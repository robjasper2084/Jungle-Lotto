import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
// Execute the actual configuration/hook with only Vite's identity wrapper replaced.
// This is a config unit test, not a full Vite build or GPU test.
// Data URLs cannot resolve relative module imports. Inline the ACTUAL preview
// implementation (not a stub) before exercising the unchanged config hooks.
const preview=await readFile(new URL('./preview-media-server.mjs',import.meta.url),'utf8');
assert.match(source,/import \{previewMediaPlugin\} from '\.\/scripts\/preview-media-server\.mjs'/);
const configSource=source.replace("import {previewMediaPlugin} from './scripts/preview-media-server.mjs';",'');
const js=preview+'\n'+stripTypeScriptTypes(configSource).replace("import { defineConfig } from 'vite';",'const defineConfig=value=>value;').replace("import {defineConfig} from 'vite';",'const defineConfig=value=>value;');
assert.ok(!/from ['"]vite['"]/.test(js),'Vite identity wrapper is replaced, while actual preview and asset plugins are exercised');
const config=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
const build=config({command:'build'});
test('actual HTML transform declares a real relative SVG icon',()=>{
 const plugin=build.plugins.find(p=>p.name==='belle-runtime-assets');
 const tags=plugin.transformIndexHtml();
 assert.deepEqual(tags,[{tag:'link',attrs:{rel:'icon',type:'image/svg+xml',href:'./favicon.svg'},injectTo:'head'}]);
});
test('same explicit icon is available during development',()=>{
 assert.deepEqual(config({command:'serve'}).plugins.find(p=>p.name==='belle-runtime-assets').transformIndexHtml(),build.plugins.find(p=>p.name==='belle-runtime-assets').transformIndexHtml());
 assert.equal(config({command:'serve'}).publicDir,'public');assert.equal(build.publicDir,false);
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

test('preview media adapter is present but never changes build assets',()=>{const x=build.plugins.filter(p=>p.name==='belle-preview-media-revalidation');assert.equal(x.length,1);assert.equal(typeof x[0].configurePreviewServer,'function');assert.equal(typeof x[0].closeBundle,'undefined');});
