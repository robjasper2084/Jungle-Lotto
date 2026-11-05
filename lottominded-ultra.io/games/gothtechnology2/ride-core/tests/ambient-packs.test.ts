import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommunityRide,LaneRoute} from '../src/communityRide.ts';
import {AmbientCyclistTraffic,cyclistCircuit,packStarts,AMBIENT_CYCLIST_PACE} from '../src/ambientCyclists.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});return out;},raycast:()=>null,raycastObstacle:()=>null};

test('starting a ride puts a pack within view without moving it again during play',()=>{
 const traffic=new AmbientCyclistTraffic(flat,cyclistCircuit([{x:0,z:0,width:5},{x:0,z:1000,width:5},{x:30,z:2000,width:5}]),523),observer={x:0,z:400};traffic.restart(523,observer);
 assert(traffic.rides[0].riders.every(r=>Math.hypot(r.x-observer.x,r.z-observer.z)<85));
 const start=traffic.rides[0].riders[0].s;traffic.update(.05,{x:0,z:1600});assert(Math.abs(traffic.rides[0].riders[0].s-start)<1);
});
test('roaming riders yield to a player in their lane',()=>{
 const traffic=new AmbientCyclistTraffic(flat,cyclistCircuit([{x:0,z:0,width:5},{x:0,z:1000,width:5},{x:30,z:2000,width:5}]),523);traffic.restart(523,{x:0,z:100});const r=traffic.rides[0].riders[0],obstacle={id:'player',x:r.x,y:r.y,z:r.z+1.1,radius:.65,height:1.8,kind:'rider',vx:0,vz:0};
 for(let i=0;i<20;i++)traffic.update(.05,obstacle,false,[obstacle]);assert(Math.hypot(r.x-obstacle.x,r.z-obstacle.z)>1);assert(r.speed<AMBIENT_CYCLIST_PACE);
});
test('two random starts remain separate and repeatable for a given session seed',()=>{
 for(let seed=1;seed<100;seed++){
  const positions=packStarts(2400,seed);assert.deepEqual(positions,packStarts(2400,seed));
  const difference=Math.abs(positions[1]-positions[0]),gap=Math.min(difference,2400-difference);assert.ok(gap>=840-1e-7);
 }
 assert.notDeepEqual(packStarts(2400,1),packStarts(2400,500));
});
test('pausing freezes both simulation and interpolated cyclist poses',()=>{
 const traffic=new AmbientCyclistTraffic(flat,cyclistCircuit([{x:0,z:0,width:5},{x:0,z:100,width:5},{x:30,z:200,width:5}]),523);
 for(let i=0;i<8;i++)traffic.update(.017,{x:0,z:0});const before=JSON.stringify(traffic.telemetry());
 traffic.update(1,{x:0,z:0},true);assert.equal(JSON.stringify(traffic.telemetry()),before);
 traffic.restart(99123);assert.deepEqual(traffic.rides.map(r=>r.riders.length),[10,10]);
});
test('random starts shift the complete pack away from a solid obstacle',()=>{
 const points=cyclistCircuit([{x:0,z:0,width:5},{x:0,z:100,width:5},{x:30,z:200,width:5}]);
 const route=new LaneRoute(points),seed=523,blocked=route.at(packStarts(route.length,seed)[0],.65);
 const terrain:TerrainSampler={...flat,raycastObstacle:o=>Math.hypot(o.x-blocked.x,o.z-blocked.z)<2?0:null};
 const traffic=new AmbientCyclistTraffic(terrain,points,seed);
 assert.notEqual(traffic.starts[0],packStarts(route.length,seed)[0]);
 for(const ride of traffic.rides)for(const r of ride.riders)assert.ok(Math.hypot(r.x-blocked.x,r.z-blocked.z)>=2);
});
test('ambient routes close on existing lanes and allow ten articulated cyclists per pack',()=>{
 const circuit=cyclistCircuit([{x:0,z:0,width:5},{x:0,z:100,width:5},{x:30,z:200,width:5}]);
 assert.deepEqual(circuit[0],circuit.at(-1));
 const route=new LaneRoute(circuit),ride=new CommunityRide(route,flat,AMBIENT_CYCLIST_PACE,10);
 assert.equal(ride.riders.length,10);assert.ok(ride.pace>=9);
 for(let s=0;s<=route.length;s+=.5){const p=route.at(s);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));}
});
