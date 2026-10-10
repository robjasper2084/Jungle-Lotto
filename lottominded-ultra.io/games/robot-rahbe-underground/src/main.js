import {DEPTHS,floorY,checkpoint} from './world.js?v=2.0.1';
import {createSimulation,serialize,update,respawn,STEP} from './simulation.js?v=2.0.1';
import {Renderer,MANIFEST} from './render.js?v=2.0.1';
import {UPGRADES,COSTUMES,readProfile,buyUpgrade,seedForDay,recordRun} from './progression.js?v=2.0.1';
import {DetroitAudio} from './detroit-audio.js?v=2.0.1';
import {Input} from './input.js?v=2.0.1';
import {createMobileControls} from './mobile-controls.js?v=2.0.1';
import {locationAt} from './detroit-locations.js?v=2.0.1';
const $=id=>document.getElementById(id);
const DEBUG=new URLSearchParams(location.search).has('debug')&&['localhost','127.0.0.1'].includes(location.hostname);
const SAVE=DEBUG?'rahbe-underground-v1-debug':'rahbe-underground-v1';
let sim=createSimulation(),view,ready=false,accumulator=0,lastRevision=-1,lastHUD='',toastUntil=0,returnFocus=null,endingMode='',endingStarted=0;
const pending={jumpPressed:false,jumpReleased:false,interactPressed:false};
let soundEnabled=false,audioContext,arcadeVolume=.65,loadProgress=0,arcadeRunId='',arcadeBase={kills:0,seconds:0,bosses:0,completions:0};
const music=new DetroitAudio();const PROFILE='rahbe-underground-profile-v2';let profile=readProfile();try{profile=readProfile(JSON.parse(localStorage.getItem(PROFILE)||'{}'));}catch{}
const ARCADE_RUN=SAVE+'-arcade-run';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function readSave(){try{const data=JSON.parse(localStorage.getItem(SAVE));return data?.version===1?data:null;}catch{return null;}}
function save(){try{localStorage.setItem(SAVE,JSON.stringify(serialize(sim)));if(arcadeRunId)localStorage.setItem(ARCADE_RUN,JSON.stringify(arcadeStats()));}catch{/* Private mode and storage limits never prevent play. */}}
function arcadeStats(){return {runId:arcadeRunId,mode:sim.mode,score:sim.coins*100+(arcadeBase.kills+sim.kills)*250,kills:arcadeBase.kills+sim.kills,shards:sim.coins,seconds:arcadeBase.seconds+Math.floor(sim.time),depth:sim.reached,seals:sim.world.seals.filter(x=>x.taken).length,bosses:Math.max(arcadeBase.bosses,sim.world.boss.hp<=0?1:0),completions:Math.max(arcadeBase.completions,sim.mode==='won'?1:0)};}
function beginArcadeRun(continuing){let old=null;try{old=continuing?JSON.parse(localStorage.getItem(ARCADE_RUN)):null;}catch{}arcadeRunId=typeof old?.runId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(old.runId)?old.runId:crypto.randomUUID();arcadeBase=Object.fromEntries(['kills','seconds','bosses','completions'].map(k=>[k,Math.max(0,Math.min(1e8,Number(old?.[k])||0))]));if(continuing){arcadeBase.kills=Math.max(0,arcadeBase.kills-sim.kills);arcadeBase.seconds=Math.max(0,arcadeBase.seconds-Math.floor(sim.time));}}
function tone(kind){if(soundEnabled&&sim.mode!=='paused')music.effect(kind,arcadeVolume);}
function toast(message){if(!message)return;$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3400;}
function updateVisibility(){
  const title=sim.mode==='title',ending=['won','dead'].includes(sim.mode),active=!title&&!ending;
  $('title-screen').hidden=!title;$('hud').hidden=!active;$('ending').hidden=!ending;$('game-hint').hidden=!active;
  $('touch').hidden=!active||!(matchMedia('(any-pointer:coarse)').matches||window.innerWidth<900||new URLSearchParams(location.search).has('touch'));
  input.deck?.setActive(sim.mode==='playing');
  document.body.classList.toggle('playing',!title);
  if(title){$('continue').hidden=!readSave();$('context').hidden=true;$('boss-hud').hidden=true;}
  if(ending){$('context').hidden=true;$('boss-hud').hidden=true;}
}
function start(continuing=false,options={}){
  if(!ready)return;sim=createSimulation(continuing?readSave():null,options);beginArcadeRun(continuing);sim.mode='playing';accumulator=0;lastHUD='';lastRevision=-1;endingMode='';input.clear();input.enabled=true;view.reset(sim);$('panel').close();updateVisibility();game.canvas.focus();toast(continuing?'Expedition resumed.':'W · JUMP   SPACE · CLIMB / GRAB   MOUSE · FIRE');save();
}
function closePanel(){if($('panel').open)$('panel').close();if(sim.mode==='paused')sim.mode='playing';input.enabled=true;input.clear();updateVisibility();(returnFocus?.offsetParent?returnFocus:game.canvas)?.focus();}
function openPanel(label,html){returnFocus=document.activeElement;input.clear();input.enabled=false;if(sim.mode==='playing')sim.mode='paused';$('panel-label').textContent=label;$('panel-content').innerHTML=html;if(!$('panel').open)$('panel').showModal();$('close-panel').focus();}
function pause(force=false){if(!ready||!['playing','paused'].includes(sim.mode))return;if($('panel').open){if(!force)closePanel();return;}openPanel('EXPEDITION PAUSED',`<h2>Take a breath.</h2><p>${DEPTHS[sim.depth].name}. Your last access beacon is at depth ${String(sim.reached).padStart(2,'0')}.</p><div class="panel-actions"><button class="primary" id="resume">RESUME EXPEDITION ↗</button><button id="return-title">RETURN TO TITLE</button></div><p class="disclaimer">Progress saves on this browser at access beacons. Sound is opt-in.</p>`);$('resume').onclick=closePanel;$('return-title').onclick=()=>{save();toTitle();};}
function showMap(){if(!ready||sim.mode==='dead'||sim.mode==='won')return;if($('panel').open){closePanel();return;}const rows=DEPTHS.map((d,i)=>`<div class="map-row ${i===sim.depth?'active':''}"><span>${String(i).padStart(2,'0')}</span><strong>${d.name}<em style="display:block;font:11px monospace;color:#a6cbbf;margin-top:5px">${locationAt(i).name} · ${locationAt(i).street}</em></strong><small>${i===sim.depth?'YOU ARE HERE':i<=sim.reached?'EXPLORED':'UNEXPLORED'}</small></div>`).join('');openPanel('DEPTH MAP / DETROIT',`<h2>Seven floors.<br>One buried secret.</h2>${rows}<p>Number seals: ${sim.world.seals.map(x=>`${x.number} ${x.taken?'◆':'◇'}`).join(' &nbsp; ')}. Ladders run both ways. Return to earlier floors to recover a missed seal.</p><p>${locationAt(sim.depth).story}</p><p class="disclaimer">Real surface locations; fictional 2084 vaults. This compressed depth map is not a street or transit map. ${locationAt(sim.depth).fact} <a href="${locationAt(sim.depth).source}" target="_blank" rel="noopener">${locationAt(sim.depth).sourceName} ↗</a></p>`);}
function guide(){openPanel('FIELD GUIDE / CONTROLS',`<h2>Go deeper.<br>Keep your footing.</h2><div class="control-grid"><div><kbd>A D</kbd> / <kbd>← →</kbd> Move</div><div><kbd>W</kbd> / <kbd>K</kbd> Jump</div><div><kbd>SPACE</kbd> Climb up / <kbd>SPACE + S</kbd> Down</div><div><kbd>MOUSE LEFT</kbd> Hold to fire</div><div><kbd>SPACE</kbd> Grab / use</div><div><kbd>M</kbd> Map & field notes</div><div><kbd>ESC</kbd> / <kbd>P</kbd> Pause</div><div><kbd>↑ + J</kbd> Fire upward</div><div><kbd>SHIFT</kbd> Sprint</div><div><kbd>C</kbd> Crouch</div></div><p>Press Space near a rope’s lower end, then W to jump at the end of the swing. Press Space near a mine cart to ride; jump to leave. Cracked floors fall after a short delay. Train signals turn red before the train arrives: climb onto a ledge.</p><p>Find seals <b>03, 13, and 31</b> in the Dequindre Cut, Maintenance Tunnels, and Ancient Chamber. Use them at the final gate. Shoot cracked walls to find a secret treasure room. Access beacons restore two integrity cells, recharge installed shields, and offer relic upgrades. Use UPGRADES to buy piercing pulses, a signal shield or a stronger rope grip. Optional ledges hide bonus caches.</p><p>Touch: left thumb moves and climbs; right thumb aims independently. Hold either FIRE button to shoot, JUMP to leap, USE to grab ropes or carts and open the gate, CROUCH to duck, and SPRINT to run. The sliders button customizes 2 / 3 / 4 finger layouts, handedness, button position, size, opacity, and fixed or floating sticks. Your layout saves on this device.</p><p>Controller: left stick / D-pad to move and climb, right stick to aim, A to jump, X or RT to fire, Y to interact, B to crouch, left-stick click to sprint, Start to pause.</p><p class="disclaimer">Fictional arcade relics and number puzzles. No real lottery tickets, money, prizes, or redemption.</p>`);}
function toTitle(){if($('panel').open)$('panel').close();sim.mode='title';input.clear();input.enabled=true;endingMode='';updateVisibility();$('start').focus();}
function showEnding(){if(endingMode===sim.mode)return;endingMode=sim.mode;input.clear();const win=sim.mode==='won';if(win){profile=recordRun(sim,profile);try{localStorage.setItem(PROFILE,JSON.stringify(profile));}catch{}}$('ending-label').textContent=win?'EXPEDITION COMPLETE':'SIGNAL INTERRUPTED';$('ending-title').textContent=win?'The city remembers.':'Get back underground.';$('ending-text').textContent=win?`The Number Warden is silent. All three seals are recovered. ${sim.coins.toLocaleString()} relics secured · ${sim.secrets}/2 treasure caches · ${Math.floor(sim.time/60)}m ${Math.floor(sim.time%60)}s.`:`Your access beacon at ${DEPTHS[sim.reached].name} is still active. The vaults are waiting.`;$('replay').textContent=win?'ANOTHER DESCENT ↗':'RETRY FROM CHECKPOINT ↗';updateVisibility();$('replay').focus();}
function refreshHUD(){
  const p=sim.player;const key=[p.hp,sim.coins,sim.depth,sim.world.seals.map(x=>x.taken).join(),sim.world.boss.hp,sim.mode,sim.context].join('|');if(key===lastHUD)return;lastHUD=key;
  $('health').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i>=p.hp?'empty':''}"></i>`).join('');$('health').setAttribute('aria-label',`${p.hp} of 6 integrity cells`);$('loot').textContent=String(sim.coins).padStart(4,'0');$('depth-number').textContent=String(sim.depth).padStart(2,'0')+' / 06';$('depth-name').textContent=DEPTHS[sim.depth].name;$('objective').textContent=locationAt(sim.depth).name+' · '+DEPTHS[sim.depth].note;$('seals').textContent=sim.world.seals.map(x=>x.taken?'◆':'◇').join(' ');$('seals').setAttribute('aria-label',`${sim.world.seals.filter(x=>x.taken).length} of 3 number seals`);
  $('context').textContent=sim.context;$('context').hidden=!sim.context||sim.mode!=='playing';const b=sim.world.boss;$('boss-hud').firstElementChild.textContent='THE NUMBER WARDEN · PHASE '+(b.stage||1);$('boss-hud').hidden=!(b.active&&b.hp>0&&sim.mode==='playing'&&sim.depth===6);$('boss-health').style.width=(b.hp/b.maxHp*100)+'%';
}
const input=new Input({pause,map:showMap,start:()=>sim.mode==='title'?start():sim.mode==='paused'?closePanel():null,active:()=>sim.mode==='playing'});
input.aimFromPointer=e=>view?.aimFromScreen?.(e,sim);
function upgrades(){openPanel('RELIC WORKBENCH',`<h2>Build your signal.</h2><p>${sim.coins} relics available. Choose upgrades for this expedition.</p><div class="upgrade-list">${UPGRADES.map(u=>`<button data-upgrade="${u.id}" ${sim.upgrades[u.id]||sim.coins<u.price?'disabled':''}><strong>${u.name}</strong><span>${u.description}</span><em>${sim.upgrades[u.id]?'INSTALLED':u.price+' RELICS'}</em></button>`).join('')}</div><button id="shop-resume" class="primary">RETURN TO EXPEDITION ↗</button>`);document.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{if(buyUpgrade(sim,b.dataset.upgrade)){save();lastHUD='';upgrades();}});$('shop-resume').onclick=closePanel;}
$('upgrades').onclick=upgrades;
$('daily').onclick=()=>start(false,{mode:'daily',seed:seedForDay()});
$('records').onclick=()=>{const daily=profile.daily[String(seedForDay())];openPanel('EXPEDITION RECORDS',`<h2>Your Detroit legacy.</h2><p>${profile.runs} completed expeditions. ${profile.best?'Personal best: '+profile.best.seconds+' seconds.':'Finish a descent to set your first record.'}</p><p>${daily?'Today’s daily best: '+daily.seconds+' seconds.':'Daily Descent uses the same challenge seed for everyone today (UTC). Optional caches and patrol timings change each day.'}</p><p>${profile.last?.medals?.join(' · ')||'Explore both secret rooms and finish without losing your signal to earn medals.'}</p><h3>RAHBE costume</h3>${profile.unlocks.map(id=>`<button data-costume="${id}" aria-pressed="${profile.costume===id}">${COSTUMES[id]}</button>`).join('')}<p>Finish a descent for Riverwalk teal. Find both secret rooms in a completed run for Vault gold. Records and costumes save on this browser.</p>`);document.querySelectorAll('[data-costume]').forEach(b=>b.onclick=()=>{profile.costume=b.dataset.costume;try{localStorage.setItem(PROFILE,JSON.stringify(profile));}catch{}view.costume=profile.costume;closePanel();});};
let layoutWasPlaying=false;
createMobileControls(input,{pause:()=>pause(),edit:editing=>{
  if(editing){layoutWasPlaying=sim.mode==='playing';if(layoutWasPlaying)sim.mode='paused';input.enabled=false;input.clear();}
  else{if(layoutWasPlaying)sim.mode='playing';input.enabled=true;input.clear();updateVisibility();}
}});
$('title-depths').innerHTML=DEPTHS.map((d,i)=>`<li><span>${String(i).padStart(2,'0')}</span>${d.name}</li>`).join('');
$('start').onclick=()=>start();$('continue').onclick=()=>start(true);$('pause').onclick=()=>pause();$('map-button').onclick=showMap;$('howto').onclick=guide;$('close-panel').onclick=closePanel;$('panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('replay').onclick=()=>{if(sim.mode==='dead'){respawn(sim);endingMode='';view.reset(sim);input.clear();updateVisibility();game.canvas.focus();}else start();};$('home').onclick=toTitle;
$('sound').onclick=async()=>{soundEnabled=!soundEnabled;if(soundEnabled){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();music.ctx=audioContext;await music.enable();}catch{soundEnabled=false;toast('Audio is unavailable in this browser.');}}$('sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Disable sound':'Enable sound');tone('coin');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('shell').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}};
document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
window.addEventListener('resize',updateVisibility);window.addEventListener('pagehide',()=>{if(sim.mode!=='title')save();});
reduced.addEventListener('change',()=>{if(view)view.reduced=reduced.matches;});
class UndergroundScene extends Phaser.Scene{
  preload(){
    this.failed=[];this.load.on('loaderror',file=>this.failed.push(file.key));
    this.load.on('progress',progress=>{loadProgress=progress;$('start').textContent=`PREPARING VAULTS · ${Math.round(progress*100)}%`;});
    for(const [key,path]of Object.entries(MANIFEST))this.load.image(key,path);
  }
  async create(){
    if(this.failed.includes('rahbe')){$('start').textContent='SPRITE LOAD FAILED — RELOAD';toast('The original RAHBE sprite could not load. Reload this local page.');return;}
    const images={};for(const key of Object.keys(MANIFEST)){if(!this.failed.includes(key))images[key]=this.textures.get(key).getSourceImage();}
    view=new Renderer(images);document.body.dataset.renderer='canvas-2d';view.costume=profile.costume||'original';view.reset(sim);this.frameDelta=1/60;
    const extern=this.add.extern();extern.renderCanvas=renderer=>view.draw(renderer.currentContext,sim,this.scale.width,this.scale.height,this.frameDelta);
    ready=true;document.body.dataset.ready='true';document.body.dataset.missingAssets=this.failed.join(',');$('start').disabled=false;$('start').innerHTML='BEGIN DESCENT <span>↘</span>';game.canvas.tabIndex=0;game.canvas.setAttribute('aria-label','Game world. Use A D to move, W to jump, Space to climb or grab, left mouse button to fire.');updateVisibility();
  }
  update(_time,delta){
    if(!ready)return;this.frameDelta=Math.min(delta/1000,.1);const actions=input.read();
    for(const key of Object.keys(pending))pending[key]||=!!actions[key];
    if(sim.mode==='playing'){
      accumulator+=this.frameDelta;
      while(accumulator>=STEP){if(sim.hitStop>0&&!reduced.matches)sim.hitStop=Math.max(0,sim.hitStop-STEP);else{update(sim,{...actions,...pending},STEP);for(const key of Object.keys(pending))pending[key]=false;}accumulator-=STEP;}
    }else {accumulator=0;for(const key of Object.keys(pending))pending[key]=false;}
    for(const event of sim.events){tone(event.type);if(event.text&&event.type!=='hurt'&&event.type!=='depth')toast(event.text);if(event.type==='checkpoint'&&sim.mode==='playing'&&UPGRADES.some(u=>!sim.upgrades[u.id]))upgrades();}
    music.tick(sim,soundEnabled,arcadeVolume);
    sim.events=[];if(performance.now()>toastUntil)$('toast').classList.remove('visible');
    if(sim.saveRevision!==lastRevision&&sim.mode!=='title'){save();lastRevision=sim.saveRevision;}
    refreshHUD();if(sim.mode==='dead'||sim.mode==='won'){if(!endingStarted)endingStarted=performance.now();if(performance.now()-endingStarted>850)showEnding();}else endingStarted=0;
  }
}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:window.innerWidth,height:window.innerHeight,backgroundColor:'#09171b',scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},input:{keyboard:false,mouse:false,touch:false},audio:{noAudio:true},fps:{target:60,smoothStep:false},render:{antialias:true,roundPixels:false},scene:UndergroundScene,banner:false});
window.render_game_to_text=()=>JSON.stringify({title:'ROBOT RAHBE: UNDERGROUND',mode:sim.mode,depth:sim.depth,depthName:DEPTHS[sim.depth].name,location:locationAt(sim.depth).name,street:locationAt(sim.depth).street,hero:'ROBOT RAHBE',heroMotion:view?.heroMotion,villainMotions:view?.villainMotions,artwork:'Higgsfield Detroit sprite adventure',renderer:document.body.dataset.renderer,upgrades:sim.upgrades,runMode:sim.runMode,seed:sim.seed,bossStage:sim.world.boss.stage,missingAssets:document.body.dataset.missingAssets,player:{x:Math.round(sim.player.x),feetY:Math.round(sim.player.y),vx:Math.round(sim.player.vx),vy:Math.round(sim.player.vy),hp:sim.player.hp,action:sim.player.action,grounded:sim.player.grounded,rope:sim.player.rope,cart:sim.player.cart},reached:sim.reached,seals:sim.world.seals.filter(x=>x.taken).map(x=>x.number),relics:sim.coins,gateOpen:sim.world.gate.open,bossHP:sim.world.boss.hp,context:sim.context,coordinates:'World pixels; x right, y down; player y is feet.'});
// Deliberate test-only access; omitted on the ordinary player URL and on hosted builds.
if(DEBUG)window.__underground={get state(){return sim;},get input(){return input;},start,step:(actions={},frames=1)=>{for(let i=0;i<frames;i++)update(sim,{...actions,jumpPressed:i===0&&!!actions.jumpPressed,interactPressed:i===0&&!!actions.interactPressed});refreshHUD();},place:(depth,x)=>{Object.assign(sim.player,checkpoint(depth),{x:x??checkpoint(depth).x,vx:0,vy:0,grounded:true,rope:-1,cart:-1,invuln:1});sim.depth=depth;view.reset(sim);},snapshot:()=>serialize(sim)};



// Small optional adapter. The standalone game and its original save key still work.
window.RahbeArcadeGame={
 get ready(){return ready;},get progress(){return loadProgress;},getStats:arcadeStats,save,
 pause:()=>pause(true),resume:()=>{if(sim.mode==='paused')closePanel();},
 start:continuing=>start(continuing),
 applySettings:settings=>{soundEnabled=!!settings.sound;arcadeVolume=settings.volume??.65;if(view){view.reduced=reduced.matches||!!settings.reducedMotion||!!settings.reducedShake||settings.particles===false;view.highContrast=!!settings.highContrast;}document.body.classList.toggle('arcade-contrast',!!settings.highContrast);$('sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled&&!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch{soundEnabled=false;}}music.ctx=audioContext;},
 destroy:()=>{save();input.clear();input.enabled=false;audioContext?.close().catch(()=>{});game.destroy(true);}
};
