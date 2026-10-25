import type {CombatState} from '../../../../ride-core/src/royale/rules.ts';
import {templateWeapon,templateReloadTime} from '../../../../ride-core/src/templateActions.ts';
export {footEyeHeight} from '../../../../ride-core/src/royale/lean.ts';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
/** Reload cues follow authority timestamps, including the real ammunition commit. */
export function reloadPose(state:CombatState,tick:number){
 if(state.reloadStart<0||tick>=state.reloadEnd)return {active:false,lower:0,magazine:0,charge:0,phase:'ready',pitch:0,cant:0,yaw:0,travel:0,sourceTime:0,capture:templateWeapon('Pistol Idle',0)};
 const commit=Math.max(state.reloadStart+1,state.reloadCommit),end=Math.max(commit+1,state.reloadEnd);
 const before=clamp((tick-state.reloadStart)/(commit-state.reloadStart)),after=clamp((tick-commit)/(end-commit));
 const magazine=before<.3?smooth(before/.3):before<.64?1:1-smooth((before-.64)/.36);
 const lower=tick<commit?smooth(before/.18):1-smooth(after),charge=tick>=commit?Math.sin(Math.PI*after):0;
 // One shared timeline drives the receiver, support palm and magazine. The
 // server's ammunition commit is the insertion point, even for interrupted reloads.
 const sourceTime=templateReloadTime(state.reloadStart,commit,end,tick),capture=templateWeapon('Pistol Reload',sourceTime);
 return {active:true,lower,magazine,charge,phase:tick<commit?(before<.3?'release':before<.64?'replace':'insert'):'readying',pitch:-capture.rotation[0],cant:-capture.rotation[2],yaw:-capture.rotation[1],travel:capture.position[2],sourceTime,capture};
}
/** Lower the old weapon before replacing its geometry, then raise the new one.
 * Authoritative firing always wins over a cosmetic equip transition. */
export class WeaponSwap {
 private shown='';private requested='';private lowered=0;
 reset(){this.shown=this.requested='';this.lowered=0;}
 update(dt:number,weapon:string,firing:boolean,reduced:boolean){
  if(!this.shown||firing||reduced){this.shown=this.requested=weapon;this.lowered=0;return {weapon,lower:0};}
  this.requested=weapon;let remaining=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  // Retarget from the current pose. Repeated weapon taps must not snap the
  // hands back up or expose a replacement before the old weapon is lowered.
  if(this.shown!==this.requested){const untilLowered=(1-this.lowered)*.12;
   if(remaining<untilLowered){this.lowered+=remaining/.12;remaining=0;}
   else{remaining-=untilLowered;this.lowered=1;this.shown=this.requested;}
  }
  if(this.shown===this.requested)this.lowered=Math.max(0,this.lowered-remaining/.18);
  return {weapon:this.shown,lower:smooth(this.lowered)};
 }
}
export const WEAPON_FEEL={static:{kick:.8,settle:25,pitch:.055,travel:.042},heart:{kick:1.08,settle:20,pitch:.07,travel:.055},bass:{kick:1.32,settle:17,pitch:.085,travel:.065}} as const;
export type FpsMotionContext={blocked?:number;crouch?:number;prone?:number};
export class FpsMotion {
 private age=1;private weapon='';private kick=0;private kickVelocity=0;private land=0;private air=false;private airFor=0;private run=0;private aim=0;private blocked=0;
 reset(){this.age=1;this.weapon='';this.kick=this.kickVelocity=this.land=this.run=this.aim=this.blocked=this.airFor=0;this.air=false;}
 update(dt:number,weapon:string,shot:boolean,speed:number,air:boolean,ads:boolean,reduced:boolean,reload:ReturnType<typeof reloadPose>,onFoot=true,context:FpsMotionContext={}){
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  if(weapon!==this.weapon){this.weapon=weapon;this.age=0;this.kick=this.kickVelocity=0;}this.age+=dt;
  const feel=WEAPON_FEEL[weapon as keyof typeof WEAPON_FEEL]??WEAPON_FEEL.static;
  if(shot&&dt>0)this.kickVelocity=Math.min(feel.settle*5,this.kickVelocity+feel.kick*feel.settle*Math.E);
  // Exact critically damped spring: identical response at 30/60/120 Hz,
  // continuous recoil rather than replacing the entire pose on each shot.
  const velocity=this.kickVelocity+feel.settle*this.kick,decay=Math.exp(-feel.settle*dt);
  this.kick=(this.kick+velocity*dt)*decay;this.kickVelocity=(this.kickVelocity-feel.settle*velocity*dt)*decay;
  if(air)this.airFor+=dt;
  if(this.air&&!air){if(this.airFor>.075)this.land=1;this.airFor=0;}this.air=air;this.land*=Math.exp(-13*dt);
  const low=(context.prone??0)>.05||(context.crouch??0)>.1;
  this.run+=((onFoot&&speed>3.2&&!air&&!low&&!ads&&!reload.active&&!shot?1:0)-this.run)*(1-Math.exp(-12*dt));
  // Template-style short aim-in/aim-out, reversible from the current weight.
  const aimTarget=ads&&!reload.active?1:0;
  this.aim+=Math.max(-dt/.18,Math.min(dt/.20,aimTarget-this.aim));
  const obstruction=Number.isFinite(context.blocked)?clamp(context.blocked!):0;
  this.blocked+=(obstruction-this.blocked)*(1-Math.exp(-18*dt));
  if(reduced)this.kick=this.kickVelocity=this.land=0;
  const aim=smooth(this.aim),motion=reduced?0:1,kick=this.kick*motion;
  return {equip:(1-smooth(this.age/.24))*motion,kick,land:this.land*motion,run:this.run,aim,blocked:this.blocked,
   recoilTravel:kick*feel.travel,recoilPitch:kick*feel.pitch*(1-.55*aim),
   sprintPitch:this.run*.24*motion,sprintRoll:this.run*.26*motion,
   action:reload.active?'reload':shot||kick>.08?'fire':this.run>.35?'sprint':aim>.5?'ads':air?'airborne':Math.abs(speed)>.2?'move':'ready'};
 }
}
