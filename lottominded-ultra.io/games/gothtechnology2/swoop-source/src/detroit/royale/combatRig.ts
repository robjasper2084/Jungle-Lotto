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
    if(h.chest){
      // Imported bone-local Y is not world up. Apply bounded torso yaw in world
      // space, then convert back to the parent's frame; no shoulder corkscrew.
      const world=h.chest.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw*.8));
      h.chest.quaternion.copy(h.chest.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));h.chest.updateWorldMatrix(false,true);
    }
    const socket=weaponSocket(pose,h.riderId,yaw,pitch,state.aimBlend,state.lean);
    w.position.set(socket.grip.x,socket.grip.y,socket.grip.z);
    w.rotation.set(-(pitch+state.kickPitch),pose.headingY+yaw+state.kickYaw,0,'YXZ');w.scale.setScalar(scale);
    w.updateWorldMatrix(true,true);
    const rot=new T.Quaternion().setFromEuler(new T.Euler(0,pose.headingY,0));
    const aim=new T.Quaternion().setFromEuler(new T.Euler(-pitch,yaw,0,'YXZ'));
    const dominant=this.weapon.socket(sockets.weapon_grip_R);
    solve(h.arms[1],dominant,new T.Vector3(.7,-.5,-.2).applyQuaternion(rot),rot.clone().multiply(aim).multiply(h.arms[1].rotation));
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
    solve(h.arms[0],target,new T.Vector3(-.7,-.5,-.2).applyQuaternion(rot),rot.clone().multiply(aim).multiply(h.arms[0].rotation));
    h.root.updateWorldMatrix(true,true);this.errorL=h.arms[0].foot.getWorldPosition(new T.Vector3()).distanceTo(target);
  }
}
