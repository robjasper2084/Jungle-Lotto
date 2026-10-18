export type AimSettings={preset:string;x:number;y:number;deadzone:number;assist:number;autoReload:boolean;simple:boolean;contrast:boolean;reticleSize:number;reticleColor:string;outline:boolean};
export const AIM_PRESETS={steady:{x:.65,y:.55,deadzone:.16},balanced:{x:1,y:.85,deadzone:.12},fast:{x:1.35,y:1.1,deadzone:.10}};
const bound=(v:unknown,fallback:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function readAimSettings(raw:unknown):AimSettings{
 const a=(raw&&typeof raw==='object'?raw:{}) as Partial<AimSettings>;
 return {preset:a.preset&&a.preset in AIM_PRESETS?a.preset:'balanced',x:bound(a.x,1,.25,2),y:bound(a.y,.85,.25,2),deadzone:bound(a.deadzone,.12,.02,.35),assist:bound(a.assist,.35,0,.6),autoReload:a.autoReload===true,simple:a.simple!==false,contrast:a.contrast!==false,reticleSize:bound(a.reticleSize,16,10,30),reticleColor:/^#[0-9a-f]{6}$/i.test(a.reticleColor??'')?a.reticleColor!:'#a3fff1',outline:a.outline!==false};
}
/** Friction only: it cannot move the crosshair or choose a shot for the player. */
export function aimFriction(angle:number,distance:number,strength:number,visible:boolean,device:string){
 if(!visible||device==='mouse'||!Number.isFinite(angle)||!Number.isFinite(distance)||distance<1||distance>60)return 1;
 const cone=.065;if(angle>=cone)return 1;
 return 1-Math.max(0,Math.min(.6,strength))*(1-Math.max(0,angle)/cone);
}
export const SIMPLE_ACTIONS=new Set(['aim','fire','reload','holster','crouch','hop','repair','recover']);
/** Local presentation only. Server remains the authority for ammunition and hits. */
export class ShotPreview {
 private held=false;private next=0;private round='';private spent=0;private counter=-1;private confirmed=-1;private pending:number[]=[];private magazine=0;private weapon='';
 reset(){this.held=false;this.next=0;this.spent=0;this.pending=[];this.counter=-1;this.confirmed=-1;this.magazine=0;this.weapon='';}
 sample(s:{round:string;tick:number;counter:number;fire:boolean;allowed:boolean;mode:number;magazine:number;interval:number;weapon?:string},now:number){
  if(this.round!==s.round){this.reset();this.round=s.round;}
  if(this.counter!==s.counter||s.magazine>this.magazine||this.weapon!==(s.weapon??'')){this.spent=0;this.counter=s.counter;}
  this.magazine=s.magazine;this.weapon=s.weapon??'';
  this.pending=this.pending.filter(t=>now-t<700);
  const edge=s.fire&&!this.held;this.held=s.fire;
  if(!s.allowed||!s.fire||s.magazine<=this.spent||now<this.next||(!edge&&s.mode!==2))return false;
  this.next=now+s.interval*1000/60;this.spent++;this.pending.push(now);return true;
 }
 confirm(counter:number,now:number){if(this.confirmed===counter)return false;const first=this.confirmed<0;this.confirmed=counter;if(first&&counter===0)return false;this.pending=this.pending.filter(t=>now-t<700);if(this.pending.length){this.pending.shift();return false;}return true;}
}
