import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {loadStreetSurfaceCache} from './streetSurfaceCache.ts';
test('compact street cache preserves every triangle coordinate and winding exactly',async()=>{
 const base=new URL('../../public/exports/street-life/',import.meta.url),old=JSON.parse(await fs.readFile(new URL('street-surfaces.json',base),'utf8')),meta=JSON.parse(await fs.readFile(new URL('street-surfaces-indexed.json',base),'utf8'));
 const raw=gunzipSync(await fs.readFile(new URL('street-surfaces.bin.gz',base))),source=new Uint32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),bytes=gunzipSync(await fs.readFile(new URL('street-surfaces-indexed.bin.gz',base)));
 await MeshoptDecoder.ready;assert.equal(meta.triangles,old.triangles);assert.equal(meta.tiles.length,old.tiles.length);let decodedBytes=0;
 for(let t=0;t<meta.tiles.length;t++){const tile=meta.tiles[t],original=old.tiles[t],p=new Uint32Array(tile.count),indices=new Uint32Array(tile.indexCount);
  MeshoptDecoder.decodeVertexBuffer(new Uint8Array(p.buffer),p.length/3,12,bytes.subarray(tile.encodedOffset,tile.encodedOffset+tile.vertexBytes));MeshoptDecoder.decodeIndexSequence(new Uint8Array(indices.buffer),indices.length,4,bytes.subarray(tile.encodedOffset+tile.vertexBytes,tile.encodedOffset+tile.vertexBytes+tile.indexBytes));
  assert.equal(indices.length*3,original.count);for(let i=0;i<indices.length;i++)for(let axis=0;axis<3;axis++)assert.equal(p[indices[i]*3+axis],source[original.offset+i*3+axis]);decodedBytes+=p.byteLength+indices.byteLength;
 }
 assert(decodedBytes<raw.byteLength*.65);assert((await fs.stat(new URL('street-surfaces-indexed.bin.gz',base))).size<(await fs.stat(new URL('street-surfaces.bin.gz',base))).size*.7);
});
test('browser loader decodes the compact asset and supplies valid index views',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),fetch=globalThis.fetch;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{}});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete (globalThis as any).document;globalThis.fetch=fetch;});
 const base=new URL('../../public/exports/street-life/',import.meta.url);globalThis.fetch=async url=>new Response(await fs.readFile(new URL(String(url).split('/').at(-1)!,base)));
 const result=await loadStreetSurfaceCache();assert.equal(result?.version,2);assert(result?.indices);assert.equal(result.positions.buffer,result.indices.buffer);assert(result.tiles.every(t=>t.count%3===0&&t.indexCount!%3===0));
});
