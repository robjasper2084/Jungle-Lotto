import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ParkTerrain} from '../src/belle/terrain.ts';
import {STUDY_SITES} from '../src/belle/stagedLandmarkStudies.ts';
import {readStagedExterior,readStagedRouteGround,readStagedRouteSweeps} from '../src/belle/stagedLandmarkGroundFit.ts';
import {FlightSolids} from '../src/belle/flightCollision.ts';
import {RideCore} from '../runtime/ride-core/src/ridecore.ts';
import {createExteriorPlanner,assertExteriorEvidence,turnExteriorHeading,checkExteriorProspectivePath,partiallyCoalesceExteriorPath,prepareExteriorLegs,exteriorLegProposals} from './staged-landmark-exterior-proof.mjs';

const map=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map),root=new T.Group();
for(const spec of STUDY_SITES){
 const raw=await readFile(new URL('../public/belle/staged-architecture/'+spec.files[0],import.meta.url)),{scene}=await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer,'');
 const lod=new T.LOD();lod.name=spec.id+'_STAGED_LODS';lod.position.set(spec.center[0],2,spec.center[1]);lod.rotation.y=spec.yaw;lod.addLevel(scene,0);root.add(lod);
}
root.updateMatrixWorld(true);
const world=(cfg,u,v)=>({x:cfg.center[0]+Math.cos(cfg.yaw)*u-Math.sin(cfg.yaw)*v,z:cfg.center[1]-Math.sin(cfg.yaw)*u-Math.cos(cfg.yaw)*v});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('both real buildings have two opposite complete-model viewpoints reachable on original terrain in both viewports',async()=>{
 for(const layout of['desktop','phone'])for(const spec of STUDY_SITES){
  const camera=new T.PerspectiveCamera(60,layout==='phone'?390/844:1280/800,.08,22000),read=readStagedExterior(root,spec.id,camera);
  const cfg=spec.id==='107227742'?map.aquarium:map.conservatory,queryGround=points=>readStagedRouteGround(terrain,points);
  const querySweeps=segments=>readStagedRouteSweeps(terrain,segments);
  const planner=await createExteriorPlanner({bounds:read.bounds,camera:read.camera,layout,queryGround,querySweeps});
  // Exact observed native dismount coordinates from run 45882624790. No
  // synthetic pose is supplied to a browser: this is route geometry only.
  let start=spec.id==='107227742'?world(cfg,-.68,-44):world(cfg,-24,.68);
  const front=spec.id==='107227742'?Math.atan2(Math.sin(cfg.yaw),Math.cos(cfg.yaw)):Math.atan2(-Math.cos(cfg.yaw),Math.sin(cfg.yaw));
  const bearings=[];
  for(const bearing of[front+Math.PI/4,front+Math.PI*1.25]){
   const route=await planner.route(start,bearing).catch(error=>{throw Error(`${layout} ${spec.id} bearing ${bearing}: ${error.message}`,{cause:error});});assert(route.halfMetreSamples>0);assert(route.waypoints.length>=2);
   // Check every compressed segment independently; diagonal or corner shortcuts
   // cannot pass just because their grid endpoints are on dry land.
   let previous=start;
   for(const point of route.waypoints){
    const count=Math.max(1,Math.ceil(distance(previous,point)/.25));
    for(let i=0;i<=count;i++){
     const x=previous.x+(point.x-previous.x)*i/count,z=previous.z+(point.z-previous.z)*i/count;
     assert(terrain.land(x,z,2)&&!terrain.obstructed(x,z,.7),`${layout} ${spec.id} original obstruction at ${x},${z}`);
    }
    previous=point;
   }
   const end=route.endpoint,center=new T.Vector3().fromArray(read.bounds.center);
   camera.position.set(end.x,terrain.height(end.x,end.z,2)+1.55,end.z);camera.lookAt(center);camera.updateMatrixWorld(true);
   assert(readStagedExterior(root,spec.id,camera).completeBoundsInFrame,layout+' actual full model must fit');
   bearings.push(Math.atan2(end.x-center.x,end.z-center.z));start=end;
  }
  const delta=Math.abs(Math.atan2(Math.sin(bearings[1]-bearings[0]),Math.cos(bearings[1]-bearings[0])));assert(delta>=Math.PI*.8);
 }
});

