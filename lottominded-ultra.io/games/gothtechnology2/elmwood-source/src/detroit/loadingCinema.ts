import {bindFilmSound,filmSoundEnabled} from './filmAudio.ts';
/** Loading remains the only clock: the film never postpones a playable scene. */
export function loadingCinema(){
 const root=document.getElementById('startupPreview');if(!root)return {status(_s:string){},finish(){}};
 const video=root.querySelector<HTMLVideoElement>('video')!,button=root.querySelector<HTMLButtonElement>('button')!,elapsed=root.querySelector<HTMLElement>('[data-load-elapsed]')!;
 video.dataset.filmSrc??=video.getAttribute('src')??'./art/loading-trailer.mp4';
 if(!video.getAttribute('src'))video.src=video.dataset.filmSrc;
 root.hidden=false;video.hidden=false;button.hidden=false;elapsed.textContent='Building your 3D world';
 const sound=root.querySelector<HTMLButtonElement>('[data-film-sound]')!,unbindSound=bindFilmSound(video,sound);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),start=performance.now(),saved=new Map<HTMLElement,boolean>();let done=false,paused=reduced.matches;
 for(const child of document.body.children)if(child instanceof HTMLElement&&child!==root){saved.set(child,child.inert);child.inert=true;}
 function updatePlayback(){if(done)return;if(paused||document.hidden){video.pause();}else {video.muted=!filmSoundEnabled();void video.play().catch(()=>{paused=true;button.textContent='Play film';});}button.textContent=paused?'Play film':'Pause film';}
 button.onclick=()=>{paused=!paused;updatePlayback();};
 const visibility=()=>updatePlayback(),comfort=()=>{paused=reduced.matches;updatePlayback();};document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',comfort);
 const failed=()=>{video.hidden=true;button.hidden=true;};video.addEventListener('error',failed);updatePlayback();
 const timer=setInterval(()=>{elapsed.textContent=Math.floor((performance.now()-start)/1000)+'s · building your 3D world';},1000);
 return {status(s:string){if(!done)root.querySelector<HTMLElement>('#startupStatus')!.textContent=s;},finish(){if(done)return;done=true;root.dataset.loadDurationMs=String(Math.round(performance.now()-start));clearInterval(timer);unbindSound();video.removeEventListener('error',failed);video.pause();video.removeAttribute('src');video.load();root.hidden=true;for(const [child,inert]of saved)child.inert=inert;document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',comfort);}};
}
