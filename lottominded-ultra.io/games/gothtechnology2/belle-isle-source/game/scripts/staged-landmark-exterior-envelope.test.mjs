import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareExteriorLegs,checkExteriorProspectivePath,exteriorLegProposals,createExteriorPlanner} from './staged-landmark-exterior-proof.mjs';

const fixtures=JSON.parse(await readFile(new URL('./staged-landmark-exterior-rejection-fixtures.json',import.meta.url),'utf8')).cases;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const close=(a,b)=>assert(distance(a,b)<1e-9);
const ground=clearance=>points=>points.map(p=>({...p,height:2,walkable:true,planningClearance:clearance}));
const sweep=(segment,clear=true)=>({...segment,length:distance(segment.from,segment.to),maxForward:segment.maxForward??0,bodyRadius:.27,bodyHeights:[.62,1.1,1.58],samples:[],clear});
const shape={bounds:{min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera:{fov:60,aspect:1.6},layout:'desktop'};

test('all four exact native rejection geometries keep their original body, lateral and stopping predicates',async()=>{
 assert.deepEqual(fixtures.map(r=>r.artifact),[15158802409,15159457667,15161590652,15161965049]);
 for(const row of fixtures){
  assert(['bf2fa1eaef4c529e8428f2ac1d0ac5a897a1e112','c7461c7c095cfb19ba8770b343952adb6eda5624'].includes(row.source));assert.deepEqual(row.nativeWEventsForFailedPhase,[]);
  assert(row.allSampleBodyHitsNull);assert(row.turn.finalErrorRadians<=row.turn.tolerance);assert.equal(row.turn.cadenceAllowanceUsed,false);
  let queries=0;
  const [leg]=await prepareExteriorLegs([{from:row.before,to:row.goal}],{
   // Replay only the actual archived leg. The earlier12m probe was not saved
   // when the old executor shortened a leg; never invent those missing rows.
   queryGround:points=>{assert.equal(points.length,row.ground.length);points.forEach((p,i)=>close(p,row.ground[i]));return structuredClone(row.ground);},
   querySweeps:segments=>segments.map(segment=>{queries++;close(segment.from,row.before);close(segment.to,row.goal);
    assert.equal(segment.maxLateral,row.maxLateral);assert.equal(segment.maxForward,.75);
    return{...row.sweep,samples:row.failureSamples};}),
  });
  assert.equal(queries,1);assert.equal(leg.clear,false);assert.equal(leg.reason,'original-stopping-corridor');assert.equal(leg.sweep.bodyRadius,.27);
  assert.deepEqual(leg.sweep.bodyHeights,[.62,1.1,1.58]);assert(leg.sweep.samples.every(s=>s.bodyHits.every(h=>h===null)));
 }
 const phone=fixtures.find(row=>row.artifact===15161590652);assert.equal(phone.failureSamples.length,2);
 assert(phone.failureSamples.every(s=>s.fromBeyondGoal>0&&s.corridorHitBeyondGoal.filter(x=>x!==null).every(x=>x>0&&x<.75)));
 assert.equal(fixtures.find(row=>row.artifact===15158802409).initialLongGroundNotArchived,true);
});

test('actual-start drift is checked before any leg is offered and retained across bounded replans',async()=>{
 const row=fixtures.find(row=>row.artifact===15161590652),[a,b]=row.plannedWaypoints;
 const cross=Math.abs((row.before.x-a.x)*(b.z-a.z)-(row.before.z-a.z)*(b.x-a.x))/distance(a,b);
 assert(Math.abs(cross-1.100557866)<1e-8);assert(cross>.41);
 const receipt={},phases=[];let replans=0,offered=0;
 const options={route:{waypoints:[row.waypoint]},label:row.phase,motion:async()=>({actor:{...row.before}}),phase:async name=>phases.push(name),
  queryGround:ground(.7),querySweeps:segments=>segments.map(segment=>{close(segment.from,row.before);close(segment.to,row.goal);return{...row.sweep,samples:row.failureSamples};}),
  replan:async actual=>{close(actual,row.before);replans++;return{waypoints:[row.waypoint]};},receipt};
 await assert.rejects(async()=>{for await(const proposal of exteriorLegProposals(options)){offered++;}},/bounded attempts/);
 assert.equal(offered,0);assert.equal(replans,4);assert.equal(receipt.replans.length,4);assert.equal(receipt.rejected.length,5);
 assert(receipt.rejected.every(r=>r.stage==='prospective'&&r.nativeWIssued===false));assert.equal(new Set(phases).size,phases.length);
 assert.equal(receipt.maximumLegs,80);assert.equal(receipt.offeredLegs,0);
});

test('connector checks keep the original test and independently reject an uncleared execution envelope',async()=>{
 const calls=[],receipt={};const planner=await createExteriorPlanner({...shape,receipt,queryGround:ground(2.25),querySweeps:segments=>segments.map(segment=>{calls.push(segment);return sweep(segment,(segment.maxForward??0)===0);})});
 await assert.rejects(planner.route({x:-5,z:0},Math.PI/2),/no walkable|No connected|could not pass/);
 assert(calls.some(c=>c.maxLateral===.41&&(c.maxForward??0)===0));
 assert(calls.some(c=>c.maxLateral===1.96&&c.maxForward===.75));
 assert.equal(planner.receipt,receipt);assert.equal(receipt.plans.length,1);assert.equal(receipt.plans[0].status,'failed');
 assert.match(receipt.plans[0].error,/no walkable/);assert(receipt.plans[0].connectors.length>0);
 assert(receipt.rejectedProspectivePaths.length>0&&receipt.rejectedProspectivePaths.every(row=>row.kind==='connector'&&row.leg.sweep.clear===false));
});

test('coalescing cannot inherit clear short-edge receipts; a validated uncoalesced route is retained',async()=>{
 const calls=[];const planner=await createExteriorPlanner({...shape,queryGround:ground(2.25),querySweeps:segments=>segments.map(segment=>{
  calls.push(segment);return sweep(segment,(segment.maxForward??0)===0||distance(segment.from,segment.to)<=3.4);
 })});
 const start={x:-10,z:0},route=await planner.route(start,Math.PI/2);
 assert.equal(route.prospective.clear,true);assert.equal(route.prospective.coalesced,false);
 assert(route.originalWaypointCount<route.waypoints.length,'Uncoalescing must not increase the original total leg allowance');
 assert(route.rejectedProspectivePaths.some(row=>row.kind==='coalesced'&&row.leg.length>3.4));
 let previous=start;for(const waypoint of route.waypoints){assert(distance(previous,waypoint)<=3.4);previous=waypoint;}
 assert(calls.some(row=>row.maxForward===.75&&row.maxLateral===1.96&&distance(row.from,row.to)>3.4));
 assert((await checkExteriorProspectivePath(start,route.waypoints,{queryGround:ground(2.25),querySweeps:segments=>segments.map(segment=>sweep(segment,distance(segment.from,segment.to)<=3.4))})).clear);
 assert.equal(planner.receipt.plans[0].status,'passed');assert.equal(planner.receipt.plans[0].selected.coalesced,false);
 assert(planner.receipt.plans[0].attempts.some(path=>path.coalesced?.clear===false&&path.uncoalesced?.clear===true));
});

test('a failed actual-start replacement preserves the original query error and all rejected receipts',async()=>{
 const receipt={},failure=Error('original native sweep query failed');let offered=0;
 await assert.rejects(async()=>{for await(const proposal of exteriorLegProposals({route:{waypoints:[{x:10,z:0}]},label:'failed-plan',
  motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},queryGround:ground(2.25),querySweeps:segments=>segments.map(s=>sweep(s,false)),
  replan:async()=>{throw failure;},receipt})){offered++;}},error=>error===failure);
 assert.equal(offered,0);assert.equal(receipt.rejected.length,1);assert.equal(receipt.rejected[0].nativeWIssued,false);
 assert.equal(receipt.replans.length,1);assert.equal(receipt.replans[0].route,null);assert.equal(receipt.replans[0].error,String(failure));
});

