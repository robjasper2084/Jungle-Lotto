/** Reparent existing controls; never clone them or replace their listeners. */
export function installHoverPresentation(hud:HTMLElement):boolean {
 if(hud.dataset.visualPolish==='v1')return false;
 const options=hud.querySelector<HTMLElement>('.hover-lighting > div');
 const summary=hud.querySelector<HTMLElement>('.hover-lighting > summary');
 if(!options||!summary)return false;
 const doc=hud.ownerDocument;
 const group=doc.createElement('div');group.className='hover-secondary-controls';
 group.setAttribute('role','group');group.setAttribute('aria-label','Lights and hoverbike sound');
 for(const key of ['lights','sound']){
  const button=hud.querySelector<HTMLButtonElement>('[data-hover="'+key+'"]');
  if(button)group.append(button);
 }
 if(group.childElementCount)options.prepend(group);
 summary.textContent='Ride options';
 summary.setAttribute('aria-label','Ride options: flight, headlights, LEDs and hoverbike sound');
 hud.dataset.visualPolish='v1';
 return true;
}
