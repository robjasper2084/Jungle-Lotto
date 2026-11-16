import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,segment,ParkTerrain,type ParkMap} from './terrain.ts';
import {planShoreClutter} from './shore.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const beaches=map.areas.filter(a=>a.kind==='beach');
const protectedBeach=(x:number,z:number)=>beaches.some(a=>inside(x,z,a.points)||a.points.slice(1).some((b,i)=>segment(x,z,a.points[i],b).d<9));
test('photo-guided riprap retains real beach access and bridge envelopes',()=>{
 const terrain=new ParkTerrain(map),before=JSON.stringify(map);
 const plan=planShoreClutter(map,terrain);
 assert.equal(JSON.stringify(map),before,'shore dressing cannot mutate map geometry');
 assert(plan.stones.length>0,'natural shoreline should retain visible riprap');
 assert(plan.walls.length>0,'Detroit seawalls must remain');
 const swatches=new Set(plan.stones.map(s=>s.color));
 assert(swatches.size>10,'avoid one uniform limestone gray');
 for(const stone of plan.stones){
  assert(!protectedBeach(stone.x,stone.z),'rock should never appear across the swim-beach sand');
  assert(!terrain.bridge(stone.x,stone.z).active,'riprap must leave MacArthur roadway/arch envelope open');
  assert([stone.x,stone.y,stone.z,stone.sx,stone.sy,stone.sz,stone.color].every(Number.isFinite));
 }
 for(const log of plan.driftwood){
  assert(terrain.land(log.x,log.z),'driftwood must be dry and reachable');
  assert(!protectedBeach(log.x,log.z),'natural driftwood must not obstruct sandy beaches');
  assert(!terrain.bridge(log.x,log.z).active,'driftwood must leave bridge approaches open');
 }
});
