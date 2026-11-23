import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CadillacHydraulics} from './cadillacHydraulics.ts';
import {CadillacSuspension,CADILLAC_CORNERS,CADILLAC_SUSPENSION_LIMITS as LIMITS,SILVER_CADILLAC_SUSPENSION_ANCHORS,
  type CadillacCornerHeights,type CadillacSuspensionAnchors,type CadillacSuspensionPose,type CadillacHop} from './cadillacSuspension.ts';

const all=(value:number):CadillacCornerHeights=>({FL:value,FR:value,RL:value,RR:value});
const near=(actual:number,expected:number,message='')=>assert(Math.abs(actual-expected)<1e-8,`${message}: ${actual} != ${expected}`);
const nearPose=(actual:Readonly<CadillacSuspensionPose>,expected:Readonly<CadillacSuspensionPose>)=>{
  near(actual.heave,expected.heave,'heave');near(actual.pitch,expected.pitch,'pitch');near(actual.roll,expected.roll,'roll');
  for(const corner of CADILLAC_CORNERS)near(actual.wheelLifts[corner],expected.wheelLifts[corner],corner);
};
const step=(suspension:CadillacSuspension,seconds:number,framesPerSecond=60)=>{
  for(let frame=0;frame<Math.round(seconds*framesPerSecond);frame++)suspension.update(1/framesPerSecond);
};
const glb=readFileSync('public/belle/vehicles/hydraulics-cadillac.glb');
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
const hydraulicAnchors=Object.fromEntries(CADILLAC_CORNERS.map(corner=>{
  const node=asset.nodes.find((n:{name:string})=>n.name==='Wheel_'+corner);
  assert(node,'actual hydraulic asset has '+corner);
  return[corner,{x:node.translation[0],y:node.translation[1],z:node.translation[2]}];
})) as unknown as CadillacSuspensionAnchors;

test('both actual Cadillac hub layouts preserve a rigid chassis and nonnegative tire contact across corner extremes',()=>{
  for(const anchors of [SILVER_CADILLAC_SUSPENSION_ANCHORS,hydraulicAnchors]){
    const suspension=new CadillacSuspension(anchors);
    const levels=[LIMITS.min,.12,LIMITS.max];
    for(let combination=0;combination<81;combination++){
      let bits=combination;const heights=all(0);
      for(const corner of CADILLAC_CORNERS){heights[corner]=levels[bits%3];bits=Math.floor(bits/3);}
      const pose=suspension.preview(heights),matrix=new T.Matrix4().compose(new T.Vector3(0,pose.heave,0),new T.Quaternion().setFromEuler(new T.Euler(pose.pitch,0,pose.roll)),new T.Vector3(1,1,1));
      assert(Math.abs(pose.pitch)<=LIMITS.maxTiltRadians&&Math.abs(pose.roll)<=LIMITS.maxTiltRadians);
      assert(Object.values(pose.wheelLifts).some(lift=>lift===0),'at least one contact supports a parked pose');
      for(const corner of CADILLAC_CORNERS){
        const p=anchors[corner],transformed=new T.Vector3(p.x,p.y,p.z).applyMatrix4(matrix);
        assert(Number.isFinite(pose.wheelLifts[corner])&&pose.wheelLifts[corner]>=0,'tires never penetrate the reference surface');
        near(transformed.y-p.y-pose.wheelLifts[corner],heights[corner],corner+' actual transformed actuator stroke');
      }
    }
  }
});

test('a single-corner command preserves the other three requested heights and levels before driving',()=>{
  const s=new CadillacSuspension();assert(s.readyForDrive);
  assert(s.setCorner('FL',.24,true));assert.deepEqual(s.targets,{FL:.24,FR:0,RL:0,RR:0});
  assert(s.pose.pitch<0&&s.pose.roll>0,'front-left rises in the rig actual axes');
  near(s.pose.wheelLifts.FL,0);near(s.pose.wheelLifts.RR,0);near(s.pose.wheelLifts.FR,.12);near(s.pose.wheelLifts.RL,.12);
  assert(s.settled&&!s.readyForDrive,'settled corner poses do not permit unstable driving');
  s.settle();assert(!s.readyForDrive);step(s,1);
  assert(s.readyForDrive);assert.deepEqual(s.targets,all(.06));near(s.pose.heave,.06);near(s.pose.pitch,0);near(s.pose.roll,0);
});