test('a sub-grid thin collision wall is found by independent edge samples and cannot create a false connected route',async()=>{
 const planner=await createExteriorPlanner({bounds:{min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera:{fov:60,aspect:1.6},layout:'desktop',
  queryGround:points=>points.map(p=>({...p,height:2,walkable:Math.abs(p.x-2.17)>.3,planningClearance:Math.abs(p.x-2.17)>.3?.7:0})),querySweeps:segments=>segments.map(()=>({clear:true,samples:[]}))});
 await assert.rejects(planner.route({x:-5,z:0},Math.PI/2),/No connected|could not pass/);
});

function evidence(){
 const report={groundFit:{structuralReceiptPassed:true},captures:[],exteriorViews:[],exteriorLegs:[],exteriorTurns:[],nativeEvidence:{events:[],held:[],focusLossDuringInput:[],overflow:false}};
 const events=report.nativeEvidence.events;events.push({type:'click',target:'#start',trusted:true});
 for(const [landmark,text]of[['Belle Isle Aquarium','Travel to entrance'],['Anna Scripps Whitcomb Conservatory','Travel to path']])events.push({type:'click',landmark,text,trusted:true});
 for(const code of['KeyW','KeyF','KeyV'])for(const type of['keydown','keyup'])events.push({type,code,trusted:true});
 for(const id of['107227742','107310050'])for(const [i,bearing]of[0,Math.PI].entries()){
  const name=id+'-'+i,frame={completeBoundsInFrame:true,selectedLevels:[0]};
  report.exteriorViews.push({id,name,bearing,before:frame,after:frame});report.captures.push({id,name,bytes:5000,sha256:'fixture'});
  for(const type of['pointerdown','pointermove','pointerup'])events.push({type,phase:name+'-aim',trusted:true});
 }
 const before={frames:1,actor:{x:0,z:0,onFoot:true,firstPerson:true,headingY:Math.PI/2}},after={frames:10,actor:{x:5,z:0,onFoot:true,firstPerson:true,headingY:Math.PI/2}};
 report.exteriorLegs.push({name:'real-leg',before,after,trace:[before,after],coastTrace:Array.from({length:4},(_,i)=>({frames:7+i,actor:{...after.actor}})),goal:{x:5,z:0},ground:[{walkable:true,planningClearance:.7}],maxLateral:.41,
  sweep:{clear:true,bodyRadius:.27,bodyHeights:[.62,1.1,1.58],from:before.actor,to:{x:5,z:0},maxLateral:.41,maxForward:.75,
   samples:[{clear:true,groundClear:true,step:.25,rayLength:.55,acceptedBeyond:.52,corridorRadius:.68,bodyHits:[null,null,null],corridorHits:[null,null,null],headHit:null,corridorHeadHit:null}]}});
 report.exteriorTurns.push({name:'real-leg-turn',complete:true,heading:Math.PI/2,tolerance:.04,geometry:{legLength:5,maxLateral:.41,maxForward:.75},acceptanceCadence:cadence(60),
  toleranceDerivation:{desiredRadians:.04,originalLimitRadians:.15,turnRateRadiansPerSecond:2.7,originalMainStepLimitSeconds:.05,halfFrameQuantumRadians:1/60*2.7/2,settlingBoundRadians:.002,corridorLimitRadians:Math.atan2(.41-.015,5.75)},
  finalErrorRadians:0,cadenceAllowanceUsed:false,before,after:{frames:1,actor:{...before.actor}},pulses:[]});
 for(const type of['keydown','keyup'])events.push({type,code:'KeyW',phase:'real-leg',trusted:true});return report;
}
test('exterior acceptance requires actual PNGs, opposite views and every real actor/native-input leg',()=>{
 assert.doesNotThrow(()=>assertExteriorEvidence(evidence()));
 for(const change of[
  r=>r.captures.pop(),r=>r.exteriorViews[1].bearing=0,r=>r.exteriorViews[0].before={completeBoundsInFrame:false,selectedLevels:[0]},
  r=>r.exteriorViews[0].after={completeBoundsInFrame:true,selectedLevels:[0,1]},r=>r.nativeEvidence.events[0].trusted=false,
  r=>r.exteriorLegs[0].after.frames=1,r=>r.exteriorLegs[0].after.actor.x=0,r=>r.exteriorLegs[0].trace[1].actor.onFoot=false,
  r=>r.exteriorLegs[0].trace.splice(1,0,{frames:3,actor:{x:1,z:2,onFoot:true}}),r=>r.exteriorLegs[0].after.actor.z=2,
  r=>r.nativeEvidence.events=r.nativeEvidence.events.filter(e=>e.phase!=='real-leg'),r=>r.nativeEvidence.events=r.nativeEvidence.events.filter(e=>e.type!=='pointermove'),
  r=>r.groundFit.structuralReceiptPassed=false,r=>r.nativeEvidence.focusLossDuringInput.push({reason:'blur'}),
  r=>r.exteriorTurns[0].after.actor.headingY=.1,r=>r.exteriorLegs[0].sweep.clear=false,r=>r.exteriorLegs[0].sweep.bodyRadius=.2,
  r=>r.exteriorLegs[0].after.actor.x=6,r=>r.exteriorLegs[0].sweep.from={x:1,z:1},
  r=>r.exteriorLegs[0].coastTrace[1].actor.z=2,r=>r.exteriorLegs[0].coastTrace=[],r=>r.exteriorLegs[0].sweep.samples[0].bodyHits[0]=0,
  r=>r.exteriorTurns[0].acceptanceCadence.meanFrameSeconds=NaN,r=>r.exteriorTurns[0].acceptanceCadence.intervals[0].frames=0,
  r=>r.exteriorTurns[0].acceptanceCadence.intervals[0].seconds=0,r=>r.exteriorTurns[0].acceptanceCadence.intervals[0].seconds=NaN,
  r=>r.exteriorTurns[0].acceptanceCadence.intervals[0].frames=Infinity,r=>r.exteriorTurns[0].acceptanceCadence.intervals=[],
  r=>r.exteriorTurns[0].acceptanceCadence.maximumHeadingDifference=-1,
  r=>r.exteriorTurns[0].tolerance=.15,r=>r.exteriorTurns[0].toleranceDerivation.settlingBoundRadians=.1,
  r=>r.exteriorTurns[0].toleranceDerivation.originalMainStepLimitSeconds=.25,
 ]){const candidate=evidence();change(candidate);assert.throws(()=>assertExteriorEvidence(candidate));}
});

function cadence(hz){return{meanFrameSeconds:1/hz,maximumHeadingDifference:0,intervals:Array.from({length:Math.ceil(hz*.2)},()=>({frames:1,seconds:1/hz}))};}
async function sampledTurn({hz,offset,initial,heading,latencyMs,legLength=2.5,maxLateral=.41}){
 const core=new RideCore(terrain,{spawn:{position:{x:1350.8787341500893,y:2,z:1125.3483974696717},headingY:initial}});
 let firstPerson=true,frames=0,wall=0,next=offset,steer=0,active=0,ignored=0;const history=[],phases=[],receipt={};
 // The real main loop samples the held-key Set at rendered frames, then
 // RideCore applies that sample to its fixed substeps. Down+up between two
 // render samples is deliberately ignored here, exactly like continuous A/D.
 const advance=milliseconds=>{const end=wall+milliseconds;while(next<=end){
  core.advance(Math.min(1/hz,.05),{steer});if(steer)active++;frames++;history.push({frames,time:next/1000,actor:{...core.renderPose,onFoot:core.current.footMode===2,firstPerson}});next+=1000/hz;
 }wall=end;};
 core.advance(1/120,{dismount:true});advance(2000);assert.equal(core.current.footMode,2);
 const motion=async()=>history.at(-1),settleHeading=async name=>{
  phases.push(name);advance(600);const row=history.at(-1),tail=history.filter(r=>row.time-r.time<=.22);
  return{...row,headingSettlement:{phase:name,firstFrame:tail[0].frames,lastFrame:row.frames,timeSpan:row.time-tail[0].time,
   intervals:tail.slice(1).map((r,i)=>({frames:r.frames-tail[i].frames,seconds:r.time-tail[i].time})),
   meanFrameSeconds:(row.time-tail[0].time)/(row.frames-tail[0].frames),maximumHeadingDifference:Math.max(...tail.map(r=>Math.abs(Math.atan2(Math.sin(row.actor.headingY-r.actor.headingY),Math.cos(row.actor.headingY-r.actor.headingY)))))}};
 };
 await turnExteriorHeading({heading,name:'sampled-turn',receipt,legLength,maxLateral,maxForward:.75,motion,phase:async name=>phases.push(name),setFirstPerson:async wanted=>{firstPerson=wanted;advance(80);},focusCanvas:async()=>{},
  pulse:async(key,milliseconds)=>{const before=active;steer=key==='a'?-1:1;advance(milliseconds+latencyMs);steer=0;if(active===before)ignored++;},settleHeading});
 assert.equal(new Set(phases).size,phases.length,'Turn phase names identify individual observations');return{receipt,ignored};
}
test('frame-sampled30/60Hz native held-input pulses handle ignored intervals and half-step headings without waiving corridor geometry',async()=>{
 // Native run45897620142/artifact15154849685, head8b33a583, recorded
 // post-correction headings -3.4011885568 and -2.8157610484. Old target
 // headings were not archived. Include that bracket, actual route bearings,
 // arbitrary angles and half-quantum targets the unpublished .04 gate missed.
 // This is a physics/controller regression, not native browser acceptance.
 let ignored=0,allowances=0;
 for(const hz of[30,60])for(const offset of[0,5,11,20,31])for(const initial of[-3.4011885568174214,-2.815761048446847])for(const latencyMs of[0,8,20]){
  const half=2.7/hz/2,headings=[-3.15,-3.1,-3.05,-1.55813,.713,initial+half-.001,initial+half,initial+half+.001,initial+half*3];
  for(const heading of headings){
   const result=await sampledTurn({hz,offset,initial,heading,latencyMs}),receipt=result.receipt;ignored+=result.ignored;allowances+=Number(receipt.cadenceAllowanceUsed);
   assert(receipt.complete&&receipt.after.actor.firstPerson&&receipt.finalErrorRadians<=receipt.tolerance);
   assert(receipt.tolerance<=.15&&receipt.tolerance<=Math.atan2(.41-.015,3.25));
   if(hz===60)assert.equal(receipt.tolerance,.04,'Keep the stricter desired target when native cadence supports it');
   assert(receipt.pulses.every(p=>p.milliseconds>=8&&p.milliseconds<=240));
  }
 }
 assert(ignored>0,'The regression must actually exercise missed subframe key holds');assert(allowances>0,'The regression must include otherwise unreachable .04 half-step headings');
});
test('a corridor below native heading resolution fails until the proposed leg is geometrically shortened',async()=>{
 const request={hz:30,offset:0,initial:-3.4011885568174214,heading:-3.4011885568174214+.045,latencyMs:0,maxLateral:.41};
 await assert.rejects(sampledTurn({...request,legLength:12}),/did not reach/);
 assert((await sampledTurn({...request,legLength:2.5})).receipt.complete);
});
test('an ignored native turn input cannot pass by increasing attempts or rewriting a pose',async()=>{
 const actor={x:0,z:0,headingY:0,onFoot:true,firstPerson:false};const receipt={};let pulses=0;
 await assert.rejects(turnExteriorHeading({heading:1,name:'ignored',receipt,legLength:2.5,maxLateral:.41,maxForward:.75,motion:async()=>({actor:{...actor}}),phase:async()=>{},setFirstPerson:async value=>{actor.firstPerson=value;},focusCanvas:async()=>{},
  pulse:async()=>{pulses++;},settleHeading:async()=>({actor:{...actor},headingSettlement:cadence(60)})}),/did not reach/);
 assert.equal(receipt.complete,false);assert.equal(actor.headingY,0);assert.equal(pulses,18);
});

function fixture(solids=[]){
 const loaded=new FlightSolids();for(const solid of solids)loaded.add(solid);
 const terrain={height:()=>2,land:()=>true,obstructed:()=>false,raycastObstacle:(...args)=>loaded.ray(...args)},requests=[];
 return{requests,queryGround:points=>readStagedRouteGround(terrain,points),querySweeps:segments=>{requests.push(...structuredClone(segments));return readStagedRouteSweeps(terrain,segments);}};
}
const line=Array.from({length:21},(_,i)=>({x:i*2,z:0}));
test('partial compression retains the valid narrow route beside an actual cylinder when a wide stopping corridor rejects the long proposal',async()=>{
 const queries=fixture([{x:9.8,z:1.3,bottom:2,top:8,radius:.15,kind:'lamp'}]),start={x:0,z:0};
 const plain=await checkExteriorProspectivePath(start,line,queries);assert(plain.clear);
 const long=await checkExteriorProspectivePath(start,[line.at(-1)],queries);assert.equal(long.clear,false);assert.equal(long.leg.sweep.maxForward,.75);assert(long.leg.sweep.maxLateral>.41);
 assert(long.leg.sweep.samples.filter(row=>!row.clear).every(row=>row.bodyHits.every(hit=>hit===null)), 'The original body fits; the full permitted stopping corridor rejects the shortcut');
 const partial=await partiallyCoalesceExteriorPath(start,line,queries);assert(partial.clear);assert(partial.rejected.length>0);assert(partial.waypoints.length<line.length/2);assert(partial.checkedLegs<plain.checkedLegs);
 assert((await checkExteriorProspectivePath(start,partial.waypoints,queries)).clear);
 assert(queries.requests.every(row=>row.maxForward===.75&&(row.maxLateral===.41||row.maxLateral===1.96)&&Math.hypot(row.to.x-row.from.x,row.to.z-row.from.z)<=12+1e-9));
});
test('partial compression never accepts an actual original-body collision merely to reduce waypoint count',async()=>{
 const queries=fixture([{x:9.8,z:0,bottom:2,top:8,radius:.5,kind:'lamp'}]),partial=await partiallyCoalesceExteriorPath({x:0,z:0},line,queries);
 assert.equal(partial.clear,false);assert(partial.rejected.length>0);const [direct]=queries.querySweeps([{from:{x:0,z:0},to:{x:20,z:0},maxLateral:.41,maxForward:.75}]);assert(direct.samples.some(row=>row.bodyHits.some(hit=>hit!==null&&hit<=row.acceptedBeyond)));assert(partial.rejected.every(row=>row.clear===false));
});
test('partial compression preserves every direction change and the actual nominal origin after a skipped sub-arrival waypoint',async()=>{
 const queries=fixture(),points=[{x:.2,z:0},{x:2.2,z:0},{x:4.2,z:0},{x:4.2,z:2},{x:4.2,z:4}];
 const result=await partiallyCoalesceExteriorPath({x:0,z:0},points,queries);
 assert(result.clear);assert.deepEqual(result.waypoints,[points[0],points[2],points[4]]);assert.deepEqual(result.accepted[1].from,{x:0,z:0});assert.deepEqual(result.end,points[4]);
});
test('incomplete ground and sweep receipts cannot pass shortcut proposals',async()=>{
 await assert.rejects(prepareExteriorLegs([{from:{x:0,z:0},to:{x:3,z:0}}],{queryGround:()=>[],querySweeps:()=>[]}),/Incomplete prospective ground/);
 const queries=fixture();await assert.rejects(prepareExteriorLegs([{from:{x:0,z:0},to:{x:3,z:0}}],{...queries,querySweeps:()=>[]}),/Incomplete prospective body-sweep/);
});
test('prospective replanning remains bounded without offering any unsafe native leg',async()=>{
 const route={waypoints:[{x:5,z:0}]},receipt={};let replans=0,offered=0;
 const queries=fixture([{x:2,z:0,bottom:2,top:8,radius:.5,kind:'lamp'}]);
 await assert.rejects(async()=>{for await(const leg of exteriorLegProposals({route,label:'blocked',motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},...queries,replan:async()=>{replans++;return route;},receipt}))offered++;},/replanning exceeded/);
 assert.equal(offered,0);assert.equal(replans,4);assert.equal(receipt.rejected.length,5);assert(receipt.rejected.every(row=>row.nativeWIssued===false));
});
test('a consumer movement failure stops the generator before any replacement or retry',async()=>{
 const receipt={},queries=fixture();let replans=0;const error=Error('actual native movement failed');
 await assert.rejects(async()=>{for await(const leg of exteriorLegProposals({route:{waypoints:[{x:5,z:0}]},label:'movement',motion:async()=>({actor:{x:0,z:0}}),phase:async()=>{},...queries,replan:async()=>{replans++;throw Error('unexpected');},receipt}))throw error;},value=>value===error);
 assert.equal(replans,0);assert.equal(receipt.offeredLegs,1);assert.equal(receipt.replans.length,0);
});

