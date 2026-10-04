import * as T from 'three';
import type {GLTF} from './compressedGLTFLoader.ts';
import {FootTraffic,solveFootContact} from './footTraffic.ts';
export type RetailWalkClip={name:string;duration:number;times:number[];bones:Record<string,number[]>;hipPositions:number[];nominalSpeed:number;source:string};
/** The installed Unity walk, retargeted in Blender, with grounded stance IK. */
export class RetailWalker extends FootTraffic {
 private motion?:RetailWalkClip;private motionTime=0;private weight=0;private planted:(T.Vector3|undefined)[]=[undefined,undefined];
 constructor(data:GLTF,clip:RetailWalkClip){super(data,false);this.motion=clip;this.root.name='Original suited hero / Blender-retargeted retail walk';}
 override apply(speed:number,dt:number){
  super.apply(0,dt);const c=this.motion;if(!c)return;
  const walking=Math.abs(speed)>.05;this.weight=T.MathUtils.damp(this.weight,walking?1:0,10,Math.max(0,dt));
  this.motionTime+=Math.max(0,dt)*Math.abs(speed)/c.nominalSpeed;
  const time=this.motionTime%c.duration;let i=0;while(i<c.times.length-2&&c.times[i+1]<time)i++;const j=i+1,t=(time-c.times[i])/(c.times[j]-c.times[i]);
  for(const b of this.bones){const values=c.bones[b.o.name];if(values){const pose=new T.Quaternion().fromArray(values,i*4).slerp(new T.Quaternion().fromArray(values,j*4),t);b.o.quaternion.slerp(pose,this.weight);}}
  const hip=new T.Vector3().fromArray(c.hipPositions,i*3).lerp(new T.Vector3().fromArray(c.hipPositions,j*3),t);this.hips.position.lerp(hip,this.weight);
  this.root.updateMatrixWorld(true);const rootQ=this.root.getWorldQuaternion(new T.Quaternion()),forward=new T.Vector3(0,0,1).applyQuaternion(rootQ);
  this.footTargets=this.legs.map((l,k)=>{
   const rotation=l.end.getWorldQuaternion(new T.Quaternion()),delta=rootQ.clone().invert().multiply(rotation).multiply(l.rotation.clone().invert()),p=l.end.getWorldPosition(new T.Vector3());
   const floor=Math.min(...l.sole!.map(s=>s.clone().applyQuaternion(delta).y));
   const ground=this.root.getWorldPosition(new T.Vector3()).y,targetY=ground-floor+.005;
   const phase=(time/c.duration+k*.5)%1,stance=walking&&phase<.58&&this.weight>.8;
   if(!stance)this.planted[k]=undefined;else if(!this.planted[k])this.planted[k]=new T.Vector3(p.x,targetY,p.z);
   if(this.planted[k]){p.x=this.planted[k]!.x;p.z=this.planted[k]!.z;p.y=targetY;}else p.y=Math.max(p.y,targetY);
   return p;
  });
  // A planted shoe cannot stretch the leg as the body advances or turns.
  let lower=0;for(let k=0;k<2;k++){const l=this.legs[k],a=l.upper.getWorldPosition(new T.Vector3()),b=l.joint.getWorldPosition(new T.Vector3()),e=l.end.getWorldPosition(new T.Vector3()),target=this.footTargets[k],reach=(a.distanceTo(b)+b.distanceTo(e))*.998;lower=Math.max(lower,a.y-target.y-Math.sqrt(Math.max(.001,reach*reach-(a.x-target.x)**2-(a.z-target.z)**2)));}
  if(lower>0){const p=this.hips.getWorldPosition(new T.Vector3());p.y-=lower;this.hips.position.copy(this.hips.parent!.worldToLocal(p));this.root.updateMatrixWorld(true);}
  for(let k=0;k<2;k++)solveFootContact(this.legs[k],this.footTargets[k],forward.clone(),this.legs[k].end.getWorldQuaternion(new T.Quaternion()));
  this.root.updateMatrixWorld(true);
 }
}
