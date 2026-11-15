import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const directory=fileURLToPath(new URL('.',import.meta.url));
const pinSets=await Promise.all(['assetPins.json','vehicles/assetPins.json'].map(file=>readFile(new URL(file,import.meta.url),'utf8').then(JSON.parse)));
const compiled=await build({stdin:{contents:"import {DefaultLoadingManager} from 'three';import {configureAssetDelivery} from './assetDelivery.ts';export function resolve(url){DefaultLoadingManager.setURLModifier();configureAssetDelivery();return DefaultLoadingManager.resolveURL(url);}",resolveDir:directory,sourcefile:'delivery-test-entry.ts'},bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.PROD':'true'},logLevel:'error'});
const client=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('production resolver delivers both original and authored models from their exact immutable commits',()=>{
 const previous={document:globalThis.document,location:globalThis.location};globalThis.document={baseURI:'https://robjasper2084.github.io/Jungle-Lotto/game/'};globalThis.location={hostname:'robjasper2084.github.io'};
 try{for(const pins of pinSets)for(const entry of pins.files){const local=new URL('./'+entry.path,document.baseURI).href;assert.equal(client.resolve(local+'?v=1#asset'),pins.base+(entry.source??entry.path));}const unrelated=new URL('./belle/new-local.glb',document.baseURI).href;assert.equal(client.resolve(unrelated),unrelated);}
 finally{Object.assign(globalThis,previous);}
});
test('authoring and local acceptance retain self-contained model URLs',()=>{
 const previous={document:globalThis.document,location:globalThis.location};
 try{for(const hostname of ['localhost','127.0.0.1']){globalThis.document={baseURI:'http://'+hostname+':8315/'};globalThis.location={hostname};for(const pins of pinSets)for(const entry of pins.files){const url=new URL('./'+entry.path,document.baseURI).href;assert.equal(client.resolve(url),url);}}}
 finally{Object.assign(globalThis,previous);}
});
