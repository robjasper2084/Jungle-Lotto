import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {solveLimb,type LimbChain} from '../../runtime/ride-core/src/limbIK.ts';
import {FingerPose} from '../../runtime/ride-core/src/fingerPose.ts';
import {invalidateAnimatedShadow} from '../../runtime/ride-core/src/shadowBudget.ts';

/** Measured against the shipped silver-cadillac.glb upholstery, in SprungBody
 * metres. That asset has no exported seat nodes or vertex groups; these are
 * explicit runtime fittings, not purported Blender vertex-group bindings. */
export const CADILLAC_CABIN_FIT={
 // The original DS_Man_01 suited rig includes its long hair and fitted aviators.
 driverScale:.77,driverRecline:-.28,
 driverHip:[.43,.712,.35] as const,
 leftFoot:[.55,.487,.84] as const,rightFoot:[.31,.487,.84] as const,
 steeringWheelLift:.08,
 dogScale:.70,dogYaw:-Math.PI/2,dogRoll:.07,dogPosition:[-.38,.58025,-.60] as const,
 rearCushionY:.566903,dogSupportClearance:.0065,
 // The conservative rear-seat envelope includes the complete tail. Turning
 // the seated dog toward its window keeps its tail on the bench, toward the
 // centre of the car, instead of projecting through the seat back.
 rearEnvelope:{min:[-.63,.562,-.80] as const,max:[.03,1.29,-.40] as const},
} as const;

type BonePose={bone:T.Object3D;position:T.Vector3;quaternion:T.Quaternion;scale:T.Vector3};
type Arm=LimbChain&{sign:number;target:T.Object3D;palm:T.Vector3;rotation:T.Quaternion};
type Bounds={min:number[];max:number[]};
const vector=()=>new T.Vector3(),quaternion=()=>new T.Quaternion();
const steeringAxis=new T.Vector3(0,.42,-.91).normalize();

function required(root:T.Object3D,name:string){
 const object=root.getObjectByName(name);
 if(!object)throw new Error('Cadillac cabin is missing '+name);
 return object;
}
function anchor(name:string,parent:T.Object3D,position:readonly number[]=[0,0,0]){
 const object=new T.Group();object.name=name;object.position.fromArray(position);parent.add(object);return object;
}
function snapshots(root:T.Object3D){
 const poses:BonePose[]=[];
 root.traverse(bone=>{if((bone as T.Bone).isBone)poses.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()});});
 return poses;
}
function restore(poses:BonePose[]){for(const p of poses){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);p.bone.scale.copy(p.scale);}}
function independentRig(source:T.Object3D){
 const rig=clone(source),skeletons=new Set<T.Skeleton>();
 rig.position.set(0,0,0);rig.quaternion.identity();rig.scale.setScalar(1);rig.visible=true;
 rig.traverse(object=>{const mesh=object as T.SkinnedMesh;if(!mesh.isSkinnedMesh)return;skeletons.add(mesh.skeleton);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;});
 // A clone can be requested while the solo hero is walking, falling or riding.
 // Restore its independent bind skeleton, not that transient source pose.
 const restored=new Set<T.Bone>();
 for(const skeleton of skeletons){
  if(skeleton.bones.every(bone=>restored.has(bone)))continue;
  // Runtime tailoring has its own bind matrices from the mounted hero, while
  // sharing the original body bones. It must not overwrite the authored rest
  // pose already restored by the primary skin.
  const shared=skeleton.bones.filter(bone=>restored.has(bone)).map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()}));
  skeleton.pose();restore(shared);for(const bone of skeleton.bones)restored.add(bone);
 }
 rig.updateMatrixWorld(true);return rig;
}
/** A cold fit only. Never called by update() or diagnostics(). */
function skinBounds(root:T.Object3D,space:T.Object3D){
 // updateMatrixWorld must reach SkinnedMesh's override so attached skins
 // refresh bindMatrixInverse after their newly fitted root transform.
 root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);space.updateWorldMatrix(true,false);
 const inverse=space.matrixWorld.clone().invert(),point=vector(),box=new T.Box3();
 root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh||!mesh.visible)return;
  const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)box.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(transform));
 });
 return box;
}
const bounds=(box:T.Box3):Bounds=>({min:box.min.toArray(),max:box.max.toArray()});

