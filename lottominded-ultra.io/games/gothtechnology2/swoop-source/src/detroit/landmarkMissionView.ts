import * as T from 'three';
import {LandmarkMission,readMissionBest} from './landmarkMission.ts';
import {routePosition} from './districtView.ts';
const cover=new URL('./mission-cover.webp',import.meta.url).href;
import './ridePolish.css';
const recordKey='swoop-freight-companion-best-v1';
export class LandmarkMissionView {
 card=document.createElement('section');hud=document.createElement('section');run?:LandmarkMission;
 private marker:T.Mesh;private title=document.createElement('strong');private copy=document.createElement('p');private stats=document.createElement('small');
 private best:ReturnType<typeof readMissionBest>;private recorded=false;private targetStation=-1;
 constructor(scene:T.Scene,parent:HTMLElement,start:()=>void,focus:()=>void){
  try{this.best=readMissionBest(localStorage.getItem(recordKey));}catch{}
  this.card.className='landmarkMissionCard';this.card.style.backgroundImage=`linear-gradient(90deg,#071d25f2,#071d2544),url("${cover}")`;
  const heading=document.createElement('h3');heading.textContent='River to the Freight Yard';
  const description=document.createElement('p');description.textContent='A companion ride through six Detroit landmarks. Settle your dog, call it back, then find your line. No time limit.';
  const button=document.createElement('button');button.type='button';button.textContent='Start landmark mission';button.onclick=start;
  this.card.append(heading,description,button);parent.append(this.card);
  this.hud.className='landmarkMissionHUD';this.hud.hidden=true;this.hud.setAttribute('aria-label','Landmark mission');
  this.copy.setAttribute('role','status');this.copy.setAttribute('aria-live','polite');
  const exit=document.createElement('button');exit.type='button';exit.textContent='End mission';exit.onclick=()=>{this.cancel();focus();};
  this.hud.append(this.title,this.copy,this.stats,exit);document.body.append(this.hud);
  this.marker=new T.Mesh(new T.TorusGeometry(2.1,.065,6,28),new T.MeshBasicMaterial({color:'#55ecd3',transparent:true,opacity:.85}));this.marker.visible=false;scene.add(this.marker);
  this.update(false,0);
 }
 start(){this.run=new LandmarkMission();this.recorded=false;this.targetStation=-1;}
 cancel(){this.run=undefined;this.hud.hidden=true;this.marker.visible=false;}
 update(visible:boolean,station:number){
  const r=this.run;this.hud.hidden=!visible||!r;
  this.marker.visible=!!r?.target&&visible;
  if(!r)return;
  if(r.phase==='complete'&&!this.recorded){
   const previous=this.best;this.best={seconds:Math.min(previous?.seconds??Infinity,r.elapsed),rides:(previous?.rides??0)+1};
   try{localStorage.setItem(recordKey,JSON.stringify(this.best));}catch{}
   this.recorded=true;
  }
  this.title.textContent=r.phase==='complete'?'MISSION COMPLETE':'RIVER → FREIGHT YARD';
  const target=r.target;let text=r.instruction;
  if(target){const delta=target.station-station;text+=delta< -5?' Marker missed: turn back and cross it northbound.':` ${Math.max(0,Math.round(delta))} m along the Cut.`;
   if(this.targetStation!==target.station){const p=routePosition(target.station);this.marker.position.set(p.x,p.y+2.2,p.z);this.marker.rotation.y=p.heading;this.targetStation=target.station;}}
  // Live announcements only change on objectives; distance remains outside the live region.
  if(this.copy.textContent!==r.instruction)this.copy.textContent=r.instruction;
  this.stats.textContent=`${r.gate}/6 landmarks · ${r.elapsed.toFixed(1)} s${target?` · ${text.slice(r.instruction.length).trim()}`:''}${r.penalties?` · ${r.penalties} recovery penalties`:''}${this.best?` · Best ${this.best.seconds.toFixed(1)} s`:''}`;
 }
}
