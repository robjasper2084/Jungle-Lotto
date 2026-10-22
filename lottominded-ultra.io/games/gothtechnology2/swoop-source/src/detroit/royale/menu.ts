import {menuAction,type RoyaleMenuState} from './menuState.ts';
import './menu.css';
export type RoyaleMenuPanel='home'|'loadout'|'online'|'settings';
/** Reuses the actual controls and handlers: no second loadout or room state. */
export function createRoyaleMenu(root:HTMLDialogElement,readState:()=>RoyaleMenuState){
 const find=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
 const content=root.querySelector<HTMLElement>('.lobby-content')!;
 const heading=root.querySelector<HTMLElement>('.lobby-heading')!;
 const setup=root.querySelector<HTMLElement>('.lobby-setup')!;
 const practice=find<HTMLButtonElement>('practice'),resume=find<HTMLButtonElement>('resume'),rematch=find<HTMLButtonElement>('rematch');
 const room=find('room'),online=find<HTMLDetailsElement>('online'),settings=find<HTMLDetailsElement>('ride-settings');
 const results=find('results'),replay=find('death-replay'),quit=find<HTMLButtonElement>('quit'),message=find('message');
 root.classList.add('royale-menu');root.removeAttribute('aria-labelledby');root.setAttribute('aria-label','Static Royale menu');
 const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 const nav=node('nav','royale-menu-nav');nav.setAttribute('aria-label','Static Royale sections');
 const brand=node('span','royale-menu-brand','STATIC / ROYALE');nav.append(brand);
 const tabs=new Map<RoyaleMenuPanel,HTMLButtonElement>();
 for(const [id,label]of [['home','Play'],['loadout','Rider & match'],['online','Friends'],['settings','Settings']] as const){const b=node('button','',label);b.type='button';b.onclick=()=>open(id);b.setAttribute('aria-controls','royale-panel-'+id);tabs.set(id,b);nav.append(b);}
 const back=node('a','royale-menu-exit','← Swoop Detroit');back.href='./index.html';nav.append(back);root.prepend(nav);
 const home=node('section','royale-menu-panel royale-home');home.append(heading);
 const facts=node('p','royale-menu-facts');home.append(facts);
 const action=node('button','primary royale-deploy');action.type='button';
 action.onclick=()=>{const a=menuAction(readState()).action;if(a==='room')open('online');else({practice,resume,rematch}[a]).click();};
 const brief=node('p','royale-menu-brief');home.append(action,brief);
 const training=node('div','royale-training');training.setAttribute('aria-label','Training');
 training.append(find('practice-range'),find('combat-block'));home.append(training);
 const resultBlock=node('section','royale-round-summary');resultBlock.setAttribute('aria-label','Round results');resultBlock.append(node('h2','','Round results'),results,replay);home.append(resultBlock);
 const selection=node('section','royale-selection');selection.setAttribute('aria-label','Selected rider and wheel');
 const rider=node('strong',''),wheel=node('span',''),selectionLabel=node('span','royale-selection-label','YOUR LOADOUT');selection.append(selectionLabel,rider,wheel);home.append(selection);
 home.insertBefore(resultBlock,action);
 const leave=node('div','royale-leave');leave.append(quit);home.append(leave);
 const panels=new Map<RoyaleMenuPanel,HTMLElement>([['home',home],['loadout',setup]]);
 for(const [id,title,detail]of [['online','Play with friends',online],['settings','Settings',settings]] as const){const section=node('section','royale-menu-panel');const h=node('h2','royale-panel-title',title);section.append(h,detail);if(id==='online')section.append(room);panels.set(id,section);detail.open=true;}
 setup.classList.add('royale-menu-panel');
 const notice=node('p','royale-next-match','Rider and wheel selections apply to your next match.');setup.querySelector('.setup-heading')!.after(notice);
 const sourceActions=node('div','royale-action-sources');sourceActions.hidden=true;sourceActions.append(resume,rematch);
 // Only long instructions collapse; existing settings and binding nodes stay live.
 const guide=node('details','royale-controls-guide');guide.append(node('summary','','Controls guide'));
 for(const p of [...settings.children])if(p.tagName==='P')guide.append(p);settings.append(guide);
 content.replaceChildren(...panels.values(),sourceActions,message);
 let current:RoyaleMenuPanel='home';
 for(const [id,p]of panels){p.id='royale-panel-'+id;p.tabIndex=-1;p.hidden=id!=='home';}
 function open(id:RoyaleMenuPanel='home',focus=true){current=id;root.dataset.royalePanel=id;for(const [key,p]of panels)p.hidden=key!==id;for(const [key,b]of tabs){if(key===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}online.open=settings.open=true;root.scrollTop=0;sync();if(focus)(id==='home'?action:panels.get(id)!).focus({preventScroll:true});}
 let summary='';
 function sync(){
  const state=readState(),choice=menuAction(state);
  const phase=state.phase??'idle';if(root.dataset.royalePhase!==phase)root.dataset.royalePhase=phase;
  if(action.textContent!==choice.label)action.textContent=choice.label;
  action.disabled=choice.disabled||(choice.action==='practice'&&practice.disabled);
  if(!state.phase&&practice.disabled)action.textContent='Preparing arena…';
  training.hidden=!!state.phase;resultBlock.hidden=state.phase!=='results';quit.hidden=!state.phase;
  practice.hidden=!!state.phase;const practiceNote=setup.querySelector<HTMLElement>('.lobby-practice-note');if(practiceNote)practiceNote.hidden=!!state.phase;
  const selectionTitle=state.phase?'NEXT MATCH LOADOUT':'YOUR LOADOUT';if(selectionLabel.textContent!==selectionTitle)selectionLabel.textContent=selectionTitle;
  const count=Number(find<HTMLSelectElement>('match-size').value),bots=Number(find<HTMLSelectElement>('bot-count').value),selectedBots=bots<0?count-1:Math.min(bots,count-1);
  const factsText=state.phase?'ROUND '+state.round+' / '+state.rounds+' · '+(state.online?'ONLINE ROOM':'LOCAL PRACTICE'):'3 ROUNDS · 10 MINUTE FIELD · DOWNTOWN DETROIT';
  if(facts.textContent!==factsText)facts.textContent=factsText;
  const note=state.phase==='results'?(state.complete?'Three rounds complete. Start a new match when ready.':'Continue the match with your current rider and wheel.'):state.phase==='lobby'?'Share your invitation and ready up in Friends.':state.phase?(state.online?'Your online match continues while this menu is open.':'Local practice is paused. Return when you are ready.'):selectedBots===0?'Solo exploration · no AI opponents':`${count}-rider arena · you + ${selectedBots} AI opponent${selectedBots===1?'':'s'}`;
  if(brief.textContent!==note)brief.textContent=note;
  const label=(id:string)=>{const s=find<HTMLSelectElement>(id);return s.selectedOptions[0]?.textContent??'';};
  const key=label('skin')+'|'+label('wheel');if(key!==summary){summary=key;rider.textContent=label('skin');wheel.textContent=label('wheel');}
  // Invite/room errors remain visible in every section.
  message.hidden=!message.textContent;
 }
 root.addEventListener('change',sync);
 const observer=new MutationObserver(sync);for(const control of [practice,rematch,message])observer.observe(control,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});
 open('home',false);
 return {open,show(){open(readState().phase==='lobby'?'online':'home');},sync,get panel(){return current;}};
}
