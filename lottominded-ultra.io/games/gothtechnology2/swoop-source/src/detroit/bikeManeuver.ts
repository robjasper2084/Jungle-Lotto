import type {BicycleController} from '@digital-static/ridecore/cycling';
import {actorTravelFraction} from './actorAvoidance.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';

/** A stopped NPC puts a foot down and rolls its bicycle back into turning room. */
export function walkBicycleBack(bike:BicycleController,terrain:TerrainSampler,dt:number,targetHeading:number){
 dt=Math.min(Math.max(dt,0),1/30);if(!dt)return false;
 const p=bike.cycle,error=Math.atan2(Math.sin(targetHeading-p.headingY),Math.cos(targetHeading-p.headingY));
 const turn=Math.max(-.75*dt,Math.min(.75*dt,error)),heading=p.headingY+turn,distance=.65*dt,dx=-Math.sin(heading)*distance,dz=-Math.cos(heading)*distance;
 const ground=terrain.sampleGround(p.x+dx,p.z+dz,createGroundSample(),p.y),actors=terrain.navigationObstacles?.(p.x,p.z,3)??[];
 const clear=!ground.offCourse&&Math.abs(ground.height-p.y)<.3&&actorTravelFraction(p,dx,dz,.65,1.8,actors)>.999&&terrain.raycastObstacle({x:p.x,y:p.y+.55,z:p.z},{x:-Math.sin(heading),y:0,z:-Math.cos(heading)},distance+.65,.32)===null;
 p.speed=0;bike.pedaling=false;p.stopFoot=1;
 if(clear){p.x+=dx;p.z+=dz;p.headingY=heading;p.wheelSpin-=distance/.34;bike.travel+=distance;}
 bike.step(dt,NEUTRAL_ACTIONS);p.driveIntent=0;p.velocityX=clear?dx/dt:0;p.velocityZ=clear?dz/dt:0;
 return clear;
}
