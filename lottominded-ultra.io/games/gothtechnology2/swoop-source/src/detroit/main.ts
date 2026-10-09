import {registerDestinationCollision} from './tagSceneryCollisions.ts';
import {MapPhotographers} from './mapPhotographers.ts';
import {isCycle,ebikeProfile,eucProfile,vehicleOptions,vehicleSummary} from './electricVehicles.ts';
import {EbikeView,loadElectricAssets} from './electricVehicleView.ts';
import {SpatialAssetStream} from './spatialAssetStream.ts';
import {isCharacter} from './actorAvoidance.ts';
import {installDogCommandHud} from './dogCommandHud.ts';
import {installLoveTagMainMenu} from './loveTagMainMenu.ts';
import type {LoveTagClient} from '@digital-static/ridecore/tag-client';
let loveTag:LoveTagClient|undefined;
import {StartupCinema} from './startupCinema.ts';
import type {StoreEntrance} from './entranceFilms.ts';
import {OnlineRooms} from './onlineRooms.ts';
import type {RoomMatch} from './onlineProtocol.ts';
import {LandmarkMissionView} from './landmarkMissionView.ts';
import {pointOnCut} from './geography.ts';
import {NatureWorld} from './natureWorld.ts';
import {dryStreetSite} from './dryStreetSite.ts';
import {cherryTreeSites} from './treePlacement.ts';
import {NatureAudio} from './natureAudio.ts';
import {DogBarkAudio} from './dogCommandAudio.ts';
import {followStableSun} from './stableSun.ts';
import {riderEyeMotion,RIDER_EYE_PITCH} from '@digital-static/ridecore';
import {loadingCinema} from './loadingCinema.ts';
import {boot,bootStage,renderBoot,failBoot} from './bootUi.ts';
import {BicycleAdapter} from './bicycleAdapter.ts';
import {LaneRoute} from '@digital-static/ridecore/cycling';
import {BicycleView,BIKE_STYLES,CyclingSession} from '@digital-static/ridecore/cycling-view';
import {ridingCompanion,computerBikeContact} from './cyclistContacts.ts';
import {BikeRaceInvitation} from './bikeRaceInvitation.ts';
import {createGraphicsQuality,startupAntialias} from './graphicsQuality.ts';
import {detroitMinimap} from './detroitMinimap.ts';
import {DETROIT_RACE_COURSE} from './detroitRaceMap.ts';
import {settingsPanel} from './settingsPanel.ts';
import {GameFilm} from './gameFilm.ts';
import {StudioCapture} from './studioCapture.ts';
import {StudioScreens} from './studioScreens.ts';
import {ArcadeCabinets} from './arcadeCabinets.ts';
import {buildLottoShop} from './lottoShop.ts';
import {buildPennyShop} from './pennyShop.ts';
import {PENNY_SHOP,pennyMap} from './pennyShopSite.ts';
import {indoorRideArea} from './indoorRiding.ts';
import {LOTTO_SHOP,lottoMap} from './lottoShopSite.ts';
import {installTouchLayout} from './touchLayout.ts';
import {FrameSchedule} from './frameSchedule.ts';
import {PARK_SPAWN,buildFreestylePark,parkContains} from './freestylePark.ts';
import {windTime} from './windMotion.ts';
import {RouteSky,DAY_SUN,DUSK_SUN} from './routeSky.ts';
import {CourseFeatureView} from './courseFeatureView.ts';
import {AdaptiveQuality} from './adaptiveQuality.ts';
import {buildMackStudio} from './mackStudio.ts';
import {MACK_STUDIO,studioMap,studioRoom,studioCoordinates} from './mackStudioSite.ts';
import {GalleryVisit} from './galleryVisit.ts';
import {destinationLayout} from './destinationLayout.ts';
import {RouteAmbience,cutEffectPatches} from './routeAmbience.ts';
import {RideConfirmation,RiderLamp} from './rideEffects.ts';
import {ContactEffects} from './contactEffects.ts';
import {SplitRaceSimulation} from './splitRaceSimulation.ts';
import {SplitRaceView} from './splitRaceView.ts';
import {OnlineViewPreference} from './onlineViewPreference.ts';
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
import {FollowCamera,chaseFrameFov} from './followCamera.ts';
import {underpassCameraHeight} from './cameraClearance.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
import * as T from 'three';

import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import { createPose,copyPose,lerpPose } from './controller.ts';
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
import './mobileHud.css';
import './arrivalHud.css';
import {northUp} from './routeMap.ts';
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
if(!elmwood)for(const [name,store] of [['Serengeti Galleries forecourt',false],['GothTechnology store',true]] as const){const p=destinationLayout(store),room=studioRoom(store),at=studioMap(room.u,29),local=toLocal(at.x,MACK_STUDIO.floor,at.z);SPOTS.push({name:name+' · 2000 Mack',...local,heading:p.heading+Math.PI});}
if(!elmwood)for(const [name,u,v]of [['Green screen studio',0,-16],['GothTech showroom',12,5.5],['Serengeti print shop',-12,7.6]] as const){const p=studioMap(u,v);SPOTS.push({name:name+' · 2000 Mack',...toLocal(p.x,MACK_STUDIO.floor,p.z),heading:MACK_STUDIO.heading+(u===0?0:Math.PI)});}
if(!elmwood){for(const [name,u,v]of [['LottoMind store · Mack Avenue',0,6.6],['LottoMind storefront · Mack Avenue',0,16.1],['LottoMind street entrance',-4.35,-20.1]]as const){const p=lottoMap(u,v);SPOTS.push({name,...toLocal(p.x,LOTTO_SHOP.floor+.068,p.z),heading:LOTTO_SHOP.heading+(v<0?0:Math.PI)});}const p=studioMap(-9.7,17.7);SPOTS.push({name:'Studio arcade · 2000 Mack',...toLocal(p.x,MACK_STUDIO.floor+.078,p.z),heading:MACK_STUDIO.heading});const q=studioMap(14.35,.6);SPOTS.push({name:'GothTech arcade · Underground',...toLocal(q.x,MACK_STUDIO.floor+.078,q.z),heading:MACK_STUDIO.heading+Math.PI});}
if(!elmwood){const p=pennyMap(0,6.7);SPOTS.push({name:'Penny Exchange · next to LottoMind',...toLocal(p.x,PENNY_SHOP.floor+.071,p.z),heading:PENNY_SHOP.heading+Math.PI});}
const coarsePointer=matchMedia('(any-pointer: coarse)');document.documentElement.classList.toggle('touchDevice',coarsePointer.matches);coarsePointer.addEventListener('change',()=>document.documentElement.classList.toggle('touchDevice',coarsePointer.matches));
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=$<HTMLCanvasElement>('world');
boot.assertActive();
const mobileGraphics=/Android|iPhone|iPad|Mobile|OculusBrowser/i.test(navigator.userAgent)||navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent);
const renderer=new T.WebGLRenderer({canvas,antialias:startupAntialias(),powerPreference:mobileGraphics&&!(navigator.hardwareConcurrency>=8)?'low-power':'high-performance'});
// Catch loss during asset loading too, before input and the simulation exist.
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.dataset.paused='true';renderer.setAnimationLoop(null);boot.fail('Graphics were interrupted. Reload to return to the menu.','WebGL context lost; reload releases this session before retrying.');renderBoot();});
const adaptiveQuality=new AdaptiveQuality();renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=elmwood?1.0:1.1;
const scene=new T.Scene();scene.background=new T.Color('#c9dce0');scene.fog=new T.Fog('#c9dce0',elmwood&&compactElmwood?65:130,elmwood&&compactElmwood?165:370);
const graphics=createGraphicsQuality(renderer,scene,canvas);
const onlineView=new OnlineViewPreference(typeof localStorage==='undefined'?undefined:localStorage);
const sky=new RouteSky();scene.add(sky);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.08,1500);
const pm=new T.PMREMGenerator(renderer);
try{
if(elmwood){
  const hdr=await new HDRLoader().loadAsync('/textures/elmwood-library/forest_grove_2k.hdr');
  scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.55;hdr.dispose();
}else{const hdr=await new HDRLoader().loadAsync(new URL('../../art/nvidia/detroit-skylight.hdr',import.meta.url).href);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.6;hdr.dispose();canvas.dataset.lighting='NVIDIA OptiX baked skylight';}
}catch(error){console.warn('Skylight unavailable; using scene lights',error);canvas.dataset.lighting='Scene lights';}finally{pm.dispose();}
const hemi=new T.HemisphereLight('#d3e9f6','#7d7659',elmwood?.95:1.15),sun=new T.DirectionalLight('#ffe4b7',elmwood?2.5:2.0);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:36,bottom:-30,near:.1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(hemi,sun,sun.target);
const fill=new T.DirectionalLight('#c1d7ed',elmwood?.22:.55);scene.add(fill,fill.target);if(elmwood)scene.environmentIntensity=.4;
const mapWorld=elmwood?new ElmwoodWorld():new DetroitWorld(),world=new GeoTerrain(mapWorld);
const cherryGround=createGroundSample();let nature:NatureWorld,natureAudio:NatureAudio;

const effectPatches=elmwood||qaVisualBaseline?[]:cutEffectPatches();
const contactEffects=qaVisualBaseline?undefined:new ContactEffects(scene,world,effectPatches);
const confirmation=new RideConfirmation(document.body),riderLamp=new RiderLamp(scene,world);let ambience:RouteAmbience|undefined;
function confirmRide(kind:string,text:string,token:string){if(confirmation.show(kind,text,token))rideAudio.confirm(kind);}
const mapScene=new T.Scene();scene.add(mapScene);mapScene.scale.x=-1;mapScene.position.set(MAP_ORIGIN.x,-MAP_ORIGIN.y,-MAP_ORIGIN.z);
const updateMap=elmwood?createElmwoodMap():createRouteMap();
const miniMap=elmwood?undefined:detroitMinimap(()=>{clearInput();if(running&&!paused)pause();},()=>canvas.focus());
const film=new GameFilm('Swoop Detroit',canvas,()=>split?split.view.heroes.map(h=>({root:h.root,body:h.rider})):[{root:sim?.cycling&&bicycleView?bicycleView.root:hero.root,body:sim?.cycling&&bicycleView?bicycleView.rider:hero.rider},...(dogEnabled?[{root:dogView.root}]:[])],()=>{clearInput();if(running&&!paused)pause();loop.stopReplay(false);$('helpPanel').hidden=true;$('menu').hidden=true;});
const studioCapture=elmwood?undefined:new StudioCapture(canvas,()=>{clearInput();canvas.focus();});
const cabinets=elmwood?undefined:new ArcadeCabinets(canvas,()=>{clearInput();paused=true;$('paused').hidden=true;studioScreens?.update(current.x,current.z,false);},()=>{clearInput();paused=false;$('paused').hidden=true;canvas.focus();});
let studioScreens:StudioScreens|undefined,lottoShop:Awaited<ReturnType<typeof buildLottoShop>>|undefined,pennyShop:Awaited<ReturnType<typeof buildPennyShop>>|undefined;
let pennyPausedRide=false;
let lottoAppPausedRide=false;
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
function mapChooser(){const label=document.createElement('label');label.textContent='MAP ';const select=document.createElement('select');select.setAttribute('aria-label','Choose riding map');for(const[value,name]of [['cut','Dequindre Cut'],['elmwood','Elmwood Explorer']]){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}select.value=elmwood?'elmwood':'cut';select.onchange=()=>{const url=new URL(location.href);if(select.value==='elmwood')url.searchParams.set('map','elmwood');else url.searchParams.delete('map');location.assign(url.href);};label.append(select);return label;}
if(elmwood){const label=document.createElement('label');label.textContent='VISUAL DETAIL';const select=document.createElement('select');select.setAttribute('aria-label','Visual detail');for(const[value,title]of [['auto','Automatic'],['detailed','Detailed - PC'],['compact','Lighter - Quest / mobile']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}select.value=detailChoice;select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('quality',select.value);location.assign(url.href);};label.append(select);document.querySelector('.options')!.append(label);}
document.querySelector('.options')!.prepend(mapChooser());$('mapPanel').querySelector('h2')!.after(mapChooser());
let photographers:MapPhotographers|undefined;let hero!:Hero,traffic:TrafficView,scenery:Awaited<ReturnType<typeof buildScenery>|ReturnType<typeof buildElmwood>>,sim:BicycleAdapter;
let bicycleView:BicycleView|undefined,community:CyclingSession|undefined;
const communityActive=()=>running&&mode==='free'&&!practice&&!race&&!split&&!challengeRun&&!vr.active;
const cycleOptions=document.createElement('div');cycleOptions.className='cycleOptions';cycleOptions.innerHTML='<label for="ride-vehicle">What will you ride?<select id="ride-vehicle"><option value="euc">Electric unicycle (one wheel)</option></select></label><div id="bikeOptions" hidden><label for="bike-style">Bicycle color<select id="bike-style"></select></label><p>Bicycles use the original suited rider. Push forward to pedal and let go to coast. Pull back to brake; keep holding after stopping to back up slowly. Free riding and races support bicycles.</p></div><button id="community-start">Join the group ride</button>';
$('start').before(cycleOptions);const vehicle=$<HTMLSelectElement>('ride-vehicle'),bikeStyle=$<HTMLSelectElement>('bike-style');bikeStyle.replaceChildren(...BIKE_STYLES.map((s,i)=>new Option(s.name,String(i))));vehicleOptions(vehicle);const performanceCard=document.createElement('p');performanceCard.setAttribute('role','status');performanceCard.style.cssText='line-height:1.5;color:#b3e9e6;max-width:46ch';cycleOptions.append(performanceCard);
function chooseVehicle(cycling:boolean){if(!sim)return;const id=cycling?vehicle.value:(!isCycle(vehicle.value)?vehicle.value:'euc');sim.selectVehicle(id);for(const name of ['specialMove','hop','crouch']){const b=$<HTMLButtonElement>(name);b.disabled=cycling;b.title=cycling?'Select the EUC to use this action.':'';}clearInput();loop.stopReplay(false);loop.flow.cancel();if(cycling){setRider('DS_Man_01',false);const p=ebikeProfile(id);bicycleView?.dispose();bicycleView=p?new EbikeView(actorData.get('Ebike_'+p.id)!,actorData.get('DS_Man_01')!,p):new BicycleView(actorData.get('DS_Bicycle_01')!,actorData.get('DS_Man_01')!,Number(bikeStyle.value));scene.add(bicycleView.root);}else setRider(wheelRider);if(bicycleView)bicycleView.root.visible=cycling;}