/** Raise the adjustable wheel to clear the suited driver's thighs. The source
 * GLB merges its open-ended column into the upholstery mesh. Its measured
 * 32-sided shaft is exactly vertices 9387..9450: move only the hub ring, keeping
 * the dashboard ring fixed. A private geometry preserves every shared asset;
 * the same affine shear updates only the shaft normals, once at construction. */
function fitSteeringColumn(model:T.Object3D,wheel:T.Object3D){
 const mesh=required(model,'Coachwork_3') as T.Mesh;
 const source=mesh.geometry,first=9387,last=9450;
 const position=source?.getAttribute('position');
 if(!mesh.isMesh||!position||position.count<=last)throw new Error('Cadillac steering-column geometry is missing');
 const dashboard=vector(),hub=vector();let dashboardCount=0,hubCount=0;
 const point=vector();
 for(let i=first;i<=last;i++){
  point.fromBufferAttribute(position,i);
  if(point.x<.37||point.x>.49||point.y<.74||point.y>.95||point.z<.56||point.z>.87)throw new Error('Cadillac steering-column geometry changed');
  if(point.z<.7){hub.add(point);hubCount++;}else{dashboard.add(point);dashboardCount++;}
 }
 if(hubCount!==32||dashboardCount!==32)throw new Error('Cadillac steering-column rings changed');
 dashboard.divideScalar(dashboardCount);hub.divideScalar(hubCount);
 const shaft=hub.sub(dashboard),lift=CADILLAC_CABIN_FIT.steeringWheelLift;
 const gradient=shaft.clone().divideScalar(shaft.lengthSq());
 const shear=new T.Matrix4().set(1,0,0,0,lift*gradient.x,1+lift*gradient.y,lift*gradient.z,0,0,0,1,0,0,0,0,1);
 const normalMatrix=new T.Matrix3().getNormalMatrix(shear);
 const fitted=source.clone(),fittedPosition=fitted.getAttribute('position'),normal=fitted.getAttribute('normal'),tangent=fitted.getAttribute('tangent');
 for(let i=first;i<=last;i++){
  if(position.getZ(i)<.7)fittedPosition.setY(i,position.getY(i)+lift);
  if(normal){point.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);normal.setXYZ(i,point.x,point.y,point.z);}
  if(tangent){point.fromBufferAttribute(tangent,i).transformDirection(shear);tangent.setXYZ(i,point.x,point.y,point.z);}
 }
 fittedPosition.needsUpdate=true;if(normal)normal.needsUpdate=true;if(tangent)tangent.needsUpdate=true;
 fitted.computeBoundingBox();fitted.computeBoundingSphere();mesh.geometry=fitted;
 const wheelPosition=wheel.position.clone();wheel.position.y+=lift;
 return()=>{wheel.position.copy(wheelPosition);mesh.geometry=source;fitted.dispose();};
}

/** The long-haired suited hero and Boerboel, seated as one cabin-local assembly.
 * There are no independent occupant rigid bodies to drift during a turn.
 * Geometry/materials stay shared; bones, skeletons and animation state do not. */
export class CadillacCabin{
 readonly root=new T.Group();
 readonly driver:T.Object3D;
 readonly dog:T.Object3D;
 readonly driverAsset:string;
 readonly anchors:{driverSeat:T.Object3D;rearSeat:T.Object3D;driverHead:T.Object3D;dogHead:T.Object3D;leftGrip:T.Object3D;rightGrip:T.Object3D;leftFoot:T.Object3D;rightFoot:T.Object3D};
 private readonly wheel:T.Object3D;
 private readonly gripFrame:T.Object3D;
 private readonly wheelRest:T.Quaternion;
 private readonly restoreSteeringFit:()=>void;
 private readonly hips:T.Object3D;
 private readonly driverHead:T.Object3D;
 private readonly driverSpine:T.Object3D;
 private readonly dogHead:T.Object3D;
 private readonly mixer:T.AnimationMixer;
 private readonly sit:T.AnimationAction;
 private readonly arms:Arm[]=[];
 private driverPose:BonePose[]=[];
 private motionPose:BonePose[]=[];
 private readonly dogHeadBase=new T.Quaternion();
 private readonly driverBounds:T.Box3;
 private readonly dogBounds:T.Box3;
 private time=0;
 private steering=0;
 private reduced=false;
 private disposed=false;
 private dogState:'Sit_Idle'|'Look_Out_Window'='Sit_Idle';
 private readonly point=vector();
 private readonly pole=vector();
 private readonly axis=vector();
 private readonly frameQuaternion=quaternion();
 private readonly rotation=quaternion();
 private readonly parentRotation=quaternion();
 private readonly deltaRotation=quaternion();

