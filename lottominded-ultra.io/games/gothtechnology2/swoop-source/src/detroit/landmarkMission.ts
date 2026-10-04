export const COMPANION_ROUTE=[
 {station:38,name:'Cut entrance'}, {station:265,name:'Woodbridge / Fit Park'},
 {station:950,name:'Campbell Terrace'}, {station:1438,name:'Chestnut overpass'},
 {station:1864,name:'Adelaide mural'}, {station:2050,name:'Freight Yard'},
] as const;
export interface MissionObservation {station:number;offset:number;speed:number;crashed:boolean;dogDistance:number;dogCommand:string;sit:number}
/** Fixed-step progress, ordered crossings and recovery penalties; pauses never tick. */
export class LandmarkMission {
 phase:'sit'|'come'|'ride'|'complete'='sit';elapsed=0;gate=0;penalties=0;
 private previous?:number;private wasCrashed=false;private held=0;
 step(dt:number,o:MissionObservation){
  if(this.phase==='complete'||!Number.isFinite(dt)||dt<=0)return false;
  this.elapsed+=dt;
  if(o.crashed){if(!this.wasCrashed){this.penalties++;this.elapsed+=5;}this.wasCrashed=true;this.previous=undefined;this.held=0;return false;}
  this.wasCrashed=false;
  if(this.phase==='sit'){
   this.held=o.dogCommand==='sit'&&o.sit>.9&&Math.abs(o.speed)<.5&&o.dogDistance<4?this.held+dt:0;
   if(this.held>.5){this.phase='come';this.held=0;return true;}
  }else if(this.phase==='come'){
   if(o.dogCommand==='come'&&o.sit<.1&&o.dogDistance<4){this.phase='ride';this.previous=o.station;return true;}
  }else{
   const target=COMPANION_ROUTE[this.gate].station,before=this.previous;this.previous=o.station;
   // Neither teleporting nor skipping a marker awards a checkpoint.
   if(before!==undefined&&before<target&&o.station>=target&&o.station-before<3&&Math.abs(o.offset)<2.8){
    this.gate++;if(this.gate===COMPANION_ROUTE.length)this.phase='complete';return true;
   }
  }
  return false;
 }
 get target(){return this.phase==='ride'?COMPANION_ROUTE[this.gate]:undefined;}
 get instruction(){return this.phase==='sit'?'Stop beside your Boerboel and ask it to Sit.':this.phase==='come'?'Ask your dog to Come, then join the Cut.':this.phase==='complete'?'Freight Yard reached. A ride to remember.':`Ride through the teal marker at ${this.target!.name}.`;}
}
export function readMissionBest(raw:string|null){try{const v=JSON.parse(raw??'null');return v&&Number.isFinite(v.seconds)&&v.seconds>0&&Number.isInteger(v.rides)&&v.rides>0?{seconds:v.seconds as number,rides:v.rides as number}:undefined;}catch{return undefined;}}
