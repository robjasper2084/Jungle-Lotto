import {$,$$,openDialog} from './dom';
import {initUndergroundDiscount} from './underground-discount';
type ElmwoodWindow=Window&{RahbeArcadeGame?:{ready:boolean;pause:()=>void;getStats?:()=>{runId:string;score:number;seconds:number;mode:string};save?:()=>void;applySettings?:(settings:{sound:boolean;reducedMotion:boolean})=>void}};
export function initElmwoodPopup(){
 const dialog=$<HTMLDialogElement>('#elmwood-dialog');if(!dialog)return;const reward=dialog.dataset.rewardGame?initUndergroundDiscount():null;
 const host=$('[data-elmwood-host]',dialog)!,loading=$<HTMLElement>('[data-elmwood-loading]',dialog)!,status=$('[data-elmwood-status]',dialog)!,retry=$<HTMLButtonElement>('[data-elmwood-retry]',dialog)!,close=$<HTMLButtonElement>('[data-close-dialog]',dialog)!;
 let frame:HTMLIFrameElement|null=null,timer:ReturnType<typeof setInterval>|undefined;
 const release=()=>{clearInterval(timer);try{const api=(frame?.contentWindow as ElmwoodWindow)?.RahbeArcadeGame;if(api){if(reward&&api.getStats)void reward.update(dialog.dataset.rewardGame!,{...api.getStats()});api.save?.();api.pause();}}catch{}frame?.remove();frame=null;host.replaceChildren();};
 const launch=()=>{
  release();loading.hidden=false;retry.hidden=true;status.textContent='Loading Elmwood’s landscape…';
  let loaded=false,lastReceipt='';const current=document.createElement('iframe');frame=current;current.title='Digital Static Elmwood Cemetery game';current.tabIndex=0;current.allow='fullscreen; gamepad';
  const url=new URL(dialog.dataset.elmwoodUrl!,location.href);if(matchMedia('(prefers-reduced-motion:reduce)').matches||document.documentElement.dataset.reducedMotion==='true')url.searchParams.set('reducedMotion','1');current.src=url.href;
  current.addEventListener('load',()=>{if(current!==frame)return;loaded=false;lastReceipt="";const doc=current.contentDocument;
   doc?.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dialog.close();}
    if(event.key==='Tab'){const items=Array.from(doc.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select,input,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);if(event.shiftKey&&doc.activeElement===items[0]||!event.shiftKey&&doc.activeElement===items.at(-1)){event.preventDefault();close.focus();}}
   },true);
  });host.replaceChildren(current);const started=Date.now();
  timer=setInterval(()=>{if(frame!==current||!dialog.open){clearInterval(timer);return;}try{const api=(current.contentWindow as ElmwoodWindow)?.RahbeArcadeGame;if(api?.ready){if(!loaded){loading.hidden=true;loaded=true;api.applySettings?.({sound:true,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches});}if(reward&&api.getStats){const stats=api.getStats(),key=JSON.stringify(stats);if(key!==lastReceipt){void reward.update(dialog.dataset.rewardGame!,{...stats});lastReceipt=key;}}return;}const error=current.contentDocument?.querySelector('#error')?.textContent;if(error)throw Error(error);}catch{release();status.textContent='Elmwood could not load. Retry or open the full page.';retry.hidden=false;return;}if(Date.now()-started>120000){release();status.textContent='The landscape is taking too long to load. Retry or open the full page.';retry.hidden=false;}},250);
 };
 $$<HTMLButtonElement>('[data-open-elmwood]').forEach(button=>button.addEventListener('click',()=>{if(dialog.open)return;document.dispatchEvent(new Event('store:game-launch'));openDialog(dialog.id,button);launch();}));
 retry.addEventListener('click',launch);dialog.addEventListener('close',release);window.addEventListener('pagehide',release);
}
