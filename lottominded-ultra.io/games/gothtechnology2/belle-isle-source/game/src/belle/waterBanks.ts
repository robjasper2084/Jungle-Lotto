import * as T from 'three';
import {inside,segment,type ParkMap,type Point,ParkTerrain} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {finishBank} from './surfaceFinish.ts';
import {bankGrassGeometry,createShoreDetailPool} from './shoreDetail.ts';

/** Bank detail follows the actual water polygon, including the islands within it.
 * These small visual slopes stay on the water side of the collision boundary. */
export function addWaterBanks(scene:T.Scene,map:ParkMap,terrain:ParkTerrain,ground:T.MeshStandardMaterial){
 const earth:number[]=[],retaining:number[]=[],reeds:{x:number;z:number;h:number;angle:number}[]=[];
 const occupied=roadIndex(map.roads),formal=(map.waterSources||[]).filter(w=>/Model Yacht Basin|Koi/.test(w.name));
 const formalEdge=(x:number,z:number)=>formal.some(w=>w.points.slice(1).some((p,i)=>segment(x,z,w.points[i],p).d<1.5));
 let seed=592;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 for(const w of map.water){
  const wet=(x:number,z:number)=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h));
  for(const ring of [w.points,...w.holes]){const points=ring.slice(0,-1);const normalAt=(index:number)=>{const p=points[index],prev=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];let dx=next[0]-prev[0],dz=next[1]-prev[1],l=Math.hypot(dx,dz)||1,nx=dz/l,nz=-dx/l;if(!wet(p[0]+nx*.08,p[1]+nz*.08)){nx=-nx;nz=-nz;}return [nx,nz];};for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.03)continue;
   const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;let nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;
   if(!wet(mx+nx*.08,mz+nz*.08)){nx=-nx;nz=-nz;}
   const hard=formalEdge(mx,mz),width=hard?.10:1.2,positions=hard?retaining:earth;const na=normalAt(i-1),nb=normalAt(i%points.length);
   const q=(p:Point,d:number,y:number)=>{const n=p===a?na:nb;return [p[0]+n[0]*d,y,p[1]+n[1]*d];};
   positions.push(...q(a,0,2.005),...q(b,0,2.005),...q(a,width,.92),...q(b,0,2.005),...q(b,width,.92),...q(a,width,.92));
   if(hard||len<3||reeds.length>=1200)continue;
   const n=Math.floor(len/4);
   for(let j=0;j<n&&reeds.length<1200;j++){
    const t=(j+.25+rand()*.5)/n,x=a[0]+(b[0]-a[0])*t-nx*.28,z=a[1]+(b[1]-a[1])*t-nz*.28;
    const patch=.5+.25*Math.sin(x*.13+Math.sin(z*.07)*2)+.25*Math.cos(z*.19-x*.05);
    if(rand()>patch||!terrain.land(x,z)||occupied(x,z,'',2)||map.buildings.some(b=>inside(x,z,b.points)))continue;
    for(let k=0;k<3&&reeds.length<1200;k++){
     const along=(rand()-.5)*2.2,inland=rand()*.7,rx=x+(b[0]-a[0])/len*along-nx*inland,rz=z+(b[1]-a[1])/len*along-nz*inland;
     if(!terrain.land(rx,rz)||occupied(rx,rz,'',1.6)||terrain.obstructed(rx,rz,.5))continue;
     reeds.push({x:rx,z:rz,h:.40+rand()*.85,angle:rand()*Math.PI*2});
    }
   }
  }}
 }
 for(const [verts,color,name]of [[earth,0x68644c,'Natural canal and lagoon banks'],[retaining,0x999b8b,'Formal pond retaining edges']] as [number[],number,string][]){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();
  const material=new T.MeshStandardMaterial({color:verts===retaining?0x899083:0xffffff,roughness:.97,side:T.DoubleSide});if(verts===earth){const uv:number[]=[];for(let i=0;i<verts.length;i+=3)uv.push(verts[i]/4,verts[i+2]/4);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));material.map=ground.map;material.normalMap=ground.normalMap;material.normalScale.set(.15,.15);}finishBank(material,1.05,2,verts===retaining);const mesh=new T.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);
 }
 const tint=new T.Color(),instances=reeds.map(r=>({x:r.x,y:terrain.height(r.x,r.z)+.012,z:r.z,yaw:r.angle,sx:1,sy:r.h,sz:1,color:tint.setHSL(.18+rand()*.035,.25,.23+rand()*.1).getHex()}));
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});material.name='Bank sedge grass';
 const sedges=createShoreDetailPool(scene,bankGrassGeometry(),material,instances,'plants','Irregular waterside sedge clusters');
 return {bankVertices:(earth.length+retaining.length)/3,reeds:reeds.length,stats:sedges.stats,setQuality:sedges.setQuality,update:sedges.update};
}
