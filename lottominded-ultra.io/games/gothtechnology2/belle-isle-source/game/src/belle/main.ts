import {animeRider,glowVehicle} from './referenceActors.ts';
import {Golf} from './golf.ts';
import './rideMedia.css';
import {yieldStartupTask,warmObjectTextures} from './startupWork.ts';
import {prepareOnFootRider} from '../../runtime/ride-core/src/onFootRider.ts';
import {StartupTelemetry} from './startupTelemetry.ts';
import {CoopSession} from './coop/session.ts';
import {createBelleAudio} from './belleAudio.ts';
import {SceneWarmup} from './sceneWarmup.ts';
import {VehicleHeadlamp} from './vehicles/headlamp.ts';
import {BoatRide} from './boatRide.ts';
import {RideRadio} from './rideRadio.ts';
import {speedMph} from './speedUnits.ts';
import {flightHudBackdropFactor} from './flightHudBackdrop.ts';

import {IslandRace} from './racing.ts';
import {IslandTrials} from './islandTrials.ts';
import type {TrialPose} from './trialRules.ts';
import {IslandActivities} from './islandActivities.ts';
import {FrameBudget,sceneFrameCap} from './frameBudget.ts';
import {softwareWebGLRenderer} from './worldPerformancePolicy.ts';
import {pauseSoftwareStartupScene} from './startupRenderPolicy.ts';
import {installGpuFramePacing} from './gpuFramePacing.ts';
import {readAntiAliasingMode,enableHardwareAntialiasing} from './antiAliasingPolicy.ts';
import {prepareCoastGuardMap} from './coastGuard.ts';
import coastGuardLayout from './coastGuardLayout.json' with {type:'json'};
import {Fishing} from './fishing.ts';
import {createReferenceHud} from './referenceHud.ts';
import {SUNSET_REFERENCE,REFERENCE_STYLE,prepareReferencePreferences,referenceSpawn} from './sunsetReferencePolicy.ts';
import {createSunsetPreview} from './sunsetPreview.ts';
import {alignScottMap} from './fountainLayout.ts';
import {prepareIslandRecovery} from './recovery.ts';
import {CadillacRide,cadillacModel} from './cadillacRide.ts';
import {RideProfile} from './rideProfile.ts';
import {createNatureRenderProbe} from './renderDiagnostics.ts';
import {installRenderSubmissionProbe} from './renderSubmissionDiagnostics.ts';
import {createRideProfileBuildReader} from './rideProfileBuild.ts';
import {gpuFramePacingDiagnostics,attachGpuFramePacingProbe} from './gpuFramePacing.ts';
import {ManualLoopProbe} from './loopDiagnostics.ts';
import type {BelleOnlineRooms} from './onlineRooms.ts';
import {OnlineRiders} from './onlineRiders.ts';
import {PLAYER_COLORS} from './onlineProtocol.ts';
import {activityLandmarks,activityVisit,clockWorld,floralClock} from './activitiesPlan.ts';
import {GiantSlideRide} from './giantSlideRide.ts';
import {GIANT_SLIDE,SLIDE_ENTRY,SLIDE_HEADING} from './giantSlide.ts';
import {configureAssetDelivery} from './assetDelivery.ts';
import {applyRealisticMaterials} from './realisticMaterials.ts';
import {connectSkySettings} from './skySettings.ts';
import {Photography,mixGameAudio} from './photography.ts';
import {ParkCompanion} from './parkCompanion.ts';
import {bridgeOverlook} from './bridgeLighting.ts';
import {resolveShowcaseStops} from './showcaseStops.ts';
import {resolveEnvironmentZones} from './environmentZones.ts';
import {playgrounds,playgroundLandmarks,playgroundRay} from './playgrounds.ts';
import referenceArchitecture from './referenceArchitecture.json' with {type:'json'};
import {appendLandmarkSources} from './landmarkSourceLinks.ts';
import {YACHT,yachtWorld,yachtInside,yachtRoom,yachtRay} from './yachtClub.ts';
import golfCenter from './golfCenterLayout.json' with {type:'json'};
import {NatureAudio} from './natureAudio.ts';
import {fountains,TEMPERANCE_VIEW} from './waterFeatures.ts';
import {dossinWorld,dossinInside,dossinRoom,dossinRay} from './dossin.ts';
import {HoverRide} from './hover.ts';
import {BelleVR} from './vr.ts';
import {aquariumWorld,aquariumInside,aquariumRoom,aquariumRay} from './aquarium.ts';
import {createStartup} from './startup.ts';
import {createFirstRideObjective} from './firstRideObjective.ts';
import {localPerformanceProbe} from './performanceProbe.ts';
import {planCasinoWayViews,CASINO_WAY_REFERENCE} from './casinoBridgeView.ts';
import {planShallowWaterInspection} from './shallowWaterInspection.ts';
import './firstRideObjective.css';
import {greenhouseWorld,greenhouseInside,greenhouseRoom} from './conservatory.ts';
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';import {HUMAN_PROFILE} from '../../runtime/ride-core/src/profiles.ts';import {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';import {createWorld} from './world.ts';import {ParkTerrain,inside,type Landmark,type ParkMap} from './terrain.ts';import './style.css';
import {createBeachLocator} from './beachLocation.ts';
import {createMobileHud} from './mobileHud.ts';
import {brakeThrottle} from './mobileInput.ts';
import {batchArmoredInk,batchHelmetDecals} from './riderInkBatch.ts';
import {batchWheelDisplay} from './wheelDisplay.ts';
import {initiallyCollapsedMap} from './visualPolishPolicy.ts';
import './visualPolish.css';
prepareReferencePreferences();
configureAssetDelivery();
const el=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const canvas=el<HTMLCanvasElement>('game'),start=el<HTMLButtonElement>('start');const startup=createStartup();const startupMetrics=new StartupTelemetry();
Object.defineProperty(window,'__belleStartupProfile',{value:()=>startupMetrics.snapshot(),configurable:true});
window.addEventListener('pagehide',()=>startupMetrics.dispose(),{once:true});
const status=(s:string)=>{startupMetrics.stage(s);startup.status(s);};const belleAudio=createBelleAudio();
let renderFocused=document.hasFocus();window.addEventListener('focus',()=>{renderFocused=true;trials?.suspend();});window.addEventListener('blur',()=>{renderFocused=false;});
el('profile').hidden=!new URLSearchParams(location.search).has('profile');
if(localPerformanceProbe()){const diagnostic=document.createElement('div');diagnostic.id='performance-probe-warning';diagnostic.textContent='REDUCED SCENE DIAGNOSTIC — NOT RELEASE QUALITY';diagnostic.style.cssText='position:fixed;z-index:10000;left:8px;bottom:8px;font:700 11px system-ui;padding:8px;background:#1a1614ee;color:#ffce92;border:1px solid #e4b573;pointer-events:none';document.body.append(diagnostic);}
let scenePreparing=false,resetFrameClock=false;
let active=false,paused=false,first=startup.choice.camera==='fpp',cap=60,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;const keys=new Set<string>();let throttle=0,steer=0,hop=false,recover=false,mount=false;let cameraYaw=0,cameraPitch=.1;
function chooseView(value:boolean){first=value;cameraYaw=0;startup.setCamera(first?'fpp':'tpp');syncViewLabel();}
function syncViewLabel(){const view=el<HTMLButtonElement>('view');view.textContent=first?'FPP · V':'TPP · V';view.setAttribute('aria-label','Switch to '+(first?'third-person (TPP)':'first-person (FPP)')+' camera (V)');view.setAttribute('aria-pressed',String(first));}syncViewLabel();
let hud:ReturnType<typeof createMobileHud>|undefined;let clearSimulationInput=()=>{};
function clear(){coop?.clear();belleAudio.silence();trials?.suspend();race?.clear();fishing?.clear();keys.clear();throttle=steer=0;hop=recover=mount=false;hover?.clear();boat?.clear();hud?.clear();clearSimulationInput();}
let coop:CoopSession|undefined;
let online:BelleOnlineRooms|undefined;let race:IslandRace|undefined;let trials:IslandTrials|undefined;

let slide:GiantSlideRide|undefined;
let fishing:Fishing|undefined;
let photo:Photography|undefined;
let golf:Golf|undefined;let boat:BoatRide|undefined;let activities:IslandActivities|undefined;
let cadillac:CadillacRide|undefined;
const cadillacDiagnostic=new URLSearchParams(location.search).get('ride')==='cadillac';
let vr:BelleVR|undefined;let hover:HoverRide|undefined;
function baseBlocked(){return !!golf?.active||!!coop?.active||scenePreparing||!!race?.active||!!fishing?.active||!!vr?.active||!active||paused||!!online?.inputBlocked||!!document.querySelector('dialog[open]')||!!trials?.active&&(!renderFocused||document.hidden);}
function blocked(){return baseBlocked()||!!trials?.inputLocked;}
// Capture fresh held controls during the countdown; only simulation remains locked.
function inputCaptureBlocked(){return baseBlocked()||!!trials?.inputCaptureLocked;}
window.addEventListener('keydown',e=>{if(golf?.active){if(!paused)golf.key(e);return;}if(e.code==='KeyG'&&!cadillac?.riding&&!hover?.riding&&!blocked()&&golf?.nearby){golf.begin();return;}if((e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable=true]'))return;if(trials?.active&&!document.querySelector('dialog[open]')&&trials.key(e))return;if((e.target as HTMLElement)?.closest('button,a,summary'))return;if(trials?.active&&e.repeat){e.preventDefault();return;}if(fishing?.active){if(!paused&&!document.querySelector('dialog[open]'))fishing.key(e);return;}if(inputCaptureBlocked())return;if(cadillac?.riding){if(!['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyF','KeyR','KeyV'].includes(e.code))return;e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')cadillac.toggleDoor();if(e.code==='KeyF')cadillac.requestExit();if(e.code==='KeyR')recover=true;if(e.code==='KeyV')chooseView(!first);return;}if(e.code==='KeyJ'&&hover?.riding&&hover.vehicle==='corleo'&&hover.key(e))return;if(activities?.key(e))return;if(slide?.active&&e.code==='KeyR'){e.preventDefault();slide.cancel();return;}if(e.code==='KeyE'&&!e.repeat&&!hover?.riding&&!photo?.active){e.preventDefault();slide?.interact();return;}if(photo?.key(e))return;if(boat?.key(e))return;if(hover?.key(e))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyR','KeyF','KeyV'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Space'&&!blocked())hop=true;if(e.code==='KeyR')recover=true;if(e.code==='KeyF')mount=true;if(e.code==='KeyV')chooseView(!first);});window.addEventListener('keyup',e=>{keys.delete(e.code);fishing?.keyUp(e.code);hover?.keyUp(e.code);boat?.keyUp(e.code);});window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
el('mount').onclick=()=>{if(!blocked()&&!trials?.active){if(cadillac?.riding)cadillac.requestExit();else mount=true;}};el('recover').onclick=()=>{if(trials?.active){trials.restart();return;}if(blocked())return;clear();if(slide?.active)slide.cancel();else recover=true;};el('view').onclick=()=>{if(!photo?.active)chooseView(!first);};el('pause').onclick=()=>{paused=!paused;el('pause').textContent=paused?'Resume':'Pause';clear();};
for(const [button,dialog]of[['map-open','guide'],['settings-open','settings'],['welcome-settings','settings']])el(button).onclick=()=>{clear();el<HTMLDialogElement>(dialog).showModal();};document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>{el<HTMLDialogElement>(b.dataset.close!).close();if(!active&&b.dataset.close==='settings')el('welcome-settings').focus();else canvas.focus();});
canvas.addEventListener('pointerdown',()=>{if(!blocked())canvas.focus({preventScroll:true});});

