import {test} from 'node:test';import assert from 'node:assert/strict';
import {RideProfileStats,type RideProfileFrame} from './rideProfileStats.ts';
const frame=(values:Partial<RideProfileFrame>={}):RideProfileFrame=>({dt:1/60,times:[1,2,3,4,5],draws:10,triangles:100,textures:3,geometries:4,x:0,z:0,speed:0,place:'Bridge',eligible:true,hidden:false,...values});
test('eligible foreground freezes remain in frame counts, active time and the measured rate',()=>{
 const stats=new RideProfileStats();
 stats.sample(frame({dt:.1}));stats.sample(frame({dt:3.2,x:1,place:'Shore'}));stats.sample(frame({dt:.3,x:2}));
 const report=stats.report();
 assert.equal(report.frames,3);assert(Math.abs(report.activeSeconds-3.6)<1e-9);
 assert(Math.abs(report.observedFPS-3/3.6)<1e-9);assert.equal(report.excludedSeconds,0);
 assert.equal(report.over250ms,2);assert.equal(report.over2s,1);assert.equal(report.maxFrameMs,3200);
 assert.equal(report.metrics.frameMs?.max,3200);assert.equal(report.slowFrames[0].place,'Shore');
 assert.equal(report.metrics.worldAndActivityCpuMs?.mean,3);assert.equal(report.metrics.renderSubmitCpuMs?.mean,4);
});
test('paused, hidden and first-resume intervals are excluded without inventing travel distance',()=>{
 const stats=new RideProfileStats();stats.sample(frame({x:0}));
 stats.sample(frame({dt:4,x:5,eligible:false})); // Pause/menu.
 stats.sample(frame({dt:10,x:10,hidden:true}));
 stats.sample(frame({dt:.5,x:15,eligible:false})); // Refocus frame.
 stats.sample(frame({dt:.1,x:20,speed:2}));stats.sample(frame({dt:.1,x:21,speed:2}));
 const report=stats.report();assert.equal(report.frames,3);assert.equal(report.excludedSeconds,14.5);
 assert.equal(report.hiddenSeconds,10);assert.equal(report.inactiveSeconds,4.5);assert.equal(report.over2s,0);
 assert.equal(report.distanceMetres,1);assert.equal(report.movingSeconds,.2);
});
test('invalid intervals cannot poison a report, while an empty capture remains finite',()=>{
 const stats=new RideProfileStats();
 for(const dt of [NaN,Infinity,-1,0,Number.MAX_VALUE])assert.equal(stats.sample(frame({dt})),false);
 let report=stats.report();assert.equal(report.invalidSamples,5);assert.equal(report.frames,0);
 assert.equal(report.observedFPS,0);assert.equal(report.activeSeconds,0);assert.equal(report.excludedSeconds,0);assert.equal(report.metrics.frameMs,null);
 stats.sample(frame({dt:.25,times:[NaN,-1,3,4,5]}));report=stats.report();
 assert.equal(report.invalidMetricSamples,1);assert.equal(report.metrics.simulationCpuMs?.mean,0);assert.equal(report.metrics.presentationCpuMs?.mean,0);
 assert.equal(report.maxFrameMs,250);assert.equal(report.over250ms,0);assert.equal(report.over2s,0);
});
test('bounded diagnostic samples preserve full-capture counts, maxima and worst stall locations',()=>{
 const stats=new RideProfileStats({frames:2,slowFrames:2,places:2});
 for(const [i,dt]of [.2,.3,4,.4].entries())stats.sample(frame({dt,x:i,place:'Place '+i}));
 const report=stats.report();assert.equal(report.frames,4);assert.equal(report.sampledFrames,2);assert.equal(report.droppedFrameSamples,2);
 assert(Math.abs(report.activeSeconds-4.9)<1e-9);assert(Math.abs(report.observedFPS-4/4.9)<1e-9);
 assert.equal(report.over250ms,3);assert.equal(report.over2s,1);assert.equal(report.maxFrameMs,4000);
 assert.equal(report.metrics.frameMs?.max,4000);assert.equal(report.metrics.frameMs?.mean,1225);
 assert.deepEqual(report.slowFrames.map(s=>s.place),['Place 2','Place 3']);assert.equal(report.places.length,2);assert.equal(report.placesTruncated,true);
});
