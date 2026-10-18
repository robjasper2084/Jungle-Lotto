import {sampleHeroAction} from './heroActions.ts';
export const WHEEL_PICKUP_APPROACH=.3;
export const WHEEL_PICKUP_DURATION=2.5;
export const WHEEL_REMOUNT_DURATION=.65;
export const WHEEL_PICKUP_TOTAL=WHEEL_PICKUP_APPROACH+WHEEL_PICKUP_DURATION+WHEEL_REMOUNT_DURATION;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
export function wheelPickupTiming(time:number){
 const phase=clamp((time-WHEEL_PICKUP_APPROACH)/WHEEL_PICKUP_DURATION);
 const [grip,lift]=sampleHeroAction("pickup",phase);
 return {phase,approach:smooth(time/WHEEL_PICKUP_APPROACH),mount:smooth((time-WHEEL_PICKUP_APPROACH-WHEEL_PICKUP_DURATION)/WHEEL_REMOUNT_DURATION),
  weight:smooth(phase/.12)*(1-smooth((phase-.88)/.12)),
  grip,lift};
}
