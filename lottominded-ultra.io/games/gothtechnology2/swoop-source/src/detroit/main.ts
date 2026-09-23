import {FrameSchedule} from './frameSchedule.ts';
import {PARK_SPAWN,buildFreestylePark,parkContains} from './freestylePark.ts';
import {windTime} from './windMotion.ts';
import {RouteSky,DAY_SUN,DUSK_SUN} from './routeSky.ts';
import {CourseFeatureView} from './courseFeatureView.ts';
import {AdaptiveQuality} from './adaptiveQuality.ts';
import {GalleryVisit} from './galleryVisit.ts';
import {destinationLayout} from './destinationLayout.ts';
import {RouteAmbience,cutEffectPatches} from './routeAmbience.ts';
import {RideConfirmation,RiderLamp} from './rideEffects.ts';
import {ContactEffects} from './contactEffects.ts';
import {SplitRaceSimulation} from './splitRaceSimulation.ts';
import {SplitRaceView} from './splitRaceView.ts';
import {SplitRideInput,splitSetupError,type SplitBinding} from './splitInput.ts';
import {EncounterWarning} from './encounterWarning.ts';
import {PracticeCoach} from './practiceCoach.ts';
import {RIDE_RULES,NeutralRearm} from './rideRules.ts';
import {RivalRace,installRaceUI} from './raceView.ts';
import {RACE_ROUTE,type RaceDifficulty} from './raceRules.ts';
import {installLobby} from './lobby.ts';
import {RideLoop} from './rideLoop.ts';
import {RideAudio} from './rideAudio.ts';
import {GamepadRideInput} from './gamepadInput.ts';
import {VRRide} from './vrRide.ts';
import {vrThrottle} from './xrInput.ts';
import {PedalSparks} from './pedalSparks.ts';
import {SPECIAL_MOVES} from './specialMoves.ts';
import {fallCameraOffset} from './fallMotion.ts';
import {TouchRideInput,bindTouchControls} from './touchInput.ts';
import {FollowCamera} from './followCamera.ts';
import {underpassCameraHeight} from './cameraClearance.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import { RideController,createPose,copyPose,lerpPose } from './controller.ts';
import { NEUTRAL_ACTIONS } from './controller.ts';
import { createGroundSample } from './terrain.ts';
import { DetroitWorld,SPOTS as MAP_SPOTS,LENGTH,clamp,cutCoords,locationAt } from './world.ts';
import { buildScenery } from './scenery.ts';
import { loadActors,Hero,TrafficView } from './actors.ts';
import {CHALLENGES,DistrictRun,photoAllowed,type Challenge} from './district.ts';
import {DistrictView,routePosition} from './districtView.ts';
import {DogFollower} from './companion.ts';
import {CompanionView} from './companionView.ts';
import './style.css';
import './lobby.css';
import './touchPolish.css';
import {GeoTerrain} from './geo-terrain.ts';
import {GEO,MAP_ORIGIN,toLocal,toMap,gpsAt} from './geo-profile.ts';
import {createRouteMap} from './routeMap.ts';
import {RIDER_CHOICES,riderChoice} from './riderChoices.ts';
import {ElmwoodWorld,ELM_SPOTS,ELM_PATHS,ELM_BOUNDARY,ELMWOOD_SOURCE,planPoint} from './elmwood.ts';
import {buildElmwood} from './elmwoodScenery.ts';
const elmwood=new URLSearchParams(location.search).get('map')==='elmwood';
const qaVisualBaseline=location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).has('qaVisualBaseline');
const bootStarted=performance.now();let loadedAt=0;const frameTimes:number[]=[];
const detailChoice=new URLSearchParams(location.search).get('quality')??'auto';
const compactElmwood=detailChoice==='compact'||(detailChoice!=='detailed'&&/OculusBrowser|Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
const SPOTS=(elmwood?ELM_SPOTS:[...MAP_SPOTS,PARK_SPAWN]).map(p=>({...p,...toLocal(p.x,0,p.z),heading:-p.heading}));

if(!elmwood){const end=routePosition(LENGTH);SPOTS.push({name:'Mack Avenue / Gallery arrival',x:end.x+Math.sin(end.heading)*2,y:end.y,z:end.z+Math.cos(end.heading)*2,heading:end.heading});}
if(!elmwood)for(const [name,store] of [['Serengeti Galleries forecourt',false],['GothTechnology store',true]] as const){const p=destinationLayout(store);SPOTS.push({name,x:p.local.x+Math.sin(p.heading)*14*p.scale,y:p.local.y,z:p.local.z+Math.cos(p.heading)*14*p.scale,heading:p.heading+Math.PI});}
const coarsePointer=matchMedia('(any-pointer: coarse)');document.documentElement.classList.toggle('touchDevice',coarsePointer.matches);coarsePointer.addEventListener('change',()=>document.documentElement.classList.toggle('touchDevice',coarsePointer.matches));
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=$<HTMLCanvasElement>('world');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
const adaptiveQuality=new AdaptiveQuality();const basePixelRatio=Math.min(devicePixelRatio,1.25);renderer.setPixelRatio(basePixelRatio);renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=elmwood?1.0:1.1;
const scene=new T.Scene();scene.background=new T.Color('#c9dce0');scene.fog=new T.Fog('#c9dce0',elmwood&&compactElmwood?65:130,elmwood&&compactElmwood?165:370);
const sky=new RouteSky();scene.add(sky);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.08,1500);
const pm=new T.PMREMGenerator(renderer);
if(elmwood){
  const hdr=await new HDRLoader().loadAsync('/textures/elmwood-library/forest_grove_2k.hdr');
  scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.55;hdr.dispose();
}else{const room=new RoomEnvironment();scene.environment=pm.fromScene(room,.03).texture;scene.environmentIntensity=.6;room.dispose();}
pm.dispose();
const hemi=new T.HemisphereLight('#d3e9f6','#7d7659',elmwood?.95:1.15),sun=new T.DirectionalLight('#ffe4b7',elmwood?2.5:2.0);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:36,bottom:-30,near:.1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(hemi,sun,sun.target);
const fill=new T.DirectionalLight('#c1d7ed',elmwood?.22:.55);scene.add(fill,fill.target);if(elmwood)scene.environmentIntensity=.4;
const mapWorld=elmwood?new ElmwoodWorld():new DetroitWorld(),world=new GeoTerrain(mapWorld);
const effectPatches=elmwood||qaVisualBaseline?[]:cutEffectPatches();
const contactEffects=qaVisualBaseline?undefined:new ContactEffects(scene,world,effectPatches);
const confirmation=new RideConfirmation(document.body),riderLamp=new RiderLamp(scene,world);let ambience:RouteAmbience|undefined;
function confirmRide(kind:string,text:string,token:string){if(confirmation.show(kind,text,token))rideAudio.confirm(kind);}
const mapScene=new T.Scene();scene.add(mapScene);mapScene.scale.x=-1;mapScene.position.set(MAP_ORIGIN.x,-MAP_ORIGIN.y,-MAP_ORIGIN.z);
const updateMap=elmwood?createElmwoodMap():createRouteMap();
function createElmwoodMap(){
  const svg=$('routeMap'),ns='http://www.w3.org/2000/svg';svg.setAttribute('viewBox','0 80 1220 580');svg.setAttribute('aria-label','Elmwood Cemetery garden lanes and rider position');
  const add=(tag:string,attrs:Record<string,string>)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
  add('polygon',{points:ELM_BOUNDARY.map(p=>p.join(',')).join(' '),fill:'#294a3b',stroke:'#8b9c7b','stroke-width':'4'});
  for(const path of ELM_PATHS)add('polyline',{points:path.samples.map(p=>{const q=planPoint(p.x,p.z);return q.x+','+q.z;}).join(' '),fill:'none',stroke:'#dacb99','stroke-width':'5'});
  for(const s of ELM_SPOTS){const p=planPoint(s.x,s.z);add('circle',{cx:String(p.x),cy:String(p.z),r:'8',fill:'#89c9bd'});}
  const dot=add('circle',{r:'11',fill:'#fff',stroke:'#183d35','stroke-width':'3'});
  return(x:number,z:number)=>{const p=planPoint(x,z);dot.setAttribute('cx',String(p.x));dot.setAttribute('cy',String(p.z));};
}
// Map changes reload only the selected environment; rider/dog preferences persist.
function mapChooser(){const label=document.createElement('label');label.textContent='MAP ';const select=document.createElement('select');select.setAttribute('aria-label','Choose riding map');for(const[value,name]of [['cut','Dequindre Cut'],['elmwood','Elmwood Cemetery']]){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}select.value=elmwood?'elmwood':'cut';select.onchange=()=>{const url=new URL(location.href);if(select.value==='elmwood')url.searchParams.set('map','elmwood');else url.searchParams.delete('map');location.assign(url.href);};label.append(select);return label;}
if(elmwood){const label=document.createElement('label');label.textContent='VISUAL DETAIL';const select=document.createElement('select');select.setAttribute('aria-label','Visual detail');for(const[value,title]of [['auto','Automatic'],['detailed','Detailed - PC'],['compact','Lighter - Quest / mobile']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}select.value=detailChoice;select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('quality',select.value);location.assign(url.href);};label.append(select);document.querySelector('.options')!.append(label);}
document.querySelector('.options')!.prepend(mapChooser());$('mapPanel').querySelector('h2')!.after(mapChooser());
let hero!:Hero,traffic:TrafficView,scenery:Awaited<ReturnType<typeof buildScenery>|ReturnType<typeof buildElmwood>>,sim:RideController;
let actorData:Awaited<ReturnType<typeof loadActors>>,selectedRider=riderChoice(null);
try{selectedRider=riderChoice(localStorage.getItem('digital-static-rider'));}catch{}
for(const r of RIDER_CHOICES){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;$('heroSelect').append(o);}
$<HTMLSelectElement>('heroSelect').value=selectedRider;
function setRider(value:string){
  if(running&&(challengeRun||race||split)&&!finished){if($('menu').hidden){$<HTMLSelectElement>('heroSelect').value=selectedRider;toast('Open the menu to choose a different rider and start a new attempt.');return;}stopRace();challengeRun=undefined;district.setRun();running=false;$('resumeRide').hidden=true;}
  selectedRider=riderChoice(value);$<HTMLSelectElement>('heroSelect').value=selectedRider;
  $('riderQuick').textContent=RIDER_CHOICES.find(r=>r.id===selectedRider)!.label;
  if(actorData){const board=hero?.skateboarding??false;hero?.dispose();hero=new Hero(actorData,world,selectedRider);hero.skateboarding=board;hero.apply(pose);scene.add(hero.root);if(sim){sim.wheelScale=hero.wheelScale;sim.mountedVolume=hero.mountedVolume;loop.startRun(undefined,selectedRider,actorData,current);}}
  canvas.dataset.hero=selectedRider;try{localStorage.setItem('digital-static-rider',selectedRider);}catch{}
}
const dog=new DogFollower(world),dogPose={...dog.current};let dogView:CompanionView;
const current=createPose(),previous=createPose(),pose=createPose();
const follow=new FollowCamera(world),ground=createGroundSample();
let ready=false,running=false,paused=false,clock=0,acc=0,last=performance.now(),mode='free',selectedSpot=elmwood?0:1,gate=0,score=0,finished=false,lastTraffic=0;
let challengeRun:DistrictRun|undefined,photoPending=false;
world.extraActors=()=>[...(race?.obstacles()??[]),...(running&&dogEnabled&&!split?[{id:'companion',x:dog.current.x,y:dog.current.y,z:dog.current.z,radius:.36,height:.85,kind:'dog',vx:Math.sin(dog.current.heading)*dog.current.speed,vz:Math.cos(dog.current.heading)*dog.current.speed}]:[])];
mapWorld.crowdActors=()=>running&&dogEnabled&&!split?[{id:'companion',...toMap(dog.current.x,dog.current.y,dog.current.z),radius:.36,height:.85,kind:'dog',vx:-Math.sin(dog.current.heading)*dog.current.speed,vz:Math.cos(dog.current.heading)*dog.current.speed}]:[];
let race:RivalRace|undefined;let practice:PracticeCoach|undefined;const encounterWarning=new EncounterWarning();
let split:{simulation:SplitRaceSimulation;view:SplitRaceView;input:SplitRideInput;audio:RideAudio}|undefined;
function stopSplit(){if(!split)return;split.view.dispose();void split.audio.dispose();split=undefined;document.body.classList.remove('splitPlaying');delete canvas.dataset.splitRace;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);hero.root.visible=true;dogView.root.visible=dogEnabled;}
function stopRace(){stopSplit();race?.dispose();race=undefined;document.body.classList.remove('racing');}
function recoverSplit(index:number){if(!split||paused)return;if(split.simulation.recover(index)){split.input.clear(index);split.view.recovered(index);canvas.focus();}}
function cruiseSplit(index:number){if(!split||paused||finished||split.simulation.rules.countdown>0||split.simulation.riders[index].sim.crashed||split.simulation.rules.racers[index].finish!==null)return;split.input.toggleCruise(index);canvas.focus();}
function startSplit(){
 if(!ready||vr.active)return;
 if(elmwood){const url=new URL(location.href);url.searchParams.delete('map');url.searchParams.set('tab','split');location.assign(url.href);return;}
 const second=riderChoice($<HTMLSelectElement>('splitRider2').value),bindings=[$<HTMLSelectElement>('splitInput1').value,$<HTMLSelectElement>('splitInput2').value] as [SplitBinding,SplitBinding];
 const error=selectedRider===second?'Choose a different rider for Player 2.':splitSetupError(bindings,Array.from(navigator.getGamepads?.()??[]));$('splitSetupError').textContent=error;if(error)return;
 stopRace();practice=undefined;$('practiceHUD').hidden=true;challengeRun=undefined;district.setRun();loop.stopReplay(false);loop.flow.cancel();mode='split';reset(selectedSpot,RACE_ROUTE.start);mapWorld.updateTraffic(0,1e8,1e8);mapWorld.step();
 const simulation=new SplitRaceSimulation(world,[selectedRider,second]),input=new SplitRideInput(bindings),audio=new RideAudio();
 const view=new SplitRaceView(scene,simulation,actorData,bindings,{pause,restart:startSplit,menu:()=>$('menuButton').click(),recover:recoverSplit,cruise:cruiseSplit,camera:i=>{split?.view.toggleCamera(i);canvas.focus();}},effectPatches,[rideAudio,audio]);
 split={simulation,input,view,audio};loop.startRun(undefined,selectedRider,actorData,current);beginRide();document.body.classList.add('splitPlaying');hero.root.visible=false;dogView.root.visible=false;traffic.update(mapWorld.traffic.map(t=>({...t,...toLocal(t.x,t.y,t.z),heading:-t.heading})),0);contactEffects?.reset();confirmation.reset();pedalSparks.reset();void audio.enable(!muted);canvas.focus();
}
function startRace(){if(!ready)return;practice=undefined;$('practiceHUD').hidden=true;if(elmwood){const url=new URL(location.href);url.searchParams.delete('map');url.searchParams.set('tab','race');location.assign(url.href);return;}stopRace();challengeRun=undefined;district.setRun();mode='race';reset(selectedSpot,RACE_ROUTE.start);mapWorld.updateTraffic(0,1e8,1e8);mapWorld.step();race=new RivalRace(scene,world,actorData,selectedRider,$<HTMLSelectElement>('raceDifficulty').value as RaceDifficulty,sim);loop.startRun(undefined,selectedRider,actorData,current);beginRide();document.body.classList.add('racing');setCamera('chase');toast('Rivals ready · follow the gates to Mack Avenue. No time cutoff.');}
function finishRace(){if(!race||finished)return;finished=true;clearInput();if(race.rules.player.finish!==null)loop.flow.bank();else loop.flow.cancel();score=loop.flow.banked;race.finish(score);}

