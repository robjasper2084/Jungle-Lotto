import { $, $$, openDialog } from './dom';
import { initUndergroundDiscount } from './underground-discount';
import {REWARD_GAMES,rewardGameForURL,rewardGameForNavigation} from '../public/arcade/games.js';
import {fighterReceipt} from '../public/arcade/rewards.js';
import {href} from '../utilities/paths';

type GameAPI={ready:boolean;getStats:()=>{mode:string;score:number;runId?:string;seconds?:number};save?:()=>void;pause:()=>void;applySettings:(settings:{sound:boolean;music?:boolean;reducedMotion:boolean})=>void};
type GameWindow=Window&{RahbeArcadeGame?:GameAPI;__gothTechnologyGame?:any};

export function initUndergroundPopup(){
  const dialog=$<HTMLDialogElement>('#underground-dialog');
  if(!dialog)return;
  const reward=initUndergroundDiscount();
  const host=$('[data-underground-host]',dialog)!;
  const loading=$<HTMLElement>('[data-underground-loading]',dialog)!;
  const status=$('[data-underground-status]',dialog)!;
  const retry=$<HTMLButtonElement>('[data-underground-retry]',dialog)!;
  const close=$<HTMLButtonElement>('[data-close-dialog]',dialog)!;
  let frame:HTMLIFrameElement|null=null,timer:ReturnType<typeof setInterval>|undefined;
  let selected=REWARD_GAMES[0];
  function selectGame(game:typeof selected,current:HTMLIFrameElement,url:string){
    selected=game;current.title=game.title+' game';
    $('#underground-title',dialog!)!.textContent=game.id==='underground'?'ROBOT RAHBE: UNDERGROUND':game.title;
    $('#underground-help',dialog!)!.textContent=game.help+' Esc closes popup.';
    $<HTMLAnchorElement>('[data-game-fullpage]',dialog!)!.href=url;
  }
  function apiFor(current:HTMLIFrameElement|null):GameAPI|undefined{
    const win=current?.contentWindow as GameWindow|null;
    if(selected.id!=='gothtechnology')return win?.RahbeArcadeGame;
    const game=win?.__gothTechnologyGame;if(!game)return;
    return {ready:game.phase!=='loading',getStats:()=>fighterReceipt(game)??{mode:'title',score:0},pause:()=>game.pauseForInterruption?.(),applySettings:settings=>{if(game.audio?.muted===settings.sound)game.audio.toggleMute();}};
  }
  function release(){
    clearInterval(timer);timer=undefined;
    try{const api=apiFor(frame);if(api&&api.getStats().mode!=='title'){void reward.update(selected.id,{...api.getStats()});api.save?.();api.pause();}}catch{/* Unloading also stops an unavailable game. */}
    frame?.remove();frame=null;host.replaceChildren();
  }
  function launch(){
    release();loading.hidden=false;retry.hidden=true;status.textContent=`Loading ${selected.title}…`;
    const current=document.createElement('iframe');frame=current;
    current.title=selected.title+' game';current.tabIndex=0;current.allow='fullscreen; gamepad; autoplay';
    current.src=href(selected.path);
    const started=Date.now();
    let loaded=false,lastReceipt='';
    current.addEventListener('load',()=>{
      if(current!==frame||!dialog!.open)return;
      try{
        const url=current.contentWindow!.location.href;
        const game=rewardGameForURL(url,new URL(href(),location.href).href);
        if(game){
          selectGame(game,current,url);loaded=false;lastReceipt='';
        }
      }catch{/* Unrecognized or cross-origin pages cannot select a reward game. */}
      const doc=current.contentDocument;
      doc?.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!doc.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();dialog!.close();}
        if(event.key==='Tab'&&!doc.querySelector('dialog[open]')){
          const controls=Array.from(doc.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
          if((event.shiftKey&&doc.activeElement===controls[0])||(!event.shiftKey&&doc.activeElement===controls.at(-1))){event.preventDefault();close.focus();}
        }
      },true);
    });
    host.replaceChildren(current);
    timer=setInterval(()=>{
      if(current!==frame||!dialog!.open){clearInterval(timer);return;}
      try{
        const api=apiFor(current);
        if(api?.ready){
          if(!loaded){api.applySettings({sound:true,music:true,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches||document.documentElement.dataset.reducedMotion==='true'});loading.hidden=true;loaded=true;}
          const stats=api.getStats(),key=[stats.runId,stats.score,(stats.seconds??0)>0,stats.mode].join('|');
          if(stats.mode!=='title'&&key!==lastReceipt){void reward.update(selected.id,{...stats});lastReceipt=key;}
          return;
        }
      }catch{/* The timeout leaves retry and the full-page link available. */}
      if(!loaded&&Date.now()-started>45000){release();status.textContent='The game could not load. Retry or open it on its own page.';retry.hidden=false;}
    },250);
  }
  $$<HTMLButtonElement>('[data-open-underground], [data-open-reward-game]').forEach(button=>button.addEventListener('click',()=>{
    if(dialog.open)return;
    selected=REWARD_GAMES.find(game=>game.id===button.dataset.openRewardGame)??REWARD_GAMES[0];
    $('#underground-title',dialog)!.textContent=selected.id==='underground'?'ROBOT RAHBE: UNDERGROUND':selected.title;
    $('#underground-help',dialog)!.textContent=selected.help+' Esc closes popup.';
    $<HTMLAnchorElement>('[data-game-fullpage]',dialog)!.href=href(selected.path);
    document.dispatchEvent(new Event('store:game-launch'));openDialog(dialog.id,button);launch();
  }));
  // Explicit links select games available on the current page.
  const requestedGame = new URLSearchParams(location.search).get('arcade');
  if (REWARD_GAMES.some(game => game.id === requestedGame)) {
    const picker = $<HTMLDetailsElement>('#reward-game-picker');
    if (picker) picker.open = true;
    const button = $$<HTMLButtonElement>('[data-open-reward-game]').find(button => button.dataset.openRewardGame === requestedGame);
    if (button) requestAnimationFrame(() => button.click());
  } else {
    // One introduction per tab session; preserve previously recorded appearances.
    const autoButton=$<HTMLButtonElement>('[data-auto-game]');
    const sessionKey='gothtechnology.swoop-introduction.v3';
    const cooldown=60_000;
    let count=0,nextAt=Date.now()+Math.max(0,60_000-performance.now());
    try{
      const saved=JSON.parse(sessionStorage.getItem(sessionKey)??'null');
      if(saved&&Number.isInteger(saved.count)&&saved.count>=0){
        count=Math.min(1,saved.count);
        if(Number.isFinite(saved.nextAt))nextAt=Math.max(nextAt,saved.nextAt);
      }else if(sessionStorage.getItem('gothtechnology.swoop-introduction.v2')==='seen'){
        count=1;nextAt=Date.now()+cooldown;
      }
    }catch{}
    const remember=()=>{try{sessionStorage.setItem(sessionKey,JSON.stringify({count,nextAt}));}catch{}};
    if(autoButton&&count<1){
      const autoTimer=setInterval(()=>{
        if(Date.now()<nextAt||document.hidden||document.querySelector('dialog[open]'))return;
        count++;nextAt=Date.now()+cooldown;remember();
        clearInterval(autoTimer);
        autoButton.click();
      },500);
      window.addEventListener('pagehide',()=>clearInterval(autoTimer),{once:true});
      const defer=()=>{nextAt=Date.now()+cooldown;remember();};
      document.addEventListener('store:game-launch',defer);
      // Never stack over another dialog or immediately follow its dismissal.
      document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement)defer();},true);
    }
  }
  // New Drop introduces Underground 30 seconds after navigation, once per session.
  const undergroundButton=$<HTMLButtonElement>('[data-open-underground]');
  const undergroundKey='gothtechnology.underground-introduction.v1';
  let undergroundSeen=false;
  try{undergroundSeen=sessionStorage.getItem(undergroundKey)==='seen';}catch{}
  const rememberUnderground=()=>{
    undergroundSeen=true;
    try{sessionStorage.setItem(undergroundKey,'seen');}catch{}
  };
  let undergroundTimer:ReturnType<typeof setInterval>|undefined;
  if(undergroundButton&&!undergroundSeen&&!REWARD_GAMES.some(game=>game.id===requestedGame)){
    const dueAt=Date.now()+Math.max(0,30_000-performance.now());
    undergroundTimer=setInterval(()=>{
      if(Date.now()<dueAt||document.hidden||document.querySelector('dialog[open]'))return;
      clearInterval(undergroundTimer);rememberUnderground();undergroundButton.click();
    },250);
    window.addEventListener('pagehide',()=>clearInterval(undergroundTimer),{once:true});
  }
  document.addEventListener('store:game-launch',()=>{
    // Choosing a game manually must not cause a second interruption later.
    clearInterval(undergroundTimer);
    if(selected.id==='underground'&&undergroundButton)rememberUnderground();
  });
  retry.addEventListener('click',launch);
  window.addEventListener('message',event=>{
    if(!dialog.open||!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;
    const storeBase=new URL(href(),location.href).href;
    const navigation=rewardGameForNavigation(event,frame.contentWindow,storeBase);
    if(navigation){selectGame(navigation,frame,new URL(navigation.path,storeBase).href);return;}
    if(event.data?.type==='rahbe-exit'&&event.data.game===selected.id)dialog.close();
  });
  dialog.addEventListener('close',release);
  window.addEventListener('pagehide',release);
}
