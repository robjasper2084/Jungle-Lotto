import type {TerrainSampler,Vec3} from '@digital-static/ridecore';
import {createGroundSample} from '@digital-static/ridecore';

/** Probe upward from the trail, never from inside the bridge slab. */
export function underpassCameraHeight(world:TerrainSampler,point:Vec3,desiredY:number,referenceY=point.y){
  const floor=world.sampleGround(point.x,point.z,createGroundSample(),referenceY).height;
  const base=floor+.12;
  const roof=world.raycast({x:point.x,y:base,z:point.z},{x:0,y:1,z:0},Math.max(4,desiredY-base+1));
  return Math.max(floor+.35,roof===null||roof<.3?desiredY:Math.min(desiredY,base+roof-.30));
}
