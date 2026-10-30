import './gameMenuHome.css';
import './presentationHud.ts';
import {makeWardrobePicker} from './wardrobePicker.ts';
type MenuHomeOptions={kind:'swoop'|'royale'|'elmwood';title:string;subtitle:string;tagline:string;description:string;play:HTMLButtonElement;resume?:HTMLButtonElement;rider?:HTMLSelectElement;configure:()=>void;settings:()=>void;online?:()=>void};
/** A small front door to the existing setup; keeps every gameplay/settings handler intact. */
export function gameMenuHome(root:HTMLElement,o:MenuHomeOptions){
 root.classList.add('game-main-menu');root.dataset.gameTheme=o.kind;
 const home=document.createElement('section');home.className='game-menu-home';home.setAttribute('aria-label',o.title+' main menu');
 const kicker=document.createElement('p');kicker.className='game-menu-kicker';kicker.textContent=o.tagline;
 const title=document.createElement('h1');title.textContent=o.title;const subtitle=document.createElement('span');subtitle.textContent=o.subtitle;title.append(subtitle);
 const description=document.createElement('p');description.className='game-menu-description';description.textContent=o.description;
 const nav=document.createElement('nav');nav.setAttribute('aria-label',o.title+' actions');
 const button=(text:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;nav.append(b);return b;};
 const open=(action:()=>void)=>{root.dataset.menuHome='false';action();root.scrollTop=0;};
 const resume=o.resume?button('Resume',()=>o.resume!.click()):null;
 const play=button(o.kind==='royale'?'Deploy · practice':'Start riding',()=>o.play.click());play.className='game-menu-play';
 button(o.kind==='royale'?'Loadout & match':'Choose your ride',()=>open(o.configure));
 if(o.online)button('Play with friends',()=>open(o.online!));
 button('Settings',()=>open(o.settings));
 const links=document.createElement('div');links.className='game-menu-worlds';links.setAttribute('aria-label','Other games');
 for(const [kind,label,url]of [['swoop','Swoop Detroit','../swoop-detroit/index.html'],['royale','Static Royale','../swoop-detroit/royale.html'],['elmwood','Elmwood Explorer','../elmwood-explorer/elmwood.html']])if(kind!==o.kind){const a=document.createElement('a');a.href=url;a.textContent=label+' ↗';links.append(a);}
 const note=document.createElement('p');note.className='game-menu-note';note.textContent=o.kind==='royale'?'3 ROUNDS / DOWNTOWN DETROIT':o.kind==='elmwood'?'QUIET LANES / YOUR OWN PACE':'DEQUINDRE CUT / ELECTRIC CULTURE';
 home.append(kicker,title,description,nav,links,note);
 const wardrobe=o.rider?makeWardrobePicker(o.rider):undefined;if(wardrobe)nav.before(wardrobe.root);
 if(o.kind==='swoop'){
  const identity=document.createElement('div');identity.className='swoop-menu-identity';
  const emblem=document.createElement('img');emblem.src=new URL('./art/swoop-insignia.webp',import.meta.url).href;emblem.alt='';emblem.width=144;emblem.height=96;emblem.decoding='async';
  const edition=document.createElement('p');edition.innerHTML='<strong>SWOOP / DETROIT</strong><span>ELECTRIC STREET CULTURE</span>';
  identity.append(emblem,edition);home.prepend(identity);
  const route=document.createElement('div');route.className='swoop-menu-route';route.setAttribute('aria-label','Explore the Detroit riverfront and Dequindre Cut');
  route.innerHTML='<span>RIVERFRONT</span><i aria-hidden="true"></i><span>DEQUINDRE CUT</span>';description.after(route);
  nav.classList.add('swoop-menu-actions');
  for(const b of Array.from(nav.children) as HTMLButtonElement[])b.dataset.menuAction=b===play?'ride':b===resume?'resume':b.textContent==='Choose your ride'?'customize':b.textContent==='Play with friends'?'friends':'settings';
  note.textContent='ONE WHEEL. YOUR CITY.';
 }
 const back=document.createElement('button');back.className='game-menu-back';back.textContent='← Main menu';back.onclick=()=>{root.dataset.menuHome='true';root.scrollTop=0;play.focus({preventScroll:true});};root.prepend(back,home);root.dataset.menuHome='true';
 const sync=()=>{if(resume){resume.hidden=!!o.resume?.hidden||!!o.resume?.disabled;resume.classList.toggle('game-menu-play',!resume.hidden);play.classList.toggle('game-menu-play',resume.hidden);}play.disabled=o.play.disabled;if(o.play.disabled)play.textContent='Preparing your game…';else play.textContent=o.kind==='royale'?'Deploy · practice':o.play.textContent?.includes('race')?'Start race':'Start riding';};sync();
 if(o.resume)new MutationObserver(sync).observe(o.resume,{attributes:true,attributeFilter:['hidden','disabled']});
 new MutationObserver(sync).observe(o.play,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});
 // Opening via an existing Settings/Online shortcut must reveal its destination.
 root.addEventListener('focusin',e=>{const target=e.target as HTMLElement;if(!home.contains(target)&&target!==back)root.dataset.menuHome='false';});
 return {show(){wardrobe?.update();root.dataset.menuHome='true';root.scrollTop=0;play.focus({preventScroll:true});}};
}
