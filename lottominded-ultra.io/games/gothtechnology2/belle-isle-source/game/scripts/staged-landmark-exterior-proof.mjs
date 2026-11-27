/** Additional complete-exterior evidence. Plans use read-only original terrain;
 * all actual travel and camera aiming use the public Guide and native input. */
import assert from 'node:assert/strict';
import {createExteriorViewScorer,scoreExteriorViewpoint} from './staged-landmark-exterior-view-advice.mjs';

const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const linePoints=(a,b)=>{const count=Math.max(1,Math.ceil(distance(a,b)/.5));return Array.from({length:count+1},(_,i)=>({x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count}));};

/** The unchanged executor leg policy, queried without input. Batch planner
 * edges without changing the actual .7/2.25 occupancy or .75 coast envelope. */
export async function prepareExteriorLegs(segments,{queryGround,querySweeps}){
 const rows=segments.map(({from,to})=>{
  const remaining=distance(from,to);assert([from.x,from.z,to.x,to.z,remaining].every(Number.isFinite));
  const length=Math.min(12,remaining),complete=remaining<=.4;
  return{from,waypoint:to,remaining,length,complete,clear:complete,
   goal:complete?to:{x:from.x+(to.x-from.x)*length/remaining,z:from.z+(to.z-from.z)*length/remaining},ground:[]};
 });
 async function groundFor(values){
  const samples=values.map(row=>linePoints(row.from,row.goal)),flat=samples.flat(),ground=flat.length?await queryGround(flat):[];
  assert.equal(ground.length,flat.length,'Incomplete prospective ground receipt');let at=0;
  for(let i=0;i<values.length;i++){values[i].ground=ground.slice(at,at+samples[i].length);at+=samples[i].length;}
 }
 const active=rows.filter(row=>!row.complete);await groundFor(active);
 const shortened=active.filter(row=>row.ground.some(p=>p.planningClearance<2.25));
 for(const row of shortened){row.length=Math.min(2.5,row.remaining);row.goal={x:row.from.x+(row.waypoint.x-row.from.x)*row.length/row.remaining,z:row.from.z+(row.waypoint.z-row.from.z)*row.length/row.remaining};}
 await groundFor(shortened);
 const sweepRows=[];
 for(const row of active){
  row.maxLateral=Math.min(...row.ground.map(p=>p.planningClearance))-.29;
  if(!row.ground.every(p=>p.walkable)){row.reason='original-ground';continue;}
  assert(Number.isFinite(row.maxLateral)&&row.maxLateral>0&&row.maxLateral<=1.96,'Invalid prospective planning clearance');sweepRows.push(row);
 }
 const swept=sweepRows.length?await querySweeps(sweepRows.map(row=>({from:row.from,to:row.goal,maxLateral:row.maxLateral,maxForward:.75}))):[];
 assert.equal(swept.length,sweepRows.length,'Incomplete prospective body-sweep receipt');
 for(let i=0;i<sweepRows.length;i++){sweepRows[i].sweep=swept[i];sweepRows[i].clear=swept[i].clear===true;if(!sweepRows[i].clear)sweepRows[i].reason='original-stopping-corridor';}
 return rows;
}

/** Coalescing may change length, width selection and stopping endpoints.
 * Validate every resulting prospective leg, including the actual connector. */
export async function checkExteriorProspectivePath(start,waypoints,queries){
 let current=start,checkedLegs=0;
 for(const [waypointIndex,waypoint]of waypoints.entries())for(let legIndex=0;legIndex<80;legIndex++){
  const [leg]=await prepareExteriorLegs([{from:current,to:waypoint}],queries);
  if(leg.complete)break;checkedLegs++;
  if(!leg.clear)return{clear:false,checkedLegs,waypointIndex,legIndex,leg};
  current=leg.goal;
  if(legIndex===79)return{clear:false,checkedLegs,waypointIndex,legIndex,leg,reason:'Original 80-leg waypoint bound'};
 }
 return{clear:true,checkedLegs,end:current};
}

/** Keep safe portions of a collinear grid run compressed. Every selected
 * waypoint is checked through the same complete 12m/2.5m executor chunks.
 * A rejected long proposal is shortened by grid index, never by weakening
 * clearance. Geometric halving bounds failed queries; even the final one-edge
 * proposal must pass independently. Nominal endpoints retain the original
 * .4m arrival policy instead of pretending every grid point was reached. */
export async function partiallyCoalesceExteriorPath(start,waypoints,queries){
 const selected=[],accepted=[],rejected=[];let current=start,checkedLegs=0;
 for(let first=0;first<waypoints.length;){
  let last=first;
  if(first>0){
   const dx=waypoints[first].x-waypoints[first-1].x,dz=waypoints[first].z-waypoints[first-1].z;
   while(last+1<waypoints.length&&Math.abs(waypoints[last+1].x-waypoints[last].x-dx)<1e-8&&Math.abs(waypoints[last+1].z-waypoints[last].z-dz)<1e-8)last++;
  }
  let target=last;
  for(;;){
   const from={...current},checked=await checkExteriorProspectivePath(from,[waypoints[target]],queries);
   if(checked.clear){
    selected.push(waypoints[target]);accepted.push({from,to:waypoints[target],firstGridIndex:first,lastGridIndex:target,checkedLegs:checked.checkedLegs,end:checked.end});
    checkedLegs+=checked.checkedLegs;current=checked.end;first=target+1;break;
   }
   rejected.push({from,to:waypoints[target],firstGridIndex:first,lastGridIndex:target,...checked});
   if(target===first)return{clear:false,selected,accepted,rejected,checkedLegs,waypointIndex:first,leg:checked.leg,reason:checked.reason};
   target=first+Math.floor((target-first)/2);
  }
 }
 return{clear:true,waypoints:selected,accepted,rejected,checkedLegs,end:current};
}

