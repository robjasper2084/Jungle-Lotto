import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {resizeRider,parseGlb} from './mobile-rider-assets.mjs';
function fixture(image,external=false){
 const vertices=Buffer.alloc(36);for(let i=0;i<9;i++)vertices.writeFloatLE(i/3,i*4);
 const pose=Buffer.from([0,1,2,3,4,5,6,7]),bin=Buffer.concat([vertices,pose,external?Buffer.alloc(0):image]);
 const json={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:8},...external?[]:[{buffer:0,byteOffset:44,byteLength:image.length}]],images:[external?{uri:'skin.png',mimeType:'image/png'}:{bufferView:2,mimeType:'image/png'}],nodes:[{name:'Hips',children:[1]},{name:'Hand'}],skins:[{joints:[0,1]}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],animations:[{name:'Walk',channels:[],samplers:[]}]};
 const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);const out=Buffer.alloc(28+padded.length+Math.ceil(bin.length/4)*4);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);out.writeUInt32LE(out.length-28-padded.length,20+padded.length);out.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(out,28+padded.length);return out;
}
for(const external of [false,true])test('Smooth asset retains rig/geometry/animation bytes with '+(external?'external':'embedded')+' textures',async()=>{
 const png=await sharp({create:{width:2048,height:1024,channels:4,background:{r:50,g:100,b:150,alpha:.5}}}).png().toBuffer(),input=fixture(png,external);
 const output=await resizeRider(input,async uri=>{assert.equal(uri,'skin.png');return png;}),a=parseGlb(input),b=parseGlb(output);
 for(const field of ['nodes','skins','meshes','accessors','animations'])assert.deepEqual(b.json[field],a.json[field]);
 for(let i=0;i<2;i++){const old=a.json.bufferViews[i],next=b.json.bufferViews[i];assert.deepEqual(b.bin.subarray(next.byteOffset,next.byteOffset+next.byteLength),a.bin.subarray(old.byteOffset,old.byteOffset+old.byteLength));}
 const image=b.json.images[0];assert.equal(image.uri,undefined);const v=b.json.bufferViews[image.bufferView],meta=await sharp(b.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength)).metadata();assert.equal(meta.width,512);assert.equal(meta.height,256);assert.equal(meta.hasAlpha,true);
});
