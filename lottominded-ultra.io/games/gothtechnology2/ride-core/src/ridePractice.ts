/** Observes real movement only. It never drives, teleports or awards points. */
export type PracticePose={x:number;z:number;speed:number;headingY:number;airHeight:number;crashBlend:number;crashRecovery?:number};
export class RidePractice {
 stepIndex=0;private distance=0;private last?:PracticePose;private reachedSpeed=false;private turn=0;private airPeak=0;private wasGrounded=false;private airborne=false;private coastDistance=0;
 readonly bicycle:boolean;
 constructor(bicycle=false){this.bicycle=bicycle;}
 observe(p:PracticePose,grounded:boolean,landed:boolean,coasting=false){
  const previous=this.last,previousGrounded=this.wasGrounded;this.last={...p};this.wasGrounded=grounded;
  if(p.crashBlend>0||(p.crashRecovery??0)>0||!previous||Math.hypot(p.x-previous.x,p.z-previous.z)>1){this.airPeak=0;this.airborne=false;return;}
  const travel=Math.hypot(p.x-previous.x,p.z-previous.z);
  if(this.stepIndex===0){this.distance+=travel;if(this.distance>=8&&p.speed>2){this.reachedSpeed=true;this.stepIndex++;}}
  else if(this.stepIndex===1){this.reachedSpeed ||= p.speed>2;if(this.reachedSpeed&&Math.abs(p.speed)<.3)this.stepIndex++;}
  else if(this.stepIndex===2){if(p.speed>1&&p.speed<7)this.turn+=Math.abs(Math.atan2(Math.sin(p.headingY-previous.headingY),Math.cos(p.headingY-previous.headingY)));if(this.turn>.4)this.stepIndex++;}
  else if(this.stepIndex===3){
   if(this.bicycle){if(coasting&&p.speed>1)this.coastDistance+=travel;if(this.coastDistance>=2)this.stepIndex++;}
   else {if(previousGrounded&&!grounded){this.airborne=true;this.airPeak=0;}if(this.airborne&&!grounded)this.airPeak=Math.max(this.airPeak,p.airHeight);if(grounded){if(landed&&this.airborne&&this.airPeak>.1)this.stepIndex++;this.airPeak=0;this.airborne=false;}}
  }
 }
 action(kind:'camera'|'recover'){
  if(kind==='recover'){this.last=undefined;this.airPeak=0;this.airborne=false;}
  if(this.stepIndex===4&&kind==='camera'||this.stepIndex===5&&kind==='recover')this.stepIndex++;
 }
 get complete(){return this.stepIndex>=6;}
 get instruction(){return [this.bicycle?'Pedal forward for 8 metres.':'Ride forward for 8 metres.','Brake gently to a complete stop.','Roll slowly and make a controlled turn.',this.bicycle?'Release forward to coast for 2 metres.':'Hold, then release Hop. Land with the wheel straight.','Change the camera using the Camera control.','Use Recover to return to a safe upright position.','Practice complete. Keep exploring or choose a challenge.'][this.stepIndex];}
}
