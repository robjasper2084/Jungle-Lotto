import test from 'node:test';import assert from 'node:assert/strict';import {StartupFrames} from '../src/startupFrames.ts';
test('first thirty seconds retain stalls, exclude paused time and stay bounded',()=>{
 const p=new StartupFrames();p.sample(0,1,10);p.sample(200,180,10);p.pause();p.sample(90000,1,10);
 for(let n=1;n<=1800;n++)p.sample(90000+n*1000/60,3,9);
 const report=p.report;assert(report.complete);assert.equal(report.over100,1);assert.equal(report.maxActors,10);assert.equal(report.max,200);assert(report.frames<1801);
 p.sample(500000,1000,20);assert.deepEqual(p.report,report);p.reset();assert.equal(p.report.frames,0);
});
