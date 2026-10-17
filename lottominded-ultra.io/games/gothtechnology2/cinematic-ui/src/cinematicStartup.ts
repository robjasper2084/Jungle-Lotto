import './cinematicStartup.css';

/** Cinematics never gate readiness. Progress measures completed setup steps, not elapsed time. */
export function cinematicStartup(game:'swoop'|'elmwood',startup:boolean){
 const root=document.getElementById('startupPreview');
 if(!root)return {status(_s:string){},progress(_n:number,_total:number){},finish(){},dismiss(){},fail(_s:string){}};
 const elmwood=game==='elmwood',started=performance.now(),saved=new Map<HTMLElement,boolean>();
 let done=false,closed=false,failed=false,motion=true,completed=0,total=0,loop=!startup;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),forced=new URLSearchParams(location.search).has('reducedMotion');
 root.className='stage cinema';root.dataset.game=game;root.dataset.mode=startup?'startup':'loading';root.dataset.ready='false';
 root.hidden=false;root.setAttribute('aria-busy','true');root.setAttribute('aria-label',(elmwood?'Elmwood Explorer':'Swoop Detroit')+' startup and loading screen');
 root.innerHTML=`<img class="backdrop" src="./cinematics/${game}-keyart.png" alt=""><video class="backdrop cinema-film" muted playsinline aria-hidden="true"></video><div class="vignette"></div>
 <div class="screen-top"><div class="studio"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M18 4 10 18h8l-4 10 10-15h-8Z"/></svg><span>DIGITAL STATIC</span></div><span>${elmwood?'ELMWOOD / BEYOND THE CITY':'DETROIT / FIND YOUR LINE'}</span></div>
 <section class="identity brand-intro"><video class="brand-energy" muted loop playsinline aria-hidden="true"></video><p class="eyebrow" id="cinema-kicker">${elmwood?'FOLLOW THE UNKNOWN.':'OWN THE STREETS.'}</p><h1><span id="cinema-title-main">${elmwood?'ELMWOOD':'SWOOP'}</span><span id="cinema-title-sub">${elmwood?'EXPLORER':'DETROIT'}</span></h1><div class="title-rule"></div><p class="tagline" id="cinema-tagline">${elmwood?'Every path holds a story.':'The city is yours. Find your line.'}</p></section>
 <div class="screen-bottom"><div class="loading-panel"><div class="loading-caption"><span class="status-wrap"><span class="status-dot"></span><span id="startupStatus" role="status">Preparing your ${elmwood?'adventure':'city'}…</span></span><span id="cinema-load-percent">Loading</span></div><div class="progress" role="progressbar" aria-label="Game setup" aria-valuemin="0" aria-valuemax="100" data-indeterminate="true"><div></div></div><div class="load-meta"><span class="cinema-time">Loading · 0.0s</span><span class="cinema-steps">Preparing game</span></div><p class="cinema-help">Loading the world and controls.</p></div><button class="start" type="button" disabled ${startup?'':'hidden'}><span class="start-icon">◇</span><span class="cinema-button-label">PREPARING</span><span class="key-hint">ENTER</span></button><div class="bottom-meta"><button class="cinema-motion" type="button" aria-pressed="false">Pause motion</button></div></div>`;
 const find=<E extends HTMLElement>(selector:string)=>root.querySelector<E>(selector)!;
 const film=find<HTMLVideoElement>('.cinema-film'),energy=find<HTMLVideoElement>('.brand-energy'),start=find<HTMLButtonElement>('.start'),toggle=find<HTMLButtonElement>('.cinema-motion'),bar=find('.progress');
 film.muted=energy.muted=true;
 function guard(){for(const child of document.body.children)if(child instanceof HTMLElement&&child!==root&&!saved.has(child)){saved.set(child,child.inert);child.inert=true;}}
 guard();const observer=new MutationObserver(guard);observer.observe(document.body,{childList:true});
 function syncMotion(){
  const paused=!motion||reduced.matches||forced||document.hidden||closed;
  root!.dataset.motion=paused?'paused':'running';toggle.textContent=paused?'Motion off':'Pause motion';toggle.setAttribute('aria-pressed',String(paused));
  if(paused){film.pause();energy.pause();return;}
  if(!film.getAttribute('src')){film.src=`./cinematics/${game}-${loop?'loading':'startup'}.mp4`;film.loop=loop;}
  if(!energy.getAttribute('src'))energy.src=`./cinematics/${elmwood?'elmwood-title-moonlight':'swoop-title-energy'}.mp4`;
  void film.play().catch(()=>{});void energy.play().catch(()=>{});
 }
 film.addEventListener('loadeddata',()=>film.classList.add('ready'));energy.addEventListener('loadeddata',()=>energy.classList.add('loaded'));
 film.addEventListener('ended',()=>{if(closed||loop)return;loop=true;film.classList.remove('ready');film.removeAttribute('src');syncMotion();});
 film.addEventListener('error',()=>film.classList.remove('ready'));
 toggle.onclick=()=>{motion=!motion;syncMotion();};reduced.addEventListener('change',syncMotion);document.addEventListener('visibilitychange',syncMotion);
 const clock=setInterval(()=>{find('.cinema-time').textContent=`Loading · ${((performance.now()-started)/1000).toFixed(1)}s`;},250);
 function dismiss(){if(closed)return;closed=true;clearInterval(clock);observer.disconnect();root!.hidden=true;root!.setAttribute('aria-busy','false');reduced.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',syncMotion);for(const video of [film,energy]){video.pause();video.removeAttribute('src');video.load();}for(const [child,inert]of saved)child.inert=inert;}
 start.onclick=()=>{if(failed){location.reload();return;}if(!done)return;dismiss();if(elmwood)document.getElementById('view')?.dispatchEvent(new Event('elmwood-main-menu'));else document.getElementById('start')?.focus({preventScroll:true});};
 // Keep keyboard navigation inside the startup screen while the game is inert.
 root.onkeydown=event=>{if(event.key!=='Tab')return;const buttons=[start,toggle].filter(b=>!b.disabled&&!b.hidden);const next=event.shiftKey?buttons.at(-1)!:buttons[0];if(event.shiftKey&&document.activeElement===buttons[0]||!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();next.focus();}};
 toggle.focus({preventScroll:true});syncMotion();
 return {
  status(s:string){if(!done&&!failed)find('#startupStatus').textContent=s;},
  progress(n:number,count:number){if(done||failed||closed)return;total=Math.max(1,count);completed=Math.max(completed,Math.min(n,total-1));const value=Math.floor(completed/total*100);bar.dataset.indeterminate='false';bar.setAttribute('aria-valuenow',String(value));bar.setAttribute('aria-valuetext',`${completed} of ${total} setup steps complete`);root!.style.setProperty('--load-progress',String(value/100));find('#cinema-load-percent').textContent=value+'%';find('.cinema-steps').textContent=`${completed} / ${total} setup steps`;},
  finish(){if(done||failed||closed)return;done=true;clearInterval(clock);root!.dataset.loadDurationMs=String(Math.round(performance.now()-started));root!.setAttribute('aria-busy','false');root!.dataset.ready='true';bar.dataset.indeterminate='false';bar.setAttribute('aria-valuenow','100');bar.setAttribute('aria-valuetext','Game ready');root!.style.setProperty('--load-progress','1');find('#cinema-load-percent').textContent='100%';find('#startupStatus').textContent=elmwood?'ELMWOOD READY':'DETROIT READY';find('.cinema-time').textContent=`Ready in ${((performance.now()-started)/1000).toFixed(1)}s`;find('.cinema-steps').textContent=total?`${total} / ${total} setup steps`:'Ready';find('.cinema-help').textContent='Press Start to open the game menu.';find('.cinema-button-label').textContent='PRESS START';start.disabled=false;if(startup)start.focus({preventScroll:true});else dismiss();},
  fail(message:string){if(closed)return;failed=true;clearInterval(clock);root!.setAttribute('aria-busy','false');bar.dataset.indeterminate='false';bar.removeAttribute('aria-valuenow');bar.setAttribute('aria-valuetext','Loading failed');find('#startupStatus').textContent=message;find('#cinema-load-percent').textContent='Retry';find('.cinema-help').textContent='Your game has not started.';find('.cinema-button-label').textContent='RETRY';start.hidden=false;start.disabled=false;start.focus();},
  dismiss
 };
}
