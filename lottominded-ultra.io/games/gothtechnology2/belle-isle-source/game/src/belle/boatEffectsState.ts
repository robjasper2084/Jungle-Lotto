import {boatClamp} from './boatProfiles.ts';
export type BoatEffectInput={speed:number;throttle:number;powerPercent:number;yawRate:number;acceleration:number;verticalAcceleration:number};
/** Shared by exhaust light, particles and audio: no flame while braking or reversing. */
export function jetPower(p:Pick<BoatEffectInput,'throttle'|'powerPercent'>){
 return boatClamp(p.throttle,0,1)*boatClamp(p.powerPercent/100,0,1);
}
export function smoothHelm(angle:number,steer:number,dt:number){
 return angle+(-boatClamp(steer,-1,1)*.85-angle)*(1-Math.exp(-12*boatClamp(dt,0,.1)));
}
export function hullSprayStrength(p:BoatEffectInput){
 const speed=boatClamp(Math.abs(p.speed)/28,0,1);
 return boatClamp(speed*(.2+Math.abs(p.yawRate)*2)+Math.max(0,p.verticalAcceleration)*speed*.12+Math.abs(p.acceleration)*speed*.025,0,1);
}
export type WakeSample={x:number;z:number;dx:number;dz:number;width:number;power:number;time:number;distance:number;chain:number};
/** Fixed ring: samples are world-space and never move with the boat. */
export class WakeHistory{
 readonly capacity=128;readonly lifetime=9;
 readonly samples:Array<WakeSample|undefined>=new Array(this.capacity);
 count=0;head=0;time=0;private chain=0;private distance=0;
 advance(dt:number){this.time+=boatClamp(dt,0,.1);while(this.count&&this.time-this.at(0)!.time>this.lifetime){this.head=(this.head+1)%this.capacity;this.count--;}}
 at(i:number){return i>=0&&i<this.count?this.samples[(this.head+i)%this.capacity]:undefined;}
 break(){this.chain++;}
 clear(){this.samples.fill(undefined);this.count=this.head=this.time=this.distance=0;this.chain++;}
 add(x:number,z:number,heading:number,width:number,power:number){
  if(![x,z,heading,width,power].every(Number.isFinite))return;
  const last=this.at(this.count-1),distance=last?Math.hypot(x-last.x,z-last.z):0;
  if(last&&last.chain===this.chain){
   if(distance>20)this.break();
   else if(distance<.8&&this.time-last.time<.15)return;
   else if(distance<.08)return;
  }
  this.distance+=Math.min(distance,20);
  if(this.count===this.capacity){this.head=(this.head+1)%this.capacity;this.count--;}
  this.samples[(this.head+this.count++)%this.capacity]={x,z,dx:Math.sin(heading),dz:Math.cos(heading),width,power:boatClamp(power,0,1),time:this.time,distance:this.distance,chain:this.chain};
 }
}
