// Keep original meshes, materials, pivots and UVs. Downsample embedded maps for the combined scene.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const src=process.argv[2]||fileURLToPath(new URL('../../elmwood-source/public/elmwood/models/',import.meta.url));
const dest=new URL('../../belle-isle-source/game/src/belle/districtModels/',import.meta.url);
await mkdir(dest,{recursive:true});
for(const name of ['elmwood-gatehouse','elmwood-entrance-sign','elmwood-chapel']){
 const bytes=await readFile(path.join(src,name+'.glb')),jl=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jl)),bin=bytes.subarray(28+jl),parts=[];
 let length=0;
 for(const [i,view] of gltf.bufferViews.entries()){
  let chunk=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  const img=gltf.images?.find(im=>im.bufferView===i);
  if(img){
   const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0','-vf','scale=384:384:force_original_aspect_ratio=decrease','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{input:chunk,maxBuffer:8*1024*1024,windowsHide:true});
   if(result.status!==0)throw Error('Texture conversion failed for '+name+' '+result.stderr);
   img.mimeType='image/png';chunk=result.stdout;
  }
  view.byteOffset=length;view.byteLength=chunk.length;
  const pad=Buffer.alloc((4-chunk.length%4)%4);parts.push(chunk,pad);length+=chunk.length+pad.length;
 }
 gltf.buffers[0].byteLength=length;
 const json=Buffer.from(JSON.stringify(gltf)),padding=Buffer.alloc((4-json.length%4)%4,32),jsonLen=json.length+padding.length;
 const header=Buffer.alloc(20),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonLen+length,8);header.writeUInt32LE(jsonLen,12);header.write('JSON',16);bh.writeUInt32LE(length);bh.write('BIN\0',4);
 await writeFile(new URL(name+'.glb',dest),Buffer.concat([header,json,padding,bh,...parts]));console.log(name,header.readUInt32LE(8));
}
