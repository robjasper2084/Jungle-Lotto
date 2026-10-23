import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FallMotion,getUpPose} from '../src/fallMotion.ts';
import {getUpPose as swoopGetUp} from '../../swoop-source/src/detroit/fallMotion.ts';
import {createPose} from '../src/controller.ts';
import {recoverySample,recoveryHand} from '../src/kimodoRecovery.ts';
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
test('recovery support mirrors by fall side and releases after standing',()=>{
 let previous=0;
 for(let i=0;i<=100;i++){const t=i/100,sample=recoverySample(t);assert(sample[0]>=previous);previous=sample[0];
  const left=recoveryHand(t,0,1),right=recoveryHand(t,1,-1);assert.equal(left.x,-right.x);assert.equal(left.y,right.y);assert.equal(left.z,right.z);
 }
 assert.equal(recoverySample(1)[0],1);assert.equal(recoveryHand(1,0,1).weight,0);
});
