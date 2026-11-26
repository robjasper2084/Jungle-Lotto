import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {CadillacRide,cadillacModel} from './cadillacRide.ts';
import {CADILLAC_CORNERS,CADILLAC_SUSPENSION_LIMITS} from './cadillacSuspension.ts';
import {HYDRAULIC_SMART_POSES} from './hydraulicController.ts';
import {HydraulicFrameClock} from './hydraulicFrameClock.ts';
import {fitCadillacWireWheels} from './cadillacWireWheels.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {ParkTerrain} from './terrain.ts';

const glb=readFileSync('public/belle/vehicles/silver-cadillac.glb');
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
async function loadFixture(glb:Buffer){
const asset=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
// Exercise the actual shipped hierarchy and index buffers. Texture references
// alone are removed in memory because Node has no browser image decoder.
const fixtureData=structuredClone(asset);fixtureData.materials=(fixtureData.materials??[]).map((material:{name:string})=>({name:material.name}));
const json=Buffer.from(JSON.stringify(fixtureData)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const binary=glb.subarray(20+glb.readUInt32LE(12)),fixtureGlb=Buffer.alloc(20+padded.length+binary.length);
fixtureGlb.write('glTF');fixtureGlb.writeUInt32LE(2,4);fixtureGlb.writeUInt32LE(fixtureGlb.length,8);fixtureGlb.writeUInt32LE(padded.length,12);fixtureGlb.writeUInt32LE(0x4e4f534a,16);padded.copy(fixtureGlb,20);binary.copy(fixtureGlb,20+padded.length);
return await new GLTFLoader().parseAsync(fixtureGlb.buffer.slice(fixtureGlb.byteOffset,fixtureGlb.byteOffset+fixtureGlb.byteLength),'');
}
const actual=await loadFixture(glb);
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
  ride.toggleDoor();advance(45,0,0,0);
  assert(ride.diagnostics().driverDoorRad<-.9&&ride.sim.pose.speed===0);
  advance(100,0,1,0);
  assert.equal(ride.sim.gear,'R');assert(ride.sim.pose.speed<0);
  assert(ride.diagnostics().driverDoorRad<-.9);ride.dispose();
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
test('the Cadillac moves with both rear doors and the trunk open and operates the panels while stopped',()=>{
 const ride=new CadillacRide(car(),flatTerrain());
 try{
  assert.deepEqual(ride.toggleTrunk(),{accepted:false,opening:false,reason:'unavailable'});ride.start();
  ride.sim.pose.speed=1;assert.equal(ride.toggleTrunk().reason,'moving');assert.equal(ride.toggleRearDoor('left').reason,'moving');
  ride.sim.pose.speed=.1;ride.sim.cruise=10;
  assert.deepEqual(ride.toggleTrunk(),{accepted:true,opening:true});assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.cruise,0);
  assert.deepEqual(ride.toggleRearDoor('left'),{accepted:true,opening:true});
  assert.deepEqual(ride.toggleRearDoor('right'),{accepted:true,opening:true});
  ride.update(.1,idle,0,false);
  assert(ride.accessSnapshot()!.trunk.progress>0);assert(ride.accessSnapshot()!.rearLeft.progress>0);assert(ride.accessSnapshot()!.rearRight.progress>0);
  const position=[ride.sim.pose.x,ride.sim.pose.z];
  for(let i=0;i<90;i++)ride.update(1/60,pedals,0,false);
  assert(ride.sim.pose.speed>2);assert.equal(ride.sim.gear,'D');assert.notDeepEqual([ride.sim.pose.x,ride.sim.pose.z],position);
  assert(ride.accessSnapshot()!.trunk.open&&ride.accessSnapshot()!.rearLeft.open&&ride.accessSnapshot()!.rearRight.open);
  assert.equal(ride.toggleTrunk().reason,'moving');
  ride.sim.pose.speed=0;
  assert.deepEqual(ride.toggleTrunk(),{accepted:true,opening:false});
  ride.update(.1,pedals,0,false);assert(ride.accessSnapshot()!.trunk.progress>0,'closing retains a physical panel');
  for(let i=0;i<90;i++)ride.update(1/60,pedals,0,false);
  assert.equal(ride.accessSnapshot()!.trunk.progress,0);assert(ride.accessSnapshot()!.rearLeft.open);assert(ride.accessSnapshot()!.rearRight.open);
  assert(ride.sim.pose.speed>2,'driving continues through a closing animation');
 }finally{ride.dispose();}
});

