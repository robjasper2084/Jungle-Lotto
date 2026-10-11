import {clearCameraBoom} from './cameraSafety.ts';
import type {TerrainSampler,Vec3} from './terrain.ts';
import {createGroundSample} from './terrain.ts';

/** Probe upward from the trail, never from inside the bridge slab. */
export function underpassCameraHeight(world:TerrainSampler,point:Vec3,desiredY:number,referenceY=point.y,headroom=1.8){
  let floor=world.sampleGround(point.x,point.z,createGroundSample(),referenceY).height;
  // A low sidewalk beside a slope is a floor, not an underpass ceiling. Keep
  // the eye above it; genuinely high bridge decks still cap the camera below.
  const raised=world.sampleGround(point.x,point.z,createGroundSample(),referenceY+headroom-.4).height;
  if(raised>floor&&raised<=referenceY+headroom+.01)floor=raised;
  const base=floor+.12;
  const roof=world.raycast({x:point.x,y:base,z:point.z},{x:0,y:1,z:0},Math.max(4,desiredY-base+1));
  return Math.max(floor+.35,roof===null||roof<.3?desiredY:Math.min(desiredY,base+roof-.30));
}

/** Clamp the rendered camera after interpolation, not only its simulation endpoints. */
export function clearRideCamera(world:TerrainSampler,eye:Vec3,anchor:Vec3,referenceY:number){
 clearCameraBoom(eye,anchor,(o,d,max)=>world.raycast(o,d,max),world.sampleGround(eye.x,eye.z,createGroundSample(),referenceY).height);
 eye.y=underpassCameraHeight(world,eye,eye.y,referenceY,Math.max(.6,Math.min(1.9,anchor.y-referenceY+.45)));
 return eye;
}
