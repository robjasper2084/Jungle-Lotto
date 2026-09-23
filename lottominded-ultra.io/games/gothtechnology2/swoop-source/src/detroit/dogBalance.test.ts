import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dogBalance} from './dogBalance.ts';
test('heavy dog balance is bounded, periodic and keeps the head steadier than the chest',()=>{
 for(const speed of [0,1,3,7.5])for(let phase=0;phase<1;phase+=.02){
  const a=dogBalance(speed,phase,1,2),b=dogBalance(speed,phase+1,1,2);
  for(const key of Object.keys(a) as (keyof typeof a)[]){assert.ok(Math.abs(a[key])<.17);assert.ok(Math.abs(a[key]-b[key])<1e-9);}
  if(speed>5)assert.ok(Math.abs(a.chestPitch+a.neckPitch)<Math.abs(a.chestPitch)+1e-9);
 }
 const a=dogBalance(3,.4,1,2),b=dogBalance(3,.4,-1,2);assert.equal(a.headYaw,-b.headYaw);
});
