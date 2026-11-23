/** Validate a Blender-authored, standalone Meshopt GLB before anyone promotes
 * it into game/public. Never infer that a green preview equals a live game.
 * node tools/validate-belle-glb.mjs game/output/environment/belle-bridge-visual-lod0.glb
 */
import {readFileSync,statSync} from 'node:fs';
import {extname,basename} from 'node:path';
import assert from 'node:assert/strict';

export function inspectGlb(file, {requireMeshopt=true,maxBytes=16*1024*1024}={}){
 const b=readFileSync(file);
 assert(extname(file).toLowerCase()==='.glb','Expected .glb file');
 assert(b.length>=20,'Truncated GLB');
 assert.equal(b.toString('ascii',0,4),'glTF','Not a GLB');
 assert.equal(b.readUInt32LE(4),2,'GLB version must be 2');
 assert.equal(b.readUInt32LE(8),b.length,'GLB length mismatch');
 assert(b.length<=maxBytes,'GLB exceeds '+(maxBytes/1048576).toFixed(0)+'MiB budget');
 let cursor=12,json;
 while(cursor+8<=b.length){
  const size=b.readUInt32LE(cursor),type=b.readUInt32LE(cursor+4);
  cursor+=8;assert(cursor+size<=b.length,'Invalid GLB chunk length');
  if(type===0x4e4f534a)json=JSON.parse(b.subarray(cursor,cursor+size).toString('utf8'));
  cursor+=size;
 }
 assert.equal(cursor,b.length,'Invalid final chunk');
 assert(json&&json.asset?.version==='2.0','glTF 2.0 JSON chunk missing');
 const extensions=[...(json.extensionsRequired||[]),...(json.extensionsUsed||[])];
 if(requireMeshopt)assert(extensions.includes('EXT_meshopt_compression')||extensions.includes('KHR_meshopt_compression'),'Expected Meshopt-compressed export, not just a renamed uncompressed GLB');
 assert(!extensions.includes('KHR_draco_mesh_compression'),'Runtime is configured for Meshopt, not Draco');
 assert((json.meshes||[]).length>0,'No exported meshes');
 assert((json.materials||[]).length<=8,'Too many material draw groups');
 const primitives=(json.meshes||[]).flatMap(m=>m.primitives||[]);
 assert(primitives.every(p=>(p.mode??4)===4),'Only TRIANGLES are supported');
 const indices=(json.accessors||[]),triangles=primitives.reduce((n,p)=>n+Math.floor((indices[p.indices]?.count||0)/3),0);
 assert(triangles>0,'Exported mesh triangles missing');
 return{file:basename(file),bytes:statSync(file).size,materials:(json.materials||[]).length,
  meshCount:json.meshes.length,triangles,compressed:extensions.filter(x=>x.toLowerCase().includes('meshopt'))};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{for(const file of process.argv.slice(2))console.log(JSON.stringify(inspectGlb(file)));if(process.argv.length<3)throw Error('Pass at least one GLB path');}
 catch(error){console.error(error);process.exitCode=1;}
}