test('route replacement does not reset the original total leg allowance',async()=>{
 let actor={x:0,z:0},calls=0,replans=0;const receipt={},names=[];
 const options={route:{waypoints:[{x:200,z:0}]},label:'budget',motion:async()=>({actor:{...actor}}),phase:async()=>{},queryGround:ground(2.25),
  querySweeps:segments=>segments.map(segment=>sweep(segment,++calls!==1)),
  replan:async()=>{replans++;return{waypoints:Array.from({length:100},(_,i)=>({x:i+1,z:0}))};},receipt};
 await assert.rejects(async()=>{for await(const proposal of exteriorLegProposals(options)){names.push(proposal.name);actor=proposal.goal;}},/original total leg allowance/);
 assert.equal(replans,1);assert.equal(receipt.maximumLegs,80);assert.equal(names.length,80);assert.equal(new Set(names).size,80);
});

test('the original 80-leg per-waypoint bound also remains binding',async()=>{
 const receipt={};let offered=0;
 await assert.rejects(async()=>{for await(const proposal of exteriorLegProposals({route:{waypoints:[{x:100,z:0},{x:110,z:0}]},label:'waypoint',
  motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},queryGround:ground(2.25),querySweeps:segments=>segments.map(s=>sweep(s)),replan:async()=>{throw Error('Unexpected replan');},receipt})){offered++;}},/bounded leg count/);
 assert.equal(offered,80);assert.equal(receipt.maximumLegs,160);assert.equal(receipt.replans.length,0);
});

