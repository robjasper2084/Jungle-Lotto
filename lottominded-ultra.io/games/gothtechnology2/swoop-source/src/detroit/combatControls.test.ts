import test from 'node:test';import assert from 'node:assert/strict';
import {AimGesture,readBindings,deadZone,COMBAT_BINDINGS} from './royale/combatControls.ts';
test('classic tap toggles once and a hold release never toggles ADS',()=>{
 const aim=new AimGesture();aim.down(0);aim.up(100);assert.equal(aim.get(101),2);aim.down(200);assert.equal(aim.get(400),1);aim.up(410);assert.equal(aim.get(420),2);aim.down(500);aim.up(501);assert.equal(aim.get(502),0);aim.down(600);aim.up(900);assert.equal(aim.get(901),0);
});
test('hold and toggle ADS, cancelled input and gamepad dead zone',()=>{
 const a=new AimGesture('hold');a.down(1);assert.equal(a.get(2),2);a.up(300);assert.equal(a.get(301),0);a.preset='toggle';a.down(400);a.up(800);assert.equal(a.get(900),2);a.reset();assert.equal(a.get(901),0);assert.equal(deadZone(.1),0);assert.equal(deadZone(1),1);assert.equal(deadZone(-1),-1);assert.equal(deadZone(NaN),0);
});
test('combat remaps reject duplicates; R reload and K recover remain distinct',()=>{
 assert.equal(COMBAT_BINDINGS.reload,'KeyR');assert.equal(COMBAT_BINDINGS.recover,'KeyK');assert.deepEqual(readBindings({reload:'KeyW'}),COMBAT_BINDINGS);assert.equal(readBindings({reload:'KeyJ'}).reload,'KeyJ');assert.equal(readBindings({reload:'F5'}).reload,'KeyR');
});