/** Only yields independently clear proposals. Four actual-start replans are
 * shared across route replacements. A consumer failure closes this iterator,
 * so a real turn or post-keydown failure cannot initiate another plan. */
export async function* exteriorLegProposals({route,label,motion,phase,queryGround,querySweeps,replan,receipt}){
 const originalWaypointCount=route.originalWaypointCount??route.waypoints.length;
 assert(Number.isSafeInteger(originalWaypointCount)&&originalWaypointCount>0&&originalWaypointCount<=route.waypoints.length,'Invalid original waypoint allowance');
 Object.assign(receipt,{label,originalWaypointCount,maximumLegs:originalWaypointCount*80,maximumReplans:4,offeredLegs:0,replans:[],rejected:[]});
 let active=route,generation=0;
 for(;;){
  let replaced=false;
  waypoints:for(const [index,waypoint]of active.waypoints.entries())for(let segment=0;segment<80;segment++){
   const current=(await motion()).actor;if(distance(current,waypoint)<=.4)break;
   assert(receipt.offeredLegs<receipt.maximumLegs,'Native exterior route exceeded its original total leg allowance');
   const routeLabel=generation?label+'-replan-'+generation:label,name=routeLabel+'-walk-'+index+'-'+segment;
   await phase(name+'-prospective');
   const [proposal]=await prepareExteriorLegs([{from:current,to:waypoint}],{queryGround,querySweeps});
   if(!proposal.clear){
    receipt.rejected.push({name,stage:'prospective',generation,nativeWIssued:false,proposal});
    assert(generation<receipt.maximumReplans,'Native exterior prospective replanning exceeded its bounded attempts');
    generation++;const planName=label+'-replan-'+generation+'-plan';await phase(planName);
    const replacementReceipt={name:planName,from:current,route:null,error:null};receipt.replans.push(replacementReceipt);
    try{
     const replacement=await replan(current);assert(replacement?.waypoints?.length>0,'Missing actual-start exterior replacement');
     replacementReceipt.route=replacement;active=replacement;replaced=true;break waypoints;
    }catch(error){replacementReceipt.error=String(error);throw error;}
   }
   receipt.offeredLegs++;yield{...proposal,name};
   if(segment===79)throw Error('Native exterior waypoint exceeded its bounded leg count');
  }
  if(!replaced)return;
 }
}

/** Neighbour grid plus independent half-metre and native body-sweep checks. A blocked
 * connector/edge fails or is replanned; it never teleports or relaxes terrain.
 * Nearby connector alternatives share the original 64 edge-search attempts. */
