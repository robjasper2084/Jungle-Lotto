import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {inRing,segmentDistance} from './elmwood-details.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),placements=read('placements.json'),grove=read('walnut-grove.json');
const terrain=new ElmwoodTerrain(read('terrain.json'),site.features,placements);
test('both marked lawns contain walnuts without estimated grave markers or blocked lanes',()=>{
 const graves=new Set(['headstone','obelisk','ledger','urn','headstone-arched','headstone-cross','headstone-weathered']);
 for(const region of grove.regions){
  const inside=placements.filter((p:any)=>inRing(p.position[0],p.position[1],region.ring));
  assert.equal(inside.filter((p:any)=>graves.has(p.asset)).length,0,region.id+' must stay free of grave dressing');
  assert.ok(inside.filter((p:any)=>p.asset==='black-walnut').length>=5,region.id+' has a grove');
 }
 for(const p of placements.filter((p:any)=>p.asset==='black-walnut')){
  assert.ok(terrain.nearest(p.position[0],p.position[1]).distance>6,'Trunk clearance from lanes');
  assert.ok(Math.abs(terrain.ground(p.position[0],p.position[1])-p.position[2])<.01,'Trunks grounded');
  for(const f of site.features.filter((f:any)=>f.kind==='water'))for(let i=1;i<f.points.length;i++)assert.ok(segmentDistance(p.position[0],p.position[1],f.points[i-1],f.points[i])>=7,'Creek banks stay open');
 }
});
test('junction bench has a collider but leaves the nearby road rideable',async()=>{
 await terrain.init();
 try{
  const p=placements.find((p:any)=>p.asset==='elmwood-park-bench');assert.ok(p);
  assert.ok(Math.hypot(p.position[0]+33.1,p.position[1]-66.7)<15,'Bench at the annotated junction');
  const near=terrain.nearest(p.position[0],p.position[1]);assert.ok(near.distance>3.2&&near.distance<8);
  const hit=terrain.raycastObstacle({x:p.position[0]-2,y:p.position[2]+.65,z:-p.position[1]},{x:1,y:0,z:0},3);
  assert.ok(hit!==null&&hit>1&&hit<2,'Bench stops the rider instead of clipping');
  assert.equal(terrain.raycastObstacle({x:near.x,y:terrain.height(near.x,near.north)+.75,z:-near.north},{x:0,y:1,z:0},2),null,'Lane centre stays clear');
 }finally{terrain.physics.free();}
});
