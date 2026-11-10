import * as T from 'three';

/** Two-bone arm solve keeps both wrists attached to the moving grips. */
export class HoverSteering {
 private pivot?:T.Object3D;
 private rest=new T.Quaternion();
 private arms:{upper:T.Object3D;elbow:T.Object3D;hand:T.Object3D;grip:T.Object3D;offset:T.Vector3}[]=[];
 constructor(root:T.Object3D){
  this.pivot=root.getObjectByName('HandlebarPivot');
  if(this.pivot)this.rest.copy(this.pivot.quaternion);
  root.updateMatrixWorld(true);
  for(const side of ['L','R']){
   const upper=root.getObjectByName('UpperArm_'+side),elbow=root.getObjectByName('ForeArm_'+side),hand=root.getObjectByName('Hand_'+side),grip=root.getObjectByName('Grip_'+side);
   if(upper&&elbow&&hand&&grip)this.arms.push({upper,elbow,hand,grip,offset:grip.worldToLocal(hand.getWorldPosition(new T.Vector3()))});
  }
 }
 update(axis:number){
  if(!this.pivot)return;
  this.pivot.quaternion.copy(this.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-T.MathUtils.clamp(axis,-1,1)*.34));
  this.pivot.updateWorldMatrix(true,true);
  for(const a of this.arms){
   a.upper.updateWorldMatrix(true,true);
   const shoulder=a.upper.getWorldPosition(new T.Vector3()),elbow=a.elbow.getWorldPosition(new T.Vector3()),wrist=a.hand.getWorldPosition(new T.Vector3()),target=a.grip.localToWorld(a.offset.clone());
   const length1=shoulder.distanceTo(elbow),length2=elbow.distanceTo(wrist),toward=target.clone().sub(shoulder),distance=T.MathUtils.clamp(toward.length(),Math.abs(length1-length2)+.001,length1+length2-.001);
   toward.normalize();
   const bend=elbow.clone().sub(shoulder).addScaledVector(toward,-elbow.clone().sub(shoulder).dot(toward));
   if(bend.lengthSq()<1e-8)bend.set(0,-1,0).addScaledVector(toward,toward.y);
   bend.normalize();
   const along=(length1*length1-length2*length2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,length1*length1-along*along));
   const desiredElbow=shoulder.clone().addScaledVector(toward,along).addScaledVector(bend,height);
   this.aim(a.upper,a.elbow,desiredElbow);
   this.aim(a.elbow,a.hand,target);
  }
 }
 private aim(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
  const origin=bone.getWorldPosition(new T.Vector3()),from=child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const world=bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromUnitVectors(from,to));
  if(bone.parent)world.premultiply(bone.parent.getWorldQuaternion(new T.Quaternion()).invert());
  bone.quaternion.copy(world);bone.updateWorldMatrix(false,true);
 }
}
