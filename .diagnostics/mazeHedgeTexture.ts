import * as T from 'three';
/** Small deterministic opaque foliage tile. No image request, alpha overdraw,
 * extra draw or animation; all maze hedges share one owned texture. */
export function hedgePixels(size=128){
 if(!Number.isInteger(size)||size<32||size>256)throw new RangeError('Hedge texture size must be 32–256');
 const data=new Uint8Array(size*size*4),count=8;
 const hash=(x:number,y:number,s:number)=>{let n=Math.imul((x+count)%count,374761393)^Math.imul((y+count)%count,668265263)^Math.imul(s,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 const cells=Array.from({length:count*count},(_,i)=>{const x=i%count,y=Math.floor(i/count),a=hash(x,y,1)*Math.PI*2;return {x:.3+hash(x,y,2)*.4,y:.3+hash(x,y,3)*.4,co:Math.cos(a),si:Math.sin(a),tone:.82+hash(x,y,4)*.28};});
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*count,v=y/size*count,ix=Math.floor(u),iy=Math.floor(v);let value=.20;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cell=cells[((iy+dy+count)%count)*count+(ix+dx+count)%count],px=u-(ix+dx+cell.x),py=v-(iy+dy+cell.y),a=px*cell.co+py*cell.si,b=-px*cell.si+py*cell.co,q=(a/.66)**2+(b/.34)**2;
   if(q>=1)continue;
   const edge=Math.min(1,(1-q)*9),ridge=Math.max(0,1-Math.abs(b)/.34),vein=Math.max(0,1-Math.abs(b)/.018)*.08;
   value=Math.max(value,(.38+edge*.28+ridge*.20+vein)*cell.tone);
  }
  const i=(y*size+x)*4;data[i]=Math.round(18+value*57);data[i+1]=Math.round(39+value*79);data[i+2]=Math.round(13+value*39);data[i+3]=255;
 }
 return data;
}
export function createHedgeTexture(){const texture=new T.DataTexture(hedgePixels(),128,128,T.RGBAFormat);texture.name='Garden maze shared leaf clusters';texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;}
