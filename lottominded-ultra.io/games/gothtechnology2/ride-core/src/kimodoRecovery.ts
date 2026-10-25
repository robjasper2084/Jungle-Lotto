import {RECOVERY_SAMPLES} from './kimodoRecoveryData.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
export function recoverySample(progress:number){
 // Keep the hips down while rolling onto the supporting knee. The previous
 // sampling raised the pelvis while the torso was still lying on its side.
 const frame=clamp((progress-.16)/.68)*(RECOVERY_SAMPLES.length-1),index=Math.floor(frame),a=RECOVERY_SAMPLES[index],b=RECOVERY_SAMPLES[Math.min(index+1,RECOVERY_SAMPLES.length-1)],u=frame-index;
 return a.map((v,i)=>v+(b[i]-v)*u);
}
export function recoveryHand(progress:number,index:number,side:number){
 const row=recoverySample(progress),support=side>0?0:1,source=index===support?0:1,offset=1+source*3;
 // Mirror the same planted-hand recovery for a fall onto either hip.
 // Keep the unweighted balance hand below shoulder level. The raw take has
 // a high reach after the roll; a helmet/backpack makes that reach awkward.
 return {x:row[offset]*(side>0?1:-1),y:Math.min(-.12,row[offset+1]),z:Math.min(.6,row[offset+2]),weight:ease(progress/.16)*(1-ease((progress-.68)/.25)),plant:index===support?ease((progress-.10)/.12)*(1-ease((progress-.38)/.32)):0};
}
/** First plant the lead boot; transfer the other foot only after rising.
 * These are presentation weights, not changes to collision or remount eligibility. */
export function recoveryFoot(progress:number,index:number,side:number){
 const trailing=index===(side>0?0:1);
 const pedal=ease((progress-(trailing?.85:.71))/(trailing?.15:.20));
 // Establish the staggered ground stance BEFORE lifting the pelvis. A late
 // plant left the ankle beside the hip and folded the knee almost 180 degrees.
 return {plant:ease((progress-(trailing?.12:.06))/(trailing?.18:.14)),pedal,forward:trailing?-.12:.22,clearance:.085*4*pedal*(1-pedal)};
}
export function recoveryWheel(progress:number){
 // Establish the grasp before taking the wheel's weight, then keep holding it
 // upright while the first boot settles onto its pedal.
 return {grip:ease((progress-.32)/.15)*(1-ease((progress-.86)/.12)),lift:ease((progress-.49)/.31)};
}