test('full original scenery reproduces every native c746 phone and desktop rejected stopping hit',async()=>{
 const {originalExteriorTerrain}=await import('./staged-landmark-original-solids.test-support.mjs');
 const {terrain:loaded,solids,boulderCount}=await originalExteriorTerrain(map);
 assert.equal(solids.length,6043);assert.equal(boulderCount,90);
 const fixture=JSON.parse(await readFile(new URL('./fixtures/staged-exterior-native-c746-sweeps.json',import.meta.url),'utf8'));
 assert.equal(fixture.cases.length,2);
 for(const row of fixture.cases){
  const [sweep]=readStagedRouteSweeps(loaded,[row.segment]);assert.equal(sweep.clear,false,row.phase);
  assert.equal(sweep.bodyRadius,.27);assert.deepEqual(sweep.bodyHeights,[.62,1.1,1.58]);
  assert.equal(sweep.maxForward,.75);assert.equal(sweep.maxLateral,row.segment.maxLateral);
  const actual=sweep.samples.map(({bodyHits,corridorHits,headHit,corridorHeadHit,groundClear,clear})=>({bodyHits,corridorHits,headHit,corridorHeadHit,groundClear,clear}));
  assert.deepEqual(actual,row.samples,row.phase+' must retain every original native hit');
  const [proposal]=await prepareExteriorLegs([{from:row.segment.from,to:row.segment.to}],{queryGround:points=>readStagedRouteGround(loaded,points),querySweeps:segments=>readStagedRouteSweeps(loaded,segments)});
  assert.equal(proposal.clear,false,'The shared planner must reject the same original stopping obstruction before W');
 }
});

