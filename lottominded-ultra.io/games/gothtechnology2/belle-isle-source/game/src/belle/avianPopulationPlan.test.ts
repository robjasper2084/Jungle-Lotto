import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,segment,type ParkMap} from './terrain.ts';
import {LAKE_SWANS,SHORE_BIRDS,AVIAN_FLIGHT_SECONDS,avianFlightHeight,shoreBirdWander} from './avianPopulationPlan.ts';
import {waterfowlPose} from './waterfowlPlan.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const waterAt=(x:number,z:number)=>map.water.some(w=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h)));
const roadClear=(x:number,z:number,margin:number)=>map.roads.every(r=>r.points.slice(1).every((v,i)=>segment(x,z,r.points[i],v).d>r.width/2+margin));
const lakeNames:Record<string,string>={'Lake Tacoma':'420953','Lake Muskoday':'51476983','Lake Okonoka':'420959','Blue Heron Lagoon':'32613819','West Lagoon':'32613549'};
test('twenty individual swan routes across five lakes stay in mapped water and away from roads',()=>{
 assert.equal(LAKE_SWANS.length,20);
 assert.equal(new Set(LAKE_SWANS.map(s=>s.x+':'+s.z)).size,20);
 for(const [name,id]of Object.entries(lakeNames)){
  const lake=map.waterSources!.find(w=>w.id===id)!;
  const residents=LAKE_SWANS.filter(s=>s.habitat===name);
  assert.equal(residents.length,4,name);
  for(const route of residents)for(let sample=0;sample<120;sample++){
   const p=waterfowlPose(route,sample*route.period/120);
   assert(inside(p.x,p.z,lake.points)&&!lake.holes.some(h=>inside(p.x,p.z,h)),name+' water polygon');
   assert(waterAt(p.x,p.z),name+' connected water');
   assert(roadClear(p.x,p.z,1.5),name+' road clearance');
  }
 }
});
test('northern and southern geese occupy safe coast, not the road or race lanes',()=>{
 const geese=SHORE_BIRDS.filter(b=>b.kind==='goose');
 assert.equal(geese.length,32);
 assert.equal(geese.filter(b=>b.sector==='north').length,16);
 assert.equal(geese.filter(b=>b.sector==='south').length,16);
 assert.equal(new Set(geese.map(b=>b.habitat)).size,8);
 for(const b of geese)for(let i=0;i<16;i++){
  const w=shoreBirdWander(b.phase,i*2),x=b.x+w.along,z=b.z+w.across;
  assert(inside(x,z,map.island)&&!waterAt(x,z),b.habitat+' dry land');
  assert(roadClear(x,z,2.7),b.habitat+' drive corridors');
 }
});
test('shoreline waders are restricted to the mapped beach margins',()=>{
 const birds=SHORE_BIRDS.filter(b=>b.kind==='wader');
 assert(birds.length>=12);
 for(const b of birds){
  const beach=map.areas.find(a=>a.kind==='beach'&&a.name===b.habitat)!;
  assert(inside(b.x,b.z,beach.points),b.habitat+' sand');
  assert(roadClear(b.x,b.z,1.7));
  assert(!waterAt(b.x,b.z));
 }
});
test('proximity takeoff and landing remain bounded, finite and nonblocking',()=>{
 for(const kind of ['swan','goose','wader'] as const){
  assert.equal(avianFlightHeight(-1,kind),0);
  assert.equal(avianFlightHeight(0,kind),0);
  assert.equal(avianFlightHeight(AVIAN_FLIGHT_SECONDS,kind),0);
  assert.equal(avianFlightHeight(Number.NaN,kind),0);
  const ys=Array.from({length:80},(_,i)=>avianFlightHeight(i*AVIAN_FLIGHT_SECONDS/80,kind));
  assert(ys.every(y=>Number.isFinite(y)&&y>=0&&y<=5));
  assert(Math.max(...ys)>1.9);
 }
 const idle=shoreBirdWander(3.5,12);
 assert(Math.abs(idle.along)<.28&&Math.abs(idle.across)<.16);
 assert.deepEqual(idle,shoreBirdWander(3.5,12),'animation deterministic; no per-frame random walk');
});
