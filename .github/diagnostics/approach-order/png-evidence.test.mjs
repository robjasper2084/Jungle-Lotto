import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {crc32,decodePng,verifyCapture} from './png-evidence.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);return out;}
function png(width,height,rgba,channels=4,filter=0){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=channels===4?6:2;
 const stride=width*channels,scan=Buffer.alloc((stride+1)*height),previous=Buffer.alloc(stride);
 for(let y=0;y<height;y++){const row=Buffer.alloc(stride);for(let x=0;x<width;x++)for(let c=0;c<channels;c++)row[x*channels+c]=rgba[(y*width+x)*4+c];scan[y*(stride+1)]=filter;
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;scan[y*(stride+1)+1+x]=(row[x]-predictor)&255;}row.copy(previous);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
const pixels=Buffer.from([1,2,3,255,17,23,69,255,120,99,16,255,254,48,90,255]);
test('all five lossless PNG filters decode exact original RGBA and RGB channels',()=>{
 for(const channels of [3,4])for(let filter=0;filter<=4;filter++)assert(decodePng(png(2,2,pixels,channels,filter),{width:2,height:2}).equals(pixels));
});
test('PNG is bound to unmodified bottom-up raw pixels with an explicit opaque alpha policy',()=>{
 const raw=Buffer.concat([pixels.subarray(8),pixels.subarray(0,8)]),image=png(2,2,pixels);
 const receipt=verifyCapture(image,raw,{width:2,height:2,pixelSha256:hash(raw)});assert.equal(receipt.decodedRgbaSha256,hash(pixels));
 assert.throws(()=>verifyCapture(image,pixels,{width:2,height:2,pixelSha256:hash(pixels)}),/differ/);
 const changed=Buffer.from(raw);changed[0]++;assert.throws(()=>verifyCapture(image,changed,{width:2,height:2,pixelSha256:hash(changed)}),/differ/);
 const alpha=Buffer.from(raw);alpha[3]=254;assert.throws(()=>verifyCapture(image,alpha,{width:2,height:2,pixelSha256:hash(alpha)}),/nonopaque/);
 assert.throws(()=>verifyCapture(image,raw,{width:2,height:2,pixelSha256:'0'.repeat(64)}),/hash/);
});
test('damaged CRC, unsupported interlace and wrong dimensions are rejected',()=>{
 const image=png(2,2,pixels),broken=Buffer.from(image);broken[40]^=1;assert.throws(()=>decodePng(broken,{width:2,height:2}),/CRC/);
 assert.throws(()=>decodePng(image,{width:1,height:2}));
 const interlaced=Buffer.from(image);interlaced[28]=1;interlaced.writeUInt32BE(crc32(interlaced.subarray(12,29)),29);assert.throws(()=>decodePng(interlaced,{width:2,height:2}),/Interlaced/);
});
