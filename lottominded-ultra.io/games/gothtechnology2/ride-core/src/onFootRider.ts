import {sampleKimodoEvade,KIMODO_EVADE} from './kimodoEvade.ts';
import {standingIdle} from './heroActions.ts';
import {sampleUserAction,userFoot} from './userActions.ts';
import {sampleTacticalWalk,tacticalFoot,TACTICAL_WALK} from './tacticalWalk.ts';
import {sampleKimodoWalk,kimodoWalkFoot,KIMODO_WALK} from './kimodoWalk.ts';
import {sampleAthletic,sampleSmoothSprint,blendAthletic,athleticFoot,KIMODO_ATHLETIC} from './kimodoAthletic.ts';
import {KIMODO_RIDING} from './kimodoRidingData.ts';
import * as T from 'three';
import {DIRECTIONAL_MOTION} from './directionalMotionData.ts';
import {TURN_MOTION} from './turnMotionData.ts';
import {LOW_STANCE_MOTION} from './lowStanceMotionData.ts';
import {FootAnimation,gaitScale,crawlReach} from './footAnimation.ts';
import {TACTICAL_MOTION} from './tacticalMotionData.ts';
import {footGait,sprintGait,footBodyMotion} from './onFootGait.ts';
import {solveLimb} from './limbIK.ts';
import {WHEEL_PICKUP} from './wheelPickupData.ts';
import {wheelPickupTiming} from './wheelPickupTiming.ts';
import {KIMODO_WHEEL} from './kimodoWheelData.ts';
import type {FootPose} from './onFoot.ts';
type Rig={walkStyle?:'tactical'|'kimodo';riderId?:string;root:T.Object3D;ground:T.Object3D;lean:T.Object3D;rider:T.Object3D;vehicle:T.Object3D;mountHeight:number;motionScale:number;bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]};
type Binding={bone:T.Object3D;offset:T.Quaternion;channel:number};
type Leg={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;rest:T.Vector3;strideCenter:number;strideX:number;rotation:T.Quaternion;sole:T.Vector3[];length:number;upperLength:number;lowerLength:number};
type Arm={upper:T.Object3D;knee:T.Object3D;foot:T.Object3D;palm?:T.Object3D;upperLength:number;lowerLength:number};
type Fit={wheelHandle?:T.Vector3;animation:FootAnimation;body:Binding[];neck?:Binding;legs:Leg[];arms:Arm[];bottom:number;legLength:number;jumpAt:number;jump:number;row?:number[];jumpFrom?:number[];lastTime?:number};
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
function lowStance(name:keyof typeof LOW_STANCE_MOTION,phase:number){
 const rows=LOW_STANCE_MOTION[name].samples,f=((phase%1+1)%1)*(rows.length-1),i=Math.floor(f);
 return rows[i].map((n,k)=>T.MathUtils.lerp(n,rows[i+1][k],f-i));
}
function turnMotion(phase:number,left:boolean){
 const rows=TURN_MOTION[left?'Left':'Right'].samples,f=phase*(rows.length-1),i=Math.floor(f);
 return mix(rows[i],rows[Math.min(i+1,rows.length-1)],f-i);
}
const directionNames=['walk','ForwardLeft','Left','BackwardLeft','Backward','BackwardRight','Right','ForwardRight'] as const;
function directional(phase:number,angle:number){
 const n=((angle/(Math.PI/4))%8+8)%8,i=Math.floor(n),t=n-i;
 const at=(index:number)=>{const name=directionNames[index%8];if(name==='walk')return sample('walk',phase);
  const rows=DIRECTIONAL_MOTION[name].samples,f=phase*(rows.length-1),j=Math.floor(f);return mix(rows[j],rows[Math.min(j+1,rows.length-1)],f-j);};
 return mix(at(i),at(i+1),t);
}
function basis(x:T.Vector3,y:T.Vector3){y.normalize();x.addScaledVector(y,-x.dot(y)).normalize();return q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,x.clone().cross(y).normalize()));}
// Each following world query refreshes its own ancestor path; the pose's
// explicit root updates publish all descendants after the rotations settle.
function worldRotation(bone:T.Object3D,world:T.Quaternion){bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,false);}
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
 return{animation:new FootAnimation(),body,legs,arms,bottom,legLength:(legs[0].length+legs[1].length)/2,neck:neckName?bind(neckName,chestFrame,0):undefined,jumpAt:0,jump:0};
}
function standingBindPose(h:Rig){
 h.ground.position.y=0;h.ground.rotation.set(0,0,0);h.lean.rotation.set(0,0,0);h.rider.rotation.set(0,0,0);h.rider.position.set(0,0,0);
 for(const b of h.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}h.root.updateMatrixWorld(true);
}
/** Cache measurements without advancing gait history or changing the current pose. */
export function prepareOnFootRider(h:Rig){
 if(rigs.has(h))return;
 const nodes=new Set([h.ground,h.lean,h.rider,...h.bones.map(b=>b.o)]);
 const saved=[...nodes].map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
 try{standingBindPose(h);rigs.set(h,fit(h));}
 finally{for(const {o,p,q}of saved){o.position.copy(p);o.quaternion.copy(q);}h.root.updateMatrixWorld(true);}
}
/** Existing TacticalOnFoot clips drive body and limb timing.
 * Contact IK fits the captured pose to each hero without changing bone lengths. */
