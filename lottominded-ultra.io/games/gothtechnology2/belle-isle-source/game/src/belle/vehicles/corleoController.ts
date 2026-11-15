import {HoverController,type HoverInput,type FlightObstacle} from '../hoverController.ts';
import {CorleoMotion} from '../corleoMotion.ts';
import type {ParkTerrain} from '../terrain.ts';
import {CORLEO_RADIUS,CORLEO_SCALE} from './corleoFit.ts';
import {CORLEO_TRANSITION_SECONDS,type CorleoAction} from './corleoState.ts';
import {horseGait,horseCadence} from './corleoHorseGait.ts';
/** One grounded controller for solo, online presentation and every co-op seat. */
export class CorleoController extends HoverController{
 readonly motion:CorleoMotion;
 private safe:{x:number;z:number;heading:number};
 private traffic?:FlightObstacle;
 private jumpQueued=false;
 private transition:'MOUNT'|'DISMOUNT'|null=null;
 private transitionTime=0;
 private exitReady=false;
 crawl=false;
 constructor(terrain:ParkTerrain,spawn:{x:number;z:number;heading:number},traffic?:FlightObstacle){
  super(terrain,spawn,traffic);this.traffic=traffic;this.safe={...spawn};
  this.motion=new CorleoMotion({...spawn,y:terrain.height(spawn.x,spawn.z)});this.reset(spawn.x,spawn.z,spawn.heading);
 }
 get transitioning(){return this.transition!==null;}
 get dismountReady(){return this.exitReady;}
 beginMount(){this.stop();this.crawl=false;this.transition='MOUNT';this.transitionTime=0;this.exitReady=false;this.action('MOUNT',0);}
 beginDismount(){if(this.transition||this.motion.pose.airMetres>.01)return false;this.stop();if(!this.exitPoint())return false;this.crawl=false;this.transition='DISMOUNT';this.transitionTime=0;this.exitReady=false;this.action('DISMOUNT',0);return true;}
 toggleCrawl(){if(!this.transition&&this.motion.pose.airMetres<.01)this.crawl=!this.crawl;}
 override launch(){if(!this.transition)this.jumpQueued=true;}
 override land(){this.stop();}
 override startFlight(){return false;}
 override toggleCruise(){return false;}
 override stop(){super.stop();if(this.motion){this.motion.pose.speed=0;this.landed=this.motion.pose.airMetres<.01;}this.jumpQueued=false;}
 override reset(x=this.safe.x,z=this.safe.z,heading=this.safe.heading){
  super.reset(x,z,heading);this.motion?.reset({x,y:this.terrain.height(x,z),z,heading});this.transition=null;this.transitionTime=0;this.exitReady=false;this.crawl=false;this.pose.corleoPhase=0;this.action('IDLE',0);
 }
 private action(action:CorleoAction,seconds:number){if(this.pose.corleoAction!==action)this.pose.corleoTime=0;this.pose.corleoAction=action;this.pose.corleoTime=Math.min(60,(this.pose.corleoTime??0)+seconds);}
 override advance(seconds:number,input:HoverInput){
  const dt=Math.max(0,Math.min(.12,Number.isFinite(seconds)?seconds:0));this.collision=false;this.impactSpeed=0;
  if(this.transition){
   this.transitionTime=Math.min(CORLEO_TRANSITION_SECONDS,this.transitionTime+dt);this.action(this.transition,dt);
   if(this.transitionTime>=CORLEO_TRANSITION_SECONDS){this.exitReady=this.transition==='DISMOUNT';this.transition=null;if(!this.exitReady)this.action('IDLE',0);}
   return this.pose;
  }
  if(this.exitReady)return this.pose;
  const steps=Math.max(1,Math.ceil(dt*120)),beforeSpeed=this.motion.pose.speed;
  const demand=input.brake?0:Math.max(-1,Math.min(1,Number.isFinite(input.throttle)?input.throttle:0));
  const crawl=this.crawl||!!input.crawl;let jump=this.jumpQueued||!!input.jump;this.jumpQueued=false;
  for(let i=0;i<steps;i++){
   const before={...this.motion.pose};
   const obstructed=(x:number,z:number)=>{
    const sin=Math.sin(this.motion.pose.heading),cos=Math.cos(this.motion.pose.heading),ground=this.terrain.height(x,z,before.y);
    const unsupported=[[-.65,1.1],[.65,1.1],[-.65,-1.1],[.65,-1.1]].some(([sx,sz])=>!this.terrain.land(x+(cos*sx+sin*sz)*CORLEO_SCALE,z+(-sin*sx+cos*sz)*CORLEO_SCALE,before.y));
    const dx=x-before.x,dz=z-before.z,distance=Math.hypot(dx,dz),direction={x:dx/(distance||1),y:0,z:dz/(distance||1)};
    const blocked=unsupported||!this.terrain.land(x,z,before.y)||this.terrain.obstructed(x,z,CORLEO_RADIUS)||Math.abs(ground-(before.y-before.airMetres))>.6||
     distance>1e-6&&[.4,.95,1.8].some(h=>this.terrain.raycastFlight({x:before.x,y:before.y+h,z:before.z},direction,distance+CORLEO_RADIUS,.45)!==null||this.traffic?.({x:before.x,y:before.y+h,z:before.z},direction,distance+CORLEO_RADIUS,.45)!=null);
    if(blocked)this.collision=true;return blocked;
   };
   if(jump&&this.terrain.raycastFlight({x:before.x,y:before.y+2,z:before.z},{x:0,y:1,z:0},.65,.5)!==null)jump=false;
   this.motion.tick(dt/steps,{throttle:demand,steer:input.steer,run:input.boost&&!input.brake,crawl,jump:jump&&i===0,lower:crawl},(x,z)=>this.terrain.height(x,z,before.y),obstructed);
  }
  const p=this.motion.pose;
  Object.assign(this.pose,{x:p.x,y:p.y+.18,z:p.z,heading:p.heading,speed:p.speed,pitch:0,roll:0,lift:p.verticalSpeed,rpm:0});
  this.flying=false;this.landed=p.airMetres<.01&&Math.abs(p.speed)<.1;this.clearance=.18+p.airMetres;this.boostActive=input.boost&&!crawl&&Math.abs(p.speed)>.1;this.throttleDemand=Math.max(0,demand);this.hazard=this.collision;this.impactSpeed=this.collision?Math.abs(beforeSpeed):0;
  const gait=horseGait(p.speed),action:CorleoAction=p.airMetres>0?'JUMP':crawl?'CRAWL':gait;
  if(!crawl&&p.airMetres===0)this.pose.corleoPhase=((this.pose.corleoPhase??0)+horseCadence(p.speed,gait)*dt)%1;
  if(this.pose.corleoAction===action&&(this.pose.corleoTime??0)>30)this.pose.corleoTime=0;
  this.action(action,dt);
  if(!this.collision&&p.airMetres===0)this.safe={x:p.x,z:p.z,heading:p.heading};return this.pose;
 }
}
