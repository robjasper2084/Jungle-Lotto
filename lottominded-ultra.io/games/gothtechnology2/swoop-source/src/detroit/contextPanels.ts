/** One opt-in drawer keeps location tools out of both thumb control areas. */
export function mountContextPanels(){
 const selector='.studio-capture,.studio-screens,.cabinet-console,.jazz-visit';
 const drawer=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('div');
 drawer.className='nearby-tools';drawer.hidden=true;summary.textContent='Nearby places';content.className='nearby-tools-content';drawer.append(summary,content);document.body.append(drawer);
 const style=document.createElement('style');style.textContent=`
 .nearby-tools{position:fixed;left:max(12px,env(safe-area-inset-left));top:156px;z-index:84;width:max-content;max-width:calc(100vw - 24px);border:1px solid #b5d3bf77;border-radius:10px;background:#132b25c9;color:#f3f8ed;font:12px system-ui;box-shadow:0 4px 18px #0002}
 .nearby-tools[hidden]{display:none!important}.nearby-tools>summary{cursor:pointer;min-height:44px;padding:14px 16px;box-sizing:border-box;list-style-position:inside;font-weight:650}.nearby-tools[open]{width:min(340px,calc(100vw - 24px))}
 .nearby-tools-content{max-height:max(100px,calc(100dvh - 440px));overflow:auto;overscroll-behavior:contain;padding:0 8px 8px}
 .nearby-tools-content>:is(.studio-capture,.studio-screens,.cabinet-console,.jazz-visit){position:static!important;inset:auto!important;transform:none!important;width:auto!important;max-width:none!important;margin:0 0 8px!important;box-shadow:none!important;background:#10272288!important}
 .nearby-tools-content>[hidden]{display:none!important}.nearby-tools button,.nearby-tools select,.nearby-tools summary{min-height:44px}.nearby-tools :focus-visible{outline:2px solid #66e0c4;outline-offset:2px}
 @media(max-height:540px){.nearby-tools{top:72px;left:50%;transform:translateX(-50%)}.nearby-tools-content{max-height:140px}}
 `;document.head.append(style);
 const panels=new Set<HTMLElement>();
 const refresh=()=>{const visible=[...panels].filter(p=>!p.hidden);drawer.hidden=!visible.length;if(!visible.length)drawer.open=false;const title=visible.length===1?(visible[0].getAttribute('aria-label')??'Nearby places'):'Nearby places · '+visible.length;if(summary.textContent!==title)summary.textContent=title;};
 const visibility=new MutationObserver(refresh);
 const add=(panel:HTMLElement)=>{if(panels.has(panel))return;panels.add(panel);content.append(panel);visibility.observe(panel,{attributes:true,attributeFilter:['hidden']});refresh();};
 document.querySelectorAll<HTMLElement>(selector).forEach(add);
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement&&node.matches(selector))add(node);}).observe(document.body,{childList:true});
 window.addEventListener('pointerdown',e=>{if(e.target instanceof Element&&e.target.id==='world')drawer.open=false;},true);
 drawer.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();drawer.open=false;summary.focus();}});
}
