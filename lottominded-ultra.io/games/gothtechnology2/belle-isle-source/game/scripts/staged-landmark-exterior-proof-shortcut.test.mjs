import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FlightSolids} from '../src/belle/flightCollision.ts';
import {readStagedRouteGround,readStagedRouteSweeps} from '../src/belle/stagedLandmarkGroundFit.ts';
import {createExteriorShortcutBudget,prepareExteriorShortcut,prepareExteriorLegs,exteriorLegProposals} from './staged-landmark-exterior-proof.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

function fixture(solids=[],narrow=false){
 const loaded=new FlightSolids();for(const solid of solids)loaded.add(solid);
 const terrain={height:()=>2,land:()=>true,obstructed:()=>false,raycastObstacle:(...args)=>loaded.ray(...args)},requests=[];
 return{requests,queryGround:points=>readStagedRouteGround(terrain,points).map(p=>({...p,planningClearance:narrow?.7:p.planningClearance})),
 querySweeps:segments=>{requests.push(...structuredClone(segments));return readStagedRouteSweeps(terrain,segments);}};
}
const points=[{x:2,z:0},{x:2,z:2},{x:4,z:2},{x:4,z:4}];

test('phone shortcut gating preserves the complete original route, count and total allowance',async()=>{
 for(const layout of ['desktop','phone']){
  const route=Object.freeze({layout,originalWaypointCount:4,waypoints:Object.freeze(points.map(p=>Object.freeze({...p})))}),before=JSON.stringify(route),receipt={},queries=fixture();
  let actor={x:0,z:0};const legs=[];
  for await(const leg of exteriorLegProposals({route,label:layout,receipt,...queries,motion:async()=>({actor}),phase:async()=>{},replan:async()=>{throw Error('Unexpected replan');}})){
   legs.push(leg);actor=leg.goal;
  }
  assert.equal(JSON.stringify(route),before);assert.equal(receipt.originalWaypointCount,4);assert.equal(receipt.maximumLegs,320);assert.equal(receipt.maximumReplans,4);
  assert.equal(receipt.shortcutPlanning.enabled,layout==='phone');assert.equal(legs.length,layout==='phone'?1:4);
  assert.equal(receipt.shortcutPlanning.attempts,layout==='phone'?1:0);assert.deepEqual(actor,points.at(-1));
  assert(legs.every(l=>l.sweep.clear&&l.sweep.maxForward===.75&&l.sweep.bodyRadius===.27));
 }
});

test('an entire multi-leg direct path must finish validation before any waypoint can be skipped',async()=>{
 const base=fixture([],true),budget=createExteriorShortcutBudget(),waypoints=[{x:2,z:0},{x:4,z:0},{x:6,z:0},{x:8,z:0}];
 let release,entered,reads=0,resolved=false;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const queries={...base,querySweeps:async segments=>{reads++;if(reads===2){entered();await gate;}return base.querySweeps(segments);}};
 const pending=prepareExteriorShortcut({x:0,z:0},waypoints,0,queries,budget).then(value=>{resolved=true;return value;});
 await started;assert.equal(resolved,false);assert.equal(reads,2);release();
 assert.equal(await pending,3);assert.equal(reads,4);assert.equal(budget.checkedLegs,4);
 assert.equal(budget.trials[0].maximumLegs,4);assert.equal(budget.trials[0].clear,true);
 assert.equal(base.requests.at(-1).to.x,8);assert(base.requests.every(r=>r.maxForward===.75&&r.maxLateral===.41));
});

test('a real body obstruction rejects a shortcut while retaining the independently clear original waypoint',async()=>{
 const queries=fixture([{x:5,z:0,bottom:2,top:8,radius:.5,kind:'lamp'}]),budget=createExteriorShortcutBudget();
 const waypoints=[{x:.5,z:0},{x:10,z:0}],target=await prepareExteriorShortcut({x:0,z:0},waypoints,0,queries,budget);
 assert.equal(target,0);assert.equal(budget.trials.length,1);assert.equal(budget.trials[0].clear,false);
 const [direct]=queries.querySweeps([{from:{x:0,z:0},to:waypoints[1],maxLateral:.41,maxForward:.75}]);
 assert(direct.samples.some(s=>s.bodyHits.some(hit=>hit!==null&&hit<=s.acceptedBeyond)));
 const [original]=await prepareExteriorLegs([{from:{x:0,z:0},to:waypoints[0]}],queries);assert.equal(original.clear,true);assert.equal(original.sweep.maxForward,.75);
});

