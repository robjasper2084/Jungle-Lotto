import {test} from 'node:test';import assert from 'node:assert/strict';
import {orientationFrame,orientationDelta,GyroFilter,readGyroSettings} from '../src/gyroscope.ts';
test('portrait yaw and pitch have independent axes and do not invert at compass wrap',()=>{
 const a=orientationFrame(0,90,0,0),yaw=orientationDelta(a,orientationFrame(10,90,0,0)),pitch=orientationDelta(a,orientationFrame(0,100,0,0));
 assert(Math.abs(yaw.yaw-10*Math.PI/180)<1e-6);assert(Math.abs(yaw.pitch)<1e-6);
 assert(Math.abs(pitch.pitch-10*Math.PI/180)<1e-6);assert(Math.abs(pitch.yaw)<1e-6);
 const wrap=orientationDelta(orientationFrame(359,90,0,0),orientationFrame(1,90,0,0));assert(Math.abs(wrap.yaw-2*Math.PI/180)<1e-6);
});
test('sensor filtering calibrates on activation, stops while paused and accepts both landscape orientations',()=>{
 for(const screen of [0,90,-90,180]){
  const f=new GyroFilter(),start=orientationFrame(0,90,0,screen);
  f.receive(start);assert.deepEqual(f.consume(1/60,true),{yaw:0,pitch:0});f.receive(orientationFrame(8,96,0,screen));
  const changed=f.consume(1/60,true);assert(Math.hypot(changed.yaw,changed.pitch)>.015);assert(Math.hypot(changed.yaw,changed.pitch)<.1);
  assert.deepEqual(f.consume(1/60,false),{yaw:0,pitch:0});assert.deepEqual(f.consume(1/60,true),{yaw:0,pitch:0});
  f.calibrate();assert.deepEqual(f.consume(1/60,true),{yaw:0,pitch:0});
 }
});
test('invalid saved gyro preferences fall back safely; sensitivity and inversion are bounded',()=>{
 assert.equal(readGyroSettings(null).mode,'off');assert.equal(readGyroSettings({mode:'bad'}).mode,'off');
 assert.equal(readGyroSettings({mode:'always',sensitivity:999}).sensitivity,3);
 const a=new GyroFilter(),b=new GyroFilter();for(const f of [a,b]){f.receive(orientationFrame(0,90,0,0));f.consume(1/60,true);f.receive(orientationFrame(10,100,0,0));}
 const normal=a.consume(1/60,true),inverse=b.consume(1/60,true,2,true,true);
 assert(Math.abs(normal.yaw*2+inverse.yaw)<1e-7);assert(Math.abs(normal.pitch*2+inverse.pitch)<1e-7);
});
