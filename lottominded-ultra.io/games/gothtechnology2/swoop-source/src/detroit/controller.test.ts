import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {FollowCamera} from './followCamera.ts';
import type {RideActions} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
function advance(c:RideController,seconds:number,actions:Partial<RideActions>={}){for(let i=0;i<seconds*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...actions});return c.snapshot();}
test('holding the brake stops without unexpectedly reversing; releasing and reapplying reverses',()=>{
  const c=new RideController(flat);advance(c,2,{throttle:1});const stopped=advance(c,4,{throttle:-1});
  assert.equal(stopped.speed,0);advance(c,.1);assert.ok(advance(c,2,{throttle:-1}).speed< -1);
});
test('hop input during flight cannot add a second impulse',()=>{
  const c=new RideController(flat);advance(c,.8,{crouch:true});c.step(1/120,{...NEUTRAL_ACTIONS,hop:true,crouch:true});
  advance(c,.2,{hop:true});assert.equal(c.snapshot().hops,1);assert.equal(c.snapshot().grounded,false);
  advance(c,2);assert.equal(c.snapshot().landings,1);assert.equal(c.snapshot().grounded,true);
});
test('visual lean points into a forward carve and ground roll follows a bank normal',()=>{
  const c=new RideController(flat);advance(c,2,{throttle:.5});advance(c,.5,{throttle:.3,steer:.5});
  const p=createPose();c.writePose(p);assert.ok(p.headingY<Math.PI);assert.ok(p.rollAngle<0);
  const bank:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.normal={x:-.2,y:Math.sqrt(.96),z:0};return out;}};
  const b=new RideController(bank,{spawn:{position:{x:0,y:0,z:0},headingY:0}});advance(b,.1);b.writePose(p);assert.ok(p.groundRoll>0);
});
test('a charged jump rises higher than a tap hop',()=>{
  const heights=[false,true].map(charge=>{const c=new RideController(flat);if(charge)advance(c,1,{crouch:true});c.step(1/120,{...NEUTRAL_ACTIONS,hop:true});let high=0;for(let i=0;i<240;i++){c.step(1/120,NEUTRAL_ACTIONS);high=Math.max(high,c.groundClearance);}return high;});
  assert.ok(heights[0]>.15);assert.ok(heights[1]>heights[0]+.4);
});
test('invalid device axes cannot introduce non-finite rider transforms',()=>{
  const c=new RideController(flat);advance(c,1,{throttle:NaN,steer:Infinity});const pose=createPose();c.writePose(pose);
  assert.ok(Object.values(pose).every(Number.isFinite));assert.equal(pose.speed,0);
});
test('recover preserves session distance while resetting fall pose and speed',()=>{
  let obstacle=false;const terrain={...flat,raycastObstacle:()=>obstacle?0:null};const c=new RideController(terrain);
  advance(c,2,{throttle:1});obstacle=true;advance(c,.2,{throttle:1});assert.ok(c.crashed);
  const distance=c.snapshot().distanceTravelled;obstacle=false;c.step(1/120,{...NEUTRAL_ACTIONS,reset:true});
  const pose=createPose();c.writePose(pose);assert.equal(c.crashed,false);assert.equal(c.snapshot().distanceTravelled,distance);
  assert.ok(pose.crashBlend>0,"recovery begins with a get-up pose");assert.equal(pose.speed,0);
  advance(c,3,{throttle:1});c.writePose(pose);assert.equal(pose.crashBlend,0);assert.equal(c.crashed,false);
});
test('follow camera tracks a turn and widens with speed without non-finite coordinates',()=>{
  const p=createPose(),camera=new FollowCamera(flat);camera.reset(p);p.headingY=Math.PI/2;p.speed=12;
  for(let i=0;i<600;i++)camera.step(1/120,p);
  assert.ok(camera.eye.x< -5);assert.ok(Math.abs(camera.eye.z)<.1);assert.ok(camera.fov>60);
  assert.ok([...Object.values(camera.eye),...Object.values(camera.target)].every(Number.isFinite));
});
test('follow camera stays in front of a blocking wall and above terrain',()=>{
  const terrain:TerrainSampler={...flat,raycast:(_o,_d,max)=>max>1.5?1.5:null};
  const p=createPose(),camera=new FollowCamera(terrain);camera.reset(p);camera.step(1/120,p);
  assert.ok(Math.hypot(camera.eye.x-camera.target.x,camera.eye.y-camera.target.y,camera.eye.z-camera.target.z)<1.5);
  assert.ok(camera.eye.y>=.35);
});
