import * as T from 'three';
import {Hero,solve} from '../actors.ts';
import type {RidePose} from '../controller.ts';
import {weaponSocket,type CombatState} from '../../../../ride-core/src/royale/rules.ts';
import {EQUIPMENT_SOCKETS as sockets} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {WeaponView} from './equipment.ts';

/** Base riding pose -> torso -> independent weapon frame -> dominant IK ->
 * hand-mounted weapon -> support IK. No hand ever drives its own IK target. */
export class CombatRig {
  errorR=0;errorL=0;supportLocked=true;
  constructor(readonly hero:Hero,readonly weapon:WeaponView){}
  apply(pose:RidePose,yaw:number,pitch:number,state:CombatState,tick:number){
    const h=this.hero,w=this.weapon.root,scale=h.motionScale;
    if(!h.arms[0]||!h.arms[1]){w.visible=false;return;}
    // Preserve Swoop's base pose and distribute the aim turn through the spine.
    // A full turn on the top joint folds the jacket/armor around a fixed waist.
    const spine=h.spine.length?h.spine:h.chest?[h.chest]:[];
    const torsoYaw=T.MathUtils.clamp(yaw*.8,-1,1);
    for(const bone of spine){
      const turn=T.MathUtils.clamp(torsoYaw/Math.max(1,spine.length),-.4,.4);
      const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
    }
    const socket=weaponSocket(pose,h.riderId,yaw,pitch,state.aimBlend,state.lean);
    w.position.set(socket.grip.x,socket.grip.y,socket.grip.z);
    w.rotation.set(-(pitch+state.kickPitch),pose.headingY+yaw+state.kickYaw,0,'YXZ');w.scale.setScalar(scale);
    w.updateWorldMatrix(true,true);
    const rot=new T.Quaternion().setFromEuler(new T.Euler(0,pose.headingY,0));
    const aim=new T.Quaternion().setFromEuler(new T.Euler(-pitch,yaw,0,'YXZ'));
    // Read the real shoulder axis: these assets put LeftArm on local +X.
    // The old fixed signs pulled both elbows inward through the torso.
    const outside=h.arms[0].upper.getWorldPosition(new T.Vector3()).sub(h.arms[1].upper.getWorldPosition(new T.Vector3())).normalize();
    const elbowPole=(side:number)=>outside.clone().multiplyScalar(side*.7).add(new T.Vector3(0,-.65,0)).add(new T.Vector3(0,0,-.15).applyQuaternion(rot));
    const dominant=this.weapon.socket(sockets.weapon_grip_R);
    solve(h.arms[1],dominant,elbowPole(-1),rot.clone().multiply(aim).multiply(h.arms[1].rotation));
    h.root.updateWorldMatrix(true,true);
    const actual=h.arms[1].foot.getWorldPosition(new T.Vector3());this.errorR=actual.distanceTo(dominant);
    // Preserve a rigid grip even when a target exceeds the arm's natural reach.
    // The measured offset is exposed by the rig review; bones are never stretched.
    w.position.add(actual.sub(dominant));w.updateWorldMatrix(true,true);
    const support=this.weapon.socket(sockets.support_grip_L);
    this.supportLocked=state.reloadStart<0;
    let target=support.clone();
    if(!this.supportLocked){
      const progress=T.MathUtils.clamp((tick-state.reloadStart)/Math.max(1,state.reloadEnd-state.reloadStart),0,1);
      const release=Math.sin(Math.PI*progress)**2;
      const mag=this.weapon.socket(sockets.magazine_socket).add(new T.Vector3(-.03,-.18,-.08).multiplyScalar(scale).applyQuaternion(rot));
      target.lerp(mag,release);
    }
    solve(h.arms[0],target,elbowPole(1),rot.clone().multiply(aim).multiply(h.arms[0].rotation));
    h.root.updateWorldMatrix(true,true);this.errorL=h.arms[0].foot.getWorldPosition(new T.Vector3()).distanceTo(target);
  }
}