export async function createExteriorPlanner({bounds,camera,layout,queryGround,querySweeps,queryViewBounds,receipt={}}){
 const center={x:bounds.center[0],z:bounds.center[2]},radius=Math.hypot(...bounds.max.map((n,i)=>n-bounds.min[i]))/2;
 const halfV=camera.fov*Math.PI/360,halfH=Math.atan(Math.tan(halfV)*camera.aspect);
 const viewDistance=radius/Math.sin(Math.min(halfV,halfH))*1.22,range=viewDistance+60,spacing=2,width=Math.ceil(range*2/spacing)+1;
 assert(width*width<=200000,'Exterior terrain query exceeds its bounded area');
 const points=Array.from({length:width*width},(_,i)=>({x:center.x-range+i%width*spacing,z:center.z-range+Math.floor(i/width)*spacing}));
 async function query(values){const rows=[];for(let i=0;i<values.length;i+=10000)rows.push(...await queryGround(values.slice(i,i+10000)));assert.equal(rows.length,values.length,'Incomplete original terrain receipt');return rows;}
 assert.equal(typeof querySweeps,'function','Original native body sweeps are required');
 const blocked=new Set(),rejectedSweeps=[],rejectedProspectivePaths=[];let checkedEdges=0;
 Object.assign(receipt,{layout,viewDistance,spacing,maximumSearchAttempts:64,plans:[],rejectedSweeps,rejectedProspectivePaths});
 const ground=await query(points);
 async function sweeps(segments){const rows=[];for(let i=0;i<segments.length;i+=2000)rows.push(...await querySweeps(segments.slice(i,i+2000)));assert.equal(rows.length,segments.length,'Incomplete original body-sweep receipt');return rows;}
 async function route(start,bearing,oppositeBearing=null){
  const planReceipt={from:{...start},bearing,status:'planning',connectors:[],connectorChanges:[],attempts:[],selected:null,error:null};receipt.plans.push(planReceipt);
  try{
  const starts=points.map((p,i)=>({i,d:distance(start,p)})).filter(v=>ground[v.i].walkable&&v.d<=12).sort((a,b)=>a.d-b.d);
  let nextStart=0,lastDisconnection;
  async function nextConnector(){
  for(;nextStart<starts.length;){
   const candidate=starts[nextStart++];
   const connectorGround=await query(linePoints(start,points[candidate.i]));
   const connector={from:start,to:points[candidate.i],groundClear:connectorGround.every(p=>p.walkable),failedGround:connectorGround.filter(p=>!p.walkable),originalSweep:null,prospective:null};planReceipt.connectors.push(connector);
   if(!connector.groundClear)continue;
   if(candidate.d>=1e-6){connector.originalSweep=(await sweeps([{from:start,to:points[candidate.i],maxLateral:.41}]))[0];if(!connector.originalSweep.clear)continue;}
   const checked=await checkExteriorProspectivePath(start,[points[candidate.i]],{queryGround:query,querySweeps:sweeps});
   connector.prospective=checked;
   if(checked.clear)return candidate.i;
   rejectedProspectivePaths.push({kind:'connector',from:start,waypoints:[points[candidate.i]],...checked});
  }
  return -1;
  }
  let first=await nextConnector();
  assert(first>=0,'The actual actor has no walkable original-terrain connector');
  const observation=queryViewBounds?await queryViewBounds():null;
  if(queryViewBounds)assert(observation,'Missing actual loaded view bounds');
  const scoreView=observation?createExteriorViewScorer(observation):null;
  const candidates=points.flatMap((p,i)=>{
   const d=distance(p,center),delta=Math.abs(angle(Math.atan2(p.x-center.x,p.z-center.z)-bearing));
   const opposite=oppositeBearing===null||Math.abs(angle(Math.atan2(p.x-center.x,p.z-center.z)-oppositeBearing))>=Math.PI*.8+Math.atan2(.4,viewDistance);
   return ground[i].walkable&&d>=viewDistance&&d<=viewDistance+48&&delta<=Math.PI/9&&opposite?[{i,score:d-viewDistance+delta*viewDistance,view:scoreView?scoreView([p.x,ground[i].height+1.55,p.z]):null}]:[];
  }).sort((a,b)=>(a.view?.blockedSamples??0)-(b.view?.blockedSamples??0)||a.score-b.score);
  assert(candidates.length,'No dry exterior viewpoint exists in the required direction');
  for(let attempt=0;attempt<64;attempt++){
   const pathReceipt={attempt,connectedCells:0,waypoints:[],failedGround:[],failedSweeps:[],failedProspective:[],coalesced:null,uncoalesced:null};planReceipt.attempts.push(pathReceipt);
   const parent=new Int32Array(points.length).fill(-1),queue=[first];parent[first]=first;
   for(let j=0;j<queue.length;j++){
    const current=queue[j],x=current%width,z=Math.floor(current/width);
    const neighbours=[];for(const ox of[-1,0,1])for(const oz of[-1,0,1])if((ox||oz)&&x+ox>=0&&x+ox<width&&z+oz>=0&&z+oz<width)neighbours.push(current+ox+oz*width);
    for(const next of neighbours){
     if(next<0||parent[next]>=0||!ground[next].walkable||blocked.has(edgeKey(current,next)))continue;
     parent[next]=current;queue.push(next);
    }
   }
   pathReceipt.connectedCells=queue.length;
   const goal=candidates.find(c=>parent[c.i]>=0);
   if(!goal){
    const reason=`No connected original-terrain route reaches the required exterior direction (${queue.length} connected cells, ${candidates.length} candidate cells, ${blocked.size} rejected edges)`;
    pathReceipt.disconnected=reason;lastDisconnection=reason;
    // Retain the first successful plan unchanged. Only a disconnected search
    // component permits another nearby connector, in the same original order.
    // Its ground, body and complete stopping corridor are checked independently;
    // blocked edges and the single 64-attempt allowance are never reset.
    if(attempt===63)break;
    const next=await nextConnector();assert(next>=0,reason);
    planReceipt.connectorChanges.push({afterAttempt:attempt,from:points[first],to:points[next],reason});
    first=next;continue;
   }
   const indices=[goal.i];while(indices.at(-1)!==first)indices.push(parent[indices.at(-1)]);indices.reverse();
   pathReceipt.waypoints=indices.map(i=>points[i]);
   const samples=[],owners=[];
   for(let i=1;i<indices.length;i++)for(const p of linePoints(points[indices[i-1]],points[indices[i]])){samples.push(p);owners.push(edgeKey(indices[i-1],indices[i]));}
   const checked=await query(samples),edgeSweeps=await sweeps(indices.slice(1).map((next,i)=>({from:points[indices[i]],to:points[next],maxLateral:.41})));
   checkedEdges+=indices.length-1;let failed=false;
   for(let i=0;i<checked.length;i++)if(!checked[i].walkable){blocked.add(owners[i]);failed=true;pathReceipt.failedGround.push({edge:owners[i],sample:checked[i]});}
   for(let i=0;i<edgeSweeps.length;i++)if(!edgeSweeps[i].clear){blocked.add(edgeKey(indices[i],indices[i+1]));failed=true;
    const rejected={...edgeSweeps[i],samples:edgeSweeps[i].samples.filter(sample=>!sample.clear)};rejectedSweeps.push(rejected);pathReceipt.failedSweeps.push(rejected);}
   if(failed)continue;
   const prospectiveEdges=await prepareExteriorLegs(indices.slice(1).map((next,i)=>({from:points[indices[i]],to:points[next]})),{queryGround:query,querySweeps:sweeps});
   for(let i=0;i<prospectiveEdges.length;i++)if(!prospectiveEdges[i].clear){
    blocked.add(edgeKey(indices[i],indices[i+1]));failed=true;const rejected={kind:'grid-edge',leg:prospectiveEdges[i]};rejectedProspectivePaths.push(rejected);pathReceipt.failedProspective.push(rejected);
   }
   if(failed)continue;
   const waypoints=[points[first]];
   for(let i=1;i<indices.length-1;i++)if(indices[i]-indices[i-1]!==indices[i+1]-indices[i])waypoints.push(points[indices[i]]);
   waypoints.push(points[indices.at(-1)]);
   let selected=waypoints,prospective=await checkExteriorProspectivePath(start,selected,{queryGround:query,querySweeps:sweeps}),coalesced=true;
   pathReceipt.coalesced={waypoints:selected,...prospective};
   if(!prospective.clear){
    rejectedProspectivePaths.push({kind:'coalesced',from:start,waypoints:selected,...prospective});
    const partial=await partiallyCoalesceExteriorPath(start,indices.map(i=>points[i]),{queryGround:query,querySweeps:sweeps});
    pathReceipt.partial=partial;
    for(const rejected of partial.rejected)rejectedProspectivePaths.push({kind:'partial-coalescing',...rejected});
    if(partial.clear&&partial.waypoints.length<indices.length){selected=partial.waypoints;prospective=partial;coalesced=true;}
    else{
     selected=indices.map(i=>points[i]);coalesced=false;
     prospective=await checkExteriorProspectivePath(start,selected,{queryGround:query,querySweeps:sweeps});
     pathReceipt.uncoalesced={waypoints:selected,...prospective};
     if(!prospective.clear){
      rejectedProspectivePaths.push({kind:'uncoalesced',from:start,waypoints:selected,...prospective});
      assert(prospective.waypointIndex>0,'The checked original-terrain connector changed during path validation');
      blocked.add(edgeKey(indices[prospective.waypointIndex-1],indices[prospective.waypointIndex]));continue;
     }
    }
   }
   planReceipt.status='passed';planReceipt.selected={waypoints:selected,coalesced,checkedLegs:prospective.checkedLegs};
   return{bearing,viewDistance,spacing,layout,waypoints:selected,originalWaypointCount:waypoints.length,endpoint:selected.at(-1),checkedEdges,halfMetreSamples:checked.length,rejectedSweeps,rejectedProspectivePaths:rejectedProspectivePaths.slice(),
    viewAdvice:goal.view?{selected:goal.view,oppositeBearing,candidateCount:candidates.length,loadedBoxCount:observation.boxes.length,selectedLevels:observation.selectedLevels}:null,
    prospective:{clear:true,checkedLegs:prospective.checkedLegs,coalesced,maxForward:.75},
    source:'Read-only original terrain land/obstruction and loaded native body-sweep queries; independently recorded actual native walking'};
  }
  throw Error('Exterior route could not pass all original-terrain edge checks (64-attempt shared connector/edge search budget exhausted)',lastDisconnection?{cause:Error(lastDisconnection)}:undefined);
  }catch(error){planReceipt.status='failed';planReceipt.error=String(error);throw error;}
 }
 return{route,query,viewDistance,center,receipt};
}