test('an insufficient complete-path reservation never queries or accepts a prefix; late rejection at the exact work cap cannot skip the suffix',async()=>{
 const waypoints=[{x:2,z:0},{x:4,z:0}],queries=fixture([],true),small=createExteriorShortcutBudget();small.checkedLegs=127;
 assert.equal(await prepareExteriorShortcut({x:0,z:0},waypoints,0,queries,small),0);assert.equal(queries.requests.length,0);assert.equal(small.attempts,0);assert.equal(small.checkedLegs,127);
 const capped=createExteriorShortcutBudget();capped.checkedLegs=126;let sweeps=0;
 const blockedSuffix={...queries,querySweeps:segments=>{const result=queries.querySweeps(segments);if(++sweeps===2)result[0].clear=false;return result;}};
 assert.equal(await prepareExteriorShortcut({x:0,z:0},waypoints,0,blockedSuffix,capped),0);assert.equal(sweeps,2);assert.equal(capped.checkedLegs,128);
 assert.equal(capped.trials[0].clear,false);assert.equal(capped.trials[0].legIndex,1);
 const count=queries.requests.length;assert.equal(await prepareExteriorShortcut({x:0,z:0},waypoints,0,queries,capped),0);assert.equal(queries.requests.length,count);
});

test('unrelated query failures and incomplete receipts propagate without a fallback or retry',async()=>{
 for(const mode of ['ground','sweep','incomplete','phase']){
  const base=fixture(),budget=createExteriorShortcutBudget(),error=new Error('retained '+mode+' failure');
  const queries={...base};if(mode==='ground')queries.queryGround=()=>{throw error;};
  if(mode==='sweep')queries.querySweeps=()=>{throw error;};if(mode==='incomplete')queries.queryGround=()=>[];
  if(mode==='phase')queries.beforeShortcutAttempt=()=>{throw error;};
  await assert.rejects(prepareExteriorShortcut({x:0,z:0},points,0,queries,budget),mode==='incomplete'?/Incomplete prospective ground/:value=>value===error);
  assert.equal(budget.attempts,1);assert.equal(budget.trials.length,1);assert(budget.trials[0].error);
 }
});

test('the same shortcut attempt budget survives all four actual-start replans and exhausted attempts use only the original fallback',async()=>{
 const route=Object.freeze({layout:'phone',originalWaypointCount:17,waypoints:Object.freeze(Array.from({length:17},(_,i)=>Object.freeze({x:(i+1)*2,z:0})))}),receipt={},original=JSON.stringify(route);
 let actor={x:0,z:0},replans=0;const budgetIdentities=[],attemptCounts=[],requests=[],queries=fixture();
 const querySweeps=segments=>{requests.push(...segments);return queries.querySweeps(segments).map((r,i)=>({...r,clear:segments[i].from.x<12&&distance(segments[i].from,segments[i].to)<=2.01}));};
 await assert.rejects(async()=>{for await(const leg of exteriorLegProposals({route,label:'bounded',receipt,queryGround:queries.queryGround,querySweeps,motion:async()=>({actor}),phase:async()=>{},
  replan:async()=>{replans++;budgetIdentities.push(receipt.shortcutPlanning);attemptCounts.push(receipt.shortcutPlanning.attempts);return{...route,waypoints:Array.from({length:17},(_,i)=>({x:14+i*2,z:0}))};}}))actor=leg.goal;},/replanning exceeded its bounded attempts/);
 assert.equal(replans,4);assert.equal(receipt.rejected.length,5);assert.equal(receipt.offeredLegs,6);assert.equal(receipt.maximumLegs,1360);assert.equal(receipt.maximumReplans,4);
 assert.equal(receipt.shortcutPlanning.attempts,32);assert.equal(receipt.shortcutPlanning.trials.length,32);assert.equal(receipt.shortcutPlanning.checkedLegs,32);
 assert.deepEqual(attemptCounts,[29,32,32,32]);assert(budgetIdentities.every(b=>b===receipt.shortcutPlanning));assert.equal(JSON.stringify(route),original);
 assert(receipt.rejected.every(r=>r.nativeWIssued===false));assert(requests.every(r=>r.maxForward===.75));
});

