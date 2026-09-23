import {dogBalance} from './dogBalance.ts';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {DogPose} from './companion.ts';
import type {TerrainSampler} from './terrain.ts';
import {createGroundSample} from './terrain.ts';
import {gaitWeights,pawContact} from './dogGait.ts';

type Paw={upper:T.Object3D;lower:T.Object3D;ankle:T.Object3D;foot:T.Object3D;restHeight:number;anchor:T.Vector3|null;contact:number};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
function point(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
  const origin=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const rotation=bone.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
function plant(paw:Paw,target:T.Vector3,pole:T.Vector3,rotation:T.Quaternion){
  const a=paw.upper.getWorldPosition(v()),b=paw.lower.getWorldPosition(v()),c=paw.ankle.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c);
  // Preserve the authored hock/wrist flexion while moving the pad onto its
  // contact. Solving directly to the pad collapses this fourth joint.
  const ankleOffset=c.clone().sub(paw.foot.getWorldPosition(v())),ankleTarget=target.clone().add(ankleOffset);
  const direction=ankleTarget.sub(a),distance=T.MathUtils.clamp(direction.length(),.015,l1+l2-.001);direction.normalize();
  pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
  const joint=a.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
  const reachable=a.addScaledVector(direction,distance);
  point(paw.upper,paw.lower,joint);point(paw.lower,paw.ankle,reachable);
  point(paw.ankle,paw.foot,reachable.sub(ankleOffset));
  paw.foot.quaternion.copy(paw.foot.parent!.getWorldQuaternion(q()).invert().multiply(rotation));paw.foot.updateWorldMatrix(false,true);
}
export class CompanionView {
  root=new T.Group();ground=new T.Group();model:T.Object3D;mixer:T.AnimationMixer;gait='idle';
  paws:Paw[]=[];private blendedSpeed=0;private lastTime=-1;private lastPosition=v();private sample=createGroundSample();
  private terrain?:TerrainSampler;
  private animated:{bone:T.Object3D;position:T.Vector3;rotation:T.Quaternion;scale:T.Vector3}[]=[];
  clips:{action:T.AnimationAction;start:number;duration:number}[]=[];
  constructor(data:Map<string,GLTF>,terrain?:TerrainSampler){
    this.terrain=terrain;
    const asset=data.get('DS_Boerboel_01')!;this.model=clone(asset.scene);
    this.root.name='DS_Boerboel_01 • riding companion';this.root.add(this.ground);this.ground.add(this.model);
    this.mixer=new T.AnimationMixer(this.model);
    for(const name of ['Dog_Idle','Dog_Walk','Dog_Trot','Dog_Run']){
      const clip=asset.animations.find(c=>c.name===name);
      if(!clip)throw new Error(`Boerboel animation missing: ${name}`);
      const start=Math.min(...clip.tracks.map(t=>t.times[0]));
      this.clips.push({action:this.mixer.clipAction(clip).play(),start,duration:clip.duration-start});
    }
    this.root.updateMatrixWorld(true);
    this.model.traverse(bone=>{if((bone as T.Bone).isBone)this.animated.push({bone,position:bone.position.clone(),rotation:bone.quaternion.clone(),scale:bone.scale.clone()});});
    for(const [prefix,side] of [['front','L'],['front','R'],['hind','L'],['hind','R']]){
      const upper=this.model.getObjectByName(`${prefix}_upper_${side}`)!,lower=this.model.getObjectByName(`${prefix}_lower_${side}`)!,ankle=this.model.getObjectByName(`${prefix}_ankle_${side}`),foot=this.model.getObjectByName(`${prefix}_paw_${side}`)!;
      if(!ankle)throw new Error('Boerboel articulated gait asset required: missing '+prefix+'_ankle_'+side);
      this.paws.push({upper,lower,ankle,foot,restHeight:foot.getWorldPosition(v()).y,anchor:null,contact:0});
    }
    this.model.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=!(o as T.SkinnedMesh).isSkinnedMesh;}});
  }
  reactToRider(hero:{x:number;z:number;speed:number},p:DogPose){
    if(p.speed>.5||Math.abs(hero.speed)>.3)return;
    const head=this.model.getObjectByName('head');if(!head)return;
    const yaw=Math.atan2(hero.x-p.x,hero.z-p.z)-p.heading;
    head.rotateY(T.MathUtils.clamp(Math.atan2(Math.sin(yaw),Math.cos(yaw)),-.4,.4)*.45);
  }
  apply(p:DogPose){
    this.root.position.set(p.x,p.y,p.z);this.root.rotation.y=p.heading;
    this.ground.rotation.set(p.pitch,0,p.roll);
    const gaitSpeed=p.gaitSpeed??p.speed;
    const elapsed=p.time-this.lastTime;
    if(this.lastTime<0||elapsed<0||elapsed>.25||p.time===0)this.blendedSpeed=gaitSpeed;
    else if(elapsed>0)this.blendedSpeed+=(gaitSpeed-this.blendedSpeed)*(1-Math.exp(-9*elapsed));
    const weights=gaitWeights(this.blendedSpeed);
    this.gait=['idle','walk','trot','run'][weights.indexOf(Math.max(...weights))];
    const jumping=(p.jumpHeight??0)>.005;
    if(jumping)this.gait='jump';
    this.clips.forEach((c,i)=>{c.action.setEffectiveWeight(weights[i]);c.action.time=c.start+((i?p.phase:p.time*.4)%1)*c.duration;});
    // The mixer skips unchanged properties. Restore its previous output before
    // applying IK so repeated paused frames cannot accumulate bone corrections.
    for(const a of this.animated){a.bone.position.copy(a.position);a.bone.quaternion.copy(a.rotation);a.bone.scale.copy(a.scale);}
    this.mixer.update(0);
    for(const a of this.animated){a.position.copy(a.bone.position);a.rotation.copy(a.bone.quaternion);a.scale.copy(a.bone.scale);}
    const balance=dogBalance(this.blendedSpeed,p.phase,p.turnRate||0,p.time,p.landing??0,p.lookYaw??0);
    this.model.getObjectByName('chest')?.rotateX(balance.chestPitch);
    this.model.getObjectByName('chest')?.rotateY(balance.chestYaw);
    this.model.getObjectByName('neck')?.rotateX(balance.neckPitch);
    this.model.getObjectByName('neck')?.rotateY(balance.neckYaw);
    this.model.getObjectByName('head')?.rotateY(balance.headYaw);
    this.model.getObjectByName('tail')?.rotateY(balance.tailYaw);
    this.model.getObjectByName('pelvis')?.rotateZ(balance.hipRoll);
    this.root.updateMatrixWorld(true);
    const dt=p.time-this.lastTime,reset=this.lastTime<0||dt<0||dt>.25||this.lastPosition.distanceTo(this.root.position)>2;
    if(reset)for(const paw of this.paws)paw.anchor=null;
    // Bank the trunk into a turn while the paws stay on their own ground contacts.
    const pelvis=this.model.getObjectByName('pelvis')!,turn=p.turnRate||0;
    const bank=T.MathUtils.clamp(-turn*p.speed*.014,-.14,.14)*(1-weights[0]);
    const rotation=pelvis.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld),bank));
    pelvis.quaternion.copy(pelvis.parent!.getWorldQuaternion(q()).invert().multiply(rotation));this.root.updateMatrixWorld(true);
    for(const [i,paw] of this.paws.entries()){
      const animated=paw.foot.getWorldPosition(v()),rotation=paw.foot.getWorldQuaternion(q());
      const contact=jumping?0:pawContact(gaitSpeed,p.phase,i);paw.contact=contact;
      if(contact<.05||gaitSpeed<.04)paw.anchor=null;
      if(!reset&&p.time>0&&gaitSpeed>.04&&contact>.75&&!paw.anchor)paw.anchor=animated.clone();
      // Release an unreachable planted foot after an emergency collision/recovery.
      if(paw.anchor&&Math.hypot(paw.anchor.x-animated.x,paw.anchor.z-animated.z)>.35)paw.anchor=null;
      const target=animated.clone();
      // Outside paws travel a longer arc; the inside pair takes shorter steps.
      // Stance anchors still own planted feet, so this only changes the swing target.
      const turnSide=i%2===0?1:-1, strideBias=T.MathUtils.clamp(-turnSide*turn*.025,-.065,.065);
      target.addScaledVector(new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld),strideBias*(1-contact));
      if(gaitSpeed>p.speed+.08)target.y+=.018*(1-contact);
      if(jumping){
        // Forelegs gather first, hind legs follow; extend forelegs before touchdown.
        const progress=p.jumpProgress??.5,tuck=Math.sin(Math.PI*progress)*(i<2?.12:.095);
        target.y+=tuck;target.addScaledVector(new T.Vector3(0,0,1).transformDirection(this.ground.matrixWorld),(i<2?-.07:.07)*Math.sin(Math.PI*progress));
      }
      if(paw.anchor){target.x=T.MathUtils.lerp(animated.x,paw.anchor.x,contact);target.z=T.MathUtils.lerp(animated.z,paw.anchor.z,contact);}
      const floor=this.terrain?this.terrain.sampleGround(target.x,target.z,this.sample,p.y).height+.015:p.y;
      target.y=T.MathUtils.lerp(target.y,floor+paw.restHeight,contact);
      // The terrain correction keeps the authored toe roll and hock recovery.
      const pole=new T.Vector3(0,0,i<2?-1:1).transformDirection(this.ground.matrixWorld);
      plant(paw,target,pole,rotation);
    }
    this.lastTime=p.time;this.lastPosition.copy(this.root.position);
    this.root.updateMatrixWorld(true);
  }
}
