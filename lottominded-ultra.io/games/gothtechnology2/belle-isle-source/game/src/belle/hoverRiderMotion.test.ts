import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {HoverController,type HoverInput} from './hoverController.ts';
import type {ParkTerrain} from './terrain.ts';
import {HoverRiderMotion,HoverRiderRig} from './hoverRiderMotion.ts';

const terrain={land:()=>true,height:()=>2,raycastFlight:()=>null,obstructed:()=>false} as unknown as ParkTerrain;
const idle:HoverInput={throttle:0,steer:0,lift:0,brake:false,boost:false};
function flight(mode:'classic'|'drone'='drone',ground=false){
 const controller=new HoverController(terrain,{x:0,z:0,heading:0});controller.setMode(mode);
 if(!ground)assert(controller.startFlight({x:0,y:15,z:0,heading:0}));
 const motion=new HoverRiderMotion();motion.reset(controller.pose,controller.landed);return{controller,motion};
}
function advance(run:ReturnType<typeof flight>,seconds:number,input=idle,hz=60){
 for(let i=0;i<Math.round(seconds*hz);i++){run.controller.advance(1/hz,input);run.motion.update(1/hz,run.controller.pose,run.controller.landed,input.steer,true,false);}
 return{...run.motion.pose};
}

test('rider braces against real acceleration, then tucks at cruising speed',()=>{
 const run=flight();const launch=advance(run,.45,{...idle,throttle:1});
 assert(launch.pitch<-.025,'acceleration loads the rider backwards');
 const cruising=advance(run,3,{...idle,throttle:1});assert(cruising.pitch>.035,'steady speed brings a modest forward tuck');
 assert(Math.abs(cruising.lean)<.005,'straight flight must not generate sideways sway');
});

test('rider leans into both turn directions and looks ahead without banking at rest',()=>{
 for(const sign of [-1,1]){
  const run=flight();advance(run,3,{...idle,throttle:1});const turn=advance(run,1.5,{...idle,throttle:1,steer:sign});
  assert(turn.lean*sign>.08,'moving rider leans into the actual curved path');
  assert(turn.look*sign<-.06,'head looks in the steering direction');
  assert(turn.headRoll*turn.lean<0,'head partially counterbalances torso lean');
  const stopped=flight();const turning=advance(stopped,1.5,{...idle,steer:sign});
  assert(Math.abs(turning.lean)<.003,'turning on the spot must not imitate high-speed cornering');
 }
});

test('drone strafing gives an initial inertial body response which settles at constant speed',()=>{
 const run=flight();const moving=advance(run,.45,{...idle,strafe:1});assert(moving.lean<-.025);
 const settled=advance(run,3,{...idle,strafe:1});assert(Math.abs(settled.lean)<.006);
});

test('braking produces a forward brace for both classic and position-hold flight',()=>{
 for(const mode of ['classic','drone'] as const){
  const run=flight(mode);advance(run,5,{...idle,throttle:1});const before=run.motion.pose.pitch;
  const braking=advance(run,.2,{...idle,brake:true});assert(braking.pitch>before+.035,`${mode} must show a visible braking response`);
  advance(run,2,{...idle,brake:true});advance(run,3,idle);assert(Math.abs(run.motion.pose.pitch)<.003);assert(Math.abs(run.motion.pose.lean)<.003);
 }
});

test('takeoff and landing flex the seated rider, settle without oscillation and reset cleanly',()=>{
 const run=flight('classic',true);run.controller.launch();
 const takeoff=advance(run,.25);assert(takeoff.compression>.01);assert(takeoff.pitch<-.005);
 advance(run,3);run.controller.land();let compression=0;
 for(let i=0;i<360;i++){advance(run,1/60);compression=Math.max(compression,run.motion.pose.compression);}
 assert(run.controller.landed);assert(compression>.012);assert(run.motion.pose.compression<.001);
 run.motion.reset(run.controller.pose,run.controller.landed);assert.deepEqual(run.motion.pose,{lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0});
});

test('an old fast descent cannot amplify a later gentle landing after settled hover',()=>{
 const landing=(dive:boolean,settle:boolean,hz:number)=>{
  const motion=new HoverRiderMotion(),p={x:0,y:20,z:0,heading:0,speed:0,pitch:0,roll:0,lift:0,rpm:1};motion.reset(p,false);
  const fly=(seconds:number,lift:number)=>{for(let i=0;i<Math.round(seconds*hz);i++){p.lift=lift;p.y+=lift/hz;motion.update(1/hz,p,false,0,true,false);}};
  if(dive)fly(1,-8);
  if(settle){fly(2,0);fly(.3,-.2);}
  let compression=0;p.lift=0;
  for(let i=0;i<hz;i++){motion.update(1/hz,p,true,0,true,false);compression=Math.max(compression,motion.pose.compression);}
  return compression;
 };
 for(const hz of [30,60,120]){
  const gentle=landing(false,true,hz),oldDive=landing(true,true,hz),immediateImpact=landing(true,false,hz);
  assert(Math.abs(oldDive-gentle)<.002,`${hz} Hz: settled hover removes the old impact history`);
  assert(immediateImpact>gentle*2,`${hz} Hz: a genuinely immediate fast landing still has a stronger reaction`);
 }
});

