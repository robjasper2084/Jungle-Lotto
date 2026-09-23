import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Recorder,readRecording,replayPose,FlowCombo,dailyChallenge,medalStars,PRACTICE_LINES} from './replayRules.ts';
import {createPose} from './controller.ts';
import {DistrictRun,readRecords} from './district.ts';

test('personal ghosts interpolate pose and heading across wrap, and reject other riders / routes',()=>{
 const record=new Recorder(),p=createPose();p.headingY=Math.PI-.1;record.push(0,p);p.x=10;p.headingY=-Math.PI+.1;record.push(1,p,true);
 const r=record.finish('man','gratiot-dash',1),loaded=readRecording(JSON.stringify(r),'man','gratiot-dash');assert.ok(loaded);const mid=replayPose(loaded,.5);assert.equal(mid.x,5);assert.ok(Math.abs(Math.abs(mid.headingY)-Math.PI)<.001);
 assert.equal(readRecording(JSON.stringify(r),'woman','gratiot-dash'),undefined);assert.equal(readRecording(JSON.stringify(r),'man','daily-2026-09-16'),undefined);
 for(const frames of [[],[[0,NaN]],r.frames.slice().reverse()])assert.equal(readRecording(JSON.stringify({...r,frames}),'man','gratiot-dash'),undefined);
});
test('recording is bounded at ten samples per second and never grows indefinitely',()=>{const r=new Recorder(),p=createPose();for(let i=0;i<120*1000;i++)r.push(i/120,p);assert.ok(r.frames.length<=9001);assert.ok(r.frames.length>=8900);});
test('flow needs controlled travel, alternating carves and diverse moves; crashes lose unbanked points',()=>{
 const flow=new FlowCombo(),p=createPose();p.speed=5;p.tractionUsage=.2;p.rollAngle=.2;
 for(let i=0;i<85;i++)flow.step(1/120,p,true);assert.equal(flow.events,1);const first=flow.pending;
 for(let i=0;i<120;i++)flow.step(1/120,p,true);assert.equal(flow.events,1,'same held carve cannot farm points');
 p.rollAngle=-.2;for(let i=0;i<90;i++)flow.step(1/120,p,true);assert.equal(flow.events,2);assert.equal(flow.multiplier,1.5);assert.ok(flow.pending>first);
 p.crashBlend=1;flow.step(.01,p,true);assert.equal(flow.pending,0);assert.equal(flow.banked,0);assert.ok(flow.lost);
});
test('flow rewards a clean settled hop, not fake landings or paused simulation',()=>{
 const f=new FlowCombo(),p=createPose();p.speed=4;f.step(.01,p,true,'clean');assert.equal(f.events,0);
 p.airHeight=.4;f.step(.1,p,false);p.airHeight=0;f.step(.01,p,true,'clean');for(let i=0;i<75;i++)f.step(1/120,p,true);assert.equal(f.last,'Clean hop');const value=f.pending;
 f.step(0,p,true);assert.equal(f.pending,value);for(let i=0;i<610;i++)f.step(1/120,p,true);assert.equal(f.banked,value);assert.equal(f.pending,0);
});
test('daily route is stable for all clients on a UTC day and has a separate record',()=>{
 const a=dailyChallenge(new Date('2026-09-16T00:01:00Z')),b=dailyChallenge(new Date('2026-09-16T23:59:59Z'));assert.deepEqual(a,b);assert.notEqual(a.id,dailyChallenge(new Date('2026-09-17')).id);
 const records=readRecords(JSON.stringify({[a.id]:{value:30,medal:2,completions:1},'practice-tight':{value:20,medal:3,completions:1}}));assert.equal(records[a.id].value,30);assert.equal(medalStars(records),0,'daily medals cannot inflate district unlocks');
});
test('technical gates require the authored offset and width',()=>{
 const c=PRACTICE_LINES[1],o=(station:number,offset:number)=>({station,offset,speed:4,grounded:true,crashed:false,roll:0,slip:0,traction:.2,airHeight:0});const miss=new DistrictRun(c);miss.step(.01,o(c.gates[0]-.1,1));miss.step(.01,o(c.gates[0]+.1,1));assert.equal(miss.count,0);
 const hit=new DistrictRun(c);hit.step(.01,o(c.gates[0]-.1,-.8));hit.step(.01,o(c.gates[0]+.1,-.8));assert.equal(hit.count,1);
});
