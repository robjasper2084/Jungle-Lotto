import * as T from 'three';
import {TACTICAL_MOTION} from './tacticalMotionData.ts';
import {footGait} from './onFootGait.ts';
import {solveLimb} from './limbIK.ts';
import type {FootPose} from './onFoot.ts';
type Rig={root:T.Object3D;ground:T.Object3D;lean:T.Object3D;rider:T.Object3D;vehicle:T.Object3D;mountHeight:number;motionScale:number;bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]};
type Binding={bone:T.Object3D;offset:T.Quaternion;channel:number};
type Leg={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;rest:T.Vector3;rotation:T.Quaternion;sole:T.Vector3[];length:number};
type Arm={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;upperLength:number;lowerLength:number};
type Fit={body:Binding[];neck?:Binding;legs:Leg[];arms:Arm[];bottom:number;legLength:number;jumpAt:number;jump:number};
const rigs=new WeakMap<Rig,Fit>(),channels=[30,34,44,48,52,56,60,64],tau=Math.PI*2;
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
const quat=(row:number[],offset:number)=>q().fromArray(row,offset).normalize();
function mix(a:number[],b:number[],t:number){const row=a.map((n,k)=>n+(b[k]-n)*t);for(const offset of channels)quat(a,offset).slerp(quat(b,offset),t).toArray(row,offset);return row;}
function sample(name:keyof typeof TACTICAL_MOTION,phase:number){const rows=TACTICAL_MOTION[name].samples,f=T.MathUtils.clamp(phase,0,1)*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1);return mix(rows[i],rows[j],f-i);}
function basis(x:T.Vector3,y:T.Vector3){y.normalize();x.addScaledVector(y,-x.dot(y)).normalize();return q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,x.clone().cross(y).normalize()));}
function worldRotation(bone:T.Object3D,world:T.Quaternion){bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
function point(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
 const a=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(a).normalize(),to=target.clone().sub(a).normalize();
 worldRotation(bone,bone.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(from,to)));
}
function fit(h:Rig):Fit{
 const bottom=new T.Box3().setFromObject(h.rider,true).min.y-h.root.getWorldPosition(v()).y;
 const inverse=h.root.getWorldQuaternion(q()).invert(),bone=(n:string)=>h.rider.getObjectByName(n)!;
 const position=(n:string)=>h.root.worldToLocal(bone(n).getWorldPosition(v()));
 const direction=(a:string,b:string)=>position(b).sub(position(a)).normalize();
 const hipFrame=basis(direction('RightUpLeg','LeftUpLeg'),direction('Hips','Spine02'));
 const chestFrame=basis(direction('RightArm','LeftArm'),direction('Spine02','Spine'));
 const bind=(name:string,reference:T.Quaternion,channel:number):Binding=>({bone:bone(name),channel,offset:reference.clone().invert().multiply(inverse.clone().multiply(bone(name).getWorldQuaternion(q())))});
 const body=['Hips','Spine02','Spine01','Spine'].map((n,i)=>bind(n,hipFrame.clone().slerp(chestFrame,i/3),i));
 const legs:Leg[]=[],arms:Arm[]=[];
 for(const side of ['Left','Right']){
  const upper=bone(side+'UpLeg'),knee=bone(side+'Leg'),foot=bone(side+'Foot');
  legs.push({upper,knee,foot,rest:position(side+'Foot'),rotation:inverse.clone().multiply(foot.getWorldQuaternion(q())),sole:[],length:upper.getWorldPosition(v()).distanceTo(knee.getWorldPosition(v()))+knee.getWorldPosition(v()).distanceTo(foot.getWorldPosition(v()))});
  const a=bone(side+'Arm'),b=bone(side+'ForeArm'),c=bone(side+'Hand');
  arms.push({upper:a,knee:b,foot:c,upperLength:a.getWorldPosition(v()).distanceTo(b.getWorldPosition(v())),lowerLength:b.getWorldPosition(v()).distanceTo(c.getWorldPosition(v()))});
 }
 // Measure the real shoes once per model; do not scan vertices in the animation loop.
 h.rider.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){
  const vertex=h.root.worldToLocal(m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld));
  if(vertex.y>bottom+.12*Math.max(.45,h.motionScale))continue;
  const l=legs.reduce((a,b)=>Math.abs(vertex.x-a.rest.x)<Math.abs(vertex.x-b.rest.x)?a:b);l.sole.push(vertex.sub(l.rest));
 }});
 for(const l of legs)if(!l.sole.length)l.sole.push(new T.Vector3(0,-.05,0));
 const neckName=bone('neck')?'neck':bone('Neck')?'Neck':undefined;
 return{body,legs,arms,bottom,legLength:(legs[0].length+legs[1].length)/2,neck:neckName?bind(neckName,chestFrame,0):undefined,jumpAt:0,jump:0};
}
/** Installed tactical capture supplies body rhythm and arm swing. Contact IK fits
 * each skeleton without copying source translations, scales or walking lean. */
