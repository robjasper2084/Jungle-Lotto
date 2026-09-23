import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

type Limb={upper:T.Object3D;joint:T.Object3D;end:T.Object3D;rest:T.Vector3;rotation:T.Quaternion;sole?:T.Vector3[]};
const v=()=>new T.Vector3(),q=()=>new T.Quaternion(),tau=Math.PI*2;
const smooth=(a:number,b:number,x:number)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function gaitTiming(speed:number,jog:boolean,legLength=.9){
  const run=jog?smooth(2.65,4.2,speed):0;
  return {run,cadence:(jog?1.42+run*.2:.88)*T.MathUtils.clamp(Math.sqrt(.9/legLength),.92,1.1),stance:jog?.44-run*.07:.62};
}
export function footStride(phase:number,speed:number,jog:boolean,legLength=.9){
  const {cadence,stance,run}=gaitTiming(speed,jog,legLength),stride=speed*stance/cadence;
  const t=((phase%1)+1)%1;
  // Contact travels backwards at exactly ground speed. Roll from heel onto the
  // forefoot before lifting; the swing recovers the heel early behind the knee.
  const heel=jog?.08:.22,toe=jog?.55:.43;
  if(t<stance){const s=t/stance;return {z:stride*(.5-s),lift:0,pitch:-heel*(1-smooth(0,.22,s))+toe*smooth(.65,1,s),stance:true};}
  const u=(t-stance)/(1-stance),ease=u*u*(3-2*u);
  const recovery=Math.pow(Math.sin(Math.PI*u),1.25)*(1+(jog?.65:.2)*Math.cos(Math.PI*u));
  return {z:stride*(ease-.5),lift:(jog?.26+run*.10:.075)*recovery,pitch:toe*(1-smooth(0,.72,u))-heel*smooth(.72,1,u),stance:false};
}
function rotate(b:T.Object3D|undefined,axis:T.Vector3,angle:number){
  if(!b)return;const rotation=b.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(axis,angle));
  b.quaternion.copy(b.parent!.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);
}
function point(b:T.Object3D,child:T.Object3D,target:T.Vector3){
  const origin=b.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const rotation=b.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to));
  b.quaternion.copy(b.parent!.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);
}
function solve(l:Limb,target:T.Vector3,pole:T.Vector3,rotation?:T.Quaternion){
  const a=l.upper.getWorldPosition(v()),b=l.joint.getWorldPosition(v()),c=l.end.getWorldPosition(v());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),d=Math.max(.03,Math.min(dir.length(),l1+l2-.0001));dir.normalize();
  pole.addScaledVector(dir,-pole.dot(dir)).normalize();
  const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  point(l.upper,l.joint,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));point(l.joint,l.end,a.clone().addScaledVector(dir,d));
  if(rotation)l.end.quaternion.copy(l.end.parent!.getWorldQuaternion(q()).invert().multiply(rotation));l.end.updateWorldMatrix(false,true);
}