test('reduced motion, exit, leave and restart preserve functional access state',()=>{
 const ride=new CadillacRide(car(),flatTerrain());
 try{
  ride.start();ride.toggleTrunk();ride.toggleRearDoor('right');ride.toggleDoor();ride.update(0,idle,0,true);
  let state=ride.accessSnapshot()!;assert.equal(state.trunk.angle,1.25);assert.equal(state.rearRight.angle,1.03);assert.equal(state.rearLeft.angle,0);assert.equal(ride.diagnostics().driverDoorRad,-1.03);
  assert(ride.setTrunkView(true));ride.requestExit();assert(!ride.trunkView);assert(ride.exiting);assert(!ride.exitReady);
  assert.equal(ride.toggleTrunk().reason,'exiting');assert(!ride.setTrunkView(true));
  ride.update(.1,pedals,0,true);assert(ride.exitReady);assert(!ride.accessSnapshot()!.held);assert.equal(ride.sim.pose.speed,0);
  ride.leave();assert(!ride.model.visible);assert.equal(ride.diagnostics().driverDoorRad,0);assert.equal(ride.accessSnapshot()!.trunk.progress,0);
  ride.start();assert(!ride.trunkView&&!ride.exiting&&!ride.accessSnapshot()!.held);assert.equal(ride.diagnostics().driverDoorRad,0);
  ride.toggleTrunk();ride.update(.1,idle,0,false);ride.leave();ride.start();state=ride.accessSnapshot()!;
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
   const sign=ride.trunk!.lidPanel;sign.updateWorldMatrix(true,false);
   for(const point of [new T.Vector3(-.60,-.36,0),new T.Vector3(.60,.36,0)])points.push(sign.localToWorld(point));
   for(const point of points){const ndc=point.clone().project(camera);assert(Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95&&ndc.z>-1&&ndc.z<1,`${aspect}: trunk feature outside frame: ${ndc.toArray()}`);}
   const before=camera.position.clone();ride.camera(camera,false,.3,.1,1/60,true);assert(camera.position.distanceTo(before)>.5,'look input orbits installation');
   terrain.raycastObstacle=()=>1;ride.camera(camera,false,0,.1,1/60,true);
   const aim=body.localToWorld(new T.Vector3(0,1.25,-2.12));assert(camera.position.distanceTo(aim)<1,'nearby obstacle clips the inspection camera');terrain.raycastObstacle=()=>null;
  }
  assert(ride.setTrunkView(false));assert(!ride.trunkView);ride.setTrunkView(true);
  for(let i=0;i<30;i++)ride.update(1/60,pedals,0,false);assert(!ride.trunkView,'driving restores normal camera');
  assert(!ride.setTrunkView(true),'inspection cannot be selected at speed');
  assert(ride.accessSnapshot()!.trunk.open);
 }finally{ride.dispose();}
});

test('hydraulic Cadillac fits shared wire rims to the original tires and completes a front hop',async t=>{
  const asset=await loadFixture(readFileSync('public/belle/vehicles/hydraulics-cadillac.glb'));
  const tireMeshes=['FL','FR','RL','RR'].map(corner=>{
    const wheel=asset.scene.getObjectByName('WheelGeometry_'+corner)!;
    return wheel.children.find(part=>(part as T.Mesh<T.BufferGeometry,T.Material>).material?.name==='Cadillac_Rubber')!;
  });
  t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>asset);
  const model=await cadillacModel('hydraulic-cadillac');
  const rims=['FL','FR','RL','RR'].map((corner,index)=>{
    const rim=model.getObjectByName('Cadillac_Wire_Rim_'+corner) as T.Mesh;
    assert.equal(rim.parent,tireMeshes[index].parent);
    assert.equal(rim.parent!.children.length,2,'the original tire and a single rim draw remain');
    assert.equal(rim.rotation.y,corner.endsWith('R')?Math.PI:0);
    return rim;
  });
  assert.equal(new Set(rims.map(rim=>rim.geometry)).size,1);
  assert.equal(new Set(rims.map(rim=>rim.material)).size,1);
  assert(rims[0].geometry.index!.count/3<=2250,'the wire rim retains the vehicle geometry budget');
  const terrain={map:{spawn:{x:0,z:0,heading:0},roads:[]},height:()=>0,land:()=>true,
    obstructed:()=>false,bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null} as unknown as ParkTerrain;
  const ride=new CadillacRide(model,terrain,undefined,'hydraulic-cadillac');
  ride.start();
  const hydraulics=ride.hydraulics!;
  const advance=(frames:number,keys:ReadonlySet<string>=new Set())=>{
    for(let i=0;i<frames;i++)ride.update(1/60,{gas:0,brake:0,steer:0,handbrake:false},0,false,keys);
  };
  const body=asset.scene.getObjectByName('ChassisGeometry')!;
  advance(60,new Set(['PageUp','KeyU']));
  assert(body.position.y>0&&body.rotation.z>0);
  assert.equal(ride.accessSnapshot(),undefined);
  ride.setSuspensionStance('cruise');advance(60);
  assert(Math.abs(body.position.y)<.001);
  assert.equal(ride.hopSuspension('front',true).accepted,false);
  ride.sim.pose.speed=3;assert.equal(ride.hopSuspension('front',false).accepted,false);ride.sim.pose.speed=0;
  assert.equal(ride.hopSuspension('front',false).accepted,true);
  advance(30);
  assert(hydraulics.hubs[0].hub.position.y>hydraulics.hubs[2].hub.position.y+.1);
  advance(70);
  assert(Math.abs(hydraulics.hubs[0].hub.position.y-hydraulics.hubs[2].hub.position.y)<.001);
  ride.leave();ride.start();
  assert(Math.abs(body.position.y)<.001);
  assert.equal(ride.diagnostics().vehicle,'hydraulic-cadillac');
  ride.dispose();
});

