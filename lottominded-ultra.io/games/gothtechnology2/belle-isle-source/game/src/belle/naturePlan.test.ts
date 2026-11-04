import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{inside,segment,ParkTerrain,type ParkMap}from'./terrain.ts';
import{natureBudget,type NaturePlan}from'./naturePlan.ts';
const map:ParkMap=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const plan:NaturePlan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map);
test('nature placement preserves dry land and playable route shoulders',()=>{
 const segments=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
 for(const p of [...plan.trees,...plan.ground]){
  assert(terrain.land(p.x,p.z),`${p.id} is in water`);
  const margin=plan.trees.includes(p)?3.99:p.id.startsWith('rock_')?2.49:1.39;
  assert(!segments.some(s=>segment(p.x,p.z,s.a,s.b).d<s.w/2+margin),`${p.id} blocks route shoulder at ${p.x},${p.z}`);
  assert(!map.buildings.some(b=>inside(p.x,p.z,b.points)),`${p.id} inside building`);
 }
});
test('nature variants exist and expensive detail has a finite mobile budget',()=>{
 assert(plan.trees.length>500&&plan.trees.length<=6500);
 for(const id of ['maple','willow','birch','pine'])assert(plan.trees.some(p=>p.id===id));
 for(const kind of ['rock_','grass_','dandelion_','periwinkle_'])assert(plan.ground.some(p=>p.id.startsWith(kind)));
 assert(natureBudget.smooth.trees<=20);assert(natureBudget.smooth.ground<=160);
 const manifest=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/manifest.json',import.meta.url),'utf8'));
 const known=new Set([...manifest.trees,...manifest.ground].map(e=>e.id));
 for(const p of [...plan.trees,...plan.ground])assert(known.has(p.id),'Missing model '+p.id);
});
test('new tree roots do not obstruct sports grounds, playgrounds or welcome sign',()=>{
 const clearAreas=map.areas.filter(a=>['pitch','track','playground','golf_course'].includes(a.kind));
 for(const p of plan.trees){
  assert(!clearAreas.some(a=>inside(p.x,p.z,a.points)));
  if(map.entranceSign)assert(Math.hypot(p.x-map.entranceSign.point[0],p.z-map.entranceSign.point[1])>=14);
 }
});

test('flatwoods multipolygon restores a dense hardwood canopy beside the eastern trails',()=>{const woods=map.areas.filter(a=>a.id.startsWith('17884436-'));assert.ok(woods.length>=6);const forest=plan.trees.filter(t=>woods.some(w=>inside(t.x,t.z,w.points)&&!(w.holes||[]).some(h=>inside(t.x,t.z,h))));assert.ok(forest.length>2200);assert.ok(forest.filter(t=>t.id==='pine').length/forest.length<.05);});
