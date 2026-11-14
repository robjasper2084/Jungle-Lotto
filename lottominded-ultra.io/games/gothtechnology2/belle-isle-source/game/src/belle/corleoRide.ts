/** Optional, lazy-loaded CORLEO ride. Never enters the startup asset waterfall.
 * The GLBs come from Animation_Library.zip and must be explicitly staged before release.
 * World-space CR_Root horizontal travel is removed: Belle Isle owns world movement.
 */
import * as T from 'three';
import './corleo.css';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CorleoMotion,type CorleoStyle} from './corleoMotion.ts';
import {inPlaceCorleoClip,disposeCorleoModel} from './corleoAnimation.ts';
import type {ParkTerrain} from './terrain.ts';

export const CORLEO_ACTIONS=['MOUNT','RUN','CRAWL','JUMP','DISMOUNT'] as const;
export type CorleoAction=typeof CORLEO_ACTIONS[number];
export const corleoAssetPath=(style:CorleoStyle,action:CorleoAction)=>
 './belle/vehicles/corleo/CORLEO_'+style+'_'+action+'.glb';

type Hooks={
 pose:()=>{x:number;y:number;z:number;headingY:number};
 blocked:()=>boolean;
 entered:()=>void;
 exited:(pose:{x:number;y:number;z:number;headingY:number})=>void;
};
type ClipCache=Map<CorleoAction,Promise<T.AnimationClip>>;

