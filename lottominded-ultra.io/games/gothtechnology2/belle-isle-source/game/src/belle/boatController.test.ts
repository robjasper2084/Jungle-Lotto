import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {BoatController} from './boatController.ts';import {BOAT_PROFILES,type BoatKind} from './boatProfiles.ts';import {ParkTerrain,type ParkMap} from './terrain.ts';
const openWater={land:()=>false,raycastFlight:()=>null} as unknown as ParkTerrain;
for(const kind of ['offshore','hydroplane'] as BoatKind[]){
 test(kind+' accelerates, planes, steers, brakes and reverses with finite telemetry',()=>{
  const c=new BoatController(openWater,undefined,kind);c.reset(0,0,0);
  for(let i=0;i<1800;i++)c.advance(1/60,1,0,false);
  assert(c.pose.speed>BOAT_PROFILES[kind].maxSpeed*.7);assert(c.pose.speed<=BOAT_PROFILES[kind].maxSpeed);assert(c.telemetry.planing>.9);assert(c.telemetry.powerPercent>99);assert(c.telemetry.torqueNm>0);
  const heading=c.pose.heading;c.advance(.1,1,1,false);assert(c.pose.heading<heading);assert(c.telemetry.yawRate<0);
  for(let i=0;i<240;i++)c.advance(1/60,0,0,true);assert(Math.abs(c.pose.speed)<.1);
  for(let i=0;i<300;i++)c.advance(1/60,-1,0,false);assert(c.pose.speed<-.5&&c.pose.speed>=-3);
  assert(Object.values(c.pose).every(Number.isFinite));assert(Object.values(c.telemetry).every(Number.isFinite));
  c.stop();assert.equal(c.pose.speed,0);assert.equal(c.telemetry.powerPercent,0);
 });
 test(kind+' does not tunnel through a wall at maximum speed',()=>{
  const wall={land:()=>false,raycastFlight:(o:{z:number},d:{z:number},length:number)=>d.z>0&&o.z<=12&&(12-o.z)/d.z<=length?(12-o.z)/d.z:null} as unknown as ParkTerrain;
  const c=new BoatController(wall,undefined,kind);c.reset(0,0,0);c.pose.speed=BOAT_PROFILES[kind].maxSpeed;let contact=false;for(let i=0;i<120;i++){c.advance(1/60,1,0,false);contact ||= c.collision;assert(c.pose.z<12-BOAT_PROFILES[kind].length/2+.4);}assert.equal(c.pose.speed,0);assert(contact);
 });
 test(kind+' crosses the actual bridge arch and cannot cross a pier',()=>{
  const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,b=map.bridge,dx=(b.b[0]-b.a[0])/b.length,dz=(b.b[1]-b.a[1])/b.length,terrain=new ParkTerrain(map);
  const c=new BoatController(terrain,undefined,kind),start=(fraction:number)=>c.reset(b.a[0]+(b.b[0]-b.a[0])*fraction-dz*25,b.a[1]+(b.b[1]-b.a[1])*fraction+dx*25,Math.atan2(dz,-dx));
  start(.5);for(let i=0;i<600;i++)c.advance(1/60,1,0,false);assert(terrain.bridge(c.pose.x,c.pose.z).side>13);
  start(9/19);for(let i=0;i<300;i++)c.advance(1/60,1,0,false);assert(terrain.bridge(c.pose.x,c.pose.z).side< -12);assert.equal(c.pose.speed,0);
 });
}
test('invalid durations cannot move a boat or poison instrument readings',()=>{const c=new BoatController(openWater);for(const dt of [NaN,Infinity,-1,0]){const before={...c.pose};c.advance(dt,1,1,false);assert.deepEqual(c.pose,before);}c.advance(.1,NaN,Infinity,false);assert(Object.values(c.pose).every(Number.isFinite));});
