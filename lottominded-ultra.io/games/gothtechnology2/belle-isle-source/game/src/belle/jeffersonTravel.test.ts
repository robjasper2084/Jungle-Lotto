import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {districts,districtName} from './detroitGround.ts';
import {JEFFERSON_BUILDINGS,planJeffersonBuildings,registerJeffersonBuildingSolids} from './jeffersonBuildings.ts';
import {jeffersonStreetDestinations,jeffersonViewOccluded,selectJeffersonTravelView} from './jeffersonTravel.ts';
import {ParkTerrain,segment,type ParkMap,type Point} from './terrain.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const rectangle=(x0:number,z0:number,x1:number,z1:number):Point[]=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]];
function actualTerrain(){const terrain=new ParkTerrain(map,true);registerJeffersonBuildingSolids(terrain,planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)));return terrain;}

test('all six actual building destinations resolve to clear local street frontage',()=>{
 const terrain=actualTerrain(),before=JSON.stringify(terrain.boxes),roads=[...map.roads,...districts.roads];
 assert.equal(JEFFERSON_BUILDINGS.length,6);
 for(const profile of JEFFERSON_BUILDINGS){
  const view=selectJeffersonTravelView(terrain,'jefferson-'+profile.id);assert.ok(view,profile.name+' has a safe view');
  assert.equal(view.sourceId,profile.id);assert.ok(view.distance>=12&&view.distance<100,profile.name+' is framed locally');
  assert.ok(terrain.land(view.x,view.z));assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
  const road=roads.find(r=>r.id===view.roadId)!;assert.ok(road&&/Jefferson/i.test(road.name));
  const distance=Math.min(...road.points.slice(1).map((p,i)=>segment(view.x,view.z,road.points[i],p).d));
  assert.ok(distance<=road.width/2+(view.surface==='sidewalk'?1.8:0)+1e-6);
  assert.ok(view.pitch<=0&&view.pitch>-.6);assert.equal(view.heading,Math.atan2(view.lookX-view.x,view.lookZ-view.z));
 }
 assert.equal(JSON.stringify(terrain.boxes),before,'travel selection never changes collisions');
});
test('Grand and Woodward are normal safe Guide viewpoints facing along Jefferson',()=>{
 const terrain=actualTerrain();
 assert.deepEqual(jeffersonStreetDestinations.map(s=>s.name),['Jefferson Avenue · East Grand Boulevard','Jefferson Avenue · Woodward downtown']);
 for(const destination of jeffersonStreetDestinations){
  const view=selectJeffersonTravelView(terrain,destination.id);assert.ok(view,destination.name);
  assert.ok(view.distance>25&&view.distance<70);assert.ok(terrain.land(view.x,view.z));assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
  assert.ok(Math.sin(view.heading)<-.7,'view faces west toward the intersection');
 }
});
test('omitted sidewalks cannot provide Guide frontage positions',()=>{
 const terrain=actualTerrain(),destination='jefferson-868842406';
 const original=selectJeffersonTravelView(terrain,destination);assert.ok(original);assert.equal(original.surface,'sidewalk');
 const roads=[...map.roads,...districts.roads].map(r=>({...r,sidewalk:false}));
 const view=selectJeffersonTravelView(terrain,destination,{roads});assert.ok(view,'the clear actual carriageway still provides a local view');
 assert.equal(view.surface,'road');assert.ok(view.distance<100);
 const road=roads.find(r=>r.id===view.roadId)!;
 assert.ok(Math.min(...road.points.slice(1).map((p,i)=>segment(view.x,view.z,road.points[i],p).d))<road.width/2);
 assert.equal(terrain.obstructed(view.x,view.z,1.25),false);
});
test('downtown labels follow qualified extension land and preserve existing districts',()=>{
 const terrain=actualTerrain(),woodward=jeffersonStreetDestinations.find(s=>s.id==='jefferson-street-woodward')!;
 assert.ok(terrain.land(woodward.x,woodward.z));assert.equal(districtName(woodward.x,woodward.z),'Downtown Detroit · East Jefferson');
 const river:Point=[-3200,2220];assert.equal(terrain.land(...river),false);assert.equal(districtName(...river),undefined);
 assert.equal(districtName(-4000,2000),undefined,'unmapped land is outside the downtown label');
 assert.equal(districtName(districts.grid.x0+districts.grid.step,districts.grid.z0+districts.grid.step),'Elmwood · cemetery district');
 assert.equal(districtName(map.spawn.x,map.spawn.z),undefined,'island labeling remains unchanged');
 assert.equal(districtName(-2000,1200),'Swoop Detroit · East Side');
});
test('occlusion excludes only the exact target source ID and detects thin unrelated blockers',()=>{
 const target={id:'target',points:rectangle(10,-5,25,5)},thin={id:'neighbor',points:rectangle(5.031,-.1,5.041,.1)};
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'target',[target]),false);
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'jefferson-target',[target]),true,'prefixed UI ID cannot masquerade as a source ID');
 assert.equal(jeffersonViewOccluded([0,0],[20,0],'target',[target,thin]),true);
 assert.equal(jeffersonViewOccluded([0,2],[8,2],'target',[thin]),false);
 const courtyard={id:'neighbor',points:rectangle(0,-4,10,4),holes:[rectangle(1,-3,9,3)]};
 assert.equal(jeffersonViewOccluded([2,0],[8,0],'target',[courtyard]),false,'open courtyard is not filled by its bounds');
 assert.equal(jeffersonViewOccluded([-1,0],[8,0],'target',[courtyard]),true,'courtyard wall still occludes an external approach');
});
test('unrelated camera blockers and blocked terrain reject views without a far fallback',()=>{
 const terrain=actualTerrain(),destination='jefferson-868842406';
 const camera=terrain.raycastCamera,obstructed=terrain.obstructed;
 terrain.raycastCamera=()=>.1;assert.equal(selectJeffersonTravelView(terrain,destination),undefined);
 terrain.raycastCamera=camera;terrain.obstructed=()=>true;assert.equal(selectJeffersonTravelView(terrain,destination),undefined);
 terrain.obstructed=obstructed;
 assert.equal(selectJeffersonTravelView(terrain,destination,{roads:[]}),undefined);
 assert.equal(selectJeffersonTravelView(terrain,'868842406'),undefined);
 assert.equal(selectJeffersonTravelView(terrain,'jefferson-unverified-building'),undefined);
});
test('disconnected nearby road fragments cannot become Guide travel destinations',()=>{
 const terrain=actualTerrain(),profile=JEFFERSON_BUILDINGS.find(p=>p.kind==='pasadena')!,plan=planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)).find(p=>p.profile.id===profile.id)!;
 const road={id:'city-disconnected-test',name:'Jefferson',width:14,points:[[plan.center[0]-40,plan.center[1]-35],[plan.center[0]+40,plan.center[1]-81]] as Point[]};
 assert.equal(selectJeffersonTravelView(terrain,'jefferson-'+profile.id,{roads:[road]}),undefined);
});