function travelCommunity(){if(!ready||!community||vr.active)return;$<HTMLSelectElement>('mode').value='free';stopRace();practice=undefined;challengeRun=undefined;district.setRun();mode='free';chooseVehicle(isCycle(vehicle.value));reset(selectedSpot,850);const at=community.ride.route.at(0,-.5);sim.reset({position:{x:at.x,y:world.sampleGround(at.x,at.z,ground).height,z:at.z},headingY:at.headingY});remount();community.ride.recover();loop.startRun(undefined,selectedRider,actorData,current);beginRide();community.ui.panel.open=true;}
$('community-start').onclick=async()=>{if(!actorData)return;try{await loadElectricAssets(actorData,vehicle.value);travelCommunity();community?.ride.restart();}catch{toast('Vehicle could not load. Try again.');}};
let actorData:Awaited<ReturnType<typeof loadActors>>,selectedRider=riderChoice(null);
try{const saved=localStorage.getItem('digital-static-rider');selectedRider=riderChoice(saved);if(!localStorage.getItem('digital-static-hero-default-v1')&&(!saved||saved==='DS_Man_01')){selectedRider='DS_Armored_Rider_01';localStorage.setItem('digital-static-rider',selectedRider);}localStorage.setItem('digital-static-hero-default-v1','true');}catch{}
$('heroSelect').replaceChildren();
for(const r of RIDER_CHOICES){const o=document.createElement('option');o.value=r.id;o.textContent=r.label;$('heroSelect').append(o);}
$<HTMLSelectElement>('heroSelect').value=selectedRider;
let wheelRider=selectedRider;
function setRider(value:string,remember=true){
  if(sim?.cycling&&value!=='DS_Man_01'&&($('menu').hidden||isCycle(vehicle.value))){toast('Bicycle fit uses the original rider. Select EUC for other riders.');$<HTMLSelectElement>('heroSelect').value='DS_Man_01';return;}
  if(running&&(challengeRun||race||split)&&!finished){if($('menu').hidden){$<HTMLSelectElement>('heroSelect').value=selectedRider;toast('Open the menu to choose a different rider and start a new attempt.');return;}stopRace();challengeRun=undefined;district.setRun();running=false;$('resumeRide').hidden=true;}
  selectedRider=riderChoice(value);$<HTMLSelectElement>('heroSelect').value=selectedRider;
  $('riderQuick').textContent=RIDER_CHOICES.find(r=>r.id===selectedRider)!.label;
  if(actorData){const board=hero?.skateboarding??false;hero?.dispose();const e=eucProfile(vehicle.value),rideAssets=new Map(actorData);if(e&&actorData.has('Euc_'+e.id))rideAssets.set('DS_EUC_01',actorData.get('Euc_'+e.id)!);hero=new Hero(rideAssets,world,selectedRider);hero.skateboarding=board;hero.apply(pose);scene.add(hero.root);if(sim){sim.wheelScale=hero.wheelScale;sim.mountedVolume=hero.mountedVolume;loop.startRun(undefined,selectedRider,actorData,current);}}
  canvas.dataset.hero=selectedRider;if(remember){wheelRider=selectedRider;try{localStorage.setItem('digital-static-rider',selectedRider);}catch{}}
}
const dog=new DogFollower(world),dogPose={...dog.current};let dogView:CompanionView;
const current=createPose(),previous=createPose(),pose=createPose();
const follow=new FollowCamera(world),ground=createGroundSample();
let ready=false,running=false,paused=false,clock=0,acc=0,last=performance.now(),mode='free',selectedSpot=0,gate=0,score=0,finished=false,lastTraffic=0;
let challengeRun:DistrictRun|undefined,photoPending=false;
world.extraActors=()=>[...(communityActive()?community?.ride.obstacles()??[]:[]),...(race?.obstacles()??[]),...(running&&dogEnabled&&!split?[{id:'companion',x:dog.current.x,y:dog.current.y,z:dog.current.z,radius:.36,height:.85,kind:'dog',vx:Math.sin(dog.current.heading)*dog.current.speed,vz:Math.cos(dog.current.heading)*dog.current.speed}]:[])];
mapWorld.crowdActors=()=>[...(communityActive()?community?.ride.obstacles().map(o=>({...o,...toMap(o.x,o.y,o.z),vx:-o.vx}))??[]:[]),...(running&&dogEnabled&&!split?[{id:'companion',...toMap(dog.current.x,dog.current.y,dog.current.z),radius:.36,height:.85,kind:'dog',vx:-Math.sin(dog.current.heading)*dog.current.speed,vz:Math.cos(dog.current.heading)*dog.current.speed}]:[])];
let race:RivalRace|undefined;let practice:PracticeCoach|undefined;const encounterWarning=new EncounterWarning();
const riderTerrain=world.withActorPassThrough(o=>ridingCompanion(o,communityActive()&&!!community?.ride.joined,!!race?.cyclingOpponents)||(o.kind==='dog'&&!!world.riderProtectionAt(current.x,current.z))).withActorRayPassThrough(isCharacter);
const bikeInvitation=new BikeRaceInvitation(()=>startRace(true),()=>canvas.focus());
let split:{simulation:SplitRaceSimulation;view:SplitRaceView;input:SplitRideInput;audio:RideAudio[]}|undefined,startingOnline=false;
const splitPhotoAim=new Map<number,string>();
function stopSplit(){if(!split)return;if(online.active&&!startingOnline)void online.leave(false);split.view.dispose();split.audio.forEach(a=>void a.dispose());split=undefined;splitPhotoAim.clear();document.body.classList.remove('splitPlaying','onlinePlaying');delete canvas.dataset.splitRace;delete canvas.dataset.online;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);hero.root.visible=true;dogView.root.visible=dogEnabled;}
function stopRace(){miniMap?.hud.setRaceCourse(null);stopSplit();race?.dispose();race=undefined;document.body.classList.remove('racing');}
function recoverSplit(index:number){if(!split||paused&&!online.active)return;if(split.simulation.recover(index)){split.input.clear(online.active?0:index);split.view.resetTouch(index);split.view.recovered(index);canvas.focus();}}
function cruiseSplit(index:number){const slot=online.active?online.slot:index;if(!split||paused||finished||slot<0||split.simulation.rules.countdown>0||split.simulation.riders[slot].sim.crashed||split.simulation.rules.racers[slot].finish!==null)return;split.input.toggleCruise(index);canvas.focus();}
function photoSplit(index:number){if(!split||paused&&!online.active)return;const rider=split.simulation.riders[index],run=rider.challenge;if(!run||run.challenge.kind!=='discovery')return;const target=district.targets.filter(t=>!run.photos.has(t.id)).sort((a,b)=>Math.hypot(a.x-rider.pose.x,a.z-rider.pose.z)-Math.hypot(b.x-rider.pose.x,b.z-rider.pose.z))[0];if(!target){rider.message='All photos collected. Follow the gates to Mack.';return;}if(splitPhotoAim.get(index)!==target.id){splitPhotoAim.set(index,target.id);split.view.framePhoto(index,target);rider.message='Framing '+target.name+' · stop and press Photo again';}else {const check=split.view.photoCheck(index,target);const saved=run.capture(target.id,check);rider.message=saved?'PHOTO SAVED · '+target.name:'Stop within 3–42 m with a clear view of '+target.name;if(saved){split.view.clearPhoto(index);splitPhotoAim.delete(index);}}canvas.focus();}
function startSplit(){
 if(!ready||vr.active)return;
 chooseVehicle(false);community?.ride.cancel();if(community){community.view.root.visible=false;community.ui.update(false);}
 if(elmwood){const url=new URL(location.href);url.searchParams.delete('map');url.searchParams.set('tab','split');location.assign(url.href);return;}
 const count=Number($<HTMLSelectElement>('splitPlayerCount').value),ids=[selectedRider,...Array.from({length:count-1},(_,i)=>riderChoice($<HTMLSelectElement>('splitRider'+(i+2)).value))],bindings=Array.from({length:count},(_,i)=>$<HTMLSelectElement>('splitInput'+(i+1)).value as SplitBinding);
 const error=new Set(ids).size!==ids.length?'Choose a different rider for each player.':splitSetupError(bindings,Array.from(navigator.getGamepads?.()??[]));$('splitSetupError').textContent=error;if(error)return;
 stopRace();practice=undefined;$('practiceHUD').hidden=true;challengeRun=undefined;district.setRun();loop.stopReplay(false);loop.flow.cancel();mode='split';reset(selectedSpot,RACE_ROUTE.start);mapWorld.updateTraffic(0,1e8,1e8);mapWorld.step();
 const selected=$<HTMLSelectElement>('splitSessionMode').value,challenge=CHALLENGES.find(c=>c.id===selected),sessionMode=selected==='free'?'free':selected==='race'?'race':'challenge';if(sessionMode==='free'){selectedSpot=Number($<HTMLSelectElement>('spawn').value);reset(selectedSpot);}
 const simulation=new SplitRaceSimulation(world,ids,{mode:sessionMode,spawn:SPOTS[selectedSpot],challenge}),input=new SplitRideInput(bindings),audio=ids.slice(1).map(()=>new RideAudio());
 const view=new SplitRaceView(scene,simulation,actorData,bindings,{pause,input,display:openDisplaySettings,restart:startSplit,menu:()=>$('menuButton').click(),recover:recoverSplit,cruise:cruiseSplit,photo:photoSplit,camera:i=>{split?.view.toggleCamera(i);canvas.focus();}},effectPatches,[rideAudio,...audio]);
 split={simulation,input,view,audio};loop.startRun(undefined,selectedRider,actorData,current);beginRide();document.body.classList.add('splitPlaying');hero.root.visible=false;dogView.root.visible=false;traffic.update(mapWorld.traffic.map(t=>({...t,...toLocal(t.x,t.y,t.z),heading:-t.heading})),0);contactEffects?.reset();confirmation.reset();pedalSparks.reset();audio.forEach(a=>void a.enable(!muted));canvas.focus();
}
async function startRace(bicycleOpponents=false){if(!ready)return;try{await loadElectricAssets(actorData,vehicle.value,true);}catch{toast("Race vehicles could not load. Try again.");return;}chooseVehicle(isCycle(vehicle.value)&&!vr.active);community?.ride.cancel();practice=undefined;$('practiceHUD').hidden=true;if(elmwood){const url=new URL(location.href);url.searchParams.delete('map');url.searchParams.set('tab','race');location.assign(url.href);return;}stopRace();challengeRun=undefined;district.setRun();mode='race';reset(selectedSpot,RACE_ROUTE.start);mapWorld.updateTraffic(0,1e8,1e8);mapWorld.step();race=new RivalRace(scene,world,actorData,selectedRider,$<HTMLSelectElement>('raceDifficulty').value as RaceDifficulty,sim,sim.cycling,bicycleOpponents||sim.cycling,ebikeProfile(sim.vehicleId),eucProfile(sim.vehicleId));loop.startRun(undefined,selectedRider,actorData,current);beginRide();document.body.classList.add('racing');setCamera('chase');toast((race.cyclingOpponents?'Cyclists':'Rivals')+' ready · follow the gates to Mack Avenue. No time cutoff.');}
function finishRace(){if(!race||finished)return;finished=true;clearInput();if(race.rules.player.finish!==null)loop.flow.bank();else loop.flow.cancel();score=loop.flow.banked;race.finish(score);}

let trickRequest=0,selectedTrick=1;
const deviceRearm=new NeutralRearm();
let inputDevice:'keyboard'|'touch'|'gamepad'|'vr'='keyboard';
let handledCrash=0;
let cameraMode='chase',firstYaw=0,firstPitch=RIDER_EYE_PITCH,orbitYaw=0,orbitHeight=2.2,orbitDistance=5,night=false,cruise=false,hop=false,resetPressed=false,muted=false;
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
canvas.addEventListener('online-release-input',()=>clearInput());
function clearInput(){
 split?.input.clear();split?.view.resetTouch();
 trickRequest=0;keys.clear();resetTouch();hop=false;resetPressed=false;cruise=false;acc=0;
 deviceRearm.interrupt();clearCameraTouches();encounterWarning.reset();toastUntil=0;$('toast').hidden=true;
 $('stickThumb').style.transform='translate(-50%,-50%)';
}
function remount(){
 sim.writePose(current);copyPose(current,previous);copyPose(current,pose);clearInput();
 follow.reset(current);orbitDistance=5;orbitHeight=2.2;firstYaw=0;firstPitch=RIDER_EYE_PITCH;
 if(!vr.active)setCamera('chase');hero.apply(pose);contactEffects?.reset();confirmation.reset();pedalSparks.reset();loop.flow.cancel();
 canvas.focus();
}
function crashEntry(){
 const count=sim.snapshot().crashes;if(count===handledCrash)return;handledCrash=count;
 clearInput();loop.flow.cancel();pedalSparks.reset();contactEffects?.reset();confirmation.reset();toast('Fall · recover when ready');
}
function recoveryLabel(){return inputDevice==='gamepad'?'Recover · X / Square':inputDevice==='keyboard'?'Recover · R':'Recover';}

const bikeRecover=document.createElement('button');bikeRecover.id='bike-recover';bikeRecover.type='button';bikeRecover.textContent='Recover bike · R';bikeRecover.style.minHeight='44px';bikeRecover.hidden=true;bikeRecover.onclick=queueRecovery;$('pause').after(bikeRecover);

