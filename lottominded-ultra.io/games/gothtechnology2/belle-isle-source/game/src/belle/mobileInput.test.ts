import test from 'node:test';
import assert from 'node:assert/strict';
import {PointerTrack,HeldControls,stickAxes,brakeThrottle} from './mobileInput.ts';

test('two thumbs own movement and look independently',()=>{
 const movement=new PointerTrack(),look=new PointerTrack();
 assert.ok(movement.begin(1,80,600));assert.ok(look.begin(2,600,500));
 assert.equal(movement.begin(3,20,30),false);
 assert.equal(movement.end(2),false);assert.equal(movement.id,1);
 assert.deepEqual(look.delta(2,620,490),{x:20,y:-10});
 assert.equal(look.delta(1,100,500),null);
 assert.ok(look.end(2));assert.equal(movement.id,1);
});
test('button release does not stop the other held action',()=>{
 const held=new HeldControls();held.press(1,'brake');held.press(2,'hop');
 held.release(2);assert.ok(held.has('brake'));assert.equal(held.has('hop'),false);
 assert.equal(held.release(50),false);assert.ok(held.has('brake'));
});
test('pointer motion alone never begins a hold or look',()=>{
 const look=new PointerTrack(),held=new HeldControls();
 assert.equal(look.delta(5,900,500),null);assert.equal(held.has('hop'),false);
});
test('focus reset permits a new gesture without a stale delta or held brake',()=>{
 const look=new PointerTrack(),held=new HeldControls();look.begin(1,20,50);held.press(2,'brake');
 look.clear();held.clear();assert.equal(look.delta(1,2000,5000),null);assert.equal(held.has('brake'),false);
 assert.ok(look.begin(3,300,500));assert.deepEqual(look.delta(3,305,502),{x:5,y:2});
});
test('joystick deadzone and radial limit prevent drift and diagonal boost',()=>{
 assert.deepEqual(stickAxes(2,1),{steer:0,throttle:0});
 assert.deepEqual(stickAxes(0,-100),{steer:0,throttle:1});
 const diagonal=stickAxes(100,-100);assert.ok(Math.abs(Math.hypot(diagonal.steer,diagonal.throttle)-1)<1e-9);
 assert.deepEqual(stickAxes(NaN,4),{steer:0,throttle:0});
});
test('brake opposes both travel directions and stops accelerating at rest',()=>{
 assert.equal(brakeThrottle(12),-1);assert.equal(brakeThrottle(-5),1);
 assert.equal(brakeThrottle(.04),0);assert.equal(brakeThrottle(0),0);
});
