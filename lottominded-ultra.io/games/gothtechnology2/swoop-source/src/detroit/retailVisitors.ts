import * as T from 'three';
import {GLTFLoader,type GLTF} from './compressedGLTFLoader.ts';
import {FootTraffic,solveFootContact} from './footTraffic.ts';
import {VISITOR_IDS,VisitorJourney} from './retailVisitorRoutes.ts';
let visitors:Promise<GLTF[]>|undefined;
const assets=()=>visitors??=Promise.all(VISITOR_IDS.map(id=>new GLTFLoader().loadAsync('/exports/visitors/'+id+'.glb?v=reference-visitors-20261003')));
type Visitor={walker:FootTraffic;journey:VisitorJourney;pose:number;camera?:T.Object3D;phone?:T.Object3D;charm?:T.Object3D;bag?:T.Object3D;cameraRest?:T.Vector3};
export class RetailVisitors {
 readonly root=new T.Group();private people:Visitor[]=[];private accumulated=0;private age=0;private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(readonly store:boolean){this.root.name=store?'GothTech reference shoppers':'Serengeti reference visitors';}
 async load(){
  const data=await assets();
  this.people=data.map((gltf,i)=>{const walker=new FootTraffic(gltf,false),journey=new VisitorJourney(this.store,i);walker.root.name=VISITOR_IDS[i];walker.root.position.set(journey.position.x,.08,journey.position.z);walker.root.rotation.y=journey.heading;this.root.add(walker.root);const find=(name:string)=>walker.rider.getObjectByName(name);const camera=find('Visitor_Camera');return {walker,journey,pose:0,camera,cameraRest:camera?.position.clone(),phone:find('Visitor_Phone'),charm:find('Visitor_Charm'),bag:find('Visitor_Bag')};});
  this.update(1/30);
 }
 get count(){return this.people.length;}
 get summary(){return this.people.map(({journey},i)=>({id:VISITOR_IDS[i],x:+journey.position.x.toFixed(2),z:+journey.position.z.toFixed(2),action:journey.walking?'walking':journey.action,visits:journey.completed}));}
 update(dt:number){
  if(!this.root.parent?.visible||dt<=0)return;
  this.accumulated+=Math.min(dt,.1);if(this.accumulated<1/30)return;dt=this.accumulated;this.accumulated=0;this.age+=dt;
  for(let i=0;i<this.people.length;i++){
   const person=this.people[i],{walker:w,journey:j}=person;
   if(!this.reduced.matches)j.step(dt,this.people.filter((_,n)=>n!==i).map(p=>p.journey.position));
   w.root.position.set(j.position.x,.08,j.position.z);const diff=T.MathUtils.euclideanModulo(j.heading-w.root.rotation.y+Math.PI,Math.PI*2)-Math.PI;w.root.rotation.y+=diff*(1-Math.exp(-dt*5));w.apply(this.reduced.matches?0:j.speed,dt);
   const photo=!j.walking&&j.action==='photo'&&!!(person.camera||person.phone),inspect=!j.walking&&(j.action==='browse'||j.action==='checkout');person.pose=T.MathUtils.damp(person.pose,(photo||inspect)?1:0,8,dt);
   const head=w.rider.getObjectByName('Head')!,eye=w.root.worldToLocal(head.getWorldPosition(new T.Vector3())).y+.015;
   if(person.camera&&person.cameraRest){person.camera.position.copy(person.cameraRest).lerp(new T.Vector3(0,eye,.30),photo?person.pose:0);}
   for(let arm=0;arm<2;arm++){
    const limb=w.arms[arm],oldUpper=limb.upper.quaternion.clone(),oldJoint=limb.joint.quaternion.clone();let target:T.Vector3|undefined;
    if(photo&&person.camera)target=new T.Vector3(arm===0?.065:-.065,eye-.035,.29);
    else if(photo&&person.phone&&arm===1)target=new T.Vector3(-.1,eye-.06,.34);
    else if(inspect&&arm===0)target=new T.Vector3(.14,eye-.43,.33);
    else if(person.charm&&arm===1)target=new T.Vector3(-.15,eye-.49,.20);
    if(target){const weight=photo||inspect?person.pose:.65;solveFootContact(limb,w.root.localToWorld(target),new T.Vector3(arm===0?1:-1,-.4,0).transformDirection(w.root.matrixWorld));limb.upper.quaternion.slerpQuaternions(oldUpper,limb.upper.quaternion.clone(),weight);limb.joint.quaternion.slerpQuaternions(oldJoint,limb.joint.quaternion.clone(),weight);w.root.updateMatrixWorld(true);}
   }
   const right=w.arms[1].end.getWorldPosition(new T.Vector3());
   if(person.bag){person.bag.position.copy(w.rider.worldToLocal(right.clone().add(new T.Vector3(0,-.14,0))));person.bag.quaternion.copy(w.rider.getWorldQuaternion(new T.Quaternion()).invert());}
   if(person.charm){const hand=w.arms[1].end;person.charm.position.copy(w.rider.worldToLocal(right));person.charm.quaternion.copy(w.root.getWorldQuaternion(new T.Quaternion()).premultiply(w.rider.getWorldQuaternion(new T.Quaternion()).invert()));hand.updateWorldMatrix(true,false);}
   if(person.phone){person.phone.position.copy(w.rider.worldToLocal(right));person.phone.quaternion.copy(w.root.getWorldQuaternion(new T.Quaternion()).premultiply(w.rider.getWorldQuaternion(new T.Quaternion()).invert()));}
   if(!j.walking){head.rotateY(Math.sin(this.age*.7+i)*.08);head.rotateX(inspect?.06:Math.sin(this.age*.4+i)*.015);}
   w.root.updateMatrixWorld(true);
  }
 }
}
