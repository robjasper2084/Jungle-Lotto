import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,type ParkMap} from './terrain.ts';
import {SHALLOW_LIMITS,planShallows} from './shallowWater.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('shallow lagoon detail stays bounded, deterministic and inside actual water',()=>{
 const a=planShallows(map);assert.deepEqual(a,planShallows(map));
 assert(a.edges>0&&a.edges<=2100);
 assert.equal(a.points.length,a.edges*12);
 assert.equal(a.index.length,a.edges*6);
 assert(a.stones.length<=115);
 for(const p of a.stones){assert([p.x,p.y,p.z,p.size,p.yaw].every(Number.isFinite));
  assert(map.water.some(w=>inside(p.x,p.z,w.points)&&!w.holes.some(h=>inside(p.x,p.z,h))));}
 assert.equal(SHALLOW_LIMITS.smooth.stones,0);assert(SHALLOW_LIMITS.high.stones>SHALLOW_LIMITS.automatic.stones);
});