test('parked customization previews without advancing travel, panel motion, or wheel phase',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  ride.toggleTrunk();ride.toggleRearDoor('left');ride.update(.08,idle,0,false);
  const before=ride.diagnostics(),panel=ride.accessSnapshot()!;
  assert(ride.setSuspensionCorner('FL',.18).accepted);
  const after=ride.diagnostics();
  assert.equal(after.distanceM,before.distanceM);assert.equal(ride.sim.pose.distance,0);assert.equal(after.speedMps,0);
  assert.deepEqual(after.wheelPhaseRad,before.wheelPhaseRad);assert.deepEqual(ride.accessSnapshot(),panel);
  assert(after.suspensionRollRad>0);assert(after.suspensionPitchRad<0);assert(!ride.suspension.readyForDrive);
  assert(ride.setWheels({rim:'wire-gold',tire:'low-profile-whitewall',center:'black'}).accepted);
  assert.equal(ride.wheels.radius,.346);assert.equal(ride.diagnostics().wheels.spokesPerWheel,100);
  assert.deepEqual(ride.accessSnapshot(),panel);assert.deepEqual(ride.diagnostics().wheelPhaseRad,before.wheelPhaseRad);
  assert(ride.setSuspensionStance('raised').accepted);assert(ride.suspension.readyForDrive);
 }finally{ride.dispose();}
});

test('separate hydraulic elapsed leaves driving, wheel travel, and panel timing unchanged',()=>{
 for(const elapsed of [1/60,.1,13]){
  const baseline=new CadillacRide(car(),flatTerrain()),separate=new CadillacRide(car(),flatTerrain());
  try{
   for(const ride of [baseline,separate]){ride.start();ride.toggleTrunk();ride.toggleRearDoor('left');ride.toggleDoor();}
   const dt=Math.min(elapsed,.05);
   for(let frame=0;frame<12;frame++){
    baseline.update(dt,pedals,0,false);
    separate.update(dt,pedals,0,false,undefined,false,elapsed);
    assert.deepEqual(separate.sim.pose,baseline.sim.pose,'hydraulic elapsed must not reach the car controller');
    assert.deepEqual(separate.diagnostics(),baseline.diagnostics(),'wheel spin, travel, panels and ground presentation retain simulation dt');
   }
   assert(separate.sim.pose.speed>0);assert(separate.accessSnapshot()!.trunk.progress>0);
  }finally{baseline.dispose();separate.dispose();}
 }
});

test('parked lifts and hops use the same eligible time at 60 Hz and 10 Hz',()=>{
 const states=[];
 for(const fps of [60,10]){
  const ride=new CadillacRide(car(),flatTerrain());ride.start();
  try{
   const elapsed=1/fps,dt=Math.min(elapsed,.05);
   assert(ride.setHydraulicPose('front-up').accepted);
   for(let frame=0;frame<fps*.6;frame++)ride.update(dt,pedals,0,false,undefined,true,elapsed);
   const lift=ride.suspension.snapshot();assert(!lift.settled&&lift.current.FL>0);
   assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.distance,0);
   ride.start();assert(ride.hopSuspension('all',false).accepted);
   for(let frame=0;frame<fps*.6;frame++)ride.update(dt,{...pedals,steer:1},0,false,undefined,true,elapsed);
   const hop=ride.suspension.snapshot();assert(Math.abs(hop.hopProgress-2/3)<1e-10);
   assert(hop.pose.wheelLifts.FL>0);assert.equal(ride.sim.pose.steering,0);assert.equal(ride.sim.pose.distance,0);
   for(let frame=0;frame<fps*.3;frame++)ride.update(dt,idle,0,false,undefined,true,elapsed);
   assert.equal(ride.suspension.snapshot().hop,null);assert(ride.suspension.readyForDrive);
   assert(ride.suspension.snapshot().cooldown>0,'landing retains the existing hop cooldown');
   assert(!ride.hopSuspension('all',false).accepted);
   states.push({lift,hop});
  }finally{ride.dispose();}
 }
 for(const corner of CADILLAC_CORNERS){
  assert(Math.abs(states[0].lift.current[corner]-states[1].lift.current[corner])<1e-10);
  assert(Math.abs(states[0].hop.pose.wheelLifts[corner]-states[1].hop.pose.wheelLifts[corner])<1e-10);
 }
 for(const key of ['heave','pitch','roll'] as const)assert(Math.abs(states[0].lift.pose[key]-states[1].lift.pose[key])<1e-10);
});

