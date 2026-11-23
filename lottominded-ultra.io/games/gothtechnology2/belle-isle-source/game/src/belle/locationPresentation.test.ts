import test from 'node:test';
import assert from 'node:assert/strict';
import {LocationPresentation} from './locationPresentation.ts';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import {createPose} from '../../runtime/ride-core/src/controller.ts';
import type {TerrainSampler} from '../../runtime/ride-core/src/terrain.ts';

const ground:TerrainSampler={
 sampleGround(_x,_z,out){out.height=2;out.normal={x:0,y:1,z:0};out.surface='pavement';out.offCourse=false;return out;},
 raycast(){return null;},raycastObstacle(){return null;}
};

test('real-location display never advances, resets or relocates the parked RideCore',()=>{
 const core=new RideCore(ground,{spawn:{position:{x:12,y:2,z:24},headingY:.4}});
 core.advance(1/60,{dismount:true});
 for(let i=0;i<120;i++)core.advance(1/60);
 const simulation=structuredClone(core.controller.captureState());
 const current=structuredClone(core.current),previous=structuredClone(core.previous),render=structuredClone(core.renderPose);
 const display=new LocationPresentation();display.begin(Object.freeze(core.current));
 for(let i=0;i<180;i++){
  const pose=display.update({x:1200+i*.03,z:400,headingY:Math.PI/2,speedMps:1.8},2,1/60)!;
  assert.notEqual(pose,core.current);assert.notEqual(pose,core.renderPose);
  assert.equal(pose.footMode,2);assert.equal(pose.footBlend,1);assert.equal(pose.y,2);
  assert.equal(pose.parkX,current.x);assert.equal(pose.parkZ,current.z);
 }
 assert.deepEqual(core.controller.captureState(),simulation);
 assert.deepEqual(core.current,current);assert.deepEqual(core.previous,previous);assert.deepEqual(core.renderPose,render);
});

test('display uses terrain height and travel heading without inheriting crash or vehicle state',()=>{
 const parked=createPose();Object.assign(parked,{x:12,z:4,headingY:.7,crashBlend:1,crashKind:4,airHeight:30,footMode:3,speed:20});
 const display=new LocationPresentation();display.begin(parked);
 const pose=display.update({x:100,z:200,headingY:null,speedMps:0},7.2,1/60)!;
 assert.equal(pose.y,7.2);assert.equal(pose.headingY,.7);assert.equal(pose.crashBlend,0);assert.equal(pose.crashKind,0);assert.equal(pose.airHeight,0);assert.equal(pose.speed,0);
 const moving=display.update({x:101,z:200,headingY:Math.PI/2,speedMps:1.5},7.3,1/60)!;
 assert.equal(moving.headingY,Math.PI/2);assert.ok(moving.footCycle>0);assert.ok(moving.velocityX>1.49);assert.ok(Math.abs(moving.velocityZ)<1e-9);
});

test('invalid display inputs fail closed and animation cannot accumulate a background gap',()=>{
 const display=new LocationPresentation();display.begin(createPose());
 const point={x:10,z:20,headingY:null,speedMps:1};
 assert.equal(display.update({...point,x:NaN},2,.016),null);
 assert.equal(display.update({...point,headingY:Infinity},2,.016),null);
 assert.equal(display.update(point,NaN,.016),null);assert.equal(display.update(point,2,-1),null);
 const pose=display.update({...point,speedMps:999},2,10000)!;
 assert.equal(pose.footTime,.1);assert.equal(pose.speed,5.4);
 display.begin(createPose());assert.equal(display.update(point,2,0)!.footTime,0);
});