function queueRecovery(){
 if(!ready||!running)return;
 community?.ride.recover();if(split){recoverSplit(0);return;}
 if(race&&finished){startRace(race.cyclingOpponents);return;}
 if(challengeRun&&!finished){const c=challengeRun,station=c.gateCount?c.challenge.gates[c.gateCount-1]+.5:c.challenge.start,p=routePosition(station);if(!sim.recover({position:{...p,y:world.sampleGround(p.x,p.z,ground).height},headingY:p.heading})){toast('Recovery space occupied · wait, then try again');return;}c.step(1/120,{station,offset:0,speed:0,grounded:true,crashed:false,roll:0,slip:0,traction:0,airHeight:0,recovered:true});remount();toast('Recovered at checkpoint · continue to Mack Avenue');return;}
 if(race){
  const r=race.rules.player,station=r.gate?RACE_ROUTE.gates[r.gate-1]+.5:RACE_ROUTE.start,p=routePosition(station);
  if(!sim.recover({position:{...p,y:world.sampleGround(p.x,p.z,ground,current.y).height},headingY:p.heading})){toast('Recovery space occupied · wait, then try again');return;}
  // Only rebase progress after placement succeeds. No gate award or clock rewind.
  race.rules.recover(selectedRider);
 }else if(!sim.recover()){toast('Recovery space occupied · wait, then try again');return;}
 remount();practice?.action('recover');toast(race?'Recovered · race clock keeps running':paused?'Recovered · Resume when ready':'Recovered · release controls, then ride');
}