test('large eligible intervals present lift midpoints and hop peaks while other animations retain simulation timing',()=>{
 const ride=new CadillacRide(car(),flatTerrain()),baseline=new CadillacRide(car(),flatTerrain());
 try{
  for(const current of [ride,baseline]){
   current.start();current.toggleTrunk();current.toggleDoor();assert(current.setHydraulicPose('front-up').accepted);
  }
  let previous=ride.suspension.snapshot().current;
  ride.update(.05,pedals,0,false,undefined,true,13);baseline.update(.05,pedals,0,false,undefined,true);
  assert(!ride.suspension.settled,'one delayed frame cannot finish the full lift');
  for(const corner of CADILLAC_CORNERS)assert(Math.abs(ride.suspension.snapshot().current[corner]-HYDRAULIC_SMART_POSES['front-up'][corner]/2)<1e-10);
  assert.deepEqual(ride.accessSnapshot(),baseline.accessSnapshot());
  assert.equal(ride.diagnostics().driverDoorRad,baseline.diagnostics().driverDoorRad);
  const switchMotion=(current:CadillacRide)=>current.hydraulicSwitches.diagnostics().switches.map(({pose,angle,moving})=>({pose,angle,moving}));
  assert.deepEqual(switchMotion(ride),switchMotion(baseline),'the physical flick retains simulation dt while its cabin follows the body');
  previous=ride.suspension.snapshot().current;assert(ride.setHydraulicPose('back-up').accepted);
  assert.deepEqual(ride.suspension.snapshot().current,previous,'retargeting starts at the displayed corner heights');
  ride.update(.05,pedals,0,false,undefined,true,9);
  for(const corner of CADILLAC_CORNERS)assert(Math.abs(ride.suspension.snapshot().current[corner]-(previous[corner]+HYDRAULIC_SMART_POSES['back-up'][corner])/2)<1e-10);
  assert(!ride.suspension.settled);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.distance,0);
  ride.start();assert(ride.hopSuspension('all',false).accepted);
  const before=ride.suspension.snapshot();
  for(const elapsed of [NaN,Infinity,-1,0])ride.update(.05,idle,0,false,undefined,true,elapsed);
  assert.deepEqual(ride.suspension.snapshot(),before,'invalid hydraulic intervals cannot advance motion');
  ride.update(.05,idle,0,false,undefined,true,13);
  assert.equal(ride.suspension.snapshot().hopProgress,.5);
  assert.equal(ride.suspension.snapshot().hop,'all');assert(!ride.suspension.readyForDrive);
 }finally{ride.dispose();baseline.dispose();}
});

test('Settings hydraulic elapsed preserves frozen physics and panels and cannot advance an active hop',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  ride.toggleTrunk();ride.toggleRearDoor('left');ride.toggleDoor();ride.update(.05,idle,0,false);
  const before=ride.diagnostics(),physics={...ride.sim.pose},panels=ride.accessSnapshot();
  assert(ride.setHydraulicPose('front-up').accepted);
  for(const elapsed of [.1,13]){
   const current=ride.suspension.snapshot().current;
   ride.updateHydraulicPreview(.05,false,elapsed);
   const after=ride.diagnostics();
   assert.deepEqual(ride.sim.pose,physics);assert.deepEqual(ride.accessSnapshot(),panels);
   assert.equal(after.distanceM,before.distanceM);assert.deepEqual(after.wheelPhaseRad,before.wheelPhaseRad);
   assert.equal(after.driverDoorRad,before.driverDoorRad);assert.deepEqual(after.trunkInstallation,before.trunkInstallation);
   assert(!ride.suspension.settled);
   for(const corner of CADILLAC_CORNERS){
    if(elapsed<=CADILLAC_SUSPENSION_LIMITS.maxFrameSeconds)assert(Math.abs(ride.suspension.snapshot().current[corner]-current[corner])<=CADILLAC_SUSPENSION_LIMITS.actuatorMetresPerSecond*elapsed+1e-10);
    else assert(Math.abs(ride.suspension.snapshot().current[corner]-HYDRAULIC_SMART_POSES['front-up'][corner]/2)<1e-10);
   }
  }
  assert(ride.setHydraulicPose('pancake',true).accepted);assert(ride.hopSuspension('all',false).accepted);
  ride.update(.05,idle,0,false);const airborne=ride.diagnostics();assert(airborne.suspension.hop);
  ride.updateHydraulicPreview(.05,false,13);assert.deepEqual(ride.diagnostics(),airborne,'Settings must not consume any active hop time');
  ride.updateHydraulicPreview(0,true,13);assert.equal(ride.suspension.snapshot().hop,null);
  assert(ride.suspension.readyForDrive);assert.equal(ride.suspension.pose.heave,0,'reduced motion still lands immediately');
 }finally{ride.dispose();}
});

