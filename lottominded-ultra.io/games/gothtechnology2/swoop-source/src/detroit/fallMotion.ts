import {fallPosture} from './fallPosture.ts';
import type {RidePose} from './controller.ts';
import {clamp} from './rideDynamics.ts';
import type {ActorImpact} from './terrain.ts';
const ease=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const ramp=(t:number,a:number,b:number)=>ease((t-a)/(b-a));

/** Frame the space between the separated rider and wheel, with a lower landing target. */
export function fallCameraOffset(p:RidePose){
  const lateral=(p.crashLateral+p.wheelCrashLateral)*.5,forward=(p.crashForward+p.wheelCrashForward)*.5;
  return {x:lateral*Math.cos(p.headingY)+forward*Math.sin(p.headingY),y:-.45*p.crashBlend,z:-lateral*Math.sin(p.headingY)+forward*Math.cos(p.headingY)};
}

/** Authored crash phases, sampled at simulation time; existing collision stays authoritative. */
export class FallMotion {
  readonly initial:RidePose;readonly side:number;readonly direction:number;readonly severity:number;
  readonly forwardFall:boolean;readonly contactTime:number;age=0;
  readonly tireRadius:number;readonly forwardSpeed:number;readonly lateralSpeed:number;readonly slideSpeed:number;readonly settleTime:number;
  constructor(p:RidePose,reason:string,tireRadius=.255,impact?:ActorImpact){
    this.tireRadius=tireRadius;
    this.initial={...p};
    const s=Math.sin(p.headingY),c=Math.cos(p.headingY);
    const vx=impact?.vx??s*p.speed,vz=impact?.vz??c*p.speed;
    this.forwardSpeed=vx*s+vz*c;this.lateralSpeed=vx*c-vz*s;
    this.direction=this.forwardSpeed<-.1?-1:1;
    this.side=Math.abs(this.lateralSpeed)>.2?Math.sign(this.lateralSpeed):Math.sign(p.rollAngle)||Math.sign(p.slipAngle)||1;
    this.severity=clamp((impact?.speed??Math.abs(p.speed))/20,0,1);
    // Momentum is no longer capped at jogging speed above 43 km/h.
    this.slideSpeed=Math.min(12,Math.max(.8,Math.hypot(vx,vz)*.60));
    this.forwardFall=reason==='collision'||(reason==='hard landing'&&Math.abs(p.rollAngle)<.25);
    this.contactTime=.5+Math.min(.35,Math.sqrt(Math.max(0,p.airHeight)/9.81)*.5);
    this.settleTime=Math.max(1.8,this.contactTime+this.slideSpeed/7+.25);
  }
  sample(age:number,p:RidePose){
    this.age=age;const t=Math.max(0,age),i=this.initial,contact=this.contactTime;
    const posture=fallPosture(t,contact);
    p.crashReach=posture.reach;p.crashAbsorb=posture.absorb;p.crashCurl=posture.curl;p.crashHeadTuck=posture.headTuck;p.crashStagger=posture.stagger;p.crashSide=this.side;p.crashDirection=this.direction;
    const release=ramp(t,.10,.38),tip=ramp(t,.10,contact+.08),impact=ramp(t,contact-.07,contact+.06),settle=ramp(t,contact+.12,this.settleTime);
    const brace=ramp(t,0,.13)*(1-.65*ramp(t,contact,contact+.45));
    const pulse=t<contact?0:Math.sin(Math.min(1,(t-contact)/.19)*Math.PI)*Math.exp(-(t-contact)*9);
    // Carry momentum through separation, then dissipate it under ground friction.
    // The old exponential drift slowed the rider in mid-air and never quite stopped.
    const speed=this.slideSpeed,flight=Math.min(t,contact);
    const airborneDrift=speed*(flight-.06*(1-Math.exp(-flight/.06)));
    const slideTime=Math.min(Math.max(0,t-contact),speed/7);
    const drift=airborneDrift+speed*slideTime-3.5*slideTime*slideTime;
    const dropTime=Math.max(0,Math.min(t,contact)-.07);
    const drop=clamp(dropTime*dropTime/((contact-.07)*(contact-.07)),0,1);
    p.crashContact=impact;p.crashMotion=1;p.crashBlend=ramp(t,0,.7);p.crashBrace=brace;p.crashRelease=release;p.crashSettle=settle;
    p.crashLegTuck=release*(.5+.40*posture.curl+.10*impact);p.crashImpactPulse=pulse;
    const momentum=Math.hypot(this.forwardSpeed,this.lateralSpeed),forward=momentum>.1?this.forwardSpeed/momentum:this.direction,lateral=momentum>.1?this.lateralSpeed/momentum:0;
    p.crashLateral=this.side*(this.forwardFall?.32:.82)*tip+this.side*.13*settle+lateral*drift;
    p.crashForward=forward*drift*(this.forwardFall?1:.75);
    p.crashDrop=(this.forwardFall?.9:.83)*drop+.2*settle-.018*pulse;
    const pitch=this.forwardFall?.85+.55*this.severity:.28;
    p.crashTumble=this.direction*(pitch*tip-pitch*settle)-this.direction*.08*pulse;
    // Rider roll uses the opposite Euler sign to the controller's bank angle.
    // Roll toward the displaced hip, rather than corkscrewing back toward the wheel.
    p.crashRoll=-this.side*((this.forwardFall?.45:1.42)*tip+(this.forwardFall?1.05:.08)*settle)-this.side*.035*pulse;
    p.wheelCrashLean=-this.side*1.48*ramp(t,.06,.65);
    p.wheelCrashSpin=this.side*(.25+.3*this.severity)*ramp(t,.12,.9);
    p.wheelCrashForward=forward*drift*.28;
    p.wheelCrashLateral=-this.side*(.18+.14*this.severity)*ramp(t,.12,.8)+lateral*drift*.28;
    p.wheelCrashPop=.035*pulse;
    p.wheelSpin=i.wheelSpin+i.speed/this.tireRadius*(1-Math.exp(-t*4))/4;
    // Keep the entry pose and relax into a compact fall instead of snapping back to bind pose.
    const blend=ramp(t,0,.4),lerp=(a:number,b:number)=>a+(b-a)*blend;
    p.bodyPitch=lerp(i.bodyPitch,.10+.36*posture.curl+.08*posture.absorb);p.bodyDrop=lerp(i.bodyDrop,.09);
    p.bodyShift=lerp(i.bodyShift,0);p.bodyLateral=lerp(i.bodyLateral,0);p.bodyHipTilt=lerp(i.bodyHipTilt,0);
    p.bodyTwist=lerp(i.bodyTwist,this.side*(.10*brace+.16*posture.absorb-.08*settle));p.bodyLook=lerp(i.bodyLook,-this.side*(.10*brace+.07*posture.curl));
    p.bodyHipYaw=lerp(i.bodyHipYaw,0);p.bodyChestRoll=lerp(i.bodyChestRoll,-this.side*.06*brace);p.bodyHeadRoll=lerp(i.bodyHeadRoll,0);
    p.armBank=lerp(i.armBank,0);p.armSwing=lerp(i.armSwing,0);
    p.crouch=lerp(i.crouch,.22);p.tuck=0;p.trickFoot=i.trickFoot*(1-release);
    p.rollAngle=i.rollAngle*(1-tip);p.riderRoll=i.riderRoll*(1-tip);p.wheelPitch=i.wheelPitch*(1-tip);
    p.groundRoll=i.groundRoll*(1-tip);p.landingCompression=0;p.takeoffExtension=0;
    p.bodyBob=0;p.airBlend=i.airBlend*(1-tip);p.velocityX=p.velocityZ=0;
  }
  get phase(){return this.age<.13?'brace':this.age<this.contactTime?'separate':this.age<this.contactTime+.22?'impact':this.age<this.settleTime?'slide':'settled';}
}

