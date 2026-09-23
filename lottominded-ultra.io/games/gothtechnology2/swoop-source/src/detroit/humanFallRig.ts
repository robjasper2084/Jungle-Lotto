import * as T from 'three';
import {CrashContact} from './crashContact.ts';
import type {RidePose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';

const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
function aim(b:T.Object3D,child:T.Object3D,target:T.Vector3){
 const origin=b.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 const rotation=b.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
 b.quaternion.copy(b.parent!.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);
}
type Limb={a:T.Object3D;b:T.Object3D;c:T.Object3D;side:number};
function ik(l:Limb,target:T.Vector3,pole:T.Vector3){
 const a=l.a.getWorldPosition(v()),b=l.b.getWorldPosition(v()),c=l.c.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a);
 const distance=T.MathUtils.clamp(dir.length(),Math.abs(l1-l2)+.001,l1+l2-.001);dir.normalize();
 pole.addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<.001)pole.set(1,0,0);pole.normalize();
 const along=(l1*l1+distance*distance-l2*l2)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
 aim(l.a,l.b,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));aim(l.b,l.c,a.clone().addScaledVector(dir,distance));
}

/** Procedural articulated crash overlay. Original limb lengths and skins are retained. */
export class HumanFallRig {
 private transforms:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];private limbs:Limb[]=[];private arms:Limb[]=[];
 private pivot:T.Vector3;private base:T.Vector3;private baseRotation:T.Quaternion;private contact:CrashContact;
 private equipment:{o:T.Object3D;p:T.Vector3;q:T.Quaternion;contact:CrashContact}[]=[];
 constructor(readonly rider:T.Object3D,equipment:T.Object3D[]=[],readonly terrain?:TerrainSampler){
  rider.updateWorldMatrix(true,true);this.base=rider.position.clone();this.baseRotation=rider.quaternion.clone();
  this.pivot=rider.worldToLocal((rider.getObjectByName('Hips')??rider).getWorldPosition(v()));this.contact=new CrashContact(rider);
  rider.traverse(o=>{if((o as T.Bone).isBone)this.transforms.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
  for(const [i,side]of ['Left','Right'].entries())for(const arm of [false,true]){
   const a=rider.getObjectByName(side+(arm?'Arm':'UpLeg')),b=rider.getObjectByName(side+(arm?'ForeArm':'Leg')),c=rider.getObjectByName(side+(arm?'Hand':'Foot'));
   if(a&&b&&c)(arm?this.arms:this.limbs).push({a,b,c,side:i===0?1:-1});
  }
  this.equipment=equipment.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone(),contact:new CrashContact(o)}));
 }
 restore(){this.rider.position.copy(this.base);this.rider.quaternion.copy(this.baseRotation);for(const t of [...this.transforms,...this.equipment]){t.o.position.copy(t.p);t.o.quaternion.copy(t.q);}}
 apply(p:RidePose,floor:number){
  this.restore();const rider=this.rider,blend=p.crashRelease,restoring=p.crashRecovery>0;
  const rotation=q().setFromEuler(new T.Euler(p.crashTumble,0,p.crashRoll));rider.quaternion.copy(this.baseRotation).multiply(rotation);
  const pivot=this.pivot.clone().multiply(rider.scale),offset=pivot.clone().sub(pivot.clone().applyQuaternion(rotation));
  rider.position.add(offset).add(new T.Vector3(p.crashLateral,-p.crashDrop,p.crashForward));rider.updateWorldMatrix(true,true);
  const up=new T.Vector3(0,1,0).transformDirection(rider.matrixWorld),forward=new T.Vector3(0,0,1).transformDirection(rider.matrixWorld),right=new T.Vector3(1,0,0).transformDirection(rider.matrixWorld);
  for(const l of this.limbs){
   const hip=l.a.getWorldPosition(v()),knee=l.b.getWorldPosition(v()),foot=l.c.getWorldPosition(v()),length=hip.distanceTo(knee)+knee.distanceTo(foot);
   const curl=p.crashLegTuck*(l.side===(p.crashSide||1)?.65:1);
   const target=hip.clone().addScaledVector(up,-length*(.97-.4*curl)).addScaledVector(forward,length*.36*curl).addScaledVector(right,l.side*.08);
   if(p.crashContact>.5||restoring)target.y=Math.max(floor+.06,T.MathUtils.lerp(target.y,floor+.06,restoring?.7:p.crashSettle));
   ik(l,foot.lerp(target,blend),forward.clone().addScaledVector(right,l.side*.12));
  }
  for(const l of this.arms){
   const shoulder=l.a.getWorldPosition(v()),elbow=l.b.getWorldPosition(v()),hand=l.c.getWorldPosition(v()),length=shoulder.distanceTo(elbow)+elbow.distanceTo(hand);
   const lower=l.side===(p.crashSide||1),reach=p.crashReach,absorb=p.crashAbsorb;
   const target=shoulder.clone().addScaledVector(up,-length*(lower?.32-.18*absorb:.05))
    .addScaledVector(forward,length*(lower?.3+.32*reach-.18*absorb:.32)).addScaledVector(right,l.side*length*(lower?.32:.16));
   if(restoring){
    const stand=T.MathUtils.smoothstep(p.crashRecovery,.38,.86),support=shoulder.clone().addScaledVector(forward,.24).addScaledVector(right,l.side*.08);support.y=floor+.07;
    const relaxed=shoulder.clone().addScaledVector(up,-length*.9).addScaledVector(forward,.06);
    target.copy(support.lerp(relaxed,stand));
   }
   target.y=Math.max(floor+.045,target.y);
   ik(l,hand.lerp(target,Math.min(1,p.crashBrace*1.7+blend)),forward.clone().multiplyScalar(-.35).addScaledVector(right,l.side*.6).addScaledVector(up,-.7));
  }
  const head=rider.getObjectByName('Head');if(head){head.quaternion.multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),p.crashHeadTuck*.3));}
  this.contact.settle(rider,floor,this.terrain,.025,p.crashContact);
  for(const e of this.equipment){e.o.position.add(new T.Vector3(p.wheelCrashLateral,0,p.wheelCrashForward));e.o.quaternion.multiply(q().setFromEuler(new T.Euler(0,p.wheelCrashSpin,p.wheelCrashLean)));e.contact.settle(e.o,floor,this.terrain,.018,p.crashContact);}
 }
}
