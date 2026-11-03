import './startup.css';
import {sampleFlyover,FLYOVER_SHOT_SECONDS} from './flyover.ts';

export function createStartup(){
 const screen=document.getElementById('welcome')!;
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
  if(e.code==='Escape'&&!panel.hidden){closeControls();return;}
  if(!ready||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  const target=e.target as HTMLElement|null;
  if(e.code==='Enter'&&(!target||target===document.body||target.id==='game')){e.preventDefault();start.click();}
 });
 updateStages();setMotion(motionOff);
 return {
  status(message:string){
   loading.textContent=message;
   const nextStage=/first frame|shaders/i.test(message)?5:/rider/i.test(message)?4:/trees|rocks|flowers|gardens/i.test(message)?3:/landmark/i.test(message)?2:/sky|road|skyline/i.test(message)?1:0;
   stage=Math.max(stage,nextStage);updateStages();
  },
  ready(destinations:number){
   ready=true;stage=5;screen.dataset.state='ready';loading.textContent=destinations+' places. One island. All yours.';
   label.textContent='Start exploring';hint.innerHTML='<kbd>ENTER</kbd> to begin · touch and keyboard ready';
   start.disabled=false;next.disabled=false;updateStages();
  },
  camera(dt:number){
   if(!motionOff&&!leaving&&ready)seconds+=dt;
   const shot=sampleFlyover(seconds);
   screen.style.setProperty('--shot-shutter',String(motionOff?0:shot.shutter));
   screen.style.setProperty('--shot-progress',String(shot.progress));
   if(lastScene!==shot.index){lastScene=shot.index;document.getElementById('startup-scene')!.textContent=shot.name;views.forEach((v,i)=>v.classList.toggle('is-current',i===shot.index));}
   return shot;
  },
  leave(onComplete:()=>void){
   if(!ready||leaving)return;leaving=true;screen.dataset.state='leaving';start.disabled=true;next.disabled=true;clearTimeout(leaveTimer);
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
