import fs from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {MeshoptEncoder} from 'meshoptimizer';
/** Exact Float32 vertex reuse, with triangle order and winding unchanged. */
export function indexStreetTile(positions){
 const bits=new Uint32Array(positions.buffer,positions.byteOffset,positions.length),lookup=new Map(),vertices=[],indices=new Uint32Array(positions.length/3);
 for(let i=0;i<positions.length;i+=3){const key=bits[i]+','+bits[i+1]+','+bits[i+2];let index=lookup.get(key);if(index===undefined){index=vertices.length/3;lookup.set(key,index);vertices.push(positions[i],positions[i+1],positions[i+2]);}indices[i/3]=index;}
 return {positions:new Float32Array(vertices),indices};
}
export async function indexStreetSurfaces(dir){
 const meta=JSON.parse(await fs.readFile(resolve(dir,'street-surfaces.json'),'utf8')),raw=gunzipSync(await fs.readFile(resolve(dir,'street-surfaces.bin.gz'))),positions=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4);
 await MeshoptEncoder.ready;
 const chunks=[],tiles=[];let offset=0,encodedOffset=0;
 for(const tile of meta.tiles){const indexed=indexStreetTile(positions.subarray(tile.offset,tile.offset+tile.count));
  const vertices=MeshoptEncoder.encodeVertexBufferLevel(new Uint8Array(indexed.positions.buffer),indexed.positions.length/3,12,2,0),indices=MeshoptEncoder.encodeIndexSequence(new Uint8Array(indexed.indices.buffer),indexed.indices.length,4);
  tiles.push({...tile,offset,count:indexed.positions.length,indexOffset:offset+indexed.positions.length,indexCount:indexed.indices.length,encodedOffset,vertexBytes:vertices.length,indexBytes:indices.length});chunks.push(vertices,indices);offset+=indexed.positions.length+indexed.indices.length;encodedOffset+=vertices.length+indices.length;
 }
 const result={...meta,version:2,encoding:'meshopt',values:offset,tiles};
 await fs.writeFile(resolve(dir,'street-surfaces-indexed.json'),JSON.stringify(result));
 const bytes=gzipSync(Buffer.concat(chunks),{level:9});await fs.writeFile(resolve(dir,'street-surfaces-indexed.bin.gz'),bytes);
 return {triangles:meta.triangles,oldBytes:raw.length,newBytes:offset*4,downloadBytes:bytes.length};
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename)console.log(await indexStreetSurfaces(resolve(import.meta.dirname,'../swoop-source/public/exports/street-life')));
