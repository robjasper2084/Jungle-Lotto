import { saved, save } from './dom';

/** Decorative motion only: reward totals are always rendered from saved receipts. */
export function initRewardMotion() {
  const panel=document.querySelector<HTMLElement>('#underground-rewards');
  const button=panel?.querySelector<HTMLButtonElement>('[data-reward-motion-toggle]');
  if(!panel||!button||panel.dataset.motionReady==='true')return;
  panel.dataset.motionReady='true';
  const preference='gothtechnology.armory.reward-motion-paused';
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=saved(preference)==='true';
  let visible=false;
  function sync() {
    const reduced=query.matches||document.documentElement.dataset.reducedMotion==='true';
    const globalPause=document.documentElement.dataset.cinemaPaused==='true';
    const stopped=paused||reduced||globalPause;
    panel!.dataset.rewardMotion=stopped||!visible||document.hidden?'paused':'running';
    button!.disabled=reduced||globalPause;
    button!.setAttribute('aria-pressed',String(stopped));
    button!.textContent=reduced?'Reduced motion on':globalPause?'Motion paused in settings':paused?'Resume motion':'Pause motion';
  }
  button.hidden=false;
  button.addEventListener('click',()=>{paused=!paused;save(preference,String(paused));sync();});
  query.addEventListener('change',sync);
  document.addEventListener('store:preferences',sync);
  document.addEventListener('store:motion',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('storage',event=>{
    if(event.key===preference||event.key===null){paused=saved(preference)==='true';sync();}
  });
  const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);sync();});
  observer.observe(panel);
  sync();
}
