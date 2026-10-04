import './startupCinema.css';
import {bindFilmSound} from './filmAudio.ts';
import {cinemaPlaybackPolicy} from './startupCinemaPolicy.ts';
import {GOTHTECH_CINEMATICS} from './mediaSources.ts';
import {ENTRANCE_FILMS,type StoreEntrance} from './entranceFilms.ts';

/** Welcome films belong to the destinations; the startup menu keeps its original artwork. */
export class StartupCinema{
 readonly panel=document.createElement('dialog');
 private feature=document.createElement('video');private status=document.createElement('p');
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private entered=new Set<string>();private entryEnd?:()=>void;private watchdog?:ReturnType<typeof setTimeout>;
 constructor(){
  this.panel.className='startupCinemaPlayer';
  const heading=document.createElement('h2');heading.id='startupCinemaTitle';heading.textContent='GOTHTECHNOLOGY';this.panel.setAttribute('aria-labelledby',heading.id);
  const close=document.createElement('button');close.type='button';close.className='cinemaClose';close.textContent='Enter store';close.onclick=()=>this.close();
  const top=document.createElement('div');top.className='cinemaPlayerTop';top.append(heading,close);
  this.feature.controls=true;this.feature.muted=true;this.feature.defaultMuted=true;this.feature.playsInline=true;this.feature.preload='none';this.feature.setAttribute('aria-label','GothTechnology welcome film');
  this.status.setAttribute('role','status');
  const replay=document.createElement('button');replay.type='button';replay.textContent='Replay film';replay.onclick=()=>{this.feature.currentTime=0;void this.feature.play().catch(()=>{this.status.textContent='Use the video play control.';});};
  const skip=document.createElement('button');skip.type='button';skip.className='cinemaRide';skip.textContent='Skip / enter →';skip.onclick=()=>this.close();
  const sound=document.createElement('button');sound.type='button';sound.className='cinemaSound';bindFilmSound(this.feature,sound);
  const actions=document.createElement('div');actions.className='cinemaPlayerActions';actions.append(this.status,sound,replay,skip);this.panel.append(top,this.feature,actions);document.body.append(this.panel);
  this.feature.addEventListener('playing',()=>{if(this.watchdog)clearTimeout(this.watchdog);});this.feature.addEventListener('ended',()=>this.close());this.feature.addEventListener('error',()=>this.close());
  this.panel.addEventListener('cancel',e=>{e.preventDefault();this.close();});
  this.panel.addEventListener('close',()=>{this.feature.pause();if(this.watchdog)clearTimeout(this.watchdog);this.feature.removeAttribute('src');this.feature.load();const done=this.entryEnd;this.entryEnd=undefined;done?.();});
  window.addEventListener('keydown',e=>{if(!this.panel.open)return;if(e.code==='Escape'){e.preventDefault();this.close();}e.stopPropagation();},true);
  document.addEventListener('visibilitychange',()=>this.sync());this.reduced.addEventListener('change',()=>this.sync());
  new MutationObserver(()=>this.sync()).observe(document.documentElement,{attributes:true,attributeFilter:['data-reduced-motion']});
 }
 private motionReduced(){return this.reduced.matches||document.documentElement.dataset.reducedMotion==='true';}
 private sync(){if(cinemaPlaybackPolicy({featureOpen:this.panel.open,hidden:document.hidden,reduced:this.motionReduced()})!=='feature')this.feature.pause();}
 private close(){this.feature.pause();if(this.panel.open)this.panel.close();}
 /** First entrance per destination in this session; the opening can be replayed. Caller holds its local rider. */
 enter(area:'studio'|'store'|'intro'|StoreEntrance,hold:()=>void,resume:()=>void){
  if(area!=='intro'&&this.entered.has(area)||this.panel.open)return false;if(area!=='intro')this.entered.add(area);
  if(this.motionReduced())return false;
  const film=area==='intro'?{title:'Swoop Detroit',url:'./art/loading-trailer.mp4',poster:'./art/loading-trailer-poster.webp',seconds:20}:area in ENTRANCE_FILMS?ENTRANCE_FILMS[area as StoreEntrance]:undefined;
  const title=film?.title??(area==='studio'?'GothTech Studio':'GothTech Store');
  this.entryEnd=resume;hold();this.feature.src=film?.url??(area==='store'?GOTHTECH_CINEMATICS[1].url:'/exports/polish/gothtech-arrival-15.mp4');this.feature.poster=film?.poster??'';this.feature.currentTime=0;
  this.panel.querySelector<HTMLButtonElement>('.cinemaSound')!.hidden=area!=='intro';this.panel.querySelector('h2')!.textContent=title;this.feature.setAttribute('aria-label',title+' entrance film');
  this.panel.querySelector('.cinemaClose')!.textContent=area==='intro'?'Back to menu':'Skip · enter '+title;this.panel.querySelector('.cinemaRide')!.textContent=area==='intro'?'Back to menu →':'Skip / enter →';
  this.status.textContent='WELCOME / '+title.toUpperCase()+' · '+(film?.seconds??15)+' seconds';
  try{this.panel.showModal();}catch{const done=this.entryEnd;this.entryEnd=undefined;done?.();return true;}
  // A missing/slow film must never lock a player out of the store.
  this.watchdog=setTimeout(()=>this.close(),30_000);void this.feature.play().catch(()=>{this.status.textContent='Play the entrance film or select Skip / enter.';});return true;
 }
 /** Starting a ride never plays or captures a startup video. */
 get active(){return this.panel.open;}
 arrive(){if(this.panel.open)this.close();}
}
