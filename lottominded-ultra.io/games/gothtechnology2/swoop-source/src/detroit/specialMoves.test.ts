import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import type {RideActions} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {stanceTargets} from './riderMotion.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
function step(c:RideController,seconds:number,input:Partial<RideActions>={}){for(let i=0;i<seconds*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...input});}
function moving(){const c=new RideController(flat);step(c,.7,{throttle:.55});return c;}
for(const id of [5,6])test(`ground flow ${id} stays grounded, follows a bounded path and settles before scoring`,()=>{
 const c=new RideController(flat),start=c.snapshot().headingY;step(c,.01,{trick:id});let min=0,max=0,award=0,previous=start;
 for(let i=0;i<720;i++){c.step(1/120,NEUTRAL_ACTIONS);const p=createPose();c.writePose(p);assert.equal(c.snapshot().grounded,true);assert.ok(Math.abs(p.headingY-previous)<.04);previous=p.headingY;assert.ok(Math.hypot(p.x,p.z)<2);min=Math.min(min,p.speed);max=Math.max(max,p.speed);award+=c.tricks.award;}
 assert.equal(c.crashed,false);assert.equal(c.snapshot().hops,0);assert.equal(c.tricks.completed,1);assert.equal(award,id===5?240:180);
 if(id===5)assert.ok(Math.abs(c.snapshot().headingY-start-Math.PI*2)<.02);else {assert.ok(min<-.12,'must roll backward');assert.ok(max>.12,'must roll forward');}
});
test('tuck hop preserves two planted pedals, then awards only after a clean landing',()=>{
 const c=moving();step(c,.01,{trick:7});let peak=0,award=0;
 for(let i=0;i<480;i++){c.step(1/120,NEUTRAL_ACTIONS);const p=createPose();c.writePose(p);assert.equal(p.trickFoot,0);peak=Math.max(peak,c.tricks.tuck);award+=c.tricks.award;}
 assert.ok(peak>.20);assert.equal(c.snapshot().hops,1);assert.equal(c.crashed,false);assert.equal(award,220);
});
test('ground flows reject speed and cancel on loss of support',()=>{
 const c=moving();step(c,.01,{trick:5});assert.equal(c.tricks.active,false);
 c.tricks.beginStep(0,true,false,0,0,0,.01);c.tricks.beginStep(6,true,false,0,0,0,.01);assert.equal(c.tricks.phase,'flow');c.tricks.beginStep(0,false,false,0,0,0,.01);assert.equal(c.tricks.active,false);assert.equal(c.tricks.groundYaw,0);
});
test('fast road posture lowers the hips and bends the arms without changing slow relaxed stance',()=>{
 const p=createPose(),slow=stanceTargets(p);p.speed=20;const fast=stanceTargets(p);assert.ok(fast.drop>slow.drop+.04);assert.ok(fast.pitch>slow.pitch+.1);assert.ok(fast.hands[0].y>slow.hands[0].y+.1);assert.ok(fast.pitch<.35);
});
for(const id of [1,2,3])test(`special ${id} preloads, lifts once, preserves air momentum and banks only after settling`,()=>{
  const c=moving(),heading=c.snapshot().headingY;c.step(1/120,{...NEUTRAL_ACTIONS,trick:id});
  assert.equal(c.snapshot().grounded,true);assert.equal(c.snapshot().hops,0);
  let vx:number|undefined,vz:number|undefined,maxHeight=0,points=0,landed=false;
  for(let i=0;i<480;i++){
    c.step(1/120,NEUTRAL_ACTIONS);const s=c.snapshot();maxHeight=Math.max(maxHeight,c.groundClearance);
    if(!s.grounded){if(vx===undefined){vx=s.velocity.x;vz=s.velocity.z;}assert.ok(Math.abs(s.velocity.x-vx)<1e-9);assert.ok(Math.abs(s.velocity.z-vz!)<1e-9);}
    if(c.touchedDown){landed=true;assert.equal(c.tricks.award,0);assert.equal(c.tricks.phase,'settle');}
    if(c.tricks.award){assert.ok(landed);points+=c.tricks.award;}
  }
  assert.equal(c.snapshot().hops,1);assert.equal(c.snapshot().landings,1);assert.equal(c.crashed,false);assert.ok(maxHeight>.5);
  assert.equal(points,[0,120,200,350][id]);assert.equal(c.tricks.completed,1);
  const turn=c.snapshot().headingY-heading;assert.ok(Math.abs(turn-(id===1?0:id===2?Math.PI:Math.PI*2))<.02);
  if(id===2)assert.ok(c.snapshot().speed<0,'180 should land riding fakie, without redirecting momentum');
});
test('holding a special request cannot repeat it; high speed and midair requests are rejected',()=>{
  const c=moving();step(c,8,{trick:3});assert.equal(c.snapshot().hops,1);assert.equal(c.tricks.completed,1);
  const fast=new RideController(flat);step(fast,2,{throttle:1});step(fast,.02,{trick:3});assert.equal(fast.tricks.phase,'idle');assert.equal(fast.snapshot().hops,0);
  const air=new RideController(flat);step(air,.2,{hop:true});assert.equal(air.snapshot().grounded,false);step(air,.01,{trick:3});assert.equal(air.tricks.phase,'idle');
});
test('one-foot glide plants again before scoring and steering hard cancels it',()=>{
  const c=moving();step(c,.01,{trick:4});step(c,.6);const pose=createPose();c.writePose(pose);assert.ok(pose.trickFoot>.95);assert.equal(c.snapshot().hops,0);assert.equal(c.tricks.completed,0);
  step(c,2);c.writePose(pose);assert.ok(pose.trickFoot<.001);assert.equal(c.tricks.completed,1);
  const cancel=moving();step(cancel,.01,{trick:4});step(cancel,.5);step(cancel,.01,{steer:1});step(cancel,1);assert.equal(cancel.tricks.completed,0);assert.equal(cancel.tricks.phase,'idle');
});
test('collision cancels a trick and recovery clears the pose',()=>{
  let blocked=false;const c=new RideController({...flat,raycastObstacle:()=>blocked?0:null});step(c,.7,{throttle:.55});step(c,.01,{trick:3});step(c,.85);blocked=true;step(c,.1);assert.equal(c.crashed,true);assert.equal(c.tricks.completed,0);blocked=false;step(c,.01,{reset:true});const p=createPose();c.writePose(p);assert.equal(c.tricks.phase,'idle');assert.equal(p.trickFoot,0);assert.equal(c.crashed,false);
});
test('an early raised landing cannot award an unfinished spin',()=>{
  let height=0;const c=new RideController({...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=height;return out;}});step(c,.01,{trick:3});step(c,.93);assert.equal(c.snapshot().grounded,false);height=1.2;step(c,2);assert.equal(c.tricks.completed,0);
});

test('holding ordinary Hop cannot block the special move internal launch edge',()=>{
  const c=new RideController(flat);step(c,.1,{hopHeld:true});step(c,.01,{trick:1,hopHeld:true});step(c,3,{hopHeld:true});assert.equal(c.snapshot().hops,1);assert.equal(c.tricks.completed,1);assert.equal(c.tricks.phase,'idle');
});
