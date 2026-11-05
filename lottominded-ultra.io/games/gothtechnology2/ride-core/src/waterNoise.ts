import * as T from 'three';
let noise:T.DataTexture|undefined;

/** Small, seamless original noise texture. Mipmaps keep distant highlights from sparkling. */
export function waterNoise(){
 if(noise)return noise;
 const size=128,data=new Uint8Array(size*size*4);
 const hash=(x:number,y:number,seed:number)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const value=(x:number,y:number,cells:number,seed:number)=>{const px=x*cells/size,py=y*cells/size,ix=Math.floor(px),iy=Math.floor(py),a=px-ix,b=py-iy,s=a*a*(3-2*a),t=b*b*(3-2*b);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix%cells,iy%cells,seed),hash((ix+1)%cells,iy%cells,seed),s),T.MathUtils.lerp(hash(ix%cells,(iy+1)%cells,seed),hash((ix+1)%cells,(iy+1)%cells,seed),s),t);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=Math.round(value(x,y,8,19)*255);data[i+1]=Math.round(value(x,y,16,73)*255);data[i+2]=Math.round(value(x,y,32,137)*255);data[i+3]=255;}
 noise=new T.DataTexture(data,size,size,T.RGBAFormat);noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.minFilter=T.LinearMipmapLinearFilter;noise.magFilter=T.LinearFilter;noise.generateMipmaps=true;noise.needsUpdate=true;noise.name='Original seamless water micro-ripples';return noise;
}
