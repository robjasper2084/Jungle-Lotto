import {createPose} from './controller.ts';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const smooth=(a:number,b:number,rate:number,dt:number)=>a+(b-a)*(1-Math.exp(-rate*dt));
/** One continuous pose per cyclist. Wheels follow travel; the crank follows effort. */
export class CyclistMotion {
 readonly pose=createPose();pedals:number;steering=0;effort=0;
 private previous?:{x:number;y:number;z:number;headingY:number;speed:number};private clock=0;
 readonly seed:number;
 constructor(seed=0){this.seed=seed;this.pedals=seed*1.77;}
 step(dt:number,r:{x:number;y:number;z:number;headingY:number;speed:number}){
  const old=this.previous,p=this.pose;dt=clamp(dt,0,.1);
  Object.assign(p,{x:r.x,y:r.y,z:r.z,speed:r.speed});
  if(!old||Math.hypot(r.x-old.x,r.z-old.z)>4){this.previous={...r};p.headingY=r.headingY;p.stopFoot=r.speed<.15?1:0;return p;}
  if(dt<=0)return p;this.clock+=dt;
  const turn=angle(r.headingY-p.headingY)*(1-Math.exp(-7*dt));p.headingY+=turn;
  const accel=clamp((r.speed-old.speed)/dt,-3,2),yaw=clamp(turn/dt,-1.3,1.3);
  const speed=Math.abs(r.speed),moving=speed>.12;
  // Different riders take short coasting rests. Braking always stops the crank.
  const coast=accel<-.18||(speed>2.6&&Math.sin(this.clock*.72+this.seed*2.13)>.72&&accel<.12);
  this.effort=smooth(this.effort,moving&&!coast?1:0,coast?9:4,dt);
  if(moving)this.pedals+=this.effort*(2.1+Math.min(4,speed*.75))*(.94+(this.seed%5)*.035)*dt;
  p.wheelSpin+=Math.hypot(r.x-old.x,r.z-old.z)/.34;
  this.steering=smooth(this.steering,moving?clamp(Math.atan(yaw*1.09/Math.max(.6,speed)),-.55,.55):0,7,dt);
  p.rollAngle=smooth(p.rollAngle,moving?clamp(-Math.atan(speed*yaw/9.81),-.42,.42):0,6,dt);
  p.groundPitch=smooth(p.groundPitch,clamp(-Math.atan2(r.y-old.y,Math.max(.01,speed*dt)),-.3,.3),5,dt);
  p.stopFoot=smooth(p.stopFoot,speed<.18?1:0,speed>.18?7:4,dt);
  p.riderPitch=smooth(p.riderPitch,accel*.045+speed*.009,5,dt);p.brakeAmount=smooth(p.brakeAmount,clamp(-accel/2.5,0,1),6,dt);
  p.driveIntent=this.effort;p.turnIntent=this.steering/.55;p.yawRate=yaw;
  this.previous={...r};return p;
 }
}

/** Only skeletal fitting is throttled; root movement and wheel travel stay continuous. */
export class RiderCadence {
 private clocks=new Map<number,number>();
 due(id:number,dt:number,distance:number){const interval=distance<22?0:distance<50?1/20:1/10;
  const elapsed=(this.clocks.get(id)??interval)+Math.max(0,dt);if(elapsed+1e-8>=interval){this.clocks.set(id,interval?Math.max(0,elapsed-interval*Math.floor((elapsed+1e-8)/interval)):0);return true;}this.clocks.set(id,elapsed);return false;}
 remove(id:number){this.clocks.delete(id);}
}
