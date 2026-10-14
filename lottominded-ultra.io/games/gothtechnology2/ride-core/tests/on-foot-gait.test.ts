import test from 'node:test';
import assert from 'node:assert/strict';
import {footGait,footBodyMotion,footCycleDistance} from '../src/onFootGait.ts';

test('relaxed gait preserves ground contact and distance-matched steps for every hero size',()=>{
 for(const leg of [.45,.9,1.2])for(const speed of [0,1,2.35,3.6,5.4]){
  let maxLift=0;
  for(let i=0;i<1000;i++){
   const a=footGait(i/1000,speed,leg),b=footGait((i+1)/1000,speed,leg);
   assert(Object.values(a).every(v=>typeof v!=='number'||Number.isFinite(v)));
   assert(a.lift>=0);maxLift=Math.max(maxLift,a.lift);
   if(a.contact)assert.equal(a.lift,0);
   if(a.contact&&b.contact){
    const cycle=footCycleDistance(speed)*Math.max(.2,leg/.9);
    assert(Math.abs((a.z-b.z)*1000-cycle)<1e-8,'stance speed still matches movement');
   }
   assert(Math.abs(a.z-b.z)<.02,'no ankle position pop at cycle seams');
   assert(Math.abs(a.pitch-b.pitch)<.02,'no ankle rotation pop at cycle seams');
  }
  assert(maxLift<(speed<=1?.08:.22),'avoid exaggerated high stepping');
  assert.deepEqual(footGait(-.2,speed,leg),footGait(.8,speed,leg));
 }
});

test('ankle velocity stays continuous at lift-off and landing instead of stopping abruptly',()=>{
 for(const speed of [1,2.35,3.6,5.4]){
  const t=Math.max(0,Math.min(1,(speed-1.9)/1.7)),stance=.62-.24*t*t*(3-2*t),h=1e-6;
  for(const phase of [stance,1]){
   const before=(footGait(phase,speed,.9).z-footGait(phase-h,speed,.9).z)/h;
   const after=(footGait(phase+h,speed,.9).z-footGait(phase,speed,.9).z)/h;
   assert(Math.abs(before-after)<.001,'contact velocity has a hard discontinuity');
  }
 }
});

test('grounded weight transfer remains restrained and settles at idle',()=>{
 for(const speed of [0,1,2.35,3.6,5.4])for(let phase=0;phase<1;phase+=.01){
  const m=footBodyMotion(phase,speed);
  assert(Math.abs(m.bob)<.018&&Math.abs(m.weight)<.021,'weight transfer stays restrained');
  if(speed===0)assert.equal(Math.abs(m.weight)+Math.abs(m.bob),0);
 }
});