test('complete-path work reservations remain shared across all four replans without spending an unchecked suffix',async()=>{
 const route={layout:'phone',originalWaypointCount:17,waypoints:Array.from({length:17},(_,i)=>({x:(i+1)*2.8,z:0}))},receipt={},queries=fixture([],true);
 let shortcutPhase=false,replans=0;const workAtReplan=[],identities=[];
 const querySweeps=segments=>queries.querySweeps(segments).map((r,i)=>({...r,clear:shortcutPhase&&segments[i].from.x<45}));
 await assert.rejects(async()=>{for await(const leg of exteriorLegProposals({route,label:'work-budget',receipt,queryGround:queries.queryGround,querySweeps,motion:async()=>({actor:{x:0,z:0}}),
  phase:async name=>{shortcutPhase=name.includes('-shortcut-');},replan:async()=>{replans++;workAtReplan.push(receipt.shortcutPlanning.checkedLegs);identities.push(receipt.shortcutPlanning);return route;}}))assert.fail('A rejected actual leg must never be offered');},/replanning exceeded its bounded attempts/);
 assert.equal(replans,4);assert.equal(receipt.offeredLegs,0);assert.equal(receipt.maximumLegs,1360);assert.deepEqual(workAtReplan,[29,58,87,116]);
 assert.equal(receipt.shortcutPlanning.attempts,9);assert.equal(receipt.shortcutPlanning.checkedLegs,126);assert(identities.every(b=>b===receipt.shortcutPlanning));
 assert(receipt.shortcutPlanning.trials.every(t=>t.checkedLegs<=t.maximumLegs));assert.equal(receipt.shortcutPlanning.trials.at(-1).maximumLegs,11);
});

test('a consumer or native-input failure closes the iterator without another shortcut or replan',async()=>{
 const route={layout:'phone',waypoints:points},receipt={},queries=fixture(),error=new Error('actual native input failed');let replans=0,queriesAtFailure=0;
 await assert.rejects(async()=>{for await(const leg of exteriorLegProposals({route,label:'input',receipt,...queries,motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},replan:async()=>{replans++;throw Error('Unexpected retry');}})){
  assert(leg.sweep.clear);queriesAtFailure=queries.requests.length;throw error;
 }},value=>value===error);
 assert.equal(replans,0);assert.equal(receipt.offeredLegs,1);assert.equal(receipt.replans.length,0);assert.equal(queries.requests.length,queriesAtFailure);assert.equal(receipt.shortcutPlanning.attempts,1);
});

test('original preparation, shared64-search planner, heading/evidence gates, actual native executor and post-turn sweeps remain byte-identical',async()=>{
 const source=await readFile(new URL('./staged-landmark-exterior-proof.mjs',import.meta.url),'utf8');
 for(const [start,end,expected] of[
  ['export async function prepareExteriorLegs','/** Keep safe portions','9341de92082db241cbe4d243402c0f20bcc0d59556b8c1dd811fa6a5425156b7'],
  ['export async function createExteriorPlanner','function headingAllowance','b684e9c87f5875a7d3372d4c81120c1d0a83d1364fdd521d99a418747eadf479'],
  ['function headingAllowance','export async function runExteriorProof','85e9bb8308cc3310aaf00515ba01ef41934410a8069df5c3375248c2d4258e29'],
  [' async function walkRoute(',' async function aim(','d2ee497146d8ed35302876ef1ff0a5da2e42bc6ac31ba6cf51f4cc81862f3a5b'],
  [' async function aim(',' for(const [id,label,action]','369a713d28c0bc275ff3ec1137f8cf6bedefbbe09e37392399420eba5c2ca547'],
 ]){const from=source.indexOf(start),to=source.indexOf(end,from);assert(from>=0&&to>from);assert.equal(createHash('sha256').update(source.slice(from,to)).digest('hex'),expected,start);}
 assert(source.includes('originalWaypointCount<=route.waypoints.length'));assert(source.includes('maximumLegs:originalWaypointCount*80'));assert(source.includes('segment<80'));
});

