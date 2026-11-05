import test from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {RideController as SwoopController,createPose} from '../../swoop-source/src/detroit/controller.ts';
import {RideMotion} from '../../elmwood-source/src/detroit/ride-motion.ts';
import {FOOT_SPEED} from '../src/onFoot.ts';
import {footStickPace} from '../src/footStickPace.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const terrain=(height:(z:number)=>number):TerrainSampler=>({sampleGround(_x,z,out){return Object.assign(out,{height:height(z),normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null});

test('all three adapters keep walking over curb steps without entering jump or landing crouch',()=>{
 for(const height of [.08,.15,.25,.33])for(const running of [false,true]){
  const floor=terrain(z=>z>=1&&z<4?height:0);
  for(const kind of ['Royale','Swoop','Elmwood']){
   const pose=createPose(),core=kind==='Royale'?new RideController(floor):kind==='Swoop'?new SwoopController(floor):null,motion=kind==='Elmwood'?new RideMotion(floor as never):null;
   core?.reset({position:{x:0,y:0,z:0},headingY:0});
   const step=(input={})=>{if(core){core.step(1/120,{...NEUTRAL_ACTIONS,...input});core.writePose(pose);}else{motion!.update(1/120,input);Object.assign(pose,motion!.pose);}};
   step({dismount:true});for(let i=0;i<100;i++)step();let rose=false,descended=false;
   for(let i=0;i<520;i++){
    step({throttle:1,run:running});if(pose.z>=1&&pose.z<4)rose=true;if(pose.z>=4)descended=true;
    assert.equal(pose.footJump,0,kind+' treated curb '+height+' as a jump/landing');assert.equal(pose.airHeight,0);assert.equal(pose.footCrouch,0);
   }
   assert(rose&&descended,kind+' did not traverse both curb edges');
  }
 }
});

test('curb grounding preserves genuine jumping and landing from a high drop',()=>{
 for(const hop of [true,false]){
  const c=new RideController(terrain(z=>!hop&&z>=1?-.7:0));
  c.reset({position:{x:0,y:0,z:0},headingY:0});
  c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<100;i++)c.step(1/120,NEUTRAL_ACTIONS);
  let air=false,landing=false,maxHeight=0;const jumps=new Set<number>();
  for(let i=0;i<400;i++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,hop:hop&&i===0});air ||= c.poseValue.airHeight>.3;landing ||= c.poseValue.footJump===3;maxHeight=Math.max(maxHeight,c.poseValue.airHeight);jumps.add(c.poseValue.footJump);}
  assert(air&&landing,JSON.stringify({hop,maxHeight,jumps:[...jumps]}));
 }
});

test('analog travel progresses continuously from careful walk to sprint without diagonal boost',()=>{
 for(const strafing of [false,true]){
  let previous=0;
  for(let i=0;i<=1000;i++){
   const amount=i/1000,input=footStickPace(amount,0,{enabled:true,run:false,blocked:false,strafing});
   const speed=Math.abs(input.throttle)*(input.run?FOOT_SPEED.run:FOOT_SPEED.walk);
   assert(speed>=previous-1e-8);assert(speed-previous<.014,'walk/run threshold snaps speed');previous=speed;
  }
  assert.equal(previous,FOOT_SPEED.run);
 }
 for(const amount of [.1,.4,.65,.8,1]){
  const c=new RideController(terrain(()=>0));c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<100;i++)c.step(1/120,NEUTRAL_ACTIONS);
  const input=footStickPace(amount,0,{enabled:true,run:false,blocked:false,strafing:true});
  for(let i=0;i<300;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...input,facingYaw:0});
  assert(Math.abs(c.poseValue.speed-input.throttle*(input.run?FOOT_SPEED.run:FOOT_SPEED.walk))<.001);
 }
 const diagonal=footStickPace(1,1,{enabled:true,run:false,blocked:false,strafing:true});assert(Math.hypot(diagonal.throttle,diagonal.steer)<=1);
 for(const input of [{enabled:false,blocked:false},{enabled:true,blocked:true}])assert.deepEqual(footStickPace(1,0,{...input,run:false,strafing:true}),{throttle:1,steer:0,run:false});
 for(const [throttle,steer]of [[-1,0],[0,1],[.2,1]])assert(!footStickPace(throttle,steer,{enabled:true,run:false,blocked:false,strafing:true}).run);
});

test('easing the stick back from sprint blends speed instead of snapping down to walk',()=>{
 const c=new RideController(terrain(()=>0));c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<100;i++)c.step(1/120,NEUTRAL_ACTIONS);
 for(let i=0;i<300;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,run:true});
 const walk=footStickPace(.5,0,{enabled:true,run:false,blocked:false,strafing:false});let previous=c.poseValue.speed;
 for(let i=0;i<300;i++){c.step(1/120,{...NEUTRAL_ACTIONS,...walk});assert(Math.abs(c.poseValue.speed-previous)<.2,'pace change snapped velocity');previous=c.poseValue.speed;}
 assert(Math.abs(previous-FOOT_SPEED.walk*.5/.65)<.001);
 c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,crouch:true});assert(c.poseValue.speed<=1.4,'crouch still caps travel');
});
