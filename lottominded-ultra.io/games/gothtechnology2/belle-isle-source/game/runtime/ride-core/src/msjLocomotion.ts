/** Browser adaptation of MSJ-TDCC ThirdPersonController.UpdateSmoothMovementValues.
 * See docs/combat/MSJ_ON_FOOT_20261021.md for the source package and adaptations.
 * Two stages (input .1 s, velocity .2 s) operate on planar velocity so reverse
 * and diagonal changes also blend. The authority owns this serializable state;
 * render callbacks must never advance it. No Unity demo managers are imported.
 */
export const MSJ_LOCOMOTION={inputSeconds:.1,velocitySeconds:.2} as const;
export const msjLocomotionState=()=>({msjInputX:0,msjInputZ:0,msjVelocityX:0,msjVelocityZ:0});
export type MsjLocomotionState=ReturnType<typeof msjLocomotionState>;
export function resetMsjLocomotion(s:MsjLocomotionState){
 s.msjInputX=s.msjInputZ=s.msjVelocityX=s.msjVelocityZ=0;
}
const finite=(v:number)=>Number.isFinite(v)?v:0;
const axes=[['msjInputX','msjVelocityX'],['msjInputZ','msjVelocityZ']] as const;
/** Exact integration of the two first-order stages avoids frame-rate-dependent
 * Lerp coefficients. Small analog inputs stay proportional instead of snapping
 * to MSJ's keyboard-only half/full-speed bands. */
export function stepMsjLocomotion(s:MsjLocomotionState,dt:number,x:number,z:number,limit:number){
 if(!Number.isFinite(dt)||dt<=0)return;
 x=finite(x);z=finite(z);limit=Math.max(0,finite(limit));
 const magnitude=Math.hypot(x,z),scale=magnitude>limit?limit/magnitude:1;x*=scale;z*=scale;
 for(let i=0;i<2;i++){
  const [inputKey,velocityKey]=axes[i],target=i===0?x:z;
  // MSJ gates displacement with raw input. A short braking blend avoids both
  // that abrupt stop and a long slippery tail when releasing a strafe axis.
  const inputTime=target===0?.04:MSJ_LOCOMOTION.inputSeconds,velocityTime=target===0?.08:MSJ_LOCOMOTION.velocitySeconds;
  const a=Math.exp(-dt/inputTime),b=Math.exp(-dt/velocityTime),cross=inputTime/(inputTime-velocityTime)*(a-b);
  const input=finite(s[inputKey]);
  s[velocityKey]=target+(finite(s[velocityKey])-target)*b+(input-target)*cross;
  s[inputKey]=target+(input-target)*a;
  if(target===0&&Math.abs(s[inputKey])<.001&&Math.abs(s[velocityKey])<.002)s[inputKey]=s[velocityKey]=0;
 }
 // Stance/stagger limits apply immediately, including after sprinting.
 const speed=Math.hypot(s.msjVelocityX,s.msjVelocityZ);
 if(speed>limit){s.msjVelocityX*=limit/speed;s.msjVelocityZ*=limit/speed;}
 if(magnitude===0&&Math.hypot(s.msjInputX,s.msjInputZ)<.001&&Math.hypot(s.msjVelocityX,s.msjVelocityZ)<.002)resetMsjLocomotion(s);
}
