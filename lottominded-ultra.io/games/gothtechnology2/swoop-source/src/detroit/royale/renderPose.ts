import {lerpPose,type RidePose} from '../../../../ride-core/src/controller.ts';

/** One simulation interval of render-only interpolation. Input, collisions and
 * hit detection still use the current authoritative/predicted pose. */
export function interpolateRenderPose(previous:RidePose|undefined,current:RidePose,alpha:number):RidePose{
 const out={...current};
 // Never blend across a teleport, re-mount or forced dismount. Their state and
 // parked-wheel coordinates must become visible together.
 if(!previous||previous.footMode!==current.footMode||
  Math.hypot(current.x-previous.x,current.y-previous.y,current.z-previous.z)>8)return out;
 const t=Math.max(0,Math.min(1,Number.isFinite(alpha)?alpha:1));
 lerpPose(previous,current,t,out);
 out.headingY=previous.headingY+Math.atan2(Math.sin(current.headingY-previous.headingY),Math.cos(current.headingY-previous.headingY))*t;
 return out;
}

type ActorPose={id:string;pose:RidePose;spawnSerial:number;alive:boolean};
/** The caller also checks round/tick identity. Re-entry and elimination snap. */
export function previousRenderPose(previous:ActorPose|undefined,current:ActorPose){
 return previous?.id===current.id&&previous.spawnSerial===current.spawnSerial&&previous.alive===current.alive?previous.pose:undefined;
}