export function applyOnFootRider(h:Rig,pose:Partial<FootPose>&{crashBlend?:number;bodyChestRoll?:number;bodyTwist?:number;bodyPitch?:number}){
 if(!(pose.footBlend!>0||pose.footMode!>0)||(pose.crashBlend||0)>0)return;
 const p=pose as FootPose,blend=T.MathUtils.clamp(p.footBlend,0,1);
 const mounted=blend<1?h.bones.map(b=>({q:b.o.quaternion.clone(),p:b.o.position.clone()})):undefined;
 standingBindPose(h);
 let data=rigs.get(h);if(!data){data=fit(h);rigs.set(h,data);}
 data.animation.update(p);
 const scale=Math.max(.2,data.legLength/.9),speed=data.animation.pace,cadence=gaitScale(data.legLength);
 const turning=speed<.1?Math.min(1,Math.abs(data.animation.turn)/1.5):0;
 const cycle=(((p.footCycle||p.footPhase)/cadence+data.animation.turnCycle)%1+1)%1,phase=cycle;
 const direction=data.animation.direction,lateral=Math.sin(direction),longitudinal=Math.cos(direction);
 let name:keyof typeof TACTICAL_MOTION=speed<.08?'idle':speed>3.2?'run':speed>2.5?'jog':'walk';
 let clipPhase=name==='idle'?(p.footTime/TACTICAL_MOTION.idle.duration)%1:phase;
 // Crossfade the captured upper body at takeoff, apex, landing and return to
 // locomotion. Reset history on a replay seek or a new actor timeline.
 if(data.lastTime!==undefined&&(p.footTime<data.lastTime||p.footTime-data.lastTime>.25)){data.row=data.jumpFrom=undefined;}
 if(p.footJump!==data.jump){data.jumpFrom=data.row;data.jump=p.footJump;data.jumpAt=p.footTime;}
 data.lastTime=p.footTime;
 if(p.footJump){name=p.footJump===1?'takeoff':p.footJump===2?'air':'land';clipPhase=Math.min(1,(p.footTime-data.jumpAt)/TACTICAL_MOTION[name].duration);}
 let row=sample(name,clipPhase);
 // Retreat plays the same forward take backwards in time; do not mirror its limbs.
 const walkPhase=longitudinal<0?-phase:phase;
 const useKimodo=h.walkStyle==='kimodo',walkReference=useKimodo?KIMODO_WALK:TACTICAL_WALK;
 const tactical=useKimodo?sampleKimodoWalk(walkPhase):sampleTacticalWalk(walkPhase),walkWeight=(longitudinal<0?1:1-T.MathUtils.smoothstep(speed,2.5,3.6))*Math.abs(longitudinal)*(1-turning)*(1-T.MathUtils.clamp(p.footProne||0,0,1))*(1-T.MathUtils.clamp(p.footCrouch||0,0,1));
 if(!p.footJump){
  row=mix(sample('idle',(p.footTime/TACTICAL_MOTION.idle.duration)%1),turning>.05?turnMotion(phase,data.animation.turn>0):directional(phase,direction),Math.max(turning*.5,T.MathUtils.smoothstep(speed,0,.85)));
  for(let i=0;i<24;i++)row[i]=T.MathUtils.lerp(row[i],tactical[i],walkWeight*T.MathUtils.smoothstep(speed,0,.85));
  row=mix(row,sample('jog',phase),T.MathUtils.smoothstep(speed,2.5,3.6)*Math.max(0,longitudinal));row=mix(row,sample('run',phase),T.MathUtils.smoothstep(speed,3.6,5.4)*Math.max(0,longitudinal));
 }
 const actionName=speed>3.2?'sprint_loop':'crouch_fwd_loop';
 const actionRow=sampleUserAction(actionName,phase);
 const actionWeight=(p.footJump?0:1)*(1-T.MathUtils.clamp(p.footProne||0,0,1))*T.MathUtils.smoothstep(speed,0,.85)*Math.max(0,longitudinal)*(speed>3.2?T.MathUtils.smoothstep(speed,3.2,5.4)*(1-T.MathUtils.clamp(p.footCrouch||0,0,1)):T.MathUtils.clamp(p.footCrouch||0,0,1));
 for(let i=0;i<24;i++)row[i]=T.MathUtils.lerp(row[i],actionRow[i],actionWeight);
 const crouch=T.MathUtils.clamp(p.footCrouch||0,0,1),prone=T.MathUtils.clamp(p.footProne||0,0,1);
 const actionMask=(p.footJump||p.footMode!==2?0:1)*(1-prone);
 // Restore the upright walk/jog/run blend from release 9530b779.
 const sprintWeight:number=0;
 const crouchWeight=crouch*actionMask,athleticWeight=Math.max(sprintWeight,crouchWeight);
 const duck=sampleAthletic('duck',crouch),low=sampleAthletic('crouch_walk',walkPhase);
 const lowMove=T.MathUtils.smoothstep(speed,0,.8)*Math.abs(longitudinal);
 const lowRow=blendAthletic(duck,low,lowMove);
 const athletic=blendAthletic(sampleSmoothSprint(phase),lowRow,crouchWeight/Math.max(.00001,sprintWeight+crouchWeight));
 for(let i=0;i<24;i++)row[i]=T.MathUtils.lerp(row[i],athletic[i],athleticWeight);
 if(data.jumpFrom){const t=T.MathUtils.smoothstep(p.footTime-data.jumpAt,0,.12);row=mix(data.jumpFrom,row,t);if(t>=1)data.jumpFrom=undefined;}
 data.row=row;
 const frame=h.root.getWorldQuaternion(q()),forward=new T.Vector3(0,0,1).applyQuaternion(frame),right=new T.Vector3(1,0,0).applyQuaternion(frame),up=new T.Vector3(0,1,0);
 const motion=footBodyMotion(phase,p.speed);
 const idle=standingIdle(p.footTime),idleWeight=(1-T.MathUtils.smoothstep(speed,0,.35))*(1-turning)*(p.footJump||p.footMode!==2?0:1)*(1-(p.footCrouch||0))*(1-(p.footProne||0));
 motion.bob+=idle[1]*idleWeight;motion.weight+=idle[0]*idleWeight;
 const tacticalWeight=walkWeight*T.MathUtils.smoothstep(speed,0,.85)*(p.footJump||p.footMode!==2?0:1);
 // Retain the selected capture's weight transfer, fitted to each hero.
 motion.bob=T.MathUtils.lerp(motion.bob,tactical[45]*.9/walkReference.legLength,tacticalWeight);
 motion.weight=T.MathUtils.lerp(motion.weight,tactical[44]*.9/walkReference.legLength,tacticalWeight);
 const athleticScale=data.legLength/KIMODO_ATHLETIC.clips.sprint.legLength;
 motion.bob=T.MathUtils.lerp(motion.bob,athletic[45]*.32*.9/KIMODO_ATHLETIC.clips.sprint.legLength,sprintWeight);
 motion.weight=T.MathUtils.lerp(motion.weight,athletic[44]*.9/KIMODO_ATHLETIC.clips.sprint.legLength,sprintWeight);
 const upright=(source:T.Quaternion,chest=false)=>{
  const e=new T.Euler().setFromQuaternion(source,'YXZ');
  // Preserve capture timing and follow-through instead of flattening the
  // torso and driving both arms with the same mirrored sine wave.
  e.x*=chest?.65:.8;e.y*=chest?.68:.85;e.z*=chest?.65:.85;
  return q().setFromEuler(e);
 };
 const stagger=T.MathUtils.clamp(p.footStagger||0,0,1),inertia=data.animation.acceleration*.010*(1-prone);
 const evade=Math.max(0,Math.min(1,(Math.hypot(p.velocityX||0,p.velocityZ||0)-speed-1)/4));
 const posture=q().setFromEuler(new T.Euler(prone*Math.PI/2+crouch*.16+stagger*.18+inertia,0,-lateral*evade*.12,'YXZ'));
 const hipFrame=(p.footJump?quat(row,30):upright(quat(row,30))).premultiply(posture),chestFrame=(p.footJump?quat(row,34):upright(quat(row,34),true)).premultiply(posture);
 hipFrame.slerp(q().setFromEuler(new T.Euler(idle[2]*.25,0,-idle[0]*.4)),idleWeight);
 chestFrame.slerp(q().setFromEuler(new T.Euler(idle[2],idle[3],idle[0]*.35)),idleWeight);
 hipFrame.slerp(quat(tactical,30),tacticalWeight);chestFrame.slerp(quat(tactical,34),tacticalWeight);
 hipFrame.slerp(quat(athletic,30),athleticWeight);chestFrame.slerp(quat(athletic,34),athleticWeight);
 for(const b of data.body)worldRotation(b.bone,frame.clone().multiply(hipFrame.clone().slerp(chestFrame,b.channel/3)).multiply(b.offset));
 if(data.neck)worldRotation(data.neck.bone,frame.clone().multiply(posture.clone().slerp(chestFrame,.22)).multiply(data.neck.offset));
 if(useKimodo&&data.neck&&tacticalWeight>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(quat(tactical,47)).multiply(data.neck.offset),tacticalWeight));
 if(data.neck&&athleticWeight>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(quat(athletic,47)).multiply(data.neck.offset),athleticWeight));
 if(data.neck&&idleWeight>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(up,idle[4]*idleWeight)));
 if(data.neck&&prone>0)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).premultiply(q().setFromAxisAngle(right,-.9*prone)));
 // Clavicles follow the captured chest; the arm socket must not be pinned to
 // a world-horizontal line while the rib cage rotates beneath it.
 for(const [i,side] of ['Left','Right'].entries()){
  const collar=h.rider.getObjectByName(side+'Shoulder'),arm=h.rider.getObjectByName(side+'Arm');
  if(collar&&arm){const target=new T.Vector3().fromArray(row,38+i*3).lerp(new T.Vector3().fromArray(tactical,38+i*3),tacticalWeight);
   target.lerp(new T.Vector3().fromArray(athletic,38+i*3),athleticWeight);
   target.z*=T.MathUtils.lerp(.55,1,tacticalWeight);target.y=T.MathUtils.lerp(T.MathUtils.clamp(target.y,-.10,.10),target.y,tacticalWeight);target.normalize().applyQuaternion(frame);
   point(collar,arm,collar.getWorldPosition(v()).add(target));
  }
 }
 const effort=Math.max(turning*.5,T.MathUtils.smoothstep(speed,0,.85)),jog=T.MathUtils.smoothstep(speed,2.5,4.1),hips=data.body[0].bone,hip=hips.getWorldPosition(v());
 hip.addScaledVector(up,-data.bottom+(motion.bob-.05*effort*(1-jog)*(1-tacticalWeight))*scale*(1-prone)-.30*scale*crouch-.09*scale*stagger-.08*scale*evade);
 hip.y-=.075*scale*sprintWeight;
 hip.addScaledVector(right,motion.weight*scale*(1-prone)*(1-crouch*.5));
 hip.y=T.MathUtils.lerp(hip.y,h.root.getWorldPosition(v()).y+.26*scale+(h.motionScale<.7?.13:.03),prone);hip.addScaledVector(forward,-.30*scale*prone);
 hip.addScaledVector(forward,tactical[46]*data.legLength/walkReference.legLength*tacticalWeight);
 // The stationary descent can reverse at any point. Moving low stance uses
 // the crouch capture's mean hip height and its subtle weight transfer.
 if(crouchWeight>0){
  const drop=T.MathUtils.lerp(duck[45],KIMODO_ATHLETIC.clips.crouch_walk.meanRootHeight-.995+low[45]*.35,lowMove*crouch);
  hip.y+=.30*scale*crouch+drop*athleticScale*actionMask;
  hip.addScaledVector(forward,T.MathUtils.lerp(duck[46],-.10,lowMove)*athleticScale*crouchWeight);
 }
 hips.position.copy(hips.parent!.worldToLocal(hip));h.root.updateMatrixWorld(true);
 if(!p.footJump||p.footJump===3){
  const strides=data.legs.map((_,i)=>{
   const stride=footGait(cycle+i*.5,Math.max(speed,turning),data!.legLength),clip=lowStance('crouch',cycle+i*.5);
   const captured=useKimodo?kimodoWalkFoot(tactical,i,data!.legLength):tacticalFoot(tactical,i,data!.legLength);
   stride.z=T.MathUtils.lerp(stride.z,captured.z,walkWeight);stride.lift=T.MathUtils.lerp(stride.lift,captured.lift,walkWeight);stride.pitch=T.MathUtils.lerp(stride.pitch,captured.pitch,walkWeight);
   stride.z=T.MathUtils.lerp(stride.z,clip[0]*scale,crouch);
   stride.lift=T.MathUtils.lerp(stride.lift,clip[1]*scale,crouch);
   stride.pitch=T.MathUtils.lerp(stride.pitch,clip[2],crouch);
   const user=userFoot(actionName,actionRow,i,data!.legLength);
   stride.z=T.MathUtils.lerp(stride.z,user.z,actionWeight);stride.lift=T.MathUtils.lerp(stride.lift,user.lift,actionWeight);stride.pitch=T.MathUtils.lerp(stride.pitch,user.pitch,actionWeight);
   const fresh=athleticFoot(athletic,i,data!.legLength);
   stride.z=T.MathUtils.lerp(stride.z,fresh.z,athleticWeight);stride.lift=T.MathUtils.lerp(stride.lift,fresh.lift,athleticWeight);stride.pitch=T.MathUtils.lerp(stride.pitch,fresh.pitch,athleticWeight);
   // Ground-matched sprint contacts let the knees absorb each landing. The
   // captured torso/arms remain; adult ankle reach must not drag the pelvis.
   const run=sprintGait(cycle+i*.5,speed,data!.legLength);
   stride.z=T.MathUtils.lerp(stride.z,run.z,sprintWeight);stride.lift=T.MathUtils.lerp(stride.lift,run.lift,sprintWeight);stride.pitch=T.MathUtils.lerp(stride.pitch,run.pitch,sprintWeight);return stride;
  });
  // Oversized mascot soles need less roll to keep the short-legged pelvis level.
  for(const stride of strides)stride.pitch*=Math.min(1,scale);
  const targets=data.legs.map((l,i)=>{
   const stride=strides[i],pitch=stride.pitch*effort*(1-prone)+prone*.7,floor=Math.min(...l.sole.map(s=>s.y*Math.cos(pitch)-s.z*Math.sin(pitch))),target=l.rest.clone();
   // The mounting bind pose has feet forward of the hips. Walking around
   // that offset over-reached one leg and repeatedly pulled the pelvis down.
   target.x=T.MathUtils.lerp(l.rest.x,l.strideX,effort*(1-prone))+stride.z*effort*lateral*(1-crouch*.45);
   target.z=T.MathUtils.lerp(l.rest.z,l.strideCenter,effort)+stride.z*effort*longitudinal*(1-crouch*.45);target.y=-floor+stride.lift*effort+.006;
   const crawl=lowStance('crawl',phase+i*.5);
   const reach=crawlReach(l.rest.x,-.90*scale,(crawl[0]+.90)*effort*scale,direction);
   target.x=T.MathUtils.lerp(target.x,reach.x,prone);target.z=T.MathUtils.lerp(target.z,reach.z,prone);target.y=-floor+T.MathUtils.lerp(stride.lift,crawl[1]*scale,prone)*effort+.006;
   target.x+=lateral*evade*.14*scale*(1-prone);
   target.z+=(i===0?-.16:.08)*stagger*scale*(1-prone);
   if((i===0)===(lateral>0))target.y+=evade*.045*scale*(1-prone);
   return h.root.localToWorld(target);
  });
  // Retarget the pack's thigh/shin directions, not a generated walking pose.
  // The captured pose is fitted onto the real shoe soles and each hero's reach.
  const captureWeight=effort*(1-prone)*(1-crouch)*(1-sprintWeight)*(p.footJump?0:1)*(useKimodo&&h.motionScale<.7?1-.2*walkWeight:1);
  if(captureWeight>0){
   const captured=data.legs.map((l,i)=>{
    const a=l.upper.getWorldPosition(v());
    const t=a.clone().addScaledVector(new T.Vector3().fromArray(row,i*6).normalize().applyQuaternion(frame),l.upperLength)
     .addScaledVector(new T.Vector3().fromArray(row,i*6+3).normalize().applyQuaternion(frame),l.lowerLength);
    const local=h.root.worldToLocal(t);local.x=l.strideX+(local.x-h.root.worldToLocal(a.clone()).x)*Math.abs(lateral);
    // The mascots' oversized shoes otherwise force the short pelvis downward
    // at every long adult recovery step. Keep a compact, readable stride.
    if(h.motionScale<.7)local.z=T.MathUtils.lerp(l.strideCenter,local.z,.88);
    return h.root.localToWorld(local);
   });
   const floor=Math.min(...captured.map((t,i)=>t.y+Math.min(...data!.legs[i].sole.map(s=>s.y*Math.cos(strides[i].pitch)-s.z*Math.sin(strides[i].pitch)))))-h.root.getWorldPosition(v()).y-.006-Math.min(...strides.map(s=>s.lift))*sprintWeight;
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
  data.legs.forEach((l,i)=>{
   const crawlPole=right.clone().multiplyScalar(i===0?1:-1).addScaledVector(up,-.85);
   solveLimb(l,targets[i],forward.clone().lerp(crawlPole,prone).normalize(),frame.clone().multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),strides[i].pitch*effort*(1-prone)+prone*.7)).multiply(l.rotation));
  });
 }else{
  data.legs.forEach((l,i)=>{for(const [b,c,channel]of [[l.upper,l.knee,i*6],[l.knee,l.foot,i*6+3]] as const)point(b,c,b.getWorldPosition(v()).add(new T.Vector3().fromArray(row,channel).normalize().applyQuaternion(frame)));
   worldRotation(l.foot,frame.clone().multiply(l.rotation));
  });
 }
 // Anatomical elbow paths share the armored hero's mechanics while respecting
 // each model's real upper-arm/forearm lengths and authored relaxed wrist.
 data.arms.forEach((l,i)=>{
  const source=12+i*6,upperAngle=Math.atan2(row[source+2],-row[source+1]),lowerAngle=Math.atan2(row[source+5],-row[source+4]);

  // A standing hop still needs the capture's counterbalance. Ground speed
  // must not erase its arm motion while the legs are airborne.
  const armEffort=p.footJump?Math.max(.8,effort):effort;
  let shoulder=p.footJump?T.MathUtils.clamp(upperAngle,-1.1,1.1)*armEffort:
   T.MathUtils.lerp(upperAngle,-.15,crouch*.4)*(1-prone);
  const elbow=T.MathUtils.lerp(.18,T.MathUtils.clamp(Math.atan2(Math.sin(lowerAngle-upperAngle),Math.cos(lowerAngle-upperAngle)),.13+.57*jog,.65+.95*jog),armEffort);
  const capturedFlex=Math.atan2(Math.sin(lowerAngle-upperAngle),Math.cos(lowerAngle-upperAngle));
  let relaxedElbow=p.footJump?elbow:T.MathUtils.clamp(capturedFlex,.18,1.32)+crouch*.30;
  // Short mascot limbs need room around the jacket and a relaxed elbow, not
  // the adult capture's deep curl. Retain its timing and counter-swing.
  const mascot=h.motionScale<.7,standing=(1-prone)*(1-crouch)*(p.footJump?0:1);
  if(mascot){
   shoulder+=standing*effort*(upperAngle*.30-.08);
   relaxedElbow=T.MathUtils.lerp(relaxedElbow,.22+.16*jog+T.MathUtils.clamp(capturedFlex,0,1.32)*.32,standing);
  }
  // Bracing arms accompany the recovery step; this layer fades with the
  // authoritative stagger/dodge and never changes movement or hit detection.
  const brace=Math.max(stagger,evade*.7)*(1-prone);
  shoulder=T.MathUtils.lerp(shoulder,.30+(i===0?.10:-.10),brace);
  relaxedElbow=T.MathUtils.lerp(relaxedElbow,.85,brace);
  shoulder=T.MathUtils.lerp(shoulder,.035+idle[5]*(i===0?1:-.75),idleWeight);
  relaxedElbow=T.MathUtils.lerp(relaxedElbow,.20+idle[5]*.5,idleWeight);
  const upperSpread=mascot?.28:.0,lowerSpread=mascot?.18:0;
  const a=l.upper.getWorldPosition(v()),side=i===0?1:-1,bend=a.clone().addScaledVector(up,-l.upperLength*Math.cos(shoulder)*Math.cos(upperSpread)).addScaledVector(forward,l.upperLength*Math.sin(shoulder)*Math.cos(upperSpread)).addScaledVector(right,side*(mascot?l.upperLength*Math.sin(upperSpread):(.035+.02*effort)*scale));
  bend.sub(a).setLength(l.upperLength).add(a);
  const hand=bend.clone().addScaledVector(up,-l.lowerLength*Math.cos(shoulder+relaxedElbow)*Math.cos(lowerSpread)).addScaledVector(forward,l.lowerLength*Math.sin(shoulder+relaxedElbow)*Math.cos(lowerSpread)).addScaledVector(right,side*l.lowerLength*Math.sin(lowerSpread));
  point(l.upper,l.knee,bend);point(l.knee,l.foot,hand);
  const wrist=.035*effort*Math.sin((tacticalWeight>0?walkPhase:phase)*tau+i*Math.PI-.45)*(1-prone);
  let handFrame=l.foot.getWorldQuaternion(q());
  if(l.palm&&!p.footJump&&effort>0&&prone<1){
   const wristPosition=l.foot.getWorldPosition(v()),palmAxis=l.palm.getWorldPosition(v()).sub(wristPosition);
   const forearm=wristPosition.clone().sub(l.knee.getWorldPosition(v())).normalize().applyAxisAngle(right,.10+wrist);
   if(palmAxis.lengthSq()>1e-8){const neutral=handFrame.clone().premultiply(q().setFromUnitVectors(palmAxis.normalize(),forearm));handFrame.slerp(neutral,effort*(1-prone));}
  }else handFrame.premultiply(q().setFromAxisAngle(right,wrist));
  worldRotation(l.foot,handFrame);
  if(prone>0){
   // Opposite hand and knee recover together; the other hand remains planted.
   const crawl=lowStance('crawl',phase+(1-i)*.5);
   const reach=crawlReach(side*.29*scale,.58*scale,(crawl[3]-.58)*effort*scale,direction);
   const target=h.root.localToWorld(new T.Vector3(reach.x,.06+T.MathUtils.lerp(.04,crawl[4],effort)*scale,reach.z));
   solveLimb(l,l.foot.getWorldPosition(v()).lerp(target,prone),right.clone().multiplyScalar(side).addScaledVector(forward,-.3),frame.clone().multiply(q().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2)));
  }
 });
 const armCapture=athleticWeight>0?blendAthletic(tactical.slice(0,51),athletic,athleticWeight):tactical;
 const armCaptureWeight=Math.max(tacticalWeight,athleticWeight);
 if(armCaptureWeight>0){
  data.arms.forEach((l,i)=>{
   const channel=12+i*6,upper=new T.Vector3().fromArray(armCapture,channel).normalize().applyQuaternion(frame),lower=new T.Vector3().fromArray(armCapture,channel+3).normalize().applyQuaternion(frame);
   if((useKimodo||athleticWeight>0)&&h.motionScale<.7){
    // The same adult take needs a softer elbow on the short mascot jacket.
    const flex=upper.angleTo(lower);
    const maxFlex=T.MathUtils.lerp(.65,1.65,athleticWeight);
    if(flex>maxFlex)lower.copy(upper.clone().applyQuaternion(q().slerp(q().setFromUnitVectors(upper,lower),maxFlex/flex)));
   }
   const a=l.upper.getWorldPosition(v()),b=l.knee.getWorldPosition(v()).lerp(a.clone().addScaledVector(upper,l.upperLength),armCaptureWeight);
   point(l.upper,l.knee,b);
   const elbow=l.knee.getWorldPosition(v()),hand=l.foot.getWorldPosition(v()).lerp(elbow.clone().addScaledVector(lower,l.lowerLength),armCaptureWeight);
   point(l.knee,l.foot,hand);
   if((useKimodo||athleticWeight>0)&&l.palm){
    // Refit the relaxed wrist after the captured elbow plane is applied.
    const wrist=l.foot.getWorldPosition(v()),palm=l.palm.getWorldPosition(v()).sub(wrist),forearm=wrist.clone().sub(l.knee.getWorldPosition(v()));
    if(palm.lengthSq()>1e-8&&forearm.lengthSq()>1e-8)worldRotation(l.foot,l.foot.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(palm.normalize(),forearm.normalize())));
   }
  });
 }
 // Combat flinches must survive the locomotion mask, including when on foot.
 for(const b of data.body.slice(1)){
  const additive=q().setFromEuler(new T.Euler((pose.bodyPitch||0)*.16,(pose.bodyTwist||0)/3,(pose.bodyChestRoll||0)/3));
  b.bone.quaternion.multiply(additive);b.bone.updateWorldMatrix(false,true);
 }
 if(p.footLean)applyKimodoLean(h,p.footLean,p);
 if(mounted)h.bones.forEach((b,i)=>{const target=b.o.quaternion.clone(),position=b.o.position.clone();b.o.quaternion.copy(mounted[i].q).slerp(target,blend);b.o.position.copy(mounted[i].p).lerp(position,blend);});
 // Establish pedal-to-ground support before retargeting the Kimodo steps.
 // The controller still owns the parking position and transition duration.
 h.rider.position.y=h.mountHeight*(1-blend);h.root.updateMatrixWorld(true);
 if(p.footMode===1||p.footMode===3){
  const soleFloor=Math.min(...data.legs.map(l=>l.foot.getWorldPosition(v()).y+Math.min(...l.sole.map(s=>s.y))))-h.root.getWorldPosition(v()).y;
  const plant=T.MathUtils.smoothstep(blend,.12,.55);
  h.rider.position.y-=soleFloor*plant;h.root.updateMatrixWorld(true);
 }
 h.vehicle.position.copy(h.lean.worldToLocal(new T.Vector3(p.parkX,p.parkY,p.parkZ)));h.vehicle.rotation.set(0,p.parkHeading-p.headingY,-.07*blend);h.root.updateMatrixWorld(true);
 if(p.footMode===3)applyWheelPickup(h,data,p);
 if(p.footMode===1||p.footMode===3)applyKimodoWheel(h,data,p);
}

