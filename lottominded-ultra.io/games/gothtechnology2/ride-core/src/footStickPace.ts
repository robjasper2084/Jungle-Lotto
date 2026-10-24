import {FOOT_SPEED} from './onFoot.ts';
/** Keep keyboard walk/Shift and the run lock, while analog forward input blends
 * from careful steps through the approved walk into a full sprint. */
export function footStickPace(throttle:number,steer:number,options:{enabled:boolean;run:boolean;blocked:boolean;strafing:boolean}){
 const result={throttle,steer,run:options.run};
 if(!options.enabled||options.run||options.blocked||throttle<=0)return result;
 const magnitude=options.strafing?Math.hypot(throttle,steer):throttle;
 // Sideways/backward movement stays a walk; diagonal input cannot boost speed.
 if(!magnitude||options.strafing&&throttle/magnitude<.7)return result;
 const amount=Math.min(1,magnitude),walkEnd=.65,t=Math.max(0,(amount-walkEnd)/(1-walkEnd));
 const speed=amount<=walkEnd?FOOT_SPEED.walk*amount/walkEnd:FOOT_SPEED.walk+(FOOT_SPEED.run-FOOT_SPEED.walk)*t*t*(3-2*t);
 const run=amount>walkEnd,factor=speed/(run?FOOT_SPEED.run:FOOT_SPEED.walk)/magnitude;
 return {throttle:throttle*factor,steer:options.strafing?steer*factor:steer,run};
}
