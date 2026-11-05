import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import {alignScottMap} from './fountainLayout.ts';
import {HoverController,flightAxis} from './hoverController.ts';
import {makeRiverTraffic} from './riverTrafficPlan.ts';
import {ParkTerrain,segment,type ParkMap} from './terrain.ts';
import {trialCourses} from './trialCourses.ts';
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

test('trial catalog has two distinct air circuits and one short mapped wheel lap',()=>{
 assert.equal(courses.filter(c=>c.vehicle==='hoverbike').length,2);
 assert.equal(courses.filter(c=>c.vehicle==='onewheel').length,1);
 assert.equal(new Set(courses.map(c=>c.id)).size,3);
 const wheel=courses.find(c=>c.vehicle==='onewheel')!;
 assert(wheel.distance>320&&wheel.distance<340);
 assert.equal(wheel.gates.length,16);
 const road=map.roads.find(r=>r.id==='8733696')!;
 assert.equal(wheel.path.length,road.points.length);
 for(const course of courses){
  assert(course.distance>0&&Number.isFinite(course.distance));
  const first=course.gates[0],finish=course.gates.at(-1)!;
  assert((course.start.x-first.x)*Math.sin(first.heading)+(course.start.z-first.z)*Math.cos(first.heading)<0,'first gate must be ahead');
  assert(Math.hypot(finish.x-course.start.x,finish.y-course.start.y,finish.z-course.start.z)<.001,'finish closes the loop');
  assert(new TrialRun(course));
 }
});

test('the complete Fountain Drive route has clear land and road-width gates',()=>{
 const course=courses.find(c=>c.vehicle==='onewheel')!,road=map.roads.find(r=>r.id==='8733696')!;
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
 const course=courses.find(c=>c.vehicle==='onewheel')!,run=new TrialRun(course);
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

for(const course of courses.filter(c=>c.vehicle==='hoverbike'))test(`normal drone controls complete all gates: ${course.name}`,()=>{
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
