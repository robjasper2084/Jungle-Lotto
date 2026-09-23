import {CITY,nearestCut} from './geography.ts';
import {nearestRamp,cutWidth} from './geo-profile.ts';
type Road=typeof CITY.roads[number];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const cells=new Map<string,{road:Road;a:number[];dx:number;dz:number;l2:number}[]>();
for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){
 const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],margin=road.width/2+4,segment={road,a,dx,dz,l2:dx*dx+dz*dz};
 for(let x=Math.floor((Math.min(a[0],b[0])-margin)/64);x<=Math.floor((Math.max(a[0],b[0])+margin)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-margin)/64);z<=Math.floor((Math.max(a[1],b[1])+margin)/64);z++){const key=x+','+z,list=cells.get(key)??[];list.push(segment);cells.set(key,list);}
}
export const hasStreetCurb=(road:Road)=>!['cycleway','footway','path','pedestrian','steps'].includes(road.kind)&&road.width>=6.8;
/** Mapped street edges, with lowered crossings. Height is an authored 15 cm,
 * not a claim of a surveyed curb inventory. The greenway remains uncurbed. */
export function curbRise(road:Road,x:number,z:number){
 let amount=1;
 const ramp=nearestRamp(x,z);amount=Math.min(amount,clamp((ramp.distance-ramp.width/2-.7)/1.2));
 const cut=nearestCut(x,z);
 // At the two level termini, leave the entire greenway mouth open.
 if(cut.d<12||cut.d>2585)amount=Math.min(amount,clamp((Math.abs(cut.u)-cutWidth(cut.d)/2-.6)/1.2));
 for(const {road:other,a,dx,dz,l2} of cells.get(Math.floor(x/64)+','+Math.floor(z/64))??[]){
  if(other===road||other.name===road.name)continue;
  // Grade-separated trail/streets do not create curb cuts on the overpass.
  const walk=['cycleway','footway','path','pedestrian'].includes(other.kind);
  if(walk&&Math.abs(cut.u)<12&&cut.d>12&&cut.d<2585)continue;
   if(l2<.01)continue;
   const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/l2),distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
   amount=Math.min(amount,clamp((distance-other.width/2-(walk?.5:2))/1.2));
   if(amount===0)return 0;
 }
 return .15*amount;
}
