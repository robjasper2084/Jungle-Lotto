import test from 'node:test';import assert from 'node:assert/strict';import {FrameSchedule} from './frameSchedule.ts';
test('callback jitter at 60 Hz does not drift into a 30 Hz cap',()=>{
 const f=new FrameSchedule();let rendered=0;for(let i=0;i<600;i++)rendered+=+f.shouldRender(i*1000/60+(i%2?1.2:0),false,false,60);assert.ok(rendered>=598,`${rendered} frames`);
});
test('non-divisible display rates retain requested frame rate, idle caps and long-stall recovery',()=>{
 const f=new FrameSchedule();let rendered=0;for(let i=0;i<1440;i++)rendered+=+f.shouldRender(i*1000/144,false,false,60);assert.ok(rendered>=599&&rendered<=601);
 assert.equal(f.shouldRender(30000,false,false,60),true);assert.equal(f.shouldRender(30001,false,false,60),false);
 assert.equal(f.shouldRender(30002,false,true,60),true);
 const idle=new FrameSchedule();let count=0;for(let i=0;i<600;i++)count+=+idle.shouldRender(i*1000/60,true,false,60);assert.ok(count>=299&&count<=301);
});
