import * as T from 'three';

// Keep the fallback and traced panorama at the same PMREM cube-UV dimensions.
// Changing those dimensions changes shader defines on every lit island material.
export const SKY_PROBE_WIDTH=512;
export const SKY_PROBE_HEIGHT=256;

/** Box-filter the decoded HDR in linear light before its one-time PMREM upload.
 * This keeps HDR range and avoids a new full-scene shader family when the first
 * live traced reflection replaces the fallback a few seconds into riding. */
export function boundedSkyProbe(source:T.DataTexture,width=SKY_PROBE_WIDTH,height=SKY_PROBE_HEIGHT){
 const input=source.image as {data:Uint16Array;width:number;height:number};
 if(source.type!==T.HalfFloatType||input.data.length!==input.width*input.height*4)throw Error('Sky probe requires decoded RGBA half-float HDR');
 const pixels=new Uint16Array(width*height*4),sx=input.width/width,sy=input.height/height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const x0=Math.floor(x*sx),x1=Math.min(input.width,Math.ceil((x+1)*sx)),y0=Math.floor(y*sy),y1=Math.min(input.height,Math.ceil((y+1)*sy));
  for(let c=0;c<4;c++){
   let sum=0,weight=0;
   for(let iy=y0;iy<y1;iy++)for(let ix=x0;ix<x1;ix++){
    const w=(Math.min(ix+1,(x+1)*sx)-Math.max(ix,x*sx))*(Math.min(iy+1,(y+1)*sy)-Math.max(iy,y*sy));
    sum+=T.DataUtils.fromHalfFloat(input.data[(iy*input.width+ix)*4+c])*w;weight+=w;
   }
   pixels[(y*width+x)*4+c]=T.DataUtils.toHalfFloat(sum/weight);
  }
 }
 const result=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.HalfFloatType);
 result.colorSpace=source.colorSpace;result.flipY=source.flipY;result.mapping=T.EquirectangularReflectionMapping;
 result.minFilter=result.magFilter=T.LinearFilter;result.needsUpdate=true;return result;
}
