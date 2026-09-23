import {routeGuide} from './routeGuide.ts';
import * as T from 'three';



import {Hero,type loadActors} from './actors.ts';



import {RaceRules,RACE_ROUTE,type RaceDifficulty} from './raceRules.ts';



import {RacePilot} from './racePilot.ts';



import {routePosition} from './districtView.ts';



import {RIDER_CHOICES,type RiderId} from './riderChoices.ts';



import {toMap,toLocal} from './geo-profile.ts';



import {CUT_THROUGH} from './raceRules.ts';



import {cutPoint,heightAt} from './world.ts';



import {cutCoords} from './world.ts';



import type {TerrainSampler} from './terrain.ts';



import type {RidePose,RideController} from './controller.ts';


const $=(id:string)=>document.getElementById(id)!;



const name=(id:string)=>RIDER_CHOICES.find(r=>r.id===id)?.label??id;



export class RivalRace {



 private playerPose?:RidePose;

 rules:RaceRules;pilots:RacePilot[];private heroes:Hero[];private group=new T.Group();private materials:T.Material[]=[];private geometry:T.BufferGeometry[]=[];



 constructor(scene:T.Scene,terrain:TerrainSampler,data:Awaited<ReturnType<typeof loadActors>>,player:RiderId,readonly difficulty:RaceDifficulty,playerController?:RideController){


  this.rules=new RaceRules(player);this.pilots=this.rules.racers.slice(1).map((r,i)=>new RacePilot(terrain,r.id,i,difficulty,()=>playerController?playerController.obstacles('human-player'):this.playerPose?[{id:'human-player',x:this.playerPose.x,y:this.playerPose.y,z:this.playerPose.z,radius:.52,height:2.2,kind:'rider',vx:this.playerPose.velocityX,vz:this.playerPose.velocityZ}]:[]));


  this.heroes=this.pilots.map(p=>{const h=new Hero(data,terrain,p.id);p.sim.mountedVolume=h.mountedVolume;h.apply(p.pose);scene.add(h.root);return h;});



  scene.add(this.group);



  for(const [index,d]of RACE_ROUTE.gates.entries()){



   const gate=new T.Group(),p=routePosition(d);gate.position.set(p.x,p.y+.04,p.z);gate.rotation.y=p.heading;



   const material=new T.MeshBasicMaterial({color:index===RACE_ROUTE.gates.length-1?0xffc169:0x58f5e5});this.materials.push(material);



   for(const side of [-1,1]){const geometry=new T.BoxGeometry(.1,2.5,.1);this.geometry.push(geometry);const post=new T.Mesh(geometry,material);post.position.set(side*RACE_ROUTE.width/2,1.25,0);gate.add(post);}



   const top=new T.BoxGeometry(RACE_ROUTE.width,.12,.12);this.geometry.push(top);const arch=new T.Mesh(top,material);arch.position.y=2.5;gate.add(arch);
   const g=new T.BoxGeometry(RACE_ROUTE.width,.025,.35);this.geometry.push(g);gate.add(new T.Mesh(g,material));this.group.add(gate);



  }



  const material=new T.MeshBasicMaterial({color:0xffc169});this.materials.push(material);



  for(const [d,u]of CUT_THROUGH){const m=cutPoint(d,u),p=toLocal(m.x,heightAt(m.x,m.z),m.z),g=new T.ConeGeometry(.16,.45,5);this.geometry.push(g);const marker=new T.Mesh(g,material);marker.position.set(p.x,p.y+.5,p.z);this.group.add(marker);}



 }



 obstacles(){return this.pilots.flatMap((p,i)=>p.sim.obstacles('rival-'+i));}


 step(dt:number,player:RidePose){this.playerPose=player;const m=toMap(player.x,player.y,player.z),c=cutCoords(m.x,m.z);if(player.crashBlend===0&&player.crashMotion===0)this.rules.observe(this.rules.player.id,c.d,c.u,dt);for(const p of this.pilots)p.step(dt,this.rules);}



 render(visible:boolean,vr:boolean){this.group.visible=visible;this.heroes.forEach((h,i)=>{h.root.visible=visible;h.apply(this.pilots[i].pose);});$('raceHUD').hidden=!visible||vr;$('raceCountdown').hidden=!visible||vr||this.rules.countdown<=0;}



