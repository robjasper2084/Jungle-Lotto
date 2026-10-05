/** A lightweight loading card over the Elmwood artwork. No startup video. */
export function loadingCinema(){
 const root=document.getElementById('startupPreview');if(!root)return {status(_s:string){},finish(){}};
 const start=performance.now(),saved=new Map<HTMLElement,boolean>();let done=false;
 root.style.setProperty('--loading-art',`url("${new URL('../../public/elmwood/title-screen-circuit-20261005.webp',import.meta.url).href}")`);
 root.hidden=false;root.setAttribute('aria-busy','true');
 for(const child of document.body.children)if(child instanceof HTMLElement&&child!==root){saved.set(child,child.inert);child.inert=true;}
 return {status(s:string){if(!done)root.querySelector<HTMLElement>('#startupStatus')!.textContent=s;},finish(){if(done)return;done=true;root.dataset.loadDurationMs=String(Math.round(performance.now()-start));root.setAttribute('aria-busy','false');root.hidden=true;for(const [child,inert]of saved)child.inert=inert;}};
}