export class CorleoRide {
 riding=false;
 readonly motion:CorleoMotion;
 private root?:T.Group;
 private mixer?:T.AnimationMixer;
 private clips:ClipCache=new Map();
 private actions=new Map<CorleoAction,T.AnimationAction>();
 private loader=new GLTFLoader();
 private style:CorleoStyle='Professional';
 private mode:'off'|'mounting'|'riding'|'dismounting'='off';
 private activeAction:CorleoAction|null=null;
 private loading=false;
 private generation=0;
 private pressed=new Set<string>();
 private variant:HTMLSelectElement;
 private button:HTMLButtonElement;
 private notice:HTMLElement;
 private hud:HTMLElement;
 private pendingAction:CorleoAction|null=null;
 private enabled=false;
 constructor(private scene:T.Scene,private terrain:ParkTerrain,private hooks:Hooks){
  const p=hooks.pose();this.motion=new CorleoMotion({x:p.x,y:p.y,z:p.z,heading:p.headingY});
  this.button=document.createElement('button');this.button.id='corleo-enter';this.button.textContent='Ride CORLEO · Y';
  this.button.type='button';document.querySelector('header nav')?.append(this.button);
  this.button.onclick=()=>{document.querySelector<HTMLDialogElement>('#ride-menu')?.close();if(this.riding)this.exit();else void this.enter();};
  this.variant=document.createElement('select');this.variant.id='corleo-suit';this.variant.setAttribute('aria-label','CORLEO rider suit');
  for(const s of ['Professional','Maverick'] as const){const o=document.createElement('option');o.value=s;o.textContent=s;this.variant.append(o);}
  this.button.before(this.variant);
  this.variant.onchange=()=>{if(this.riding||this.loading)return;this.style=this.variant.value==='Maverick'?'Maverick':'Professional';this.resetAssets();};
  this.hud=document.createElement('section');this.hud.id='corleo-hud';this.hud.hidden=true;
  this.hud.setAttribute('aria-label','CORLEO ground mobility controls');
  this.hud.style.cssText='position:fixed;bottom:1rem;right:1rem;z-index:35;max-width:min(90vw,350px);touch-action:none;padding:12px;color:#f6f5e9;background:#101b21e8;border:1px solid #698b87;border-radius:12px;font:14px system-ui';
  this.hud.innerHTML='<strong>CORLEO</strong><p id="corleo-status" role="status">Ready</p><small>W/S move · A/D turn · Shift run · C lower/crawl · Space jump · Y dismount</small><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button type="button" data-hold="ArrowLeft" aria-label="Turn left">←</button><button type="button" data-hold="ArrowUp" aria-label="Move forward">↑</button><button type="button" data-hold="ArrowDown" aria-label="Reverse">↓</button><button type="button" data-hold="ArrowRight" aria-label="Turn right">→</button><button type="button" data-hold="ShiftLeft">RUN</button><button type="button" data-corleo="crawl">LOWER / CRAWL</button><button type="button" data-corleo="jump">JUMP</button><button type="button" data-corleo="exit">DISMOUNT</button></div>';
  document.body.append(this.hud);this.notice=this.hud.querySelector('#corleo-status')!;
  this.hud.querySelectorAll<HTMLButtonElement>('[data-corleo]').forEach(b=>b.onclick=()=>{
   if(!this.enabled||this.mode!=='riding')return;
   const kind=b.dataset.corleo;
   if(kind==='exit')this.exit();
   if(kind==='crawl'){this.crawl=!this.crawl;this.status(this.crawl?'Crawl enabled':'Crawl disabled');}
   if(kind==='jump')this.jumpQueued=true;
  });
  this.hud.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(button=>{
   const code=button.dataset.hold!;
   button.onpointerdown=e=>{if(!this.enabled||this.mode!=='riding')return;e.preventDefault();button.setPointerCapture(e.pointerId);this.pressed.add(code);};
   const release=()=>this.pressed.delete(code);
   button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
   button.onkeydown=e=>{if(['Space','Enter'].includes(e.code)&&this.enabled){e.preventDefault();this.pressed.add(code);}};
   button.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release();}};button.onblur=release;
  });
 }
 private crawl=false;
 private jumpQueued=false;
 private status(message:string){this.notice.textContent=message;}
 get pose(){return this.motion.pose;}
 private async file(action:CorleoAction){
  const path=corleoAssetPath(this.style,action);
  const gltf=await this.loader.loadAsync(path);
  const clip=gltf.animations.find(c=>c.name==='CORLEO_'+this.style+'_'+action);
  if(!clip)throw Error('CORLEO animation missing in '+path);
  return{gltf,clip};
 }
 private async clip(action:CorleoAction){
  let stored=this.clips.get(action);
  if(!stored){
   stored=this.file(action).then(({gltf,clip})=>{const converted=inPlaceCorleoClip(clip,action==='JUMP');disposeCorleoModel(gltf.scene);return converted;});
   this.clips.set(action,stored);
   stored.catch(()=>{if(this.clips.get(action)===stored)this.clips.delete(action);});
  }
  return stored;
 }
 private async makeAction(action:CorleoAction){
  if(!this.mixer)throw Error('CORLEO model not loaded');
  let playing=this.actions.get(action);
  if(!playing){const mixer=this.mixer;const clip=await this.clip(action);if(this.mixer!==mixer)throw Error('CORLEO load cancelled');playing=mixer.clipAction(clip);this.actions.set(action,playing);}
  return playing;
 }
 private async play(action:CorleoAction,loop=false){
  if(this.pendingAction===action)return;
  const generation=this.generation;this.pendingAction=action;
  let next:T.AnimationAction;
  try{next=await this.makeAction(action);}finally{if(generation===this.generation)this.pendingAction=null;}
  if(generation!==this.generation||this.mode==='off')return;
  next.reset().setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);
  next.clampWhenFinished=!loop;next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(action==='JUMP'?next.getClip().duration/(2*3.2/9.81):1);
  const old=this.activeAction?this.actions.get(this.activeAction):undefined;
  if(old&&old!==next){next.play();next.crossFadeFrom(old,.14,true);}
  else next.play();
  this.activeAction=action;
 }
 private resetAssets(){
  if(this.mode!=='off')return;
  this.generation++;this.clips.clear();this.actions.clear();this.mixer?.stopAllAction();
  if(this.root){this.scene.remove(this.root);disposeCorleoModel(this.root);this.root=undefined;}
  this.mixer=undefined;this.activeAction=null;
 }
 async enter(){
  if(this.riding||this.loading||this.hooks.blocked())return;
  this.loading=true;this.variant.disabled=true;this.button.disabled=true;this.button.textContent='Preparing CORLEO…';
  const generation=++this.generation;
  try{
   const [{gltf,clip}]=await Promise.all([this.file('RUN'),...(['MOUNT','CRAWL','JUMP','DISMOUNT'] as const).map(action=>this.clip(action))]);
   if(generation!==this.generation||this.hooks.blocked()){disposeCorleoModel(gltf.scene);return;}
   const p=this.hooks.pose();
   this.motion.reset({x:p.x,y:this.terrain.height(p.x,p.z),z:p.z,heading:p.headingY});
   this.root=new T.Group();gltf.scene.rotation.y=Math.PI;this.root.add(gltf.scene);this.root.name='Playable CORLEO '+this.style;
   // Strip movement from all cycle tracks before passing clips to the mixer.
   this.mixer=new T.AnimationMixer(this.root);
   const run=inPlaceCorleoClip(clip);
   this.actions.set('RUN',this.mixer.clipAction(run));
   this.root.position.set(p.x,this.terrain.height(p.x,p.z),p.z);
   this.root.rotation.y=p.headingY;
   this.root.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=false;object.receiveShadow=true;}if(object instanceof T.Light)object.visible=false;});
   this.scene.add(this.root);
   this.riding=true;document.body.classList.add('corleo-riding');this.mode='mounting';this.hud.hidden=false;this.hooks.entered();
   this.status('Mounting — movement enabled after the sequence');
   await this.play('MOUNT');
  }catch(err){
   this.status('Unable to load CORLEO. Please try again.');
   console.warn('CORLEO load failed',err);
   this.leaveForTravel();
  }finally{
   this.loading=false;this.button.disabled=false;this.variant.disabled=this.riding;this.button.textContent=this.riding?'Dismount CORLEO · Y':'Ride CORLEO · Y';
  }
 }
 key(e:KeyboardEvent){
  if(!this.riding){if(e.code==='KeyY'&&!e.repeat&&!this.hooks.blocked()){e.preventDefault();void this.enter();return true;}return false;}
  if(!this.enabled)return false;
  const controlled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','KeyC','Space','KeyY'];
  if(!controlled.includes(e.code))return false;
  if(e.repeat&&['KeyC','KeyY','Space'].includes(e.code)){e.preventDefault();return true;}
  e.preventDefault();this.pressed.add(e.code);
  if(e.code==='KeyC'&&!e.repeat)this.crawl=!this.crawl;
  if(e.code==='Space'&&!e.repeat)this.jumpQueued=true;
  if(e.code==='KeyY'&&!e.repeat)this.exit();
  return true;
 }
 keyUp(code:string){this.pressed.delete(code);}
 clear(){this.pressed.clear();this.jumpQueued=false;}
 update(dt:number,enabled:boolean){
  this.enabled=enabled;
  if(!this.riding||!this.root||!this.mixer)return;
  if(!enabled){this.clear();return;}
  const delta=Math.min(.05,Math.max(0,dt));
  const cycle=this.activeAction?this.actions.get(this.activeAction):undefined;
  if(this.mode==='riding'&&cycle&&this.activeAction!=='JUMP')cycle.setEffectiveTimeScale(Math.min(2.5,Math.abs(this.pose.speed)/(this.activeAction==='CRAWL'?.22:1.7835)));
  this.mixer.update(delta);
  if(this.mode==='mounting'||this.mode==='dismounting'){
   const old=this.activeAction?this.actions.get(this.activeAction):undefined;
   if(old&&old.time>=old.getClip().duration-.025){
    if(this.mode==='dismounting'){this.finishExit();return;}
    this.mode='riding';void this.play('RUN',true).catch(e=>this.status(String(e)));
   }
  }
  if(this.mode==='riding'){
   const throttle=enabled?(Number(this.pressed.has('KeyW')||this.pressed.has('ArrowUp'))-Number(this.pressed.has('KeyS')||this.pressed.has('ArrowDown'))):0;
   const steer=enabled?(Number(this.pressed.has('KeyD')||this.pressed.has('ArrowRight'))-Number(this.pressed.has('KeyA')||this.pressed.has('ArrowLeft'))):0;
   const run=this.pressed.has('ShiftLeft')||this.pressed.has('ShiftRight');
   const p=this.motion.tick(delta,{throttle,steer,run,crawl:this.crawl,jump:this.jumpQueued,lower:this.crawl},
    (x,z)=>this.terrain.height(x,z),
    (x,z)=>!this.terrain.land(x,z)||this.terrain.obstructed(x,z,1.5));
   this.jumpQueued=false;
   const action:CorleoAction=p.gait==='jump'?'JUMP':this.crawl?'CRAWL':'RUN';
   if(action!==this.activeAction&&action!==this.pendingAction)void this.play(action,action!=='JUMP').catch(e=>this.status('Animation unavailable: '+String(e)));
   this.status(p.gait.toUpperCase()+' · '+(p.speed*2.236936).toFixed(1)+' MPH');
  }
  const p=this.motion.pose;this.root.position.set(p.x,p.y,p.z);this.root.rotation.y=p.heading;
 }
 camera(camera:T.PerspectiveCamera,first:boolean,yaw:number,pitch:number,dt:number,snap=false){
  const p=this.motion.pose,eye=p.y+(this.crawl?1.5:2.8),heading=p.heading+yaw;
  const look=first?new T.Vector3(p.x+Math.sin(heading)*5,eye-Math.tan(pitch)*5,p.z+Math.cos(heading)*5):new T.Vector3(p.x,p.y+(this.crawl?.8:1.5),p.z);
  const pilot=this.root?.getObjectByName('CR_'+this.style+'_Pilot_Root');if(pilot)pilot.visible=!first;
  const desired=first?new T.Vector3(p.x,eye,p.z):new T.Vector3(p.x-Math.sin(heading)*6.5,eye+1.3+pitch,p.z-Math.cos(heading)*6.5);
  desired.y=Math.max(desired.y,this.terrain.height(desired.x,desired.z)+.5);
  camera.position.lerp(desired,snap?1:Math.min(1,Math.max(0,dt)*10));camera.lookAt(look);
 }
 exit(){
  if(this.mode!=='riding'||!this.enabled)return;
  this.clear();this.mode='dismounting';this.status('Dismounting…');
  void this.play('DISMOUNT').catch(()=>this.finishExit());
 }
 private finishExit(){
  const p=this.pose;
  this.leaveForTravel();
  this.hooks.exited({x:p.x,y:p.y,z:p.z,headingY:p.heading});
 }
 leaveForTravel(){
  this.generation++;document.body.classList.remove('corleo-riding');this.mode='off';this.riding=false;this.crawl=false;this.pendingAction=null;this.clear();this.hud.hidden=true;this.variant.disabled=false;
  if(this.root){this.scene.remove(this.root);disposeCorleoModel(this.root);this.root=undefined;}
  this.mixer?.stopAllAction();this.mixer=undefined;this.actions.clear();this.clips.clear();this.activeAction=null;
  this.button.disabled=false;this.button.textContent='Ride CORLEO · Y';
 }
}
