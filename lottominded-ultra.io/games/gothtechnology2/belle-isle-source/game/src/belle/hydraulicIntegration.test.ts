import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CadillacRide,type CadillacVariant} from './cadillacRide.ts';
import {fitCadillacWireWheels} from './cadillacWireWheels.ts';
import {CADILLAC_CORNERS,CADILLAC_SUSPENSION_LIMITS} from './cadillacSuspension.ts';
import {HYDRAULIC_SMART_POSES,type HydraulicSmartPose} from './hydraulicController.ts';
import type {ParkTerrain} from './terrain.ts';

async function loadFixture(path:string){
  const glb=readFileSync(path),jsonLength=glb.readUInt32LE(12);
  const asset=JSON.parse(glb.subarray(20,20+jsonLength).toString());
  // Preserve the shipped vertices, indices, node hierarchy, and materials'
  // identities. Only texture decoding is omitted in this Node-only harness.
  asset.materials=(asset.materials??[]).map((material:{name:string})=>({name:material.name}));
  const json=Buffer.from(JSON.stringify(asset)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const binary=glb.subarray(20+jsonLength),fixture=Buffer.alloc(20+padded.length+binary.length);
  fixture.write('glTF');fixture.writeUInt32LE(2,4);fixture.writeUInt32LE(fixture.length,8);
  fixture.writeUInt32LE(padded.length,12);fixture.writeUInt32LE(0x4e4f534a,16);
  padded.copy(fixture,20);binary.copy(fixture,20+padded.length);
  return (await new GLTFLoader().parseAsync(fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength),'')).scene;
}
const source={
  cadillac:await loadFixture('public/belle/vehicles/silver-cadillac.glb'),
  'hydraulic-cadillac':await loadFixture('public/belle/vehicles/hydraulics-cadillac.glb'),
};
// Match cadillacModel(): the real red/gold rim fitter runs before the ride's
// immutable fender captures, just as it does in the browser.
fitCadillacWireWheels(source['hydraulic-cadillac']);
const variants:CadillacVariant[]=['cadillac','hydraulic-cadillac'];
const idle={gas:0,brake:0,steer:0,handbrake:false};
const pedals={gas:1,brake:0,steer:.9,handbrake:false};
const noKeys:ReadonlySet<string>=new Set();
const dt=1/60;
function flatTerrain(){return{
  map:{spawn:{x:0,z:0,heading:0},roads:[]},height:()=>0,land:()=>true,obstructed:()=>false,
  bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null,
} as unknown as ParkTerrain;}
function makeRide(variant:CadillacVariant,terrain=flatTerrain()){
  const ride=new CadillacRide(source[variant].clone(true),terrain,undefined,variant);ride.start();return ride;
}
function body(ride:CadillacRide){return ride.model.getObjectByName(ride.variant==='cadillac'?'SprungBody':'ChassisGeometry')!;}
function renderState(ride:CadillacRide){
  const chassis=body(ride);
  return{body:[...chassis.position.toArray(),...chassis.quaternion.toArray()],hubs:CADILLAC_CORNERS.map(corner=>{
    const hub=ride.model.getObjectByName((ride.variant==='cadillac'?'Hub':'HydraulicHub')+corner)!;
    return[...hub.position.toArray(),...hub.quaternion.toArray()];
  })};
}
function nearly(actual:number,expected:number,message:string){assert(Math.abs(actual-expected)<1e-10,`${message}: ${actual} != ${expected}`);}
function renderedPoseMatches(ride:CadillacRide,base={heave:0,pitch:0,roll:0}){
  const chassis=body(ride),pose=ride.suspension.pose;
  nearly(chassis.position.y,base.heave+pose.heave,'rendered heave');
  nearly(chassis.rotation.x,base.pitch+pose.pitch,'rendered pitch');
  nearly(chassis.rotation.z,base.roll+pose.roll,'rendered roll');
}
function heldFrame(ride:CadillacRide,seconds=dt){ride.update(seconds,idle,0,false,noKeys,true);}
function finishTransition(ride:CadillacRide,frame=(seconds:number)=>heldFrame(ride,seconds)){
  const from=ride.suspension.snapshot().current,target={...ride.suspension.targets};
  const chassis=body(ride),pose=ride.suspension.pose;
  const base={heave:chassis.position.y-pose.heave,pitch:chassis.rotation.x-pose.pitch,roll:chassis.rotation.z-pose.roll};
  let previous=from,progress=0,frames=0;
  while(!ride.suspension.settled&&frames++<180){
    frame(dt);const current=ride.suspension.snapshot().current;
    let scalar:number|undefined;
    for(const corner of CADILLAC_CORNERS){
      assert(Math.abs(current[corner]-previous[corner])<=CADILLAC_SUSPENSION_LIMITS.actuatorMetresPerSecond*dt+1e-10,'actual ride keeps the actuator speed bound');
      const distance=target[corner]-from[corner];
      if(Math.abs(distance)<1e-12)nearly(current[corner],from[corner],'unchanged corner');
      else{
        const weight=(current[corner]-from[corner])/distance;
        assert(weight>=progress-1e-10&&weight<=1+1e-10,'the accepted segment is monotone and cannot overshoot');
        if(scalar===undefined)scalar=weight;else nearly(weight,scalar,'all corners retain the exact preflight segment');
      }
    }
    if(scalar!==undefined)progress=scalar;
    renderedPoseMatches(ride,base);previous=current;
  }
  assert(ride.suspension.settled,'a lift must finish within its bounded duration');
  assert.deepEqual(ride.suspension.snapshot().current,target);
  return frames;
}
function commandWithoutSnap(ride:CadillacRide,pose:HydraulicSmartPose){
  const before=ride.suspension.snapshot(),rendered=renderState(ride);
  const result=ride.setHydraulicPose(pose);
  assert(result.accepted,`${ride.variant} ${pose}: ${result.message}`);
  assert.deepEqual(ride.suspension.targets,HYDRAULIC_SMART_POSES[pose]);
  assert.deepEqual(ride.suspension.snapshot().current,before.current,'an accepted command starts at the displayed current heights');
  assert.deepEqual(ride.suspension.pose,before.pose,'an accepted command cannot snap the body pose');
  assert.deepEqual(renderState(ride),rendered,'preflight and command acceptance do not move scene nodes');
  assert.equal(ride.hydraulicSwitches.diagnostics().activePose,pose);
}