test('hydraulic command epochs cover changed motion and resets without reanchoring rejected or identical commands',()=>{
 let now=0;const terrain=flatTerrain(),ride=new CadillacRide(car(),terrain,undefined,'cadillac',undefined,()=>now);ride.start();
 try{
  const initial=ride.hydraulicCommandRevision;now=100;assert(ride.setHydraulicPose('front-up').accepted);
  assert.equal(ride.hydraulicCommandRevision,initial+1);assert.equal(ride.hydraulicCommandTime,100);
  ride.update(.05,idle,0,false,undefined,true,13);const revision=ride.hydraulicCommandRevision;
  now=200;assert(ride.setHydraulicPose('front-up').accepted);assert.equal(ride.hydraulicCommandRevision,revision);
  terrain.obstructed=()=>true;now=300;assert(!ride.setHydraulicPose('back-up').accepted);
  assert.equal(ride.hydraulicCommandRevision,revision);assert.equal(ride.hydraulicCommandTime,100);
  terrain.obstructed=()=>false;ride.update(1/60,idle,0,false,undefined,true,1/60);
  assert(ride.suspension.settled,'rejected and identical commands retain the original accepted motion credit');
  now=400;assert(ride.setHydraulicPose('pancake').accepted);ride.update(.05,idle,0,false,undefined,true,13);
  const displayed=ride.suspension.snapshot().current;now=500;assert(ride.setHydraulicPose('back-up').accepted);
  assert.equal(ride.hydraulicCommandTime,500);assert.deepEqual(ride.suspension.snapshot().current,displayed);
  ride.update(1/60,idle,0,false,undefined,true,1/60);
  for(const corner of CADILLAC_CORNERS)assert(Math.abs(ride.suspension.snapshot().current[corner]-displayed[corner])<=CADILLAC_SUSPENSION_LIMITS.actuatorMetresPerSecond/60+1e-10);
  now=600;ride.start();assert.equal(ride.hydraulicCommandTime,600);
  assert(ride.setSuspensionCorner('FL',.16).accepted);now=610;assert(ride.hopSuspension('all',false).accepted);
  now=620;assert(ride.settleSuspension().accepted);const queued=ride.hydraulicCommandRevision;
  now=630;assert(ride.settleSuspension().accepted);assert.equal(ride.hydraulicCommandRevision,queued);
  ride.update(.05,idle,0,false,undefined,true,13);ride.update(.05,idle,0,false,undefined,true,13);
  assert.equal(ride.hydraulicCommandRevision,queued,'internal landing and queued leveling do not invent new command epochs');
  now=700;ride.leave();assert.equal(ride.hydraulicCommandTime,700);assert.equal(ride.hydraulicCommandRevision,queued+1);
 }finally{ride.dispose();}
});

test('new held and automatic commands cannot consume a rendering gap before they were accepted',()=>{
 let now=0;const ride=new CadillacRide(car(),flatTerrain(),undefined,'cadillac',undefined,()=>now);ride.start();
 try{
  now=13000;const before=ride.suspension.snapshot().current;
  ride.update(.05,idle,0,false,new Set(['PageUp']),true,13);
  assert.deepEqual(ride.suspension.snapshot().current,before,'the first held command cannot use the preceding thirteen seconds');
  assert(ride.suspension.targets.FL>0);assert.equal(ride.hydraulicCommandTime,13000);
  now=26000;ride.update(.05,idle,0,false,new Set(['PageUp']),true,13);
  assert(ride.suspension.snapshot().current.FL>0,'continuous retargeting still advances the previously accepted motion');
  ride.start();assert(ride.setSuspensionCorner('FL',.20).accepted);const unlevel=ride.suspension.snapshot().current;
  now=39000;ride.update(.05,{...pedals,steer:1},0,false,undefined,false,13);
  assert.deepEqual(ride.suspension.snapshot().current,unlevel,'a new automatic level starts from the current pose');
  assert.equal(ride.hydraulicCommandTime,39000);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.steering,0);
  ride.update(.05,{...pedals,steer:1},0,false,undefined,false,13);
  assert(!ride.suspension.readyForDrive);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.distance,0);assert.equal(ride.sim.pose.steering,0);
  ride.update(.05,{...pedals,steer:1},0,false,undefined,false,13);
  assert(ride.suspension.readyForDrive);assert(ride.sim.pose.speed>0,'driving resumes only after the accepted level endpoint');
 }finally{ride.dispose();}
});

test('leveling an already level hop preserves its accepted motion epoch and eligible credit',()=>{
 let now=0;const ride=new CadillacRide(car(),flatTerrain(),undefined,'cadillac',undefined,()=>now);ride.start();
 try{
  assert(ride.setSuspensionStance('raised').accepted);now=100;assert(ride.hopSuspension('all',false).accepted);
  ride.update(.05,idle,0,false,undefined,true,13);
  const revision=ride.hydraulicCommandRevision,accepted=ride.hydraulicCommandTime,apex=ride.suspension.snapshot();
  now=13100;assert(ride.settleSuspension().accepted);assert(ride.suspension.levelingQueued);
  assert.equal(ride.hydraulicCommandRevision,revision);assert.equal(ride.hydraulicCommandTime,accepted);
  assert.deepEqual(ride.suspension.snapshot(),apex,'the already level landing path remains unchanged');
  ride.update(1/60,idle,0,false,undefined,true,1/60);
  assert(ride.suspension.readyForDrive);assert.equal(ride.suspension.snapshot().hop,null);
  assert.equal(ride.suspension.snapshot().cooldown,CADILLAC_SUSPENSION_LIMITS.hopCooldownSeconds);
 }finally{ride.dispose();}
});

