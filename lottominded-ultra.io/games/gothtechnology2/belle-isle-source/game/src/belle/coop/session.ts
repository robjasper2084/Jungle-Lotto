import {gearLabel} from '../hoverTransmission.ts';
import {sampleDrawGroups} from './renderProfile.ts';
import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {RidePose} from '../../../runtime/ride-core/src/controller.ts';
import {mountCoopLobby} from './lobby.ts';
import {CoopInput,coopViewports,glViewport,preparePair,loadLayout,LAYOUT_KEY,type SplitLayout,RIDERS,VEHICLES,type InputFrame,type Pad,type PlayerManifest,type Spawn,type Seat} from './coop.ts';
import {CoopAssets,createRenderActor,type RenderActor} from './actors.ts';
import {PairSimulation,coopFrameSeconds,type CoopTerrainSource} from './simulation.ts';
import './session.css';

type Hooks={available:()=>boolean;anchor:()=>Spawn;activate:()=>Promise<void>|void;leave:()=>void;blocked:()=>boolean;prepare?:(root:T.Object3D,signal:AbortSignal)=>Promise<void>};
type World={beginSplitView?:()=>void;endSplitView?:()=>void;splitDetail?:(enabled:boolean)=>void;update:(time:number,x:number,z:number,camera:T.Camera,running?:boolean)=>void};
type Touch={clutch:number;shift:number;lift:number;throttle:number;steer:number;hop:boolean;recover:boolean;interact:boolean;brake:boolean};
type Pane={root:HTMLElement;status:HTMLElement;stick:HTMLElement;thumb:HTMLElement;look:HTMLElement;input:Touch;pointer:number|null;lookPointer:number|null;origin:[number,number];last:[number,number]};
const MOVE_KEYS=new Set(['KeyW','KeyS','KeyA','KeyD','Space','KeyR','KeyF','ShiftLeft','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Slash','Period','ShiftRight','KeyE','KeyQ','PageUp','PageDown','KeyC','KeyO','BracketLeft','BracketRight','Digit9','Digit0']);
const ZERO=():Touch=>({clutch:0,shift:0,lift:0,throttle:0,steer:0,hop:false,recover:false,interact:false,brake:false});
const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{run();if(!document.querySelector('dialog[open]'))document.getElementById('game')?.focus();};return b;};
const pads=()=>Array.from(navigator.getGamepads?.()??[]) as (Pad|null)[];
const store=()=>{try{return localStorage;}catch{return undefined;}};

