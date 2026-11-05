import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';
import {mobileRiderUrl} from './mobileRiderUrl.ts';
import {mobileRiderUrl as elmwoodUrl} from '../../../elmwood-source/src/detroit/mobileRiderUrl.ts';
import {loadStreetSurfaceCache,STREET_CACHE_REVISION} from './streetSurfaceCache.ts';
import {previewContentType} from '../../../docs/combat/scripts/device-preview-mime.mjs';
for(const [name,urlFor] of [['Swoop/Royale',mobileRiderUrl],['Elmwood',elmwoodUrl]] as const)test(name+': only mobile Smooth selects smaller riders',()=>{
 const url='/arcade/swoop-detroit/exports/rigged-heroes/DS_Man_01.glb?v=2';assert.match(urlFor(url,true,512),/mobile-512-20261017\/DS_Man_01.glb\?v=2$/);for(const limit of [1024,2048,4096])assert.equal(urlFor(url,true,limit),url);assert.equal(urlFor(url,false,512),url);assert.equal(urlFor('/exports/custom.glb',true,512),'/exports/custom.glb');
});
test('preview permits both compressed map formats and street cache but rejects source/credentials',()=>{
 for(const file of ['swoop-detroit.browser.json.gz','swoop-detroit.physics-123456789abcdef0.bin.gz','street-surfaces.bin.gz','elmwood-explorer.json.gz'])assert.equal(previewContentType(file),'application/gzip');
 for(const file of ['source.ts','config.toml','private.key','run.exe'])assert.equal(previewContentType(file),undefined);
});
for(const native of [true,false])test('street cache decodes exact coordinates using '+(native?'native stream':'compatibility fallback'),async t=>{
 const oldDoc=Object.getOwnPropertyDescriptor(globalThis,'document'),oldFetch=globalThis.fetch,oldStream=globalThis.DecompressionStream;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{}});if(!native)globalThis.DecompressionStream=undefined as never;
 t.after(()=>{if(oldDoc)Object.defineProperty(globalThis,'document',oldDoc);else delete (globalThis as any).document;globalThis.fetch=oldFetch;globalThis.DecompressionStream=oldStream;});
 const positions=new Float32Array([1,2,3,4,5,6,7,8,9]),zip=gzipSync(new Uint8Array(positions.buffer));let paths:string[]=[];
 globalThis.fetch=async input=>{paths.push(String(input));return String(input).endsWith('.json')?Response.json({revision:STREET_CACHE_REVISION,sections:1,triangles:1,values:9,tiles:[{x:0,z:0,material:'road',offset:0,count:9}]}):new Response(zip);};
 const result=await loadStreetSurfaceCache();assert.deepEqual(result?.positions,positions);assert.equal(paths.length,2);
});
