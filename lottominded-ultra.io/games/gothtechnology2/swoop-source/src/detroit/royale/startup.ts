export {};
const startup=document.getElementById('royale-startup') as HTMLDialogElement;
const film=document.getElementById('royale-startup-video') as HTMLVideoElement;
const enter=document.getElementById('royale-startup-enter') as HTMLButtonElement;
const sound=document.getElementById('royale-startup-sound') as HTMLButtonElement;
const status=document.getElementById('royale-startup-status')!;
const detail=document.getElementById('royale-startup-detail')!;
const progress=document.getElementById('royale-startup-progress')!;
const timing=document.getElementById('royale-startup-timing')!;
let finishedAt:number|undefined;
function syncTiming(){
  const seconds=Math.floor((finishedAt??performance.now())/1000);
  const duration=seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`;
  const total=Number(startup.dataset.total)||0,completed=Math.min(total,Number(startup.dataset.completed)||0);
  timing.textContent=finishedAt!==undefined?`Ready in ${duration}`:`${duration} elapsed${total?` · ${completed}/${total} loading steps`:''}`;
}
const clock=window.setInterval(syncTiming,250);
const lobby=document.getElementById('lobby') as HTMLDialogElement;
const practice=document.getElementById('practice') as HTMLButtonElement;
const message=document.getElementById('message')!;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
film.muted=true;film.defaultMuted=true;
startup.close();startup.showModal();enter.focus({preventScroll:true});
function syncPlayback(){
  sound.hidden=reduced.matches;
  if(!startup.open||document.hidden||reduced.matches){film.pause();if(reduced.matches){film.muted=true;sound.textContent='Sound off';sound.setAttribute('aria-pressed','false');film.currentTime=0;}return;}
  void film.play().catch(()=>{film.poster&&film.setAttribute('data-playback','poster');});
}
function syncStatus(){
  const ready=!practice.disabled;
  startup.dataset.ready=String(ready);
  // Completed work includes individual rider/wheel assets and arena setup tasks.
  const total=Number(startup.dataset.total)||0;
  const completed=Math.min(total,Number(startup.dataset.completed)||0);
  const fraction=ready?1:total?Math.min(.99,completed/total):0;
  startup.style.setProperty('--load-progress',String(fraction));
  startup.style.setProperty('--load-heat',String(Math.max(0,(fraction-.3)/.7)));
  progress.setAttribute('aria-valuemax',String(total||1));
  if(total)progress.setAttribute('aria-valuenow',String(completed));else progress.removeAttribute('aria-valuenow');
  progress.setAttribute('aria-valuetext',ready?'Arena ready':`${completed} of ${total} loading steps complete`);
  if(ready&&finishedAt===undefined){finishedAt=performance.now();clearInterval(clock);}
  syncTiming();
  status.textContent=ready?'Arena ready':'Preparing arena';
  detail.textContent=ready?'Open the menu to choose your rider and match.':message.textContent||'Loading the streets of Detroit…';
}
const observer=new MutationObserver(syncStatus);
observer.observe(message,{childList:true,characterData:true,subtree:true});
observer.observe(practice,{attributes:true,attributeFilter:['disabled']});
observer.observe(startup,{attributes:true,attributeFilter:['data-completed','data-total']});
function dismiss(){
  film.pause();film.muted=true;observer.disconnect();clearInterval(clock);startup.close();
  // The HTML lobby may still be non-modal while the main game module loads.
  if(lobby.open)lobby.close();lobby.showModal();
  (practice.disabled?document.getElementById('name'):practice)?.focus({preventScroll:true});
}
enter.addEventListener('click',dismiss);
document.getElementById('royale-art-start')!.addEventListener('click',dismiss);
startup.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
// Keep the game's keyboard shortcuts from reacting to startup controls.
window.addEventListener('keydown',event=>{if(startup.open)event.stopPropagation();},true);
window.addEventListener('keyup',event=>{if(startup.open)event.stopPropagation();},true);
sound.addEventListener('click',()=>{film.muted=!film.muted;sound.textContent=film.muted?'Sound off':'Sound on';sound.setAttribute('aria-pressed',String(!film.muted));if(!reduced.matches)void film.play().catch(()=>{});});
reduced.addEventListener('change',syncPlayback);
document.addEventListener('visibilitychange',syncPlayback);
film.addEventListener('error',()=>{sound.hidden=true;});
syncStatus();syncPlayback();