/** Local exploration is an opt-in session, never a replacement renderer or second game loop. */
export class CoopSession{
 active=false;
 paused=false;
 private disposed=false;
 private preparing=false;
 private generation=0;
 private dialog=document.createElement('dialog');
 private lobby?:ReturnType<typeof mountCoopLobby>;
 private overlay=document.createElement('section');
 private alert=document.createElement('output');
 private pauseButton:HTMLButtonElement;
 private openButton:HTMLButtonElement;
 private welcomeButton:HTMLButtonElement;
 private keys=new Set<string>();
 private readers:CoopInput[]|undefined;
 private simulation:PairSimulation|undefined;
 private assets:CoopAssets|undefined;
 private actors:RenderActor[]=[];
 private panes:Pane[]=[];
 private pendingAbort:AbortController|undefined;
 private lastNow=0;
 private frames:number[]=[];
 private draws:number[]=[];
 private layoutChoice:SplitLayout=loadLayout(store());
 private lastDiagnostics=0;private collectDiagnostics=false;private lastCensus=0;
 private savedScissor=new T.Vector4();private savedViewport=new T.Vector4();
 private width=0;private height=0;
 private cameraTarget=new T.Vector3();private cameraEye=new T.Vector3();
 private cooldown=[0,0,0,0];private updateCount=0;
 constructor(private scene:T.Scene,private terrain:CoopTerrainSource,private wheel:GLTF,private hooks:Hooks){
  this.dialog.id='coop-setup';this.dialog.setAttribute('aria-label','Two-to-four-player exploration');this.dialog.setAttribute('data-mode','local');
  this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.closeSetup();});
  this.dialog.addEventListener('close',()=>{this.lobby?.dispose();this.lobby=undefined;this.clear();});
  this.openButton=button('Explore together · 2–4 players',()=>this.open());this.openButton.id='coop-open';this.openButton.disabled=true;
  document.querySelector('header nav')?.append(this.openButton);
  this.welcomeButton=button('Explore together · 2–4 players',()=>this.open());this.welcomeButton.id='welcome-coop';this.welcomeButton.disabled=true;
  const welcome=document.getElementById('welcome-friends');welcome?.parentElement?.append(this.welcomeButton);
  this.overlay.id='coop-overlay';this.overlay.hidden=true;this.overlay.setAttribute('aria-label','Two-to-four-player island exploration');
  const nav=document.createElement('nav');nav.className='coop-session-toolbar';nav.setAttribute('aria-label','Co-op session controls');
  const label=document.createElement('span');label.textContent='EXPLORE TOGETHER';label.className='coop-session-title';
  this.pauseButton=button('Pause all',()=>this.setPaused(!this.paused));this.pauseButton.id='coop-pause';
  const layout=document.createElement('select');layout.setAttribute('aria-label','Co-op view layout');layout.add(new Option('Horizontal','horizontal'));layout.add(new Option('Side by side','vertical'));layout.value=this.layoutChoice;layout.onchange=()=>{this.layoutChoice=layout.value as SplitLayout;try{store()?.setItem(LAYOUT_KEY,this.layoutChoice);}catch{}this.width=0;this.layout();};
  nav.append(label,layout,this.pauseButton,button('Change riders',()=>this.open()),button('Return to solo',()=>this.stop()));
  this.alert.id='coop-announcement';this.alert.setAttribute('role','status');this.alert.setAttribute('aria-live','polite');
  this.overlay.append(nav,this.alert);document.body.append(this.dialog,this.overlay);
  window.addEventListener('keydown',this.keyDown,true);window.addEventListener('keyup',this.keyUp,true);
  window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);
  window.addEventListener('gamepaddisconnected',this.padLost);window.addEventListener('gamepadconnected',this.padLost);
 }
 refreshAvailability(){const ready=this.hooks.available()&&!this.preparing;this.openButton.disabled=this.welcomeButton.disabled=!ready;}
 private keyDown=(event:KeyboardEvent)=>{
  if(!this.active||this.dialog.open)return;
  if((event.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"],button,summary,a'))return;
  if(event.code==='Escape'||event.code==='KeyP'){
   event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)this.setPaused(!this.paused);return;
  }
  if(event.code==='KeyC'||event.code==='Comma'){
   event.preventDefault();event.stopImmediatePropagation();if(!event.repeat&&!this.paused)this.cameraView(event.code==='KeyC'?0:1);return;
  }
  if(!MOVE_KEYS.has(event.code))return;
  event.preventDefault();event.stopImmediatePropagation();if(!this.paused&&(!event.repeat||this.keys.has(event.code)))this.keys.add(event.code);
 };
 private keyUp=(event:KeyboardEvent)=>{if(!this.active)return;this.keys.delete(event.code);if(MOVE_KEYS.has(event.code)){event.preventDefault();event.stopImmediatePropagation();}};
 private blur=()=>{if(this.active)this.setPaused(true,'Paused because the game lost focus. Release controls before resuming.');};
 private visibility=()=>{if(document.hidden)this.blur();};
 private padLost=()=>{if(this.active)this.setPaused(true,'Controller connection changed. Reconnect the assigned controller, then resume.');};
 private setPaused(value:boolean,message?:string){
  this.paused=value;this.pauseButton.textContent=value?'Resume all':'Pause all';this.overlay.dataset.paused=String(value);this.clear();
  this.alert.textContent=message??(value?'All players paused.':'Explore independently. C / comma switches each camera.');
  if(!value)document.getElementById('game')?.focus();
 }
 clear(){this.keys.clear();for(const r of this.readers??[])r.reset();this.simulation?.clear();for(const p of this.panes){p.input=ZERO();p.pointer=p.lookPointer=null;p.thumb.style.transform='';}this.lastNow=0;}
 open(){
  if(this.disposed||this.preparing||!this.hooks.available())return;
  if(this.active)this.setPaused(true);
  this.lobby?.dispose();this.lobby=mountCoopLobby(this.dialog,{store:store(),pads,onClose:()=>this.closeSetup(),onBegin:(players,signal)=>this.begin(players,signal)});
  this.dialog.showModal();this.clear();this.dialog.querySelector<HTMLSelectElement>('select')?.focus();
 }
 private closeSetup(){this.pendingAbort?.abort(new DOMException('Co-op preparation cancelled','AbortError'));this.generation++;this.dialog.close();if(this.active)this.setPaused(true,'Setup closed. Select Resume all to keep exploring.');else document.getElementById('game')?.focus();}
 private async begin(manifests:readonly PlayerManifest[],outer:AbortSignal){
  if(this.preparing||!this.hooks.available())throw new Error('Wait until the island is ready and leave VR before starting co-op.');
  this.preparing=true;this.refreshAvailability();const version=++this.generation;
  const ctl=new AbortController();this.pendingAbort=ctl;
  const cancel=()=>ctl.abort(outer.reason);outer.addEventListener('abort',cancel,{once:true});if(outer.aborted)cancel();
  const assets=new CoopAssets();let actors:RenderActor[]=[];let staging:T.Group|undefined;
  try{
   const simulation=new PairSimulation(this.terrain,manifests,this.hooks.anchor());
   const prepared=await preparePair(manifests,async(m,signal)=>createRenderActor(m,await assets.rider(m,signal),this.wheel,simulation,m.vehicleId==='hoverbike'?await assets.hover(signal):undefined),ctl.signal,60_000);
   actors=[...prepared];
   // SceneWarmup needs the candidate in the existing scene. It stays invisible outside
   // synchronous program collection; the main render loop suspends during preparation.
   staging=new T.Group();staging.name='Co-op shader preparation';staging.visible=false;staging.add(...actors.map(a=>a.root));this.scene.add(staging);
   if(this.hooks.prepare)await this.hooks.prepare(staging,ctl.signal);
   if(ctl.signal.aborted||version!==this.generation||this.disposed)throw ctl.signal.reason??new Error('Co-op preparation superseded.');
   // Revalidate final occupancy after asynchronous preparation, before any visible handoff.
   for(const seat of actors.map((_,i)=>i as Seat)){simulation.recover(seat,simulation.initial[seat]);actors[seat].apply(0);if(!actors[seat].validate())throw new Error('Player '+(seat+1)+' could not fit safely on the selected wheel.');}
   await this.hooks.activate();
   if(ctl.signal.aborted||version!==this.generation)throw ctl.signal.reason??new Error('Co-op preparation cancelled.');
   this.releaseActors();this.assets=assets;this.simulation=simulation;this.actors=actors;
   this.readers=manifests.map(m=>new CoopInput(m.binding));this.layoutChoice=loadLayout(store());this.overlay.querySelector<HTMLSelectElement>('select')!.value=this.layoutChoice;this.draws=manifests.map(()=>0);
   for(const actor of actors)this.scene.add(actor.root);staging.removeFromParent();staging=undefined;
   this.active=true;this.paused=false;this.frames=[];this.updateCount=0;this.width=0;this.lastNow=0;this.makePanes();
   document.body.classList.add('coop-playing');this.overlay.hidden=false;this.overlay.dataset.state='playing';this.overlay.dataset.paused='false';
   this.pauseButton.textContent='Pause all';this.alert.textContent='All riders ready. Explore the island at your own pace.';
   this.dialog.close();this.clear();document.getElementById('game')?.focus();
  }catch(error){staging?.removeFromParent();if(this.assets===assets){this.active=false;this.releaseActors();this.overlay.hidden=true;document.body.classList.remove('coop-playing');this.hooks.leave();}else{for(const actor of actors)actor.dispose();assets.dispose();}throw error;
  }finally{outer.removeEventListener('abort',cancel);if(this.pendingAbort===ctl)this.pendingAbort=undefined;this.preparing=false;this.refreshAvailability();}
 }
 private makePanes(){
  for(const p of this.panes)p.root.remove();this.panes=[];
  for(const seat of this.actors.map((_,i)=>i as Seat)){
   const actor=this.actors[seat],root=document.createElement('section');root.className='coop-player-pane';root.dataset.seat=String(seat);root.setAttribute('aria-label','Player '+(seat+1)+' view');
   const info=document.createElement('div');info.className='coop-player-info';const title=document.createElement('strong');title.textContent='P'+(seat+1)+' · '+RIDERS.find(r=>r.id===actor.manifest.riderId)!.label;
   const status=document.createElement('output');status.className='coop-player-status';info.append(title,status);
   const look=document.createElement('div');look.className='coop-look';look.setAttribute('aria-label','Player '+(seat+1)+' camera drag area');
   const actions=document.createElement('div');actions.className='coop-player-actions';
   const camera=button('Camera',()=>this.cameraView(seat));camera.setAttribute('aria-label','Change Player '+(seat+1)+' camera');
   const recover=button('Recover',()=>{if(!this.paused){p.input.recover=true;}});recover.setAttribute('aria-label','Recover Player '+(seat+1));
   const together=button('Join partner',()=>this.joinPartner(seat));together.setAttribute('aria-label','Bring Player '+(seat+1)+' near their partner');
   const mount=button('Ride / walk',()=>{if(!this.paused)p.input.interact=true;});mount.setAttribute('aria-label','Player '+(seat+1)+' ride or walk');
   actions.append(camera,recover,together,mount);
   const stick=document.createElement('div');stick.className='coop-touch-stick';stick.setAttribute('role','group');stick.setAttribute('aria-label','Player '+(seat+1)+' movement joystick');const thumb=document.createElement('i');stick.append(thumb);
   const p:Pane={root,status,stick,thumb,look,input:ZERO(),pointer:null,lookPointer:null,origin:[0,0],last:[0,0]};
   const canInput=()=>this.active&&!this.paused&&!this.dialog.open&&!this.hooks.blocked();
   stick.onpointerdown=e=>{if(!canInput()||e.button!==0||p.pointer!==null)return;e.preventDefault();document.getElementById('game')?.focus();p.pointer=e.pointerId;p.origin=[e.clientX,e.clientY];stick.setPointerCapture(e.pointerId);};
   stick.onpointermove=e=>{if(p.pointer!==e.pointerId||!canInput())return;e.preventDefault();const x=(e.clientX-p.origin[0])/32,y=(p.origin[1]-e.clientY)/32,len=Math.max(1,Math.hypot(x,y));p.input.steer=x/len;p.input.throttle=y/len;p.thumb.style.transform=`translate(${x/len*23}px,${-y/len*23}px)`;};
   const release=(e:PointerEvent)=>{if(p.pointer!==e.pointerId)return;p.pointer=null;p.input.throttle=p.input.steer=0;p.thumb.style.transform='';};stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=release;
   look.onpointerdown=e=>{if(!canInput()||e.button!==0||p.lookPointer!==null)return;document.getElementById('game')?.focus();p.lookPointer=e.pointerId;p.last=[e.clientX,e.clientY];look.setPointerCapture(e.pointerId);};
   look.onpointermove=e=>{if(p.lookPointer!==e.pointerId||!canInput())return;actor.yaw-=(e.clientX-p.last[0])*.004;actor.pitch=T.MathUtils.clamp(actor.pitch+(e.clientY-p.last[1])*.003,-.4,.85);p.last=[e.clientX,e.clientY];};
   const releaseLook=(e:PointerEvent)=>{if(p.lookPointer===e.pointerId)p.lookPointer=null;};look.onpointerup=look.onpointercancel=look.onlostpointercapture=releaseLook;
   const hover=actor.manifest.vehicleId==='hoverbike';
   const hop=button(hover?'Takeoff / land':'Hop',()=>{if(canInput())p.input.hop=true;});hop.className='coop-touch-hop';hop.setAttribute('aria-label','Player '+(seat+1)+(hover?' takeoff or land':' hop'));root.dataset.vehicle=actor.manifest.vehicleId;
   const brake=button('Brake',()=>{});brake.className='coop-touch-brake';brake.setAttribute('aria-label','Player '+(seat+1)+' brake');
   brake.onpointerdown=e=>{if(!canInput()||e.button!==0)return;e.preventDefault();p.input.brake=true;brake.setPointerCapture(e.pointerId);};brake.onpointerup=brake.onpointercancel=brake.onlostpointercapture=()=>p.input.brake=false;
   const lift=document.createElement('div');lift.className='coop-lift';lift.hidden=!hover;
   for(const [name,value] of [['Up',1],['Down',-1]] as const){const b=button(name,()=>{});b.setAttribute('aria-label','Player '+(seat+1)+' '+name.toLowerCase());b.onpointerdown=e=>{if(!canInput()||e.button!==0)return;e.preventDefault();p.input.lift=value;b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>p.input.lift=0;lift.append(b);}
   if(hover){
    const drive=document.createElement('details');drive.className='coop-drive';const summary=document.createElement('summary');summary.textContent='Gear AUTO';const clutch=button('Hold clutch',()=>{});clutch.setAttribute('aria-label','Player '+(seat+1)+' clutch');clutch.onpointerdown=e=>{if(!canInput()||e.button!==0)return;e.preventDefault();p.input.clutch=1;clutch.setPointerCapture(e.pointerId);};clutch.onpointerup=clutch.onpointercancel=clutch.onlostpointercapture=()=>p.input.clutch=0;
    drive.append(summary,clutch);for(const [label,direction] of [['Gear −',-1],['Gear +',1]] as const){const b=button(label,()=>{if(canInput())p.input.shift=direction;});b.setAttribute('aria-label','Player '+(seat+1)+' '+label);drive.append(b);}info.append(drive);
   }
   root.dataset.touch=String(actor.manifest.binding.startsWith('touch:'));
   root.append(look,info,actions,stick,hop,brake,lift);this.overlay.append(root);this.panes.push(p);
  }
  this.layout();
 }
 private layout(){
  if(this.width===innerWidth&&this.height===innerHeight)return;this.width=innerWidth;this.height=innerHeight;
  const rects=coopViewports(innerWidth,innerHeight,this.actors.length,this.layoutChoice);
  for(const seat of this.actors.map((_,i)=>i as Seat)){const r=rects[seat],p=this.panes[seat];p.root.dataset.topRow=String(r.y===0);p.root.style.left=r.x+'px';p.root.style.top=r.y+'px';p.root.style.width=r.width+'px';p.root.style.height=r.height+'px';this.actors[seat].camera.aspect=r.width/r.height;this.actors[seat].camera.updateProjectionMatrix();this.actors[seat].snap=true;}
  this.overlay.dataset.orientation=innerWidth>=innerHeight?'landscape':'portrait';this.overlay.dataset.layout=this.layoutChoice;this.overlay.dataset.players=String(this.actors.length);
 }
 private cameraView(seat:Seat){if(this.paused||!this.actors[seat])return;const actor=this.actors[seat];actor.firstPerson=!actor.firstPerson;actor.yaw=0;actor.pitch=.12;actor.snap=true;}
 private joinPartner(seat:Seat){
  if(!this.simulation||this.paused||performance.now()<this.cooldown[seat])return;
  const target=this.simulation.actors[(seat+1)%this.actors.length].current;
  try{this.simulation.recover(seat,{x:target.x,y:target.y,z:target.z,heading:target.headingY});this.actors[seat].snap=true;this.readers?.[seat].reset();this.panes[seat].input=ZERO();this.cooldown[seat]=performance.now()+2000;this.alert.textContent='Player '+(seat+1)+' moved to clear ground near their partner.';}
  catch{this.alert.textContent='There is no safe open ground near your partner. Move to a wider path and try again.';}
 }
 update(seconds:number,now:number,externalPause=false):RidePose{
  if(!this.active||!this.simulation||!this.readers)throw new Error('Co-op is not active.');
  const gamepads=pads();
  for(const actor of this.actors)if(actor.manifest.binding.startsWith('pad:')){
   const pad=gamepads.find(p=>p?.index===Number(actor.manifest.binding.slice(4)));
   if(!pad?.connected||pad.mapping!=='standard'){if(!this.paused)this.setPaused(true,'Player '+(actor.manifest.seat+1)+' controller disconnected. Reconnect it to resume.');}
  }
  const suspended=this.paused||externalPause||this.dialog.open||this.hooks.blocked();
  const inputs=this.readers.map((reader,i)=>{
   const raw=reader.read(this.keys,gamepads,suspended),touch=this.panes[i].input;
   if(suspended){this.panes[i].input=ZERO();return ZERO();}
   const out={clutch:Math.max(raw.clutch??0,touch.clutch),shift:raw.shift||touch.shift,lift:T.MathUtils.clamp((raw.lift??0)+touch.lift,-1,1),throttle:T.MathUtils.clamp(raw.throttle+touch.throttle,-1,1),steer:T.MathUtils.clamp(raw.steer+touch.steer,-1,1),hop:raw.hop||touch.hop,recover:raw.recover||touch.recover,interact:raw.interact||touch.interact,brake:raw.brake||touch.brake};
   touch.hop=touch.recover=touch.interact=false;touch.shift=0;return out;
  }) as InputFrame[];
  for(let i=0;i<this.panes.length;i++){const flight=this.simulation.hovers[i],summary=this.panes[i].root.querySelector('.coop-drive summary');if(flight&&summary)summary.textContent='Gear '+gearLabel(flight.drive.gear)+(flight.drive.clutch>.8?' · CLUTCH':'');}
  const poses=this.simulation.advance(coopFrameSeconds(seconds,now,this.lastNow,suspended),inputs,suspended);this.overlay.dataset.simulationFrames=String(++this.updateCount);
  this.layout();this.collectDiagnostics=now-this.lastDiagnostics>=250;if(this.collectDiagnostics)this.lastDiagnostics=now;
  for(const seat of this.actors.map((_,i)=>i as Seat)){
   const actor=this.actors[seat],p=poses[seat],peer=poses[(seat+1)%poses.length];actor.apply(suspended?0:seconds);actor.view.root.visible=true;
   const yaw=p.headingY+actor.yaw,eyeHeight=p.footBlend>.5?1.55:1.7;
   this.cameraTarget.set(p.x,p.y+(actor.firstPerson?eyeHeight:1.3),p.z);
   if(actor.firstPerson){this.cameraEye.copy(this.cameraTarget);this.cameraTarget.add(new T.Vector3(Math.sin(yaw)*15,-Math.tan(actor.pitch)*15,Math.cos(yaw)*15));}
   else{
    this.cameraEye.copy(this.cameraTarget).add(new T.Vector3(-Math.sin(yaw)*4.5,1.5+actor.pitch*2,-Math.cos(yaw)*4.5));
    this.cameraEye.y=Math.max(this.cameraEye.y,this.terrain.height(this.cameraEye.x,this.cameraEye.z,p.y)+.6);
    const delta=this.cameraEye.clone().sub(this.cameraTarget),distance=delta.length();delta.normalize();const hit=this.terrain.raycastObstacle(this.cameraTarget,delta,distance,.18);
    if(hit!==null)this.cameraEye.copy(this.cameraTarget).addScaledVector(delta,Math.max(.2,hit-.2));
   }
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.querySelector<HTMLInputElement>('#motion')?.checked;
   actor.camera.position.lerp(this.cameraEye,actor.snap||reduced?1:1-Math.exp(-seconds*12));actor.camera.lookAt(this.cameraTarget);actor.snap=false;
   if(this.collectDiagnostics){const pane=this.panes[seat];pane.root.dataset.rider=actor.manifest.riderId;pane.root.dataset.vehicle=actor.manifest.vehicleId;
   pane.root.dataset.x=p.x.toFixed(3);pane.root.dataset.y=p.y.toFixed(3);pane.root.dataset.z=p.z.toFixed(3);pane.root.dataset.speed=p.speed.toFixed(3);pane.root.dataset.footError=actor.footError().toFixed(5);
   pane.root.dataset.camera=actor.firstPerson?'first':'third';pane.root.dataset.crashBlend=String(p.crashBlend);pane.root.dataset.footBlend=String(p.footBlend);
   pane.status.textContent=Math.round(Math.abs(p.speed)*3.6)+' km/h · '+VEHICLES.find(v=>v.id===actor.manifest.vehicleId)!.label+' · Partner '+Math.round(Math.hypot(p.x-peer.x,p.z-peer.z))+' m'+(this.simulation.hovers[seat]?this.simulation.mounted[seat]?(this.simulation.hovers[seat]!.landed?' · Landed · Takeoff to ride':' · Flying'):' · On foot · Return to bike':'');}
  }
  if(!suspended&&this.lastNow){this.frames.push(now-this.lastNow);if(this.frames.length>300)this.frames.shift();}this.lastNow=suspended?0:now;
  return poses[0];
 }
 render(renderer:T.WebGLRenderer,world:World,clock:number){
  if(!this.active||!this.simulation)return;
  renderer.getScissor(this.savedScissor);renderer.getViewport(this.savedViewport);const scissor=renderer.getScissorTest(),auto=renderer.autoClear,shadows=renderer.shadowMap.enabled;
  let worldMs=0,renderMs=0,matrixMs=0,triangles=0;const censusTime=performance.now();const finishCensus=this.collectDiagnostics&&new URLSearchParams(location.search).has('profile')&&censusTime-this.lastCensus>5000?sampleDrawGroups(this.scene):undefined;if(finishCensus)this.lastCensus=censusTime;
  const oldVisible=this.actors.map(a=>a.view.rider.visible),rects=coopViewports(innerWidth,innerHeight,this.actors.length,this.layoutChoice);
  try{
   // Three or four views use the terrain-aligned contact shadows on each rider.
   // Avoid repeated directional shadow-map passes for three or four views.
   if(this.actors.length>=3)renderer.shadowMap.enabled=false;
   world.splitDetail?.(this.actors.length>=3);
   renderer.setScissorTest(true);renderer.autoClear=true;
   for(const seat of this.actors.map((_,i)=>i as Seat)){
    const actor=this.actors[seat],p=this.simulation.actors[seat].renderPose,r=glViewport(rects[seat],innerHeight);
    for(const a of this.actors)a.view.rider.visible=a!==actor||!actor.firstPerson;
    renderer.setViewport(r.x,r.y,r.width,r.height);renderer.setScissor(r.x,r.y,r.width,r.height);
    // Per-view culling/light choices happen immediately before each view is drawn.
    // Simulation and time are owned by the one outer loop; never advance them here.
    const worldStart=performance.now();world.update(clock,p.x,p.z,actor.camera,!this.paused&&!this.hooks.blocked());worldMs+=performance.now()-worldStart;
    if(this.actors.length>=3)world.beginSplitView?.();
    const renderStart=performance.now();const matrixStart=renderStart;this.scene.updateMatrixWorld();matrixMs+=performance.now()-matrixStart;const matrixAuto=this.scene.matrixWorldAutoUpdate;this.scene.matrixWorldAutoUpdate=false;try{renderer.render(this.scene,actor.camera);}finally{this.scene.matrixWorldAutoUpdate=matrixAuto;world.endSplitView?.();}renderMs+=performance.now()-renderStart;this.draws[seat]=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
   }
  }finally{world.endSplitView?.();world.splitDetail?.(false);if(finishCensus)this.overlay.dataset.drawGroups=JSON.stringify(finishCensus());this.actors.forEach((a,i)=>a.view.rider.visible=oldVisible[i]);renderer.autoClear=auto;renderer.shadowMap.enabled=shadows;renderer.setScissorTest(scissor);renderer.setScissor(this.savedScissor);renderer.setViewport(this.savedViewport);}
  if(this.collectDiagnostics&&this.frames.length){const sorted=this.frames.slice().sort((a,b)=>a-b);this.overlay.dataset.medianFrameMs=sorted[Math.floor(sorted.length*.5)].toFixed(2);this.overlay.dataset.p95FrameMs=sorted[Math.floor(sorted.length*.95)].toFixed(2);}
  if(this.collectDiagnostics){this.overlay.dataset.triangles=String(triangles);this.overlay.dataset.worldMs=worldMs.toFixed(2);this.overlay.dataset.renderMs=renderMs.toFixed(2);this.overlay.dataset.matrixMs=matrixMs.toFixed(2);this.overlay.dataset.shadows=this.actors.length>=3?'contact':'mapped';}
  this.overlay.dataset.drawCalls=String(this.draws.reduce((a,b)=>a+b,0));this.overlay.dataset.renderedViews=String(this.actors.length);
 }
 private releaseActors(){for(const actor of this.actors)actor.dispose();this.actors=[];this.assets?.dispose();this.assets=undefined;this.simulation=undefined;this.readers=undefined;}
 stop(){
  this.generation++;this.pendingAbort?.abort(new DOMException('Session ended','AbortError'));
  const hadSession=this.active;this.active=false;this.paused=false;this.clear();this.dialog.close();this.releaseActors();for(const pane of this.panes)pane.root.remove();this.panes=[];
  this.overlay.hidden=true;this.overlay.dataset.state='idle';document.body.classList.remove('coop-playing');if(hadSession)this.hooks.leave();this.refreshAvailability();
 }
 dispose(){if(this.disposed)return;this.stop();this.disposed=true;window.removeEventListener('keydown',this.keyDown,true);window.removeEventListener('keyup',this.keyUp,true);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('gamepaddisconnected',this.padLost);window.removeEventListener('gamepadconnected',this.padLost);this.openButton.remove();this.welcomeButton.remove();this.dialog.remove();this.overlay.remove();}
}
