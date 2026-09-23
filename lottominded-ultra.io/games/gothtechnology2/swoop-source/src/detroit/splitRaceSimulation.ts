import {RideController,NEUTRAL_ACTIONS,createPose,copyPose,type RideActions} from './controller.ts';
import {RaceRules,RACE_ROUTE} from './raceRules.ts';
import {routePosition} from './districtView.ts';
import {toMap} from './geo-profile.ts';
import {cutCoords} from './world.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import {FlowCombo} from './replayRules.ts';
import type {RiderId} from './riderChoices.ts';

/** Two existing RideControllers, advanced only by the main loop's 120 Hz ticks.
 * Local room scores have no persistence/reward adapter. Each rider sees the other as a solid moving actor.
 */
export class SplitRaceSimulation {
 readonly rules:RaceRules;
 readonly riders:{id:RiderId;sim:RideController;previous:ReturnType<typeof createPose>;pose:ReturnType<typeof createPose>;flow:FlowCombo;message:string}[]=[];
 readonly terrain:TerrainSampler;
 newCrashes:number[]=[];
 constructor(terrain:TerrainSampler,ids:readonly [RiderId,RiderId]){
  this.terrain=terrain;this.rules=new RaceRules(ids[0],{opponents:[ids[1]],waitForAll:true});
  ids.forEach((id,i)=>{
   const queries:TerrainSampler={
    sampleGround:(...a)=>terrain.sampleGround(...a),raycast:(...a)=>terrain.raycast(...a),raycastObstacle:(...a)=>terrain.raycastObstacle(...a),
    mountedClear:terrain.mountedClear?(...a)=>terrain.mountedClear!(...a):undefined,
    navigationObstacles:(x,z,radius)=>(terrain.navigationObstacles?.(x,z,radius)??[]).concat(this.riders.flatMap((r,j)=>j===i?[]:r.sim.obstacles('local-'+j)))
   };
   const p=routePosition(RACE_ROUTE.start,i===0?-1.2:1.2);p.y=terrain.sampleGround(p.x,p.z,createGroundSample()).height;
   const sim=new RideController(queries,{spawn:{position:p,headingY:p.heading}});sim.wheelScale=id.startsWith('DS_Mascot_')?.75:.86;
   const pose=createPose(),previous=createPose();sim.writePose(pose);copyPose(pose,previous);
   this.riders.push({id,sim,pose,previous,flow:new FlowCombo(),message:''});
   Object.assign(this.rules.racers[i],{station:RACE_ROUTE.start,previous:RACE_ROUTE.start,offset:i===0?-1.2:1.2});
  });
 }
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
   if(!r.sim.crashed)this.rules.observe(r.id,c.d,c.u,elapsed);
   if(this.rules.racers[i].finish!==null){r.flow.bank();r.message='Finished · waiting for the other rider';}
  });
  if(this.rules.done)this.riders.forEach((r,i)=>{if(this.rules.racers[i].finish===null)r.flow.cancel();});
 }
 recover(index:number){
  const r=this.riders[index],progress=this.rules.racers[index];
  if(this.rules.done||progress.finish!==null||this.rules.countdown>0)return false;
  if(r.sim.crashed&&r.sim.snapshot().fallPhase!=='settled'){r.message='Let the fall settle, then recover';return false;}
  const station=progress.gate?RACE_ROUTE.gates[progress.gate-1]+.5:RACE_ROUTE.start;
  const p=routePosition(station,index===0?-1.2:1.2);p.y=this.terrain.sampleGround(p.x,p.z,createGroundSample(),r.pose.y).height;
  if(!r.sim.recover({position:p,headingY:p.heading})){r.message='Recovery space occupied · try again';return false;}
  this.rules.recover(r.id);r.sim.writePose(r.pose);copyPose(r.pose,r.previous);r.flow.cancel();r.message='Recovered · release controls, then ride';return true;
 }
 get snapshot(){return {countdown:this.rules.countdown,elapsed:this.rules.elapsed,done:this.rules.done,racers:this.riders.map((r,i)=>({...this.rules.racers[i],position:{x:r.pose.x,y:r.pose.y,z:r.pose.z},speed:r.pose.speed,crashed:r.sim.crashed,fallPhase:r.sim.snapshot().fallPhase,banked:r.flow.banked,pending:r.flow.pending,hops:r.sim.snapshot().hops}))};}
}
