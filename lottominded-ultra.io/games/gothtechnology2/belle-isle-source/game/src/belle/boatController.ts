import type {ParkTerrain} from './terrain.ts';
import type {FlightObstacle} from './hoverController.ts';
import {BOAT_PROFILES,boatClamp,type BoatKind} from './boatProfiles.ts';
export class BoatController {
 pose={x:0,y:0,z:0,heading:0,speed:0,pitch:0,roll:0};collision=false;
 telemetry={rpm:600,torqueNm:0,powerPercent:0,throttle:0,steer:0,acceleration:0,gForce:1,planing:0,yawRate:0};
 private engine=0;private time=0;private verticalSpeed=0;private trimVelocity=0;private bankVelocity=0;
 readonly terrain:ParkTerrain;private traffic?:FlightObstacle;readonly kind:BoatKind;
 constructor(terrain:ParkTerrain,traffic?:FlightObstacle,kind:BoatKind='offshore'){this.terrain=terrain;this.traffic=traffic;this.kind=kind;}
 get profile(){return BOAT_PROFILES[this.kind];}
 reset(x:number,z:number,heading:number){this.pose={x,y:0,z,heading,speed:0,pitch:0,roll:0};this.stop();this.time=0;this.verticalSpeed=0;this.trimVelocity=0;this.bankVelocity=0;this.collision=false;}
 stop(){this.pose.speed=0;this.engine=0;Object.assign(this.telemetry,{rpm:this.profile.idleRpm,torqueNm:0,powerPercent:0,throttle:0,steer:0,acceleration:0,gForce:1,planing:0,yawRate:0});}
 advance(dt:number,throttle:number,steer:number,brake:boolean){
  const duration=boatClamp(dt,0,.1);if(!duration)return this.pose;
  throttle=boatClamp(throttle,-1,1);steer=boatClamp(steer,-1,1);this.collision=false;
  const steps=Math.ceil(duration*60),t=duration/steps,c=this.profile,p=this.pose,info=this.telemetry;
  for(let n=0;n<steps;n++){
   this.time+=t;const speedBefore=p.speed;
   this.engine+=(Math.abs(brake?0:throttle)-this.engine)*(1-Math.exp(-t*2.5));
   info.planing=boatClamp((Math.abs(p.speed)-c.planeStart)/(c.planeEnd-c.planeStart),0,1);
   const watts=c.powerWatts*this.engine,force=Math.min(c.maxThrust,watts*.62/Math.max(6,Math.abs(p.speed)))*Math.sign(throttle)*(throttle<0?.18:1);
   const resistance=p.speed*(40+c.drag*(1-.72*info.planing)*Math.abs(p.speed));
   p.speed+=(force-resistance)/c.mass*t;if(brake)p.speed*=Math.exp(-3*t);
   p.speed=boatClamp(p.speed,-3,c.maxSpeed);if(Math.abs(p.speed)<.015&&Math.abs(throttle)<.01)p.speed=0;
   info.yawRate=-steer*Math.min(c.turnRate,Math.abs(p.speed)*.10)*Math.sign(p.speed)/(1+Math.abs(p.speed)/65);
   const heading=p.heading+info.yawRate*t,forward={x:Math.sin(heading),z:Math.cos(heading)},right={x:forward.z,z:-forward.x};
   const distance=Math.abs(p.speed*t),sign=Math.sign(p.speed),d={x:forward.x*sign,y:0,z:forward.z*sign},x=p.x+d.x*distance,z=p.z+d.z*distance;
   const halfLength=c.length/2-.3,halfBeam=c.beam/2-.15;
   const land=[-halfLength,0,halfLength].some(a=>[-halfBeam,0,halfBeam].some(b=>this.terrain.land(x+forward.x*a+right.x*b,z+forward.z*a+right.z*b,0)));
   const hit=[.35,1.0,c.height].some(y=>[-halfBeam,0,halfBeam].some(side=>{
    const o={x:p.x+right.x*side,y:p.y+y,z:p.z+right.z*side};return this.terrain.raycastFlight(o,d,distance+halfLength,.35)!==null||this.traffic?.(o,d,distance+halfLength,.35)!=null;
   }));
   if(land||hit||Math.abs(x)>7500||Math.abs(z)>7500){this.collision ||= Math.abs(p.speed)>.2;p.speed=0;}else{p.x=x;p.z=z;p.heading=heading;}
   info.acceleration=(p.speed-speedBefore)/t;
   const pitchTarget=-.035*info.planing-boatClamp(info.acceleration,-5,8)*.004,bankTarget=boatClamp(info.yawRate*p.speed/9.81,-.6,.6)*.09;
   this.trimVelocity+=((pitchTarget-p.pitch)*35-this.trimVelocity*10)*t;p.pitch+=this.trimVelocity*t;
   this.bankVelocity+=((bankTarget-p.roll)*30-this.bankVelocity*10)*t;p.roll+=this.bankVelocity*t;
   const water=.025*Math.sin(this.time*1.7+p.x*.012)+.07*info.planing,verticalAcceleration=(water-p.y)*30-this.verticalSpeed*9;
   this.verticalSpeed+=verticalAcceleration*t;p.y+=this.verticalSpeed*t;
   info.gForce=Math.hypot(1+verticalAcceleration/9.81,info.yawRate*p.speed/9.81);
   info.rpm=c.idleRpm+(c.maxRpm-c.idleRpm)*this.engine;info.torqueNm=info.rpm>1?watts/(info.rpm*Math.PI/30):0;
   info.powerPercent=this.engine*100;info.throttle=brake?0:throttle;info.steer=steer;
  }
  return p;
 }
}