test('malformed commands are atomic, valid heights clamp, and idle updates reuse their pose',()=>{
  const s=new CadillacSuspension(),before=s.snapshot();
  assert(!s.setTargets({FL:.2,FR:NaN}));assert(!s.setCorner('FL',Infinity));assert(!s.setCorner('invalid' as 'FL',.1));
  assert.deepEqual(s.snapshot(),before);
  assert(s.setCorner('FL',50,true));assert(s.setCorner('RR',-50,true));
  assert.equal(s.targets.FL,LIMITS.max);assert.equal(s.targets.RR,LIMITS.min);
  assert.throws(()=>s.preview({FL:NaN}),/Invalid/);
  s.reset();const pose=s.update(0);
  assert.strictEqual(s.update(1/60),pose,'no steady-driving pose allocations');
  assert.deepEqual(s.snapshot(),before);
});

test('clearance previews do not mutate state and follow the actual normalized corner path',()=>{
  const s=new CadillacSuspension();s.setCorner('RR',.08,true);
  const targets={FL:.24,FR:.12,RL:.04,RR:0},before=s.snapshot(),path=s.previewPath(targets,20);
  assert.deepEqual(s.snapshot(),before);assert.equal(path.length,21);nearPose(path[0],before.pose);
  assert(s.setTargets(targets));
  const duration=.24/LIMITS.actuatorMetresPerSecond;
  for(let i=1;i<path.length;i++){s.update(duration/20);nearPose(s.pose,path[i]);}
  assert(s.settled);nearPose(s.pose,s.preview(targets));
});

test('each hop is one bounded sequence and its clearance preview matches every sampled rendered pose',()=>{
  for(const mode of ['all','front','rear'] as CadillacHop[]){
    const s=new CadillacSuspension(hydraulicAnchors);s.setTargets(all(.1),true);
    const before=s.snapshot(),path=s.previewHop(mode,36);assert.deepEqual(s.snapshot(),before);
    assert(s.hop(mode));assert(!s.hop(mode));assert(!s.setCorner('FL',.2));
    assert(!s.readyForDrive);nearPose(s.pose,path[0]);
    for(let frame=1;frame<=36;frame++){
      s.update(LIMITS.hopSeconds/36);nearPose(s.pose,path[frame]);
      assert(Object.values(s.pose.wheelLifts).every(lift=>lift>=0&&lift<.5));
    }
    assert.equal(s.snapshot().hop,null);nearPose(s.pose,before.pose);assert(s.readyForDrive);
    assert(!s.hop(mode),'cooldown prevents repeated hopping');step(s,.5,100);assert(s.hop(mode));
  }
});

test('hop timing agrees at 30, 60 and 120 Hz and huge or invalid frame times cannot skip the sequence',()=>{
  const results=[];
  for(const fps of [30,60,120]){const s=new CadillacSuspension();s.hop('front');step(s,.6,fps);results.push(s.snapshot());}
  for(const state of results.slice(1)){nearPose(state.pose,results[0].pose);near(state.hopProgress,results[0].hopProgress);}
  const s=new CadillacSuspension();s.hop('all');const before=s.snapshot();
  for(const dt of [NaN,Infinity,-1])s.update(dt);
  assert.deepEqual(s.snapshot(),before);
  s.update(50);near(s.snapshot().hopProgress,LIMITS.maxFrameSeconds/LIMITS.hopSeconds);assert(!s.readyForDrive);
});

