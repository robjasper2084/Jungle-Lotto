import {RACE_ROUTE} from './raceRules.ts';
const artwork=new URL('../../public/art/swoop-rivals.webp',import.meta.url).href;
export function installLobby(elmwood:boolean,onRace:()=>void,onSplit:()=>void){
 const $=(id:string)=>document.getElementById(id)!;
 const menu=$('menu'),setup=menu.querySelector<HTMLElement>('.menuInner')!,board=$('districtBoard');
 menu.style.setProperty('--lobby-art',`url("${artwork}")`);
 const chrome=document.createElement('div');chrome.className='lobbyChrome';chrome.innerHTML='<a class="lobbyBrand" href="#" aria-label="Swoop Detroit home">SWOOP<span>DETROIT / ELECTRIC CULTURE</span></a><nav class="lobbyTabs" aria-label="Main menu"></nav><span class="offlineBadge"><i></i> RIDE YOUR CITY</span>';menu.prepend(chrome);
 const intro=document.createElement('div');intro.className='lobbyIntro';intro.innerHTML='<p class="lobbyKicker">FIND YOUR LINE. OWN THE CUT.</p>';intro.append($('menuTitle'),$('menuCopy'));menu.append(intro);
 setup.querySelector('.eyebrow')!.setAttribute('hidden','');
 const deck=document.createElement('div');deck.className='lobbyDeck';menu.append(deck);deck.append(setup,board);
 const setupHeading=document.createElement('h2');setupHeading.id='setupHeading';setup.prepend(setupHeading);
 const raceInfo=document.createElement('p');raceInfo.id='raceInfo';raceInfo.hidden=true;raceInfo.textContent=`4 RIDERS / ${Math.round(RACE_ROUTE.end-RACE_ROUTE.start)} METRES / ${RACE_ROUTE.gates.length} GATES. Southern Cut entrance to Mack Avenue. Marked slippery spots and optional jump ramps change each race. No time cutoff: finish the whole route. Recover at your last gate; the clock keeps running. Closed course, no pedestrian traffic. Works offline.`;setupHeading.after(raceInfo);
 const difficulty=document.createElement('label');difficulty.id='raceDifficultyLabel';difficulty.hidden=true;difficulty.innerHTML='RIVAL PACE<select id="raceDifficulty"><option value="cruise">Sport · up to 40 km/h</option><option value="club">Race · up to 62 km/h</option><option value="expert" selected>Expert · up to 70 km/h / competitive</option></select>';setup.querySelector('.options')!.append(difficulty);
 const splitSetup=document.createElement('div');splitSetup.id='splitSetup';splitSetup.hidden=true;
 splitSetup.innerHTML='<p>Two people. One screen. Southern Cut entrance to Mack Avenue. Marked slippery spots and optional jump ramps change each race. Cross every gate; the race ends when both riders finish. No time cutoff. Each rider has their own view, score and recovery. Riders have collision protection: leave room and steer around each other. Pause stops both clocks.</p><label>PLAYER 2 RIDER<select id="splitRider2" aria-label="Player 2 rider"></select></label><div class="splitSetupRow"><label>PLAYER 1 CONTROLS<select id="splitInput1" aria-label="Player 1 controls"></select></label><label>PLAYER 2 CONTROLS<select id="splitInput2" aria-label="Player 2 controls"></select></label></div><p>Keyboard: P1 uses WASD, Space to hop, R to recover. P2 uses arrows, Enter to hop, Backspace to recover. C / slash changes each camera. Each view has a 24 km/h cruise button. P or Escape pauses both. Controller: left stick / triggers ride, A hops, X recovers, Y changes view.</p><p>Local keyboard/controller play. Solo touch and VR modes remain available under Free ride. Match results do not change solo records or rewards.</p><p id="splitSetupError" role="status"></p>';
 const hero=$('heroSelect') as HTMLSelectElement,p2=splitSetup.querySelector<HTMLSelectElement>('#splitRider2')!;for(const option of hero.options)p2.append(option.cloneNode(true));p2.value=hero.value==='DS_Hoodie_Woman_01'?'DS_Man_01':'DS_Hoodie_Woman_01';
 for(const [i,id]of ['splitInput1','splitInput2'].entries()){const select=splitSetup.querySelector<HTMLSelectElement>('#'+id)!;for(const[value,label]of [['wasd','Keyboard · WASD'],['arrows','Keyboard · Arrow keys'],...Array.from({length:4},(_,n)=>['pad:'+n,'Controller '+(n+1)])]){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}select.value=i?'arrows':'wasd';}setup.querySelector('.options')!.after(splitSetup);
 const actions=document.createElement('div');actions.className='launchActions';actions.append($('start'),$('resumeRide'),$('enterVR'));setup.append(actions);
 const settings=document.createElement('div');settings.id='lobbySettings';settings.className='lobbyPanel';settings.innerHTML='<p class="eyebrow">MAKE IT YOUR RIDE</p><h2>Controls & VR</h2><p>Choose your steering, comfort speed and view. Your riding controls stay the same.</p>';
 settings.append(setup.querySelector('.vrControls')!,$('controllerStatus'));
 for(const hint of [...setup.querySelectorAll('.hint,.touchHint')])settings.append(hint);
 const garage=document.createElement('div');garage.id='lobbyGarage';garage.className='lobbyPanel';garage.innerHTML='<p class="eyebrow">YOUR OWN FREQUENCY</p><h2>Garage & soundtrack</h2>';
 garage.append($('rideGarage'),$('musicPanel'));garage.querySelectorAll('details').forEach(d=>d.open=true);
 deck.append(garage,settings);
 const footer=document.createElement('div');footer.className='lobbyFooter';footer.innerHTML='<span>ONE WHEEL. FOUR PERSONALITIES.</span><span>KEYBOARD / TOUCH / CONTROLLER / VR</span>';menu.append(footer);
 const mode=$('mode') as HTMLSelectElement;mode.closest('label')!.hidden=true;
 const tabs=chrome.querySelector('nav')!;
 const buttons=new Map<string,HTMLButtonElement>();
 const show=(tab:string)=>{
  menu.dataset.tab=tab;for(const [id,button]of buttons)button.setAttribute('aria-pressed',String(id===tab));
  setup.hidden=!['ride','race','split'].includes(tab);board.hidden=tab!=='challenges'||elmwood;garage.hidden=tab!=='garage';settings.hidden=tab!=='settings';
  intro.hidden=!['ride','race','split'].includes(tab);difficulty.hidden=tab!=='race';raceInfo.hidden=tab!=='race';splitSetup.hidden=tab!=='split';$('enterVR').hidden=tab==='split';
  $('spawn').closest('label')!.hidden=tab==='race'||tab==='split';$('companion').closest('label')!.hidden=tab==='race'||tab==='split';
  const practice=document.getElementById('practiceRoute');if(practice)practice.hidden=tab!=='race';
  setupHeading.textContent=tab==='split'?'Bring a friend. Pick your line.':tab==='race'?'Race the other riders.':'Your ride starts here.';
  if(tab==='ride'||tab==='race'||tab==='split'){
   mode.value=tab==='split'?'split':tab==='race'&&!elmwood?'race':'free';mode.dispatchEvent(new Event('change'));
   $('menuCopy').textContent=tab==='split'?'Two riders. Two views. One Detroit showdown.':tab==='race'?'Pick your rider. The other three are your competition.':elmwood?'Quiet lanes. Rolling hills. A ride at your own pace.':'Carve the Cut. Chase the skyline. Make every ride your own.';
   if(tab==='race'&&elmwood){raceInfo.textContent='Rival racing starts on the Dequindre Cut. Continue to the race setup, then choose your rider and pace.';$('start').textContent='GO TO THE CUT →';}
   $('start').onclick=tab==='split'?onSplit:tab==='race'?onRace:originalStart;
  }
  if(tab==='challenges'){mode.value='free';mode.dispatchEvent(new Event('change'));}
  menu.scrollTop=0;
 };
 const originalStart=$('start').onclick!;
 for(const [id,label]of [['ride','Free ride'],['race','Race rivals'],['split','2-player race'],['challenges','Challenges'],['garage','Garage + music'],['settings','Controls + VR']]){
  const button=document.createElement('button');button.textContent=label;button.dataset.lobbyTab=id;button.setAttribute('aria-pressed','false');button.onclick=()=>show(id);if(elmwood&&id==='challenges')button.hidden=true;buttons.set(id,button);tabs.append(button);
 }
 chrome.querySelector('a')!.onclick=e=>{e.preventDefault();show('ride');};
 $('menuButton').addEventListener('click',()=>show(['race','split'].includes(mode.value)?mode.value:'ride'));
 show(['race','split'].includes(new URLSearchParams(location.search).get('tab')??'')?new URLSearchParams(location.search).get('tab')!:'ride');
}
