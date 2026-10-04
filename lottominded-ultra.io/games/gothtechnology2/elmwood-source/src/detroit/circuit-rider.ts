import * as T from 'three';
import {GLTFLoader,type GLTF} from './compressedGLTFLoader.ts';
import {Hero,solve} from './actors.ts';
import type {EucPose} from '../simulation/EucController.ts';
import {WHEEL} from '../data/tuning.ts';

export type CircuitOutfit='suit'|'hoodie';
export async function loadCircuitRiders(){
 const loader=new GLTFLoader(),data=new Map<string,GLTF>();
 await Promise.all(['suit','hoodie','euc'].map(async id=>data.set(id,await loader.loadAsync(`${import.meta.env.BASE_URL}circuit-riders/models/circuit-${id}.glb`))));return data;
}
/** Shared physics, with foot targets fitted to the short character's own bind skeleton. */
export class CircuitHero extends Hero{
 readonly outfit:CircuitOutfit;
 constructor(data:Map<string,GLTF>,outfit:CircuitOutfit){
  super(new Map([['DS_Man_01',{...data.get(outfit)!,animations:data.get(outfit)!.animations.filter(a=>a.name==='Idle')}],['DS_EUC_01',data.get('euc')!]]));
  this.outfit=outfit;this.rider.position.y=.249;this.root.name=`Digital Static Circuit ${outfit}`;this.root.updateMatrixWorld(true);
  for(const l of [...this.legs,...this.arms]){l.target.copy(this.lean.worldToLocal(l.foot.getWorldPosition(new T.Vector3())));l.rotation.copy(this.lean.getWorldQuaternion(new T.Quaternion()).invert().multiply(l.foot.getWorldQuaternion(new T.Quaternion())));}
 }
 override apply(p:EucPose){
  const rest=T.MathUtils.clamp(p.restFactor,0,1)*(1-T.MathUtils.clamp(p.airBlend,0,1))*(1-T.MathUtils.clamp(p.ragdollBlend,0,1));
  this.root.position.set(p.x,p.y,p.z);this.root.rotation.set(0,p.headingY,0);this.ground.rotation.set(p.groundPitch,0,p.groundRoll);this.lean.rotation.set(p.wheelPitch,0,-p.rollAngle);
  const wheelRestTilt=.32*rest;
  this.vehicle.position.set(0,p.wheelCrashPop+.29*(1-Math.cos(wheelRestTilt)),0);this.vehicle.rotation.set(0,p.wobbleYaw+p.wheelCrashSpin,wheelRestTilt-p.wobbleRoll-p.wheelCrashLean);
  if(this.wheel)this.wheel.rotation.x=p.wheelSpin*(WHEEL.tyreDiameter/2)/.29;
  this.rider.position.set(p.crashLateral+.24*rest,.249+p.suspensionOffset*(1-rest)-p.crashDrop-.26*rest,p.crashForward+.045*rest);
  this.rider.position.y-=Math.min(.16,.13*p.crouch+.06*p.tuck+.025*p.attack)*(1-rest)*(1-T.MathUtils.clamp(p.ragdollBlend,0,1));
  this.rider.rotation.set(p.crashTumble,0,p.crashRoll);
  for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
  if(this.chest){this.chest.rotation.x+=T.MathUtils.clamp(p.riderPitch-p.wheelPitch,-.18,.18)+.08*p.crouch;this.chest.rotation.y+=p.riderTurnTwist*.35;this.chest.rotation.z+=(p.rollAngle-p.riderRoll)*.5;}
  if(this.head)this.head.rotation.y+=p.riderLookYaw*.5;
  this.root.updateMatrixWorld(true);
  const forward=new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld);
  this.legs.forEach((l,i)=>{
   const target=this.vehicle.localToWorld(l.target.clone());let rotation=this.vehicle.getWorldQuaternion(new T.Quaternion()).multiply(l.rotation);
   if(i===0){target.lerp(this.ground.localToWorld(new T.Vector3(.44,.10,.04)),rest);rotation.slerp(this.ground.getWorldQuaternion(new T.Quaternion()).multiply(l.rotation),rest);}
   solve(l,target,forward.clone(),rotation);
  });
  this.root.updateMatrixWorld(true);
 }
}
