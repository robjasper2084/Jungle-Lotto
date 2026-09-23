import {ROUTE_START,FULL_ROUTE_GATES} from './fullRoute.ts';
import {RIDER_CHOICES,type RiderId} from './riderChoices.ts';
import {CUT_METRES} from './geography.ts';
// The finish is the mapped Mack Avenue endpoint, never a timer or mid-route gate.
export const RACE_ROUTE={id:'entrance-mack-v3',label:'Cut entrance to Mack Avenue',start:ROUTE_START,end:CUT_METRES,gates:[...FULL_ROUTE_GATES],width:5.5};
// Existing mapped paths 6324 -> 5565 -> 5564, rejoin before the 2180 m checkpoint.
export const CUT_THROUGH=[[2001.6,0],[2001.2,-10.2],[2027.2,-11.5],[2027.1,0]] as const;
export type RaceDifficulty='cruise'|'club'|'expert';
export const RACE_PACE:Record<RaceDifficulty,number>={cruise:10,club:16,expert:19};
export interface Racer {id:RiderId;player:boolean;station:number;offset:number;speed:number;gate:number;finish:number|null;previous:number;missed:boolean}
export class RaceRules {
 countdown=3;elapsed=0;done=false;racers:Racer[];
 private waitForAll:boolean;
 constructor(player:RiderId,options?:{opponents:readonly RiderId[];waitForAll?:boolean}){
  const ids=[player,...(options?.opponents??RIDER_CHOICES.map(r=>r.id).filter(id=>id!==player))];
  if(new Set(ids).size!==ids.length)throw Error('Each racer needs a different character');
  this.waitForAll=options?.waitForAll??false;
  this.racers=ids.map((id,i)=>({id,player:i===0,station:RACE_ROUTE.start-i*2.2,offset:0,speed:0,gate:0,finish:null,previous:RACE_ROUTE.start-i*2.2,missed:false}));
 }
 advance(dt:number){if(this.done||dt<=0)return 0;if(this.countdown>0){const remaining=Math.max(0,dt-this.countdown);this.countdown=Math.max(0,this.countdown-dt);this.elapsed+=remaining;return remaining;}this.elapsed+=dt;return dt;}
 observe(id:RiderId,station:number,offset:number,dt:number){
  const r=this.racers.find(r=>r.id===id)!;
  if(this.done||this.countdown>0||r.finish!==null)return;
  const before=r.previous,travel=station-before;r.station=station;r.offset=offset;if(dt>0&&Math.abs(travel)<Math.max(2,dt*25))r.speed+=(Math.max(0,travel/dt)-r.speed)*Math.min(1,dt*6);
  const gate=RACE_ROUTE.gates[r.gate];
  if(travel>0&&travel<Math.max(2,dt*25)&&before<gate&&station>=gate&&Math.abs(offset)<=RACE_ROUTE.width/2){
   r.gate++;r.missed=false;
   if(r.gate===RACE_ROUTE.gates.length){r.finish=Math.max(0,this.elapsed-dt+(gate-before)/travel*dt);if(this.waitForAll?this.racers.every(r=>r.finish!==null):r.player)this.done=true;}
  }
  if(station>(RACE_ROUTE.gates[r.gate]??Infinity)+4)r.missed=true;
  r.previous=station;
 }
 recover(id:RiderId){const r=this.racers.find(r=>r.id===id)!;const d=r.gate?RACE_ROUTE.gates[r.gate-1]+.5:RACE_ROUTE.start;r.station=r.previous=d;r.speed=0;r.missed=false;return d;}
 get order(){return [...this.racers].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.gate-a.gate||Math.min(b.station,RACE_ROUTE.gates[b.gate])-Math.min(a.station,RACE_ROUTE.gates[a.gate]));}
 get player(){return this.racers[0];}
 get place(){return this.order.findIndex(r=>r.player)+1;}
 get label(){return this.countdown>0?`START IN ${Math.ceil(this.countdown)}`:this.done?(this.player.finish===null?'RACE COMPLETE':`${this.place}${['','ST','ND','RD','TH'][this.place]} PLACE`):`${this.place}/${this.racers.length} · GATE ${Math.min(this.player.gate+1,RACE_ROUTE.gates.length)}/${RACE_ROUTE.gates.length}`;}
}
