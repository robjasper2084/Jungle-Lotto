import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { copyGameBuilds, gameBuilds, readGameBuilds } from "./game-pages.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "game-pages-"));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith("game-pages-"));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function write(root, path, content = "fixture") {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function completeBuild(root, game) {
  const prefix = `${game.path}/${game.dist}`;
  for (const file of game.required) await write(root, `${prefix}/${file}`, file);
  await write(root, `${prefix}/assets/build/app.js`);
  await write(root, `${prefix}/assets/build/app.css`);
  await write(root, `${prefix}/assets/runtime.js`);
  await write(root, `${prefix}/assets/runtime.css`);
}

test("Pages assembly requires complete production game builds", async (t) => {
  const root = await fixture(t);
  await assert.rejects(readGameBuilds(root), /fortune-grid build is missing index.html/);
  for (const game of gameBuilds) await completeBuild(root, game);
  await rm(join(root, gameBuilds[1].path, gameBuilds[1].dist, "sw.js"));
  await assert.rejects(readGameBuilds(root), /jackpot-maze build is missing sw.js/);
});

test("Pages assembly copies game builds without source files", async (t) => {
  const root = await fixture(t);
  for (const game of gameBuilds) await completeBuild(root, game);
  const entries = await readGameBuilds(root);
  const output = join(root, "_site");
  const bytes = await copyGameBuilds(entries, output);
  assert.ok(bytes > 0);
  assert.equal(
    await readFile(join(output, gameBuilds[0].path, "index.html"), "utf8"),
    "index.html",
  );
  assert.ok(entries.every(({ path }) => !/\.(?:ts|tsx|map)$/.test(path)));
});

test("Pages assembly refuses source maps and private files", async (t) => {
  const root = await fixture(t);
  for (const game of gameBuilds) await completeBuild(root, game);
  const fortune = gameBuilds[0];
  await write(root, `${fortune.path}/${fortune.dist}/assets/app.js.map`);
  await assert.rejects(readGameBuilds(root), /Refusing to publish/);
});
