import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gothtechnologyPath, requiredStoreFiles, readGothtechnologyBuild, copyGothtechnologyBuild } from './gothtechnology-pages.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'goth-pages-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('goth-pages-'));
    await rm(root, {recursive:true, force:true});
  });
  return root;
}
async function write(root, path, content='fixture') {
  const target = join(root, path);
  await mkdir(dirname(target), {recursive:true});
  await writeFile(target, content);
}

test('Pages assembly fails before publishing an absent or partial store build', async t => {
  const root = await fixture(t);
  await assert.rejects(readGothtechnologyBuild(root), /missing index.html/);
  await write(root, gothtechnologyPath + '/dist/index.html');
  await assert.rejects(readGothtechnologyBuild(root), /missing shop\/index.html/);
});

test('Pages assembly includes compiled routes, lazy chunks and videos without touching other apps', async t => {
  const root = await fixture(t);
  const files = [...requiredStoreFiles, '_store/lazy.js', 'media/keychain.webp', '.nojekyll'];
  for (const file of files) await write(root, gothtechnologyPath + '/dist/' + file, file);
  await write(root, '_site/another-game/index.html', 'unchanged');
  const entries = await readGothtechnologyBuild(root);
  assert.equal(entries.length, files.length);
  const bytes = await copyGothtechnologyBuild(entries, join(root, '_site'));
  assert.equal(bytes, files.reduce((sum, name) => sum + Buffer.byteLength(name), 0));
  assert.equal(await readFile(join(root, '_site', gothtechnologyPath, '_store/lazy.js'), 'utf8'), '_store/lazy.js');
  assert.equal(await readFile(join(root, '_site/another-game/index.html'), 'utf8'), 'unchanged');
});

test('Pages assembly refuses private environment files in generated output', async t => {
  const root = await fixture(t);
  for (const file of requiredStoreFiles) await write(root, gothtechnologyPath + '/dist/' + file);
  await write(root, gothtechnologyPath + '/dist/.env', 'not-a-real-secret');
  await assert.rejects(readGothtechnologyBuild(root), /Refusing to publish/);
});
