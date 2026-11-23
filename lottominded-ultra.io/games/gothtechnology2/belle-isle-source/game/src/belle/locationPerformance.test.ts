import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocationPerformanceCapture,LOCATION_PERF_SAMPLE_LIMIT,createLocationPerformancePanel,locationPerformanceEnabled,type LocationPerfContext} from './locationPerformance.ts';

const context=(changes:Partial<LocationPerfContext>={}):LocationPerfContext=>({
 active:true,paused:false,hidden:false,focused:true,preparing:false,modal:false,immersive:false,cooperative:false,
 viewportWidth:1280,viewportHeight:720,devicePixelRatio:2,renderPixelRatio:1.5,targetFrameCap:60,reducedMotion:false,locationState:'follow',...changes,
});

test('the exact QA flag is required and disabled construction touches neither DOM nor context',()=>{
 for(const search of ['', '?profile=manual','?locationPerf=0','?locationPerf=true']){
  assert.equal(locationPerformanceEnabled(search),false);
  assert.equal(createLocationPerformancePanel(()=>{throw Error('Disabled QA must not read game state');},search),undefined);
 }
 assert.equal(locationPerformanceEnabled('?locationPerf=1&profile=manual'),true);
});

test('GPS-follow frames use measured completion intervals, nearest-rank percentiles and explicit CPU timings',()=>{
 const capture=new LocationPerformanceCapture(),state=context();assert.equal(capture.start(1000,30,state),true);
 for(const [index,time] of [1010,1026,1042,1058,1308,2409].entries())capture.rendered(time,index+2,state);
 capture.stop(2500,state);const result=capture.result!;
 assert.equal(result.outcome,'stopped');assert.equal(result.wallDurationMs,1500);assert.equal(result.renderedFrames,6);assert.equal(result.renderedFramesPerSecond,4);
 assert.equal(result.firstFrameWaitMs,10);assert.equal(result.tailWithoutFrameMs,91);
 assert.deepEqual(result.frameIntervalsMs,{count:5,meanMs:279.8,p50Ms:16,p95Ms:1101,p99Ms:1101,maxMs:1101});
 assert.deepEqual(result.sceneRenderCpuMs,{count:6,meanMs:4.5,p50Ms:4,p95Ms:7,p99Ms:7,maxMs:7});
 assert.deepEqual(result.stalls,{over50Ms:2,over100Ms:2,over250Ms:1,over1000Ms:1});
 assert.deepEqual(result.locationFrames,{follow:6});assert.match(result.note,/not GPU completion/);
});

test('a deadline bounds wall time and reports an unfinished long stall without inventing frames',()=>{
 const capture=new LocationPerformanceCapture(),state=context();capture.start(0,30,state);capture.rendered(100,10,state);
 capture.rendered(60000,40000,state);const result=capture.result!;
 assert.equal(result.outcome,'complete');assert.equal(result.wallDurationMs,30000);assert.equal(result.renderedFrames,1);
 assert.equal(result.tailWithoutFrameMs,29900);assert.equal(result.frameIntervalsMs,null);assert.equal(result.sceneRenderCpuMs!.count,1);
 capture.rendered(60010,2,state);assert.deepEqual(capture.result,result,'Completed captures do not resume');
 const empty=new LocationPerformanceCapture();empty.start(0,60,state);empty.check(60000,state);
 assert.equal(empty.result!.renderedFrames,0);assert.equal(empty.result!.firstFrameWaitMs,null);assert.equal(empty.result!.tailWithoutFrameMs,60000);
});

test('hidden, paused and interrupted gameplay end captures before those renders enter the sample',()=>{
 const interruptions:Array<[Partial<LocationPerfContext>,string]>=[
  [{hidden:true},'hidden'],[{focused:false},'focus-lost'],[{paused:true},'paused'],[{active:false},'inactive'],
  [{preparing:true},'preparing'],[{modal:true},'modal'],[{immersive:true},'immersive'],[{cooperative:true},'cooperative'],[{reducedScene:true},'reduced-scene'],
 ];
 for(const [change,reason] of interruptions){
  const capture=new LocationPerformanceCapture(),state=context();
  assert.equal(capture.start(0,30,context(change)),false,reason+' cannot start');
  capture.start(0,30,state);capture.rendered(10,2,state);capture.rendered(20,2,context(change));
  assert.equal(capture.running,false);assert.equal(capture.result!.outcome,'interrupted');assert.equal(capture.result!.reason,reason);
  assert.equal(capture.result!.renderedFrames,1);assert.equal(capture.result!.frameIntervalsMs,null);
  capture.rendered(1000,2,state);assert.equal(capture.result!.renderedFrames,1,'Visible/resumed state does not auto-restart');
  assert.equal(capture.start(1010,30,state),true,'Explicit restart is permitted');
 }
});

