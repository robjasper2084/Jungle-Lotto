import {reloadPose} from './fpsMotion.ts';
import * as T from 'three';
import {Hero,solve} from '../actors.ts';
import type {RidePose} from '../controller.ts';
import {weaponSocket,type CombatState} from '../../../../ride-core/src/royale/rules.ts';
import {EQUIPMENT_SOCKETS as sockets} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {WeaponView} from './equipment.ts';
import leanProfile from './leanProfiles.json' with {type:'json'};
import {meleeTargets} from '../../../../ride-core/src/royale/melee.ts';

const packShape=new T.BoxGeometry(.13,.08,.045),packMaterial=new T.MeshStandardMaterial({color:0xa9e6c9,roughness:.8});
/** Base riding pose -> torso -> independent weapon frame -> dominant IK ->
 * hand-mounted weapon -> support IK. No hand ever drives its own IK target. */
export class CombatRig {
  errorR=0;errorL=0;supportLocked=true;private pickupTick=-999;
  private gestureTick=-1;private gestureWeight=0;private gestureHealing=false;private gesturePulse=0;
  pickup(tick:number){this.pickupTick=tick;}
  interruptPickup(){this.pickupTick=-999;this.gestureWeight=0;}
  private repairPack=new T.Mesh(packShape,packMaterial);
  constructor(readonly hero:Hero,readonly weapon:WeaponView){this.repairPack.name="Held health pack";this.repairPack.visible=false;hero.root.add(this.repairPack);}
  apply(pose:RidePose,yaw:number,pitch:number,state:CombatState,tick:number,healingUntil=0){
    const h=this.hero,w=this.weapon.root,scale=h.motionScale;w.visible=true;this.repairPack.visible=false;
    if(pose.footMode===3){w.visible=false;this.interruptPickup();this.supportLocked=false;return;}
    if(!h.arms[0]||!h.arms[1]){w.visible=false;return;}
    // Preserve Swoop's base pose and distribute the aim turn through the spine.
    // A full turn on the top joint folds the jacket/armor around a fixed waist.
    const spine=h.spine.length?h.spine:h.chest?[h.chest]:[];
    const torsoYaw=state.melee?.brawl?0:T.MathUtils.clamp(yaw*.8,-1,1);
    for(const [index,bone] of spine.entries()){
      const turn=T.MathUtils.clamp(torsoYaw/Math.max(1,spine.length),-.4,.4);
      const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
      // Blender-authored additive combat lean. Keep the hips/feet on Swoop's
      // base pose, and let the existing authoritative lean blend drive it.
      const lean=leanProfile.profiles.CombatLeanRight;
      const axis=new T.Vector3(Math.sin(pose.headingY),0,Math.cos(pose.headingY));
      world.premultiply(new T.Quaternion().setFromAxisAngle(axis,T.MathUtils.clamp(state.lean,-1,1)*lean.radians*(lean.weights[index]??0)));
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
    }
    const socket=weaponSocket(pose,h.riderId,yaw,pitch,state.aimBlend,state.lean);
    w.position.set(socket.grip.x,socket.grip.y,socket.grip.z);
    w.rotation.set(-(pitch+state.kickPitch),pose.headingY+yaw+state.kickYaw,0,'YXZ');w.scale.setScalar(scale);
    w.updateWorldMatrix(true,true);
    const healing=healingUntil>tick,pickupAge=(tick-this.pickupTick)/60;
    const gestureActive=healing||(pickupAge>=0&&pickupAge<.65&&state.reloadStart<0);
    const elapsed=this.gestureTick<0?0:(tick-this.gestureTick)/60;this.gestureTick=tick;
    if(elapsed<0||elapsed>.25)this.gestureWeight=0;
    const targetWeight=gestureActive&&!state.melee?.brawl?1:0;
    const fade=Math.max(0,Math.min(.1,elapsed))/.14;
    this.gestureWeight+=T.MathUtils.clamp(targetWeight-this.gestureWeight,-fade,fade);
    if(gestureActive){this.gestureHealing=healing;this.gesturePulse=healing?Math.sin((healingUntil-tick)*.16):Math.sin(pickupAge/.65*Math.PI);}
    if(state.melee?.brawl&&pose.footMode===2){
      const targets=meleeTargets(state.melee,tick),heading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),pose.headingY);
      // Upper-body strike mask leaves the current stride intact. Only a power
      // kick overrides one leg; the supporting foot retains ground contact.
      for(const bone of spine){const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),targets.twist/Math.max(1,spine.length)));bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
      const at=(values:number[])=>new T.Vector3().fromArray(values).multiplyScalar(scale).applyQuaternion(heading).add(new T.Vector3(pose.x,pose.y,pose.z));
      for(const [i,values]of [targets.left,targets.right].entries()){const limb=h.arms[i],pole=new T.Vector3(i===0?.7:-.7,-.3,-.3).applyQuaternion(heading);solve(limb,at(values),pole,heading.clone().multiply(limb.rotation));}
      if(state.melee.kind===3&&h.legs[1]){const leg=h.legs[1];solve(leg,at(targets.kick),new T.Vector3(0,.4,1).applyQuaternion(heading),heading.clone().multiply(leg.rotation));}
      h.fingers.apply('MeleeFist');h.root.updateWorldMatrix(true,true);w.visible=false;this.errorL=this.errorR=0;return;
    }
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
      const reload=reloadPose(state,tick);
      const mag=this.weapon.socket(sockets.magazine_socket).add(new T.Vector3(-.03-.065*reload.magazine,-.10-.22*reload.magazine,-.08).multiplyScalar(scale).applyQuaternion(rot));
      target.lerp(mag,reload.lower);
      // After insertion the hand returns over the receiver to ready the weapon.
      if(reload.charge>0)target.lerp(this.weapon.socket(sockets.support_grip_L).add(new T.Vector3(0,.06,-.12).multiplyScalar(scale).applyQuaternion(rot)),reload.charge);
    }
    solve(h.arms[0],target,elbowPole(1),rot.clone().multiply(aim).multiply(h.arms[0].rotation));
    const release=reloadPose(state,tick).magazine;
    h.fingers.apply('SupportGrip','WeaponGrip',release);
    h.root.updateWorldMatrix(true,true);this.errorL=h.arms[0].foot.getWorldPosition(new T.Vector3()).distanceTo(target);
    // Solve the ready pose first, then blend the hands toward the action. Both
    // entry and exit retain the current stride and the real limb lengths.
    if(this.gestureWeight>0){
      const weight=T.MathUtils.smoothstep(this.gestureWeight,0,1),heading=rot,pulse=this.gesturePulse,repair=this.gestureHealing;
      for(const [i,limb]of h.arms.entries()){
        const side=i===0?1:-1,shoulder=limb.upper.getWorldPosition(new T.Vector3());
        const offset=new T.Vector3(side*(repair?-.16:.12),repair?-.18:-.23-.18*pulse,repair?.26+.015*pulse:.25+.10*pulse).multiplyScalar(scale).applyQuaternion(heading);
        const destination=limb.foot.getWorldPosition(new T.Vector3()).lerp(shoulder.add(offset),weight);
        const rotation=limb.foot.getWorldQuaternion(new T.Quaternion()).slerp(heading.clone().multiply(limb.rotation),weight);
        solve(limb,destination,elbowPole(side),rotation);
      }
      if(repair&&healing){this.repairPack.visible=weight>.5;this.repairPack.scale.setScalar(scale);this.repairPack.position.copy(h.root.worldToLocal(h.arms[0].foot.getWorldPosition(new T.Vector3())));this.repairPack.quaternion.copy(h.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(h.arms[0].foot.getWorldQuaternion(new T.Quaternion())));}
      // Holster while either hand is occupied; restore only at the ready grip.
      w.visible=false;h.fingers.apply('SupportGrip','WeaponGrip',(repair?.45:.85)*weight);
    }
  }
}
