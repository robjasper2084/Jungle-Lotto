import type {RidePose} from '../controller.ts';
import {FallMotion} from '../fallMotion.ts';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Visual-only additive motion. Never feeds positions, aim or collisions back to authority. */
export class RiderPresentation {
 private lastTick=-1;private speed=0;private heading=0;private acceleration=0;private turn=0;
 private kick=0;private flinch=0;private hitSide=1;private hitForward=1;private fall?:FallMotion;private fallTick=0;private serial=-1;
 private celebration=0;
 hit(side:number,forward=1){this.flinch=1;this.hitSide=clamp(side,-1,1);this.hitForward=clamp(forward,-1,1);if(this.fall&&this.lastTick-this.fallTick<3)this.fall=undefined;}
 sample(source:RidePose,tick:number,alive:boolean,serial:number,shot:boolean,reduced:boolean,victory=false,renderDelta=1/60,balanceSource:Pick<RidePose,'speed'|'headingY'>=source){
  const p={...source};
  if(this.serial!==serial||tick<this.lastTick){this.lastTick=-1;this.fall=undefined;this.kick=this.flinch=this.celebration=0;this.acceleration=this.turn=0;this.serial=serial;}
  // Derivatives and their baselines share simulation time. Render interpolation
  // must not overwrite the next tick's baseline. Spectator ticks may be fractional.
  const dt=this.lastTick<0?0:clamp((tick-this.lastTick)/60,0,.1);
  if(dt>0){const blend=1-Math.exp(-10*dt);this.acceleration+=(clamp((balanceSource.speed-this.speed)/dt,-12,12)-this.acceleration)*blend;
   const angle=Math.atan2(Math.sin(balanceSource.headingY-this.heading),Math.cos(balanceSource.headingY-this.heading));this.turn+=(clamp(angle/dt,-3,3)-this.turn)*blend;}
  // Recoil and hit reactions still decay smoothly at display rate and freeze at pause.
  const displayDt=clamp(renderDelta,0,.1);
  this.kick*=Math.exp(-18*displayDt);this.flinch*=Math.exp(-9*displayDt);
  if(shot)this.kick=1;
  if(this.lastTick!==tick){this.lastTick=tick;this.speed=balanceSource.speed;this.heading=balanceSource.headingY;}
  if(!alive){if(!this.fall){this.fall=new FallMotion({...p,rollAngle:this.hitSide*.3},Math.abs(this.hitSide)>.65?'side impact':'collision',.255,{vx:-(Math.sin(p.headingY)*this.hitForward+Math.cos(p.headingY)*this.hitSide)*2,vz:-(Math.cos(p.headingY)*this.hitForward-Math.sin(p.headingY)*this.hitSide)*2,speed:2});this.fallTick=tick;}
   this.fall.sample(reduced?this.fall.settleTime:Math.max(0,(tick-this.fallTick)/60),p);return p;}
  this.fall=undefined;
  // Existing controller owns actual crashes and supported get-up/re-mount poses.
  if(p.crashBlend>.01||p.crashRecovery>0)return p;
  const gain=reduced?.2:1,mounted=!p.footMode;
  const drive=mounted?clamp(this.acceleration*.012,-.13,.11)*gain:0;
  const bank=mounted?clamp(this.turn*Math.abs(p.speed)*.0025,-.075,.075)*gain:0;
  const brake=mounted?clamp(-this.acceleration/10,0,1)*gain:0;
  // Flex the hips over the existing planted-pedal IK; tyre support is unchanged.
  const carve=mounted?clamp(Math.abs(p.rollAngle)/.65,0,1)*clamp(Math.abs(p.speed)/4,0,1):0;
  p.bodyDrop+=carve*.045*gain;p.bodyShift-=carve*.018*gain;
  p.riderRoll-=p.rollAngle*.12*carve*gain;
  p.bodyChestRoll+=p.rollAngle*.14*carve*gain;p.bodyHeadRoll+=p.rollAngle*.10*carve*gain;
  p.bodyPitch+=drive-this.kick*.075*gain+this.flinch*this.hitForward*.20*gain;p.riderPitch+=drive;
  p.bodyDrop+=brake*.045+clamp(p.landingCompression,0,1)*.025*gain;
  p.bodyShift+=drive*.25;p.bodyChestRoll+=bank+this.flinch*this.hitSide*.12*gain;
  p.bodyTwist+=this.flinch*this.hitSide*.08*gain;
  p.shoulderR+=this.kick*.10*gain;p.shoulderL+=this.kick*.06*gain;
  p.riderRoll+=bank;p.bodyLook+=clamp(this.turn*.06,-.12,.12)*gain;
  // A relaxed raised-hand salute; the standard leg solver keeps boots planted.
  if(victory){this.celebration=Math.min(1,this.celebration+clamp(renderDelta,0,.1)*2);const t=reduced?1:this.celebration;
   p.naturalMotion=1;p.bodyPitch*=1-t*.65;p.bodyDrop*=1-t*.3;p.handRY+=.8*t;p.handRZ+=.12*t;p.shoulderR+=.25*t;}
  return p;
 }
}