test('orientation, framebuffer, motion and frame-cap changes cannot silently mix capture settings',()=>{
 for(const change of [{viewportWidth:720,viewportHeight:1280},{renderPixelRatio:1},{devicePixelRatio:1},{targetFrameCap:30},{reducedMotion:true}]){
  const capture=new LocationPerformanceCapture(),state=context();capture.start(0,30,state);capture.rendered(10,2,state);capture.rendered(20,2,context(change));
  assert.equal(capture.result!.reason,'settings-changed');assert.equal(capture.result!.renderedFrames,1);
 }
 const capture=new LocationPerformanceCapture();capture.start(0,30,context({locationState:'off'}));
 capture.rendered(10,2,context({locationState:'off'}));capture.rendered(20,2,context({locationState:'tracking'}));capture.rendered(30,2,context());capture.stop(40,context());
 assert.deepEqual(capture.result!.locationFrames,{off:1,tracking:1,follow:1},'GPS state changes are reported only as bounded aggregate labels');
});

test('sample storage is bounded even if a caller submits frames above the allowed game frame rate',()=>{
 const capture=new LocationPerformanceCapture(),state=context();capture.start(0,60,state);
 for(let i=1;i<=LOCATION_PERF_SAMPLE_LIMIT+1;i++)capture.rendered(i,1,state);
 const result=capture.result!;assert.equal(result.reason,'sample-limit');assert.equal(result.renderedFrames,LOCATION_PERF_SAMPLE_LIMIT);
 assert.equal(result.frameIntervalsMs!.count,LOCATION_PERF_SAMPLE_LIMIT-1);assert.equal(result.sceneRenderCpuMs!.count,LOCATION_PERF_SAMPLE_LIMIT);
 capture.clear();assert.equal(capture.result,undefined);assert.equal(capture.renderedFrames,0);
});

test('bad clocks and CPU values cannot corrupt timing aggregates',()=>{
 const capture=new LocationPerformanceCapture(),state=context();
 assert.equal(capture.start(NaN,30,state),false);assert.equal(capture.start(-1,30,state),false);
 assert.equal(capture.start(0,120 as 30,state),false);assert.equal(capture.start(0,30,context({viewportWidth:Infinity})),false);
 capture.start(0,30,state);capture.rendered(10,NaN,state);capture.rendered(20,-1,state);capture.rendered(30,undefined,state);capture.rendered(40,4,state);capture.rendered(35,5,state);
 const result=capture.result!;assert.equal(result.reason,'clock');assert.equal(result.renderedFrames,4);assert.equal(result.invalidCpuSamples,2);
 assert.equal(result.sceneRenderCpuMs!.count,1);assert.equal(result.frameIntervalsMs!.p99Ms,10);assert.equal(result.wallDurationMs,40);
 const duplicate=new LocationPerformanceCapture();duplicate.start(0,30,state);duplicate.rendered(10,1,state);duplicate.rendered(10,1,state);
 assert.equal(duplicate.result!.reason,'clock');assert.equal(duplicate.result!.renderedFrames,1);
});

test('reports whitelist aggregate fields and never retain caller extras, raw frames or absolute timestamps',()=>{
 const state={...context(),latitude:42,longitude:-83,x:1234,z:5678,headingDegrees:123,track:['PRIVATE-TRACK'],identifier:'PRIVATE-ID'};
 const capture=new LocationPerformanceCapture();capture.start(1_000_000,30,state);capture.rendered(1_000_010,2,state);capture.stop(1_000_020,state);
 const result=capture.result!,json=JSON.stringify(result);
 for(const key of ['"latitude":','"longitude":','"headingDegrees":','"identifier":','PRIVATE-TRACK','PRIVATE-ID','"x":','"z":','1000000'])assert.ok(!json.includes(key),key);
 assert.deepEqual(Object.keys(result.atStart).sort(),['locationState','reducedMotion','targetFrameCap','viewport']);
 assert.equal(Array.isArray(result.frameIntervalsMs),false);
 result.locationFrames.follow=900;result.atStart.viewport.width=99;
 assert.equal(capture.result!.locationFrames.follow,1);assert.equal(capture.result!.atStart.viewport.width,1280,'Returned reports cannot mutate capture state');
});

test('the main hook observes successful full-scene rendering independently of the located profiler',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 assert.match(main,/const renderEnd=performance\.now\(\);locationPerformance\?\.rendered\(renderEnd,renderEnd-locationRenderStart\)/);
 assert.match(main,/locationState:locationFollowing\?'follow':realLocation\?\.snapshot\.status\?\?'off'/);
 assert.match(main,/renderProbe\?\.beginFrame\(!!rideProfile\?\.enabled&&eligibleFrame&&!locationFollowing\)/,'The existing located profiling privacy gate stays intact');
 const setup=main.slice(main.indexOf('const locationPerformance=createLocationPerformancePanel'),main.indexOf('let profilePlace='));
 assert.doesNotMatch(setup,/\.fix|\.pose|camera\.|heading|latitude|longitude/,'The QA context never receives precise location data');
});