test('the retained native250 phone failure keeps its unsafe connector rejected and reaches a clear alternative after the chosen component disconnects',async t=>{
 const retained=JSON.parse(await readFile(new URL('./staged-landmark-exterior-proof-connector-fixture.json',import.meta.url),'utf8'));
 assert.equal(retained.source,'7b69bf2b48d6177f5eb346021793ba79922be79e');
 assert.equal(retained.plannerBlob,'43f39c112df68f5ca5c3fc2231bd550470fa8d86');
 assert.equal(retained.artifact.id,15168627388);assert.equal(retained.plans.length,3);assert.equal(retained.nativeSweeps.length,9);
 const {originalExteriorTerrain}=await import('./staged-landmark-original-solids.test-support.mjs');
 const {terrain:loaded,solids,boulderCount}=await originalExteriorTerrain(map);
 assert.equal(solids.length,6043);assert.equal(boulderCount,90);
 const queries={queryGround:points=>readStagedRouteGround(loaded,points),querySweeps:segments=>readStagedRouteSweeps(loaded,segments)};
 for(const sweep of retained.nativeSweeps){
  const [actual]=queries.querySweeps([{from:sweep.from,to:sweep.to,maxLateral:sweep.maxLateral,maxForward:sweep.maxForward}]);
  assert.deepEqual(actual,sweep,'All nine original native sweep receipts must reproduce exactly');
 }
 const receipt={},planner=await createExteriorPlanner({bounds:retained.bounds,camera:retained.camera,layout:retained.layout,...queries,receipt});
 for(const old of retained.plans.slice(0,2)){
  const route=await planner.route(old.from,old.bearing),plan=receipt.plans.at(-1);
  assert.equal(plan.status,old.status);assert.equal(plan.attempts.length,old.attemptCount);
  assert.deepEqual(plan.attempts.map(row=>row.connectedCells),old.connectedCells);
  assert.deepEqual(plan.connectors,old.connectors);assert.deepEqual(plan.selected,old.selected);
  assert.deepEqual(route.waypoints,old.selected.waypoints,'Already passing route choices must remain identical');
  assert.deepEqual(plan.connectorChanges??[],[]);
 }
 const old=retained.plans.at(-1),route=await planner.route(old.from,old.bearing),plan=receipt.plans.at(-1);
 assert.equal(old.status,'failed');assert.equal(old.attemptCount,7);
 assert.deepEqual(plan.connectors.slice(0,2),old.connectors);
 assert.equal(plan.connectors[0].prospective.clear,false,'The closest connector still fails its original stopping corridor');
 assert.equal(plan.connectors[1].prospective.clear,true,'The next connector is locally clear but its component disconnects');
 assert.equal(plan.connectors.length,3);assert.equal(plan.connectors[2].prospective.clear,true);
 assert.deepEqual(plan.connectors[2].to,{x:1214.5335473956352,z:1329.1117891992094});
 assert.deepEqual(plan.attempts.slice(0,7).map(row=>row.connectedCells),old.connectedCells);
 assert.equal(plan.connectorChanges.length,1);assert.equal(plan.connectorChanges[0].afterAttempt,6);
 assert(old.error.includes(plan.connectorChanges[0].reason),'The original disconnected-component cause remains explicit');
 assert.deepEqual(plan.connectorChanges[0].from,old.connectors[1].to);assert.deepEqual(plan.connectorChanges[0].to,plan.connectors[2].to);
 assert.equal(plan.status,'passed');assert(plan.attempts.length<=receipt.maximumSearchAttempts);
 const checked=await checkExteriorProspectivePath(old.from,route.waypoints,queries);
 assert(checked.clear);assert.equal(checked.checkedLegs,route.prospective.checkedLegs);
 assert.equal(route.prospective.maxForward,.75);assert(checked.checkedLegs<=route.originalWaypointCount*80);
 t.diagnostic(JSON.stringify({rawNativeSweepsMatched:9,connectorChanges:plan.connectorChanges,searchAttempts:plan.attempts.length,waypoints:route.waypoints.length,originalWaypointCount:route.originalWaypointCount,checkedLegs:checked.checkedLegs,originalTotalLegAllowance:route.originalWaypointCount*80}));
 // This is an original-source geometric replay. The failed native archive is
 // retained; only a new exact-head native run can establish actual completion.
});

