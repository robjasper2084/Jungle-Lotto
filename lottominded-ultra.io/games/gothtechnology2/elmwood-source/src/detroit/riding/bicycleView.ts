// RideCore articulation, fitted to RideCore's existing saddle and grip sockets.
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from '../compressedGLTFLoader.ts';
import type {RidePose} from '@digital-static/ridecore';
import {BIKE_STYLES,styleCyclist} from '@digital-static/ridecore/cycling-view';
import {curlHandlebarHands,handlebarHandRotation,HANDLEBAR_WRIST_OFFSET} from './handlebarGrip.ts';
export {BIKE_STYLES};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
type Limb={a:T.Object3D;b:T.Object3D;c:T.Object3D;rotation:T.Quaternion;side:number};
function point(a:T.Object3D,b:T.Object3D,target:T.Vector3){const from=a.getWorldPosition(v()),rotation=a.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(b.getWorldPosition(v()).sub(from).normalize(),target.clone().sub(from).normalize()));a.quaternion.copy(a.parent!.getWorldQuaternion(q()).invert().multiply(rotation));a.updateWorldMatrix(false,true);}
function ik(l:Limb,target:T.Vector3,pole:T.Vector3,rotation:T.Quaternion){const a=l.a.getWorldPosition(v()),b=l.b.getWorldPosition(v()),c=l.c.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),d=Math.max(.02,Math.min(dir.length(),l1+l2-.001));dir.normalize();pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));point(l.a,l.b,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));point(l.b,l.c,a.clone().addScaledVector(dir,d));l.c.quaternion.copy(l.c.parent!.getWorldQuaternion(q()).invert().multiply(rotation));l.c.updateWorldMatrix(false,true);}
/** Fits the original articulated humans to measured saddle, crank and steering sockets. */
export class BicycleView {
  root=new T.Group();frame=new T.Group();bike:T.Object3D;rider:T.Object3D;head?:T.Object3D;hips:T.Object3D;
  private bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];private legs:Limb[]=[];private arms:Limb[]=[];
  private steering:T.Object3D;private steerRest:T.Quaternion;private crank:T.Object3D;private cleanup:()=>void;
  private disposeHands:()=>void;
  readonly style:number;private restSole=.065;private lean=.55;private spine?:T.Object3D;private neck?:T.Object3D;
  constructor(bicycle:GLTF,human:GLTF,style=0,npc=false){
    this.lean=npc?.5:.9;this.restSole=npc?.10:.065;this.style=style%BIKE_STYLES.length;this.bike=bicycle.scene.clone(true);this.rider=clone(human.scene);this.root.name='Bicycle · '+BIKE_STYLES[this.style].name;this.root.add(this.frame);this.frame.add(this.bike,this.rider);
    this.steering=this.bike.getObjectByName('Bicycle_Steering_Pivot')!;this.steerRest=this.steering.quaternion.clone();this.crank=this.bike.getObjectByName('Bicycle_Crank_Pivot')!;
    if(npc&&human.animations.length){const mixer=new T.AnimationMixer(this.rider);mixer.clipAction(human.animations[0]).play();mixer.setTime(0);}
    this.root.updateMatrixWorld(true);this.hips=this.rider.getObjectByName('Hips')!;this.head=this.rider.getObjectByName('Head');
    if(!this.hips||!this.steering||!this.crank)throw Error('The bicycle or rider rig is missing its fitted pivots.');
    this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
    for(const side of ['Left','Right'])for(const arm of [false,true]){const a=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg')),b=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg')),c=this.rider.getObjectByName(side+(arm?'Hand':'Foot'));if(!a||!b||!c)throw Error('This rider has no bicycle fit.');(arm?this.arms:this.legs).push({a,b,c,rotation:c.getWorldQuaternion(q()),side:Math.sign(this.rider.worldToLocal(c.getWorldPosition(v())).x)||1});}
    this.spine=this.rider.getObjectByName('Spine02');this.neck=this.rider.getObjectByName('Neck');
    this.cleanup=styleCyclist(this.bike,this.rider,this.style,npc);
    this.disposeHands=curlHandlebarHands(this.rider);
    this.root.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){m.castShadow=!npc;m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});
  }
  apply(p:RidePose,steering=0,pedals=0){
    this.root.position.set(p.x,p.y+.008,p.z);this.root.rotation.y=p.headingY;this.frame.rotation.set(p.groundPitch,0,p.rollAngle);this.frame.updateMatrixWorld(true);
    this.steering.quaternion.copy(this.steerRest).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering));this.crank.rotation.x=pedals;
    for(const name of ['Bicycle_Pedal_L_Pivot','Bicycle_Pedal_R_Pivot']){const o=this.bike.getObjectByName(name);if(o)o.rotation.x=-pedals;}
    for(const name of ['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot']){const o=this.bike.getObjectByName(name);if(o)o.rotation.x=p.wheelSpin;}
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}this.rider.position.set(0,0,0);this.root.updateMatrixWorld(true);
    const effort=Math.max(0,p.driveIntent)*(1-p.stopFoot),brake=Math.max(0,p.brakeAmount),bank=Math.max(-.42,Math.min(.42,p.rollAngle));
    const pulse=Math.sin(pedals*2)*.007*effort,settle=Math.min(.035,Math.abs(p.riderPitch)*.08);
    const hips=this.frame.localToWorld(new T.Vector3(-bank*.045,1.07-p.stopFoot*.08-pulse-settle,-.25+p.stopFoot*.12-brake*.035));this.hips.position.copy(this.hips.parent!.worldToLocal(hips));this.root.updateMatrixWorld(true);
    const right=new T.Vector3(1,0,0).transformDirection(this.frame.matrixWorld),forward=new T.Vector3(0,0,1).transformDirection(this.frame.matrixWorld);
    const spine=this.spine;if(spine){
      const rest=spine.getWorldQuaternion(q()),parent=spine.parent!.getWorldQuaternion(q()).invert();
      let pitch=this.lean+effort*.055-brake*.10-p.stopFoot*.18+p.groundPitch*.2;
      // Lean from the saddle until both grips are reachable. Limb lengths never change.
      for(let attempt=0;attempt<8;attempt++){
        spine.quaternion.copy(parent).multiply(q().setFromAxisAngle(right,pitch).multiply(rest));spine.updateWorldMatrix(false,true);
        let excess=0;
        for(const arm of this.arms){const shoulder=arm.a.getWorldPosition(v()),elbow=arm.b.getWorldPosition(v()),hand=arm.c.getWorldPosition(v());
          const grip=this.bike.getObjectByName(arm.side>0?'Grip001':'Grip')??this.bike.getObjectByName(arm.side>0?'Grip.001':'Grip')!;
          const wrist=grip.getWorldPosition(v()).add(HANDLEBAR_WRIST_OFFSET.clone().applyQuaternion(this.frame.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering))));
          excess=Math.max(excess,shoulder.distanceTo(wrist)-shoulder.distanceTo(elbow)-elbow.distanceTo(hand)+.055);}
        if(excess<=0)break;pitch=Math.min(1.4,pitch+Math.min(.12,excess*2));
      }
    }
    if(this.neck){this.neck.quaternion.multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering*.22+p.riderLookYaw));this.neck.updateWorldMatrix(false,true);}
    const frameQ=this.frame.getWorldQuaternion(q());
    for(let i=0;i<2;i++){
      const side=this.legs[i].side,phase=pedals+(side>0?Math.PI:0),foot=new T.Vector3(side*.13,.33-.165*Math.cos(phase)+this.restSole,-.13-.165*Math.sin(phase));
      if(!i)foot.lerp(new T.Vector3(side*.28,this.restSole,-.1),p.stopFoot);
      ik(this.legs[i],this.frame.localToWorld(foot),forward.clone(),frameQ.clone().multiply(this.legs[i].rotation));
      const grip=this.bike.getObjectByName(side>0?'Grip001':'Grip')??this.bike.getObjectByName(side>0?'Grip.001':'Grip')!;
      const barRotation=frameQ.clone().multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering));
      const wrist=grip.getWorldPosition(v()).add(HANDLEBAR_WRIST_OFFSET.clone().applyQuaternion(barRotation));
      ik(this.arms[i],wrist,forward.clone().multiplyScalar(-1).addScaledVector(right,side*(.3+effort*.08+brake*.10)+bank*.16),barRotation.multiply(handlebarHandRotation(side)));
    }
    this.root.updateMatrixWorld(true);
  }
  dispose(){this.root.removeFromParent();this.cleanup();this.disposeHands();const skeletons=new Set<T.Skeleton>();this.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)skeletons.add((o as T.SkinnedMesh).skeleton);});skeletons.forEach(s=>s.dispose());}
}
