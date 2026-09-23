import {gaitWeights} from './dogGait.ts';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Subtle heavy-dog weight transfer layered over the existing four articulated gaits. */
export function dogBalance(speed:number,phase:number,turnRate:number,time:number,landing=0,lookYaw=0){
 const [idle,walk,trot,run]=gaitWeights(speed),a=phase*Math.PI*2;
 const chestPitch=run*Math.sin(a-.4)*.035-landing*.045;
 return {
  chestPitch,
  chestYaw:(walk*.025+trot*.012)*Math.sin(a+.3)+clamp(turnRate*.035,-.085,.085),
  hipRoll:walk*Math.sin(a)*.016,
  headYaw:clamp(turnRate*.055+lookYaw*.45,-.16,.16),
  neckYaw:clamp(lookYaw*.35+turnRate*.02,-.12,.12),
  neckPitch:-chestPitch*.7+idle*Math.sin(time*1.8)*.006,
  tailYaw:(idle*.10+walk*.035+trot*.025+run*.014)*Math.sin(a-.7+idle*time*2.1)-clamp(turnRate*.025,-.055,.055),
 };
}