 hud(){const r=this.rules;$('racePosition').textContent=`${r.place} / 4`;$('raceTime').textContent=r.elapsed.toFixed(1)+' s';$('raceCountdown').textContent=String(Math.ceil(r.countdown));$('raceGate').textContent=r.player.missed?'MISSED GATE · Recover to last checkpoint':`${Math.max(0,Math.round(RACE_ROUTE.end-r.player.station))} m to finish · Gate ${Math.min(r.player.gate+1,RACE_ROUTE.gates.length)}/${RACE_ROUTE.gates.length}`;



  if(this.playerPose&&RACE_ROUTE.gates[r.player.gate]!==undefined){const p=this.playerPose;$('raceGate').textContent+=' / '+routeGuide(p.x,p.z,p.headingY,routePosition(RACE_ROUTE.gates[r.player.gate]));}
  if(r.player.station>1965&&r.player.station<2030&&!r.player.missed)$('raceGate').textContent+=' · Gold markers: optional Freight Yard cut-through';



  $('raceOrder').replaceChildren(...r.order.map((p,i)=>{const li=document.createElement('li');li.textContent=`${i+1}. ${p.player?'YOU':name(p.id)}${p.finish!==null?' · '+p.finish.toFixed(1)+' s':!p.player?' · '+Math.round(p.speed*3.6)+' km/h':''}`;li.classList.toggle('isPlayer',p.player);return li;}));



 }



 finish(banked=0){const r=this.rules;$('raceResults').hidden=false;$('raceResultTitle').textContent=r.player.finish===null?'Race complete.':r.place===1?'THE CUT IS YOURS.':`${r.place}${r.place===2?'ND':r.place===3?'RD':'TH'} PLACE. RUN IT BACK.`;



  $('raceResultCopy').textContent=r.player.finish===null?'Finish every gate to complete the route.':`${r.player.finish.toFixed(2)} seconds · ${this.difficulty.toUpperCase()} · Cut entrance to Mack Avenue`;



  $('raceResultOrder').replaceChildren(...r.order.map((p,i)=>{const row=document.createElement('li');row.textContent=`${i+1} — ${p.player?'You · ':''}${name(p.id)} — ${p.finish===null?Math.max(0,Math.round(RACE_ROUTE.end-p.station))+' m remaining':p.finish.toFixed(2)+' s'}`;return row;}));



  $('raceResultCopy').textContent+=` · ${banked} banked trick points · ${r.player.finish===null?'INCOMPLETE':'VALID FINISH'} · Local personal records`;



  if(r.player.finish!==null)try{const key=`swoop-rivals-best:${RACE_ROUTE.id}:${this.difficulty}:${r.player.id}`,old=Number(localStorage.getItem(key));if(!old||r.player.finish<old){localStorage.setItem(key,String(r.player.finish));$('raceResultCopy').textContent+=' · NEW PERSONAL BEST';}else $('raceResultCopy').textContent+=` · Best ${old.toFixed(2)} s`;}catch{}



 }



 dispose(){this.heroes.forEach(h=>h.dispose());this.group.removeFromParent();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());$('raceHUD').hidden=true;$('raceCountdown').hidden=true;$('raceResults').hidden=true;}



}



export function installRaceUI(retry:()=>void,free:()=>void,menu:()=>void){



 const hud=document.createElement('section');hud.id='raceHUD';hud.hidden=true;hud.innerHTML='<div class="raceHudTop"><small>RIVAL RACE</small><strong id="racePosition">1 / 4</strong><span id="raceTime">0.0 s</span></div><p id="raceGate"></p><ol id="raceOrder"></ol><button id="raceRetry">Restart race</button>';document.body.append(hud);



 const countdown=document.createElement('div');countdown.id='raceCountdown';countdown.hidden=true;countdown.setAttribute('role','status');document.body.append(countdown);



 const results=document.createElement('section');results.id='raceResults';results.hidden=true;results.setAttribute('role','dialog');results.setAttribute('aria-modal','true');results.setAttribute('aria-labelledby','raceResultTitle');results.innerHTML='<div><p class="eyebrow">SWOOP RIVALS / FINISH LINE</p><h2 id="raceResultTitle"></h2><p id="raceResultCopy"></p><ol id="raceResultOrder"></ol><div class="raceResultButtons"><button id="raceAgain">Race again</button><button id="raceFree">Free ride</button><button id="raceMenu">Main menu</button></div></div>';document.body.append(results);



 $('raceRetry').onclick=$('raceAgain').onclick=retry;$('raceFree').onclick=free;$('raceMenu').onclick=menu;



}



