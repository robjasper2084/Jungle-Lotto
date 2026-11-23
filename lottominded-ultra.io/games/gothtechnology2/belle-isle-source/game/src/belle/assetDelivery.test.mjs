import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const directory=fileURLToPath(new URL('.',import.meta.url));
const pinSets=await Promise.all(['assetPins.json','vehicles/assetPins.json','cadillacHeroPins.json','hydraulicCadillacPins.json'].map(file=>readFile(new URL(file,import.meta.url),'utf8').then(JSON.parse)));
const compiled=await build({stdin:{contents:"import {DefaultLoadingManager} from 'three';import {configureAssetDelivery} from './assetDelivery.ts';export function resolve(url){DefaultLoadingManager.setURLModifier();configureAssetDelivery();return DefaultLoadingManager.resolveURL(url);}export function prepare(){DefaultLoadingManager.setURLModifier();configureAssetDelivery();}",resolveDir:directory,sourcefile:'delivery-test-entry.ts'},bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.PROD':'true'},logLevel:'error'});
const client=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('production resolver delivers Belle Isle scenery, vehicles and Cadillac drivers from exact immutable commits',()=>{
 const previous={document:globalThis.document,location:globalThis.location};globalThis.document={baseURI:'https://robjasper2084.github.io/Jungle-Lotto/game/'};globalThis.location={hostname:'robjasper2084.github.io'};
 try{for(const pins of pinSets)for(const entry of pins.files){const local=new URL('./'+entry.path,document.baseURI).href;assert.equal(client.resolve(local+'?v=1#asset'),pins.base+(entry.source??entry.path));}const unrelated=new URL('./belle/new-local.glb',document.baseURI).href;assert.equal(client.resolve(unrelated),unrelated);}
 finally{Object.assign(globalThis,previous);}
});
test('authoring and local acceptance retain self-contained model URLs',()=>{
 const previous={document:globalThis.document,location:globalThis.location};
 try{for(const hostname of ['localhost','127.0.0.1']){globalThis.document={baseURI:'http://'+hostname+':8315/'};globalThis.location={hostname};for(const pins of pinSets)for(const entry of pins.files){const url=new URL('./'+entry.path,document.baseURI).href;assert.equal(client.resolve(url),url);}}}
 finally{Object.assign(globalThis,previous);}
});

test('production warmup hints the pinned host and only the essential skyline GLB',()=>{
 const previous={document:globalThis.document,location:globalThis.location};
 const links=[];
 globalThis.document={baseURI:'https://robjasper2084.github.io/Jungle-Lotto/game/',
  head:{querySelectorAll:()=>links,append:link=>links.push(link)},
  createElement:()=>({dataset:{},href:'',rel:'',as:'',crossOrigin:'',fetchPriority:''})};
 globalThis.location={hostname:'robjasper2084.github.io'};
 try{
  client.prepare();client.prepare();
  const connections=links.filter(link=>link.rel==='preconnect');
  const preloads=links.filter(link=>link.rel==='preload');
  assert.equal(connections.length,1);
  assert.equal(connections[0].href,'https://raw.githubusercontent.com/');
  assert.equal(preloads.length,1);
  assert.equal(preloads[0].href,pinSets[0].base+'belle/detroit-skyline.glb');
  assert.equal(preloads[0].as,'fetch');
  assert.equal(preloads[0].crossOrigin,'anonymous');
  assert.equal(preloads[0].fetchPriority,'high');
  assert.ok(!links.some(link=>link.href.includes('landmarks-delivery.glb')));
 }finally{Object.assign(globalThis,previous);}
});