function reset(spot=selectedSpot,station?:number){
  landmarkMission?.cancel();
  gallery?.reset();boutique?.reset();
  if(!elmwood){const seed=challengeRun?.challenge.id.startsWith('daily-')?[...challengeRun.challenge.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,23):crypto.getRandomValues(new Uint32Array(1))[0];mapWorld.setHazards(seed,station??cutCoords(toMap(SPOTS[spot].x,0,SPOTS[spot].z).x,toMap(SPOTS[spot].x,0,SPOTS[spot].z).z).d,mode==='race'||mode==='split'||!!challengeRun?.challenge.features);courseView.set(mapWorld.courseFeatures);canvas.dataset.hazards=JSON.stringify({seed,count:mapWorld.hazards.length,features:mapWorld.courseFeatures});}
  mapWorld.clearRecoverySpace();mapWorld.rideIntent={speed:0,heading:0};
  if(hero)hero.skateboarding=false;sitButton.disabled=false;sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');boardButton.textContent='Switch to skateboard';boardButton.setAttribute('aria-pressed','false');
  selectedSpot=spot;const s=station===undefined?SPOTS[spot]:routePosition(station);sim.reset({position:{x:s.x,y:world.sampleGround(s.x,s.z,ground).height,z:s.z},headingY:s.heading});
  sim.writePose(current);copyPose(current,previous);copyPose(current,pose);follow.reset(current);
  dog.reset(current);pedalSparks.reset();contactEffects?.reset();confirmation.reset();
  handledCrash=0;clock=0;lastTraffic=0;const p=toMap(s.x,0,s.z);mapWorld.updateTraffic(0,p.x,p.z);mapWorld.step();gate=0;score=0;finished=false;acc=0;clearInput();$('paused').hidden=true;
}
function beginRide(){if(!$('menu').hidden)startupCinema?.arrive();unlockRideAudio();loop.music.unlock();document.body.classList.add('playing');setCompanion($<HTMLSelectElement>('companion').value==='dog');running=true;paused=false;photoPending=false;$('menu').hidden=true;$('mapPanel').hidden=true;$('helpPanel').hidden=true;$('pause').textContent='Pause';$('paused').hidden=true;$('status').textContent='';$('run').textContent=challengeRun?.progress??'FREE RIDE';canvas.focus();}
async function start(){if(!ready||preparingSpawn)return;const cinema=loadingCinema();cinema.status('Loading your wheels and starting place…');try{await prepareSpawn(Number($<HTMLSelectElement>('spawn').value));await loadElectricAssets(actorData,vehicle.value,$<HTMLSelectElement>('mode').value==='race');}catch{toast('This place could not load. Try again.');return;}finally{cinema.finish();}practice=undefined;$('practiceHUD').hidden=true;const selected=$<HTMLSelectElement>('mode').value;if(isCycle(vehicle.value)&&!['free','race'].includes(selected)){toast('Choose Free ride or Rival race for bicycles.');$('status').textContent='Select Free ride or Rival race for the bicycle.';return;}chooseVehicle(isCycle(vehicle.value)&&!vr.active);if(community?.ride.stage==='cleanup')community.ride.restart();if(selected==='race'){startRace();return;}if(selected==='split'){startSplit();return;}stopRace();if(selected!=='free'){startChallenge(CHALLENGES.find(c=>c.kind===selected)!);return;}challengeRun=undefined;district.setRun();mode='free';selectedSpot=Number($<HTMLSelectElement>('spawn').value);reset();loop.startRun(undefined,selectedRider,actorData,current);beginRide();setCamera('chase');}
function startChallenge(c:Challenge){if(!ready)return;chooseVehicle(false);community?.ride.cancel();practice=undefined;$('practiceHUD').hidden=true;stopRace();district.selected=c.id;mode=c.kind;challengeRun=new DistrictRun(c);reset(selectedSpot,c.start);district.setRun(challengeRun);loop.startRun(c,selectedRider,actorData,current);if(c.id.startsWith('daily-')&&night)toggleLight();beginRide();setCamera(c.kind==='discovery'?'photo':'chase');toast(c.kind==='trial'?'GO · Follow the gold gates. Brake for people.':c.description);}
function freeRideHere(){mapWorld.courseFeatures=[];courseView.set([]);canvas.dataset.hazards=JSON.stringify({seed:mapWorld.hazardSeed,count:mapWorld.hazards.length,features:[]});practice=undefined;practiceHUD.hidden=true;stopRace();challengeRun=undefined;district.setRun();mode='free';finished=false;paused=false;clearInput();loop.startRun(undefined,selectedRider,actorData,current);beginRide();setCamera('chase');$<HTMLSelectElement>('mode').value='free';district.filter('free');}
function completeChallenge(){if(finished||!challengeRun)return;if(challengeRun.failed&&sim.crashed){const cause=sim.crashCause;challengeRun.reason=cause==='collision'?'Collision. Leave room for other path users and brake before obstacles. Retry / N starts immediately.':cause==='hard landing'?'Hard landing. Use a smaller hop and absorb the touchdown with a crouch. Retry / N starts immediately.':cause==='sideways landing'?'Sideways landing. Align the wheel with your direction of travel before touchdown. Retry / N starts immediately.':cause==='trail boundary'?'Outside the rideable trail. Follow the marked line. Retry / N starts immediately.':cause+'. Retry / N starts immediately.';}finished=true;clearInput();if(challengeRun.failed)loop.flow.cancel();district.finish(challengeRun);loop.finish(challengeRun,current);}
const district=new DistrictView(scene,startChallenge,()=>loop.retry(),freeRideHere,()=>setCamera('photo'),()=>{photoPending=true;canvas.focus();});
const loop=new RideLoop(scene,district,world,elmwood?'elmwood':'cut',startChallenge,freeRideHere,toast);
if(elmwood){$('districtBoard').hidden=true;$<HTMLSelectElement>('mode').innerHTML='<option value="free">Free ride</option>';$('menuCopy').textContent='Explore the garden lanes, pond and wooded grounds of Elmwood Cemetery. Choose your rider and optional Boerboel companion.';document.querySelector('.eyebrow')!.textContent='DETROIT • ELMWOOD CEMETERY';document.title='Elmwood Explorer | Swoop . Detroit';$('menuTitle').textContent='ELMWOOD EXPLORER';$('mapPanel').querySelector('small')!.textContent='Paths traced from the official cemetery plan. Heights, vegetation and individual monuments are approximate; this is a game environment.';const source=$('mapPanel').querySelector('a')!;source.href=ELMWOOD_SOURCE;source.textContent='Official Elmwood plan ↗';}
const crashOverlay=document.createElement('section');crashOverlay.id='crashOverlay';crashOverlay.hidden=true;crashOverlay.setAttribute('aria-label','Crash recovery');
const crashCopy=document.createElement('p');crashCopy.textContent='Take a breath. Your banked points are safe.';
const crashRecover=document.createElement('button');crashRecover.id='crashRecover';crashRecover.textContent='Recover';crashRecover.onclick=queueRecovery;crashOverlay.append(crashCopy,crashRecover);document.body.append(crashOverlay);
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')inputDevice='touch';},{passive:true});
const mapRecover=document.createElement('button');mapRecover.textContent='Recover rider';mapRecover.onclick=queueRecovery;$('mapPanel').append(mapRecover);
const mobileMap=document.createElement('button');mobileMap.textContent='Map';mobileMap.id='mobileMap';mobileMap.onclick=()=>{$('map').click();$('ridingOptions').classList.remove('expanded');$('optionsToggle').setAttribute('aria-expanded','false');};$('ridingOptions').append(mobileMap);
const trickSelect=document.createElement('select');trickSelect.id='trickSelect';trickSelect.setAttribute('aria-label','Special move');
for(const move of SPECIAL_MOVES){const option=document.createElement('option');option.value=String(move.id);option.textContent=move.name;trickSelect.append(option);}
$('ridingOptions').append(trickSelect);
const trickHint=document.createElement('p');trickHint.id='trickReadiness';trickHint.style.cssText='font-size:12px;max-width:220px;margin:4px';$('ridingOptions').append(trickHint);
function chooseTrick(id:number){selectedTrick=id;trickSelect.value=String(id);for(const button of document.querySelectorAll<HTMLElement>('[data-touch-action="trick"]'))button.textContent='Trick · '+SPECIAL_MOVES[id-1].name;}
function requestTrick(id=selectedTrick){if(sim?.cycling){toast('Bicycle · pedal, coast and brake. EUC tricks are unavailable.');return;}if(!ready||!running||paused||finished)return;if(sim.crashed){toast('Recover before starting a trick');return;}chooseTrick(id);trickRequest=id;cruise=false;canvas.focus();}
trickSelect.onchange=()=>chooseTrick(Number(trickSelect.value));$('specialMove').onclick=()=>requestTrick();
const ridingOptions=$('ridingOptions');$('optionsToggle').onclick=()=>{const open=!ridingOptions.classList.contains('expanded');ridingOptions.classList.toggle('expanded',open);$('optionsToggle').setAttribute('aria-expanded',String(open));};
const rideCamera=document.createElement('button');rideCamera.id='rideCamera';rideCamera.textContent='Recenter / Ride camera';rideCamera.onclick=recenterCamera;$('ridingOptions').append(rideCamera);
const eyesCamera=document.createElement('button');eyesCamera.id='eyesCamera';eyesCamera.textContent='First person';eyesCamera.onclick=()=>{if(!vr.active)setCamera('first',true);};$('ridingOptions').append(eyesCamera);
const orbitCamera=document.createElement('button');orbitCamera.textContent='Photo / orbit';orbitCamera.onclick=()=>{if(!vr.active)setCamera('orbit',true);};$('ridingOptions').append(orbitCamera);
const touchToggle=document.createElement('button');touchToggle.id='touchToggle';let manualTouch='auto';try{const value=localStorage.getItem('swoop-touch-visibility')??localStorage.getItem('swoop-touch-layout');manualTouch=['auto','on','off'].includes(value??'')?value!:'auto';}catch{}
function applyTouchChoice(){document.documentElement.classList.toggle('hideTouch',manualTouch==='off');document.documentElement.classList.toggle('forceTouch',manualTouch==='on');touchToggle.textContent='Touch controls: '+manualTouch;touchToggle.setAttribute('aria-pressed',String(manualTouch==='on'));}
touchToggle.onclick=()=>{manualTouch=manualTouch==='auto'?'on':manualTouch==='on'?'off':'auto';clearInput();applyTouchChoice();try{localStorage.setItem('swoop-touch-visibility',manualTouch);}catch{}};applyTouchChoice();$('helpPanel').append(touchToggle);
graphics.mount($('helpPanel'));
const touchLayoutButton=installTouchLayout(()=>{clearInput();if(running&&!paused)pause();});
const quickHelp=document.createElement('p');quickHelp.id='quickHelp';$('helpPanel').querySelector('h2')!.after(quickHelp);
const resumeRide=document.createElement('button');resumeRide.id='resumeRide';resumeRide.textContent='Resume current ride';resumeRide.hidden=true;$('start').after(resumeRide);resumeRide.onclick=()=>{if(!running||finished)return;$('challengeHUD').hidden=!challengeRun;unlockRideAudio();clearInput();paused=false;document.body.classList.add('playing');$('menu').hidden=true;$('pause').textContent='Pause';$('paused').hidden=true;canvas.focus();};
function pause(){if(lottoShop?.appActive||split?.simulation.rules.done||!running||!$('menu').hidden||!$('challengeResults').hidden||!$('raceResults').hidden)return;paused=!paused;if(paused)commandBark.stop();else unlockRideAudio();clearInput();$('pause').textContent=paused?'Resume':'Pause';$('paused').hidden=!paused;rideAudio.update(pose,!paused);}
function setCamera(m:string,user=false){if(user&&m!==cameraMode)practice?.action('camera');if(m==='first'&&cameraMode!==m){firstYaw=0;firstPitch=RIDER_EYE_PITCH;}cameraMode=m;$<HTMLSelectElement>('camera').value=m;canvas.focus();}
function recenterCamera(){if(vr.active)return;clearCameraTouches();orbitYaw=0;orbitHeight=2.2;orbitDistance=5;follow.distance=4.6;firstYaw=0;firstPitch=RIDER_EYE_PITCH;follow.reset(current);setCamera('chase');}
function cycleCamera(){const modes=['chase','first','front','side','orbit'];setCamera(modes[(modes.indexOf(cameraMode)+1)%modes.length],true);}
function toggleLight(){night=!night;sky.setDusk(night);if(scenery&&'lighting' in scenery)scenery.lighting.setDusk(night);scene.background=new T.Color(night?'#182831':'#c9dce0');scene.fog=new T.Fog(night?'#182831':'#c9dce0',night?65:elmwood&&compactElmwood?65:130,elmwood&&compactElmwood?165:night?250:370);sun.intensity=night?.65:elmwood?2.5:2.0;hemi.intensity=night?.5:elmwood?.95:1.15;fill.intensity=night?.35:elmwood?.22:.55;scene.environmentIntensity=night?.25:elmwood?.4:.6;$('light').textContent=night?'Day':'Dusk';}
function toggleAudio(){if(!muted&&rideAudio.state.context==='suspended'){unlockRideAudio();return;}muted=!muted;if(muted)commandBark.stop();try{localStorage.setItem('digital-static-ride-sound',muted?'off':'on');}catch{}unlockRideAudio();}
$('spawn').replaceChildren();
for(const [i,s]of SPOTS.entries()){
  const o=document.createElement('option');o.value=String(i);o.textContent=s.name;$('spawn').append(o);
  const b=document.createElement('button');b.textContent=s.name;b.onclick=()=>{if(challengeRun&&running){toast('Choose Free Ride before changing location.');return;}reset(i);beginRide();setCamera('front');};$('locations').append(b);
}
$<HTMLSelectElement>('spawn').value='0';
$('mode').onchange=()=>{const kind=$<HTMLSelectElement>('mode').value;district.filter(kind);$('start').textContent=kind==='split'?'Start playing together →':kind==='race'?'Start race →':kind==='free'?'Start riding →':'Start first challenge →';};
const setupSummary=document.createElement('p');setupSummary.id='setupSummary';setupSummary.setAttribute('aria-live','polite');$('start').before(setupSummary);
function describeSetup(){const name=SPOTS[Number($<HTMLSelectElement>('spawn').value)]?.name??'Choose a starting location',cycling=isCycle(vehicle.value)&&['free','race'].includes($<HTMLSelectElement>('mode').value),rider=RIDER_CHOICES.find(r=>r.id===(cycling?'DS_Man_01':$<HTMLSelectElement>('heroSelect').value))?.label??'Choose a rider';performanceCard.textContent=vehicleSummary(vehicle.value);bikeStyle.closest('label')!.hidden=vehicle.value!=='bicycle';setupSummary.textContent=`${ebikeProfile(vehicle.value)?.name??eucProfile(vehicle.value)?.name??(cycling?'Bicycle':'One wheel')} · ${rider} · ${name}`;setupSummary.hidden=$<HTMLSelectElement>('mode').value!=='free';$('bikeOptions').hidden=!cycling;$('bikeOptions').querySelector('p')!.textContent=ebikeProfile(vehicle.value)?'Electric motos use the original suited rider. Push forward for motor power, let go to coast, and pull back to brake. Keep holding after stopping to reverse slowly. Race through the streets or explore freely.':'Bicycles use the original suited rider. Push forward to pedal, let go to coast, and pull back to brake. Keep holding after stopping to reverse slowly.';$<HTMLSelectElement>('heroSelect').disabled=cycling;}
vehicle.addEventListener('change',describeSetup);
$('spawn').addEventListener('change',describeSetup);$('heroSelect').addEventListener('change',describeSetup);$('mode').addEventListener('change',describeSetup);describeSetup();
$('start').onclick=()=>{void start().catch(()=>toast('The starting area could not load. Try again.'));};$('pause').onclick=pause;$('camera').onchange=()=>setCamera($<HTMLSelectElement>('camera').value,true);
$('companion').onchange=()=>setCompanion($<HTMLSelectElement>('companion').value==='dog');
$('heroSelect').onchange=()=>setRider($<HTMLSelectElement>('heroSelect').value);
$('riderQuick').onclick=()=>{setRider(RIDER_CHOICES[(RIDER_CHOICES.findIndex(r=>r.id===selectedRider)+1)%RIDER_CHOICES.length].id);canvas.focus();};
$('dogToggle').onclick=()=>{setCompanion(!dogEnabled);canvas.focus();};
$('menuButton').textContent='Menu';
$('menuButton').onclick=()=>{cabinets?.stop();loop.stopReplay(false);$('challengeHUD').hidden=true;paused=true;clearInput();$('paused').hidden=true;$('pause').textContent='Resume';$('challengeResults').hidden=true;resumeRide.hidden=!running||finished;document.body.classList.remove('playing');$('menu').hidden=false;$('menuTitle').textContent=elmwood?'Elmwood Explorer':'Swoop . Detroit';district.refreshBoard();loop.refresh();};
$('map').onclick=()=>{cabinets?.stop();if(miniMap){miniMap.hud.open();return;}$('mapPanel').hidden=!$('mapPanel').hidden;};$('closeMap').onclick=()=>{$('mapPanel').hidden=true;};
let controlSettingsReturn:HTMLElement|null=null;
function openControlSettings(){cabinets?.stop();controlSettingsReturn=document.activeElement as HTMLElement|null;clearInput();if(running&&!paused)pause();$('ridingOptions').classList.remove('expanded');$('optionsToggle').setAttribute('aria-expanded','false');$('helpPanel').hidden=false;$('helpPanel').scrollTop=0;$('closeHelp').focus();}
$('helpPanel').querySelector('h2')!.textContent='Control settings';
const touchSettings=$('helpPanel').querySelector('.touchSettings')!;
touchSettings.querySelector('legend')!.after(touchLayoutButton,touchToggle);$('quickHelp').after(touchSettings);
const layoutHelp=document.createElement('p');layoutHelp.textContent='Customize touch controls to move and resize your joystick and buttons. Choose floating or fixed joystick and assign each button below.';touchLayoutButton.before(layoutHelp);
const rideControlSettings=document.createElement('button');rideControlSettings.id='rideControlSettings';rideControlSettings.textContent='Control settings';rideControlSettings.setAttribute('aria-controls','helpPanel');rideControlSettings.onclick=openControlSettings;$('ridingOptions').append(rideControlSettings);
$('help').onclick=()=>{if($('helpPanel').hidden)openControlSettings();else $('closeHelp').click();};$('closeHelp').onclick=()=>{$('helpPanel').hidden=true;controlSettingsReturn?.focus();};
$('light').onclick=toggleLight;$('audio').onclick=toggleAudio;$('recover').onclick=()=>{if(finished&&challengeRun)loop.retry();else queueRecovery();};
const vrControls=document.createElement('div');vrControls.className='vrControls';$('start').after(vrControls);
const vr=new VRRide(renderer,scene,camera,vrControls,{ready:()=>ready,unlockAudio:unlockRideAudio,message:toast,
 enter:()=>{if(sim.cycling){chooseVehicle(false);vehicle.value='euc';sim.reset({position:current,headingY:current.headingY});remount();}if(split){stopRace();$<HTMLSelectElement>('mode').value='free';start();}else if(!running)start();else beginRide();clearInput();last=performance.now();acc=0;},
 exit:()=>{clearInput();paused=true;$('pause').textContent='Resume';$('paused').hidden=false;rideAudio.update(pose,false);follow.reset(current);last=performance.now();acc=0;},
 pause:()=>{if(!paused){paused=true;clearInput();$('pause').textContent='Resume';$('paused').hidden=false;rideAudio.update(pose,false);}}
});
const extraHelp=document.createElement('p');extraHelp.textContent='SEATED RIDING · X or Sit down / Stand up; gamepad D-pad down; Quest left grip + A. Feet stay on pedals. Hops, crouching and tricks temporarily stand up. CHALLENGES · N instantly retries the current route; R retries after a result. The Retry button works on touch. Controller X / Square and VR recover retry at results. Personal ghosts and rewards save in this browser. CONTROLLER · Left stick ride/steer · RT/R2 accelerate · LT/L2 brake · A/Cross hold/release hop · B/Circle trick · RB/R1 or D-pad choose trick · LB/L1 crouch · X/Square recover · Y/Triangle camera · right stick look · Start pause/resume. VR · Quest: left stick ride, left trigger brake, grips crouch, right trigger hold/release hop, A trick, B choose, X recover, Y pause. Vive wands: left pad ride; click upper half to recover, lower half to pause. Right pad click upper half to choose trick, lower half to perform it. Right pad sides turn the view. VR HUD on/off: Quest left stick click; Vive right pad center click. Right stick click recenters Quest view.';$('helpPanel').append(extraHelp);
let seatedRide=false;
const boardButton=document.createElement('button');boardButton.textContent='Switch to skateboard';boardButton.onclick=()=>{if(sim?.cycling){toast('Choose EUC to use the freestyle skateboard.');return;}const m=toMap(current.x,0,current.z);if(split||race||challengeRun||!parkContains(m.x,m.z)){toast('Switch boards in the Freestyle Yard during free ride');return;}if(Math.abs(current.speed)>.5||sim.crashed){toast('Stop upright to change your ride');return;}hero.skateboarding=!hero.skateboarding;seatedRide=false;cruise=false;sitButton.disabled=hero.skateboarding;sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');boardButton.textContent=hero.skateboarding?'Switch to EUC':'Switch to skateboard';boardButton.setAttribute('aria-pressed',String(hero.skateboarding));toast(hero.skateboarding?'Arcade skateboard - steer, crouch and hop with your usual controls':'Electric unicycle');canvas.focus();};$('cruise').before(boardButton);
const sitButton=document.createElement('button');sitButton.id='sitRide';sitButton.textContent='Sit down';sitButton.setAttribute('aria-pressed','false');sitButton.onclick=()=>{if(sim?.cycling){toast('The cyclist is already seated on the saddle.');return;}if(hero.skateboarding){toast('Seated riding is available on the EUC');return;}seatedRide=!seatedRide;sitButton.textContent=seatedRide?'Stand up':'Sit down';sitButton.setAttribute('aria-pressed',String(seatedRide));toast(seatedRide?'Seated riding · Space / tricks rise out of the seat':'Standing riding');canvas.focus();};$('cruise').before(sitButton);
$('cruise').onclick=()=>{if(!ready||!running||paused||finished||sim.crashed){cruise=false;return;}cruise=!cruise;toast(cruise?`Cruise • ${Math.round(RIDE_RULES.cruiseSpeed*3.6)} km/h · YOU steer · brake to cancel`:'Cruise off');canvas.focus();};
window.addEventListener('keydown',e=>{
  if(pennyShop?.active){if(e.code==='Escape'){e.preventDefault();pennyShop.close();}return;}
  if(lottoShop?.appActive){if(e.code==='Escape'){e.preventDefault();lottoShop.closeApp();}return;}
  if(film.playing){if(e.code==='Escape')film.stopReplay();return;}
  if(gallery?.active||boutique?.active){if(e.code==='Escape')(gallery?.active?gallery:boutique)!.panel.querySelector<HTMLButtonElement>('[data-back]')!.click();return;}
  if(split&&$('menu').hidden){if(document.activeElement?.closest('button,a,input,select,textarea,summary,[contenteditable=true]'))return;if(e.repeat){if(split.input.ownsKey(e.code))e.preventDefault();return;}if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();pause();return;}if(e.code==='KeyN'){e.preventDefault();startSplit();return;}if(split.input.ownsKey(e.code)){e.preventDefault();if(!paused&&!finished)split.input.handleKey(e.code,true);}return;}
  if(document.activeElement?.closest('button,a,input,select,textarea,summary,[contenteditable=true]'))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
  inputDevice='keyboard';if(e.repeat)return;keys.add(e.code);if(e.code==='Enter'&&!running)start();if(e.code==='Space')hop=true;if(e.code==='KeyR'){if(finished&&challengeRun)loop.retry();else queueRecovery();}if(e.code==='KeyN'&&running){if(race)startRace(race.cyclingOpponents);else if(challengeRun)loop.retry();}
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
canvas.onpointermove=e=>{if(cameraMode==='first'){if(drag?.id===e.pointerId){firstYaw=clamp(firstYaw-(e.clientX-drag.x)*.0032,-1.45,1.45);firstPitch=clamp(firstPitch-(e.clientY-drag.y)*.0032,-1.25,.7);drag.x=e.clientX;drag.y=e.clientY;}return;}if(cameraTouches.has(e.pointerId)){cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(cameraTouches.size>=2){const [a,b]=[...cameraTouches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0){orbitDistance=clamp(orbitDistance*pinchDistance/Math.max(1,distance),2.5,12);if(cameraMode!=='orbit'){orbitYaw=cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:0;setCamera('orbit');}}pinchDistance=distance;return;}}if(drag?.id!==e.pointerId)return;if(cameraMode!=='orbit'){orbitYaw=cameraMode==='front'?Math.PI:cameraMode==='side'?Math.PI/2:0;cameraMode='orbit';}
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
installRaceUI(()=>startRace(!!race?.cyclingOpponents),freeRideHere,()=>{stopRace();$('menuButton').click();});
const splitOption=document.createElement('option');splitOption.value='split';splitOption.textContent='2-player split-screen';$('mode').append(splitOption);
const lobby=installLobby(elmwood,startRace,startSplit);
const startupCinema=elmwood?undefined:new StartupCinema();
const online=new OnlineRooms(elmwood?'elmwood':'cut',()=>ready,()=>Number($<HTMLSelectElement>('spawn').value),startOnline,()=>{if(split){stopSplit();running=false;clearInput();$('menu').hidden=false;document.body.classList.remove('playing');$('resumeRide').hidden=true;}});
async function startOnline(match:RoomMatch,slot:number){
 if(!ready||preparingSpawn)return;try{await prepareSpawn(match.spawn);}catch{toast('Room location could not load. Try joining again.');return;}startingOnline=true;stopRace();startingOnline=false;chooseVehicle(false);community?.ride.cancel();practice=undefined;challengeRun=undefined;district.setRun();loop.stopReplay(false);loop.flow.cancel();mode='split';selectedSpot=match.spawn;
 const challenge=CHALLENGES.find(c=>c.id===match.mode),sessionMode=match.mode==='free'?'free':match.mode==='race'?'race':'challenge';reset(selectedSpot,sessionMode==='free'?undefined:challenge?.start??RACE_ROUTE.start);
 if(!elmwood){mapWorld.setHazards(match.seed,challenge?.start??RACE_ROUTE.start,sessionMode!=='free');courseView.set(mapWorld.courseFeatures);mapWorld.updateTraffic(0,1e8,1e8);mapWorld.step();}
 const ids=match.members.map(m=>m.rider),bindings:SplitBinding[]=ids.map((_,i)=>i===0?online.binding:(['wasd','arrows','ijkl','numpad'] as const)[i]),simulation=new SplitRaceSimulation(world,ids,{mode:sessionMode,spawn:SPOTS[selectedSpot],challenge}),input=new SplitRideInput(bindings),audio=ids.slice(1).map(()=>new RideAudio());simulation.rules.countdown=Math.max(0,(match.startAt-Date.now())/1000);
 if(online.isHost)simulation.fillRivals(match.members.flatMap((m,i)=>m.bot?[i]:[]),match.difficulty??'expert');
 const own=(i:number)=>i===slot;
 const view=new SplitRaceView(scene,simulation,actorData,bindings,{pause,input,display:openDisplaySettings,onlineSlot:slot,bots:match.members.flatMap((m,i)=>m.bot?[i]:[]),splitView:()=>onlineView.split,restart:()=>toast('Leave the match and create a new room to restart.'),menu:()=>$('menuButton').click(),recover:i=>{if(own(i)){if(online.isHost)recoverSplit(i);else online.command({...NEUTRAL_ACTIONS,reset:true});}},cruise:i=>{if(own(i))cruiseSplit(0);},photo:i=>{if(own(i)){if(online.isHost)photoSplit(i);else online.command({...NEUTRAL_ACTIONS},false,true);}},camera:i=>{if(own(i))split?.view.toggleCamera(i);}},effectPatches,[rideAudio,...audio]);
 split={simulation,input,view,audio};beginRide();document.body.classList.add('splitPlaying');hero.root.visible=false;dogView.root.visible=false;contactEffects?.reset();confirmation.reset();pedalSparks.reset();canvas.focus();
 document.body.classList.add('onlinePlaying');
 view.hud.querySelector('.splitBar span')!.textContent='ONLINE / '+ids.length+'P / '+match.mode.toUpperCase();
}
function welcomeGothTech(area:'studio'|'store'){
 if(!startupCinema||vr.active||split||race||challengeRun)return;
 const wasPaused=paused;startupCinema.enter(area,()=>{clearInput();paused=true;$('paused').hidden=true;},()=>{clearInput();paused=wasPaused;$('paused').hidden= !paused;canvas.focus();});
}
async function welcomeStore(area:StoreEntrance|'store'){
 if(!startupCinema||vr.active||split||race||challengeRun)return;
 const wasPaused=paused;
 await new Promise<void>(resolve=>{
  const shown=startupCinema.enter(area,()=>{clearInput();paused=true;$('paused').hidden=true;rideAudio.update(pose,false);},()=>{clearInput();paused=wasPaused;$('paused').hidden=!paused;$('pause').textContent=paused?'Resume':'Pause';canvas.focus();resolve();});
  if(!shown)resolve();
 });
}
const landmarkMission=elmwood?undefined:new LandmarkMissionView(scene,lobby.placeBody,startLandmarkMission,()=>canvas.focus());
function startLandmarkMission(){
 if(!ready||vr.active)return;
 chooseVehicle(false);community?.ride.cancel();stopRace();practice=undefined;challengeRun=undefined;district.setRun();mode='free';
 $<HTMLSelectElement>('mode').value='free';$<HTMLSelectElement>('companion').value='dog';setCompanion(true);
 reset(0);landmarkMission?.start();loop.startRun(undefined,selectedRider,actorData,current);beginRide();setCamera('chase');
 toast('Landmark mission · open Dog commands to Sit, then Come.');
}
graphics.mount($('lobbySettings'));onlineView.mount($('helpPanel'),()=>clearInput());onlineView.mount($('lobbySettings'),()=>clearInput());
const lobbyLayout=document.createElement('button');lobbyLayout.textContent='Control settings';lobbyLayout.setAttribute('aria-controls','helpPanel');lobbyLayout.onclick=openControlSettings;$('lobbySettings').querySelector('h2')!.after(lobbyLayout);
const settingsGame=document.createElement('div');
const commandBark=new DogBarkAudio();
installDogCommandHud(settingsGame,'swoop-dog-pads',command=>{if(command==='bark'&&!muted)void commandBark.bark().catch(()=>{});const feedback=dog.order(command,mapWorld.traffic.filter(t=>t.kind==='pedestrian').map(t=>toLocal(t.x,t.y,t.z)));toast(feedback);canvas.focus();return feedback;},()=>running&&!paused&&!finished&&dogEnabled&&!split&&$('menu').hidden&&$('helpPanel').hidden&&$('mapPanel').hidden&&!film.playing);
for(const id of ['camera','light','sitRide','dogToggle']){const label=document.createElement('label');label.textContent=id==='camera'?'Riding camera':id==='light'?'Time of day':id==='sitRide'?'Riding posture':'Companion';settingsGame.append(label,$(id));}
const settingsAudio=document.createElement('div');settingsAudio.append($('audio'),$('musicPanel'));
const garageAudio=document.createElement('button');garageAudio.textContent='Soundtrack settings';garageAudio.onclick=()=>{openControlSettings();settingsTabs.select(2);};$('lobbyGarage').append(garageAudio);
const settingsNavigation=document.createElement('button');settingsNavigation.textContent='Landmarks & start locations';settingsNavigation.onclick=()=>{$('helpPanel').hidden=true;$('mapPanel').hidden=false;};settingsGame.append(settingsNavigation);
const mapLayoutButton=document.createElement('button');mapLayoutButton.textContent='Customize mini-map';mapLayoutButton.hidden=!miniMap;mapLayoutButton.onclick=()=>{miniMap?.hud.layout.edit();};
const communitySetting=document.createElement('button');communitySetting.textContent='Meet the Cut cyclists';communitySetting.onclick=()=>{$('community-start').click();};settingsGame.append(communitySetting);
const settingsTabs=settingsPanel($('helpPanel'),$<HTMLButtonElement>('closeHelp'),[
 {name:'Controls',nodes:[mapLayoutButton,...$('helpPanel').querySelectorAll('fieldset:not(.graphicsSettings)'),layoutHelp]},
 {name:'Graphics',nodes:[...$('helpPanel').querySelectorAll('.graphicsSettings')]},
 {name:'Audio',nodes:[settingsAudio]},{name:'Gameplay',nodes:[settingsGame]},{name:'Replay',nodes:[film.panel]}
]);function openDisplaySettings(){openControlSettings();settingsTabs.select(1);}
$('help').textContent='Settings';rideControlSettings.textContent='Settings';lobbyLayout.textContent='Open settings';
const practiceHUD=document.createElement('section');practiceHUD.id='practiceHUD';practiceHUD.hidden=true;practiceHUD.setAttribute('aria-label','Riding lesson');practiceHUD.innerHTML='<strong>Learn to ride</strong><p id="practiceCopy" role="status"></p><button id="practiceFree">Finish lesson · free ride</button><details><summary>Lesson options</summary><button id="practiceRace">Try a timed challenge</button><button id="practiceAgain">Restart lesson</button></details>';document.body.append(practiceHUD);
async function startPractice(){if(!ready||vr.active)return;try{await loadElectricAssets(actorData,vehicle.value);}catch{toast("Vehicle could not load. Try again.");return;}chooseVehicle(isCycle(vehicle.value));community?.ride.cancel();stopRace();challengeRun=undefined;district.setRun();mode='free';selectedSpot=Number($<HTMLSelectElement>('spawn').value);reset(selectedSpot,elmwood?undefined:RACE_ROUTE.start);loop.startRun(undefined,selectedRider,actorData,current);practice=new PracticeCoach(sim.cycling);practiceCompleted=false;try{practiceCompleted=localStorage.getItem(practiceKey())==='complete';}catch{}beginRide();setCamera('chase');practiceHUD.hidden=false;}
$('practiceRace').hidden=elmwood;$('practiceRace').onclick=()=>startChallenge(CHALLENGES.find(c=>c.id==='gratiot-dash')!);$('practiceFree').onclick=freeRideHere;$('practiceAgain').onclick=startPractice;
const practiceButton=document.createElement('button');practiceButton.id='practiceRoute';practiceButton.textContent='Practice controls · optional';practiceButton.onclick=startPractice;practiceButton.hidden=$('menu').dataset.tab!=='race';$('raceInfo').after(practiceButton);

const practiceKey=()=>sim?.cycling?'swoop-practice-v2-bicycle':'swoop-practice-v2';
let practiceCompleted=false;try{practiceCompleted=localStorage.getItem('swoop-practice-v2')==='complete';}catch{}
const quickPractice=document.createElement('button');quickPractice.id='learnRide';quickPractice.textContent=practiceCompleted?'Practice again':'Learn to ride';quickPractice.disabled=true;quickPractice.hidden=$('menu').dataset.tab!=='ride';quickPractice.onclick=startPractice;lobby.actions.append(quickPractice);
const quickPark=document.createElement('button');quickPark.textContent='Freestyle Yard / skateboard';quickPark.onclick=()=>{const i=SPOTS.findIndex(s=>s.name===PARK_SPAWN.name);if(i<0||!ready)return;stopRace();challengeRun=undefined;district.setRun();mode='free';selectedSpot=i;reset(i);beginRide();};
quickPark.hidden=elmwood;lobby.placeButtons.append(quickPark);
const quickStudio=document.createElement('button');quickStudio.textContent='GothTech Studio · 2000 Mack';quickStudio.hidden=elmwood;quickStudio.onclick=async()=>{const i=SPOTS.findIndex(s=>s.name.startsWith('Green screen studio'));if(i<0||!ready||preparingSpawn)return;try{await prepareSpawn(i);}catch{toast('Studio could not load. Try again.');return;}stopRace();challengeRun=undefined;district.setRun();mode='free';selectedSpot=i;reset(i);setCamera('chase');beginRide();studioCapture?.open();};lobby.placeButtons.append(quickStudio);
for(const [label,name]of [['Penny Exchange · merch auctions','Penny Exchange · next to LottoMind'],['LottoMind store · app + play','LottoMind store · Mack Avenue'],['Studio arcade · 3D joysticks','Studio arcade · 2000 Mack'],['GothTech arcade · Underground','GothTech arcade · Underground']]){const b=document.createElement('button');b.textContent=label;b.hidden=elmwood;b.onclick=async()=>{const i=SPOTS.findIndex(s=>s.name===name);if(i<0||!ready||preparingSpawn)return;try{await prepareSpawn(i);}catch{toast('This place could not load. Try again.');return;}stopRace();challengeRun=undefined;district.setRun();mode='free';selectedSpot=i;reset(i);setCamera('chase');beginRide();};lobby.placeButtons.append(b);}lobby.finish();
const parkHUD=document.createElement('section');parkHUD.id='parkCoach';parkHUD.hidden=true;parkHUD.setAttribute('aria-label','Freestyle Yard session');document.body.append(parkHUD);
let parkLandings=0,parkLastLanding=-Infinity;
const courseView=new CourseFeatureView(scene);
let mackStudio:Awaited<ReturnType<typeof buildMackStudio>>|undefined;
const gallery=elmwood?undefined:new GalleryVisit(scene,async()=>{
  if(split||sim.crashed||Math.abs(current.speed)>.5)return;
  freeRideHere();$('challengeResults').hidden=true;$('raceResults').hidden=true;
  await welcomeStore('gallery');
  clearInput();paused=true;gallery!.start(actorData,selectedRider,hero,current);
},()=>{clearInput();paused=false;canvas.focus();});
const boutique=elmwood?undefined:new GalleryVisit(scene,async()=>{
 if(split||sim.crashed||Math.abs(current.speed)>.5)return;freeRideHere();await welcomeStore('store');clearInput();paused=true;boutique!.start(actorData,selectedRider,hero,current);
},()=>{clearInput();paused=false;canvas.focus();},true);
const interiorStream=new SpatialAssetStream(1,()=>{canvas.dataset.interiorStreaming=JSON.stringify(interiorStream.status);});
const retailAnchor=toLocal(MACK_STUDIO.x,0,MACK_STUDIO.z);
const retailLoads=new Map<string,Promise<unknown>>();
function loadRetail<V>(id:string,load:()=>Promise<V>):Promise<V>{
 const existing=retailLoads.get(id);if(existing)return existing as Promise<V>;
 const promise=Promise.resolve().then(load).catch(error=>{retailLoads.delete(id);throw error;});retailLoads.set(id,promise);return promise;
}
interiorStream.add({id:'mack-retail',centers:[retailAnchor],async load(){
  const interiors=elmwood?undefined:await Promise.all([
    loadRetail('studio',()=>buildMackStudio(scene,mapWorld as DetroitWorld)),
    loadRetail('lotto',()=>buildLottoShop(scene,mapWorld as DetroitWorld,()=>clearInput(),()=>{clearInput();lottoAppPausedRide=running&&!paused;if(lottoAppPausedRide)pause();},()=>{clearInput();const ridingView=$('menu').hidden&&$('helpPanel').hidden&&$('mapPanel').hidden;if(lottoAppPausedRide&&running&&paused&&ridingView)pause();lottoAppPausedRide=false;if(ridingView)canvas.focus();},()=>welcomeStore('lotto'))),
    loadRetail('penny',()=>buildPennyShop(scene,mapWorld as DetroitWorld,()=>{clearInput();pennyPausedRide=running&&!paused;if(pennyPausedRide){paused=true;$('pause').textContent='Resume';rideAudio.update(pose,false);}},()=>{clearInput();if(pennyPausedRide&&running){paused=false;$('pause').textContent='Pause';}$('paused').hidden=!paused;pennyPausedRide=false;canvas.focus();},()=>welcomeStore('penny'))),
    loadRetail('gallery',()=>gallery!.load()),loadRetail('boutique',()=>boutique!.load())
  ]);
  if(!elmwood){mackStudio=interiors![0];studioScreens=new StudioScreens(mackStudio.building,()=>{clearInput();canvas.focus();});lottoShop=interiors![1];cabinets!.add(mackStudio.building,-9,20.65,Math.PI,'wave','2084 Static Wave');cabinets!.add(mackStudio.building,-10.4,20.65,Math.PI,'rahbe','Robot RAHBE · Vault Rush');cabinets!.add(boutique!.building,2.35,-4.7,0,'underground','ROBOT RAHBE: Underground');}
  if(!elmwood){pennyShop=interiors![2];lottoShop!.building.add(pennyShop.kiosk);cabinets!.add(lottoShop!.building,3.4,5.25,0,'wave','2084 Static Wave · LottoMind game kiosk');const q=lottoMap(3.4,5.25);(mapWorld as DetroitWorld).addBox({x:q.x,y:LOTTO_SHOP.floor+.8,z:q.z,hx:.64,hy:.8,hz:.55,yaw:-LOTTO_SHOP.heading,kind:'retail game kiosk'});}
  for(const destination of [gallery,boutique])if(destination)registerDestinationCollision(mapWorld as DetroitWorld,destination.store);
  mapWorld.step();graphics.apply();
}});
let preparingSpawn=false;
async function prepareSpawn(spot:number){
 const point=SPOTS[spot];if(!point)return;
 preparingSpawn=true;
 try{
 if(!elmwood&&Math.hypot(point.x-retailAnchor.x,point.z-retailAnchor.z)<350&&interiorStream.status.loaded===0){
  $('status').textContent='Preparing the store and nearby scenery…';
  await interiorStream.ensure('mack-retail');
 }
 if(scenery&&'stream' in scenery){const p=toMap(point.x,0,point.z);await scenery.stream.warm([p],120);}
 }finally{preparingSpawn=false;$('status').textContent='';}
}
try{
  bootStage('loading','Loading your rider and Detroit district…');
  const [data]=await Promise.all([loadActors(),mapWorld.init()]);
  boot.assertActive();bootStage('preparing','Preparing streets, landmarks and collision…');
  // Ground queries need the initialized physics world, including nature placement.
  const cherrySites=elmwood?[35,150,390,640,940,1290,1640].map((d,i)=>({...pointOnCut(d,i%2?7:-7),scale:.95+i%3*.1})).filter(m=>dryStreetSite(m.x,m.z,1)):cherryTreeSites((x,z)=>(mapWorld as DetroitWorld).chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50));
  const cherryAnchors=cherrySites.map(m=>{const p=toLocal(m.x,0,m.z);return{x:p.x,z:p.z,y:world.sampleGround(p.x,p.z,cherryGround).height,scale:m.scale};});
  nature=new NatureWorld(scene,cherryAnchors,(x,z)=>world.sampleGround(x,z,cherryGround).height);void nature.load();
  natureAudio=new NatureAudio([{file:'birdsong.mp3',points:cherryAnchors,radius:65,volume:.15}],()=>!muted&&running&&!paused&&$('menu').hidden);
  await interiorStream.warm([SPOTS[Number($<HTMLSelectElement>('spawn').value)]],350);


  boot.assertActive();bootStage('preparing','Preparing the ride and controls…');
  if(!elmwood&&!qaVisualBaseline)ambience=new RouteAmbience(scene,world,effectPatches);
  if(!elmwood)buildFreestylePark(mapScene,mapWorld as DetroitWorld);
  actorData=data;scenery=elmwood?await buildElmwood(mapScene,mapWorld as ElmwoodWorld,()=>compactElmwood||vr.active):await buildScenery(mapScene,mapWorld,!qaVisualBaseline,toMap(SPOTS[selectedSpot].x,0,SPOTS[selectedSpot].z));setRider(selectedRider);traffic=new TrafficView(scene,data,world);photographers=new MapPhotographers(scene,data,world);dogView=new CompanionView(data,world);scene.add(dogView.root);
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
  sim=new BicycleAdapter(riderTerrain);sim.mountedVolume=hero.mountedVolume;sim.wheelScale=selectedRider.startsWith('DS_Mascot_')?.75:.86;reset();
  if(!elmwood){community=new CyclingSession('Swoop Detroit',scene,actorData,world.withActorPassThrough(computerBikeContact),new LaneRoute(Array.from({length:31},(_,i)=>({...routePosition(850+i*5),width:5}))),()=>current,travelCommunity,()=>canvas.focus());community.ride.passThroughContact=o=>computerBikeContact(o)||o.id==='player'&&!!community?.ride.joined;}
  boot.assertActive();
  if(!boot.finish(!!actorData.get(selectedRider),!!SPOTS[Number($<HTMLSelectElement>('spawn').value)],!!scenery,!!sim))throw new Error('Rider, start location, scene or controller is unavailable');
  renderBoot();graphics.apply();ready=true;loop.ready();canvas.dataset.ready='true';canvas.dataset.firstPlayableMs=String(Math.round(performance.now()-bootStarted));canvas.dataset.hero=selectedRider;canvas.dataset.controller=RIDE_TUNING.version;canvas.dataset.physics='Rapier terrain + Digital Static controller';canvas.dataset.routeLength=String(LENGTH);$('loading').hidden=true;$<HTMLButtonElement>('start').disabled=false;quickPractice.disabled=false;document.querySelectorAll<HTMLButtonElement>('.districtCard').forEach(b=>b.disabled=false);
  const {LoveTagClient}=await import('@digital-static/ridecore/tag-client');
  loveTag=new LoveTagClient({product:'swoop-detroit',scene,camera,canvas,mountDisplay:graphics.mount,menu:lobby.moreItems,
    fixtureUrl:new URL('./love-tag/swoop-detroit.json',location.href).href,configUrl:new URL('./love-tag/config.json',location.href).href,
    async createView(terrain){return new Hero(actorData,terrain as any,selectedRider);},
    suspend(){const state={running,paused};running=false;paused=true;clearInput();rideAudio.update(current,false);natureAudio.update(current,current.headingY,false);
      const hidden=[hero.root,dogView.root,...[...traffic.items.values()].map(i=>i.root),community?.view.root].filter((o):o is T.Group=>!!o).map(o=>({o,visible:o.visible}));for(const {o}of hidden)o.visible=false;
      return ()=>{for(const {o,visible}of hidden)o.visible=visible;running=state.running;paused=state.paused;clearInput();};}});
  installLoveTagMainMenu(loveTag,()=>$('menuButton').click());
  setCamera('front');
  if(new URLSearchParams(location.search).get('launch')==='quest')void vr.enterFromPackage();
}catch(e){console.error(e);failBoot(e);}
const frameSchedule=new FrameSchedule();
let hudAt=0,frames=0,fpsAt=performance.now(),fps=0;
function advanceOnlineHost(dt:number){
 const room=split!;acc+=dt;
 while(acc>=1/120&&!room.simulation.rules.done){mapWorld.step();const inputs=online.inputs(paused||document.hidden||online.inputBlocked||!$('menu').hidden?{...NEUTRAL_ACTIONS}:room.input.consume(0));for(let i=0;i<inputs.length;i++){if(inputs[i].reset){recoverSplit(i);inputs[i].reset=false;}if(online.events(i).photo)photoSplit(i);}room.simulation.step(1/120,inputs);for(const i of room.simulation.newCrashes)room.input.clear(i===online.slot?0:i);room.view.afterStep(1/120);acc=Math.max(0,acc-1/120);}
 online.update(dt,room.simulation,paused||document.hidden||online.inputBlocked?{...NEUTRAL_ACTIONS}:room.input.consume(0));
}
// Browsers throttle hidden tabs. Keep the authoritative room clock and remote riders moving.
let backgroundRoomAt=performance.now();
window.setInterval(()=>{const now=performance.now(),dt=Math.min(1.5,(now-backgroundRoomAt)/1000);backgroundRoomAt=now;if(document.hidden&&online.active&&online.isHost&&split&&running&&!finished)advanceOnlineHost(dt);},40);
function frameSplit(now:number,dt:number){
 const room=split!;windTime.value=room.simulation.rules.elapsed;const controls=room.input.poll(Array.from(navigator.getGamepads?.()??[]),room.simulation.riders.map((r,i)=>online.active&&i===0?room.simulation.riders[online.slot].pose.speed:r.pose.speed),dt);
 if(controls.disconnected&&!paused)pause();
 if(controls.pause){if(!$('menu').hidden)resumeRide.click();else pause();}
 for(let i=0;i<room.simulation.riders.length;i++){const event=room.input.events(i),slot=online.active?online.slot:i;if(online.active&&i!==0)continue;if(event.recover){if(online.active&&!online.isHost)online.command({...NEUTRAL_ACTIONS,reset:true});else recoverSplit(slot);}if(event.camera)room.view.toggleCamera(slot);if(event.cruise)cruiseSplit(online.active?0:i);}
 const visible=$('menu').hidden,active=running&&!finished&&(online.active&&online.isHost||!paused&&visible);
 if(online.active&&!online.isHost){const f=online.frame;if(f){room.simulation.rules.countdown=f.countdown;room.simulation.rules.elapsed=f.elapsed;room.simulation.rules.done=f.done;f.riders.forEach((r,i)=>{const local=room.simulation.riders[i];lerpPose(local.pose,r.pose,1-Math.exp(-dt*16),local.pose);copyPose(local.pose,local.previous);Object.assign(room.simulation.rules.racers[i],{gate:r.gate,station:r.station,finish:r.finish,missed:r.missed});local.flow.banked=r.banked;local.message=r.message;local.sim.crashed=r.crashed;room.simulation.remoteFallPhase.set(i,r.fallPhase??'none');if(local.challenge&&r.challenge){Object.assign(local.challenge,r.challenge);local.challenge.photos=new Set(r.challenge.photos);}});}acc=0;const input=active&&!online.inputBlocked?room.input.consume(0):{...NEUTRAL_ACTIONS};if(input.hop||input.trick)online.command(input);online.update(dt,room.simulation,input);}
 else if(active){if(online.active)advanceOnlineHost(dt);else {acc+=dt;while(acc>=1/120&&!room.simulation.rules.done){mapWorld.step();room.simulation.step(1/120,room.simulation.riders.map((_,i)=>room.input.consume(i)));for(const i of room.simulation.newCrashes)room.input.clear(i);room.view.afterStep(1/120);acc=Math.max(0,acc-1/120);}}}
 else acc=0;
 if(room.simulation.rules.done&&!finished){finished=true;clearInput();}
 hero.root.visible=false;dogView.root.visible=false;confirmation.render(false);riderLamp.update(dt,current,night,false);ambience?.update(room.simulation.rules.elapsed,room.simulation.riders.map(r=>r.pose));
 room.view.render(renderer,scene,dt,active&&!finished?Math.min(1,acc*120):1,active&&!finished,paused,visible,p=>{
  followStableSun(sun,p,night?DUSK_SUN:DAY_SUN);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
  if(!night){const roof=world.raycastObstacle({x:p.x,y:p.y+2.3,z:p.z},{x:0,y:1,z:0},7);fill.intensity=roof===null?.55:.9;}
  mackStudio?.update(p.x,p.z);
  for(const destination of [gallery,boutique])if(destination)destination.building.visible=Math.hypot(p.x-destination.building.position.x,p.z-destination.building.position.z)<180;
  const m=toMap(p.x,p.y,p.z);scenery.update(m.x,m.z,room.simulation.rules.elapsed);
 },online.active&&!online.healthy?'Connection stalled · waiting for the host':controls.disconnected?'Controller disconnected · reconnect the assigned controller, then Resume':'',online.active?room.simulation.riders.map((_,i)=>i===online.slot&&room.input.cruising[0]):room.input.cruising,night);
 film.capture(dt,active&&!finished,visible);
 const driving=active&&!finished&&room.simulation.rules.countdown<=0;
 rideAudio.update(room.simulation.riders[0].pose,driving&&!room.simulation.riders[0].sim.crashed);
 room.audio.forEach((a,i)=>{if(a.enabled!==!muted)void a.enable(!muted);a.update(room.simulation.riders[i+1].pose,driving&&!room.simulation.riders[i+1].sim.crashed);});
 loop.music.update(dt,finished?'results':'ride',!document.hidden&&(!paused||!visible||finished),0,0,0);
 if(now-hudAt>120){
  const navSlot=online.active?online.slot:0,navPose=room.simulation.riders[navSlot].pose,navPoint=toMap(navPose.x,navPose.y,navPose.z);miniMap?.hud.setRaceCourse(room.simulation.sessionMode==='race'?{...DETROIT_RACE_COURSE,next:room.simulation.rules.racers[navSlot].gate,finished:room.simulation.rules.racers[navSlot].finish!==null}:null);miniMap?.update(navPoint.x,navPoint.z,navPose.headingY,visible,room.simulation.riders.flatMap((r,i)=>i===navSlot?[]:[{...toMap(r.pose.x,r.pose.y,r.pose.z),heading:r.pose.headingY,label:(online.match?.members[i]?.bot?'AI ':'P')+(i+1),color:online.match?.members[i]?.bot?'#ffce76':'#73eafa'}]));
  canvas.dataset.effects=JSON.stringify({players:room.view.feedback,patches:effectPatches.length});
  canvas.dataset.splitRace=JSON.stringify({...room.simulation.snapshot,paused,bindings:room.input.bindings,cruise:room.input.cruising});
  if(online.active)canvas.dataset.online=JSON.stringify(online.state);else delete canvas.dataset.online;
  const timings=[...frameTimes].sort((a,b)=>a-b);canvas.dataset.performance=JSON.stringify({sampleFrames:timings.length,frameP50:timings[Math.floor(timings.length*.5)],frameP95:timings[Math.floor(timings.length*.95)],geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,views:room.simulation.riders.length});
  Object.assign(canvas.dataset,{mode:'split',paused:String(paused),running:String(running),finished:String(finished),score:'0',cruise:'false',actors:String(room.simulation.riders.length)});hudAt=now;
 }
}
function frame(now:number,xrFrame?:XRFrame){
  bikeRecover.hidden=!(ready&&running&&sim?.cycling&&!vr.active&&!film.playing&&$('menu').hidden);
  if(!ready||boot.stage==='error'||(document.hidden&&!vr.active)){last=now;return;}
  if(!frameSchedule.shouldRender(now,(!running||paused)&&!loveTag?.isActive&&!film.playing&&!gallery?.active&&!boutique?.active,vr.active,graphics.current.fps))return;
  const rawFrameMs=Math.max(0,now-last),dt=Math.min(rawFrameMs/1000,.06);last=now;
  if(loveTag?.update(dt)){
    const p=loveTag.sceneFocus??{x:camera.position.x,y:camera.position.y,z:camera.position.z,headingY:0},m=toMap(p.x,p.y,p.z);
    scenery.update(m.x,m.z,now/1000);interiorStream.update([p],650);mackStudio?.update(p.x,p.z);
    for(const destination of [gallery,boutique])if(destination)destination.building.visible=Math.hypot(p.x-destination.building.position.x,p.z-destination.building.position.z)<220;
    followStableSun(sun,p,night?DUSK_SUN:DAY_SUN);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
    if(adaptiveQuality.sample(rawFrameMs,graphics.choice==='auto'&&!vr.active&&now-bootStarted>5000,graphics.current.fps)){graphics.setAdaptiveDetail(adaptiveQuality.detail);graphics.setResolutionScale(adaptiveQuality.scale);}
    miniMap?.hud.setRaceCourse(null);miniMap?.hud.update([],false);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(scene,camera);
    canvas.dataset.tagRender=JSON.stringify({focus:p,resolutionScale:adaptiveQuality.scale,drawCalls:renderer.info.render.calls,streaming:"stream" in scenery?scenery.stream.status:undefined});return;
  }
  nature.update(dt,current,!running||paused,graphics.current.shadows===0,matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.reducedMotion==='true');natureAudio.update(current,current.headingY,running&&!paused&&!film.playing&&!gallery?.active&&!boutique?.active);canvas.dataset.nature=JSON.stringify(nature.status);canvas.dataset.natureAudio=natureAudio.status;
  if(!loadedAt)loadedAt=now;if(!document.hidden&&running&&!paused){interiorStream.update(split?split.simulation.riders.map(r=>r.pose):[current],650);canvas.dataset.interiorStreaming=JSON.stringify(interiorStream.status);}const budgetActive=graphics.choice==='auto'&&!document.hidden&&!vr.active&&running&&!paused&&now-loadedAt>5000;if(!budgetActive&&graphics.choice!=='auto')adaptiveQuality.reset();if(adaptiveQuality.sample(rawFrameMs,budgetActive,graphics.current.fps)){graphics.setAdaptiveDetail(adaptiveQuality.detail);graphics.setResolutionScale(adaptiveQuality.scale);document.documentElement.dataset.renderQuality=graphics.current.shadows===0||adaptiveQuality.scale<.85?'compact':'detailed';}if(now-hudAt>120)canvas.dataset.renderBudget=JSON.stringify({targetFPS:graphics.current.fps,quality:graphics.choice,resolutionScale:adaptiveQuality.scale,detail:adaptiveQuality.detail,pixelRatio:renderer.getPixelRatio(),xr:vr.active});for(const destination of [gallery,boutique])if(destination)destination.building.visible=destination.active||Math.hypot(current.x-destination.building.position.x,current.z-destination.building.position.z)<220;mackStudio?.update(current.x,current.z);if(running&&!paused&&!document.hidden&&!film.playing){frameTimes.push(rawFrameMs);if(frameTimes.length>480)frameTimes.shift();}
  if(film.playing||gallery?.active||boutique?.active||split){studioScreens?.update(current.x,current.z,false);lottoShop?.update(current.x,current.z,false);cabinets?.update(current.x,current.z,false,camera);}
  for(const destination of [gallery,boutique])destination?.animateVisitors((running&&!paused||gallery?.active||boutique?.active||film.playing)?dt:0);
  if(film.playing){studioCapture?.update(current.x,current.z,false,camera);film.render(dt,renderer,scene,camera,(focus,wanted)=>{const mapped=toMap(focus.x,focus.y,focus.z);scenery.update(mapped.x,mapped.z,clock);wanted.y=Math.max(wanted.y,world.sampleGround(wanted.x,wanted.z,ground).height+.5);followStableSun(sun,focus,night?DUSK_SUN:DAY_SUN);});return;}
  if(gallery?.active||boutique?.active){
    const destination=(gallery?.active?gallery:boutique)!;const walking=destination.update(document.hidden?0:dt,camera);
    if(vr.active){vr.eyeHeight=hero.vrEyeHeight-hero.mountHeight;vr.update(walking,false,false,'Serengeti Galleries',false,dt,xrFrame);}
    studioCapture?.update(walking.x,walking.z,!vr.active,camera);rideAudio.update(current,false);renderer.render(scene,camera);studioCapture?.afterRender();return;
  }
  if(split)studioCapture?.update(current.x,current.z,false,camera);if(split&&community){community.view.root.visible=false;community.ui.update(false);}courseView.update(split?split.simulation.riders.map(r=>r.pose):[current]);if(split){frameSplit(now,dt);return;}
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
      mapWorld.step();sim.step(1/120,deviceReady?{...NEUTRAL_ACTIONS,throttle,steer,crouch,eyeControl:!vr.active&&cameraMode==='first',seated:seatedRide,hop:touch.consumeHop()||hop,hopHeld:touch.hopHeld||gp.hopHeld||xp.hopHeld||keys.has('Space'),reset:resetPressed,trick:trickRequest}:NEUTRAL_ACTIONS);hop=false;resetPressed=false;trickRequest=0;
      if(sim.tricks.award>0)confirmRide('trick',sim.tricks.event,'trick:'+clock);else if(sim.tricks.event)toast(sim.tricks.event);
      if(sim.crashed)crashEntry();sim.writePose(current);contactEffects?.step(1/120,current,sim.snapshot().grounded);confirmation.step(1/120);if(sim.touchedDown){const m=toMap(current.x,0,current.z);if(parkContains(m.x,m.z)&&sim.lastLandingQuality!=='crash'&&clock-parkLastLanding>1){parkLandings++;parkLastLanding=clock;}follow.landing(sim.lastLandingImpact);if(sim.lastLandingQuality!=='crash'){const surface=contactEffects?.land(current,sim.lastLandingImpact);rideAudio.landing(sim.lastLandingImpact,surface?.surface??world.sampleGround(current.x,current.z,ground,current.y).surface,surface?.wet);if(!sim.tricks.active&&!sim.tricks.event)confirmation.show('landing',sim.lastLandingQuality.toUpperCase()+' LANDING','landing:'+clock);}}
      follow.step(1/120,current);if(dogEnabled)dog.step(1/120,current);if(!sim.cycling&&!community?.ride.joined)loop.step(1/120,current,sim.snapshot().grounded,sim.touchedDown?sim.lastLandingQuality:undefined,sim.tricks.award?sim.tricks.event:undefined,dog.current,dogEnabled,sim.tricks.active,sim.tricks.award);acc=Math.max(0,acc-1/120);if(!challengeRun)score=loop.flow.banked;
      if(landmarkMission?.run){const mapped=toMap(current.x,0,current.z),route=cutCoords(mapped.x,mapped.z);if(landmarkMission.run.step(1/120,{station:route.d,offset:route.u,speed:current.speed,crashed:sim.crashed,dogDistance:Math.hypot(dog.current.x-current.x,dog.current.z-current.z),dogCommand:dog.command,sit:dog.sit}))confirmRide('checkpoint',landmarkMission.run.instruction,'mission:'+landmarkMission.run.phase+':'+landmarkMission.run.gate);}
      if(practice){practice.observe(current,sim.snapshot().grounded,sim.touchedDown&&(sim.lastLandingQuality==='clean'||sim.lastLandingQuality==='charged'),Math.abs(throttle)<.05);if(practice.complete&&!practiceCompleted){practiceCompleted=true;try{localStorage.setItem(practiceKey(),'complete');}catch{}quickPractice.textContent='Practice again';}loop.flow.cancel();score=0;}
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
  for(const destination of [gallery,boutique])if(destination){const p=toMap(current.x,0,current.z),c=cutCoords(p.x,p.z);destination.offer(c.d,c.u,current,!!((race&&!finished)||(challengeRun&&!finished)),running&&!cabinets?.playing&&$('menu').hidden&&![gallery,boutique].some(other=>other&&other!==destination&&Math.hypot(current.x-other.approach.x,current.z-other.approach.z)<Math.hypot(current.x-destination.approach.x,current.z-destination.approach.z)));}
  race?.render(running&&$('menu').hidden,vr.active);
  const pm=toMap(pose.x,0,pose.z),inPark=parkContains(pm.x,pm.z);parkHUD.hidden=!inPark||!!race||!!split||!!challengeRun||vr.active||!$('menu').hidden;parkHUD.textContent=`FREESTYLE YARD / ${hero.skateboarding?'SKATEBOARD':'EUC'} / ${parkLandings} clean landings / ${score} banked points. Pump loop outside; bowl on the east side; tabletop through the middle. Brake to switch rides.`;
  community?.update(dt,communityActive(),paused,world.navigationObstacles(current.x,current.z,1000),sim.cycling?'bicycle':'euc');if(community){community.ui.update(communityActive()&&$('menu').hidden&&$('helpPanel').hidden);if(now-hudAt>120)canvas.dataset.community=JSON.stringify({stage:community.ride.stage,joined:community.ride.joined,gate:community.ride.nextGate,completed:community.ride.completed,riders:community.ride.riders});}canvas.dataset.vehicle=sim.vehicleId;
  bikeInvitation.update(dt,!elmwood&&communityActive()&&!paused&&!finished&&!sim.crashed&&$('menu').hidden&&$('helpPanel').hidden&&!cabinets?.playing,current,world.navigationObstacles(current.x,current.z,28));
  hero.root.visible=!sim.cycling;if(bicycleView){bicycleView.root.visible=sim.cycling;bicycleView.apply(pose,sim.bicycle.steeringAngle,sim.bicycle.pedalPhase);}if(dogView)dogView.root.visible=dogEnabled;hero.apply(pose);pedalSparks.update(dt,pose,running&&!paused&&!finished&&!sim.crashed);
  const firstPerson=cameraMode==='first'&&!sim.crashed;
  // Immersive view retains the selected rider's animated body, excluding head geometry.
  hero.visibility.setVR(vr.active);
  hero.rider.visible=vr.active||!firstPerson;if(bicycleView)bicycleView.rider.visible=!firstPerson;
  vr.eyeHeight=hero.vrEyeHeight;
  const mapTraffic=mapWorld.traffic.map(t=>({...t,...toLocal(t.x,t.y,t.z),heading:-t.heading,fall:t.fall?{...t.fall,headingY:-t.fall.headingY,crashLateral:-t.fall.crashLateral,crashRoll:-t.fall.crashRoll,crashSide:-t.fall.crashSide,wheelCrashLateral:-t.fall.wheelCrashLateral,wheelCrashLean:-t.fall.wheelCrashLean}:undefined}));traffic.update(mapTraffic,running&&!paused&&!finished?dt:0,pose,graphics.current.distance);if(photographers){photographers.root.visible=running&&$('menu').hidden&&!loveTag?.active;photographers.update(running&&!paused&&!finished&&photographers.root.visible?dt:0,[pose],Math.min(200,graphics.current.distance));}
  dog.updateTargets(mapWorld.traffic.filter(t=>t.kind==='pedestrian').map(t=>toLocal(t.x,t.y,t.z)));
  if(dogEnabled){dog.sample(running&&!paused&&!finished?acc*120:1,dogPose);dogView.apply(dogPose);dogView.reactToRider(pose,dogPose);}
  contactEffects?.update(dt,pose,hero,dogView,dogEnabled,running&&!paused&&!finished);
  confirmation.render(running&&$('menu').hidden&&!vr.active&&!finished);riderLamp.update(dt,pose,night,running&&$('menu').hidden&&!qaVisualBaseline);ambience?.update(clock,[pose]);
  const photoTarget=challengeRun?.challenge.kind==='discovery'?district.targets.find(t=>!challengeRun!.photos.has(t.id)):undefined;
  if(vr.active){vr.update(pose,paused,sim.crashed,race?race.rules.label+' · '+race.rules.elapsed.toFixed(1)+' s':finished?'COMPLETE · recover to retry / pause for free ride':SPECIAL_MOVES[selectedTrick-1].name,sim.tricks.active,dt,xrFrame);}
  else if(firstPerson){
    const eye=(sim.cycling?bicycleView?.head:hero.head)?.getWorldPosition(new T.Vector3())??new T.Vector3(pose.x,pose.y+1.85,pose.z);
    eye.add(new T.Vector3(Math.sin(pose.headingY)*.10,.065,Math.cos(pose.headingY)*.10));
    eye.y=underpassCameraHeight(world,eye,eye.y,pose.y);
    // Body-mounted eyes follow acceleration, braking and bank without changing physics.
    const eyes=riderEyeMotion(pose,matchMedia('(prefers-reduced-motion: reduce)').matches);
    const yaw=pose.headingY+firstYaw,pitch=firstPitch+eyes.pitch;
    camera.position.copy(eye);camera.lookAt(eye.clone().add(new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))));
    camera.rotateZ(eyes.roll);camera.fov=74;
  }
  else if(cameraMode==='photo'&&photoTarget){camera.position.set(pose.x,underpassCameraHeight(world,pose,pose.y+2.35),pose.z);camera.lookAt(photoTarget.x,photoTarget.y,photoTarget.z);camera.fov=60;}
  else if((cameraMode==='chase'||cameraMode==='first')&&running){const view=follow.sample(!paused&&!finished?Math.min(1,acc*120):1);camera.position.set(view.eye.x,view.eye.y,view.eye.z);camera.lookAt(view.target.x,view.target.y,view.target.z);camera.rotateZ(view.roll);camera.fov=chaseFrameFov(view.fov,camera.aspect);}
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
  loop.render(dt,running&&!paused&&!finished&&!sim.cycling&&!community?.ride.joined,hero,dogView.root,camera,vr.active,sim.tricks.snapshot());
  studioCapture?.update(pose.x,pose.z,running&&!paused&&!finished&&!split&&!vr.active&&$('menu').hidden&&$('helpPanel').hidden&&$('mapPanel').hidden&&!cabinets?.playing,camera);
  const shopVisible=running&&!finished&&!split&&!vr.active&&$('menu').hidden&&$('helpPanel').hidden&&$('mapPanel').hidden&&!film.playing;
  if(shopVisible&&!paused&&!cabinets?.playing){const p=toMap(pose.x,pose.y,pose.z),room=studioCoordinates(p.x,p.z);if(Math.abs(room.u)<9.5&&room.v>-21&&room.v<-.5)welcomeGothTech('studio');else if(room.u>2.5&&room.u<21&&room.v>-.5&&room.v<17)welcomeGothTech('store');}
  pennyShop?.update(pose.x,pose.z,shopVisible&&!cabinets?.playing);studioScreens?.update(pose.x,pose.z,shopVisible&&!cabinets?.playing);lottoShop?.update(pose.x,pose.z,shopVisible&&!cabinets?.playing);cabinets?.update(pose.x,pose.z,shopVisible,camera);
  if(!vr.active)camera.updateProjectionMatrix();followStableSun(sun,pose,night?DUSK_SUN:DAY_SUN);fill.position.set(pose.x-12,pose.y+8,pose.z-13);fill.target.position.copy(hero.root.position);if(!qaVisualBaseline&&!elmwood&&!night){const roof=world.raycastObstacle({x:pose.x,y:pose.y+2.3,z:pose.z},{x:0,y:1,z:0},7);fill.intensity=T.MathUtils.damp(fill.intensity,roof===null?.55:.9,5,dt);}
  canvas.dataset.visibleChunks=String(scenery.update(toMap(pose.x,0,pose.z).x,toMap(pose.x,0,pose.z).z,clock));if(now-hudAt>120)canvas.dataset.environment=JSON.stringify({rails:'rails' in scenery?scenery.rails:0,landmarks:'landmarks' in scenery?scenery.landmarks:null,flowers:'flowers' in scenery?scenery.flowers:0,trees:scenery.trees,grassClumps:'grassClumps' in scenery?scenery.grassClumps:0,routeArt:'routeArt' in scenery?scenery.routeArt:null,generatedSkins:scenery.skins,treeVersion:elmwood?'elmwood-five-species-20260916':'curved-elm-maple-20260915',style:elmwood?'Five botanical meshes, photographic PBR and outdoor HDR lighting':'Higgsfield elm/maple foliage, tapered branches and bark',quality:compactElmwood||vr.active?'compact':'detailed'});renderer.render(scene,camera);studioCapture?.afterRender();if(finished)loop.capture(canvas);frames++;if(now-fpsAt>1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;}
  if(photoPending){photoPending=false;if(photoTarget&&challengeRun&&!finished&&!paused){const target=new T.Vector3(photoTarget.x,photoTarget.y,photoTarget.z),direction=target.clone().sub(camera.position),distance=direction.length(),projected=target.clone().project(camera),hit=world.raycast(camera.position,direction.clone().normalize(),Math.max(0,distance-.8));const check={distance:Math.hypot(target.x-pose.x,target.z-pose.z),speed:pose.speed,inFrame:Math.abs(projected.x)<.85&&Math.abs(projected.y)<.85&&projected.z>-1&&projected.z<1,unobstructed:hit===null||hit>=distance-.8};if(photoAllowed(check)&&challengeRun.capture(photoTarget.id,check)){district.savePhoto(photoTarget.id,canvas);confirmRide('checkpoint','PHOTO SAVED · '+photoTarget.name,'photo:'+photoTarget.id);if(challengeRun.done)completeChallenge();}else toast('Stop within 3–42 m with a clear view. Use Frame subject or orbit the camera.');}}
  film.capture(dt,running&&!paused&&!finished,running&&$('menu').hidden&&!vr.active);
  rideAudio.update(pose,running&&!paused&&!finished&&!sim.crashed&&!sim.cycling);
  loop.music.update(dt,finished?'results':elmwood||challengeRun?.challenge.kind==='discovery'?'garden':challengeRun?.challenge.kind==='style'?'style':'ride',!document.hidden&&(!paused||!$('menu').hidden||finished),pose.speed,loop.flow.pending,pose.warningLevel+pose.scrape);
  if(now-hudAt>120){
    if(race){race.hud();canvas.dataset.race=JSON.stringify({countdown:race.rules.countdown,elapsed:race.rules.elapsed,place:race.rules.place,done:race.rules.done,racers:race.rules.racers,pilots:race.pilots.map(p=>p.diagnostics())});}else delete canvas.dataset.race;
    const timings=[...frameTimes].sort((a,b)=>a-b),gl=renderer.getContext(),gpu=gl.getExtension('WEBGL_debug_renderer_info');
    canvas.dataset.performance=JSON.stringify({sampleFrames:timings.length,frameP50:timings[Math.floor(timings.length*.5)],frameP95:timings[Math.floor(timings.length*.95)],loadMs:loadedAt-bootStarted,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length,heapMB:((performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0)/1048576,renderer:gpu?gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),visualBaseline:qaVisualBaseline});
    const s=sim.snapshot(),mapped=toMap(pose.x,pose.y,pose.z),gps=gpsAt(mapped.x,mapped.z);updateMap(mapped.x,mapped.z);miniMap?.hud.setRaceCourse(race?{...DETROIT_RACE_COURSE,next:race.rules.player.gate,finished:race.rules.player.finish!==null}:null);miniMap?.update(mapped.x,mapped.z,pose.headingY,running&&$('menu').hidden&&!vr.active);if(communityActive()&&community?.ride.joined)miniMap?.hud.setRoute(community.ride.route.points.map(p=>{const m=toMap(p.x,0,p.z);return northUp(m.x,m.z);}),[],'Cut community ride · '+community.ride.nextGate+'/'+community.ride.gates.length);
    if(elmwood)Object.assign(canvas.dataset,{map:'elmwood',origin:JSON.stringify({name:'Elmwood entrance / local plan coordinates',source:ELMWOOD_SOURCE,estimated:true}),routeLength:String(ELM_PATHS.reduce((n,p)=>n+p.length,0))});
    else Object.assign(canvas.dataset,{map:'cut',latitude:gps.lat.toFixed(7),longitude:gps.lon.toFixed(7),station:cutCoords(mapped.x,mapped.z).d.toFixed(2),origin:JSON.stringify(GEO.origin)});
    const footErrors=hero.legs.map((l,i)=>l.foot.getWorldPosition(new T.Vector3()).distanceTo(hero.footTarget(i,pose)));
    canvas.dataset.wheelLights=JSON.stringify(hero.lights.status);canvas.dataset.poseDebug=JSON.stringify({riderRoll:pose.riderRoll,wobble:pose.wobbleSway,groundRoll:pose.groundRoll,groundPitch:pose.groundPitch,wheelPitch:pose.wheelPitch,crash:pose.crashBlend,hip:hero.hips?.getWorldPosition(new T.Vector3()).toArray(),footErrors});
    canvas.dataset.companion=JSON.stringify({command:dog.command,sit:dog.sit,lie:dog.lie,barking:dog.barking,mode:dog.mode,asset:'DS_Boerboel_01',count:dogEnabled?1:0,enabled:dogEnabled,visible:dogView.root.visible,gait:dogView.gait,speed:dogPose.speed,phase:dogPose.phase,x:dogPose.x,y:dogPose.y,z:dogPose.z,distance:Math.hypot(dogPose.x-pose.x,dogPose.z-pose.z),jumps:dog.jumps,jumpHeight:dogPose.jumpHeight});
    const missionRoute=toMap(pose.x,0,pose.z);landmarkMission?.update(running&&$('menu').hidden&&$('helpPanel').hidden&&$('mapPanel').hidden&&!film.playing,cutCoords(missionRoute.x,missionRoute.z).d);
    canvas.dataset.landmarkMission=JSON.stringify(landmarkMission?.run?{phase:landmarkMission.run.phase,gates:landmarkMission.run.gate,elapsed:landmarkMission.run.elapsed,penalties:landmarkMission.run.penalties}:null);
    canvas.dataset.effects=JSON.stringify({surface:contactEffects?.surface.model.state,confirmation:confirmation.model.text,lamp:riderLamp.intensity,patches:effectPatches.length});
    canvas.dataset.rideFeedback=JSON.stringify({stopFoot:pose.stopFoot,scrape:pose.scrape,scrapeSide:pose.scrapeSide,warningLevel:pose.warningLevel,beepPulse:pose.beepPulse,audio:rideAudio.state});
    canvas.dataset.replayLoop=JSON.stringify(loop.state);canvas.dataset.controllerInput=JSON.stringify(gp);canvas.dataset.vr=JSON.stringify({active:vr.active,hud:vr.hudEnabled,steering:vr.steeringMode,drive:vr.driveMode,bodyVisible:hero.rider.visible,eyeHeight:vr.eyeHeight,comfort:vr.comfort,controllers:xp.connected,secure:isSecureContext});
    canvas.dataset.fall=JSON.stringify({phase:s.fallPhase,brace:pose.crashBrace,release:pose.crashRelease,impact:pose.crashImpactPulse,bodyForward:pose.crashForward,wheelForward:pose.wheelCrashForward});
    const readiness=sim.moveReadiness(selectedTrick);trickHint.textContent=readiness||SPECIAL_MOVES[selectedTrick-1].name+' · Ready';canvas.dataset.trick=JSON.stringify({...sim.tricks.snapshot(),selected:selectedTrick,readiness:readiness||'Ready'});
    canvas.dataset.motion=JSON.stringify({state:paused?'paused':s.state,velocity:s.velocity,yawRate:pose.yawRate,turnIntent:pose.turnIntent,brake:pose.brakeAmount,compression:pose.landingCompression,extension:pose.takeoffExtension,airHeight:pose.airHeight,slip:pose.slipAngle,traction:pose.tractionUsage,lateralAcceleration:pose.lateralAcceleration,weightShift:pose.weightShift});
    quickHelp.textContent=inputDevice==='touch'?'Left thumb rides and steers. Hold/release Hop with your right thumb. Ride options changes view.':inputDevice==='gamepad'?'Left stick steers · RT rides · LT brakes · A holds/releases Hop · X recovers · Y changes view.':inputDevice==='vr'?'Use your configured Quest or Vive controls. Head tracking stays independent of flat-screen cameras.':'WASD rides and steers · S brakes · Space holds/releases Hop · R recovers · H recenters. Select Photo / orbit before dragging the view.';
    $('speedAlert').classList.toggle('beep-pulse',pose.beepPulse>.4&&!paused);
    $('speed').textContent=String(Math.round(Math.abs(s.speedKph)));$('location').textContent=elmwood?'ELMWOOD CEMETERY':parkContains(mapped.x,mapped.z)?'FREESTYLE YARD':locationAt(mapped.x,mapped.z).toUpperCase();
    $('distance').textContent=(s.distanceTravelled/1000).toFixed(2)+' km';$('run').textContent=race?race.rules.label:challengeRun?challengeRun.progress:`FREE RIDE${score?' · '+score+' PTS':''}`;district.update(challengeRun,pose.x,pose.z,pose.headingY);canvas.dataset.challenge=JSON.stringify(challengeRun?{id:challengeRun.challenge.id,start:challengeRun.challenge.start,end:challengeRun.challenge.end,gates:challengeRun.gateCount,totalGates:challengeRun.challenge.gates.length,count:challengeRun.count,elapsed:challengeRun.elapsed,done:challengeRun.done,failed:challengeRun.failed,score:challengeRun.score,medal:challengeRun.medal}:null);
    $('status').textContent=s.crashed?`${paused?'PAUSED · ':''}${s.crashCause.toUpperCase()} · ${recoveryLabel()}`:paused?'PAUSED':s.crouchCharge>.1?`HOP CHARGE ${Math.round(s.crouchCharge*100)}%`:seatedRide?'SEATED RIDE':cruise?'CRUISE':' ';
    $('speedAlert').textContent=paused||s.crashed?'':s.powerStage!=='normal'?`${s.powerStage.toUpperCase()} · EASE OFF`:pose.scrape>.05?'PEDAL SCRAPE · EASE THE CARVE':'';
    const hazard=encounterWarning.step((now-hudAt)/1000,pose,world,running&&!paused&&!finished);
    const m=toMap(pose.x,0,pose.z),route=cutCoords(m.x,m.z),feature=mapWorld.courseFeatures.find(f=>f.station-route.d>-f.length&&f.station-route.d<35);const courseWarning=!hazard&&feature&&running&&!paused?`${feature.kind==='jump'?'Jump ramp':'Slippery patch'} · ${Math.max(0,Math.round(feature.station-route.d))} m · pass ${feature.offset>0?'left':'right'} to avoid`:'';$('warning').hidden=!(hazard||courseWarning);$('warning').textContent=hazard||courseWarning;
    if(practice){$('practiceCopy').textContent=`${Math.min(6,practice.stepIndex+1)}/6 · ${practice.instruction}`;$('practiceHUD').hidden=!$('menu').hidden||vr.active;}
    $('toast').hidden=now>toastUntil||sim.crashed||paused;$<HTMLSelectElement>('camera').value=cameraMode;
    canvas.dataset.cruise=String(cruise);canvas.dataset.inputDevice=inputDevice;crashOverlay.hidden=!running||!sim.crashed||!$('menu').hidden||finished||vr.active;crashRecover.textContent=recoveryLabel();$<HTMLButtonElement>('cruise').disabled=paused||sim.crashed||finished;
    const inside=toMap(pose.x,pose.y,pose.z);canvas.dataset.indoor=elmwood?'outside':indoorRideArea(inside.x,inside.z)??'outside';
    canvas.dataset.touchInput=JSON.stringify({throttle:touch.throttle,steer:touch.steer,crouch:touch.crouch,brake:touch.braking,hopHeld:touch.hopHeld});canvas.dataset.trafficKinds=JSON.stringify(mapWorld.traffic.map(t=>({id:t.id,kind:t.kind,speed:t.speed,x:t.x,y:t.y,z:t.z,heading:t.heading})));
    Object.assign(canvas.dataset,{seated:pose.seated.toFixed(3),speed:s.speed.toFixed(3),x:pose.x.toFixed(2),z:pose.z.toFixed(2),height:pose.y.toFixed(3),grounded:String(s.grounded),lean:s.riderPitch.toFixed(3),roll:s.rollAngle.toFixed(3),crouch:s.crouchCharge.toFixed(2),hops:String(s.hops),landings:String(s.landings),crashes:String(s.crashes),crashed:String(s.crashed),cameraMode,eyeControl:String(!vr.active&&cameraMode==='first'),heading:pose.headingY.toFixed(4),eyeYaw:firstYaw.toFixed(4),eyePitch:firstPitch.toFixed(4),eyeRoll:riderEyeMotion(pose,matchMedia('(prefers-reduced-motion: reduce)').matches).roll.toFixed(4),paused:String(paused),running:String(running),mode,checkpoint:String(gate),distance:s.distanceTravelled.toFixed(1),fps:fps.toFixed(1),drawCalls:String(renderer.info.render.calls),triangles:String(renderer.info.render.triangles),actors:String(mapWorld.traffic.length),score:String(score),finished:String(finished)});hudAt=now;
  }
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;graphics.resize();camera.updateProjectionMatrix();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;clearInput();renderer.setAnimationLoop(null);boot.fail('Graphics were interrupted. Reload to return to the menu.','WebGL context lost; simulation and race clocks stopped. Your saved records are unchanged.');renderBoot();});
