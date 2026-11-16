import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {planCanalRoots,ROOT_LIMITS} from './canalRoots.ts';
import {roadIndex} from './streetPlan.ts';
import type {NaturePlan} from './naturePlan.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const plants:NaturePlan=JSON.parse(readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
test('waterfront roots remain deterministic, finite and clear of mapped trails',()=>{
 const terrain=new ParkTerrain(map),list=planCanalRoots(map,terrain,plants.trees),another=planCanalRoots(map,terrain,plants.trees);
 assert.deepEqual(list,another);assert(list.length<=170);
 const occupied=roadIndex(map.roads);
 for(const r of list){
  const tip=[r.x+Math.sin(r.angle)*r.length,r.z+Math.cos(r.angle)*r.length];
  assert(terrain.land(tip[0],tip[1]));
  assert(!occupied(tip[0],tip[1],'',2.5));
  assert([r.x,r.y,r.z,r.angle,r.length,r.thickness].every(Number.isFinite));
 }
 assert(ROOT_LIMITS.smooth.count<ROOT_LIMITS.high.count);
});
