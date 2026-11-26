import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CadillacHydraulics} from './cadillacHydraulics.ts';
import {HYDRAULIC_SMART_POSES} from './hydraulicController.ts';
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
const advanceExact=(suspension:CadillacSuspension,seconds:number)=>{
  while(seconds>LIMITS.maxFrameSeconds){suspension.update(LIMITS.maxFrameSeconds);seconds-=LIMITS.maxFrameSeconds;}
  if(seconds>0)suspension.update(seconds);
};
// Invert cubic smoothstep independently to compare the uniformly spaced
// collision samples with the exact times the animation reaches those points.
const spatialTime=(weight:number)=>.5-Math.sin(Math.asin(1-2*weight)/3);
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
  const duration=1.5*.24/LIMITS.actuatorMetresPerSecond;
  for(let i=1;i<path.length;i++){advanceExact(s,duration*(spatialTime(i/20)-spatialTime((i-1)/20)));nearPose(s.pose,path[i]);}
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

test('elapsed recovery leaves ordinary 10, 30, 60 and 120 Hz easing and hop timing exact',()=>{
  for(const fps of [10,30,60,120])for(const hop of [false,true]){
    const bounded=new CadillacSuspension(),elapsed=new CadillacSuspension();
    for(const suspension of [bounded,elapsed]){
      if(hop)suspension.hop('front');else suspension.setTargets(HYDRAULIC_SMART_POSES['front-up']);
    }
    for(let frame=0;frame<fps*2;frame++){
      bounded.update(1/fps);elapsed.advanceElapsed(1/fps);
      assert.deepEqual(elapsed.snapshot(),bounded.snapshot());
    }
  }
});

test('a single stall preserves eligible time while presenting the hop apex before landing',()=>{
  const recovered=new CadillacSuspension(),reference=new CadillacSuspension();
  recovered.hop('all');reference.hop('all');recovered.advanceElapsed(.6);advanceExact(reference,.6);
  near(recovered.snapshot().hopProgress,.5);assert.equal(recovered.snapshot().hop,'all');
  recovered.advanceElapsed(1/60);reference.update(1/60);
  nearPose(recovered.pose,reference.pose);near(recovered.snapshot().hopProgress,reference.snapshot().hopProgress);
  for(let frame=1;frame<18;frame++){recovered.advanceElapsed(1/60);reference.update(1/60);}
  assert.equal(recovered.snapshot().hop,null);assert(recovered.readyForDrive);
  nearPose(recovered.pose,reference.pose);
  const uneven=new CadillacSuspension();uneven.hop('front');
  uneven.advanceElapsed(.3);near(uneven.snapshot().hopProgress,1/3);
  uneven.advanceElapsed(.3);near(uneven.snapshot().hopProgress,.5);
  uneven.advanceElapsed(.3);assert.equal(uneven.snapshot().hop,null,'three real .3 second intervals complete the .9 second motion');
});

test('severe stalls present every hop apex and landing on both actual rig layouts without retaining idle credit',()=>{
  for(const anchors of [SILVER_CADILLAC_SUSPENSION_ANCHORS,hydraulicAnchors])for(const mode of ['all','front','rear'] as const){
    const s=new CadillacSuspension(anchors),path=s.previewHop(mode,2);assert(s.hop(mode));
    s.advanceElapsed(13);near(s.snapshot().hopProgress,.5);nearPose(s.pose,path[1]);assert(!s.readyForDrive);
    const apex=s.snapshot();for(const seconds of [0,-1,NaN,Infinity])s.advanceElapsed(seconds);
    assert.deepEqual(s.snapshot(),apex,'a new positive eligible interval is required to spend retained motion time');
    s.advanceElapsed(9);nearPose(s.pose,path[2]);assert(s.readyForDrive);assert.equal(s.snapshot().hop,null);
    near(s.snapshot().cooldown,LIMITS.hopCooldownSeconds,'pre-landing credit cannot consume the new cooldown');
    s.advanceElapsed(.1);near(s.snapshot().cooldown,.35);assert(!s.hop(mode));
    s.advanceElapsed(13);assert(s.hop(mode));s.advanceElapsed(1/60);
    near(s.snapshot().hopProgress,(1/60)/LIMITS.hopSeconds,'the new hop cannot inherit idle time');
  }
});

test('static recovery preserves its midpoint and discards credit only for new commands or eligibility boundaries',()=>{
  const target=HYDRAULIC_SMART_POSES['front-up'],s=new CadillacSuspension();s.setTargets(target);s.advanceElapsed(13);
  for(const corner of CADILLAC_CORNERS)near(s.snapshot().current[corner],target[corner]/2);
  assert(!s.settled);const midpoint=s.snapshot();
  assert(s.setTargets(target));assert(!s.setTargets({FL:NaN}));s.advanceElapsed(0);
  assert.deepEqual(s.snapshot(),midpoint);
  s.advanceElapsed(1/60);assert(s.settled);assert.deepEqual(s.snapshot().current,target,'identical/rejected requests preserve existing credit');
  s.reset();s.setTargets(target);s.advanceElapsed(13);const from=s.snapshot().current;
  assert(s.setTargets(HYDRAULIC_SMART_POSES['back-up']));assert.deepEqual(s.snapshot().current,from);
  s.advanceElapsed(1/60);assert(!s.settled);
  for(const corner of CADILLAC_CORNERS)assert(Math.abs(s.snapshot().current[corner]-from[corner])<=LIMITS.actuatorMetresPerSecond/60+1e-10,'a retarget cannot spend the old segment credit');
  const resumed=new CadillacSuspension(),reference=new CadillacSuspension();
  resumed.setTargets(target);reference.setTargets(target);resumed.advanceElapsed(13);
  advanceExact(reference,1.5*.22/LIMITS.actuatorMetresPerSecond/2);
  resumed.clearCatchUp();resumed.advanceElapsed(1/60);reference.update(1/60);
  nearPose(resumed.pose,reference.pose);assert(!resumed.settled,'resume cannot replay the excluded interval');
  resumed.advanceElapsed(13,true);assert(resumed.settled);resumed.reset();resumed.setTargets(target);resumed.advanceElapsed(1/60);
  assert(resumed.snapshot().current.FL<.01,'reduced motion and reset both discard old credit');
});

