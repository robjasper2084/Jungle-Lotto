/** CORLEO game tuning — prototype values, not manufacturer specifications. */
export const CORLEO_TUNING = Object.freeze({
  mountingSaddleMetres: 0.8,
  trotMetresPerSecond: 1.23,
  runMetresPerSecond: 1.7835,
  crawlMetresPerSecond: 0.36,
  turnRadiansPerSecond: 1.4,
  accelerationMetresPerSecondSquared: 2.1,
  brakingMetresPerSecondSquared: 3.5,
  jumpVelocityMetresPerSecond: 3.2,
  gravityMetresPerSecondSquared: 9.81
});
export type CorleoStyle = 'Professional' | 'Maverick';
export type CorleoGait = 'idle' | 'walk' | 'run' | 'crawl' | 'jump';
export type CorleoPose = {
  x:number; y:number; z:number; heading:number; speed:number;
  gait:CorleoGait; gaitPhase:number; airMetres:number; verticalSpeed:number;
  saddleMetres:number;
};
export type CorleoInput = {throttle:number;steer:number;run?:boolean;crawl?:boolean;jump?:boolean;lower?:boolean};
const clamp=(v:number,low:number,high:number)=>Math.min(high,Math.max(low,Number.isFinite(v)?v:0));
export class CorleoMotion {
 readonly pose:CorleoPose;
 constructor(spawn:{x:number;y:number;z:number;heading:number}){
  this.pose={...spawn,speed:0,gait:'idle',gaitPhase:0,airMetres:0,verticalSpeed:0,saddleMetres:1.15};
 }
 reset(p:{x:number;y:number;z:number;heading:number}){
  Object.assign(this.pose,p,{speed:0,gait:'idle',gaitPhase:0,airMetres:0,verticalSpeed:0,saddleMetres:1.15});
 }
 tick(dt:number,input:CorleoInput,terrainHeight:(x:number,z:number)=>number,blocked:(x:number,z:number)=>boolean){
  const p=this.pose,step=clamp(dt,0,.05);
  if(!step)return p;
  const throttle=clamp(input.throttle,-1,1),steer=clamp(input.steer,-1,1);
  const crawl=!!input.crawl,run=!!input.run&&!crawl;
  const desired=throttle*(crawl?CORLEO_TUNING.crawlMetresPerSecond:run?CORLEO_TUNING.runMetresPerSecond:CORLEO_TUNING.trotMetresPerSecond);
  const delta=clamp(desired-p.speed,-(Math.abs(throttle)<.01?CORLEO_TUNING.brakingMetresPerSecondSquared:CORLEO_TUNING.accelerationMetresPerSecondSquared)*step,CORLEO_TUNING.accelerationMetresPerSecondSquared*step);
  p.speed+=delta;
  p.heading+=steer*step*CORLEO_TUNING.turnRadiansPerSecond*(.35+Math.min(1,Math.abs(p.speed)/.6)*.65);
  const x=p.x+Math.sin(p.heading)*p.speed*step,z=p.z+Math.cos(p.heading)*p.speed*step;
  if(!blocked(x,z)){p.x=x;p.z=z;}else p.speed=0;
  const ground=terrainHeight(p.x,p.z);
  if(input.jump&&p.airMetres===0&&!crawl){p.verticalSpeed=CORLEO_TUNING.jumpVelocityMetresPerSecond;p.airMetres=.001;}
  if(p.airMetres>0){
   p.airMetres=Math.max(0,p.airMetres+p.verticalSpeed*step);
   p.verticalSpeed-=CORLEO_TUNING.gravityMetresPerSecondSquared*step;
   if(p.airMetres===0)p.verticalSpeed=0;
  }
  p.y=ground+p.airMetres;
  p.gait=p.airMetres>0?'jump':Math.abs(p.speed)<.045?'idle':crawl?'crawl':run?'run':'walk';
  p.gaitPhase=(p.gaitPhase+Math.abs(p.speed)*step/(crawl?.46:run?1.3:.85))%1;
  const saddleTarget=input.lower||crawl?CORLEO_TUNING.mountingSaddleMetres:1.15;
  p.saddleMetres+=clamp(saddleTarget-p.saddleMetres,-step*.75,step*.75);
  return p;
 }
}
