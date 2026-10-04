import {EbikeController} from './ebikeController.ts';
import {EBIKES,EUC_MODELS,eucHandling,eucSteering,type EbikeProfile,type EucProfile} from './electricVehicles.ts';
import {BicycleController} from '@digital-static/ridecore/cycling';
import {RideController,createPose,createGroundSample,NEUTRAL_ACTIONS,type TerrainSampler} from '@digital-static/ridecore';
import {LaneRoute} from './riding/communityRide.ts';
import {ElmwoodRun,type Point} from './elmwood-gameplay.ts';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Actual controller-driven rival. Every checkpoint is earned by its swept physical pose. */
export class ElmwoodRacePilot {
 readonly sim:RideController;readonly pose=createPose();readonly run:ElmwoodRun;readonly route:LaneRoute;
 private accumulator=0;station=0;offset=0;targetOffset=0;private sample=createGroundSample();private think=0;private commitment=0;private blockedFor=0;private backoff=0;private recovery=0;recoveries=0;
 readonly terrain:TerrainSampler;readonly index:number;readonly cycling:boolean;readonly difficulty:'club'|'expert';readonly electric?:EbikeProfile;readonly wheel?:EucProfile;
 constructor(terrain:TerrainSampler,points:readonly Point[],gates:Point[],index:number,cycling:boolean,difficulty:'club'|'expert'='club',electric?:EbikeProfile,wheel?:EucProfile){this.difficulty=difficulty;this.terrain=terrain;this.index=index;this.cycling=cycling;this.electric=electric?EBIKES[(EBIKES.findIndex(p=>p.id===electric.id)+index+1)%4]:undefined;this.wheel=wheel?EUC_MODELS[(EUC_MODELS.findIndex(p=>p.id===wheel.id)+index+1)%4]:undefined;
  this.route=new LaneRoute(points.map(p=>({...p,width:4})));this.run=new ElmwoodRun(gates);this.sim=this.electric?new EbikeController(terrain,this.electric):cycling?new BicycleController(terrain):new RideController(terrain);if(this.wheel)this.sim.setHandling(eucHandling(this.wheel));this.reset();
 }
 reset(){this.accumulator=0;this.station=0;this.offset=this.targetOffset=[-.95,.95,0][this.index];this.think=this.commitment=this.blockedFor=this.backoff=this.recovery=this.recoveries=0;
  const a=this.route.at(0,this.offset),back=(this.index+1)*1.9,x=a.x-Math.sin(a.headingY)*back,z=a.z-Math.cos(a.headingY)*back;
  this.sim.reset({position:{x,y:this.terrain.sampleGround(x,z,this.sample).height,z},headingY:a.headingY});this.sim.writePose(this.pose);this.run.reset('sprint',this.pose);
 }
 private clear(offset:number,distance:number){const p=this.pose,a=this.route.at(this.station+distance,offset),length=Math.hypot(a.x-p.x,a.z-p.z),g=this.terrain.sampleGround(a.x,a.z,this.sample,p.y);
  if(g.offCourse||g.surface==='grass'||length>.01&&this.terrain.raycastObstacle({x:p.x,y:p.y+.6,z:p.z},{x:(a.x-p.x)/length,y:0,z:(a.z-p.z)/length},length,.35)!==null)return false;
  // Walkers and roaming cyclists are not Rapier scenery. Plan around the same
  // live actors that can stop the bicycle's physical contact sweep.
  for(const o of this.terrain.navigationObstacles?.(p.x,p.z,distance+3)??[]){
   if(o.raycastSolid||Math.abs(o.y-p.y)>2)continue;
   const x=o.x+o.vx*.35-p.x,z=o.z+o.vz*.35-p.z,dx=a.x-p.x,dz=a.z-p.z,t=clamp((x*dx+z*dz)/Math.max(.001,length*length),0,1);
   if(Math.hypot(x,z)<o.radius+.65&&Math.hypot(x-dx,z-dz)>Math.hypot(x,z))continue;
   if(Math.hypot(x-dx*t,z-dz*t)<o.radius+.48)return false;
  }
  return true;
 }
 update(dt:number,others:readonly ElmwoodRacePilot[]=[],paused=false){if(paused){this.accumulator=0;return;}this.accumulator+=Math.min(.1,Math.max(0,dt));while(this.accumulator>=1/120){this.step(1/120,others);this.accumulator-=1/120;}}
 step(dt:number,others:readonly ElmwoodRacePilot[]=[],paused=false){
  if(paused||this.run.finished||dt<=0)return;const p=this.pose;this.station=this.route.nearest(p,this.station).s;
  if(this.backoff>0){
   this.backoff=Math.max(0,this.backoff-dt);const behind=this.route.at(Math.max(0,this.station-2),this.targetOffset),desired=Math.atan2(p.x-behind.x,p.z-behind.z),error=Math.atan2(Math.sin(desired-p.headingY),Math.cos(desired-p.headingY));
   this.sim.step(dt,{...NEUTRAL_ACTIONS,throttle:-.8,steer:clamp(error*2.8,-.85,.85)});this.sim.writePose(p);this.run.update(dt,p,[]);return;
  }
  this.think-=dt;this.commitment=Math.max(0,this.commitment-dt);
  const base=[-.95,.95,0][this.index],look=2.1+Math.abs(p.speed)*.48;
  if(this.think<=0){this.think=this.difficulty==='expert'?.09:.14;const obstructed=!this.clear(this.targetOffset,Math.max(5,p.speed*1.5));
   const front=others.find(o=>o!==this&&o.station-this.station>0&&o.station-this.station<Math.max(6,p.speed*1.2)&&Math.abs(o.offset-this.targetOffset)<1.2);
   if(obstructed||front&&this.commitment<=0){
    const candidates=[base,-base,-1.15,1.15,0].filter(u=>this.clear(u,Math.max(5,p.speed*1.5))).map(u=>({u,cost:Math.abs(u-this.offset)*.2+others.reduce((c,o)=>c+(o!==this&&Math.abs(o.station-this.station)<10&&Math.abs(u-o.offset)<1.15?4:0),0)})).sort((a,b)=>a.cost-b.cost);
    if(candidates.length){this.targetOffset=candidates[0].u;this.commitment=2.8;}
   }else if(this.commitment<=0&&this.clear(base,6))this.targetOffset=base;
  }
  this.offset+=clamp(this.targetOffset-this.offset,-dt*1.5,dt*1.5);
  const target=this.route.at(this.station+look,this.offset),desired=Math.atan2(target.x-p.x,target.z-p.z),error=Math.atan2(Math.sin(desired-p.headingY),Math.cos(desired-p.headingY));
  const a=this.route.at(this.station),b=this.route.at(this.station+9),bend=Math.abs(Math.atan2(Math.sin(b.headingY-a.headingY),Math.cos(b.headingY-a.headingY)))/9;
  const skill=this.difficulty==='expert'?1:.88;
  let pace=Math.min((this.electric?Math.min(19,this.electric.topKph/3.6*.68)*skill:this.wheel?Math.min(13,this.wheel.topKph/3.6*.8)*skill:this.cycling?(this.difficulty==='expert'?7.2:6.5):(this.difficulty==='expert'?10:8.8))+[.1,-.15,.02][this.index],Math.sqrt(2.5/Math.max(.005,bend)));pace*=clamp(1-Math.abs(error)*.45,.35,1);
  if(!this.clear(this.offset,Math.max(1.2,p.speed*.6)))pace=Math.min(pace,2);
  for(const o of others){const gap=o.station-this.station;if(o!==this&&gap>0&&gap<7&&Math.abs(o.offset-this.offset)<1.1)pace=Math.min(pace,Math.max(1,o.pose.speed+(gap-2.4)*1.4));}
  const drag=this.electric?.09+.32*p.speed*p.speed/(this.electric.mass+80):this.cycling?.13+p.speed*p.speed*.009:p.speed*.055+p.speed*p.speed*.006;
  const throttle=clamp((pace-p.speed)*.8+drag/(this.electric?this.electric.acceleration:this.cycling?2.35:5),-.8,1);
  this.sim.step(dt,{...NEUTRAL_ACTIONS,throttle,steer:this.wheel?eucSteering(this.wheel,p.speed,clamp(-error*2.5,-.85,.85)):clamp(-error*(this.cycling?2.8:2.5),-.85,.85)});this.sim.writePose(p);
  this.blockedFor=Math.abs(p.speed)<.15?this.blockedFor+dt:0;
  if(this.cycling&&(this.sim as BicycleController).blocked&&this.blockedFor>.3){this.backoff=1.6;this.blockedFor=0;this.commitment=3;this.think=0;}
  if(this.sim.crashed||this.blockedFor>2.5){this.recovery+=dt;
   if(this.recovery>3&&(!this.sim.crashed||this.sim.snapshot().fallPhase==='settled')){
    const gate=this.run.gates[Math.max(0,this.run.gate-1)],s=this.route.nearest(gate).s,spot=this.route.at(Math.min(this.route.length,s+.3),0);
    this.sim.reset({position:{x:spot.x,y:this.terrain.sampleGround(spot.x,spot.z,this.sample).height,z:spot.z},headingY:spot.headingY});this.sim.writePose(p);this.run.relocate(p);this.run.elapsed+=5;this.recoveries++;this.recovery=this.blockedFor=0;this.targetOffset=this.offset=0;
   }
  }else this.recovery=0;
  this.run.update(dt,p,[]);this.station=this.route.nearest(p,this.station).s;
 }
}
export function elmwoodRaceOrder(player:ElmwoodRun,position:Point,route:LaneRoute,pilots:readonly ElmwoodRacePilot[]){
 return [{name:'YOU',run:player,station:route.nearest(position).s},...pilots.map((p,i)=>({name:p.electric?.name??p.wheel?.name??'Rider '+(i+1),run:p.run,station:p.station}))].sort((a,b)=>a.run.finished&&b.run.finished?a.run.finishTime-b.run.finishTime:a.run.finished?-1:b.run.finished?1:b.run.gate-a.run.gate||b.station-a.station);
}
/** Advance neighbors together; frame-sized batches per rider distort following gaps. */
export class ElmwoodRacePack {
 private accumulator=0;
 update(dt:number,pilots:readonly ElmwoodRacePilot[],paused=false){
  if(paused){this.accumulator=0;return;}
  this.accumulator+=Math.min(.1,Math.max(0,dt));
  while(this.accumulator+1e-12>=1/120){for(const pilot of pilots)pilot.step(1/120,pilots);this.accumulator=Math.max(0,this.accumulator-1/120);}
 }
 reset(){this.accumulator=0;}
}