/** Distance-matched stance, swing clearance, opposing arms and forward-facing knees. */
export class FootTraffic {
  readonly root=new T.Group();readonly rider:T.Object3D;readonly jog:boolean;
  bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];legs:Limb[]=[];arms:Limb[]=[];footTargets:T.Vector3[]=[];
  hips:T.Object3D;phase=0;legLength=.9;
  constructor(data:GLTF,jog:boolean){
    this.jog=jog;this.rider=clone(data.scene);this.root.add(this.rider);this.root.name=jog?'Detroit hoodie jogger':'Detroit hoodie walker';
    this.root.updateMatrixWorld(true);this.hips=this.rider.getObjectByName('Hips')!;
    this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});const m=o as T.Mesh;if(m.isMesh){m.castShadow=m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});
    for(const side of ['Left','Right'])for(const arm of [false,true]){
      const upper=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg'))!,joint=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg'))!,end=this.rider.getObjectByName(side+(arm?'Hand':'Foot'))!;
      (arm?this.arms:this.legs).push({upper,joint,end,rest:this.root.worldToLocal(end.getWorldPosition(v())),rotation:end.getWorldQuaternion(q())});
    }
    this.legLength=this.legs.reduce((n,l)=>n+l.upper.getWorldPosition(v()).distanceTo(l.joint.getWorldPosition(v()))+l.joint.getWorldPosition(v()).distanceTo(l.end.getWorldPosition(v())),0)/2;
    // Measure the actual shoe, so a rolling ankle never drives the toe/heel
    // through the floor on either generated character's different footwear.
    for(const l of this.legs){l.sole=[];this.rider.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){const p=this.root.worldToLocal(m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld));if(p.y<.10&&Math.sign(p.x)===Math.sign(l.rest.x))l.sole!.push(p.sub(l.rest));}});}
    this.apply(0,0);
  }
  apply(speed:number,dt:number){
    const effort=Math.min(1,Math.abs(speed)/(this.jog?2.65:1.1)),timing=gaitTiming(Math.abs(speed),this.jog,this.legLength);
    this.phase=(this.phase+Math.max(0,dt)*timing.cadence*effort)%1;
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}
    this.root.updateMatrixWorld(true);
    const forward=new T.Vector3(0,0,1).transformDirection(this.root.matrixWorld),right=new T.Vector3(1,0,0).transformDirection(this.root.matrixWorld),up=new T.Vector3(0,1,0);
    const wave=Math.sin(this.phase*tau),bob=(this.jog?.022:.012)*Math.cos((this.phase-(this.jog?.46:.25))*tau*2)*effort;
    const hips=this.hips.getWorldPosition(v()).addScaledVector(up,-(this.jog?.075:.015)+bob).addScaledVector(right,wave*(this.jog?.012:.020)*effort);
    this.hips.position.copy(this.hips.parent!.worldToLocal(hips));this.root.updateMatrixWorld(true);
    rotate(this.hips,forward,wave*.025*effort);rotate(this.hips,up,wave*.04*effort);
    const spine=['Spine02','Spine01','Spine'].map(n=>this.rider.getObjectByName(n));
    for(const b of spine)rotate(b,right,(this.jog?.13:.025)*effort/3);
    rotate(spine[2],up,-wave*(this.jog?.14:.075)*effort);rotate(this.rider.getObjectByName('Head'),up,wave*(this.jog?.07:.035)*effort);
    rotate(this.rider.getObjectByName('Head'),right,-(this.jog?.10:.02)*effort);
    const strides=this.legs.map((_,i)=>footStride(this.phase+i*.5,Math.abs(speed),this.jog,this.legLength));
    this.footTargets=this.legs.map((l,i)=>{
      const stride=strides[i],target=l.rest.clone(),pitch=stride.pitch*effort;
      const floor=Math.min(...l.sole!.map(p=>p.y*Math.cos(pitch)-p.z*Math.sin(pitch)));
      target.x=Math.sign(target.x)*Math.min(.08,Math.abs(target.x));target.z+=stride.z;
      target.y=-floor+stride.lift*effort+.003;
      return this.root.localToWorld(target);
    });
    // The pelvis follows the supporting leg's arc. Do not stretch a short rig to
    // reach the same stride as a taller person or lift a planted shoe off the path.
    let lower=0;
    for(let i=0;i<2;i++){
      const l=this.legs[i],a=l.upper.getWorldPosition(v()),b=l.joint.getWorldPosition(v()),c=l.end.getWorldPosition(v()),t=this.footTargets[i];
      const reach=(a.distanceTo(b)+b.distanceTo(c))*.998,horizontal=(a.x-t.x)**2+(a.z-t.z)**2;
      lower=Math.max(lower,a.y-t.y-Math.sqrt(Math.max(.01,reach*reach-horizontal)));
    }
    if(lower>0){const hip=this.hips.getWorldPosition(v());hip.y-=lower;this.hips.position.copy(this.hips.parent!.worldToLocal(hip));this.root.updateMatrixWorld(true);}
    for(let i=0;i<2;i++){
      const l=this.legs[i],world=this.footTargets[i];
      const rotation=this.root.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),strides[i].pitch*effort)).multiply(l.rotation);
      solve(l,world,forward.clone(),rotation);
    }
    for(let i=0;i<2;i++){
      const l=this.arms[i],side=Math.sign(l.rest.x),swing=Math.cos((this.phase+i*.5)*tau-.10)*effort;
      const shoulder=l.upper.getWorldPosition(v()),elbow=l.joint.getWorldPosition(v()),hand=l.end.getWorldPosition(v()),upper=shoulder.distanceTo(elbow),lower=elbow.distanceTo(hand);
      // The upper arm drives the swing. On the backstroke the elbow opens a
      // little; the return hand rises toward the ribs with a relaxed wrist.
      // Keeping both forearms forward made running look like carrying a tray.
      const shoulderAngle=this.jog?-.12-(.56+timing.run*.12)*swing:-.045-.30*swing;
      const elbowAngle=this.jog?1.32-.18*swing:.20-.07*swing+.04*Math.sin((this.phase+i*.5)*tau);
      // Anatomical elbow path gives a relaxed sagittal swing. Solving to a hand
      // point near full reach let tiny changes flip the elbow and twist sleeves.
      const elbowTarget=shoulder.clone().addScaledVector(up,-upper*Math.cos(shoulderAngle)).addScaledVector(forward,upper*Math.sin(shoulderAngle)).addScaledVector(right,side*(this.jog?.025:.012));
      elbowTarget.sub(shoulder).setLength(upper).add(shoulder);
      const target=elbowTarget.clone().addScaledVector(up,-lower*Math.cos(shoulderAngle+elbowAngle)).addScaledVector(forward,lower*Math.sin(shoulderAngle+elbowAngle)).addScaledVector(right,-side*(this.jog?.028:.008)*(1-swing)*.5);
      point(l.upper,l.joint,elbowTarget);point(l.joint,l.end,target);
      // Wrists inherit the forearm direction instead of locking to the A-pose.
      rotate(l.end,right,(.07+.035*Math.sin((this.phase+i*.5)*tau-.3))*effort);
      rotate(l.end,forward,side*.035*effort);
    }
    this.root.updateMatrixWorld(true);
  }
}
