import {ROUTE_START,FULL_ROUTE_GATES} from './fullRoute.ts';
import {CUT_METRES} from './geography.ts';
import {RIDE_RULES} from './rideRules.ts';
// District rules are independent of rendering and advance only on simulation ticks.
export type ChallengeKind='trial'|'style'|'discovery';
export interface Challenge {id:string;title:string;kind:ChallengeKind;start:number;end:number;description:string;gates:number[];gold:number;silver:number;gateOffsets?:number[];gateWidth?:number;finishAtEnd?:boolean;features?:boolean}
export const MACK_FINISH=CUT_METRES;
export const mackGates=(_start:number)=>[...FULL_ROUTE_GATES];
export const CHALLENGES:Challenge[]=[
 {id:'gratiot-dash',title:'End-to-End Dash',kind:'trial',start:ROUTE_START,end:MACK_FINISH,description:'Ride from the southern Cut entrance to Mack Avenue. Every checkpoint counts; no time cutoff.',gates:mackGates(ROUTE_START),gold:420,silver:550,finishAtEnd:true},
 {id:'freight-express',features:true,title:'Freight Yard Express',kind:'trial',start:ROUTE_START,end:MACK_FINISH,description:'Ride the entire Cut via the Freight Yard to Mack. Watch for marked slippery patches and optional jump ramps.',gates:mackGates(ROUTE_START),gold:440,silver:580,finishAtEnd:true},
 {id:'silk-line',title:'Silk Line',kind:'style',start:ROUTE_START,end:MACK_FINISH,description:'Link four alternating controlled carves, then follow the gates all the way to Mack Avenue. Hold each lean for 0.6 seconds at 7–32 km/h.',gates:mackGates(ROUTE_START),gold:480,silver:440,finishAtEnd:true},
 {id:'soft-landing',features:true,title:'Soft Landing Club',kind:'style',start:ROUTE_START,end:MACK_FINISH,description:'Land three moving hops at least 8 m apart, settle each landing, and continue through the gates to Mack Avenue.',gates:mackGates(ROUTE_START),gold:450,silver:360,finishAtEnd:true},
 {id:'cut-collector',title:'The Cut, Collected',kind:'discovery',start:ROUTE_START,end:MACK_FINISH,description:'Photograph the gateway, heron mural and Freight Yard. Then finish your journey through the marked route at Mack Avenue.',gates:mackGates(ROUTE_START),gold:3,silver:2,finishAtEnd:true},
];
export interface Observation {station:number;offset:number;speed:number;grounded:boolean;crashed:boolean;roll:number;slip:number;traction:number;airHeight:number;landing?:string;hopCharge?:number;recovered?:boolean}
export interface PhotoCheck {distance:number;speed:number;inFrame:boolean;unobstructed:boolean}
export function photoAllowed(p:PhotoCheck){return p.distance>=3&&p.distance<=42&&Math.abs(p.speed)<.5&&p.inFrame&&p.unobstructed;}
export class DistrictRun {
 readonly challenge:Challenge;
 elapsed=0;count=0;gateCount=0;score=0;done=false;failed=false;reason='';photos=new Set<string>();
 private previous:Observation|undefined;private crashPenalty=false;
 private turnSign=0;private turnTime=0;private turnMetres=0;private lastTurn=0;private turnQuality=0;
 private airborne=false;private airPeak=0;private landingPending=false;private settle=0;private lastLandingStation=-Infinity;private pendingPoints=0;
 constructor(challenge:Challenge){this.challenge=challenge;}
 step(dt:number,o:Observation){
  if(this.done||this.failed||dt<=0)return;
  this.elapsed+=dt;const c=this.challenge,before=this.previous;this.previous={...o};
  if(o.crashed||o.recovered){if(!this.crashPenalty){this.elapsed+=5;this.crashPenalty=true;}this.previous=undefined;this.airborne=false;this.landingPending=false;this.turnTime=0;this.reason='Recover and continue · 5 s penalty. All remaining gates still count.';return;}this.crashPenalty=false;
  if(o.station<c.start-15||o.station>c.end+12||Math.abs(o.offset)>3.2){this.reason='Return to the marked route to continue.';return;}
  const travel=before?o.station-before.station:0;
  if(c.kind==='trial'||c.finishAtEnd){
   const target=c.gates[this.gateCount];
   if(before&&target!==undefined&&before.station<target&&o.station>=target&&travel>0&&travel<3){
    const u=before.offset+(o.offset-before.offset)*(target-before.station)/travel;
    if(Math.abs(u-(c.gateOffsets?.[this.gateCount]??0))<=(c.gateWidth??3.4)/2)this.gateCount++;
   }
   if(c.gates[this.gateCount]!==undefined&&o.station>c.gates[this.gateCount]+5){this.reason='Missed a gate. Turn back and ride between the gold posts.';return;}this.reason='';
   if(c.kind==='trial'){this.count=this.gateCount;if(this.gateCount===c.gates.length)this.done=true;return;}
   if(this.gateCount===c.gates.length){if(this.objectiveReady)this.done=true;else this.fail('Mack Avenue reached before the objectives were complete. Retry and finish them on the way.');return;}
  }
  if(c.kind==='discovery')return;
  const controlled=o.grounded&&!o.crashed&&Math.abs(o.slip)<.22&&o.traction<.85&&o.speed>=2&&o.speed<=9&&Math.abs(o.offset)<2;
  if(this.objectiveReady)return;
  if(c.id==='silk-line'){
   const sign=Math.sign(o.roll);
   if(controlled&&Math.abs(o.roll)>=.055&&Math.abs(o.roll)<.5&&travel>0&&travel<1&&sign!==this.lastTurn){
    if(sign!==this.turnSign){this.turnTime=0;this.turnMetres=0;this.turnQuality=0;this.turnSign=sign;}
    this.turnTime+=dt;this.turnMetres+=travel;this.turnQuality+=dt*(o.traction<.5?1:0);
    if(this.turnTime>=.6&&this.turnMetres>=1.5){this.count++;this.score+=100+Math.round(25*this.turnQuality/this.turnTime);this.lastTurn=sign;this.turnTime=0;this.turnMetres=0;if(this.count===4&&!c.finishAtEnd)this.done=true;}
   }else {this.turnTime=0;this.turnMetres=0;this.turnQuality=0;}
  }else{
   if(!o.grounded){this.airborne=true;this.airPeak=Math.max(this.airPeak,o.airHeight);this.landingPending=false;this.settle=0;}
   if(o.landing){
    this.landingPending=this.airborne&&this.airPeak>.1&&['clean','charged'].includes(o.landing)&&o.station-this.lastLandingStation>=8&&o.speed>=1.5;
    this.pendingPoints=100+Math.round(60*Math.min(1,Math.max(0,o.hopCharge??0)));this.airborne=false;this.airPeak=0;this.settle=0;
   }
   if(this.landingPending){
    if(!o.grounded||Math.abs(o.slip)>.22||o.traction>=.85||Math.abs(o.roll)>.4){this.landingPending=false;return;}
    this.settle+=dt;if(this.settle>=RIDE_RULES.settleSeconds){this.count++;this.score+=this.pendingPoints;this.lastLandingStation=o.station;this.landingPending=false;if(this.count===3&&!c.finishAtEnd)this.done=true;}
   }
  }
 }
 capture(id:string,check:PhotoCheck){if(this.challenge.kind!=='discovery'||this.done||this.failed||!['gateway','mural','freight'].includes(id)||!photoAllowed(check))return false;this.photos.add(id);this.count=this.photos.size;this.score=this.count;if(this.count===3&&!this.challenge.finishAtEnd)this.done=true;return true;}
 get objectiveReady(){return this.count>=(this.challenge.id==='silk-line'?4:3);}
 fail(reason:string){this.failed=true;this.reason=reason;}
 get medal(){if(!this.done)return 0;const c=this.challenge;return c.kind==='trial'?(this.elapsed<=c.gold?3:this.elapsed<=c.silver?2:1):(this.score>=c.gold?3:this.score>=c.silver?2:1);}
 get progress(){const c=this.challenge,finish=c.finishAtEnd?` · ${this.gateCount}/${c.gates.length} gates to Mack`:'';return c.kind==='trial'?`${this.count}/${c.gates.length} gates · ${this.elapsed.toFixed(1)} s`:c.kind==='discovery'?`${this.count}/3 photographs${finish}`:`${this.count}/${c.id==='silk-line'?4:3} ${c.id==='silk-line'?'linked carves':'clean landings'} · ${this.score} pts${finish}`;}
}
export interface PersonalBest {value:number;medal:number;completions:number}
export type Records=Record<string,PersonalBest>;
export function readRecords(raw:string|null):Records {const out:Records={};try{const parsed=JSON.parse(raw??'{}');for(const id of [...CHALLENGES.map(c=>c.id),...Object.keys(parsed??{}).filter(id=>/^(daily-\d{4}-\d{2}-\d{2}|practice-(wide|tight|hops))$/.test(id)).slice(-40)]){const c={id};const r=parsed?.[c.id];if(r&&Number.isFinite(r.value)&&r.value>=0&&Number.isInteger(r.medal)&&r.medal>=1&&r.medal<=3&&Number.isInteger(r.completions)&&r.completions>0)out[c.id]={value:r.value,medal:r.medal,completions:r.completions};}}catch{}return out;}
export function recordRun(records:Records,run:DistrictRun){if(!run.done||run.failed)return false;const c=run.challenge,value=c.kind==='trial'?run.elapsed:run.score,old=records[c.id];const improved=!old||(c.kind==='trial'?value<old.value:value>old.value);records[c.id]={value:improved?value:old.value,medal:Math.max(old?.medal??0,run.medal),completions:(old?.completions??0)+1};return improved;}
