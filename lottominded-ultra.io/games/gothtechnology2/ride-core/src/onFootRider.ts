import * as T from 'three';
import {DIRECTIONAL_MOTION} from './directionalMotionData.ts';
import {WHEEL_TRANSITIONS} from './wheelTransitionData.ts';
import {FootAnimation,gaitScale,movementDirection} from './footAnimation.ts';
import {TACTICAL_MOTION} from './tacticalMotionData.ts';
import {footGait,footBodyMotion} from './onFootGait.ts';
import {solveLimb} from './limbIK.ts';
import type {FootPose} from './onFoot.ts';
type Rig={riderId?:string;root:T.Object3D;ground:T.Object3D;lean:T.Object3D;rider:T.Object3D;vehicle:T.Object3D;mountHeight:number;motionScale:number;bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]};
type Binding={bone:T.Object3D;offset:T.Quaternion;channel:number};
type Leg={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;rest:T.Vector3;strideCenter:number;strideX:number;rotation:T.Quaternion;sole:T.Vector3[];length:number;upperLength:number;lowerLength:number};
type Arm={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;palm?:T.Object3D;upperLength:number;lowerLength:number};
type Fit={transition?:Record<string,number[][]>;animation:FootAnimation;body:Binding[];neck?:Binding;legs:Leg[];arms:Arm[];bottom:number;legLength:number;jumpAt:number;jump:number};
const rigs=new WeakMap<Rig,Fit>(),channels=[30,34,44,48,52,56,60,64],tau=Math.PI*2;
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
const quat=(row:number[],offset:number)=>q().fromArray(row,offset).normalize();
// Imported captures begin at different headings. Remove only that constant
// heading, retaining the small, non-uniform pelvis/chest rotations in the take.
const motionRows=Object.fromEntries(Object.entries(TACTICAL_MOTION).map(([name,clip])=>{
 if(!['walk','jog','run','idle'].includes(name))return[name,clip.samples];
 const rows=clip.samples.map(row=>row.slice()),count=rows.length-1;
 for(const offset of [30,34]){
  const heading=rows.slice(0,count).reduce((sum,row)=>sum+new T.Euler().setFromQuaternion(quat(row,offset),'YXZ').y,0)/count;
  for(const row of rows){const e=new T.Euler().setFromQuaternion(quat(row,offset),'YXZ');e.y-=heading;q().setFromEuler(e).toArray(row,offset);}
 }
 return[name,rows];
})) as Record<keyof typeof TACTICAL_MOTION,number[][]>;
function mix(a:number[],b:number[],t:number){const row=a.map((n,k)=>n+(b[k]-n)*t);for(const offset of channels)quat(a,offset).slerp(quat(b,offset),t).toArray(row,offset);return row;}
function sample(name:keyof typeof TACTICAL_MOTION,phase:number){const rows=motionRows[name],f=T.MathUtils.clamp(phase,0,1)*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1);return mix(rows[i],rows[j],f-i);}
const directionNames=['walk','ForwardLeft','Left','BackwardLeft','Backward','BackwardRight','Right','ForwardRight'] as const;
function directional(phase:number,angle:number){
 const n=((angle/(Math.PI/4))%8+8)%8,i=Math.floor(n),t=n-i;
 const at=(index:number)=>{const name=directionNames[index%8];if(name==='walk')return sample('walk',phase);
  const rows=DIRECTIONAL_MOTION[name].samples,f=phase*(rows.length-1),j=Math.floor(f);return mix(rows[j],rows[Math.min(j+1,rows.length-1)],f-j);};
 return mix(at(i),at(i+1),t);
}
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
  legs.push({upper,knee,foot,rest:position(side+'Foot'),strideCenter:position(side+'UpLeg').z,strideX:position(side+'UpLeg').x,rotation:inverse.clone().multiply(foot.getWorldQuaternion(q())),sole:[],upperLength:upper.getWorldPosition(v()).distanceTo(knee.getWorldPosition(v())),lowerLength:knee.getWorldPosition(v()).distanceTo(foot.getWorldPosition(v())),length:upper.getWorldPosition(v()).distanceTo(knee.getWorldPosition(v()))+knee.getWorldPosition(v()).distanceTo(foot.getWorldPosition(v()))});
  const a=bone(side+'Arm'),b=bone(side+'ForeArm'),c=bone(side+'Hand');
  arms.push({upper:a,knee:b,foot:c,palm:bone(side+'HandMiddle1'),upperLength:a.getWorldPosition(v()).distanceTo(b.getWorldPosition(v())),lowerLength:b.getWorldPosition(v()).distanceTo(c.getWorldPosition(v()))});
 }
 // Measure the real shoes once per model; do not scan vertices in the animation loop.
 h.rider.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;for(let i=0;i<m.geometry.attributes.position.count;i++){
  const vertex=h.root.worldToLocal(m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld));
  if(vertex.y>bottom+.12*Math.max(.45,h.motionScale))continue;
  const l=legs.reduce((a,b)=>Math.abs(vertex.x-a.rest.x)<Math.abs(vertex.x-b.rest.x)?a:b);l.sole.push(vertex.sub(l.rest));
 }});
 for(const l of legs)if(!l.sole.length)l.sole.push(new T.Vector3(0,-.05,0));
 // Pedal spacing is a riding stance, not a walking track. Bring the feet
 // beneath the pelvis while retaining clearance for the mascots' wide shoes.
 const center=(legs[0].strideX+legs[1].strideX)/2;
 const shoeClearance=(legs[0].sole.reduce((m,s)=>Math.max(m,-s.x),0)+legs[1].sole.reduce((m,s)=>Math.max(m,s.x),0))*.5+.008;
 for(const l of legs){const side=Math.sign(l.rest.x-center)||1;
  const halfWidth=Math.min(Math.abs(l.rest.x-center),Math.max(Math.abs(l.strideX-center)*.80,shoeClearance));
  l.strideX=center+side*halfWidth;
 }
 const neckName=bone('neck')?'neck':bone('Neck')?'Neck':undefined;
 let riderId=h.riderId;
 if(!riderId)h.rider.traverse(o=>{if(riderId)return;const mesh=o as T.Mesh;
  const names=[o.name,...(mesh.isMesh?(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name):[])];
  riderId=Object.keys(WHEEL_TRANSITIONS).find(id=>names.some(n=>n.startsWith(id)));
 });
 return{transition:riderId?WHEEL_TRANSITIONS[riderId]:undefined,animation:new FootAnimation(),body,legs,arms,bottom,legLength:(legs[0].length+legs[1].length)/2,neck:neckName?bind(neckName,chestFrame,0):undefined,jumpAt:0,jump:0};
}
/** Existing TacticalOnFoot clips drive body and limb timing.
 * Contact IK fits the captured pose to each hero without changing bone lengths. */
