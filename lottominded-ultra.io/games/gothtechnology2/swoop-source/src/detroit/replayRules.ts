import {RIDE_RULES} from './rideRules.ts';
import {createPose,type RidePose} from './controller.ts';
import {CHALLENGES,type Challenge,type Records} from './district.ts';

export const REPLAY_VERSION=4;
// Quantized 10 Hz recordings are small enough for browser storage; rendering interpolates.
export const POSE_KEYS=['seated','naturalMotion','bodyDrop','bodyShift','bodyPitch','bodyLateral','bodyHipTilt','bodyChestRoll','bodyHeadRoll','bodyTwist','bodyLook','bodyHipYaw','armBank','armSwing','shoulderL','shoulderR','handLX','handLY','handLZ','handRX','handRY','handRZ','wristL','wristR','x','y','z','headingY','speed','wheelSpin','groundPitch','groundRoll','rollAngle','riderRoll','riderPitch','wheelPitch','suspensionOffset','crouch','tuck','attack','carveStance','technicalTurn','riderTurnTwist','riderLookYaw','reverseBlend','restFactor','airBlend','airHeight','stopFoot','trickFoot','bodyBob','yawRate','turnIntent','brakeAmount','landingCompression','takeoffExtension','landingAnticipation','slipAngle','weightShift','lateralAcceleration','tractionUsage','crashBlend','crashLateral','crashDrop','crashForward','crashTumble','crashRoll','wheelCrashForward','wheelCrashLateral','wheelCrashPop','wheelCrashSpin','wheelCrashLean','crashMotion','crashBrace','crashRelease','crashSettle','crashLegTuck','crashImpactPulse'] as const;
export interface Recording {version:number;rider:string;challenge:string;elapsed:number;frames:number[][];splits:number[];highlight:number}
export class Recorder {
 frames:number[][]=[];splits:number[]=[];highlight=0;private next=0;
 push(t:number,p:RidePose,force=false){if(this.frames.length>=9001)return;if(!force&&t+1e-6<this.next)return;this.next=t+.1;const row=[+t.toFixed(3),...POSE_KEYS.map(k=>+p[k].toFixed(4))];if(this.frames.at(-1)?.[0]===row[0])this.frames[this.frames.length-1]=row;else this.frames.push(row);}
 finish(rider:string,challenge:string,elapsed:number):Recording{return{version:REPLAY_VERSION,rider,challenge,elapsed,frames:this.frames,splits:this.splits,highlight:this.highlight};}
}
export function readRecording(raw:string|null,rider:string,challenge:string):Recording|undefined{try{const r=JSON.parse(raw??'null');if(!r||r.version!==REPLAY_VERSION||r.rider!==rider||r.challenge!==challenge||!Number.isFinite(r.elapsed)||r.elapsed<=0||r.elapsed>900||!Array.isArray(r.frames)||r.frames.length<2||r.frames.length>9001||!Array.isArray(r.splits)||r.splits.length>CHALLENGES[0].gates.length||r.splits.some((n:number)=>!Number.isFinite(n)||n<0||n>r.elapsed))return;let last=-1;for(const row of r.frames){if(!Array.isArray(row)||row.length!==POSE_KEYS.length+1||row.some((n:number)=>!Number.isFinite(n)||Math.abs(n)>1e7)||row[0]<=last||row[0]>r.elapsed+.11)return;last=row[0];}if(!Number.isFinite(r.highlight))r.highlight=r.elapsed;return r;}catch{return;}}
export function replayPose(r:Recording,t:number,out:RidePose=createPose()){
 const f=r.frames;let lo=0,hi=f.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(f[mid][0]<=t)lo=mid;else hi=mid;}
 const a=f[lo],b=f[hi],u=Math.max(0,Math.min(1,(t-a[0])/Math.max(.001,b[0]-a[0])));
 POSE_KEYS.forEach((key,i)=>{let d=b[i+1]-a[i+1];if(key==='headingY')d=Math.atan2(Math.sin(d),Math.cos(d));out[key]=a[i+1]+d*u;});return out;
}
export class FlowCombo {
 pending=0;banked=0;best=0;multiplier=1;last='';events=0;lost=false;
 private age=0;private seen:string[]=[];private cooldown=new Map<string,number>();private time=0;private carveTime=0;private carveSign=0;private lastCarve=0;private scrapeTime=0;private air=false;private peak=0;private settle=-1;private specialFlight=false;
 award(move:string,points:number){if(this.time-(this.cooldown.get(move)??-100)<2)return false;this.cooldown.set(move,this.time);const repeat=this.seen.includes(move);if(!repeat)this.seen.push(move);this.multiplier=Math.min(4,1+(this.seen.length-1)*.5);this.pending+=Math.round(points*this.multiplier*(repeat?.25:1));this.last=move;this.age=0;this.events++;this.lost=false;return true;}
 step(dt:number,p:RidePose,grounded:boolean,landing?:string,trick?:string,specialActive=false,trickPoints=150){
  if(dt<=0)return;this.time+=dt;this.age+=dt;
  if(p.crashBlend>0||Math.abs(p.slipAngle)>.65){this.lost=this.pending>0;this.pending=0;this.seen=[];this.multiplier=1;this.carveTime=0;this.scrapeTime=0;this.air=false;this.peak=0;this.settle=-1;this.specialFlight=false;return;}
  const controlled=grounded&&p.speed>2&&Math.abs(p.slipAngle)<.22&&p.tractionUsage<.85;
  const sign=Math.sign(p.rollAngle);
  if(controlled&&Math.abs(p.rollAngle)>.07&&Math.abs(p.rollAngle)<.5&&sign!==this.lastCarve){if(sign!==this.carveSign){this.carveSign=sign;this.carveTime=0;}this.carveTime+=dt;if(this.carveTime>=.65){this.award(sign>0?'Right carve':'Left carve',60);this.lastCarve=sign;this.carveTime=0;}}else this.carveTime=0;
  if(controlled&&p.scrape>.08){this.scrapeTime+=dt;if(this.scrapeTime>.3){this.award('Pedal kiss',90);this.scrapeTime=-2;}}else this.scrapeTime=0;
  if(!grounded){this.specialFlight ||= specialActive;this.air=true;this.peak=Math.max(this.peak,p.airHeight);this.settle=-1;}
  if(landing){this.settle=!this.specialFlight&&this.air&&this.peak>.1&&['clean','charged'].includes(landing)?0:-1;this.air=false;this.peak=0;this.specialFlight=false;}
  if(this.settle>=0){if(!controlled||Math.abs(p.rollAngle)>.4)this.settle=-1;else {this.settle+=dt;if(this.settle>=RIDE_RULES.settleSeconds){this.award('Clean hop',120);this.settle=-1;}}}
  if(trick&&grounded&&Math.abs(p.rollAngle)<.4)this.award(trick.replace(/ · clean \+\d+$/, ''),trickPoints);
  if(this.pending&&this.age>=RIDE_RULES.comboBankSeconds)this.bank();
 }
 cancel(){this.lost=this.pending>0;this.pending=0;this.seen=[];this.multiplier=1;this.carveTime=this.scrapeTime=0;this.air=false;this.peak=0;this.settle=-1;this.specialFlight=false;this.age=0;}
 get settleProgress(){return this.settle<0?0:Math.min(1,this.settle/RIDE_RULES.settleSeconds);}
 get bankProgress(){return this.pending?Math.min(1,this.age/RIDE_RULES.comboBankSeconds):0;}
 bank(){const value=this.pending;this.banked+=value;this.best=Math.max(this.best,value);this.pending=0;this.seen=[];this.multiplier=1;return value;}
}
export function medalStars(records:Records){return CHALLENGES.reduce((n,c)=>n+(records[c.id]?.medal??0),0);}
export const REWARDS=[{id:'stock',label:'Original finish',stars:0,color:0x88bbb8},{id:'teal',label:'Cut teal · hoodie tint + lights + cuffs',stars:1,color:0x28dac6},{id:'amber',label:'Motor City amber · hoodie tint + lights + dog collar',stars:3,color:0xffbb48},{id:'violet',label:'Night rider violet · hoodie tint + lights + cuffs + collar',stars:6,color:0xba7cff},{id:'gold',label:'District gold · kit + human headband',stars:10,color:0xffdd70}];
export function dailyChallenge(date=new Date()):Challenge{const day=date.toISOString().slice(0,10),seed=[...day].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0),base=CHALLENGES[seed%2];return{...base,id:'daily-'+day,title:'Daily line · '+day,start:base.start,end:base.end,gates:[...base.gates],gateOffsets:base.gates.map((_,i)=>((i+seed)%2?-.7:.7)),gateWidth:1.7,description:'Today’s fixed slalom. Same gates for everyone; local personal bests. No streaks or missed-day penalties.'};}
export const PRACTICE_LINES:Challenge[]=[
 {...CHALLENGES[0],id:'practice-wide',title:'Practice · wide line',gateWidth:3.8,description:'Wide gates and a forgiving line. Learn the route, then retry instantly.'},
 {...CHALLENGES[0],id:'practice-tight',title:'Practice · technical line',gateWidth:1.2,gateOffsets:CHALLENGES[0].gates.map((_,i)=>i%2?.8:-.8),description:'Alternate narrow gates. Brake early and link smooth changes of direction.'},
 {...CHALLENGES[3],id:'practice-hops',title:'Practice · hop line',description:'Three clean moving hops on supported pavement. Gold landing markers suggest your takeoff zones.'},
];
