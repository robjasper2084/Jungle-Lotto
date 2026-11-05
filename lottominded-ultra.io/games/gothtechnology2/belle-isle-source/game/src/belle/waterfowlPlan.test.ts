import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WATERFOWL,canalWaterfowl,waterfowlPose} from './waterfowlPlan.ts';
import {inside,segment,type ParkMap} from './terrain.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('lagoon has exactly four swans and two distinct ducks',()=>{assert.equal(WATERFOWL.length,6);assert.equal(WATERFOWL.filter(b=>b.species==='swan').length,4);assert.deepEqual(WATERFOWL.filter(b=>b.species==='duck').map(b=>b.plumage),['drake','hen']);});
test('entire swimming cycles remain clear of shores, islands and bridges',()=>{
 const lagoon=map.waterSources!.find(w=>w.id==='32613819')!;
 for(const b of WATERFOWL)for(let i=0;i<=360;i++){
  const p=waterfowlPose(b,b.period*i/360);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(inside(p.x,p.z,lagoon.points));
  const water=map.water.find(w=>inside(p.x,p.z,w.points)&&!w.holes.some(h=>inside(p.x,p.z,h)));assert.ok(water);
  for(const ring of [water.points,...water.holes])for(let j=1;j<ring.length;j++)assert.ok(segment(p.x,p.z,ring[j-1],ring[j]).d>2);
  for(const r of map.roads.filter(r=>r.bridge))for(let j=1;j<r.points.length;j++)assert.ok(segment(p.x,p.z,r.points[j-1],r.points[j]).d>r.width/2+1);
  assert.ok(Math.abs(p.y-1.05)<.02);
 }
});
test('each main canal has swans and ducks whose complete routes avoid land crossings',()=>{
 const residents=canalWaterfowl(map);
 for(const name of ['Loop Canal','Nashua Canal','Sylvan Canal']){
  const birds=residents.filter(r=>r.habitat===name);assert.ok(birds.some(b=>b.species==='swan'),name+' swans');assert.ok(birds.some(b=>b.species==='duck'),name+' ducks');
  const canal=map.waterwayRoutes!.find(c=>c.name===name)!;
  for(const bird of birds)for(let i=0;i<360;i++){
   const p=waterfowlPose(bird,bird.period*i/360);assert.ok(Object.values(p).every(Number.isFinite));
   assert.ok(canal.points.slice(1).some((v,j)=>segment(p.x,p.z,canal.points[j],v).d<canal.width/2-1));
   assert.ok(!map.roads.some(r=>r.points.slice(1).some((v,j)=>segment(p.x,p.z,r.points[j],v).d<r.width/2+1.9)));
  }
 }
 assert.ok(residents.length<=24);
});
