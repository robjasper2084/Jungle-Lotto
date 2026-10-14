import test from 'node:test';
import assert from 'node:assert/strict';
import {FootAnimation,gaitScale,movementDirection} from '../src/footAnimation.ts';
import {footCycleDistance} from '../src/onFootGait.ts';
import {RiderPresentation} from '../../swoop-fps-release/src/detroit/royale/riderPresentation.ts';
import {createPose} from '../../swoop-fps-release/src/detroit/controller.ts';

test('both short-legged mascots retain a readable walking cadence',()=>{
 for(const leg of [.27,.30]){
  const cycles=2.35/footCycleDistance(2.35)/gaitScale(leg);
  assert(cycles<2,'mascot must not cycle six to nine steps per second');
  assert(cycles>1,'walking still has visible footwork');
 }
});
test('directional captures follow local travel at every facing, including backwards',()=>{
 for(const headingY of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const direction of [0,Math.PI/4,Math.PI/2,Math.PI]){
  const actual=movementDirection({headingY,velocityX:Math.sin(headingY+direction),velocityZ:Math.cos(headingY+direction)});
  assert(Math.abs(Math.atan2(Math.sin(actual-direction),Math.cos(actual-direction)))<1e-8);
 }
});
test('turn-in-place history steps the feet and resets safely when scrubbing',()=>{
 const a=new FootAnimation();for(let i=0;i<120;i++)a.update({footTime:i/60,headingY:i/60,speed:0});
 assert(a.turn>.9&&a.turnCycle>.6);a.update({footTime:0,headingY:0,speed:0});
 assert.equal(a.turnCycle,0);assert.equal(a.turn,0);assert.equal(a.acceleration,0);
});
test('confirmed hit direction changes flinch and elimination direction without moving authority',()=>{
 const source=createPose(),front=new RiderPresentation(),back=new RiderPresentation();
 front.sample(source,1,true,0,false,false);back.sample(source,1,true,0,false,false);
 front.hit(0,1);back.hit(0,-1);
 assert(front.sample(source,2,true,0,false,false).bodyPitch>back.sample(source,2,true,0,false,false).bodyPitch);
 front.sample(source,3,false,0,false,false);back.sample(source,3,false,0,false,false);
 assert(front.sample(source,30,false,0,false,false).crashDirection!==back.sample(source,30,false,0,false,false).crashDirection);
 assert.equal(source.crashBlend,0);assert.equal(source.x,0);
});

import {LOW_STANCE_MOTION} from '../src/lowStanceMotionData.ts';
import {TURN_MOTION} from '../src/turnMotionData.ts';
test('authored low stances retain planted contact, recover above ground and close their loops',()=>{
 for(const [name,clip] of Object.entries(LOW_STANCE_MOTION)){
  assert.deepEqual(clip.samples[0],clip.samples.at(-1),name+' seam');
  assert(clip.samples.every(row=>row.every(Number.isFinite)&&row[1]>=0&&row[4]>=0),name+' below-ground target');
  assert(clip.samples.some(row=>row[1]>.04),name+' has no foot recovery');
  assert(clip.samples.filter(row=>row[1]<.005).length>20,name+' lacks planted support');
 }
 for(const [name,clip] of Object.entries(TURN_MOTION)){
  const first=clip.samples[0],last=clip.samples.at(-1)!;
  for(const [a,b] of [[0,30],[38,44]])assert.deepEqual(first.slice(a,b),last.slice(a,b),name+' turn direction seam');
  for(const offset of [30,34,44,48,52,56,60,64]){
   const dot=first.slice(offset,offset+4).reduce((sum,n,k)=>sum+n*last[offset+k],0);
   assert(Math.abs(dot)>.99999,name+' turn rotation seam');
  }
  assert(clip.samples.every(row=>row.every(Number.isFinite)),name+' invalid turn sample');
 }
});