test('paused poses freeze and reduced motion removes secondary reactions',()=>{
 const run=flight();advance(run,3,{...idle,throttle:1});advance(run,1,{...idle,throttle:1,steer:1});
 const before={...run.motion.pose};
 for(let i=0;i<100;i++)run.motion.update(.1,run.controller.pose,false,-1,false,false);
 assert.deepEqual(run.motion.pose,before);
 run.motion.update(.1,run.controller.pose,false,1,false,true);
 assert.deepEqual(run.motion.pose,{lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0});
 run.controller.stop();advance(run,2,idle);assert(Math.abs(run.motion.pose.pitch)<.003);assert(Math.abs(run.motion.pose.lean)<.003);
});

test('body motion remains consistent at 30, 60 and 120 simulation updates per second',()=>{
 const simulate=(hz:number)=>{
  const run=flight();const values=[];
  values.push(advance(run,1,{...idle,throttle:1},hz));values.push(advance(run,2,{...idle,throttle:1,steer:.7},hz));
  values.push(advance(run,.25,{...idle,brake:true},hz));values.push(advance(run,1,{...idle,strafe:-1,lift:1},hz));return values;
 };
 const reference=simulate(120);
 for(const hz of [30,60])for(const [i,pose] of simulate(hz).entries()){
  assert(Math.abs(pose.lean-reference[i].lean)<.012,`${hz} Hz lean phase ${i}`);
  assert(Math.abs(pose.pitch-reference[i].pitch)<.012,`${hz} Hz pitch phase ${i}`);
  assert(Math.abs(pose.compression-reference[i].compression)<.003,`${hz} Hz compression phase ${i}`);
 }
});

test('invalid telemetry, zero time and world relocation cannot leave NaN or a false impact',()=>{
 const run=flight();const before={...run.motion.pose};run.motion.update(0,run.controller.pose,false,1,true,false);assert.deepEqual(run.motion.pose,before);
 run.motion.update(.1,{...run.controller.pose,heading:NaN},false,Infinity,true,false);assert(Object.values(run.motion.pose).every(Number.isFinite));
 run.controller.pose.x=700;run.controller.pose.z=-300;run.motion.update(.1,run.controller.pose,false,0,true,false);
 assert(Math.abs(run.motion.pose.pitch)<.003);assert.equal(run.motion.pose.compression,0);
});

// Parse the shipped GLB's exact geometry, skin, transforms and animation. Only
// material references are replaced in this in-memory test fixture so Node does
// not need a DOM image decoder. This is rig verification, not a rendered proof.
async function readAsset(){
 const bytes=fs.readFileSync(new URL('../../public/belle/vehicles/hero-hoverbike.glb',import.meta.url)),jsonLength=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 data.materials=[{name:'Rig verification'}];for(const mesh of data.meshes)for(const primitive of mesh.primitives)primitive.material=0;
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+jsonLength),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const assetPromise=readAsset();
async function actualRider(){
 const asset=await assetPromise,model=clone(asset.scene),mixer=new T.AnimationMixer(model),clip=asset.animations.find(c=>c.name.includes('Ride_Steer'))!;
 mixer.clipAction(clip).play();mixer.setTime(clip.duration*.5);model.updateMatrixWorld(true);
 const rig=HoverRiderRig.create(model);assert(rig);assert.equal(rig.diagnostics.contacts,4);
 const controller=new HoverController(terrain,{x:0,z:0,heading:0});controller.setMode('drone');assert(controller.startFlight({x:0,y:15,z:0,heading:0}));
 const bar=model.getObjectByName('HandlebarPivot')!,barRest=bar.quaternion.clone(),q=new T.Quaternion(),axis=new T.Vector3(0,1,0);let steer=0;
 const place=()=>{const p=controller.pose;model.position.set(p.x,p.y,p.z);model.rotation.set(p.pitch,p.heading,p.roll,'YXZ');};
 place();rig.reset(controller.pose,controller.landed);
 const step=(input:HoverInput,dt=1/60,running=true,reduced=false)=>{
  if(running){controller.advance(dt,input);steer=T.MathUtils.damp(steer,input.steer,7,dt);bar.quaternion.copy(barRest).multiply(q.setFromAxisAngle(axis,-steer*.18));}
  place();rig.update(dt,controller.pose,controller.landed,steer,running,reduced);
 };
 return{rig,model,controller,step,bar,barRest,place};
}
function bones(model:T.Object3D){const result:T.Bone[]=[];model.traverse(o=>{if((o as T.Bone).isBone)result.push(o as T.Bone);});return result;}
function boneSnapshot(model:T.Object3D){return bones(model).flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]);}
function weightedWorldBounds(model:T.Object3D,bone:T.Bone){
 const box=new T.Box3(),v=new T.Vector3();model.updateMatrixWorld(true);
 model.traverse(o=>{
  const mesh=o as T.SkinnedMesh;if(!mesh.isSkinnedMesh||mesh.name==='Hero_FPVArms')return;
  mesh.skeleton.update();const index=mesh.skeleton.bones.indexOf(bone),position=mesh.geometry.attributes.position,joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<position.count;i++)for(let j=0;j<4;j++)if(joints.getComponent(i,j)===index&&weights.getComponent(i,j)>.5){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);box.expandByPoint(v);break;}
 });return box;
}