document.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button')&&!blocked())canvas.focus();});
const zone=el('touch-zone'),touch=el<HTMLInputElement>('touch');
hud=createMobileHud({blocked:inputCaptureBlocked,movementBlocked:()=>!!photo?.active||!!hover?.riding||!!slide?.active,clear,move:(x,y)=>{steer=x;throttle=y;},look:(x,y)=>{cameraYaw-=x*.003;cameraPitch=Math.max(-1.25,Math.min(1.1,cameraPitch+y*.002));},hop:()=>{if(!blocked()){if(cadillac?.riding)cadillac.toggleDoor();else hop=true;}}});
const release=()=>hud?.clear();
el<HTMLInputElement>('motion').checked=reduced;el<HTMLInputElement>('motion').onchange=e=>reduced=(e.target as HTMLInputElement).checked;
const graphics=el<HTMLSelectElement>('quality'),frameLimit=el<HTMLSelectElement>('fps'),aaSelect=el<HTMLSelectElement>('anti-aliasing');
graphics.value='automatic';aaSelect.value='automatic';try{const saved=JSON.parse(localStorage.getItem('belle-graphics-v1')||'null');if(saved&&['automatic','smooth','high'].includes(saved.quality))graphics.value=saved.quality;if(saved&&(saved.cap===30||saved.cap===60)){cap=saved.cap;frameLimit.value=String(cap);}aaSelect.value=readAntiAliasingMode(saved?.antiAliasing);}catch{/* Keep the default settings when storage is unavailable. */}
let appliedAaMode=readAntiAliasingMode(aaSelect.value);
const aaDevice={coarsePointer:matchMedia('(pointer:coarse)').matches,deviceMemoryGB:(navigator as Navigator&{deviceMemory?:number}).deviceMemory,logicalCores:navigator.hardwareConcurrency};
const requestedMsaa=enableHardwareAntialiasing(appliedAaMode,aaDevice);
let actualMsaa:boolean|undefined;
const aaStatus=el<HTMLElement>('aa-status'),aaApply=el<HTMLButtonElement>('aa-apply');
const saveGraphics=()=>{try{localStorage.setItem('belle-graphics-v1',JSON.stringify({quality:graphics.value,cap,antiAliasing:appliedAaMode}));}catch{/* The current session still uses the selected graphics. */}};
const syncAaStatus=()=>{
 const selected=readAntiAliasingMode(aaSelect.value),pending=selected!==appliedAaMode,active=actualMsaa??requestedMsaa;
 aaApply.hidden=!pending;
 const fallback=requestedMsaa&&!active?' (not supported by this browser/GPU)':'';
 aaStatus.textContent=(active?'Hardware edge smoothing on':'Hardware edge smoothing off')+fallback+'. '+(pending?'Apply the selection'+(enableHardwareAntialiasing(selected,aaDevice)!==requestedMsaa?' to reload the scene.':'.'):(appliedAaMode==='automatic'?'Auto limits GPU work on touch or low-power devices.':'Setting saved.'));
};
aaSelect.onchange=syncAaStatus;
aaApply.onclick=()=>{
 const selected=readAntiAliasingMode(aaSelect.value),reload=enableHardwareAntialiasing(selected,aaDevice)!==requestedMsaa;
 appliedAaMode=selected;saveGraphics();
 if(reload){location.reload();return;}
 syncAaStatus();
};
syncAaStatus();
graphics.onchange=saveGraphics;
frameLimit.onchange=()=>{cap=Number(frameLimit.value);saveGraphics();};
const opacity=el<HTMLInputElement>('opacity');
try{opacity.value=localStorage.getItem('belle-map-opacity')||'.8';}catch{opacity.value='.8';}
const mapAlpha=()=>el('navigation').style.setProperty('--map-alpha',opacity.value);
opacity.oninput=()=>{mapAlpha();try{localStorage.setItem('belle-map-opacity',opacity.value);}catch{}};mapAlpha();
let savedMapChoice:string|null=null;try{savedMapChoice=localStorage.getItem('belle-map-collapsed');}catch{}
let mapCollapsed=initiallyCollapsedMap(savedMapChoice,touch.checked,innerWidth);
const syncMap=()=>{el('minimap').hidden=mapCollapsed;el('navigation').classList.toggle('is-collapsed',mapCollapsed);el('minimap-hide').textContent=mapCollapsed?'Show map':'Hide map';el('minimap-hide').setAttribute('aria-expanded',String(!mapCollapsed));};
el('minimap-hide').onclick=()=>{mapCollapsed=!mapCollapsed;syncMap();try{localStorage.setItem('belle-map-collapsed',String(mapCollapsed));}catch{}};syncMap();
async function boot(){const response=await fetch('./belle/map.json');if(!response.ok)throw Error('Map unavailable');const data=await response.json() as ParkMap;alignScottMap(data);prepareCoastGuardMap(data);if(SUNSET_REFERENCE)data.spawn=referenceSpawn(data);const beachPlace=createBeachLocator(data.areas);for(const p of activityLandmarks())if(!data.landmarks.some(l=>l.id===p.id))data.landmarks.push(p);for(const p of playgroundLandmarks)if(!data.landmarks.some(l=>l.id===p.id))data.landmarks.push(p);status('Preparing terrain and canal crossings');await yieldStartupTask();const terrain=new ParkTerrain(data);await yieldStartupTask();const natureAudio=new NatureAudio(fountains(data),text=>el('nature-audio-status').textContent=text,[data.island,...data.water.map(w=>w.points)]);const natureToggle=el<HTMLInputElement>('nature-sound'),natureVolume=el<HTMLInputElement>('nature-volume'),birdVolume=el<HTMLInputElement>('bird-volume');natureToggle.checked=natureAudio.enabled;natureVolume.value=String(natureAudio.volume);birdVolume.value=String(natureAudio.birdVolume);const audioSettings=()=>natureAudio.configure(natureToggle.checked,Number(natureVolume.value),Number(birdVolume.value));natureToggle.onchange=audioSettings;natureVolume.oninput=audioSettings;birdVolume.oninput=audioSettings;el('nature-preview').onclick=()=>natureAudio.preview();const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,innerWidth/innerHeight,.08,22000);const renderer=new T.WebGLRenderer({canvas,antialias:requestedMsaa,powerPreference:'high-performance'});
 // The renderer's ACTUAL WebGL backend, not a user-agent/viewport guess,
 // governs whether decorative preview canvases should consume a second GPU.
 const gameGl=renderer.getContext(),gpuDebug=gameGl.getExtension('WEBGL_debug_renderer_info');
 const gpuName=String(gameGl.getParameter(gpuDebug?.UNMASKED_RENDERER_WEBGL??gameGl.RENDERER));
 const softwareStartup=softwareWebGLRenderer(gpuName);
 startup.setSoftwarePreview(softwareStartup);
 if(softwareStartup)installGpuFramePacing(renderer);
 else if(/\bApple\b/i.test(gpuName)){
  installGpuFramePacing(renderer,()=>renderFocused&&!document.hidden&&!blocked());
 }
 actualMsaa=!!renderer.getContext().getContextAttributes()?.antialias;syncAaStatus();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const core=new RideCore(terrain,{spawn:{position:{x:data.spawn.x,y:2,z:data.spawn.z},headingY:data.spawn.heading}});clearSimulationInput=()=>core.clearPendingActions();const loader=new GLTFLoader();const renderProbe=createNatureRenderProbe(location.search);const world=await createWorld(scene,renderer,data,terrain,status,renderProbe);el('profile').dataset.macarthurRailMeshes=String(world.stats.bridgeRailFinish.meshes);el('profile').dataset.macarthurRailMaterials=String(world.stats.bridgeRailFinish.newMaterials);world.sky.preview(!SUNSET_REFERENCE);const refreshSkySettings=connectSkySettings(world.sky);const sunsetPreview=SUNSET_REFERENCE?createSunsetPreview(camera,()=>hover,()=>active&&!trials?.active&&!race?.active&&!coop?.active&&!photo?.active,()=>{clear();cameraYaw=0;cameraPitch=.1;snap=true;},data.spawn,data):undefined;
 const frameBudget=new FrameBudget();graphics.onchange=()=>{frameBudget.reset();world.setQuality(graphics.value);saveGraphics();};world.setQuality(graphics.value);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(!vr?.active)renderer.setSize(innerWidth,innerHeight);});
 const sceneWarmup=new SceneWarmup(renderer,scene,camera,value=>{scenePreparing=value;resetFrameClock=true;if(value)clear();});
 // The permanent vehicle spotlight contributes to the shader light count,
 // including while its intensity is zero and no ride has been selected.
 const headlamp=new VehicleHeadlamp(scene);
 status('Preparing stable sky reflections');await world.sky.prepareReflections(camera,core.current.x,core.current.z);
 status('Preparing your rider');
 const [rider,wheel]=await Promise.all([
  loader.loadAsync('./exports/rigged-heroes/DS_Armored_Rider_01.glb'),
  loader.loadAsync('./exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'),
  Promise.resolve().then(()=>sceneWarmup.primeIsland())
 ]);
 const hero=new ThreeRiderView(rider,wheel,terrain,{...HUMAN_PROFILE,id:'DS_Armored_Rider_01'});scene.add(hero.root);applyRealisticMaterials(hero.root,'actor');if(REFERENCE_STYLE){animeRider(hero.rider);glowVehicle(hero.vehicle,'wheel');}hero.apply(core.current);
 // The first acceleration uses the fitted riding rig, including its skinned
 // boot soles. Prepare it once while the loading screen owns the frame.
 status('Fitting your rider');await yieldStartupTask();prepareOnFootRider(hero);
 if(REFERENCE_STYLE){batchArmoredInk(hero.rider,hero.root);batchHelmetDecals(hero.rider,hero.root);}
 batchWheelDisplay(hero.vehicle,hero.root,wheel.animations);
 const remoteRiders=new OnlineRiders(scene,terrain,rider,wheel,async model=>{await warmObjectTextures(renderer,model);await renderer.compileAsync(model,camera,scene);});
 let savedSoloSky:typeof world.sky.settings|undefined;
 void import('./onlineRooms.ts').then(({BelleOnlineRooms})=>{online=new BelleOnlineRooms({race:(sender,message)=>race?.receive(sender,message),raceOpen:()=>race?.open(),clear:()=>{clear();release();core.clearPendingActions();},ride:()=>{if(!active)start.click();},sky:()=>world.sky.settings,syncSky:s=>{savedSoloSky??=world.sky.settings;world.sky.synchronize(s);},localSky:()=>{if(savedSoloSky){world.sky.configure(savedSoloSky);savedSoloSky=undefined;}},skyHost:host=>{document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.sky-settings input,.sky-settings select').forEach(e=>e.disabled=!host);el('sky-room-note').textContent=online?.online?(host?'You control the shared room sky.':'Time and clouds follow the room host.'):'Time pauses with solo play. Online rooms share the host’s sky.';},follow:p=>{for(const d of [4,7,11,18])for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=p.x+Math.sin(a)*d,z=p.z+Math.cos(a)*d;if(terrain.land(x,z)&&!terrain.obstructed(x,z,1.5)){jump(x,z,Math.atan2(p.x-x,p.z-z));return;}}}});}).catch(error=>{console.warn('Multiplayer unavailable',error);for(const id of ['friends-open','welcome-friends'])el(id).textContent='Multiplayer unavailable · reload';});
 const destinations=[...data.landmarks,...data.pois.filter(p=>!data.landmarks.some(l=>l.id===p.id))];let destination:ParkMap['landmarks'][number]|undefined;const routepoints=data.roads.flatMap(r=>r.points.slice(1).flatMap((b,i)=>{const a=r.points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));return Array.from({length:steps},(_,j)=>[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps] as [number,number]);})).filter(p=>terrain.land(p[0],p[1])&&!terrain.obstructed(p[0],p[1],2));let snap=true;const vrPlaces:{label:string;go:()=>void}[]=[];
 function jump(x:number,z:number,headingY:number){golf?.stop();trials?.interrupt();activities?.relocated();fishing?.stop();slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();clear();core.reset({position:{x,y:terrain.height(x,z),z},headingY});cameraYaw=0;cameraPitch=.1;snap=true;vr?.relocated();}
 hover=new HoverRide(scene,terrain,{nightAmount:()=>world.sky.nightAmount.value,prepareScene:(model,signal)=>sceneWarmup.prepare(model,signal),obstacle:world.trafficRay,vehicleLocked:()=>!!trials?.active,restartTrial:()=>trials?.restart(),pose:()=>core.current,blocked:()=>!!cadillac?.riding||inputCaptureBlocked()||!!photo?.active||!!slide?.active||!!boat?.riding,touch:()=>touch.checked,entered:()=>{clear();release();cameraYaw=0;cameraPitch=.1;snap=true;zone.hidden=true;canvas.focus();},exited:p=>{clear();core.reset({position:{x:p.x,y:p.y,z:p.z},headingY:p.heading});core.advance(1/60,{dismount:true});cameraYaw=0;snap=true;zone.hidden=!touch.checked;canvas.focus();}},headlamp);
  startup.bindVehicles(wheel.scene,async()=>{const vehicle=await hover!.preparePreview(scene);if(!vehicle)throw new Error('Hoverbike preview unavailable');return vehicle;});
 const home=document.createElement('button');home.type='button';home.id='main-menu-return';home.textContent='Main menu';document.querySelector('#ride-menu nav')!.append(home);
 home.onclick=()=>{photo?.close();trials?.interrupt();activities?.interrupt('Returned to the main menu. Saved records are kept.');coop?.stop();race?.stop();fishing?.stop();golf?.stop();slide?.cancel();cadillac?.leave();hover?.leaveForTravel();boat?.leave();void online?.leave();clear();document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());active=false;paused=false;world.sky.preview(!SUNSET_REFERENCE);el('ridehud').hidden=true;el('navigation').hidden=true;zone.hidden=true;startup.show();};
 slide=new GiantSlideRide(core,hero,scene,()=>{clear();release();first=false;cameraYaw=0;cameraPitch=.1;snap=true;canvas.focus();});
 const companion=new ParkCompanion(scene,terrain);let photoSaved={first:false,yaw:0,pitch:.1};let photoWasActive=false;
 let boatReturn={x:data.spawn.x,z:data.spawn.z,headingY:data.spawn.heading};
 const boatAssets=await Promise.all([loader.loadAsync('./belle/vehicles/speedboat.glb'),loader.loadAsync('./belle/vehicles/hydroplane.glb')]);
 boat=new BoatRide(scene,terrain,hero.rider,{allowed:()=>!cadillac?.riding&&!blocked()&&!photo?.active,night:()=>world.sky.nightAmount.value,enter:()=>{boatReturn={x:core.current.x,z:core.current.z,headingY:core.current.headingY};cadillac?.leave();hover?.leaveForTravel();clear();release();cameraYaw=0;cameraPitch=.1;snap=true;},exit:()=>{jump(boatReturn.x,boatReturn.z,boatReturn.headingY);canvas.focus();}},{offshore:boatAssets[0].scene,hydroplane:boatAssets[1].scene},world.trafficRay);
 const radio=new RideRadio(canvas);hover.setRadio(radio,canvas);
 photo=new Photography(scene,canvas,hero.rider,()=>{if(photo?.active)trials?.interrupt();clear();release();if(photo?.active&&!photoWasActive){photoSaved={first,yaw:cameraYaw,pitch:cameraPitch};first=true;}else if(!photo?.active&&photoWasActive){first=photoSaved.first;cameraYaw=photoSaved.yaw;cameraPitch=photoSaved.pitch;}photoWasActive=!!photo?.active;snap=true;},()=>mixGameAudio([natureAudio.capture(),hover?.captureAudio(),trials?.captureAudio(),radio.capture()]));
 let fishingSaved={first,yaw:cameraYaw,pitch:cameraPitch};
 fishing=new Fishing(scene,data,{allowed:()=>active&&!paused&&!vr?.active&&!online?.inputBlocked&&!document.querySelector('dialog[open]'),travel:spot=>{activities?.interrupt('Activity ended when fishing started. Your saved records are kept.');fishingSaved={first,yaw:cameraYaw,pitch:cameraPitch};jump(...spot.stand,Math.atan2(spot.cast[0]-spot.stand[0],spot.cast[1]-spot.stand[1]));core.advance(1/60,{dismount:true});first=true;cameraPitch=.10;snap=true;},leave:()=>{first=fishingSaved.first;cameraYaw=fishingSaved.yaw;cameraPitch=fishingSaved.pitch;snap=true;clear();}});
 let golfSaved={first,yaw:cameraYaw,pitch:cameraPitch};
 golf=new Golf(scene,{playable:(x,z)=>terrain.land(x,z)&&!terrain.obstructed(x,z,.1),allowed:()=>active&&!paused&&!vr?.active&&!race?.active&&!fishing?.active&&!online?.inputBlocked&&!document.querySelector('dialog[open]'),travel:hole=>{destination=data.landmarks.find(l=>l.id===golfCenter.id);if(!golf?.active){golfSaved={first,yaw:cameraYaw,pitch:cameraPitch};slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();clear();release();}core.reset({position:{x:hole.tee[0],y:terrain.height(...hole.tee),z:hole.tee[1]},headingY:Math.atan2(hole.cup[0]-hole.tee[0],hole.cup[1]-hole.tee[1])});core.advance(1/60,{dismount:true});snap=true;},leave:()=>{first=golfSaved.first;cameraYaw=golfSaved.yaw;cameraPitch=golfSaved.pitch;snap=true;clear();}});
 race=new IslandRace(scene,terrain,data,core,hero,rider,wheel,{online:()=>online,clear,blocked:()=>paused||document.hidden||!!online?.inputBlocked||!!document.querySelector('dialog[open]'),activate:()=>{trials?.interrupt();activities?.interrupt('Activity ended when the race started. Your saved records are kept.');fishing?.stop();slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();clear();document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());startup.leave(()=>{});active=true;paused=false;world.sky.preview(false);el('ridehud').hidden=false;el('navigation').hidden=false;zone.hidden=!touch.checked;first=false;cameraYaw=0;cameraPitch=.1;snap=true;},leave:()=>{clear();snap=true;cameraYaw=0;cameraPitch=.1;canvas.focus();}});
 photo.rig.userData.photoQuestIgnore=true;photo.carried.userData.photoQuestIgnore=true;hero.root.userData.photoQuestIgnore=true;
 activities=new IslandActivities(scene,data,terrain,camera,canvas,photo.capture,{
  clear,ready:()=>active||!start.disabled,
  available:()=>!trials?.active&&!vr?.active&&!race?.active&&!fishing?.active&&!slide?.active,
  running:()=>active&&!paused&&!document.hidden&&!trials?.active&&!vr?.active&&!race?.active&&!fishing?.active&&!slide?.active&&!online?.inputBlocked&&!document.querySelector('dialog[open]'),
  start:()=>{if(!active)start.click();if(paused){paused=false;el('pause').textContent='Pause';}clear();canvas.focus();},
  openCamera:()=>photo?.capture.setActive(true),closeCamera:()=>photo?.close(),
  navigate:point=>{destination=point;}
 });
 function syncTrialControls(){
  const inTrial=!!trials?.active,recovery=el<HTMLButtonElement>('recover');
  recovery.querySelector('span')!.textContent=inTrial?'Restart':'Recover';
  recovery.setAttribute('aria-label',inTrial?'Restart time trial (R)':'Recover rider (R)');
  el('hint').textContent=inTrial?'WASD / arrows · R restart · V view · Follow numbered checkpoints':'WASD / arrows · F ride or walk · V view · R recover';
  el<HTMLButtonElement>('mount').disabled=inTrial||!!slide?.active;
  el<HTMLButtonElement>('hover-enter').disabled=inTrial||!!slide?.active;
 }
 trials=new IslandTrials(scene,data,terrain,canvas,{
  ready:()=>active||!start.disabled,
  available:()=>!vr?.active&&!race?.active&&!fishing?.active&&!slide?.active,
  running:()=>active&&!paused&&!document.hidden&&renderFocused&&!vr?.active&&!race?.active&&!fishing?.active&&!slide?.active&&!online?.inputBlocked&&!document.querySelector('dialog[open]'),
  reducedMotion:()=>reduced,
  clear,
  prepare:async(course,signal)=>{
   if(signal.aborted||vr?.active||starting)return false;
   activities?.interrupt('Activity ended when the time trial started. Your records are saved.');
   race?.stop();fishing?.stop();slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();clear();
   document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());
   await online?.leave();if(signal.aborted)return false;
   if(course.vehicle==='hoverbike'){await hover!.selectVehicle({vehicle:'hoverbike',camera:'tpp'},scene,signal);await hover!.prepare(scene,true,signal);if(signal.aborted)return false;}
   startup.leave(()=>{});active=true;paused=false;el('pause').textContent='Pause';world.sky.preview(false);
   destination=undefined;chooseView(false);cameraYaw=0;cameraPitch=.1;snap=true;
   core.reset({position:{x:course.start.x,y:terrain.height(course.start.x,course.start.z),z:course.start.z},headingY:course.start.heading});
   el('speed').innerHTML='0 <small>KM/H</small>';hud?.mode(false);
   el('ridehud').hidden=false;el('navigation').hidden=false;zone.hidden=!touch.checked;
   const placed=course.vehicle==='onewheel'||hover!.beginTrial(course.start);
   syncTrialControls();canvas.focus();return placed;
  },
  leave:()=>{clear();hover?.endTrial();syncTrialControls();snap=true;canvas.focus();}
 });
 coop=new CoopSession(scene,terrain,wheel,{
  available:()=>!vr?.active&&!scenePreparing&&(active||!start.disabled),
  anchor:()=>({x:core.current.x,y:core.current.y,z:core.current.z,heading:core.current.headingY}),
  blocked:()=>paused||document.hidden||!renderFocused||!!online?.inputBlocked||!!document.querySelector('dialog[open]:not(#coop-setup)'),
  prepare:async(root,signal)=>{const shadows=renderer.shadowMap.enabled;if(root.children.length>=3)renderer.shadowMap.enabled=false;try{await world.prepareSplitDetail();const batchRoot=world.splitBatchRoot();if(batchRoot)await sceneWarmup.prepare(batchRoot,signal);await sceneWarmup.prepare(root,signal);}finally{renderer.shadowMap.enabled=shadows;}},
  activate:async()=>{
   await online?.leave();trials?.interrupt();race?.stop();activities?.interrupt('Solo activity paused for local co-op. Saved records are unchanged.');fishing?.stop();slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();clear();
   document.querySelectorAll<HTMLDialogElement>('dialog[open]:not(#coop-setup)').forEach(d=>d.close());
   startup.leave(()=>{});active=true;paused=false;el('pause').textContent='Pause';world.sky.preview(false);world.sky.protectStartup();startupMetrics.begin('coop');hero.root.visible=false;first=false;snap=true;
  },
  leave:()=>{hero.root.visible=true;el('ridehud').hidden=false;el('navigation').hidden=false;zone.hidden=!touch.checked;paused=false;el('pause').textContent='Pause';clear();snap=true;cameraYaw=0;cameraPitch=.1;world.sky.protectStartup();startupMetrics.begin('solo');canvas.focus();}
 });

 hud?.collectTools();
 // Mapped Guide views only: camera locations are derived from existing dry
 // bank/paths, never synthetic bridge geometry or rewritten collision data.
 const scenicRoute=(x:number,z:number)=>{
  const candidates=routepoints.map(p=>({p,d:Math.hypot(p[0]-x,p[1]-z)}))
   .filter(v=>v.d>=13&&v.d<=48&&!terrain.obstructed(v.p[0],v.p[1],1.2))
   .sort((a,b)=>Math.abs(a.d-23)-Math.abs(b.d-23));
  return candidates[0]?.p;
 };
 const scenicCard=(name:string,description:string,x:number,z:number,buttonName:string,view?:{x:number;z:number;pitch?:number})=>{
  const p=view?[view.x,view.z] as [number,number]:scenicRoute(x,z);if(!p)return;
  const card=document.createElement('article');card.className='landmark';card.dataset.kind='trail';card.dataset.search=name.toLowerCase();
  const title=document.createElement('h3');title.textContent=name;
  const note=document.createElement('p');note.textContent=description;
  const visit=document.createElement('button');visit.type='button';visit.textContent=buttonName;
  visit.onclick=()=>{
   if(!terrain.land(p[0],p[1])||terrain.obstructed(p[0],p[1],1.2))return;
   destination=undefined;
   jump(p[0],p[1],Math.atan2(x-p[0],z-p[1]));
   core.advance(1/60,{dismount:true,instantDismount:true});
   first=true;cameraPitch=view?.pitch??.035;el<HTMLDialogElement>('guide').close();
   if(!active)start.click();
  };
  card.append(title,note,visit);el('landmarks').append(card);
 };
 const casinoViews=planCasinoWayViews(data,terrain);
 if(casinoViews?.side){const v=casinoViews.side;
  scenicCard('Casino Way Bridge · bank side','Historic red bridge railing from a dry bank. Source: '+CASINO_WAY_REFERENCE.source,v.lookX,v.lookZ,'Visit red bridge',v);
 }
 if(casinoViews?.context){const v=casinoViews.context;
  scenicCard('Casino Way Bridge · Casino context','Separate wider mapped bridge and Casino context view.',v.lookX,v.lookZ,'Visit Casino context',v);
 }
 const sylvanCanal=data.pois.find(p=>p.name==='Sylvan Canal');
 if(sylvanCanal)scenicCard('Sylvan Canal · wooded banks','Real mapped wooded canal and water edge.',sylvanCanal.x,sylvanCanal.z,'Visit canal view');
 const shallowView=planShallowWaterInspection(data,terrain);
 if(shallowView)scenicCard('Lagoon · submerged stone bed',
  'Look down from the mapped dry bank at submerged limestone, lagoon sediment and shallow-water transparency.',
  shallowView.lookX,shallowView.lookZ,'Inspect shallow water',shallowView);
 const bridgeCard=document.createElement('article');bridgeCard.className='landmark';bridgeCard.dataset.kind='attraction';bridgeCard.dataset.search='ambassador bridge sunset point photography overlook';bridgeCard.innerHTML='<h3>Ambassador Bridge overlook</h3><p>Look downriver from Sunset Point. Try the 85 mm or 135 mm lens, then switch to dusk for the bridge lights.</p><button type="button">Visit bridge overlook</button>';bridgeCard.querySelector('button')!.onclick=()=>{jump(bridgeOverlook.x,bridgeOverlook.z,bridgeOverlook.heading);core.advance(1/60,{dismount:true});first=true;cameraPitch=-.012;el<HTMLDialogElement>('guide').close();if(!active)start.click();};el('landmarks').append(bridgeCard);
 el('restart').onclick=()=>{destination=undefined;first=false;jump(data.spawn.x,data.spawn.z,data.spawn.heading);el<HTMLDialogElement>('settings').close();};
 async function visitYachtClub(landmark:Landmark,button:HTMLButtonElement){
  const guide=el<HTMLDialogElement>('guide');
  const pending=new AbortController();
  guide.addEventListener('close',()=>pending.abort(),{once:true,signal:pending.signal});
  button.disabled=true;
  button.textContent='Loading Yacht Club…';
  try{
   await world.prepareYachtClub(camera);
   if(pending.signal.aborted||!guide.open)return;
   const approach=yachtWorld(...YACHT.approach as [number,number]);
   const entry=yachtWorld(...YACHT.entry as [number,number]);
   destination=landmark;
   jump(approach.x,approach.z,Math.atan2(entry.x-approach.x,entry.z-approach.z));
   first=false;
   guide.close();
   if(!active)start.click();
  }catch(error){
   button.textContent='Retry Yacht Club';
   console.warn('Yacht Club travel unavailable',error);
  }finally{
   pending.abort();
   button.disabled=false;
   if(button.textContent==='Loading Yacht Club…')button.textContent='Travel to path';
  }
 }
 const showcaseTravel=new Map<string,HTMLButtonElement>();
 for(const lm of destinations){const c=document.createElement('article');c.className='landmark';c.dataset.kind=['659605208','107208288'].includes(lm.id)?'monument':lm.kind;c.dataset.search=lm.name.toLowerCase();const h=document.createElement('h3');h.textContent=lm.name;const go=document.createElement('button');go.textContent='Navigate';go.onclick=()=>{destination=lm;el<HTMLDialogElement>('guide').close();};const travel=document.createElement('button');travel.textContent=data.facilities?.sites.some(s=>s.id===lm.id)?'Travel nearby':'Travel to path';travel.onclick=()=>{if(lm.id===coastGuardLayout.id){const p=coastGuardLayout.view,q=coastGuardLayout.look;destination=lm;jump(p[0],p[1],Math.atan2(q[0]-p[0],q[1]-p[1]));first=true;cameraPitch=.02;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}if(lm.id==='belle-floral-clock'){const p=clockWorld(0,-23);if(terrain.land(...p)&&!terrain.obstructed(...p,1)){destination=lm;jump(...p,floralClock.heading);first=true;cameraPitch=.04;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}}if(lm.id===GIANT_SLIDE.id){destination=lm;jump(SLIDE_ENTRY.x,SLIDE_ENTRY.z,SLIDE_HEADING+Math.PI);first=false;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const play=playgrounds.find(p=>p.id===lm.id);if(play&&!terrain.obstructed(play.view[0],play.view[1],1)&&terrain.land(play.view[0],play.view[1])){destination=lm;jump(play.view[0],play.view[1],Math.atan2(play.look[0]-play.view[0],play.look[1]-play.view[1]));first=false;cameraPitch=-.12;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const architecture=referenceArchitecture.find(a=>a.id===lm.id&&a.view);if(architecture?.view&&architecture.look&&!terrain.obstructed(architecture.view[0],architecture.view[1],2)&&terrain.land(architecture.view[0],architecture.view[1])){destination=lm;jump(architecture.view[0],architecture.view[1],Math.atan2(architecture.look[0]-architecture.view[0],architecture.look[1]-architecture.view[1]));first=false;cameraPitch=-.3;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}if(lm.id===golfCenter.id){const [x,z]=golfCenter.approach,[tx,tz]=golfCenter.entry;if(!terrain.land(x,z)||terrain.obstructed(x,z,1))return;destination=lm;jump(x,z,Math.atan2(tx-x,tz-z));first=false;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}if(lm.id===YACHT.id){void visitYachtClub(lm,travel);return;}if(lm.id==='762688416'&&terrain.land(1337,1156)&&!terrain.obstructed(1337,1156,.6)){destination=lm;jump(1337,1156,Math.PI);first=true;cameraPitch=.55;el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const lake=[data.lakeHabitat,data.lagoonHabitat].find(l=>l?.id===lm.id);if(lake&&terrain.land(...lake.view)&&!terrain.obstructed(...lake.view,1)){destination=lm;jump(...lake.view,Math.atan2(lake.look[0]-lake.view[0],lake.look[1]-lake.view[1]));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const house=data.historicHouses?.find(h=>h.id===lm.id);if(house&&!terrain.obstructed(...house.view,1)){destination=lm;jump(...house.view,Math.atan2(house.look[0]-house.view[0],house.look[1]-house.view[1]));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const facility=data.facilities?.sites.find(s=>s.id===lm.id);if(facility){const near=routepoints.reduce((a,b)=>Math.hypot(a[0]-lm.x,a[1]-lm.z)<Math.hypot(b[0]-lm.x,b[1]-lm.z)?a:b),angle=Math.atan2(near[0]-lm.x,near[1]-lm.z);let point:[number,number]|undefined;for(let r=13;r<=45&&!point;r+=4)for(const da of [0,.35,-.35,.7,-.7,1.3,-1.3,Math.PI]){const p:[number,number]=[lm.x+Math.sin(angle+da)*r,lm.z+Math.cos(angle+da)*r];if(terrain.land(...p)&&!terrain.obstructed(...p,2.4)&&!inside(p[0],p[1],facility.points)){point=p;break;}}if(point){destination=lm;jump(point[0],point[1],Math.atan2(lm.x-point[0],lm.z-point[1]));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}}if(data.dossin&&lm.id===data.dossin.id){const cfg=data.dossin,p=dossinWorld(cfg,...cfg.approach as [number,number]),q=dossinWorld(cfg,...cfg.entry as [number,number]);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}if(data.aquarium&&lm.id===data.aquarium.id){const cfg=data.aquarium,p=aquariumWorld(cfg,...cfg.approach as [number,number]),q=aquariumWorld(cfg,0,0);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}if(data.conservatory&&lm.id===data.conservatory.id){const c=data.conservatory,p=greenhouseWorld(c,c.approach[0],c.approach[1]),q=greenhouseWorld(c,0,0);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));el<HTMLDialogElement>('guide').close();if(!active)start.click();return;}const skylineView=lm.name==='Sunset Point',bridgeView=lm.id==='macarthur-overlook';const viewDistance=lm.viewDistance??(lm.kind==='entrance'?16:lm.kind==='water'?14:bridgeView?0:skylineView||lm.kind==='landscape'?20:lm.id==='107192915'?100:65);const facing=lm.model?[Math.sin(lm.yaw||0),Math.cos(lm.yaw||0)]:lm.kind==='entrance'?[.819,-.574]:lm.id==='107227742'?[-.288,-.958]:lm.id==='107310050'?[-.999,-.035]:lm.id==='107205459'?[-.334,-.943]:lm.id==='106948123'?[.223,-.975]:lm.id==='107192915'?[-.75,-.66]:lm.id==='106966327'?[0,-1]:lm.id==='264321737'?[-.8,.6]:lm.id==='368859182'?[-.7,.7]:null;const score=(p:[number,number])=>{const dx=p[0]-lm.x,dz=p[1]-lm.z,d=Math.hypot(dx,dz);return Math.abs(d-viewDistance)+(facing?(1-(dx*facing[0]+dz*facing[1])/Math.max(1,d))*45:0);};const candidates=routepoints.slice().sort((a,b)=>score(a)-score(b)).slice(0,80);const p=candidates.find(p=>!data.buildings.some(b=>b.id!==lm.id&&Array.from({length:12},(_,i)=>(i+1)/13).some(t=>inside(p[0]+(lm.x-p[0])*t,p[1]+(lm.z-p[1])*t,b.points))))||candidates[0];destination=lm;jump(p[0],p[1],Math.atan2((bridgeView?(data.bridge.a[0]+data.bridge.b[0])*.5:skylineView?-3127:lm.x)-p[0],(bridgeView?(data.bridge.a[1]+data.bridge.b[1])*.5:skylineView?1983:lm.z)-p[1]));el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(h);if(lm.description){const note=document.createElement('p');note.textContent=lm.description;c.append(note);}if(lm.reference){const ref=document.createElement('a');ref.href=lm.reference;ref.textContent='Landmark reference ↗';ref.target='_blank';ref.rel='noopener noreferrer';c.append(ref);}if(lm.indoor){travel.textContent='Travel to exterior path';}if(lm.id==='368859182'){const note=document.createElement('p');note.textContent='Nature play: eagle-nest sandbox, pebble harp and hollow-log exploration.';const source=document.createElement('a');source.href='https://belleislenaturecenter.org/attraction/nature-play-area/';source.textContent='Official Nature Play Area guide';source.target='_blank';source.rel='noopener noreferrer';c.append(note,source);}if(lm.id===GIANT_SLIDE.id){travel.textContent='Go to slide stairs';const note=document.createElement('p');note.textContent='Stop at the right-hand stairs and select Climb Giant Slide (E). Your wheel stays below. At the top, choose Slide down. Recover (R) returns you safely.';c.append(note);}c.append(go,travel);const sportVisit=activityVisit(lm.id);if(sportVisit){const walk=document.createElement('button');walk.textContent=sportVisit.label;walk.onclick=()=>{const p=sportVisit.point;if(!terrain.land(...p)||terrain.obstructed(...p,.5))return;destination=lm;jump(...p,sportVisit.heading);core.advance(1/60,{dismount:true});first=true;cameraPitch=.12;el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(walk);}appendLandmarkSources(c,lm.id);if(lm.id===golfCenter.id){travel.textContent='Travel to clubhouse';const note=document.createElement('p');note.textContent='Low clubhouse and open driving range with 30 hitting stations. Reconstructed from the mapped footprint and official aerial photos; fine facade details are approximate.';const ref=document.createElement('a');ref.href=golfCenter.source;ref.target='_blank';ref.rel='noopener noreferrer';ref.textContent='Official Golf Center reference ↗';c.append(note,ref);}if(lm.id===YACHT.id){travel.textContent='Travel to club entrance';const note=document.createElement('p');note.textContent='Photo-guided Mediterranean clubhouse: tiled harbor passage, grand stairs, timber hall and marina. Interior layout is an interpretation of public photographs.';c.append(note);for(const mode of ['inside','marina'] as const){const enter=document.createElement('button');enter.textContent=mode==='inside'?'Explore Yacht Club on foot':'Visit marina';enter.onclick=()=>{const p=yachtWorld(...(mode==='inside'?[-7.5,0]:YACHT.harborView) as [number,number]),q=yachtWorld(mode==='inside'?-29:-7,mode==='inside'?0:-65);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));core.advance(1/60,{dismount:true});first=true;cameraPitch=.05;el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);vrPlaces.unshift({label:'Yacht Club · '+mode,go:()=>enter.click()});}}if(lm.id==='6179290151'){const enter=document.createElement('button');enter.textContent='Visit fountain on foot';enter.onclick=()=>{const [x,z]=TEMPERANCE_VIEW;if(!terrain.land(x,z)||terrain.obstructed(x,z,.5))return;destination=lm;jump(x,z,Math.atan2(lm.x-x,lm.z-z));core.advance(1/60,{dismount:true});first=true;cameraPitch=.25;el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);}if(data.dossin&&lm.id===data.dossin.id){travel.textContent='Travel to entrance';const enter=document.createElement('button');enter.textContent='Explore museum on foot';enter.onclick=()=>{const cfg=data.dossin!,p=dossinWorld(cfg,...cfg.entry as [number,number]),q=dossinWorld(cfg,-5,0);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));core.advance(1/60,{dismount:true});first=true;el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);vrPlaces.unshift({label:'Dossin Museum · explore inside on foot',go:()=>enter.click()});}if(data.aquarium&&lm.id===data.aquarium.id){travel.textContent='Travel to entrance';const enter=document.createElement('button');enter.textContent='Explore aquarium on foot';enter.onclick=()=>{const cfg=data.aquarium!,p=aquariumWorld(cfg,0,-33),q=aquariumWorld(cfg,0,-20);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));core.advance(1/60,{dismount:true});first=true;el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);}if(lm.id==='368854132'){const enter=document.createElement('button');enter.textContent='Walk onto the beach';enter.onclick=()=>{destination=lm;jump(1949,184,Math.atan2(-3127-1949,1983-184));core.advance(1/60,{dismount:true,instantDismount:true});chooseView(true);el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);}if(data.conservatory&&lm.id===data.conservatory.id){const enter=document.createElement('button');enter.textContent='Explore Palm House on foot';enter.onclick=()=>{const cfg=data.conservatory!,p=greenhouseWorld(cfg,-8.5,0),q=greenhouseWorld(cfg,0,0);destination=lm;jump(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z));core.advance(1/60,{dismount:true});el<HTMLDialogElement>('guide').close();if(!active)start.click();};c.append(enter);}vrPlaces.push({label:lm.name,go:()=>travel.click()});if(data.aquarium&&lm.id===data.aquarium.id)vrPlaces.unshift({label:'Aquarium · explore inside on foot',go:()=>c.querySelectorAll<HTMLButtonElement>('button')[2].click()});if(data.conservatory&&lm.id===data.conservatory.id)vrPlaces.unshift({label:'Conservatory · explore inside on foot',go:()=>c.querySelectorAll<HTMLButtonElement>('button')[2].click()});showcaseTravel.set(lm.id,travel);el('landmarks').append(c);}
 const showcaseList=el<HTMLOListElement>('showcase-stops');
 for(const stop of resolveShowcaseStops(data)){
  const item=document.createElement('li');
  const label=document.createElement('strong');label.textContent=stop.name;
  const desc=document.createElement('p');desc.textContent=stop.focus;
  const visit=document.createElement('button');visit.type='button';visit.dataset.showcaseStop=stop.id;
  visit.textContent='Travel to '+stop.name;
  visit.onclick=()=>showcaseTravel.get(stop.destinationId)?.click();
  item.append(label,desc,visit);showcaseList.append(item);
 }
 const environmentZoneList=el<HTMLDivElement>('environment-zones');
 for(const zone of resolveEnvironmentZones(data)){
  const group=document.createElement('section');group.className='environment-zone';group.dataset.zone=zone.id;
  const heading=document.createElement('h4');heading.textContent=zone.name;
  const description=document.createElement('p');description.textContent=zone.theme;
  const stops=document.createElement('ol');
  for(const stop of zone.stops){
   const entry=document.createElement('li'),button=document.createElement('button');
   button.type='button';button.dataset.zoneStop=stop.id;button.textContent='Travel to '+stop.destinationName;
   button.onclick=()=>showcaseTravel.get(stop.destinationId)?.click();
   const detail=document.createElement('small');detail.textContent=stop.focus;
   entry.append(button,detail);stops.append(entry);
  }
  group.append(heading,description,stops);environmentZoneList.append(group);
 }
 for(const [value,label]of [['sports','Courts & ballfields'],['trail','Trails']]){const option=document.createElement('option');option.value=value;option.textContent=label;el('guide-category').append(option);}
 const filterGuide=()=>{const query=el<HTMLInputElement>('guide-search').value.trim().toLowerCase(),kind=el<HTMLSelectElement>('guide-category').value;let shown=0;document.querySelectorAll<HTMLElement>('#landmarks .landmark').forEach(c=>{c.hidden=!(c.dataset.search!.includes(query)&&(kind==='all'||c.dataset.kind===kind));if(!c.hidden)shown++;});el('guide-count').textContent=shown+' places';};el('guide-search').oninput=filterGuide;el('guide-category').onchange=filterGuide;filterGuide();
 const firstRide=createFirstRideObjective(destinations,data.spawn,target=>{if(destination===target)destination=undefined;});
 const referenceHud=REFERENCE_STYLE?createReferenceHud(data):undefined;
 const minimap=el<HTMLCanvasElement>('minimap'),navigation=el('navigation'),ctx=minimap.getContext('2d')!;
 const px=(x:number)=>(x+600)/4700*420,pz=(z:number)=>(z+700)/2700*290;
 const mapLayer=document.createElement('canvas');mapLayer.width=minimap.width;mapLayer.height=minimap.height;
 const baseCtx=mapLayer.getContext('2d')!;
 let mapLayerOpacity=-1;
 function drawMapLayer(alpha:number){
  baseCtx.clearRect(0,0,mapLayer.width,mapLayer.height);baseCtx.globalAlpha=alpha;
  baseCtx.fillStyle='#143f47';baseCtx.fillRect(0,0,420,290);
  function path(points:[number,number][]){
   baseCtx.beginPath();points.forEach((p,i)=>i?baseCtx.lineTo(px(p[0]),pz(p[1])):baseCtx.moveTo(px(p[0]),pz(p[1])));
  }
  function polygon(points:[number,number][],color:string){
   path(points);baseCtx.closePath();baseCtx.fillStyle=color;baseCtx.fill();
  }
  polygon(data.island,'#506b4b');
  for(const i of data.outerIslets||[])polygon(i.points,'#506b4b');
  for(const w of data.water){polygon(w.points,'#214951');for(const h of w.holes)polygon(h,'#506b4b');}
  baseCtx.strokeStyle='#b8c3a3';baseCtx.lineWidth=1;
  for(const r of data.roads){if(!r.foot){path(r.points);baseCtx.stroke();}}
  baseCtx.strokeStyle='#c3c98e';baseCtx.lineWidth=.65;baseCtx.setLineDash([2,2]);
  for(const r of data.roads){if(r.foot&&['path','track','cycleway'].includes(r.highway||'')){path(r.points);baseCtx.stroke();}}
  baseCtx.setLineDash([]);mapLayerOpacity=alpha;
 }
 function drawMap(x:number,z:number,heading:number){
  if(navigation.hidden||minimap.hidden)return;
  const alpha=Number(opacity.value);
  if(mapLayerOpacity!==alpha)drawMapLayer(alpha);
  ctx.clearRect(0,0,420,290);ctx.drawImage(mapLayer,0,0);
  ctx.strokeStyle='#c3c98e';ctx.lineWidth=.65;
  for(const l of data.landmarks){ctx.fillStyle=l===destination?'#ffd98b':l.kind==='monument'?'#96e7dc':'#e8deaa';ctx.beginPath();ctx.arc(px(l.x),pz(l.z),l===destination?4:2,0,Math.PI*2);ctx.fill();}for(const [i,m]of (online?.members??[]).entries()){if(m.id===online?.self)continue;const p=online?.buffers.get(m.id)?.sample(performance.now());if(!p)continue;ctx.fillStyle=PLAYER_COLORS[i];ctx.strokeStyle='#10252c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(p.pose.x),pz(p.pose.z),4,0,Math.PI*2);ctx.fill();ctx.stroke();}race?.drawMap(ctx,px,pz);activities?.drawMap(ctx,px,pz);ctx.save();ctx.translate(px(x),pz(z));ctx.rotate(-heading);ctx.fillStyle='#a5fff0';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-4,-4);ctx.lineTo(4,-4);ctx.fill();ctx.restore();ctx.fillStyle='#f2f4e6';ctx.font='12px system-ui';ctx.fillText('N ↑',10,18);}
 status('Warming up island lighting');await sceneWarmup.prepare();status('Preparing the first frame');let prepared=false,starting=false;start.onclick=async()=>{if(starting||!prepared)return;starting=true;const choice=startup.choice;natureAudio.unlock();clear();startup.preparing();try{if(choice.vehicle==='cadillac'){if(!cadillac){cadillac=new CadillacRide((await cadillacModel()).clone(true),terrain);scene.add(cadillac.model);}cadillac.start();}else if(choice.vehicle!=='onewheel'){await hover!.selectVehicle(choice,scene);await hover!.prepare(scene,true);}startup.leave(()=>{world.sky.preview(false);world.sky.protectStartup();startupMetrics.begin('solo');active=true;paused=false;destination??=firstRide.begin(destination);chooseView(choice.camera==='fpp');el('ridehud').hidden=false;el('navigation').hidden=false;zone.hidden=!touch.checked;snap=true;canvas.focus();vr?.refresh();if(choice.vehicle==='cadillac'){if(choice.camera==='tpp')cameraYaw=.60;starting=false;if(cadillacDiagnostic)rideProfile?.start();}else if(choice.vehicle!=='onewheel')void hover!.mount(scene).finally(()=>{starting=false;});else starting=false;});}catch(error){starting=false;startup.retryRide('Your ride could not load. Try again, or choose the other vehicle.');console.warn('Selected ride preparation failed',error);}};
 let savedFirst=false,savedQuality='automatic';
 vr=new BelleVR(renderer,scene,camera,terrain,{
  ready:()=>active&&!scenePreparing&&!race?.active&&!trials?.active&&!coop?.active,pose:()=>core.current,places:()=>[{label:'Jefferson Avenue · bridge start',go:()=>el('restart').click()},...vrPlaces],clear:()=>{clear();core.clearPendingActions();},
  enter:()=>{trials?.interrupt();activities?.interrupt('Activities are available in the desktop and touch views. Your records are saved.');fishing?.stop();slide?.cancel();photo?.close();cadillac?.leave();hover?.leaveForTravel();boat?.leave();savedFirst=first;savedQuality=el<HTMLSelectElement>('quality').value;clear();release();document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());paused=false;first=true;zone.hidden=true;world.setQuality('smooth');previous=performance.now();},
  exit:()=>{clear();release();first=savedFirst;paused=true;el('pause').textContent='Resume';world.setQuality(savedQuality);if(savedQuality==='automatic')world.setBudget(frameBudget.scale);zone.hidden=!touch.checked;hero.rider.visible=true;snap=true;previous=performance.now();cameraYaw=0;cameraPitch=.1;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);canvas.focus();}
 });
 const submissionProbe=renderProbe?installRenderSubmissionProbe(renderer,scene):undefined;
 const loopProbe=renderProbe?new ManualLoopProbe():undefined;const loopBinding=loopProbe?attachGpuFramePacingProbe(renderer,loopProbe):undefined;
 const rideProfile=new URLSearchParams(location.search).has('profile')?new RideProfile(()=>({quality:graphics.value,effectiveQuality:world.quality.effective,cap,shadowMappingSupported:renderer.shadowMap.enabled,pixelRatio:renderer.getPixelRatio(),adaptiveScale:frameBudget.scale,world:world.stats,diagnosticReduction:localPerformanceProbe(),vehicle:cadillac?.riding?'silver-cadillac':hover?.riding?hover.vehicle:boat?.riding?'boat':'onewheel',cadillac:cadillac?.riding?cadillac.diagnostics():null,cockpitDisplay:hover?.cockpitDisplayDiagnostics??null}),{shortRideSeconds:cadillacDiagnostic?150:undefined,build:createRideProfileBuildReader(new URLSearchParams(location.search).get('profile')),loopProbe,loopCoverage:()=>loopBinding?.coverage(),gpuPacing:()=>gpuFramePacingDiagnostics(renderer),submissionCoverage:()=>submissionProbe?.coverage(),resetRenderDiagnostics:()=>{renderProbe?.cancelFrame();submissionProbe?.cancelFrame();}}):null;
 let previous=performance.now(),lastUI=0,lastRender=0,clock=0,lastMeasurementEligible=false,activeFrames=0,stalledFrames=0,severeFrames=0,longestFrameMs=0;const samples:number[]=[];const target=new T.Vector3(),desired=new T.Vector3(),forward=new T.Vector3();function frame(now:number,xrFrame?:XRFrame){
 // The authentic MacArthur start frame must be rendered first. Once ready,
 // the software WebGL island freezes behind the open ride picker. Leaving
 // the picker instantly resumes the normal, unmodified world renderer.
 // This is never active in flight, XR, or hardware-accelerated browsers.
 if(pauseSoftwareStartupScene(softwareStartup,prepared,active,document.querySelector<HTMLDetailsElement>('.cinema-ride-picker')?.open===true,!!vr?.active)){
  previous=now;lastMeasurementEligible=false;return;
 }
 if(scenePreparing||(document.hidden&&!vr?.active)){previous=now;lastMeasurementEligible=false;rideProfile?.breakFrameAssociation();return;}if(resetFrameClock){previous=now;lastMeasurementEligible=false;rideProfile?.breakFrameAssociation();resetFrameClock=false;}const overlay=paused||!!document.querySelector('dialog[open]');if(!active||overlay||!renderFocused)rideProfile?.breakFrameAssociation();const frameCap=sceneFrameCap(cap,active,overlay,renderFocused);if(!vr?.active&&now-lastRender<1000/frameCap-.8)return;const measureFrame=active&&!overlay&&renderFocused;const eligibleFrame=measureFrame&&lastMeasurementEligible;lastMeasurementEligible=measureFrame;const cpuStart=performance.now();const elapsed=(now-previous)/1000;previous=now;lastRender=now;clock+=Math.min(elapsed,.1);const dt=Math.min(elapsed,.05);world.sky.observeFrame(elapsed*1000,eligibleFrame&&!coop?.paused);const budgetChanged=graphics.value==='automatic'&&!vr?.active&&frameBudget.sample(elapsed,cap,eligibleFrame);world.sky.tick(dt,!!online?.online||(active&&!paused&&!coop?.paused&&!document.querySelector('dialog[open]')&&(!vr?.active||!vr.suspended)),reduced);
 coop?.refreshAvailability();
 if(coop?.active){
  rideProfile?.breakFrameAssociation();
  if(budgetChanged)world.setBudget(frameBudget.scale);
  const pairPose=coop.update(dt,now,paused||!renderFocused);hero.root.visible=false;
  world.contactVehicle(null);world.waterVehicle(null);companion.update(core.current,0,false,false);if(photo)photo.carried.visible=false;
  coop.render(renderer,world,clock);
  const sounding=!coop.paused&&!paused&&renderFocused&&!document.hidden&&!document.querySelector('dialog[open]');
  belleAudio.update(pairPose,{active:sounding,wheel:false},now);natureAudio.update(pairPose.x,pairPose.z,false,sounding,world.sky.hour);
  startupMetrics.sample(performance.now()-cpuStart,Number(document.getElementById('coop-overlay')?.dataset.drawCalls??renderer.info.render.calls),renderer.info.memory.textures,renderer.info.memory.geometries,renderer.info.programs?.length??0,measureFrame&&!coop.paused);lastMeasurementEligible=measureFrame&&!coop.paused;return;
 }
 race?.update(dt,now);let pose=core.renderPose;const vrActions=vr?.active?vr.poll(xrFrame):null;if(vr?.active){if(!vr.suspended){const input={...vrActions};if(input.recover||input.reset)input.reset=prepareIslandRecovery(core,terrain);const result=core.advance(dt,input);pose=result.pose;vr.consumed(result.steps);}}else if(!cadillac?.riding&&!blocked()&&!photo?.active&&!hover?.riding&&!boat?.riding&&!slide?.active){pose=core.advance(dt,{throttle:hud?.held.has('brake')?(core.current.footBlend>.5?0:brakeThrottle(core.current.speed)):throttle+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer:steer+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),crouch:false,hop,hopHeld:keys.has('Space')||!!hud?.held.has('hop'),reset:recover&&prepareIslandRecovery(core,terrain),trick:0,dismount:mount,recover,run:keys.has('ShiftLeft')||!!hud?.running}).pose;hop=recover=mount=false;}if(cadillac?.riding){
    if(!blocked()&&!photo?.active&&renderFocused){
      if(recover){cadillac.start();recover=false;snap=true;}
      const forward=throttle+Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const turn=steer+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      cadillac.update(dt,{gas:Math.max(0,forward),brake:Math.max(-forward,hud?.held.has('brake')?1:0),steer:turn,handbrake:keys.has('Space')},world.sky.nightAmount.value,reduced);
      if(cadillac.exitReady){const exit=cadillac.sim.exitPoint();if(exit){jump(exit.x,exit.z,exit.heading);core.advance(1/60,{dismount:true,instantDismount:true});pose=core.current;}}
    }
    if(cadillac.riding){const p=cadillac.sim.pose;pose={...pose,x:p.x,y:p.y,z:p.z,headingY:p.heading,speed:p.speed,groundPitch:p.pitch,groundRoll:p.roll};}
  }
  sunsetPreview?.sync();hover?.update(dt,!blocked()&&!photo?.active&&!sunsetPreview?.showcase,clock);boat?.update(dt,!blocked()&&!photo?.active,clock,reduced);world.boatWake(boat?.wake??null);world.waterVehicle(hover?.riding?hover.sim.pose:null);if(hover?.riding){const hp=hover.sim.pose;pose={...pose,x:hp.x,y:hp.y,z:hp.z,headingY:hp.heading,speed:hp.speed,groundPitch:hp.pitch,groundRoll:hp.roll};}if(boat?.riding){const bp=boat.sim.pose;pose={...pose,x:bp.x,y:bp.y,z:bp.z,headingY:bp.heading,speed:bp.speed};}const slidePose=slide?.update(dt,!cadillac?.riding&&!blocked()&&!photo?.active&&!hover?.riding);if(slidePose)pose=slidePose;if(slide?.active){hop=recover=mount=false;}const trialPose:TrialPose={x:pose.x,y:pose.y,z:pose.z,heading:pose.headingY,vehicle:hover?.riding?'hoverbike':'onewheel',onFoot:!hover?.riding&&pose.footBlend>.05,pitch:hover?.riding?hover.sim.pose.pitch:pose.wheelPitch,roll:hover?.riding?hover.sim.pose.roll:pose.groundRoll*.25-pose.rollAngle};trials?.update(elapsed,trialPose,now);const simEnd=performance.now();companion.update(slide?.active?core.current:pose,dt,active&&!vr?.active,!blocked());hero.apply(pose);world.contactVehicle(!cadillac?.riding&&active&&!race?.active&&!slide?.active?(hover?.riding?{...hover.sim.pose,vehicle:'hoverbike'}:pose.footBlend<.5?{x:pose.x,y:pose.y,z:pose.z,heading:pose.headingY,vehicle:'onewheel'}:null):null);slide?.present();if(online){online.update({pose,...(hover?.riding?hover.vehicleTelemetry:{}),vehicle:hover?.riding?hover.vehicle:'onewheel',pilot:hover?.selection.pilot,livery:hover?.selection.livery,mode:hover?.riding?'hover':slide?.active?'slide':'ride',seat:slide?.active?slide.motion.seat:0,active});remoteRiders.update(online,now,pose.x,pose.z);}const presentationEnd=performance.now();if(budgetChanged)world.setBudget(frameBudget.scale);hero.rider.visible=!vr?.active;if(vr?.active){hero.root.visible=true;vr.update(pose,dt);world.update(clock,pose.x,pose.z,camera,!paused&&!document.querySelector('dialog[open]'));}else if(!active){hero.root.visible=false;const shot=SUNSET_REFERENCE?{index:0,position:[60,35,1488],target:[-300,-18,1550]}:startup.camera(Math.min(elapsed,.08),camera.aspect);world.sky.previewShot(shot.index);camera.position.fromArray(shot.position);camera.lookAt(new T.Vector3().fromArray(shot.target));if(camera.fov!==52){camera.fov=52;camera.updateProjectionMatrix();}world.update(clock,camera.position.x,camera.position.z,camera,true,false);}else if(race?.active){hero.root.visible=true;}else if(golf?.active){hero.root.visible=false;golf.update(dt,camera,!overlay&&!online?.inputBlocked);world.update(clock,pose.x,pose.z,camera,!overlay);}else if(cadillac?.riding){hero.root.visible=false;cadillac.camera(camera,first,cameraYaw,cameraPitch,dt,snap||reduced);snap=false;world.update(clock,pose.x,pose.z,camera,!overlay);}else if(boat?.riding){hero.root.visible=false;boat.camera(camera,first,cameraYaw,cameraPitch,dt,snap||reduced);snap=false;world.update(clock,pose.x,pose.z,camera,!overlay);}else if(hover?.riding){hero.root.visible=false;hover.camera(camera,sunsetPreview?.showcase?false:first,cameraYaw,cameraPitch,dt,snap||reduced,!!photo?.active);sunsetPreview?.update();snap=false;world.update(clock,pose.x,pose.z,camera,!paused&&!document.querySelector('dialog[open]'));}else{if(camera.fov!==60){camera.fov=60;camera.updateProjectionMatrix();}hero.root.visible=!first;const yaw=pose.headingY+cameraYaw+(slide?.active?.65:0);forward.set(Math.sin(yaw),0,Math.cos(yaw));target.set(pose.x,pose.y+(slide?.active&&slide.motion.seat>.1?1.0:pose.footBlend > .5?1.55:1.8),pose.z);if(!first&&!slide?.active)target.y-=.4;const inAquarium=!!data.aquarium&&aquariumInside(data.aquarium,pose.x,pose.z);const inDossin=!!data.dossin&&dossinInside(data.dossin,pose.x,pose.z);const inYacht=yachtInside(pose.x,pose.z);const indoors=inYacht||inDossin||inAquarium||(!!data.conservatory&&greenhouseInside(data.conservatory,pose.x,pose.z));if(first){desired.copy(target);target.addScaledVector(forward,15);target.y-=Math.tan(cameraPitch)*15;}else{desired.copy(target).addScaledVector(forward,slide?.active?-2.5:indoors?-3:-4.8);desired.y+=slide?.active?.3+Math.min(.15,cameraPitch):indoors?.6+cameraPitch:1.4+cameraPitch*3;desired.y=Math.max(desired.y,terrain.height(desired.x,desired.z,pose.y)+.65);}if(!first&&inAquarium&&data.aquarium){const dir=desired.clone().sub(target),length=dir.length();dir.normalize();const hit=aquariumRay(data.aquarium,target,dir,length,.18);if(hit!==null)desired.copy(target).addScaledVector(dir,Math.max(.15,hit-.22));}if(!first&&inDossin&&data.dossin){const dir=desired.clone().sub(target),length=dir.length();dir.normalize();const hit=dossinRay(data.dossin,target,dir,length,.18);if(hit!==null)desired.copy(target).addScaledVector(dir,Math.max(.15,hit-.22));}if(!first&&inYacht){const dir=desired.clone().sub(target),length=dir.length();dir.normalize();const hit=yachtRay(target,dir,length,.18);if(hit!==null)desired.copy(target).addScaledVector(dir,Math.max(.15,hit-.22));}if(!first){const dir=desired.clone().sub(target),length=dir.length();dir.normalize();const hit=terrain.raycastCamera(target,dir,length,.16);if(hit!==null)desired.copy(target).addScaledVector(dir,Math.max(.15,hit-.2));}camera.position.lerp(desired,snap||reduced?1:1-Math.exp(-dt*12));camera.lookAt(target);hero.rider.visible=!first&&camera.position.distanceTo(target)>.85;snap=false;world.update(clock,pose.x,pose.z,camera,!paused&&!document.querySelector('dialog[open]'));}fishing?.update(dt,camera,active&&!paused&&!vr?.active&&!online?.inputBlocked&&!document.querySelector('dialog[open]'));belleAudio.update(pose,{active:active&&!scenePreparing&&!paused&&renderFocused&&!document.hidden&&!online?.inputBlocked&&!document.querySelector('dialog[open]')&&(!vr?.active||!vr.suspended),wheel:!cadillac?.riding&&!boat?.riding&&!hover?.riding&&!slide?.active&&!race?.active&&!fishing?.active&&!photo?.active&&!trials?.inputLocked,boat:boat?.riding&&!photo?.active?{...boat.sim.telemetry,speed:boat.sim.pose.speed,hydroplane:boat.sim.kind==='hydroplane'}:undefined},now);natureAudio.update(pose.x,pose.z,!!(yachtInside(pose.x,pose.z)||(data.aquarium&&aquariumInside(data.aquarium,pose.x,pose.z))||(data.dossin&&dossinInside(data.dossin,pose.x,pose.z))||(data.conservatory&&greenhouseInside(data.conservatory,pose.x,pose.z))),active&&!paused&&!document.querySelector('dialog[open]')&&(!vr?.active||!vr.suspended),world.sky.hour);golf?.proximity(pose.x,pose.z,active&&!blocked()&&!photo?.active&&!hover?.riding&&!boat?.riding);radio.update(active&&!vr?.active,paused||!!document.querySelector('dialog[open]'),!!hover?.riding&&(hover.sim.hazard||hover.sim.collision),!!hover?.riding&&first&&!photo?.active);photo?.update(camera,active&&!vr?.active&&!paused,hover?.riding?(hover.riderObject??hero.rider):hero.rider,now);activities?.update(elapsed,{x:pose.x,y:pose.y,z:pose.z,speedMps:pose.speed,onFoot:!hover?.riding&&pose.footBlend>.95,ride:hover?.riding?'hoverbike':'onewheel',height:Math.max(0,pose.y-terrain.height(pose.x,pose.z))},now);if((slide?.active||fishing?.active||race?.active)&&photo)photo.carried.visible=false;const worldEnd=performance.now();renderProbe?.beginFrame(!!rideProfile?.enabled&&eligibleFrame);submissionProbe?.beginFrame(!!rideProfile?.enabled&&eligibleFrame);try{if(race?.active)race.render(renderer,world,clock);else if(photo)photo.render(renderer,camera,now);else renderer.render(scene,camera);}catch(error){submissionProbe?.cancelFrame();renderProbe?.cancelFrame();throw error;}const renderEnd=performance.now();const submissionFrame=submissionProbe?.finishFrame();startupMetrics.sample(renderEnd-cpuStart,renderer.info.render.calls,renderer.info.memory.textures,renderer.info.memory.geometries,renderer.info.programs?.length??0,measureFrame&&!blocked());if(!prepared){prepared=true;startup.ready(destinations.length);}if(eligibleFrame&&!blocked()){samples.push(elapsed*1000);activeFrames++;if(elapsed>.25)stalledFrames++;if(elapsed>2)severeFrames++;longestFrameMs=Math.max(longestFrameMs,elapsed*1000);}if(samples.length>1800)samples.shift();if(now-lastUI>300){lastUI=now;firstRide.update(pose.x,pose.z,destination,active&&!paused&&!vr?.active&&!coop?.active&&!race?.active&&!trials?.active);syncViewLabel();refreshSkySettings();drawMap(pose.x,pose.z,pose.headingY);el('speed').innerHTML=speedMph(pose.speed)+' <small>MPH</small>';hud?.mode(pose.footBlend>.5);syncTrialControls();el<HTMLButtonElement>('hop').disabled=!!slide?.active;
    const doorButton=el('hop');if(cadillac?.riding){el('ride-mode').textContent='CADILLAC · '+cadillac.sim.gear;el('mount-label').textContent='Exit';el('mount').setAttribute('aria-label','Exit parked Cadillac (F)');doorButton.querySelector('span')!.textContent='Door';doorButton.setAttribute('aria-label','Open or close parked driver door (E)');el('hint').textContent='WASD / arrows drive · S brake / hold to reverse · E door · V view';el('hover-enter').setAttribute('disabled','');}else if(doorButton.getAttribute('aria-label')?.includes('driver door')){doorButton.querySelector('span')!.textContent='Hop';doorButton.setAttribute('aria-label','Hop (Space)');}
    const nearest=destinations.reduce((a,b)=>Math.hypot(a.x-pose.x,a.z-pose.z)<Math.hypot(b.x-pose.x,b.z-pose.z)?a:b);el('place').textContent=yachtRoom(pose.x,pose.z)||(data.dossin&&dossinRoom(data.dossin,pose.x,pose.z))||(data.aquarium&&(aquariumRoom(data.aquarium,pose.x,pose.z)||(Math.hypot(pose.x-aquariumWorld(data.aquarium,0,-38).x,pose.z-aquariumWorld(data.aquarium,0,-38).z)<13?'Aquarium · North entrance':null)))||(data.conservatory&&greenhouseRoom(data.conservatory,pose.x,pose.z))||(data.conservatory&&Math.hypot(pose.x-data.conservatory.center[0],pose.z-data.conservatory.center[1])<35?'Conservatory · West entrance':Math.hypot(pose.x,pose.z)<210?'Jefferson Avenue · Bridge approach':terrain.bridge(pose.x,pose.z).active?'MacArthur Bridge':(beachPlace(pose.x,pose.z)??nearest.name));el('destination').textContent=destination?destination.name+' · '+Math.round(Math.hypot(destination.x-pose.x,destination.z-pose.z))+' m':destinations.length+' places · Island guide';referenceHud?.update(pose,active&&!sunsetPreview?.showcase&&!photo?.active&&!vr?.active&&!race?.active&&!coop?.active,destination??undefined,el('place').textContent||'',!!trials?.active);const flightPanelFactor=flightHudBackdropFactor(pose.speed,!!hover?.riding,paused||overlay||!!coop?.active);document.body.style.setProperty('--belle-flight-hud-alpha',(.87*flightPanelFactor).toFixed(3));const s=samples.slice().sort((a,b)=>a-b),diagnostic=el('profile');Object.assign(diagnostic.dataset,{quality:graphics.value,effectiveQuality:world.quality.effective,adaptiveScale:String(world.quality.scale),frameCap:String(cap),activeFrames:String(activeFrames),stalledFrames:String(stalledFrames),severeFrames:String(severeFrames),longestFrameMs:longestFrameMs.toFixed(1),pixelRatio:renderer.getPixelRatio().toFixed(3),programs:String(renderer.info.programs?.length??0),sampleCount:String(s.length),frameP50Ms:s.length?s[Math.floor(s.length*.50)].toFixed(2):'',frameP95Ms:s.length?s[Math.min(s.length-1,Math.floor(s.length*.95))].toFixed(2):'',frameP99Ms:s.length?s[Math.min(s.length-1,Math.floor(s.length*.99))].toFixed(2):'',drawCalls:String(renderer.info.render.calls),triangles:String(renderer.info.render.triangles),textures:String(renderer.info.memory.textures),geometries:String(renderer.info.memory.geometries)});diagnostic.textContent=s.length?'Frame '+s[Math.floor(s.length*.5)].toFixed(1)+' ms · p95 '+s[Math.floor(s.length*.95)].toFixed(1)+' ms · '+renderer.info.render.calls+' draws · '+world.quality.effective+' · '+stalledFrames+' stalls >250 ms'+(rideProfile?.shortStatus?' · '+rideProfile.shortStatus:''):'';}rideProfile?.sample(elapsed,[simEnd-cpuStart,presentationEnd-simEnd,worldEnd-presentationEnd,renderEnd-worldEnd,performance.now()-renderEnd],renderer.info.render.calls,renderer.info.render.triangles,renderer.info.memory.textures,renderer.info.memory.geometries,pose.x,pose.z,pose.speed,el('place').textContent||'',eligibleFrame&&!blocked(),renderProbe?.finishFrame(),submissionFrame);}
 // Hidden tabs may suspend animation frames entirely; do not charge that gap to a delivery.
 document.addEventListener('visibilitychange',()=>{previous=performance.now();lastMeasurementEligible=false;});
 window.addEventListener('focus',()=>{previous=performance.now();lastMeasurementEligible=false;});

 renderer.setAnimationLoop(frame);
}
// Give the title a painted frame before building the geographic scene.
requestAnimationFrame(()=>requestAnimationFrame(()=>{void boot().catch(e=>{console.error(e);startup.error(e instanceof Error?e.message:String(e));});}));