test('the landed idle cooldown expires on fresh eligible time in both ride and Settings preview paths',()=>{
 for(const mode of ['active','preview'] as const){
  let now=0;const ride=new CadillacRide(car(),flatTerrain(),undefined,'cadillac',undefined,()=>now),clock=new HydraulicFrameClock();ride.start();
  try{
   assert(ride.setSuspensionStance('raised').accepted);assert(ride.hopSuspension('all',false).accepted);
   assert.equal(clock.sample(now,ride,'active'),0);
   for(let frame=0;frame<8;frame++){
    now+=120;ride.update(.05,idle,0,false,undefined,true,clock.sample(now,ride,'active'));
   }
   const landed=ride.suspension.snapshot(),physics={...ride.sim.pose},panels=ride.accessSnapshot();
   assert.equal(landed.hop,null);assert(landed.settled&&landed.readyForDrive);
   assert(Math.abs(landed.cooldown-.39)<1e-12,'reproduce the native report\'s idle post-landing cooldown');
   const advance=(seconds:number)=>mode==='active'?ride.update(.05,idle,0,false,undefined,true,seconds):ride.updateHydraulicPreview(.05,false,seconds);
   clock.reset();now+=89000;advance(clock.sample(now,ride,mode));
   assert.equal(ride.suspension.snapshot().cooldown,landed.cooldown,'excluded time and the first resumed sample do not age cooldown');
   now+=13000;advance(clock.sample(now,ride,mode));
   assert.equal(ride.suspension.snapshot().cooldown,0,'idle pose must not prevent fresh eligible elapsed time from completing cooldown');
   assert.deepEqual(ride.suspension.snapshot().current,landed.current);assert.deepEqual(ride.suspension.pose,landed.pose);
   assert.deepEqual(ride.sim.pose,physics);assert.deepEqual(ride.accessSnapshot(),panels);
   assert(ride.hopSuspension('all',false).accepted,'the actual next-hop gate reopens after cooldown');
  }finally{ride.dispose();}
 }
});

test('both shipped Cadillac models present safe hop and leveling landmarks under severe rendering stalls',async()=>{
 for(const variant of ['cadillac','hydraulic-cadillac'] as const){
  const model=variant==='cadillac'?car():(await loadFixture(readFileSync('public/belle/vehicles/hydraulics-cadillac.glb'))).scene;
  if(variant==='hydraulic-cadillac')fitCadillacWireWheels(model);
  const ride=new CadillacRide(model,flatTerrain(),undefined,variant);ride.start();
  try{
   const body=model.getObjectByName(variant==='cadillac'?'SprungBody':'ChassisGeometry')!;
   for(const mode of ['all','front','rear'] as const){
    ride.start();assert(ride.setSuspensionStance('raised').accepted);
    const path=ride.suspension.previewHop(mode,2),base={height:body.position.y-ride.suspension.pose.heave,pitch:body.rotation.x-ride.suspension.pose.pitch,roll:body.rotation.z-ride.suspension.pose.roll};
    assert(ride.hopSuspension(mode,false).accepted,variant+' '+mode+' must pass the actual fender and body sweep');
    ride.update(.05,{...pedals,steer:1},0,false,undefined,true,13);
    assert.equal(ride.suspension.snapshot().hopProgress,.5);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.steering,0);
    assert(Math.abs(body.position.y-base.height-path[1].heave)<1e-10);
    assert(Math.abs(body.rotation.x-base.pitch-path[1].pitch)<1e-10);assert(Math.abs(body.rotation.z-base.roll-path[1].roll)<1e-10);
    ride.update(.05,{...pedals,steer:1},0,false,undefined,true,9);
    assert(ride.suspension.readyForDrive);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.distance,0);
    assert(Object.values(ride.suspension.pose.wheelLifts).every(height=>height===0));
    assert(Math.abs(body.position.y-base.height-path[2].heave)<1e-10);
   }
   ride.start();assert(ride.setHydraulicPose('front-up',true).accepted);
   const initial=ride.suspension.snapshot().current,level=Object.values(initial).reduce((sum,height)=>sum+height/4,0);
   assert(ride.hopSuspension('all',false).accepted);assert(ride.settleSuspension().accepted);
   const revision=ride.hydraulicCommandRevision;
   for(let frame=0;frame<4;frame++){
    ride.update(.05,{...pedals,steer:1},0,false,undefined,false,13);
    assert.equal(ride.hydraulicCommandRevision,revision);
    if(frame<3){assert(!ride.suspension.readyForDrive);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.distance,0);assert.equal(ride.sim.pose.steering,0);}
    if(frame===0)assert.equal(ride.suspension.snapshot().hopProgress,.5);
    if(frame===1){assert.equal(ride.suspension.snapshot().hop,null);assert.deepEqual(ride.suspension.snapshot().current,initial);}
    if(frame===2)for(const corner of CADILLAC_CORNERS)assert(Math.abs(ride.suspension.snapshot().current[corner]-(initial[corner]+level)/2)<1e-10);
   }
   assert(ride.suspension.readyForDrive);assert(ride.sim.pose.speed>0);
  }finally{ride.dispose();}
 }
});

