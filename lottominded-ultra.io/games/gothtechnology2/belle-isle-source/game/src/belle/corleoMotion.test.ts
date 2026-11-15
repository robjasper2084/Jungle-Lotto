import assert from 'node:assert/strict';
import test from 'node:test';
import {CorleoMotion,CORLEO_TUNING} from './corleoMotion.ts';

test('right and left steering turn toward the rider-relative side at every heading',()=>{
 for(const heading of [0,Math.PI/2,-2.4])for(const steer of [-1,1]){
  const m=new CorleoMotion({x:0,y:0,z:0,heading});
  for(let i=0;i<20;i++)m.tick(.05,{throttle:1,steer},()=>0,()=>false);
  // With forward +Z, the rider's right is -X, rotated by the spawn heading.
  const right=-m.pose.x*Math.cos(heading)+m.pose.z*Math.sin(heading);
  const forward=m.pose.x*Math.sin(heading)+m.pose.z*Math.cos(heading);
  assert(right*steer>.2,'steering must move toward the selected side');
  assert(forward>1,'turning must preserve forward travel');
 }
});

test('walking reaches 25 mph and running reaches 160 mph without overshoot',()=>{
 for(const [run,mph] of [[false,25],[true,160]] as const){
  const m=new CorleoMotion({x:0,y:0,z:0,heading:0});
  for(let i=0;i<200;i++){
   m.tick(.05,{throttle:1,steer:0,run},()=>0,()=>false);
   assert.ok(m.pose.speed<=mph*.44704+.00001);
  }
  assert.ok(Math.abs(m.pose.speed/.44704-mph)<.00001);
 }
});
test('top speed cannot tunnel through a narrow obstruction in a long frame',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});m.pose.speed=CORLEO_TUNING.runMetresPerSecond;
 m.tick(.05,{throttle:1,steer:0,run:true},()=>0,(_x,z)=>z>=1&&z<=1.3);
 assert.ok(m.pose.z<1);assert.equal(m.pose.speed,0);
});
test('releasing run returns to walking speed and releasing movement stops',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});m.pose.speed=CORLEO_TUNING.runMetresPerSecond;
 for(let i=0;i<100;i++)m.tick(.05,{throttle:1,steer:0},()=>0,()=>false);
 assert.ok(Math.abs(m.pose.speed/.44704-25)<.00001);
 for(let i=0;i<100;i++)m.tick(.05,{throttle:0,steer:0},()=>0,()=>false);
 assert.equal(m.pose.speed,0);
});
test('lower/crawl reaches a 0.8 metre saddle and stays grounded',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});
 for(let i=0;i<100;i++)m.tick(.05,{throttle:0,steer:0,crawl:true,lower:true},()=>0,()=>false);
 assert.ok(Math.abs(m.pose.saddleMetres-.8)<.0001);
 assert.equal(m.pose.airMetres,0);
});
test('jump leaves ground then lands without negative altitude',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});
 m.tick(.05,{throttle:1,steer:0,jump:true},()=>2,()=>false);
 assert.ok(m.pose.airMetres>0);
 for(let i=0;i<80;i++)m.tick(.05,{throttle:0,steer:0},()=>2,()=>false);
 assert.equal(m.pose.airMetres,0);
 assert.equal(m.pose.y,2);
});
test('obstructed terrain blocks forward travel',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});
 for(let i=0;i<100;i++)m.tick(.05,{throttle:1,steer:0,run:true},()=>0,(_x,z)=>z>.3);
 assert.ok(m.pose.z<=.300001);
 assert.ok(Number.isFinite(m.pose.heading));
});
test('invalid inputs do not poison game state',()=>{
 const m=new CorleoMotion({x:0,y:0,z:0,heading:0});
 m.tick(NaN,{throttle:Infinity,steer:NaN},()=>0,()=>false);
 assert.equal(m.pose.speed,0);
 m.tick(.05,{throttle:Infinity,steer:NaN},()=>0,()=>false);
 assert.ok(Number.isFinite(m.pose.speed));
});