function disconnectedConnectorFixture({small=false}={}){
 const bounds={min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera={fov:60,aspect:1.6};
 const range=Math.sqrt(3)/Math.sin(Math.PI/6)*1.22+60,start={x:-range+44,z:-range+64};
 const queryGround=points=>points.map(point=>{
  const walkable=point.x>10||(small?distance(point,start)<=3.1:point.x<-10);
  return{...point,height:2,walkable,planningClearance:walkable?.7:0};
 });
 const requests=[],querySweeps=segments=>{requests.push(...structuredClone(segments));return segments.map(()=>({clear:true,samples:[]}));};
 return{bounds,camera,start,queryGround,querySweeps,requests,layout:'desktop'};
}
test('bounded connector selection fails closed when every independently clear connector is disconnected',async()=>{
 const setup=disconnectedConnectorFixture({small:true}),receipt={},planner=await createExteriorPlanner({...setup,receipt});
 await assert.rejects(planner.route(setup.start,Math.PI/2),/No connected original-terrain route/);
 const plan=receipt.plans[0];assert.equal(plan.status,'failed');assert(plan.attempts.length>1&&plan.attempts.length<64);
 assert.equal(plan.connectorChanges.length,plan.attempts.length-1);assert(plan.attempts.every(row=>row.disconnected));
 assert(plan.connectors.every(row=>row.groundClear&&row.prospective.clear));
 assert.equal(plan.selected,null);assert(plan.error.includes(plan.attempts.at(-1).disconnected));
});
test('connector alternatives share the unchanged64-search budget and retain deterministic failure receipts',async()=>{
 const receipts=[];
 for(let repeat=0;repeat<2;repeat++){
  const setup=disconnectedConnectorFixture(),receipt={},planner=await createExteriorPlanner({...setup,receipt});
  await assert.rejects(planner.route(setup.start,Math.PI/2),error=>{
   assert.match(error.message,/64-attempt shared connector\/edge search budget exhausted/);
   assert.match(String(error.cause),/No connected original-terrain route/);return true;
  });
  const plan=receipt.plans[0];assert.equal(receipt.maximumSearchAttempts,64);assert.equal(plan.attempts.length,64);
  assert.equal(plan.connectorChanges.length,63);assert.equal(plan.connectors.length,64);
  assert(plan.attempts.every(row=>row.disconnected));assert.equal(plan.selected,null);assert.equal(plan.status,'failed');
  assert(setup.requests.every(row=>row.maxLateral===.41&&(row.maxForward===undefined||row.maxForward===.75)));
  assert(new Set(plan.connectors.map(row=>JSON.stringify(row.to))).size===plan.connectors.length,'No connector is selected repeatedly');
  receipts.push(plan);
 }
 assert.deepEqual(receipts[0],receipts[1]);
});

// Register the complete prospective/executor rejection regressions in the existing test target.
import './staged-landmark-exterior-envelope.test.mjs';
import './staged-landmark-exterior-proof-view.test.mjs';
