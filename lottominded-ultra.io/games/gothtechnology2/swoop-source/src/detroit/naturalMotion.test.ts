import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,createPose,NEUTRAL_ACTIONS} from './controller.ts';
import {NaturalMotionEngine} from './naturalMotion.ts';
import {advanceDrive,RIDE_TUNING} from './rideDynamics.ts';
import {stanceTargets} from './riderMotion.ts';
import type {TerrainSampler} from './terrain.ts';

const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
test('hop arms sweep from preload into lift and relaxed wrists settle after landing',()=>{
  const engine=new NaturalMotionEngine(),p=createPose();engine.step(1/120,p,0);
  p.hopPreload=1;p.crouch=.5;
  for(let i=0;i<90;i++)engine.step(1/120,p,0);
  const preload={y:p.handLY,z:p.handLZ};
  p.hopPreload=0;p.takeoffExtension=1;p.airBlend=1;p.crouch=0;
  for(let i=0;i<30;i++)engine.step(1/120,p,0);
  assert.ok(p.handLY>preload.y+.04&&p.handLZ>preload.z+.04,'hands should lift and reach forward with takeoff');
  assert.ok(p.wristL<-.03&&p.wristR<-.03,'wrists should hang softly during the reach');
  assert.ok(Math.abs(p.wristL)<=.24&&Math.abs(p.wristR)<=.24);
  Object.assign(p,createPose());for(let i=0;i<900;i++)engine.step(1/120,p,0);
  assert.ok(Math.abs(p.wristL)<1e-6&&Math.abs(p.wristR)<1e-6,'hands must settle without perpetual flutter');
});
test('opposite carving directions mirror hand reach and shoulder counterbalance',()=>{
  const run=(side:number)=>{const p=createPose(),engine=new NaturalMotionEngine();engine.step(1/120,p,0);
    Object.assign(p,{speed:2,turnIntent:side*.8,rollAngle:side*.25,rollVelocity:side*.7,riderTurnTwist:side*-.2,riderLookYaw:side*-.4});
    for(let i=0;i<60;i++)engine.step(1/120,p,0);return p;};
  const left=run(1),right=run(-1);
  for(const [a,b] of [[left.handLX,-right.handRX],[left.handLY,right.handRY],[left.handLZ,right.handRZ],[left.wristL,right.wristR],[left.shoulderL,right.shoulderR]])assert.ok(Math.abs(a-b)<1e-9);
});
test('tap hop compresses before leaving the ground, then extends and absorbs its landing',()=>{
  const c=new RideController(flat),p=createPose();let preload=0,compression=0,extension=0;
  c.step(1/120,{...NEUTRAL_ACTIONS,hop:true});assert.equal(c.snapshot().grounded,true);
  for(let i=0;i<240;i++){
    c.step(1/120,NEUTRAL_ACTIONS);c.writePose(p);
    if(c.snapshot().grounded&&c.snapshot().hops===0)preload=Math.max(preload,p.hopPreload);
    extension=Math.max(extension,p.takeoffExtension);compression=Math.max(compression,p.landingCompression);
  }
  assert.ok(preload>.8&&extension>.8&&compression>.3);assert.equal(c.snapshot().hops,1);assert.equal(c.snapshot().landings,1);
});
test('motor launch is jerk-limited while emergency braking remains responsive',()=>{
  let motor=0;
  for(let i=0;i<120;i++){const next=advanceDrive(motor,7.6,false,1/120);assert.ok(next>=motor&&next<=7.6);assert.ok((next-motor)*120<=RIDE_TUNING.launchJerk+1e-9);motor=next;}
  assert.equal(motor,7.6);
  for(let i=0;i<28;i++)motor=advanceDrive(motor,-9.2,true,1/120);
  assert.equal(motor,-9.2,'brake force should reverse within 0.24 s');
});
test('gaze leads the torso, arms ease through a reversal, and the body settles at rest',()=>{
  const engine=new NaturalMotionEngine(),p=createPose();engine.step(1/120,p,0);
  p.speed=7;p.turnIntent=.8;p.rollAngle=.4;p.riderTurnTwist=-.2;p.riderLookYaw=-.4;p.rollVelocity=1;
  for(let i=0;i<15;i++)engine.step(1/120,p,3);
  assert.ok(Math.abs(p.bodyLook/.4)>Math.abs(p.bodyTwist/.2)+.2,'eyes should anticipate the chest');
  assert.ok(p.bodyChestRoll<p.bodyHeadRoll,'head should compensate more bank than chest');
  const before=[p.handLX,p.handLY,p.handLZ,p.handRX,p.handRY,p.handRZ];
  p.turnIntent=-.8;p.rollAngle=-.4;p.riderTurnTwist=.2;p.riderLookYaw=.4;p.rollVelocity=-1;
  engine.step(1/120,p,-5);
  [p.handLX,p.handLY,p.handLZ,p.handRX,p.handRY,p.handRZ].forEach((v,i)=>assert.ok(Math.abs(v-before[i])<.006,'hands must not pop at direction changes'));
  Object.assign(p,createPose());
  for(let i=0;i<720;i++)engine.step(1/120,p,0);
  const target=stanceTargets(p);
  assert.ok(Math.abs(p.bodyDrop-target.drop)<1e-6);assert.ok(Math.abs(p.bodyPitch-target.pitch)<1e-6);
  assert.ok(Math.abs(p.bodyLook)<1e-6&&Math.abs(p.bodyTwist)<1e-6);
  assert.ok(Math.abs(p.handLZ-target.hands[0].z)<1e-6);
});
test('complete body state replays identically at 30, 60 and 144 render Hz and after reset',()=>{
  const c=new RideController(flat),p=createPose();
  const run=(hz:number)=>{
    c.reset();let accumulator=0,tick=0;
    for(let frame=0;frame<hz*6;frame++){
      accumulator+=1/hz;
      while(accumulator+1e-10>=1/120){
        c.step(1/120,{...NEUTRAL_ACTIONS,throttle:tick<300?.6:-.5,steer:Math.sin(tick/120)*.6,crouch:tick>400&&tick<460,hop:tick===460});
        accumulator-=1/120;tick++;
      }
    }
    c.writePose(p);return {...p};
  };
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(60),run(144));assert.deepEqual(run(144),run(30));
});

