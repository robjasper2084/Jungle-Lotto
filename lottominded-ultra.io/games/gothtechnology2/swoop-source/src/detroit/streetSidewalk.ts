import {CITY} from './geography.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {segmentDistance} from './roadsidePlacement.ts';
import {sidewalkHalfWidth} from './streetFurnitureLayout.ts';

/** Some OSM walking/cycling ways trace the sidewalk beside a street. The street
 * already supplies that concrete surface; a second asphalt ribbon would hide its curb. */
export function parallelStreetSidewalk(a:number[],b:number[]){
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)return undefined;
 for(const road of CITY.roads){
  if(!hasStreetCurb(road)||road.bridge)continue;
  for(let i=1;i<road.points.length;i++){
   const p=road.points[i-1],q=road.points[i],rx=q[0]-p[0],rz=q[1]-p[1],rl=Math.hypot(rx,rz);
   if(rl<.01||Math.abs(dx*rx+dz*rz)/(length*rl)<.94)continue;
   const half=road.width/2,outer=half+2*sidewalkHalfWidth(road)+.5;
   if([.15,.5,.85].every(t=>{const d=segmentDistance({x:a[0]+dx*t,z:a[1]+dz*t},p,q);return d>=half-.5&&d<=outer;}))return road;
  }
 }
 return undefined;
}