test('a post-keydown consumer failure preserves its exact error and cannot request another plan',async()=>{
 const nativeError=Error('recorded native movement failure'),receipt={};let presses=0,replans=0;
 await assert.rejects(async()=>{for await(const proposal of exteriorLegProposals({route:{waypoints:[{x:10,z:0}]},label:'movement',
  motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},queryGround:ground(2.25),querySweeps:segments=>segments.map(s=>sweep(s)),
  replan:async()=>{replans++;return{waypoints:[{x:1,z:0}]};},receipt})){presses++;throw nativeError;}},error=>error===nativeError);
 assert.equal(presses,1);assert.equal(replans,0);assert.equal(receipt.offeredLegs,1);assert.deepEqual(receipt.rejected,[]);
});

// Exercise the actual nested executor, supplying only its external operations.
// This avoids running a browser or duplicating its movement/error implementation.
async function executor({postTurnBlocked=false,movementError=null,settleError=null,archived=null}={}){
 const source=await readFile(new URL('./staged-landmark-exterior-proof.mjs',import.meta.url),'utf8');
 const body=source.slice(source.indexOf(' async function walkRoute('),source.indexOf(' async function aim('));assert(body.startsWith(' async function walkRoute('));
 const report={exteriorProspectiveRoutes:[],exteriorTurns:[],exteriorLegs:[]},inputs=[];let sweepQueries=0,replans=0,frame=1;
 const actor=archived?{...archived.before}:{x:0,z:0,headingY:Math.PI/2,onFoot:true,firstPerson:true},motion=async()=>({frames:frame++,actor:{...actor}});
 const deps={assert,angle:x=>Math.atan2(Math.sin(x),Math.cos(x)),distance,exteriorLegProposals,report,motion,phase:async()=>{},
  queryGround:archived?points=>{assert.equal(points.length,archived.ground.length);points.forEach((p,i)=>close(p,archived.ground[i]));return structuredClone(archived.ground);}:ground(2.25),
  querySweeps:segments=>segments.map(segment=>{if(archived){close(segment.from,archived.before);close(segment.to,archived.goal);assert.equal(segment.maxLateral,archived.maxLateral);assert.equal(segment.maxForward,.75);return structuredClone(archived.sweep);}return sweep(segment,!(postTurnBlocked&&++sweepQueries===2));}),
  turnExteriorHeading:async({receipt,name})=>{inputs.push('turn');Object.assign(receipt,{name,complete:true,before:await motion(),after:await motion()});},
  setFirstPerson:async()=>{},focusCanvas:async()=>{},pulse:async()=>{},settleHeading:async()=>{},
  keyDown:async key=>inputs.push('down:'+key),keyUp:async key=>inputs.push('up:'+key),
  waitMotion:async()=>{if(movementError)throw movementError;},settle:async()=>{if(settleError)throw settleError;},trace:async()=>[]};
 const walk=Function(...Object.keys(deps),'return '+body)(...Object.values(deps));
 let error;try{await walk({waypoints:[archived?archived.goal:{x:10,z:0}]},'executor',async()=>{replans++;if(archived)throw Error('No unobserved native detour is assumed');return{waypoints:[{x:1,z:0}]};});}catch(value){error=value;}
 return{report,inputs,replans,error};
}

