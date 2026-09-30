import type {RidePose} from './controller.ts';
/** Optional, resettable lesson. Observes the real controller; never steers it. */
export class PracticeCoach {
 stepIndex=0;private distance=0;private last?:RidePose;private reachedSpeed=false;private turn=0;private airPeak=0;private wasGrounded=false;private airborne=false;
 observe(p:RidePose,grounded:boolean,landed:boolean){
  const previous=this.last,previousGrounded=this.wasGrounded;this.last={...p};this.wasGrounded=grounded;
  if(p.crashBlend>0||p.crashRecovery>0||!previous||Math.hypot(p.x-previous.x,p.z-previous.z)>1){this.airPeak=0;this.airborne=false;return;}
  const travel=Math.hypot(p.x-previous.x,p.z-previous.z);
  if(this.stepIndex===0){this.distance+=travel;if(this.distance>=8&&p.speed>2){this.reachedSpeed=true;this.stepIndex++;}}
  else if(this.stepIndex===1){this.reachedSpeed ||= p.speed>2;if(this.reachedSpeed&&Math.abs(p.speed)<.3)this.stepIndex++;}
  else if(this.stepIndex===2){if(p.speed>1&&p.speed<7)this.turn+=Math.abs(Math.atan2(Math.sin(p.headingY-previous.headingY),Math.cos(p.headingY-previous.headingY)));if(this.turn>.4)this.stepIndex++;}
  else if(this.stepIndex===3){if(previousGrounded&&!grounded){this.airborne=true;this.airPeak=0;}if(this.airborne&&!grounded)this.airPeak=Math.max(this.airPeak,p.airHeight);if(grounded){if(landed&&this.airborne&&this.airPeak>.1)this.stepIndex++;this.airPeak=0;this.airborne=false;}}
 }
 get complete(){return this.stepIndex>=4;}
 get instruction(){return ['Ride forward for 8 metres.','Brake gently to a complete stop.','Roll slowly and make a controlled turn.','Hold, then release Hop. Land with the wheel straight.','You’re ready. Try End-to-End Dash or keep riding.'][this.stepIndex];}
}
