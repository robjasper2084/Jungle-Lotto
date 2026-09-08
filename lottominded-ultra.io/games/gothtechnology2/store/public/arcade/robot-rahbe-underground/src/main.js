import {DEPTHS,floorY,checkpoint} from './world.js';
import {createSimulation,serialize,update,respawn,STEP} from './simulation.js';
import {Renderer,MANIFEST} from './render.js';
import {Input} from './input.js';
import {locationAt} from './detroit-locations.js';
import {DISCOUNT_TIERS,readDiscountPreview,bankGameProgress} from './discount-preview.js';
const $=id=>document.getElementById(id);
const DEBUG=new URLSearchParams(location.search).has('debug')&&['localhost','127.0.0.1'].includes(location.hostname);
const SAVE=DEBUG?'rahbe-underground-v1-debug':'rahbe-underground-v1';
let sim=createSimulation(),view,ready=false,accumulator=0,lastRevision=-1,lastHUD='',toastUntil=0,returnFocus=null,endingMode='',endingStarted=0;
const pending={jumpPressed:false,jumpReleased:false,interactPressed:false};
let soundEnabled=false,audioContext,arcadeVolume=.65,loadProgress=0,arcadeRunId='',arcadeBase={kills:0,seconds:0,bosses:0,completions:0};
const ARCADE_RUN=SAVE+'-arcade-run';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');