/** The original entrance turn helper remains unchanged. Its 100ms polling
 * while A/D stays held overshot the phone exterior target repeatedly. Here
 * genuine key holds have a bounded duration independent of observation RPCs;
 * every correction starts from the actual settled post-keyup heading. */
function headingAllowance(geometry,settlement){
 assert(settlement&&settlement.intervals?.length>=3&&settlement.intervals.every(r=>Number.isSafeInteger(r.frames)&&r.frames>0&&Number.isFinite(r.seconds)&&r.seconds>0),'Missing actual settled-frame cadence');
 const seconds=settlement.intervals.reduce((n,r)=>n+r.seconds,0),frames=settlement.intervals.reduce((n,r)=>n+r.frames,0);
 assert(seconds>=.18&&Number.isFinite(settlement.meanFrameSeconds)&&settlement.meanFrameSeconds>0&&Math.abs(settlement.meanFrameSeconds-seconds/frames)<1e-10&&
  Number.isFinite(settlement.maximumHeadingDifference)&&settlement.maximumHeadingDifference>=0&&settlement.maximumHeadingDifference<.002,'Invalid actual settled-frame cadence');
 // Original main samples held A/D once per rendered loop; RideCore then
 // advances fixed steps at the existing 2.7rad/s turn rate, with main's
 // unchanged .05s simulation-dt cap. At steady30Hz,
 // a .09rad turn quantum can make a strict .04rad target unreachable.
 // Keep that desired target; any cadence allowance remains below the old
 // .15rad gate AND the complete lateral/stopping-envelope geometry.
 const limit=Math.atan2(geometry.maxLateral-.015,geometry.legLength+geometry.maxForward);
 return Math.min(.15,limit,Math.max(.04,Math.min(.05,settlement.meanFrameSeconds)*2.7/2+.002));
}
export async function turnExteriorHeading({heading,name,receipt,legLength,maxLateral,maxForward,motion,phase,setFirstPerson,focusCanvas,pulse,settleHeading}){
 assert([heading,legLength,maxLateral,maxForward].every(Number.isFinite)&&legLength>.4&&maxLateral>.015&&maxForward>=0,'Invalid native turn geometry');
 const geometry={legLength,maxLateral,maxForward,stationaryReserve:.015};
 Object.assign(receipt,{name,heading,desiredTolerance:.04,tolerance:null,geometry,acceptanceCadence:null,before:await motion(),pulses:[],after:null,complete:false});
 await phase(name+'-tpp');await setFirstPerson(false);await focusCanvas();
 let current=await settleHeading(name+'-initial-settled');
 for(let attempt=0;attempt<18;attempt++){
  const delta=angle(heading-current.actor.headingY);if(Math.abs(delta)<=headingAllowance(geometry,current.headingSettlement))break;
  const key=delta>0?'a':'d',milliseconds=Math.min(240,Math.max(8,Math.abs(delta)*1000/2.7*.75));
  const correction={name:name+'-pulse-'+attempt,key,milliseconds,before:current,after:null};receipt.pulses.push(correction);
  await phase(correction.name);await pulse(key,milliseconds);
  current=await settleHeading(correction.name+'-settled');correction.after=current;
  correction.observedTurnRadians=angle(current.actor.headingY-correction.before.actor.headingY);
  correction.noObservedHeadingChange=Math.abs(correction.observedTurnRadians)<1e-4;
 }
 receipt.acceptanceCadence=current.headingSettlement;receipt.tolerance=headingAllowance(geometry,current.headingSettlement);
 receipt.toleranceDerivation={desiredRadians:.04,originalLimitRadians:.15,turnRateRadiansPerSecond:2.7,originalMainStepLimitSeconds:.05,halfFrameQuantumRadians:Math.min(.05,current.headingSettlement.meanFrameSeconds)*2.7/2,
  settlingBoundRadians:.002,corridorLimitRadians:Math.atan2(maxLateral-.015,legLength+maxForward)};
 assert(Math.abs(angle(heading-current.actor.headingY))<=receipt.tolerance,'Native exterior pulse turn did not reach its recorded heading');
 await phase(name+'-fpp');await setFirstPerson(true);current=await settleHeading(name+'-final-settled');receipt.after=current;
 receipt.finalErrorRadians=Math.abs(angle(heading-current.actor.headingY));receipt.cadenceAllowanceUsed=receipt.finalErrorRadians>.04;
 assert(current.actor.onFoot&&current.actor.firstPerson,'Exterior turning changed out of the real walking camera');
 assert(Math.abs(angle(heading-current.actor.headingY))<=receipt.tolerance,'The actual heading changed after the native camera toggle');
 assert(distance(receipt.before.actor,current.actor)<.015,'A stationary exterior turn moved the actual actor');receipt.complete=true;return receipt;
}