/** Full-body peek fitted to planted feet; also called by Static Royale before
 * its independent aiming and hand-contact layer. Negative is anatomical left. */
export function applyKimodoLean(h:Rig,value:number,p:Partial<FootPose>){
 const data=rigs.get(h);if(!data||p.footMode!==2||p.footJump||p.footProne!>.1)return;
 const weight=T.MathUtils.clamp(Math.abs(value),0,1)*(1-T.MathUtils.smoothstep(Math.abs(p.speed||0),2,3.5));
 if(weight<=0)return;
 const source=KIMODO_ATHLETIC.pairedLean,frame=h.root.getWorldQuaternion(q()),inverse=frame.clone().invert(),mirror=value>0;
 const capture=(values:number[])=>{const rotation=q().fromArray(values);if(mirror){rotation.y*=-1;rotation.z*=-1;}return q().slerp(rotation,weight);};
 const hips=capture(source.hip),chest=capture(source.chest),head=capture(source.head);
 const body=data.body.map(b=>({binding:b,rotation:b.bone.getWorldQuaternion(q())})),neck=data.neck?.bone.getWorldQuaternion(q());
 const feet=data.legs.map(l=>({position:l.foot.getWorldPosition(v()),rotation:l.foot.getWorldQuaternion(q())}));
 const origin=data.body[0].bone.getWorldPosition(v());
 for(const {binding:b,rotation}of body)worldRotation(b.bone,frame.clone().multiply(hips.clone().slerp(chest,b.channel/3)).multiply(inverse).multiply(rotation));
 if(data.neck&&neck)worldRotation(data.neck.bone,frame.clone().multiply(head).multiply(inverse).multiply(neck));
 const scale=data.legLength/source.legLength,offset=new T.Vector3().fromArray(source.shift).multiplyScalar(scale*weight);
 if(mirror)offset.x*=-1;offset.applyQuaternion(frame);
 const pelvis=data.body[0].bone;pelvis.position.copy(pelvis.parent!.worldToLocal(origin.add(offset)));h.root.updateMatrixWorld(true);
 let lower=0;data.legs.forEach((l,i)=>{const a=l.upper.getWorldPosition(v()),t=feet[i].position,reach=l.length*.995;
  lower=Math.max(lower,a.y-t.y-Math.sqrt(Math.max(.000001,reach*reach-(a.x-t.x)**2-(a.z-t.z)**2)));
 });
 if(lower>0){const at=pelvis.getWorldPosition(v());at.y-=lower;pelvis.position.copy(pelvis.parent!.worldToLocal(at));h.root.updateMatrixWorld(true);}
 data.legs.forEach((l,i)=>solveLimb(l,feet[i].position,new T.Vector3((mirror?-1:1)*.15,0,1).applyQuaternion(frame),feet[i].rotation));
 h.root.updateMatrixWorld(true);
}

