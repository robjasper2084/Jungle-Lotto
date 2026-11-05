import {CITY} from './geography.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {streetElevation,type StreetPoint} from './street-geometry.ts';
import {sidewalkHalfWidth} from './streetFurnitureLayout.ts';
type Road=typeof CITY.roads[number];
function closestApproaches(a:number[],b:number[],p:number[],q:number[]){
 const project=(v:number[],s:number[],e:number[])=>{const dx=e[0]-s[0],dz=e[1]-s[1],t=Math.max(0,Math.min(1,((v[0]-s[0])*dx+(v[1]-s[1])*dz)/(dx*dx+dz*dz||1)));return [s[0]+dx*t,s[1]+dz*t];};
 const dx=b[0]-a[0],dz=b[1]-a[1],rx=q[0]-p[0],rz=q[1]-p[1],det=dx*rz-dz*rx;
 if(Math.abs(det)>1e-8){const x=p[0]-a[0],z=p[1]-a[1],t=(x*rz-z*rx)/det,u=(x*dz-z*dx)/det;if(t>=0&&t<=1&&u>=0&&u<=1){const v=[a[0]+dx*t,a[1]+dz*t];return [v,v];}}
 return [[a,project(a,p,q)],[b,project(b,p,q)],[project(p,a,b),p],[project(q,a,b),q]].sort((v,w)=>Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1])-Math.hypot(w[0][0]-w[1][0],w[0][1]-w[1][1]))[0];
}
const grid=new Map<string,{road:Road;a:number[];b:number[]}[]>();
for(const road of CITY.roads.filter(hasStreetCurb))for(let i=1;i<road.points.length;i++){
 const a=road.points[i-1],b=road.points[i],pad=road.width/2+.3+2*sidewalkHalfWidth(road),segment={road,a,b};
 for(let x=Math.floor((Math.min(a[0],b[0])-pad)/64);x<=Math.floor((Math.max(a[0],b[0])+pad)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/64);z<=Math.floor((Math.max(a[1],b[1])+pad)/64);z++){const key=x+','+z,list=grid.get(key)??[];list.push(segment);grid.set(key,list);}
}
/** Roads own crossings. Walking ribbons/sidewalks stop at their edge instead
 * of making raised dark/concrete patches across asphalt. Other grades survive. */
export function streetJoinExclusions(owner:Road,a:number[],b:number[],pad:number,height:(x:number,z:number)=>number):StreetPoint[][]{
 if(owner.bridge)return [];
 const candidates=new Set<{road:Road;a:number[];b:number[]}>();
 for(let x=Math.floor((Math.min(a[0],b[0])-pad)/64);x<=Math.floor((Math.max(a[0],b[0])+pad)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/64);z<=Math.floor((Math.max(a[1],b[1])+pad)/64);z++)for(const s of grid.get(x+','+z)??[])candidates.add(s);
 const footprints:StreetPoint[][]=[];
 const sidewalkApproach=!hasStreetCurb(owner);
 for(const {road,a:p,b:q} of candidates){
  // A short bend can put its sidewalk inside a neighbouring asphalt segment
  // of the same street. Exclude those too, keeping only this segment exempt.
  if(road.bridge||(road===owner&&p===a&&q===b))continue;
  const dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.01)continue;
  // Compare each route on its own ground at their actual closest approach.
  // Sampling a distant bank as if it were the trail incorrectly erased hundreds
  // of metres of asphalt below nearby parallel streets and overpasses.
  const [own,other]=closestApproaches(a,b,p,q);
  // Paths and narrow driveways meet the outer sidewalk edge; they must not
  // repaint its lowered crossing. Motor-road sidewalks still stop at asphalt.
  const half=road.width/2+(sidewalkApproach?.15+2*sidewalkHalfWidth(road):0);
  if(Math.hypot(own[0]-other[0],own[1]-other[1])>pad+half)continue;
  if(Math.abs(streetElevation(owner,own[0],own[1],height(own[0],own[1]))-streetElevation(road,other[0],other[1],height(other[0],other[1])))>.3)continue;
  const nx=-dz/length*half,nz=dx/length*half;
  footprints.push([{x:p[0]-nx,z:p[1]-nz},{x:q[0]-nx,z:q[1]-nz},{x:q[0]+nx,z:q[1]+nz},{x:p[0]+nx,z:p[1]+nz}]);
  // Match the existing road end caps, leaving no scraps at T junctions.
  for(const v of [p,q])if(v[0]>=Math.min(a[0],b[0])-pad-road.width&&v[0]<=Math.max(a[0],b[0])+pad+road.width&&v[1]>=Math.min(a[1],b[1])-pad-road.width&&v[1]<=Math.max(a[1],b[1])+pad+road.width)footprints.push(Array.from({length:16},(_,i)=>({x:v[0]+Math.cos(i*Math.PI/8)*half,z:v[1]+Math.sin(i*Math.PI/8)*half})));
 }
 return footprints;
}
