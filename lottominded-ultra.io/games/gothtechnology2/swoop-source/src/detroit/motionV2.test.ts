import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import type {RideActions} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {advanceSpring,spring,RIDE_TUNING} from './rideDynamics.ts';
const dt=1/120;
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
const ride=(world=flat)=>new RideController(world,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
function tick(c:RideController,a:Partial<RideActions>={}){c.step(dt,{...NEUTRAL_ACTIONS,...a});}
function run(c:RideController,n:number,a:Partial<RideActions>={}){for(let i=0;i<Math.round(n/dt);i++)tick(c,a);}
test('walking-speed carving fits a lane and the rider looks into the turn',t=>{
  const c=ride();for(let i=0;i<720;i++)tick(c,{throttle:(1.4-c.snapshot().speed)*.8,steer:1});
  const s=c.snapshot(),p=createPose();c.writePose(p);const radius=Math.abs(s.speed/s.yawRate);
  assert.ok(radius<1.1&&radius>.35);assert.ok(p.riderLookYaw*p.yawRate>0);
  t.diagnostic('Walking-speed turn radius: '+radius.toFixed(2)+' m');
});
test('mirrored steering produces mirrored trajectories and no stationary orbit',()=>{
  const a=ride(),b=ride();run(a,2,{steer:1});run(b,2,{steer:-1});assert.equal(a.snapshot().headingY,0);
  run(a,4,{throttle:.3,steer:1});run(b,4,{throttle:.3,steer:-1});
  assert.ok(Math.abs(a.snapshot().position.x+b.snapshot().position.x)<1e-9);
  assert.ok(Math.abs(a.snapshot().position.z-b.snapshot().position.z)<1e-9);
});
test('steering reversal is continuous and clean full-speed carving has no artificial wobble',()=>{
  const c=ride(),p=createPose();run(c,6,{throttle:1});run(c,1,{steer:1,throttle:.5});let maxDelta=0,old=c.snapshot().yawRate;
  for(let i=0;i<360;i++){tick(c,{steer:-1,throttle:.5});c.writePose(p);maxDelta=Math.max(maxDelta,Math.abs(p.yawRate-old));old=p.yawRate;assert.equal(p.wobble,0);assert.ok(Math.abs(p.rollAngle)<=RIDE_TUNING.maxLean+.001);}
  assert.ok(maxDelta<.07);assert.equal(c.crashed,false);assert.ok(p.yawRate>0);
});
test('air steering rotates the rider without redirecting or accelerating flight',()=>{
  const a=ride(),b=ride();for(const c of [a,b]){run(c,1.5,{throttle:.8});run(c,.8,{crouch:true});tick(c,{hop:true});for(let i=0;i<20&&c.snapshot().grounded;i++)tick(c);assert.equal(c.snapshot().grounded,false);}
  run(a,.3,{throttle:1,steer:1,crouch:true});run(b,.3,{throttle:-1});
  const x=a.snapshot(),y=b.snapshot();assert.equal(x.grounded,false);
  assert.ok(Math.abs(x.headingY-y.headingY)>.4);
  assert.ok(Math.abs(x.position.x-y.position.x)<1e-9&&Math.abs(x.position.z-y.position.z)<1e-9);
  assert.deepEqual(x.velocity,y.velocity);
});
test('a fast sideways landing falls once and recovers cleanly',()=>{
  const c=ride();run(c,1.8,{throttle:1});run(c,.8,{crouch:true});tick(c,{hop:true});run(c,.22,{steer:1,crouch:true});run(c,2);
  assert.equal(c.snapshot().crashCause,'sideways landing');assert.equal(c.snapshot().crashes,1);
  tick(c,{reset:true});assert.equal(c.crashed,false);assert.equal(c.snapshot().speed,0);assert.equal(c.snapshot().grounded,true);
});
test('holding hop through landing cannot repeatedly bounce',()=>{
  const c=ride();run(c,.8,{crouch:true});run(c,4,{hop:true,hopHeld:true,crouch:true});
  assert.equal(c.snapshot().hops,1);assert.equal(c.snapshot().landings,1);assert.equal(c.snapshot().grounded,true);
});
test('a new hop pressed just before touchdown is buffered to the next ground contact',()=>{
  const c=ride();tick(c,{hop:true});let buffered=false;
  for(let i=0;i<150;i++){const s=c.snapshot();const trigger=!buffered&&!s.grounded&&s.velocity.y<0&&c.groundClearance<.06;if(trigger)buffered=true;tick(c,{hop:trigger});if(c.snapshot().hops===2)break;}
  assert.ok(buffered);assert.equal(c.snapshot().hops,2);assert.equal(c.snapshot().landings,1);
});
test('a hop just after rolling off an edge gets coyote time',()=>{
  const edge:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=z<2?.6:0;return out;}};
  const c=ride(edge);let left=false;
  for(let i=0;i<300;i++){tick(c,{throttle:.8});if(!c.snapshot().grounded){left=true;break;}}
  assert.ok(left);run(c,.025);tick(c,{hop:true});assert.equal(c.snapshot().hops,1);assert.ok(c.snapshot().velocity.y>2);
});
test('landing drives compression and suspension, then settles without persistent jitter',t=>{
  const c=ride(),p=createPose();run(c,.8,{crouch:true});tick(c,{hop:true});let peak=0,lowest=0;
  for(let i=0;i<360;i++){tick(c);c.writePose(p);peak=Math.max(peak,p.landingCompression);lowest=Math.min(lowest,p.suspensionOffset);}
  assert.ok(peak>.7);assert.ok(lowest<-.025);assert.ok(p.landingCompression<.001&&Math.abs(p.suspensionOffset)<.001);
  assert.equal(c.snapshot().landings,1);t.diagnostic('Landing compression peak: '+peak.toFixed(3)+'; suspension travel: '+(-lowest*100).toFixed(1)+' cm');
});
test('forward drive has a stable soft top speed and braking brings it to rest',t=>{
  const c=ride();run(c,8,{throttle:1});const speed8=c.snapshot().speed;run(c,12,{throttle:1});const top=c.snapshot().speed,start=c.snapshot().distanceTravelled;
  let stopTime=0;for(let i=0;i<600;i++){tick(c,{throttle:-1});stopTime+=dt;if(!c.snapshot().speed)break;}
  assert.ok(speed8>18&&top<21.8&&top>19);assert.equal(c.snapshot().speed,0);assert.ok(stopTime<3);
  t.diagnostic('8 s speed: '+(speed8*3.6).toFixed(1)+' km/h; top: '+(top*3.6).toFixed(1)+' km/h; stop: '+stopTime.toFixed(2)+' s / '+(c.snapshot().distanceTravelled-start).toFixed(1)+' m');
});
test('fixed 120 Hz simulation produces the same motion at 30, 60 and 144 rendered frames per second',()=>{
  const snapshots=[30,60,144].map(fps=>{const c=ride();let acc=0,steps=0;for(let frame=0;frame<fps*6;frame++){acc+=1/fps;while(acc+1e-10>=dt){tick(c,{throttle:steps<480?.5:-1,steer:steps>180&&steps<350?.4:0,crouch:steps>350&&steps<400,hop:steps===400});steps++;acc-=dt;}}assert.equal(steps,720);return c.snapshot();});
  assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[1],snapshots[2]);
});
test('critical spring solves a constant target consistently across update frequencies',()=>{
  const values=[30,60,120].map(hz=>{const s=spring();for(let i=0;i<hz;i++)advanceSpring(s,1,8,1/hz);return s.value;});
  assert.ok(Math.max(...values)-Math.min(...values)<1e-10);
});
