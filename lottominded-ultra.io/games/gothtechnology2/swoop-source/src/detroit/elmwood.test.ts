import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ELM_PATHS,ELM_SPOTS,ElmwoodWorld,elmHeight,elmInside,elmDistance,PLAN_METRES,elmPoint,ELM_WATER_Y} from './elmwood.ts';
import {ELM_DEM,ELM_ELEVATIONS} from './elmwood-dem.ts';
import {createGroundSample} from './terrain.ts';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toLocal} from './geo-profile.ts';
import {ELM_BUILDINGS,buildingSite,clearElmPlot,elmLaneVertices} from './elmwoodDetails.ts';
const world=await new ElmwoodWorld().init();
test('Elmwood is a separate terrain with kilometre-scale branching garden lanes',()=>{
 assert.equal(world.geoMeshes.length,0);assert.equal(world.buildingMeshes.length,0);
 assert.ok(ELM_PATHS.reduce((n,p)=>n+p.length,0)>2500);assert.ok(PLAN_METRES>.68&&PLAN_METRES<.70);
 for(const spot of ELM_SPOTS){assert.ok(elmInside(spot.x,spot.z),spot.name);assert.ok(elmDistance(spot.x,spot.z)<.01);}
});
test('all Elmwood lanes match rideable collision ground',()=>{
 const g=createGroundSample();
 for(const path of ELM_PATHS)for(let d=0;d<path.length;d+=6){const p=path.sample(d);world.sampleGround(p.x,p.z,g);assert.ok(!g.offCourse,'outside plan');assert.ok(g.normal.y>.97,'steep lane');assert.ok(Math.abs(g.height-elmHeight(p.x,p.z))<.03,'surface mismatch');assert.equal(g.surface,'pavement');}
});
test('Elmwood entrance supports riding and an immediate reset without subsequent simulation ticks',()=>{
 const p=ELM_SPOTS[0],terrain=new GeoTerrain(world),position=toLocal(p.x,elmHeight(p.x,p.z),p.z),sim=new RideController(terrain,{spawn:{position,headingY:-p.heading}});
 for(let i=0;i<240;i++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.3});
 assert.ok(sim.snapshot().distanceTravelled>1);assert.equal(sim.crashed,false);
 const distance=sim.snapshot().distanceTravelled;sim.step(1/120,{...NEUTRAL_ACTIONS,reset:true});assert.equal(sim.snapshot().speed,0);assert.equal(sim.crashed,false);assert.equal(sim.snapshot().distanceTravelled,distance);
});
test('Elmwood walkers follow a closed circuit without an endpoint teleport',()=>{
 const p=ELM_PATHS[17],a=p.sample(0),b=p.sample(p.length);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.01);
});
test('satellite-aligned elevation retains a low pond and substantial lawn relief',()=>{
 assert.equal(ELM_ELEVATIONS.length,ELM_DEM.width*ELM_DEM.height);
 assert.ok(ELM_ELEVATIONS.every(h=>Number.isFinite(h)&&h>170&&h<200));
 const p=elmPoint(850,386),g=createGroundSample();world.sampleGround(p.x,p.z,g);
 assert.ok(g.offCourse);assert.ok(g.height<ELM_WATER_Y-.35,'pond bed stays below water');
 const heights=ELM_SPOTS.map(s=>elmHeight(s.x,s.z));
 assert.ok(Math.max(...heights)-Math.min(...heights)>4,'the valley must not flatten back to a generic lawn');
});

test('chapel and lodge footprints leave every lane clear for rider and companion',()=>{
 for(const definition of ELM_BUILDINGS){
   const b=buildingSite(definition);assert.ok(elmInside(b.x,b.z));
   // Include buttresses and roof overhang, not just the collision box.
   for(let x=-b.w/2-.7;x<=b.w/2+.7;x+=.5)for(let z=-b.d/2-.7;z<=b.d/2+.7;z+=.5){
     assert.ok(elmDistance(b.x+x,b.z+z)>4.2,b.name+' intrudes on lane');
   }
   world.addBox({x:b.x,y:b.y+b.eave/2,z:b.z,hx:b.w/2,hy:b.eave/2,hz:b.d/2,kind:'architecture'});
 }
 world.step();const g=createGroundSample();
 for(const path of ELM_PATHS)for(let d=0;d<path.length;d+=3){
   const p=path.sample(d);world.sampleGround(p.x,p.z,g);
   assert.ok(Math.abs(g.height-elmHeight(p.x,p.z))<.03,'building blocks lane');
 }
});

test('ornament placement rejects lanes, pond and occupied architectural plots',()=>{
 for(const path of ELM_PATHS)for(let d=0;d<path.length;d+=12){const p=path.sample(d);assert.equal(clearElmPlot(p.x,p.z,1.8),false);}
 for(const b of ELM_BUILDINGS){const p=buildingSite(b);assert.equal(clearElmPlot(p.x,p.z,1),false);}
 const water=elmPoint(850,386);assert.equal(clearElmPlot(water.x,water.z,1),false);
});

test('visible lane triangles clear the underlying hillside without a floating road',()=>{
 for(const path of ELM_PATHS){const p=elmLaneVertices(path.samples);
   for(let i=0;i<p.length;i+=9){
     const x=(p[i]+p[i+3]+p[i+6])/3,y=(p[i+1]+p[i+4]+p[i+7])/3,z=(p[i+2]+p[i+5]+p[i+8])/3;
     const clearance=y-elmHeight(x,z);assert.ok(clearance>.001&&clearance<.075,'road clearance '+clearance);
     const ax=p[i+3]-p[i],az=p[i+5]-p[i+2],bx=p[i+6]-p[i],bz=p[i+8]-p[i+2];assert.ok(az*bx-ax*bz>0,'upward face');
   }
 }
});

