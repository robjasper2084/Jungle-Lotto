import * as T from 'three';
import type {Point} from './terrain.ts';

/** Roof wings follow the long and transverse axes of the mapped brick footprint. */
export function oakwayRoof(center:Point,eave:number){
 const positions:number[]=[],uv:number[]=[];
 function vertex(u:number,v:number,h:number){
  positions.push(center[0]+.795*u+.607*v,eave+h,center[1]-.607*u+.795*v);
 }
 function wing(start:number,end:number,left:number,right:number,turn:boolean,gable:boolean){
  const mid=(left+right)/2,rise=2.45;
  const A=[start,left,0],B=[end,left,0],C=[end,right,0],D=[start,right,0];
  const P=[start+(gable?0:3),mid,rise],Q=[end-3,mid,rise];
  for(const [along,across,h] of [A,B,Q,A,Q,P,D,P,Q,D,Q,C,B,C,Q,A,P,D]){
   vertex(turn?across:along,turn?along:across,h);uv.push(along/.46,across);
  }
 }
 wing(-9.35,9.5,-2.35,5.55,false,false);
 wing(-6.6,8.25,-3.9,4.05,true,true);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();
 // One immutable repeat tile for the standing seams across both roof wings.
 const pixels=new Uint8Array(16*4).fill(255);
 for(let k=0;k<3;k++){pixels[k]=188;pixels[4+k]=218;}
 const seams=new T.DataTexture(pixels,16,1,T.RGBAFormat);
 seams.wrapS=T.RepeatWrapping;seams.magFilter=T.LinearFilter;seams.minFilter=T.LinearMipmapLinearFilter;
 seams.generateMipmaps=true;seams.needsUpdate=true;
 const material=new T.MeshStandardMaterial({color:0x71968a,map:seams,roughness:.72,metalness:.12,side:T.DoubleSide});
 return {geometry,material};
}