test('actual shipped gloves surround the grips and boot soles sit on the supports',async()=>{
 const {rig,model}=await actualRider();assert(rig.diagnostics.handError<.003);assert(rig.diagnostics.footError<.003);
 const rigBones=bones(model),hands=rigBones.filter(b=>b.name==='Hand_L'||b.name==='Hand_R'),feet=rigBones.filter(b=>/^Foot_[LR](?:_\d+)?$/.test(b.name));
 const grips=['Grip_L','Grip_R'].map(name=>model.getObjectByName(name)!.getWorldPosition(new T.Vector3()));
 for(const hand of hands){const bounds=weightedWorldBounds(model,hand);assert(grips.some(p=>bounds.containsPoint(p)),'each actual glove contains its own grip anchor');}
 const supports=['Foot_L','Foot_R'].map(name=>model.getObjectByName(name)!.getWorldPosition(new T.Vector3()));
 for(const foot of feet){const bounds=weightedWorldBounds(model,foot),centre=bounds.getCenter(new T.Vector3()),support=supports.reduce((a,b)=>a.distanceToSquared(centre)<b.distanceToSquared(centre)?a:b);assert(Math.abs(bounds.min.y-support.y)<.025,'boot sole meets the support without sinking an ankle into it');}
});

test('actual skinned rider keeps hands and feet anchored through turns, boost, braking and lift',async t=>{
 const run=await actualRider();let handError=0,footError=0,maxLean=0,maxPitch=0;
 const phases:[number,HoverInput][]=[[3,{...idle,throttle:1}],[2,{...idle,throttle:1,steer:1,boost:true}],[.3,{...idle,brake:true}],[2,{...idle,throttle:1,steer:-1,lift:-1,boost:true}],[1,{...idle,strafe:1,lift:1}]];
 for(const [seconds,input] of phases)for(let i=0;i<Math.round(seconds*60);i++){
  run.step(input);const d=run.rig.diagnostics;handError=Math.max(handError,d.handError);footError=Math.max(footError,d.footError);maxLean=Math.max(maxLean,Math.abs(d.lean));maxPitch=Math.max(maxPitch,Math.abs(d.pitch));
 }
 assert(maxLean>.1);assert(maxPitch>.07);assert(handError<.008,`hand anchor error ${handError} m`);assert(footError<.008,`foot anchor error ${footError} m`);
 t.diagnostic(`Shipped rig: max hand error ${handError.toFixed(6)} m, foot error ${footError.toFixed(6)} m; peak torso lean ${maxLean.toFixed(4)} rad, pitch ${maxPitch.toFixed(4)} rad.`);
});

test('actual rider pause, reduced motion and reset cannot accumulate bone drift or alter camera visibility',async()=>{
 const run=await actualRider(),head=run.model.getObjectByName('Hero_Head')!,fpv=run.model.getObjectByName('Hero_FPVArms')!;head.visible=false;fpv.visible=true;
 for(let i=0;i<240;i++)run.step({...idle,throttle:1,steer:.8});
 const snapshot=boneSnapshot(run.model);
 for(let i=0;i<120;i++)run.step(idle,1/60,false);
 const after=boneSnapshot(run.model);assert.equal(after.length,snapshot.length);for(let i=0;i<after.length;i++)assert(Math.abs(after[i]-snapshot[i])<1e-10,`paused bone component ${i}`);
 run.step(idle,1/60,false,true);assert.equal(run.rig.diagnostics.lean,0);assert.equal(run.rig.diagnostics.compression,0);assert(run.rig.diagnostics.handError<.008);
 run.controller.reset();run.bar.quaternion.copy(run.barRest);run.place();run.rig.reset(run.controller.pose,true);
 assert.equal(run.rig.diagnostics.pitch,0);assert.equal(run.rig.diagnostics.look,0);assert(run.rig.diagnostics.handError<.003);assert(run.rig.diagnostics.footError<.003);
 assert.equal(head.visible,false);assert.equal(fpv.visible,true,'camera retains control of first-person/photo mesh visibility');
});

test('missing rider bones or supports fail gracefully without adding fake replacement geometry',()=>{
 const model=new T.Group(),child=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());model.add(child);
 assert.equal(HoverRiderRig.create(model),undefined);assert.equal(model.children.length,1);assert.equal(model.children[0],child);
});
