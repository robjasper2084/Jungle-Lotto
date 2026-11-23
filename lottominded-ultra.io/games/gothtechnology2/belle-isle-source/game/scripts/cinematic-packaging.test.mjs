import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {searchForWorkspaceRoot} from 'vite';
import config from '../vite.config.ts';
const source=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
// Node 24 loads the real TypeScript configuration from its file URL, including
// Vite helpers and relative adapters. No imports or configuration are replaced.
// This remains a config unit test, not a full Vite build or GPU test.
const build=config({command:'build'});
test('actual HTML transform declares a real relative SVG icon',()=>{
 const plugin=build.plugins.find(p=>p.name==='belle-runtime-assets');
 const tags=plugin.transformIndexHtml();
 assert.deepEqual(tags,[{tag:'link',attrs:{rel:'icon',type:'image/svg+xml',href:'./favicon.svg'},injectTo:'head'}]);
});
test('same explicit icon is available during development',()=>{
 const runtime=settings=>settings.plugins.find(plugin=>plugin.name==='belle-runtime-assets');
 assert.deepEqual(runtime(config({command:'serve'})).transformIndexHtml(),runtime(build).transformIndexHtml());
 assert.equal(config({command:'serve'}).publicDir,'public');assert.equal(build.publicDir,false);
});

test('configuration loads the real preview media adapter alongside the asset plugin',()=>{
 const media=build.plugins.find(plugin=>plugin.name==='belle-preview-media-revalidation');
 assert.equal(typeof media.configurePreviewServer,'function');
 assert.deepEqual(Object.keys(media).sort(),['configurePreviewServer','name']);
});
test('new document files are copied without removing vehicle or world assets',()=>{
 for(const file of ['favicon.svg','deployment-health.html','deployment-health.mjs','release-health-model.mjs','belle/vehicles/hero-hoverbike.glb','belle/nature/cherry.glb','belle/map.json','belle/beach-surface.bin','exports/rigged-heroes/DS_Armored_Rider_01.glb'])assert.ok(source.includes(`'${file}'`)||source.includes(`"${file}"`),file);
 assert.match(source,/for\(const item of assets\)await copyAsset\(item\)/);
});
test('nested deployment base and single entry stylesheet are retained',()=>{
 assert.equal(build.base,'./');assert.equal(build.build.cssCodeSplit,false);assert.equal(build.build.target,'es2022');assert.equal(build.server.port,8301);assert.equal(build.server.strictPort,true);
});
test('development file access allows only the strict workspace and the two Cadillac driver assets',()=>{
 const dev=config({command:'serve'});
 assert.equal(dev.server.fs.strict,true);
 assert.deepEqual(dev.server.fs.allow,[
  searchForWorkspaceRoot(process.cwd()),
  path.resolve('../../swoop-source/public/exports/rigged-heroes/DS_Man_01.glb'),
  path.resolve('../../swoop-source/public/exports/rigged-heroes/DS_Hoodie_Woman_01.glb'),
 ]);
});
test('favicon bytes are an actual non-executable SVG, not an empty 200 substitute',async()=>{
 const svg=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
 assert.match(svg,/<svg\s[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/viewBox="0 0 64 64"/);assert.match(svg,/<path\s/);assert.doesNotMatch(svg,/<script|onload=|href=|<image/i);assert.ok(Buffer.byteLength(svg)>100);
});
test('asset copy still rejects traversal and preserves external GLB dependencies',()=>{
 assert.match(source,/if\(!source.startsWith\(path.resolve\('public'\)\+path.sep\)\)throw Error/);
 assert.match(source,/await fs.copyFile\(source,dest\)/);assert.match(source,/decodeURI\(ref.uri\)/);assert.match(source,/asset-manifest.json/);
});
