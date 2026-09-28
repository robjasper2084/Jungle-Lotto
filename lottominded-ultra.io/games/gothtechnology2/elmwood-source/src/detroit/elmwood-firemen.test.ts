import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {inRing} from './elmwood-details.ts';
const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
const site=read('site.json'),placements=read('placements.json'),report=read('firemen-memorial.json');

test('Firemen landmark is grounded in the cemetery, clear of lanes and overlapping dressing',()=>{
 const terrain=new ElmwoodTerrain(read('terrain.json'),site.features,placements);
 const main=placements.filter((p:any)=>p.asset==='firemen-memorial');assert.equal(main.length,1);
 assert.equal(placements.filter((p:any)=>p.asset==='firemen-hydrant').length,2);
 for(const p of report.placements){
  const [x,n,h]=p.position;assert.ok(inRing(x,n,site.boundary));
  assert.ok(Math.abs(terrain.ground(x,n)-h)<.01,'Foundation follows local DEM');
  assert.ok(terrain.nearest(x,n).distance>(p.asset==='firemen-memorial'?4.5:2.8),'Keep the riding lane open');
 }
 assert.equal(placements.filter((p:any)=>p.layer==='estimated'&&Math.hypot(p.position[0]-report.x,p.position[1]-report.north)<5.8).length,0);
});

test('Firemen pedestal blocks a rider but the adjacent road remains open',async()=>{
 const terrain=new ElmwoodTerrain(read('terrain.json'),site.features,placements);await terrain.init();
 try{
  const p=report.placements[0],h=p.position[2];
  const hit=terrain.raycastObstacle({x:report.x-4,y:h+1,z:-report.north},{x:1,y:0,z:0},5);
  assert.ok(hit!==null&&hit>1&&hit<4,'Pedestal must stop approach');
  const lane=terrain.nearest(report.x,report.north);
  assert.equal(terrain.raycastObstacle({x:lane.x,y:terrain.height(lane.x,lane.north)+.7,z:-lane.north},{x:0,y:1,z:0},2),null);
 }finally{terrain.physics.free();}
});