/** Side roll -> supported kneel -> rise -> remount. Offsets remain at the resting
 * location for pedestrians; mounted recovery closes the last short step to the pedals. */
export function getUpPose(rest:RidePose,progress:number,out:RidePose,mounted=false){
  Object.assign(out,rest);const t=clamp(progress,0,1),kneel=ramp(t,0,.40),stand=ramp(t,.38,.86),mount=ramp(t,.78,1);
  const side=rest.crashSide||1;
  out.crashRecovery=t;out.crashRoll=rest.crashRoll*(1-kneel);out.crashTumble=.42*kneel*(1-stand);
  out.crashDrop=rest.crashDrop*(1-kneel)+.46*kneel*(1-stand);
  out.crashLegTuck=(1-stand)*.82;out.crashRelease=mounted?1-mount:1;
  out.crashReach=.45*kneel*(1-stand);out.crashAbsorb=0;out.crashCurl=.40*(1-stand);out.crashHeadTuck=.45*(1-stand);
  out.crashSettle=1-stand;out.crashBrace=1-stand;out.crashContact=1-stand;out.crashBlend=1-mount;
  out.bodyPitch=.1+.25*(1-stand);out.bodyDrop=.08+.09*(1-stand);out.bodyTwist=side*.12*(1-stand);
  out.crashImpactPulse=0;out.wheelCrashPop=0;
  if(mounted){out.crashForward=rest.crashForward*(1-mount);out.crashLateral=rest.crashLateral*(1-mount);out.wheelCrashForward=rest.wheelCrashForward*(1-stand);out.wheelCrashLateral=rest.wheelCrashLateral*(1-stand);out.wheelCrashLean=rest.wheelCrashLean*(1-stand);out.wheelCrashSpin=rest.wheelCrashSpin*(1-stand);}
}