let trickRequest=0,selectedTrick=1;
const deviceRearm=new NeutralRearm();
let inputDevice:'keyboard'|'touch'|'gamepad'|'vr'='keyboard';
let handledCrash=0;
let cameraMode='chase',firstYaw=0,firstPitch=-.10,orbitYaw=0,orbitHeight=2.2,orbitDistance=5,night=false,cruise=false,hop=false,resetPressed=false,muted=false;
try{muted=localStorage.getItem('digital-static-ride-sound')==='off';}catch{}
let dogEnabled=true;try{dogEnabled=localStorage.getItem('digital-static-companion')!=='solo';}catch{}
$<HTMLSelectElement>('companion').value=dogEnabled?'dog':'solo';
function setCompanion(enabled:boolean){
  const changed=dogEnabled!==enabled;dogEnabled=enabled;$<HTMLSelectElement>('companion').value=enabled?'dog':'solo';
  $('dogToggle').textContent=enabled?'Dog on':'Dog off';$('dogToggle').setAttribute('aria-pressed',String(enabled));
  if(dogView){dogView.root.visible=enabled;if(enabled&&changed)dog.reset(current);}
  try{localStorage.setItem('digital-static-companion',enabled?'dog':'solo');}catch{}
}
const keys=new Set<string>(),touch=new TouchRideInput(),padInput=new GamepadRideInput();
const controllerStatus=document.createElement('small');controllerStatus.id='controllerStatus';controllerStatus.setAttribute('role','status');controllerStatus.textContent='Controller: connect USB/Bluetooth, then press a button.';$('start').after(controllerStatus);
const resetTouch=bindTouchControls(touch,()=>ready&&running&&!paused&&!finished&&!sim.crashed,action=>{if(action==='recover')queueRecovery();else requestTrick();});
const rideAudio=new RideAudio(),pedalSparks=new PedalSparks(scene);
function showAudioState(){const button=$('audio');button.textContent=muted?'Sound off':rideAudio.state.context==='suspended'?'Tap for sound':'Sound on';button.setAttribute('aria-pressed',String(!muted));button.title='Motor, pedal scrape and high-speed warning beeps';}
// Starting/resuming is a user gesture: unlock Web Audio here on phones and desktop.
function unlockRideAudio(){void rideAudio.enable(!muted).then(showAudioState).catch(()=>{muted=true;void rideAudio.enable(false);showAudioState();});showAudioState();}
showAudioState();
function clearInput(){
 split?.input.clear();
 trickRequest=0;keys.clear();resetTouch();hop=false;resetPressed=false;cruise=false;acc=0;
 deviceRearm.interrupt();clearCameraTouches();encounterWarning.reset();toastUntil=0;$('toast').hidden=true;
 $('stickThumb').style.transform='translate(-50%,-50%)';
}
function remount(){
 sim.writePose(current);copyPose(current,previous);copyPose(current,pose);clearInput();
 follow.reset(current);orbitDistance=5;orbitHeight=2.2;firstYaw=0;firstPitch=-.10;
 if(!vr.active)setCamera('chase');hero.apply(pose);contactEffects?.reset();confirmation.reset();pedalSparks.reset();loop.flow.cancel();
 canvas.focus();
}
function crashEntry(){
 const count=sim.snapshot().crashes;if(count===handledCrash)return;handledCrash=count;
 clearInput();loop.flow.cancel();pedalSparks.reset();contactEffects?.reset();confirmation.reset();toast('Fall · recover when ready');
}
function recoveryLabel(){return inputDevice==='gamepad'?'Recover · X / Square':inputDevice==='keyboard'?'Recover · R':'Recover';}

function queueRecovery(){
 if(!ready||!running)return;
 if(split){recoverSplit(0);return;}
 if(race&&finished){startRace();return;}
 if(challengeRun&&!finished){const c=challengeRun,station=c.gateCount?c.challenge.gates[c.gateCount-1]+.5:c.challenge.start,p=routePosition(station);if(!sim.recover({position:{...p,y:world.sampleGround(p.x,p.z,ground).height},headingY:p.heading})){toast('Recovery space occupied · wait, then try again');return;}c.step(1/120,{station,offset:0,speed:0,grounded:true,crashed:false,roll:0,slip:0,traction:0,airHeight:0,recovered:true});remount();toast('Recovered at checkpoint · continue to Mack Avenue');return;}
 if(race){
  const r=race.rules.player,station=r.gate?RACE_ROUTE.gates[r.gate-1]+.5:RACE_ROUTE.start,p=routePosition(station);
  if(!sim.recover({position:{...p,y:world.sampleGround(p.x,p.z,ground,current.y).height},headingY:p.heading})){toast('Recovery space occupied · wait, then try again');return;}
  // Only rebase progress after placement succeeds. No gate award or clock rewind.
  race.rules.recover(selectedRider);
 }else if(!sim.recover()){toast('Recovery space occupied · wait, then try again');return;}
 remount();toast(race?'Recovered · race clock keeps running':paused?'Recovered · Resume when ready':'Recovered · release controls, then ride');
}

