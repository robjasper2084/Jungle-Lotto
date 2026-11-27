/** Decode without color/alpha conversion; bind the actual PNG to raw GL bytes. */
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function decodePng(bytes,{width,height}){
 assert(bytes.subarray(0,8).equals(signature),'Invalid PNG signature');let offset=8,header=null,ended=false;const idat=[];
 while(offset<bytes.length){assert(offset+12<=bytes.length,'Truncated PNG chunk');const n=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+n;
  assert(end<=bytes.length,'PNG chunk outside file');const data=bytes.subarray(offset+8,offset+8+n);
  assert.equal(crc32(bytes.subarray(offset+4,offset+8+n)),bytes.readUInt32BE(offset+8+n),'PNG CRC mismatch');
  if(type==='IHDR'){assert(!header&&offset===8&&n===13,'Invalid PNG header');header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),depth:data[8],color:data[9],compression:data[10],filter:data[11],interlace:data[12]};}
  else if(type==='IDAT')idat.push(data);
  else if(type==='IEND'){assert.equal(n,0);ended=true;assert.equal(end,bytes.length,'Trailing PNG data');break;}
  else {assert(type!=='tRNS','Unexpected PNG transparency conversion');assert(type[0]===type[0].toLowerCase(),'Unsupported critical PNG chunk '+type);}
  offset=end;
 }
 assert(header&&ended&&idat.length,'Incomplete PNG');assert.equal(header.width,width);assert.equal(header.height,height);
 assert.equal(header.depth,8,'Only original 8-bit pixels supported');assert([2,6].includes(header.color),'Unexpected PNG color type');assert.equal(header.compression,0);assert.equal(header.filter,0);assert.equal(header.interlace,0,'Interlaced output is not supported');
 const channels=header.color===6?4:3,stride=width*channels,expected=(stride+1)*height;
 const compressed=inflateSync(Buffer.concat(idat),{maxOutputLength:expected});assert.equal(compressed.length,expected,'Unexpected PNG payload length');
 const decoded=Buffer.alloc(width*height*4),row=Buffer.alloc(stride),previous=Buffer.alloc(stride);
 for(let y=0;y<height;y++){const at=y*(stride+1),filter=compressed[at];assert(filter<=4,'Invalid PNG row filter');
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,v=compressed[at+1+x];
   row[x]=(v+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}
  for(let x=0;x<width;x++){const to=(y*width+x)*4,from=x*channels;decoded[to]=row[from];decoded[to+1]=row[from+1];decoded[to+2]=row[from+2];decoded[to+3]=channels===4?row[from+3]:255;}
  row.copy(previous);
 }
 return decoded;
}
export function verifyCapture(png,raw,{width,height,pixelSha256}){
 assert.equal(raw.length,width*height*4,'Raw RGBA length');assert.equal(hash(raw),pixelSha256,'Raw GL hash mismatch');
 const decoded=decodePng(png,{width,height}),topDown=Buffer.alloc(raw.length),stride=width*4;
 for(let y=0;y<height;y++)raw.copy(topDown,y*stride,(height-1-y)*stride,(height-y)*stride);
 for(let i=3;i<raw.length;i+=4)assert.equal(raw[i],255,'Unexpected nonopaque original framebuffer alpha');
 assert(decoded.equals(topDown),'Decoded PNG channels differ from original GL pixels');
 return {rawSha256:pixelSha256,pngSha256:hash(png),decodedRgbaSha256:hash(decoded),width,height,
  rawLayout:'RGBA8 bottom-up; unmodified gl.readPixels',pngLayout:'RGBA8 top-down',alphaPolicy:'Every original alpha byte must be 255; no normalization or color conversion'};
}
