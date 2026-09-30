import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BootLifecycle} from './bootLifecycle.ts';
test('start stays gated until rider, location, scene and input are ready',()=>{
 const b=new BootLifecycle();b.advance('loading','Loading rider');
 for(let i=0;i<4;i++){const flags=[true,true,true,true];flags[i]=false;assert.equal(b.finish(...flags as [boolean,boolean,boolean,boolean]),false);}
 assert.equal(b.finish(true,true,true,true),true);assert.equal(b.stage,'ready');
});
test('renderer or asset failure remains terminal despite late async completion',()=>{
 const b=new BootLifecycle();b.fail('Required rider failed','404');b.advance('preparing','Old attempt');
 assert.equal(b.finish(true,true,true,true),false);assert.throws(()=>b.assertActive());assert.equal(b.detail,'404');
});
test('actual download progress extends timeout; silence produces a retryable error',()=>{
 let time=0;const b=new BootLifecycle(()=>time,100);b.advance('loading','Rider');
 for(let i=0;i<10;i++){time+=90;b.progress();b.tick();assert.equal(b.stage,'loading');}
 time+=101;b.tick();assert.equal(b.stage,'error');
});
test('context loss can fail a previously ready session; retry is a new lifecycle',()=>{
 const b=new BootLifecycle();b.finish(true,true,true,true);b.fail('Graphics interrupted');assert.equal(b.stage,'error');
 const retry=new BootLifecycle();assert.equal(retry.finish(true,true,true,true),true);
});
