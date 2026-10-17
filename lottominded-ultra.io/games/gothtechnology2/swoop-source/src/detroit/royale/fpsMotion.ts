import type {CombatState} from '../../../../ride-core/src/royale/rules.ts';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
/** Reload cues follow authority timestamps, including the real ammunition commit. */
export function reloadPose(state:CombatState,tick:number){
 if(state.reloadStart<0)return {active:false,lower:0,magazine:0,charge:0,phase:'ready'};
 const commit=Math.max(state.reloadStart+1,state.reloadCommit),end=Math.max(commit+1,state.reloadEnd);
 const before=clamp((tick-state.reloadStart)/(commit-state.reloadStart)),after=clamp((tick-commit)/(end-commit));
 const magazine=before<.3?smooth(before/.3):before<.64?1:1-smooth((before-.64)/.36);
 return {active:true,lower:tick<commit?smooth(before/.18):1-smooth(after),magazine,charge:tick>=commit?Math.sin(Math.PI*after):0,phase:tick<commit?(before<.3?'release':before<.64?'replace':'insert'):'readying'};
}
export function footEyeHeight(scale:number,crouch:number,prone:number){return ((1.64-.42*clamp(crouch))*(1-clamp(prone))+.46*clamp(prone))*scale;}
/** Lower the old weapon before replacing its geometry, then raise the new one.
 * Authoritative firing always wins over a cosmetic equip transition. */
export class WeaponSwap {
 private shown='';private requested='';private age=1;
 update(dt:number,weapon:string,firing:boolean,reduced:boolean){
  if(!this.shown||firing||reduced){this.shown=this.requested=weapon;this.age=1;return {weapon,lower:0};}
  if(weapon!==this.requested){this.requested=weapon;this.age=0;}
  this.age+=Math.max(0,Math.min(.1,dt));
  if(this.age>=.12)this.shown=this.requested;
  const lower=this.age<.12?smooth(this.age/.12):1-smooth((this.age-.12)/.18);
  return {weapon:this.shown,lower};
 }
}
export class FpsMotion {
 private age=1;private weapon='';private kick=0;private land=0;private air=false;private run=0;private aim=0;
 update(dt:number,weapon:string,shot:boolean,speed:number,air:boolean,ads:boolean,reduced:boolean,reload:ReturnType<typeof reloadPose>){
  dt=Math.max(0,Math.min(.1,dt));if(weapon!==this.weapon){this.weapon=weapon;this.age=0;}this.age+=dt;
  this.kick*=Math.exp(-20*dt);if(shot)this.kick=1;if(this.air&&!air)this.land=1;this.air=air;this.land*=Math.exp(-13*dt);
  this.run+=((speed>3.2&&!ads&&!reload.active?1:0)-this.run)*(1-Math.exp(-12*dt));this.aim+=((ads?1:0)-this.aim)*(1-Math.exp(-20*dt));
  const motion=reduced?0:1;
  return {equip:(1-smooth(this.age/.24))*motion,kick:this.kick*motion,land:this.land*motion,run:this.run,aim:this.aim};
 }
}