export function assertExteriorEvidence(report){
 const evidence=report.nativeEvidence;
 assert(evidence&&!evidence.overflow&&evidence.events.length,'Missing complete exterior native input receipts');
 assert(evidence.events.every(e=>e.trusted),'Untrusted exterior input');
 assert.deepEqual(evidence.held,[]);assert.deepEqual(evidence.focusLossDuringInput,[]);
 assert(evidence.events.some(e=>e.type==='click'&&e.target==='#start'),'Missing native Start');
 for(const [title,action]of[['Belle Isle Aquarium','Travel to entrance'],['Anna Scripps Whitcomb Conservatory','Travel to path']])
  assert(evidence.events.some(e=>e.type==='click'&&e.landmark===title&&e.text===action),'Missing public exterior Guide action');
 for(const code of['KeyW','KeyF','KeyV'])for(const type of['keydown','keyup'])assert(evidence.events.some(e=>e.type===type&&e.code===code),'Missing exterior native '+code+' '+type);
 assert(report.groundFit?.structuralReceiptPassed,'Actual loaded ground/step/paving receipt failed');
 assert.equal(report.captures.length,4,'Both opposite views of both complete exteriors are required');
 assert.equal(report.exteriorViews.length,4);assert(report.exteriorLegs.length>0,'No genuine exterior walking');
 assert(report.exteriorTurns?.length===report.exteriorLegs.length,'Missing per-leg actual native heading receipts');
 for(const turn of report.exteriorTurns){
  assert(turn.complete&&turn.after.actor.onFoot&&turn.after.actor.firstPerson&&turn.tolerance===headingAllowance(turn.geometry,turn.acceptanceCadence),'Native exterior turn did not finish');
  const derivation=turn.toleranceDerivation;assert(derivation?.desiredRadians===.04&&derivation.originalLimitRadians===.15&&derivation.turnRateRadiansPerSecond===2.7&&derivation.originalMainStepLimitSeconds===.05&&derivation.settlingBoundRadians===.002&&
   derivation.halfFrameQuantumRadians===Math.min(.05,turn.acceptanceCadence.meanFrameSeconds)*2.7/2&&derivation.corridorLimitRadians===Math.atan2(turn.geometry.maxLateral-.015,turn.geometry.legLength+turn.geometry.maxForward),'Native turn tolerance derivation changed');
  assert(turn.finalErrorRadians===Math.abs(angle(turn.heading-turn.after.actor.headingY))&&turn.cadenceAllowanceUsed===(turn.finalErrorRadians>.04),'Missing actual final heading error');
  assert(Math.abs(angle(turn.heading-turn.after.actor.headingY))<=turn.tolerance&&distance(turn.before.actor,turn.after.actor)<.015,'Exterior heading or stationary position failed');
  for(const pulse of turn.pulses){
   assert(pulse.after&&pulse.milliseconds>=8&&pulse.milliseconds<=240,'Missing bounded native pulse receipt');
   for(const type of['keydown','keyup'])assert(evidence.events.some(e=>e.phase===pulse.name&&e.type===type&&e.code==='Key'+pulse.key.toUpperCase()),'Missing genuine native turn pulse '+type);
  }
 }
 for(const id of['107227742','107310050']){
  const views=report.exteriorViews.filter(v=>v.id===id);assert.equal(views.length,2);
  assert(Math.abs(angle(views[0].bearing-views[1].bearing))>=Math.PI*.8,'Exterior views do not cover opposite directions');
  for(const view of views){
   assert(view.before.completeBoundsInFrame&&view.after.completeBoundsInFrame,'A cropped exterior cannot pass');
   assert(view.before.selectedLevels.length===1&&view.after.selectedLevels.length===1,'Exterior LOD visibility is ambiguous');
   assert(report.captures.some(c=>c.id===id&&c.name===view.name&&c.sha256&&c.bytes>1000),'Missing actual complete-exterior PNG');
   for(const type of['pointerdown','pointermove','pointerup'])assert(evidence.events.some(e=>e.phase===view.name+'-aim'&&e.type===type),'Missing genuine camera drag '+type);
  }
 }
 for(const leg of report.exteriorLegs){
  assert(leg.after.frames>leg.before.frames+3&&distance(leg.before.actor,leg.after.actor)>.15,'Exterior walking has no genuine actor movement');
  assert(leg.trace.length>=2&&leg.coastTrace?.length>=4&&[...leg.trace,...leg.coastTrace].every(row=>row.actor.onFoot),'Exterior trajectory or coast is missing or changed walking mode');
  const dx=leg.goal.x-leg.before.actor.x,dz=leg.goal.z-leg.before.actor.z,length=Math.hypot(dx,dz);
  assert(length>.4&&Number.isFinite(leg.maxLateral)&&leg.maxLateral>0&&leg.ground.every(p=>p.walkable&&p.planningClearance>=.7),'Missing original-terrain route clearance');
  assert(leg.sweep?.clear&&leg.sweep.bodyRadius===.27&&JSON.stringify(leg.sweep.bodyHeights)==='[0.62,1.1,1.58]'&&leg.sweep.maxLateral===leg.maxLateral,'Missing unchanged native body/corridor sweep');
  assert(distance(leg.sweep.from,leg.before.actor)<.015&&distance(leg.sweep.to,leg.goal)<1e-7,'Body sweep does not describe this actual leg');
  const turn=report.exteriorTurns.find(turn=>turn.name===leg.name+'-turn');assert(turn&&turn.geometry.maxLateral===leg.maxLateral&&turn.geometry.maxForward===leg.sweep.maxForward&&Math.abs(turn.geometry.legLength-length)<.015,'Heading tolerance does not describe the actual leg');
  assert(Math.abs(angle(Math.atan2(dx,dz)-leg.before.actor.headingY))<=Math.min(.15,Math.atan2(leg.maxLateral-.015,length+leg.sweep.maxForward)),'Actual walking heading exceeds its original/corridor bound');
  assert(leg.sweep.samples?.length>0&&leg.sweep.samples.every(sample=>sample.clear&&sample.groundClear&&sample.step>0&&sample.step<=.25+1e-8&&
   Math.abs(sample.rayLength-sample.step-.3)<1e-8&&Math.abs(sample.acceptedBeyond-sample.step-.27)<1e-8&&Math.abs(sample.corridorRadius-.27-leg.maxLateral)<1e-8&&
   [sample.bodyHits,sample.corridorHits].every(hits=>hits.length===3&&hits.every(hit=>hit===null||Number.isFinite(hit)&&hit>sample.acceptedBeyond))&&sample.headHit===null&&sample.corridorHeadHit===null),'Original body/corridor raw hit receipt failed');
  for(const row of[...leg.trace,...leg.coastTrace,leg.after]){
   const x=row.actor.x-leg.before.actor.x,z=row.actor.z-leg.before.actor.z;
   assert(Math.abs(x*dz-z*dx)/length<=leg.maxLateral,'Observed native trajectory left its measured lateral corridor');
   assert((x*dx+z*dz)/length<=length+leg.sweep.maxForward,'Observed native trajectory passed its swept stopping envelope');
  }
  const afterX=leg.after.actor.x-leg.before.actor.x,afterZ=leg.after.actor.z-leg.before.actor.z;
  assert((afterX*dx+afterZ*dz)/length>=length-.1,'The actual actor did not reach the recorded leg goal');
  for(const type of['keydown','keyup'])assert(evidence.events.some(e=>e.phase===leg.name&&e.type===type&&e.code==='KeyW'),'Missing genuine exterior leg '+type);
 }
}

