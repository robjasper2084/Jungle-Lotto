import test from 'node:test';
import assert from 'node:assert/strict';
import {footGait} from '../src/onFootGait.ts';

test('relaxed gait preserves ground contact and distance-matched steps for every hero size',()=>{
 for(const leg of [.45,.9,1.2])for(const speed of [0,1,2.35,3.6,5.4]){
  let maxLift=0;
  for(let i=0;i<1000;i++){
   const a=footGait(i/1000,speed,leg),b=footGait((i+1)/1000,speed,leg);
   assert(Object.values(a).every(v=>typeof v!=='number'||Number.isFinite(v)));
   assert(a.lift>=0);maxLift=Math.max(maxLift,a.lift);
   if(a.contact)assert.equal(a.lift,0);
   if(a.contact&&b.contact){
    const t=Math.max(0,Math.min(1,(speed-2.35)/3.05)),cycle=(1.65+1.95*t*t*(3-2*t))*Math.max(.35,leg/.9);
    assert(Math.abs((a.z-b.z)*1000-cycle)<1e-8,'stance speed still matches movement');
   }
   assert(Math.abs(a.z-b.z)<.02,'no ankle position pop at cycle seams');
   assert(Math.abs(a.pitch-b.pitch)<.02,'no ankle rotation pop at cycle seams');
  }
  assert(maxLift<(speed<=1?.06:.22),'avoid exaggerated high stepping');
  assert.deepEqual(footGait(-.2,speed,leg),footGait(.8,speed,leg));
 }
});
