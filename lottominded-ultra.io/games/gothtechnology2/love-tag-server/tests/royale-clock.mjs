import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleClock} from '../dist/royaleClock.js';
test('fixed scheduler bounds catch-up and reports lost wall time',()=>{
 const clock=new RoyaleClock();let ticks=0;
 for(let i=0;i<60;i++)clock.advance(1000/60,()=>ticks++);
 assert.equal(ticks,60);assert.equal(clock.metrics.droppedMs,0);
 assert.equal(clock.advance(1000,()=>ticks++),15);assert.equal(ticks,75);
 assert(Math.abs(clock.metrics.droppedMs-750)<1e-5);assert.equal(clock.metrics.overloadCallbacks,1);
 assert.equal(clock.advance(0,()=>ticks++),0);assert.throws(()=>clock.advance(NaN,()=>{}));
});
test('engine step errors propagate, never silently award a result or continue the tick',()=>{
 const clock=new RoyaleClock();assert.throws(()=>clock.advance(20,()=>{throw Error('engine overflow');}),/overflow/);
 assert.equal(clock.metrics.steps,0);
});
