import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {inside,segment,ParkTerrain,type ParkMap} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {makeGardenPlan,type GardenPlan} from './gardenPlan.ts';
import {OUDOLF_BEDS,OUDOLF_LAWN_AISLES,oudolfLawnPanels,type GardenForm} from './oudolf.ts';
import {gardenBotany} from './gardenBotany.ts';
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
 assert(plan.plants.length>2000&&plan.plants.length<=8000);
 const formal=plan.plants.filter(p=>p.bed==='107227702');assert(formal.length>400);
 assert(new Set(plan.plants.map(p=>p.bed)).size>=15);
 assert(new Set(plan.plants.map(p=>p.palette)).size===5);
 assert(plan.plants.every(p=>p.height>=.3&&p.height<(p.form?1.34:.9)));
});
test('Oudolf has layered, varied silhouettes without spreading beyond its beds',()=>{
 const plants=plan.plants.filter(p=>p.form);
 assert(plants.length>4500&&plants.length<6500);
 assert(plants.every(p=>OUDOLF_BEDS.has(p.bed)));
 assert.equal(new Set(plants.map(p=>p.form)).size,5);
 assert(plants.some(p=>p.height>1.2)&&plants.some(p=>p.height<.7));
 assert.deepEqual(makeGardenPlan(map),plan,'Offline generation is reproducible');
});
test('botanical meshes stay finite and within the fixed triangle budget',()=>{
 let total=0;
 for(const form of ['umbel','spire','airy','grass','cone'] as GardenForm[]){
  const meshes=gardenBotany(form);let triangles=0;
  for(const g of [meshes.leaf,meshes.flower]){
   for(const name of ['position','normal','color'])assert([...g.attributes[name].array].every(Number.isFinite));
   triangles+=g.attributes.position.count/3;g.dispose();
  }
  total+=triangles*plan.plants.filter(p=>p.form===form).length;
 }
 assert(total<2_000_000,'Oudolf must not exceed the fixed geometry budget');
});

test('Oudolf lawn strips leave intersecting gravel routes visible',()=>{
 const panels=oudolfLawnPanels(map);
 assert(panels.length>250&&panels.length<800);
 const cross=map.roads.filter(r=>!OUDOLF_LAWN_AISLES.has(r.id)&&r.points.some(p=>Math.hypot(p[0]-1077,p[1]-1228)<95));
 for(const panel of panels){
  assert.equal(panel.length,4);
  assert(panel.flat().every(Number.isFinite));
  for(const path of cross)for(let i=1;i<path.points.length;i++)for(const p of panel)assert(segment(p[0],p[1],path.points[i-1],path.points[i]).d>=path.width*.5+.099);
 }
});
