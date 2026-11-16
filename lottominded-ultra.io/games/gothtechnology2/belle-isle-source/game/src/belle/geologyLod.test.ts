import test from 'node:test';
import assert from 'node:assert/strict';
import {selectGeology,GEOLOGY_BUDGET} from './geologyLod.ts';
const rocks=Array.from({length:130},(_,i)=>({x:i*7,z:0,shape:i%3}));
test('new mineral LOD keeps the nearest boulders and bounds mobile draw submissions',()=>{
 for(const tier of ['smooth','automatic','high'] as const){
  const {near,far}=selectGeology(rocks,0,0,tier),b=GEOLOGY_BUDGET[tier];
  assert(near.length<=b.nearMax);
  assert(far.length<=b.farMax);
  assert(near.every(p=>Math.hypot(p.x,p.z)<=b.nearRange));
  assert(far.every(p=>Math.hypot(p.x,p.z)<=b.farRange));
  assert.equal(new Set([...near,...far]).size,near.length+far.length);
 }
 assert(GEOLOGY_BUDGET.smooth.farRange<GEOLOGY_BUDGET.high.farRange);
 assert.equal(selectGeology(rocks,Infinity,0,'high').near.length,0);
});
test('co-op cameras select independently without modifying any authored rock',()=>{
 const before=JSON.stringify(rocks);
 const first=selectGeology(rocks,4,0,'automatic'),second=selectGeology(rocks,670,0,'automatic');
 assert.notDeepEqual(first,second);
 assert.equal(JSON.stringify(rocks),before);
 assert.deepEqual(first,selectGeology(rocks,4,0,'automatic'));
});
