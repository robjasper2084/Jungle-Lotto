import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {CadillacRide} from './cadillacRide.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {ParkTerrain} from './terrain.ts';

const glb=readFileSync('public/belle/vehicles/silver-cadillac.glb');
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
// Exercise the actual shipped hierarchy and index buffers. Texture references
// alone are removed in memory because Node has no browser image decoder.
const fixtureData=structuredClone(asset);fixtureData.materials=(fixtureData.materials??[]).map((material:{name:string})=>({name:material.name}));
const json=Buffer.from(JSON.stringify(fixtureData)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const binary=glb.subarray(20+glb.readUInt32LE(12)),fixtureGlb=Buffer.alloc(20+padded.length+binary.length);
fixtureGlb.write('glTF');fixtureGlb.writeUInt32LE(2,4);fixtureGlb.writeUInt32LE(fixtureGlb.length,8);fixtureGlb.writeUInt32LE(padded.length,12);fixtureGlb.writeUInt32LE(0x4e4f534a,16);padded.copy(fixtureGlb,20);binary.copy(fixtureGlb,20+padded.length);
const actual=await new GLTFLoader().parseAsync(fixtureGlb.buffer.slice(fixtureGlb.byteOffset,fixtureGlb.byteOffset+fixtureGlb.byteLength),'');
const car=()=>actual.scene.clone(true);
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
  const group=car();
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
  assert.equal(ride.sim.gear,'R');assert(ride.sim.pose.speed<0);ride.dispose();
});

test('cabin view follows suspension and keeps both faces framed in either iPad orientation',()=>{
  const group=car();
  const terrain={map:{spawn:{x:0,z:0,heading:0},roads:[{points:[[0,-20],[0,20]]}]},
    height:()=>0,land:()=>true,obstructed:()=>false,bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null} as unknown as ParkTerrain;
  const ride=new CadillacRide(group,terrain);ride.start();
  const body=group.getObjectByName('SprungBody')!;
  const driver=new T.Object3D(),dog=new T.Object3D();
  // Independently measured heads of the posed suited hero and rear passenger.
  driver.position.set(.4297691775,1.2015169098,.2303756170);dog.position.set(-.4252,1.1278,-.6);body.add(driver,dog);
  group.position.set(400,2,-300);group.rotation.y=1.4;body.position.y=.09;body.rotation.set(.10,0,-.08);
  for(const [width,height]of [[1194,834],[834,1194]]){
    const camera=new T.PerspectiveCamera(60,width/height,.04,2000);
    ride.camera(camera,true,0,.1,1/60,true);camera.updateMatrixWorld(true);
    const anchor=group.getObjectByName('Cadillac_InteriorCamera')!;
    assert(camera.position.distanceTo(anchor.getWorldPosition(new T.Vector3()))<1e-8);
    for(const head of [driver,dog]){
      const screen=head.getWorldPosition(new T.Vector3()).project(camera);
      assert(Math.abs(screen.x)<.9&&Math.abs(screen.y)<.9&&screen.z>-1&&screen.z<1,
        `${width}×${height}: occupant outside the camera frame: ${screen.toArray()}`);
    }
    const before=camera.getWorldDirection(new T.Vector3());
    ride.camera(camera,true,.2,.1,1/60,true);
    assert(before.angleTo(camera.getWorldDirection(new T.Vector3()))>.15,'look input remains responsive');
    ride.camera(camera,false,0,.1,1/60,true);
    assert.equal(camera.fov,54);assert.deepEqual(camera.up.toArray(),[0,1,0]);
  }
  ride.dispose();
});

function flatTerrain(){return{map:{spawn:{x:0,z:0,heading:0},roads:[{points:[[0,-20],[0,20]]}]},height:()=>0,land:()=>true,obstructed:()=>false,
 bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null} as unknown as ParkTerrain;}
