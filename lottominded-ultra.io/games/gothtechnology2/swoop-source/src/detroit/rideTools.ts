import './rideTools.css';

/** Secondary ride tools share one drawer, outside the thumb-control lanes. */
const selector='.studio-capture,.studio-screens,.community-panel,.cabinet-console';
const tools=new Set<HTMLDetailsElement>();
const drawer=document.createElement('details');
drawer.id='ride-tools';drawer.className='ride-tools';drawer.hidden=true;
drawer.setAttribute('aria-label','Ride tools');
const heading=document.createElement('summary');heading.textContent='Ride tools';
drawer.append(heading);document.body.append(drawer);

function available(){
 const studio=[...tools].some(p=>!p.hidden&&p.matches('.studio-capture,.studio-screens,.cabinet-console'));
 drawer.dataset.studio=String(studio);
 heading.textContent=studio?'Studio tools':'Group ride';
 return [...tools].filter(p=>!p.hidden);
}
function refresh(){
 const visible=available(),wasHidden=drawer.hidden;drawer.hidden=visible.length===0;
 if(drawer.hidden)drawer.open=false;
 else if(wasHidden&&visible.some(p=>p.open))drawer.open=true;
}
function attach(panel:HTMLDetailsElement){
 if(tools.has(panel))return;
 tools.add(panel);panel.classList.add('ride-tool-panel');drawer.append(panel);
 // A single expanded tool keeps the drawer short; existing controls and media stay intact.
 panel.addEventListener('toggle',()=>{
  if(panel.open&&!panel.hidden){for(const other of tools)if(other!==panel)other.open=false;drawer.open=true;}
 });
 new MutationObserver(refresh).observe(panel,{attributes:true,attributeFilter:['hidden']});
 refresh();
}
function scan(node:Node){
 if(!(node instanceof Element))return;
 if(node.matches(selector)&&node instanceof HTMLDetailsElement)attach(node);
 for(const panel of node.querySelectorAll<HTMLDetailsElement>(selector))attach(panel);
}
drawer.addEventListener('toggle',()=>{
 if(!drawer.open){for(const panel of tools)panel.open=false;}
 else{const visible=available();if(visible.length===1)visible[0].open=true;}
});
drawer.addEventListener('keydown',event=>{
 event.stopPropagation();
 if(event.key==='Escape'){event.preventDefault();drawer.open=false;heading.focus();}
});
drawer.addEventListener('keyup',event=>event.stopPropagation());
drawer.addEventListener('pointerdown',event=>event.stopPropagation());
// Studio screens and community rides are constructed after their assets load.
scan(document.body);
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(document.body,{childList:true,subtree:true});
