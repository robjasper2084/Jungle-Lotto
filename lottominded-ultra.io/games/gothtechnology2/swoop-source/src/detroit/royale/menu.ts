import {menuAction,menuPresentation,type RoyaleMenuState} from './menuState.ts';
import {makeWardrobePicker} from '../wardrobePicker.ts';
import './menu.css';
import '../presentationHud.ts';
import './tacticalReadout.css';
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
 const resultBlock=node('section','royale-round-summary');resultBlock.setAttribute('aria-label','Round results');resultBlock.append(node('h2','','Round results'),results);home.append(resultBlock);
 // Replays remain available after the re-entry window closes, before results.
 const replayBlock=node('div','royale-replay-action');replayBlock.append(replay);home.append(replayBlock);
 const selection=node('section','royale-selection');selection.setAttribute('aria-label','Selected rider and wheel');
 const rider=node('strong',''),wheel=node('span',''),selectionLabel=node('span','royale-selection-label','YOUR LOADOUT');selection.append(selectionLabel,rider,wheel);home.append(selection);
 const wardrobe=makeWardrobePicker(find<HTMLSelectElement>('skin'));selection.before(wardrobe.root);
 home.insertBefore(resultBlock,action);
 home.insertBefore(replayBlock,brief.nextSibling);
 const leave=node('div','royale-leave');leave.append(quit);home.append(leave);
 const panels=new Map<RoyaleMenuPanel,HTMLElement>([['home',home],['loadout',setup]]);
 for(const [id,title,detail]of [['online','Play with friends',online],['settings','Settings',settings]] as const){const section=node('section','royale-menu-panel');const h=node('h2','royale-panel-title',title);section.append(h,detail);if(id==='online')section.append(room);panels.set(id,section);detail.open=true;}
 setup.classList.add('royale-menu-panel');
 const notice=node('p','royale-next-match','Rider and wheel selections apply to your next match.');setup.querySelector('.setup-heading')!.after(notice);
 const sourceActions=node('div','royale-action-sources');sourceActions.hidden=true;sourceActions.append(resume,rematch);
 // Only long instructions collapse; existing settings and binding nodes stay live.
 const guide=node('details','royale-controls-guide');guide.append(node('summary','','Controls guide'));
 for(const p of [...settings.children])if(p.tagName==='P')guide.append(p);settings.append(guide);
 // Move existing controls, never clone them: listeners and saved values stay intact.
 const setting=(id:string)=>settings.querySelector<HTMLElement>('#'+id)!;
 const camera=setting('camera-settings');camera.querySelector('legend')!.textContent='Your view';
 const groups=node('div','royale-settings-groups');camera.after(groups);
 const fold=(title:string,items:HTMLElement[])=>{const d=node('details','royale-settings-group');d.append(node('summary','',title),...items);groups.append(d);return d;};
 for(const f of [...camera.children])if(f.tagName==='FIELDSET')fold(f.querySelector('legend')?.textContent??'Camera options',[f as HTMLElement]);
 const take=(ids:string[])=>ids.map(id=>setting(id)).filter(Boolean).map(e=>e.closest('label')??e) as HTMLElement[];
 fold('Aim sensitivity & sights',take(['aim-sensitivity','ads-sensitivity','aim-preset']));
 fold('Touch controls & layout',take(['touch-display','stick-mode','touch-lean','touch-aim','layout','button-size','reset-layout']));
 const graphics=setting('graphics-settings');fold('Graphics & performance',[graphics]);
 const intro=node('p','royale-settings-intro','Choose your riding and on-foot views. Open a group below to fine-tune your controls.');camera.before(intro);
 content.replaceChildren(...panels.values(),sourceActions,message);
 let current:RoyaleMenuPanel='home';
 for(const [id,p]of panels){p.id='royale-panel-'+id;p.tabIndex=-1;p.hidden=id!=='home';}
 function open(id:RoyaleMenuPanel='home',focus=true){current=id;root.dataset.royalePanel=id;for(const [key,p]of panels)p.hidden=key!==id;for(const [key,b]of tabs){if(key===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}online.open=settings.open=true;root.scrollTop=0;content.scrollTop=0;sync();if(focus)(id==='home'?action:panels.get(id)!).focus({preventScroll:true});}
 let summary='';
 function sync(){
  wardrobe.update();
  const state=readState(),choice=menuAction(state);
  const phase=state.phase??'idle';if(root.dataset.royalePhase!==phase)root.dataset.royalePhase=phase;
  if(action.textContent!==choice.label)action.textContent=choice.label;
  action.disabled=choice.disabled||(choice.action==='practice'&&practice.disabled);
  if(!state.phase&&practice.disabled)action.textContent='Preparing arena…';
  training.hidden=!!state.phase;resultBlock.hidden=state.phase!=='results';replayBlock.hidden=replay.hidden;quit.hidden=!state.phase;
  practice.hidden=!!state.phase;const practiceNote=setup.querySelector<HTMLElement>('.lobby-practice-note');if(practiceNote)practiceNote.hidden=!!state.phase;
  const selectionTitle=state.phase?'NEXT MATCH LOADOUT':'YOUR LOADOUT';if(selectionLabel.textContent!==selectionTitle)selectionLabel.textContent=selectionTitle;
  const count=Number(find<HTMLSelectElement>('match-size').value),bots=Number(find<HTMLSelectElement>('bot-count').value),selectedBots=bots<0?count-1:Math.min(bots,count-1);
  const copy=menuPresentation(state,selectedBots);
  if(facts.textContent!==copy.facts)facts.textContent=copy.facts;
  if(brief.textContent!==copy.brief)brief.textContent=copy.brief;
  const caption=root.querySelector<HTMLElement>('.lobby-world-caption');
  if(caption)for(const [selector,text]of [['span',copy.captionLabel],['strong',copy.captionTitle],['p',copy.captionDetail]]){const part=caption.querySelector(selector);if(part&&part.textContent!==text)part.textContent=text;}
  const label=(id:string)=>{const s=find<HTMLSelectElement>(id);return s.selectedOptions[0]?.textContent??'';};
  const key=label('skin')+'|'+label('wheel');if(key!==summary){summary=key;rider.textContent=label('skin');wheel.textContent=label('wheel');}
  // Invite/room errors remain visible in every section.
  message.hidden=!message.textContent;
 }
 root.addEventListener('change',sync);
 const observer=new MutationObserver(sync);for(const control of [practice,rematch,message])observer.observe(control,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});
 observer.observe(replay,{attributes:true,attributeFilter:['hidden']});
 open('home',false);
 return {open,show(){open(readState().phase==='lobby'?'online':'home');},sync,get panel(){return current;}};
}
