import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import {alignScottMap} from './fountainLayout.ts';
import {HoverController,flightAxis} from './hoverController.ts';
import {makeRiverTraffic} from './riverTrafficPlan.ts';
import {ParkTerrain,segment,inside,type ParkMap} from './terrain.ts';
import {trialCourses} from './trialCourses.ts';
import {createTrialPaceGhost,sampleTrialGhost,trialGhostFingerprint,TrialGhostRecorder,TrialGhostStore,TRIAL_GHOST_STORAGE_KEY,TRIAL_GHOST_SAMPLE_SECONDS,TRIAL_GHOST_MAX_SAMPLES,type TrialGhostInput,type TrialGhostTrack} from './trialGhost.ts';
import {TrialRun,type TrialCourse,type TrialPoint,type TrialPose} from './trialRules.ts';

const map=JSON.parse(fs.readFileSync('public/belle/map.json','utf8')) as ParkMap;
alignScottMap(map);
const terrain=new ParkTerrain(map),courses=trialCourses(map,terrain);
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const angle=(n:number)=>Math.atan2(Math.sin(n),Math.cos(n));
const pose=(course:TrialCourse,p:TrialPoint,heading:number):TrialPose=>({...p,heading,vehicle:course.vehicle,onFoot:false});

function samples(course:TrialCourse,visit:(p:TrialPoint,direction:{x:number;y:number;z:number})=>void){
 for(let i=1;i<course.path.length;i++){
  const a=course.path[i-1],b=course.path[i],span=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(span);
  for(let j=0;j<=steps;j++){
   const t=j/steps;visit({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},{x:(b.x-a.x)/span,y:0,z:(b.z-a.z)/span});
  }
 }
}

test('the catalog leads with four whole-island circuits and preserves three practice identities',()=>{
 assert.equal(courses.length,7);
 assert.equal(new Set(courses.map(c=>c.id)).size,7);
 const featured=courses.slice(0,4),practice=courses.slice(4);
 assert(featured.every(c=>c.category==='island'));
 assert.equal(featured.filter(c=>c.vehicle==='onewheel').length,2);
 assert.equal(featured.filter(c=>c.vehicle==='hoverbike').length,2);
 assert(practice.every(c=>c.category==='practice'&&c.description.startsWith('Practice sprint.')));
 assert.deepEqual(practice.map(c=>c.id),['onewheel-island-cup-v1','sky-bridge-v1','sky-sunset-v1']);
 assert.deepEqual(practice.map(c=>c.name),['One-Wheel Island Cup','Bridge Skyline','Sunset Halo']);
 assert.deepEqual(practice.map(c=>c.gates.length),[16,18,16]);
 const wheel=practice[0],road=map.roads.find(r=>r.id==='8733696')!;
 assert(wheel.distance>320&&wheel.distance<340);
 assert.equal(wheel.path.length,road.points.length);
 for(const course of courses){
  assert(course.distance>0&&Number.isFinite(course.distance));
  assert(course.targetSeconds!>course.distance/course.maxSpeed);
  const first=course.gates[0],finish=course.gates.at(-1)!;
  assert((course.start.x-first.x)*Math.sin(first.heading)+(course.start.z-first.z)*Math.cos(first.heading)<0,'first gate must be ahead');
  assert(Math.hypot(finish.x-course.start.x,finish.y-course.start.y,finish.z-course.start.z)<.001,'finish closes the loop');
  assert(Math.hypot(course.path.at(-1)!.x-course.start.x,course.path.at(-1)!.z-course.start.z)<.001,'route line closes the loop');
  assert(new TrialRun(course));
 }
});

