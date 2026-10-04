import {test} from 'node:test';import assert from 'node:assert/strict';
import {BicycleController} from '@digital-static/ridecore/cycling';
import {walkBicycleBack} from './bikeManeuver.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('a stopped NPC rolls back slowly with a planted foot and idle pedals',()=>{
 const bike=new BicycleController(flat);
 for(let n=0;n<120;n++)assert.ok(walkBicycleBack(bike,flat,1/120,.6));
 assert.ok(bike.cycle.z<-.5&&Math.hypot(bike.cycle.x,bike.cycle.z)<=.65);
 assert.ok(bike.cycle.headingY>.4&&bike.cycle.headingY<=.6);assert.equal(bike.cycle.speed,0);assert.equal(bike.pedalPhase,0);assert.equal(bike.pedaling,false);assert.equal(bike.cycle.stopFoot,1);
});
test('a backing bicycle stays clear of a pedestrian, wall and raised floor',()=>{
 for(const terrain of [
  {...flat,navigationObstacles:()=>[{id:'walker',x:0,y:0,z:-.85,radius:.3,height:1.8,kind:'pedestrian',vx:0,vz:0}]},
  {...flat,raycastObstacle:()=>.2},
  {...flat,sampleGround(_x:number,z:number,out:ReturnType<typeof createGroundSample>){return Object.assign(out,createGroundSample(),{height:z<0?1:0});}}
 ]){
  const bike=new BicycleController(terrain),start={x:bike.cycle.x,z:bike.cycle.z,heading:bike.cycle.headingY};
  assert.equal(walkBicycleBack(bike,terrain,1/120,.6),false);assert.deepEqual({x:bike.cycle.x,z:bike.cycle.z,heading:bike.cycle.headingY},start);
 }
});