/** Reference-directed EUC articulation. The wheel, steering, suspension and
 * boot contacts remain those of the live vehicle; no generated root travel. */
export function applyKimodoRiding(h:Rig,p:Partial<FootPose>&{crashBlend?:number;seated?:number;riderPitch?:number;brakeAmount?:number;crouch?:number}){
 if(p.footMode||p.airBlend!>.01||p.crashBlend!>0||p.seated!>.01||p.stopFoot!>.01)return;
 const moving=T.MathUtils.smoothstep(Math.abs(p.speed||0),1,5);
 const acceleration=T.MathUtils.smoothstep(p.riderPitch||0,.015,.28),braking=T.MathUtils.smoothstep(p.brakeAmount||0,.03,.8),carve=T.MathUtils.smoothstep(Math.abs(p.rollAngle||0),.04,.40);
 const weight=moving*Math.max(acceleration,braking,carve)*.42*(1-T.MathUtils.clamp(p.crouch||0,0,1));
 if(weight<.001)return;
 prepareOnFootRider(h);const data=rigs.get(h)!;
 const clips=KIMODO_RIDING.clips;
 let row=blendAthletic(clips.acceleration.row,clips.braking.row,braking);
 row=blendAthletic(row,(p.rollAngle||0)>0?clips.carve_left.row:clips.carve_right.row,carve);
 const frame=h.lean.getWorldQuaternion(q()),feet=data.legs.map(l=>({position:l.foot.getWorldPosition(v()),rotation:l.foot.getWorldQuaternion(q())}));
 for(const b of data.body){const target=quat(row,30).slerp(quat(row,34),b.channel/3);worldRotation(b.bone,b.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(target).multiply(b.offset),weight));}
 if(data.neck)worldRotation(data.neck.bone,data.neck.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(quat(row,47)).multiply(data.neck.offset),weight*.6));
 const pelvis=data.body[0].bone,scale=data.legLength/clips.acceleration.legLength;
 const offset=new T.Vector3(Math.sign(p.rollAngle||0)*.035*carve,-.045*carve-.035*braking,.045*acceleration-.065*braking).multiplyScalar(scale*weight).applyQuaternion(frame);
 const origin=pelvis.getWorldPosition(v()).add(offset);pelvis.position.copy(pelvis.parent!.worldToLocal(origin));h.root.updateMatrixWorld(true);
 let lower=0;data.legs.forEach((l,i)=>{const a=l.upper.getWorldPosition(v()),t=feet[i].position,reach=l.length*.995;lower=Math.max(lower,a.y-t.y-Math.sqrt(Math.max(.000001,reach*reach-(a.x-t.x)**2-(a.z-t.z)**2)));});
 if(lower>0){const at=pelvis.getWorldPosition(v());at.y-=lower;pelvis.position.copy(pelvis.parent!.worldToLocal(at));h.root.updateMatrixWorld(true);}
 data.legs.forEach((l,i)=>solveLimb(l,feet[i].position,new T.Vector3((i===0?1:-1)*.10*carve,0,1).applyQuaternion(frame),feet[i].rotation));
 data.arms.forEach((l,i)=>{
  for(const [bone,child,k]of [[l.upper,l.knee,12+i*6],[l.knee,l.foot,15+i*6]] as const){
   const direction=new T.Vector3().fromArray(row,k).normalize().applyQuaternion(frame),origin=bone.getWorldPosition(v());
   const target=origin.clone().addScaledVector(direction,origin.distanceTo(child.getWorldPosition(v())));
   point(bone,child,child.getWorldPosition(v()).lerp(target,weight*.65));
  }
 });
 h.root.updateMatrixWorld(true);
}