test('the final post-turn sweep still fails before W and preserves both real attempt receipts',async()=>{
 const result=await executor({postTurnBlocked:true});assert.match(String(result.error),/actual exterior leg or stopping corridor/);
 assert.deepEqual(result.inputs,['turn']);assert.equal(result.replans,0);
 assert.equal(result.report.exteriorTurns.length,1);assert.equal(result.report.exteriorLegs.length,1);
 assert.equal(result.report.exteriorLegs[0].after,null);assert.equal(result.report.exteriorLegs[0].sweep.clear,false);
 const rejected=result.report.exteriorProspectiveRoutes[0].rejected;assert.equal(rejected.length,1);
 assert.equal(rejected[0].stage,'post-turn');assert.equal(rejected[0].nativeWIssued,false);assert.equal(rejected[0].turn,result.report.exteriorTurns[0]);
});

test('all four archived failing envelopes are rejected before turning or W without assuming an unobserved detour',async()=>{
 for(const archived of fixtures){
  const result=await executor({archived});assert.match(String(result.error),/No unobserved native detour/);assert.deepEqual(result.inputs,[]);
  assert.equal(result.report.exteriorTurns.length,0);assert.equal(result.report.exteriorLegs.length,0);assert.equal(result.replans,1);
  const receipt=result.report.exteriorProspectiveRoutes[0];assert.equal(receipt.rejected.length,1);assert.equal(receipt.rejected[0].nativeWIssued,false);
  assert.deepEqual(receipt.rejected[0].proposal.sweep,archived.sweep);assert.match(receipt.replans[0].error,/No unobserved native detour/);
 }
});

test('the actual executor releases W and rethrows the original movement failure without replanning',async()=>{
 const nativeError=Error('native waitMotion failure'),result=await executor({movementError:nativeError});
 assert.equal(result.error,nativeError);assert.deepEqual(result.inputs,['turn','down:w','up:w']);assert.equal(result.replans,0);
 assert.equal(result.report.exteriorTurns.length,1);assert.equal(result.report.exteriorLegs.length,1);
 assert.deepEqual(result.report.exteriorProspectiveRoutes[0].rejected,[],'A post-W failure must not be relabelled as a prospective planning rejection');
 assert.equal(result.report.exteriorLegs[0].movementError,String(nativeError));
});

test('a later settle failure cannot erase the earlier native movement error from the receipt',async()=>{
 const movementError=Error('original movement failure'),settleError=Error('original settle failure');
 const result=await executor({movementError,settleError});assert.equal(result.error,settleError);assert.deepEqual(result.inputs,['turn','down:w','up:w']);assert.equal(result.replans,0);
 assert.equal(result.report.exteriorLegs[0].movementError,String(movementError));assert.equal(result.report.exteriorLegs[0].settleError,String(settleError));
});
