import {styleCyclist} from '@digital-static/ridecore/cycling-view';
import * as T from 'three';
import { GLTFLoader } from './compressedGLTFLoader.ts';
import type { GLTF } from './compressedGLTFLoader.ts';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { EucPose } from '../simulation/EucController.ts';
import type { TrafficState } from './world.ts';
import { clamp } from './world.ts';
import {toLocal} from './geo-profile.ts';

type Limb={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;target:T.Vector3;rotation:T.Quaternion;};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
function pointBone(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
  const p=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(p).normalize(),to=target.clone().sub(p).normalize();
  const world=bone.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,true);
}
export function solve(l:Limb,target:T.Vector3,pole:T.Vector3,rotation?:T.Quaternion){
  const a=l.upper.getWorldPosition(v()),b=l.knee.getWorldPosition(v()),c=l.foot.getWorldPosition(v());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),d=clamp(dir.length(),.03,l1+l2-.0001);dir.normalize();
  pole.addScaledVector(dir,-pole.dot(dir)).normalize();if(pole.lengthSq()<.01)pole.set(1,0,0);
  const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  pointBone(l.upper,l.knee,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));pointBone(l.knee,l.foot,target);
  if(rotation)l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(q()).invert().multiply(rotation));
}
function rotateWorld(bone:T.Object3D|undefined,axis:T.Vector3,angle:number){if(!bone)return;const w=bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(axis,angle));bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(w));bone.updateWorldMatrix(false,true);}
function prepare(o:T.Object3D){o.traverse(n=>{const m=n as T.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});}
export async function loadActors(ids=['DS_Man_01','DS_EUC_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01','DS_Hazard_Cone_01','DS_Hazard_Barrier_01','DS_Boerboel_01']){
  const loader=new GLTFLoader(),data=new Map<string,GLTF>();
  await Promise.all(ids.map(async id=>{
    const original=()=>loader.loadAsync(`${import.meta.env.BASE_URL}exports/glb/${id}/${id==='DS_EUC_01'?'DS_EUC_Compact':id+'_LOD'+(id==='DS_Man_01'?0:1)}.glb`);
    data.set(id,id==='DS_Bicycle_01'?await loader.loadAsync(`${import.meta.env.BASE_URL}exports/glb/DS_Bicycle_Styles/DS_Bicycle_Styles_LOD1.glb`).catch(original):await original());
  }));
  return data;
}
export class Hero {
  root=new T.Group();ground=new T.Group();lean=new T.Group();vehicle:T.Object3D;rider:T.Object3D;
  wheel?:T.Object3D;hips?:T.Object3D;head?:T.Object3D;chest?:T.Object3D;
  bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];legs:Limb[]=[];arms:Limb[]=[];
  constructor(data:Map<string,GLTF>){
    this.root.add(this.ground);this.ground.add(this.lean);
    this.vehicle=data.get('DS_EUC_01')!.scene.clone(true);this.rider=clone(data.get('DS_Man_01')!.scene);
    this.rider.position.y=.296;this.lean.add(this.vehicle,this.rider);
    const m=new T.AnimationMixer(this.rider);m.clipAction(data.get('DS_Man_01')!.animations[0]).play();m.setTime(0);
    prepare(this.root);this.root.updateMatrixWorld(true);
    this.wheel=this.vehicle.getObjectByName('Wheel_Pivot');this.hips=this.rider.getObjectByName('Hips');this.head=this.rider.getObjectByName('Head');this.chest=this.rider.getObjectByName('Chest')??this.rider.getObjectByName('Spine');
    this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
    for(const side of ['Left','Right'])for(const arm of [false,true]){
      const upper=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg')),knee=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg')),foot=this.rider.getObjectByName(side+(arm?'Hand':'Foot'));
      if(upper&&knee&&foot)(arm?this.arms:this.legs).push({upper,knee,foot,target:this.lean.worldToLocal(foot.getWorldPosition(v())),rotation:this.lean.getWorldQuaternion(q()).invert().multiply(foot.getWorldQuaternion(q()))});
    }
    this.root.name='Digital Static • custom man on separate EUC';
  }
  apply(p:EucPose){
    this.root.position.set(p.x,p.y,p.z);this.root.rotation.set(0,p.headingY,0);
    this.ground.rotation.set(p.groundPitch,0,p.groundRoll);this.lean.rotation.set(p.wheelPitch,0,-p.rollAngle);
    this.vehicle.position.y=p.wheelCrashPop;this.vehicle.rotation.set(0,p.wobbleYaw+p.wheelCrashSpin,-p.wobbleRoll-p.wheelCrashLean);
    if(this.wheel)this.wheel.rotation.x=p.wheelSpin;
    this.rider.position.set(p.crashLateral,.296+p.suspensionOffset-p.crashDrop,p.crashForward);
    this.rider.rotation.set(p.crashTumble,0,p.crashRoll);
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
    this.root.updateMatrixWorld(true);
    // Fit the reference controller's stance to the supplied skeleton. Rotating
    // the entire rider without solving the legs makes the boots slide off the EUC.
    const rest=clamp(p.restFactor,0,1)*(1-clamp(p.airBlend,0,1))*(1-clamp(p.ragdollBlend,0,1));
    const riding=(1-rest)*(1-clamp(p.ragdollBlend,0,1));
    const squat=Math.min(.26,.20*p.crouch+.09*p.tuck+.045*p.attack+.035*Math.abs(p.carveStance))*riding;
    this.rider.position.y-=squat;
    // wobbleSway is a unit oscillator even on a smooth road, not metres.
    this.rider.position.x+=.045*p.wobble*p.wobbleSway*riding;
    this.rider.rotation.x+=(p.riderPitch-p.wheelPitch)*riding;
    this.rider.rotation.z+=(p.rollAngle-p.riderRoll)*riding;
    this.root.updateMatrixWorld(true);
    const forward=new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld);
    const right=new T.Vector3(1,0,0).transformDirection(this.ground.matrixWorld);
    const up=new T.Vector3(0,1,0).transformDirection(this.ground.matrixWorld);
    rotateWorld(this.chest,right,(.16*p.tuck+.08*p.attack)*riding);
    rotateWorld(this.chest,up,(p.riderTurnTwist+.18*p.reverseBlend)*riding);
    rotateWorld(this.head,up,(p.riderLookYaw-p.riderTurnTwist+.45*p.reverseBlend)*riding);
    // Balance gestures use the rig's authored shoulder axes.
    for(let i=0;i<this.arms.length;i++){
      const arm=this.arms[i];
      rotateWorld(arm.upper,forward,(i===0?-1:1)*(.20*p.airBlend+.12*Math.abs(p.carveStance))*riding);
      rotateWorld(arm.upper,right,(-.12*p.tuck+.10*p.attack)*riding);
    }
    this.applyStoppedStance(p);
    this.root.updateMatrixWorld(true);
  }
  private applyStoppedStance(p:EucPose){
    const rest=clamp(p.restFactor,0,1)*(1-clamp(p.airBlend,0,1))*(1-clamp(p.ragdollBlend,0,1));
    if(this.legs.length!==2||p.ragdollBlend>.8)return;
    // Lower the pelvis enough for the supplied rig's leg lengths, and shift
    // weight over the left supporting boot. The right boot stays on its pedal.
    this.rider.position.x+=.09*rest;
    this.rider.position.y-=.30*rest;
    this.root.updateMatrixWorld(true);
    const forward=new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld);
    for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i],target=this.lean.localToWorld(leg.target.clone());
      let rotation=this.lean.getWorldQuaternion(q()).multiply(leg.rotation);
      if(i===0){
        // The mounted sole is .296 m above the ground. Ground-space targets
        // follow the local slope and cancel suspension at the supporting foot.
        const planted=this.ground.localToWorld(new T.Vector3(.35,leg.target.y-.296,-.09));
        target.lerp(planted,rest);
        rotation.slerp(this.ground.getWorldQuaternion(q()).multiply(leg.rotation),rest);
      }
      // Start with the authored knee plane, then ease into the planted stance.
      // A fixed pole switched on at rest > 0 displaced the knee immediately.
      const hip=leg.upper.getWorldPosition(v()),ankle=leg.foot.getWorldPosition(v()),axis=ankle.sub(hip).normalize();
      const pole=leg.knee.getWorldPosition(v()).sub(hip);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      // Preserve the authored knee at neutral, then bend forward as the
      // controller compresses the legs. The blend is continuous at zero.
      const bend=clamp(rest+p.crouch+p.tuck+Math.abs(p.riderPitch)*2+Math.abs(p.rollAngle),0,1);
      pole.lerp(forward,bend).normalize();
      solve(leg,target,pole,rotation);
    }
    this.root.updateMatrixWorld(true);
  }
}
/** Retarget the cyclist's supplied skin onto the actual moving bicycle pedals. */
export class CyclistView {
  root=new T.Group();rider:T.Object3D;bicycle:T.Object3D;
  crank:T.Object3D;pedals:T.Object3D[];wheels:T.Object3D[];
  bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];
  legs:{limb:Limb;pedal:T.Object3D;offset:T.Vector3}[]=[];
  phase=0;wheelSpin=0;
  constructor(data:Map<string,GLTF>,style=0){
    const asset=data.get('DS_Cyclist_01')!;this.rider=clone(asset.scene);this.bicycle=data.get('DS_Bicycle_01')!.scene.clone(true);this.root.add(this.rider,this.bicycle);styleCyclist(this.bicycle,this.rider,style);
    const mixer=new T.AnimationMixer(this.rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);
    // Keep the supplied seated body pose; the exported clip's knee poles bend backward.
    this.root.updateMatrixWorld(true);this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
    this.crank=this.bicycle.getObjectByName('Bicycle_Crank_Pivot')!;
    this.pedals=['Bicycle_Pedal_L_Pivot','Bicycle_Pedal_R_Pivot'].map(n=>this.bicycle.getObjectByName(n)!);
    this.wheels=['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot'].map(n=>this.bicycle.getObjectByName(n)!);
    const platforms=['Pedal_Platform','Pedal_Platform001'].map(n=>this.bicycle.getObjectByName(n)!);
    for(const side of ['Left','Right']){
      const upper=this.rider.getObjectByName(side+'UpLeg')!,knee=this.rider.getObjectByName(side+'Leg')!,foot=this.rider.getObjectByName(side+'Foot')!;
      const position=this.root.worldToLocal(foot.getWorldPosition(v()));
      // The bicycle's L/R labels use the opposite convention to the human rig.
      const pedal=platforms.find(o=>Math.sign(this.root.worldToLocal(o.getWorldPosition(v())).x)===Math.sign(position.x))!;
      const offset=position.clone().sub(this.root.worldToLocal(pedal.getWorldPosition(v())));
      this.legs.push({limb:{upper,knee,foot,target:position,rotation:this.root.getWorldQuaternion(q()).invert().multiply(foot.getWorldQuaternion(q()))},pedal,offset});
    }
    prepare(this.root);this.applyPhase(0,0);
  }
  applyPhase(phase:number,wheelSpin=this.wheelSpin){
    this.phase=phase;this.wheelSpin=wheelSpin;
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
    this.crank.rotation.x=phase;
    for(const pedal of this.pedals)pedal.rotation.x=-phase; // Keep platforms level.
    for(const wheel of this.wheels)wheel.rotation.x=wheelSpin;
    this.root.updateWorldMatrix(true,true);
    const rotation=this.root.getWorldQuaternion(q()),forward=new T.Vector3(0,0,1).applyQuaternion(rotation);
    for(const {limb,pedal,offset} of this.legs){
      const target=this.root.worldToLocal(pedal.getWorldPosition(v())).add(offset);
      solve(limb,this.root.localToWorld(target),forward.clone(),rotation.clone().multiply(limb.rotation));
    }
    this.root.updateWorldMatrix(true,true);
  }
  update(speed:number,dt:number){
    const distance=Math.max(0,speed)*Math.max(0,dt);
    // 5.2 m per crank revolution gives about 39 rpm at the 3.4 m/s cruise.
    this.applyPhase((this.phase+distance/5.2*Math.PI*2)%(Math.PI*2),(this.wheelSpin+distance/.34)%(Math.PI*2));
  }
}
export class TrafficView {
  scene:T.Scene;data:Map<string,GLTF>;items=new Map<number,{root:T.Group;mixers:T.AnimationMixer[];cyclist?:CyclistView}>();
  constructor(scene:T.Scene,data:Map<string,GLTF>){this.scene=scene;this.data=data;}
  update(actors:TrafficState[],dt:number){const keep=new Set<number>();for(const a of actors){keep.add(a.id);let item=this.items.get(a.id);
    if(!item){const root=new T.Group(),mixers:T.AnimationMixer[]=[];const add=(id:string,animate=false)=>{const d=this.data.get(id)!,o=animate?clone(d.scene):d.scene.clone(true);root.add(o);prepare(o);if(animate&&d.animations.length){const m=new T.AnimationMixer(o);m.clipAction(d.animations[0]).play();mixers.push(m);}};
      let cyclist:CyclistView|undefined;
      if(a.kind==='pedestrian')add('DS_Pedestrian_01',true);else if(a.kind==='cyclist'){cyclist=new CyclistView(this.data);root.add(cyclist.root);}else add(a.kind==='cone'?'DS_Hazard_Cone_01':'DS_Hazard_Barrier_01');
      item={root,mixers,cyclist};this.items.set(a.id,item);this.scene.add(root);
    }
    // Convert cartographic coordinates explicitly. Skeletal IK must not inherit
    // mapScene's negative X scale: a reflected basis cannot be represented by quaternions.
    const local=toLocal(a.x,a.y,a.z);
    item.root.position.set(local.x,local.y,local.z);item.root.rotation.y=-a.heading;for(const m of item.mixers)m.update(dt);
    item.cyclist?.update(a.speed,dt);
  }for(const[id,item]of this.items)if(!keep.has(id)){item.root.removeFromParent();item.mixers.forEach(m=>m.stopAllAction());this.items.delete(id);}}
}
