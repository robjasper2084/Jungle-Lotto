import type {FootPose} from './onFoot.ts';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Short-legged mascots keep a readable cadence rather than tripling the human
 * cycle. This affects presentation only; every hero retains the same move speed. */
export const gaitScale=(legLength:number)=>Math.max(.88,legLength/.9);
export const movementDirection=(p:Partial<FootPose>)=>{
 const h=p.headingY||0,x=p.velocityX||0,z=p.velocityZ||0;
 if(Math.hypot(x,z)<.02)return(p.speed||0)<0?Math.PI:0;
 return Math.atan2(x*Math.cos(h)-z*Math.sin(h),x*Math.sin(h)+z*Math.cos(h));
};
/** Redirect reach around the planted prone stance, not around the rider origin.
 * Rotating the whole pose would swing feet through the torso on a back-step. */
export function crawlReach(x:number,z:number,travel:number,direction:number){
 return {x:x+travel*Math.sin(direction),z:z+travel*Math.cos(direction)};
}
/** Read-only animation history. Never affects authoritative movement. */
export class FootAnimation {
 private time=-1;private heading=0;private speed=0;turn=0;acceleration=0;turnCycle=0;pace=0;direction=0;
 update(p:Partial<FootPose>){
  const time=p.footTime||0,dt=time-this.time;
  if(this.time<0||dt<0||dt>.25){this.turn=this.acceleration=0;this.turnCycle=0;this.pace=Math.abs(p.speed||0);this.direction=movementDirection(p);}
  else if(dt>0){
   const d=Math.atan2(Math.sin((p.headingY||0)-this.heading),Math.cos((p.headingY||0)-this.heading));
   const blend=1-Math.exp(-12*dt);
   this.turn+=(clamp(d/dt,-3,3)-this.turn)*blend;
   this.acceleration+=(clamp(((p.speed||0)-this.speed)/dt,-8,8)-this.acceleration)*blend;
   // Brief presentation-only easing prevents sprint/strafe/idle snaps. The
   // captured walk cycle, input response and collision velocity stay intact.
   this.pace+=(Math.abs(p.speed||0)-this.pace)*(1-Math.exp(-20*dt));if(this.pace<.025)this.pace=0;
   if(Math.abs(p.speed||0)>.04){const target=movementDirection(p),delta=Math.atan2(Math.sin(target-this.direction),Math.cos(target-this.direction));this.direction+=delta*(1-Math.exp(-22*dt));}
   if(Math.abs(p.speed||0)<.1)this.turnCycle+=Math.abs(this.turn)*dt*.5;
  }
  this.time=time;this.heading=p.headingY||0;this.speed=p.speed||0;
 }
}
