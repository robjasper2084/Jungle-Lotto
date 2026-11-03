/** Original arcade cruiser physics. Metres, seconds and radians; forward is local +Z. */
export type CarGear = 'P' | 'R' | 'N' | 'D';
export interface CarGround {
  height(x:number,z:number,referenceY?:number):number;
  land(x:number,z:number,referenceY?:number):boolean;
  obstructed(x:number,z:number,margin?:number):unknown;
  bridge(x:number,z:number):{active:boolean;t:number;side:number};
  raycastObstacle(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half?:number):number|null;
}
export interface CarInput {gas:number;brake:number;steer:number;handbrake:boolean}
export interface CarPose {x:number;y:number;z:number;heading:number;speed:number;steering:number;pitch:number;roll:number;distance:number}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const approach=(v:number,target:number,amount:number)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
export const CAR={halfWidth:1.05,halfLength:2.95,wheelbase:3.3,topSpeed:28,reverseSpeed:7} as const;

export class CarController {
  pose:CarPose;
  gear:CarGear='P';
  engine=false;
  cruise=0;
  braking=false;
  collided=false;
  private reverseHold=0;
  private autoReverse=false;
  constructor(readonly terrain:CarGround,spawn:{x:number;z:number;heading:number}) {
    this.pose={...spawn,y:terrain.height(spawn.x,spawn.z),speed:0,steering:0,pitch:0,roll:0,distance:0};
  }
  /** A grid over the entire body catches corners, small obstacles, and shore edges. */
  valid(x:number,z:number,heading:number,referenceY=this.pose.y):boolean {
    const s=Math.sin(heading),c=Math.cos(heading);
    for(const localZ of [-2.95,-1.5,0,1.5,2.95])for(const localX of [-1.05,0,1.05]){
      const px=x+c*localX+s*localZ,pz=z-s*localX+c*localZ;
      if(!this.terrain.land(px,pz,referenceY)||this.terrain.obstructed(px,pz,.23))return false;
      const b=this.terrain.bridge(px,pz);
      if(b.active&&referenceY>=4&&Math.abs(b.side)>11.4)return false;
      if(Math.abs(this.terrain.height(px,pz,referenceY)-referenceY)>1.3)return false;
    }
    return true;
  }
  reset(x:number,z:number,heading:number) {
    const y=this.terrain.height(x,z);
    if(!this.valid(x,z,heading,y))return false;
    this.pose={x,y,z,heading,speed:0,steering:0,pitch:0,roll:0,distance:this.pose.distance};
    this.gear='P';this.cruise=0;this.autoReverse=false;this.reverseHold=0;return true;
  }
  selectGear(gear:CarGear) {
    if(Math.abs(this.pose.speed)>.5)return false;
    this.pose.speed=0;this.gear=gear;this.cruise=0;this.autoReverse=false;this.reverseHold=0;return true;
  }
  toggleEngine(){this.engine=!this.engine;this.cruise=0;}
  toggleCruise(){
    if(this.cruise){this.cruise=0;return false;}
    if(this.engine&&this.gear==='D'&&this.pose.speed>2){this.cruise=this.pose.speed;return true;}
    return false;
  }
  cancelCruise(){this.cruise=0;this.reverseHold=0;}
  /** Fixed-size substeps prevent tunnelling and make braking independent of display FPS. */
  advance(seconds:number,input:CarInput) {
    const elapsed=clamp(Number.isFinite(seconds)?seconds:0,0,.12);
    const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
    this.collided=false;
    if(input.brake>.02||input.handbrake||Math.abs(input.steer)>.8)this.cruise=0;
    for(let i=0;i<steps;i++)this.step(dt,input);
    return this.pose;
  }
  private step(dt:number,input:CarInput) {
    const p=this.pose;
    let gas=clamp(input.gas,0,1),brake=clamp(input.brake,0,1);
    if(this.autoReverse){
      if(gas>.02){
        if(p.speed<-.25){brake=Math.max(brake,gas);gas=0;}
        else{this.gear='D';this.autoReverse=false;}
      }else if(brake>.02){gas=brake;brake=0;}
    }else if(this.gear==='D'&&brake>.02&&!gas&&Math.abs(p.speed)<.25&&!input.handbrake){
      this.reverseHold+=dt;
      if(this.reverseHold>.45){this.gear='R';this.autoReverse=true;gas=brake;brake=0;}
    }else this.reverseHold=0;
    if(!this.engine||this.gear==='N'||this.gear==='P')gas=0;
    if(this.cruise&&this.engine&&this.gear==='D')gas=Math.max(gas,clamp((this.cruise-p.speed)*.8+.07,0,1));
    if(this.gear==='P')brake=1;
    this.braking=brake>.02||input.handbrake||this.gear==='P';
    const steeringLimit=.52/(1+Math.abs(p.speed)*.035);
    p.steering=approach(p.steering,-clamp(input.steer,-1,1)*steeringLimit,dt*1.5);
    const sign=this.gear==='R'?-1:1,top=sign<0?CAR.reverseSpeed:CAR.topSpeed;
    let next=p.speed+sign*gas*3.9*Math.max(.15,1-Math.abs(p.speed)/top)*dt;
    const resistance=.16+Math.abs(p.speed)*.025+p.speed*p.speed*.0014;
    next=approach(next,0,(resistance+brake*8.5+(input.handbrake?13:0))*dt);
    next=clamp(next,-CAR.reverseSpeed,CAR.topSpeed);
    if(Math.abs(next)<.025&&!gas)next=0;
    const yawRate=next/CAR.wheelbase*Math.tan(p.steering);
    const heading=p.heading+yawRate*dt;
    const mid=p.heading+yawRate*dt*.5;
    const nx=p.x+Math.sin(mid)*next*dt,nz=p.z+Math.cos(mid)*next*dt;
    if(!this.valid(nx,nz,heading,p.y)){
      p.speed=0;this.cruise=0;this.collided=true;return;
    }
    if(Math.abs(next)>.01){
      const dir={x:Math.sin(mid)*Math.sign(next),y:0,z:Math.cos(mid)*Math.sign(next)};
      const hit=this.terrain.raycastObstacle({x:p.x,y:p.y+.65,z:p.z},dir,CAR.halfLength+Math.abs(next*dt)+.15,CAR.halfWidth);
      if(hit!==null&&hit<=CAR.halfLength+Math.abs(next*dt)+.08){p.speed=0;this.cruise=0;this.collided=true;return;}
    }
    p.x=nx;p.z=nz;p.heading=heading;p.speed=next;p.distance+=Math.abs(next*dt);
    p.y=this.terrain.height(nx,nz,p.y);
    const s=Math.sin(heading),c=Math.cos(heading);
    const front=this.terrain.height(nx+s*1.65,nz+c*1.65,p.y),back=this.terrain.height(nx-s*1.65,nz-c*1.65,p.y);
    const left=this.terrain.height(nx+c*.85,nz-s*.85,p.y),right=this.terrain.height(nx-c*.85,nz+s*.85,p.y);
    p.pitch=approach(p.pitch,-Math.atan2(front-back,3.3),dt*.5);
    p.roll=approach(p.roll,Math.atan2(left-right,1.7)+clamp(yawRate*next*.0015,-.035,.035),dt*.35);
  }
  exitPoint(){
    if(Math.abs(this.pose.speed)>.5)return null;
    const p=this.pose,c=Math.cos(p.heading),s=Math.sin(p.heading);
    for(const [lx,lz]of [[1.8,-.35],[-1.8,-.35],[0,-3.8],[0,3.8]]){
      const x=p.x+c*lx+s*lz,z=p.z-s*lx+c*lz;
      if(this.terrain.land(x,z,p.y)&&!this.terrain.obstructed(x,z,.5)&&Math.abs(this.terrain.height(x,z,p.y)-p.y)<.6){
        const b=this.terrain.bridge(x,z);if(b.active&&p.y>=4&&Math.abs(b.side)>11.2)continue;
        return{x,y:this.terrain.height(x,z,p.y),z,heading:p.heading};
      }
    }
    return null;
  }
}
