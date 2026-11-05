import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FallMotion,getUpPose} from '../src/fallMotion.ts';
import {getUpPose as swoopGetUp} from '../../swoop-source/src/detroit/fallMotion.ts';
import {createPose} from '../src/controller.ts';
import {recoverySample,recoveryHand,recoveryFoot,recoveryWheel} from '../src/kimodoRecovery.ts';
test('Kimodo recovery starts at the settled pose and rises continuously in all game controllers',()=>{
 for(const side of [-1,1])for(const mounted of [false,true]){
  const rest={...createPose(),speed:8,rollAngle:side*.4};new FallMotion(rest,'sideways landing').sample(4,rest);
  const out=createPose(),other=createPose();getUpPose(rest,0,out,mounted);assert.deepEqual(out,rest);
  let previous={...out};
  for(let frame=1;frame<=240;frame++){
   const t=frame/240;getUpPose(rest,t,out,mounted);swoopGetUp(rest,t,other,mounted);assert.deepEqual(out,other);
   assert(Object.values(out).every(Number.isFinite));
   for(const key of ['crashDrop','crashRoll','crashTumble','crashLegTuck','bodyPitch','bodyDrop'] as const)assert(Math.abs(out[key]-previous[key])<.08,key+' recovery snaps');
   previous={...out};
  }
  assert.equal(out.crashDrop,0);assert.equal(Math.abs(out.crashRoll),0);
 }
});

test('get-up plants its support before rising and transfers boots to pedals separately',()=>{
 assert.equal(recoverySample(.16)[0],0,'pelvis must not rise during the side roll');
 for(const side of [-1,1]){
  const support=side>0?0:1,lead=1-support;
  assert.equal(recoveryHand(.3,support,side).plant,1,'support palm must stay grounded');
  assert.equal(recoveryFoot(.40,lead,side).plant,1,'lead boot must be planted before the rise');
  assert.equal(recoveryFoot(.7,lead,side).pedal,0,'do not lift both feet while kneeling');
  assert(recoveryFoot(.85,lead,side).pedal>.5);
  assert.equal(recoveryFoot(.85,support,side).pedal,0,'trailing boot still carries weight');
  assert.equal(recoveryHand(1,support,side).plant,0);
  assert.equal(recoveryFoot(1,support,side).pedal,1);
 }
});
test('recovery support mirrors by fall side and releases after standing',()=>{
 let previous=0;
 for(let i=0;i<=100;i++){const t=i/100,sample=recoverySample(t);assert(sample[0]>=previous);previous=sample[0];
  const left=recoveryHand(t,0,1),right=recoveryHand(t,1,-1);assert.equal(left.x,-right.x);assert.equal(left.y,right.y);assert.equal(left.z,right.z);
 }
 assert.equal(recoverySample(1)[0],1);assert.equal(recoveryHand(1,0,1).weight,0);
});
test('the wheel stays down until grasped and finishes lifting before grip release',()=>{
 assert.equal(recoveryWheel(.32).lift,0);
 assert(recoveryWheel(.46).grip>.95);assert.equal(recoveryWheel(.46).lift,0);
 assert.equal(recoveryWheel(.8).lift,1);assert.equal(recoveryWheel(.8).grip,1);
 assert.equal(recoveryWheel(1).grip,0);
});

test('remount clears the pedal edge one boot at a time with support held during the transfer',()=>{
 for(const side of [-1,1]){
  const support=side>0?0:1,lead=1-support;
  assert.equal(recoveryHand(.38,support,side).plant,1,'palm supports the first planted foot');
  let lastLead=0,lastTrail=0;
  for(let frame=0;frame<=300;frame++){
   const t=frame/300,a=recoveryFoot(t,lead,side),b=recoveryFoot(t,support,side);
   assert(a.pedal>=lastLead&&b.pedal>=lastTrail,'boots must not reverse their step');
   assert(a.pedal>=b.pedal,'the leading boot lands before the trailing boot');
   for(const foot of [a,b]){
    assert(foot.clearance>=0&&foot.clearance<=.085,'step must remain below knee height');
    if(foot.pedal===0||foot.pedal===1)assert.equal(foot.clearance,0,'no floating foot at either endpoint');
    else assert(foot.clearance>0,'moving foot must lift over the pedal edge');
   }
   if(a.pedal>0&&a.pedal<.9)assert(recoveryWheel(t).grip>.9,'keep the wheel steady while the first foot transfers');
   lastLead=a.pedal;lastTrail=b.pedal;
  }
 }
});
