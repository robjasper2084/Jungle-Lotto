import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JEFFERSON_SIGNAL_BASE_RADIUS,JEFFERSON_SIGNAL_INVENTORY,jeffersonSignalPhase,planJeffersonSignals,projectJeffersonSignal,type JeffersonSignalSource,type SignalPoint,type SignalRoad} from './jeffersonSignalPlan.ts';
import {ParkTerrain,segment,type ParkMap,type Point} from './terrain.ts';
import {districts} from './detroitGround.ts';
import {planJeffersonBuildings,registerJeffersonBuildingSolids} from './jeffersonBuildings.ts';
import {createJeffersonPedestrianClearance,type JeffersonWalkingCorridor} from './jeffersonPedestrianClearance.ts';
import originalDistricts from './detroitDistricts.json' with {type:'json'};
import sourceSidewalks from './jeffersonSidewalks.json' with {type:'json'};

const origin:JeffersonSignalSource={objectId:999,intersectionId:999,name:'Cross',crossNames:['cross'],longitude:-83.00175,latitude:42.34680,electrical:'Signal'};
const synthetic:SignalRoad[]=[
 {id:'main',name:'East Jefferson Avenue',width:14,points:[[-100,58.3],[100,-58.3]]},
 {id:'cross',name:'Cross Street',width:8,points:[[-58.3,-100],[58.3,100]]},
];
const open={roads:synthetic,sources:[origin],land:()=>true,obstructed:()=>false};
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
// Use the original runtime map, not a synthetic map built to fit the planner.

