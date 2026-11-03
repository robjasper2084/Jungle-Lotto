import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {inside,ParkTerrain,type ParkMap} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import type {GardenPlan} from './gardenPlan.ts';
const map:ParkMap=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const plan:GardenPlan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/gardens.json',import.meta.url),'utf8'));
test('dense flower beds preserve playable paths, water edges and memorial access',()=>{
 const terrain=new ParkTerrain(map),occupied=roadIndex(map.roads);
 for(const p of plan.plants){
  const bed=map.areas.find(a=>a.id===p.bed)!;
  assert(bed&&inside(p.x,p.z,bed.points),'Flower outside mapped bed');
  assert(terrain.land(p.x,p.z),'Flower in water');
  assert(!occupied(p.x,p.z,'',.79),'Flower obstructs route shoulder');
  assert(!terrain.obstructed(p.x,p.z,1.19),'Flower clips building or monument');
  assert(Math.abs(p.y-terrain.height(p.x,p.z)-.035)<.002,'Floating flower');
 }
});
test('garden silhouette detail is bounded and fills formal borders without filling lawns',()=>{
 assert(plan.plants.length>2000&&plan.plants.length<=5000);
 const formal=plan.plants.filter(p=>p.bed==='107227702');assert(formal.length>400);
 assert(new Set(plan.plants.map(p=>p.bed)).size>=15);
 assert(new Set(plan.plants.map(p=>p.palette)).size===5);
 assert(plan.plants.every(p=>p.height>=.3&&p.height<.9));
});
