import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {solve} from './actors.ts';

export const WALK_CYCLE_METRES=1.08;
export function walkingFoot(phase:number){
  const t=((phase%1)+1)%1,duty=.60,span=WALK_CYCLE_METRES*duty;
  if(t<duty)return {z:span*(.5-t/duty),lift:0,stance:true};
  const u=(t-duty)/(1-duty),ease=u*u*(3-2*u);
  return {z:span*(ease-.5),lift:Math.sin(Math.PI*u)*.105,stance:false};
}
/** Feet stay planted during stance; gait phase advances only with actual travel. */
export class ElmwoodWalkerView{
  root=new T.Group();model:T.Object3D;phone=new T.Group();phase=0;photoBlend=0;
  private bones:{node:T.Object3D;p:T.Vector3;q:T.Quaternion;s:T.Vector3}[]=[];
  private legs:{upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;target:T.Vector3;rotation:T.Quaternion;anchor:T.Vector3;stance:boolean}[]=[];
  private arms:{upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;target:T.Vector3;rotation:T.Quaternion}[]=[];
  private movement=0;
  constructor(asset:GLTF){
    this.model=clone(asset.scene);this.root.add(this.model,this.phone);this.root.updateMatrixWorld(true);
    this.model.traverse(node=>{if((node as T.Bone).isBone)this.bones.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});if((node as T.Mesh).isMesh){node.castShadow=true;node.frustumCulled=false;}});
    for(const side of ['Left','Right']){
      const limb=(a:string,b:string,c:string)=>{const upper=this.model.getObjectByName(side+a)!,knee=this.model.getObjectByName(side+b)!,foot=this.model.getObjectByName(side+c)!;return {upper,knee,foot,target:foot.getWorldPosition(new T.Vector3()),rotation:foot.getWorldQuaternion(new T.Quaternion())};};
      this.legs.push({...limb('UpLeg','Leg','Foot'),anchor:new T.Vector3(),stance:false});this.arms.push(limb('Arm','ForeArm','Hand'));
    }
    const body=new T.Mesh(new T.BoxGeometry(.078,.15,.016),new T.MeshStandardMaterial({color:0x22292d,roughness:.35}));this.phone.add(body);
    const screen=new T.Mesh(new T.PlaneGeometry(.064,.129),new T.MeshBasicMaterial({color:0xadc8c1}));screen.position.z=-.009;screen.rotation.y=Math.PI;this.phone.add(screen);
    const lens=new T.Mesh(new T.CylinderGeometry(.011,.011,.005,10),new T.MeshStandardMaterial({color:0x081316,metalness:.5,roughness:.2}));lens.rotation.x=Math.PI/2;lens.position.set(.021,.046,.01);this.phone.add(lens);this.phone.visible=false;
  }
  update(distance:number,dt:number,photo:boolean,height:(x:number,z:number)=>number){
    if(dt<=0)return;
    this.phase=(this.phase+Math.max(0,distance)/WALK_CYCLE_METRES)%1;
    const moving=distance/dt>.025&&!photo;this.movement+=(Number(moving)-this.movement)*(1-Math.exp(-dt*9));this.photoBlend+=(Number(photo)-this.photoBlend)*(1-Math.exp(-dt*4));
    for(const b of this.bones){b.node.position.copy(b.p);b.node.quaternion.copy(b.q);b.node.scale.copy(b.s);}
    const hips=this.model.getObjectByName('Hips')!;hips.position.y-=.035*this.movement;
    this.root.updateMatrixWorld(true);const rotation=this.root.getWorldQuaternion(new T.Quaternion()),forward=new T.Vector3(0,0,1).applyQuaternion(rotation);
    this.legs.forEach((leg,i)=>{
      const step=walkingFoot(this.phase+i*.5),local=leg.target.clone();local.z+=step.z*this.movement;local.y+=step.lift*this.movement;
      const wanted=this.root.localToWorld(local);wanted.y=height(wanted.x,wanted.z)+leg.target.y+step.lift*this.movement;
      if(moving&&step.stance){if(!leg.stance||leg.anchor.distanceTo(wanted)>.35)leg.anchor.copy(wanted);wanted.copy(leg.anchor);}else leg.anchor.copy(wanted);
      leg.stance=moving&&step.stance;solve(leg,wanted,forward.clone(),rotation.clone().multiply(leg.rotation));
    });
    this.arms.forEach((arm,i)=>{
      const hand=arm.target.clone(),swing=Math.sin(this.phase*Math.PI*2+i*Math.PI)*.16*this.movement;
      hand.z+=swing;hand.y+=Math.abs(swing)*.2;
      hand.lerp(new T.Vector3(i?-.056:.056,1.41,.34),this.photoBlend);
      solve(arm,this.root.localToWorld(hand),new T.Vector3(i?-.5:.5,-1,.15).applyQuaternion(rotation),rotation.clone().multiply(arm.rotation));
    });
    this.phone.visible=this.photoBlend>.05;this.phone.position.set(0,T.MathUtils.lerp(.93,1.45,this.photoBlend),T.MathUtils.lerp(.15,.355,this.photoBlend));this.phone.rotation.x=(1-this.photoBlend)*-.4;
    this.root.updateMatrixWorld(true);
  }
}
