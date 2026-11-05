import type * as T from 'three';
import {jazzCoordinates,type JazzSite} from './jazzSites.ts';
import {toMap} from './geo-profile.ts';

/** A club door enters the playable Bloom world; the Detroit session stays parked. */
export class JazzVisit {
 readonly panel=document.createElement('section');
 private title=document.createElement('strong');
 private enter=document.createElement('button');
 private status=document.createElement('p');
 private portal=document.createElement('dialog');
 private leave=document.createElement('button');
 private frame?:HTMLIFrameElement;
 private selected?:JazzSite;
 private entered?:string;
 private oldPaused=false;
 active=false;
 constructor(private clubs:readonly {site:JazzSite;root:T.Object3D}[],private suspend:()=>boolean,private resume:(paused:boolean)=>void,private entryMode:()=> 'walk'|'ride',private coordinates={toMap}) {
  this.panel.className='jazz-visit';this.panel.hidden=true;this.panel.setAttribute('aria-label','Jazz club entrance');
  this.enter.textContent='Enter the music world';this.status.textContent='Walk or ride through the garden, waterfront and live band.';
  this.panel.append(this.title,this.status,this.enter);document.body.append(this.panel);
  this.portal.className='jazz-world';this.portal.setAttribute('aria-label','Bloom Through Gloom · playable music world');
  this.leave.textContent='← Return to Detroit';this.leave.className='jazz-return';this.leave.onclick=()=>this.stop('return');
  this.portal.append(this.leave);document.body.append(this.portal);
  const css=document.createElement('style');css.textContent=`
   .jazz-visit{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(70px,env(safe-area-inset-bottom));z-index:74;max-width:min(320px,85vw);padding:14px;background:#16262bd9;color:#f8ebc9;border:1px solid #ceac67;border-radius:10px;font:13px system-ui}
   .jazz-visit button,.jazz-return{min-height:44px;padding:10px 16px;border:1px solid #aebca580;border-radius:9px;background:#16262bd9;color:#fff;font:600 13px system-ui;cursor:pointer}.jazz-visit p{line-height:1.45}.jazz-visit[hidden]{display:none!important}
   dialog.jazz-world{position:fixed;inset:0;margin:0;padding:0;border:0;width:100vw;height:100dvh;max-width:none;max-height:none;background:#151b17;overflow:hidden}dialog.jazz-world::backdrop{background:#151b17}
   .jazz-world-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#151b17}.jazz-return{position:absolute;z-index:2;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top))}.jazz-return:focus-visible{outline:3px solid #63e5d0;outline-offset:3px}`;
  document.head.append(css);this.enter.onclick=()=>this.start();
  this.portal.addEventListener('cancel',e=>{e.preventDefault();this.stop('escape');});
  addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==this.frame?.contentWindow)return;
   if(e.data?.type==='bloom-exit')this.stop('world-return');
  });
  addEventListener('pagehide',()=>this.stop(),{once:true});
 }
 private start() {
  if(!this.selected||this.active)return;
  this.entered=this.selected.id;this.oldPaused=this.suspend();this.active=true;this.panel.hidden=true;
  document.exitPointerLock?.();
  const url=new URL('./exports/jazz-stage/index.html',location.href);
  url.searchParams.set('portal','1');url.searchParams.set('mode',this.entryMode());url.searchParams.set('club',this.selected.id);
  this.frame=document.createElement('iframe');this.frame.title='Walk and ride inside Bloom Through Gloom';this.frame.className='jazz-world-frame';this.frame.allow='autoplay; fullscreen';this.frame.src=url.href;
  this.portal.append(this.frame);this.portal.showModal();this.leave.focus();
  this.portal.dataset.club=this.selected.id;
 }
 stop(reason='session-change') {
  if(!this.active)return;this.active=false;
  // Removing the browsing context releases its Unity heap, audio and input listeners.
  this.frame?.remove();this.frame=undefined;this.portal.close();this.panel.dataset.lastExit=reason;this.resume(this.oldPaused);
 }
 update(x:number,z:number,visible:boolean) {
  const p=this.coordinates.toMap(x,0,z),club=this.clubs.find(c=>{const q=jazzCoordinates(c.site,p.x,p.z);return Math.abs(q.u)<c.site.width/2-1&&q.v<c.site.depth/2+5&&q.v>-c.site.depth/2;});
  if(!club)this.entered=undefined;
  if(this.active){if(!visible)this.stop('parent-inactive');else return;}
  this.selected=club?.site;this.panel.hidden=!visible||!club;this.title.textContent=club?.site.name??'';
  if(club&&visible&&this.entered!==club.site.id&&jazzCoordinates(club.site,p.x,p.z).v<club.site.depth/2-.4)this.start();
 }
}

