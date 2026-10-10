import test from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {RideController as SwoopController,createPose} from '../../swoop-source/src/detroit/controller.ts';
import {RideMotion} from '../../elmwood-source/src/detroit/ride-motion.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const terrain:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
test('standalone Elmwood adapter parks, walks, jumps and mounts; right steering is not inverted',()=>{
 const motion=new RideMotion(terrain as any),step=(n:number,a={})=>{for(let i=0;i<n;i++)motion.update(1/120,a);};
 step(1,{dismount:true});step(95);assert.equal(motion.pose.footMode,2);const park=[motion.pose.parkX,motion.pose.parkZ];
 step(30,{throttle:1,steer:1});assert(motion.pose.headingY<0,'right input must reduce +Z-facing yaw');
 assert(motion.pose.x<.68,'walk towards screen right');assert.deepEqual([motion.pose.parkX,motion.pose.parkZ],park);
 step(1,{hop:true});step(20);assert(motion.pose.airHeight>.2);step(140);assert.equal(motion.pose.airHeight,0);
 step(1,{dismount:true});step(95);assert.equal(motion.pose.footMode,0);assert(Math.hypot(motion.pose.x-park[0],motion.pose.z-park[1])<.01);
 step(120,{throttle:1});assert(motion.pose.speed>1);
});
for(const [name,make] of [['Royale',()=>new RideController(terrain)],['Swoop',()=>new SwoopController(terrain)]] as const){
 test(name+' parks, walks, runs, jumps, returns and remounts without moving the wheel',()=>{
  const c=make(),p=createPose(),step=(n:number,a={})=>{for(let i=0;i<n;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...a});c.writePose(p);};
  step(1,{dismount:true});step(90);assert.equal(p.footMode,2);assert.equal(p.footBlend,1);
  const park=[p.parkX,p.parkY,p.parkZ],start={...p};step(120,{throttle:1});assert(p.speed>2.3&&p.speed<2.4);assert.deepEqual([p.parkX,p.parkY,p.parkZ],park);
  step(120,{throttle:1,run:true});assert(p.speed>5.3&&p.speed<5.5);
  step(1,{hop:true});step(16,{hopHeld:true});assert(p.airHeight>.25);step(150,{hopHeld:true});assert.equal(p.airHeight,0,'holding jump must not bunny-hop');
  step(1,{dismount:true});step(90);assert.equal(p.footMode,2,'cannot mount a distant wheel');
  // Return using the real controller, including the slower backwards speed.
  const ahead=()=> (p.x-start.x)*Math.sin(start.headingY)+(p.z-start.z)*Math.cos(start.headingY);
  let ticks=0;while(ahead()>.25&&ticks++<900)step(1,{throttle:-1});step(100);
  // Controlled movement comes back within mounting distance; no teleport command.
  assert(Math.hypot(p.x-start.x,p.z-start.z)<1.2);
  step(1,{dismount:true});step(90);assert.equal(p.footMode,0);assert(Math.hypot(p.x-park[0],p.z-park[2])<.01);
  step(120,{throttle:1});assert(p.speed>1);
 });
}
test('no dismount at speed or into blocked terrain; walking sweeps obstacles',()=>{
 const c=new RideController(terrain);for(let i=0;i<240;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});assert.equal(c.poseValue.footMode,0);
 const blocked={...terrain,raycastObstacle:()=>0};const b=new RideController(blocked);b.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});assert.equal(b.poseValue.footMode,0);
});
test('authoritative restore retains parked wheel, foot mode and jump trajectory',()=>{
 const a=new RideController(terrain),b=new RideController(terrain);
 a.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<120;i++)a.step(1/120,NEUTRAL_ACTIONS);
 a.step(1/120,{...NEUTRAL_ACTIONS,hop:true});b.restoreState(a.captureState());
 for(let i=0;i<100;i++){a.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});b.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});}
 assert.deepEqual(b.captureState(),a.captureState());
});
