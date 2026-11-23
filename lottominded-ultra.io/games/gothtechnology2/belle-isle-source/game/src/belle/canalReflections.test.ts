import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,type ParkMap} from './terrain.ts';
import {CANAL_REFLECTION_EDGE_LIMIT,planCanalReflections} from './canalReflections.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('canal greenery reflection ribbons remain deterministic and bounded on mapped water',()=>{
 const a=planCanalReflections(map),b=planCanalReflections(map);
 assert.deepEqual(a,b);assert(a.edges>0&&a.edges<=CANAL_REFLECTION_EDGE_LIMIT);
 assert.equal(a.positions.length,a.edges*12);assert.equal(a.uv.length,a.edges*8);assert.equal(a.indices.length,a.edges*6);
 for(let j=0;j<a.positions.length;j+=12){
  const x=(a.positions[j+6]+a.positions[j+9])/2,z=(a.positions[j+8]+a.positions[j+11])/2;
  assert(map.water.some(w=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h))),'water-edge tint must never become dry-path geometry');
 }
 assert(a.positions.every(Number.isFinite));
});
