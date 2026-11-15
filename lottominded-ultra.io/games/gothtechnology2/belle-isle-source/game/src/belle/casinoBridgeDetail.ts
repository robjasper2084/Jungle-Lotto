import * as T from 'three';
import type {SmallBridgePlan} from './smallBridges.ts';

/** The two mapped footbridges beside the Casino. Photo proportions are an
 * interpretation; the surveyed path endpoints and rail envelope stay authoritative. */
export const CASINO_FOOTBRIDGES=new Set(['106948146','42986441']);
type Part=SmallBridgePlan['parts'][number];
export function casinoBridgeRail(p:Part,add:(g:T.BufferGeometry)=>void){
 const dx=p.b[0]-p.a[0],dz=p.b[1]-p.a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),h=p.top-p.bottom;
 const place=(g:T.BufferGeometry)=>{g.rotateY(yaw);g.translate(p.a[0],p.bottom,p.a[1]);add(g);};
 const box=(z:number,y:number,w:number,height:number,len:number)=>place(new T.BoxGeometry(w,height,len).translate(0,y,z));
 box(length/2,.065,.10,.13,length);box(length/2,h-.045,.11,.09,length);
 const panels=Math.ceil(length/1.65),step=length/panels;
 for(let i=0;i<=panels;i++){
  box(i*step,h/2,.105,h,.105);
  // Square cap and pyramidal finial, wholly inside the existing rail envelope.
  if(i%2===0){box(i*step,h-.13,.12,.065,.20);place(new T.ConeGeometry(.075,.09,4,1,true).rotateY(Math.PI/4).translate(0,h-.045,i*step));}
 }
 for(let i=0;i<panels;i++){
  const mid=(i+.5)*step;
  // Thin cast-iron strips retain an opaque silhouette from either bank.
  // Fine oval, simpler small scrolls: both bridges retain the original budget.
  const curve=(points:T.Vector3[],radius=.019,segments=8)=>{
   const path=new T.CatmullRomCurve3(points),v:number[]=[],uv:number[]=[],index:number[]=[];
   for(let j=0;j<=segments;j++){
    const q=path.getPoint(j/segments),t=path.getTangent(j/segments),n=new T.Vector3(0,-t.z,t.y).normalize().multiplyScalar(radius);
    v.push(q.x,q.y+n.y,q.z+n.z,q.x,q.y-n.y,q.z-n.z);uv.push(0,j/segments,1,j/segments);
    if(j<segments){const k=j*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();place(g);
  };
  curve(Array.from({length:13},(_,j)=>{const a=j*Math.PI/6;return new T.Vector3(0,h*.51+Math.sin(a)*h*.31,mid+Math.cos(a)*step*.23);}),.019,12);
  for(const sign of [-1,1])curve(Array.from({length:10},(_,j)=>{const a=j/9*Math.PI*1.65,r=.17*(1-j/12);return new T.Vector3(0,h*.51+Math.sin(a)*r,mid+sign*(step*.39+Math.cos(a)*r));}),.016);
 }
}
