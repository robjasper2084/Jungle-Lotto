import * as T from 'three';
import {solveLimb} from '../../runtime/ride-core/src/limbIK.ts';
import type {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
type SeatRig=Pick<ThreeRiderView,'root'|'rider'|'hips'|'bones'|'legs'|'arms'|'motionScale'>;
/** Keep targets in world space until assigning the hip's local translation. */
export function applySlideSeat(h:SeatRig,heading:number,weight:number){
 if(weight<=0||!h.hips)return;
 const nodes=[h.rider,...h.bones.map(b=>b.o)],saved=nodes.map(o=>({p:o.position.clone(),q:o.quaternion.clone()}));
 const forward=new T.Vector3(Math.sin(heading),0,Math.cos(heading)),right=new T.Vector3(Math.cos(heading),0,-Math.sin(heading));
 const hip=h.hips.getWorldPosition(new T.Vector3());hip.y=h.root.position.y+.29*h.motionScale;
 h.hips.position.copy(h.hips.parent!.worldToLocal(hip.clone()));h.root.updateMatrixWorld(true);
 for(const [i,leg]of h.legs.entries()){
  const side=i===0?1:-1,target=hip.clone().addScaledVector(right,side*.14*h.motionScale).addScaledVector(forward,.76*h.motionScale);target.y=h.root.position.y+.16*h.motionScale;
  solveLimb(leg,target,new T.Vector3(0,1,0).addScaledVector(forward,.25),h.root.getWorldQuaternion(new T.Quaternion()).multiply(leg.rotation),.98);
 }
 for(const [i,arm]of h.arms.entries()){
  const side=i===0?1:-1,target=hip.clone().addScaledVector(right,side*.31*h.motionScale).addScaledVector(forward,.27*h.motionScale);target.y+=.12*h.motionScale;
  solveLimb(arm,target,right.clone().multiplyScalar(side).addScaledVector(forward,-.4),undefined,.97);
 }
 nodes.forEach((o,i)=>{o.position.lerp(saved[i].p,1-weight);o.quaternion.slerp(saved[i].q,1-weight);});h.root.updateMatrixWorld(true);
}
