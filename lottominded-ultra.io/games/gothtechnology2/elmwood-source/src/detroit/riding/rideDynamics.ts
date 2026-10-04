/** Original unit-based tuning shared by the live ride and movement studio. */
export const RIDE_TUNING=Object.freeze({version:'Digital Static Motion 4.1',maxSpeed:21.8,reverseSpeed:5.2,driveAcceleration:7.6,brakeAcceleration:9.2,launchJerk:22,brakeJerk:75,releaseJerk:32,gravity:9.81,lowSpeedYaw:2.55,highSpeedYaw:.62,maxLean:.94,hopSpeed:2.55,chargedHopSpeed:2.5,coyoteTime:.085,hopBuffer:.12,wheelRadius:.255,crashImpact:8.5});
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Bound change in motor acceleration (m/s³), retaining faster deliberate braking. */
export function advanceDrive(force:number,requested:number,braking:boolean,dt:number){
  const rate=braking?RIDE_TUNING.brakeJerk:Math.abs(requested)<Math.abs(force)?RIDE_TUNING.releaseJerk:RIDE_TUNING.launchJerk;
  return force+clamp(requested-force,-rate*dt,rate*dt);
}
export const damp=(v:number,target:number,rate:number,dt:number)=>target+(v-target)*Math.exp(-rate*dt);
export const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
export type Spring={value:number;velocity:number};
export const spring=():Spring=>({value:0,velocity:0});
/** Closed-form critically damped spring, retaining velocity through reversals. */
export function advanceSpring(s:Spring,target:number,frequency:number,dt:number){const error=s.value-target,b=s.velocity+frequency*error,e=Math.exp(-frequency*dt);s.value=target+(error+b*dt)*e;s.velocity=(s.velocity-frequency*b*dt)*e;return s.value;}