test('reduced motion preserves functional height, suppresses hopping, and reset cancels all transient state',()=>{
  const s=new CadillacSuspension();s.setCorner('RL',.2);
  s.update(0,true);assert(s.settled);nearPose(s.pose,s.preview({RL:.2}));
  assert(!s.hop('rear',true));assert.equal(s.snapshot().hop,null);
  assert(s.hop('rear'));step(s,.3);assert(s.snapshot().hop!==null);
  s.update(0,true);assert.equal(s.snapshot().hop,null);nearPose(s.pose,s.preview({RL:.2}));
  s.reset();assert(s.readyForDrive);assert.deepEqual(s.targets,all(0));assert.deepEqual(s.pose,{heave:0,pitch:0,roll:0,wheelLifts:all(0)});
  assert(s.hop('all'),'reset clears the old hop and cooldown');
});

test('requesting driving during a hop waits for landing before leveling',()=>{
  const s=new CadillacSuspension();s.setCorner('FL',.24,true);assert(s.hop('all'));step(s,.3);
  const airborne=s.snapshot().pose;s.settle();nearPose(s.pose,airborne);assert(!s.readyForDrive);
  step(s,.3);assert(s.snapshot().hop!==null&&!s.readyForDrive);
  step(s,1.5);assert(s.readyForDrive);assert.deepEqual(s.targets,all(.06));assert.deepEqual(s.pose.wheelLifts,all(0));
});

test('pending previews follow remaining hop, landing and queued leveling in rendered order without mutating the controller',()=>{
  const bounds=new T.Box3(new T.Vector3(-1,.08,-2.9),new T.Vector3(1,1.7,3));
  const transformedBounds=(pose:Readonly<CadillacSuspensionPose>)=>bounds.clone().applyMatrix4(new T.Matrix4().compose(
    new T.Vector3(0,pose.heave,0),new T.Quaternion().setFromEuler(new T.Euler(pose.pitch,0,pose.roll)),new T.Vector3(1,1,1)));
  for(const anchors of [SILVER_CADILLAC_SUSPENSION_ANCHORS,hydraulicAnchors])for(const mode of ['all','front','rear'] as CadillacHop[]){
    const s=new CadillacSuspension(anchors),initial={FL:.24,FR:.06,RL:0,RR:.12},height=Object.values(initial).reduce((sum,value)=>sum+value/4,0);
    s.setTargets(initial,true);s.hop(mode);step(s,.5625,160);s.settle();
    const before=s.snapshot(),path=s.previewPendingMotion(24),sampleBounds=path.map(transformedBounds);
    assert.deepEqual(s.snapshot(),before,'preview must preserve queued leveling and current motion');
    assert.equal(path.length,49);nearPose(path[0],before.pose);nearPose(path[24],s.preview(initial));nearPose(path.at(-1)!,s.preview(all(height)));
    const hopStep=(1-before.hopProgress)*LIMITS.hopSeconds/24;
    const levelStep=Math.max(...Object.values(initial).map(value=>Math.abs(value-height)))/LIMITS.actuatorMetresPerSecond/24;
    for(let index=1;index<path.length;index++){
      s.update(index<=24?hopStep:levelStep);nearPose(s.pose,path[index]);
      const actual=transformedBounds(s.pose),expected=sampleBounds[index];
      near(actual.min.distanceTo(expected.min),0,'clearance bounds follow the same lower surface');
      near(actual.max.distanceTo(expected.max),0,'clearance bounds follow the same upper surface');
      if(index<24){assert(s.snapshot().hop!==null);assert.deepEqual(s.targets,initial,'leveling must wait for landing');}
      else{assert.equal(s.snapshot().hop,null);assert.deepEqual(s.targets,all(height));}
    }
    assert(s.readyForDrive);
  }
});

test('pending previews omit past peaks, retain the future peak and follow static movement',()=>{
  const s=new CadillacSuspension();s.hop('all');step(s,.675,120);
  const current=s.snapshot(),descending=s.previewPendingMotion(24);
  nearPose(descending[0],current.pose);nearPose(descending.at(-1)!,s.preview(all(0)));
  assert(descending.every(pose=>pose.heave<=current.pose.heave+1e-8),'a descending hop does not revalidate its past peak');
  s.reset();s.hop('all');step(s,.1,120);
  const rising=s.previewPendingMotion(3);
  near(Math.max(...rising.map(pose=>pose.heave)),LIMITS.hopWheelLift+LIMITS.hopExtension,'future apex remains part of clearance preview');
  s.reset();s.setCorner('FL',.24);step(s,.2);
  const staticBefore=s.snapshot();assert.deepEqual(s.previewPendingMotion(12),s.previewPath(s.targets,12));assert.deepEqual(s.snapshot(),staticBefore);
});