test('the long courses cover the whole island, with genuinely different routes and bounded checkpoint counts',()=>{
 const featured=courses.filter(c=>c.category==='island');
 for(const course of featured){
  assert(course.distance>8500&&course.distance<11500,`${course.id}: full island distance`);
  assert(course.gates.length>=60&&course.gates.length<=140,`${course.id}: readable gate spacing`);
  const guide=createTrialPaceGhost(course);assert(guide,`${course.id}: a finite guide can follow the complete route`);
  assert.equal(guide.seconds,course.targetSeconds,'guide completes at the authored target time');
  const xs=course.path.map(p=>p.x),zs=course.path.map(p=>p.z);
  assert(Math.max(...xs)-Math.min(...xs)>3500,'visit both ends of the island driving loop');
  assert(Math.max(...zs)-Math.min(...zs)>1800,'visit the north and south shores');
  if(course.vehicle==='hoverbike'){
   const ring=course.path.map(p=>[p.x,p.z] as [number,number]);
   assert(map.island.every(p=>inside(p[0],p[1],ring)),'Sky routes wrap the complete shoreline, including the eastern wetland tip');
  }
 }
 const [perimeter,garden,coast,crown]=featured;
 assert(garden.distance>perimeter.distance+900,'garden route adds a distinct inland section');
 assert(crown.distance>coast.distance+450,'outer flight line has different river bends');
 assert(Math.max(...coast.path.map(p=>p.y))<Math.max(...crown.path.map(p=>p.y))-2,'air circuits have distinct height profiles');
 assert(Math.cos(perimeter.start.heading-garden.start.heading)<.9,'ground starts follow different directions');
 assert(Math.cos(coast.start.heading-crown.start.heading)<-.9,'air circuits run in opposite directions');
});

test('both full wheel courses follow unobstructed driving roads across every route sample',()=>{
 const roads=map.roads.filter(r=>!r.foot&&r.width>=6);
 for(const course of courses.filter(c=>c.category==='island'&&c.vehicle==='onewheel')){
  samples(course,p=>{
   assert(terrain.land(p.x,p.z),`${course.id}: water at ${p.x},${p.z}`);
   assert(!terrain.obstructed(p.x,p.z,2),`${course.id}: blocked road at ${p.x},${p.z}`);
   assert(Math.abs(p.y-terrain.height(p.x,p.z))<.06,'path follows the bridge approach ramp');
  });
  for(const gate of course.gates){
   const road=roads.find(r=>gate.radius<=r.width/2-1&&r.points.slice(1).some((p,i)=>segment(gate.x,gate.z,r.points[i],p).d<.01));
   assert(road,`${course.id}: checkpoint opening must fit a mapped driving road`);
  }
 }
});

test('each complete authored centerline crosses all forward checkpoints in order',()=>{
 for(const course of courses){
  const run=new TrialRun(course);run.step(3,pose(course,course.start,course.start.heading));
  let previous=course.start as TrialPoint;
  for(let i=1;i<course.path.length&&run.status==='running';i++){
   const target=course.path[i],span=Math.hypot(target.x-previous.x,target.y-previous.y,target.z-previous.z);
   assert(span>0,`${course.id}: no zero-length path segment`);
   run.step(span/10,pose(course,target,Math.atan2(target.x-previous.x,target.z-previous.z)));
   previous=target;
  }
  assert.equal(run.status,'finished',`${course.id}: centerline stopped at gate ${run.next}`);
  assert.equal(run.splits.length,course.gates.length);
 }
});

test('generated pace guides complete every authored gate in order at their target times',()=>{
 for(const course of courses){
  const guide=createTrialPaceGhost(course);assert(guide,`${course.id}: guide is available`);
  const run=new TrialRun(course);run.step(3,pose(course,course.start,course.start.heading));
  for(let i=1;i<guide.samples.length&&run.status==='running';i++){
   const sample=guide.samples[i],seconds=sample.time-guide.samples[i-1].time;
   run.step(seconds,pose(course,sample,sample.heading));
  }
  assert.equal(run.status,'finished',`${course.id}: guide stopped at gate ${run.next}: ${run.reason}`);
  assert.equal(run.splits.length,course.gates.length);
  assert(Math.abs(run.finish!-guide.seconds)<1e-6,`${course.id}: guide reaches the finish at its target`);
 }
});