const pedals={gas:1,brake:0,steer:0,handbrake:false};
const idle={gas:0,brake:0,steer:0,handbrake:false};
test('trunk and rear doors accept independent parked commands and hold the brakes until fully closed',()=>{
 const ride=new CadillacRide(car(),flatTerrain());
 try{
  assert.deepEqual(ride.toggleTrunk(),{accepted:false,opening:false,reason:'unavailable'});ride.start();
  ride.sim.pose.speed=1;assert.equal(ride.toggleTrunk().reason,'moving');assert.equal(ride.toggleRearDoor('left').reason,'moving');
  ride.sim.pose.speed=.1;ride.sim.cruise=10;
  assert.deepEqual(ride.toggleTrunk(),{accepted:true,opening:true});assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.cruise,0);
  assert.deepEqual(ride.toggleRearDoor('left'),{accepted:true,opening:true});
  ride.update(.1,pedals,0,false);
  assert(ride.accessSnapshot().trunk.progress>0);assert(ride.accessSnapshot().rearLeft.progress>0);assert.equal(ride.accessSnapshot().rearRight.progress,0);
  const position=[ride.sim.pose.x,ride.sim.pose.z];
  for(let i=0;i<90;i++)ride.update(1/60,pedals,0,false);
  assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.gear,'D');assert(ride.sim.braking);assert.deepEqual([ride.sim.pose.x,ride.sim.pose.z],position);
  assert.deepEqual(ride.toggleTrunk(),{accepted:true,opening:false});
  ride.update(.1,pedals,0,false);assert(ride.accessSnapshot().trunk.progress>0,'closing retains a physical panel');
  for(let i=0;i<90;i++)ride.update(1/60,pedals,0,false);
  assert.equal(ride.accessSnapshot().trunk.progress,0);assert(ride.accessSnapshot().rearLeft.open);assert.equal(ride.sim.pose.speed,0);
  assert.deepEqual(ride.toggleRearDoor('left'),{accepted:true,opening:false});
  ride.update(0,pedals,0,true);assert.equal(ride.accessSnapshot().held,false);assert.equal(ride.sim.pose.speed,0);
  for(let i=0;i<20;i++)ride.update(1/60,pedals,0,false);
  assert(ride.sim.pose.speed>1,'driving resumes only after all panels are closed');
 }finally{ride.dispose();}
});

test('reduced motion, exit, leave and restart preserve functional access state',()=>{
 const ride=new CadillacRide(car(),flatTerrain());
 try{
  ride.start();ride.toggleTrunk();ride.toggleRearDoor('right');ride.toggleDoor();ride.update(0,idle,0,true);
  let state=ride.accessSnapshot();assert.equal(state.trunk.angle,1.25);assert.equal(state.rearRight.angle,1.03);assert.equal(state.rearLeft.angle,0);assert.equal(ride.diagnostics().driverDoorRad,-1.03);
  assert(ride.setTrunkView(true));ride.requestExit();assert(!ride.trunkView);assert(ride.exiting);assert(!ride.exitReady);
  assert.equal(ride.toggleTrunk().reason,'exiting');assert(!ride.setTrunkView(true));
  ride.update(0,pedals,0,true);assert(ride.exitReady);assert(!ride.accessSnapshot().held);assert.equal(ride.sim.pose.speed,0);
  ride.leave();assert(!ride.model.visible);assert.equal(ride.diagnostics().driverDoorRad,0);assert.equal(ride.accessSnapshot().trunk.progress,0);
  ride.start();assert(!ride.trunkView&&!ride.exiting&&!ride.accessSnapshot().held);assert.equal(ride.diagnostics().driverDoorRad,0);
  ride.toggleTrunk();ride.update(.1,idle,0,false);ride.leave();ride.start();state=ride.accessSnapshot();
  assert(!state.trunk.open&&state.trunk.progress===0&&!state.held,'restart does not retain a partly open lid or trigger an opening');
 }finally{ride.dispose();}
});

test('parked trunk camera frames the actual lid and subwoofers and retains look and obstacle clipping',()=>{
 const terrain=flatTerrain(),ride=new CadillacRide(car(),terrain);
 try{
  ride.start();ride.toggleTrunk();ride.update(0,idle,0,true);assert(ride.setTrunkView(true));
  for(const aspect of [1194/834,834/1194]){
   const camera=new T.PerspectiveCamera(60,aspect,.04,2000);ride.camera(camera,true,0,.1,1/60,true);camera.updateMatrixWorld(true);
   const points=[new T.Vector3(-.39,.802,-1.98),new T.Vector3(.39,.802,-1.98),new T.Vector3(0,.802,-2.30)];
   const body=ride.model.getObjectByName('SprungBody')!;for(const point of points)point.applyMatrix4(body.matrixWorld);
   const sign=ride.trunk.lidPanel;sign.updateWorldMatrix(true,false);
   for(const point of [new T.Vector3(-.60,-.36,0),new T.Vector3(.60,.36,0)])points.push(sign.localToWorld(point));
   for(const point of points){const ndc=point.clone().project(camera);assert(Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95&&ndc.z>-1&&ndc.z<1,`${aspect}: trunk feature outside frame: ${ndc.toArray()}`);}
   const before=camera.position.clone();ride.camera(camera,false,.3,.1,1/60,true);assert(camera.position.distanceTo(before)>.5,'look input orbits installation');
   terrain.raycastObstacle=()=>1;ride.camera(camera,false,0,.1,1/60,true);
   const aim=body.localToWorld(new T.Vector3(0,1.25,-2.12));assert(camera.position.distanceTo(aim)<1,'nearby obstacle clips the inspection camera');terrain.raycastObstacle=()=>null;
  }
  assert(ride.setTrunkView(false));assert(!ride.trunkView);ride.setTrunkView(true);ride.toggleTrunk();ride.update(0,idle,0,true);
  for(let i=0;i<30;i++)ride.update(1/60,pedals,0,false);assert(!ride.trunkView,'driving restores normal camera');
  assert(!ride.setTrunkView(true),'inspection cannot be selected at speed');
 }finally{ride.dispose();}
});
