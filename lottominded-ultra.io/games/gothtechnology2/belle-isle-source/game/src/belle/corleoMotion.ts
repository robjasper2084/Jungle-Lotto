/** CORLEO game tuning — prototype values, not manufacturer specifications. */
export const CORLEO_TUNING = Object.freeze({
  mountingSaddleMetres: 0.8,
  trotMetresPerSecond: 25 * 0.44704,
  runMetresPerSecond: 160 * 0.44704,
  crawlMetresPerSecond: 0.36,
  turnRadiansPerSecond: 1.4,
  accelerationMetresPerSecondSquared: 4.5,
  runAccelerationMetresPerSecondSquared: 12,
  brakingMetresPerSecondSquared: 18,
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
  const desired=throttle*(crawl?CORLEO_TUNING.crawlMetresPerSecond:run&&throttle>0?CORLEO_TUNING.runMetresPerSecond:CORLEO_TUNING.trotMetresPerSecond);
  const braking=Math.abs(desired)<Math.abs(p.speed)||desired*p.speed<0;
  const rate=braking?CORLEO_TUNING.brakingMetresPerSecondSquared:run?CORLEO_TUNING.runAccelerationMetresPerSecondSquared:CORLEO_TUNING.accelerationMetresPerSecondSquared;
  const delta=clamp(desired-p.speed,-rate*step,rate*step);
  p.speed+=delta;
  // Match the shared controls: positive steer is right in the +Z-forward world.
  p.heading-=steer*step*CORLEO_TUNING.turnRadiansPerSecond*(.35+Math.min(1,Math.abs(p.speed)/.6)*.65)/(1+Math.abs(p.speed)/18);
  // Check the entire travelled segment: a 160 mph frame can cover 3.58 m.
  // End-point-only collision would skip narrow walls and shore boundaries.
  const distance=p.speed*step,segments=Math.max(1,Math.ceil(Math.abs(distance)/.25));
  const dx=Math.sin(p.heading)*distance/segments,dz=Math.cos(p.heading)*distance/segments;
  for(let i=0;i<segments;i++){
   const x=p.x+dx,z=p.z+dz;
   if(blocked(x,z)){p.speed=0;break;}p.x=x;p.z=z;
  }
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
