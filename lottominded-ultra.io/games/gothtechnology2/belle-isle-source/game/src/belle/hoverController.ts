import {inside} from './terrain.ts';
import type {ParkTerrain} from './terrain.ts';
export interface HoverInput {throttle:number;steer:number;lift:number;brake:boolean;boost:boolean}
export interface HoverPose {x:number;y:number;z:number;heading:number;speed:number;pitch:number;roll:number;lift:number;rpm:number}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const approach=(n:number,target:number,d:number)=>n<target?Math.min(target,n+d):Math.max(target,n-d);
/** Stable terrain-following hover simulation, shared behaviour with the Unity controller. */
export class HoverController {
  pose:HoverPose;
  clearance=.18;
  flying=false;
  landed=true;
  collision=false;
  private verticalSpeed=0;
  private lastSafe:{x:number;z:number;heading:number};
  readonly terrain:ParkTerrain;
  constructor(terrain:ParkTerrain,spawn:{x:number;z:number;heading:number}){
    this.terrain=terrain;this.lastSafe={...spawn};
    this.pose={...spawn,y:this.floor(spawn.x,spawn.z)+.18,speed:0,pitch:0,roll:0,lift:0,rpm:0};
  }
  floor(x:number,z:number){return this.terrain.land(x,z)?this.terrain.height(x,z):this.terrain.map.water.some(w=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h)))?1.05:0;}
  launch(){this.flying=true;this.clearance=Math.max(1.4,this.clearance);this.landed=false;}
  land(){this.clearance=.18;this.pose.speed=0;}
  stop(){this.pose.speed=0;this.verticalSpeed=0;}
  reset(x=this.lastSafe.x,z=this.lastSafe.z,heading=this.lastSafe.heading){
    this.pose={x,z,heading,y:this.floor(x,z)+.18,speed:0,pitch:0,roll:0,lift:0,rpm:0};
    this.clearance=.18;this.flying=false;this.landed=true;this.verticalSpeed=0;
  }
  advance(seconds:number,input:HoverInput){
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.12),steps=Math.max(1,Math.ceil(dt*120));
    this.collision=false;
    for(let i=0;i<steps;i++)this.step(dt/steps,input);
    return this.pose;
  }
  private step(dt:number,input:HoverInput){
    const p=this.pose;
    if(input.lift>.01&&!this.flying)this.launch();
    if(this.flying)this.clearance=clamp(this.clearance+input.lift*5*dt,.18,36);
    const desiredHeight=this.floor(p.x,p.z)+this.clearance;
    this.verticalSpeed+=((desiredHeight-p.y)*15-this.verticalSpeed*7.8)*dt;
    p.y=Math.max(this.floor(p.x,p.z)+.15,p.y+this.verticalSpeed*dt);
    this.landed=this.clearance<.3&&Math.abs(p.y-this.floor(p.x,p.z)-.18)<.12&&Math.abs(this.verticalSpeed)<.25;
    if(this.landed){this.flying=false;p.speed=0;this.lastSafe={x:p.x,z:p.z,heading:p.heading};}
    p.rpm=approach(p.rpm,this.flying?1+(input.boost?.45:0)+Math.abs(input.throttle)*.2:0,dt*(this.flying?.75:.5));
    let speed=p.speed;
    if(this.flying&&!input.brake){
      speed+=clamp(input.throttle,-1,1)*7*dt;
      speed=approach(speed,0,(input.throttle===0?1.5:.7)*dt);
      speed=clamp(speed,-7,input.boost?32:21);
    }else speed=approach(speed,0,18*dt);
    const steering=clamp(input.steer,-1,1);
    const heading=p.heading-steering*1.05*dt*(this.flying?1:0);
    const dx=Math.sin(heading)*speed*dt,dz=Math.cos(heading)*speed*dt,distance=Math.hypot(dx,dz);
    let blocked=false;
    if(distance>.00001){
      const direction={x:dx/distance,y:0,z:dz/distance};
      // Check both chassis and rider height; radius includes all fan guards.
      for(const h of [.22,.95,1.85]){
        const hit=this.terrain.raycastFlight({x:p.x,y:p.y+h,z:p.z},direction,distance+1.3,1.02);
        if(hit!==null){blocked=true;break;}
      }
    }
    if(blocked){speed=0;this.collision=true;}else{p.x+=dx;p.z+=dz;}
    p.heading=heading;p.speed=speed;
    // Keep the complete craft above the support surface at ramps and bridge transitions.
    p.y=Math.max(p.y,this.floor(p.x,p.z)+.15);
    p.pitch=approach(p.pitch,input.brake?.055:-clamp(speed/160,-.08,.16),dt*.32);
    p.roll=approach(p.roll,steering*clamp(Math.abs(speed)/65+.025,0,.27),dt*.65);
    p.lift=this.verticalSpeed;
    // Bounded local map; recover to the last safe ground if external state becomes invalid.
    if(!Number.isFinite(p.x+p.y+p.z)||Math.abs(p.x)>8000||Math.abs(p.z)>8000)this.reset();
  }
  exitPoint(){
    if(!this.landed||Math.abs(this.pose.speed)>.1||!this.terrain.land(this.pose.x,this.pose.z))return null;
    const p=this.pose;
    for(const side of [1,-1]){
      const x=p.x+Math.cos(p.heading)*side*2,z=p.z-Math.sin(p.heading)*side*2;
      if(this.terrain.land(x,z)&&!this.terrain.obstructed(x,z,.5))return{x,y:this.terrain.height(x,z),z,heading:p.heading};
    }
    return null;
  }
}
