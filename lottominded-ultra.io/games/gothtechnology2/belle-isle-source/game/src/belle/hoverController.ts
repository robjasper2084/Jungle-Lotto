import {HoverTransmission} from './hoverTransmission.ts';
import {inside} from './terrain.ts';
import type {ParkTerrain} from './terrain.ts';
import {HOVER_TOP_SPEED,mphToMps,speedMph} from './speedUnits.ts';
export interface HoverInput {throttle:number;steer:number;strafe?:number;lift:number;brake:boolean;boost:boolean;clutch?:number}
export type FlightObstacle=(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half:number)=>number|null;
export type FlightMode='classic'|'drone';
/** Neutral dead band and exponential response preserve delicate stick movement. */
export function flightAxis(value:number){const n=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0,a=Math.max(0,(Math.abs(n)-.06)/.94);return Math.sign(n)*(.35*a+.65*a*a*a);}
export interface HoverPose {x:number;y:number;z:number;heading:number;speed:number;pitch:number;roll:number;lift:number;rpm:number}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const approach=(n:number,target:number,d:number)=>n<target?Math.min(target,n+d):Math.max(target,n-d);
/** Fixed-step fan flight. World-space momentum survives heading changes. */
export class HoverController {
 mode:FlightMode='classic';readonly drive=new HoverTransmission();
 private takeoffAge=0;private droneForward=0;private droneSide=0;private vx=0;private vz=0;private yawRate=0;
 boostEnergy=1;boostActive=false;private boostLocked=false;private rechargeDelay=0;
 cruiseSpeed:number|null=null;
 throttleDemand=0;
 toggleCruise(){
  if(this.cruiseSpeed!==null){this.cancelCruise();return false;}
  const along=this.vx*Math.sin(this.pose.heading)+this.vz*Math.cos(this.pose.heading);
  if(!this.flying||this.clearance<=.3||along<mphToMps(5)||this.collision)return false;
  this.cruiseSpeed=clamp(mphToMps(speedMph(along)),mphToMps(5),HOVER_TOP_SPEED);return true;
 }
 adjustCruise(mph:number){if(this.cruiseSpeed!==null&&Number.isFinite(mph))this.cruiseSpeed=clamp(this.cruiseSpeed+mphToMps(mph),mphToMps(5),HOVER_TOP_SPEED);}
 cancelCruise(){this.cruiseSpeed=null;}
 setMode(mode:FlightMode){this.stop();this.mode=mode;}
  pose:HoverPose;
  clearance=.18;
  flying=false;
  landed=true;
  collision=false;
  impactSpeed=0;hazard=false;private hazardClock=0;
  private verticalSpeed=0;
  private lastSafe:{x:number;z:number;heading:number};
  readonly terrain:ParkTerrain;private obstacle?:FlightObstacle;
  constructor(terrain:ParkTerrain,spawn:{x:number;z:number;heading:number},obstacle?:FlightObstacle){this.obstacle=obstacle;
    this.terrain=terrain;this.lastSafe={...spawn};
    this.pose={...spawn,y:this.floor(spawn.x,spawn.z)+.18,speed:0,pitch:0,roll:0,lift:0,rpm:0};
  }
  floor(x:number,z:number){const b=this.terrain.bridge?.(x,z),under=b?.active&&!!this.pose&&this.pose.y<this.terrain.height(x,z)-.5;const reference=under?0:undefined;return this.terrain.land(x,z,reference)?this.terrain.height(x,z,reference):this.terrain.map.water.some(w=>inside(x,z,w.points)&&!w.holes.some(h=>inside(x,z,h)))?1.05:0;}
  launch(){if(!this.flying||this.clearance<=.3)this.takeoffAge=0;this.flying=true;this.clearance=Math.max(1.4,this.clearance);this.landed=false;}
 land(){this.cancelCruise();this.clearance=.18;this.boostActive=false;}
 stop(){this.drive.clear();this.cancelCruise();this.throttleDemand=0;this.pose.speed=0;this.droneForward=this.droneSide=0;this.vx=this.vz=this.yawRate=0;this.verticalSpeed=0;this.boostActive=false;}
  reset(x=this.lastSafe.x,z=this.lastSafe.z,heading=this.lastSafe.heading){
    this.pose={x,z,heading,y:this.floor(x,z)+.18,speed:0,pitch:0,roll:0,lift:0,rpm:0};
  this.clearance=.18;this.takeoffAge=0;this.flying=false;this.landed=true;this.stop();
  }
  /** Start a flight course at its authored height, with no inherited momentum. */
  startFlight(p:{x:number;y:number;z:number;heading:number}){
    if(![p.x,p.y,p.z,p.heading].every(Number.isFinite))return false;
    const clearance=p.y-this.floor(p.x,p.z);
    if(clearance<1.4||clearance>36||Math.abs(p.x)>8000||Math.abs(p.z)>8000)return false;
    this.reset(p.x,p.z,p.heading);
    this.clearance=clearance;this.pose.y=p.y;this.pose.rpm=1;
    // A course starts already airborne; countdown and pause must not replay takeoff easing.
    this.takeoffAge=1;this.flying=true;this.landed=false;this.collision=false;
    return true;
  }
  advance(seconds:number,input:HoverInput){
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.12),steps=Math.max(1,Math.ceil(dt*120));
    this.collision=false;this.impactSpeed=0;this.hazardClock-=dt;
    const throttle=this.drive.sample(input.throttle,input.clutch,input.brake);if(this.drive.gear===0||this.drive.clutch>.05)this.cancelCruise();input={...input,throttle,strafe:(input.strafe??0)*(this.drive.gear===0?0:1-this.drive.clutch)};
    for(let i=0;i<steps;i++)this.step(dt/steps,input);
    return this.pose;
  }
  /** Four skid contacts keep the chassis clear without inheriting flight banking. */
  private support(){
    const p=this.pose,s=Math.sin(p.heading),c=Math.cos(p.heading);
    const sample=(x:number,z:number)=>this.floor(p.x+c*x+s*z,p.z-s*x+c*z);
    const fl=sample(-.67,.95),fr=sample(.67,.95),rl=sample(-.67,-.95),rr=sample(.67,-.95);
    return {height:Math.max(this.floor(p.x,p.z),fl,fr,rl,rr),pitch:clamp(-Math.atan2((fl+fr-rl-rr)*.5,1.9),-.12,.12),roll:clamp(Math.atan2((fr+rr-fl-rl)*.5,1.34),-.12,.12)};
  }
  private step(dt:number,input:HoverInput){
    const p=this.pose;
    let forward=flightAxis(input.throttle);
    const lateral=this.mode==='drone'?flightAxis(input.strafe??0):0,steering=flightAxis(input.steer);
    if(input.lift>.01&&!this.flying)this.launch();
    if(this.flying)this.clearance=clamp(this.clearance+(this.mode==='drone'?flightAxis(input.lift):input.lift)*5*dt,.18,36);
    const support=this.support(),desiredHeight=support.height+this.clearance;
    const terrainRise=this.flying?clamp((this.floor(p.x+this.vx*.08,p.z+this.vz*.08)-this.floor(p.x,p.z))/.08,-12,12):0;
    this.verticalSpeed+=((desiredHeight-p.y)*15-(this.verticalSpeed-terrainRise)*7.8)*dt;
    const dy=this.verticalSpeed*dt;
    if(dy>0&&this.terrain.raycastFlight({x:p.x,y:p.y+1.95,z:p.z},{x:0,y:1,z:0},dy+.08,.85)!==null){this.impactSpeed=Math.max(this.impactSpeed,Math.abs(this.verticalSpeed));this.verticalSpeed=0;this.clearance=Math.max(.18,p.y-support.height);this.collision=true;this.cancelCruise();}
    else if(dy<0){const hit=this.terrain.raycastFlight({x:p.x,y:p.y+.16,z:p.z},{x:0,y:-1,z:0},-dy+.16,.85);if(hit!==null&&hit<-dy+.16){this.impactSpeed=Math.max(this.impactSpeed,Math.abs(this.verticalSpeed));p.y+=.16-hit+.02;this.verticalSpeed=0;this.clearance=Math.max(.18,p.y-support.height);this.collision=true;this.cancelCruise();}else p.y=Math.max(support.height+.15,p.y+dy);}else p.y=Math.max(support.height+.15,p.y+dy);
    const moving=this.flying&&this.clearance>.3;
    if(!moving||input.brake||forward<-.05||input.boost)this.cancelCruise();
    const cruise=this.cruiseSpeed!==null;
    if(cruise){
      const along=this.vx*Math.sin(p.heading)+this.vz*Math.cos(p.heading);
      const drag=along*(.04+.0007*Math.abs(along));
      // Feed-forward drag compensation plus proportional speed control, in m/s.
      // A positive throttle temporarily overrides the set speed; releasing resumes it.
      forward=Math.max(forward,clamp((drag+(this.cruiseSpeed!-along)*2.2)/10,0,1));
    }
    this.throttleDemand=moving&&!input.brake?Math.max(0,forward):0;
    this.rechargeDelay=Math.max(0,this.rechargeDelay-dt);
    if(!input.boost&&this.boostEnergy>=.22)this.boostLocked=false;
    this.boostActive=moving&&!input.brake&&(forward>.08||(this.mode==='drone'&&Math.abs(lateral)>.08))&&input.boost&&!this.boostLocked&&this.boostEnergy>0;
    if(this.boostActive){this.boostEnergy=Math.max(0,this.boostEnergy-dt*.16);this.rechargeDelay=1.2;if(this.boostEnergy===0){this.boostLocked=true;this.boostActive=false;}}
    else if(this.rechargeDelay===0)this.boostEnergy=Math.min(1,this.boostEnergy+dt*.09);
    const smooth=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
    const gain=(.35+.65*smooth(this.takeoffAge+dt*.5))*(this.mode==='drone'?1-.45*smooth((Math.abs(p.speed)-8)/24):1/(1+Math.pow(Math.abs(p.speed)/38,2)));
    if(moving)this.takeoffAge=Math.min(1,this.takeoffAge+dt);
    this.yawRate=moving?steering*1.05*gain:0;
    const heading=p.heading-this.yawRate*dt,sin=Math.sin(heading),cos=Math.cos(heading);
    const oldX=this.vx,oldZ=this.vz,speedAlong=oldX*sin+oldZ*cos,sideAlong=-oldX*cos+oldZ*sin;
    let acceleration=0,sideAcceleration=0;
    if(moving&&!input.brake){
      const norm=Math.max(1,Math.hypot(forward,lateral));
      // Quadratic drag grows with airspeed; released throttle coasts to a stop.
      acceleration=forward/norm*(this.boostActive?18:10)-speedAlong*(.04+.0007*Math.abs(speedAlong));
      if(cruise&&input.throttle<=.06&&speedAlong>this.cruiseSpeed!)acceleration=Math.min(acceleration,(this.cruiseSpeed!-speedAlong)*2.2);
      sideAcceleration=lateral/norm*10-sideAlong*(1.25+.015*Math.abs(sideAlong));
      if(forward===0&&!cruise)acceleration-=speedAlong*.04;
      if(speedAlong<-7)acceleration+=(-7-speedAlong)*3;
      this.vx+=(sin*acceleration-cos*sideAcceleration)*dt;
      this.vz+=(cos*acceleration+sin*sideAcceleration)*dt;
    }else{
      const speed=Math.hypot(oldX,oldZ),next=Math.max(0,speed-(input.brake?18:12)*dt),ratio=speed?next/speed:0;
      this.vx*=ratio;this.vz*=ratio;
      acceleration=dt?(this.vx-oldX)*sin/dt+(this.vz-oldZ)*cos/dt:0;
    }
    if(this.mode==='drone'&&!cruise){
      const max=(this.boostActive?32:21)*this.drive.ratio,norm=Math.max(1,Math.hypot(forward,lateral));
      this.droneForward=moving&&!input.brake&&forward!==0?approach(this.droneForward,forward/norm*(forward<0?7:max),14*dt):0;
      this.droneSide=moving&&!input.brake&&lateral!==0?approach(this.droneSide,lateral/norm*max,14*dt):0;
      this.vx=sin*this.droneForward-cos*this.droneSide;this.vz=cos*this.droneForward+sin*this.droneSide;
    }
    // Apply the same top speed to diagonal input and boost; boost reaches it sooner.
    const airspeed=Math.hypot(this.vx,this.vz);
    const limit=HOVER_TOP_SPEED*this.drive.ratio;if(airspeed>limit){this.vx*=limit/airspeed;this.vz*=limit/airspeed;}
    if(Math.hypot(this.vx,this.vz)<.035&&forward===0&&lateral===0)this.vx=this.vz=0;
    const dx=this.vx*dt,dz=this.vz*dt,distance=Math.hypot(dx,dz);
    let blocked=false;
    if(distance>.00001){
      const direction={x:dx/distance,y:0,z:dz/distance};
      // Check both chassis and rider height; radius includes all fan guards.
      for(const h of [.22,.95,1.85]){
        const hit=this.terrain.raycastFlight({x:p.x,y:p.y+h,z:p.z},direction,distance+1.3,1.02);
        if(hit!==null||this.obstacle?.({x:p.x,y:p.y+h,z:p.z},direction,distance+1.3,1.02)!=null){blocked=true;break;}
      }
    }
    if(blocked){this.impactSpeed=Math.max(this.impactSpeed,Math.hypot(this.vx,this.vz));this.vx=this.vz=this.droneForward=this.droneSide=0;this.collision=true;this.cancelCruise();this.throttleDemand=0;}else{p.x+=dx;p.z+=dz;}
    if(this.hazardClock<=0){this.hazardClock=.18;this.hazard=!blocked&&distance>.001&&this.terrain.raycastFlight({x:p.x,y:p.y+.95,z:p.z},{x:dx/distance,y:0,z:dz/distance},Math.min(18,Math.hypot(this.vx,this.vz)*.65+2),1.02)!==null;}
    p.heading=heading;p.speed=Math.hypot(this.vx,this.vz)*((this.vx*sin+this.vz*cos)<-.05?-1:1);
    // Keep the complete craft above the support surface at ramps and bridge transitions.
    const contact=this.support();p.y=Math.max(p.y,contact.height+.15);
    this.landed=this.clearance<.3&&Math.abs(p.y-contact.height-.18)<.12&&Math.abs(this.verticalSpeed)<.25&&Math.abs(p.speed)<.1;
    if(this.landed){this.flying=false;this.vx=this.vz=0;p.speed=0;this.lastSafe={x:p.x,z:p.z,heading:p.heading};}
    const air=clamp((p.y-contact.height-.22)/.9,0,1),flightPitch=-clamp(acceleration*.018+speedAlong*.003,-.20,.25),flightRoll=this.mode==='drone'?clamp(this.droneSide/400,-.065,.065):clamp(this.yawRate*Math.abs(p.speed)*.014,-.34,.34);
    p.pitch=approach(p.pitch,contact.pitch*(1-air)+flightPitch*air,dt*.7);
    p.roll=approach(p.roll,contact.roll*(1-air)+flightRoll*air,dt*.9);
    p.rpm=approach(p.rpm,this.flying?1+(this.boostActive?.5:0)+Math.abs(forward)*.15+Math.min(.12,Math.abs(this.verticalSpeed)*.025):0,dt*(this.flying?1.4:.7));
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