test('the exact prototype keeps retained native geometry and quantifies only ideal-stop route benefit',async t=>{
 const retained=JSON.parse(await readFile(new URL('./staged-landmark-exterior-proof-shortcut-fixture.json',import.meta.url),'utf8'));
 assert.equal(retained.source,'c271634dd06ae76b1188fd1e9e9c32d19ba3b1fb');assert.equal(retained.reportSha256,'d4981b6b4a14892ad9d2ec649e9c742014bf0ae565beb5d25d66d788987b47e8');
 const {originalExteriorTerrain}=await import('./staged-landmark-original-solids.test-support.mjs');
 const map=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));
 const {terrain,solids,boulderCount}=await originalExteriorTerrain(map);assert.equal(solids.length,6043);assert.equal(boulderCount,90);
 const native=retained.nativeLeg;assert.deepEqual(readStagedRouteSweeps(terrain,[{from:native.before.actor,to:native.goal,maxLateral:native.maxLateral,maxForward:.75}])[0],native.sweep);
 for(const row of retained.cases){
  const results=[];
  for(const layout of ['desktop','phone']){
   const route={layout,waypoints:structuredClone(row.waypoints),originalWaypointCount:row.originalWaypointCount},before=JSON.stringify(route),receipt={},cost={groundCalls:0,groundPoints:0,sweepCalls:0,sweepSamples:0},legs=[],indices=[];let actor=structuredClone(row.from);
   const queryGround=points=>{cost.groundCalls++;cost.groundPoints+=points.length;return readStagedRouteGround(terrain,points);};
   const querySweeps=segments=>{cost.sweepCalls++;const swept=readStagedRouteSweeps(terrain,segments);cost.sweepSamples+=swept.reduce((n,s)=>n+s.samples.length,0);return swept;};
   const began=performance.now();
   for await(const leg of exteriorLegProposals({route,label:row.name,receipt,queryGround,querySweeps,motion:async()=>({actor}),phase:async()=>{},replan:async()=>{throw Error('Retained nominal route unexpectedly required a replan');}})){
    assert(leg.clear&&leg.sweep.clear);assert.equal(leg.sweep.maxForward,.75);assert.equal(leg.sweep.bodyRadius,.27);assert.deepEqual(leg.sweep.bodyHeights,[.62,1.1,1.58]);
    legs.push(leg);const index=Number(leg.name.match(/-walk-(\d+)-\d+$/)[1]);if(indices.at(-1)!==index)indices.push(index);actor=leg.goal;
   }
   assert.equal(JSON.stringify(route),before);assert.equal(receipt.maximumLegs,row.originalWaypointCount*80);assert(receipt.shortcutPlanning.attempts<=32&&receipt.shortcutPlanning.checkedLegs<=128);
   assert(distance(actor,row.waypoints.at(-1))<=.4);
   results.push({layout,offeredLegs:legs.length,visitedWaypoints:indices.length,walkDistanceM:legs.reduce((n,l)=>n+l.length,0),elapsedOfflineMs:performance.now()-began,cost,shortcutAttempts:receipt.shortcutPlanning.attempts,shortcutLegChecks:receipt.shortcutPlanning.checkedLegs,originalTotalAllowance:receipt.maximumLegs});
  }
  if(row.expectedBaselineLegs){assert.equal(results[0].offeredLegs,row.expectedBaselineLegs);assert.equal(results[1].offeredLegs,row.expectedCandidateLegs);assert.equal(results[0].visitedWaypoints,row.expectedBaselineWaypoints);assert.equal(results[1].visitedWaypoints,row.expectedCandidateWaypoints);}
  assert(results[1].offeredLegs<results[0].offeredLegs);assert(results[1].walkDistanceM<results[0].walkDistanceM);
  t.diagnostic(JSON.stringify({name:row.name,results,nativeSweepExact:true,nativeCompletionProven:false,model:'Ideal nominal stops; complete original terrain, body and stopping queries. Native coast/timing and257 viewpoints are not modeled.'}));
 }
});
