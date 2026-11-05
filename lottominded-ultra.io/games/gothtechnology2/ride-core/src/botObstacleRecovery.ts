import type {TerrainSampler,Vec3} from './terrain.ts';
import {mountedClearance} from './mountedClearance.ts';
import {angle,clamp} from './rideDynamics.ts';
import {beginSimulationProfile,endSimulationProfile} from './simulationProfile.ts';
export type BotObstacleRecovery={blocked:number;until:number;heading:number;reverse:boolean;origin:Vec3;attempt:number};
export const botObstacleRecovery=():BotObstacleRecovery=>({blocked:0,until:0,heading:0,reverse:false,origin:{x:0,y:0,z:0},attempt:0});
type Pose=Vec3&{headingY:number;speed:number;footMode?:number};
/** A committed, swept escape prevents replanning from steering straight back
 * into the same wall. It drives normally and never relocates or dismounts. */
export function recoverBotObstacle(terrain:TerrainSampler,p:Pose,goal:Vec3,state:BotObstacleRecovery,time:number,dt:number){
 const profile=beginSimulationProfile();try{
 if(p.footMode){state.blocked=0;state.until=0;return;}
 if(state.until>0&&(time>=state.until||Math.hypot(p.x-state.origin.x,p.z-state.origin.z)>2.4)){state.until=0;state.blocked=0;}
 if(!state.until){
  // Only a slow, uncommitted rider can start recovery. Moving riders and an
  // already selected escape never use the front-probe result.
  const blocked=Math.abs(p.speed)<.65&&mountedClearance(terrain,p,{x:Math.sin(p.headingY),y:0,z:Math.cos(p.headingY)},1.1,.32)!==null;
  state.blocked=blocked?state.blocked+dt:Math.max(0,state.blocked-dt*2);
  if(state.blocked<.7)return;
  const options:{heading:number;score:number;reverse:boolean}[]=[];
  for(let i=0;i<16;i++){
   const heading=p.headingY+i*Math.PI/8,dx=Math.sin(heading),dz=Math.cos(heading),g=terrain.sampleGround(p.x+dx*2,p.z+dz*2,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false},p.y);
   if(g.offCourse||Math.abs(g.height-p.y)>.9||g.normal.y<.75)continue;
   const d={x:dx,y:(g.height-p.y)/2,z:dz},hit=mountedClearance(terrain,p,d,2.5,.35);
   if(hit!==null&&hit<2)continue;
   const reverse=Math.abs(angle(heading-p.headingY))>Math.PI*.6,turn=Math.abs(angle(heading-p.headingY-(reverse?Math.PI:0)));
   const progress=Math.cos(angle(heading-Math.atan2(goal.x-p.x,goal.z-p.z)));
   options.push({heading,reverse,score:progress-turn*.8+(state.attempt%2?Math.sin(heading-p.headingY)*.1:0)});
  }
  options.sort((a,b)=>b.score-a.score);const best=options[0];if(!best){state.blocked=.5;return {throttle:0,steer:0};}
  state.heading=best.heading;state.reverse=best.reverse;state.origin={x:p.x,y:p.y,z:p.z};state.until=time+3;state.attempt++;
 }
 const error=angle(state.heading-p.headingY-(state.reverse?Math.PI:0));
 // Briefly release the brake so the normal controller can engage reverse.
 const release=state.until-time>2.86;
 return {throttle:release?0:state.reverse?(p.speed< -1.8?0:-.5):Math.abs(error)>1?.16:p.speed>2.5?0:.42,steer:clamp(error*(state.reverse?2:-2),-.85,.85)};
 }finally{endSimulationProfile('obstacleRecovery',profile);}
}
