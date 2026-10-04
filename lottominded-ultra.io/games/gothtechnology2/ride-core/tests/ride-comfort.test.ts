import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {gentleSteering,riderEyeMotion} from '../src/rideComfort.ts';
import {createPose,RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {NaturalMotionEngine} from '../src/naturalMotion.ts';
import {BalanceEngine} from '../src/balanceEngine.ts';
import type {TerrainSampler} from '../src/terrain.ts';
test('steering rejects drift, softens the centre and retains symmetric full lock',()=>{
 assert.equal(gentleSteering(.03),0);assert.equal(gentleSteering(NaN),0);
 assert.ok(gentleSteering(.3)<.18);assert.equal(gentleSteering(1),1);assert.equal(gentleSteering(-1),-1);
 let last=0;for(let i=0;i<=100;i++){const v=gentleSteering(i/100);assert.ok(v>=last);assert.equal(gentleSteering(-i/100),-v);last=v;}
});

test('eye controls give partial stick more range, retain fine control and ignore stick drift',()=>{
 assert.equal(gentleSteering(.03,true),0);assert.equal(gentleSteering(NaN,true),0);
 assert.ok(gentleSteering(.5,true)>gentleSteering(.5)*1.25);
 assert.ok(gentleSteering(.1,true)<.05);
 let last=0;for(let i=0;i<=100;i++){const v=gentleSteering(i/100,true);assert.ok(v>=last&&v<=1);assert.equal(gentleSteering(-i/100,true),-v);last=v;}
 assert.equal(gentleSteering(1,true),1);assert.equal(gentleSteering(-1,true),-1);
});

test('eye mode changes carve direction sooner while keeping the same full-lock and airborne limits',()=>{
 const reversal=(eyeControl:boolean)=>{
  const engine=new BalanceEngine(),a={speed:6,steer:-.5,grip:.9,grounded:true,crouch:false,eyeControl};
  for(let i=0;i<120;i++)engine.step(1/120,a);
  a.steer=.5;
  for(let i=1;i<=120;i++)if(engine.step(1/120,a).yawRate<0)return i/120;
  return Infinity;
 };
 assert.ok(reversal(true)+.04<reversal(false),'countersteering must react measurably earlier');
 for(const grounded of [true,false]){
  const yaw=(eyeControl:boolean)=>{const e=new BalanceEngine();let out;for(let i=0;i<240;i++)out=e.step(1/120,{speed:6,steer:1,grip:.9,grounded,crouch:false,eyeControl});return out!.yawRate;};
  assert.ok(Math.abs(yaw(true)-yaw(false))<.001,'eye control does not increase maximum yaw');
 }
});
test('eyes lean forward at speed, back under braking and obey reduced motion',()=>{
 const p=createPose();p.speed=10;p.riderPitch=.2;
 const fast=riderEyeMotion(p);assert.ok(fast.pitch<0);
 p.riderPitch=-.2;p.brakeAmount=1;assert.ok(riderEyeMotion(p).pitch>0);
 p.rollAngle=.5;assert.ok(riderEyeMotion(p).roll>0);
 assert.ok(Math.abs(riderEyeMotion(p,true).roll)<Math.abs(riderEyeMotion(p).roll)*.2);
});

test('rider eyes bank toward the actual left/right turn at every compass heading',()=>{
 const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const steer of [-.4,.4])for(const eyeControl of [false,true]){
  const controller=new RideController(flat,{spawn:{position:{x:0,y:0,z:0},headingY:heading}});
  for(let i=0;i<240;i++)controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5});
  for(let i=0;i<60;i++)controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:.3,steer,eyeControl});
  const p=createPose();controller.writePose(p);assert.equal(controller.crashed,false);
  const camera=new T.PerspectiveCamera();camera.lookAt(Math.sin(p.headingY),0,Math.cos(p.headingY));
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const velocity=new T.Vector3(Math.sin(p.headingY),0,Math.cos(p.headingY));
  const startRight=new T.Vector3(-Math.cos(heading),0,Math.sin(heading));
  assert.ok(velocity.dot(startRight)*steer>0,'right input turns toward screen right');
  camera.rotateZ(riderEyeMotion(p).roll);
  const eyeUp=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const bodyUp=new T.Vector3(0,1,0).applyAxisAngle(new T.Vector3(0,0,1),-p.rollAngle).applyAxisAngle(new T.Vector3(0,1,0),p.headingY);
  assert.ok(eyeUp.dot(right)*steer>0,'camera leans into the turn');
  assert.ok(eyeUp.dot(right)*bodyUp.dot(right)>0,'eye and body banks agree in world space');
 }
});

test('strong bumps and braking cannot force large eye rotations; reduced motion keeps a steady horizon',()=>{
 const p=createPose();Object.assign(p,{speed:35,riderPitch:2,rollAngle:2,landingCompression:2});
 for(const sign of [-1,1]){
  p.riderPitch=sign*2;p.rollAngle=sign*2;
  const normal=riderEyeMotion(p),calm=riderEyeMotion(p,true);
  assert.ok(Math.abs(normal.pitch)<=.14&&Math.abs(normal.roll)<=.16);
  assert.ok(Math.abs(calm.pitch)<.026&&Math.abs(calm.roll)<.029);
 }
});
test('idle breath is subtle, deterministic and stops with simulation time',()=>{
 const engine=new NaturalMotionEngine(),p=createPose();for(let i=0;i<120;i++)engine.step(1/120,p,0);
 const before=p.bodyPitch;for(let i=0;i<120;i++)engine.step(1/120,p,0);assert.notEqual(p.bodyPitch,before);assert.ok(Math.abs(p.bodyPitch-before)<.025);
 const snapshot={...p};engine.step(0,p,0);assert.deepEqual(p,snapshot);
});