function discountDetails(){
  const state=readDiscountPreview();
  return `<h2>Play toward 20% off.</h2><p>All-games total: <b>${state.totalPoints.toLocaleString('en-US')} points</b> · <b>${state.percent}% discount preview</b>.</p>${DISCOUNT_TIERS.map(tier=>`<div class="map-row ${state.totalPoints>=tier.points?'active':''}"><strong>${tier.percent}%</strong><span>${tier.points.toLocaleString('en-US')} points</span><small>${state.totalPoints>=tier.points?'REACHED':'TARGET'}</small></div>`).join('')}<p>Each relic unit is worth 100 points, plus 250 per defeated enemy. Pickups contain 10 relic units. Seals, treasure caches, and the Warden add bonus relics. Points from Underground, Shadow Ops, Vault Rush, and GOTHTECHNOLOGY add together. New runs contribute; a resumed run counts only new points.</p><p class="disclaimer">Discount preview only. Redemption is not connected. ${state.saved?'Shared points saved on this browser.':'Session only; browser storage is unavailable.'} No purchase required. Collectibles have no cash value.</p>`;
}
function readSave(){try{const data=JSON.parse(localStorage.getItem(SAVE));return data?.version===1?data:null;}catch{return null;}}
function save(){if(!DEBUG)void bankGameProgress('underground',arcadeStats());try{localStorage.setItem(SAVE,JSON.stringify(serialize(sim)));if(arcadeRunId)localStorage.setItem(ARCADE_RUN,JSON.stringify(arcadeStats()));}catch{/* Private mode and storage limits never prevent play. */}}
function arcadeStats(){return {runId:arcadeRunId,mode:sim.mode,score:sim.coins*100+(arcadeBase.kills+sim.kills)*250,kills:arcadeBase.kills+sim.kills,shards:sim.coins,seconds:arcadeBase.seconds+Math.floor(sim.time),depth:sim.reached,seals:sim.world.seals.filter(x=>x.taken).length,bosses:Math.max(arcadeBase.bosses,sim.world.boss.hp<=0?1:0),completions:Math.max(arcadeBase.completions,sim.mode==='won'?1:0)};}
function beginArcadeRun(continuing){let old=null;try{old=continuing?JSON.parse(localStorage.getItem(ARCADE_RUN)):null;}catch{}arcadeRunId=typeof old?.runId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(old.runId)?old.runId:crypto.randomUUID();arcadeBase=Object.fromEntries(['kills','seconds','bosses','completions'].map(k=>[k,Math.max(0,Math.min(1e8,Number(old?.[k])||0))]));}
function tone(kind){
  if(!soundEnabled||!audioContext||arcadeVolume<=0||sim.mode==='paused')return;
  const frequencies={shoot:220,jump:320,coin:830,seal:660,hurt:80,enemy:120,gate:150,treasure:780,'boss-down':480,checkpoint:510,rope:280,cart:110};
  if(!frequencies[kind])return;const now=audioContext.currentTime;const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=kind==='shoot'?'triangle':kind==='hurt'?'sawtooth':'sine';osc.frequency.setValueAtTime(frequencies[kind],now);osc.frequency.exponentialRampToValueAtTime(frequencies[kind]*(kind==='jump'?2:kind==='hurt'?.4:1.3),now+.12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime((kind==='shoot'?.028:.07)*arcadeVolume,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(now+.22);
}
function toast(message){if(!message)return;$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3400;}
function updateVisibility(){
  const title=sim.mode==='title',ending=['won','dead'].includes(sim.mode),active=!title&&!ending;
  $('title-screen').hidden=!title;$('hud').hidden=!active;$('ending').hidden=!ending;$('game-hint').hidden=!active;
  $('touch').hidden=!active||!(matchMedia('(pointer:coarse)').matches||window.innerWidth<900);
  document.body.classList.toggle('playing',!title);
  if(title){$('continue').hidden=!readSave();$('context').hidden=true;$('boss-hud').hidden=true;}
  if(ending){$('context').hidden=true;$('boss-hud').hidden=true;}
}
function start(continuing=false){
  if(!ready)return;beginArcadeRun(continuing);sim=createSimulation(continuing?readSave():null);sim.mode='playing';accumulator=0;lastHUD='';lastRevision=-1;endingMode='';input.clear();input.enabled=true;view.reset(sim);$('panel').close();updateVisibility();game.canvas.focus();toast(continuing?'Expedition resumed. Find the next access ladder.':'DESCEND BENEATH DETROIT · W / S to climb. M opens your map.');save();
}
function closePanel(){if($('panel').open)$('panel').close();if(sim.mode==='paused')sim.mode='playing';input.enabled=true;input.clear();updateVisibility();(returnFocus?.offsetParent?returnFocus:game.canvas)?.focus();}
function openPanel(label,html){returnFocus=document.activeElement;input.clear();input.enabled=false;if(sim.mode==='playing')sim.mode='paused';$('panel-label').textContent=label;$('panel-content').innerHTML=html;if(!$('panel').open)$('panel').showModal();$('close-panel').focus();}
function pause(force=false){if(!ready||!['playing','paused'].includes(sim.mode))return;if($('panel').open){if(!force)closePanel();return;}openPanel('EXPEDITION PAUSED',`<h2>Take a breath.</h2><p>${DEPTHS[sim.depth].name}. Your last access beacon is at depth ${String(sim.reached).padStart(2,'0')}.</p><div class="panel-actions"><button class="primary" id="resume">RESUME EXPEDITION ↗</button><button id="return-title">RETURN TO TITLE</button></div><p class="disclaimer">Progress saves on this browser at access beacons. Sound is opt-in.</p>`);$('resume').onclick=closePanel;$('return-title').onclick=()=>{save();toTitle();};}
function showMap(){if(!ready||sim.mode==='dead'||sim.mode==='won')return;if($('panel').open){closePanel();return;}const rows=DEPTHS.map((d,i)=>`<div class="map-row ${i===sim.depth?'active':''}"><span>${String(i).padStart(2,'0')}</span><strong>${d.name}<em style="display:block;font:11px monospace;color:#a6cbbf;margin-top:5px">${locationAt(i).name} · ${locationAt(i).street}</em></strong><small>${i===sim.depth?'YOU ARE HERE':i<=sim.reached?'EXPLORED':'UNEXPLORED'}</small></div>`).join('');openPanel('DEPTH MAP / DETROIT',`<h2>Seven floors.<br>One buried secret.</h2>${rows}<p>Number seals: ${sim.world.seals.map(x=>`${x.number} ${x.taken?'◆':'◇'}`).join(' &nbsp; ')}. Ladders run both ways. Return to earlier floors to recover a missed seal.</p><p>${locationAt(sim.depth).story}</p><p class="disclaimer">Real surface locations; fictional 2084 vaults. This compressed depth map is not a street or transit map. ${locationAt(sim.depth).fact} <a href="${locationAt(sim.depth).source}" target="_blank" rel="noopener">${locationAt(sim.depth).sourceName} ↗</a></p>`);}
function guide(){openPanel('FIELD GUIDE / CONTROLS',`<h2>Go deeper.<br>Keep your footing.</h2><div class="control-grid"><div><kbd>A D</kbd> / <kbd>← →</kbd> Move</div><div><kbd>SPACE</kbd> / <kbd>K</kbd> Jump</div><div><kbd>W S</kbd> / <kbd>↑ ↓</kbd> Climb</div><div><kbd>J</kbd> / <kbd>X</kbd> Hold to fire</div><div><kbd>E</kbd> / <kbd>F</kbd> Grab / use</div><div><kbd>M</kbd> Map & field notes</div><div><kbd>ESC</kbd> / <kbd>P</kbd> Pause</div><div><kbd>↑ + J</kbd> Fire upward</div></div><p>Grab a rope near its lower end, then jump at the end of the swing. Press E near a mine cart to ride; jump to leave. Cracked floors fall after a short delay. Train signals turn red before the train arrives: climb onto a ledge.</p><p>Find seals <b>03, 13, and 31</b> in the Subway, Maintenance Tunnels, and Ancient Chamber. Use them at the final gate. Shoot cracked walls to find a secret treasure room. Access beacons restore two integrity cells and save your depth.</p><p>Controller: left stick / D-pad to move and climb, A to jump, X or RT to fire, Y / B to interact, Start to pause. Touch controls appear on smaller screens.</p><p class="disclaimer">Fictional arcade relics and number puzzles. No real lottery tickets, money, prizes, or redemption.</p>`);}
function toTitle(){if($('panel').open)$('panel').close();sim.mode='title';input.clear();input.enabled=true;endingMode='';updateVisibility();$('start').focus();}
function showEnding(){if(endingMode===sim.mode)return;endingMode=sim.mode;input.clear();const win=sim.mode==='won';$('ending-label').textContent=win?'EXPEDITION COMPLETE':'SIGNAL INTERRUPTED';$('ending-title').textContent=win?'The city remembers.':'Get back underground.';$('ending-text').textContent=win?`The Number Warden is silent. All three seals are recovered. ${sim.coins.toLocaleString()} relics secured · ${sim.secrets}/2 treasure caches · ${Math.floor(sim.time/60)}m ${Math.floor(sim.time%60)}s.`:`Your access beacon at ${DEPTHS[sim.reached].name} is still active. The vaults are waiting.`;$('replay').textContent=win?'ANOTHER DESCENT ↗':'RETRY FROM CHECKPOINT ↗';updateVisibility();$('replay').focus();}
function refreshHUD(){
  const score=arcadeStats().score;
  const p=sim.player;const key=[p.hp,sim.coins,sim.kills,sim.depth,sim.world.seals.map(x=>x.taken).join(),sim.world.boss.hp,sim.mode,sim.context].join('|');if(key===lastHUD)return;lastHUD=key;
  $('health').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i>=p.hp?'empty':''}"></i>`).join('');$('health').setAttribute('aria-label',`${p.hp} of 6 integrity cells`);$('loot').textContent=score.toLocaleString('en-US');$('depth-number').textContent=String(sim.depth).padStart(2,'0')+' / 06';$('depth-name').textContent=DEPTHS[sim.depth].name;$('objective').textContent=locationAt(sim.depth).name+' · '+DEPTHS[sim.depth].note;$('seals').textContent=sim.world.seals.map(x=>x.taken?'◆':'◇').join(' ');$('seals').setAttribute('aria-label',`${sim.world.seals.filter(x=>x.taken).length} of 3 number seals`);
  $('context').textContent=sim.context;$('context').hidden=!sim.context||sim.mode!=='playing';const b=sim.world.boss;$('boss-hud').hidden=!(b.active&&b.hp>0&&sim.mode==='playing'&&sim.depth===6);$('boss-health').style.width=(b.hp/b.maxHp*100)+'%';
}
const input=new Input({pause,map:showMap,start:()=>sim.mode==='title'?start():sim.mode==='paused'?closePanel():null,active:()=>sim.mode==='playing'});
$('title-depths').innerHTML=DEPTHS.map((d,i)=>`<li><span>${String(i).padStart(2,'0')}</span>${d.name}</li>`).join('');
$('discount-info').onclick=()=>openPanel('GAME DISCOUNT / PREVIEW',discountDetails());
$('start').onclick=()=>start();$('continue').onclick=()=>start(true);$('pause').onclick=()=>pause();$('map-button').onclick=showMap;$('howto').onclick=guide;$('close-panel').onclick=closePanel;$('panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('replay').onclick=()=>{if(sim.mode==='dead'){respawn(sim);endingMode='';view.reset(sim);input.clear();updateVisibility();game.canvas.focus();}else start();};$('home').onclick=toTitle;
$('sound').onclick=async()=>{soundEnabled=!soundEnabled;if(soundEnabled){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();}catch{soundEnabled=false;toast('Audio is unavailable in this browser.');}}$('sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Disable sound':'Enable sound');tone('coin');};
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
  create(){
    if(this.failed.includes('rahbe')){$('start').textContent='SPRITE LOAD FAILED — RELOAD';toast('The original RAHBE sprite could not load. Reload this local page.');return;}
    const images={};for(const key of Object.keys(MANIFEST)){if(!this.failed.includes(key))images[key]=this.textures.get(key).getSourceImage();}
    view=new Renderer(images);view.reset(sim);this.frameDelta=1/60;
    const extern=this.add.extern();extern.renderCanvas=renderer=>view.draw(renderer.currentContext,sim,this.scale.width,this.scale.height,this.frameDelta);
    ready=true;document.body.dataset.ready='true';document.body.dataset.missingAssets=this.failed.join(',');$('start').disabled=false;$('start').innerHTML='BEGIN DESCENT <span>↘</span>';game.canvas.tabIndex=0;game.canvas.setAttribute('aria-label','Game world. Use A D to move, Space to jump, W S to climb, J to fire, E to interact.');updateVisibility();
  }
  update(_time,delta){
    if(!ready)return;this.frameDelta=Math.min(delta/1000,.1);const actions=input.read();
    for(const key of Object.keys(pending))pending[key]||=!!actions[key];
    if(sim.mode==='playing'){
      accumulator+=this.frameDelta;
      while(accumulator>=STEP){update(sim,{...actions,...pending},STEP);for(const key of Object.keys(pending))pending[key]=false;accumulator-=STEP;}
    }else {accumulator=0;for(const key of Object.keys(pending))pending[key]=false;}
    for(const event of sim.events){tone(event.type);if(event.text&&event.type!=='hurt'&&event.type!=='depth')toast(event.text);}
    sim.events=[];if(performance.now()>toastUntil)$('toast').classList.remove('visible');
    if(sim.saveRevision!==lastRevision&&sim.mode!=='title'){save();lastRevision=sim.saveRevision;}
    refreshHUD();if(sim.mode==='dead'||sim.mode==='won'){if(!endingStarted)endingStarted=performance.now();if(performance.now()-endingStarted>850)showEnding();}else endingStarted=0;
  }
}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:window.innerWidth,height:window.innerHeight,backgroundColor:'#09171b',scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},input:{keyboard:false,mouse:false,touch:false},audio:{noAudio:true},fps:{target:60,smoothStep:false},render:{antialias:true,roundPixels:false},scene:UndergroundScene,banner:false});
window.render_game_to_text=()=>JSON.stringify({title:'ROBOT RAHBE: UNDERGROUND',mode:sim.mode,depth:sim.depth,depthName:DEPTHS[sim.depth].name,location:locationAt(sim.depth).name,street:locationAt(sim.depth).street,hero:'ROBOT RAHBE',heroMotion:view?.heroMotion,villainMotions:view?.villainMotions,artwork:'Higgsfield Detroit 2.5D',missingAssets:document.body.dataset.missingAssets,player:{x:Math.round(sim.player.x),feetY:Math.round(sim.player.y),vx:Math.round(sim.player.vx),vy:Math.round(sim.player.vy),hp:sim.player.hp,action:sim.player.action,grounded:sim.player.grounded,rope:sim.player.rope,cart:sim.player.cart},reached:sim.reached,seals:sim.world.seals.filter(x=>x.taken).map(x=>x.number),relics:sim.coins,gateOpen:sim.world.gate.open,bossHP:sim.world.boss.hp,context:sim.context,coordinates:'World pixels; x right, y down; player y is feet.'});
// Deliberate test-only access; omitted on the ordinary player URL and on hosted builds.
if(DEBUG)window.__underground={get state(){return sim;},start,step:(actions={},frames=1)=>{for(let i=0;i<frames;i++)update(sim,{...actions,jumpPressed:i===0&&!!actions.jumpPressed,interactPressed:i===0&&!!actions.interactPressed});refreshHUD();},place:(depth,x)=>{Object.assign(sim.player,checkpoint(depth),{x:x??checkpoint(depth).x,vx:0,vy:0,grounded:true,rope:-1,cart:-1,invuln:1});sim.depth=depth;view.reset(sim);},snapshot:()=>serialize(sim)};



// Small optional adapter. The standalone game and its original save key still work.
window.RahbeArcadeGame={
 get ready(){return ready;},get progress(){return loadProgress;},getStats:arcadeStats,save,
 pause:()=>pause(true),resume:()=>{if(sim.mode==='paused')closePanel();},
 start:continuing=>start(continuing),
 applySettings:settings=>{soundEnabled=!!settings.sound;arcadeVolume=settings.volume??.65;if(view){view.reduced=reduced.matches||!!settings.reducedMotion||!!settings.reducedShake||settings.particles===false;view.highContrast=!!settings.highContrast;}document.body.classList.toggle('arcade-contrast',!!settings.highContrast);$('sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled&&!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch{soundEnabled=false;}}},
 destroy:()=>{save();input.clear();input.enabled=false;audioContext?.close().catch(()=>{});game.destroy(true);}
};
