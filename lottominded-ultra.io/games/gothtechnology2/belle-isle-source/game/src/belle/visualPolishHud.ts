/** Keep existing action buttons reachable even when compact races hide Ride options.
 * Never move, clone or replace buttons or their event listeners. */
export function installHoverPresentation(hud:HTMLElement):boolean {
 if(hud.dataset.visualPolish==='v1')return false;
 const options=hud.querySelector<HTMLElement>('.hover-lighting > div');
 const summary=hud.querySelector<HTMLElement>('.hover-lighting > summary');
 if(!options||!summary)return false;
 summary.textContent='Ride options';
 summary.setAttribute('aria-label','Ride options: flight mode, LED color, LED effects and high beam');
 hud.dataset.visualPolish='v1';
 return true;
}