test('suspension and access animations run together on separate transforms and fully land',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  ride.toggleTrunk();ride.toggleRearDoor('left');ride.toggleRearDoor('right');ride.toggleDoor();
  const lid=ride.access!.trunkLid,body=ride.model.getObjectByName('SprungBody')!,lidPosition=lid.position.clone();
  assert(ride.hopSuspension('all',false).accepted);
  for(let i=0;i<25;i++)ride.update(1/60,idle,0,false);
  assert(body.position.y>.18);assert(ride.accessSnapshot()!.trunk.progress>.8);assert(ride.accessSnapshot()!.rearLeft.progress>.8);
  assert.equal(lid.parent,body);assert(lid.position.equals(lidPosition));
  assert(ride.trunkSpeakerAnchor!.parent!==ride.model,'speakers remain in the moving cabin');
  for(let i=0;i<65;i++)ride.update(1/60,idle,0,false);
  assert(ride.suspension.readyForDrive);assert.equal(ride.suspension.snapshot().hop,null);assert(Math.abs(body.position.y)<1e-8);
  for(const corner of ['FL','FR','RL','RR'])assert(Math.abs(ride.model.getObjectByName('Hub'+corner)!.position.y-.346)<1e-8);
  assert.equal(ride.accessSnapshot()!.trunk.progress,1);assert(ride.accessSnapshot()!.rearLeft.open&&ride.accessSnapshot()!.rearRight.open);
 }finally{ride.dispose();}
});

test('driving and reverse wait for an uneven setup to level, without closing doors or trunk',()=>{
 for(const reverse of [false,true]){
  const ride=new CadillacRide(car(),flatTerrain());ride.start();
  try{
   ride.toggleTrunk();ride.toggleRearDoor('right');ride.update(0,idle,0,true);
   assert(ride.setSuspensionCorner('FL',.20).accepted);
   const input=reverse?{gas:0,brake:1,steer:0,handbrake:false}:pedals;
   ride.update(1/120,input,0,false);assert.equal(ride.sim.pose.speed,0);assert.equal(ride.sim.pose.z,0);
   for(let i=0;i<180;i++){
    ride.update(1/120,input,0,false);
    if(!ride.suspension.readyForDrive)assert.equal(ride.sim.pose.speed,0,'an unlevel car must not drive');
   }
   assert(ride.suspension.readyForDrive);assert(reverse?ride.sim.pose.speed<0:ride.sim.pose.speed>0);
   assert.equal(ride.sim.gear,reverse?'R':'D');assert(ride.accessSnapshot()!.trunk.open&&ride.accessSnapshot()!.rearRight.open);
  }finally{ride.dispose();}
 }
});

test('reduced motion preserves static setup but suppresses hops, including keyboard requests',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  assert(ride.setSuspensionStance('raised').accepted);assert.equal(ride.suspension.pose.heave,.14);
  assert(!ride.hopSuspension('all',true).accepted);assert(ride.suspensionKey('KeyZ',true,false,true));
  ride.update(.1,idle,0,true);assert.equal(ride.suspension.pose.heave,.14);assert.equal(ride.suspension.snapshot().hop,null);
  assert(ride.suspensionKey('KeyY',true,false,true));assert.equal(ride.suspension.pose.heave,0);
  assert(ride.hopSuspension('rear',false).accepted);ride.update(.2,idle,0,false);assert(ride.suspension.snapshot().hop);
  ride.update(.1,idle,0,true);assert.equal(ride.suspension.snapshot().hop,null);assert(ride.suspension.readyForDrive);
 }finally{ride.dispose();}
});

test('invalid, moving, overhead-blocked, and ground-blocked changes retain the accepted setup',()=>{
 const terrain=flatTerrain(),ride=new CadillacRide(car(),terrain);ride.start();
 try{
  const initial=ride.suspension.snapshot();
  assert(!ride.setSuspensionCorner('FL',NaN).accepted);assert(!ride.setSuspensionCorner('FL',-.01).accepted);
  ride.sim.pose.speed=2;
  assert(!ride.setSuspensionStance('raised').accepted);assert(!ride.setWheels({rim:'wire-gold',tire:'whitewall',center:'white'}).accepted);
  ride.update(.1,idle,0,false,new Set(['PageUp','KeyU']));assert.deepEqual(ride.suspension.snapshot().targets,initial.targets);
  ride.sim.pose.speed=0;ride.start();
  const body=ride.model.getObjectByName('SprungBody')!,top=new T.Box3().setFromObject(body).max.y,ceiling=top+.06;
  terrain.raycastObstacle=(origin,direction,max)=>{
   if(direction.y<=0)return null;const distance=(ceiling-origin.y)/direction.y;return distance>=0&&distance<=max?distance:null;
  };
  assert(!ride.setSuspensionStance('raised').accepted);assert(!ride.hopSuspension('all',false).accepted);
  assert.deepEqual(ride.suspension.snapshot().targets,initial.targets);assert.equal(ride.suspension.snapshot().hop,null);
  terrain.raycastObstacle=()=>null;assert(ride.setSuspensionStance('raised').accepted);
  terrain.height=()=>.30;
  assert(!ride.setSuspensionStance('cruise').accepted);assert.equal(ride.suspension.targets.FL,.14);
 }finally{ride.dispose();}
});

