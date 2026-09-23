import {routeGuide} from './routeGuide.ts';
import * as T from 'three';
import {Hero,type loadActors} from './actors.ts';
import {FollowCamera} from './followCamera.ts';
import {RideConfirmation,RiderLamp} from './rideEffects.ts';
import type {EffectPatch} from './effectRules.ts';
import type {RideAudio} from './rideAudio.ts';
import {ContactEffects} from './contactEffects.ts';
import {PedalSparks} from './pedalSparks.ts';
import {createPose,lerpPose,type RidePose} from './controller.ts';
import {RACE_ROUTE,CUT_THROUGH} from './raceRules.ts';
import {routePosition} from './districtView.ts';
import {underpassCameraHeight} from './cameraClearance.ts';
import {SplitRaceSimulation} from './splitRaceSimulation.ts';
import {splitBindingLabel,type SplitBinding} from './splitInput.ts';
import {splitViewports} from './splitLayout.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import './splitRace.css';

const riderName=(id:string)=>RIDER_CHOICES.find(r=>r.id===id)!.label;
export class SplitRaceView {
 readonly simulation:SplitRaceSimulation;
 readonly heroes:Hero[];readonly poses=[createPose(),createPose()];
 private cues:RideConfirmation[]=[];private lamps:RiderLamp[]=[];private lastGates=[0,0];private audio:readonly RideAudio[];
 private cameras=[new T.PerspectiveCamera(55,1,.08,1500),new T.PerspectiveCamera(55,1,.08,1500)];
 private follows:FollowCamera[];private first=[false,false];private effects:ContactEffects[];private sparks:PedalSparks[];
 private course=new T.Group();private courseGeometries:T.BufferGeometry[]=[];private courseMaterials:T.Material[]=[];
 private hud=document.createElement('section');private results=document.createElement('section');private resultShown=false;
 private panels:HTMLElement[]=[];private clock:HTMLElement;private pauseButton:HTMLButtonElement;
 readonly bindings:readonly [SplitBinding,SplitBinding];
 constructor(scene:T.Scene,simulation:SplitRaceSimulation,data:Awaited<ReturnType<typeof loadActors>>,bindings:readonly [SplitBinding,SplitBinding],actions:{pause:()=>void;restart:()=>void;menu:()=>void;recover:(i:number)=>void;camera:(i:number)=>void;cruise:(i:number)=>void},patches:readonly EffectPatch[]=[],audio:readonly RideAudio[]=[]){
  this.simulation=simulation;this.bindings=bindings;this.audio=audio;this.lamps=simulation.riders.map(()=>new RiderLamp(scene,simulation.terrain));
  this.heroes=simulation.riders.map(r=>{const h=new Hero(data,r.sim.terrain,r.id);r.sim.mountedVolume=h.mountedVolume;h.apply(r.pose);scene.add(h.root);return h;});
  this.follows=simulation.riders.map(r=>{const f=new FollowCamera(simulation.terrain);f.reset(r.pose);return f;});
  this.effects=simulation.riders.map(()=>new ContactEffects(scene,simulation.terrain,patches));this.sparks=simulation.riders.map(()=>new PedalSparks(scene));scene.add(this.course);
  for(const [i,station]of RACE_ROUTE.gates.entries()){
   const p=routePosition(station),g=new T.Group(),mat=new T.MeshBasicMaterial({color:i===RACE_ROUTE.gates.length-1?0xffc169:0x58f5e5});this.courseMaterials.push(mat);g.position.set(p.x,p.y+.04,p.z);g.rotation.y=p.heading;
   const post=new T.BoxGeometry(.1,2.5,.1),line=new T.BoxGeometry(RACE_ROUTE.width,.025,.35);this.courseGeometries.push(post,line);
   for(const side of [-1,1]){const mesh=new T.Mesh(post,mat);mesh.position.set(side*RACE_ROUTE.width/2,1.25,0);g.add(mesh);}g.add(new T.Mesh(line,mat));this.course.add(g);
  }
  const gold=new T.MeshBasicMaterial({color:0xffc169});this.courseMaterials.push(gold);
  for(const [d,u]of CUT_THROUGH){const p=routePosition(d,u),g=new T.ConeGeometry(.16,.45,5);this.courseGeometries.push(g);const marker=new T.Mesh(g,gold);marker.position.set(p.x,p.y+.5,p.z);this.course.add(marker);}
  this.hud.id='splitHUD';this.hud.setAttribute('aria-label','Two player race');
  const bar=document.createElement('div');bar.className='splitBar';bar.innerHTML='<strong>SWOOP <span>LOCAL / 2P</span></strong><b class="splitClock"></b><nav></nav>';this.clock=bar.querySelector('b')!;
  const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b;};
  this.pauseButton=button('Pause',actions.pause);bar.querySelector('nav')!.append(this.pauseButton,button('Restart',actions.restart),button('Menu',actions.menu));this.hud.append(bar);
  for(let i=0;i<2;i++){
   const panel=document.createElement('section');panel.className='splitPane';panel.dataset.player=String(i+1);panel.setAttribute('aria-label',`Player ${i+1} view`);
   panel.innerHTML='<div class="splitIdentity"><b></b><span></span></div><div class="splitMeters"><strong></strong><span></span></div><p class="splitProgress"></p><p class="splitNotice" role="status"></p><div class="splitBottom"><div class="splitScore"></div><small></small><nav></nav></div>';
   panel.querySelector('.splitIdentity b')!.textContent='PLAYER '+(i+1);panel.querySelector('.splitIdentity span')!.textContent=riderName(simulation.riders[i].id);
   panel.querySelector('small')!.textContent=splitBindingLabel(bindings[i]);panel.querySelector('nav')!.append(button('Recover',()=>actions.recover(i)),button('Camera',()=>actions.camera(i)),button('Cruise · 24',()=>actions.cruise(i)));this.panels.push(panel);this.hud.append(panel);this.cues.push(new RideConfirmation(panel));
  }
  this.results.id='splitResults';this.results.hidden=true;this.results.setAttribute('role','dialog');this.results.setAttribute('aria-modal','true');this.results.setAttribute('aria-labelledby','splitResultTitle');
  this.results.innerHTML='<div><p class="eyebrow">LOCAL RACE / DEQUINDRE CUT</p><h2 id="splitResultTitle"></h2><ol></ol><p>Local match only. Solo records, rewards and saves stay unchanged.</p><nav></nav></div>';
  this.results.querySelector('nav')!.append(button('Race again',actions.restart),button('Main menu',actions.menu));document.body.append(this.hud,this.results);
 }
 afterStep(dt:number){
  if(this.simulation.rules.countdown>0)return;
  this.simulation.riders.forEach((r,i)=>{
   const cue=this.cues[i];cue.step(dt);this.follows[i].step(dt,r.pose);this.effects[i].step(dt,r.pose,r.sim.snapshot().grounded);
   if(r.sim.touchedDown){this.follows[i].landing(r.sim.lastLandingImpact);if(r.sim.lastLandingQuality!=='crash'){const surface=this.effects[i].land(r.pose,r.sim.lastLandingImpact);this.audio[i]?.landing(r.sim.lastLandingImpact,surface.surface,surface.wet);}}
   if(r.sim.tricks.award>0&&cue.show('trick',r.sim.tricks.event,'trick:'+this.simulation.rules.elapsed))this.audio[i]?.confirm('trick');
   const gate=this.simulation.rules.racers[i].gate;
   if(gate>this.lastGates[i]){this.lastGates[i]=gate;if(cue.show('checkpoint',gate===RACE_ROUTE.gates.length?'FINISH LINE':`CHECKPOINT ${gate} / ${RACE_ROUTE.gates.length}`,'gate:'+gate))this.audio[i]?.confirm();}
   if(this.simulation.newCrashes.includes(i)){this.sparks[i].reset();this.effects[i].reset();cue.reset();}
  });
 }
 recovered(i:number){this.follows[i].reset(this.simulation.riders[i].pose);this.first[i]=false;this.sparks[i].reset();this.effects[i].reset();this.cues[i].reset();}
 get feedback(){return this.effects.map((e,i)=>({...e.surface.model.state,confirmation:this.cues[i].model.text,lamp:this.lamps[i].intensity,audio:this.audio[i]?.state}));}
 toggleCamera(i:number){this.first[i]=!this.first[i];this.follows[i].reset(this.simulation.riders[i].pose);}
 render(renderer:T.WebGLRenderer,scene:T.Scene,dt:number,alpha:number,active:boolean,paused:boolean,visible:boolean,beforeView:(p:RidePose,camera:T.PerspectiveCamera)=>void,connectionMessage='',cruising:readonly boolean[]=[false,false],dusk=false){
  this.hud.hidden=!visible;this.results.hidden=!visible||!this.simulation.rules.done;
  const rules=this.simulation.rules,rects=splitViewports(innerWidth,innerHeight);
  this.pauseButton.textContent=paused?'Resume':'Pause';this.clock.textContent=paused?'PAUSED':rules.countdown>0?`START IN ${Math.ceil(rules.countdown)}`:rules.done?'RACE COMPLETE':rules.elapsed.toFixed(1)+' s';
  this.simulation.riders.forEach((r,i)=>{
   lerpPose(r.previous,r.pose,alpha,this.poses[i]);this.heroes[i].apply(this.poses[i]);this.heroes[i].rider.visible=true;this.cues[i].render(visible&&!rules.done);this.lamps[i].update(dt,this.poses[i],dusk,visible);
   this.effects[i].update(dt,this.poses[i],this.heroes[i],undefined,false,active);this.sparks[i].update(dt,this.poses[i],active&&!r.sim.crashed);
   const rect=rects[i],panel=this.panels[i],progress=rules.racers[i],place=rules.order.findIndex(x=>x.id===r.id)+1;
   Object.assign(panel.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
   panel.querySelector('.splitMeters strong')!.textContent=Math.round(Math.abs(r.pose.speed)*3.6)+' km/h';panel.querySelector('.splitMeters span')!.textContent=`${place} / 2`;
   panel.querySelector('.splitProgress')!.textContent=progress.finish!==null?`FINISHED · ${progress.finish.toFixed(2)} s`:progress.missed?'MISSED GATE · Recover to last checkpoint':`Gate ${Math.min(progress.gate+1,RACE_ROUTE.gates.length)}/${RACE_ROUTE.gates.length} · ${Math.max(0,Math.round(RACE_ROUTE.end-progress.station))} m`;
   if(progress.finish===null&&RACE_ROUTE.gates[progress.gate]!==undefined)panel.querySelector('.splitProgress')!.textContent+=' / '+routeGuide(r.pose.x,r.pose.z,r.pose.headingY,routePosition(RACE_ROUTE.gates[progress.gate]));
   panel.querySelector('.splitNotice')!.textContent=connectionMessage|| (r.sim.crashed?`FALL · ${r.sim.snapshot().fallPhase==='settled'?'Recover when ready':'settling…'}`:paused?'Release controls before resuming':r.pose.warningLevel>.05?'SPEED WARNING · EASE OFF':r.pose.scrape>.05?'PEDAL SCRAPE':r.message);
   panel.querySelector('.splitScore')!.textContent=`${r.flow.banked} BANKED`+(r.flow.pending?` · +${r.flow.pending} PENDING`:'');
   const buttons=panel.querySelectorAll<HTMLButtonElement>('nav button');buttons[0].disabled=paused||rules.countdown>0||rules.done||progress.finish!==null||r.sim.crashed&&r.sim.snapshot().fallPhase!=='settled';
   buttons[1].textContent=this.first[i]?'Camera · first person':'Camera · chase';
   buttons[2].disabled=paused||rules.countdown>0||rules.done||progress.finish!==null||r.sim.crashed;buttons[2].setAttribute('aria-pressed',String(cruising[i]));buttons[2].textContent=cruising[i]?'Cruise on · 24':'Cruise · 24';
  });
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();renderer.info.reset();renderer.info.autoReset=false;renderer.setScissorTest(true);
  for(let i=0;i<2;i++){
   const p=this.poses[i],camera=this.cameras[i],rect=rects[i],f=this.follows[i],first=this.first[i]&&!this.simulation.riders[i].sim.crashed;
   if(first){const eye=this.heroes[i].head?.getWorldPosition(new T.Vector3())??new T.Vector3(p.x,p.y+1.85,p.z);eye.add(new T.Vector3(Math.sin(p.headingY)*.1,.065,Math.cos(p.headingY)*.1));eye.y=underpassCameraHeight(this.simulation.terrain,eye,eye.y,p.y);camera.position.copy(eye);camera.lookAt(eye.x+Math.sin(p.headingY)*10,eye.y-.5,eye.z+Math.cos(p.headingY)*10);camera.fov=74;}
   else{camera.position.set(f.eye.x,f.eye.y,f.eye.z);camera.lookAt(f.target.x,f.target.y,f.target.z);camera.fov=f.fov;}
   camera.far=180;camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();this.heroes[i].rider.visible=!first;
   beforeView(p,camera);renderer.setViewport(rect.x,innerHeight-rect.y-rect.height,rect.width,rect.height);renderer.setScissor(rect.x,innerHeight-rect.y-rect.height,rect.width,rect.height);renderer.render(scene,camera);this.heroes[i].rider.visible=true;
  }
  renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.info.autoReset=true;
  if(rules.done&&!this.resultShown){
   this.resultShown=true;const order=rules.order,finished=order.filter(r=>r.finish!==null),tied=finished.length===2&&Math.abs(finished[0].finish!-finished[1].finish!)<.01;
   this.results.querySelector('h2')!.textContent=tied?'PHOTO FINISH · TIED':finished.length?`PLAYER ${rules.racers.indexOf(order[0])+1} WINS`:'RACE COMPLETE';
   this.results.querySelector('ol')!.replaceChildren(...order.map((r,i)=>{const li=document.createElement('li'),slot=rules.racers.indexOf(r);li.textContent=`${i+1}. Player ${slot+1} · ${riderName(r.id)} — ${r.finish===null?'Incomplete · '+r.gate+'/'+RACE_ROUTE.gates.length+' gates':r.finish.toFixed(2)+' s · VALID FINISH'} · ${this.simulation.riders[slot].flow.banked} banked points`;return li;}));
   this.results.querySelector<HTMLButtonElement>('button')?.focus();
  }
 }
 dispose(){this.cues.forEach(c=>c.dispose());this.lamps.forEach(l=>l.dispose());this.heroes.forEach(h=>h.dispose());this.effects.forEach(e=>e.dispose());this.sparks.forEach(e=>e.dispose());this.course.removeFromParent();this.courseGeometries.forEach(g=>g.dispose());this.courseMaterials.forEach(m=>m.dispose());this.hud.remove();this.results.remove();}
}