test('the complete Fountain Drive route has clear land and road-width gates',()=>{
 const course=courses.find(c=>c.id==='onewheel-island-cup-v1')!,road=map.roads.find(r=>r.id==='8733696')!;
 samples(course,p=>{
  assert(terrain.land(p.x,p.z));
  assert(!terrain.obstructed(p.x,p.z,2),`blocked road at ${p.x},${p.z}`);
  assert.equal(p.y,terrain.height(p.x,p.z));
 });
 for(const gate of course.gates){
  const roadDistance=Math.min(...road.points.slice(1).map((p,i)=>segment(gate.x,gate.z,road.points[i],p).d));
  assert(roadDistance<.001);
  assert(gate.radius<=road.width/2-1);
 }
});

test('air routes are reachable above physical obstacles, vessels and nearby tree crowns',()=>{
 const placements=JSON.parse(fs.readFileSync('public/belle/nature/placements.json','utf8')) as {trees:{id:string;x:number;y:number;z:number;scale:number;heightScale?:number}[]};
 const manifest=JSON.parse(fs.readFileSync('public/belle/nature/manifest.json','utf8')) as {trees:{id:string;height:number;cardSize:number}[]};
 const vesselCeiling=Math.max(...makeRiverTraffic(map).map(v=>v.height));
 for(const course of courses.filter(c=>c.vehicle==='hoverbike')){
  const hover=new HoverController(terrain,course.start);
  for(const gate of course.gates)assert(gate.y-gate.halfHeight>vesselCeiling+1,'the entire gate opening must clear moving vessels');
  samples(course,(p,direction)=>{
   const clearance=p.y-hover.floor(p.x,p.z);
   assert(clearance>1.4&&clearance<=36,`${course.id}: unreachable altitude`);
   assert(p.y>vesselCeiling+2,'route center must remain above moving vessel collision boxes');
   for(const height of [.22,.95,1.85])assert.equal(terrain.raycastFlight({...p,y:p.y+height},direction,1.3,1.02),null,`${course.id}: physical obstacle`);
  });
  for(const tree of placements.trees){
   const asset=manifest.trees.find(t=>t.id===tree.id)!;
   const canopyRadius=asset.cardSize*tree.scale*.5,top=tree.y+asset.height*tree.scale*(tree.heightScale??1);
   for(let i=1;i<course.path.length;i++){
    const a=course.path[i-1],b=course.path[i],near=segment(tree.x,tree.z,[a.x,a.z],[b.x,b.z]);
    if(near.d<=canopyRadius+1.02)assert(a.y+(b.y-a.y)*near.t-top>2,`${course.id}: route crosses a tree crown`);
   }
  }
 }
});

test('a rider completes every Cup gate using normal RideCore movement',()=>{
 const course=courses.find(c=>c.id==='onewheel-island-cup-v1')!,run=new TrialRun(course);
 const core=new RideCore(terrain,{spawn:{position:course.start,headingY:course.start.heading}});
 run.step(3,pose(course,core.current,core.current.headingY));
 for(let i=0;i<60*160&&run.status==='running';i++){
  const p=core.current,g=course.gates[run.next],look=4;
  const desired=Math.atan2(g.x+Math.sin(g.heading)*look-p.x,g.z+Math.cos(g.heading)*look-p.z);
  core.advance(1/60,{steer:clamp(-angle(desired-p.headingY)*2.4),throttle:clamp((6-p.speed)*.42,-.65,.8)});
  assert(!core.controller.crashed,'normal wheel handling must finish without a fall');
  run.step(1/60,pose(course,core.current,core.current.headingY));
 }
 assert.equal(run.status,'finished',`gate ${run.next}: ${run.reason}`);
 assert.equal(run.splits.length,course.gates.length);
});

/** Convert a desired axis response into the controller's normal exponential input. */
function inputAxis(response:number){
 const sign=Math.sign(response),target=Math.abs(clamp(response));let lo=0,hi=1;
 for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(flightAxis(mid)<target)lo=mid;else hi=mid;}
 return sign*(lo+hi)/2;
}

