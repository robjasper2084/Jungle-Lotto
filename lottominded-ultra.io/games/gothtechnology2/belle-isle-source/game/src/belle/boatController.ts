import type {ParkTerrain} from './terrain.ts';
import type {FlightObstacle} from './hoverController.ts';
export class BoatController {
 pose={x:0,y:0,z:0,heading:0,speed:0};collision=false;
 readonly terrain:ParkTerrain;private traffic?:FlightObstacle;
 constructor(terrain:ParkTerrain,traffic?:FlightObstacle){this.terrain=terrain;this.traffic=traffic;}
 reset(x:number,z:number,heading:number){this.pose={x,y:0,z,heading,speed:0};}
 stop(){this.pose.speed=0;}
 advance(dt:number,throttle:number,steer:number,brake:boolean){this.collision=false;const steps=Math.max(1,Math.ceil(Math.min(.1,dt)*60));for(let n=0;n<steps;n++){const t=Math.min(.1,dt)/steps,p=this.pose;p.speed+=(throttle*3.5-p.speed*(brake?3:.14+.018*Math.abs(p.speed)))*t;p.speed=Math.max(-3,Math.min(13,p.speed));p.heading-=steer*Math.min(.65,Math.abs(p.speed)*.12)*Math.sign(p.speed||1)*t;const distance=Math.abs(p.speed*t),d={x:Math.sin(p.heading)*Math.sign(p.speed),y:0,z:Math.cos(p.heading)*Math.sign(p.speed)},x=p.x+d.x*distance,z=p.z+d.z*distance;
 // Hull, bow and stern remain over navigable water; structural collisions include piers and deck.
 const land=[-2.7,0,2.7].some(offset=>this.terrain.land(x+Math.sin(p.heading)*offset,z+Math.cos(p.heading)*offset,0));
 const hit=[.5,1.3,2.2].some(y=>this.terrain.raycastFlight({x:p.x,y,z:p.z},d,distance+2.9,.85)!==null||this.traffic?.({x:p.x,y,z:p.z},d,distance+2.9,.85)!=null);
 if(land||hit||Math.abs(x)>7500||Math.abs(z)>7500){this.collision=Math.abs(p.speed)>.2;p.speed=0;}else{p.x=x;p.z=z;}}
 return this.pose;}
}
