import {RECOVERY_SAMPLES} from './kimodoRecoveryData.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function recoverySample(progress:number){
 const frame=clamp(progress/.86)*(RECOVERY_SAMPLES.length-1),index=Math.floor(frame),a=RECOVERY_SAMPLES[index],b=RECOVERY_SAMPLES[Math.min(index+1,RECOVERY_SAMPLES.length-1)],u=frame-index;
 return a.map((v,i)=>v+(b[i]-v)*u);
}
export function recoveryHand(progress:number,index:number,side:number){
 const row=recoverySample(progress),support=side>0?0:1,source=index===support?0:1,offset=1+source*3;
 // Mirror the same planted-hand recovery for a fall onto either hip.
 // Keep the unweighted balance hand below shoulder level. The raw take has
 // a high reach after the roll; a helmet/backpack makes that reach awkward.
 return {x:row[offset]*(side>0?1:-1),y:Math.min(-.12,row[offset+1]),z:Math.min(.6,row[offset+2]),weight:clamp(progress/.16)*(1-clamp((progress-.68)/.25))};
}