export async function runExteriorProof({page,report,phase,motion,snapshot,guideAction,dismount,focusCanvas,keyDown,keyUp,waitMotion,settle,frames,capture,trace}){
 report.exteriorViews=[];report.exteriorLegs=[];report.exteriorTurns=[];report.exteriorPlans=[];
 report.exteriorProspectiveRoutes=[];report.exteriorPlanning=[];
 report.manualVisualReviewRequired=true;report.appearanceAccepted=null;report.occlusionAccepted=null;report.collisionAccepted=null;
 report.groundFit=await page.evaluate(()=>window.__stagedLandmarkProof.groundFit());assert(report.groundFit.structuralReceiptPassed,'Actual original terrain and loaded walking surfaces disagree');
 const queryGround=points=>page.evaluate(points=>window.__stagedLandmarkProof.routeGround(points),points);
 const querySweeps=segments=>page.evaluate(segments=>window.__stagedLandmarkProof.routeSweeps(segments),segments);
 const exterior=id=>page.evaluate(id=>window.__stagedLandmarkProof.exterior(id),id);
 async function setFirstPerson(wanted){
  if((await motion()).actor.firstPerson!==wanted){await focusCanvas();await pulse('v',0);await frames(3);}
  assert.equal((await motion()).actor.firstPerson,wanted,'Exterior native V did not change the real camera');
 }
 async function settleHeading(name){
  await phase(name);
  const handle=await page.waitForFunction(name=>{
   const e=window.__stagedWalkNativeEvidence,row=window.__stagedLandmarkProof.motion();
   if(!row.actor?.onFoot)throw Error('Exterior turn left native on-foot mode');
   const rows=e.traces[name]??=[];if(!rows.length||rows.at(-1).frames!==row.frames){if(rows.length>=4096){e.overflow=true;throw Error('Exterior turn trace overflow');}rows.push(row);}
   const tail=rows.filter(r=>row.time-r.time<=.22);if(tail.length<4||row.time-tail[0].time<.18)return false;
   if(!tail.every(r=>Math.abs(Math.atan2(Math.sin(row.actor.headingY-r.actor.headingY),Math.cos(row.actor.headingY-r.actor.headingY)))<.002&&Math.hypot(row.actor.x-r.actor.x,row.actor.z-r.actor.z)<.015))return false;
   return{...row,headingSettlement:{phase:name,firstFrame:tail[0].frames,lastFrame:row.frames,timeSpan:row.time-tail[0].time,
    intervals:tail.slice(1).map((r,i)=>({frames:r.frames-tail[i].frames,seconds:r.time-tail[i].time})),
    meanFrameSeconds:(row.time-tail[0].time)/(row.frames-tail[0].frames),maximumHeadingDifference:Math.max(...tail.map(r=>Math.abs(Math.atan2(Math.sin(row.actor.headingY-r.actor.headingY),Math.cos(row.actor.headingY-r.actor.headingY)))))}};
  },name,{polling:'raf',timeout:90_000});
  try{return await handle.jsonValue();}finally{await handle.dispose();}
 }
 const pulse=async(key,milliseconds)=>{await keyDown(key);try{await new Promise(resolve=>setTimeout(resolve,milliseconds));}finally{await keyUp(key);}};
 async function walkRoute(route,label,replan){
  const prospectiveReceipt={};report.exteriorProspectiveRoutes.push(prospectiveReceipt);
  for await(const {name,from:current,length,goal,ground,maxLateral}of exteriorLegProposals({route,label,motion,phase,queryGround,querySweeps,replan,receipt:prospectiveReceipt})){
   assert(ground.every(p=>p.walkable),'Observed actor route approaches an original obstruction');
   const turn={};report.exteriorTurns.push(turn);let before,dx,dz,actualLength,sweep,leg;
   try{
   await turnExteriorHeading({heading:Math.atan2(goal.x-current.x,goal.z-current.z),name:name+'-turn',receipt:turn,legLength:length,maxLateral,maxForward:.75,motion,phase,setFirstPerson,focusCanvas,pulse,settleHeading});
   await phase(name);await focusCanvas();before=await motion();
   dx=goal.x-before.actor.x;dz=goal.z-before.actor.z;actualLength=Math.hypot(dx,dz);
   assert(Math.abs(angle(Math.atan2(dx,dz)-before.actor.headingY))<=Math.min(.15,Math.atan2(maxLateral-.015,actualLength+.75)),'Native exterior heading exceeds the actual swept corridor');
   sweep=(await querySweeps([{from:before.actor,to:goal,maxLateral,maxForward:.75}]))[0];
   leg={name,before,after:null,goal,ground,maxLateral,sweep,trace:[],coastTrace:[]};report.exteriorLegs.push(leg);
   assert(sweep.clear,'The actual exterior leg or stopping corridor intersects an original native body obstacle');
   }catch(error){
    prospectiveReceipt.rejected.push({name,stage:turn.complete?'post-turn':'turn',nativeWIssued:false,turnIndex:report.exteriorTurns.length-1,turn,before:before??null,goal,ground,maxLateral,sweep:sweep??null,error:String(error)});throw error;
   }
   let movementFailure;
   await keyDown('w');try{await waitMotion({type:'world-target',x:before.actor.x,z:before.actor.z,dx:dx/actualLength,dz:dz/actualLength,length:actualLength,maxLateral},90_000);}catch(error){movementFailure=error;leg.movementError=String(error);}finally{await keyUp('w');}
   try{await settle(name);}catch(error){leg.settleError=String(error);throw error;}const after=await motion();Object.assign(leg,{after,trace:await trace(name),coastTrace:await trace('settle-'+name)});
   if(movementFailure)throw movementFailure;
   for(const row of[...leg.trace,...leg.coastTrace,after]){
    const x=row.actor.x-before.actor.x,z=row.actor.z-before.actor.z;
    assert(Math.abs(x*dz-z*dx)/actualLength<=maxLateral,'Native exterior coast left its measured route corridor');
    assert((x*dx+z*dz)/actualLength<=actualLength+sweep.maxForward,'Native exterior coast passed its swept stopping envelope');
   }
   assert(after.frames>before.frames+3&&distance(before.actor,after.actor)>.15,'Native exterior walk did not advance');
  }
 }
 async function aim(id,name){
  await phase(name+'-aim');
  for(let attempt=0;attempt<24;attempt++){
   const read=await exterior(id),center=read.bounds.center,camera=read.camera;
   const yaw=Math.atan2(camera.direction[0],camera.direction[2]),desiredYaw=Math.atan2(center[0]-camera.position[0],center[2]-camera.position[2]);
   const pitch=Math.atan2(-camera.direction[1],Math.hypot(camera.direction[0],camera.direction[2]));
   const desiredPitch=Math.atan2(camera.position[1]-center[1],Math.hypot(center[0]-camera.position[0],center[2]-camera.position[2]));
   const yawDelta=angle(desiredYaw-yaw),pitchDelta=desiredPitch-pitch;
   if(Math.abs(yawDelta)<.012&&Math.abs(pitchDelta)<.012){assert(read.completeBoundsInFrame,'Aimed camera still crops the actual full-model bounds');return read;}
   // Normal look sensitivity in the untouched fresh context. Read the actual
   // camera after every trusted canvas drag, so ignored input fails the bound.
   const {width,height}=report.viewport,x=width*.5,y=height*.48,clamp=(v,m)=>Math.max(-m,Math.min(m,v));
   await page.mouse.move(x,y);await page.mouse.down();
   try{await page.mouse.move(x+clamp(-yawDelta/.003,width*.3),y+clamp(pitchDelta/.002,height*.2),{steps:4});}finally{await page.mouse.up();}
   await frames(3);
  }
  throw Error('Native pointer aiming did not reach the complete exterior');
 }
 for(const [id,label,action]of[['107227742','aquarium','Travel to entrance'],['107310050','conservatory','Travel to path']]){
  await guideAction(id,action);await dismount();
  const current=await snapshot(),site=current.sites.find(s=>s.id===id),initial=await exterior(id);assert(initial.ready);
  const plannerReceipt={id,label};report.exteriorPlanning.push(plannerReceipt);
  const queryViewBounds=()=>page.evaluate(id=>window.__stagedLandmarkProof.viewObstructions(id),id);
  const planner=await createExteriorPlanner({bounds:initial.bounds,camera:initial.camera,layout:report.layout,queryGround,querySweeps,queryViewBounds,receipt:plannerReceipt});
  // Diagonal front/side and opposite rear/side directions expose all four
  // exterior orientations while preserving real surrounding scenery.
  const front=id==='107227742'?Math.atan2(Math.sin(site.layout.yaw),Math.cos(site.layout.yaw)):Math.atan2(-Math.cos(site.layout.yaw),Math.sin(site.layout.yaw));
  let oppositeBearing=null;
  for(const [suffix,bearing]of[['front-side',front+Math.PI/4],['rear-side',front+Math.PI*1.25]]){
   const name=label+'-complete-'+suffix;await phase(name+'-plan');
   const route=await planner.route((await motion()).actor,bearing,oppositeBearing);report.exteriorPlans.push({name,id,route});await walkRoute(route,name,start=>planner.route(start,bearing,oppositeBearing));
   const before=await aim(id,name);await capture(name,id,{near:false});const after=await exterior(id);
   assert(after.completeBoundsInFrame,'The real capture camera cropped the model');
   const actualBounds=await queryViewBounds();assert(actualBounds,'Missing loaded-view observation after actual capture');
   const actualViewAdvice=scoreExteriorViewpoint(actualBounds,after.camera.position);
   oppositeBearing=Math.atan2(after.camera.position[0]-after.bounds.center[0],after.camera.position[2]-after.bounds.center[2]);
   report.exteriorViews.push({id,name,bearing:oppositeBearing,route,before,after,actualViewAdvice});
  }
 }
 report.exteriorReview='Four native full-model-bounds PNGs: opposite front/side and rear/side views of both buildings. Framing and original terrain receipts are automated; architectural appearance, surrounding-scene occlusion and remaining fit acceptance require independent review of these actual PNGs. No surveyed measurements or complete collider parity are claimed.';
}