test('signal intergreens retain amber then two all-red seconds in both directions',()=>{
 const expected:[number,string,string][]=[[0,'green','red'],[45.999,'green','red'],[46,'amber','red'],[49.999,'amber','red'],[50,'red','red'],[51.999,'red','red'],[52,'red','green'],[81.999,'red','green'],[82,'red','amber'],[85.999,'red','amber'],[86,'red','red'],[87.999,'red','red'],[88,'green','red']];
 for(const [t,main,cross]of expected){const p=jeffersonSignalPhase(t);assert.equal(p.jefferson,main);assert.equal(p.cross,cross);}
 for(let t=-176;t<264;t+=.125){const p=jeffersonSignalPhase(t,36);assert.ok(p.jefferson==='red'||p.cross==='red','conflicting movements may never both proceed');}
});
test('phase evaluation is periodic and fails to all-red on invalid time',()=>{
 for(const t of [-88,-.5,0,46,51,52,86,87.5])assert.deepEqual(jeffersonSignalPhase(t),jeffersonSignalPhase(t+88*1_000_000));
 for(const t of [NaN,Infinity,-Infinity])assert.deepEqual(jeffersonSignalPhase(t),{key:2,jefferson:'red',cross:'red'});
 assert.deepEqual(jeffersonSignalPhase(0,NaN),{key:2,jefferson:'red',cross:'red'});
});
test('inventory preserves source identity and excludes the unsignalized Grand crossover',()=>{
 assert.equal(JEFFERSON_SIGNAL_INVENTORY.length,13);assert.equal(new Set(JEFFERSON_SIGNAL_INVENTORY.map(s=>s.objectId)).size,13);
 assert.ok(!JEFFERSON_SIGNAL_INVENTORY.some(s=>s.objectId===195));
 assert.deepEqual(projectJeffersonSignal(-83.0015752696423,42.3470310199068),[14.38,-25.72]);
 assert.equal(JEFFERSON_SIGNAL_INVENTORY.at(-1)!.name,'Woodward');
 assert.throws(()=>{(JEFFERSON_SIGNAL_INVENTORY[0] as {latitude:number}).latitude=0;});
 assert.throws(()=>{(JEFFERSON_SIGNAL_INVENTORY[0].crossNames as string[]).push('fake');});
});
function roadClearance(point:SignalPoint,roads:readonly SignalRoad[]){
 return Math.min(...roads.filter(r=>!r.foot&&!r.bridge).flatMap(r=>r.points.slice(1).map((p,i)=>segment(point[0],point[1],r.points[i] as Point,p as Point).d-r.width*.5)));
}
test('supported intersections face approaching traffic and keep all supports outside roads',()=>{
 const plan=planJeffersonSignals(open);assert.equal(plan.junctions.length,1);const j=plan.junctions[0];
 assert.equal(j.fixtures.length,4);assert.ok(Object.isFrozen(j.fixtures));
 for(const axis of ['jefferson','cross']){
  const pair=j.fixtures.filter(f=>f.axis===axis);assert.equal(pair.length,2);
  assert.ok(pair[0].travel[0]*pair[1].travel[0]+pair[0].travel[1]*pair[1].travel[1]<-.999);
 }
 for(const f of j.fixtures){
  assert.ok(roadClearance(f.pole,synthetic)>=.8-1e-8);
  if(f.support)assert.ok(roadClearance(f.support,synthetic)>=.8-1e-8);
  for(const head of f.heads){assert.ok(roadClearance(head,synthetic)<0,'head must hang over a mapped carriageway');assert.ok(head[0]*f.travel[0]+head[1]*f.travel[1]>0,'heads are on the far side facing the approaching driver');}
 }
});
test('unnamed cross streets and a mislabeled perpendicular Jefferson segment do not invent directions',()=>{
 const unknown=planJeffersonSignals({...open,roads:[synthetic[0],{...synthetic[1],name:'Unidentified'}]});
 assert.equal(unknown.junctions[0].fixtures.length,2);assert.equal(unknown.junctions[0].crossRoadId,undefined);
 const wrong=planJeffersonSignals({...open,roads:[{...synthetic[1],name:'Jefferson'}]});
 assert.equal(wrong.junctions.length,0);assert.equal(wrong.excluded[0].reason,'outside-mapped-roads');
});
test('missing land or blocked shoulders exclude signals without moving roads or obstacles',()=>{
 const before=JSON.stringify(synthetic);
 assert.equal(planJeffersonSignals({...open,land:()=>false}).excluded[0].reason,'outside-mapped-roads');
 assert.equal(planJeffersonSignals({...open,obstructed:()=>true}).excluded[0].reason,'no-clear-pole-placement');
 assert.equal(JSON.stringify(synthetic),before);
});
test('optional pedestrian clearance preserves the default plan and supplies the complete base radius',()=>{
 const original=planJeffersonSignals(open),checked:SignalPoint[]=[];
 const allowed=planJeffersonSignals({...open,pedestrianClearance:(x,z,radius)=>{assert.equal(radius,.33);checked.push([x,z]);return true;}});
 assert.deepEqual(allowed,original);
 for(const fixture of allowed.junctions[0].fixtures)for(const p of [fixture.pole,...(fixture.support?[fixture.support]:[])]){
  assert.ok(checked.some(q=>q[0]===p[0]&&q[1]===p[1]),'every accepted pole and span anchor passes the pedestrian guard');
 }
});
test('a pedestrian landing overlapping only a span anchor base selects another safe suspended fixture',()=>{
 const input={...open,sources:[{...origin,objectId:417}]},original=planJeffersonSignals(input),anchor=original.junctions[0].fixtures[0].support!;
 // The original anchor centre is outside this landing. Its 0.33 m foot still
 // overlaps: checking only the centre would leave a real walking obstruction.
 const landing={minX:anchor[0]+.3,maxX:anchor[0]+.7,minZ:anchor[1]-1.5,maxZ:anchor[1]+1.5};
 const pedestrianClearance=(x:number,z:number,radius:number)=>Math.hypot(Math.max(landing.minX-x,0,x-landing.maxX),Math.max(landing.minZ-z,0,z-landing.maxZ))>=radius;
 assert.equal(pedestrianClearance(...anchor,JEFFERSON_SIGNAL_BASE_RADIUS),false);
 const plan=planJeffersonSignals({...input,pedestrianClearance});
 assert.equal(plan.junctions.length,1);assert.equal(plan.junctions[0].fixtures.length,original.junctions[0].fixtures.length);
 assert.notDeepEqual(plan.junctions[0].fixtures[0].support,anchor);
 for(const fixture of plan.junctions[0].fixtures){
  assert.ok(fixture.support,'the photographed suspended family keeps its opposite anchor');
  for(const p of [fixture.pole,fixture.support]){
   assert.equal(pedestrianClearance(...p,JEFFERSON_SIGNAL_BASE_RADIUS),true);
   assert.ok(roadClearance(p,synthetic)>=.8-1e-8,'alternate supports retain the full carriageway guard');
  }
 }
});
test('original map activates seven sourced junctions with every pole and anchor clear',()=>{
 const terrain=new ParkTerrain(map,true),roads=[...map.roads,...originalDistricts.roads] as unknown as SignalRoad[];
 const before=JSON.stringify(terrain.boxes),plan=planJeffersonSignals({roads,land:(x,z)=>terrain.land(x,z),obstructed:(x,z,r)=>terrain.obstructed(x,z,r)});
 assert.deepEqual(plan.junctions.map(j=>j.source.name),['East Grand Boulevard','Mount Elliott','McDougall / Walker','Joseph Campau','Chene','Dubois','Saint Aubin']);
 assert.equal(plan.excluded.length,6);assert.ok(plan.excluded.every(e=>e.reason==='outside-mapped-roads'));
 for(const junction of plan.junctions)for(const f of junction.fixtures)for(const p of [f.pole,...(f.support?[f.support]:[])]){
  assert.ok(terrain.land(...p));assert.equal(terrain.obstructed(...p,.7),false);assert.ok(roadClearance(p,roads)>=.8-1e-8);
 }
 for(const junction of plan.junctions)for(const fixture of junction.fixtures)for(const head of fixture.heads)assert.ok(roadClearance(head,roads)<0,'every actual-map head hangs over a carriageway');
 const campau=plan.junctions.find(j=>j.source.objectId===417)!;assert.ok(campau.fixtures.every(f=>f.support),'photographed wire suspension requires valid opposite supports');
 assert.equal(JSON.stringify(terrain.boxes),before);
});
test('the complete sourced corridor reaches Woodward with thirteen safe junctions',()=>{
 const terrain=new ParkTerrain(map,true),roads=[...map.roads,...districts.roads] as SignalRoad[];
 registerJeffersonBuildingSolids(terrain,planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)));
 const before=JSON.stringify(terrain.boxes),plan=planJeffersonSignals({roads,land:(x,z)=>terrain.land(x,z),obstructed:(x,z,r)=>terrain.obstructed(x,z,r)});
 assert.deepEqual(plan.junctions.map(j=>j.source.objectId),JEFFERSON_SIGNAL_INVENTORY.map(s=>s.objectId));
 assert.deepEqual(plan.excluded,[]);
 // The northern surface carriageway is necessary at Chrysler west: using
 // only the southern curved branch misses the official source center by 44 m.
 const west=plan.junctions.find(j=>j.source.objectId===415)!;
 assert.equal(west.jeffersonRoadId,'city-jefferson-extension-32702');
 for(const junction of plan.junctions){
  assert.deepEqual(junction.center,projectJeffersonSignal(junction.source.longitude,junction.source.latitude),'source centers are never relocated to make signals fit');
  const road=roads.find(r=>r.id===junction.jeffersonRoadId)!;
  assert.ok(Math.min(...road.points.slice(1).map((p,i)=>segment(...junction.center,road.points[i] as Point,p as Point).d))<=18);
  const primary=junction.fixtures.filter(f=>f.axis==='jefferson');assert.equal(primary.length,2);
  assert.ok(primary[0].travel[0]*primary[1].travel[0]+primary[0].travel[1]*primary[1].travel[1]<-.999);
  for(const fixture of junction.fixtures){
   for(const point of [fixture.pole,...(fixture.support?[fixture.support]:[])]){
    assert.ok(terrain.land(...point));assert.equal(terrain.obstructed(...point,.7),false);
    assert.ok(roadClearance(point,roads)>=.8-1e-8,junction.source.name+' support clears every mapped carriageway');
   }
   for(const head of fixture.heads){assert.ok(terrain.land(...head));assert.ok(roadClearance(head,roads)<0,'heads remain over actual mapped carriageways');}
  }
 }
 assert.equal(JSON.stringify(terrain.boxes),before,'signal placement cannot alter collision geometry');
});
test('the full corridor keeps every signal while clearing central walking bands on qualified City sidewalks',()=>{
 const terrain=new ParkTerrain(map,true),roads=[...map.roads,...districts.roads] as SignalRoad[];
 registerJeffersonBuildingSolids(terrain,planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)));
 // These independent centre lines protect 1.2 m of the current 1.8 m sidewalk
 // width. Source coordinates and sidewalk:false are retained. Endpoint caps
 // make the fixture conservative at junction landings as well as mid-block.
 const walks=districts.roads.filter(r=>r.id.startsWith('city-')&&r.sidewalk!==false&&r.name!=='Elmwood Cemetery entrance').flatMap(r=>r.points.slice(1).flatMap((b,i)=>{
  const a=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.1)return [];
  return [-1,1].map(side=>{const offset=(r.width/2+.9)*side,nx=-dz/length*offset,nz=dx/length*offset;return {a:[a[0]+nx,a[1]+nz] as Point,b:[b[0]+nx,b[1]+nz] as Point};});
 }));
 const pedestrianClearance=(x:number,z:number,radius:number)=>walks.every(w=>segment(x,z,w.a,w.b).d>=.6+radius);
 const input={roads,land:(x:number,z:number)=>terrain.land(x,z),obstructed:(x:number,z:number,r:number)=>terrain.obstructed(x,z,r)},original=planJeffersonSignals(input);
 assert.ok(original.junctions.some(j=>j.fixtures.some(f=>[f.pole,...(f.support?[f.support]:[])].some(p=>!pedestrianClearance(...p,JEFFERSON_SIGNAL_BASE_RADIUS)))),'the real fixture contains pedestrian pinches before the guard is enabled');
 const before=JSON.stringify(terrain.boxes),plan=planJeffersonSignals({...input,pedestrianClearance});
 assert.deepEqual(plan.junctions.map(j=>j.source.objectId),JEFFERSON_SIGNAL_INVENTORY.map(s=>s.objectId));assert.deepEqual(plan.excluded,[]);
 for(const junction of plan.junctions){
  assert.equal(junction.fixtures.length,original.junctions.find(j=>j.source.objectId===junction.source.objectId)!.fixtures.length,'no existing signal direction is omitted');
  for(const fixture of junction.fixtures)for(const p of [fixture.pole,...(fixture.support?[fixture.support]:[])]){
   assert.equal(pedestrianClearance(...p,JEFFERSON_SIGNAL_BASE_RADIUS),true,junction.source.name+' base clears the protected pedestrian band');
   assert.ok(terrain.land(...p));assert.equal(terrain.obstructed(...p,.7),false);assert.ok(roadClearance(p,roads)>=.8-1e-8);
  }
 }
 assert.equal(JSON.stringify(terrain.boxes),before);
});
test('all thirteen actual junctions retain their heads while every base clears the sourced walking corridors',()=>{
 const terrain=new ParkTerrain(map,true),roads=[...map.roads,...districts.roads] as SignalRoad[];
 registerJeffersonBuildingSolids(terrain,planJeffersonBuildings(map,(x,z)=>terrain.height(x,z)));
 const corridors=sourceSidewalks.walkingCorridors as unknown as readonly JeffersonWalkingCorridor[];
 assert.ok(corridors.length>0);assert.ok(corridors.some(c=>c.category==='sidewalk'));assert.ok(corridors.some(c=>c.category.startsWith('crosswalk')));
 const input={roads,land:(x:number,z:number)=>terrain.land(x,z),obstructed:(x:number,z:number,r:number)=>terrain.obstructed(x,z,r)};
 const original=planJeffersonSignals(input),before=JSON.stringify(terrain.boxes);
 const plan=planJeffersonSignals({...input,pedestrianClearance:createJeffersonPedestrianClearance(corridors)});
 assert.deepEqual(plan.junctions.map(j=>j.source.objectId),JEFFERSON_SIGNAL_INVENTORY.map(s=>s.objectId));assert.deepEqual(plan.excluded,[]);
 assert.notDeepEqual(plan,original,'source sidewalk protection must actually correct the prior pole placements');
 for(const junction of plan.junctions){
  const previous=original.junctions.find(j=>j.source.objectId===junction.source.objectId)!;
  assert.deepEqual(junction.center,previous.center,'the City intersection remains fixed');
  assert.deepEqual(junction.fixtures.map(f=>[f.axis,f.heads.length]),previous.fixtures.map(f=>[f.axis,f.heads.length]),'all original signal directions and heads remain');
  for(const fixture of junction.fixtures){
   if(junction.source.objectId===417)assert.ok(fixture.support,'Joseph Campau retains the photographed span-wire family');
   for(const point of [fixture.pole,...(fixture.support?[fixture.support]:[])]){
    assert.ok(terrain.land(...point));assert.equal(terrain.obstructed(...point,.7),false);assert.ok(roadClearance(point,roads)>=.8-1e-8);
    // Independently scan every source segment rather than asking the indexed
    // predicate whether its own accepted result was safe. The base footprint
    // and 0.10 m furnishing gap must miss the complete central walking band.
    for(const corridor of corridors)for(let i=1;i<corridor.points.length;i++){
     const a=corridor.points[i-1],b=corridor.points[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-5)continue;
     assert.ok(segment(...point,a as Point,b as Point).d>=Math.min(corridor.widthM/2,.9)+.1+JEFFERSON_SIGNAL_BASE_RADIUS-1e-8,junction.source.name+' support overlaps source walking corridor '+corridor.id);
    }
   }
   for(const head of fixture.heads){assert.ok(terrain.land(...head));assert.ok(roadClearance(head,roads)<0,'heads remain over actual mapped carriageways');}
  }
 }
 assert.equal(JSON.stringify(terrain.boxes),before,'pedestrian-aware signal planning preserves all collision data');
});
test('a terminal mapped street uses a safe near-side head without extending the road',()=>{
 const roads=[{...synthetic[0],points:[[-100,58.3],[0,0]] as Point[]},synthetic[1]],plan=planJeffersonSignals({...open,roads});
 assert.equal(plan.junctions.length,1);
 const primary=plan.junctions[0].fixtures.filter(f=>f.axis==='jefferson');assert.equal(primary.length,2);
 assert.ok(primary.some(f=>f.heads[0][0]*f.travel[0]+f.heads[0][1]*f.travel[1]<0),'missing far-side road is not invented');
 for(const fixture of primary){assert.ok(roadClearance(fixture.pole,roads)>=.8-1e-8);for(const head of fixture.heads)assert.ok(roadClearance(head,roads)<0);}
});
