import {isCharacter} from './actorAvoidance.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {routePosition} from './districtView.ts';
import {cutCoords,cutPoint,clamp} from './world.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
import {toMap} from './geo-profile.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from './terrain.ts';
import {RaceRules,RACE_PACE,RACE_ROUTE,type RaceDifficulty} from './raceRules.ts';
import type {RiderId} from './riderChoices.ts';
export class RacePilot {
 readonly sim:RideController;pose=createPose();private recovery=0;private blockedFor=0;private backoff=0;private smoothLane=0;private surfaceCheck=0;private surfacePace=Infinity;private passLane:number|undefined;private passUntil=0;private ground=createGroundSample();
 private terrain:TerrainSampler;readonly id:RiderId;readonly index:number;readonly difficulty:RaceDifficulty;
 constructor(terrain:TerrainSampler,id:RiderId,index:number,difficulty:RaceDifficulty,neighbours:()=>NavigationObstacle[]=()=>[]){this.terrain=terrain;this.id=id;this.index=index;this.difficulty=difficulty;this.sim=new RideController({sampleGround:(...args)=>terrain.sampleGround(...args),raycast:(...args)=>terrain.raycast(...args),raycastObstacle:(...args)=>terrain.raycastObstacle(...args),mountedClear:terrain.mountedClear?(...args)=>terrain.mountedClear!(...args):undefined,navigationObstacles:(x,z,radius)=>(terrain.navigationObstacles?.(x,z,radius)??[]).filter(o=>o.id!==`rival-${index}`&&o.id!==`rival-${index}-wheel`).concat(neighbours())});this.sim.wheelScale=id.startsWith('DS_Mascot_')?.75:.86;this.reset(RACE_ROUTE.start-(index+1)*2.2);}
 reset(d:number){this.passLane=undefined;this.blockedFor=this.backoff=0;this.smoothLane=[-1.35,1.35,-.55][this.index];const p=routePosition(d,[-1.35,1.35,-.55][this.index]);p.y=this.terrain.sampleGround(p.x,p.z,this.ground).height;this.sim.reset({position:p,headingY:p.heading});this.sim.writePose(this.pose);}
 step(dt:number,rules:RaceRules){
  const me=rules.racers.find(r=>r.id===this.id)!;
  if(this.sim.crashed||me.missed){
   this.sim.step(dt,{...NEUTRAL_ACTIONS,throttle:this.sim.crashed?0:-1});this.sim.writePose(this.pose);this.recovery+=dt;
   if(this.recovery>(this.sim.crashed?3:1.8)&&(!this.sim.crashed||this.sim.snapshot().fallPhase==='settled')){const station=me.gate?RACE_ROUTE.gates[me.gate-1]+.5:RACE_ROUTE.start,p=routePosition(station,[-1.35,1.35,-.55][this.index]);p.y=this.terrain.sampleGround(p.x,p.z,this.ground,this.pose.y).height;
    if(this.sim.recover({position:p,headingY:p.heading})){rules.recover(this.id);this.sim.writePose(this.pose);this.recovery=this.blockedFor=this.backoff=this.surfaceCheck=0;this.surfacePace=Infinity;this.passLane=undefined;this.smoothLane=[-1.35,1.35,-.55][this.index];}}
   return;
  }
  const p=this.pose,m=toMap(p.x,p.y,p.z),coord=cutCoords(m.x,m.z);
  if(this.backoff>0){
   this.backoff=Math.max(0,this.backoff-dt);if(this.passLane!==undefined)this.smoothLane+=clamp(this.passLane-this.smoothLane,-.85*dt,.85*dt);
   // Release the brake latch, then create turning room behind a blocked wheel.
   this.sim.step(dt,{...NEUTRAL_ACTIONS,throttle:this.backoff>2.4?0:this.backoff>.5?-.55:.5});this.sim.writePose(this.pose);
   const m=toMap(this.pose.x,this.pose.y,this.pose.z),c=cutCoords(m.x,m.z);rules.observe(this.id,c.d,c.u,dt);return;
  }
  if(coord.d>this.passUntil)this.passLane=undefined;
  const rivals=rules.racers.filter(r=>r.id!==this.id&&r.finish===null);
  const leader=rivals.reduce((best,r)=>r.station>best.station?r:best,me);
  const behind=Math.max(0,leader.station-coord.d);
  const attack=rivals.some(r=>r.station-coord.d>-3&&r.station-coord.d<30);
  // A bounded pursuit effort uses the same motor and grip as the human rider.
  // Leaders retain their pace; no teleporting or forced slowdown to bunch the field.
  const cap=this.difficulty==='expert'?19.8:this.difficulty==='club'?17.3:11.2;
  const pursuit=this.difficulty==='cruise'?0:clamp((behind-8)/55,0,1)*1.1;
  let lane=[-1.35,1.35,-.55][this.index];
  let pace=Math.min(cap,Math.max(RACE_PACE[this.difficulty],behind>12?Math.min(leader.speed+.4,cap):0)+pursuit+[.25,-.12,.08][this.index]+Math.sin(rules.elapsed*.28+this.index*2)*.3+(attack?.35:0)+(coord.d>RACE_ROUTE.end-240?.45:0));
  // Commit to a clear overtaking line early, including space for a racer behind.
  const blocked=rivals.find(r=>r.station-coord.d>-.8&&r.station-coord.d<Math.max(20,p.speed*2.5)&&Math.abs(r.offset-(this.passLane??lane))<1.25);
  if(blocked){
   const choices=[-1.65,0,1.65].map(u=>({u,cost:Math.abs(u-coord.u)*.12+rivals.reduce((cost,r)=>{const gap=r.station-coord.d;return cost+(gap>-9&&gap<Math.max(22,p.speed*2.5)&&Math.abs(u-r.offset)<1.3?(gap<6?12:5):0);},0)})).sort((a,b)=>a.cost-b.cost);
   if(choices[0].cost<4){this.passLane=choices[0].u;this.passUntil=blocked.station+10;}
  }
  // Plan for marked low-grip patches and ramps at 10 Hz, before committing to
  // a high-speed pass. Prefer open dry pavement; brake if every lane is occupied.
  this.surfaceCheck-=dt;
  if(this.surfaceCheck<=0){
   this.surfaceCheck=.1;this.surfacePace=Infinity;
   for(let distance=6;distance<=36;distance+=5){
    const d=coord.d+distance,u=this.passLane??lane,q=routePosition(d,u),sample=this.terrain.sampleGround(q.x,q.z,this.ground,q.y);
    if(sample.surface!=='ice'&&sample.surface!=='wood')continue;
    const clear=[-1.65,0,1.65].filter(candidate=>{
     const point=routePosition(d,candidate),g=this.terrain.sampleGround(point.x,point.z,this.ground,point.y);
     return g.surface!=='ice'&&g.surface!=='wood'&&!rivals.some(r=>r.station-coord.d>-8&&r.station-coord.d<distance+8&&Math.abs(candidate-r.offset)<1.3);
    }).sort((a,b)=>Math.abs(a-coord.u)-Math.abs(b-coord.u));
    if(clear.length){this.passLane=clear[0];this.passUntil=d+14;}else this.surfacePace=8;
    break;
   }
  }
  pace=Math.min(pace,this.surfacePace);
  const look=Math.max(12,Math.abs(p.speed)*2.8);
  const nearby=(this.sim.terrain.navigationObstacles?.(p.x,p.z,look+3)??[]).filter(o=>isCharacter(o)||o.kind==='cone'||o.kind==='barrier');
  let noseBlocked=false;
  for(const o of nearby){
   const dx=o.x-p.x,dz=o.z-p.z,along=dx*Math.sin(p.headingY)+dz*Math.cos(p.headingY),side=dx*Math.cos(p.headingY)-dz*Math.sin(p.headingY);
   if(Math.abs(o.y-p.y)>1.3||along<0||along>look||Math.abs(side)>o.radius+this.sim.mountedVolume.radius+.35)continue;
   if(along<o.radius+this.sim.mountedVolume.radius+1.4)noseBlocked=true;
   const mapped=toMap(o.x,o.y,o.z),location=cutCoords(mapped.x,mapped.z);
   if(this.passLane===undefined||Math.abs(this.passLane-location.u)<o.radius+this.sim.mountedVolume.radius+.25){
    const candidates=[-1.65,0,1.65].map(u=>({u,cost:Math.abs(u-coord.u)*.1+nearby.reduce((cost,actor)=>{const a=toMap(actor.x,actor.y,actor.z),c=cutCoords(a.x,a.z);return cost+(c.d>coord.d-6&&c.d<coord.d+look&&Math.abs(c.u-u)<actor.radius+this.sim.mountedVolume.radius+.25?10:0);},0)})).sort((a,b)=>a.cost-b.cost);
    this.passLane=candidates[0].u;this.passUntil=location.d+10;
   }
   const forwardSpeed=Math.max(0,o.vx*Math.sin(p.headingY)+o.vz*Math.cos(p.headingY));
   pace=Math.min(pace,forwardSpeed+Math.sqrt(Math.max(0,along-o.radius-this.sim.mountedVolume.radius-.5)*4));
  }
  this.blockedFor=noseBlocked&&Math.abs(p.speed)<.35?this.blockedFor+dt:0;
  if(this.blockedFor>.35){this.backoff=2.6;this.blockedFor=0;return;}
  if(this.passLane!==undefined)lane=this.passLane;
  if(Math.abs(coord.u)>2.15){lane=clamp(lane,-1.1,1.1);pace=Math.min(pace,6);}
  this.smoothLane+=clamp(lane-this.smoothLane,-.85*dt,.85*dt);lane=this.smoothLane;
  if(me.finish!==null)pace=0;
  const target=routePosition(coord.d+3+Math.abs(p.speed)*.65,lane),desired=Math.atan2(target.x-p.x,target.z-p.z),error=Math.atan2(Math.sin(desired-p.headingY),Math.cos(desired-p.headingY));
  // Brake for measured curvature, accounting for distance to the corner.
  // The previous minimum-curvature clamp also capped speed on straight pavement.
  let curvePace=cap;
  for(const distance of [0,12,26,42]){
   const ahead=cutPoint(Math.min(RACE_ROUTE.end,coord.d+distance)),after=cutPoint(Math.min(RACE_ROUTE.end,coord.d+distance+10));
   const bend=Math.abs(Math.atan2(Math.sin(after.heading-ahead.heading),Math.cos(after.heading-ahead.heading)))/10;
   if(bend>.002){const cornerSpeed=Math.sqrt(2.5/bend);curvePace=Math.min(curvePace,Math.sqrt(cornerSpeed*cornerSpeed+2*4*Math.max(0,distance-5)));}
  }
  pace=Math.min(pace,curvePace)*clamp(1-Math.abs(error)*.5,.4,1);
  const tuck=p.speed>12&&Math.abs(error)<.16&&this.sim.snapshot().grounded;
  // Feed-forward drag compensation lets the pilot reach its target instead of
  // coasting permanently below it, while launch jerk still comes from RideCore.
  const drag=p.speed*.055+p.speed*p.speed*(tuck?.004:.006),taper=clamp((RIDE_TUNING.maxSpeed-p.speed)/6.5,.12,1);
  const throttle=clamp((pace-p.speed)*.75+(pace>0?drag/(RIDE_TUNING.driveAcceleration*taper):0),-.9,1);
  this.sim.step(dt,{...NEUTRAL_ACTIONS,throttle,crouch:tuck,steer:this.sim.snapshot().grounded?clamp(-error*2.5,-.8,.8):0});this.sim.writePose(this.pose);
  const mapped=toMap(this.pose.x,this.pose.y,this.pose.z),c=cutCoords(mapped.x,mapped.z);rules.observe(this.id,c.d,c.u,dt);
 }
}