for(const variant of variants){
  test(`${variant}: all Smart Pump presets clear the shipped fenders from stock and through front/back reversals`,()=>{
    const ride=makeRide(variant);
    try{
      for(const pose of ['front-up','back-up','pancake'] as const){
        ride.start();commandWithoutSnap(ride,pose);finishTransition(ride);
      }
      for(const pose of ['front-up','back-up','front-up','pancake'] as const){
        commandWithoutSnap(ride,pose);const frames=finishTransition(ride);
        assert(frames>1,'a nonzero Smart Pump move is visibly gradual');
      }
      assert(ride.suspension.readyForDrive);
    }finally{ride.dispose();}
  });

  test(`${variant}: rapid Smart Pump retargets keep the actual current pose and new swept path`,()=>{
    const ride=makeRide(variant);
    try{
      commandWithoutSnap(ride,'front-up');for(let i=0;i<12;i++)heldFrame(ride);
      const current=ride.suspension.snapshot().current;
      assert(current.FL>0&&current.FL<.22,'retarget while the source rig is actually travelling');
      commandWithoutSnap(ride,'back-up');for(let i=0;i<7;i++)heldFrame(ride);
      commandWithoutSnap(ride,'pancake');for(let i=0;i<4;i++)heldFrame(ride);
      commandWithoutSnap(ride,'front-up');finishTransition(ride);
      assert.deepEqual(ride.suspension.snapshot().current,HYDRAULIC_SMART_POSES['front-up']);
    }finally{ride.dispose();}
  });

  test(`${variant}: hydraulic mode holds throttle and steering during motion, at an uneven endpoint, and at factory height`,()=>{
    const ride=makeRide(variant);
    try{
      commandWithoutSnap(ride,'front-up');
      const parked={...ride.sim.pose},phases=ride.diagnostics().wheelPhaseRad;
      const frame=(seconds:number)=>{
        ride.update(seconds,pedals,0,false,noKeys,true);
        for(const key of ['x','z','heading','steering','speed','distance'] as const)nearly(ride.sim.pose[key],parked[key],`held ${key}`);
        assert.deepEqual(ride.diagnostics().wheelPhaseRad,phases);
      };
      finishTransition(ride,frame);for(let i=0;i<30;i++)frame(dt);
      assert.deepEqual(ride.suspension.targets,HYDRAULIC_SMART_POSES['front-up'],'held pedals do not replace the selected Smart Pump pose with automatic leveling');
      commandWithoutSnap(ride,'pancake');finishTransition(ride,frame);for(let i=0;i<30;i++)frame(dt);
      assert(ride.suspension.readyForDrive);
      for(let i=0;i<45;i++)ride.update(dt,pedals,0,false);
      assert(ride.sim.pose.speed>0&&ride.sim.pose.steering<0,'closing hydraulic mode restores the driving controls');
    }finally{ride.dispose();}
  });

  test(`${variant}: paused Settings previews move hydraulics without advancing physics, travel, wheel spin, or panel animations`,()=>{
    const ride=makeRide(variant);
    try{
      // Retain nonzero accumulated travel and spin, so this also catches a
      // preview that resets them instead of merely failing to advance them.
      for(let i=0;i<20;i++)ride.update(dt,{...pedals,steer:0},0,false);
      for(let i=0;i<20;i++)ride.update(dt,{...idle,brake:1,handbrake:true},0,false);
      for(let i=0;i<90;i++)ride.update(dt,idle,0,false);
      assert(ride.sim.pose.speed===0&&ride.sim.pose.distance>0);
      assert(ride.diagnostics().wheelPhaseRad.some(phase=>phase!==0));
      if(ride.access){
        assert(ride.toggleTrunk().accepted);assert(ride.toggleRearDoor('left').accepted);assert(ride.toggleRearDoor('right').accepted);
        ride.toggleDoor();heldFrame(ride,.08);
        assert(ride.accessSnapshot()!.trunk.progress>0&&ride.accessSnapshot()!.trunk.progress<1);
      }
      const physics={...ride.sim.pose},before=ride.diagnostics(),panels=ride.accessSnapshot();
      commandWithoutSnap(ride,'front-up');
      finishTransition(ride,seconds=>{
        ride.updateHydraulicPreview(seconds,false);
        assert.deepEqual(ride.sim.pose,physics,'Settings preview must not step the car controller');
        const after=ride.diagnostics();
        assert.equal(after.distanceM,before.distanceM);assert.deepEqual(after.wheelPhaseRad,before.wheelPhaseRad);
        assert.equal(after.driverDoorRad,before.driverDoorRad);assert.deepEqual(ride.accessSnapshot(),panels);
        assert.deepEqual(after.trunkInstallation,before.trunkInstallation);
      });
      assert(body(ride).position.y>0);
      if(ride.access){heldFrame(ride,.08);assert(ride.accessSnapshot()!.trunk.progress>panels!.trunk.progress,'normal updates resume the existing panel animation');}
    }finally{ride.dispose();}
  });

  test(`${variant}: reduced-motion Smart Pump commands and paused previews apply their exact endpoint immediately`,()=>{
    const ride=makeRide(variant);
    try{
      assert(ride.setHydraulicPose('front-up',true).accepted);
      assert.deepEqual(ride.suspension.snapshot().current,HYDRAULIC_SMART_POSES['front-up']);
      assert(ride.suspension.settled);renderedPoseMatches(ride);
      assert(ride.hydraulicSwitches.diagnostics().switches.every(control=>!control.moving));
      commandWithoutSnap(ride,'back-up');heldFrame(ride,.1);
      assert(!ride.suspension.settled);ride.updateHydraulicPreview(0,true);
      assert.deepEqual(ride.suspension.snapshot().current,HYDRAULIC_SMART_POSES['back-up']);
      assert(ride.suspension.settled);renderedPoseMatches(ride);
      assert(ride.hydraulicSwitches.diagnostics().switches.every(control=>!control.moving));
      assert(ride.setHydraulicPose('pancake',true).accepted);
      assert.deepEqual(ride.suspension.snapshot().current,HYDRAULIC_SMART_POSES.pancake);
      assert(ride.suspension.readyForDrive);renderedPoseMatches(ride);
    }finally{ride.dispose();}
  });

  test(`${variant}: obstacle rejection keeps the accepted hydraulic target, rendered pose, and physical switches`,()=>{
    const terrain=flatTerrain(),ride=makeRide(variant,terrain);
    try{
      commandWithoutSnap(ride,'front-up');finishTransition(ride);for(let i=0;i<60;i++)heldFrame(ride);
      const accepted=ride.suspension.snapshot(),rendered=renderState(ride),switches=ride.hydraulicSwitches.diagnostics();
      assert(switches.switches.every(control=>!control.moving));
      terrain.obstructed=()=>true;
      const result=ride.setHydraulicPose('back-up');assert(!result.accepted);assert.match(result.message,/clearance|obstacle/i);
      assert.deepEqual(ride.suspension.snapshot(),accepted);assert.deepEqual(renderState(ride),rendered);
      assert.deepEqual(ride.hydraulicSwitches.diagnostics(),switches);
      ride.updateHydraulicPreview(.1,false);
      assert.deepEqual(ride.hydraulicSwitches.diagnostics(),switches,'a rejected command cannot schedule a delayed switch flick');
      terrain.obstructed=()=>false;
      commandWithoutSnap(ride,'back-up');finishTransition(ride);
    }finally{ride.dispose();}
  });
}

