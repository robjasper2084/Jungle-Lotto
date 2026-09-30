import {createGroundSample,type TerrainSampler} from '../simulation/world.ts';
export type VisitorContact={x:number;z:number;radius?:number};
export function clearVisitorStep(map:TerrainSampler,from:{x:number;y:number;z:number},x:number,z:number,radius:number,contacts:readonly VisitorContact[]){
  const dx=x-from.x,dz=z-from.z,length=Math.hypot(dx,dz);
  const g=map.sampleGround(x,z,createGroundSample());
  if(g.offCourse||g.normal.y<.72||Math.abs(g.height-from.y)>.5)return false;
  if(length>.001){const hit=map.raycastObstacle?.({x:from.x,y:from.y+.8,z:from.z},{x:dx/length,y:0,z:dz/length},length,radius);if(hit!=null&&hit<length)return false;}
  for(const c of contacts){
    const clearance=radius+(c.radius??.5),old=Math.hypot(from.x-c.x,from.z-c.z),next=Math.hypot(x-c.x,z-c.z);
    // An initially overlapping visitor may move out, but never farther in.
    if(old<clearance){if(next<=old+.00001)return false;continue;}
    const t=Math.max(0,Math.min(1,((c.x-from.x)*dx+(c.z-from.z)*dz)/(length*length||1)));
    if(Math.hypot(from.x+t*dx-c.x,from.z+t*dz-c.z)<clearance)return false;
  }
  return true;
}
/** Try a clear passing arc on either side instead of stopping behind a person. */
export function visitorSteering(map:TerrainSampler,from:{x:number;y:number;z:number},preferred:number,radius:number,lookAhead:number,contacts:readonly VisitorContact[]){
  for(const offset of [0,.4,-.4,.8,-.8,1.2,-1.2,1.65,-1.65,2.2,-2.2,Math.PI]){
    const heading=preferred+offset,x=from.x+Math.sin(heading)*lookAhead,z=from.z+Math.cos(heading)*lookAhead;
    if(clearVisitorStep(map,from,x,z,radius,contacts))return {heading,clear:true};
  }
  return {heading:preferred,clear:false};
}