test('hop finishing, exit, and recovery reset suspension without discarding wheel choice',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  assert(ride.setWheels({rim:'wire-chrome',tire:'whitewall',center:'white'}).accepted);
  assert(ride.setSuspensionCorner('FR',.16).accepted);assert(ride.hopSuspension('front',false).accepted);
  ride.update(.12,idle,0,false);const airborne=ride.suspension.pose.heave;
  assert(ride.settleSuspension().accepted);assert.equal(ride.suspension.pose.heave,airborne,'finishing must not snap an airborne car');
  for(let i=0;i<120;i++)ride.update(1/60,idle,0,false);
  assert(ride.suspension.readyForDrive);assert(Math.abs(ride.suspension.targets.FL-.04)<1e-8);
  ride.requestExit();for(let i=0;i<80;i++)ride.update(1/60,idle,0,false);assert(ride.exitReady);
  ride.leave();ride.start();assert.equal(ride.suspension.pose.heave,0);assert(ride.suspension.readyForDrive);
  assert.equal(ride.wheels.selection.rim,'wire-chrome');assert.equal(ride.wheels.selection.tire,'whitewall');
 }finally{ride.dispose();}
});

test('hops and uneven stances hold their validated steering angle until the car levels',()=>{
 const ride=new CadillacRide(car(),flatTerrain());ride.start();
 try{
  assert(ride.hopSuspension('all',false).accepted);
  for(let i=0;i<30;i++){
   ride.update(1/60,{...idle,steer:1},0,false);
   assert(ride.sim.pose.steering===0,'the accepted hop cannot steer into an unchecked fender position');
  }
  for(let i=0;i<45;i++)ride.update(1/60,idle,0,false);
  assert(ride.suspension.readyForDrive);
  assert(ride.setSuspensionCorner('FL',.18).accepted);
  for(let i=0;i<20;i++)ride.update(1/60,{...idle,steer:-1},0,false);
  assert(ride.sim.pose.steering===0);
  assert(ride.setSuspensionStance('level').accepted);
  ride.update(.1,{...idle,steer:1},0,false);
  assert(ride.sim.pose.steering<0,'ordinary steering returns after leveling');
 }finally{ride.dispose();}
});

test('a parked hydraulic tilt preserves its checked ground attitude and road heave on a slope',()=>{
 const terrain=flatTerrain();terrain.height=(x:number,z:number)=>x*.006+z*.004;
 const ride=new CadillacRide(car(),terrain);ride.start();
 try{
  assert(ride.setSuspensionStance('raised').accepted);
  assert(ride.setSuspensionCorner('FL',.20).accepted);
  const body=ride.model.getObjectByName('SprungBody')!,before={pitch:ride.sim.pose.pitch,roll:ride.sim.pose.roll,heave:body.position.y-ride.suspension.pose.heave};
  for(let i=0;i<30;i++){
   ride.update(1/60,idle,0,false);
   assert.equal(ride.sim.pose.pitch,before.pitch);assert.equal(ride.sim.pose.roll,before.roll);
   assert(Math.abs(body.position.y-ride.suspension.pose.heave-before.heave)<1e-10);
   assert(Math.abs(body.rotation.x-ride.suspension.pose.pitch-before.pitch)<1e-10);
   assert(Math.abs(body.rotation.z-ride.suspension.pose.roll-before.roll)<1e-10);
  }
  assert(ride.setSuspensionStance('level').accepted);
  ride.update(.1,idle,0,false);
  assert(Math.abs(ride.sim.pose.pitch)>0&&Math.abs(ride.sim.pose.roll)>0,'normal terrain alignment resumes after leveling');
 }finally{ride.dispose();}
});

test('both actual Cadillac wheel meshes fit the numerical collision envelope at full steering lock',async()=>{
 for(const variant of ['cadillac','hydraulic-cadillac'] as const){
  const model=variant==='cadillac'?car():(await loadFixture(readFileSync('public/belle/vehicles/hydraulics-cadillac.glb'))).scene;
  if(variant==='hydraulic-cadillac')fitCadillacWireWheels(model);
  const ride=new CadillacRide(model,flatTerrain(),undefined,variant);ride.start();
  try{
   for(const tire of ['standard','low-profile-whitewall'] as const){
    assert(ride.setWheels({rim:tire==='standard'?'stock':'wire-chrome',tire,center:'gold'}).accepted);
    for(const steering of [-.52,0,.52]){
     ride.sim.pose.steering=steering;ride.update(0,idle,0,false);model.updateWorldMatrix(true,true);
     const bounds=(ride.sim as unknown as {collisionSamples:{bounds:{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}}}).collisionSamples.bounds;
     const inverse=model.matrixWorld.clone().invert(),matrix=new T.Matrix4(),point=new T.Vector3();
     for(const corner of ['FL','FR','RL','RR']){
      const hub=model.getObjectByName((variant==='cadillac'?'Hub':'HydraulicHub')+corner)!;
      hub.traverseVisible(object=>{
       if(!(object instanceof T.Mesh))return;
       matrix.multiplyMatrices(inverse,object.matrixWorld);
       const positions=object.geometry.getAttribute('position');
       for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(matrix);
        assert(point.x>=bounds.minX-1e-5&&point.x<=bounds.maxX+1e-5&&point.y>=bounds.minY-1e-5&&point.y<=bounds.maxY+1e-5&&point.z>=bounds.minZ-1e-5&&point.z<=bounds.maxZ+1e-5,
         `${variant} ${tire} ${corner} at ${steering}: wheel vertex ${point.toArray()} lies outside the collision envelope`);
       }
      });
     }
    }
   }
  }finally{ride.dispose();}
 }
});
