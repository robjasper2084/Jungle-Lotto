import test from 'node:test';import assert from 'node:assert/strict';import {AdaptiveQuality} from './adaptiveQuality.ts';
test('distant detail changes before resolution; pauses and manual mode do not adapt',()=>{
 const q=new AdaptiveQuality();for(let i=0;i<180;i++)q.sample(25,true);assert.equal(q.detail,.9);assert.equal(q.scale,1);
 for(let i=0;i<720;i++)q.sample(1000,false);assert.equal(q.detail,.9);assert.equal(q.scale,1);
 for(let i=0;i<720;i++)q.sample(12,true);assert.ok(q.detail>.9&&q.detail<1);assert.equal(q.scale,1);
 for(let i=0;i<3000;i++)q.sample(40,true);assert.equal(q.detail,.65);assert.equal(q.scale,.65);
});
test('active stalls count against the budget and recovery restores clarity gradually',()=>{
 const q=new AdaptiveQuality();for(let i=0;i<180;i++)q.sample(i%5?16:180,true);assert.equal(q.detail,.9);
 for(let i=0;i<1800;i++)q.sample(50,true);const detail=q.detail,scale=q.scale;
 for(let i=0;i<720;i++)q.sample(12,true);assert.ok(q.scale>scale);assert.equal(q.detail,detail);
});
test('30 FPS phones are measured against their cap',()=>{
 const q=new AdaptiveQuality();for(let i=0;i<900;i++)q.sample(33.4,true,30);assert.equal(q.detail,1);assert.equal(q.scale,1);
 for(let i=0;i<180;i++)q.sample(50,true,30);assert.equal(q.detail,.9);
 q.reset();assert.equal(q.detail,1);assert.equal(q.scale,1);
});
