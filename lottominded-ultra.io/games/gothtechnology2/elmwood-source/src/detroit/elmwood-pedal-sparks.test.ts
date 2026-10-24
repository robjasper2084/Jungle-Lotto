import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {PedalSparks} from '../../../ride-core/src/pedalSparks.ts';
import {RideMotion} from './ride-motion.ts';
import type {TerrainSampler} from '../simulation/world.ts';

test('Elmwood interpolated riding poses retain hard-surface scrape contact',()=>{
 const terrain:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
 for(const steer of [-1,1]){
  const motion=new RideMotion(terrain),sparks=new PedalSparks(new Scene());motion.selectVehicle('euc');
  for(let i=0;i<420;i++)motion.update(1/60,{throttle:1});
  let peak=0;
  for(let i=0;i<90;i++){motion.update(1/60,{throttle:.7,steer});sparks.update(1/60,motion.pose,!motion.sim.crashed);peak=Math.max(peak,sparks.count);}
  assert.ok(peak>0,'actual Elmwood pose must emit at pedal contact');sparks.dispose();
 }
});
