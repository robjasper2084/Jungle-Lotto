import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createExteriorPlanner,partiallyCoalesceExteriorPath} from './staged-landmark-exterior-proof.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ground=points=>points.map(p=>({...p,height:2,walkable:true,planningClearance:2.25}));
const sweep=segment=>({...segment,length:distance(segment.from,segment.to),maxForward:segment.maxForward??0,bodyRadius:.27,bodyHeights:[.62,1.1,1.58],samples:[],clear:(segment.maxForward??0)===0||distance(segment.from,segment.to)<=3.4});
const shape={bounds:{min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera:{fov:60,aspect:1.6},layout:'desktop'};

for(const failingQuery of ['ground','sweep'])test(`a rejected partial shortcut survives a later ${failingQuery} query error without native authorization`,async()=>{
 const receipt={},failure=Error(`original ${failingQuery} query failed`),queryObservations=[];let partialSweeps=0,returnedRoute;
 // Only the test's original query callbacks are controlled. Detect the real
 // partial helper in the stack so the same failure is injected before/after
 // this repair, without replacing planner code or relying on new receipts.
 const inPartialQuery=()=>new Error().stack.includes('partiallyCoalesceExteriorPath');
 const observeQuery=()=>{const partial=receipt.plans[0].attempts.at(-1).partial;queryObservations.push({attached:!!partial,status:partial?.status,proposalStatus:partial?.proposals.at(-1)?.status,rejected:partial?.rejected.length});};
 const queryGround=points=>{
  if(inPartialQuery()){observeQuery();if(failingQuery==='ground'&&partialSweeps===1)throw failure;}
  return ground(points);
 };
 const querySweeps=segments=>segments.map(segment=>{
  if(inPartialQuery()){observeQuery();if(++partialSweeps===2&&failingQuery==='sweep')throw failure;}
  return sweep(segment);
 });
 const planner=await createExteriorPlanner({...shape,receipt,queryGround,querySweeps});
 await assert.rejects(async()=>{returnedRoute=await planner.route({x:-10,z:0},Math.PI/2);},error=>error===failure);
 assert.equal(returnedRoute,undefined,'A failed query must not return an authorized route');
 assert.equal(planner.receipt,receipt);assert.equal(receipt.plans.length,1);
 const plan=receipt.plans[0],attempt=plan.attempts.at(-1),partial=attempt.partial;
 assert.equal(plan.status,'failed');assert.equal(plan.selected,null);assert.equal(plan.error,String(failure));
 assert(partial,'The partial receipt must be attached before its first query');
 assert.equal(partial.status,'failed');assert.equal(partial.clear,false);assert.equal(partial.error,String(failure));
 assert(queryObservations.length>=3);assert(queryObservations.every(p=>p.attached&&p.status==='planning'&&p.proposalStatus==='querying'));
 assert.equal(queryObservations.at(-1).rejected,1,'The earlier rejection must already be visible when the failing query starts');
 assert.equal(partial.rejected.length,1);assert(partial.accepted.length>0);
 assert.equal(partial.proposals.filter(p=>p.status==='rejected').length,1);
 const pending=partial.proposals.at(-1);
 assert.equal(pending.status,'failed');assert.equal(pending.checkedLegs,null);assert.equal(pending.error,String(failure));
 assert.deepEqual(pending.from,partial.rejected[0].from);assert(pending.lastGridIndex<partial.rejected[0].lastGridIndex);
 const retained=receipt.rejectedProspectivePaths.filter(p=>p.kind==='partial-coalescing');
 assert.deepEqual(retained,partial.rejected.map(p=>({kind:'partial-coalescing',...p})));
 assert.equal(partial.rejected[0].leg.sweep.clear,false);
 assert.equal(partial.rejected[0].leg.sweep.maxLateral,1.96);assert.equal(partial.rejected[0].leg.sweep.maxForward,.75);
});

test('successful partial compression preserves the exact pinned result and query sequence',async()=>{
 const receipt={},queryLog=[],points=[...Array.from({length:7},(_,i)=>({x:.2+i*2,z:0})),...Array.from({length:4},(_,i)=>({x:12.2,z:(i+1)*2}))];
 const queries={
  queryGround:values=>{queryLog.push({kind:'ground',values:structuredClone(values)});return ground(values);},
  querySweeps:values=>{queryLog.push({kind:'sweeps',values:structuredClone(values)});return values.map(s=>({...s,length:distance(s.from,s.to),maxForward:s.maxForward??0,bodyRadius:.27,bodyHeights:[.62,1.1,1.58],samples:[],clear:distance(s.from,s.to)<=6}));},
 };
 const result=await partiallyCoalesceExteriorPath({x:0,z:0},points,queries,receipt);
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 // Independently recorded from exact 73bba helper Git blob
 // 43f39c112df68f5ca5c3fc2231bd550470fa8d86 before the receipt repair.
 assert.equal(hash(result),'8e3b74ec4ef3bff86803a397b7f67f4c559cb42f28bc5f7a9d20a4707494203a');
 assert.equal(hash(queryLog),'6a6749c442d53505f0250a45e85bf39b31ab750069138fb6ee5fc37de8880365');
 assert.deepEqual(result.waypoints,[points[0],points[2],points[4],points[6],points[8],points[10]]);
 assert.deepEqual(result.accepted[1].from,{x:0,z:0},'A sub-arrival waypoint must not move the nominal origin');
 assert.equal(result.checkedLegs,5);assert.equal(result.rejected.length,4);assert.deepEqual(result.end,{x:12.2,z:8});
 assert.equal(receipt.status,'passed');assert.equal(receipt.clear,true);assert.equal(receipt.error,null);
 assert.equal(receipt.accepted,result.accepted);assert.equal(receipt.rejected,result.rejected);assert.equal(receipt.waypoints,result.waypoints);
 assert.equal(receipt.proposals.length,result.accepted.length+result.rejected.length);
 assert(receipt.proposals.every(p=>['accepted','rejected'].includes(p.status)&&p.error===null));
});
