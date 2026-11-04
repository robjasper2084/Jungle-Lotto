// Lossless delivery compression; authoring GLB is retained in public/belle.
import fs from 'node:fs/promises';
import {MeshoptEncoder} from '../game/node_modules/meshoptimizer/meshopt_encoder.js';
import {MeshoptDecoder} from '../game/node_modules/meshoptimizer/meshopt_decoder.mjs';
import assert from 'node:assert/strict';
const file=new URL('../game/dist/belle/landmarks.glb',import.meta.url);
const input=await fs.readFile(file),jsonLength=input.readUInt32LE(12);
const doc=JSON.parse(input.subarray(20,20+jsonLength).toString());
if(doc.extensionsRequired?.includes('EXT_meshopt_compression'))throw Error('Already compressed; rebuild first');
const bin=input.subarray(28+jsonLength);await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const pieces=[];let length=0,decodedLength=0,packed=0;
function append(bytes){const offset=length;pieces.push(Buffer.from(bytes));length+=bytes.length;const pad=(4-length%4)%4;if(pad){pieces.push(Buffer.alloc(pad));length+=pad;}return offset;}
const componentSize={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
for(let index=0;index<doc.bufferViews.length;index++){
 const view=doc.bufferViews[index],raw=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
 const uses=doc.accessors.filter(a=>a.bufferView===index);
 const a=uses.length===1?uses[0]:null;
 const stride=a?(view.byteStride??componentSize[a.componentType]*components[a.type]):0;
 const valid=a&&!a.sparse&&!(a.byteOffset??0)&&a.count*stride===raw.length;
 // INDICES preserves exact index order, including provoking vertices.
 const mode=view.target===34963?'INDICES':'ATTRIBUTES';
 const supported=valid&&(mode==='INDICES'?[2,4].includes(stride):stride%4===0&&stride<=256);
 if(supported){
  const encoded=MeshoptEncoder.encodeGltfBuffer(raw,a.count,stride,mode);
  const check=new Uint8Array(raw.length);MeshoptDecoder.decodeGltfBuffer(check,a.count,stride,encoded,mode);
  assert.deepEqual(Buffer.from(check),raw,'Lossless roundtrip view '+index);
  if(encoded.length<raw.length){
   view.extensions={...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:append(encoded),byteLength:encoded.length,byteStride:stride,count:a.count,mode}};
   view.buffer=1;view.byteOffset=decodedLength;decodedLength+=raw.length;decodedLength=(decodedLength+3)&~3;packed++;continue;
  }
 }
 view.buffer=0;view.byteOffset=append(raw);
}
doc.buffers=[{byteLength:length},{byteLength:decodedLength,extensions:{EXT_meshopt_compression:{fallback:true}}}];
for(const name of ['extensionsUsed','extensionsRequired'])doc[name]=[...new Set([...(doc[name]??[]),'EXT_meshopt_compression'])];
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(length);binHeader.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,binHeader,...pieces]);await fs.writeFile(file,output);
const report={inputBytes:input.length,outputBytes:output.length,savedPercent:100*(1-output.length/input.length),compressedViews:packed,losslessRoundtrip:true};
await fs.writeFile(new URL('../qa/landmark-compression-20261103.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