 constructor(model:T.Object3D,hero:T.Object3D,dogAsset:GLTF,heroClips:T.AnimationClip[]=[]){
  const body=required(model,'SprungBody');this.wheel=required(model,'SteeringWheel');
  const clip=dogAsset.animations.find(animation=>animation.name==='Dog_Sit');
  if(!clip)throw new Error('Cadillac rear passenger requires the authored Dog_Sit clip');
  this.restoreSteeringFit=fitSteeringColumn(model,this.wheel);
  this.root.name='Cadillac_Cabin_Occupants';body.add(this.root);
  this.driver=independentRig(hero);this.driver.name='Cadillac_Main_Hero';
  this.driverAsset=hero.getObjectByName('DS_Man_01_Dressed_Surface')?'DS_Man_01':hero.getObjectByName('Armored_Rider_Surface')?'DS_Armored_Rider_01':hero.name||'custom';
  this.driver.userData.sourceAsset=this.driverAsset;
  if(this.driverAsset==='DS_Man_01')this.driver.userData.characterLabel='Main Hero · long hair, black suit';
  this.dog=independentRig(dogAsset.scene);this.dog.name='Cadillac_Boerboel';
  this.root.add(this.driver,this.dog);
  this.hips=required(this.driver,'Hips');this.driverHead=required(this.driver,'Head');
  this.driverSpine=this.driver.getObjectByName('Spine')??required(this.driver,'Chest');
  this.dogHead=required(this.dog,'head');
  this.gripFrame=anchor('Cadillac_Wheel_Grip_Frame',this.wheel);
  this.wheelRest=this.wheel.quaternion.clone();
  this.anchors={
   driverSeat:anchor('Cadillac_Driver_Seat',this.root,CADILLAC_CABIN_FIT.driverHip),
   rearSeat:anchor('Cadillac_Rear_Passenger_Seat',this.root,[CADILLAC_CABIN_FIT.dogPosition[0],CADILLAC_CABIN_FIT.rearCushionY,-.60]),
   driverHead:anchor('Cadillac_Driver_Profile_Target',this.root),
   dogHead:anchor('Cadillac_Boerboel_Head_Target',this.root),
   leftGrip:anchor('Cadillac_Left_Wheel_Grip',this.gripFrame,[.205,0,0]),
   rightGrip:anchor('Cadillac_Right_Wheel_Grip',this.gripFrame,[-.205,0,0]),
   leftFoot:anchor('Cadillac_Left_Footwell',this.root,CADILLAC_CABIN_FIT.leftFoot),
   rightFoot:anchor('Cadillac_Right_Footwell',this.root,CADILLAC_CABIN_FIT.rightFoot),
  };
  this.driver.userData.animationState='Driving_Idle';
  this.driver.userData.animationSource='Procedural seated pose and contact IK';
  this.dog.userData.animationSource='Dog_Sit';
  // Preserve the imported sole orientation while fitting the knees. Reclining
  // the whole rig must not recline the shoes through the footwell floor.
  this.root.getWorldQuaternion(this.frameQuaternion).invert();
  const feet=(['Left','Right'] as const).map(side=>({
   upper:required(this.driver,side+'UpLeg'),knee:required(this.driver,side+'Leg'),foot:required(this.driver,side+'Foot'),
   rotation:required(this.driver,side+'Foot').getWorldQuaternion(quaternion()).premultiply(this.frameQuaternion),
   target:side==='Left'?this.anchors.leftFoot:this.anchors.rightFoot,
  }));
  this.driver.scale.setScalar(CADILLAC_CABIN_FIT.driverScale);this.driver.rotation.x=CADILLAC_CABIN_FIT.driverRecline;
  this.root.updateWorldMatrix(true,true);
  this.anchors.driverSeat.getWorldPosition(this.point);this.hips.parent!.worldToLocal(this.point);this.hips.position.copy(this.point);
  this.root.updateWorldMatrix(true,true);
  this.root.getWorldQuaternion(this.frameQuaternion);
  for(const leg of feet){
   leg.target.getWorldPosition(this.point);this.pole.set(0,1,.2).transformDirection(this.root.matrixWorld);
   solveLimb(leg,this.point,this.pole,this.rotation.copy(this.frameQuaternion).multiply(leg.rotation),.98);
  }
  // Reuse the suited hero's authored hand curls. Its EUC_Ride_Idle clip is for
  // a different vehicle, so Driving_Idle is the fitted procedural cabin state.
  new FingerPose(this.driver,heroClips).apply('WeaponGrip');
  for(const [side,sign]of [['Left',1],['Right',-1]] as const){
   const hand=required(this.driver,side+'Hand');
   // Palm centre in the imported hand frame; contact is the palm, not the
   // wrist origin. The long hand axis follows the wheel's inclined vertical.
   const finger=required(this.driver,side+'HandMiddle1');
   const palm=finger.position.clone().multiplyScalar(.72);
   const y=new T.Vector3(0,.91,.42).normalize(),z=new T.Vector3(-sign,0,0),x=y.clone().cross(z).normalize();
   const orientation=quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
   this.arms.push({upper:required(this.driver,side+'Arm'),knee:required(this.driver,side+'ForeArm'),foot:hand,sign,target:sign===1?this.anchors.leftGrip:this.anchors.rightGrip,palm,rotation:orientation});
  }
  this.poseHands();
  this.driverPose=snapshots(this.driver);
  const animated=new Set<T.Object3D>([this.driverSpine,this.driverHead,...this.arms.flatMap(arm=>[arm.upper,arm.knee,arm.foot])]);
  this.motionPose=this.driverPose.filter(pose=>animated.has(pose.bone));
  this.dog.scale.setScalar(CADILLAC_CABIN_FIT.dogScale);
  // A four-degree cabin-space tilt fits the haunch and front paws to the
  // sculpted cushion. The measured bolster is higher than its centre plateau.
  this.dog.rotation.set(0,CADILLAC_CABIN_FIT.dogYaw,CADILLAC_CABIN_FIT.dogRoll,'ZYX');
  this.dog.position.fromArray(CADILLAC_CABIN_FIT.dogPosition);
  this.mixer=new T.AnimationMixer(this.dog);this.sit=this.mixer.clipAction(clip);this.sit.play();this.mixer.setTime(0);
  this.dogHeadBase.copy(this.dogHead.quaternion);
  // Scan the full posed skin once, including the tail, and ground it to the
  // measured bench. Continuous motion is bounded at the head; no frame scans.
  const dogBox=skinBounds(this.dog,this.root);
  this.dog.position.y+=CADILLAC_CABIN_FIT.rearCushionY+CADILLAC_CABIN_FIT.dogSupportClearance-dogBox.min.y;
  this.driverBounds=skinBounds(this.driver,this.root);
  this.dogBounds=skinBounds(this.dog,this.root);
  this.reset();
 }

