import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
export const MOBILE_RIDER_DIRECTORY='mobile-512-20261017';
export const RIDERS=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
export function parseGlb(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB');
 const size=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+size));
 if(json.buffers.length!==1||json.buffers[0].uri||(json.extensionsUsed??[]).some(x=>/meshopt|draco/i.test(x)))throw Error('Expected uncompressed, single-buffer rider');
 return {json,bin:bytes.subarray(28+size)};
}
/** Derived Smooth assets only. Preserve every non-image buffer byte and rig field;
 * rebuild buffer offsets after resizing embedded or external texture images. */
export async function resizeRider(bytes,readImage,maxSize=512){
 const {json,bin}=parseGlb(bytes),imageViews=new Set(),replacements=new Map();
 for(const image of json.images??[]){
  const index=image.bufferView,view=index===undefined?undefined:json.bufferViews[index];
  const source=view?bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength):await readImage(image.uri);
  const texture=await sharp(source).resize({width:maxSize,height:maxSize,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
  const id=index??json.bufferViews.length;
  if(index===undefined)json.bufferViews.push({buffer:0,byteLength:0});
  imageViews.add(id);replacements.set(id,texture);image.bufferView=id;image.mimeType='image/png';delete image.uri;
 }
 let offset=0;const chunks=[];
 for(const [i,view] of json.bufferViews.entries()){
  const data=replacements.get(i)??bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  view.byteOffset=offset;view.byteLength=data.length;const padded=Buffer.alloc(Math.ceil(data.length/4)*4);data.copy(padded);chunks.push(padded);offset+=padded.length;
 }
 json.buffers[0].byteLength=offset;const raw=Buffer.from(JSON.stringify(json)),header=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(header);
 const out=Buffer.alloc(28+header.length+offset);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(header.length,12);out.writeUInt32LE(0x4e4f534a,16);header.copy(out,20);out.writeUInt32LE(offset,20+header.length);out.writeUInt32LE(0x004e4942,24+header.length);Buffer.concat(chunks).copy(out,28+header.length);
 // Fail packaging rather than ship changed joint, animation or geometry bytes.
 const before=parseGlb(bytes),after=parseGlb(out);
 for(const field of ['nodes','skins','meshes','animations','accessors'])if(JSON.stringify(before.json[field])!==JSON.stringify(after.json[field]))throw Error('Rider structure changed: '+field);
 before.json.bufferViews.forEach((v,i)=>{if(imageViews.has(i))return;const w=after.json.bufferViews[i];if(!before.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength).equals(after.bin.subarray(w.byteOffset,w.byteOffset+w.byteLength)))throw Error('Rider buffer changed: '+i);});
 return out;
}
export async function buildMobileRiders(root){
 const reports=[];const dir=resolve(root,'exports/rigged-heroes'),outDir=resolve(dir,MOBILE_RIDER_DIRECTORY);await mkdir(outDir,{recursive:true});
 for(const id of RIDERS){const file=resolve(dir,id+'.glb'),bytes=await readFile(file);let externalBytes=0;
  const output=await resizeRider(bytes,async uri=>{if(!uri||/^(data:|https?:|\/)/.test(uri))throw Error('Unexpected rider image URI');const path=resolve(dirname(file),decodeURIComponent(uri));if(!path.startsWith(resolve(root)+sep))throw Error('Image outside package');const data=await readFile(path);externalBytes+=data.length;return data;});
  await writeFile(resolve(outDir,id+'.glb'),output);reports.push({id,originalBytes:bytes.length+externalBytes,mobileBytes:output.length});
 }
 await writeFile(resolve(outDir,'manifest.json'),JSON.stringify({textureLimit:512,preserves:'Exact non-image buffers, joints, meshes and animations',models:reports},null,2));
 console.log('Smooth rider assets: '+JSON.stringify(reports));return reports;
}