function reset(spot=selectedSpot,station?:number){
  gallery?.reset();boutique?.reset();
  if(!elmwood){const seed=challengeRun?.challenge.id.startsWith('daily-')?[...challengeRun.challenge.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,23):crypto.getRandomValues(new Uint32Array(1))[0];mapWorld.setHazards(seed,station??cutCoords(toMap(SPOTS[spot].x,0,SPOTS[spot].z).x,toMap(SPOTS[spot].x,0,SPOTS[spot].z).z).d,mode==='race'||mode==='split'||!!challengeRun?.challenge.features);courseView.set(mapWorld.courseFeatures);canvas.dataset.hazards=JSON.stringify({seed,count:mapWorld.hazards.length,features:mapWorld.courseFeatures});}
  mapWorld.clearRecoverySpace();mapWorld.rideIntent={speed:0,heading:0};
  if(hero)hero.skateboarding=false;sitButton.disabled=false;sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');boardButton.textContent='Switch to skateboard';boardButton.setAttribute('aria-pressed','false');
  selectedSpot=spot;const s=station===undefined?SPOTS[spot]:routePosition(station);sim.reset({position:{x:s.x,y:world.sampleGround(s.x,s.z,ground).height,z:s.z},headingY:s.heading});
  sim.writePose(current);copyPose(current,previous);copyPose(current,pose);follow.reset(current);
  dog.reset(current);pedalSparks.reset();contactEffects?.reset();confirmation.reset();
  handledCrash=0;clock=0;lastTraffic=0;const p=toMap(s.x,0,s.z);mapWorld.updateTraffic(0,p.x,p.z);mapWorld.step();gate=0;score=0;finished=false;acc=0;clearInput();$('paused').hidden=true;
}
function beginRide(){unlockRideAudio();loop.music.unlock();document.body.classList.add('playing');setCompanion($<HTMLSelectElement>('companion').value==='dog');running=true;paused=false;photoPending=false;$('menu').hidden=true;$('mapPanel').hidden=true;$('helpPanel').hidden=true;$('pause').textContent='Pause';$('paused').hidden=true;$('status').textContent='';$('run').textContent=challengeRun?.progress??'FREE RIDE';canvas.focus();}
function start(){if(!ready)return;practice=undefined;$('practiceHUD').hidden=true;const selected=$<HTMLSelectElement>('mode').value;if(selected==='race'){startRace();return;}if(selected==='split'){startSplit();return;}stopRace();if(selected!=='free'){startChallenge(CHALLENGES.find(c=>c.kind===selected)!);return;}challengeRun=undefined;district.setRun();mode='free';selectedSpot=Number($<HTMLSelectElement>('spawn').value);reset();loop.startRun(undefined,selectedRider,actorData,current);beginRide();setCamera('chase');}
function startChallenge(c:Challenge){if(!ready)return;practice=undefined;$('practiceHUD').hidden=true;stopRace();district.selected=c.id;mode=c.kind;challengeRun=new DistrictRun(c);reset(selectedSpot,c.start);district.setRun(challengeRun);loop.startRun(c,selectedRider,actorData,current);if(c.id.startsWith('daily-')&&night)toggleLight();beginRide();setCamera(c.kind==='discovery'?'photo':'chase');toast(c.kind==='trial'?'GO · Follow the gold gates. Brake for people.':c.description);}
function freeRideHere(){mapWorld.courseFeatures=[];courseView.set([]);canvas.dataset.hazards=JSON.stringify({seed:mapWorld.hazardSeed,count:mapWorld.hazards.length,features:[]});practice=undefined;practiceHUD.hidden=true;stopRace();challengeRun=undefined;district.setRun();mode='free';finished=false;paused=false;clearInput();loop.startRun(undefined,selectedRider,actorData,current);beginRide();setCamera('chase');$<HTMLSelectElement>('mode').value='free';district.filter('free');}
function completeChallenge(){if(finished||!challengeRun)return;if(challengeRun.failed&&sim.crashed){const cause=sim.crashCause;challengeRun.reason=cause==='collision'?'Collision. Leave room for other path users and brake before obstacles. Retry / N starts immediately.':cause==='hard landing'?'Hard landing. Use a smaller hop and absorb the touchdown with a crouch. Retry / N starts immediately.':cause==='sideways landing'?'Sideways landing. Align the wheel with your direction of travel before touchdown. Retry / N starts immediately.':cause==='trail boundary'?'Outside the rideable trail. Follow the marked line. Retry / N starts immediately.':cause+'. Retry / N starts immediately.';}finished=true;clearInput();if(challengeRun.failed)loop.flow.cancel();district.finish(challengeRun);loop.finish(challengeRun,current);}
const district=new DistrictView(scene,startChallenge,()=>loop.retry(),freeRideHere,()=>setCamera('photo'),()=>{photoPending=true;canvas.focus();});
const loop=new RideLoop(scene,district,world,elmwood?'elmwood':'cut',startChallenge,freeRideHere,toast);
if(elmwood){$('districtBoard').hidden=true;$<HTMLSelectElement>('mode').innerHTML='<option value="free">Free ride</option>';$('menuCopy').textContent='Explore the garden lanes, pond and wooded grounds of Elmwood Cemetery. Choose your rider and optional Boerboel companion.';document.querySelector('.eyebrow')!.textContent='DETROIT • ELMWOOD CEMETERY';document.title='Elmwood Cemetery • Swoop . Detroit';$('mapPanel').querySelector('small')!.textContent='Paths traced from the official cemetery plan. Heights, vegetation and individual monuments are approximate; this is a game environment.';const source=$('mapPanel').querySelector('a')!;source.href=ELMWOOD_SOURCE;source.textContent='Official Elmwood plan ↗';}
const crashOverlay=document.createElement('section');crashOverlay.id='crashOverlay';crashOverlay.hidden=true;crashOverlay.setAttribute('aria-label','Crash recovery');
const crashCopy=document.createElement('p');crashCopy.textContent='Take a breath. Your banked points are safe.';
const crashRecover=document.createElement('button');crashRecover.id='crashRecover';crashRecover.textContent='Recover';crashRecover.onclick=queueRecovery;crashOverlay.append(crashCopy,crashRecover);document.body.append(crashOverlay);
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')inputDevice='touch';},{passive:true});
const mapRecover=document.createElement('button');mapRecover.textContent='Recover rider';mapRecover.onclick=queueRecovery;$('mapPanel').append(mapRecover);
const mobileMap=document.createElement('button');mobileMap.textContent='Map';mobileMap.id='mobileMap';mobileMap.onclick=()=>{$('map').click();$('ridingOptions').classList.remove('expanded');$('optionsToggle').setAttribute('aria-expanded','false');};$('ridingOptions').append(mobileMap);
const trickSelect=document.createElement('select');trickSelect.id='trickSelect';trickSelect.setAttribute('aria-label','Special move');
for(const move of SPECIAL_MOVES){const option=document.createElement('option');option.value=String(move.id);option.textContent=move.name;trickSelect.append(option);}
$('ridingOptions').append(trickSelect);
function chooseTrick(id:number){selectedTrick=id;trickSelect.value=String(id);for(const button of document.querySelectorAll<HTMLElement>('[data-touch-action="trick"]'))button.textContent='Trick · '+SPECIAL_MOVES[id-1].name;}
function requestTrick(id=selectedTrick){if(!ready||!running||paused||finished)return;if(sim.crashed){toast('Recover before starting a trick');return;}chooseTrick(id);trickRequest=id;cruise=false;canvas.focus();}
trickSelect.onchange=()=>chooseTrick(Number(trickSelect.value));$('specialMove').onclick=()=>requestTrick();
const ridingOptions=$('ridingOptions');$('optionsToggle').onclick=()=>{const open=!ridingOptions.classList.contains('expanded');ridingOptions.classList.toggle('expanded',open);$('optionsToggle').setAttribute('aria-expanded',String(open));};
const rideCamera=document.createElement('button');rideCamera.id='rideCamera';rideCamera.textContent='Recenter / Ride camera';rideCamera.onclick=recenterCamera;$('ridingOptions').append(rideCamera);
const eyesCamera=document.createElement('button');eyesCamera.id='eyesCamera';eyesCamera.textContent='First person';eyesCamera.onclick=()=>{if(!vr.active)setCamera('first');};$('ridingOptions').append(eyesCamera);
const orbitCamera=document.createElement('button');orbitCamera.textContent='Photo / orbit';orbitCamera.onclick=()=>{if(!vr.active)setCamera('orbit');};$('ridingOptions').append(orbitCamera);
const touchToggle=document.createElement('button');touchToggle.id='touchToggle';let manualTouch='auto';try{manualTouch=localStorage.getItem('swoop-touch-layout')??'auto';}catch{}
function applyTouchChoice(){document.documentElement.classList.toggle('hideTouch',manualTouch==='off');document.documentElement.classList.toggle('forceTouch',manualTouch==='on');touchToggle.textContent='Touch controls: '+manualTouch;touchToggle.setAttribute('aria-pressed',String(manualTouch==='on'));}
touchToggle.onclick=()=>{manualTouch=manualTouch==='auto'?'on':manualTouch==='on'?'off':'auto';clearInput();applyTouchChoice();try{localStorage.setItem('swoop-touch-layout',manualTouch);}catch{}};applyTouchChoice();$('helpPanel').append(touchToggle);
const quickHelp=document.createElement('p');quickHelp.id='quickHelp';$('helpPanel').querySelector('h2')!.after(quickHelp);
const resumeRide=document.createElement('button');resumeRide.id='resumeRide';resumeRide.textContent='Resume current ride';resumeRide.hidden=true;$('start').after(resumeRide);resumeRide.onclick=()=>{if(!running||finished)return;$('challengeHUD').hidden=!challengeRun;unlockRideAudio();clearInput();paused=false;document.body.classList.add('playing');$('menu').hidden=true;$('pause').textContent='Pause';$('paused').hidden=true;canvas.focus();};
function pause(){if(split?.simulation.rules.done||!running||!$('menu').hidden||!$('challengeResults').hidden||!$('raceResults').hidden)return;paused=!paused;if(!paused)unlockRideAudio();clearInput();$('pause').textContent=paused?'Resume':'Pause';$('paused').hidden=!paused;rideAudio.update(pose,!paused);}
function setCamera(m:string){if(m==='first'&&cameraMode!==m){firstYaw=0;firstPitch=-.10;}cameraMode=m;$<HTMLSelectElement>('camera').value=m;canvas.focus();}
function recenterCamera(){if(vr.active)return;clearCameraTouches();orbitYaw=0;orbitHeight=2.2;orbitDistance=5;follow.distance=4.6;firstYaw=0;firstPitch=-.10;follow.reset(current);setCamera('chase');}
function cycleCamera(){const modes=['chase','first','front','side','orbit'];setCamera(modes[(modes.indexOf(cameraMode)+1)%modes.length]);}
function toggleLight(){night=!night;sky.setDusk(night);if(scenery&&'lighting' in scenery)scenery.lighting.setDusk(night);scene.background=new T.Color(night?'#182831':'#c9dce0');scene.fog=new T.Fog(night?'#182831':'#c9dce0',night?65:elmwood&&compactElmwood?65:130,elmwood&&compactElmwood?165:night?250:370);sun.intensity=night?.65:elmwood?2.5:2.0;hemi.intensity=night?.5:elmwood?.95:1.15;fill.intensity=night?.35:elmwood?.22:.55;scene.environmentIntensity=night?.25:elmwood?.4:.6;$('light').textContent=night?'Day':'Dusk';}
function toggleAudio(){if(!muted&&rideAudio.state.context==='suspended'){unlockRideAudio();return;}muted=!muted;try{localStorage.setItem('digital-static-ride-sound',muted?'off':'on');}catch{}unlockRideAudio();}
for(const [i,s]of SPOTS.entries()){
  const o=document.createElement('option');o.value=String(i);o.textContent=s.name;$('spawn').append(o);
  const b=document.createElement('button');b.textContent=s.name;b.onclick=()=>{if(challengeRun&&running){toast('Choose Free Ride before changing location.');return;}reset(i);beginRide();setCamera('front');};$('locations').append(b);
}
$<HTMLSelectElement>('spawn').value=elmwood?'0':'1';
$('mode').onchange=()=>{const kind=$<HTMLSelectElement>('mode').value;district.filter(kind);$('start').textContent=kind==='split'?'START 2-PLAYER RACE →':kind==='race'?'START RACE →':kind==='free'?'LET’S RIDE →':'Start first challenge →';};
$('start').onclick=start;$('pause').onclick=pause;$('camera').onchange=()=>setCamera($<HTMLSelectElement>('camera').value);
$('companion').onchange=()=>setCompanion($<HTMLSelectElement>('companion').value==='dog');
$('heroSelect').onchange=()=>setRider($<HTMLSelectElement>('heroSelect').value);
$('riderQuick').onclick=()=>{setRider(RIDER_CHOICES[(RIDER_CHOICES.findIndex(r=>r.id===selectedRider)+1)%RIDER_CHOICES.length].id);canvas.focus();};
$('dogToggle').onclick=()=>{setCompanion(!dogEnabled);canvas.focus();};
$('menuButton').onclick=()=>{loop.stopReplay(false);$('challengeHUD').hidden=true;paused=true;clearInput();$('paused').hidden=true;$('pause').textContent='Resume';$('challengeResults').hidden=true;resumeRide.hidden=!running||finished;document.body.classList.remove('playing');$('menu').hidden=false;$('menuTitle').textContent='Swoop . Detroit';district.refreshBoard();loop.refresh();};
$('map').onclick=()=>{$('mapPanel').hidden=!$('mapPanel').hidden;};$('closeMap').onclick=()=>{$('mapPanel').hidden=true;};
$('help').onclick=()=>{$('helpPanel').hidden=!$('helpPanel').hidden;};$('closeHelp').onclick=()=>{$('helpPanel').hidden=true;};
$('light').onclick=toggleLight;$('audio').onclick=toggleAudio;$('recover').onclick=()=>{if(finished&&challengeRun)loop.retry();else queueRecovery();};
const vrControls=document.createElement('div');vrControls.className='vrControls';$('start').after(vrControls);
const vr=new VRRide(renderer,scene,camera,vrControls,{ready:()=>ready,unlockAudio:unlockRideAudio,message:toast,
 enter:()=>{if(split){stopRace();$<HTMLSelectElement>('mode').value='free';start();}else if(!running)start();else beginRide();clearInput();last=performance.now();acc=0;},
 exit:()=>{clearInput();paused=true;$('pause').textContent='Resume';$('paused').hidden=false;rideAudio.update(pose,false);follow.reset(current);last=performance.now();acc=0;},
 pause:()=>{if(!paused){paused=true;clearInput();$('pause').textContent='Resume';$('paused').hidden=false;rideAudio.update(pose,false);}}
});
const extraHelp=document.createElement('p');extraHelp.textContent='SEATED RIDING · X or Sit down / Stand up; gamepad D-pad down; Quest left grip + A. Feet stay on pedals. Hops, crouching and tricks temporarily stand up. CHALLENGES · N instantly retries the current route; R retries after a result. The Retry button works on touch. Controller X / Square and VR recover retry at results. Personal ghosts and rewards save in this browser. CONTROLLER · Left stick ride/steer · RT/R2 accelerate · LT/L2 brake · A/Cross hold/release hop · B/Circle trick · RB/R1 or D-pad choose trick · LB/L1 crouch · X/Square recover · Y/Triangle camera · right stick look · Start pause/resume. VR · Quest: left stick ride, left trigger brake, grips crouch, right trigger hold/release hop, A trick, B choose, X recover, Y pause. Vive wands: left pad ride; click upper half to recover, lower half to pause. Right pad click upper half to choose trick, lower half to perform it. Right pad sides turn the view. VR HUD on/off: Quest left stick click; Vive right pad center click. Right stick click recenters Quest view.';$('helpPanel').append(extraHelp);
let seatedRide=false;
const boardButton=document.createElement('button');boardButton.textContent='Switch to skateboard';boardButton.onclick=()=>{const m=toMap(current.x,0,current.z);if(split||race||challengeRun||!parkContains(m.x,m.z)){toast('Switch boards in the Freestyle Yard during free ride');return;}if(Math.abs(current.speed)>.5||sim.crashed){toast('Stop upright to change your ride');return;}hero.skateboarding=!hero.skateboarding;seatedRide=false;cruise=false;sitButton.disabled=hero.skateboarding;sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');boardButton.textContent=hero.skateboarding?'Switch to EUC':'Switch to skateboard';boardButton.setAttribute('aria-pressed',String(hero.skateboarding));toast(hero.skateboarding?'Arcade skateboard - steer, crouch and hop with your usual controls':'Electric unicycle');canvas.focus();};$('cruise').before(boardButton);
const sitButton=document.createElement('button');sitButton.id='sitRide';sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');sitButton.onclick=()=>{if(hero.skateboarding){toast('Seated riding is available on the EUC');return;}seatedRide=!seatedRide;sitButton.textContent=seatedRide?'Stand up':'Sit down';sitButton.setAttribute('aria-pressed',String(seatedRide));toast(seatedRide?'Seated riding · Space / tricks rise out of the seat':'Standing riding');canvas.focus();};$('cruise').before(sitButton);
$('cruise').onclick=()=>{if(!ready||!running||paused||finished||sim.crashed){cruise=false;return;}cruise=!cruise;toast(cruise?`Cruise • ${Math.round(RIDE_RULES.cruiseSpeed*3.6)} km/h · YOU steer · brake to cancel`:'Cruise off');canvas.focus();};
window.addEventListener('keydown',e=>{
  if(gallery?.active||boutique?.active){if(e.code==='Escape')(gallery?.active?gallery:boutique)!.panel.querySelector<HTMLButtonElement>('[data-back]')!.click();return;}
  if(split&&$('menu').hidden){if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement?.tagName??''))return;if(e.repeat){if(split.input.ownsKey(e.code))e.preventDefault();return;}if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();pause();return;}if(e.code==='KeyN'){e.preventDefault();startSplit();return;}if(split.input.ownsKey(e.code)){e.preventDefault();if(!paused&&!finished)split.input.handleKey(e.code,true);}return;}
  if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement?.tagName??''))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
  inputDevice='keyboard';if(e.repeat)return;keys.add(e.code);if(e.code==='Enter'&&!running)start();if(e.code==='Space')hop=true;if(e.code==='KeyR'){if(finished&&challengeRun)loop.retry();else queueRecovery();}if(e.code==='KeyN'&&running){if(race)startRace();else if(challengeRun)loop.retry();}
  if(e.code==='KeyX')sitButton.click();if(e.code==='KeyH')recenterCamera();if(e.code==='KeyC')cycleCamera();if(e.code==='KeyP'||e.code==='Escape')pause();if(e.code==='KeyM')$('map').click();if(e.code==='KeyV')$('cruise').click();
  if(/^Digit[1-7]$/.test(e.code))requestTrick(Number(e.code.slice(-1)));if(e.code==='KeyT')requestTrick();
  if(e.code==='KeyF'&&challengeRun?.challenge.kind==='discovery')photoPending=true;
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(split?.input.handleKey(e.code,false))e.preventDefault();});
window.addEventListener('blur',()=>{clearInput();if(!vr.active&&running&&!paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!vr.active){rideAudio.update(pose,false);clearInput();if(running&&!paused)pause();}});
let drag:{id:number;x:number;y:number}|undefined;const cameraTouches=new Map<number,{x:number;y:number}>();let pinchDistance=0;
const clearCameraTouches=()=>{for(const id of cameraTouches.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);cameraTouches.clear();drag=undefined;pinchDistance=0;};
window.addEventListener('blur',clearCameraTouches);window.addEventListener('resize',()=>{clearInput();clearCameraTouches();});
canvas.onpointerdown=e=>{if(split){canvas.focus();return;}if(!running||paused||finished||sim.crashed||vr.active||!['first','orbit','photo'].includes(cameraMode))return;canvas.focus();if(e.pointerType==='touch'){cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(cameraTouches.size===2){const [a,b]=[...cameraTouches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}}drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(cameraMode==='first'){if(drag?.id===e.pointerId){firstYaw=clamp(firstYaw-(e.clientX-drag.x)*.005,-1.45,1.45);firstPitch=clamp(firstPitch-(e.clientY-drag.y)*.005,-1.25,.7);drag.x=e.clientX;drag.y=e.clientY;}return;}if(cameraTouches.has(e.pointerId)){cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(cameraTouches.size>=2){const [a,b]=[...cameraTouches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0){orbitDistance=clamp(orbitDistance*pinchDistance/Math.max(1,distance),2.5,12);if(cameraMode!=='orbit'){orbitYaw=cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:0;setCamera('orbit');}}pinchDistance=distance;return;}}if(drag?.id!==e.pointerId)return;if(cameraMode!=='orbit'){orbitYaw=cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:0;cameraMode='orbit';}
  orbitYaw-=(e.clientX-drag.x)*.007;orbitHeight=clamp(orbitHeight+(e.clientY-drag.y)*.015,1,10);drag.x=e.clientX;drag.y=e.clientY;};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{cameraTouches.delete(e.pointerId);pinchDistance=0;const first=cameraTouches.entries().next().value;drag=first?{id:first[0],x:first[1].x,y:first[1].y}:undefined;};canvas.oncontextmenu=e=>e.preventDefault();
canvas.onwheel=e=>{if(split||vr.active||!running)return;e.preventDefault();if(cameraMode==='chase')follow.distance=clamp(follow.distance+e.deltaY*.003,3.5,6.5);else if(cameraMode==='orbit'||cameraMode==='photo')orbitDistance=clamp(orbitDistance+e.deltaY*.006,2.5,12);};
let previousPadConnected=false,previousXRConnected=false;
function gamepad(dt:number){const p=padInput.sample(Array.from(navigator.getGamepads?.()??[]),current.speed);
  if(previousPadConnected&&!p.connected&&!paused){clearInput();pause();}previousPadConnected=p.connected;
  controllerStatus.textContent=p.connected?'Controller connected · '+p.id:'Controller: connect USB/Bluetooth, then press a button.';
  if(p.start&&!running){start();return {...p,throttle:0,steer:0,hop:false,hopHeld:false};}
  if(p.pause){if(loop.replay)loop.stopReplay();else if(finished)freeRideHere();else if(!$('menu').hidden&&running)resumeRide.click();else pause();}
  if(p.nextTrick)chooseTrick(selectedTrick%SPECIAL_MOVES.length+1);if(p.previousTrick)chooseTrick((selectedTrick+SPECIAL_MOVES.length-2)%SPECIAL_MOVES.length+1);
  if(p.sit)sitButton.click();if(p.camera&&!vr.active)cycleCamera();if(p.recover){if(finished&&challengeRun)startChallenge(challengeRun.challenge);else queueRecovery();}if(p.trick)requestTrick();
  if(running&&!paused){if(p.hop)hop=true;if(!vr.active&&(p.lookX||p.lookY)){if(cameraMode==='first'){firstYaw=clamp(firstYaw-p.lookX*dt*1.7,-1.45,1.45);firstPitch=clamp(firstPitch-p.lookY*dt*1.3,-1.25,.7);}else{if(cameraMode!=='orbit'){orbitYaw=cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:0;setCamera('orbit');}orbitYaw-=p.lookX*dt*1.7;orbitHeight=clamp(orbitHeight+p.lookY*dt*2,1,10);}}}
  return p;
}
let toastUntil=0;function toast(text:string){$('toast').textContent=text;toastUntil=performance.now()+4000;}
installRaceUI(startRace,freeRideHere,()=>{stopRace();$('menuButton').click();});
const splitOption=document.createElement('option');splitOption.value='split';splitOption.textContent='2-player split-screen';$('mode').append(splitOption);
installLobby(elmwood,startRace,startSplit);
const practiceHUD=document.createElement('section');practiceHUD.id='practiceHUD';practiceHUD.hidden=true;practiceHUD.innerHTML='<strong>Optional route practice</strong><p id="practiceCopy"></p><button id="practiceRace">Skip / Start race</button><button id="practiceAgain">Replay lesson</button>';document.body.append(practiceHUD);
function startPractice(){if(!ready)return;stopRace();challengeRun=undefined;district.setRun();mode='free';reset(selectedSpot,RACE_ROUTE.start);loop.startRun(undefined,selectedRider,actorData,current);practice=new PracticeCoach();beginRide();setCamera('chase');practiceHUD.hidden=false;}
$('practiceRace').onclick=startRace;$('practiceAgain').onclick=startPractice;
const practiceButton=document.createElement('button');practiceButton.id='practiceRoute';practiceButton.textContent='Practice controls · optional';practiceButton.onclick=startPractice;practiceButton.hidden=$('menu').dataset.tab!=='race';$('raceInfo').after(practiceButton);

const quickPractice=document.createElement('button');quickPractice.textContent='Learn to ride';quickPractice.onclick=startPractice;
const quickPark=document.createElement('button');quickPark.textContent='Freestyle Yard / skateboard';quickPark.onclick=()=>{const i=SPOTS.findIndex(s=>s.name===PARK_SPAWN.name);if(i<0||!ready)return;stopRace();challengeRun=undefined;district.setRun();mode='free';selectedSpot=i;reset(i);beginRide();};
$('start').after(quickPractice,quickPark);
const parkHUD=document.createElement('section');parkHUD.id='parkCoach';parkHUD.hidden=true;parkHUD.setAttribute('aria-label','Freestyle Yard session');document.body.append(parkHUD);
let parkLandings=0,parkLastLanding=-Infinity;
const courseView=new CourseFeatureView(scene);
const gallery=elmwood?undefined:new GalleryVisit(scene,()=>{
  if(split||sim.crashed||Math.abs(current.speed)>.5)return;
  freeRideHere();$('challengeResults').hidden=true;$('raceResults').hidden=true;
  clearInput();paused=true;gallery!.start(actorData,selectedRider,hero,current);
},()=>{clearInput();paused=false;canvas.focus();});
const boutique=elmwood?undefined:new GalleryVisit(scene,()=>{
 if(split||sim.crashed||Math.abs(current.speed)>.5)return;freeRideHere();clearInput();paused=true;boutique!.start(actorData,selectedRider,hero,current);
},()=>{clearInput();paused=false;canvas.focus();},true);
try{
  $('loading').textContent='Loading Detroit and your custom rider…';
  const [data]=await Promise.all([loadActors(),mapWorld.init()]);
  for(const destination of [gallery,boutique])if(destination){
    await destination.load();destination.building.updateMatrixWorld(true);
    const localMap=(x:number,y:number,z:number)=>{const p=new T.Vector3(x,y,z).applyMatrix4(destination.building.matrixWorld);return toMap(p.x,p.y,p.z);};
    // Floors share the visible prefab coordinates. A solid building foundation
    // is base ground, not an overhead bridge: paws and tires must stand on it.
    for(const [near,far,y] of [[-7.5,7.5,.06],[6,10.4,0]] as const){
      const corners=[[-9,near],[-9,far],[9,far],[9,near]].map(([x,z])=>localMap(x,y,z));
      const vertices=new Float32Array([0,2,1,0,3,2].flatMap(i=>{const p=corners[i];return[p.x,p.y,p.z];}));
      (mapWorld as DetroitWorld).addRideSurface(vertices,true);
    }
    // Wall colliders leave the central shop entrance and aisle open.
    for(const [x,z,w,d] of [[-9,0,.3,12],[9,0,.3,12],[0,-6,18,.3]] as const){
      const m=localMap(x,3.6,z),scale=destination.building.scale.x;
      mapWorld.addBox({x:m.x,y:m.y,z:m.z,hx:w*scale/2,hy:3.6*scale,hz:d*scale/2,yaw:-destination.building.rotation.y,kind:'building'});
    }
  }

  if(!elmwood&&!qaVisualBaseline)ambience=new RouteAmbience(scene,world,effectPatches);
  if(!elmwood)buildFreestylePark(mapScene,mapWorld as DetroitWorld);
  actorData=data;scenery=elmwood?await buildElmwood(mapScene,mapWorld as ElmwoodWorld,()=>compactElmwood||vr.active):await buildScenery(mapScene,mapWorld,!qaVisualBaseline);setRider(selectedRider);traffic=new TrafficView(scene,data,world);dogView=new CompanionView(data,world);scene.add(dogView.root);
  setCompanion(dogEnabled);
  if(elmwood&&'waterGroup' in scenery&&!compactElmwood){
    // One reflection capture of the actual banks and trees, outside the frame loop.
    const pond=toLocal(...([scenery.pondPosition.x,scenery.pondPosition.y,scenery.pondPosition.z] as [number,number,number]));
    const target=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType}),probe=new T.CubeCamera(.2,350,target);
    probe.position.set(pond.x,pond.y+.35,pond.z);scene.add(probe);scenery.waterGroup.visible=false;hero.root.visible=false;dogView.root.visible=false;
    sun.position.set(pond.x+22,pond.y+35,pond.z+24);sun.target.position.set(pond.x,pond.y,pond.z);scene.updateMatrixWorld(true);
    probe.update(renderer,scene);const generator=new T.PMREMGenerator(renderer);scenery.waterMaterial.envMap=generator.fromCubemap(target.texture).texture;scenery.waterMaterial.needsUpdate=true;
    generator.dispose();target.dispose();probe.removeFromParent();scenery.waterGroup.visible=true;hero.root.visible=true;dogView.root.visible=dogEnabled;
  }
  canvas.dataset.architecture=JSON.stringify(scenery.architecture);
  sim=new RideController(world);sim.mountedVolume=hero.mountedVolume;sim.wheelScale=selectedRider.startsWith('DS_Mascot_')?.75:.86;reset();
  ready=true;loop.ready();canvas.dataset.ready='true';canvas.dataset.hero=selectedRider;canvas.dataset.controller=RIDE_TUNING.version;canvas.dataset.physics='Rapier terrain + Digital Static controller';canvas.dataset.routeLength=String(LENGTH);$('loading').hidden=true;$<HTMLButtonElement>('start').disabled=false;document.querySelectorAll<HTMLButtonElement>('.districtCard').forEach(b=>b.disabled=false);
  setCamera('front');
  if(new URLSearchParams(location.search).get('launch')==='quest')void vr.enterFromPackage();
}catch(e){console.error(e);$('loading').textContent='The ride could not load: '+String(e);}
const frameSchedule=new FrameSchedule();
let hudAt=0,frames=0,fpsAt=performance.now(),fps=0;
function frameSplit(now:number,dt:number){
 const room=split!;windTime.value=room.simulation.rules.elapsed;const controls=room.input.poll(Array.from(navigator.getGamepads?.()??[]),room.simulation.riders.map(r=>r.pose.speed),dt);
 if(controls.disconnected&&!paused)pause();
 if(controls.pause){if(!$('menu').hidden)resumeRide.click();else pause();}
 for(let i=0;i<2;i++){const event=room.input.events(i);if(event.recover)recoverSplit(i);if(event.camera)room.view.toggleCamera(i);if(event.cruise)cruiseSplit(i);}
 const visible=$('menu').hidden,active=running&&!paused&&!finished&&visible;
 if(active){acc+=dt;while(acc>=1/120&&!room.simulation.rules.done){mapWorld.step();room.simulation.step(1/120,[room.input.consume(0),room.input.consume(1)]);for(const i of room.simulation.newCrashes)room.input.clear(i);room.view.afterStep(1/120);acc=Math.max(0,acc-1/120);}}
 else acc=0;
 if(room.simulation.rules.done&&!finished){finished=true;clearInput();}
 hero.root.visible=false;dogView.root.visible=false;confirmation.render(false);riderLamp.update(dt,current,night,false);ambience?.update(room.simulation.rules.elapsed,room.simulation.riders.map(r=>r.pose));
 room.view.render(renderer,scene,dt,active&&!finished?Math.min(1,acc*120):1,active&&!finished,paused,visible,p=>{
  sun.position.copy(night?DUSK_SUN:DAY_SUN).multiplyScalar(48).add(new T.Vector3(p.x,p.y,p.z));sun.target.position.set(p.x,p.y,p.z);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
  if(!night){const roof=world.raycastObstacle({x:p.x,y:p.y+2.3,z:p.z},{x:0,y:1,z:0},7);fill.intensity=roof===null?.55:.9;}
  for(const destination of [gallery,boutique])if(destination)destination.building.visible=Math.hypot(p.x-destination.building.position.x,p.z-destination.building.position.z)<180;
  const m=toMap(p.x,p.y,p.z);scenery.update(m.x,m.z,room.simulation.rules.elapsed);
 },controls.disconnected?'Controller disconnected · reconnect the assigned controller, then Resume':'',room.input.cruising,night);
 const driving=active&&!finished&&room.simulation.rules.countdown<=0;
 rideAudio.update(room.simulation.riders[0].pose,driving&&!room.simulation.riders[0].sim.crashed);
 if(room.audio.enabled!==!muted)void room.audio.enable(!muted);room.audio.update(room.simulation.riders[1].pose,driving&&!room.simulation.riders[1].sim.crashed);
 loop.music.update(dt,finished?'results':'ride',!document.hidden&&(!paused||!visible||finished),0,0,0);
 if(now-hudAt>120){
  canvas.dataset.effects=JSON.stringify({players:room.view.feedback,patches:effectPatches.length});
  canvas.dataset.splitRace=JSON.stringify({...room.simulation.snapshot,paused,bindings:room.input.bindings,cruise:room.input.cruising});
  const timings=[...frameTimes].sort((a,b)=>a-b);canvas.dataset.performance=JSON.stringify({sampleFrames:timings.length,frameP50:timings[Math.floor(timings.length*.5)],frameP95:timings[Math.floor(timings.length*.95)],geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,views:2});
  Object.assign(canvas.dataset,{mode:'split',paused:String(paused),running:String(running),finished:String(finished),score:'0',cruise:'false',actors:'2'});hudAt=now;
 }
}
function frame(now:number,xrFrame?:XRFrame){
  if(!ready||(document.hidden&&!vr.active)){last=now;return;}
  if(!frameSchedule.shouldRender(now,(!running||paused)&&!gallery?.active&&!boutique?.active,vr.active))return;
  const rawFrameMs=Math.max(0,now-last),dt=Math.min(rawFrameMs/1000,.06);last=now;
  if(!loadedAt)loadedAt=now;const budgetActive=!document.hidden&&!vr.active&&running&&!paused&&now-loadedAt>5000;if(adaptiveQuality.sample(rawFrameMs,budgetActive)){renderer.setPixelRatio(basePixelRatio*adaptiveQuality.scale);renderer.setSize(innerWidth,innerHeight);document.documentElement.dataset.renderQuality=adaptiveQuality.scale<.85?'compact':'detailed';}canvas.dataset.renderBudget=JSON.stringify({targetFPS:60,resolutionScale:adaptiveQuality.scale,pixelRatio:renderer.getPixelRatio(),xr:vr.active});for(const destination of [gallery,boutique])if(destination)destination.building.visible=destination.active||Math.hypot(current.x-destination.building.position.x,current.z-destination.building.position.z)<220;frameTimes.push(rawFrameMs);if(frameTimes.length>480)frameTimes.shift();
  if(gallery?.active||boutique?.active){
    const destination=(gallery?.active?gallery:boutique)!;const walking=destination.update(document.hidden?0:dt,camera);
    if(vr.active){vr.eyeHeight=hero.vrEyeHeight-hero.mountHeight;vr.update(walking,false,false,'Serengeti Galleries',false,dt,xrFrame);}
    rideAudio.update(current,false);renderer.render(scene,camera);return;
  }
  courseView.update(split?split.simulation.riders.map(r=>r.pose):[current]);if(split){frameSplit(now,dt);return;}
  const gp=gamepad(dt),xp=vr.poll(current.speed);if(vr.active){if(xp.sit)sitButton.click();if(xp.toggleHud)vr.toggleHud();if(previousXRConnected&&!xp.connected&&!paused){clearInput();pause();}if(xp.pause){if(finished)freeRideHere();else pause();}if(xp.recover){if(finished&&challengeRun)startChallenge(challengeRun.challenge);else queueRecovery();}if(xp.nextTrick)chooseTrick(selectedTrick%SPECIAL_MOVES.length+1);if(xp.trick)requestTrick();if(running&&!paused&&xp.hop)hop=true;vr.look(xp.snap,xp.recenter);}previousXRConnected=xp.connected;
  const manualSteer=clamp(touch.steer+gp.steer+xp.steer+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),-1,1);
  const steer=vr.steering(manualSteer,current,dt,xrFrame);
  const deviceActive=Math.abs(gp.throttle)+Math.abs(gp.steer)+Math.abs(xp.throttle)+Math.abs(xp.steer)>.05||gp.hopHeld||gp.crouch||xp.hopHeld||xp.crouch;
  const deviceReady=deviceRearm.sample(dt,deviceActive);
  if(deviceActive&&deviceReady)inputDevice=vr.active?'vr':'gamepad';
  let throttle=clamp(touch.throttle+gp.throttle+xp.throttle+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),-1,1);
  if(touch.braking){throttle=touch.brakeThrottle(current.speed);cruise=false;}if(throttle<0||sim.crashed)cruise=false;if(cruise&&Math.abs(throttle)<.01)throttle=clamp((RIDE_RULES.cruiseSpeed-current.speed)*.45,-.3,.5);
  if(vr.active){if(vr.driveMode==='lean')cruise=false;throttle=vr.drive(throttle,current,dt,xp.braking||touch.braking,xrFrame);throttle=vrThrottle(throttle,current.speed,vr.comfort);}
  if(hero.skateboarding){seatedRide=false;trickRequest=trickRequest===4||trickRequest===5||trickRequest===6?0:trickRequest;throttle=current.speed<0?Math.max(0,throttle):current.speed>=8?Math.min(0,throttle):throttle>0?throttle*.45:throttle;}
  const crouch=touch.crouch||gp.crouch||xp.crouch||xp.hopHeld||keys.has('ShiftLeft')||keys.has('ShiftRight');
  if(running&&!paused&&!finished){
    acc+=dt;while(acc>=1/120&&!finished){
      if(race&&race.rules.advance(1/120)===0){hop=false;trickRequest=0;acc-=1/120;continue;}
      copyPose(current,previous);
      clock+=1/120;windTime.value=clock;if(!race&&clock-lastTraffic>1/30){const p=toMap(current.x,0,current.z);mapWorld.rideIntent={speed:current.speed,heading:-current.headingY};mapWorld.updateTraffic(clock,p.x,p.z);lastTraffic=clock;}
      mapWorld.step();sim.step(1/120,deviceReady?{...NEUTRAL_ACTIONS,throttle,steer,crouch,seated:seatedRide,hop:touch.consumeHop()||hop,hopHeld:touch.hopHeld||gp.hopHeld||xp.hopHeld||keys.has('Space'),reset:resetPressed,trick:trickRequest}:NEUTRAL_ACTIONS);hop=false;resetPressed=false;trickRequest=0;
      if(sim.tricks.award>0)confirmRide('trick',sim.tricks.event,'trick:'+clock);else if(sim.tricks.event)toast(sim.tricks.event);
      if(sim.crashed)crashEntry();sim.writePose(current);contactEffects?.step(1/120,current,sim.snapshot().grounded);confirmation.step(1/120);if(sim.touchedDown){const m=toMap(current.x,0,current.z);if(parkContains(m.x,m.z)&&sim.lastLandingQuality!=='crash'&&clock-parkLastLanding>1){parkLandings++;parkLastLanding=clock;}follow.landing(sim.lastLandingImpact);if(sim.lastLandingQuality!=='crash'){const surface=contactEffects?.land(current,sim.lastLandingImpact);rideAudio.landing(sim.lastLandingImpact,surface?.surface??world.sampleGround(current.x,current.z,ground,current.y).surface,surface?.wet);if(!sim.tricks.active&&!sim.tricks.event)confirmation.show('landing',sim.lastLandingQuality.toUpperCase()+' LANDING','landing:'+clock);}}
      follow.step(1/120,current);if(dogEnabled)dog.step(1/120,current);loop.step(1/120,current,sim.snapshot().grounded,sim.touchedDown?sim.lastLandingQuality:undefined,sim.tricks.award?sim.tricks.event:undefined,dog.current,dogEnabled,sim.tricks.active,sim.tricks.award);acc=Math.max(0,acc-1/120);if(!challengeRun)score=loop.flow.banked;
      if(practice){practice.observe(current,sim.snapshot().grounded,sim.touchedDown);loop.flow.cancel();score=0;}
      if(race){const oldGate=race.rules.player.gate;race.step(1/120,current);if(race.rules.player.gate>oldGate)confirmRide('checkpoint',race.rules.done?'FINISH LINE':`CHECKPOINT ${race.rules.player.gate} / ${RACE_ROUTE.gates.length}`,'race-gate:'+race.rules.player.gate);if(race.rules.done)finishRace();}
      if(challengeRun){const p=toMap(current.x,0,current.z),c=cutCoords(p.x,p.z),old=challengeRun.gateCount;challengeRun.step(1/120,{station:c.d,offset:c.u,speed:current.speed,grounded:sim.snapshot().grounded,crashed:sim.crashed,roll:current.rollAngle,slip:current.slipAngle,traction:current.tractionUsage,airHeight:current.airHeight,landing:sim.touchedDown?sim.lastLandingQuality:undefined,hopCharge:sim.lastHopCharge});gate=challengeRun.count;score=loop.flow.banked;if(challengeRun.gateCount>old){loop.checkpoint(challengeRun.gateCount,challengeRun.elapsed);confirmRide('checkpoint',challengeRun.progress,'challenge:'+challengeRun.gateCount);}if(challengeRun.done||challengeRun.failed)completeChallenge();}
    }
    lerpPose(previous,current,Math.min(1,acc*120),pose);
  }else if(running&&!paused&&sim.crashed&&sim.snapshot().fallPhase!=='settled'){
    // A failed attempt stops scoring/timing, but an impact still has to reach the ground.
    acc+=dt;while(acc>=1/120){copyPose(current,previous);sim.step(1/120,NEUTRAL_ACTIONS);sim.writePose(current);follow.step(1/120,current);if(dogEnabled)dog.step(1/120,current);acc-=1/120;}
    lerpPose(previous,current,Math.min(1,acc*120),pose);
  }else{acc=0;copyPose(current,pose);}
  if(finished&&challengeRun&&sim.crashed)$('challengeResults').hidden=sim.snapshot().fallPhase!=='settled';
  for(const destination of [gallery,boutique])if(destination){const p=toMap(current.x,0,current.z),c=cutCoords(p.x,p.z);destination.offer(c.d,c.u,current,!!((race&&!finished)||(challengeRun&&!finished)),running&&$('menu').hidden);}
  race?.render(running&&$('menu').hidden,vr.active);
  const pm=toMap(pose.x,0,pose.z),inPark=parkContains(pm.x,pm.z);parkHUD.hidden=!inPark||!!race||!!split||!!challengeRun||vr.active||!$('menu').hidden;parkHUD.textContent=`FREESTYLE YARD / ${hero.skateboarding?'SKATEBOARD':'EUC'} / ${parkLandings} clean landings / ${score} banked points. Pump loop outside; bowl on the east side; tabletop through the middle. Brake to switch rides.`;
  hero.root.visible=true;if(dogView)dogView.root.visible=dogEnabled;hero.apply(pose);pedalSparks.update(dt,pose,running&&!paused&&!finished&&!sim.crashed);
  const firstPerson=cameraMode==='first'&&!sim.crashed;
  // Immersive view retains the selected rider's animated body, excluding head geometry.
  hero.visibility.setVR(vr.active);
  hero.rider.visible=vr.active||!firstPerson;
  vr.eyeHeight=hero.vrEyeHeight;
  const mapTraffic=mapWorld.traffic.map(t=>({...t,...toLocal(t.x,t.y,t.z),heading:-t.heading,fall:t.fall?{...t.fall,headingY:-t.fall.headingY,crashLateral:-t.fall.crashLateral,crashRoll:-t.fall.crashRoll,crashSide:-t.fall.crashSide,wheelCrashLateral:-t.fall.wheelCrashLateral,wheelCrashLean:-t.fall.wheelCrashLean}:undefined}));traffic.update(mapTraffic,running&&!paused&&!finished?dt:0);
  if(dogEnabled){dog.sample(running&&!paused&&!finished?acc*120:1,dogPose);dogView.apply(dogPose);dogView.reactToRider(pose,dogPose);}
  contactEffects?.update(dt,pose,hero,dogView,dogEnabled,running&&!paused&&!finished);
  confirmation.render(running&&$('menu').hidden&&!vr.active&&!finished);riderLamp.update(dt,pose,night,running&&$('menu').hidden&&!qaVisualBaseline);ambience?.update(clock,[pose]);
  const photoTarget=challengeRun?.challenge.kind==='discovery'?district.targets.find(t=>!challengeRun!.photos.has(t.id)):undefined;
  if(vr.active){vr.update(pose,paused,sim.crashed,race?race.rules.label+' · '+race.rules.elapsed.toFixed(1)+' s':finished?'COMPLETE · recover to retry / pause for free ride':SPECIAL_MOVES[selectedTrick-1].name,sim.tricks.active,dt,xrFrame);}
  else if(firstPerson){
    const eye=hero.head?.getWorldPosition(new T.Vector3())??new T.Vector3(pose.x,pose.y+1.85,pose.z);
    eye.add(new T.Vector3(Math.sin(pose.headingY)*.10,.065,Math.cos(pose.headingY)*.10));
    eye.y=underpassCameraHeight(world,eye,eye.y,pose.y);
    const yaw=pose.headingY+firstYaw;
    camera.position.copy(eye);camera.lookAt(eye.clone().add(new T.Vector3(Math.sin(yaw)*Math.cos(firstPitch),Math.sin(firstPitch),Math.cos(yaw)*Math.cos(firstPitch))));
    camera.fov=74;
  }
  else if(cameraMode==='photo'&&photoTarget){camera.position.set(pose.x,underpassCameraHeight(world,pose,pose.y+2.35),pose.z);camera.lookAt(photoTarget.x,photoTarget.y,photoTarget.z);camera.fov=60;}
  else if((cameraMode==='chase'||cameraMode==='first')&&running){camera.position.set(follow.eye.x,follow.eye.y,follow.eye.z);camera.lookAt(follow.target.x,follow.target.y,follow.target.z);camera.rotateZ(follow.roll);camera.fov=follow.fov;}
  else {
    const angle=pose.headingY+(cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:orbitYaw),distance=cameraMode==='orbit'?orbitDistance:5;
    const fall=fallCameraOffset(pose);
    const target=new T.Vector3(pose.x+fall.x,pose.y+1.1+fall.y,pose.z+fall.z),wanted=new T.Vector3(pose.x-Math.sin(angle)*distance+fall.x,pose.y+(cameraMode==='orbit'?orbitHeight:2.05),pose.z-Math.cos(angle)*distance+fall.z);
    wanted.y=Math.min(underpassCameraHeight(world,pose,wanted.y),underpassCameraHeight(world,wanted,wanted.y,pose.y));
    const direction=wanted.clone().sub(target),hit=world.raycast(target,direction,direction.length());if(hit!==null)wanted.copy(target).addScaledVector(direction.normalize(),Math.max(.65,hit-.2));wanted.y=Math.max(wanted.y,world.sampleGround(wanted.x,wanted.z,ground,pose.y).height+.35);
    camera.position.lerp(wanted,1-Math.exp(-dt*10));
    camera.position.y=Math.min(underpassCameraHeight(world,pose,camera.position.y),underpassCameraHeight(world,camera.position,camera.position.y,pose.y));
    camera.lookAt(target);camera.fov=52;
  }
  loop.render(dt,running&&!paused&&!finished,hero,dogView.root,camera,vr.active,sim.tricks.snapshot());
  if(!vr.active)camera.updateProjectionMatrix();sun.position.copy(night?DUSK_SUN:DAY_SUN).multiplyScalar(48).add(new T.Vector3(pose.x,pose.y,pose.z));sun.target.position.set(pose.x,pose.y,pose.z);fill.position.set(pose.x-12,pose.y+8,pose.z-13);fill.target.position.copy(hero.root.position);if(!qaVisualBaseline&&!elmwood&&!night){const roof=world.raycastObstacle({x:pose.x,y:pose.y+2.3,z:pose.z},{x:0,y:1,z:0},7);fill.intensity=T.MathUtils.damp(fill.intensity,roof===null?.55:.9,5,dt);}
  canvas.dataset.visibleChunks=String(scenery.update(toMap(pose.x,0,pose.z).x,toMap(pose.x,0,pose.z).z,clock));canvas.dataset.environment=JSON.stringify({rails:'rails' in scenery?scenery.rails:0,landmarks:'landmarks' in scenery?scenery.landmarks:null,flowers:'flowers' in scenery?scenery.flowers:0,trees:scenery.trees,grassClumps:'grassClumps' in scenery?scenery.grassClumps:0,routeArt:'routeArt' in scenery?scenery.routeArt:null,generatedSkins:scenery.skins,treeVersion:elmwood?'elmwood-five-species-20260916':'curved-elm-maple-20260915',style:elmwood?'Five botanical meshes, photographic PBR and outdoor HDR lighting':'Higgsfield elm/maple foliage, tapered branches and bark',quality:compactElmwood||vr.active?'compact':'detailed'});renderer.render(scene,camera);if(finished)loop.capture(canvas);frames++;if(now-fpsAt>1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;}
  if(photoPending){photoPending=false;if(photoTarget&&challengeRun&&!finished&&!paused){const target=new T.Vector3(photoTarget.x,photoTarget.y,photoTarget.z),direction=target.clone().sub(camera.position),distance=direction.length(),projected=target.clone().project(camera),hit=world.raycast(camera.position,direction.clone().normalize(),Math.max(0,distance-.8));const check={distance:Math.hypot(target.x-pose.x,target.z-pose.z),speed:pose.speed,inFrame:Math.abs(projected.x)<.85&&Math.abs(projected.y)<.85&&projected.z>-1&&projected.z<1,unobstructed:hit===null||hit>=distance-.8};if(photoAllowed(check)&&challengeRun.capture(photoTarget.id,check)){district.savePhoto(photoTarget.id,canvas);confirmRide('checkpoint','PHOTO SAVED · '+photoTarget.name,'photo:'+photoTarget.id);if(challengeRun.done)completeChallenge();}else toast('Stop within 3–42 m with a clear view. Use Frame subject or orbit the camera.');}}
  rideAudio.update(pose,running&&!paused&&!finished&&!sim.crashed);
  loop.music.update(dt,finished?'results':elmwood||challengeRun?.challenge.kind==='discovery'?'garden':challengeRun?.challenge.kind==='style'?'style':'ride',!document.hidden&&(!paused||!$('menu').hidden||finished),pose.speed,loop.flow.pending,pose.warningLevel+pose.scrape);
  if(now-hudAt>120){
    if(race){race.hud();canvas.dataset.race=JSON.stringify({countdown:race.rules.countdown,elapsed:race.rules.elapsed,place:race.rules.place,done:race.rules.done,racers:race.rules.racers});}else delete canvas.dataset.race;
    const timings=[...frameTimes].sort((a,b)=>a-b),gl=renderer.getContext(),gpu=gl.getExtension('WEBGL_debug_renderer_info');
    canvas.dataset.performance=JSON.stringify({sampleFrames:timings.length,frameP50:timings[Math.floor(timings.length*.5)],frameP95:timings[Math.floor(timings.length*.95)],loadMs:loadedAt-bootStarted,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length,heapMB:((performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0)/1048576,renderer:gpu?gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),visualBaseline:qaVisualBaseline});
    const s=sim.snapshot(),mapped=toMap(pose.x,pose.y,pose.z),gps=gpsAt(mapped.x,mapped.z);updateMap(mapped.x,mapped.z);
    if(elmwood)Object.assign(canvas.dataset,{map:'elmwood',origin:JSON.stringify({name:'Elmwood entrance / local plan coordinates',source:ELMWOOD_SOURCE,estimated:true}),routeLength:String(ELM_PATHS.reduce((n,p)=>n+p.length,0))});
    else Object.assign(canvas.dataset,{map:'cut',latitude:gps.lat.toFixed(7),longitude:gps.lon.toFixed(7),station:cutCoords(mapped.x,mapped.z).d.toFixed(2),origin:JSON.stringify(GEO.origin)});
    const footErrors=hero.legs.map((l,i)=>l.foot.getWorldPosition(new T.Vector3()).distanceTo(hero.footTarget(i,pose)));
    canvas.dataset.poseDebug=JSON.stringify({riderRoll:pose.riderRoll,wobble:pose.wobbleSway,groundRoll:pose.groundRoll,groundPitch:pose.groundPitch,wheelPitch:pose.wheelPitch,crash:pose.crashBlend,hip:hero.hips?.getWorldPosition(new T.Vector3()).toArray(),footErrors});
    canvas.dataset.companion=JSON.stringify({mode:dog.mode,asset:'DS_Boerboel_01',count:dogEnabled?1:0,enabled:dogEnabled,visible:dogView.root.visible,gait:dogView.gait,speed:dogPose.speed,phase:dogPose.phase,x:dogPose.x,y:dogPose.y,z:dogPose.z,distance:Math.hypot(dogPose.x-pose.x,dogPose.z-pose.z),jumps:dog.jumps,jumpHeight:dogPose.jumpHeight});
    canvas.dataset.effects=JSON.stringify({surface:contactEffects?.surface.model.state,confirmation:confirmation.model.text,lamp:riderLamp.intensity,patches:effectPatches.length});
    canvas.dataset.rideFeedback=JSON.stringify({stopFoot:pose.stopFoot,scrape:pose.scrape,scrapeSide:pose.scrapeSide,warningLevel:pose.warningLevel,beepPulse:pose.beepPulse,audio:rideAudio.state});
    canvas.dataset.replayLoop=JSON.stringify(loop.state);canvas.dataset.controllerInput=JSON.stringify(gp);canvas.dataset.vr=JSON.stringify({active:vr.active,hud:vr.hudEnabled,steering:vr.steeringMode,drive:vr.driveMode,bodyVisible:hero.rider.visible,eyeHeight:vr.eyeHeight,comfort:vr.comfort,controllers:xp.connected,secure:isSecureContext});
    canvas.dataset.fall=JSON.stringify({phase:s.fallPhase,brace:pose.crashBrace,release:pose.crashRelease,impact:pose.crashImpactPulse,bodyForward:pose.crashForward,wheelForward:pose.wheelCrashForward});
    canvas.dataset.trick=JSON.stringify({...sim.tricks.snapshot(),selected:selectedTrick});
    canvas.dataset.motion=JSON.stringify({state:paused?'paused':s.state,velocity:s.velocity,yawRate:pose.yawRate,turnIntent:pose.turnIntent,brake:pose.brakeAmount,compression:pose.landingCompression,extension:pose.takeoffExtension,airHeight:pose.airHeight,slip:pose.slipAngle,traction:pose.tractionUsage,lateralAcceleration:pose.lateralAcceleration,weightShift:pose.weightShift});
    quickHelp.textContent=inputDevice==='touch'?'Left thumb rides and steers. Hold/release Hop with your right thumb. Ride options changes view.':inputDevice==='gamepad'?'Left stick steers · RT rides · LT brakes · A holds/releases Hop · X recovers · Y changes view.':inputDevice==='vr'?'Use your configured Quest or Vive controls. Head tracking stays independent of flat-screen cameras.':'WASD rides and steers · S brakes · Space holds/releases Hop · R recovers · H recenters. Select Photo / orbit before dragging the view.';
    $('speedAlert').classList.toggle('beep-pulse',pose.beepPulse>.4&&!paused);
    $('speed').textContent=String(Math.round(Math.abs(s.speedKph)));$('location').textContent=elmwood?'ELMWOOD CEMETERY':parkContains(mapped.x,mapped.z)?'FREESTYLE YARD':locationAt(mapped.x,mapped.z).toUpperCase();
    $('distance').textContent=(s.distanceTravelled/1000).toFixed(2)+' km';$('run').textContent=race?race.rules.label:challengeRun?challengeRun.progress:`FREE RIDE${score?' · '+score+' PTS':''}`;district.update(challengeRun,pose.x,pose.z,pose.headingY);canvas.dataset.challenge=JSON.stringify(challengeRun?{id:challengeRun.challenge.id,start:challengeRun.challenge.start,end:challengeRun.challenge.end,gates:challengeRun.gateCount,totalGates:challengeRun.challenge.gates.length,count:challengeRun.count,elapsed:challengeRun.elapsed,done:challengeRun.done,failed:challengeRun.failed,score:challengeRun.score,medal:challengeRun.medal}:null);
    $('status').textContent=s.crashed?`${paused?'PAUSED · ':''}${s.crashCause.toUpperCase()} · ${recoveryLabel()}`:paused?'PAUSED':s.crouchCharge>.1?`HOP CHARGE ${Math.round(s.crouchCharge*100)}%`:seatedRide?'SEATED RIDE':cruise?'CRUISE':' ';
    $('speedAlert').textContent=paused||s.crashed?'':s.powerStage!=='normal'?`${s.powerStage.toUpperCase()} · EASE OFF`:pose.scrape>.05?'PEDAL SCRAPE · EASE THE CARVE':'';
    const hazard=encounterWarning.step((now-hudAt)/1000,pose,world,running&&!paused&&!finished);
    const m=toMap(pose.x,0,pose.z),route=cutCoords(m.x,m.z),feature=mapWorld.courseFeatures.find(f=>f.station-route.d>-f.length&&f.station-route.d<35);const courseWarning=!hazard&&feature&&running&&!paused?`${feature.kind==='jump'?'Jump ramp':'Slippery patch'} · ${Math.max(0,Math.round(feature.station-route.d))} m · pass ${feature.offset>0?'left':'right'} to avoid`:'';$('warning').hidden=!(hazard||courseWarning);$('warning').textContent=hazard||courseWarning;
    if(practice){$('practiceCopy').textContent=`${Math.min(4,practice.stepIndex+1)}/4 · ${practice.instruction}`;$('practiceHUD').hidden=!$('menu').hidden||vr.active;}
    $('toast').hidden=now>toastUntil||sim.crashed||paused;$<HTMLSelectElement>('camera').value=cameraMode;
    canvas.dataset.cruise=String(cruise);canvas.dataset.inputDevice=inputDevice;crashOverlay.hidden=!running||!sim.crashed||!$('menu').hidden||finished||vr.active;crashRecover.textContent=recoveryLabel();$<HTMLButtonElement>('cruise').disabled=paused||sim.crashed||finished;
    canvas.dataset.touchInput=JSON.stringify({throttle:touch.throttle,steer:touch.steer,crouch:touch.crouch,brake:touch.braking,hopHeld:touch.hopHeld});canvas.dataset.trafficKinds=JSON.stringify(mapWorld.traffic.map(t=>({id:t.id,kind:t.kind,speed:t.speed,x:t.x,y:t.y,z:t.z,heading:t.heading})));
    Object.assign(canvas.dataset,{seated:pose.seated.toFixed(3),speed:s.speed.toFixed(3),x:pose.x.toFixed(2),z:pose.z.toFixed(2),height:pose.y.toFixed(3),grounded:String(s.grounded),lean:s.riderPitch.toFixed(3),roll:s.rollAngle.toFixed(3),crouch:s.crouchCharge.toFixed(2),hops:String(s.hops),landings:String(s.landings),crashes:String(s.crashes),crashed:String(s.crashed),cameraMode,paused:String(paused),running:String(running),mode,checkpoint:String(gate),distance:s.distanceTravelled.toFixed(1),fps:fps.toFixed(1),drawCalls:String(renderer.info.render.calls),triangles:String(renderer.info.render.triangles),actors:String(mapWorld.traffic.length),score:String(score),finished:String(finished)});hudAt=now;
  }
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;renderer.setSize(innerWidth,innerHeight);camera.updateProjectionMatrix();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;clearInput();$('loading').hidden=false;$('loading').textContent='Restoring the graphics context…';});canvas.addEventListener('webglcontextrestored',()=>location.reload());







