import * as T from 'three';
import type {RidePose} from '@digital-static/ridecore';

export const ELMWOOD_CAMERAS=[
  ['chase','Third person · Swoop'],['first','First person · Swoop'],['wide','Wide chase'],
  ['front','Front'],['left','Left side'],['right','Right side'],
  ['low','Low chase'],['overhead','Overhead'],
  ['orbit','Orbit'],['drone','Drone follow'],
] as const;
export type ElmwoodCameraMode=typeof ELMWOOD_CAMERAS[number][0];
export function cameraMode(value:unknown):ElmwoodCameraMode{
  return ELMWOOD_CAMERAS.some(([id])=>id===value)?value as ElmwoodCameraMode:'chase';
}
export function nextElmwoodCamera(value:string):ElmwoodCameraMode{
  return ELMWOOD_CAMERAS[(ELMWOOD_CAMERAS.findIndex(([id])=>id===cameraMode(value))+1)%ELMWOOD_CAMERAS.length][0];
}
export function cameraFrame(){return {eye:new T.Vector3(),target:new T.Vector3(),roll:0,fov:55,hideRider:false};}
/** Same body-mounted pitch, roll and 74-degree lens as Swoop Detroit. */
export function swoopFirstPersonMotion(p:RidePose,reducedMotion=false){const amount=reducedMotion?.18:1;return {pitch:T.MathUtils.clamp(-p.riderPitch*.65-p.landingCompression*.075+p.takeoffExtension*.04,-.22,.22)*amount,roll:T.MathUtils.clamp(-p.rollAngle*.65,-.28,.28)*amount};}
/** Offsets are in the rider's frame; the existing RideCore Follow camera stays separate. */
export function frameElmwoodCamera(mode:ElmwoodCameraMode,p:RidePose,reducedMotion:boolean,out= cameraFrame(),first?:{head?:T.Vector3;yaw:number;pitch:number}){
  const s=Math.sin(p.headingY),c=Math.cos(p.headingY),speed=Math.abs(p.speed);
  out.hideRider=mode==='first';out.roll=0;out.fov=55;
  out.target.set(p.x,p.y+1.05,p.z);
  let back=5,height=2.45,side=0;
  if(mode==='first'){
    const motion=swoopFirstPersonMotion(p,reducedMotion),yaw=p.headingY+(first?.yaw??0),pitch=(first?.pitch??-.10)+motion.pitch;
    out.eye.copy(first?.head??new T.Vector3(p.x,p.y+1.85-p.crouch*.43+p.bodyBob+p.suspensionOffset,p.z));out.eye.add(new T.Vector3(s*.10,.065,c*.10));
    out.target.copy(out.eye).add(new T.Vector3(Math.sin(yaw)*Math.cos(pitch)*12,Math.sin(pitch)*12,Math.cos(yaw)*Math.cos(pitch)*12));
    out.roll=motion.roll;out.fov=74;return out;
  }
  if(mode==='front'){back=-5;out.fov=52;}
  if(mode==='wide'){back=9+Math.min(3,speed*.12);height=4.8;out.fov=62;}
  if(mode==='left'||mode==='right'){back=1.5;height=2.5;side=mode==='right'?6:-6;out.fov=58;}
  if(mode==='low'){back=4.5;height=.72;out.target.y=p.y+.85;out.fov=66;}
  if(mode==='overhead'){back=4;height=18;out.fov=55;}
  if(mode==='orbit'){back=7;height=3.8;side=5;out.fov=60;}
  if(mode==='drone'){
    back=reducedMotion?19:16+Math.min(7,speed*.25);
    height=reducedMotion?12:11+Math.min(4,speed*.12);
    side=4;out.fov=60;
    const lead=Math.min(10,speed*.65);
    out.target.x+=s*lead;out.target.z+=c*lead;
  }
  out.eye.set(p.x-s*back-c*side,p.y+height,p.z-c*back+s*side);
  return out;
}

/** Apply clearance after smoothing too, so a lagging camera cannot pass through masonry. */
export function clearElmwoodCamera(eye:T.Vector3,anchor:T.Vector3,terrain:{raycast:(o:T.Vector3,d:T.Vector3,m:number)=>number|null;height:(x:number,north:number)=>number},direction=new T.Vector3()){
  eye.y=Math.max(eye.y,terrain.height(eye.x,-eye.z)+.30);
  direction.copy(eye).sub(anchor);const distance=direction.length();
  if(distance<.001)return;
  direction.multiplyScalar(1/distance);const hit=terrain.raycast(anchor,direction,distance);
  if(hit!==null)eye.copy(anchor).addScaledVector(direction,Math.max(0,hit-.25));
}
