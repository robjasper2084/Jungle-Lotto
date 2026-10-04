import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FallMotion,fallCameraOffset} from '../src/fallMotion.ts';
import {createPose,RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import type {TerrainSampler} from '../src/terrain.ts';
test('fall camera frames the rider and wheel midpoint in world space and leaves riding unchanged',()=>{
  const p=createPose();assert.deepEqual(fallCameraOffset(p),{x:0,y:-0,z:0});
  Object.assign(p,{headingY:Math.PI/2,crashForward:2,wheelCrashForward:.4,crashLateral:.5,wheelCrashLateral:-.3,crashBlend:1});
  const o=fallCameraOffset(p);assert.ok(Math.abs(o.x-1.2)<1e-8);assert.ok(Math.abs(o.z+.1)<1e-8);assert.equal(o.y,-.45);
});

test('fall preserves the entry posture, releases feet before impact, and settles without perpetual bouncing',()=>{
  const p=createPose();Object.assign(p,{speed:8,naturalMotion:1,bodyPitch:.3,bodyDrop:.15,rollAngle:.2});
  const fall=new FallMotion(p,'collision');fall.sample(0,p);
  assert.equal(p.bodyPitch,.3);assert.equal(p.bodyDrop,.15);assert.equal(p.crashRelease,0);
  const phases:string[]=[];
  for(const t of [0,.25,.55,1,2]){fall.sample(t,p);phases.push(fall.phase);}
  assert.deepEqual(phases,['brace','separate','impact','slide','settled']);
  fall.sample(.3,p);assert.ok(p.crashRelease>.5);assert.equal(p.crashImpactPulse,0);
  fall.sample(.57,p);assert.ok(p.crashImpactPulse>0);
  fall.sample(3,p);assert.ok(p.crashForward>p.wheelCrashForward+.6);assert.equal(p.crashRelease,1);
  assert.ok(p.crashImpactPulse<1e-8);assert.ok(p.crashLegTuck>.5);
});

test('fall direction follows travel and bank; faster crashes slide further',()=>{
  for(const speed of [-9,9])for(const side of [-1,1]){
    const p=createPose();Object.assign(p,{speed,rollAngle:side*.4});const f=new FallMotion(p,'sideways landing');f.sample(2,p);
    assert.equal(Math.sign(p.crashForward),Math.sign(speed));assert.equal(Math.sign(p.crashRoll),-side);
    assert.equal(Math.sign(p.wheelCrashLateral),-side);assert.ok(Math.abs(p.crashRoll)>Math.abs(p.crashTumble));
  }
  const distances=[2,12].map(speed=>{const p=createPose();p.speed=speed;new FallMotion(p,'collision').sample(2,p);return p.crashForward;});
  assert.ok(distances[1]>distances[0]+1);
});

test('fall transforms are continuous, finite and deterministic at fixed simulation times',()=>{
  const p=createPose();Object.assign(p,{speed:12,naturalMotion:1,rollAngle:-.4,airHeight:.8});const f=new FallMotion(p,'hard landing'),out=createPose();
  const fields=['crashForward','crashLateral','crashDrop','crashTumble','crashRoll','wheelCrashForward','wheelCrashLateral'] as const;
  let previous=createPose();f.sample(0,previous);
  for(let frame=1;frame<=360;frame++){
    f.sample(frame/120,out);assert.ok(Object.values(out).every(Number.isFinite));
    for(const key of fields)assert.ok(Math.abs(out[key]-previous[key])<.1,`${key} jumped at ${frame}`);
    previous={...out};
  }
  f.sample(.45,out);const repeat=createPose();new FallMotion(p,'hard landing').sample(.45,repeat);assert.deepEqual(out,repeat);
});

test('the drop accelerates before impact and the slide stops completely after contact',()=>{
  const entry=createPose();Object.assign(entry,{speed:10,rollAngle:.4});
  const f=new FallMotion(entry,'sideways landing'),p=createPose(),drops:number[]=[];
  for(const t of [.1,.2,.3,.4]){f.sample(t,p);drops.push(p.crashDrop);}
  assert.ok(drops[3]-drops[2]>drops[1]-drops[0],'fall decelerates in the air');
  f.sample(f.contactTime,p);const contact=p.crashForward;
  f.sample(f.contactTime+.2,p);assert.ok(p.crashForward>contact,'no momentum after impact');
  f.sample(2,p);const resting=p.crashForward;
  f.sample(8,p);assert.equal(p.crashForward,resting,'settled body keeps sliding');
  assert.equal(Math.sign(-Math.sin(p.crashRoll)),Math.sign(p.crashLateral),'body tips opposite its fall direction');
});

test('collision fall respects the wall sweep and recovery clears all fall channels',()=>{
  let wall=false;
  const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>wall?.28:null};
  const c=new RideController(flat),p=createPose();
  for(let i=0;i<240;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
  wall=true;for(let i=0;i<300;i++)c.step(1/120,NEUTRAL_ACTIONS);c.writePose(p);
  assert.ok(c.crashed);assert.equal(c.snapshot().fallPhase,'settled');
  assert.ok(Math.hypot(p.crashForward,p.crashLateral)<=.03001);assert.ok(Math.hypot(p.wheelCrashForward,p.wheelCrashLateral)<=.03001);
  wall=false;c.step(1/120,{...NEUTRAL_ACTIONS,reset:true});c.writePose(p);
  assert.equal(c.snapshot().fallPhase,'recovering');for(let i=0;i<240;i++)c.step(1/120,NEUTRAL_ACTIONS);c.writePose(p);
  assert.equal(c.snapshot().fallPhase,'none');assert.equal(p.crashMotion,0);assert.equal(p.crashRelease,0);assert.equal(p.wheelCrashLateral,0);
});
