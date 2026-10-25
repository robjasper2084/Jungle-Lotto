import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Object3D,Vector3,Quaternion,Euler} from 'three';
import {calibrateLimb,solveAnatomicalLimb} from '../src/limbIK.ts';

const point=(o:Object3D)=>o.getWorldPosition(new Vector3());
function chain(side=1,heading=0){
 const root=new Object3D(),hip=new Object3D(),upper=new Object3D(),knee=new Object3D(),foot=new Object3D();
 root.rotation.y=heading;root.position.set(3,.2,-2);root.add(hip);hip.position.y=1;hip.add(upper);upper.position.x=side*.12;upper.add(knee);knee.add(foot);
 const uq=new Quaternion().setFromEuler(new Euler(.43,side*.57,-.24)),kq=new Quaternion().setFromEuler(new Euler(-.38,side*.29,.33));
 upper.quaternion.copy(uq);knee.quaternion.copy(uq.clone().invert().multiply(kq));
 knee.position.copy(new Vector3(0,-.45,.055).applyQuaternion(uq.clone().invert()));
 foot.position.copy(new Vector3(0,-.43,-.055).applyQuaternion(kq.clone().invert()));root.updateMatrixWorld(true);
 const l={upper,knee,foot},right=new Vector3(1,0,0).applyQuaternion(root.quaternion),anatomy=calibrateLimb(l,right);
 const localNormals=[right.clone().applyQuaternion(upper.getWorldQuaternion(new Quaternion()).invert()),right.clone().applyQuaternion(knee.getWorldQuaternion(new Quaternion()).invert())];
 const lengths=[point(upper).distanceTo(point(knee)),point(knee).distanceTo(point(foot))];
 return {root,hip,l,anatomy,localNormals,lengths};
}
test('anatomical IK preserves imported axes and length while keeping thigh and shin in a single hinge plane',()=>{
 for(const side of [-1,1])for(const heading of [0,Math.PI/2,-1.7]){
  const {root,hip,l,anatomy,localNormals,lengths}=chain(side,heading);
  for(let frame=0;frame<=240;frame++){
   const t=frame/240;hip.rotation.set(.35*Math.sin(t*5),.2*Math.cos(t*3),side*.3*Math.sin(t*4));root.updateMatrixWorld(true);
   const target=root.localToWorld(new Vector3(side*(.13+.08*Math.sin(t*5)),.1+.18*Math.sin(t*Math.PI),.1+.3*t));
   const hint=new Vector3(side*.18,0,1).applyQuaternion(root.quaternion),footRotation=root.quaternion.clone();
   solveAnatomicalLimb(l,target,hint,anatomy,footRotation);
   const a=point(l.upper),b=point(l.knee),c=point(l.foot),plane=b.clone().sub(a).cross(c.clone().sub(b)).normalize();
   assert(Math.abs(a.distanceTo(b)-lengths[0])<1e-9);assert(Math.abs(b.distanceTo(c)-lengths[1])<1e-9);
   const normals=localNormals.map((normal,i)=>normal.clone().applyQuaternion((i===0?l.upper:l.knee).getWorldQuaternion(new Quaternion())).normalize());
   assert(normals[0].dot(normals[1])>.99999,'knee hinge frames must not twist against each other');
   assert(Math.abs(normals[0].dot(plane))>.99999,'thigh hinge must align with the bend plane');
   assert(Math.abs(normals[1].dot(plane))>.99999,'shin hinge must align with the bend plane');
   assert(l.foot.getWorldQuaternion(new Quaternion()).angleTo(footRotation)<1e-6,'preserve the requested sole orientation');
  }
 }
});
test('anatomical IK gives rotated copies the same joint positions and remains stable near full extension',()=>{
 const plain=chain(1,0),turned=chain(1,1.8);let previous:Quaternion|undefined;
 for(let frame=0;frame<=240;frame++){
  const t=frame/240,targetLocal=new Vector3(.12,-.025+.02*Math.sin(t*6),.001*Math.cos(t*6)),hintLocal=new Vector3(0,0,1);
  const joints=[];
  for(const rig of [plain,turned]){
   solveAnatomicalLimb(rig.l,rig.root.localToWorld(targetLocal.clone()),hintLocal.clone().applyQuaternion(rig.root.quaternion),rig.anatomy,undefined,1);
   joints.push([rig.l.upper,rig.l.knee,rig.l.foot].map(o=>rig.root.worldToLocal(point(o))));
  }
  joints[0].forEach((p,i)=>assert(p.distanceTo(joints[1][i])<1e-8,'heading must not affect the solve'));
  const q=plain.l.knee.getWorldQuaternion(new Quaternion());if(previous)assert(q.angleTo(previous)<.02,'near-straight knees must not flip');previous=q;
 }
});
test('a parallel hint and collapsed target stay finite without changing bone lengths',()=>{
 const {l,anatomy,lengths}=chain();
 for(const offset of [new Vector3(0,-.5,0),new Vector3(0,0,0)]){
  solveAnatomicalLimb(l,point(l.upper).add(offset),new Vector3(0,-1,0),anatomy);
  for(const bone of [l.upper,l.knee,l.foot])assert([...bone.position.toArray(),...bone.quaternion.toArray()].every(Number.isFinite));
  assert(Math.abs(point(l.upper).distanceTo(point(l.knee))-lengths[0])<1e-9);
  assert(Math.abs(point(l.knee).distanceTo(point(l.foot))-lengths[1])<1e-9);
 }
});
test('opposite signs for the same authored hinge normal do not turn the skin inside out',()=>{
 for(const side of [-1,1]){
  const a=chain(side,.8),b=chain(side,.8);
  b.anatomy=calibrateLimb(b.l,new Vector3(-1,0,0).applyQuaternion(b.root.quaternion));
  for(const rig of [a,b])solveAnatomicalLimb(rig.l,rig.root.localToWorld(new Vector3(side*.16,.28,.24)),new Vector3(0,0,1).applyQuaternion(rig.root.quaternion),rig.anatomy);
  for(const name of ['upper','knee','foot'] as const){
   assert(point(a.l[name]).distanceTo(point(b.l[name]))<1e-8);
   assert(a.l[name].getWorldQuaternion(new Quaternion()).angleTo(b.l[name].getWorldQuaternion(new Quaternion()))<1e-6);
  }
 }
});
test('optional flex limit prevents a short shin folding into its thigh without stretching either segment',()=>{
 for(const side of [-1,1])for(const ratio of [.35,1]){
  const {root,l}=chain(side,1.2);l.foot.position.multiplyScalar(ratio);root.updateMatrixWorld(true);
  const anatomy=calibrateLimb(l,new Vector3(1,0,0).applyQuaternion(root.quaternion));
  const lengths=[point(l.upper).distanceTo(point(l.knee)),point(l.knee).distanceTo(point(l.foot))],limit=150*Math.PI/180;
  const target=point(l.upper).add(new Vector3(0,-.01,.002)),hint=new Vector3(0,0,1).applyQuaternion(root.quaternion);
  solveAnatomicalLimb(l,target,hint,anatomy,undefined,.975,limit);
  const a=point(l.upper),b=point(l.knee),c=point(l.foot),flex=Math.PI-a.clone().sub(b).angleTo(c.clone().sub(b));
  assert(Math.abs(flex-limit)<1e-7,'the clamped triangle respects anatomical flex even with unequal bone lengths');
  assert(Math.abs(a.distanceTo(b)-lengths[0])<1e-9);assert(Math.abs(b.distanceTo(c)-lengths[1])<1e-9);
  solveAnatomicalLimb(l,target,hint,anatomy);
  const freeFlex=Math.PI-point(l.upper).sub(point(l.knee)).angleTo(point(l.foot).sub(point(l.knee)));
  assert(freeFlex>limit,'callers that omit a flex limit retain the full target range');
 }
});
