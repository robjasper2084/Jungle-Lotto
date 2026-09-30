import './tacticalHud.css';
type Group={name:string;nodes:Element[]};
/** Reparents real controls, preserving their values, listeners and saved layouts. */
export function settingsPanel(root:HTMLElement,close:HTMLButtonElement,groups:Group[],leftover='Help'){
 const taken=new Set(groups.flatMap(g=>g.nodes));
 const remaining=[...root.children].filter(n=>n!==close&&!taken.has(n)&&n.tagName!=='H2');
 root.querySelector(':scope > h2')?.remove();root.classList.add('tactical-settings');root.setAttribute('aria-label','Settings');
 const heading=document.createElement('div');heading.className='settings-heading';const title=document.createElement('h2');title.textContent='Settings';heading.append(title,close);
 const nav=document.createElement('div');nav.className='settings-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Settings categories');
 const pages:HTMLElement[]=[],tabs:HTMLButtonElement[]=[];
 const all=[...groups,...(remaining.length?[{name:leftover,nodes:remaining}]:[])];
 for(const [i,g]of all.entries()){
  const tab=document.createElement('button');tab.type='button';tab.textContent=g.name;tab.id=root.id+'-tab-'+i;tab.setAttribute('role','tab');
  const page=document.createElement('section');page.className='settings-page';page.id=root.id+'-page-'+i;page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',tab.id);page.tabIndex=0;tab.setAttribute('aria-controls',page.id);
  const h=document.createElement('h3');h.textContent=g.name;page.append(h,...g.nodes);pages.push(page);tabs.push(tab);nav.append(tab);
  tab.onclick=()=>select(i);tab.onkeydown=e=>{const next=e.code==='ArrowRight'?(i+1)%all.length:e.code==='ArrowLeft'?(i+all.length-1)%all.length:e.code==='Home'?0:e.code==='End'?all.length-1:-1;if(next>=0){e.preventDefault();select(next);tabs[next].focus();}};
 }
 function select(i:number){tabs.forEach((t,j)=>{t.setAttribute('aria-selected',String(i===j));t.tabIndex=i===j?0:-1;pages[j].hidden=i!==j;});root.scrollTop=0;}
 root.replaceChildren(heading,nav,...pages);select(0);
 root.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();close.click();}e.stopPropagation();});
 return{select};
}
export function controlNodes(root:HTMLElement,selectors:string[]){
 const result:Element[]=[];
 for(const selector of selectors)for(const n of root.querySelectorAll(selector)){
  if(n.id){const label=root.querySelector(`label[for="${n.id}"]`);if(label&&!result.includes(label))result.push(label);}
  const item=n.parentElement?.tagName==='LABEL'?n.parentElement:n;if(!result.includes(item))result.push(item);
 }
 return result;
}
