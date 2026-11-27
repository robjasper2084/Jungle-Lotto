/** Exact-channel analytical crops/differences; originals are always preserved. */
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {crc32,decodePng} from './png-evidence.mjs';
export function encodeRgba(rgba,width,height){
 assert.equal(rgba.length,width*height*4);
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);
 const chunk=(type,data)=>{const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length);return out;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const rows=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)rgba.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
export function cropRgba(rgba,width,height,rect){
 const {x,y,width:w,height:h}=rect;assert([x,y,w,h].every(Number.isInteger)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height);
 const out=Buffer.alloc(w*h*4);for(let row=0;row<h;row++)rgba.copy(out,row*w*4,((row+y)*width+x)*4,((row+y)*width+x+w)*4);return out;
}
export function comparePixels(a,b,width,height,rect){
 assert.equal(a.length,width*height*4);assert.equal(b.length,a.length);const image=Buffer.alloc(a.length);
 let changedPixels=0,insideRoofRegion=0,outsideRoofRegion=0,maxChannelDelta=0,sumChannelDelta=0;
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let i=0;i<a.length;i+=4){let changed=false;const pixel=i/4,x=pixel%width,y=Math.floor(pixel/width);
  for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);image[i+c]=d;changed||=d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);sumChannelDelta+=d;}
  assert.equal(a[i+3],255);assert.equal(b[i+3],255);image[i+3]=255;
  if(changed){changedPixels++;if(x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height)insideRoofRegion++;else outsideRoofRegion++;
   minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 return {image,statistics:{changedPixels,insideRoofRegion,outsideRoofRegion,maxChannelDelta,meanAbsoluteRgbChannelDelta:sumChannelDelta/(width*height*3),
  changedBounds:changedPixels?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null,
  interpretation:'Measured changes, including any cast/reflected shadow changes outside the roof crop. This is not pixel-equivalence or architectural acceptance.'}};
}
export function assertNonblank(png,width,height){
 const rgba=decodePng(png,{width,height}),colors=new Set();let nonzero=0;
 for(let i=0;i<rgba.length;i+=4){if(rgba[i]||rgba[i+1]||rgba[i+2])nonzero++;if(colors.size<32)colors.add(rgba.readUInt32BE(i));}
 assert(nonzero>width*height*.01&&colors.size>=8,'Blank or discarded native framebuffer');return rgba;
}
