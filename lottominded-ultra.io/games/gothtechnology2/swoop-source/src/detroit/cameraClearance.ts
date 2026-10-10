import type {TerrainSampler,Vec3} from './terrain.ts';
import {createGroundSample} from './terrain.ts';

/** Probe upward from the trail, never from inside the bridge slab. */
export function underpassCameraHeight(world:TerrainSampler,point:Vec3,desiredY:number,referenceY=point.y){
  const floor=world.sampleGround(point.x,point.z,createGroundSample(),referenceY).height;
  const base=floor+.12;
  const roof=world.raycast({x:point.x,y:base,z:point.z},{x:0,y:1,z:0},Math.max(4,desiredY-base+1));
  return Math.max(floor+.35,roof===null?desiredY:Math.min(desiredY,base+roof-.30));
}

/** Clamp the rendered camera after interpolation, not only its simulation endpoints. */
export function clearRideCamera(world:TerrainSampler,eye:Vec3,anchor:Vec3,referenceY:number){
 const dx=eye.x-anchor.x,dy=eye.y-anchor.y,dz=eye.z-anchor.z,length=Math.hypot(dx,dy,dz);
 if(length>.001){const direction={x:dx/length,y:dy/length,z:dz/length},hit=world.raycast(anchor,direction,length);
  if(hit!==null){const reach=Math.max(0,hit-.25);eye.x=anchor.x+direction.x*reach;eye.y=anchor.y+direction.y*reach;eye.z=anchor.z+direction.z*reach;}}
 eye.y=underpassCameraHeight(world,eye,eye.y,referenceY);
 return eye;
}
