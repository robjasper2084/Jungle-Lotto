import assert from 'node:assert/strict';
import test from 'node:test';
import {CorleoMotion,CORLEO_TUNING} from './corleoMotion.ts';

test('prototype run is 45 percent faster than trot',()=>{
 assert.ok(Math.abs(CORLEO_TUNING.runMetresPerSecond/CORLEO_TUNING.trotMetresPerSecond-1.45)<.0001);
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