export function applyOnFootRider(h:Rig,pose:Partial<FootPose>&{crashBlend?:number;bodyChestRoll?:number;bodyTwist?:number;bodyPitch?:number}){
 if(!(pose.footBlend!>0||pose.footMode!>0)||(pose.crashBlend||0)>0)return;
 const p=pose as FootPose,blend=T.MathUtils.clamp(p.footBlend,0,1);
 const mounted=blend<1?h.bones.map(b=>({q:b.o.quaternion.clone(),p:b.o.position.clone()})):undefined;
 h.ground.position.y=0;h.ground.rotation.set(0,0,0);h.lean.rotation.set(0,0,0);h.rider.rotation.set(0,0,0);h.rider.position.set(0,0,0);
 for(const b of h.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}h.root.updateMatrixWorld(true);
 let data=rigs.get(h);if(!data){data=fit(h);rigs.set(h,data);}
 data.animation.update(p);
 const scale=Math.max(.2,data.legLength/.9),speed=Math.abs(p.speed),cadence=gaitScale(data.legLength);
 const turning=speed<.1?Math.min(1,Math.abs(data.animation.turn)/1.5):0;
 const cycle=(((p.footCycle||p.footPhase)/cadence+data.animation.turnCycle)%1+1)%1,phase=cycle;
 const direction=movementDirection(p),lateral=Math.sin(direction),longitudinal=Math.cos(direction);
 let name:keyof typeof TACTICAL_MOTION=speed<.08?'idle':speed>3.2?'run':speed>2.5?'jog':'walk';
 let clipPhase=name==='idle'?(p.footTime/TACTICAL_MOTION.idle.duration)%1:phase;
 if(p.footJump!==data.jump){data.jump=p.footJump;data.jumpAt=p.footTime;}
 if(p.footJump){name=p.footJump===1?'takeoff':p.footJump===2?'air':'land';clipPhase=Math.min(1,(p.footTime-data.jumpAt)/TACTICAL_MOTION[name].duration);}
 let row=sample(name,clipPhase);
 if(!p.footJump){
  row=mix(sample('idle',(p.footTime/TACTICAL_MOTION.idle.duration)%1),directional(phase,turning>.05?Math.sign(data.animation.turn)*Math.PI/2:direction),Math.max(turning*.5,T.MathUtils.smoothstep(speed,0,.85)));
  row=mix(row,sample('jog',phase),T.MathUtils.smoothstep(speed,2.5,3.6)*Math.max(0,longitudinal));row=mix(row,sample('run',phase),T.MathUtils.smoothstep(speed,3.6,5.4)*Math.max(0,longitudinal));
 }
 const frame=h.root.getWorldQuaternion(q()),forward=new T.Vector3(0,0,1).applyQuaternion(frame),right=new T.Vector3(1,0,0).applyQuaternion(frame),up=new T.Vector3(0,1,0);
 const motion=footBodyMotion(phase,p.speed);
 const upright=(source:T.Quaternion,chest=false)=>{
  const e=new T.Euler().setFromQuaternion(source,'YXZ');
  // Preserve capture timing and follow-through instead of flattening the
  // torso and driving both arms with the same mirrored sine wave.
  e.x*=chest?.65:.8;e.y*=chest?.68:.85;e.z*=chest?.65:.85;
  return q().setFromEuler(e);
 };
 const crouch=T.MathUtils.clamp(p.footCrouch||0,0,1),prone=T.MathUtils.clamp(p.footProne||0,0,1);
 const stagger=T.MathUtils.clamp(p.footStagger||0,0,1),inertia=data.animation.acceleration*.010*(1-prone);
 const evade=Math.max(0,Math.min(1,(Math.hypot(p.velocityX||0,p.velocityZ||0)-speed-1)/4));
 const posture=q().setFromEuler(new T.Euler(prone*Math.PI/2+crouch*.16+stagger*.18+inertia,0,-lateral*evade*.12,'YXZ'));
 const hipFrame=(p.footJump?quat(row,30):upright(quat(row,30))).premultiply(posture),chestFrame=(p.footJump?quat(row,34):upright(quat(row,34),true)).premultiply(posture);
 for(const b of data.body)worldRotation(b.bone,frame.clone().multiply(hipFrame.clone().slerp(chestFrame,b.channel/3)).multiply(b.offset));
 if(data.neck)worldRotation(data.neck.bone,frame.clone().multiply(posture.clone().slerp(chestFrame,.22)).multiply(data.neck.offset));
 if(data.neck&&prone>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(right,-.9*prone)));
 // Clavicles follow the captured chest; the arm socket must not be pinned to
 // a world-horizontal line while the rib cage rotates beneath it.
 for(const [i,side] of ['Left','Right'].entries()){
  const collar=h.rider.getObjectByName(side+'Shoulder'),arm=h.rider.getObjectByName(side+'Arm');
  if(collar&&arm){const target=new T.Vector3().fromArray(row,38+i*3);
   target.z*=.55;target.y=T.MathUtils.clamp(target.y,-.10,.10);target.normalize().applyQuaternion(frame);
   point(collar,arm,collar.getWorldPosition(v()).add(target));
  }
 }
 const effort=Math.max(turning*.5,T.MathUtils.smoothstep(speed,0,.85)),jog=T.MathUtils.smoothstep(speed,2.5,4.1),hips=data.body[0].bone,hip=hips.getWorldPosition(v());
 hip.addScaledVector(up,-data.bottom+(motion.bob-.05*effort*(1-jog))*scale*(1-prone)-.30*scale*crouch-.09*scale*stagger-.08*scale*evade);
 hip.addScaledVector(right,motion.weight*scale*(1-prone)*(1-crouch*.5));
 hip.y=T.MathUtils.lerp(hip.y,h.root.getWorldPosition(v()).y+.26*scale+(h.motionScale<.7?.13:.03),prone);hip.addScaledVector(forward,-.30*scale*prone);
 hips.position.copy(hips.parent!.worldToLocal(hip));h.root.updateMatrixWorld(true);
 if(!p.footJump||p.footJump===3){
  const strides=data.legs.map((_,i)=>footGait(cycle+i*.5,Math.max(speed,turning),data!.legLength));
  // Oversized mascot soles need less roll to keep the short-legged pelvis level.
  for(const stride of strides)stride.pitch*=Math.min(1,scale);
  const targets=data.legs.map((l,i)=>{
   const stride=strides[i],pitch=stride.pitch*effort*(1-prone)+prone*.7,floor=Math.min(...l.sole.map(s=>s.y*Math.cos(pitch)-s.z*Math.sin(pitch))),target=l.rest.clone();
   // The mounting bind pose has feet forward of the hips. Walking around
   // that offset over-reached one leg and repeatedly pulled the pelvis down.
   target.x=T.MathUtils.lerp(l.rest.x,l.strideX,effort*(1-prone))+stride.z*effort*lateral*(1-crouch*.45);
   target.z=T.MathUtils.lerp(l.rest.z,l.strideCenter,effort)+stride.z*effort*longitudinal*(1-crouch*.45);target.y=-floor+stride.lift*effort+.006;
   target.z=T.MathUtils.lerp(target.z,(-.90+Math.sin((phase+i*.5)*tau)*.14*effort)*scale,prone);target.y=-floor+stride.lift*effort*(1-prone)+.006;
   return h.root.localToWorld(target);
  });
  // Retarget the pack's thigh/shin directions, not a generated walking pose.
  // The captured pose is fitted onto the real shoe soles and each hero's reach.
  const captureWeight=effort*(1-prone)*(1-crouch)*(p.footJump?0:1);
  if(captureWeight>0){
   const captured=data.legs.map((l,i)=>{
    const a=l.upper.getWorldPosition(v());
    const t=a.clone().addScaledVector(new T.Vector3().fromArray(row,i*6).normalize().applyQuaternion(frame),l.upperLength)
     .addScaledVector(new T.Vector3().fromArray(row,i*6+3).normalize().applyQuaternion(frame),l.lowerLength);
    const local=h.root.worldToLocal(t);local.x=l.strideX+(local.x-h.root.worldToLocal(a.clone()).x)*Math.abs(lateral);return h.root.localToWorld(local);
   });
   const floor=Math.min(...captured.map((t,i)=>t.y+Math.min(...data!.legs[i].sole.map(s=>s.y*Math.cos(strides[i].pitch)-s.z*Math.sin(strides[i].pitch)))))-h.root.getWorldPosition(v()).y-.006;
   const pos=hips.getWorldPosition(v());pos.y-=floor*captureWeight;hips.position.copy(hips.parent!.worldToLocal(pos));h.root.updateMatrixWorld(true);
   captured.forEach((t,i)=>{t.y-=floor;targets[i].lerp(t,captureWeight);});
  }
  let lower=0;data.legs.forEach((l,i)=>{const a=l.upper.getWorldPosition(v()),t=targets[i],reach=l.length*.985;
   const required=a.y-t.y-Math.sqrt(Math.max(.000001,reach*reach-(a.x-t.x)**2-(a.z-t.z)**2));
   // Smooth maximum stays above both reach constraints, avoiding a hard
   // pelvis velocity change when support transfers from one foot to the other.
   lower=(lower+required+Math.hypot(lower-required,.035*scale))*.5;
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

  let shoulder=p.footJump?T.MathUtils.clamp(upperAngle,-.55-.45*jog,.55+.40*jog)*effort:
   T.MathUtils.lerp(upperAngle,-.15,crouch*.4)*(1-prone);
  const elbow=T.MathUtils.lerp(.18,T.MathUtils.clamp(Math.atan2(Math.sin(lowerAngle-upperAngle),Math.cos(lowerAngle-upperAngle)),.13+.57*jog,.65+.95*jog),effort);
  const capturedFlex=Math.atan2(Math.sin(lowerAngle-upperAngle),Math.cos(lowerAngle-upperAngle));
  let relaxedElbow=p.footJump?elbow:T.MathUtils.clamp(capturedFlex,.18,1.32)+crouch*.30;
  // Short mascot limbs need room around the jacket and a relaxed elbow, not
  // the adult capture's deep curl. Retain its timing and counter-swing.
  const mascot=h.motionScale<.7,standing=(1-prone)*(1-crouch)*(p.footJump?0:1);
  if(mascot){
   shoulder+=standing*effort*(upperAngle*.30-.08);
   relaxedElbow=T.MathUtils.lerp(relaxedElbow,.22+.16*jog+T.MathUtils.clamp(capturedFlex,0,1.32)*.32,standing);
  }
  const upperSpread=mascot?.28:.0,lowerSpread=mascot?.18:0;
  const a=l.upper.getWorldPosition(v()),side=i===0?1:-1,bend=a.clone().addScaledVector(up,-l.upperLength*Math.cos(shoulder)*Math.cos(upperSpread)).addScaledVector(forward,l.upperLength*Math.sin(shoulder)*Math.cos(upperSpread)).addScaledVector(right,side*(mascot?l.upperLength*Math.sin(upperSpread):(.035+.02*effort)*scale));
  bend.sub(a).setLength(l.upperLength).add(a);
  const hand=bend.clone().addScaledVector(up,-l.lowerLength*Math.cos(shoulder+relaxedElbow)*Math.cos(lowerSpread)).addScaledVector(forward,l.lowerLength*Math.sin(shoulder+relaxedElbow)*Math.cos(lowerSpread)).addScaledVector(right,side*l.lowerLength*Math.sin(lowerSpread));
  point(l.upper,l.knee,bend);point(l.knee,l.foot,hand);
  const wrist=.035*effort*Math.sin(phase*tau+i*Math.PI-.45)*(1-prone);
  let handFrame=l.foot.getWorldQuaternion(q());
  if(l.palm&&!p.footJump&&effort>0&&prone<1){
   const wristPosition=l.foot.getWorldPosition(v()),palmAxis=l.palm.getWorldPosition(v()).sub(wristPosition);
   const forearm=wristPosition.clone().sub(l.knee.getWorldPosition(v())).normalize().applyAxisAngle(right,.10+wrist);
   if(palmAxis.lengthSq()>1e-8){const neutral=handFrame.clone().premultiply(q().setFromUnitVectors(palmAxis.normalize(),forearm));handFrame.slerp(neutral,effort*(1-prone));}
  }else handFrame.premultiply(q().setFromAxisAngle(right,wrist));
  worldRotation(l.foot,handFrame);
  if(prone>0){
   const crawl=Math.sin((phase+i*.5)*tau)*effort;
   const target=h.root.localToWorld(new T.Vector3(side*(.24+.05*crawl)*scale,.06+.06*scale,(.58+.13*crawl)*scale));
   solveLimb(l,l.foot.getWorldPosition(v()).lerp(target,prone),right.clone().multiplyScalar(side).addScaledVector(forward,-.3),frame.clone().multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2)));
  }
 });
 // Combat flinches must survive the locomotion mask, including when on foot.
 for(const b of data.body.slice(1)){
  const additive=q().setFromEuler(new T.Euler((pose.bodyPitch||0)*.16,(pose.bodyTwist||0)/3,(pose.bodyChestRoll||0)/3));
  b.bone.quaternion.multiply(additive);b.bone.updateWorldMatrix(false,true);
 }
 if(mounted)h.bones.forEach((b,i)=>{const target=b.o.quaternion.clone(),position=b.o.position.clone();b.o.quaternion.copy(mounted[i].q).slerp(target,blend);b.o.position.copy(mounted[i].p).lerp(position,blend);});
 // Use the authored wheel-handling rotations during the step-off/step-on.
 // The controller still owns the parking position and transition duration.
 const transition=data.transition;
 if(transition&&(p.footMode===1||p.footMode===3)){
  const phase=blend*(25-1),index=Math.floor(phase),weight=Math.sin(blend*Math.PI)**2*.72;
  for(const b of h.bones){const rows=transition[b.o.name];if(rows){const target=q().fromArray(rows[index]).slerp(q().fromArray(rows[Math.min(index+1,24)]),phase-index);b.o.quaternion.slerp(target,weight);}}
 }
 h.rider.position.y=h.mountHeight*(1-blend);h.root.updateMatrixWorld(true);
 if(p.footMode===1||p.footMode===3){
  const soleFloor=Math.min(...data.legs.map(l=>l.foot.getWorldPosition(v()).y+Math.min(...l.sole.map(s=>s.y))))-h.root.getWorldPosition(v()).y;
  const plant=T.MathUtils.smoothstep(blend,.12,.55);
  h.rider.position.y-=soleFloor*plant;h.root.updateMatrixWorld(true);
 }
 h.vehicle.position.copy(h.lean.worldToLocal(new T.Vector3(p.parkX,p.parkY,p.parkZ)));h.vehicle.rotation.set(0,p.parkHeading-p.headingY,-.07*blend);h.root.updateMatrixWorld(true);
}

