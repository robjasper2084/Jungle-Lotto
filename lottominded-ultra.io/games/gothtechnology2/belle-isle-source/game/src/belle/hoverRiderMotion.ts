import * as T from 'three';
import type {HoverPose} from './hoverController.ts';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const damp=(value:number,target:number,rate:number,dt:number)=>target+(value-target)*Math.exp(-rate*dt);
const pulse=(age:number,rate:number)=>Number.isFinite(age)?age*rate*Math.exp(1-age*rate):0;
const finitePose=(p:HoverPose)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&Number.isFinite(p.heading)&&Number.isFinite(p.speed)&&Number.isFinite(p.lift)&&Number.isFinite(p.pitch)&&Number.isFinite(p.roll);

export interface HoverRiderPose {lean:number;pitch:number;compression:number;headPitch:number;headRoll:number;look:number}

/** Secondary body reactions follow simulation time and measured vehicle motion, not a looping clip. */
export class HoverRiderMotion {
 readonly pose:HoverRiderPose={lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0};
 private ready=false;private sync=true;
 private x=0;private z=0;private heading=0;private lift=0;private landed=true;
 private vx=0;private vz=0;private forwardAcceleration=0;private lateralAcceleration=0;private verticalAcceleration=0;private yawRate=0;
 private takeoffAge=Infinity;private landingAge=Infinity;private descent=0;private landingStrength=0;
 private seed(p:HoverPose,landed:boolean){this.x=p.x;this.z=p.z;this.heading=p.heading;this.lift=p.lift;this.landed=landed;this.vx=this.vz=0;this.ready=true;}
 private zero(){const p=this.pose;p.lean=p.pitch=p.compression=p.headPitch=p.headRoll=p.look=0;this.forwardAcceleration=this.lateralAcceleration=this.verticalAcceleration=this.yawRate=0;this.takeoffAge=this.landingAge=Infinity;this.descent=this.landingStrength=0;}
 reset(p:HoverPose,landed:boolean){this.zero();this.ready=false;if(finitePose(p))this.seed(p,landed);this.sync=!this.ready;return this.pose;}
 /** Input clearing can pause a ride; it must not turn a pause into a braking or landing impulse. */
 suspend(){this.sync=true;this.descent=0;}
 update(seconds:number,p:HoverPose,landed:boolean,steer:number,running:boolean,reducedMotion:boolean){
  if(!finitePose(p)){this.zero();this.ready=false;this.sync=true;return this.pose;}
  if(reducedMotion){this.zero();this.seed(p,landed);this.sync=true;return this.pose;}
  if(!running){this.sync=true;return this.pose;}
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.12);if(dt===0)return this.pose;
  if(!this.ready||Math.hypot(p.x-this.x,p.z-this.z)>8){this.reset(p,landed);}
  let forward=0;
  if(this.sync){const vx=(p.x-this.x)/dt,vz=(p.z-this.z)/dt;this.seed(p,landed);this.vx=vx;this.vz=vz;forward=vx*Math.sin(p.heading)+vz*Math.cos(p.heading);this.forwardAcceleration=this.lateralAcceleration=this.verticalAcceleration=this.yawRate=0;this.sync=false;}
  else{
   const vx=(p.x-this.x)/dt,vz=(p.z-this.z)/dt,sin=Math.sin(p.heading),cos=Math.cos(p.heading),ax=(vx-this.vx)/dt,az=(vz-this.vz)/dt;
   forward=vx*sin+vz*cos;
   // Filter the impulse before bounding the pose: an immediate drone stop must
   // produce the same body response at 30, 60 or 120 Hz.
   this.forwardAcceleration=damp(this.forwardAcceleration,ax*sin+az*cos,9,dt);
   this.lateralAcceleration=damp(this.lateralAcceleration,-ax*cos+az*sin,9,dt);
   this.verticalAcceleration=damp(this.verticalAcceleration,(p.lift-this.lift)/dt,9,dt);
   this.yawRate=damp(this.yawRate,Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading))/dt,9,dt);
   this.vx=vx;this.vz=vz;
   // Retain only a recent descent impulse (125 ms decay time), not the fastest
   // dive since takeoff. A settled hover followed by a gentle landing is gentle.
   this.descent=Math.max(this.descent*Math.exp(-8*dt),Math.max(0,-p.lift));
   if(this.landed&&!landed){this.takeoffAge=0;this.descent=0;}
   if(!this.landed&&landed){this.landingAge=0;this.landingStrength=clamp(this.descent/5,.3,1);this.descent=0;}
  }
  this.x=p.x;this.z=p.z;this.heading=p.heading;this.lift=p.lift;this.landed=landed;
  this.takeoffAge+=dt;this.landingAge+=dt;
  const takeoff=pulse(this.takeoffAge,7),landing=pulse(this.landingAge,8)*this.landingStrength,speed=clamp(Math.abs(forward)/24,0,1);
  const turnAcceleration=-this.yawRate*forward,sideAcceleration=this.lateralAcceleration-turnAcceleration,fall=clamp(-p.lift/5,0,1);
  const lean=clamp(Math.atan2(turnAcceleration,9.81)*.34-sideAcceleration*.0045,-.24,.24);
  const pitch=clamp(speed*speed*.065-this.forwardAcceleration*.005+fall*.02-takeoff*.045+landing*.06,-.10,.20);
  const compression=clamp(Math.max(0,this.verticalAcceleration)*.0025+fall*.012+takeoff*.018+landing*.055,0,.085);
  const state=this.pose;
  state.lean=damp(state.lean,lean,8,dt);state.pitch=damp(state.pitch,pitch,8,dt);state.compression=damp(state.compression,compression,12,dt);
  state.headPitch=damp(state.headPitch,-state.pitch*.65-p.pitch*.45,9,dt);
  state.headRoll=damp(state.headRoll,-state.lean*.65-p.roll*.5,9,dt);
  state.look=damp(state.look,-clamp(Number.isFinite(steer)?steer:0,-1,1)*(.035+.09*speed),9,dt);
  return state;
 }
}