for(const course of courses.filter(c=>c.vehicle==='hoverbike'&&c.category==='practice'))test(`normal drone controls complete all gates: ${course.name}`,()=>{
 const hover=new HoverController(terrain,course.start),run=new TrialRun(course);
 hover.setMode('drone');assert(hover.startFlight(course.start),'the authored airborne start must be accepted');
 run.step(3,pose(course,hover.pose,hover.pose.heading));
 for(let i=0;i<60*240&&run.status==='running';i++){
  const p=hover.pose,g=course.gates[run.next],look=8;
  const desired=Math.atan2(g.x+Math.sin(g.heading)*look-p.x,g.z+Math.cos(g.heading)*look-p.z),turn=angle(desired-p.heading);
  const clearance=g.y-hover.floor(p.x,p.z),level=Math.abs(p.y-g.y)<2.2;
  hover.advance(1/60,{
   steer:inputAxis(-turn*1.8/1.05),
   throttle:level&&Math.abs(turn)<.6?inputAxis(12/21):0,
   lift:inputAxis((clearance-hover.clearance)*2/5),brake:false,boost:false,
  });
  assert(!hover.collision,`${course.id}: collision before gate ${run.next}`);
  run.step(1/60,pose(course,hover.pose,hover.pose.heading));
 }
 assert.equal(run.status,'finished',`gate ${run.next}: ${run.reason}; pose ${JSON.stringify(hover.pose)}`);
 assert.equal(run.splits.length,course.gates.length);
});

/** Test-only route reader. It only chooses ordinary inputs; it never changes a vehicle pose. */
function routeReader(course:TrialCourse){
 const stations=[0];
 for(let i=1;i<course.path.length;i++)stations.push(stations[i-1]+Math.hypot(course.path[i].x-course.path[i-1].x,course.path[i].y-course.path[i-1].y,course.path[i].z-course.path[i-1].z));
 const total=stations.at(-1)!;let cursor=0,progress=0;
 const pointAt=(meters:number):TrialPoint=>{
  const wrapped=((meters%total)+total)%total;let lo=0,hi=stations.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(stations[mid]<=wrapped)lo=mid;else hi=mid;}
  const a=course.path[lo],b=course.path[hi],t=(wrapped-stations[lo])/(stations[hi]-stations[lo]);
  return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
 };
 const headingAt=(meters:number)=>{const a=pointAt(meters-.6),b=pointAt(meters+.6);return Math.atan2(b.x-a.x,b.z-a.z);};
 return{pointAt,headingAt,update(p:TrialPoint){
  let nearest=Infinity,next=cursor,value=progress;
  for(let i=Math.max(0,cursor-2);i<Math.min(course.path.length-1,cursor+20);i++){
   const a=course.path[i],b=course.path[i+1],s=segment(p.x,p.z,[a.x,a.z],[b.x,b.z]);
   if(s.d<nearest){nearest=s.d;next=i;value=stations[i]+(stations[i+1]-stations[i])*s.t;}
  }
  cursor=Math.max(cursor,next);progress=Math.max(progress,value);return{meters:progress,distance:nearest};
 }};
}

