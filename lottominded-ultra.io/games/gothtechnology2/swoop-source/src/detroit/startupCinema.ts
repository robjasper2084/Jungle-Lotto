import './startupCinema.css';
import {cinemaPlaybackPolicy} from './startupCinemaPolicy.ts';
import {GOTHTECH_CINEMATICS} from './mediaSources.ts';

/** Welcome films belong to the destinations; the startup menu keeps its original artwork. */
export class StartupCinema{
 readonly panel=document.createElement('dialog');
 private feature=document.createElement('video');private status=document.createElement('p');
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private entered=new Set<string>();private entryEnd?:()=>void;
 constructor(){
  this.panel.className='startupCinemaPlayer';
  const heading=document.createElement('h2');heading.id='startupCinemaTitle';heading.textContent='GOTHTECHNOLOGY';this.panel.setAttribute('aria-labelledby',heading.id);
  const close=document.createElement('button');close.type='button';close.className='cinemaClose';close.textContent='Enter store';close.onclick=()=>this.close();
  const top=document.createElement('div');top.className='cinemaPlayerTop';top.append(heading,close);
  this.feature.controls=true;this.feature.muted=true;this.feature.defaultMuted=true;this.feature.playsInline=true;this.feature.preload='none';this.feature.setAttribute('aria-label','GothTechnology welcome film');
  this.status.setAttribute('role','status');
  const replay=document.createElement('button');replay.type='button';replay.textContent='Replay film';replay.onclick=()=>{this.feature.currentTime=0;void this.feature.play().catch(()=>{this.status.textContent='Use the video play control.';});};
  const skip=document.createElement('button');skip.type='button';skip.className='cinemaRide';skip.textContent='Skip / enter →';skip.onclick=()=>this.close();
  const actions=document.createElement('div');actions.className='cinemaPlayerActions';actions.append(this.status,replay,skip);this.panel.append(top,this.feature,actions);document.body.append(this.panel);
  this.feature.addEventListener('ended',()=>this.close());this.feature.addEventListener('error',()=>this.close());
  this.panel.addEventListener('cancel',e=>{e.preventDefault();this.close();});
  this.panel.addEventListener('close',()=>{this.feature.pause();const done=this.entryEnd;this.entryEnd=undefined;done?.();});
  window.addEventListener('keydown',e=>{if(!this.panel.open)return;if(e.code==='Escape'){e.preventDefault();this.close();}e.stopPropagation();},true);
  document.addEventListener('visibilitychange',()=>this.sync());this.reduced.addEventListener('change',()=>this.sync());
  new MutationObserver(()=>this.sync()).observe(document.documentElement,{attributes:true,attributeFilter:['data-reduced-motion']});
 }
 private motionReduced(){return this.reduced.matches||document.documentElement.dataset.reducedMotion==='true';}
 private sync(){if(cinemaPlaybackPolicy({featureOpen:this.panel.open,hidden:document.hidden,reduced:this.motionReduced()})!=='feature')this.feature.pause();}
 private close(){this.feature.pause();if(this.panel.open)this.panel.close();}
 /** First entrance per destination in this session. Skippable and silent; caller holds only its local rider. */
 enter(area:'studio'|'store',hold:()=>void,resume:()=>void){
  if(this.entered.has(area)||this.panel.open)return false;this.entered.add(area);
  if(this.motionReduced())return false;
  this.entryEnd=resume;hold();this.feature.src=area==='store'?GOTHTECH_CINEMATICS[1].url:'/exports/polish/gothtech-arrival-15.mp4';this.feature.currentTime=0;
  this.panel.querySelector('.cinemaClose')!.textContent='Enter '+(area==='studio'?'GothTech studio':'store');
  this.status.textContent='WELCOME / '+(area==='studio'?'GOTHTECH STUDIO':'GOTHTECH STORE')+' · 15 seconds';this.panel.showModal();void this.feature.play().catch(()=>{this.status.textContent='Play the welcome film or select Skip / enter.';});return true;
 }
 /** Starting a ride never plays or captures a startup video. */
 arrive(){if(this.panel.open)this.close();}
}
