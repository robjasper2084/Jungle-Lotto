import { isReduced } from './experience';
import { openDialog } from './dom';

export function initCinematic() {
  const cards = [...document.querySelectorAll<HTMLElement>('.signal-card')];
  const dialog = document.querySelector<HTMLDialogElement>('#signal-display');
  if (!cards.length || !dialog) return;
  const stage = dialog.querySelector<HTMLElement>('.signal-display-stage')!;
  const image = dialog.querySelector<HTMLImageElement>('.signal-display-image')!;
  const title = dialog.querySelector<HTMLElement>('#signal-display-title')!;
  const link = dialog.querySelector<HTMLAnchorElement>('[data-display-collection]')!;
  const note = dialog.querySelector<HTMLElement>('[data-display-status]')!;
  let angleX=0, angleY=0, zoom=1;
  const draw=()=>{
    stage.style.setProperty('--rotate-x',`${isReduced()?0:angleX}deg`);
    stage.style.setProperty('--rotate-y',`${isReduced()?0:angleY}deg`);
    stage.style.setProperty('--display-zoom',String(zoom));
  };
  const reset=()=>{angleX=0;angleY=0;zoom=1;draw();};
  let drag: {x:number;y:number}|null=null;
  stage.addEventListener('pointerdown',event=>{
    stage.focus({preventScroll:true});
    if(event.button!==0 || isReduced() || document.documentElement.dataset.cinemaPaused==='true') return;
    drag={x:event.clientX,y:event.clientY};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(isReduced() || document.documentElement.dataset.cinemaPaused==='true') return;
    const rect=stage.getBoundingClientRect();
    stage.style.setProperty('--light-x',((event.clientX-rect.left)/rect.width*100)+'%');
    stage.style.setProperty('--light-y',((event.clientY-rect.top)/rect.height*100)+'%');
    if(!drag) return;
    angleY=Math.max(-24,Math.min(24,angleY+(event.clientX-drag.x)*.12));
    angleX=Math.max(-12,Math.min(12,angleX-(event.clientY-drag.y)*.08));
    drag={x:event.clientX,y:event.clientY};
    draw();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) stage.addEventListener(event,()=>{drag=null;});
  const setView=(view:string)=>{
    if(isReduced() && (view==='left' || view==='right')) return;
    if(view==='left') angleY=Math.max(-24,angleY-8);
    if(view==='right') angleY=Math.min(24,angleY+8);
    if(view==='in') zoom=Math.min(1.3,zoom+.1);
    if(view==='out') zoom=Math.max(.8,zoom-.1);
    if(view==='reset') reset();
    draw();
  };
  dialog.addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('button');
    if(button?.dataset.displayView) setView(button.dataset.displayView);
    if(button?.dataset.displayLight){
      stage.dataset.light=button.dataset.displayLight;
      dialog.querySelectorAll('[data-display-light]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    }
  });
  stage.addEventListener('keydown',event=>{
    const action=({ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out',Home:'reset'} as Record<string,string>)[event.key];
    if(action){event.preventDefault();setView(action);}
  });
  const syncMotion = () => {
    const reduced = isReduced();
    reset();
    drag = null;
    note.textContent = reduced
      ? 'Reduced motion is on. Zoom and lighting controls remain available.'
      : 'Drag to tilt the display. The keychain is concept artwork, not a 360-degree product model.';
    dialog.querySelectorAll<HTMLButtonElement>('[data-display-view="left"],[data-display-view="right"]').forEach(control => control.disabled = reduced);
    const hint = dialog.querySelector<HTMLElement>('.display-hint');
    if (hint) hint.textContent = reduced ? 'ZOOM AND LIGHTING CONTROLS BELOW' : 'DRAG TO EXPLORE';
    stage.setAttribute('aria-label', reduced
      ? 'Keychain depth display. Plus and minus zoom, Home resets.'
      : 'Keychain depth display. Arrow keys tilt, plus and minus zoom, Home resets.');
  };
  document.addEventListener('store:preferences', syncMotion);
  dialog.addEventListener('close',()=>{drag=null;reset();});
  cards.forEach(card=>{
    const art=card.querySelector<HTMLImageElement>('img');
    const name=card.querySelector('h3')?.textContent ?? 'Signal';
    if(!art || !(card instanceof HTMLAnchorElement)) return;
    const wrapper=card.closest<HTMLElement>('.cinematic-card');
    const button=wrapper?.querySelector<HTMLButtonElement>('.signal-inspect');
    if(!wrapper || !button) return;
    button.disabled=false;
    let frame=0;
    const clear=()=>{
      cancelAnimationFrame(frame);
      wrapper.style.setProperty('--card-x','0deg');
      wrapper.style.setProperty('--card-y','0deg');
      wrapper.classList.remove('is-lit');
    };
    card.addEventListener('pointermove',event=>{
      if(isReduced() || document.documentElement.dataset.cinemaPaused==='true' || event.pointerType!=='mouse') return;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const r=wrapper.getBoundingClientRect();
        const x=Math.max(0,Math.min(1,(event.clientX-r.left)/r.width));
        const y=Math.max(0,Math.min(1,(event.clientY-r.top)/r.height));
        wrapper.style.setProperty('--card-x',((.5-y)*7)+'deg');
        wrapper.style.setProperty('--card-y',((x-.5)*9)+'deg');
        wrapper.style.setProperty('--light-x',(x*100)+'%');
        wrapper.style.setProperty('--light-y',(y*100)+'%');
        wrapper.classList.add('is-lit');
      });
    });
    card.addEventListener('pointerleave',clear);
    card.addEventListener('blur',clear);
    document.addEventListener('store:preferences',clear);
    document.addEventListener('store:motion',clear);
    window.addEventListener('pagehide',clear,{once:true});
    button.addEventListener('click',()=>{
      image.src=art.src;
      image.alt=art.alt;
      title.textContent=name;
      link.href=card.href;
      stage.dataset.light=wrapper.dataset.signalLight??'warm';
      dialog.querySelectorAll<HTMLElement>('[data-display-light]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.displayLight===stage.dataset.light)));
      syncMotion();
      openDialog('signal-display',button);
    });
  });
}
