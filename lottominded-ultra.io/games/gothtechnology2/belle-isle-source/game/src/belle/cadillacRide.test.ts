import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {CadillacRide} from './cadillacRide.ts';
import type {ParkTerrain} from './terrain.ts';

const glb=readFileSync('public/belle/vehicles/silver-cadillac.glb');
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
test('Fleetwood retains four shared wheel meshes and its mobile rendering budget',()=>{
  assert.equal(glb.toString('ascii',0,4),'glTF');
  assert.equal(glb.readUInt32LE(8),glb.length);
  const tireMeshes=asset.nodes.filter((n:{name:string})=>/^Tire[FR][LR]$/.test(n.name)).map((n:{mesh:number})=>n.mesh);
  assert.equal(tireMeshes.length,4);
  assert.equal(new Set(tireMeshes).size,1);
  let calls=0,triangles=0;
  for(const node of asset.nodes)if(node.mesh!==undefined)for(const p of asset.meshes[node.mesh].primitives){
    calls++;triangles+=asset.accessors[p.indices].count/3;
  }
  assert(calls<=22&&triangles<55000&&glb.length<2*1024**2);
});
test('Fleetwood rig drives, steers, brakes, opens at rest and stops before a wall',()=>{
  const group=new T.Group();
  for(const n of asset.nodes){const part=new T.Group();part.name=n.name;if(n.translation)part.position.fromArray(n.translation);group.add(part);}
  let wall=Infinity;
  const terrain={map:{spawn:{x:0,z:0,heading:0},roads:[{points:[[0,-20],[0,20]]}]},
    height:()=>0,land:()=>true,obstructed:(_x:number,z:number)=>z>=wall,bridge:()=>({active:false,t:0,side:0}),
    raycastObstacle:()=>null} as unknown as ParkTerrain;
  const ride=new CadillacRide(group,terrain);ride.start();
  const advance=(frames:number,gas:number,brake:number,steer:number)=>{
    for(let i=0;i<frames;i++)ride.update(1/60,{gas,brake,steer,handbrake:false},0,false);
  };
  advance(70,1,0,.4);
  assert(ride.sim.pose.speed>2);
  assert.notEqual(group.getObjectByName('HubFL')!.rotation.y,group.getObjectByName('HubFR')!.rotation.y);
  assert.equal(group.getObjectByName('HubRL')!.rotation.y,0);
  assert(new Set(ride.diagnostics().wheelPhaseRad).size>1);
  ride.toggleDoor();assert(ride.diagnostics().driverDoorRad===0);
  wall=ride.sim.pose.z+6;
  advance(150,1,0,0);assert.equal(ride.sim.pose.speed,0);assert(ride.sim.pose.z<wall-2.5);
  ride.toggleDoor();advance(45,1,0,0);
  assert(ride.diagnostics().driverDoorRad<-.9&&ride.sim.pose.speed===0);
  ride.toggleDoor();advance(100,0,1,0);
  assert.equal(ride.sim.gear,'R');assert(ride.sim.pose.speed<0);
});