/** Kimodo supplies counterbalance and separate step timing. The existing rig's
 * soles, limb lengths and pedal height supply contacts; simulation owns movement. */
function applyKimodoWheel(h:Rig,data:Fit,p:FootPose){
 const off=p.footMode===1,phase=off?p.footBlend:wheelPickupTiming(p.footMountTime||0).mount;
 if(phase<=0||phase>=1)return;
 const rows=KIMODO_WHEEL[off?'dismount':'mount'].samples,f=phase*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1);
 const row=rows[i].map((n,k)=>T.MathUtils.lerp(n,rows[j][k],f-i));
 const weight=T.MathUtils.smoothstep(phase,0,.12)*(1-T.MathUtils.smoothstep(phase,.88,1));
 const frame=q().setFromAxisAngle(new T.Vector3(0,1,0),p.parkHeading),right=new T.Vector3(1,0,0).applyQuaternion(frame),forward=new T.Vector3(0,0,1).applyQuaternion(frame);
 const origin=new T.Vector3(p.parkX,p.parkY,p.parkZ),delta=new T.Vector3(p.x-p.parkX,0,p.z-p.parkZ),side=Math.sign(delta.dot(right))||1;
 // The source steps off to its right (-X). Mirror anatomy for the other side.
 const mirror=side>0,scale=Math.max(.25,data.legLength/.9);
 for(const b of data.body){
  const offset=b.channel<2?0:4,capture=q().fromArray(rows[i],offset).slerp(q().fromArray(rows[j],offset),f-i);
  if(mirror){capture.y*=-1;capture.z*=-1;}
  worldRotation(b.bone,b.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(capture).multiply(b.offset),weight*.65));
 }
 h.root.updateMatrixWorld(true);
 const targets=data.legs.map((l,k)=>{
  const source=mirror?1-k:k,u=row[20+source*2],lift=row[21+source*2]*scale;
  const floor=-Math.min(...l.sole.map(s=>s.y))+.006;
  const pedal=new T.Vector3(l.rest.x,floor+h.mountHeight,l.rest.z).applyQuaternion(frame).add(origin);
  const standing=new T.Vector3(l.rest.x+(off?.68:.30)*side,floor,l.rest.z).applyQuaternion(frame).add(origin);
  const target=(off?pedal.clone().lerp(standing,u):standing.clone().lerp(pedal,u));target.y+=lift;
  return l.foot.getWorldPosition(v()).lerp(target,weight);
 });
 // Bend the knees rather than stretching a planted leg as weight transfers.
 let lower=0;
 data.legs.forEach((l,k)=>{const a=l.upper.getWorldPosition(v()),t=targets[k],reach=l.length*.985;
  lower=Math.max(lower,a.y-t.y-Math.sqrt(Math.max(.0001,reach*reach-(a.x-t.x)**2-(a.z-t.z)**2)));
 });
 if(lower>0){const hips=data.body[0].bone,at=hips.getWorldPosition(v());at.y-=Math.min(lower,.32*scale);hips.position.copy(hips.parent!.worldToLocal(at));h.root.updateMatrixWorld(true);}
 data.legs.forEach((l,k)=>solveLimb(l,targets[k],forward.clone().addScaledVector(right,(k===0?1:-1)*.16),frame.clone().multiply(l.rotation)));
 data.arms.forEach((l,k)=>{
  const source=mirror?1-k:k;
  for(const [bone,child,offset]of [[l.upper,l.knee,8+source*6],[l.knee,l.foot,11+source*6]] as const){
   const direction=new T.Vector3().fromArray(row,offset);if(mirror)direction.x*=-1;direction.normalize().applyQuaternion(frame);
   const at=bone.getWorldPosition(v()),target=at.clone().addScaledVector(direction,at.distanceTo(child.getWorldPosition(v())));
   point(bone,child,child.getWorldPosition(v()).lerp(target,weight*.82));
  }
 });
 h.root.updateMatrixWorld(true);
}

