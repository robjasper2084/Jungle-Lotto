import {evadePhase} from '../../../../ride-core/src/royale/evade.ts';
import {reloadPose} from './fpsMotion.ts';
import {templateLook} from '../../../../ride-core/src/templateActions.ts';
import {applyKimodoLean,applyKimodoEvade} from '../../../../ride-core/src/onFootRider.ts';
import {weaponReadyAmount} from '../../../../ride-core/src/royale/holster.ts';
import {cameraDrawPose} from '../../../../ride-core/src/royale/cameraDraw.ts';
import * as T from 'three';
import {Hero,solve} from '../actors.ts';
import type {RidePose} from '../controller.ts';
import {weaponSocket,type CombatState} from '../../../../ride-core/src/royale/rules.ts';
import {EQUIPMENT_SOCKETS as sockets} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {WeaponView,type HeldRepairPack} from './equipment.ts';
import leanProfile from './leanProfiles.json' with {type:'json'};
import {meleeTargets} from '../../../../ride-core/src/royale/melee.ts';

/** Base riding pose -> torso -> independent weapon frame -> dominant IK ->
 * hand-mounted weapon -> support IK. No hand ever drives its own IK target. */
export class CombatRig {
  errorR=0;errorL=0;supportLocked=true;private pickupTick=-999;
  private gestureTick=-1;private gestureWeight=0;private gestureHealing=false;private gesturePulse=0;
  pickup(tick:number){this.pickupTick=tick;}
  hideHandheld(){this.repairPack.visible=false;}
  interruptPickup(){this.pickupTick=-999;this.gestureWeight=0;}
  private repairProp:HeldRepairPack;private repairPack:T.Group;
  private backRest=new T.Quaternion();
  constructor(readonly hero:Hero,readonly weapon:WeaponView,private readonly firstPerson=false){this.repairProp=weapon.createHeldRepair();this.repairPack=this.repairProp.root;hero.root.add(this.repairPack);(hero.chest??hero.rider).getWorldQuaternion(this.backRest).invert();}
  private gripOffset(left:boolean){const wide=this.weapon.kind==='bass';return new T.Vector3(left?(wide?.31:.24):wide?-.30:-.23,-.035,left?-.035:-.085).multiplyScalar(this.hero.motionScale).applyQuaternion(this.weapon.root.quaternion);}
  private handRotation(index:number,weaponRotation:T.Quaternion){
    const limb=this.hero.arms[index],rotation=limb.rotation.clone();
    if(this.firstPerson){
      const finger=limb.foot.getObjectByName((index===0?'Left':'Right')+'HandMiddle1');
      // Lift the dominant palm around the handle; the support palm crosses
      // under the receiver. Pointing both palms straight down the barrel only
      // exposes the ends of the knuckles and reads as two empty sleeve tubes.
      if(finger){const palm=finger.position.clone().normalize().applyQuaternion(rotation);
        const gripDirection=index===0?new T.Vector3(-.65,.40,.65):new T.Vector3(.45,.75,.35);
        rotation.premultiply(new T.Quaternion().setFromUnitVectors(palm,gripDirection.normalize()));}
    }
    return rotation.premultiply(weaponRotation);
  }
  apply(pose:RidePose,yaw:number,pitch:number,state:CombatState,tick:number,healingUntil=0){
    const h=this.hero,w=this.weapon.root,scale=h.motionScale;w.visible=true;this.repairPack.visible=false;
    // Keep the captured support hands during falls and the middle of a laydown.
    if(pose.crashBlend>0||(pose.footProne>.08&&pose.footProne<.92)){w.visible=false;this.interruptPickup();this.supportLocked=false;this.errorL=this.errorR=0;h.fingers.apply('Relaxed');return;}
    if(pose.footMode===3){w.visible=false;this.interruptPickup();this.supportLocked=false;return;}
    if(!h.arms[0]||!h.arms[1]){w.visible=false;return;}
    if(pose.footMode===2&&(state.melee?.evadeUntil??0)>tick){
      applyKimodoEvade(h,pose,evadePhase(state.melee!.evadeUntil,tick),state.melee!.evadeDir);
      w.visible=false;this.interruptPickup();this.supportLocked=false;this.errorL=this.errorR=0;h.fingers.apply('Relaxed');return;
    }
    if(pose.footVault>0){w.visible=false;this.interruptPickup();this.supportLocked=false;return;}
    if(pose.footMode===2)applyKimodoLean(h,state.lean,pose);
    const ready=weaponReadyAmount(state,tick);
    if(ready<1&&!state.melee?.brawl&&healingUntil<=tick){this.applyHolster(pose,yaw,pitch,state,ready);return;}
    // Preserve Swoop's base pose and distribute the aim turn through the spine.
    // A full turn on the top joint folds the jacket/armor around a fixed waist.
    const spine=h.spine.length?h.spine:h.chest?[h.chest]:[];
    const look=templateLook(yaw,pitch);
    const torsoYaw=state.melee?.brawl?0:((look['UpperChest Twist Left-Right']??0)*.55+(look['Spine Twist Left-Right']??0)*.3);
    for(const [index,bone] of spine.entries()){
      const turn=T.MathUtils.clamp(torsoYaw/Math.max(1,spine.length),-.4,.4);
      const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
      // Mounted riders retain the additive torso lean. On-foot riders already
      // received the captured full-body lean and foot planting above.
      const lean=leanProfile.profiles.CombatLeanRight;
      const axis=new T.Vector3(Math.sin(pose.headingY),0,Math.cos(pose.headingY));
      if(!state.melee?.brawl){const amount=((look['Spine Front-Back']??0)+(look['Chest Front-Back']??0)+(look['UpperChest Front-Back']??0))*.3/Math.max(1,spine.length);world.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(Math.cos(pose.headingY),0,-Math.sin(pose.headingY)),-amount));}
      if(pose.footMode!==2)world.premultiply(new T.Quaternion().setFromAxisAngle(axis,T.MathUtils.clamp(state.lean,-1,1)*lean.radians*(lean.weights[index]??0)));
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
    }
    // The template separates head look from locomotion. Keep the chosen walk
    // and planted legs, while the neck/head share the remaining aim elevation.
    if(!state.melee?.brawl){
      const right=new T.Vector3(Math.cos(pose.headingY+yaw),0,-Math.sin(pose.headingY+yaw));
      for(const [bone,name]of [[h.neck,'Neck'],[h.head,'Head']] as const){if(!bone)continue;
        const nod=(look[name+' Nod Down-Up']??0)*(name==='Head'?.58:.42),turn=(look[name+' Turn Left-Right']??0)*(name==='Head'?.62:.35);
        const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(right,-nod)).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
        bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
      }
    }
    const socket=weaponSocket(pose,h.riderId,yaw,pitch,state.aimBlend,state.lean);
    w.position.set(socket.grip.x,socket.grip.y,socket.grip.z);
    w.rotation.set(-(pitch+state.kickPitch),pose.headingY+yaw+state.kickYaw,0,'YXZ');w.scale.setScalar(scale);
    if(!this.firstPerson){const reload=reloadPose(state,tick);if(reload.active){w.rotateX(reload.pitch);w.rotateY(reload.yaw);w.rotateZ(-reload.cant);}}
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
    // Read the real shoulder axis: these assets put LeftArm on local +X.
    // The old fixed signs pulled both elbows inward through the torso.
    const outside=h.arms[0].upper.getWorldPosition(new T.Vector3()).sub(h.arms[1].upper.getWorldPosition(new T.Vector3()));outside.y=0;outside.normalize();
    const elbowPole=(side:number)=>outside.clone().multiplyScalar(side*.7).add(new T.Vector3(0,-.65,0)).add(new T.Vector3(0,0,-.15).applyQuaternion(rot));
    if(state.reloadStart<0){
      // Riding, aiming and leaning change shoulder reach. Fit the weapon inside
      // both arms' reach before solving either hand, preserving its orientation.
      // This presentation offset does not alter the authoritative firing ray.
      const reach=h.arms.map(l=>{const a=l.upper.getWorldPosition(new T.Vector3()),b=l.knee.getWorldPosition(new T.Vector3()),c=l.foot.getWorldPosition(new T.Vector3());return{shoulder:a,length:(a.distanceTo(b)+b.distanceTo(c))*.995};});
      for(let pass=0;pass<6;pass++){
        let adjusted=false;
        for(const index of [1,0]){
          const target=this.weapon.socket(index?sockets.weapon_grip_R:sockets.support_grip_L);
          if(this.firstPerson)target.add(this.gripOffset(index===0));
          const delta=target.sub(reach[index].shoulder),distance=delta.length();
          if(distance>reach[index].length+.000001){w.position.add(delta.multiplyScalar(reach[index].length/distance-1));w.updateWorldMatrix(true,true);adjusted=true;}
        }
        if(!adjusted)break;
      }
    }
    const dominant=this.weapon.socket(sockets.weapon_grip_R);
    if(this.firstPerson)dominant.add(this.gripOffset(false));
    const gripRotation=w.getWorldQuaternion(new T.Quaternion());
    solve(h.arms[1],dominant,elbowPole(-1),this.handRotation(1,gripRotation));
    h.root.updateWorldMatrix(true,true);
    const actual=h.arms[1].foot.getWorldPosition(new T.Vector3());this.errorR=actual.distanceTo(dominant);
    // Preserve a rigid grip even when a target exceeds the arm's natural reach.
    // The measured offset is exposed by the rig review; bones are never stretched.
    w.position.add(actual.sub(dominant));w.updateWorldMatrix(true,true);
    const support=this.weapon.socket(sockets.support_grip_L);
    if(this.firstPerson)support.add(this.gripOffset(true));
    this.supportLocked=!reloadPose(state,tick).active;
    let target=support.clone();
    if(!this.supportLocked){
      const reload=reloadPose(state,tick);
      const hand=new T.Vector3().fromArray(reload.capture.hand);hand.x*=-1;
      target.add(hand.multiplyScalar(scale).applyQuaternion(rot));
    }
    solve(h.arms[0],target,elbowPole(1),this.handRotation(0,gripRotation));
    const release=reloadPose(state,tick).magazine;
    h.fingers.apply('SupportGrip','WeaponGrip',release);
    h.fingers.applyTemplateGrip();
    this.weapon.reloadVisual(reloadPose(state,tick),!this.firstPerson);
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
      if(repair&&healing){
        this.repairPack.visible=weight>.5;this.repairPack.scale.setScalar(scale);
        // The authored case rests above the palm. Hand bone axes differ between
        // heroes; inheriting them turns its lid into the wrist and sleeve.
        const palm=h.arms[0].foot.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.035,.035).multiplyScalar(scale).applyQuaternion(heading));
        this.repairPack.position.copy(h.root.worldToLocal(palm));
        this.repairPack.quaternion.copy(h.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(heading));
        this.repairProp.sample(tick,healingUntil,typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      // Holster while either hand is occupied; restore only at the ready grip.
      w.visible=false;h.fingers.apply('SupportGrip','WeaponGrip',(repair?.45:.85)*weight);
    }
  }
  private applyHolster(pose:RidePose,yaw:number,pitch:number,state:CombatState,ready:number){
    const h=this.hero,w=this.weapon.root,scale=h.motionScale,draw=cameraDrawPose(ready);
    this.gestureWeight=0;this.supportLocked=draw.support>.99;this.errorL=this.errorR=0;
    const heading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),pose.headingY);
    // Upper-body mask: a small reach turn, then the same aim/lean as the ready
    // pose. Feet retain the walking/crouching action without an endpoint snap.
    const spine=h.spine.length?h.spine:h.chest?[h.chest]:[];
    for(const [index,bone]of spine.entries()){
      const turn=T.MathUtils.clamp((T.MathUtils.clamp(yaw*.8,-1,1)*draw.swing+draw.twist)/Math.max(1,spine.length),-.4,.4);
      const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn));
      const lean=leanProfile.profiles.CombatLeanRight,axis=new T.Vector3(Math.sin(pose.headingY),0,Math.cos(pose.headingY));
      if(pose.footMode!==2)world.premultiply(new T.Quaternion().setFromAxisAngle(axis,T.MathUtils.clamp(state.lean,-1,1)*lean.radians*(lean.weights[index]??0)*draw.swing));
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
    }
    const socket=weaponSocket(pose,h.riderId,yaw*ready,pitch*ready,state.aimBlend*ready,state.lean*ready);
    const chest=h.chest??h.rider,backFrame=chest.getWorldQuaternion(new T.Quaternion()).multiply(this.backRest);
    const origin=chest.getWorldPosition(new T.Vector3()),at=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).multiplyScalar(scale).applyQuaternion(backFrame).add(origin);
    // Move the handle toward the dominant shoulder. First lift the camera off
    // its back mount; only then rotate it around the outside of the shoulder.
    const back=at(-.22,-.09,-.27),lift=at(-.46,.15,-.23),readyGrip=new T.Vector3(socket.grip.x,socket.grip.y,socket.grip.z);
    w.position.copy(back).lerp(lift,draw.lift);
    if(draw.swing>0)w.position.copy(new T.CubicBezierCurve3(lift,at(-.53,.19,.04),readyGrip.clone().add(new T.Vector3(-.12,.065,.02).multiplyScalar(scale).applyQuaternion(heading)),readyGrip).getPoint(draw.swing));
    w.position.y+=draw.settle*scale;
    const stowedRotation=backFrame.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,-.35,'ZXY')));
    const aimRotation=new T.Quaternion().setFromEuler(new T.Euler(-(pitch+state.kickPitch),pose.headingY+yaw+state.kickYaw,0,'YXZ'));
    w.quaternion.copy(stowedRotation).slerp(aimRotation,draw.swing);
    w.scale.setScalar(scale);w.updateWorldMatrix(true,true);
    const outside=h.arms[0].upper.getWorldPosition(new T.Vector3()).sub(h.arms[1].upper.getWorldPosition(new T.Vector3())).normalize();
    for(const i of [1,0]){
      const limb=h.arms[i],weight=i===1?draw.grip:draw.support;
      if(weight<=0)continue;
      const target=this.weapon.socket(i===1?sockets.weapon_grip_R:sockets.support_grip_L);
      const base=limb.foot.getWorldPosition(new T.Vector3()),rotation=limb.foot.getWorldQuaternion(new T.Quaternion());
      const reach=base.lerp(target,weight);
      // The empty hand travels upward and outside before closing on the handle.
      if(i===1&&weight<1)reach.add(new T.Vector3(-.12,.25,-.05).multiplyScalar(Math.sin(weight*Math.PI)*scale).applyQuaternion(heading));
      const side=i===0?1:-1,pole=outside.clone().multiplyScalar(side*.7).add(new T.Vector3(0,-.65+.85*(1-draw.swing)*(i===1?1:0),-.15).applyQuaternion(heading));
      const handRotation=w.quaternion.clone().multiply(limb.rotation);
      solve(limb,reach,pole,rotation.slerp(handRotation,weight));
      if(i===1&&weight>.999){
        // Drive the prop from the solved palm, not an independent sliding path.
        // This also keeps short mascot arms attached without stretching bones.
        const actual=limb.foot.getWorldPosition(new T.Vector3());
        w.position.add(actual.sub(target));w.updateWorldMatrix(true,true);
        this.errorR=limb.foot.getWorldPosition(new T.Vector3()).distanceTo(this.weapon.socket(sockets.weapon_grip_R));
      }else if(i===0&&weight>.999)this.errorL=limb.foot.getWorldPosition(new T.Vector3()).distanceTo(target);
    }
    h.fingers.apply(draw.support>.5?'SupportGrip':'Relaxed',draw.grip>.85?'WeaponGrip':'Relaxed');
    h.root.updateWorldMatrix(true,true);
  }
}