/** Exercise the real recording/archive path with controller poses, using isolated test storage. */
function lapReplay(course:TrialCourse){
 const recorder=new TrialGhostRecorder(course),probes:{time:number;pose:TrialGhostInput}[]=[];
 let completed:TrialGhostTrack|null=null,frames=0;
 return{
  observe(run:TrialRun,input:TrialGhostInput){
   if(run.status==='running'){
    assert(recorder.record(run.elapsed,input),`${course.id}: recorder accepts continuous normal movement`);
    // These actual-frame probes deliberately include times between stored replay samples.
    if(++frames%401===3)probes.push({time:run.elapsed,pose:{...input}});
   }else if(run.status==='finished'){
    completed=recorder.finish(run,input);
    assert(completed,`${course.id}: a completed controller lap produces a recorded ghost`);
   }
  },
  verify(run:TrialRun,thinned=false){
   assert(completed,`${course.id}: finish was recorded before any reset`);
   assert.equal(recorder.recording,false);
   assert.equal(completed.kind,'recorded');
   assert.equal(completed.seconds,run.finish);
   assert.equal(completed.fingerprint,trialGhostFingerprint(course));
   assert.deepEqual(completed.splits,run.splits);
   assert(completed.samples.length<=TRIAL_GHOST_MAX_SAMPLES);
   const final=completed.samples.at(-1)!,gate=course.gates.at(-1)!;
   assert.equal(final.time,run.finish);
   assert(Math.abs((final.x-gate.x)*Math.sin(gate.heading)+(final.z-gate.z)*Math.cos(gate.heading))<1e-8,'recording ends at the fractional finish-plane crossing');
   const memory=new Map<string,string>(),storage={
    getItem(key:string){assert.equal(key,TRIAL_GHOST_STORAGE_KEY);return memory.get(key)??null;},
    setItem(key:string,value:string){assert.equal(key,TRIAL_GHOST_STORAGE_KEY);memory.set(key,value);},
   };
   assert.deepEqual(new TrialGhostStore(storage).save(completed),{improved:true,saved:true,seconds:run.finish});
   assert.deepEqual([...memory.keys()],[TRIAL_GHOST_STORAGE_KEY]);
   const restored=new TrialGhostStore(storage).best(course);
   assert(restored,`${course.id}: a fresh archive reload accepts the completed course trajectory`);
   assert.equal(restored.fingerprint,trialGhostFingerprint(course));
   assert.equal(restored.seconds,run.finish);
   assert.deepEqual(restored.splits,run.splits);
   assert.equal(restored.samples.length,completed.samples.length);
   const replayFinish=sampleTrialGhost(restored,run.finish!);
   assert(replayFinish);
   assert(Math.hypot(replayFinish.x-final.x,replayFinish.y-final.y,replayFinish.z-final.z)<.01,'saved replay preserves the final position to storage precision');
   let maxReplayError=0,interpolated=0;
   for(const probe of probes){
    const replay=sampleTrialGhost(restored,probe.time);assert(replay);
    const error=Math.hypot(replay.x-probe.pose.x,replay.y-probe.pose.y,replay.z-probe.pose.z);
    maxReplayError=Math.max(maxReplayError,error);
    assert(error<.5,`${course.id}: archived interpolation stays near the actual controller at ${probe.time.toFixed(2)} s`);
    assert(Math.abs(angle(replay.heading-probe.pose.heading))<.2,'replay heading follows the actual rider through bends');
    if(!restored.samples.some(sample=>Math.abs(sample.time-probe.time)<1e-8))interpolated++;
   }
   assert(interpolated>20,'verify many actual controller poses between archived samples');
   if(thinned){
    const boundary=(TRIAL_GHOST_MAX_SAMPLES-1)*TRIAL_GHOST_SAMPLE_SECONDS;
    assert(run.finish!>boundary,'the active race exceeds the recorder thinning boundary');
    assert(restored.samples[1].time>=TRIAL_GHOST_SAMPLE_SECONDS*2-1e-8,'older samples were actually thinned');
    assert(probes.some(probe=>probe.time>boundary),'interpolation is also checked after thinning begins');
   }
   return{samples:restored.samples.length,maxReplayError};
  },
 };
}

