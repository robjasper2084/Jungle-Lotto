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