 private turnInCabin(bone:T.Object3D,x:number,y:number,z:number,angle:number){
  if(!angle)return;
  // Compose rotations inside the cabin rather than decomposing world skin
  // matrices. Imported breathing scales can shear those matrices slightly;
  // this keeps the same local pose at every vehicle heading and bank angle.
  this.parentRotation.identity();
  for(let parent=bone.parent;parent&&parent!==this.root;parent=parent.parent)this.parentRotation.premultiply(parent.quaternion);
  this.axis.set(x,y,z).applyQuaternion(this.parentRotation.normalize().invert());
  this.deltaRotation.setFromAxisAngle(this.axis,angle);
  bone.quaternion.premultiply(this.deltaRotation);
 }
 private poseHands(){
  // The wheel can rotate more than a half-turn. Repositioning the grip around
  // its round rim keeps each arm on its own side, instead of crossing through
  // the driver's torso when the wheel makes a full steering revolution.
  const handTurn=T.MathUtils.clamp(this.steering*.65,-.35,.35);
  this.root.updateWorldMatrix(true,false);
  this.gripFrame.quaternion.copy(this.wheel.quaternion).invert().multiply(this.wheelRest).multiply(this.deltaRotation.setFromAxisAngle(steeringAxis,handTurn));
  this.gripFrame.updateWorldMatrix(true,false);
  for(const arm of this.arms){
   this.gripFrame.getWorldQuaternion(this.frameQuaternion);
   this.rotation.copy(this.frameQuaternion).multiply(arm.rotation);
   arm.target.getWorldPosition(this.point);
   this.axis.copy(arm.palm).multiplyScalar(CADILLAC_CABIN_FIT.driverScale).applyQuaternion(this.rotation);
   this.point.sub(this.axis);
   this.pole.set(arm.sign,-.45,-.25).transformDirection(this.root.matrixWorld);
   solveLimb(arm,this.point,this.pole,this.rotation,.98);
  }
 }
 private updateTargets(){
  this.root.updateWorldMatrix(true,false);
  this.driverHead.getWorldPosition(this.point);this.anchors.driverHead.position.copy(this.root.worldToLocal(this.point));
  this.dogHead.getWorldPosition(this.point);this.anchors.dogHead.position.copy(this.root.worldToLocal(this.point));
 }
 update(dt:number,steering:number,reduced=false){
  if(this.disposed)return;
  const step=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.1):0;
  this.steering=Number.isFinite(steering)?T.MathUtils.clamp(steering,-1,1):0;this.reduced=reduced;
  if(!reduced)this.time=(this.time+step)%3600;
  restore(this.motionPose);
  if(!reduced){
   this.turnInCabin(this.driverSpine,1,0,0,Math.sin(this.time*1.35)*.003);
   this.turnInCabin(this.driverHead,0,1,0,Math.sin(this.time*.42)*.018+this.steering*.055);
  }
  this.poseHands();
  this.dogHead.quaternion.copy(this.dogHeadBase);
  if(reduced)this.mixer.setTime(0);else this.mixer.update(step);
  this.dogHeadBase.copy(this.dogHead.quaternion);
  const glance=reduced?0:Math.sin(this.time*.48)*.08;
  this.turnInCabin(this.dogHead,0,1,0,glance);
  if(!reduced)this.turnInCabin(this.dogHead,1,0,0,Math.sin(this.time*.71)*.012);
  this.dogState=Math.abs(glance)>.025?'Look_Out_Window':'Sit_Idle';this.dog.userData.animationState=this.dogState;
  this.updateTargets();invalidateAnimatedShadow(this.root);
 }
 reset(){
  if(this.disposed)return;
  this.time=0;this.steering=0;restore(this.driverPose);
  this.dogHead.quaternion.copy(this.dogHeadBase);this.sit.reset().play();this.mixer.setTime(0);
  this.dogHeadBase.copy(this.dogHead.quaternion);this.update(0,0,this.reduced);
 }
 diagnostics(){
  return{
   parent:this.root.parent?.name??null,driverAsset:this.driverAsset,driverState:'Driving_Idle',driverAnimation:'procedural seated IK',
   dogState:this.dogState,dogSourceClip:'Dog_Sit',seatBinding:'measured runtime anchors',
   driverScale:CADILLAC_CABIN_FIT.driverScale,dogScale:CADILLAC_CABIN_FIT.dogScale,
   steeringWheelLift:CADILLAC_CABIN_FIT.steeringWheelLift,
   driverSeat:this.anchors.driverSeat.position.toArray(),rearSeat:this.anchors.rearSeat.position.toArray(),
   driverHead:this.anchors.driverHead.position.toArray(),dogHead:this.anchors.dogHead.position.toArray(),
   driverPoseBounds:bounds(this.driverBounds),dogPoseBounds:bounds(this.dogBounds),
   reducedMotion:this.reduced,disposed:this.disposed,
  };
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.mixer.stopAllAction();this.mixer.uncacheRoot(this.dog);
  const skeletons=new Set<T.Skeleton>();
  this.root.traverse(object=>{if((object as T.SkinnedMesh).isSkinnedMesh)skeletons.add((object as T.SkinnedMesh).skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
  this.restoreSteeringFit();
  this.gripFrame.removeFromParent();this.root.removeFromParent();
 }
}