for(const course of courses.filter(c=>c.vehicle==='onewheel'&&c.category==='island'))test(`normal wheel controls complete the full circuit: ${course.name}`,t=>{
 const run=new TrialRun(course),route=routeReader(course),core=new RideCore(terrain,{spawn:{position:course.start,headingY:course.start.heading}}),replay=lapReplay(course);
 const riderPose=():TrialGhostInput=>({...pose(course,core.current,core.current.headingY),pitch:core.current.wheelPitch,roll:core.current.groundRoll*.25-core.current.rollAngle});
 run.step(3,pose(course,core.current,core.current.headingY));let deviation=0;
 replay.observe(run,riderPose());
 const idleSeconds=course.id==='onewheel-garden-grand-tour-v1'?50:0;
 // Active normal-input idle, not pause: extend this real lap past 1,200 s to exercise replay thinning.
 for(let frame=0;frame<30*idleSeconds;frame++){
  core.advance(1/30,{});run.step(1/30,riderPose());
  assert.equal(run.status,'running');assert(!core.controller.crashed);
  replay.observe(run,riderPose());
 }
 for(let frame=0;frame<30*course.targetSeconds!*1.2&&run.status==='running';frame++){
  const p=core.current,position=route.update(p),heading=route.headingAt(position.meters);
  deviation=Math.max(deviation,position.distance);
  const turn=Math.max(...[6,16,30].map(ahead=>Math.abs(angle(route.headingAt(position.meters+ahead)-heading))));
  const targetSpeed=clamp(12/(1+turn*4),3.2,12),look=clamp(Math.abs(p.speed)*.4+3,3.5,8);
  const target=route.pointAt(position.meters+look),desired=Math.atan2(target.x-p.x,target.z-p.z);
  core.advance(1/30,{steer:clamp(-angle(desired-p.headingY)*2.4),throttle:clamp((targetSpeed-p.speed)*.7,-.95,.85)});
  assert(!core.controller.crashed,`${course.id}: fall before gate ${run.next} at ${p.x},${p.z}`);
  run.step(1/30,pose(course,core.current,core.current.headingY));
  replay.observe(run,riderPose());
 }
 assert.equal(run.status,'finished',`${course.id}: gate ${run.next}, ${run.reason}; pose ${JSON.stringify(core.current)}`);
 assert.equal(run.splits.length,course.gates.length);
 assert(run.finish!<course.targetSeconds!,`normal controls finish in ${run.finish!.toFixed(2)} s, within the ${course.targetSeconds} s guide target`);
 assert(deviation<4,'the whole simulated lap remains within the mapped road corridor');
 const archived=replay.verify(run,idleSeconds>0);
 t.diagnostic(`${course.distance.toFixed(0)} m, ${course.gates.length} gates, ${run.finish!.toFixed(2)} s using normal inputs${idleSeconds?` including ${idleSeconds} s active idle`:''}; max road-center deviation ${deviation.toFixed(2)} m; archived ${archived.samples} replay samples, max interpolated error ${archived.maxReplayError.toFixed(3)} m`);
});

for(const course of courses.filter(c=>c.vehicle==='hoverbike'&&c.category==='island'))test(`normal drone controls complete the full island: ${course.name}`,t=>{
 const hover=new HoverController(terrain,course.start),run=new TrialRun(course),route=routeReader(course),replay=lapReplay(course);
 const riderPose=():TrialGhostInput=>({...pose(course,hover.pose,hover.pose.heading),pitch:hover.pose.pitch,roll:hover.pose.roll});
 hover.setMode('drone');assert(hover.startFlight(course.start));
 run.step(3,pose(course,hover.pose,hover.pose.heading));let deviation=0;
 replay.observe(run,riderPose());
 for(let frame=0;frame<30*course.targetSeconds!*1.2&&run.status==='running';frame++){
  const p=hover.pose,position=route.update(p),target=route.pointAt(position.meters+14),current=route.pointAt(position.meters);
  deviation=Math.max(deviation,position.distance);
  const desired=Math.atan2(target.x-p.x,target.z-p.z),turn=angle(desired-p.heading),clearance=current.y-hover.floor(p.x,p.z);
  hover.advance(1/30,{
   steer:inputAxis(-turn*1.8/1.05),throttle:Math.abs(p.y-current.y)<2.2&&Math.abs(turn)<.6?inputAxis(16/21):0,
   lift:inputAxis((clearance-hover.clearance)*2/5),brake:false,boost:false,
  });
  assert(!hover.collision,`${course.id}: collision before gate ${run.next} at ${p.x},${p.z}`);
  run.step(1/30,pose(course,hover.pose,hover.pose.heading));
  replay.observe(run,riderPose());
 }
 assert.equal(run.status,'finished',`${course.id}: gate ${run.next}, ${run.reason}; pose ${JSON.stringify(hover.pose)}`);
 assert.equal(run.splits.length,course.gates.length);
 assert(run.finish!<course.targetSeconds!,`normal unboosted controls finish in ${run.finish!.toFixed(2)} s, within the ${course.targetSeconds} s guide target`);
 assert(deviation<6,'the complete simulated flight stays near the marked route');
 const archived=replay.verify(run);
 t.diagnostic(`${course.distance.toFixed(0)} m, ${course.gates.length} gates, ${run.finish!.toFixed(2)} s using normal unboosted controls; max route deviation ${deviation.toFixed(2)} m; archived ${archived.samples} replay samples, max interpolated error ${archived.maxReplayError.toFixed(3)} m`);
});
