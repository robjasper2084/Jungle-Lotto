import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {mappedCasinoWayBridge,planCasinoWayViews,CASINO_WAY_MAPPED_ID} from './casinoBridgeView.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('historic coordinates identify the Casino crossing and reject the wrongly labeled path',()=>{
 const m=mappedCasinoWayBridge(map);assert(m);assert.equal(m.road.id,CASINO_WAY_MAPPED_ID);assert(m.distance<12);
 const other=map.roads.find(r=>r.id==='42986441')!;const p=other.points;
 assert(Math.hypot((p[0][0]+p[p.length-1][0])/2-m.center[0],(p[0][1]+p[p.length-1][1])/2-m.center[1])>75);
 assert.equal(mappedCasinoWayBridge({...map,origin:[-81.5,40]}),null);
});
test('historic bank-side and Casino-context views are deterministic and collision-safe',()=>{
 const terrain=new ParkTerrain(map),v=planCasinoWayViews(map,terrain);assert(v);assert.deepEqual(v,planCasinoWayViews(map,terrain));
 assert.equal(v.bridgeId,CASINO_WAY_MAPPED_ID);
 for(const [name,p] of [['side',v.side],['context',v.context]] as const){
  assert(p,name+' camera required');assert(terrain.land(p.x,p.z));assert(!terrain.obstructed(p.x,p.z,2));
  assert(!terrain.bridge(p.x,p.z).active);assert(p.sideFraction>.75);
 }
 assert(v.side!.distance<75);assert(v.context!.casinoAngle<=40);
});

test('the gallery captures both historic side rails and a separate Casino context in the actual game',()=>{
 const gallery=readFileSync(new URL('../../scripts/environment-gallery.mjs',import.meta.url),'utf8');
 const game=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 assert(gallery.includes('Casino Way Bridge · bank side'));
 assert(gallery.includes('Visit red bridge'));
 assert(game.includes('Casino Way Bridge · Casino context'));
 assert(game.includes('Visit Casino context'));
 assert(gallery.includes('action:/Walk onto the beach/'));
 assert(!gallery.includes('search:/Covered Bridge/i'));
 assert(!gallery.includes('search:/Wet-Mesic Flatwoods Forest/i'));
});
