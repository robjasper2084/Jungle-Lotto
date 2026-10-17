import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneRidingBundles} from './prune-riding-bundles.mjs';
test('retains entry, dynamic import, CSS media and cross-game references; omits obsolete cycles', async () => {
  const prefix='site/arcade/swoop-detroit/';
  const fixtures=[
    ['index.html','assets/main-12345678.js'],
    ['assets/main-12345678.js','import("./lazy-abcdefgh.js"); "style-12345678.css"'],
    ['assets/lazy-abcdefgh.js','"sky-abcdefgh.hdr"'],
    ['assets/style-12345678.css','url(poster-abcdefgh.webp)'],
    ['assets/sky-abcdefgh.hdr',''],['assets/poster-abcdefgh.webp',''],
    ['assets/old-12345678.js','"old-abcdefgh.js"'],
    ['assets/old-abcdefgh.js','"old-12345678.js"'],
    ['assets/manual.js',''],['assets/unused-abcdefgh.mp4',''],
    ['assets/shared-abcdefgh.js',''],
  ].map(([path,content])=>({path:prefix+path,content,bytes:10}));
  fixtures.push({path:'site/arcade/elmwood-explorer/elmwood.html',content:'../swoop-detroit/assets/shared-abcdefgh.js',bytes:10});
  const result=await pruneRidingBundles(fixtures);
  assert.deepEqual(result.omitted.map(f=>f.path.slice(prefix.length)),['assets/old-12345678.js','assets/old-abcdefgh.js','assets/unused-abcdefgh.mp4']);
  assert.equal(result.saved,30);assert.equal(fixtures.length,12);
});
test('does not prune other games or non-hashed authored assets', async()=>{
 const files=[{path:'site/arcade/other/assets/old-12345678.js',content:'',bytes:1},{path:'site/arcade/swoop-detroit/assets/authored.png',bytes:2}];
 assert.deepEqual((await pruneRidingBundles(files)).files,files);
});
