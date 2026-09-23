import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

type Limb={upper:T.Object3D;joint:T.Object3D;end:T.Object3D;rest:T.Vector3;rotation:T.Quaternion};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
const smooth=(t:number)=>t*t*(3-2*t);
function point(b:T.Object3D,child:T.Object3D,target:T.Vector3){
 const origin=b.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 const rotation=b.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
 b.quaternion.copy(b.parent!.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);
}
function solve(l:Limb,target:T.Vector3,pole:T.Vector3,rotation?:T.Quaternion){
 const a=l.upper.getWorldPosition(v()),b=l.joint.getWorldPosition(v()),c=l.end.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a);
 const d=Math.max(.03,Math.min(dir.length(),l1+l2-.0001));dir.normalize();
 pole.addScaledVector(dir,-pole.dot(dir)).normalize();
 const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
 point(l.upper,l.joint,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));point(l.joint,l.end,a.clone().addScaledVector(dir,d));
 if(rotation)l.end.quaternion.copy(l.end.parent!.getWorldQuaternion(q()).invert().multiply(rotation));
 l.end.updateWorldMatrix(false,true);
}

/** A planted two-wheel transporter stance or alternating inline push/recovery. */
export class MobilityRider {
 readonly root=new T.Group();readonly rider:T.Object3D;readonly kind:'segway'|'skater'|'scooter';
 bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];legs:Limb[]=[];arms:Limb[]=[];
 skates:T.Object3D[]=[];wheels:T.Object3D[]=[];footTargets:T.Vector3[]=[];handTargets:T.Vector3[]=[];
 hips:T.Object3D;phase=0;wheelTurn=0;effort=0;private materials:T.Material[]=[];
 constructor(kind:'segway'|'skater'|'scooter',data:Map<string,GLTF>){
  this.kind=kind;this.root.name=kind==='scooter'?'Detroit tee electric scooter rider':kind==='segway'?'Two-wheel electric transporter rider':'Inline rollerblader';
  this.rider=clone(data.get(kind==='scooter'?'SW_Detroit_Tee_Rider':'DS_Pedestrian_01')!.scene);this.rider.position.y=kind==='scooter'?.193:kind==='segway'?.298:.10;this.root.add(this.rider);
  this.root.updateMatrixWorld(true);this.hips=this.rider.getObjectByName('Hips')!;
  this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
  for(const side of ['Left','Right'])for(const arm of [false,true]){
   const upper=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg'))!,joint=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg'))!,end=this.rider.getObjectByName(side+(arm?'Hand':'Foot'))!;
   (arm?this.arms:this.legs).push({upper,joint,end,rest:this.root.worldToLocal(end.getWorldPosition(v())),rotation:end.getWorldQuaternion(q())});
  }
  if(kind==='scooter'){
   const scooter=data.get('SW_Scooter_01')!.scene.clone(true);this.root.add(scooter);
   for(const axle of ['Front','Rear'])this.wheels.push(scooter.getObjectByName('Scooter_'+axle+'_Wheel')!);
  }else if(kind==='segway'){
   const scooter=data.get('DS_Segway_01')!.scene.clone(true);this.root.add(scooter);
   for(const side of ['L','R'])this.wheels.push(scooter.getObjectByName('Segway_Wheel_'+side)!);
  }else for(let i=0;i<2;i++){
   const skate=data.get('DS_InlineSkate_01')!.scene.clone(true);skate.name='Inline_skate_'+i;this.root.add(skate);this.skates.push(skate);
   skate.traverse(o=>{if(o.name.startsWith('Skate_Wheel_'))this.wheels.push(o);});
  }
  // Separate equipment colors keep skin and clothing textures unmodified.
  if(kind!=='scooter'){
  const helmetMat=new T.MeshStandardMaterial({color:kind==='segway'?'#228994':'#88569e',roughness:.58});this.materials.push(helmetMat);
  const helmet=new T.Mesh(new T.SphereGeometry(1,16,10),helmetMat);helmet.name='Mobility_helmet';helmet.scale.set(.112,.083,.14);
  const head=this.rider.getObjectByName('Head')!;this.root.add(helmet);this.root.updateMatrixWorld(true);
  helmet.position.copy(this.root.worldToLocal(head.getWorldPosition(v())).add(new T.Vector3(0,.105,0)));
  head.attach(helmet);helmet.updateMatrixWorld(true);
  }
  this.root.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){m.castShadow=m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});
  this.apply(0,0);
 }
 apply(speed:number,dt:number){
  dt=Math.max(0,Math.min(dt,.1));const moving=Math.min(1,Math.abs(speed)/1.5);
  this.effort+=(moving-this.effort)*(1-Math.exp(-dt*10));
  this.phase=(this.phase+dt*Math.abs(speed)*.44) % 1;this.wheelTurn=(this.wheelTurn+speed*dt/(this.kind==='scooter'?.145:this.kind==='segway'?.23:.04))%(Math.PI*2);
  for(const w of this.wheels)w.rotation.x=this.wheelTurn;
  for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
  this.root.updateMatrixWorld(true);
  const forward=new T.Vector3(0,0,1).transformDirection(this.root.matrixWorld),right=new T.Vector3(1,0,0).transformDirection(this.root.matrixWorld),up=new T.Vector3(0,1,0);
  const skate=this.kind==='skater',scooter=this.kind==='scooter',sway=skate?Math.sin(this.phase*Math.PI*2)*.06*this.effort:0;
  const hips=this.hips.getWorldPosition(v()).addScaledVector(up,skate?-.105-.012*Math.sin(this.phase*Math.PI*4)*this.effort:scooter?-.055-.006*this.effort*Math.sin(this.phase*Math.PI*2):-.035).addScaledVector(right,sway).addScaledVector(forward,skate?.035:scooter?.055:.01);
  this.hips.position.copy(this.hips.parent!.worldToLocal(hips));this.root.updateMatrixWorld(true);
  const chest=this.rider.getObjectByName('Spine02')!;
  const rotation=chest.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(right,skate?.10*this.effort:.025));
  chest.quaternion.copy(chest.parent!.getWorldQuaternion(q()).invert().multiply(rotation));this.root.updateMatrixWorld(true);
  this.footTargets=[];this.handTargets=[];
  for(let i=0;i<2;i++){
   const l=this.legs[i],side=i===0?1:-1,target=l.rest.clone();let strideX=0,strideZ=0,lift=0,yaw=0;
   if(scooter){target.set(side*.048,l.rest.y,i===0?.10:-.19);yaw=side*.12;}
   else if(skate){
    const t=(this.phase+i*.5)%1,p=t<.6?smooth(t/.6):1-smooth((t-.6)/.4);
    strideX=side*.18*p*this.effort;strideZ=(.12-.3*p)*this.effort;lift=t<.6?0:.08*Math.sin((t-.6)/.4*Math.PI)*this.effort;yaw=-side*.20*p*this.effort;
    target.x+=strideX;target.z+=strideZ;target.y+=lift;
    this.skates[i].position.set(target.x,lift,target.z-l.rest.z);this.skates[i].rotation.y=yaw;
   }
   const worldTarget=this.root.localToWorld(target),footRotation=this.root.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),yaw)).multiply(l.rotation);
   this.footTargets.push(worldTarget.clone());solve(l,worldTarget,forward.clone(),footRotation);
  }
  for(let i=0;i<2;i++){
   const l=this.arms[i],side=i===0?1:-1;
   // The hand bone is at the wrist: set it behind the grip and turn the palm
   // forward over the bar, rather than leaving straight fingers hanging below it.
   const target=skate?l.rest.clone().add(new T.Vector3(side*.055,.06,.17*Math.sin(this.phase*Math.PI*2+i*Math.PI)*this.effort)):scooter?new T.Vector3(side*.252,1.182,.263):new T.Vector3(side*.267,1.245,.235);
   const handRotation=skate?undefined:this.root.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2)).multiply(l.rotation);
   const worldTarget=this.root.localToWorld(target);this.handTargets.push(worldTarget.clone());solve(l,worldTarget,forward.clone().multiplyScalar(-1).addScaledVector(right,side*.4),handRotation);
  }
  this.root.updateMatrixWorld(true);
 }
 dispose(){this.root.getObjectByName('Mobility_helmet')?.traverse(o=>{if((o as T.Mesh).isMesh)(o as T.Mesh).geometry.dispose();});for(const m of this.materials)m.dispose();}
}