/** Retarget the supplied farm_harvest capture. World-space contact IK preserves
 * each hero's bone lengths and the already planted feet. Only the visual wheel
 * is lifted; its saved parking position remains owned by the controller. */
function applyWheelPickup(h:Rig,data:Fit,p:FootPose){
 const timing=wheelPickupTiming(p.footMountTime||0),weight=timing.weight;
 if(weight<=0)return;
 if(!data.wheelHandle){
  const grip=h.vehicle.getObjectByName("CarryHandle_Grip");
  const bounds=new T.Box3().setFromObject(grip??h.vehicle,true);
  data.wheelHandle=bounds.isEmpty()?new T.Vector3(0,.55,0):h.vehicle.worldToLocal(grip?bounds.getCenter(v()):bounds.getCenter(v()).setY(bounds.max.y-.035));
 }
 h.vehicle.position.y+=timing.lift*Math.max(.48,h.motionScale);h.vehicle.rotation.z*=1-timing.grip;h.root.updateMatrixWorld(true);
 const rows=WHEEL_PICKUP.frames,f=timing.phase*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1),row=rows[i].map((n,k)=>T.MathUtils.lerp(n,rows[j][k],f-i));
 const frame=h.root.getWorldQuaternion(q()),scale=data.legLength/WHEEL_PICKUP.legLength;
 const capture=q().fromArray(rows[i],3).slerp(q().fromArray(rows[j],3),f-i);
 if(h.motionScale<.7)capture.slerp(q(),.22);
 const hips=data.body[0].bone,origin=hips.getWorldPosition(v());
 const planted=data.legs.map(l=>({p:l.foot.getWorldPosition(v()),q:l.foot.getWorldQuaternion(q())}));
 const hands=data.arms.map(l=>({p:l.foot.getWorldPosition(v()),q:l.foot.getWorldQuaternion(q())}));
 for(const b of data.body)worldRotation(b.bone,b.bone.getWorldQuaternion(q()).slerp(frame.clone().multiply(capture).multiply(b.offset),weight));
 const offset=new T.Vector3().fromArray(row).sub(new T.Vector3().fromArray(rows[0])).multiplyScalar(scale*weight).applyQuaternion(frame);
 hips.position.copy(hips.parent!.worldToLocal(origin.clone().add(offset)));h.root.updateMatrixWorld(true);
 const handle=h.vehicle.localToWorld(data.wheelHandle.clone());
 // Keep the knees flexed while placing the wheel down. The harvest take rises
 // earlier than the handle release; without this reach correction the wrist
 // pulled away from the wheel during the last part of the grip.
 const arm=data.arms[1],reach=(arm.upperLength+arm.lowerLength)*.97;
 const shoulder=arm.upper.getWorldPosition(v()),toward=handle.clone().sub(shoulder).setY(0);
 const shift=Math.min(.22*scale,Math.max(0,toward.length()-reach*.82))*timing.grip*weight;
 if(shift>0){const at=hips.getWorldPosition(v()).add(toward.normalize().multiplyScalar(shift));hips.position.copy(hips.parent!.worldToLocal(at));h.root.updateMatrixWorld(true);arm.upper.getWorldPosition(shoulder);}
 const horizontal=(shoulder.x-handle.x)**2+(shoulder.z-handle.z)**2;
 const lower=Math.max(0,shoulder.y-handle.y-Math.sqrt(Math.max(.001,reach*reach-horizontal)))*timing.grip*weight;
 if(lower>0){const at=hips.getWorldPosition(v());at.y-=Math.min(lower,.50*scale);hips.position.copy(hips.parent!.worldToLocal(at));h.root.updateMatrixWorld(true);}
 data.legs.forEach((l,k)=>solveLimb(l,planted[k].p,new T.Vector3(0,0,1).applyQuaternion(frame),planted[k].q));
 data.arms.forEach((l,k)=>{
  const at=(index:number)=>new T.Vector3().fromArray(row,index).sub(new T.Vector3().fromArray(rows[0])).multiplyScalar(scale).applyQuaternion(frame).add(origin);
  const target=at(7+k*3);
  if(k===1)target.lerp(handle,timing.grip);
  const pole=at(13+k*3).sub(l.upper.getWorldPosition(v())).normalize();
  solveLimb(l,hands[k].p.clone().lerp(target,weight),pole,hands[k].q);
 });
 h.root.updateMatrixWorld(true);
}



