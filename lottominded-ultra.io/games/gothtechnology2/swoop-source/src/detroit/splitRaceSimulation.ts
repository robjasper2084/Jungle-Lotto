import {RideController,NEUTRAL_ACTIONS,createPose,copyPose,type RideActions} from './controller.ts';
import {RaceRules,RACE_ROUTE} from './raceRules.ts';
import {routePosition} from './districtView.ts';
import {toMap} from './geo-profile.ts';
import {cutCoords} from './world.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import {FlowCombo} from './replayRules.ts';
import type {RiderId} from './riderChoices.ts';
import {DistrictRun,type Challenge} from './district.ts';
import {freeRideLaunch} from './rideLaunch.ts';

/** Two to four existing RideControllers, advanced only by the main loop's 120 Hz ticks.
 * Local room scores have no persistence/reward adapter. Each rider sees the other as a solid moving actor.
 */
export class SplitRaceSimulation {
 readonly rules:RaceRules;
 readonly riders:{id:RiderId;sim:RideController;previous:ReturnType<typeof createPose>;pose:ReturnType<typeof createPose>;flow:FlowCombo;message:string;challenge?:DistrictRun}[]=[];
 readonly sessionMode:'free'|'race'|'challenge';
 readonly terrain:TerrainSampler;
 readonly remoteFallPhase=new Map<number,string>();
 newCrashes:number[]=[];
 constructor(terrain:TerrainSampler,ids:readonly RiderId[],options:{mode?:'free'|'race'|'challenge';spawn?:{x:number;y:number;z:number;heading:number};challenge?:Challenge}={}){
  if(ids.length<2||ids.length>4)throw Error('Split play supports 2–4 riders.');
  this.sessionMode=options.mode??'race';if(this.sessionMode==='challenge'&&!options.challenge)throw Error('Choose a challenge.');
  this.terrain=terrain;this.rules=new RaceRules(ids[0],{opponents:ids.slice(1),waitForAll:true});if(this.sessionMode==='free')this.rules.countdown=0;
  ids.forEach((id,i)=>{
   const queries:TerrainSampler={
    sampleGround:(...a)=>terrain.sampleGround(...a),raycast:(...a)=>terrain.raycast(...a),raycastObstacle:(...a)=>terrain.raycastObstacle(...a),
    mountedClear:terrain.mountedClear?(...a)=>terrain.mountedClear!(...a):undefined,
    navigationObstacles:(x,z,radius)=>(terrain.navigationObstacles?.(x,z,radius)??[]).concat(this.riders.flatMap((r,j)=>j===i?[]:r.sim.obstacles('local-'+j)))
   };
   const offset=this.offset(i,ids.length),row=this.row(i,ids.length),centre=options.spawn,station=(options.challenge?.start??RACE_ROUTE.start)-row;
   let p=this.sessionMode==='free'&&centre?{x:centre.x+Math.cos(centre.heading)*offset-Math.sin(centre.heading)*row,y:centre.y,z:centre.z-Math.sin(centre.heading)*offset-Math.cos(centre.heading)*row,heading:centre.heading}:routePosition(station,offset);p.y=terrain.sampleGround(p.x,p.z,createGroundSample(),p.y).height;
   if(this.sessionMode==='free')p=freeRideLaunch(queries,p,this.riders.map(r=>r.pose));
   const sim=new RideController(queries,{spawn:{position:p,headingY:p.heading}});sim.wheelScale=id.startsWith('DS_Mascot_')?.75:.86;
   const pose=createPose(),previous=createPose();sim.writePose(pose);copyPose(pose,previous);
   this.riders.push({id,sim,pose,previous,flow:new FlowCombo(),message:'',challenge:options.challenge?new DistrictRun(options.challenge):undefined});
   Object.assign(this.rules.racers[i],{station,previous:station,offset});
  });
 }
 // Loaded EUC riders need about 1.32 m between centres. Two staggered lanes
 // keep all four bodies separate without spreading across the narrow northern Cut.
 private offset(index:number,count=this.riders.length){return count===2?index===0?-1.2:1.2:index%2===0?-.9:.9;}
 private row(index:number,count=this.riders.length){return count===2?0:Math.floor(index/2)*2.2;}
 step(dt:number,actions:readonly RideActions[]){
  this.newCrashes=[];const elapsed=this.rules.advance(dt);if(this.rules.done){this.riders.forEach((r,i)=>{if(this.rules.racers[i].finish===null)r.flow.cancel();});return;}if(elapsed<=0)return;
  this.riders.forEach((r,i)=>{
   copyPose(r.pose,r.previous);const before=this.rules.racers[i].finish,wasCrashed=r.sim.crashed;
   r.sim.step(elapsed,before===null?actions[i]:{...NEUTRAL_ACTIONS,throttle:Math.abs(r.pose.speed)>.08?-Math.sign(r.pose.speed):0});r.sim.writePose(r.pose);
   if(!wasCrashed&&r.sim.crashed){this.newCrashes.push(i);r.message='Fall · recover when settled';}
   if(before!==null)return;
   r.flow.step(elapsed,r.pose,r.sim.snapshot().grounded,r.sim.touchedDown?r.sim.lastLandingQuality:undefined,r.sim.tricks.award?r.sim.tricks.event:undefined,r.sim.tricks.active,r.sim.tricks.award);
   if(r.sim.tricks.event)r.message=r.sim.tricks.event;
   const p=toMap(r.pose.x,r.pose.y,r.pose.z),c=cutCoords(p.x,p.z);
   if(this.sessionMode==='race'&&!r.sim.crashed)this.rules.observe(r.id,c.d,c.u,elapsed);
   else if(r.challenge){const s=r.sim.snapshot();r.challenge.step(elapsed,{station:c.d,offset:c.u,speed:r.pose.speed,grounded:s.grounded,crashed:r.sim.crashed,roll:r.pose.rollAngle,slip:r.pose.slipAngle,traction:r.pose.tractionUsage,airHeight:r.pose.airHeight,landing:r.sim.touchedDown?r.sim.lastLandingQuality:undefined,hopCharge:r.sim.lastHopCharge});Object.assign(this.rules.racers[i],{station:c.d,offset:c.u,gate:r.challenge.gateCount});r.message=r.challenge.reason||r.challenge.progress;if(r.challenge.done||r.challenge.failed)this.rules.racers[i].finish=r.challenge.elapsed;}
   else if(this.sessionMode==='free')Object.assign(this.rules.racers[i],{station:c.d,offset:c.u});
   if(this.rules.racers[i].finish!==null){if(r.challenge?.failed){r.flow.cancel();r.message='Attempt ended · '+r.challenge.reason;}else {r.flow.bank();r.message='Finished · waiting for the other riders';}}
  });
  if(this.sessionMode==='challenge')this.rules.done=this.riders.every(r=>r.challenge?.done||r.challenge?.failed);
  if(this.rules.done)this.riders.forEach((r,i)=>{if(this.rules.racers[i].finish===null)r.flow.cancel();});
 }
 recover(index:number){
  const r=this.riders[index],progress=this.rules.racers[index];
  if(this.rules.done||progress.finish!==null||this.rules.countdown>0)return false;
  if(r.sim.crashed&&r.sim.snapshot().fallPhase!=='settled'){r.message='Let the fall settle, then recover';return false;}
  const gates=r.challenge?.challenge.gates??RACE_ROUTE.gates,station=progress.gate?gates[progress.gate-1]+.5:r.challenge?.challenge.start??RACE_ROUTE.start;
  const p=this.sessionMode==='free'?{x:r.pose.x,y:r.pose.y,z:r.pose.z,heading:r.pose.headingY}:routePosition(station+this.row(index),this.offset(index));p.y=this.terrain.sampleGround(p.x,p.z,createGroundSample(),r.pose.y).height;
  if(!r.sim.recover({position:p,headingY:p.heading})){r.message='Recovery space occupied · try again';return false;}
  if(this.sessionMode==='race')this.rules.recover(r.id);r.sim.writePose(r.pose);copyPose(r.pose,r.previous);r.flow.cancel();r.message='Recovered · release controls, then ride';if(r.challenge){const c=cutCoords(toMap(r.pose.x,0,r.pose.z).x,toMap(r.pose.x,0,r.pose.z).z);r.challenge.step(1/120,{station:c.d,offset:c.u,speed:0,grounded:true,crashed:false,recovered:true,roll:0,slip:0,traction:0,airHeight:0});}return true;
 }
 get snapshot(){return {sessionMode:this.sessionMode,countdown:this.rules.countdown,elapsed:this.rules.elapsed,done:this.rules.done,racers:this.riders.map((r,i)=>({...this.rules.racers[i],position:{x:r.pose.x,y:r.pose.y,z:r.pose.z},speed:r.pose.speed,crashed:r.sim.crashed,fallPhase:r.sim.snapshot().fallPhase,banked:r.flow.banked,pending:r.flow.pending,hops:r.sim.snapshot().hops,challenge:r.challenge?{id:r.challenge.challenge.id,count:r.challenge.count,photos:[...r.challenge.photos],gate:r.challenge.gateCount,elapsed:r.challenge.elapsed,done:r.challenge.done,failed:r.challenge.failed}:undefined}))};}
}
