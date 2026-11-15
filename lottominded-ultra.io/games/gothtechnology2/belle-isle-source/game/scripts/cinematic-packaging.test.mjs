import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
// Execute the actual configuration/hook with only Vite's identity wrapper replaced.
// This is a config unit test, not a full Vite build or GPU test.
const js=stripTypeScriptTypes(source).replace("import { defineConfig } from 'vite';",'const defineConfig=value=>value;').replace("import {defineConfig} from 'vite';",'const defineConfig=value=>value;')
 .replace(/from (['"])(\.[^'"]+)\1/g,(_match,quote,specifier)=>'from '+quote+new URL(specifier,new URL('../vite.config.ts',import.meta.url)).href+quote);
assert.ok(!/from ['"]vite['"]/.test(js),'Only the Vite wrapper is substituted');
const config=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
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
test('favicon bytes are an actual non-executable SVG, not an empty 200 substitute',async()=>{
 const svg=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
 assert.match(svg,/<svg\s[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/viewBox="0 0 64 64"/);assert.match(svg,/<path\s/);assert.doesNotMatch(svg,/<script|onload=|href=|<image/i);assert.ok(Buffer.byteLength(svg)>100);
});
test('asset copy still rejects traversal and preserves external GLB dependencies',()=>{
 assert.match(source,/if\(!source.startsWith\(path.resolve\('public'\)\+path.sep\)\)throw Error/);
 assert.match(source,/await fs.copyFile\(source,dest\)/);assert.match(source,/decodeURI\(ref.uri\)/);assert.match(source,/asset-manifest.json/);
});