/** Full-body captured roll overrides weapon/lean overlays, with locomotion crossfades. */
export function applyKimodoEvade(h:Rig,p:FootPose,phase:number,direction:number){
 prepareOnFootRider(h);const data=rigs.get(h)!,row=sampleKimodoEvade(phase);
 const nodes=[h.ground,h.lean,h.rider,...h.bones.map(b=>b.o)],base=nodes.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
 standingBindPose(h);
 const turn=direction===-1?-Math.PI/2:direction===1?Math.PI/2:direction===2?Math.PI:0;
 const heading=q().setFromAxisAngle(new T.Vector3(0,1,0),p.headingY+turn),scale=data.legLength/KIMODO_EVADE.legLength;
 for(const b of data.body){const orientation=quat(row,30).slerp(quat(row,34),b.channel/3);worldRotation(b.bone,heading.clone().multiply(orientation).multiply(b.offset));}
 const hip=data.body[0].bone.getWorldPosition(v()),target=new T.Vector3(p.x,p.y+row[45]*scale,p.z);
 // Root translation follows the swept game motor; only captured vertical motion is retargeted.
 h.rider.position.add(h.rider.parent!.worldToLocal(target).sub(h.rider.parent!.worldToLocal(hip)));h.root.updateWorldMatrix(true,true);
 if(data.neck)worldRotation(data.neck.bone,heading.clone().multiply(quat(row,47)).multiply(data.neck.offset));
 for(const [i,l]of [...data.legs,...data.arms].entries()){
  const offset=i<2?i*6:12+(i-2)*6,a=l.upper.getWorldPosition(v()),upper=v().fromArray(row,offset).normalize().applyQuaternion(heading),lower=v().fromArray(row,offset+3).normalize().applyQuaternion(heading);
  point(l.upper,l.knee,a.addScaledVector(upper,l.upperLength));
  point(l.knee,l.foot,l.knee.getWorldPosition(v()).addScaledVector(lower,l.lowerLength));
  if(i<2)worldRotation(l.foot,heading.clone().multiply(quat(row,51+i*4)).multiply(data.legs[i].rotation));
 }
 const weight=T.MathUtils.smoothstep(phase,0,.10)*(1-T.MathUtils.smoothstep(phase,.84,1));
 for(const old of base){old.o.position.lerpVectors(old.p,old.o.position,weight);old.o.quaternion.copy(old.q.clone().slerp(old.o.quaternion,weight));}
 h.root.updateWorldMatrix(true,true);
}

