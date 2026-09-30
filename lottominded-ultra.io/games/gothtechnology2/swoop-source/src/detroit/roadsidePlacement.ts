import {CITY,riverEdge} from './geography.ts';

type Point={x:number;z:number};
export function segmentDistance(p:Point,a:number[],b:number[]){
 const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
 const t=l2?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/l2)):0;
 return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz);
}
const roads=CITY.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,half:r.width/2})));
const cells=new Map<string,typeof roads>();
for(const s of roads){const m=s.half+32;for(let x=Math.floor((Math.min(s.a[0],s.b[0])-m)/64);x<=Math.floor((Math.max(s.a[0],s.b[0])+m)/64);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-m)/64);z<=Math.floor((Math.max(s.a[1],s.b[1])+m)/64);z++){const key=x+','+z,list=cells.get(key)??[];list.push(s);cells.set(key,list);}}
const buildings=CITY.buildings.map(b=>({points:b.points,minX:Math.min(...b.points.map(p=>p[0]))-.7,maxX:Math.max(...b.points.map(p=>p[0]))+.7,minZ:Math.min(...b.points.map(p=>p[1]))-.7,maxZ:Math.max(...b.points.map(p=>p[1]))+.7}));
/** Test the union of ALL road/path envelopes, including intersection corners. */
export function roadwayClearance(p:Point){
 let clearance=Infinity;
 for(const s of cells.get(Math.floor(p.x/64)+','+Math.floor(p.z/64))??[]){
  const margin=s.half+32;
  if(p.x<Math.min(s.a[0],s.b[0])-margin||p.x>Math.max(s.a[0],s.b[0])+margin||p.z<Math.min(s.a[1],s.b[1])-margin||p.z>Math.max(s.a[1],s.b[1])+margin)continue;
  clearance=Math.min(clearance,segmentDistance(p,s.a,s.b)-s.half);
 }
 return clearance;
}
function inBuilding(p:Point){
 return buildings.some(b=>{
  if(p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ)return false;
  let inside=false;
  for(let i=0,j=b.points.length-1;i<b.points.length;j=i++){
   const a=b.points[i],q=b.points[j];
   if(segmentDistance(p,a,q)<.7)return true;
   if((a[1]>p.z)!==(q[1]>p.z)&&p.x<(q[0]-a[0])*(p.z-a[1])/(q[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 });
}
export function roadsidePoint(x:number,z:number,allowed:(x:number,z:number)=>boolean=()=>true){
 // Keep original orientation/approach. Only move the post to the closest clear
 // verge, with enough room for the sign face as well as the post.
 const valid=(p:Point)=>allowed(p.x,p.z)&&p.x>riverEdge(p.z)+1&&roadwayClearance(p)>=1.15&&!inBuilding(p);
 if(valid({x,z}))return{x,z};
 for(let radius=.75;radius<=24;radius+=.75){
  const n=Math.max(16,Math.ceil(radius*8));
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n,p={x:x+Math.cos(a)*radius,z:z+Math.sin(a)*radius};if(valid(p))return p;}
 }
 // Omit a decorative sign instead of ever planting it in a travel lane.
 return null;
}
