import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ROUTE_START,FULL_ROUTE_GATES} from './fullRoute.ts';
import {PRACTICE_LINES,dailyChallenge} from './replayRules.ts';
import {CHALLENGES,DistrictRun,photoAllowed,readRecords,recordRun,MACK_FINISH,type Observation} from './district.ts';
const observation=(station:number,extra:Partial<Observation>={}):Observation=>({station,offset:0,speed:5,grounded:true,crashed:false,roll:0,slip:0,traction:.2,airHeight:0,...extra});
function finishStyle(run:DistrictRun){run.gateCount=0;for(let d=run.challenge.start;d<=run.challenge.end;d+=.05)run.step(.01,observation(d));run.step(.01,observation(run.challenge.end+.02));}
function finishTrial(run:DistrictRun){for(let d=run.challenge.start;d<=run.challenge.end;d+=.05)run.step(.01,observation(d));run.step(.01,observation(run.challenge.end+.02));}
test('five district challenges fit the existing Cut and end at Mack Avenue',()=>{assert.equal(CHALLENGES.length,5);assert.equal(CHALLENGES.filter(c=>c.kind==='trial').length,2);assert.equal(CHALLENGES.filter(c=>c.kind==='style').length,2);for(const c of CHALLENGES){assert.ok(c.start===ROUTE_START&&c.end===MACK_FINISH);assert.ok(c.end>c.start);}});
test('time trial only counts ordered forward crossings inside gate posts',()=>{
 const run=new DistrictRun(CHALLENGES[0]);run.step(.1,observation(37));run.step(.1,observation(39,{offset:2.9}));assert.equal(run.count,1,'interpolated gate crossing is inside posts');
 const wrong=new DistrictRun(CHALLENGES[0]);wrong.step(.1,observation(39));wrong.step(.1,observation(37));assert.equal(wrong.count,0);
 const outside=new DistrictRun(CHALLENGES[0]);outside.step(.1,observation(37,{offset:2}));outside.step(.1,observation(39,{offset:2}));assert.equal(outside.count,0);
 const skip=new DistrictRun(CHALLENGES[0]);skip.step(.1,observation(37));skip.step(.1,observation(91));assert.equal(skip.count,0);assert.equal(skip.failed,false);assert.match(skip.reason,/Missed a gate/);
});
test('pause does not advance time and complete time trials earn a persistent best',()=>{const r=new DistrictRun(CHALLENGES[0]);r.step(0,observation(39));assert.equal(r.elapsed,0);assert.equal(r.count,0);finishTrial(r);assert.ok(r.done);const records={};assert.equal(recordRun(records,r),true);const loaded=readRecords(JSON.stringify(records));assert.equal(loaded[r.challenge.id].completions,1);assert.equal(recordRun(loaded,r),false);assert.equal(loaded[r.challenge.id].completions,2);});
test('a fall adds one penalty and recovery continues the same full-route challenge',()=>{const r=new DistrictRun(CHALLENGES[0]);r.step(.1,observation(ROUTE_START,{crashed:true}));r.step(.1,observation(ROUTE_START,{crashed:true}));assert.ok(Math.abs(r.elapsed-5.2)<1e-8);assert.equal(r.failed,false);assert.equal(recordRun({},r),false);r.step(.1,observation(ROUTE_START,{recovered:true}));assert.ok(r.elapsed<5.4);finishTrial(r);assert.ok(r.done);assert.equal(recordRun({},r),true);});
test('main, daily and practice objectives never finish before the last route gate',()=>{for(const c of [...CHALLENGES,...PRACTICE_LINES,dailyChallenge(new Date('2026-09-16'))]){assert.equal(c.start,ROUTE_START);assert.deepEqual(c.gates,FULL_ROUTE_GATES);const run=new DistrictRun(c);for(const d of [c.start,30,900,1800,2120,2391]){run.step(.1,observation(d));assert.equal(run.done,false);assert.equal(run.failed,false);}}});
test('carving requires alternating supported lean, forward travel and control',()=>{
 const r=new DistrictRun(CHALLENGES[2]);let d=r.challenge.start;
 const carve=(sign:number,n=90,extra:Partial<Observation>={})=>{for(let i=0;i<n;i++){d+=.04;r.step(1/120,observation(d,{roll:.12*sign,...extra}));}};
 carve(1,120,{speed:0});assert.equal(r.count,0);carve(1,100,{traction:1});assert.equal(r.count,0);carve(1);assert.equal(r.count,1);carve(1);assert.equal(r.count,1);carve(-1);carve(1);carve(-1);assert.equal(r.done,false);finishStyle(r);assert.ok(r.done);assert.equal(r.score,500);assert.equal(r.medal,3);
});
test('landing reward needs airborne height, a clean touchdown and a stable settle',()=>{
 const r=new DistrictRun({...CHALLENGES[3],gates:[MACK_FINISH]});let d=r.challenge.start;
 const hop=(quality='charged',distance=12)=>{d+=distance;r.step(.1,observation(d,{grounded:false,airHeight:.3}));r.step(.01,observation(d+.1,{landing:quality,hopCharge:.9}));for(let i=0;i<75;i++)r.step(1/120,observation(d+.1+i*.03));};
 r.step(.1,observation(d,{landing:'charged',hopCharge:1}));assert.equal(r.count,0);hop('heavy');assert.equal(r.count,0);hop();assert.equal(r.count,1);hop('clean',2);assert.equal(r.count,1);hop();hop();assert.equal(r.count,3);assert.equal(r.done,false);finishStyle(r);assert.ok(r.done);assert.equal(r.medal,3);
});
test('falling during settle cancels clean landing rewards',()=>{const r=new DistrictRun(CHALLENGES[3]);r.step(.1,observation(1920,{grounded:false,airHeight:.4}));r.step(.1,observation(1921,{landing:'clean'}));r.step(.1,observation(1922,{crashed:true}));assert.equal(r.count,0);assert.equal(r.failed,false);});
test('photos require a stopped rider, correct framing, range and visibility, with unique subjects',()=>{
 const good={distance:12,speed:0,inFrame:true,unobstructed:true};for(const invalid of [{speed:2},{distance:90},{distance:1},{inFrame:false},{unobstructed:false}])assert.equal(photoAllowed({...good,...invalid}),false);
 const r=new DistrictRun(CHALLENGES[4]);assert.equal(r.capture('unrelated',good),false);r.capture('gateway',good);r.capture('gateway',good);assert.equal(r.count,1);r.capture('mural',good);r.capture('freight',good);assert.equal(r.done,false);finishStyle(r);assert.ok(r.done);assert.equal(r.medal,3);
});
test('malformed or obsolete personal records do not break the board',()=>{for(const raw of ['bad','null','[]','{"gratiot-dash":{"value":-4,"medal":9,"completions":0}}'])assert.deepEqual(readRecords(raw),{});});
