import {createRequire} from 'node:module';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(new URL('../lottominded-ultra.io/games/gothtechnology2/package.json',import.meta.url));
const {MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
const widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};

/** Encode buffer bytes without quantization, reordering, texture conversion or simplification. */
export async function compressRideModel(input){
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 if(input.readUInt32LE(0)!==0x46546c67)throw new Error('Expected GLB');
 const n=input.readUInt32LE(12),gltf=JSON.parse(input.toString('utf8',20,20+n)),binary=input.subarray(28+n);
 if(gltf.buffers?.length!==1||gltf.extensionsRequired?.includes('EXT_meshopt_compression'))return input;
 const accessors=new Map();
 for(const a of gltf.accessors??[])if(a.bufferView!==undefined){const list=accessors.get(a.bufferView)??[];list.push(a);accessors.set(a.bufferView,list);}
 const chunks=[];let offset=0,virtualOffset=0,compressed=0;
 for(const [i,view] of (gltf.bufferViews??[]).entries()){
  if(view.buffer!==0)throw new Error('Unexpected GLB buffer');
  const bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),attrs=accessors.get(i);
  let encoded,description;
  if(attrs?.length&&bytes.length>=256&&!attrs.some(a=>a.sparse)){
   const a=attrs[0],stride=view.byteStride??widths[a.componentType]*components[a.type];
   // INDICES preserves exact ordering, including the first vertex in a triangle.
   const mode=view.target===34963?'INDICES':'ATTRIBUTES';
   if(stride&&bytes.length%stride===0&&((mode==='INDICES'&&[2,4].includes(stride))||(mode==='ATTRIBUTES'&&stride%4===0&&stride<=256))){
    const count=bytes.length/stride;let candidate=MeshoptEncoder.encodeGltfBuffer(bytes,count,stride,mode,0),filter='NONE';
    // A per-component exponential filter at full float precision often makes
    // measured terrain much smaller. Keep it only after an exact byte comparison.
    if(mode==='ATTRIBUTES'&&attrs.every(a=>a.componentType===5126)&&bytes.byteOffset%4===0){
     const floats=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
     const filtered=MeshoptEncoder.encodeFilterExp(floats,count,stride,24,'Separate');
     const alternative=MeshoptEncoder.encodeGltfBuffer(filtered,count,stride,mode,0),roundtrip=new Uint8Array(bytes.length);
     MeshoptDecoder.decodeGltfBuffer(roundtrip,count,stride,alternative,mode,'EXPONENTIAL');
     if(alternative.length<candidate.length&&Buffer.from(roundtrip).equals(bytes)){candidate=alternative;filter='EXPONENTIAL';}
    }
    if(candidate.length+128<bytes.length){
     const decoded=new Uint8Array(bytes.length);MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,candidate,mode,filter);
     if(!Buffer.from(decoded).equals(bytes))throw new Error('Lossless geometry round trip failed');
     encoded=Buffer.from(candidate);description={buffer:0,byteOffset:offset,byteLength:encoded.length,byteStride:stride,count,mode,filter};
    }
   }
  }
  const payload=encoded??bytes,padded=Buffer.alloc(Math.ceil(payload.length/4)*4);payload.copy(padded);chunks.push(padded);
  if(encoded){view.buffer=1;view.byteOffset=virtualOffset;view.extensions={...view.extensions,EXT_meshopt_compression:description};virtualOffset+=Math.ceil(bytes.length/4)*4;compressed++;}
  else view.byteOffset=offset;
  offset+=padded.length;
 }
 if(!compressed)return input;
 gltf.buffers=[{byteLength:offset},{byteLength:virtualOffset}];
 gltf.extensionsUsed=[...new Set([...(gltf.extensionsUsed??[]),'EXT_meshopt_compression'])];
 gltf.extensionsRequired=[...new Set([...(gltf.extensionsRequired??[]),'EXT_meshopt_compression'])];
 const json=Buffer.from(JSON.stringify(gltf)),paddedJson=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(paddedJson);
 const result=Buffer.alloc(28+paddedJson.length+offset);
 [0x46546c67,2,result.length,paddedJson.length,0x4e4f534a].forEach((v,i)=>result.writeUInt32LE(v,i*4));paddedJson.copy(result,20);
 result.writeUInt32LE(offset,20+paddedJson.length);result.writeUInt32LE(0x004e4942,24+paddedJson.length);Buffer.concat(chunks).copy(result,28+paddedJson.length);
 return result.length<input.length?result:input;
}

export async function compressRideModels(outputRoot){
 const arcade=resolve(outputRoot,'lottominded-ultra.io/games/gothtechnology2/arcade');let saved=0,models=0;
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const path=resolve(dir,e.name);if(e.isDirectory())await walk(path);else if(e.name.endsWith('.glb')){const input=await readFile(path),output=await compressRideModel(input);if(output.length<input.length){await writeFile(path,output);saved+=input.length-output.length;models++;}}}}
 for(const game of ['swoop-detroit','elmwood-explorer'])await walk(resolve(arcade,game));
 console.log(`Losslessly compressed ${models} ride models; saved ${(saved/1048576).toFixed(1)} MiB.`);return {saved,models};
}
