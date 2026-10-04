import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnimationCadence} from '../src/animationCadence.ts';
test('nearby animation stays full rate while distant skeleton work is bounded',()=>{
  const c=new AnimationCadence();for(let i=0;i<3;i++)assert.ok(c.due(i,0,0));
  const counts=[0,0,0];for(let frame=0;frame<60;frame++)[5,40,80].forEach((d,i)=>{if(c.due(i,1/60,d))counts[i]++;});
  assert.deepEqual(counts,[60,20,10]);
});
test('paused animation freezes and returning actors refresh immediately',()=>{
  const c=new AnimationCadence();assert.ok(c.due(0,0,90));assert.equal(c.due(0,0,90),false);
  c.reset();assert.ok(c.due(0,0,90));assert.ok(c.due(0,1/60,2));
});
