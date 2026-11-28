import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import original from './detroitDistricts.json' with {type:'json'};
import extension from './jeffersonExtension.json' with {type:'json'};
import {districts,districtCollisionBuildings,districtDestinations} from './detroitGround.ts';
import {ParkTerrain,inside,type ParkMap,type Point} from './terrain.ts';

const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;

test('Jefferson extension appends geometry while preserving every original entry identity and order',()=>{
 for(const key of ['land','flat','roads','buildings'] as const){
  const before=original[key],after=districts[key];
  assert(after.length>before.length,key+' did not append extension');
  before.forEach((entry,i)=>assert.equal(after[i],entry,key+' source entry '+i+' was replaced or reordered'));
  assert.deepEqual(after.slice(0,before.length),before);
 }
 for(const key of ['grid','greenway','bridges','routes','models','trees','stones','water','gate','cut'] as const)assert.equal(districts[key],original[key],key+' changed');
 assert.equal(districtDestinations.at(-1)?.id,'greater-detroit-downtown');
 assert.deepEqual([districtDestinations.at(-1)?.x,districtDestinations.at(-1)?.z],extension.destination.point);
});

test('only the new courtyard footprint is split for collision while its visual hole remains intact',()=>{
 original.buildings.forEach((b,i)=>assert.equal(districtCollisionBuildings[i],b,'original collider entry changed'));
 assert.equal(districts.buildings.length-original.buildings.length,49);
 assert.equal(districtCollisionBuildings.length-original.buildings.length,50);
 const source=districts.buildings.find(b=>b.id==='jefferson-city-8423552-0')!;
 assert.equal(source.holes?.length,1);
 assert.equal(source.collisionParts?.length,2);
 const colliders=districtCollisionBuildings.filter(b=>b.id.startsWith(source.id+'-collision-'));
 assert.equal(colliders.length,2);
 colliders.forEach((b,i)=>{
  assert.equal(b.points,source.collisionParts![i]);
  assert.equal(b.height,21.34);
  assert.equal(b.holes,undefined);
 });
});

test('mainland registration keeps original map and district collider ordering and appends fifty solids',()=>{
 const island=new ParkTerrain(map),connected=new ParkTerrain(map,true);
 assert.deepEqual(connected.boxes.slice(0,island.boxes.length),island.boxes);
 original.buildings.forEach((b,i)=>{
  const collider=connected.boxes[island.boxes.length+i];
  assert.equal(collider.points,b.points);
  assert.equal(collider.height,b.height);
 });
 assert.equal(connected.boxes.length,island.boxes.length+original.buildings.length+50);
});

test('Palms courtyard remains walkable while both surrounding wall solids and the reported roof height obstruct',()=>{
 const terrain=new ParkTerrain(map,true),x=-2707.46974,z=1478.05044;
 const source=districts.buildings.find(b=>b.id==='jefferson-city-8423552-0')!;
 assert(inside(x,z,source.points),'negative witness must be inside exterior outline');
 assert(inside(x,z,source.holes![0]),'negative witness must be in courtyard');
 assert(terrain.land(x,z));
 assert.equal(terrain.obstructed(x,z,.2),false);
 assert.equal(terrain.raycastFlight({x,y:25,z},{x:0,y:-1,z:0},30,.1),null);
 for(const [wx,wz]of [[-2696.36833717823,1483.018315],[-2698.9869070151626,1476.769905]]){
  assert(terrain.obstructed(wx,wz,.2),'wall witness must obstruct');
  const hit=terrain.raycastFlight({x:wx,y:25,z:wz},{x:0,y:-1,z:0},30,.1);
  assert(hit!==null&&Math.abs(hit-(25-2-21.34))<.001,'reported overall height must obstruct flight');
 }
});

test('the added Jefferson route is continuous, walkable and clear at sampled rider clearance',()=>{
 const terrain=new ParkTerrain(map,true),main=extension.roads.filter(r=>r.kind==='mainline');
 assert.deepEqual(main[0].points[0],extension.seam);
 for(let i=1;i<main.length;i++)assert.deepEqual(main[i-1].points.at(-1),main[i].points[0]);
 for(const road of main)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10);
  for(let n=0;n<=steps;n++){
   const t=n/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
   assert(terrain.land(x,z),'route lost land at '+[x,z]);
   assert.equal(terrain.obstructed(x,z,.6),false,'route enters a solid at '+[x,z]);
  }
 }
 assert(terrain.land(...extension.destination.point as Point));
 assert.equal(terrain.land(-3512,2500),false,'Detroit River must remain water');
});
