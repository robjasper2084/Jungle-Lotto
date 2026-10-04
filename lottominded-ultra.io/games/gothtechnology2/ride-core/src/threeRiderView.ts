import * as T from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { RidePose } from './controller.ts';
import {clamp} from './rideDynamics.ts';
import {HUMAN_PROFILE,type RiderProfile} from './profiles.ts';
import { riderMotion } from './riderMotion.ts';
import {CrashContact} from './crashContact.ts';
import type {TerrainSampler} from './terrain.ts';

type Limb={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;target:T.Vector3;rotation:T.Quaternion;};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
function pointBone(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
  const p=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(p).normalize(),to=target.clone().sub(p).normalize();
  const world=bone.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,true);
}
function solve(l:Limb,target:T.Vector3,pole:T.Vector3,rotation?:T.Quaternion,reachFraction=1){
  const a=l.upper.getWorldPosition(v()),b=l.knee.getWorldPosition(v()),c=l.foot.getWorldPosition(v());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a);
  const d=clamp(dir.length(),.03,(l1+l2)*reachFraction-.0001);dir.normalize();
  const reachableTarget=a.clone().addScaledVector(dir,d);
  pole.addScaledVector(dir,-pole.dot(dir)).normalize();if(pole.lengthSq()<.01)pole.set(1,0,0);
  const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  pointBone(l.upper,l.knee,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));pointBone(l.knee,l.foot,reachableTarget);
  if(rotation)l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(q()).invert().multiply(rotation));
}
function rotateWorld(bone:T.Object3D|undefined,axis:T.Vector3,angle:number){if(!bone)return;const w=bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(axis,angle));bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(w));bone.updateWorldMatrix(false,true);}
function prepare(o:T.Object3D){o.traverse(n=>{const m=n as T.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});}
export class ThreeRiderView {
  root=new T.Group();ground=new T.Group();lean=new T.Group();vehicle:T.Object3D;rider:T.Object3D;
  wheel?:T.Object3D;body?:T.Object3D;bodyRestY=0;hips?:T.Object3D;head?:T.Object3D;chest?:T.Object3D;
  spine:T.Object3D[]=[];neck?:T.Object3D;shoulders:T.Object3D[]=[];
  private fallPivot=new T.Vector3();private axle=new T.Vector3();private tyreRadius=.255;private tyreHalfWidth=.07;
  bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];legs:Limb[]=[];arms:Limb[]=[];
  private riderContact:CrashContact;private wheelContact:CrashContact;private terrain?:TerrainSampler;
  readonly profile:RiderProfile;
  readonly wheelScale:number;readonly motionScale:number;readonly mountHeight:number;
  constructor(riderAsset:GLTF,wheelAsset:GLTF,terrain?:TerrainSampler,profile:RiderProfile=HUMAN_PROFILE){
    this.terrain=terrain;this.profile=profile;
    this.wheelScale=profile.wheelScale;this.motionScale=profile.motionScale;this.mountHeight=profile.pedalHeight*this.wheelScale;
    this.root.add(this.ground);this.ground.add(this.lean);
    this.vehicle=wheelAsset.scene.clone(true);this.rider=clone(riderAsset.scene);
    this.vehicle.scale.setScalar(this.wheelScale);this.rider.position.y=this.mountHeight;this.lean.add(this.vehicle,this.rider);
    const clip=riderAsset.animations[0];if(clip){const m=new T.AnimationMixer(this.rider);m.clipAction(clip).play();m.setTime(0);}
    prepare(this.root);this.root.updateMatrixWorld(true);
    this.wheel=this.vehicle.getObjectByName('Wheel_Pivot');this.body=this.vehicle.getObjectByName('Body_Suspension');this.bodyRestY=this.body?.position.y??0;this.hips=this.rider.getObjectByName('Hips');this.head=this.rider.getObjectByName('Head');
    // This asset names the spine from the chest DOWN. Bind in anatomical parent order.
    this.spine=['Spine02','Spine01','Spine'].map(name=>this.rider.getObjectByName(name)).filter((bone):bone is T.Object3D=>!!bone);
    this.chest=this.spine.at(-1)??this.rider.getObjectByName('Chest');
    this.neck=this.rider.getObjectByName('neck')??this.rider.getObjectByName('Neck');
    this.shoulders=['LeftShoulder','RightShoulder'].map(name=>this.rider.getObjectByName(name)).filter((bone):bone is T.Object3D=>!!bone);
    if(this.wheel){const bounds=new T.Box3().setFromObject(this.wheel),size=bounds.getSize(v());this.axle.copy(this.lean.worldToLocal(bounds.getCenter(v())));this.tyreRadius=(size.y+size.z)/4;this.tyreHalfWidth=size.x/2;}
    this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
    for(const side of ['Left','Right'])for(const arm of [false,true]){
      const upper=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg')),knee=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg')),foot=this.rider.getObjectByName(side+(arm?'Hand':'Foot'));
      if(upper&&knee&&foot)(arm?this.arms:this.legs).push({upper,knee,foot,target:this.lean.worldToLocal(foot.getWorldPosition(v())),rotation:this.lean.getWorldQuaternion(q()).invert().multiply(foot.getWorldQuaternion(q()))});
    }
    for(const l of this.legs){l.target.divideScalar(this.wheelScale);l.target.x=Math.sign(l.target.x)*profile.pedalHalfSpacing;}
    this.root.name='Digital Static RideCore • '+profile.id;
    if(this.hips)this.fallPivot.copy(this.rider.worldToLocal(this.hips.getWorldPosition(v())));
    this.riderContact=new CrashContact(this.rider);this.wheelContact=new CrashContact(this.vehicle);
  }
  dispose(){this.root.removeFromParent();this.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});}
  pedalTarget(l:Limb,suspensionOffset:number){return this.vehicle.localToWorld(l.target.clone().add(new T.Vector3(0,suspensionOffset,0)));}
  footTarget(index:number,p:RidePose){
    const target=this.pedalTarget(this.legs[index],p.suspensionOffset);
    if(index===0&&this.profile.footDownStop&&p.stopFoot>0&&p.crashBlend<.01){
      const ankle=this.legs[0].target.y*this.wheelScale-this.mountHeight;
      const planted=this.root.localToWorld(new T.Vector3(this.motionScale<1?.30:.39,ankle,.035));
      if(this.terrain){const g=this.terrain.sampleGround(planted.x,planted.z,{height:p.y,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false},p.y);planted.y=g.height+ankle;}
      target.lerp(planted,p.stopFoot);
    }
    if(index===0&&p.crashBlend<.01){
      target.add(new T.Vector3(p.trickFoot*.08,p.trickFoot*.24,-p.trickFoot*.20).transformDirection(this.lean.matrixWorld).multiplyScalar(Math.hypot(p.trickFoot*.08,p.trickFoot*.24,p.trickFoot*.20)));
    }
    return target;
  }
  apply(p:RidePose){
    // A recovered/mounted pose must not inherit a previous fall's body or wheel
    // displacement, including when a paused preview supplies a partial pose.
    if(p.crashBlend<=0){
      const keys=(Object.keys(p) as (keyof RidePose)[]).filter(k=>k.startsWith('crash')||k.startsWith('wheelCrash'));
      if(keys.some(k=>p[k]!==0)){p={...p};for(const key of keys)p[key]=0;}
    }
    this.root.position.set(p.x,p.y,p.z);this.root.rotation.set(0,p.headingY,0);
    // Self-balancing pedals stay level fore/aft on a grade; the body provides the climbing lean.
    this.ground.rotation.set(0,0,p.groundRoll*.25);this.ground.position.y=0;this.lean.rotation.set(p.wheelPitch,0,-p.rollAngle);
    // Ground contact under a bank changes all local axes. Reset the full transform
    // so those corrections cannot accumulate sideways over repeated fallen frames.
    this.vehicle.position.set(p.wheelCrashLateral,p.wheelCrashPop,p.wheelCrashForward);this.vehicle.rotation.set(0,p.wobbleYaw+p.wheelCrashSpin,-p.wobbleRoll-p.wheelCrashLean);
    if(this.wheel)this.wheel.rotation.x=p.wheelSpin;
    if(this.body)this.body.position.y=this.bodyRestY+p.suspensionOffset;
    this.rider.position.set(p.crashLateral,this.mountHeight+p.suspensionOffset*this.wheelScale-p.crashDrop,p.crashForward);
    this.rider.rotation.set(p.crashTumble,0,p.crashRoll);
    if(p.crashMotion){const pivot=this.fallPivot.clone().multiply(this.rider.scale);this.rider.position.add(pivot.clone().sub(pivot.applyEuler(this.rider.rotation)));}
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
    this.root.updateMatrixWorld(true);
    if(p.crashBlend<.01){
      // Rounded tyre support about the real axle prevents floating during a bank.
      const axisY=new T.Vector3(1,0,0).transformDirection(this.lean.matrixWorld).y;
      const support=(this.tyreRadius-this.tyreHalfWidth)*Math.sqrt(Math.max(0,1-axisY*axisY))+this.tyreHalfWidth;
      this.ground.position.y=support-(this.lean.localToWorld(this.axle.clone()).y-p.y);this.root.updateMatrixWorld(true);
    }
    const hips=this.hips;if(!hips)return;
    // Once released, posture belongs to the falling body, not the upright wheel.
    const bodyFrame=p.crashMotion?this.rider.matrixWorld:this.lean.matrixWorld;
    const forward=new T.Vector3(0,0,1).transformDirection(bodyFrame),right=new T.Vector3(1,0,0).transformDirection(bodyFrame),up=new T.Vector3(0,1,0).transformDirection(bodyFrame);
    const motion=riderMotion(p);
    motion.drop*=this.motionScale;motion.shift*=this.motionScale;motion.lateral*=this.motionScale;
    for(const hand of motion.hands){hand.x*=this.motionScale;hand.y*=this.motionScale;hand.z*=this.motionScale;}
    if(this.profile.footDownStop&&p.stopFoot>0&&p.crashBlend<.01){motion.drop+=p.stopFoot*(this.mountHeight-.045);motion.lateral+=p.stopFoot*.075;motion.shift*=1-p.stopFoot;motion.pitch*=1-p.stopFoot*.75;}
    // Shift the centre of mass before solving planted boots. Phase alone has no displacement.
    const hipWorld=hips.getWorldPosition(v()).addScaledVector(up,-motion.drop+p.bodyBob)
      .addScaledVector(forward,motion.shift).addScaledVector(right,motion.lateral+.025*p.wobble*p.wobbleSway);
    hips.position.copy(hips.parent!.worldToLocal(hipWorld));this.root.updateMatrixWorld(true);
    // Spread the hinge across the pelvis and spine instead of tipping one rigid figure.
    rotateWorld(hips,right,motion.pitch*.55);
    rotateWorld(hips,forward,(p.crashMotion?0:p.rollAngle-p.riderRoll)+motion.hipTilt);
    rotateWorld(hips,up,motion.hipYaw);
    for(let i=0;i<this.spine.length;i++)rotateWorld(this.spine[i],right,motion.pitch*[.20,.15,.10][i]);
    if(!this.spine.length)rotateWorld(this.chest,right,motion.pitch*.45);
    rotateWorld(this.chest,forward,-motion.hipTilt+motion.chestRoll);
    rotateWorld(this.chest,up,motion.chestYaw-motion.hipYaw);
    // Neck and head share the correction: no single-joint swivel at the base of the skull.
    const neckShare=this.neck?.65:0;
    const neckPitch=p.crashMotion?.30*p.crashHeadTuck:motion.neck;
    rotateWorld(this.neck,right,neckPitch*neckShare);
    rotateWorld(this.neck,up,(motion.headYaw-motion.chestYaw)*.4);
    rotateWorld(this.neck,forward,motion.headRoll*neckShare);
    rotateWorld(this.head,right,neckPitch*(1-neckShare));
    rotateWorld(this.head,up,(motion.headYaw-motion.chestYaw)*(this.neck?.6:1));
    rotateWorld(this.head,forward,motion.headRoll*(1-neckShare));
    for(let i=0;i<this.shoulders.length;i++){
      const side=i===0?1:-1;
      rotateWorld(this.shoulders[i],forward,side*motion.shoulders[i]);
      rotateWorld(this.shoulders[i],up,-side*(p.crouch*.045+p.airBlend*.035));
    }
    for(let i=0;i<this.legs.length;i++){
      const l=this.legs[i],target=this.footTarget(i,p),rotation=this.vehicle.getWorldQuaternion(q()).multiply(l.rotation);
      const side=i===0?1:-1,inside=side===Math.sign(p.rollAngle);
      const pole=forward.clone().applyAxisAngle(up,motion.hipYaw*.5).addScaledVector(right,inside?side*.45*motion.carve*(1-motion.technical):0);
      // Release the pedals progressively as the rider falls away from the machine.
      const release=p.crashMotion?clamp((p.crashRelease-(i===0?0:.07))/(i===0?.88:.93),0,1):clamp(p.crashBlend*3,0,1);
      if(p.crashMotion){
        const bodyUp=new T.Vector3(0,1,0).transformDirection(this.rider.matrixWorld),bodyForward=new T.Vector3(0,0,1).transformDirection(this.rider.matrixWorld),bodyRight=new T.Vector3(1,0,0).transformDirection(this.rider.matrixWorld);
        const hip=l.upper.getWorldPosition(v()),length=hip.distanceTo(l.knee.getWorldPosition(v()))+l.knee.getWorldPosition(v()).distanceTo(l.foot.getWorldPosition(v()));
        const bend=p.crashLegTuck*(side===(p.crashSide||1)?.72:1);
        const free=hip.clone().addScaledVector(bodyUp,-length*(.92-.32*bend)).addScaledVector(bodyForward,(i===0?.21:.08)*bend).addScaledVector(bodyRight,side*.13*bend);
        if(p.crashContact>.5)free.y=Math.max(p.y-p.airHeight+.06,free.y);
        solve(l,target.lerp(free,release),bodyForward.addScaledVector(bodyRight,side*.2),rotation.clone().slerp(this.rider.getWorldQuaternion(q()).multiply(l.rotation),release));
      }else if(release<1)solve(l,target.lerp(l.foot.getWorldPosition(v()),release),pole,rotation);
    }
    for(let i=0;i<this.arms.length;i++){
      const l=this.arms[i],offset=motion.hands[i];
      // Apparent gravity and arm inertia own the hang, independently of the torso hinge.
      const shoulder=l.upper.getWorldPosition(v()),elbow=l.knee.getWorldPosition(v()),hand=l.foot.getWorldPosition(v());
      const length=shoulder.distanceTo(elbow)+elbow.distanceTo(hand),worldUp=new T.Vector3(0,1,0);
      const down=new T.Vector3(Math.sin(motion.armBank),-1,Math.sin(motion.armSwing)).normalize().transformDirection(this.root.matrixWorld);
      const target=shoulder.clone().addScaledVector(down,length*.98).addScaledVector(worldUp,offset.y)
        .addScaledVector(right,offset.x).addScaledVector(forward,offset.z);
      // Elbows open sideways as the hands rise, rather than remaining pinned behind
      // the torso during a hop or low-speed balance turn.
      const elbowOpen=clamp(offset.y/this.motionScale,0,.4);
      const armPole=forward.clone().multiplyScalar(-1).addScaledVector(right,(i===0?1:-1)*(.70+elbowOpen*1.3));
      if(p.crashMotion){
        const bodyUp=new T.Vector3(0,1,0).transformDirection(this.rider.matrixWorld),bodyForward=new T.Vector3(0,0,1).transformDirection(this.rider.matrixWorld),bodyRight=new T.Vector3(1,0,0).transformDirection(this.rider.matrixWorld),side=i===0?1:-1;
        const lower=side===(p.crashSide||1);
        const protective=shoulder.clone().addScaledVector(bodyUp,-length*(.25+.20*p.crashAbsorb)).addScaledVector(bodyForward,length*(.34+.36*p.crashReach-.16*p.crashAbsorb)).addScaledVector(bodyRight,side*length*(lower?.34:.24));
        protective.y=Math.max(p.y-p.airHeight+.055,protective.y);
        // After contact, fold the lower arm inward instead of balancing the whole body on fingertips.
        const rest=shoulder.clone().addScaledVector(bodyUp,-length*.30).addScaledVector(bodyForward,length*.25).addScaledVector(bodyRight,-side*length*.22);
        protective.lerp(rest,p.crashSettle);
        target.lerp(protective,Math.min(1,p.crashBrace*1.7+p.crashRelease));
        armPole.lerp(bodyUp.negate().addScaledVector(bodyForward,.25),p.crashSettle);
      }
      solve(l,target,armPole,undefined,.975);
      // Bone reset preserved the authored hand-to-forearm orientation. Follow that
      // frame completely, then add a small passive flex about its own lateral axis.
      // A world-down blend was still pulling against the elbow's balance movement.
      const rotation=l.foot.getWorldQuaternion(q());
      const wristAxis=right.clone().addScaledVector(up,-(i===0?1:-1)*.22).normalize();
      rotation.premultiply(q().setFromAxisAngle(wristAxis,p.crashMotion?-.18*p.crashAbsorb+.12*p.crashCurl:offset.wrist));
      l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(q()).invert().multiply(rotation));
    }
    this.root.updateMatrixWorld(true);
    if(p.crashBlend>0){
      const floor=p.crashMotion?p.y-p.airHeight:p.y;
      this.wheelContact.settle(this.vehicle,floor,this.terrain,.018);
      this.riderContact.settle(this.rider,floor,this.terrain);
      this.root.updateMatrixWorld(true);
    }
  }
}
