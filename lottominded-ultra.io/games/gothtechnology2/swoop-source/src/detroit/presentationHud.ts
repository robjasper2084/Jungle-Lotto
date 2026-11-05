import './presentationHud.css';
import './rideTools.ts';

/** One opt-in home for existing utility panels. Nodes keep their handlers and
 * saved control state; combat actions and race progress never enter this tray. */
const tray=document.createElement('details');tray.className='presentation-tools';
const summary=document.createElement('summary');summary.textContent='Tools';
const content=document.createElement('div');content.className='presentation-tools-content';
tray.append(summary,content);document.body.append(tray);
const panels=new Set<HTMLElement>();
const selector='#ride-tools,.game-film-toolbar,.dogCommandTray,.dogActionHud,.nearby-tools';
function refresh(){tray.hidden=![...panels].some(p=>!p.hidden);if(tray.hidden)tray.open=false;}
function attach(panel:HTMLElement){
 if(panels.has(panel))return;panels.add(panel);content.append(panel);
 new MutationObserver(records=>{refresh();if(records.some(r=>r.attributeName==='data-collapsed')&&panel.dataset.collapsed==='false'&&!panel.hidden)tray.open=true;}).observe(panel,{attributes:true,attributeFilter:['hidden','data-collapsed']});refresh();
}
function scan(node:Node){if(!(node instanceof Element))return;if(node.matches(selector))attach(node as HTMLElement);for(const p of node.querySelectorAll<HTMLElement>(selector))attach(p);}
scan(document.body);refresh();
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(document.body,{childList:true,subtree:true});
tray.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();tray.open=false;summary.focus();}});
tray.addEventListener('keyup',e=>e.stopPropagation());tray.addEventListener('pointerdown',e=>e.stopPropagation());
document.addEventListener('pointerdown',e=>{if(e.target instanceof HTMLCanvasElement)tray.open=false;},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)tray.open=false;});