test('arm balance has inertia through a turn reversal and settles without a looping sway',()=>{
  const engine=new NaturalMotionEngine(),p=createPose();engine.step(1/120,p,0);
  p.speed=7;p.lateralAcceleration=-6;
  for(let i=0;i<180;i++)engine.step(1/120,p,0);
  assert.ok(p.armBank>.4);
  const before=p.armBank;p.lateralAcceleration=6;engine.step(1/120,p,0);
  assert.ok(p.armBank>0&&Math.abs(p.armBank-before)<.005,'arms cannot instantaneously follow the new acceleration');
  for(let i=0;i<240;i++)engine.step(1/120,p,0);
  assert.ok(p.armBank<-.4);
  p.lateralAcceleration=0;
  for(let i=0;i<720;i++)engine.step(1/120,p,0);
  assert.ok(Math.abs(p.armBank)<1e-6,'a settled rider should not keep oscillating');
});

test('road speed brings hands into a compact stance while tuck gathers them ahead of the torso',()=>{
  const p=createPose();p.speed=3;const slow=stanceTargets(p);
  p.speed=16;const road=stanceTargets(p);
  assert.ok(road.drop>slow.drop&&road.pitch>slow.pitch,'road posture should soften the knees and hinge slightly');
  assert.ok(road.hands.every((hand,i)=>hand.y>slow.hands[i].y+.04&&hand.z>slow.hands[i].z+.03));
  p.crouch=1;p.tuck=1;const tuck=stanceTargets(p);
  assert.ok(tuck.shift<road.shift-.05&&tuck.drop>road.drop+.2,'hips move back and down into tuck');
  assert.ok(tuck.hands.every((hand,i)=>hand.z>road.hands[i].z+.15&&hand.y>road.hands[i].y+.10));
  p.speed=-4;p.crouch=0;p.tuck=0;const reverse=stanceTargets(p);
  assert.equal(reverse.pitch,slow.pitch,'reverse must not trigger the forward road tuck');
});
test('the knees anticipate an approaching raised seam without treating a constant grade as a bump',()=>{
  const terrain=(wave:boolean):TerrainSampler=>({...flat,sampleGround(_x,z,out){
    const slope=wave?.025*3*Math.cos(z*3):.05;
    out.height=wave?.025*Math.sin(z*3):z*.05;out.surface='pavement';out.offCourse=false;
    const n=Math.hypot(1,slope);Object.assign(out.normal,{x:0,y:1/n,z:-slope/n});return out;
  }});
  const peak=(wave:boolean)=>{const c=new RideController(terrain(wave)),p=createPose();let bend=0;
    for(let i=0;i<720;i++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.35});c.writePose(p);bend=Math.max(bend,p.terrainBend);assert.ok(!c.crashed);}
    return bend;};
  assert.ok(peak(false)<1e-6);assert.ok(peak(true)>.015);
});
