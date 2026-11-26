import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ParkTerrain} from '../src/belle/terrain.ts';
import {STUDY_SITES} from '../src/belle/stagedLandmarkStudies.ts';
import {readStagedExterior,readStagedRouteGround,readStagedRouteSweeps} from '../src/belle/stagedLandmarkGroundFit.ts';
import {RideCore} from '../runtime/ride-core/src/ridecore.ts';
import {createExteriorPlanner,assertExteriorEvidence,turnExteriorHeading} from './staged-landmark-exterior-proof.mjs';

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
  queryGround:points=>points.map(p=>({...p,height:2,walkable:Math.abs(p.x-2.17)>.3})),querySweeps:segments=>segments.map(()=>({clear:true,samples:[]}))});
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
