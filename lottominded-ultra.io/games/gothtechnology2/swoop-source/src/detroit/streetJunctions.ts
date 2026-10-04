import {CITY} from './geography.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {streetElevation,type StreetPoint} from './street-geometry.ts';
type Road=typeof CITY.roads[number];
const grid=new Map<string,{road:Road;a:number[];b:number[]}[]>();
for(const road of CITY.roads.filter(hasStreetCurb))for(let i=1;i<road.points.length;i++){
 const a=road.points[i-1],b=road.points[i],pad=road.width/2+1,segment={road,a,b};
 for(let x=Math.floor((Math.min(a[0],b[0])-pad)/64);x<=Math.floor((Math.max(a[0],b[0])+pad)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/64);z<=Math.floor((Math.max(a[1],b[1])+pad)/64);z++){const key=x+','+z,list=grid.get(key)??[];list.push(segment);grid.set(key,list);}
}
/** Roads own crossings. Walking ribbons/sidewalks stop at their edge instead
 * of making raised dark/concrete patches across asphalt. Other grades survive. */
export function streetJoinExclusions(owner:Road,a:number[],b:number[],pad:number,height:(x:number,z:number)=>number):StreetPoint[][]{
 if(owner.bridge)return [];
 const candidates=new Set<{road:Road;a:number[];b:number[]}>();
 for(let x=Math.floor((Math.min(a[0],b[0])-pad)/64);x<=Math.floor((Math.max(a[0],b[0])+pad)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/64);z<=Math.floor((Math.max(a[1],b[1])+pad)/64);z++)for(const s of grid.get(x+','+z)??[])candidates.add(s);
 const footprints:StreetPoint[][]=[];
 for(const {road,a:p,b:q} of candidates){
  if(road===owner||road.bridge||road.name&&road.name===owner.name)continue;
  const dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.01)continue;
  const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,t=Math.max(0,Math.min(1,((mx-p[0])*dx+(mz-p[1])*dz)/(length*length))),x=p[0]+dx*t,z=p[1]+dz*t,y=height(x,z);
  if(Math.abs(streetElevation(owner,x,z,y)-streetElevation(road,x,z,y))>.3)continue;
  const nx=-dz/length*road.width/2,nz=dx/length*road.width/2;
  footprints.push([{x:p[0]-nx,z:p[1]-nz},{x:q[0]-nx,z:q[1]-nz},{x:q[0]+nx,z:q[1]+nz},{x:p[0]+nx,z:p[1]+nz}]);
  // Match the existing road end caps, leaving no scraps at T junctions.
  for(const v of [p,q])if(v[0]>=Math.min(a[0],b[0])-pad-road.width&&v[0]<=Math.max(a[0],b[0])+pad+road.width&&v[1]>=Math.min(a[1],b[1])-pad-road.width&&v[1]<=Math.max(a[1],b[1])+pad+road.width)footprints.push(Array.from({length:16},(_,i)=>({x:v[0]+Math.cos(i*Math.PI/8)*road.width/2,z:v[1]+Math.sin(i*Math.PI/8)*road.width/2})));
 }
 return footprints;
}
