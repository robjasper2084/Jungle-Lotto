import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeHazards} from './routeHazards.ts';
import {GEO,cutWidth} from './geo-profile.ts';
import {CUT_METRES} from './geography.ts';
test('seeded hazards vary between rides but remain fixed during a ride',()=>{
 assert.deepEqual(routeHazards(23),routeHazards(23));assert.notDeepEqual(routeHazards(23),routeHazards(91));assert.ok(routeHazards(23).length>=3);
});
test('hazards preserve reaction distance, a passing corridor and clear bridge/ramp entrances',()=>{
 for(let seed=0;seed<100;seed++){
  const h=routeHazards(seed);
  for(const [i,p] of h.entries()){
   assert.ok(p.station>=1805&&p.station<CUT_METRES-30);
   assert.ok(cutWidth(p.station)/2+Math.abs(p.offset)-p.radius>=2);
   assert.ok([...GEO.bridges,...GEO.ramps].every(b=>Math.abs(p.station-b.at)>=28));
   if(i)assert.ok(p.station-h[i-1].station>=73);
  }
 }
});
