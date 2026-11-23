import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,inside,type ParkMap} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {CANAL_DETAIL_LIMITS,planLivingCanals} from './livingCanals.ts';

const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('canal reeds and fallen limbs use deterministic, route-safe dry bank placement',()=>{
 const terrain=new ParkTerrain(map),first=planLivingCanals(map,terrain),again=planLivingCanals(map,terrain);
 assert.deepEqual(first,again);
 assert(first.reeds.length<=640&&first.branches.length<=140);
 assert(first.reeds.length>0,'expected natural wetland details along mapped canals');
 const occupied=roadIndex(map.roads),beaches=map.areas.filter(a=>a.kind==='beach');
 for(const p of [...first.reeds,...first.branches]){
  assert([p.x,p.y,p.z,p.yaw,p.scale,p.color].every(Number.isFinite));
  assert(terrain.land(p.x,p.z),'plants and branches must stay on land');
  assert(!terrain.bridge(p.x,p.z).active,'no crossing obstruction');
  assert(!terrain.obstructed(p.x,p.z,.5));
  assert(!occupied(p.x,p.z,'',2.5),'no clutter in road or trail corridors');
  assert(!beaches.some(a=>inside(p.x,p.z,a.points)),'no clutter on swimming beaches');
 }
 assert(CANAL_DETAIL_LIMITS.smooth.reeds<CANAL_DETAIL_LIMITS.high.reeds);
 assert(CANAL_DETAIL_LIMITS.smooth.branches<CANAL_DETAIL_LIMITS.high.branches);
});
