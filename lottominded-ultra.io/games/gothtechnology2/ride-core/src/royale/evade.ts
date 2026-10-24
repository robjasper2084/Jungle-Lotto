export const EVADE_TICKS=96;
// Screen right is local -X for a rider facing +Z, matching on-foot strafing.
export function evadeDirection(throttle:number,steer:number){return throttle<-.2?2:steer<-.3?1:steer>.3?-1:3;}
export function evadePhase(until:number,tick:number){return Math.max(0,Math.min(1,1-(until-tick)/EVADE_TICKS));}
/** Controller owns travel and body sweeps; the capture never teleports the actor. */
export function evadeSpeed(phase:number){return phase<.14?2.5:phase<.65?3.8:phase<.88?1.6:0;}
