import {districts} from './detroitGround.ts';
import {inside,segment,type ParkTerrain,type Point} from './terrain.ts';

export function planDetroitProps(terrain:ParkTerrain){
 const groups=new Map<string,{x:number;z:number;yaw:number;scale:number}[]>();
 const place=(name:string,x:number,z:number,yaw:number,scale:number)=>{
  const list=groups.get(name)??[];list.push({x,z,yaw,scale});groups.set(name,list);
 };
 // Install foliage and street furniture on verges, leaving every mapped lane clear.
 const nearRoad=(x:number,z:number)=>districts.roads.some(r=>r.points.some((p,i)=>i>0&&segment(x,z,r.points[i-1],p).d<r.width/2+.8));
 for(const [n,r] of districts.roads.entries()){
  if(r.points.length<2||(!r.id.startsWith('elm-')&&n%3!==0))continue;
  const a=r.points[0],b=r.points[1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1)continue;
  const side=n%2?1:-1,off=side*(r.width*.5+2.4);
  const x=(a[0]+b[0])/2+dz/len*off,z=(a[1]+b[1])/2-dx/len*off;
  if(!terrain.land(x,z)||terrain.obstructed(x,z,1)||nearRoad(x,z))continue;
  if(r.id.startsWith('elm-')){
   for(let k=0;k<5;k++){const px=x+dx/len*k*.5,pz=z+dz/len*k*.5;if(!nearRoad(px,pz))place(k%3?'GrassTuft':'Wildflower',px,pz,n+k,1.35);}
  }else place('ParkBin',x,z,Math.atan2(dx,dz),1);
 }
 // Camera-mapped background architecture uses the long street-facing edges of existing blocks.
 for(const b of districts.buildings.filter(b=>b.height>10&&b.height<40).filter((_,i)=>i%9===0)){
  const r=b.points;const a=r[0],c=r[1];if(!c||Math.hypot(a[0]-c[0],a[1]-c[1])<6)continue;
  const x=(a[0]+c[0])/2,z=(a[1]+c[1])/2;if(nearRoad(x,z))continue;
  place('CityFacade',x,z,Math.atan2(c[0]-a[0],c[1]-a[1]),Math.min(1.15,b.height/17));
 }
 for(const beach of terrain.map.areas.filter(a=>a.kind==='beach')){
  const center:Point=[beach.points.reduce((s,p)=>s+p[0],0)/beach.points.length,beach.points.reduce((s,p)=>s+p[1],0)/beach.points.length];
  let count=0;
  for(const [i,p] of beach.points.entries()){
   if(i%4||count>=8)continue;const x=p[0]*.82+center[0]*.18,z=p[1]*.82+center[1]*.18;
   if(!inside(x,z,beach.points)||!terrain.land(x,z)||terrain.obstructed(x,z,.8))continue;
   place(count%3?'Gull':'Driftwood',x,z,i*.9,count%3?1:1.25);count++;
  }
 }
 return groups;
}
