/** Observation-only regression for the actual native walk driver. The controller
 * experiment is offline: numeric timer/frame phase and keyup latency are explicit
 * assumptions, never a claim of native completion or a reason to relax gates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {RideCore} from '../runtime/ride-core/src/ridecore.ts';
import {originalExteriorTerrain} from './staged-landmark-original-solids.test-support.mjs';
import {readStagedRouteSweeps} from '../src/belle/stagedLandmarkGroundFit.ts';

const source=await readFile(new URL('./staged-landmark-walk-proof.mjs',import.meta.url),'utf8');
const begin=source.indexOf(' async function waitMotion('),end=source.indexOf('\n const frames=',begin);
assert(begin>=0&&end>begin,'The actual driver observer must be present');
const definition=source.slice(begin,end).trim();
const beforeDefinition=definition.replace("polling:rule.type==='world-target'?16:100",'polling:100');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fixtureBytes=await readFile(new URL('./staged-landmark-exterior-proof-cadence-fixture.json',import.meta.url));
const fixture=JSON.parse(fixtureBytes);
const worldRule={type:'world-target',x:0,z:0,dx:1,dz:0,length:1,maxLateral:.41};
const makeRow=(frames=1,x=0,z=0)=>({frames,time:frames/60,actor:{x,y:2,z,onFoot:true,headingY:Math.PI/2,footBlend:1},sites:[]});

function observer({row=makeRow(),now=0,started=0,caseMs=1_920_000,waitError=null,jsonError=null,budgetError=null}={}){
 const state={row,callback:null,args:null,options:null,waitCalls:0,disposed:0,jsonReads:0};
 const evidence={traces:{},overflow:false};
 const context={window:{__stagedLandmarkProof:{frame:()=>state.row.frames,motion:()=>state.row},__stagedWalkNativeEvidence:evidence},
  Date:{now:()=>now},started,CASE_MS:caseMs,report:{phase:'observed-native-walk'},checkBudget:()=>{if(budgetError)throw budgetError;},
  page:{waitForFunction:async(callback,args,options)=>{state.waitCalls++;Object.assign(state,{callback,args,options});if(waitError)throw waitError;
   return{jsonValue:async()=>{state.jsonReads++;if(jsonError)throw jsonError;return state.row;},dispose:async()=>{state.disposed++;}};}}};
 return{state,evidence,wait:vm.runInNewContext('('+definition+')',context),predicate:()=>state.callback(state.args)};
}

test('cadence changes only world-target observation and keeps the original case/leg deadline intersection',async()=>{
 assert.equal(hash(beforeDefinition),'34a3649faa7fb8a8dafbf8d749084fff01de5ca28cd5f6c35c02b624e2c61ade');
 const candidate=observer({now:1_919_792});await candidate.wait(worldRule,90_000);
 assert.equal(candidate.state.options.polling,16);assert.equal(candidate.state.options.timeout,208);
 assert.equal(candidate.state.disposed,1);assert.equal(candidate.state.jsonReads,1);
 for(const type of ['frames','on-foot','target','turn','settled','heading-settled','contact']){
  const other=observer({now:1_000});await other.wait({type},90_000);
  assert.equal(other.state.options.polling,100,type+' must retain its original numeric cadence');assert.equal(other.state.options.timeout,90_000);
 }
});

test('actual world-target predicate retains lateral rejection, frame deduplication and the 4096-row failure',async()=>{
 const h=observer();await h.wait(worldRule,90_000);
 for(let i=0;i<100;i++)assert.equal(h.predicate(),false);
 assert.equal(h.evidence.traces['observed-native-walk'].length,1,'Repeated timer reads must not invent render frames');
 h.state.row=makeRow(2,.5,.411);assert.throws(()=>h.predicate(),/departed its observed route corridor/);
 h.state.row=makeRow(3,.5,0);h.evidence.traces['observed-native-walk']=Array.from({length:4096},(_,i)=>makeRow(i+4));
 assert.throws(()=>h.predicate(),/Movement trace overflow/);assert.equal(h.evidence.overflow,true);
});

test('nonadvancing frames keep numeric polling while original timeout failures and handle cleanup propagate',async()=>{
 const timeout=new Error('original numeric timeout'),timed=observer({waitError:timeout});
 await assert.rejects(timed.wait(worldRule,90_000),error=>error===timeout);assert.equal(timed.state.options.polling,16);assert.equal(timed.state.disposed,0);
 const readError=new Error('original handle read failure'),badHandle=observer({jsonError:readError});
 await assert.rejects(badHandle.wait(worldRule,90_000),error=>error===readError);assert.equal(badHandle.state.disposed,1);
 const budget=new Error('original case expired'),expired=observer({budgetError:budget});
 await assert.rejects(expired.wait(worldRule,90_000),error=>error===budget);assert.equal(expired.state.waitCalls,0);
});

const map=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));
let originalPromise;
const original=()=>originalPromise??=originalExteriorTerrain(map);

test('retained native reversal fixture reconstructs both complete original body and stopping sweeps exactly',async()=>{
 assert.equal(hash(fixtureBytes),'f2809fb43a7671fb1c029efb2373aeee0ce813acac707b2c82eb2ecc1455d6b6');
 assert.equal(fixture.source,'59c03bfff92f82f777ede52f3dfdfcbb6e7fa5d7');
 assert.equal(fixture.reportSha256,'bf4210b607f5dc9452db6c382546e0bd7a1ac4a5a3271136f3f29346e32c114a');
 const {terrain,solids,boulderCount}=await original();assert.equal(solids.length,6043);assert.equal(boulderCount,90);
 assert.deepEqual(fixture.firstLeg.goal,fixture.reverseCorrection.goal);
 assert(Math.hypot(fixture.firstLeg.after.actor.x-fixture.firstLeg.goal.x,fixture.firstLeg.after.actor.z-fixture.firstLeg.goal.z)>.4);
 for(const leg of[fixture.firstLeg,fixture.reverseCorrection]){
  const actual=readStagedRouteSweeps(terrain,[{from:leg.before.actor,to:leg.goal,maxLateral:leg.maxLateral,maxForward:.75}])[0];
  assert.deepEqual(actual,leg.sweep);assert.equal(actual.clear,true);assert.equal(actual.bodyRadius,.27);assert.deepEqual(actual.bodyHeights,[.62,1.1,1.58]);
 }
});

async function simulatedFirstReversal(observerDefinition){
 const {terrain}=await original(),first=fixture.firstLeg,p=first.before.actor,heading=p.headingY;
 // Invert the original 0.68m dismount offset, then use the untouched controller's
 // actual constructor/dismount. No pose, speed or simulation internals are set.
 const core=new RideCore(terrain,{spawn:{position:{x:p.x-Math.cos(heading)*.68,y:p.y,z:p.z+Math.sin(heading)*.68},headingY:heading}});
 core.advance(1/120,{dismount:true});for(let i=0;i<240;i++)core.advance(1/120,{});
 assert.equal(core.current.footMode,2);assert(Math.hypot(core.renderPose.x-p.x,core.renderPose.z-p.z)<1e-9);
 let frames=1,clock=0,nextFrame=0,held=true,row={frames,time:0,actor:{...core.renderPose,onFoot:true},sites:[]};
 const samples=[row],dt=1000/30;
 const advance=target=>{while(nextFrame<=target+1e-9){core.advance(Math.min(dt/1000,.05),{throttle:held?1:0,facingYaw:heading});row={frames:++frames,time:nextFrame/1000,actor:{...core.renderPose,onFoot:true},sites:[]};samples.push(row);nextFrame+=dt;}clock=target;};
 const evidence={traces:{}},context={window:{__stagedLandmarkProof:{frame:()=>frames,motion:()=>row},__stagedWalkNativeEvidence:evidence},
  Date:{now:()=>clock},CASE_MS:1_920_000,started:0,report:{phase:'model-native-leg'},checkBudget:()=>{},
  page:{waitForFunction:async(callback,args,options)=>{
   assert.equal(options.timeout,90_000);assert.equal(typeof options.polling,'number');let result=callback(args);
   // 30Hz frames, a 66ms observer phase and 50ms native-release latency are
   // explicit test assumptions. Equal-time frames execute before timer reads.
   for(let next=66;!result&&next<options.timeout;next+=options.polling){advance(next);result=callback(args);}
   assert(result,'The unchanged leg deadline must fail a blocked observer');return{jsonValue:async()=>result,dispose:async()=>{}};
  }}};
 const wait=vm.runInNewContext('('+observerDefinition+')',context),length=Math.hypot(first.goal.x-p.x,first.goal.z-p.z),dx=(first.goal.x-p.x)/length,dz=(first.goal.z-p.z)/length;
 const rule={type:'world-target',x:p.x,z:p.z,dx,dz,length,maxLateral:first.maxLateral};
 const stop=await wait(rule,90_000),observedAt=clock;
 // Model the same release latency and original controller coast for both.
 advance(clock+50);held=false;advance(clock+1500);
 for(const sample of samples){const x=sample.actor.x-p.x,z=sample.actor.z-p.z;
  assert(Math.abs(x*dz-z*dx)<=first.maxLateral,'The original route corridor stays binding');
  assert(x*dx+z*dz<=length+.75,'The original swept stopping envelope stays binding');assert.equal(sample.actor.onFoot,true);
 }
 assert(row.frames>4&&Math.hypot(row.actor.x-p.x,row.actor.z-p.z)>.15,'The original genuine-movement requirement stays binding');
 return{arrivalDistance:Math.hypot(row.actor.x-first.goal.x,row.actor.z-first.goal.z),observedAt,stopPosition:{x:stop.actor.x,z:stop.actor.z},samples:samples.length};
}

test('actual source controller stops inside the unchanged waypoint radius before the retained reverse correction',async()=>{
 const baseline=await simulatedFirstReversal(beforeDefinition),candidate=await simulatedFirstReversal(definition);
 assert(baseline.arrivalDistance>.4,'The retained 100ms observer must fail this negative control');
 assert(candidate.arrivalDistance<=.4,'The candidate must meet the original 0.4m arrival radius');
 assert(candidate.observedAt<baseline.observedAt,'The correction must observe arrival earlier under the same source/controller assumptions');
 console.log(JSON.stringify({cadenceRegression:'original-source-controller',baseline,candidate,nativeCompletionProven:false}));
});