interface BoneRest {bone:T.Bone;position:T.Vector3;quaternion:T.Quaternion;scale:T.Vector3}
interface Limb {upper:T.Bone;lower:T.Bone;end:T.Bone;anchor:T.Object3D;clavicle?:T.Bone;contact:T.Vector3;orientation:T.Quaternion}
type RigParts={hips:T.Bone;spine:T.Bone;chest:T.Bone;head:T.Bone;arms:[Limb,Limb];legs:[Limb,Limb];bones:T.Bone[]};
export interface HoverRiderDiagnostics extends HoverRiderPose {handError:number;footError:number;contacts:number}

function boneName(b:T.Object3D){return b.name.replace(/_\d+$/,'');}
function matchAnchors(a:T.Bone,b:T.Bone,first:T.Object3D,second:T.Object3D):[T.Object3D,T.Object3D]{
 const pa=a.getWorldPosition(new T.Vector3()),pb=b.getWorldPosition(new T.Vector3()),p1=first.getWorldPosition(new T.Vector3()),p2=second.getWorldPosition(new T.Vector3());
 // The authored sockets and skeleton use opposite L/R conventions. Spatial
 // assignment avoids crossed hands and remains valid if exporter names change.
 return pa.distanceToSquared(p1)+pb.distanceToSquared(p2)<pa.distanceToSquared(p2)+pb.distanceToSquared(p1)?[first,second]:[second,first];
}