test('silver Cadillac panel poses remain independent while Smart Pump presets raise, reverse, and lower the body',()=>{
  const ride=makeRide('cadillac');
  try{
    assert(ride.toggleTrunk().accepted);assert(ride.toggleRearDoor('left').accepted);assert(ride.toggleRearDoor('right').accepted);ride.toggleDoor();
    commandWithoutSnap(ride,'front-up');heldFrame(ride,.1);
    assert(ride.suspension.pose.heave>0);assert(ride.accessSnapshot()!.trunk.progress>0&&ride.accessSnapshot()!.trunk.progress<1);
    assert(ride.diagnostics().driverDoorRad<0);
    finishTransition(ride);for(let i=0;i<120;i++)heldFrame(ride);
    const panels=ride.accessSnapshot(),door=ride.diagnostics().driverDoorRad,lid=ride.access!.trunkLid;
    const lidLocal=[...lid.position.toArray(),...lid.quaternion.toArray()];
    for(const pose of ['back-up','pancake'] as const){
      commandWithoutSnap(ride,pose);finishTransition(ride);
      assert.deepEqual(ride.accessSnapshot(),panels);assert.equal(ride.diagnostics().driverDoorRad,door);
      assert.deepEqual([...lid.position.toArray(),...lid.quaternion.toArray()],lidLocal,'body tilt cannot overwrite the trunk hinge layer');
    }
  }finally{ride.dispose();}
});

test('the original hydraulic Cadillac fender guard rejects an unsafe corner without changing targets or flicking a switch',()=>{
  const ride=makeRide('hydraulic-cadillac');
  try{
    const accepted=ride.suspension.snapshot(),rendered=renderState(ride),switches=ride.hydraulicSwitches.diagnostics();
    const result=ride.setSuspensionCorner('FL',.08,false);
    assert(!result.accepted,'the actual source front fender rejects this known unsafe unbalanced stroke');
    assert.match(result.message,/tire.*fender/);
    assert.deepEqual(ride.suspension.snapshot(),accepted);assert.deepEqual(renderState(ride),rendered);
    assert.deepEqual(ride.hydraulicSwitches.diagnostics(),switches);
    ride.updateHydraulicPreview(.1,false);assert.deepEqual(ride.hydraulicSwitches.diagnostics(),switches);
  }finally{ride.dispose();}
});
