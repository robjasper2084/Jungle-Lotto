import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gothtechnologyPath, requiredStoreFiles, readGothtechnologyBuild, copyGothtechnologyBuild, shareShadowOpsAssets } from './gothtechnology-pages.mjs';

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

test('Pages shares identical cabinet assets and resolves both document and module URLs',async t=>{
  const root=await fixture(t),cabinet=gothtechnologyPath+'/arcade/shadow-ops-canvas/';
  const entries=[];
  for(const [path,content] of [['assets/hero.png','same-image'],['src/game.js','const image="./assets/hero.png";'],['src/title-3d.js','new URL("../assets/hero.png",import.meta.url)'],['style.css','url("./assets/hero.png")']]){
    const source=join(root,'build',path);await write(root,'build/'+path,content);entries.push({source,path:cabinet+path,bytes:Buffer.byteLength(content)});
  }
  const canonical='lottominded-ultra.io/games/shadow-ops-canvas/assets/hero.png';
  await write(root,'_site/'+canonical,'same-image');
  const shared=await shareShadowOpsAssets(entries,join(root,'_site'));assert.equal(shared.length,3);
  await copyGothtechnologyBuild(shared,join(root,'_site'));
  const pageURL=new URL('https://example.test/Jungle-Lotto/'+cabinet);
  for(const entry of shared){
    const url=entry.content.match(/"([^"]*assets\/hero.png)"/)[1];
    const base=entry.path.endsWith('title-3d.js')?new URL('src/title-3d.js',pageURL):pageURL;
    assert.equal(new URL(url,base).href,'https://example.test/Jungle-Lotto/'+canonical);
  }
  assert.equal(await readFile(entries[1].source,'utf8'),'const image="./assets/hero.png";','the original local build is unchanged');
  await write(root,'_site/'+canonical,'different-image');
  assert.equal((await shareShadowOpsAssets(entries,join(root,'_site'))).length,4,'different media must remain independent');
});

test('Pages retains original media URLs consumed by Vault Rush and the arcade catalog',async t=>{
  const root=await fixture(t),cabinet=gothtechnologyPath+'/arcade/shadow-ops-canvas/';
  const names=['mascot/lottomind-mascot-runner-atlas.png','backgrounds/higgsfield-soul-location-backplate.png','other.png'];
  const entries=[];
  for(const name of names){
    const source=join(root,'build/assets',name);
    await write(root,'build/assets/'+name,'same');
    await write(root,'_site/lottominded-ultra.io/games/shadow-ops-canvas/assets/'+name,'same');
    entries.push({source,path:cabinet+'assets/'+name,bytes:4});
  }
  const shared=await shareShadowOpsAssets(entries,join(root,'_site'));assert.equal(shared.length,2);
  await copyGothtechnologyBuild(shared,join(root,'_site'));
  for(const name of names.slice(0,2))assert.equal(await readFile(join(root,'_site',cabinet,'assets',name),'utf8'),'same');
});