/** Uses the shipped skin, gloves, boots and sockets; creates no replacement meshes or materials. */
export class HoverRiderRig {
 readonly motion=new HoverRiderMotion();
 readonly diagnostics:HoverRiderDiagnostics={lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0,handError:0,footError:0,contacts:0};
 private rests:BoneRest[];
 private model:T.Object3D;private parts:RigParts;
 private hipsRest:T.Vector3;
 private hipsScale=1;
 private v0=new T.Vector3();private v1=new T.Vector3();private v2=new T.Vector3();private v3=new T.Vector3();private v4=new T.Vector3();private v5=new T.Vector3();private v6=new T.Vector3();private v7=new T.Vector3();
 private target=new T.Vector3();private anchorPosition=new T.Vector3();private endScale=new T.Vector3();
 private q0=new T.Quaternion();private q1=new T.Quaternion();private q2=new T.Quaternion();private desiredOrientation=new T.Quaternion();private identity=new T.Quaternion();private rotation=new T.Euler(0,0,0,'YXZ');
 private constructor(model:T.Object3D,parts:RigParts){
  this.model=model;this.parts=parts;
  this.rests=parts.bones.map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()}));
  this.hipsRest=parts.hips.position.clone();this.hipsScale=parts.hips.parent!.getWorldScale(this.v0).y;
  for(const chain of [...parts.arms,...parts.legs]){
   chain.orientation.copy(chain.anchor.getWorldQuaternion(this.q0)).invert().multiply(chain.end.getWorldQuaternion(this.q1));
   if(this.calibrateContact(chain,parts.legs.includes(chain)))this.diagnostics.contacts++;
  }
 }
 static create(model:T.Object3D){
  const bones:T.Bone[]=[],objects:T.Object3D[]=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);else objects.push(o);});
  const bone=(name:string)=>bones.find(b=>boneName(b)===name),anchor=(name:string)=>objects.find(o=>boneName(o)===name);
  const hips=bone('Hips'),spine=bone('Spine'),chest=bone('Chest'),head=bone('Head');
  const leftHand=bone('Hand_L'),rightHand=bone('Hand_R'),leftFoot=bone('Foot_L'),rightFoot=bone('Foot_R');
  const gripA=anchor('Grip_L'),gripB=anchor('Grip_R'),footA=anchor('Foot_L'),footB=anchor('Foot_R');
  if(!hips||!spine||!chest||!head||!leftHand||!rightHand||!leftFoot||!rightFoot||!gripA||!gripB||!footA||!footB)return;
  const grips=matchAnchors(leftHand,rightHand,gripA,gripB),feet=matchAnchors(leftFoot,rightFoot,footA,footB);
  const limb=(side:'L'|'R',leg:boolean,target:T.Object3D):Limb|undefined=>{
   const upper=bone((leg?'Thigh_':'UpperArm_')+side),lower=bone((leg?'Shin_':'ForeArm_')+side),end=bone((leg?'Foot_':'Hand_')+side);
   if(!upper||!lower||!end||lower.parent!==upper||end.parent!==lower)return;
   return{upper,lower,end,anchor:target,clavicle:leg?undefined:bone('Shoulder_'+side),contact:new T.Vector3(),orientation:new T.Quaternion()};
  };
  const al=limb('L',false,grips[0]),ar=limb('R',false,grips[1]),ll=limb('L',true,feet[0]),lr=limb('R',true,feet[1]);
  if(!al||!ar||!ll||!lr)return;
  return new HoverRiderRig(model,{hips,spine,chest,head,arms:[al,ar],legs:[ll,lr],bones});
 }
 private calibrateContact(chain:Limb,foot:boolean){
  const bounds=new T.Box3(),point=new T.Vector3();
  this.model.traverse(object=>{
   const mesh=object as T.SkinnedMesh;if(!mesh.isSkinnedMesh||object.name==='Hero_FPVArms')return;
   const index=mesh.skeleton.bones.indexOf(chain.end);if(index<0)return;
   const positions=mesh.geometry.attributes.position,joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!positions||!joints||!weights)return;
   mesh.skeleton.update();
   for(let i=0;i<positions.count;i++){
    let belongs=false;for(let j=0;j<4;j++)if(joints.getComponent(i,j)===index&&weights.getComponent(i,j)>.5){belongs=true;break;}
    if(belongs){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);bounds.expandByPoint(point);}
   }
  });
  if(bounds.isEmpty())return false;
  bounds.getCenter(point);
  // Glove volume centres sit on the grips; the boot sole sits on its support.
  // Calibrate once from the authored skin, rather than pinning a wrist/ankle
  // origin inside the bar/platform or stretching a limb to compensate.
  if(foot)point.y=bounds.min.y+(bounds.max.y-bounds.min.y)*.05;
  chain.contact.copy(chain.end.worldToLocal(point));return true;
 }
 reset(p:HoverPose,landed:boolean){this.motion.reset(p,landed);this.apply(this.motion.pose);}
 suspend(){this.motion.suspend();}
 update(dt:number,p:HoverPose,landed:boolean,steer:number,running:boolean,reducedMotion:boolean){this.apply(this.motion.update(dt,p,landed,steer,running,reducedMotion));}
 private rotate(bone:T.Bone,pitch:number,yaw:number,roll:number){bone.quaternion.multiply(this.q0.setFromEuler(this.rotation.set(pitch,yaw,roll,'YXZ')));}
 private apply(p:HoverRiderPose){
  for(let i=0;i<this.rests.length;i++){const r=this.rests[i];r.bone.position.copy(r.position);r.bone.quaternion.copy(r.quaternion);r.bone.scale.copy(r.scale);}
  const {hips,spine,chest,head,arms,legs}=this.parts;
  hips.position.x=this.hipsRest.x-p.lean*.06/this.hipsScale;
  hips.position.y=this.hipsRest.y-p.compression/this.hipsScale;
  hips.position.z=this.hipsRest.z+p.pitch*.03/this.hipsScale;
  this.rotate(hips,0,0,p.lean*.08);
  this.rotate(spine,p.pitch*.55,0,p.lean*.52);
  this.rotate(chest,p.pitch*.45,0,p.lean*.40);
  this.rotate(head,p.headPitch,p.look,p.headRoll);
  this.model.updateMatrixWorld(true);
  let handError=0,footError=0;
  for(let i=0;i<2;i++)handError=Math.max(handError,this.solve(arms[i]));
  for(let i=0;i<2;i++)footError=Math.max(footError,this.solve(legs[i]));
  const d=this.diagnostics;d.lean=p.lean;d.pitch=p.pitch;d.compression=p.compression;d.headPitch=p.headPitch;d.headRoll=p.headRoll;d.look=p.look;d.handError=handError;d.footError=footError;
 }
 private setWorldQuaternion(bone:T.Bone,world:T.Quaternion){bone.parent!.getWorldQuaternion(this.q2).invert();bone.quaternion.copy(this.q2.multiply(world));bone.updateMatrixWorld(true);}
 private solve(chain:Limb){
  const {upper,lower,end,anchor}=chain;
  anchor.getWorldPosition(this.anchorPosition);anchor.getWorldQuaternion(this.desiredOrientation).multiply(chain.orientation);
  end.getWorldScale(this.endScale);
  this.target.copy(chain.contact).multiply(this.endScale).applyQuaternion(this.desiredOrientation);
  this.target.negate().add(this.anchorPosition);
  if(chain.clavicle)this.protract(chain);
  upper.getWorldPosition(this.v0);lower.getWorldPosition(this.v1);end.getWorldPosition(this.v2);
  const l1=this.v0.distanceTo(this.v1),l2=this.v1.distanceTo(this.v2),distance=this.v0.distanceTo(this.target);
  if(l1<1e-6||l2<1e-6||distance<1e-6)return distance;
  const reach=clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
  this.v3.copy(this.target).sub(this.v0).normalize();
  // Use the authored elbow/knee plane as the pole; bending never switches to
  // the opposite side when a hand approaches full extension.
  this.v4.copy(this.v1).sub(this.v0);this.v4.addScaledVector(this.v3,-this.v4.dot(this.v3));
  if(this.v4.lengthSq()<1e-10){this.v4.set(0,0,1).applyQuaternion(upper.getWorldQuaternion(this.q0));this.v4.addScaledVector(this.v3,-this.v4.dot(this.v3));}
  this.v4.normalize();
  const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  this.v5.copy(this.v0).addScaledVector(this.v3,along).addScaledVector(this.v4,height);
  this.v6.copy(this.v1).sub(this.v0).normalize();this.v7.copy(this.v5).sub(this.v0).normalize();
  this.q0.setFromUnitVectors(this.v6,this.v7);upper.getWorldQuaternion(this.q1);this.q0.multiply(this.q1);this.setWorldQuaternion(upper,this.q0);
  lower.getWorldPosition(this.v1);end.getWorldPosition(this.v2);
  this.v6.copy(this.v2).sub(this.v1).normalize();this.v7.copy(this.v0).addScaledVector(this.v3,reach).sub(this.v1).normalize();
  this.q0.setFromUnitVectors(this.v6,this.v7);lower.getWorldQuaternion(this.q1);this.q0.multiply(this.q1);this.setWorldQuaternion(lower,this.q0);
  this.setWorldQuaternion(end,this.desiredOrientation);
  this.v0.copy(chain.contact);end.localToWorld(this.v0);
  return this.v0.distanceTo(this.anchorPosition);
 }
 private protract(chain:Limb){
  const clavicle=chain.clavicle!;
  clavicle.getWorldPosition(this.v0);chain.upper.getWorldPosition(this.v1);chain.lower.getWorldPosition(this.v2);chain.end.getWorldPosition(this.v3);
  const shoulderLength=this.v0.distanceTo(this.v1),armReach=(this.v1.distanceTo(this.v2)+this.v2.distanceTo(this.v3))*.985,distance=this.v0.distanceTo(this.target);
  if(shoulderLength<1e-6||distance<1e-6||this.v1.distanceTo(this.target)<=armReach)return;
  this.v4.copy(this.v1).sub(this.v0).normalize();this.v5.copy(this.target).sub(this.v0).normalize();
  const angle=Math.acos(clamp(this.v4.dot(this.v5),-1,1));if(angle<1e-6)return;
  const reachableAngle=Math.acos(clamp((distance*distance+shoulderLength*shoulderLength-armReach*armReach)/(2*distance*shoulderLength),-1,1));
  const correction=clamp(angle-reachableAngle,0,.60);
  this.q0.setFromUnitVectors(this.v4,this.v5).slerp(this.identity,1-correction/angle);
  clavicle.getWorldQuaternion(this.q1);this.q0.multiply(this.q1);this.setWorldQuaternion(clavicle,this.q0);
 }
}
