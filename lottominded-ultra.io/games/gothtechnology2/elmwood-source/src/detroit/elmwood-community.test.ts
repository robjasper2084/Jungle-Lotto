import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CommunityRide,LaneRoute,COMMUNITY_PACE} from './riding/communityRide.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';
import {elmwoodCommunityRoute} from './elmwood-community-route.ts';
import {createGroundSample} from '../simulation/world.ts';
const read=async(name:string)=>JSON.parse(await readFile(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
test('Elmwood group completes the real Creek Lane corridor without an off-road shortcut',async()=>{
 const [grid,site,placements]=await Promise.all(['terrain.json','site.json','placements.json'].map(read));const map=new ElmwoodTerrain(grid,site.features,placements);await map.init();const terrain=rideCoreTerrain(map);
 const route=new LaneRoute(map.features.find(f=>f.id==='59197492')!.points.map(p=>({x:p[0],z:-p[1],width:4}))).section(25,175),ride=new CommunityRide(route,terrain,COMMUNITY_PACE,4);
 ride.join({...route.at(0,-.85)});ride.continue();let s=0,minimum=Infinity,spread=0;
 for(let i=0;i<5400&&ride.stage!=='complete';i++){s=Math.min(route.length-1,s+COMMUNITY_PACE/60);const p=route.at(s,-.85);ride.step(1/60,{...p,y:map.height(p.x,-p.z),speed:COMMUNITY_PACE});
   for(let j=1;j<4;j++)for(let k=0;k<j;k++)minimum=Math.min(minimum,Math.hypot(ride.riders[j].x-ride.riders[k].x,ride.riders[j].z-ride.riders[k].z));
   if(ride.riders[0].s<100)spread=Math.max(spread,Math.max(...ride.riders.map(r=>r.offset))-Math.min(...ride.riders.map(r=>r.offset)));
 }
 assert.equal(ride.stage,'complete',JSON.stringify(ride.riders));assert.equal(ride.completed,true);assert.ok(ride.elapsed<60,String(ride.elapsed));assert.ok(minimum>=1.25,String(minimum));assert.ok(spread>1.5);
 const state=JSON.stringify(ride.riders);ride.step(1,{...route.at(149),y:0,speed:0});assert.equal(JSON.stringify(ride.riders),state);map.physics.free();
});

test('Elmwood cyclists set off automatically and ride repeated laps on a connected tour of every side of the grounds',async t=>{
 const [grid,site,placements]=await Promise.all(['terrain.json','site.json','placements.json'].map(read));const map=new ElmwoodTerrain(grid,site.features,placements);await map.init();t.after(()=>map.physics.free());
 const route=elmwoodCommunityRoute(map.features),ride=new CommunityRide(route,rideCoreTerrain(map),COMMUNITY_PACE,4);ride.autoStart=true;
 assert.ok(route.length>1800);assert.ok(Math.min(...route.points.map(p=>p.x))<-400);assert.ok(Math.max(...route.points.map(p=>p.x))>140);assert.ok(Math.min(...route.points.map(p=>p.z))<-880);
 assert.equal(route.loop,true);let furthest=0,minimum=Infinity,stalled=0,maxStep=0,seamStep=0;
 for(let i=0;i<1800*20&&ride.laps<3;i++){
  const before=ride.riders.map(r=>({x:r.x,z:r.z,s:r.s}));ride.step(1/20,{x:10000,y:0,z:10000,speed:0});
  ride.riders.forEach((r,i)=>{const distance=Math.hypot(r.x-before[i].x,r.z-before[i].z);maxStep=Math.max(maxStep,distance);if(Math.floor(r.s/route.length)!==Math.floor(before[i].s/route.length))seamStep=Math.max(seamStep,distance);});
  stalled=ride.stage==='riding'&&ride.riders.every(r=>r.speed<.01)?stalled+1:0;
  assert.ok(stalled<10*20,'tour cannot remain stuck: '+JSON.stringify(ride.riders));
  if(i===12*20)assert.ok(ride.riders.every(r=>r.s>20),'every cyclist leaves the gathering: '+JSON.stringify(ride.riders));
  for(const r of ride.riders){const g=map.sampleGround(r.x,r.z,createGroundSample());assert.equal(g.offCourse,false);assert.notEqual(g.surface,'grass','tour stays on lanes');furthest=Math.max(furthest,r.s);}
  for(let j=1;j<4;j++)for(let k=0;k<j;k++)minimum=Math.min(minimum,Math.hypot(ride.riders[j].x-ride.riders[k].x,ride.riders[j].z-ride.riders[k].z));
 }
 assert.equal(ride.stage,'riding',JSON.stringify({length:route.length,furthest,riders:ride.riders}));assert.equal(ride.laps,3);assert.equal(ride.completed,false);assert.ok(ride.riders.every(r=>!r.parked&&r.speed>1),JSON.stringify(ride.riders));assert.ok(maxStep<1.25,'bounded movement: '+maxStep);assert.ok(seamStep<.6,'continuous lap boundary: '+seamStep);assert.ok(minimum>1.24,String(minimum));
 t.diagnostic(JSON.stringify({metres:route.length,seconds:ride.elapsed,separation:minimum,laps:ride.laps,maxStep,seamStep}));
});

