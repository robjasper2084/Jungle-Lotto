import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DetroitWorld,trafficAt} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toLocal} from './geo-profile.ts';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample} from './terrain.ts';

test('a newly streamed cyclist cannot appear through a successful remount',async()=>{
 const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped);
 try{
  const cyclist=trafficAt(3,0),position=toLocal(cyclist.x,cyclist.y,cyclist.z);
  position.y=terrain.sampleGround(position.x,position.z,createGroundSample()).height;
  mapped.updateTraffic(0,1e8,1e8);mapped.step();
  const rider=new RideController(terrain,{spawn:{position,headingY:-cyclist.heading}});
  assert.equal(rider.recover(),true,'the unloaded actor is not part of the current collision query');
  mapped.updateTraffic(0,cyclist.x,cyclist.z);mapped.step();
  assert.equal(mapped.traffic.some(t=>t.id===cyclist.id),false,'streaming after recovery must respect the new mounted volume');
  for(let i=0;i<120;i++){
   mapped.updateTraffic(i/120,cyclist.x,cyclist.z);mapped.step();rider.step(1/120,NEUTRAL_ACTIONS);
   assert.equal(rider.crashed,false,'no immediate re-collision from a newly activated actor');
  }
 }finally{mapped.physics.free();}
});

test('the reservation expires by simulation ticks, preserves active traffic, and never removes static hazards',async()=>{
 const world=await new DetroitWorld().init();
 try{
  const t=trafficAt(3,0);world.updateTraffic(0,1e8,1e8);world.step();world.reserveRecoverySpace(t,.6,2.2);
  for(let i=0;i<200;i++)world.updateTraffic(0,t.x,t.z);
  assert.equal(world.traffic.some(a=>a.id===t.id),false,'render/pause updates do not consume the reservation');
  for(let i=0;i<145;i++)world.step();world.updateTraffic(0,t.x,t.z);
  assert.equal(world.traffic.some(a=>a.id===t.id),true,'ordinary traffic can activate after the short window');
  const collider=world.trafficBodies.get(t.id);world.reserveRecoverySpace(t,.6,2.2);world.updateTraffic(.5,t.x,t.z);
  const moving=world.traffic.find(a=>a.id===t.id)!;assert.equal(moving.direction,t.direction);assert.ok(moving.routeDistance!>=t.routeDistance!);assert.ok(Math.hypot(moving.x-t.x,moving.z-t.z)<2.2,'active traffic may detour, but must not teleport');assert.equal(world.trafficBodies.get(t.id),collider);
  const cone=trafficAt(7,0);world.clearRecoverySpace();world.updateTraffic(0,1e8,1e8);world.step();
  assert.equal(world.mountedClear(cone,0,.6,2.2),false,'unloaded cones remain excluded from safe placement');
  world.reserveRecoverySpace(cone,.6,2.2);world.updateTraffic(0,cone.x,cone.z);assert.ok(world.traffic.some(a=>a.id===cone.id),'static hazard collision is never disabled by recovery');
  world.updateTraffic(0,1e8,1e8);world.reserveRecoverySpace(t,.6,2.2);world.clearRecoverySpace();world.updateTraffic(0,t.x,t.z);assert.ok(world.traffic.some(a=>a.id===t.id),'restart clears the old reservation');
 }finally{world.physics.free();}
});