export function applyOnFootRider(h:Rig,pose:Partial<FootPose>){
 if(!(pose.footBlend!>0||pose.footMode!>0))return;
 const p=pose as FootPose,blend=T.MathUtils.clamp(p.footBlend,0,1);
 const mounted=blend<1?h.bones.map(b=>({q:b.o.quaternion.clone(),p:b.o.position.clone()})):undefined;
 h.ground.position.y=0;h.ground.rotation.set(0,0,0);h.lean.rotation.set(0,0,0);h.rider.rotation.set(0,0,0);h.rider.position.set(0,0,0);
 for(const b of h.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}h.root.updateMatrixWorld(true);
 let data=rigs.get(h);if(!data){data=fit(h);rigs.set(h,data);}
 const scale=Math.max(.35,data.legLength/.9),speed=Math.abs(p.speed);
 const cycle=((p.footCycle||p.footPhase)/scale)%1,phase=p.speed<0?(1-cycle)%1:cycle;
 let name:keyof typeof TACTICAL_MOTION=speed<.08?'idle':speed>3.2?'run':speed>2.5?'jog':'walk';
 let clipPhase=name==='idle'?(p.footTime/TACTICAL_MOTION.idle.duration)%1:phase;
 if(p.footJump!==data.jump){data.jump=p.footJump;data.jumpAt=p.footTime;}
 if(p.footJump){name=p.footJump===1?'takeoff':p.footJump===2?'air':'land';clipPhase=Math.min(1,(p.footTime-data.jumpAt)/TACTICAL_MOTION[name].duration);}
 let row=sample(name,clipPhase);
 if(!p.footJump){
  row=mix(sample('idle',(p.footTime/TACTICAL_MOTION.idle.duration)%1),sample('walk',phase),T.MathUtils.smoothstep(speed,0,.85));
  row=mix(row,sample('jog',phase),T.MathUtils.smoothstep(speed,2.5,3.6));row=mix(row,sample('run',phase),T.MathUtils.smoothstep(speed,3.6,5.4));
 }
 const frame=h.root.getWorldQuaternion(q()),forward=new T.Vector3(0,0,1).applyQuaternion(frame),right=new T.Vector3(1,0,0).applyQuaternion(frame),up=new T.Vector3(0,1,0);
 const upright=(source:T.Quaternion)=>{const e=new T.Euler().setFromQuaternion(source,'YXZ');e.x=0;e.z=T.MathUtils.clamp(e.z,-.035,.035);return q().setFromEuler(e);};
 const crouch=T.MathUtils.clamp(p.footCrouch||0,0,1),prone=T.MathUtils.clamp(p.footProne||0,0,1);
 const posture=q().setFromAxisAngle(new T.Vector3(1,0,0),prone*Math.PI/2+crouch*.10);
 const hipFrame=(p.footJump?quat(row,30):upright(quat(row,30))).premultiply(posture),chestFrame=(p.footJump?quat(row,34):upright(quat(row,34))).premultiply(posture);
 for(const b of data.body)worldRotation(b.bone,frame.clone().multiply(hipFrame.clone().slerp(chestFrame,b.channel/3)).multiply(b.offset));
 if(data.neck)worldRotation(data.neck.bone,frame.clone().multiply(hipFrame.clone().slerp(chestFrame,.35)).multiply(data.neck.offset));
 if(data.neck&&prone>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(right,-.9*prone)));
 // Small counter-swings keep the collar alive without importing each A-pose's
 // different elbow plane or bending the torso forward.
 for(const [i,side] of ['Left','Right'].entries()){
  const collar=h.rider.getObjectByName(side+'Shoulder'),arm=h.rider.getObjectByName(side+'Arm');
  if(collar&&arm){const wave=Math.sin(phase*tau+i*Math.PI)*T.MathUtils.smoothstep(speed,0,.85);
   const target=new T.Vector3(i===0?1:-1,-.015+wave*.012,wave*.035).normalize().applyQuaternion(frame);
   point(collar,arm,collar.getWorldPosition(v()).add(target));
  }
 }
 const effort=T.MathUtils.smoothstep(speed,0,.85),jog=T.MathUtils.smoothstep(speed,2.5,4.1),hips=data.body[0].bone,hip=hips.getWorldPosition(v());
 hip.addScaledVector(up,-data.bottom+(.010+.012*jog)*Math.cos(phase*tau*2)*effort*(1-prone)-.34*scale*crouch);
 hip.y=T.MathUtils.lerp(hip.y,h.root.getWorldPosition(v()).y+.26*scale+(h.motionScale<.7?.13:.03),prone);hip.addScaledVector(forward,-.30*scale*prone);
 hips.position.copy(hips.parent!.worldToLocal(hip));h.root.updateMatrixWorld(true);
 if(!p.footJump||p.footJump===3){
  const strides=data.legs.map((_,i)=>footGait(cycle+i*.5,speed,data!.legLength));
  const targets=data.legs.map((l,i)=>{
   const stride=strides[i],pitch=stride.pitch*effort*(1-prone)+prone*.7,floor=Math.min(...l.sole.map(s=>s.y*Math.cos(pitch)-s.z*Math.sin(pitch))),target=l.rest.clone();
   target.z+=stride.z*effort*(p.speed<0?-1:1)*(1-crouch*.4);target.y=-floor+stride.lift*effort+.006;
   target.z=T.MathUtils.lerp(target.z,(-1.10+Math.sin((phase+i*.5)*tau)*.08*effort)*scale,prone);target.y=-floor+stride.lift*effort*(1-prone)+.006;
   return h.root.localToWorld(target);
  });
  let lower=0;data.legs.forEach((l,i)=>{const a=l.upper.getWorldPosition(v()),t=targets[i],reach=l.length*.998;
   lower=Math.max(lower,a.y-t.y-Math.sqrt(Math.max(.000001,reach*reach-(a.x-t.x)**2-(a.z-t.z)**2)));
  });
  if(lower>0){const a=hips.getWorldPosition(v());a.y-=lower;hips.position.copy(hips.parent!.worldToLocal(a));h.root.updateMatrixWorld(true);}
  data.legs.forEach((l,i)=>solveLimb(l,targets[i],forward.clone().lerp(up,prone).normalize(),frame.clone().multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),strides[i].pitch*effort*(1-prone)+prone*.7)).multiply(l.rotation)));
 }else{
  data.legs.forEach((l,i)=>{for(const [b,c,channel]of [[l.upper,l.knee,i*6],[l.knee,l.foot,i*6+3]] as const)point(b,c,b.getWorldPosition(v()).add(new T.Vector3().fromArray(row,channel).normalize().applyQuaternion(frame)));
   worldRotation(l.foot,frame.clone().multiply(l.rotation));
  });
 }
 // Anatomical elbow paths share the armored hero's mechanics while respecting
 // each model's real upper-arm/forearm lengths and authored relaxed wrist.
 data.arms.forEach((l,i)=>{
  const source=12+i*6,upperAngle=Math.atan2(row[source+2],-row[source+1]),lowerAngle=Math.atan2(row[source+5],-row[source+4]);
  const shoulder=T.MathUtils.clamp(upperAngle,-.55-.45*jog,.55+.40*jog)*effort;
  const elbow=T.MathUtils.lerp(.18,T.MathUtils.clamp(Math.atan2(Math.sin(lowerAngle-upperAngle),Math.cos(lowerAngle-upperAngle)),.13+.57*jog,.65+.95*jog),effort);
  const a=l.upper.getWorldPosition(v()),side=i===0?1:-1,bend=a.clone().addScaledVector(up,-l.upperLength*Math.cos(shoulder)).addScaledVector(forward,l.upperLength*Math.sin(shoulder)).addScaledVector(right,side*.015*scale);
  bend.sub(a).setLength(l.upperLength).add(a);
  const hand=bend.clone().addScaledVector(up,-l.lowerLength*Math.cos(shoulder+elbow)).addScaledVector(forward,l.lowerLength*Math.sin(shoulder+elbow));
  point(l.upper,l.knee,bend);point(l.knee,l.foot,hand);
  worldRotation(l.foot,l.foot.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(right,.035*effort*Math.sin(phase*tau+i*Math.PI-.25))));
 });
 if(mounted)h.bones.forEach((b,i)=>{const target=b.o.quaternion.clone(),position=b.o.position.clone();b.o.quaternion.copy(mounted[i].q).slerp(target,blend);b.o.position.copy(mounted[i].p).lerp(position,blend);});
 h.rider.position.y=h.mountHeight*(1-blend);h.root.updateMatrixWorld(true);
 h.vehicle.position.copy(h.lean.worldToLocal(new T.Vector3(p.parkX,p.parkY,p.parkZ)));h.vehicle.rotation.set(0,p.parkHeading-p.headingY,-.07*blend);h.root.updateMatrixWorld(true);
}

