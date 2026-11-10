// Optional display-only indices. Full authoring and collision geometry is unchanged.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from '../game/node_modules/meshoptimizer/meshopt_simplifier.js';
import {MeshoptEncoder} from '../game/node_modules/meshoptimizer/meshopt_encoder.js';
const source=new URL('../game/public/belle/landmarks.glb',import.meta.url);
const bytes=await fs.readFile(source),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size)),bin=bytes.subarray(28+size);
await Promise.all([MeshoptSimplifier.ready,MeshoptEncoder.ready]);
const hash=array=>{let h=2166136261;for(const v of array)h=Math.imul(h^v,16777619);return h>>>0;};
const read=i=>{const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],C=({5126:Float32Array,5125:Uint32Array,5123:Uint16Array})[a.componentType],n=({SCALAR:1,VEC3:3})[a.type];if(!C||!n||a.sparse||v.byteStride&&v.byteStride!==n*C.BYTES_PER_ELEMENT)throw Error('Unsupported accessor '+i);const start=(v.byteOffset??0)+(a.byteOffset??0),raw=bin.subarray(start,start+a.count*n*C.BYTES_PER_ELEMENT);return new C(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));};
const entries=[],parts=[];let offset=0;
for(let mi=0;mi<doc.meshes.length;mi++)for(let pi=0;pi<doc.meshes[mi].primitives.length;pi++){
 const p=doc.meshes[mi].primitives[pi];if(p.mode!==undefined&&p.mode!==4||p.targets||p.attributes.JOINTS_0!==undefined||p.indices===undefined)continue;
 const indices=new Uint32Array(read(p.indices));if(indices.length<6000)continue;
 const positions=read(p.attributes.POSITION);
 const [reduced,error]=MeshoptSimplifier.simplify(indices,positions,3,Math.floor(indices.length*.25/3)*3,.04,['ErrorAbsolute']);
 if(reduced.length>indices.length*.85)continue;
 const packed=MeshoptEncoder.encodeIndexSequence(reduced,reduced.length,4);
 entries.push({mesh:mi,primitive:pi,name:doc.meshes[mi].name,vertices:positions.length/3,originalCount:indices.length,hash:hash(indices),count:reduced.length,offset,length:packed.length,error});parts.push(Buffer.from(packed));offset+=packed.length;
}
const report={version:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),entries};
await fs.writeFile(new URL('../game/public/belle/landmark-detail.bin',import.meta.url),Buffer.concat(parts));
await fs.writeFile(new URL('../game/public/belle/landmark-detail.json',import.meta.url),JSON.stringify(report));
console.log(JSON.stringify({meshes:entries.length,bytes:offset,before:entries.reduce((s,e)=>s+e.originalCount/3,0),after:entries.reduce((s,e)=>s+e.count/3,0),maxError:Math.max(...entries.map(e=>e.error))}));