test('invalid or collinear hub geometry is rejected before producing NaN transforms',()=>{
  assert.throws(()=>new CadillacSuspension({...SILVER_CADILLAC_SUSPENSION_ANCHORS,FL:{x:NaN,y:.346,z:1}}),/finite/);
  const line=Object.fromEntries(CADILLAC_CORNERS.map((corner,index)=>[corner,{x:0,y:.3,z:index}])) as unknown as CadillacSuspensionAnchors;
  assert.throws(()=>new CadillacSuspension(line),/chassis plane/);
});

// Decode the actual dedicated-model hierarchy without browser-only textures.
const fixture=structuredClone(asset);fixture.materials=(fixture.materials??[]).map((material:{name:string})=>({name:material.name}));
const json=Buffer.from(JSON.stringify(fixture)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const binary=glb.subarray(20+glb.readUInt32LE(12)),buffer=Buffer.alloc(20+padded.length+binary.length);
buffer.write('glTF');buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(padded.length,12);buffer.writeUInt32LE(0x4e4f534a,16);padded.copy(buffer,20);binary.copy(buffer,20+padded.length);
const model=(await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene;

test('the existing hydraulic rig retains its original hubs, wheel spins and cylinder mounts',()=>{
  const car=model.clone(true),root=car.getObjectByName('Cadillac_Model')!,body=car.getObjectByName('ChassisGeometry')!;
  car.updateMatrixWorld(true);
  const original=CADILLAC_CORNERS.map(corner=>car.getObjectByName('Wheel_'+corner)!.getWorldPosition(new T.Vector3()));
  const rig=new CadillacHydraulics(root,body);
  for(let i=0;i<4;i++){
    near(rig.hubs[i].hub.getWorldPosition(new T.Vector3()).distanceTo(original[i]),0);
    assert.equal(rig.hubs[i].spin.name,'Wheel_'+CADILLAC_CORNERS[i]);
    assert.equal(root.getObjectByName('Hydraulic_'+CADILLAC_CORNERS[i]+'_HubMount')!.parent,rig.hubs[i].hub);
  }
  rig.suspension.setCorner('FL',.2,true);const pose=rig.suspension.pose;
  body.position.y=pose.heave;body.rotation.set(pose.pitch,0,pose.roll);
  for(let i=0;i<4;i++)rig.hubs[i].hub.position.y=hydraulicAnchors[CADILLAC_CORNERS[i]].y+pose.wheelLifts[CADILLAC_CORNERS[i]];
  rig.updateCylinders();
  for(const corner of CADILLAC_CORNERS){
    const start=root.worldToLocal(root.getObjectByName('Hydraulic_'+corner+'_ChassisMount')!.getWorldPosition(new T.Vector3()));
    const end=root.worldToLocal(root.getObjectByName('Hydraulic_'+corner+'_HubMount')!.getWorldPosition(new T.Vector3()));
    const direction=end.clone().sub(start).normalize();
    for(const section of ['Barrel','Rod']){
      const part=root.getObjectByName('Hydraulic_'+corner+'_'+section)!;
      assert(Number.isFinite(part.scale.y)&&part.scale.y>0);
      near(new T.Vector3(0,1,0).applyQuaternion(part.quaternion).distanceTo(direction),0,'cylinder tracks its physical mounts');
    }
  }
  rig.reset();rig.update(.1,new Set(['PageUp','KeyU']));assert.deepEqual(rig.suspension.targets,all(0),'keyboard input cannot bypass the guarded ride request path');
  assert(!rig.hop(true,NaN));assert(!rig.hop(true,.25));assert(rig.hop(true,0));
  rig.update(.1,new Set(),true);assert.equal(rig.suspension.snapshot().hop,null);
});