test('catch-up presents landing before queued leveling and ages cooldown only with fresh post-landing time',()=>{
  const s=new CadillacSuspension(hydraulicAnchors),initial={FL:.24,FR:0,RL:0,RR:0};
  s.setTargets(initial,true);const landed=s.preview(initial);assert(s.hop('all'));s.settle();
  s.advanceElapsed(13);near(s.snapshot().hopProgress,.5);assert(s.levelingQueued);
  s.settle();s.advanceElapsed(13);assert.equal(s.snapshot().hop,null);nearPose(s.pose,landed);
  assert.deepEqual(s.snapshot().current,initial);assert.deepEqual(s.targets,all(.06));assert(!s.readyForDrive);
  near(s.snapshot().cooldown,.45);s.advanceElapsed(1/60);
  for(const corner of CADILLAC_CORNERS)near(s.snapshot().current[corner],(initial[corner]+.06)/2);
  assert(!s.readyForDrive);near(s.snapshot().cooldown,.45-1/60);
  s.advanceElapsed(1/60);assert(s.readyForDrive);assert.deepEqual(s.snapshot().current,all(.06));near(s.snapshot().cooldown,.45-2/60);
});

test('catch-up work remains bounded and every actual internal step keeps the actuator speed limit',t=>{
  const s=new CadillacSuspension(),target=HYDRAULIC_SMART_POSES['front-up'];s.setTargets(target);
  const integration=s as unknown as {updateStep:(seconds:number,reduced:boolean,ageCooldown:boolean)=>CadillacSuspensionPose};
  const update=integration.updateStep.bind(s);let steps=0;
  t.mock.method(integration,'updateStep',(seconds:number,reduced:boolean,ageCooldown:boolean)=>{
    assert(seconds>0&&seconds<=LIMITS.maxFrameSeconds);const before=s.snapshot().current;
    const pose=update(seconds,reduced,ageCooldown);steps++;
    for(const corner of CADILLAC_CORNERS){
      const current=s.snapshot().current[corner];
      assert(Math.abs(current-before[corner])<=LIMITS.actuatorMetresPerSecond*seconds+1e-10);
      near(current/target[corner],s.snapshot().current.FL/target.FL,'each substep stays on the preflight segment');
    }
    nearPose(pose,s.preview(s.snapshot().current));return pose;
  });
  s.advanceElapsed(Number.MAX_VALUE);assert(steps>1&&steps<=5);assert(!s.settled);
  const first=steps;s.advanceElapsed(Number.MAX_VALUE);assert(steps-first<=5);assert(s.settled);
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
    const levelDuration=1.5*Math.max(...Object.values(initial).map(value=>Math.abs(value-height)))/LIMITS.actuatorMetresPerSecond;
    for(let index=1;index<path.length;index++){
      const levelIndex=index-24;
      advanceExact(s,index<=24?hopStep:levelDuration*(spatialTime(levelIndex/24)-spatialTime((levelIndex-1)/24)));nearPose(s.pose,path[index]);
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

test('Smart Pump retargets preserve the displayed pose and the new collision segment on both actual hub layouts',()=>{
  for(const anchors of [SILVER_CADILLAC_SUSPENSION_ANCHORS,hydraulicAnchors]){
    const s=new CadillacSuspension(anchors);
    for(const target of [HYDRAULIC_SMART_POSES['front-up'],HYDRAULIC_SMART_POSES['back-up'],HYDRAULIC_SMART_POSES.pancake]){
      const before=s.snapshot(),path=s.previewPath(target,16);
      assert(s.setTargets(target));nearPose(s.pose,before.pose);nearPose(path[0],before.pose);
      assert.deepEqual(s.snapshot().current,before.current,'retarget starts at the visible actuator positions');
      for(const dt of [.04,.06,.03]){
        const prior=s.snapshot().current;s.update(dt);const now=s.snapshot().current;
        const leading=CADILLAC_CORNERS.reduce((key,next)=>Math.abs(target[next]-before.current[next])>Math.abs(target[key]-before.current[key])?next:key,CADILLAC_CORNERS[0]);
        const span=target[leading]-before.current[leading],weight=span?(now[leading]-before.current[leading])/span:0;
        assert(weight>=0&&weight<=1);
        for(const corner of CADILLAC_CORNERS){
          near(now[corner],before.current[corner]+(target[corner]-before.current[corner])*weight);
          assert(Math.abs(now[corner]-prior[corner])<=LIMITS.actuatorMetresPerSecond*dt+1e-10);
        }
        nearPose(s.pose,s.preview(now));
      }
    }
    s.update(0,true);assert(s.readyForDrive);assert.deepEqual(s.snapshot().current,HYDRAULIC_SMART_POSES.pancake);
  }
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
