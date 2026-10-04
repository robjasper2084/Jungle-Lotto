import {RACE_ROUTE} from './raceRules.ts';
import {CHALLENGES} from './district.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
const artwork=new URL('../../public/art/swoop-rivals.webp',import.meta.url).href;
export function installLobby(elmwood:boolean,onRace:()=>void,onSplit:()=>void){
 const $=(id:string)=>document.getElementById(id)!;
 const menu=$('menu'),setup=menu.querySelector<HTMLElement>('.menuInner')!,board=$('districtBoard');
 for(const [id,label]of [['heroSelect','Your rider'],['companion','Bring a companion'],['spawn','Starting point']])$(id).closest('label')!.firstChild!.textContent=label;
 ($('companion') as HTMLSelectElement).options[0].textContent='Bring your dog (Boerboel)';
 menu.style.setProperty('--lobby-art',`url("${artwork}")`);
 const chrome=document.createElement('div');chrome.className='lobbyChrome';chrome.innerHTML='<a class="lobbyBrand" href="#" aria-label="Swoop Detroit home">SWOOP<span>DETROIT / ELECTRIC CULTURE</span></a><nav class="lobbyTabs" aria-label="Main menu"></nav><span class="offlineBadge"><i></i> RIDE YOUR CITY</span>';menu.prepend(chrome);
 const intro=document.createElement('div');intro.className='lobbyIntro';intro.innerHTML='<p class="lobbyKicker">FIND YOUR LINE. OWN THE CUT.</p>';intro.append($('menuTitle'),$('menuCopy'));menu.append(intro);
 setup.querySelector('.eyebrow')!.setAttribute('hidden','');
 const deck=document.createElement('div');deck.className='lobbyDeck';menu.append(deck);deck.append(setup,board);
 const setupHeading=document.createElement('h2');setupHeading.id='setupHeading';setup.prepend(setupHeading);
 const raceInfo=document.createElement('p');raceInfo.id='raceInfo';raceInfo.hidden=true;raceInfo.textContent=`Race 3 computer riders to Mack Avenue. Follow ${RACE_ROUTE.gates.length} gates over ${Math.round((RACE_ROUTE.end-RACE_ROUTE.start)/100)/10} km. Take your time — there is no time limit. If you fall, Recover returns you to your last gate.`;setupHeading.after(raceInfo);
 const difficulty=document.createElement('label');difficulty.id='raceDifficultyLabel';difficulty.hidden=true;difficulty.innerHTML='Race difficulty<select id="raceDifficulty"><option value="cruise" selected>Easy · relaxed rivals</option><option value="club">Medium · faster rivals</option><option value="expert">Hard · competitive rivals</option></select>';setup.querySelector('.options')!.append(difficulty);
 const splitSetup=document.createElement('div');splitSetup.id='splitSetup';splitSetup.hidden=true;
 splitSetup.innerHTML='<p>Two people. One screen. Southern Cut entrance to Mack Avenue. Marked slippery spots and optional jump ramps change each race. Cross every gate; the race ends when both riders finish. No time cutoff. Each rider has their own view, score and recovery. Riders have collision protection: leave room and steer around each other. Pause stops both clocks.</p><label>PLAYER 2 RIDER<select id="splitRider2" aria-label="Player 2 rider"></select></label><div class="splitSetupRow"><label>PLAYER 1 CONTROLS<select id="splitInput1" aria-label="Player 1 controls"></select></label><label>PLAYER 2 CONTROLS<select id="splitInput2" aria-label="Player 2 controls"></select></label></div><p>Keyboard: P1 uses WASD, Space to hop, R to recover. P2 uses arrows, Enter to hop, Backspace to recover. C / slash changes each camera. Each view has a 24 km/h cruise button. P or Escape pauses both. Controller: left stick / triggers ride, A hops, X recovers, Y changes view.</p><p>Local keyboard/controller play. Solo touch and VR modes remain available under Free ride. Match results do not change solo records or rewards.</p><p id="splitSetupError" role="status"></p>';
 const hero=$('heroSelect') as HTMLSelectElement,p2=splitSetup.querySelector<HTMLSelectElement>('#splitRider2')!;for(const option of hero.options)p2.append(option.cloneNode(true));p2.value=hero.value==='DS_Hoodie_Woman_01'?'DS_Man_01':'DS_Hoodie_Woman_01';
 for(const [i,id]of ['splitInput1','splitInput2'].entries()){const select=splitSetup.querySelector<HTMLSelectElement>('#'+id)!;for(const[value,label]of [['wasd','Keyboard · WASD'],['arrows','Keyboard · Arrow keys'],...Array.from({length:4},(_,n)=>['pad:'+n,'Controller '+(n+1)])]){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}select.value=i?'arrows':'wasd';}setup.querySelector('.options')!.after(splitSetup);
 const countLabel=document.createElement('label');countLabel.textContent='How many players?';const count=document.createElement('select');count.id='splitPlayerCount';count.setAttribute('aria-label','Number of split-screen players');for(const n of [2,3,4])count.add(new Option(n+' players',String(n)));count.value='2';countLabel.append(count);
 const sessionLabel=document.createElement('label');sessionLabel.textContent='SPLIT-SCREEN MODE';const session=document.createElement('select');session.id='splitSessionMode';session.setAttribute('aria-label','Split-screen mode');session.add(new Option('Free ride / selected starting location','free'));session.add(new Option('Race / Cut to Mack','race'));for(const c of CHALLENGES)session.add(new Option(c.title+' / '+c.kind,c.id));session.value='race';sessionLabel.append(session);splitSetup.prepend(countLabel,sessionLabel);
 for(const n of [3,4]){const row=document.createElement('div');row.className='splitSetupRow';row.dataset.splitSlot=String(n);const riderLabel=document.createElement('label');riderLabel.textContent='PLAYER '+n+' RIDER';const rider=document.createElement('select');rider.id='splitRider'+n;rider.setAttribute('aria-label','Player '+n+' rider');for(const r of RIDER_CHOICES)rider.add(new Option(r.label,r.id));rider.value=RIDER_CHOICES[n-1].id;riderLabel.append(rider);const inputLabel=document.createElement('label');inputLabel.textContent='PLAYER '+n+' CONTROLS';const input=document.createElement('select');input.id='splitInput'+n;input.setAttribute('aria-label','Player '+n+' controls');inputLabel.append(input);row.append(riderLabel,inputLabel);splitSetup.append(row);}
 for(let n=1;n<=4;n++){const input=splitSetup.querySelector<HTMLSelectElement>('#splitInput'+n)!;input.replaceChildren();for(const[value,label]of [['wasd','Keyboard · WASD'],['arrows','Keyboard · Arrow keys'],['ijkl','Keyboard · IJKL'],['numpad','Keyboard · Number pad'],...Array.from({length:4},(_,i)=>['pad:'+i,'Controller '+(i+1)])])input.add(new Option(label,value));input.value=['wasd','arrows','ijkl','numpad'][n-1];}
 const splitCopy=splitSetup.querySelector('p')!;splitCopy.textContent='Play with 2–4 people on one screen. Each rider has separate controls, camera and progress. Choose Free ride, a race, or any Cut challenge. Races finish after everyone crosses the gates. Photo challenges require framing the actual subjects. Pause stops the local match.';
 const updateCount=()=>{for(const row of splitSetup.querySelectorAll<HTMLElement>('[data-split-slot]'))row.hidden=Number(row.dataset.splitSlot)>Number(count.value);};count.onchange=updateCount;updateCount();
 const splitHelp=document.createElement('details');splitHelp.className='lobbyDisclosure';splitHelp.innerHTML='<summary>How to play together</summary>';for(const p of [...splitSetup.querySelectorAll('p')].slice(1,3))splitHelp.append(p);splitSetup.append(splitHelp);
 const customize=document.createElement('details');customize.id='rideCustomize';customize.className='lobbyDisclosure';customize.innerHTML='<summary><span>Customize your ride</span><small>Rider, wheels & starting point</small></summary>';
 const customBody=document.createElement('div');customBody.className='lobbyDisclosureBody';customBody.append(setup.querySelector('.options')!,$('ride-vehicle').closest('.cycleOptions')!);customize.append(customBody);setup.append(customize);
 const actions=document.createElement('div');actions.className='launchActions';actions.append($('resumeRide'),$('start'));setupHeading.after($('setupSummary'),actions,$('startReason'));
 const places=document.createElement('details');places.id='ridePlaces';places.className='lobbyDisclosure';places.hidden=elmwood;places.innerHTML='<summary><span>Places & activities</span><small>Stores, skate park & landmark mission</small></summary>';
 const placeBody=document.createElement('div');placeBody.className='lobbyDisclosureBody';const placeButtons=document.createElement('div');placeButtons.className='lobbyPlaceButtons';placeBody.append(placeButtons);places.append(placeBody);setup.append(places);placeButtons.append($('community-start'));$('community-start').hidden=elmwood;
 const essentials=document.createElement('p');essentials.className='lobbyEssentials';essentials.innerHTML='<strong>You can go at your own pace.</strong> Pause or return to the menu at any time.';actions.after(essentials);
 const settings=document.createElement('div');settings.id='lobbySettings';settings.className='lobbyPanel';settings.innerHTML='<p class="eyebrow">MAKE IT YOUR RIDE</p><h2>Settings</h2><p>Choose your steering, comfort speed and view. Your riding controls stay the same.</p>';
 settings.append(setup.querySelector('.vrControls')!,$('enterVR'),$('controllerStatus'));
 for(const hint of [...setup.querySelectorAll('.hint,.touchHint')])settings.append(hint);
 const garage=document.createElement('div');garage.id='lobbyGarage';garage.className='lobbyPanel';garage.innerHTML='<p class="eyebrow">YOUR OWN FREQUENCY</p><h2>Garage & soundtrack</h2>';
 garage.append($('rideGarage'),$('musicPanel'));garage.querySelectorAll('details').forEach(d=>d.open=true);
 deck.append(garage,settings);
 const footer=document.createElement('div');footer.className='lobbyFooter';footer.innerHTML='<span>ONE WHEEL. FOUR PERSONALITIES.</span><span>KEYBOARD / TOUCH / CONTROLLER / VR</span>';menu.append(footer);
 const mode=$('mode') as HTMLSelectElement;mode.closest('label')!.hidden=true;
 const tabs=chrome.querySelector('nav')!;
 const more=document.createElement('details');more.className='lobbyMore';more.innerHTML='<summary>More <span aria-hidden="true">⌄</span></summary><div class="lobbyMoreItems"></div>';const moreItems=more.querySelector<HTMLElement>('.lobbyMoreItems')!;
 const buttons=new Map<string,HTMLButtonElement>();
 const show=(tab:string)=>{
  const changed=menu.dataset.tab!==tab;menu.dataset.tab=tab;for(const [id,button]of buttons)button.setAttribute('aria-pressed',String(id===tab));more.dataset.active=String(!['ride','race','split'].includes(tab));
  setup.hidden=!['ride','race','split'].includes(tab);board.hidden=tab!=='challenges'||elmwood;garage.hidden=tab!=='garage';settings.hidden=tab!=='settings';
  intro.hidden=!['ride','race','split'].includes(tab);difficulty.hidden=tab!=='race';raceInfo.hidden=tab!=='race';splitSetup.hidden=tab!=='split';$('enterVR').hidden=tab==='split';
  $('spawn').closest('label')!.hidden=tab==='race'||tab==='split'&&session.value!=='free';$('companion').closest('label')!.hidden=tab==='race'||tab==='split';
  const practice=document.getElementById('practiceRoute');if(practice)practice.hidden=tab!=='race';
  const learn=document.getElementById('learnRide');if(learn)learn.hidden=tab!=='ride';places.hidden=elmwood||tab!=='ride';essentials.hidden=tab!=='ride';if(changed)customize.open=tab==='race'||tab==='split';
  $('ride-vehicle').closest<HTMLElement>('.cycleOptions')!.hidden=tab==='split';customize.querySelector('summary small')!.textContent=tab==='split'?'Choose player 1 and your map':'Rider, wheels & starting point';
  setupHeading.textContent=tab==='split'?'Play on one screen.':tab==='race'?'Ready to race?':elmwood?'Explore Elmwood.':'Ready to ride?';
  if(tab==='ride'||tab==='race'||tab==='split'){
   mode.value=tab==='split'?'split':tab==='race'&&!elmwood?'race':'free';mode.dispatchEvent(new Event('change'));
   $('menuCopy').textContent=tab==='split'?'2–4 players. Share a screen with separate keyboards or controllers.':tab==='race'?'Follow the gates. Find your pace. Race to Mack Avenue.':elmwood?'Quiet lanes. Rolling hills. Explore at your own pace.':'Explore Detroit. Ride with your dog. Find your own adventure.';
   $('start').textContent=tab==='split'?'Start playing together →':tab==='race'?'Start race →':'Start riding →';
   if(tab==='race'&&elmwood){raceInfo.textContent='Rival racing starts on the Dequindre Cut. Continue to the race setup, then choose your rider and pace.';$('start').textContent='GO TO THE CUT →';}
   $('start').onclick=tab==='split'?()=>onSplit():tab==='race'?()=>onRace():originalStart;
  }
  if(tab==='challenges'){mode.value='free';mode.dispatchEvent(new Event('change'));}
  menu.scrollTop=0;
 };
 const originalStart=$('start').onclick!;
 session.onchange=()=>{if(menu.dataset.tab==='split')$('spawn').closest('label')!.hidden=session.value!=='free';};
 splitHelp.querySelector('p')!.textContent='P1: WASD / Space hop / R recover. P2: arrows / Enter hop / Backspace recover. P3: IJKL / U hop / Y recover. P4: number pad 8456 / 0 hop / 7 recover. Each view has Camera, Recover and Cruise controls. P or Escape pauses the local match. Controllers: left stick / triggers ride, A hops, X recovers, Y changes view.';
 for(const [id,label]of [['ride','Free ride'],['race','Race'],['split','Local split'],['challenges','Challenges'],['garage','Garage & music'],['settings','Settings']]){
  const button=document.createElement('button');button.textContent=label;button.dataset.lobbyTab=id;button.setAttribute('aria-pressed','false');button.onclick=()=>show(id);if(elmwood&&id==='challenges')button.hidden=true;buttons.set(id,button);(['ride','race','split'].includes(id)?tabs:moreItems).append(button);
 }
 const destination=document.createElement('button');destination.textContent=elmwood?'Dequindre Cut':'Elmwood Explorer';destination.setAttribute('aria-label',elmwood?'Switch to Dequindre Cut':'Explore Elmwood Cemetery');destination.onclick=()=>{const url=new URL(location.href);url.searchParams.delete('tab');if(elmwood)url.searchParams.delete('map');else url.searchParams.set('map','elmwood');location.assign(url.href);};moreItems.append(destination);tabs.append(more);
 more.addEventListener('keydown',e=>{if(e.key==='Escape'&&more.open){e.stopPropagation();more.open=false;more.querySelector('summary')!.focus();}});
 tabs.addEventListener('click',e=>{const target=e.target as HTMLElement;if(!target.closest('button'))return;const inside=more.contains(target);more.open=false;if(inside)more.querySelector('summary')!.focus();});
 document.addEventListener('pointerdown',e=>{if(!more.contains(e.target as Node))more.open=false;});
 chrome.querySelector('a')!.onclick=e=>{e.preventDefault();show('ride');};
 $('menuButton').addEventListener('click',()=>show(['race','split'].includes(mode.value)?mode.value:'ride'));
 show(['race','split'].includes(new URLSearchParams(location.search).get('tab')??'')?new URLSearchParams(location.search).get('tab')!:'ride');
 return {actions,placeButtons,placeBody,finish(){
  // Late-created features keep their existing click handlers when grouped here.
  for(const button of [...tabs.querySelectorAll<HTMLButtonElement>(':scope > button')])if(!['ride','race','split','online'].includes(button.dataset.lobbyTab??'')){moreItems.append(button);button.addEventListener('click',()=>{more.dataset.active='true';});}
 }};
}
