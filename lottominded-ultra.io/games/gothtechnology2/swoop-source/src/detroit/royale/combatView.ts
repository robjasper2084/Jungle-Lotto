import {Vector3} from 'three';

/** Our rider faces +Z. Screen-right is -X, so rightward look input reduces yaw. */
export function dragAim(yaw:number,pitch:number,dx:number,dy:number,gain:number){
 return {yaw:Math.max(-1.25,Math.min(1.25,yaw-dx*gain)),pitch:Math.max(-.65,Math.min(.65,pitch-dy*gain))};
}
export function stickAxes(x:number,y:number,radius:number){
 const length=Math.hypot(x,y),scale=Math.max(radius,length);
 return {steer:scale?x/scale:0,throttle:scale?-y/scale:0};
}
/** Place eyes behind the actual animated sight, not inside the receiver. The
 * first-person carry view leaves the weapon below/right; ADS looks down its rail.
 * No mirroring or changes to the authoritative muzzle/hand transforms. */
export function combatEye(sight:Vector3,heading:number,pitch:number,scale:number,ads:boolean){
 const forward=new Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const right=new Vector3(-Math.cos(heading),0,Math.sin(heading));
 const up=new Vector3().crossVectors(right,forward).normalize();
 return sight.clone().addScaledVector(forward,-(ads?.42:.62)*scale)
  .addScaledVector(up,(ads?.018:.22)*scale).addScaledVector(right,ads?0:-.18*scale);
}
