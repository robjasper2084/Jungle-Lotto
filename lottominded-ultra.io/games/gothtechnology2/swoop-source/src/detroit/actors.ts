import {HairWind} from './windMotion.ts';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {createPose as initialMountedPose,type RidePose} from './controller.ts';
import type { TrafficState } from './world.ts';
import { clamp } from './world.ts';
import { riderMotion } from './riderMotion.ts';
import {MobilityRider} from './mobilityTraffic.ts';
import {CrashContact} from './crashContact.ts';
import {RiderVisibility} from './riderVisibility.ts';
import {FootTraffic} from './footTraffic.ts';
import {HumanFallRig} from './humanFallRig.ts';
import type {RiderId} from './riderChoices.ts';
import type {TerrainSampler} from './terrain.ts';
import {createGroundSample} from './terrain.ts';

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
export async function loadActors(){
  const loader=new GLTFLoader(),data=new Map<string,GLTF>();
  await Promise.all(['DS_Man_01','DS_EUC_01','DS_Boerboel_01','DS_Pedestrian_01','DS_Cyclist_01','DS_Bicycle_01','DS_Hazard_Cone_01','DS_Hazard_Barrier_01'].map(async id=>data.set(id,await loader.loadAsync(`/exports/glb/${id}/${id}_LOD${id==='DS_Man_01'?0:1}.glb`))));
  await Promise.all(['DS_Segway_01','DS_InlineSkate_01'].map(async id=>data.set(id,await loader.loadAsync(`/exports/mobility/${id}.glb`))));
  await Promise.all(['SW_Scooter_01','SW_Detroit_Tee_Rider'].map(async id=>data.set(id,await loader.loadAsync(`/exports/scooter/${id}.glb`))));
  await Promise.all(['DS_Hoodie_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'].map(async id=>data.set(id,await loader.loadAsync(`/exports/glb/${id}/${id}_LOD1.glb`))));
  return data;
}
export class Hero {
  root=new T.Group();ground=new T.Group();lean=new T.Group();vehicle:T.Object3D;rider:T.Object3D;
  wheel?:T.Object3D;body?:T.Object3D;bodyRestY=0;hips?:T.Object3D;head?:T.Object3D;chest?:T.Object3D;
  spine:T.Object3D[]=[];neck?:T.Object3D;shoulders:T.Object3D[]=[];
  private fallPivot=new T.Vector3();private axle=new T.Vector3();private tyreRadius=.255;private tyreHalfWidth=.07;
  bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];legs:Limb[]=[];arms:Limb[]=[];
  private riderContact:CrashContact;private wheelContact:CrashContact;private terrain?:TerrainSampler;
  readonly riderId:RiderId;
  readonly wheelScale:number;readonly motionScale:number;readonly mountHeight:number;
  skateboarding=false;private skateContact?:CrashContact;private skateboard=new T.Group();private skateWheels:T.Mesh[]=[];
  private saddle:T.Mesh;private hairWind:HairWind;
  readonly visibility:RiderVisibility;readonly vrEyeHeight:number;readonly mountedVolume:{radius:number;height:number};
  constructor(data:Map<string,GLTF>,terrain?:TerrainSampler,riderId:RiderId='DS_Man_01'){
    this.terrain=terrain;this.riderId=riderId;
    const mascot=riderId.startsWith('DS_Mascot_');this.wheelScale=mascot?.75:.86;this.motionScale=mascot?.48:1;this.mountHeight=.296*this.wheelScale;
    this.root.add(this.ground);this.ground.add(this.lean);
    this.vehicle=data.get('DS_EUC_01')!.scene.clone(true);this.rider=clone(data.get(riderId)!.scene);
    this.hairWind=new HairWind(this.rider,riderId==='DS_Man_01');
    this.vehicle.scale.setScalar(this.wheelScale);this.rider.position.y=this.mountHeight;this.lean.add(this.vehicle,this.rider,this.skateboard);
    const deck=new T.Mesh(new T.BoxGeometry(.28,.045,.88),new T.MeshStandardMaterial({color:'#242a29',roughness:.95}));deck.position.y=.15;this.skateboard.add(deck);for(const end of [-1,1]){const tip=new T.Mesh(new T.BoxGeometry(.28,.045,.17),deck.material);tip.position.set(0,.18,end*.48);tip.rotation.x=end*-.32;this.skateboard.add(tip);}
    for(const z of [-.29,.29]){const truck=new T.Mesh(new T.BoxGeometry(.25,.05,.07),new T.MeshStandardMaterial({color:'#b4b8b9',metalness:.8,roughness:.3}));truck.position.set(0,.095,z);this.skateboard.add(truck);for(const x of [-.145,.145]){const wheel=new T.Mesh(new T.CylinderGeometry(.06,.06,.045,12),new T.MeshStandardMaterial({color:'#e4cf98',roughness:.7}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.06,z);this.skateboard.add(wheel);this.skateWheels.push(wheel);}}
    this.skateboard.visible=false;this.skateContact=new CrashContact(this.skateboard);
    const clip=data.get(riderId)!.animations[0];if(clip){const m=new T.AnimationMixer(this.rider);m.clipAction(clip).play();m.setTime(0);}
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
    for(const l of this.legs){l.target.divideScalar(this.wheelScale);l.target.x=Math.sign(l.target.x)*.195;}
    this.saddle=new T.Mesh(new T.BoxGeometry(mascot?.23:.27,.055,mascot?.23:.29),new T.MeshStandardMaterial({color:0x202828,roughness:.85}));this.saddle.name='Seated riding saddle';this.saddle.position.set(0,mascot?.41:.76,mascot?-.19:-.065);this.saddle.visible=false;this.lean.add(this.saddle);
    this.root.name='Digital Static • '+riderId+' on separate EUC';
    if(this.hips)this.fallPivot.copy(this.rider.worldToLocal(this.hips.getWorldPosition(v())));
    this.riderContact=new CrashContact(this.rider);this.wheelContact=new CrashContact(this.vehicle);
    this.visibility=new RiderVisibility(this.rider,this.head);
    this.vrEyeHeight=(this.head?.getWorldPosition(v()).y??1.75)+.065;
      this.apply({...initialMountedPose()});const box=new T.Box3().setFromObject(this.root,true);
      this.mountedVolume={radius:Math.max(.4,Math.abs(box.min.x),Math.abs(box.max.x),Math.abs(box.min.z),Math.abs(box.max.z))+.06,height:box.max.y+.08};
  }
  dispose(){this.skateboard.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.hairWind.dispose();this.saddle.geometry.dispose();(this.saddle.material as T.Material).dispose();this.visibility.dispose();this.root.removeFromParent();this.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});}
  pedalTarget(l:Limb,suspensionOffset:number){return this.vehicle.localToWorld(l.target.clone().add(new T.Vector3(0,suspensionOffset,0)));}
  footTarget(index:number,p:RidePose){
    const target=this.pedalTarget(this.legs[index],p.suspensionOffset);
    if(index===0&&this.motionScale===1&&p.stopFoot>0&&p.crashBlend<.01){
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
    if(this.skateboarding&&p.crashBlend===0)p={...p,stopFoot:0,seated:0};
    this.hairWind.update(p.speed,p.headingY,typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    // A recovered/mounted pose must not inherit a previous fall's body or wheel
    // displacement, including when a paused preview supplies a partial pose.
    if(p.crashBlend<=0){
      const keys=(Object.keys(p) as (keyof RidePose)[]).filter(k=>k.startsWith('crash')||k.startsWith('wheelCrash'));
      if(keys.some(k=>p[k]!==0)){p={...p};for(const key of keys)p[key]=0;}
    }
    this.root.position.set(p.x,p.y,p.z);this.root.rotation.set(0,p.headingY,0);
    // Self-balancing pedals stay level fore/aft on a grade; the body provides the climbing lean.
    this.ground.rotation.set(this.skateboarding?p.groundPitch:0,0,p.groundRoll*(this.skateboarding?1:.25));this.ground.position.y=0;this.lean.rotation.set(p.wheelPitch,0,-p.rollAngle);
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
    const motion=riderMotion(p),sit=clamp(p.seated||0,0,1)*(1-clamp(p.airBlend,0,1))*(1-clamp(p.crashBlend*4,0,1));
    this.saddle.visible=sit>.01;this.saddle.position.y=(this.motionScale<1?.41:.76)+p.suspensionOffset*this.wheelScale;
    if(sit){motion.pitch=T.MathUtils.lerp(motion.pitch,.20+p.riderPitch*.3,sit);motion.neck=-motion.pitch*.78;motion.lateral*=1-sit*.8;motion.hipYaw*=1-sit*.85;motion.hipTilt*=1-sit*.8;}
    motion.drop*=this.motionScale;motion.shift*=this.motionScale;motion.lateral*=this.motionScale;
    for(const hand of motion.hands){hand.x*=this.motionScale;hand.y*=this.motionScale;hand.z*=this.motionScale;}
    if(this.motionScale===1&&p.stopFoot>0&&p.crashBlend<.01){motion.drop+=p.stopFoot*(this.mountHeight-.045);motion.lateral+=p.stopFoot*.075;motion.shift*=1-p.stopFoot;motion.pitch*=1-p.stopFoot*.75;}
    // Shift the centre of mass before solving planted boots. Phase alone has no displacement.
    const hipWorld=hips.getWorldPosition(v()).addScaledVector(up,-motion.drop+p.bodyBob)
      .addScaledVector(forward,motion.shift).addScaledVector(right,motion.lateral+.025*p.wobble*p.wobbleSway);
    if(sit){const seated=this.lean.localToWorld(new T.Vector3(0,(this.motionScale<1?.495:.88)+p.suspensionOffset*this.wheelScale,this.motionScale<1?-.19:-.065));hipWorld.lerp(seated,sit);}
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
    const neckPitch=p.crashMotion?.34*p.crashHeadTuck:motion.neck;
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
      const pole=forward.clone().applyAxisAngle(up,motion.hipYaw*.5).addScaledVector(right,side*(sit*.95+(inside?.45*motion.carve*(1-motion.technical)*(1-sit):0)));
      // Release the pedals progressively as the rider falls away from the machine.
      const fallSide=p.crashSide||Math.sign(p.crashLateral)||1,lowerSide=side===fallSide;
      const release=p.crashMotion?clamp((p.crashRelease-(lowerSide?0:.07))/(lowerSide?.88:.93),0,1):clamp(p.crashBlend*3,0,1);
      if(p.crashMotion){
        const bodyUp=new T.Vector3(0,1,0).transformDirection(this.rider.matrixWorld),bodyForward=new T.Vector3(0,0,1).transformDirection(this.rider.matrixWorld),bodyRight=new T.Vector3(1,0,0).transformDirection(this.rider.matrixWorld);
        const hip=l.upper.getWorldPosition(v()),length=hip.distanceTo(l.knee.getWorldPosition(v()))+l.knee.getWorldPosition(v()).distanceTo(l.foot.getWorldPosition(v()));
        const bend=p.crashLegTuck*(lowerSide?.72:1.12);
        const free=hip.clone().addScaledVector(bodyUp,-length*(.92-.40*bend))
          .addScaledVector(bodyForward,length*(lowerSide?.18:.34)*bend*(p.crashDirection||1))
          .addScaledVector(bodyRight,side*length*.12*bend);
        // Let both boots relax onto the ground after the roll, rather than leaving
        // the upper leg suspended in the sideways body frame.
        const footFloor=this.terrain?this.terrain.sampleGround(free.x,free.z,createGroundSample(),p.y-p.airHeight).height:p.y-p.airHeight;
        free.y=T.MathUtils.lerp(free.y,footFloor+.075*this.motionScale,p.crashSettle);
        // Staggered knee recovery keeps the thighs apart and clears the departing wheel.
        solve(l,target.lerp(free,release),bodyForward.addScaledVector(bodyRight,side*.2),rotation.clone().slerp(this.rider.getWorldQuaternion(q()).multiply(l.rotation),release));
      }else if(release<1)solve(l,target.lerp(l.foot.getWorldPosition(v()),release),pole,rotation);
    }
    for(let i=0;i<this.arms.length;i++){
      const l=this.arms[i],offset=motion.hands[i];
      // Apparent gravity and arm inertia own the hang, independently of the torso hinge.
      const shoulder=l.upper.getWorldPosition(v()),elbow=l.knee.getWorldPosition(v()),hand=l.foot.getWorldPosition(v());
      const length=shoulder.distanceTo(elbow)+elbow.distanceTo(hand),worldUp=new T.Vector3(0,1,0);
      const down=new T.Vector3(Math.sin(motion.armBank),-1,Math.sin(motion.armSwing)).normalize().transformDirection(this.root.matrixWorld);
      const target=shoulder.clone().addScaledVector(down,length*.90).addScaledVector(worldUp,offset.y)
        .addScaledVector(right,offset.x).addScaledVector(forward,offset.z);
      if(sit){const knee=this.legs[i]?.knee.getWorldPosition(v());if(knee)target.lerp(knee.addScaledVector(up,.07*this.motionScale).addScaledVector(forward,-.07*this.motionScale),sit);}
      // Elbows open sideways as the hands rise, rather than remaining pinned behind
      // the torso during a hop or low-speed balance turn.
      const elbowOpen=clamp(offset.y/this.motionScale,0,.4);
      const armPole=forward.clone().multiplyScalar(-1).addScaledVector(right,(i===0?1:-1)*(.25+elbowOpen*1.3));
      if(p.crashMotion){
        const bodyUp=new T.Vector3(0,1,0).transformDirection(this.rider.matrixWorld),bodyForward=new T.Vector3(0,0,1).transformDirection(this.rider.matrixWorld),bodyRight=new T.Vector3(1,0,0).transformDirection(this.rider.matrixWorld),side=i===0?1:-1;
        const lowerSide=side===(p.crashSide||Math.sign(p.crashLateral)||1),direction=p.crashDirection||1;
        const reach=p.crashReach,absorb=p.crashAbsorb,curl=p.crashCurl;
        // The contact-side hand braces first. The other forearm protects the chest/head.
        // Elbow compression follows impact rather than holding a rigid two-arm plank.
        const down=lowerSide?.28-.17*absorb:.02-.10*curl;
        const front=lowerSide?.28+.38*reach-.22*absorb:.30+.12*reach;
        const width=lowerSide?.32+.13*reach-.25*absorb:.17;
        const protective=shoulder.clone().addScaledVector(bodyUp,-length*down)
          .addScaledVector(bodyForward,length*front*direction).addScaledVector(bodyRight,side*length*width);
        const rest=shoulder.clone().addScaledVector(bodyUp,-length*(lowerSide?.18:.10))
          .addScaledVector(bodyForward,length*(lowerSide?.28:.36)).addScaledVector(bodyRight,-side*length*.10);
        protective.lerp(rest,p.crashSettle);
        target.lerp(protective,Math.min(1,p.crashBrace*1.7+p.crashRelease));
        armPole.copy(bodyForward).multiplyScalar(-.35).addScaledVector(bodyRight,side*.6).addScaledVector(bodyUp,-.7);

      }
      solve(l,target,armPole,undefined,.95);
      // Let the hand follow its forearm. Locking the palm to world-down made a raised
      // arm bend sharply at the wrist, especially during slow turns and deep tucks.
      const rotation=this.root.getWorldQuaternion(q()).multiply(l.rotation)
        .slerp(l.foot.getWorldQuaternion(q()),.92).premultiply(q().setFromAxisAngle(right,offset.wrist));
      l.foot.quaternion.copy(l.foot.parent!.getWorldQuaternion(q()).invert().multiply(rotation));
    }
    this.vehicle.visible=!this.skateboarding;this.skateboard.visible=this.skateboarding;
    if(this.skateboarding){
      this.saddle.visible=false;this.skateboard.position.copy(this.vehicle.position);this.skateboard.rotation.copy(this.vehicle.rotation);
      for(const wheel of this.skateWheels)wheel.rotation.x=p.wheelSpin*4;
      if(p.crashBlend===0){
        this.rider.position.y=.15-p.crouch*.08;this.rider.rotation.y=Math.PI/2;this.root.updateMatrixWorld(true);
        this.skateboard.rotation.x+=p.takeoffExtension*-.18+p.landingCompression*.12;
        const push=p.airBlend<.05&&p.crouch<.1&&Math.abs(p.rollAngle)<.15&&p.driveIntent>.1?Math.max(0,Math.sin(p.wheelSpin*1.5))*Math.min(1,p.speed/1.5):0;
        const pole=new T.Vector3(1,0,0).transformDirection(this.lean.matrixWorld);
        for(let i=0;i<this.legs.length;i++){const l=this.legs[i],ankle=l.target.y*this.wheelScale-this.mountHeight;const target=this.lean.localToWorld(new T.Vector3(i===1?push*.30:0,.15+ankle-(i===1?push*.11:0),-Math.sign(l.target.x)*.23*this.motionScale-(i===1?push*.32:0)));const rotation=this.lean.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2)).multiply(l.rotation);solve(l,target,pole.clone(),rotation);}
        rotateWorld(this.head,new T.Vector3(0,1,0),-Math.PI/3);
      }
    }
    this.root.updateMatrixWorld(true);
    if(p.crashBlend>0){
      const floor=p.crashMotion?p.y-p.airHeight:p.y;
      if(this.skateboarding)this.skateContact?.settle(this.skateboard,floor,this.terrain,.018);else this.wheelContact.settle(this.vehicle,floor,this.terrain,.018);
      this.riderContact.settle(this.rider,floor,this.terrain,.025,p.crashMotion?p.crashContact:0);
      this.root.updateMatrixWorld(true);
    }
  }
}
export class TrafficView {
  scene:T.Scene;data:Map<string,GLTF>;items=new Map<number,{root:T.Group;mixers:T.AnimationMixer[];pedalPhase:number;clipStart:number;clipDuration:number;mobility?:MobilityRider;foot?:FootTraffic;fallRig?:HumanFallRig}>();
  constructor(scene:T.Scene,data:Map<string,GLTF>,readonly terrain?:TerrainSampler){this.scene=scene;this.data=data;}
  update(actors:TrafficState[],dt:number){const keep=new Set<number>();for(const a of actors){keep.add(a.id);let item=this.items.get(a.id);
    if(!item){const root=new T.Group(),mixers:T.AnimationMixer[]=[];const add=(id:string,animate=false)=>{const d=this.data.get(id)!,o=animate?clone(d.scene):d.scene.clone(true);root.add(o);prepare(o);if(animate&&d.animations.length){const m=new T.AnimationMixer(o);m.clipAction(d.animations[0]).play();mixers.push(m);}};
      let mobility:MobilityRider|undefined,foot:FootTraffic|undefined;
      if(a.kind==='segway'||a.kind==='skater'||a.kind==='scooter'){mobility=new MobilityRider(a.kind,this.data);mobility.phase=(a.id*.37)%1;root.add(mobility.root);}
      else if(a.kind==='pedestrian'||a.kind==='jogger'){foot=new FootTraffic(this.data.get(Math.floor(a.id/2)%2?'DS_Hoodie_Woman_01':'DS_Hoodie_Man_01')!,a.kind==='jogger');foot.phase=(a.id*.37)%1;root.add(foot.root);}
      else if(a.kind==='cyclist'){add('DS_Cyclist_01',true);add('DS_Bicycle_01');}else add(a.kind==='cone'?'DS_Hazard_Cone_01':'DS_Hazard_Barrier_01');
      const clip=this.data.get('DS_Cyclist_01')?.animations[0],clipStart=clip?Math.min(...clip.tracks.map(t=>t.times[0])):0;
      item={root,mixers,pedalPhase:0,clipStart,clipDuration:(clip?.duration??2)-clipStart,mobility,foot};this.items.set(a.id,item);this.scene.add(root);
    }
    item.root.position.set(a.x,a.y,a.z);item.root.rotation.y=a.heading;
    if(a.fall){
      if(!item.fallRig){
        const mobility=item.mobility;
        if(mobility?.kind==='skater'){item.root.updateMatrixWorld(true);mobility.skates.forEach((skate,i)=>mobility.legs[i].end.attach(skate));}
        const rider=item.foot?.rider??mobility?.rider??item.root.children[0],equipment=mobility?mobility.root.children.filter(o=>o!==rider):a.kind==='cyclist'?item.root.children.slice(1):[];
        item.fallRig=new HumanFallRig(rider,equipment,this.terrain);
      }
      item.root.updateMatrixWorld(true);item.fallRig.apply(a.fall,a.y);continue;
    }
    if(item.fallRig){item.fallRig.restore();item.fallRig=undefined;if(item.mobility?.kind==='skater'){const m=item.mobility;m.skates.forEach(s=>{m.root.attach(s);s.rotation.set(0,0,0);});}}
    if(item.foot){item.root.updateMatrixWorld(true);item.foot.apply(a.speed,dt);}
    else if(item.mobility){item.root.updateMatrixWorld(true);item.mobility.apply(a.speed,dt);}
    else if(a.kind==='cyclist'){
      // One phase owns the baked legs, crank and opposing, level pedals. A 2.5:1 gear ratio.
      const wheelTurn=a.speed*dt/.34;item.pedalPhase=(item.pedalPhase+wheelTurn/2.5)%(Math.PI*2);
      for(const m of item.mixers)m.setTime(item.clipStart+item.pedalPhase/(Math.PI*2)*item.clipDuration);
      const crank=item.root.getObjectByName('Bicycle_Crank_Pivot');if(crank)crank.rotation.x=item.pedalPhase;
      for(const name of ['Bicycle_Pedal_L_Pivot','Bicycle_Pedal_R_Pivot']){const pedal=item.root.getObjectByName(name);if(pedal)pedal.rotation.x=-item.pedalPhase;}
      for(const name of ['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot']){const w=item.root.getObjectByName(name);if(w)w.rotation.x+=wheelTurn;}
    }else for(const m of item.mixers)m.update(dt);
  }for(const[id,item]of this.items)if(!keep.has(id)){item.root.removeFromParent();item.mixers.forEach(m=>m.stopAllAction());item.mobility?.dispose();this.items.delete(id);}}
}

