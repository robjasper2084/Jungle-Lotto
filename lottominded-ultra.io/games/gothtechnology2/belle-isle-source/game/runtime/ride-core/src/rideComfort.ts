/** Small stick movements are precise; full lock remains available for tight turns. */
export function gentleSteering(value:number,eyeControl=false){
  if(!Number.isFinite(value))return 0;
  const x=Math.min(1,Math.max(0,(Math.abs(value)-.045)/.955));
  // Eye mode responds earlier to a partial stick without increasing full-lock yaw.
  return Math.sign(value)*(eyeControl?.72*x+.28*x*x*x:.48*x+.52*x*x*x);
}
/** A relaxed rider looks ahead, just below the horizon. */
export const RIDER_EYE_PITCH=-.04;
/** Head stabilization counters most body motion while retaining acceleration and bank cues. */
export function riderEyeMotion(p:{riderPitch:number;rollAngle:number;speed:number;driveIntent:number;brakeAmount:number;landingCompression:number;takeoffExtension:number},reduced=false){
  const clamp=(x:number,n:number)=>Math.max(-n,Math.min(n,x)),amount=reduced?.18:1;
  return {pitch:clamp(-p.riderPitch*.28-Math.max(0,p.speed)*.0015+p.brakeAmount*.035-p.landingCompression*.035+p.takeoffExtension*.018,.14)*amount,
    // Camera-local +Z points backward. Its roll must share the bank's sign
    // to lean toward the same side as the rider in the world.
    roll:clamp(p.rollAngle*.32,.16)*amount};
}
