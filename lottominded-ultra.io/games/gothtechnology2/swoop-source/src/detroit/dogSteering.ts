const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const dogStepSpeed=(speed:number,rate:number)=>Math.max(speed,Math.abs(rate)>.01?.55+Math.abs(rate)*.25:0);
export const wrapDogAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** Turn with angular inertia and a finite running radius. Units: metres, seconds, radians. */
export function dogSteering(heading:number,speed:number,yawRate:number,desiredHeading:number,wantedSpeed:number,dt:number){
 const error=wrapDogAngle(desiredHeading-heading);
 // A heavy dog slows for a tight corner. At a standstill it takes short pivot steps.
 const maxYaw=Math.min(2.6,7.5/Math.max(1,speed));
 const wantedYaw=clamp(error*5,-maxYaw,maxYaw);
 const rate=yawRate+clamp(wantedYaw-yawRate,-7*dt,7*dt);
 const nextHeading=heading+rate*dt;
 const aligned=Math.max(0,Math.cos(error));
 const cornerSpeed=Math.abs(error)>.25?Math.min(wantedSpeed,Math.sqrt(7.5/Math.max(.1,Math.abs(error)))):wantedSpeed;
 const targetSpeed=cornerSpeed*aligned;
 const pace=Math.max(0,speed+clamp((targetSpeed-speed)*(1-Math.exp(-8*dt)),-9.5*dt,9.8*dt));
 const gaitSpeed=dogStepSpeed(pace,rate);
 return {heading:nextHeading,speed:pace,turnRate:rate,gaitSpeed,lookYaw:clamp(error*.4,-.32,.32)};
}
