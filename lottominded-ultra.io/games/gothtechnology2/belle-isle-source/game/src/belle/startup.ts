import './startup.css';
import type {Object3D} from 'three';
import {createRidePreview} from './ridePreview.ts';
import {createRideSetup} from './rideSetup.ts';
import {sampleFlyover,FLYOVER_SHOT_SECONDS,FLYOVER_SHOTS} from './flyover.ts';

export function createStartup(){
 const screen=document.getElementById('welcome')!;
 const setup=createRideSetup(screen);
 const picker=document.createElement('details');picker.className='cinema-ride-picker';picker.innerHTML='<summary>Choose your ride &amp; view</summary>';
 const rideSetup=screen.querySelector('.ride-setup')!;rideSetup.before(picker);picker.append(rideSetup);
 const done=document.createElement('button');done.type='button';done.className='ride-picker-done';done.textContent='Use this ride';rideSetup.append(done);done.onclick=()=>{picker.open=false;picker.querySelector('summary')?.focus();};
 let preview:ReturnType<typeof createRidePreview>|undefined,sources:{wheel:Object3D,bike:()=>Promise<Object3D>}|undefined;
 const refreshPreview=()=>{if(picker.open&&sources&&!preview){try{preview=createRidePreview(rideSetup as HTMLElement,sources.wheel,sources.bike);}catch{rideSetup.classList.add('preview-unavailable');}}preview?.setActive(picker.open);};
 picker.addEventListener('toggle',refreshPreview);
 const indicators=screen.querySelector('.cinema-views')!;indicators.innerHTML=FLYOVER_SHOTS.map((_,i)=>'<i'+(i===0?' class="is-current"':'')+'></i>').join('');
 const friends=document.getElementById('welcome-friends') as HTMLButtonElement;let friendsDisabled=true;
 const start=document.getElementById('start') as HTMLButtonElement;
 const label=document.getElementById('start-label')!;
 const loading=document.getElementById('loading')!;
 const count=document.getElementById('startup-count')!;
 const hint=document.getElementById('start-hint')!;
 const motion=document.getElementById('startup-motion') as HTMLButtonElement;
 const next=document.getElementById('startup-next') as HTMLButtonElement;
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 let motionOff=media.matches,stage=0,ready=false,leaving=false,seconds=1,lastScene=-1;
 let leaveTimer:ReturnType<typeof setTimeout>|undefined;
 const items=Array.from(screen.querySelectorAll<HTMLElement>('[data-stage]'));
 const views=Array.from(screen.querySelectorAll<HTMLElement>('.cinema-views i'));
 const updateStages=()=>{
  for(const [i,item]of items.entries()){
   item.classList.toggle('is-complete',i<stage||ready);
   item.classList.toggle('is-current',i===stage&&!ready);
   if(i===stage&&!ready)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
  }
  count.textContent=ready?'READY':String(stage+1).padStart(2,'0')+' / 06';
 };
 const setMotion=(value:boolean)=>{
  motionOff=value;screen.classList.toggle('motion-off',value);
  motion.setAttribute('aria-pressed',String(value));
  motion.innerHTML=value?'Resume flyover <span aria-hidden="true">▷</span>':'Pause flyover <span aria-hidden="true">Ⅱ</span>';
 };
 motion.onclick=()=>setMotion(!motionOff);
 media.addEventListener('change',e=>setMotion(e.matches));
 next.onclick=()=>{seconds=(Math.floor(seconds/FLYOVER_SHOT_SECONDS)+1)*FLYOVER_SHOT_SECONDS+(motionOff?1:0);};
 const controls=document.getElementById('startup-controls') as HTMLButtonElement;
 const panel=document.getElementById('startup-controls-panel')!;
 const closeControls=()=>{panel.hidden=true;controls.setAttribute('aria-expanded','false');controls.focus();};
 controls.onclick=()=>{panel.hidden=!panel.hidden;controls.setAttribute('aria-expanded',String(!panel.hidden));};
 document.getElementById('startup-controls-close')!.onclick=closeControls;
 document.addEventListener('keydown',e=>{
  if(screen.hidden||leaving)return;
  if(e.code==='Escape'&&picker.open){picker.open=false;picker.querySelector('summary')?.focus();return;}
  if(e.code==='Escape'&&!panel.hidden){closeControls();return;}
  if(!ready||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  const target=e.target as HTMLElement|null;
  if(e.code==='Enter'&&(!target||target===document.body||target.id==='game')){e.preventDefault();start.click();}
 });
 updateStages();setMotion(motionOff);
 return {
  get choice(){return setup.choice;},
  bindVehicles(wheel:Object3D,bike:()=>Promise<Object3D>){sources={wheel,bike};refreshPreview();},
  setCamera:setup.setCamera,
  preparing(){friendsDisabled=friends.disabled;friends.disabled=true;setup.disable(true);start.disabled=true;label.textContent='Preparing '+setup.name.toLowerCase()+'…';loading.textContent='Getting your selected ride ready.';},
  retryRide(message:string){friends.disabled=friendsDisabled;setup.disable(false);start.disabled=false;label.textContent='Try starting again';loading.textContent=message;},
  status(message:string){
   loading.textContent=message;
   const nextStage=/first frame|shaders/i.test(message)?5:/rider/i.test(message)?4:/trees|rocks|flowers|gardens/i.test(message)?3:/landmark/i.test(message)?2:/sky|road|skyline/i.test(message)?1:0;
   stage=Math.max(stage,nextStage);updateStages();
  },
  ready(destinations:number){
   ready=true;stage=5;screen.dataset.state='ready';loading.textContent='Island ready · '+destinations+' places to explore';
   label.textContent='Start exploring';hint.innerHTML='<kbd>ENTER</kbd> to begin · <kbd>V</kbd> switches FPP / TPP';
   start.disabled=false;next.disabled=false;updateStages();
  },
  camera(dt:number,aspect=16/9){
   if(!motionOff&&!leaving&&ready)seconds+=dt;
   const shot=sampleFlyover(seconds,aspect);
   screen.style.setProperty('--shot-shutter',String(motionOff?0:shot.shutter));
   screen.style.setProperty('--shot-progress',String(shot.progress));
   if(lastScene!==shot.index){lastScene=shot.index;document.getElementById('startup-scene')!.textContent=shot.name;views.forEach((v,i)=>v.classList.toggle('is-current',i===shot.index));}
   return shot;
  },
  leave(onComplete:()=>void){
   if(!ready||leaving)return;leaving=true;preview?.dispose();preview=undefined;sources=undefined;picker.open=false;setup.disable(true);screen.dataset.state='leaving';start.disabled=true;next.disabled=true;clearTimeout(leaveTimer);
   const finish=()=>{screen.hidden=true;document.body.classList.remove('at-start');if(!motionOff)document.body.classList.add('entering-ride');onComplete();setTimeout(()=>document.body.classList.remove('entering-ride'),1000);};
   if(motionOff)finish();else leaveTimer=setTimeout(finish,600);
  },
  error(message:string){
   screen.dataset.state='error';loading.textContent='Island could not load. '+message;
   label.textContent='Try again';hint.textContent='Reload the island and try once more.';start.disabled=false;
   start.onclick=()=>location.reload();
  }
 };
}
