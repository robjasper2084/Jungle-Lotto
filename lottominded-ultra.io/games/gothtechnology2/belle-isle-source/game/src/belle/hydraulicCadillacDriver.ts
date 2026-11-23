import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {FingerPose} from '../../runtime/ride-core/src/fingerPose.ts';
import {solveLimb} from '../../runtime/ride-core/src/limbIK.ts';
import {independentRig} from './cadillacCabin.ts';

// Cabin coordinates in metres relative to the Cadillac's sprung chassis.
const steeringCenter=new T.Vector3(.43,.93,.52);
const steeringAxis=new T.Vector3(0,.42,-.91).normalize();

export class HydraulicCadillacDriver {
  private readonly rig:T.Object3D;
  private readonly arms;
  private readonly point=new T.Vector3();
  private readonly pole=new T.Vector3();
  private readonly chassisRotation=new T.Quaternion();
  private readonly gripRotation=new T.Quaternion();
  private readonly handRotation=new T.Quaternion();
  private lastSteering=NaN;

  constructor(private readonly chassis:T.Object3D,asset:GLTF){
    this.rig=independentRig(asset.scene);
    this.rig.name='Cadillac_Hoodie_Driver';
    this.rig.userData.sourceAsset='DS_Hoodie_Woman_01';
    chassis.add(this.rig);
    const bone=(name:string)=>{
      const found=this.rig.getObjectByName(name);
      if(!found)throw Error('Hoodie driver bone missing: '+name);
      return found;
    };
    chassis.getWorldQuaternion(this.chassisRotation);
    const inverse=this.chassisRotation.clone().invert();
    const sides=['Left','Right'] as const;
    const legs=sides.map(side=>{
      const foot=bone(side+'Foot');
      return {upper:bone(side+'UpLeg'),knee:bone(side+'Leg'),foot,
        rotation:foot.getWorldQuaternion(new T.Quaternion()).premultiply(inverse)};
    });
    this.arms=sides.map((side,index)=>{
      const foot=bone(side+'Hand'),sign=index===0?1:-1;
      return {upper:bone(side+'Arm'),knee:bone(side+'ForeArm'),foot,sign,
        rotation:foot.getWorldQuaternion(new T.Quaternion()).premultiply(inverse)};
    });
    this.rig.scale.setScalar(.75);
    this.rig.rotation.x=-.20;
    const hips=bone('Hips');
    chassis.localToWorld(this.point.set(.43,.664,.19));
    hips.position.copy(hips.parent!.worldToLocal(this.point));
    legs.forEach((leg,index)=>{
      chassis.localToWorld(this.point.set(index===0?.55:.31,.455,.68));
      this.pole.set(0,1,.22).transformDirection(chassis.matrixWorld);
      solveLimb(leg,this.point,this.pole,this.handRotation.copy(this.chassisRotation).multiply(leg.rotation),.98);
    });
    new FingerPose(this.rig,asset.animations).apply('WeaponGrip');
    this.update(0);
  }

  update(steering:number){
    const angle=T.MathUtils.clamp(steering*.75,-.35,.35);
    if(Math.abs(angle-this.lastSteering)<.002)return;
    this.lastSteering=angle;
    this.chassis.getWorldQuaternion(this.chassisRotation);
    this.gripRotation.setFromAxisAngle(steeringAxis,angle);
    for(const arm of this.arms){
      this.point.set(arm.sign*.148,.078,.035).applyQuaternion(this.gripRotation).add(steeringCenter);
      this.chassis.localToWorld(this.point);
      this.pole.set(arm.sign,-.61,-.25).transformDirection(this.chassis.matrixWorld);
      this.handRotation.copy(this.chassisRotation).multiply(this.gripRotation).multiply(arm.rotation);
      solveLimb(arm,this.point,this.pole,this.handRotation,.98);
    }
  }

  dispose(){
    const skeletons=new Set<T.Skeleton>();
    this.rig.traverse(object=>{if(object instanceof T.SkinnedMesh)skeletons.add(object.skeleton);});
    for(const skeleton of skeletons)skeleton.dispose();
    this.rig.removeFromParent();
  }
}
