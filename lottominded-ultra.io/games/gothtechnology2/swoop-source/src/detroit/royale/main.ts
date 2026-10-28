import {baseRiderId} from '../../../../ride-core/src/riderWardrobe.ts';
import {StableEnvironment} from '../stableEnvironment.ts';
import {failStartup} from './startupFailure.ts';
import {VisibleTouchLayout} from './controlPlacement.ts';
import {roundResults} from './roundResults.ts';
import {RoyaleVR} from './vrCombat.ts';
import type {XRCombatInput} from './xrCombatInput.ts';
import {CameraCapture,photographyInput} from './cameraCapture.ts';
import {LcdViewfinder} from './lcdViewfinder.ts';
import {CircuitRace} from '../circuitRace.ts';
import {CruiseControl} from '../../../../ride-core/src/cruiseControl.ts';
import {AimComfortUi} from './aimComfortUi.ts';
import {aimFriction,SIMPLE_ACTIONS,ShotPreview,autoReloadAllowed} from './aimComfort.ts';
import {OpponentContrast} from './opponentContrast.ts';
import {makeHelmetSkinPicker} from '../helmetSkin.ts';
import {PointLightBudget} from '@digital-static/ridecore';
import {weaponReady,weaponReadyAmount} from '../../../../ride-core/src/royale/holster.ts';
import {fpsAim} from './fpsAim.ts';
import {CombatPreferencesControls,combatLookGain,combatChaseEye,retractCombatCamera} from './combatPolish.ts';
import {FpsControlFlow} from './fpsControlFlow.ts';
const combatPreferences=new CombatPreferencesControls();
const fpsControlFlow=new FpsControlFlow();
let barrelBlocked=false,aimDistance=0;
import {FirstPersonView} from './firstPersonView.ts';
import {parseRoomInvitation,roomInvitationLink} from '../../../../ride-core/src/roomInvitation.ts';
import {PlayerNameplate} from './playerNameplate.ts';
import {eliminationLabel} from './playerIdentity.ts';
import {RoyaleAudio} from './audio.ts';
const royaleAudio=new RoyaleAudio();
import {CombatBlockTerrain} from '../../../../ride-core/src/royale/combatBlock.ts';
import {CombatBlockView} from './combatBlockView.ts';
import {PracticeRangeView} from './practiceRangeView.ts';
import {fieldStageAt} from '../../../../ride-core/src/royale/fieldSchedule.ts';
let combatBlock:CombatBlockView|undefined;
let practiceRange:PracticeRangeView|undefined;
const activeTerrain=()=>combatBlock?.terrain??practiceRange?.layout.terrain??terrain;
function closeRange(){if(combatBlock){session.leave();combatBlock.dispose();combatBlock=undefined;scenery.root.visible=true;companions?.dispose();companions=new RoyaleCompanions(scene,assetMap,terrain,graphics.applyAssets);clearActorViews();}practiceRange?.dispose();practiceRange=undefined;}
import {FootAim} from './footAim.ts';
import {pacedFootCommand} from './movementIntent.ts';
const footAim=new FootAim();
import {ScopeSensitivityControls} from './scopeSensitivity.ts';
const scopeSensitivity=new ScopeSensitivityControls();
import {DeathReplay} from './deathReplay.ts';
import {SurfaceMarks} from './surfaceMarks.ts';
import {ImpactEffect} from './impactEffect.ts';
import {RiderPresentation} from './riderPresentation.ts';
import {interpolateRenderPose,previousRenderPose} from './renderPose.ts';
import type {RidePose} from '../../../../ride-core/src/controller.ts';
import {MatchPresentation} from './matchPresentation.ts';
import './matchPresentation.css';
import {RoyaleRadarMap} from './radarMap.ts';
import {JazzVisit} from '../jazzVisit.ts';
import {mountHudTransparency} from '../../../../ride-core/src/hudTransparency.ts';
import {RoyaleCompanions} from './companions.ts';
import {GyroscopeControl} from '../../../../ride-core/src/gyroscope.ts';
const gyroscope=new GyroscopeControl();
import {AmbientCyclistPacks,cyclistCircuit} from '../../../../ride-core/src/ambientCyclists.ts';
import {cutPoint,LENGTH} from '../world.ts';
import {HeartProjectiles} from './heartProjectiles.ts';
import {ShieldEffect} from './shieldEffect.ts';
import {ScopeLibrary,type ScopePickup} from './scopeView.ts';
import {isScope,SCOPES,cycleScope,bestScope,scopeZoom,scopedFov,type Scope} from '../../../../ride-core/src/royale/scopes.ts';
import {combatEye,dragAim,stickAxes} from './combatView.ts';
import {FootControls} from '../../../../ride-core/src/onFootControls.ts';
import {CameraBlend,mountCameraPreferences,cameraTransitionsEnabled} from '../../../../ride-core/src/cameraPresentation.ts';
import {combatFootEye,footLeanOffset} from '../../../../ride-core/src/royale/lean.ts';
import {CAMERA_PROFILE} from '../../../../ride-core/src/cameraProfile.ts';
import {underpassCameraHeight,clearRideCamera} from '../cameraClearance.ts';
import {loadEngineForPage,engineRequested} from '../../../../ride-core/src/engine/browser.ts';
import {engineReady} from '../../../../ride-core/src/engine/runtime.ts';
import './style.css';
import './lobby.css';
import {InteractiveWater} from '../interactiveWater.ts';
import {createRoyaleMenu,type RoyaleMenuPanel} from './menu.ts';
import * as T from 'three';
import {PedalSparks} from '../../../../ride-core/src/pedalSparks.ts';
import {GLTFLoader} from '../compressedGLTFLoader.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';
import {Hero} from '../actors.ts';
import {RIDER_CHOICES,riderChoice} from '../riderChoices.ts';
import {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';
import {TagTerrain} from '../../../../ride-core/src/tag/fixture.ts';
import {loadFixture} from '../../../../ride-core/src/fixtureLoader.ts';
import {buildDetroitArenaScene} from './detroitScene.ts';
import {RouteSky} from '../routeSky.ts';
import {ROYALE_SUN,ROYALE_HAZE} from './arenaLook.ts';
import {followStableSun} from '../stableSun.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {WEAPONS,neutral,DT,PROTECTION,weaponSocket,type Command} from '../../../../ride-core/src/royale/rules.ts';
import {RoyaleSession} from '../../../../ride-core/src/royaleClient.ts';
import {createGraphicsQuality,startupAntialias} from '../graphicsQuality.ts';
import {warmFirstView} from '../warmFirstView.ts';
import {ActorVisibility} from './actorVisibility.ts';
import {StartupFrames} from '../../../../ride-core/src/startupFrames.ts';
import {WorkSlice} from '../../../../ride-core/src/workSlice.ts';
const actorVisibility=new ActorVisibility(),startupFrames=new StartupFrames();let preparingMatch=false,profileRound='';
import {FrameSchedule} from '../frameSchedule.ts';
import {AdaptiveQuality} from '../adaptiveQuality.ts';
import {SmokeView} from './smokeView.ts';
import {evadeDirection} from '../../../../ride-core/src/royale/evade.ts';
import {CombatReadout} from './combatReadout.ts';
import {TacticalReadout,tacticalContext,tacticalStatus} from './tacticalReadout.ts';
import {setSimulationProfiling,takeSimulationProfile} from '../../../../ride-core/src/simulationProfile.ts';
import {findVault} from '../../../../ride-core/src/royale/vault.ts';
const vaultHint={tick:-Infinity,round:'',available:false};
import {touchLayout,presetTouchLayout,type ControlPreset} from './touchLayout.ts';
import {contextualActions} from './actionVisibility.ts';
import {assetConcurrency,loadAssetQueue} from '../assetQueue.ts';
import {EquipmentLibrary,WeaponView,CAMERA_SIGHTS,type EquipmentView} from './equipment.ts';
import {CombatRig} from './combatRig.ts';
import {FieldBoundary} from './fieldBoundary.ts';
import {AimGesture,LeanGesture,StanceGesture,deadZone,readBindings,type AimPreset} from './combatControls.ts';
import {MouseCombatInput} from './mouseCombatInput.ts';
import {WHEELS,wheelProfile} from '../../../../ride-core/src/royale/wheelProfiles.ts';
import {FIRE_MODES} from '../../../../ride-core/src/royale/combatProfiles.ts';
const el=<K extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as K;
const canvas=el<HTMLCanvasElement>('arena'),dialog=el<HTMLDialogElement>('lobby'),skin=el<HTMLSelectElement>('skin'),query=new URLSearchParams(location.search);
el('ride-settings').append(makeHelmetSkinPicker());
const fromElmwood=query.get('from')==='elmwood',back=el<HTMLAnchorElement>('return');if(fromElmwood){back.href='../elmwood-explorer/elmwood.html';back.textContent='← Elmwood Explorer';}
if(engineRequested())back.href+=(back.href.includes('?')?'&':'?')+'engine=breadflower';
const menuBack=el<HTMLAnchorElement>('return-menu');menuBack.href=back.href;menuBack.textContent=back.textContent;
dialog.close();if(!el<HTMLDialogElement>('royale-startup').open)dialog.showModal();
for(const r of RIDER_CHOICES)skin.add(new Option(r.label,r.id));skin.value=riderChoice(null);
try{skin.value=riderChoice(localStorage.getItem('static-royale-rider'));}catch{}
skin.addEventListener('change',()=>{try{localStorage.setItem('static-royale-rider',skin.value);}catch{}});
const wheel=el<HTMLSelectElement>('wheel');for(const w of WHEELS)wheel.add(new Option(w.name+' · '+Math.round(w.topKph)+' km/h',w.id));
const stanceGesture=new StanceGesture();const leanGesture=new LeanGesture();const aimGesture=new AimGesture();const mouseCombat=new MouseCombatInput(aimGesture);let touchAds=false,adsSensitivity=.65,touchDisplay='auto',touchAim='toggle',stickMode='floating';const resetPointers:Array<()=>void>=[];
for(const [id,fallback] of [['ads-sensitivity','0.65'],['touch-display','auto'],['touch-aim','toggle'],['touch-lean','toggle'],['stick-mode','floating']]){const field=el<HTMLInputElement>(id);try{field.value=localStorage.getItem('royale-'+id+(id==='stick-mode'?'-v2':''))??fallback;}catch{field.value=fallback;}const apply=()=>{if(id==='ads-sensitivity')adsSensitivity=T.MathUtils.clamp(Number(field.value)||.65,.2,1.5);if(id==='touch-display')touchDisplay=field.value;if(id==='touch-aim'){touchAim=field.value;touchAds=false;}if(id==='touch-lean'){leanGesture.mode=field.value==='hold'?'hold':'toggle';leanGesture.reset();}if(id==='stick-mode')stickMode=field.value;};field.onchange=()=>{apply();try{localStorage.setItem('royale-'+id+(id==='stick-mode'?'-v2':''),field.value);}catch{}};apply();}
let bindings=readBindings(null),lookYaw=0,lookPitch=0;
const cameraModes=['chase','first','front','side','orbit','drone'] as const;
type ViewMode=typeof cameraModes[number];let viewMode:ViewMode='chase',sensitivity=1;const cameraBlend=new CameraBlend();
try{const saved=localStorage.getItem('royale-camera');if(cameraModes.includes(saved as ViewMode))viewMode=saved as ViewMode;const value=Number(localStorage.getItem('royale-aim-sensitivity'));if(value>=.4&&value<=2)sensitivity=value;}catch{}
function setCamera(mode:ViewMode){viewMode=mode;el<HTMLSelectElement>('camera-view').value=mode;try{localStorage.setItem('royale-camera',mode);}catch{}}
function cycleCamera(){syncFootAim();firstPerson?.resetMotion();if(footAim.active){footView=footView==='first'?'chase':'first';saveFootView();}else setCamera(viewMode==='first'?'chase':'first');}
setCamera(viewMode);el<HTMLSelectElement>('camera-view').onchange=e=>setCamera((e.target as HTMLSelectElement).value as ViewMode);
let footView:'first'|'chase'='first';
try{if(localStorage.getItem('royale-foot-view')==='chase')footView='chase';}catch{}
const footViewLabel=document.createElement('label'),footViewSelect=document.createElement('select');footViewLabel.textContent='On-foot view';footViewSelect.id='foot-camera-view';footViewSelect.add(new Option('First person · combat','first'));footViewSelect.add(new Option('Third person · combat','chase'));footViewSelect.value=footView;footViewLabel.append(footViewSelect);el('camera-settings').append(footViewLabel);
function saveFootView(){footViewSelect.value=footView;try{localStorage.setItem('royale-foot-view',footView);}catch{}}
footViewSelect.onchange=()=>{footView=footViewSelect.value==='first'?'first':'chase';saveFootView();};
const sensitivityInput=el<HTMLInputElement>('aim-sensitivity');sensitivityInput.value=String(sensitivity);sensitivityInput.oninput=()=>{sensitivity=Number(sensitivityInput.value);try{localStorage.setItem('royale-aim-sensitivity',String(sensitivity));}catch{}};
const aimComfort=new AimComfortUi(el('camera-settings'));
const shotPreview=new ShotPreview();let localShotPending=false,assistChecked=-Infinity,assistGain=1,rosterSignature='',telemetryAt=0;
const reticle=el('reticle');reticle.classList.add('comfort-reticle');reticle.textContent='';const coverWarning=document.createElement('span');coverWarning.className='cover-warning';coverWarning.textContent='COVER';coverWarning.hidden=true;reticle.append(coverWarning);
let controlsExpanded=false;const moreControls=document.createElement('button');moreControls.className='combat-more';moreControls.type='button';moreControls.textContent='More';moreControls.setAttribute('aria-label','More combat controls');moreControls.setAttribute('aria-expanded','false');moreControls.onclick=()=>{controlsExpanded=!controlsExpanded;moreControls.textContent=controlsExpanded?'Less':'More';moreControls.setAttribute('aria-expanded',String(controlsExpanded));hudAt=0;};
royaleAudio.mount(el('ride-settings'));mountCameraPreferences(el('camera-settings'));mountHudTransparency(el('camera-settings'));gyroscope.mount(el('camera-settings'),true);scopeSensitivity.mount(el('camera-settings'));combatPreferences.mount(el('camera-settings'));
try{bindings=readBindings(JSON.parse(localStorage.getItem('royale-combat-bindings')??'null'));const preset=localStorage.getItem('royale-aim-preset');if(['classic','hold','toggle'].includes(preset??''))aimGesture.preset=preset as AimPreset;}catch{}
el<HTMLSelectElement>('aim-preset').value=aimGesture.preset;el<HTMLSelectElement>('aim-preset').onchange=e=>{aimGesture.reset();aimGesture.preset=(e.target as HTMLSelectElement).value as AimPreset;try{localStorage.setItem('royale-aim-preset',aimGesture.preset);}catch{}};
for(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const label=document.createElement('label');label.textContent=key;const input=document.createElement('button');input.textContent=bindings[key];input.onclick=()=>{input.textContent='Press a key…';input.onkeydown=e=>{e.preventDefault();e.stopPropagation();bindings=readBindings({...bindings,[key]:e.code});try{localStorage.setItem('royale-combat-bindings',JSON.stringify(bindings));}catch{}for(const b of el('bindings').querySelectorAll('button'))b.textContent=bindings[b.dataset.binding as keyof typeof bindings];input.onkeydown=null;};};input.dataset.binding=key;label.append(input);el('bindings').append(label);}
const scene=new T.Scene();const smokeView=new SmokeView();scene.add(smokeView);const combatReadout=new CombatReadout(el('hud'));const tacticalReadout=new TacticalReadout();const lightingBudget=new PointLightBudget(scene);scene.background=new T.Color(ROYALE_HAZE);scene.fog=new T.Fog(ROYALE_HAZE,280,1200);
const camera=new T.PerspectiveCamera(62,1,.12,4200);camera.position.set(65,85,100);camera.lookAt(0,0,0);
const capture=new CameraCapture(canvas,()=>{release();if(capture.active&&session?.state?.self?.combat.holster?.stowed)tap.add('holster');},()=>royaleAudio.capture());
const lcdViewfinder=new LcdViewfinder();
const spectatorControls=document.createElement('div');spectatorControls.id='spectator-controls';spectatorControls.hidden=true;spectatorControls.setAttribute('aria-label','Spectator controls');const spectatorLabel=document.createElement('span'),spectatorReplay=el<HTMLButtonElement>('spectator-replay');
for(const [label,delta]of [['Previous rider',-1],['Next rider',1]] as const){const b=document.createElement('button');b.textContent=delta<0?'←':'→';b.dataset.spectatorStep=String(delta);b.setAttribute('aria-label',label);b.onclick=()=>{const s=session.state?.spectating;if(!s?.choices.length)return;session.watch(s.choices[(Math.max(0,s.choices.indexOf(s.target))+delta+s.choices.length)%s.choices.length]);};spectatorControls.append(b);if(delta<0)spectatorControls.append(spectatorLabel);}spectatorControls.append(spectatorReplay);document.body.append(spectatorControls);
const interactiveWater=new InteractiveWater(canvas,camera);interactiveWater.settings(el('camera-settings'));
const renderer=new T.WebGLRenderer({canvas,antialias:startupAntialias()});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.type=T.PCFShadowMap;
const atmosphereSky=new RouteSky();
// Restrained Royale sky grade.
atmosphereSky.material.fragmentShader=atmosphereSky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );','texColor=mix(vec3(dot(texColor,vec3(.2126,.7152,.0722))),texColor,.74); gl_FragColor = vec4( texColor, 1.0 );');
scene.add(atmosphereSky);const sky=new T.HemisphereLight('#c2d9e6','#5b6156',.94);scene.add(sky);const sun=new T.DirectionalLight('#fff0dc',1.8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:36,bottom:-30,near:.1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);followStableSun(sun,{x:0,y:0,z:0},ROYALE_SUN);
const graphics=createGraphicsQuality(renderer,scene,canvas);
const fill=new T.DirectionalLight('#c7dceb',.30);fill.position.set(-12,8,-13);scene.add(fill,fill.target);
graphics.mount(el('graphics-settings'));

const fieldRing=new FieldBoundary('#49adff',.9,true);scene.add(fieldRing);
const nextRing=new FieldBoundary('#efc568',.75);scene.add(nextRing);
let radarMap:RoyaleRadarMap|undefined;let shieldAsset:GLTF;let companions:RoyaleCompanions|undefined;
const nameHead=new T.Vector3();
const actors=new Map<string,{sparks:PedalSparks;nameplate:PlayerNameplate;view:Hero;equipment:WeaponView;weapon:T.Group;shield:ShieldEffect;rig:CombatRig;wheelId:string;optic:T.Group;motion:RiderPresentation;contrast:OpponentContrast}>(),assetMap=new Map<string,GLTF>(),items=new Map<string,EquipmentView|ScopePickup>();
import {RideGhostView} from '../../../../ride-core/src/rideGhostView.ts';
const savedGhost=new RideGhostView('static-royale-downtown',scene,rig=>{const [skin,wheel]=rig.split(':');if(!assetMap.has(baseRiderId(skin)))return;const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheel).asset)!);return new Hero(models,activeTerrain(),riderChoice(skin),'kimodo');});el('ride-settings').append(savedGhost.panel);
let scopeLibrary:ScopeLibrary,selectedScope:Scope|null=null,ownedScopeKey='',scopePadHeld=false;
function changeScope(){selectedScope=cycleScope(session?.state?.self?.scopes??[],selectedScope);canvas.focus();}
el('scope-select').onclick=changeScope;
new ResizeObserver(()=>{document.documentElement.style.setProperty('--royale-hud-bottom',el('hud').getBoundingClientRect().bottom+'px');loadLayout();}).observe(el('hud'));
let firstPerson:FirstPersonView|undefined;
let vr:RoyaleVR|undefined,vrWeapon:WeaponView|undefined,vrPacket:ReturnType<XRCombatInput['sample']>|undefined;const vrEdges=new Set<string>();let vrAimBlocked=false;
let equipmentLibrary:EquipmentLibrary,equipmentTime=0,equipmentRound='',equipmentShots=0,previousShotTick=-999;
const seenShots=new Set<string>(),reducedEquipmentMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scenery:Awaited<ReturnType<typeof buildDetroitArenaScene>>;
let ambientPacks:AmbientCyclistPacks|undefined;let jazzVisit:JazzVisit|undefined;
let terrain:DowntownArena,session:RoyaleSession,loaded=false,acc=0,last=performance.now(),hudAt=0,paused=false,layoutEditing=false,aimYaw=0,aimPitch=0,slot=0;
const circuitRace=new CircuitRace(scene,canvas,{name:'Static Royale',context:()=>String(activeTerrain()?.arenaIdentity.arena)+':'+session?.state?.round,focus:()=>canvas.focus(),entries:()=>{const p=session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose;return p?[{id:session.me,name:'You',pose:p}]:[];},
 points:()=>{const p=session?.state?.actors.find(a=>a.id===session.me)?.pose,t=activeTerrain();if(!p||!t)return [];const goals=t.zones.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>40&&Math.hypot(q.x-p.x,q.z-p.z)<220).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));for(const q of goals.slice(0,6)){const path=t.route(p,{...q,y:t.ground(q.x,q.z,p.y).height});if(path.length>1)return path;}return [];},
 ground:(x,z,y)=>activeTerrain()?.ground(x,z,y).height??NaN,
 clear:(a,b)=>{const t=activeTerrain();return !t.ground(b.x,b.z,a.y).offCourse&&t.clear(b.x,b.z,.4,b.y)&&t.line({...a,y:a.y+.6},{...b,y:b.y+.6},.4);}});
let predictionFrame:{round:string;id:string;pose:RidePose;spawnSerial:number;alive:boolean}|undefined;
const footControls=new FootControls();const deathReplay=new DeathReplay(),impactEffect=new ImpactEffect();const surfaceMarks=new SurfaceMarks();scene.add(impactEffect,surfaceMarks);const seenImpacts=new Set<string>(),fallenAt=new Map<string,number>();let hitFlashUntil=0;const matchFeedback=new MatchPresentation();let previousShield=50,shieldSerial=-1;
const bots=()=>Math.min(Number(el<HTMLSelectElement>('bot-count').value),Number(el<HTMLSelectElement>('match-size').value)-1);
let reentryRequested=false;
el('reentry-confirm').onclick=()=>{reentryRequested=true;deathReplay.stop();release();session.requestReentry(true,el<HTMLSelectElement>('respawn-location').value||undefined);};el('reentry-decline').onclick=()=>{reentryRequested=false;session.requestReentry(false);};
function playDeathReplay(){if(!session?.state?.self||session.state.self.alive||!deathReplay.available)return;release();deathReplay.start(performance.now());if(deathReplay.playing){paused=false;dialog.close();}}el('death-replay').onclick=playDeathReplay;el('reentry-replay').onclick=playDeathReplay;spectatorReplay.onclick=playDeathReplay;el('replay-stop').onclick=()=>{deathReplay.stop();canvas.focus();};
const keys=new Set<string>(),held=new Set<string>(),tap=new Set<string>();let throttle=0,steer=0,aimPointer:number|undefined,mousePointer:number|undefined,aimX=0,aimY=0,stickPointer:number|undefined;
const message=(s:string)=>el('message').textContent=s;
const speedCruise=new CruiseControl();
function release(){vrAimBlocked=false;vr?.input.reset();vrEdges.clear();vrPacket=undefined;fpsControlFlow.reset();firstPerson?.resetMotion();speedCruise.reset();shotPreview.reset();localShotPending=false;footControls.clear();stanceGesture.reset();leanGesture.reset();touchAds=false;mouseCombat.reset();lookYaw=lookPitch=0;keys.clear();held.clear();tap.clear();steer=throttle=0;aimPointer=mousePointer=stickPointer=undefined;resetPointers.forEach(reset=>reset());session?.release();}
function finishLayoutEditing(){if(layoutEditing)saveLayout();layoutEditing=false;el('touch').classList.remove('editing');el('layout-done').hidden=true;release();}
function clearResults(){if(el('results').childElementCount){el('results').replaceChildren();delete el('results').dataset.summary;}el('rematch').hidden=true;}
let menuHome:ReturnType<typeof createRoyaleMenu>;
function showMenu(panel?:RoyaleMenuPanel){if(document.pointerLockElement===canvas)document.exitPointerLock();release();finishLayoutEditing();paused=true;if(dialog.open)dialog.close();dialog.showModal();el('resume').hidden=!session?.state;el('quit').hidden=!session?.state;if(panel)menuHome?.open(panel);else menuHome?.show();}
function resume(){void royaleAudio.unlock();finishLayoutEditing();paused=false;dialog.close();canvas.focus();loadLayout();}
const openSettings=()=>{showMenu('settings');el('camera-view').focus();};
el('settings-open').onclick=openSettings;
// Reach recovery with a mouse/keyboard even when the touch HUD is disabled.
const recoverQuick=document.createElement('button');recoverQuick.id='recover-quick';recoverQuick.type='button';recoverQuick.textContent='Recover';recoverQuick.hidden=true;recoverQuick.style.minHeight='44px';el('hud').append(recoverQuick);
const recoveryFeedback=document.createElement('span');recoveryFeedback.id='recovery-feedback';recoveryFeedback.setAttribute('role','status');recoveryFeedback.hidden=true;el('hud').append(recoveryFeedback);
let recoveryFeedbackTimer:ReturnType<typeof setTimeout>|undefined;
function recoveryNotice(text:string){clearTimeout(recoveryFeedbackTimer);recoveryFeedback.textContent=text;recoveryFeedback.hidden=false;recoveryFeedbackTimer=setTimeout(()=>{recoveryFeedback.hidden=true;},5000);}
function requestRecovery(){
 if(gameplayInputBlocked()||!session.state?.self?.alive)return;
 const p=session.state.actors.find(a=>a.id===session.me)?.pose,health=session.state.self.integrity;
 if(health<=15){recoveryNotice('Heal above 15 health before remounting.');return;}
 if(p?.footMode===2&&Math.hypot(p.x-p.parkX,p.z-p.parkZ)>1.3)recoveryNotice('Return to your wheel · '+Math.ceil(Math.hypot(p.x-p.parkX,p.z-p.parkZ))+' m away.');
 else recoveryNotice('Recovery requested · let the fall settle and keep your weapon idle.');
 tap.add('recover');canvas.focus();
}
recoverQuick.onclick=requestRecovery;
el('menu').onclick=()=>showMenu();el('resume').onclick=resume;dialog.addEventListener('cancel',e=>{e.preventDefault();if(menuHome.panel!=='home'){menuHome.show();return;}if(session?.state&&session.state.phase!=='lobby'&&session.state.phase!=='results')resume();});
async function run(work:()=>void|Promise<void>){try{message('');await work();}catch(e){message((e as Error).message);}}
function preparationItemDone(){const root=el('royale-startup');root.dataset.completed=String(Number(root.dataset.completed??0)+1);}
function preparationStage(completed:number,label:string){const root=el('royale-startup');if(completed===0){root.dataset.total=String(10+3+new Set(RIDER_CHOICES.map(r=>baseRiderId(r.id))).size+WHEELS.filter(w=>w.id!=='euc').length);root.dataset.completed='0';}else preparationItemDone();message(label);}
async function prepare(){preparationStage(0,'Warming up the arena…');const hdr=await new HDRLoader().loadAsync(new URL('../../../art/nvidia/detroit-skylight.hdr',import.meta.url).href),pm=new StableEnvironment(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.35;hdr.dispose();pm.dispose();await loadEngineForPage(true);if(!engineReady())throw Error('Compiled arena could not load. Return to normal riding or retry.');preparationStage(1,'Loading the original Detroit map…');terrain=new DowntownArena(await TagTerrain.create(await loadFixture(new URL('./love-tag/swoop-detroit.json',location.href).href)));preparationStage(2,'Building the Detroit skyline…');session=new RoyaleSession(terrain);radarMap=new RoyaleRadarMap(terrain,el('camera-settings'));scenery=await buildDetroitArenaScene(scene,terrain,graphics.applyAssets);interactiveWater.register(scenery.root);canvas.dataset.riverfront=JSON.stringify(scenery.root.userData.riverfront);canvas.dataset.arena=terrain.arenaIdentity.arena;canvas.dataset.collision=terrain.arenaIdentity.collision;
 preparationStage(3,'Preparing riders…');const loader=new GLTFLoader();await loadAssetQueue(['DS_EUC_01','DS_Cyclist_01','DS_Bicycle_01',...new Set(RIDER_CHOICES.map(r=>baseRiderId(r.id)))],assetConcurrency(),async id=>{assetMap.set(id,await loader.loadAsync(['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'].includes(id)?'/exports/rigged-heroes/'+id+'.glb':'/exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb'));graphics.applyAssets(assetMap.get(id)!.scene);preparationItemDone();});
 preparationStage(4,'Preparing companions…');assetMap.set('DS_Boerboel_01',await loader.loadAsync('/exports/polish/royale-equipment/royale-dog.glb'));companions=new RoyaleCompanions(scene,assetMap,terrain,graphics.applyAssets);
 preparationStage(5,'Tuning the wheels…');await loadAssetQueue(WHEELS.filter(w=>w.id!=='euc'),assetConcurrency(),async w=>{assetMap.set(w.asset,await loader.loadAsync('/exports/electric/'+w.asset+'.glb'));preparationItemDone();});
 preparationStage(6,'Loading equipment…');equipmentLibrary=await EquipmentLibrary.load(loader,new URL('./exports/polish/royale-equipment/',location.href));canvas.dataset.equipment='Higgsfield-Blender-Unity:7-equipment-models;Blender-dog-power-clips';
 preparationStage(7,'Calibrating scopes…');scopeLibrary=new ScopeLibrary(await loader.loadAsync('/exports/polish/royale-equipment/scope.glb'));
 preparationStage(8,'Charging shields…');shieldAsset=await loader.loadAsync('/exports/polish/royale-equipment/rider-shield.glb');
 preparationStage(9,'Final arena checks…');session.comms?.root.addEventListener('toggle',()=>{if(session.comms?.inputBlocked)release();});
 const mapTransform=terrain.terrain.fixture.transform;ambientPacks=new AmbientCyclistPacks(scene,assetMap,terrain,cyclistCircuit(Array.from({length:100},(_,i)=>{const p=cutPoint(60+i*(LENGTH-120)/99);return {x:(p.x-mapTransform.tx)/mapTransform.sx,z:p.z-mapTransform.tz,width:5};})));canvas.dataset.ambientPackSizes='10,10';canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks.starts);
 jazzVisit=new JazzVisit(scenery.jazz.clubs,()=>{const was=paused;paused=true;release();return was;},was=>{paused=was;release();canvas.focus();},()=>session.state?.actors.find(a=>a.id===session.me)?.pose.footMode?'walk':'ride',{toMap:(x,y,z)=>terrain.sourcePosition({x,y,z})});
 graphics.apply();message('Preparing the first arena view…');
 // Build the immutable nearest-node index before the first nine AI route queries.
 const start=terrain.spawns[0].position,navigationAt=performance.now();terrain.navigation.nearest(start);canvas.dataset.navigationWarmMs=String(Math.round(performance.now()-navigationAt));scenery.update(start,0);camera.position.set(start.x,start.y+3,start.z+6);camera.lookAt(start.x,start.y+1,start.z);camera.updateProjectionMatrix();
 await warmFirstView(renderer,scene,camera);
 preparationItemDone();loaded=true;loadedAt=performance.now();canvas.dataset.loadMs=String(Math.round(loadedAt));el<HTMLButtonElement>('practice').disabled=false;rangeButton.disabled=false;blockButton.disabled=false;el('practice').textContent='Practice with AI opponents →';message('Original Detroit arena ready. Choose six or ten riders; AI fills empty seats when enabled.');
 if(incomingInvitation){applyInvitation(incomingInvitation);menuHome.open('online',false);el('online-status').textContent='Your invitation is ready. Select Join game.';}
}
function relayControls(){const relay=!!relayConfig&&el<HTMLInputElement>('use-relay').checked;el<HTMLInputElement>('endpoint').closest('label')!.hidden=relay;el<HTMLInputElement>('test-code').closest('label')!.hidden=!relay;const note=el('supabase-test').querySelector('.note');if(note)note.textContent=relay?'Temporary remote test. The host computer must remain on and the access code must be current.':'Direct local match server · no test access code needed.';}
el<HTMLInputElement>('use-relay').onchange=relayControls;
async function prepareMatchView(){
 preparingMatch=true;paused=true;release();const prepareStarted=performance.now();message('Preparing riders, textures and shadows…');
 try{
  const spawn=session.state?.actors.find(a=>a.id===session.me)?.pose;
  if(spawn&&!combatBlock&&!practiceRange){
   await scenery.warm(spawn,graphics.current.distance+100).catch(e=>console.warn('Nearby arena art unavailable',e));
   scenery.update(spawn,0);
  }
  // The roster contains cosmetic choices, not hidden enemy positions. Fit those
  // rigs before deployment so an opponent entering the AOI cannot block a frame.
  const slice=new WorkSlice(),warmActors:T.Object3D[]=[];
  await session.prepareNavigation(()=>slice.checkpoint());
  for(const rider of session.state?.roster??[]){const a=view(rider.id,rider.skin,rider.wheelId??'euc');a.view.prepareOnFoot();a.equipment.select('static');warmActors.push(a.view.root,a.weapon);await slice.checkpoint();}
  draw(performance.now()); // Establish this round's pack locations before warming.
  if(spawn&&!combatBlock&&!practiceRange)await ambientPacks?.warm(spawn);
  draw(performance.now());
  await warmFirstView(renderer,scene,camera,[...warmActors,...(!combatBlock&&!practiceRange?ambientPacks?.views.map(v=>v.root)??[]:[])]);
  draw(performance.now());
 }
 finally{canvas.dataset.matchPrepareMs=String(Math.round(performance.now()-prepareStarted));preparingMatch=false;last=performance.now();previousFrame=last;acc=0;startupFrames.reset();message('');}
}
async function practice(training=false){if(preparingMatch)return;closeRange();if(training)practiceRange=new PracticeRangeView(scene,terrain);footAim.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;void royaleAudio.unlock();clearResults();session.offline(skin.value,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,training?0:bots(),practiceRange?.layout.terrain);slot=0;await prepareMatchView();resume();}
el('practice').onclick=()=>run(()=>practice());
const rangeButton=document.createElement('button');rangeButton.id='practice-range';rangeButton.textContent='Shooting range · 10–100 m';rangeButton.disabled=!loaded;rangeButton.onclick=()=>run(()=>practice(true));el('practice').after(rangeButton);
const blockButton=document.createElement('button');blockButton.id='combat-block';blockButton.textContent='Combat block · close-range AI';blockButton.disabled=!loaded;rangeButton.after(blockButton);
blockButton.onclick=()=>run(async()=>{closeRange();session.leave();const block=await CombatBlockTerrain.create();combatBlock=new CombatBlockView(scene,block);scenery.root.visible=false;companions?.dispose();companions=new RoyaleCompanions(scene,assetMap,block,graphics.applyAssets);clearActorViews();footAim.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;void royaleAudio.unlock();clearResults();session.offline(skin.value,wheel.value,6,true,2,block);slot=0;await prepareMatchView();resume();});
menuHome=createRoyaleMenu(dialog,()=>({phase:session?.state?.phase,online:!!session?.room,host:!session?.room||session.host===session.me,round:session?.state?.series.number??1,rounds:session?.state?.series.total??3,complete:session?.state?.series.complete??false,mode:combatBlock?'combat':practiceRange?'range':'city',riders:session?.state?.roster.length}));

let relayConfig:{endpoint:string;publishableKey:string}|undefined;let roomConnecting=false;const incomingInvitation=parseRoomInvitation(location.href,8);
function applyInvitation(invite:{code:string;testCode?:string}){el<HTMLInputElement>('code').value=invite.code;if(invite.testCode){el<HTMLInputElement>('test-code').value=invite.testCode;el<HTMLInputElement>('use-relay').checked=true;relayControls();}}
async function connectRoom(create:boolean){
 if(roomConnecting)return;closeRange();if(!loaded)throw Error('The arena is still loading. Your invitation is ready once it finishes.');
 const invitation=parseRoomInvitation(el<HTMLInputElement>('code').value,8);if(!create&&!invitation){el<HTMLInputElement>('code').focus();throw Error('Paste a full invitation or an 8-character room code.');}if(invitation)applyInvitation(invitation);
 const relay=!!relayConfig&&el<HTMLInputElement>('use-relay').checked;
 if(relay&&!/^[a-f0-9]{64}$/i.test(el<HTMLInputElement>('test-code').value.trim())){el<HTMLDetailsElement>('online-options').open=true;el('test-code').focus();throw Error('Ask the host for the full invitation, or enter the temporary test access under Connection options.');}
 roomConnecting=true;el<HTMLButtonElement>('join').disabled=el<HTMLButtonElement>('create').disabled=true;el('online-status').textContent=create?'Creating your room…':'Joining your friend’s room…';
 try{void royaleAudio.unlock();const code=invitation?.code??'',name=el<HTMLInputElement>('name').value,fill=el<HTMLInputElement>('botfill').checked,spectate=el<HTMLInputElement>('spectate').checked;
 if(relay)await session.supabase({...relayConfig!,accessCode:el<HTMLInputElement>('test-code').value.trim()},create,code,name,skin.value,fill,spectate,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,bots());
 else await session.online(el<HTMLInputElement>('endpoint').value,create,code,name,skin.value,fill,spectate,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,bots());
 clearResults();session.readyUp();el('online-status').textContent='Connected. Getting your room ready…';
 }catch(error){const detail=String((error as Error).message);el('online-status').textContent=/expired|offline|too many joins/i.test(detail)?'This test invite expired or the host is offline. Ask the host for a fresh invitation.':detail;throw error;}
 finally{roomConnecting=false;el<HTMLButtonElement>('join').disabled=el<HTMLButtonElement>('create').disabled=false;}
}
function requestRoom(create:boolean){return run(async()=>{try{await connectRoom(create);}catch(error){if(!el('online-status').textContent)el('online-status').textContent=(error as Error).message;throw error;}});}
el('create').onclick=()=>requestRoom(true);
el('join').onclick=()=>requestRoom(false);el<HTMLInputElement>('code').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el<HTMLButtonElement>('join').click();}};
el('ready').onclick=()=>session.readyUp();el('launch').onclick=()=>session.start();el('reconnect').onclick=()=>run(()=>{if(relayConfig&&el<HTMLInputElement>('use-relay').checked)session.relayConfig={...relayConfig,accessCode:el<HTMLInputElement>('test-code').value.trim()};return session.reconnect();});
el('rematch').onclick=()=>run(async()=>{release();footAim.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;session.start();if(!session.room){await prepareMatchView();resume();}});
el('quit').onclick=()=>{finishLayoutEditing();closeRange();session.leave();clearResults();paused=false;el('room').hidden=true;el('resume').hidden=el('quit').hidden=true;el('join').hidden=el('create').hidden=false;el<HTMLInputElement>('code').closest('label')!.hidden=false;el('online-status').textContent='You left the room. Join an invitation or create another room.';message('You left the match.');menuHome.show();};
el('connection-menu').onclick=()=>{showMenu('online');el<HTMLDetailsElement>('online-options').open=true;el('reconnect').focus();};
el('invite').onclick=()=>run(async()=>{
 const test=el<HTMLInputElement>('use-relay').checked?el<HTMLInputElement>('test-code').value.trim():undefined;
 const link=roomInvitationLink(location.href,session.code,test),field=el<HTMLInputElement>('invite-link');field.hidden=false;field.value=link;
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),status=el('invite-status');
 if(navigator.share&&!local){try{await navigator.share({title:'Static Royale',text:'Join my Static Royale room '+session.code,url:link});status.textContent='Invitation shared.';return;}catch(error){if((error as Error).name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(link);status.textContent=local?'Invite copied. This preview link opens on this computer; other devices need the same hosted game build.':'Invite copied. Your friend can open it and select Join game.';}catch{field.focus();field.select();status.textContent='Copy the invitation above and send it to your friend.';}
});
void fetch('./royale-config.json').then(r=>r.ok?r.json():{}).then((c:{supabaseTest?:{endpoint:string;publishableKey:string};serverUrl?:string})=>{relayConfig=c.supabaseTest;el('supabase-test').hidden=!relayConfig;el<HTMLInputElement>('use-relay').checked=!['localhost','127.0.0.1'].includes(location.hostname);el<HTMLInputElement>('endpoint').value=c.serverUrl||(['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8226':'');if(incomingInvitation?.testCode)applyInvitation(incomingInvitation);relayControls();}).catch(()=>{});
function buttonAction(action:string){if(action==='recover'){requestRecovery();return;}if(action==='crouch'||action==='prone'){stanceGesture.down(action==='crouch'?1:2);return;}if(action==='hop')stanceGesture.reset();if(action==='lean-left'||action==='lean-right'){leanGesture.down(action==='lean-left'?-1:1);return;}if(action==='scope'){changeScope();return;}if(action==='camera'){cycleCamera();return;}if(action==='fire-left'){tap.add('fire-left');return;}if(action==='aim'){if(touchAim==='toggle')touchAds=!touchAds;return;}if(action==='switch'){slot=1-slot;return;}tap.add(action);}
function gameplayInputBlocked(){return !loaded||!session?.state||dialog.open||paused||layoutEditing||deathReplay.playing||capture.reviewing||!!session.comms?.inputBlocked||document.hidden;}
window.addEventListener('keydown',e=>{const target=e.target as HTMLElement;
 // Clicking an on-screen action leaves its button focused. Keep WASD working
 // while preserving Enter/Space activation and text-entry keyboard ownership.
 if(target?.matches('input,select,textarea,[contenteditable=true]')||(target?.closest('button')&&['Enter','Space'].includes(e.code))||dialog.open||deathReplay.playing||capture.reviewing||session?.comms?.inputBlocked)return;
 if(e.code==='Escape'||e.code===bindings.loadout){e.preventDefault();showMenu();return;}
 if(gameplayInputBlocked())return;
 if([...Object.values(bindings),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Escape'].includes(e.code))e.preventDefault();
 if(!keys.has(e.code)){if(e.code===bindings.crouch)stanceGesture.down(1);if(e.code===bindings.prone)stanceGesture.down(2);if(e.code===bindings.hop)stanceGesture.reset();for(const [key,action] of [['holster','holster'],['hop','hop'],['utility','utility'],['repair','repair'],['recover','recover'],['reload','reload'],['pickup','swap'],['cycleMode','cycleMode'],['dogAttack','dog-attack'],['dogRadar','dog-radar'],['brawl','brawl'],['evade','evade'],['vault','vault'],['smoke','smoke']] as const)if(e.code===bindings[key]){if(action==='recover')requestRecovery();else tap.add(action);}if(e.code===bindings.captureMode)capture.setActive(!capture.active);if(e.code===bindings.captureRecord)capture.toggleRecording();if(e.code===bindings.camera)cycleCamera();if(e.code===bindings.scope)changeScope();}
 keys.add(e.code);if(e.code==='Digit1')slot=0;if(e.code==='Digit2')slot=1;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);window.addEventListener('gamepaddisconnected',release);
document.addEventListener('visibilitychange',()=>{release();last=performance.now();acc=0;predictionFrame=undefined;frames=0;profileAt=previousFrame=last;samples=[];});
// The transparent aim pad and touch buttons are canvas siblings. Scope browser
// menu suppression to these active game surfaces, leaving page/UI menus usable.
for(const surface of [canvas,el('touch')])surface.addEventListener('contextmenu',e=>{if(!gameplayInputBlocked())e.preventDefault();});
 document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas){release();if(session?.state&&!dialog.open&&!paused)showMenu();}});
 document.addEventListener('pointerlockerror',()=>{message('Mouse capture is unavailable here. Hold and drag to aim, or open the game in a full browser tab.');});
 function captureMouse(){if(document.pointerLockElement===canvas||!canvas.requestPointerLock)return;try{const result=canvas.requestPointerLock();result?.catch(()=>message('Click the arena to capture your mouse. Escape releases it.'));}catch{message('Hold and drag to aim. Mouse capture is unavailable.');}}
 function aimSlowdown(device:string){
  if(device==='mouse'||aimComfort.value.assist<=0||!session?.state?.self?.alive)return 1;
  const now=performance.now();if(now-assistChecked<50)return assistGain;assistChecked=now;assistGain=1;
  const self=session.state.actors.find(a=>a.id===session.me);if(!self)return 1;
  const pose=session.prediction?.controller.poseValue??self.pose,yaw=footAim.active?footAim.heading:pose.headingY+aimYaw,scale=self.skin.startsWith('DS_Mascot_')?.48:1;
  const eye=combatFootEye(pose,scale,self.combat.lean,activeTerrain());
  for(const a of session.state.actors){if(a.id===session.me||!a.alive)continue;const scale=a.skin.startsWith('DS_Mascot_')?.48:1,target={x:a.pose.x,y:a.pose.y+(a.pose.footProne>.5?.3:a.pose.footCrouch>.5?.8:1.2)*scale,z:a.pose.z},dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z,d=Math.hypot(dx,dy,dz);if(d<1||d>60)continue;
   const yawError=Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw)),pitchError=Math.atan2(dy,Math.hypot(dx,dz))-aimPitch,offset=Math.hypot(yawError,pitchError);if(offset>.065)continue;
   const hit=activeTerrain().raycast(eye,{x:dx/d,y:dy/d,z:dz/d},d);assistGain=Math.min(assistGain,aimFriction(offset,d,aimComfort.value.assist,hit===null||hit>=d-.15,device));
  }return assistGain;
 }
canvas.addEventListener('wheel',e=>{if(gameplayInputBlocked())return;e.preventDefault();slot=1-slot;},{passive:false});
const aimGain=(gain:number)=>combatLookGain(gain,sensitivity,adsSensitivity,aimMode(),(footAim.active?footView:viewMode)==='first',selectedScope,scopeSensitivity.value,combatPreferences.value,mouseCombat.canFire||held.has('fire')||held.has('fire-left')||!!navigator.getGamepads?.()[0]?.buttons[7]?.pressed);
function syncFootAim(){footAim.sync(session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose);}
function look(dx:number,dy:number,gain:number,device='touch'){if(!dx&&!dy)return;syncFootAim();dx*=aimComfort.value.x;dy*=aimComfort.value.y;const g=aimGain(gain)*aimSlowdown(device),next=dragAim(aimYaw,aimPitch,dx,dy,g);if(footAim.active){footAim.turn(-dx*g);aimYaw=0;}else aimYaw=next.yaw;aimPitch=next.pitch;}
function cancelAimPointer(){fpsControlFlow.reset();mouseCombat.reset();tap.delete('mouse-fire');localShotPending=false;shotPreview.reset();aimPointer=mousePointer=undefined;}
const aimPad=el('aim-pad');
for(const surface of [canvas,aimPad]){
 const accepts=(e:PointerEvent)=>surface===canvas||e.pointerType==='mouse';
 surface.addEventListener('pointerdown',e=>{if(!accepts(e)||gameplayInputBlocked()||e.pointerType!=='mouse'&&(aimPointer!==undefined||e.clientX<innerWidth*.4))return;canvas.focus();if(document.pointerLockElement!==canvas){try{surface.setPointerCapture(e.pointerId);}catch{}}aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;if(e.pointerType==='mouse')mousePointer=e.pointerId;});
 // mousedown/up report each button in a chord. Pointer movement (including
 // button-mask changes) must never start, stop, or queue a shot.
 surface.addEventListener('mousedown',e=>{if(gameplayInputBlocked()||e.button!==0&&e.button!==2||mousePointer===undefined&&document.pointerLockElement!==canvas)return;const change=mouseCombat.handle(e,performance.now());if(change.firePressed)tap.add('mouse-fire');captureMouse();});
 surface.addEventListener('pointermove',e=>{if(!accepts(e)||gameplayInputBlocked()||aimPointer!==e.pointerId&&document.pointerLockElement!==canvas)return;
 const dx=e.pointerType==='mouse'?e.movementX:e.clientX-aimX,dy=e.pointerType==='mouse'?e.movementY:e.clientY-aimY;
 if((keys.has(bindings.freeLook)||held.has('free-look'))){lookYaw=T.MathUtils.clamp(lookYaw-dx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-dy*.003,-.8,.8);}
 else look(dx,dy,.004,e.pointerType==='mouse'?'mouse':'touch');
 aimX=e.clientX;aimY=e.clientY;
 });
 surface.addEventListener('pointerup',e=>{if(!accepts(e))return;if(aimPointer===e.pointerId)aimPointer=undefined;if(mousePointer===e.pointerId)mousePointer=undefined;});
 surface.addEventListener('pointercancel',e=>{if(accepts(e)&&(aimPointer===e.pointerId||e.pointerType==='mouse'&&document.pointerLockElement===canvas))release();});
 surface.addEventListener('lostpointercapture',e=>{if(accepts(e)&&aimPointer===e.pointerId&&document.pointerLockElement!==canvas)cancelAimPointer();});
}
// Release even if the pointer leaves the canvas or lands over a touch button.
window.addEventListener('mouseup',e=>{if(gameplayInputBlocked())cancelAimPointer();else mouseCombat.handle(e,performance.now());});
for(const [action,label]of [['vault','Vault'],['smoke','Smoke']] as const){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.setAttribute('aria-label',label);el('touch').append(button);}
const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
let controlPreset:ControlPreset='custom';try{const saved=localStorage.getItem('royale-control-preset');if(['two','three','four'].includes(saved??''))controlPreset=saved as ControlPreset;}catch{}
const layoutKey=()=> 'static-royale-touch-'+orientation()+(controlPreset==='custom'?'':'-'+controlPreset);
const presetLabel=document.createElement('label'),presetSelect=document.createElement('select');presetLabel.textContent='Touch layout';presetSelect.setAttribute('aria-label','Touch layout preset');for(const [value,label]of [['custom','My saved layout'],['two','Two fingers'],['three','Three fingers'],['four','Four fingers']])presetSelect.add(new Option(label,value));presetSelect.value=controlPreset;presetLabel.append(presetSelect);el('camera-settings').append(presetLabel);presetSelect.onchange=()=>{controlPreset=presetSelect.value as ControlPreset;try{localStorage.setItem('royale-control-preset',controlPreset);}catch{}loadLayout();};
function saveLayout(){const result:Record<string,{x:number;y:number}>={};for(const node of el('touch').children){const h=node as HTMLElement;if(h.dataset.customPosition){const r=h.getBoundingClientRect();result[h.id||h.dataset.action!]={x:r.left/innerWidth,y:r.top/innerHeight};}}try{localStorage.setItem(layoutKey(),JSON.stringify(result));}catch{}}
const visibleTouchLayout=new VisibleTouchLayout();
function loadLayout(){
 visibleTouchLayout.reset();
 let data:Record<string,{x:number;y:number}>={};try{data=JSON.parse(localStorage.getItem(layoutKey())??'{}')??{};}catch{}
 const touch=el('touch'),padding=getComputedStyle(touch),safe={left:parseFloat(padding.paddingLeft)||0,right:parseFloat(padding.paddingRight)||0,top:parseFloat(padding.paddingTop)||0,bottom:parseFloat(padding.paddingBottom)||0};
 const layout=controlPreset==='custom'?touchLayout(innerWidth,innerHeight,Number(el<HTMLInputElement>('button-size').value),el('hud').getBoundingClientRect().bottom||188,safe):presetTouchLayout(innerWidth,innerHeight,Number(el<HTMLInputElement>('button-size').value),controlPreset);touch.style.setProperty('--touch-size',layout.size+'px');
 for(const n of touch.children){const h=n as HTMLElement,id=h.id||h.dataset.action!,p=data[id],r=id==='move-pad'?layout.move:layout.buttons[id];h.style.left=h.style.top=h.style.right=h.style.bottom='';delete h.dataset.customPosition;
  if(r){h.style.left=r.x+'px';h.style.top=r.y+'px';h.style.width=r.width+'px';h.style.height=r.height+'px';h.style.right=h.style.bottom='auto';}
  if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){const w=r?.width||innerWidth*.54,ht=r?.height||innerHeight*.4;h.style.left=Math.min(innerWidth-safe.right-w,Math.max(safe.left,p.x*innerWidth))+'px';h.style.top=Math.min(innerHeight-safe.bottom-ht,Math.max(safe.top,p.y*innerHeight))+'px';h.style.right=h.style.bottom='auto';h.dataset.customPosition='true';}
 }
}
el('layout').onclick=()=>{release();paused=true;layoutEditing=true;for(const b of el('touch').querySelectorAll<HTMLButtonElement>('button')){b.hidden=false;b.disabled=false;}el('touch').classList.add('editing');el('touch').hidden=false;el('layout-done').hidden=false;dialog.close();loadLayout();el('hint').textContent='Drag controls. Tap Done to save and return.';};
el('layout-done').onclick=()=>session?.state?resume():showMenu();
el('reset-layout').onclick=()=>{try{localStorage.removeItem(layoutKey());}catch{}loadLayout();};
el<HTMLInputElement>('button-size').oninput=e=>{try{localStorage.setItem('royale-touch-size',(e.target as HTMLInputElement).value);}catch{}loadLayout();};
try{const size=Number(localStorage.getItem('royale-touch-size'));if(size>=48&&size<=86){el<HTMLInputElement>('button-size').value=String(size);el('touch').style.setProperty('--touch-size',size+'px');}}catch{}
const ridingAim=new Map<number,{x:number;y:number}>();
let beginFloatingMove:((e:PointerEvent)=>void)|undefined;
document.addEventListener('pointerdown',e=>{const target=e.target as Element;if(e.pointerType!=='touch'||stickMode!=='floating'||dialog.open||paused||deathReplay.playing||layoutEditing||el('touch').hidden||e.clientX>innerWidth*.5||e.clientY<64||target.closest('button,a,input,select,textarea,summary,dialog,[role=dialog]'))return;if(target===canvas||el('touch').contains(target)){beginFloatingMove?.(e);if(stickPointer===e.pointerId)e.stopImmediatePropagation();}},{capture:true});
for(const node of Array.from(el('touch').children)){
 const h=node as HTMLElement;let pointer:number|undefined,dx=0,dy=0,originX=0,originY=0,homeLeft='',homeTop='';const act=()=>h.dataset.action;
 const down=(e:PointerEvent)=>{if(h.id==='aim-pad'&&e.pointerType==='mouse'&&!layoutEditing)return;if(e.pointerType==='mouse'&&e.button!==0||!layoutEditing&&gameplayInputBlocked()||pointer!==undefined||h.id==='move-pad'&&stickPointer!==undefined||!layoutEditing&&h instanceof HTMLButtonElement&&h.disabled)return;e.preventDefault();pointer=e.pointerId;ridingAim.set(pointer,{x:e.clientX,y:e.clientY});h.setPointerCapture(pointer);const r=h.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;
  if(layoutEditing)return;if(h.id==='move-pad'){stickPointer=pointer;originX=stickMode==='floating'?e.clientX:r.left+r.width/2;originY=stickMode==='floating'?e.clientY:r.top+r.height/2;homeLeft=h.style.left;homeTop=h.style.top;if(stickMode==='floating'){h.style.left=(originX-r.width/2)+'px';h.style.top=(originY-r.height/2)+'px';}const axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;}
  else if(h.id==='aim-pad'){aimPointer=pointer;aimX=e.clientX;aimY=e.clientY;}else {held.add(act()!);buttonAction(act()!);}h.classList.add('active');
 };h.addEventListener('pointerdown',down);if(h.id==='move-pad')beginFloatingMove=down;
 h.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;
  if(layoutEditing){h.style.left=T.MathUtils.clamp(e.clientX-dx,0,innerWidth-h.offsetWidth)+'px';h.style.top=T.MathUtils.clamp(e.clientY-dy,0,innerHeight-h.offsetHeight)+'px';h.style.right=h.style.bottom='auto';h.dataset.customPosition='true';return;}
  if(h.id==='move-pad'&&pointer===stickPointer){const r=h.getBoundingClientRect(),axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;h.style.setProperty('--stick-x',(steer*28)+'px');h.style.setProperty('--stick-y',(-throttle*28)+'px');}
  else if((act()==='fire'||act()==='free-look')&&pointer!==undefined){const mx=e.clientX-(ridingAim.get(pointer)?.x??e.clientX),my=e.clientY-(ridingAim.get(pointer)?.y??e.clientY);ridingAim.set(pointer,{x:e.clientX,y:e.clientY});if(act()==='free-look'){lookYaw=T.MathUtils.clamp(lookYaw-mx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-my*.004,-.8,.8);}else look(mx,my,.004,e.pointerType==='mouse'?'mouse':'touch');}
  else if(h.id==='aim-pad'&&pointer===aimPointer){look(e.clientX-aimX,e.clientY-aimY,.004,e.pointerType==='mouse'?'mouse':'touch');aimX=e.clientX;aimY=e.clientY;}
 });
 const up=()=>{if(pointer===undefined)return;if(pointer!==undefined)ridingAim.delete(pointer);if(h.id==='move-pad'&&pointer===stickPointer){stickPointer=undefined;steer=throttle=0;h.style.setProperty('--stick-x','0px');h.style.setProperty('--stick-y','0px');h.style.left=homeLeft;h.style.top=homeTop;}if(pointer===aimPointer)aimPointer=undefined;held.delete(act()!);pointer=undefined;h.classList.remove('active');if(layoutEditing)saveLayout();};
 resetPointers.push(up);for(const type of ['pointerup','pointercancel','lostpointercapture'])h.addEventListener(type,e=>{if((e as PointerEvent).pointerId!==pointer)return;if(type!=='pointerup'){tap.delete(act()!);if(act()==='fire'||act()==='fire-left'){localShotPending=false;shotPreview.reset();}if(act()==='aim'){touchAds=false;aimGesture.reset();}}up();});
  if(h instanceof HTMLButtonElement&&act()){
   let keyboardHeld=false;const releaseKey=()=>{if(!keyboardHeld)return;keyboardHeld=false;held.delete(act()!);h.classList.remove('active');};
   h.addEventListener('keydown',e=>{if(e.code!=='Enter'&&e.code!=='Space')return;e.preventDefault();e.stopPropagation();if(e.repeat||h.disabled||layoutEditing||gameplayInputBlocked())return;keyboardHeld=true;held.add(act()!);buttonAction(act()!);h.classList.add('active');});
   h.addEventListener('keyup',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();releaseKey();}});h.addEventListener('blur',releaseKey);resetPointers.push(releaseKey);
  }
}
el('touch').append(moreControls);
function rawAimMode(){if(vr?.active)return vrPacket?.ads?2:0;return touchAds||touchAim==='hold'&&held.has('aim')||navigator.getGamepads?.()[0]?.buttons[6]?.pressed?2:aimGesture.get(performance.now());}
function aimMode(){const p=session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose;if((p?.footEvade??0)>0||(p?.footVault??0)>0)return 0;return combatPreferences.value.controlStyle==='burntwax'&&footAim.active&&fpsControlFlow.aimSuppressed?0:rawAimMode();}
function vrCommand():Command{
 const state=session.state,c=neutral(state?.round??''),me=state?.self,actor=state?.actors.find(a=>a.id===session.me),p=session.prediction?.controller.poseValue??actor?.pose,packet=vrPacket;
 if(!vr?.active||!packet||!me?.alive||!p||!actor)return c;
 const edge=(key:string)=>{const value=vrEdges.has(key);vrEdges.delete(key);return value;};
 const aim=vr.aim(),wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
 c.throttle=packet.brake?(Math.abs(p.speed)<.15?0:-Math.sign(p.speed)):packet.throttle;c.steer=packet.steer;c.fire=packet.fire;c.aimMode=packet.ads?2:0;c.crouch=packet.crouch;
 c.repair=edge('heal');c.holster=edge('holster');if(edge('switch'))c.slot=(me.slot+1)%me.loadout.length;else c.slot=me.slot;c.reload=edge('reload');c.dismount=edge('mount');c.recover=edge('recover');c.hop=edge('hop');c.hopHeld=false;
 // Controller aiming still goes through the authoritative physical muzzle and cover checks.
 c.facingYaw=p.footMode===2?aim.yaw:null;vrAimBlocked=Math.abs(wrap(aim.yaw-(c.facingYaw??p.headingY)))>1.25||Math.abs(aim.pitch)>.65;if(vrAimBlocked)c.fire=false;c.aimYaw=T.MathUtils.clamp(wrap(aim.yaw-(c.facingYaw??p.headingY)),-1.25,1.25);c.aimPitch=T.MathUtils.clamp(aim.pitch,-.65,.65);
 const w=WEAPONS[actor.weapon],facing={...p,headingY:c.facingYaw??p.headingY};
 const converged=fpsAim(facing,actor.skin,facing.headingY+c.aimYaw,c.aimPitch,me.combat.aimBlend,0,activeTerrain(),state!.actors.filter(a=>a.id!==session.me),{origin:aim.position,range:Math.min(600,w.speed*w.life/60),kickYaw:0,kickPitch:0});
 c.aimYaw=converged.aimYaw;c.aimPitch=converged.aimPitch;barrelBlocked=converged.blocked;aimDistance=converged.distance;aimYaw=c.aimYaw;aimPitch=c.aimPitch;
 if(me.combat.melee?.brawl){c.brawl=true;c.fire=false;}
 return c;
}
function command():Command{if(vr?.active)return vrCommand();syncFootAim();let c=neutral(session.state?.round??'');const pad=navigator.getGamepads?.()[0];const axis=(n:number)=>deadZone(pad?.axes[n]??0,aimComfort.value.deadzone);
 const scopePressed=!!pad?.buttons[12]?.pressed;if(scopePressed&&!scopePadHeld)changeScope();scopePadHeld=scopePressed;
 c.throttle=T.MathUtils.clamp(throttle+Number(keys.has(bindings.forward)||keys.has('ArrowUp'))-Number(keys.has(bindings.brake)||keys.has('ArrowDown'))-axis(1),-1,1);
 c.steer=T.MathUtils.clamp(steer+Number(keys.has(bindings.right)||keys.has('ArrowRight'))-Number(keys.has(bindings.left)||keys.has('ArrowLeft'))+axis(0),-1,1);
 look(axis(2)*6,axis(3)*4.5,.004,'controller');const gyro=gyroscope.consume(1/60,!dialog.open&&!paused,aimMode()===2||viewMode==='first');const gyroGain=scopeSensitivity.gain(aimMode()===2?selectedScope:null,'gyro')/(aimMode()===2?scopeZoom(selectedScope):1);gyro.yaw*=gyroGain;gyro.pitch*=gyroGain;if(footAim.active){footAim.turn(-gyro.yaw);aimYaw=0;}else aimYaw=T.MathUtils.clamp(aimYaw-gyro.yaw,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch+gyro.pitch,-.65,.65);c.facingYaw=footAim.active?footAim.heading:null;c.aimYaw=aimYaw;c.aimPitch=aimPitch;
 c.fire=(mouseCombat.canFire||tap.has('mouse-fire')||held.has('fire')||held.has('fire-left')||tap.has('fire')||tap.has('fire-left'))||!!pad?.buttons[7]?.pressed;c.aimMode=rawAimMode();if(c.fire&&!footAim.active&&!c.aimMode&&viewMode!=='first'&&viewMode!=='chase')setCamera('chase');
 c.holster=tap.has('holster');if(c.holster){touchAds=false;aimGesture.reset();held.delete('aim');c.aimMode=0;}c.reload=tap.has('reload')||!!pad?.buttons[2]?.pressed;c.cycleMode=tap.has('cycleMode');c.lean=leanGesture.get(keys.has(bindings.leanLeft),keys.has(bindings.leanRight),held.has('lean-left'),held.has('lean-right'));c.crouch=stanceGesture.value===1;c.prone=stanceGesture.value===2;
 c.hop=tap.has('hop')||!!pad?.buttons[0]?.pressed;c.hopHeld=held.has('hop')||keys.has(bindings.hop)||!!pad?.buttons[0]?.pressed;c.dismount=footControls.consume();c.burst=footControls.run||held.has('burst')||keys.has(bindings.burst)||!!pad?.buttons[4]?.pressed;
 const brawling=!!session.state?.self?.combat.melee?.brawl;c.brawl=tap.has('brawl');c.light=brawling&&c.fire;c.heavy=brawling&&c.reload;if(brawling){c.fire=false;c.reload=false;c.aimMode=0;}c.evade=tap.has('evade')?evadeDirection(c.throttle,c.steer):0;c.vault=tap.has('vault');c.smoke=tap.has('smoke');
 c.dogAttack=tap.has('dog-attack');c.dogRadar=tap.has('dog-radar');c.utility=tap.has('utility')||!!pad?.buttons[5]?.pressed;c.repair=tap.has('repair')||!!pad?.buttons[3]?.pressed;c.recover=tap.has('recover');c.swap=tap.has('swap');c.slot=slot;
 if(capture.active){capture.trigger(c.fire||c.light);c=photographyInput(c);}
 const self=session.state?.actors.find(a=>a.id===session.me),pose=session.prediction?.controller.poseValue??self?.pose;
 const own=session.state?.self,ownWeapon=own?.loadout[own.slot];
  if(session.state){
   const context=tacticalContext(session.state,!!c.vault&&pose?.footMode===2&&!!findVault(activeTerrain(),pose));
   const now=performance.now();
   if(c.smoke&&!tacticalReadout.attempt('smoke',now,context))c.smoke=false;
   if(c.evade&&!tacticalReadout.attempt('evade',now,context))c.evade=0;
   if(c.vault&&!tacticalReadout.attempt('vault',now,context))c.vault=false;
   if(c.repair&&!tacticalReadout.attempt('repair',now,context))c.repair=false;
  }
 c.facingYaw=footAim.commandYaw({aimMode:c.aimMode,fire:c.fire,lean:c.lean,brawl:brawling});
 c=pacedFootCommand(c,{onFoot:pose?.footMode===2,brawling,reloading:(own?.combat.reloadStart??-1)>=0,keyboard:[bindings.forward,bindings.brake,bindings.left,bindings.right,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k))});
 if(own&&ownWeapon&&autoReloadAllowed(pose?.footMode,pose?.footStagger,c.recover)&&!capture.active&&aimComfort.value.autoReload&&weaponReady(own.combat,session.state?.tick??0)&&!brawling&&own.combat.magazine[ownWeapon]===0&&own.ammo[ownWeapon]>0&&own.combat.reloadStart<0)c.reload=true;
 const fpsIntent=fpsControlFlow.update({enabled:combatPreferences.value.controlStyle==='burntwax'&&!capture.active&&!brawling,onFoot:pose?.footMode===2,moving:Math.hypot(c.throttle,c.steer)>.05,sprint:c.burst,aimMode:c.aimMode,fire:c.fire,reloading:c.reload||(own?.combat.reloadStart??-1)>=0,low:c.crouch||c.prone,lean:c.lean});
 c.burst=fpsIntent.sprint&&(!pose?.footMode||!c.lean);c.aimMode=fpsIntent.aimMode;c.fire=fpsIntent.fire;
 c.facingYaw=footAim.commandYaw({aimMode:c.aimMode,fire:c.fire,lean:c.lean,brawl:brawling});
 canvas.dataset.fpsControls=combatPreferences.value.controlStyle;
 c.throttle=speedCruise.update(c.throttle,pose?.speed??0,DT,!!self?.alive&&!!pose&&!pose.footMode&&!session.state?.self?.controller.fields.crashed&&session.state?.phase==='active',c.dismount||c.recover);
 canvas.dataset.cruise=String(speedCruise.active);canvas.dataset.cruiseSpeed=String(speedCruise.targetSpeed);
 barrelBlocked=false;
 if(self&&pose&&!brawling&&!keys.has(bindings.freeLook)&&!held.has('free-look')&&camera.position.distanceTo(new T.Vector3(pose.x,pose.y,pose.z))<15&&(footAim.active||c.aimMode||viewMode==='first'||viewMode==='chase')){
  const facing={...pose,headingY:c.facingYaw??pose.headingY},w=WEAPONS[self.weapon],aim=fpsAim(facing,self.skin,facing.headingY+c.aimYaw+self.combat.kickYaw,aimPitch+self.combat.kickPitch,self.combat.aimBlend,self.combat.lean,activeTerrain(),session.state?.actors.filter(a=>a.id!==session.me)??[],{origin:camera.position,range:Math.min(600,w.speed*w.life/60),kickYaw:self.combat.kickYaw,kickPitch:self.combat.kickPitch,targets:practiceRange?.layout.targets,targetHeading:practiceRange?.layout.heading});
  c.aimYaw=aim.aimYaw;c.aimPitch=aim.aimPitch;barrelBlocked=aim.blocked;aimDistance=aim.distance;
 }
 if(self&&session.state?.self){const me=session.state.self,w=me.loadout[me.slot],mag=me.combat.magazine[w];
  if(session.room){const preview=shotPreview.sample({round:session.state.round,tick:session.state.tick,counter:me.combat.shotCounter,fire:c.fire,allowed:weaponReady(me.combat,session.state.tick)&&!c.holster&&session.state.phase==='active'&&me.alive&&!brawling&&!c.reload&&me.combat.reloadStart<0&&!paused&&!dialog.open,mode:me.combat.fireMode,magazine:mag,interval:WEAPONS[w].interval,weapon:w},performance.now());if(preview){localShotPending=true;royaleAudio.previewShot(w);}}
 }
 tap.clear();return c;
}
function clearActorViews(){for(const a of actors.values()){a.sparks.dispose();a.contrast.dispose();a.view.dispose();a.equipment.dispose();a.nameplate.dispose();a.shield.dispose();}actors.clear();}
function view(id:string,choice:string,wheelId:string){let a=actors.get(id);if(a&&a.view.riderId===riderChoice(choice)&&a.wheelId===wheelId)return a;if(a){a.sparks.dispose();a.contrast.dispose();a.nameplate.dispose();a.view.dispose();a.equipment.dispose();a.shield.dispose();}
 const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheelId).asset)!);const hero=new Hero(models,activeTerrain(),riderChoice(choice),'kimodo'),equipment=new WeaponView(equipmentLibrary),weapon=equipment.root;scene.add(hero.root,weapon);
 const optic=scopeLibrary.model();optic.position.set(0,.105,.08);weapon.add(optic);
 const shield=new ShieldEffect(shieldAsset);scene.add(shield);const nameplate=new PlayerNameplate();scene.add(nameplate.root);a={sparks:new PedalSparks(scene),nameplate,view:hero,equipment,weapon,shield,optic,rig:new CombatRig(hero,equipment),wheelId,motion:new RiderPresentation(),contrast:new OpponentContrast(hero.rider)};graphics.applyAssets(hero.root);graphics.applyAssets(weapon);graphics.applyAssets(shield);actors.set(id,a);return a;
}
const heartShots=new HeartProjectiles();scene.add(heartShots);
let renderedLife='';
function draw(now:number,xrFrame?:XRFrame){
 let stageAt=profileCpu?performance.now():0;
 const stage=(name:string)=>{if(profileCpu){const at=performance.now();drawStageLast[name]=at-stageAt;(drawStageSamples[name]??=[]).push(at-stageAt);stageAt=at;}};
 const telemetry=now-telemetryAt>200;if(telemetry)telemetryAt=now;
 session?.comms?.place(dialog.open?el('room'):undefined);
 const live=session?.state,life=live?.self?live.round+':'+live.self.spawnSerial:'';
 if(life&&life!==renderedLife){
  if(renderedLife){release();footAim.reset();cameraBlend.reset();deathReplay.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;slot=live!.self!.slot;predictionFrame=undefined;acc=0;}
  renderedLife=life;
  if(reentryRequested&&live?.self?.alive){reentryRequested=false;resume();}
 }

 firstPerson?.hide();
 const delta=equipmentTime?Math.min(.1,(now-equipmentTime)/1000):0;equipmentTime=now;
 const motionDelta=paused&&!session?.room?0:delta,reducedMotion=reducedEquipmentMotion.matches||document.documentElement.dataset.reducedMotion==='true'||query.has('reducedMotion');
 atmosphereSky.update(motionDelta,ROYALE_SUN,.42,0,graphics.current.shadows===0,reducedMotion,paused&&!session?.room,scene.fog?.color);if(telemetry)canvas.dataset.atmosphere=JSON.stringify(atmosphereSky.status);
 const replayFrame=deathReplay.sample(now);const replaying=!!replayFrame;const s=replayFrame?.state??session?.state;el('replay-status').hidden=!replaying;el('replay-status').querySelector('span')!.textContent=deathReplay.kind==='killer'?'Killer replay · attacker perspective':'Last-view replay · received positions only';el('replay-status').setAttribute('aria-label',deathReplay.kind==='killer'?'Killer replay':'Last-view replay');if(!s){savedGhost.suspend();matchFeedback.hide();tacticalReadout.hide();for(const a of actors.values()){a.sparks.reset();a.nameplate.root.visible=a.view.root.visible=a.weapon.visible=a.shield.visible=false;}companions?.dispose();jazzVisit?.stop();heartShots.reset();for(const m of items.values())m.root.visible=false;el('hud').hidden=el('reticle').hidden=el('scope-mask').hidden=true;return;}const rendered=new Set<string>();
 if(!replaying&&practiceRange?.update(s,session.me,now)){matchFeedback.hit(now,'range');royaleAudio.rangeHit();}
 radarMap?.update(s,now,!combatBlock&&!dialog.open&&!!s.self?.alive);
 const watching=!replaying?s.spectating:undefined;const focusId=watching?.target||session.me;
 const presentationTick=watching?(session.remotePoses.tick(now)??watching.tick??s.tick-180):s.tick;
 const smooth=!replaying&&(!paused||!!session.room)&&!layoutEditing&&(s.phase==='active'||s.phase==='deployment');
 const alpha=smooth?Math.min(1,acc/DT):1,basePoses=new Map<string,RidePose>();
 const previous=smooth&&session.previous?.round===s.round&&session.previous.tick===s.tick-1?session.previous:undefined;
 capture.update(!!s.self?.alive&&!dialog.open&&!paused&&!replaying);
 const deadForReplay=!!session.state?.self&&!session.state.self.alive;
 spectatorControls.hidden=(!watching&&!deadForReplay)||dialog.open||replaying||!!session.state?.self?.reentry.eligible||s.phase==='results'||s.phase==='lobby';
 spectatorLabel.textContent=watching?.target?'Watching '+(s.roster.find(r=>r.id===watching.target)?.name??'Rider')+' · 3s delay':'Preparing spectator view…';
 for(const button of spectatorControls.querySelectorAll<HTMLButtonElement>('[data-spectator-step]'))button.disabled=!watching||watching.choices.length<2;
 const bikeObserver=s.actors.find(a=>a.id===focusId)?.pose??terrain.spawns[0].position;
 if(equipmentRound!==s.round){jazzVisit?.stop();equipmentRound=s.round;companions?.dispose();selectedScope=null;ownedScopeKey='';ambientPacks?.restart(undefined,bikeObserver);canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks?.starts);seenShots.clear();seenImpacts.clear();fallenAt.clear();shieldSerial=-1;for(const a of actors.values()){a.motion=new RiderPresentation();a.sparks.reset();}impactEffect.reset();surfaceMarks.reset();deathReplay.reset();previousShotTick=-999;for(const item of items.values())item.dispose();items.clear();}
 ambientPacks?.update(delta,bikeObserver,!combatBlock&&!dialog.open,paused,s.actors.filter(a=>a.alive).map(a=>({id:a.id,...a.pose,radius:.65,height:1.8,kind:'rider' as const,vx:Math.sin(a.pose.headingY)*a.pose.speed,vz:Math.cos(a.pose.headingY)*a.pose.speed})));ambientPacks?.report(canvas,delta);
 smokeView.update(s.smokeClouds??[],s.tick,reducedMotion,graphics.current.maxPixels<=600000?16:28);combatReadout.update(s.self?.combat,s.self?.loadout[s.self.slot],s.tick);
 royaleAudio.update({...s,actors:[...s.actors,...(s.soundSources??[]).filter(a=>!s.actors.some(b=>a.id===b.id))]},session.me,!dialog.open&&!paused&&!replaying,!!session.comms?.inputBlocked,Math.atan2(-camera.matrixWorld.elements[8],-camera.matrixWorld.elements[10]),activeTerrain());canvas.dataset.audio=JSON.stringify(royaleAudio.status);
 const owned=s.self?.scopes??[],scopeKey=owned.join(',');if(scopeKey!==ownedScopeKey){selectedScope=bestScope(owned);ownedScopeKey=scopeKey;}if(selectedScope&&!owned.includes(selectedScope))selectedScope=null;
 const firing=new Set<string>();if(localShotPending&&!replaying){firing.add(session.me);localShotPending=false;}
 matchFeedback.update(s,session.me,now,dialog.open||paused||replaying,reducedMotion);
 if(s.self){if(shieldSerial===s.self.spawnSerial&&previousShield>0&&s.self.shield===0){actors.get(s.self.id)?.shield.hit(true);matchFeedback.shieldBreak(now);}previousShield=s.self.shield;shieldSerial=s.self.spawnSerial;}
 // Local online presentation is immediate; confirmed damage and projectile simulation stay authoritative.
 if(s.self&&s.self.shotAt!==previousShotTick){if(s.self.shotAt>=0&&s.tick-s.self.shotAt<12&&(!session.room||shotPreview.confirm(s.self.combat.shotCounter,now)))firing.add(s.self.id);previousShotTick=s.self.shotAt;}
 stage('setup');actorVisibility.update(camera);
 const riderCosts={create:0,pose:0,equipment:0,rig:0};let riderAt=0;
 const riderPart=(part:keyof typeof riderCosts)=>{if(profileCpu){const at=performance.now();riderCosts[part]+=at-riderAt;riderAt=at;}};
 for(const projectile of s.projectiles){const key=projectile.owner+':'+projectile.shot;if(!seenShots.has(key)){seenShots.add(key);if(projectile.owner!==s.self?.id)firing.add(projectile.owner);}}
 for(const actor of s.actors){riderAt=profileCpu?performance.now():0;const a=view(actor.id,actor.skin,actor.wheelId??'euc');riderPart('create');a.contrast.set(aimComfort.value.contrast&&actor.id!==session.me);if(!actor.alive&&!fallenAt.has(actor.id))fallenAt.set(actor.id,presentationTick);if(actor.alive)fallenAt.delete(actor.id);const falling=!actor.alive&&presentationTick-(fallenAt.get(actor.id)??presentationTick)<210;a.view.rider.visible=true;a.view.root.visible=actor.alive||falling;a.weapon.visible=actor.alive;a.shield.visible=actor.alive&&(actor.shieldActive||actor.protected||a.shield.reacting);a.shield.scale.setScalar(actor.protected&&!actor.shieldActive?.88:1);rendered.add(actor.id);let pose={...actor.pose};
  if(!replaying&&actor.id===session.me&&session.room&&session.prediction)pose=interpolateRenderPose(smooth&&predictionFrame?.round===s.round?previousRenderPose(predictionFrame,actor):undefined,session.prediction.controller.poseValue,alpha);
  else if(!replaying&&(session.room||watching))pose=session.remotePoses.pose(actor.id,pose,actor.spawnSerial,now);
  else if(!replaying)pose=interpolateRenderPose(previousRenderPose(previous?.actors.find(a=>a.id===actor.id),actor),pose,alpha);
  basePoses.set(actor.id,pose);
  if(actor.id!==focusId&&!actorVisibility.visible(pose,bikeObserver)){a.view.root.visible=a.weapon.visible=a.shield.visible=a.nameplate.root.visible=false;a.sparks.reset();continue;}
  const balancePose=watching?pose:!replaying&&actor.id===session.me&&session.room&&session.prediction?session.prediction.controller.poseValue:actor.pose;
  pose=a.motion.sample({...pose,seated:0},presentationTick,actor.alive,actor.spawnSerial,firing.has(actor.id),reducedMotion,s.phase==='results'&&s.winner===actor.id,motionDelta,balancePose);pose.stopFoot=0;a.view.combatLocomotion=actor.alive&&!actor.combat.melee?.brawl?weaponReadyAmount(actor.combat,presentationTick):0;a.view.apply({...pose,seated:0});a.sparks.update(motionDelta,pose,actor.alive&&!dialog.open&&!paused&&!replaying&&s.phase!=='results',reducedMotion);a.view.visibility.setFirstPerson(!!replayFrame?.focus&&actor.id===replayFrame.focus);const yaw=actor.id===session.me&&!replaying?(footAim.active?footAim.relative(pose):aimYaw):actor.aimYaw,pitch=actor.id===session.me&&!replaying?aimPitch:actor.aimPitch;
  riderPart('pose');a.optic.visible=!!(actor.id===session.me?selectedScope:actor.scope);a.equipment.select(actor.weapon);a.optic.position.fromArray(CAMERA_SIGHTS[actor.weapon]);if(firing.has(actor.id)&&a.equipment.fire(reducedMotion))equipmentShots++;a.equipment.update(motionDelta,reducedMotion);a.weapon.visible=actor.alive&&pose.crashBlend<.05&&s.phase!=='results';
  riderPart('equipment');if(firing.has(actor.id))a.rig.interruptPickup();
  if(actor.alive&&pose.crashBlend<.05&&s.phase!=='results')a.rig.apply({...pose,seated:0},yaw,pitch,actor.combat,presentationTick,(actor as typeof actor&{healingUntil?:number}).healingUntil||0);
  riderPart('rig');if(actor.id===session.me)canvas.dataset.rig=JSON.stringify({rider:actor.skin,wheel:actor.wheelId,rightError:a.rig.errorR,leftError:a.rig.errorL,supportLocked:a.rig.supportLocked});
  a.shield.position.set(pose.x,pose.y+1,pose.z);a.shield.rotation.y=pose.headingY-Math.PI/2;
  a.shield.update(motionDelta,reducedMotion,graphics.current.shadows===0,actor.shieldActive||actor.protected);
 }
 for(const [id,a]of actors)if(!rendered.has(id)){a.sparks.reset();a.nameplate.root.visible=false;a.view.root.visible=false;a.weapon.visible=false;a.shield.visible=false;}

 if(telemetry)canvas.dataset.pedalSparks=String([...actors.values()].reduce((n,a)=>n+a.sparks.count,0));
  stage('riders');if(profileCpu)for(const [name,cost]of Object.entries(riderCosts)){drawStageLast['rider-'+name]=cost;(drawStageSamples['rider-'+name]??=[]).push(cost);}
 const dogTick=watching?.tick??s.tick;
 const dogDisplayTick=!replaying&&(session.room||watching)?session.remotePoses.tick(now)??dogTick-3:dogTick-3+alpha;
 companions?.update(s.actors,s.roster,dogTick,motionDelta,graphics.current.shadows===0,reducedMotion,s.phase==='results'?s.winner:undefined,dogDisplayTick,p=>actorVisibility.visible(p,bikeObserver));canvas.dataset.companions=String(s.actors.filter(a=>a.alive).length);
 const ghostSelf=s.actors.find(a=>a.id===s.self?.id);
 savedGhost.update(motionDelta,ghostSelf?basePoses.get(ghostSelf.id)??ghostSelf.pose:undefined,(ghostSelf?.skin??'')+':'+(s.self?.wheelId??'euc'),!dialog.open&&!paused&&!replaying&&s.phase==='active',!!s.self?.alive&&s.phase==='active'&&!replaying&&!combatBlock&&!practiceRange);
 stage('dogs');
 const presentLoot=new Set(s.loot.map(item=>item.id));
 for(const loot of s.loot){
  const distance=Math.hypot(loot.p.x-bikeObserver.x,loot.p.z-bikeObserver.z);let item=items.get(loot.id);
  // The visibility range is unchanged. Do not instantiate every pickup across
  // downtown on match entry, or keep its hidden hierarchy updating forever.
  if(distance>=140){if(item){item.dispose();items.delete(loot.id);}continue;}
  if(!item){if(distance>=100)continue;item=isScope(loot.kind)?scopeLibrary.pickup(loot.kind):equipmentLibrary.create(loot.kind);items.set(loot.id,item);scene.add(item.root);}
  item.root.visible=distance<100;item.root.position.set(loot.p.x,loot.p.y+.65,loot.p.z);item.root.scale.setScalar(isScope(loot.kind)?1:1.7);if(item.root.visible)item.update(motionDelta,reducedMotion);
 }
 for(const [id,item]of items)if(!presentLoot.has(id)){item.dispose();items.delete(id);}
 if(telemetry)canvas.dataset.lootViews=JSON.stringify({allocated:items.size,available:s.loot.length});
 stage('pickups');
 canvas.dataset.equipmentShots=String(equipmentShots);canvas.dataset.equipmentWeapon=s.actors.find(a=>a.id===session.me)?.weapon??'';
 fieldRing.update(s.field.x,s.field.z,s.field.radius,(x,z)=>activeTerrain().ground(x,z).height);
 fieldRing.energize(s.tick/60,s.field.remaining,reducedMotion,graphics.current.shadows===0);
 nextRing.update(s.field.x,s.field.z,s.field.nextRadius,(x,z)=>activeTerrain().ground(x,z).height);
 canvas.dataset.field=JSON.stringify(s.field);
 stage('barrier');
 const self=s.actors.find(a=>a.id===focusId);if(self){const p=basePoses.get(self.id)??self.pose,mode=watching?0:self.combat.melee?.brawl?0:replaying?(self.combat.aimBlend>.8?2:0):aimMode(),ads=mode===2;
 if(!keys.has(bindings.freeLook)&&!held.has('free-look')){lookYaw*=Math.exp(-delta*10);lookPitch*=Math.exp(-delta*10);}
 const renderAimYaw=watching?self.aimYaw:footAim.active&&!replaying?footAim.relative(p):aimYaw;
 const renderPitch=watching?self.aimPitch:aimPitch;const heading=p.headingY+renderAimYaw+(watching?0:lookYaw)+self.combat.kickYaw,pitch=renderPitch+(watching?0:lookPitch)+self.combat.kickPitch;
 const scale=self.skin.startsWith('DS_Mascot_')?.48:1,socket=weaponSocket(p,self.skin,renderAimYaw,aimPitch,self.combat.aimBlend,self.combat.lean);
 const at=new T.Vector3(socket.grip.x,socket.grip.y+.10*scale,socket.grip.z),forward=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const comfort=aimComfort.value,blocked=activeTerrain().raycast(socket.muzzle,forward,.9);coverWarning.hidden=blocked===null&&!barrelBlocked;reticle.dataset.blocked=String(blocked!==null||barrelBlocked);reticle.dataset.outline=String(comfort.outline);reticle.style.setProperty('--reticle-color',comfort.reticleColor);reticle.style.setProperty('--reticle-size',(comfort.reticleSize+(ads?0:Math.min(14,Math.abs(p.speed)*.5+WEAPONS[self.weapon].spread*180+Math.abs(self.combat.kickPitch)*220)))+'px');
  const gameView=watching?'chase':capture.finder?'first':p.footMode?footView:viewMode;
 const activeMode=ads?'ads':mode===1&&gameView!=='first'?'shoulder':gameView;
 const profile=CAMERA_PROFILE.cameras.find(c=>c.mode===(activeMode==='shoulder'?'chase':activeMode))!;
 const eyeView=ads||gameView==='first';
 const angle=activeMode==='orbit'?p.headingY+lookYaw+renderAimYaw:heading;
 const mine=actors.get(self.id),sight=mine?.equipment.sight()??at;
 const desired=eyeView&&p.footMode?new T.Vector3().copy(combatFootEye(p,scale,self.combat.lean,activeTerrain())):eyeView?combatEye(sight,heading,pitch,scale,ads):
   activeMode==='chase'||activeMode==='shoulder'?combatChaseEye(at,heading,scale,combatPreferences.value.shoulder,activeMode==='shoulder'):
   at.clone().add(new T.Vector3(-Math.sin(angle)*profile.back+Math.cos(angle)*profile.side,profile.height,-Math.cos(angle)*profile.back-Math.sin(angle)*profile.side));
 const clearCombat=(eye:T.Vector3)=>{retractCombatCamera(eye,at,(o,d,max)=>activeTerrain().raycast(o,d,max),activeTerrain().ground(eye.x,eye.z,p.y).height);eye.y=underpassCameraHeight(activeTerrain(),eye,eye.y,p.y,1.9);return eye;};
 if(activeMode==='chase'||activeMode==='shoulder')clearCombat(desired);else clearRideCamera(activeTerrain(),desired,at,p.y);
 followStableSun(sun,p,ROYALE_SUN);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
 interactiveWater.update(p,paused||!!combatBlock);if(!combatBlock)scenery.update(p,now/1000);
 if(!vr?.active){camera.position.copy(desired);
 camera.lookAt(eyeView||activeMode==='chase'||activeMode==='shoulder'?desired.clone().addScaledVector(forward,100):at);
 if(eyeView&&p.footMode&&!reducedMotion)camera.rotateZ(-footLeanOffset(p,self.combat.lean).roll);
 camera.fov=ads?scopedFov(profile.fov,selectedScope):activeMode==='first'?combatPreferences.value.firstFov:activeMode==='chase'?combatPreferences.value.thirdFov:activeMode==='shoulder'?Math.max(50,combatPreferences.value.thirdFov-10):profile.fov;cameraBlend.apply(camera,(watching?'spectate-'+focusId+'-':'')+(p.footMode?'foot-':'ride-')+activeMode,delta,reducedMotion||!cameraTransitionsEnabled());
  if(activeMode==='chase'||activeMode==='shoulder')clearCombat(camera.position);else clearRideCamera(activeTerrain(),camera.position,at,p.y);if(capture.finder)camera.fov=2*Math.atan(Math.tan(62*Math.PI/360)/capture.zoom)*180/Math.PI;camera.updateProjectionMatrix();
 }else{const own=s.actors.find(a=>a.id===session.me),tracked=own?(basePoses.get(own.id)??own.pose):p;
  vr.update(tracked,(own?.skin.startsWith('DS_Mascot_')?.84:1.7)+(tracked.footMode?0:.25),xrFrame);
 }
 reticle.dataset.ads=String(ads);canvas.dataset.barrelBlocked=String(barrelBlocked);canvas.dataset.aimDistance=aimDistance.toFixed(1);
 const viewButton=el('touch').querySelector<HTMLButtonElement>('[data-action=camera]');if(viewButton){viewButton.textContent=gameView==='first'?'TPP':'FPP';viewButton.setAttribute('aria-label',gameView==='first'?'Switch to third person':'Switch to first person');}
 canvas.dataset.cameraMode=viewMode;canvas.dataset.cameraActive=activeMode;canvas.dataset.cameraFov=camera.fov.toFixed(2);
 if(telemetry)canvas.dataset.grounding=JSON.stringify({rider:{x:p.x,y:p.y,z:p.z},source:terrain.sourcePosition(p),floor:terrain.ground(p.x,p.z,p.y).height,park:{x:p.parkX,y:p.parkY,z:p.parkZ},dog:self.dog,camera:camera.position.toArray(),cameraFloor:terrain.ground(camera.position.x,camera.position.z,p.y).height});
 if(mine){mine.view.rider.visible=true;mine.view.visibility.setFirstPerson(eyeView||!!vr?.active);if(ads&&selectedScope)mine.weapon.visible=false;
  if(!vr?.active&&!watching&&eyeView&&self.alive&&!replaying&&p.crashBlend<.05&&s.phase!=='results'){
   if(!firstPerson||firstPerson.skin!==self.skin){firstPerson?.dispose();firstPerson=new FirstPersonView(assetMap,equipmentLibrary,riderChoice(self.skin));scene.add(firstPerson.root);}
   mine.view.rider.visible=false;mine.weapon.visible=false;mine.rig.hideHandheld();
   const presentation=firstPerson.update({...p,seated:0},self.combat,self.weapon,s.tick,renderAimYaw,aimPitch,camera,motionDelta,firing.has(self.id),ads,reducedMotion,activeTerrain(),s.self?.healingUntil||0,combatPreferences.value.controlStyle==='burntwax',ads&&!!selectedScope);
   canvas.dataset.fpsPresentation=JSON.stringify(presentation);
    if(capture.finder)firstPerson.root.visible=false;
  }else canvas.dataset.fpsPresentation='world';
  if(vr?.active){if(self.id===session.me){mine.view.rider.visible=false;mine.weapon.visible=false;mine.rig.hideHandheld();}
   vrWeapon??=new WeaponView(equipmentLibrary);if(vrWeapon.root.parent!==vr.weaponMount)vr.weaponMount.add(vrWeapon.root);
   vrWeapon.select(self.weapon);vrWeapon.root.rotation.y=Math.PI;vrWeapon.root.position.set(0,.075,-.06);
   vrWeapon.root.visible=!watching&&self.alive&&weaponReady(self.combat,s.tick)&&p.footMode!==3;
   if(firing.has(self.id))vrWeapon.fire(reducedMotion);vrWeapon.update(motionDelta,reducedMotion);canvas.dataset.fpsPresentation='tracked-vr-gloves';
  }
 }
 el('scope-mask').hidden=!!vr?.active||!ads||!selectedScope||dialog.open||!self.alive;
 el('scope-magnification').textContent=selectedScope?SCOPES[selectedScope].label:'';
 if(telemetry)canvas.dataset.optics=JSON.stringify({selected:selectedScope,owned,zoom:ads?scopeZoom(selectedScope):1,available:s.loot.filter(l=>isScope(l.kind)).length});
 if(telemetry)canvas.dataset.aim=JSON.stringify({yaw:renderAimYaw,worldYaw:heading,freeFootAim:footAim.active,pitch:aimPitch,ads,steer,throttle,fire:mouseCombat.canFire||held.has('fire')||held.has('fire-left'),lean:self.combat.lean,crouch:p.footCrouch,prone:p.footProne,footMode:p.footMode});for(const direction of [-1,1]){const b=el('touch').querySelector<HTMLButtonElement>(direction<0?'[data-action=lean-left]':'[data-action=lean-right]');b?.setAttribute('aria-pressed',String(self.combat.lean*direction>.1));}
 for(const [action,pressed]of [['crouch',p.footMode?p.footCrouch>.5:stanceGesture.value===1],['prone',p.footProne>.5]] as const)el('touch').querySelector('[data-action='+action+']')?.setAttribute('aria-pressed',String(pressed));
 jazzVisit?.update(p.x,p.z,!watching&&!dialog.open&&!replaying&&self.alive&&!session.room);
 const adsButton=el('touch').querySelector<HTMLButtonElement>('[data-action=aim]')!;adsButton.setAttribute('aria-pressed',String(ads));
 stage('cameraScenery');

 }
 if(replayFrame&&!vr?.active){camera.position.fromArray(replayFrame.camera.position);camera.quaternion.fromArray(replayFrame.camera.quaternion);camera.fov=replayFrame.camera.fov;camera.updateProjectionMatrix();}else deathReplay.observe(s,now,{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov});if(!replaying)deathReplay.installKillcam(session.killcam);
 for(const actor of s.actors){const a=actors.get(actor.id)!;if(!session.room){a.nameplate.root.visible=false;continue;}const rider=s.roster.find(r=>r.id===actor.id);if(a.view.head)a.view.head.getWorldPosition(nameHead);else nameHead.set(actor.pose.x,actor.pose.y+1.8,actor.pose.z);a.nameplate.update(rider?.name??'Rider',!!rider?.bot,nameHead,camera,!!session.room&&!dialog.open&&a.view.root.visible&&actor.id!==(replayFrame?.focus??session.me));}
 const liveDeath=session.state?.self;const killedText=liveDeath&&!liveDeath.alive?eliminationLabel(liveDeath.elimination):'';
 el('eliminated-by').textContent=killedText;el('eliminated-by').hidden=!killedText;el('reentry-killer').textContent=killedText;
 if(telemetry)canvas.dataset.playerNames=JSON.stringify([...actors.values()].filter(a=>a.nameplate.root.visible).map(a=>a.nameplate.root.name));
 el('death-replay').textContent=el('reentry-replay').textContent=spectatorReplay.textContent=deathReplay.kind==='killer'?'Watch killer replay':'Watch last-view replay';
 const replayAvailable=deathReplay.available&&!!liveDeath&&!liveDeath.alive;
 spectatorReplay.hidden=!replayAvailable;spectatorReplay.disabled=!replayAvailable;
 el<HTMLButtonElement>('reentry-replay').disabled=!replayAvailable;el('death-replay').hidden=!replayAvailable;
 if(!replaying)for(const e of s.events){if(e.kind.startsWith('pickup')&&s.tick-e.tick<40){actors.get(e.actor)?.rig.pickup(e.tick);if(e.actor===session.me)firstPerson?.pickup(e.tick);}if(e.kind!=='hit'&&e.kind!=='dog-knockoff'&&e.kind!=='melee-hit')continue;const key=s.round+':'+e.tick+':'+e.kind+':'+e.actor+':'+e.target;if(seenImpacts.has(key))continue;seenImpacts.add(key);if(s.tick-e.tick>30)continue;const victim=s.actors.find(a=>a.id===e.target);if(victim){impactEffect.hit(victim.pose,now,victim.shieldActive);const attacker=s.actors.find(a=>a.id===e.actor),relative=attacker?Math.atan2(attacker.pose.x-victim.pose.x,attacker.pose.z-victim.pose.z)-victim.pose.headingY:undefined;actors.get(victim.id)?.motion.hit(relative===undefined?0:Math.sin(relative),relative===undefined?1:Math.cos(relative));if(victim.shieldActive||victim.id===s.self?.id&&s.self.shield>0)actors.get(victim.id)?.shield.hit();if(e.target===session.me)matchFeedback.damage(now,relative===undefined?undefined:relative-aimYaw-lookYaw);}
 if(e.target===session.me){hitFlashUntil=now+450;el('hit-flash').dataset.kind=e.kind==='dog-knockoff'?'knockdown':'bullet';}}
 if(seenImpacts.size>128){const oldest=seenImpacts.values().next().value;if(oldest)seenImpacts.delete(oldest);}
 surfaceMarks.visible=!replaying;surfaceMarks.update(s.impacts??[],now);canvas.dataset.surfaceMarks=String(surfaceMarks.count);impactEffect.visible=!replaying;impactEffect.update(now,reducedMotion);el('hit-flash').style.opacity=now<hitFlashUntil?'1':'0';
 heartShots.update(s.projectiles,camera,now/1000,reducedMotion);
 stage('feedback');
 canvas.dataset.projectileEffect='hearts-and-sparkles';canvas.dataset.animationPass='rider-weight;confirmed-hit;shield-ripple;field-energy;dog-interpolation;full-fall;match-moments';
 if(now-hudAt>150){hudAt=now;const me=s.self;el('hud').hidden=false;for(const [action,label,until]of [['dog-attack','Dog',me?.dogPower.ready??0],['dog-radar','Radar',me?.dogPower.radarReady??0]] as const){const b=el('touch').querySelector<HTMLButtonElement>('[data-action='+action+']')!;b.disabled=!me?.dogPower.charges||until>s.tick;b.textContent=until>s.tick?label+' '+Math.ceil((until-s.tick)/60)+'s':label+' '+(me?.dogPower.charges??0);}el('phase-count').textContent=s.phase==='deployment'?'Deploying · '+Math.ceil((PROTECTION-s.tick)/60)+'s':s.remaining+(s.remaining===1?' rider alive':' riders alive');el('phase-round').textContent=practiceRange?'Shooting range':'Round '+(s.series.number||1)+'/'+s.series.total;
  const liveSelf=session.state?.self;const eligible=!!liveSelf?.reentry.eligible&&!dialog.open&&!replaying;el('reentry-panel').hidden=!eligible;el('reentry-countdown').textContent=liveSelf?'Choose within '+Math.max(0,Math.ceil((liveSelf.reentry.until-(session.state?.tick??0))/60))+'s. Ten seconds of protection; fighting ends it.':'';const stock=liveSelf?.reentry.remaining??0;el('respawn-stock').textContent=practiceRange?'Solo drills · your pace':combatBlock?'Local training · restart from Menu':liveSelf&&!liveSelf.alive&&!liveSelf.reentry.eligible?'Respawn window closed · spectating':'Respawns left · '+stock+' / 3';el('reentry-title').textContent='Eliminated · '+stock+' respawn'+(stock===1?'':'s')+' left';el('reentry-confirm').textContent='Respawn · '+stock+' left';
  const location=el<HTMLSelectElement>('respawn-location'),choices=liveSelf?.reentry.choices??[],signature=JSON.stringify(choices);if(location.dataset.choices!==signature){const selected=location.value;location.replaceChildren(new Option('Safest available location',''),...choices.map(n=>new Option(n.label,n.id)));if(choices.some(n=>n.id===selected))location.value=selected;location.dataset.choices=signature;}
  location.disabled=!choices.length;el<HTMLButtonElement>('reentry-confirm').disabled=!eligible||!choices.length;if(eligible&&!choices.length)el('reentry-confirm').textContent='Waiting for a safe location…';el('respawn-availability').textContent=eligible&&!choices.length?'No safe point right now. Checking for openings…':eligible&&/respawn|Re-entry|re-entry/i.test(session.message)?session.message:'';
  el<HTMLProgressElement>('health-meter').value=me?.integrity??0;el('health-value').textContent=String(Math.ceil(me?.integrity??0));el<HTMLProgressElement>('shield-meter').value=me?.shield??0;el('shield-value').textContent=String(Math.ceil(me?.shield??0));const healing=!!me&&me.healingUntil>s.tick;el('health-feedback').textContent=healing?'Healing · '+Math.ceil((me!.healingUntil-s.tick)/60)+'s':me?.reentry.protectedUntil&&me.reentry.protectedUntil>s.tick?'Protected · '+Math.ceil((me.reentry.protectedUntil-s.tick)/60)+'s · combat cancels':me?'Health packs · '+me.repairs+' · H to heal':'';const healthButton=el('touch').querySelector<HTMLButtonElement>('[data-action=repair]')!;healthButton.textContent=healing?'Healing…':'Heal '+(me?.repairs??0);healthButton.disabled=!me?.repairs||healing||!me.alive||me.integrity>=100;
  el('vitals').textContent=me?'Integrity '+Math.ceil(me.integrity)+' / Shield '+Math.ceil(me.shield)+' / Flow '+Math.round(me.energy):'Spectator · 3-second delayed follow';
  const brawling=!!me?.combat.melee?.brawl,foot=self?.pose.footMode===2;for(const [action,label]of [['fire',capture.active?'Photo':brawling?'Jab':'Fire'],['reload',brawling?'Kick / palm':'Reload'],['brawl',brawling?'Weapon':'Brawl']] as const)el('touch').querySelector<HTMLButtonElement>('[data-action='+action+']')!.textContent=label;el<HTMLButtonElement>('touch').querySelector<HTMLButtonElement>('[data-action=brawl]')!.disabled=!foot;el<HTMLButtonElement>('touch').querySelector<HTMLButtonElement>('[data-action=evade]')!.disabled=!foot;
  const w=me?.loadout[me.slot];el('weapon').textContent=brawling?'Brawl stance · click / Jab to strike · R / Kick for heavy':w?WEAPONS[w].name+' · '+me!.combat.magazine[w]+' / '+(me!.ammo[w]-me!.combat.magazine[w])+' · '+FIRE_MODES[me!.combat.fireMode]+(me!.combat.reloadStart>=0?' · Reloading…':''):'';
  const holsterButton=el('touch').querySelector<HTMLButtonElement>('[data-action=holster]')!;
  const holstered=!!me?.combat.holster?.stowed,handling=(me?.combat.holster?.end??0)>s.tick;
  holsterButton.textContent=handling?(holstered?'Stowing…':'Drawing…'):holstered?'Draw':'Holster';holsterButton.disabled=handling;holsterButton.setAttribute('aria-pressed',String(holstered));
  if(holstered||handling)el('weapon').textContent=handling?(holstered?'Holstering weapon…':'Drawing weapon…'):'Weapon holstered · tap Draw or '+bindings.holster.replace('Digit','');
  const empty=!!w&&!brawling&&!holstered&&!handling&&me!.combat.magazine[w]===0;el('weapon').dataset.empty=String(empty);el('touch').querySelector<HTMLElement>('[data-action=reload]')!.dataset.needed=String(empty);if(empty&&me!.combat.reloadStart<0)el('weapon').textContent+=me!.ammo[w!]>0?' · Reload':' · Out of ammo';
  recoverQuick.hidden=!me?.alive||replaying||!(me.controller.fields.crashed||(self?.pose.footStagger??0)>.1);
  recoverQuick.disabled=self?.pose.footMode===3;
  recoverQuick.textContent=recoverQuick.disabled?'Picking up wheel…':me&&me.integrity<=15?'Heal to remount':(self?.pose.footStagger??0)>0?'Recover · queue get-up':'Recover · '+bindings.recover.replace(/^(Key|Digit)/,'');
  recoverQuick.title='Get back up and remount when near your wheel';
  const scopeKeyLabel=bindings.scope.replace(/^(Key|Digit)/,'');const scopeLabel=selectedScope?SCOPES[selectedScope].label:'Iron sights';el('scope-select').textContent='Scope · '+scopeLabel+' · '+scopeKeyLabel;el<HTMLButtonElement>('scope-select').disabled=!owned.length;el<HTMLButtonElement>('scope-select').title=owned.length?'Switch collected scopes':'Find a scope and ride or walk over it';
  const scopeTouch=el('touch').querySelector<HTMLButtonElement>('[data-action=scope]')!;scopeTouch.textContent=selectedScope?SCOPES[selectedScope].zoom+'×':'Scope';scopeTouch.disabled=!owned.length;
  if(me&&!layoutEditing){
   const profile=w?WEAPONS[w]:undefined,magazine=w?me.combat.magazine[w]:0;
   const canSwap=!!self&&me.loadout.length>=2&&s.loot.some(l=>l.available&&(l.kind==='static'||l.kind==='heart'||l.kind==='bass')&&!me.loadout.includes(l.kind)&&Math.hypot(l.p.x-self.pose.x,l.p.z-self.pose.z)<=2.5);
   const reloadButton=el('touch').querySelector<HTMLButtonElement>('[data-action=reload]')!;reloadButton.disabled=!brawling&&(me.combat.reloadStart>=0||!w||magazine>=(profile?.magazine??0)||me.ammo[w]<=magazine);reloadButton.title=brawling?'Heavy melee attack':me.combat.reloadStart>=0?'Reloading':!w||me.ammo[w]<=magazine?'No reserve ammunition':magazine>=(profile?.magazine??0)?'Magazine full':'Reload weapon';
   const vaultEligible=!!self&&foot&&!self.pose.footVault&&!self.pose.footEvade;
   if(!vaultEligible){vaultHint.available=false;vaultHint.tick=-Infinity;}
   else if(vaultHint.round!==s.round||s.tick<vaultHint.tick||s.tick-vaultHint.tick>=8){vaultHint.available=!!findVault(activeTerrain(),self!.pose);vaultHint.tick=s.tick;vaultHint.round=s.round;}
   const canVault=vaultEligible&&vaultHint.available;const smokeButton=el('touch').querySelector<HTMLButtonElement>('[data-action=smoke]')!;smokeButton.textContent='Smoke · '+(me.smokeCharges??0);smokeButton.disabled=!tacticalStatus('smoke',tacticalContext(s,canVault)).available;el('touch').querySelector<HTMLButtonElement>('[data-action=evade]')!.disabled=!tacticalStatus('evade',tacticalContext(s,canVault)).available;
   const visible=contextualActions({canVault,smokeCharges:me.smokeCharges??0,nearWheel:!!self&&Math.hypot(self.pose.x-self.pose.parkX,self.pose.z-self.pose.parkZ)<1.3,foot,brawling,crashed:!!me.controller.fields.crashed,dogCharges:me.dogPower.charges,scopes:owned.length,weapons:me.loadout.length,health:me.integrity,healthPacks:me.repairs,healing,shields:me.utility,canSwap,magazine,capacity:profile?.magazine??0,reserve:w?me.ammo[w]-magazine:0,reloading:me.combat.reloadStart>=0,fireModes:profile?.modes??0});
   for(const b of el('touch').querySelectorAll<HTMLButtonElement>('button[data-action]')){const action=b.dataset.action!;if(!b.classList.contains('active'))b.hidden=visible[action]===false||(aimComfort.value.simple&&!controlsExpanded&&!SIMPLE_ACTIONS.has(action));if(b.hidden)held.delete(action);}
   el('scope-select').hidden=!visible.scope;el('touch').dataset.simple=String(aimComfort.value.simple);el('touch').dataset.expanded=String(controlsExpanded);moreControls.hidden=!aimComfort.value.simple;
  }
  const nearby=s.loot.filter(l=>isScope(l.kind)).map(l=>({l,d:Math.hypot(l.p.x-bikeObserver.x,l.p.z-bikeObserver.z)})).sort((a,b)=>a.d-b.d)[0];
  const pickup=s.events.filter(e=>e.actor===session.me&&e.kind.startsWith('pickup-scope')&&s.tick-e.tick<180).at(-1);
  el('scope-status').textContent=pickup?'Collected '+SCOPES[pickup.kind.slice(7) as Scope].label+' · Scope / '+scopeKeyLabel+' to switch':nearby&&nearby.d<30?SCOPES[nearby.l.kind as Scope].label+' · '+Math.ceil(nearby.d)+' m · ride or walk over to collect':'';
  el('speed').textContent=self?(foot?'On foot':Math.round(Math.abs(self.pose.speed)*3.6)+' km/h'+(speedCruise.active?' · '+speedCruise.label:'')):'';
  el('field').hidden=!!practiceRange;el('field').textContent=(fieldStageAt(s.tick).closing?'Barrier closing · ':'Barrier holds · ')+Math.ceil(s.field.remaining)+'s · '+Math.round(s.field.radius)+'m → '+Math.round(s.field.nextRadius)+'m';
  el('reticle').hidden=!me?.alive||dialog.open||!!(selectedScope&&aimMode()===2)||(!footAim.active&&!aimMode()&&viewMode!=='chase'&&viewMode!=='first');el('touch').hidden=(!(touchDisplay==='on'||touchDisplay==='auto'&&matchMedia('(any-pointer:coarse)').matches)||dialog.open||replaying||!me?.alive)&&!layoutEditing;
  visibleTouchLayout.fit(el('touch'));
   tacticalReadout.update(tacticalContext(s,!!self&&self.pose.footMode===2&&vaultHint.available),bindings,now,dialog.open||paused||replaying||layoutEditing,!el('touch').hidden);
   el('hint').textContent=capture.active?'Camera mode · Photo / fire: shutter · '+bindings.captureRecord.replace('Key','')+': record · '+bindings.captureMode.replace('Key','')+': combat':layoutEditing?'Move controls, then open Menu to finish.':empty&&me!.combat.reloadStart<0?(me!.ammo[w!]>0?'Empty magazine · tap Reload or '+bindings.reload.replace(/^Key/,''):'Out of ammunition · find ammo or switch weapon'):!footAim.active&&Math.abs(aimYaw)>1.20?'Turn toward your target to aim farther.':replaying?(deathReplay.kind==='killer'?'Killer perspective · recorded by the server':'Last-view replay'):me&&!me.alive?me.reentry.eligible?'Eliminated · choose a respawn location':replayAvailable?(deathReplay.kind==='killer'?'Eliminated · killer replay available':'Eliminated · last-view replay available'):'Eliminated · spectating':s.phase==='deployment'?'Spawn protection · weapons unlock when the countdown ends':me&&Math.hypot((self?.pose.x??0)-s.field.x,(self?.pose.z??0)-s.field.z)>s.field.radius?'Outside the Static Field — ride toward the gold circle!':!el('touch').hidden?(foot?'Left stick: walk · right side: aim · Wheel: return to ride':speedCruise.active?speedCruise.label+' · pull down to cancel':'Left stick: push up twice for cruise · right side: aim'):foot?'WASD move · Shift sprint · L evade · Y vault · M smoke · Q/E lean · J wheel':'WASD ride · mouse aim · click fire · right click ADS · R reload · J get off/on';
  el('room').hidden=!session.room;el('roomcode').textContent='Room '+session.code+(session.botFill?' · AI fill on':' · '+s.size+' human seats · AI fill off');
  el('ready').hidden=session.ready.includes(session.me);const inRoom=!!session.room;el<HTMLInputElement>('code').closest('label')!.hidden=inRoom;el('create').hidden=el('join').hidden=inRoom;if(inRoom&&s.phase==='lobby')el('online-status').textContent='Room '+session.code+' · '+(session.ready.includes(session.me)?'You’re ready':'Preparing your rider…')+(session.host===session.me?' · Share invite, then Start match.':' · Waiting for the host to start.');
  el<HTMLButtonElement>('launch').disabled=session.host!==session.me;const rosterKey=s.roster.map(a=>a.id+':'+a.name+':'+a.connected+':'+session.ready.includes(a.id)).join('|');if(rosterKey!==rosterSignature){rosterSignature=rosterKey;el('roster').replaceChildren(...s.roster.map(a=>{const li=document.createElement('li');li.textContent=a.name+(a.bot?' · AI':session.ready.includes(a.id)?' · Ready':' · Loading / not ready')+(!a.connected?' · Disconnected':'');return li;}));}
  if(dialog.open)menuHome.sync();
  if(session.message)message(session.message);
  if(s.phase==='lobby'&&!dialog.open){showMenu();}if(s.phase==='deployment'&&dialog.open&&session.room){resume();}
  if(s.phase==='results'){if(!dialog.open&&!replaying&&now-matchFeedback.resultsStarted>2600)showMenu();el('rematch').hidden=false;el<HTMLButtonElement>('rematch').disabled=!!session.room&&session.host!==session.me;el('rematch').textContent=session.room&&session.host!==session.me?'Waiting for host':s.series.complete?'New '+s.series.total+'-round match':'Next round '+(s.series.number+1)+' / '+s.series.total;const stats=s.results.find(r=>r.id===session.me);roundResults(el('results'),{winner:s.winner===session.me?'YOU WIN':s.winner?(s.roster.find(a=>a.id===s.winner)?.name??'Rider')+' WINS':'DRAW',reason:s.reason,kills:stats?.kills??0,damage:stats?.damage??0,distance:stats?.distance??0,eliminatedBy:killedText,round:s.series.number,rounds:s.series.total,complete:s.series.complete,standings:s.series.standings,self:session.me,matchWinner:s.series.winner?(s.series.standings.find(r=>r.id===s.series.winner)?.name??'Rider')+' wins the match':'Match tied'});}
 }
}
window.addEventListener('resize',()=>{release();graphics.resize();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();loadLayout();});
camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
const schedule=new FrameSchedule(),adaptiveQuality=new AdaptiveQuality();let loadedAt=Infinity,frames=0,profileAt=performance.now(),samples:number[]=[],previousFrame=performance.now();
const profileCpu=query.has('profile');setSimulationProfiling(profileCpu);let pendingSimulationMs=0,cpuSamples:{simulation:number;presentation:number;submission:number}[]=[];
 let drawStageSamples:Record<string,number[]>={},drawStageLast:Record<string,number>={};
 // Keep bounded, correlated opening spikes: a delayed callback belongs to the
 // preceding submitted frame, not necessarily to the work about to run.
 let openingTrace:unknown[]=[],previousWork:unknown;
function loop(now:number,xrFrame?:XRFrame){const rawFrameMs=now-last,delta=Math.min(.15,rawFrameMs/1000);last=now;if(document.hidden){startupFrames.pause();return;}if(preparingMatch){if(vr?.active)renderer.render(scene,camera);return;}
 if(!loaded||(!session?.state&&el<HTMLDialogElement>('royale-startup').open))return;
 if(vr?.active){
  const own=session?.state?.actors.find(a=>a.id===session.me),p=session?.prediction?.controller.poseValue??own?.pose;
  if(p)vr.update(p,(own?.skin.startsWith('DS_Mascot_')?.84:1.7)+(p.footMode?0:.25),xrFrame);
  vrPacket=vr.poll();for(const key of ['reload','mount','recover','hop','heal','holster','switch'] as const)if(vrPacket[key])vrEdges.add(key);
  vr.snap(vrPacket.snap);
  if(vrPacket.pause){if(paused||dialog.open)resume();else showMenu();}
  if(vrEdges.has('reload')&&session?.state){
   if(session.state.self?.reentry.eligible&&!el<HTMLButtonElement>('reentry-confirm').disabled){vrEdges.delete('reload');el('reentry-confirm').click();}
   else if(session.state.phase==='results'){vrEdges.delete('reload');el('rematch').click();}
  }
 }
 const cpuStart=performance.now();let simulationSteps=0;
 const idle=paused||dialog.open||layoutEditing||!session?.state||session.state.phase==='results';
  circuitRace.update(delta,!!session?.state?.self?.alive&&!dialog.open&&!capture.active&&!deathReplay.playing&&!vr?.active&&session.state.phase!=='results',idle||document.hidden);
 if(graphics.choice!=='auto')adaptiveQuality.reset();
 if(adaptiveQuality.sample(rawFrameMs,loaded&&!idle&&!vr?.active&&graphics.choice==='auto'&&now-loadedAt>5000,graphics.current.fps)){graphics.setAdaptiveDetail(adaptiveQuality.detail);graphics.setResolutionScale(adaptiveQuality.scale);}
 const connection=session?.connectionStatus(now);el('connection-status').hidden=!connection?.text||dialog.open;el('connection-text').textContent=connection?.text??'';canvas.dataset.connection=connection?.state??'offline';
 if(!session?.state||session.state.phase!=='results')clearResults();
 footControls.update(session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose??{},loaded&&!dialog.open&&!!session?.state?.self?.alive,true,(session?.state?.self?.integrity??100)<=15);
 if(loaded&&session.state&&(!paused||session.room)&&!layoutEditing){acc+=delta;let n=0;while(acc>=DT&&n++<9){
  try{
   const self=session.state.self;
   predictionFrame=session.room&&session.prediction&&self?{round:session.state.round,id:self.id,spawnSerial:self.spawnSerial,alive:self.alive,pose:{...session.prediction.controller.poseValue}}:undefined;
   session.step(dialog.open||paused||deathReplay.playing||capture.reviewing||session.comms?.inputBlocked?neutral(session.state.round):command());
  simulationSteps++;}catch(error){paused=true;release();showMenu();message('The simulation stopped safely. Start a new practice or reconnect: '+(error as Error).message);break;}acc-=DT;
 }}else acc=0;
 pendingSimulationMs+=performance.now()-cpuStart;
 if(!vr?.active&&!schedule.shouldRender(now,idle,false,graphics.current.fps))return;
 const viewStart=performance.now();draw(now,xrFrame);
 if(vr?.active){const me=session?.state?.self,w=me?.loadout[me.slot];vr.hudText([
  paused||dialog.open?'PAUSED · Left Y resumes':session?.state?.phase==='results'?'ROUND COMPLETE · Right A continues':!me?.alive?me?.reentry.eligible?'ELIMINATED · Right A respawns':'ELIMINATED · waiting for next round':'STATIC ROYALE · '+(session?.state?.remaining??0)+' riders',
  'Health '+Math.ceil(me?.integrity??0)+' · Ammo '+(w?me?.combat.magazine[w]:0),
  vrAimBlocked?'Turn the wheel toward your target before firing':'Left stick move · Right trigger fire · Left trigger aim',
  'Right A reload · B mount · Left X recover · Y pause',
  'Left grip + A: heal / B: holster · Right stick click: weapon'
 ]);}
  const submitStart=performance.now();renderer.info.autoReset=false;renderer.info.reset();
  if(firstPerson){firstPerson.rearLcd.render(renderer,scene,camera,firstPerson.root,now,graphics.current.fps<=30);canvas.dataset.cameraRearLcd=JSON.stringify(firstPerson.rearLcd.status);}
  else renderer.render(scene,camera);
  capture.afterRender(now);lcdViewfinder.render(renderer,capture.finder&&!vr?.active);
  if(capture.finder)canvas.dataset.viewfinderCost=JSON.stringify(lcdViewfinder.status);
 if(profileCpu)cpuSamples.push({simulation:pendingSimulationMs,presentation:submitStart-viewStart,submission:performance.now()-submitStart});
 if(session?.state?.round!==profileRound){profileRound=session?.state?.round??'';startupFrames.reset();openingTrace=[];previousWork=undefined;}
 if(profileCpu){const work={simulationSteps,rawFrameMs,simulation:pendingSimulationMs,presentation:submitStart-viewStart,submission:performance.now()-submitStart,stages:{...drawStageLast},actors:actors.size,visibleActors:session?.state?.actors.length??0,loot:items.size,programs:renderer.info.programs?.length,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,calls:renderer.info.render.calls};
  if(!idle&&startupFrames.activeMs<30000&&now-previousFrame>40&&openingTrace.length<60)openingTrace.push({at:startupFrames.activeMs,gap:now-previousFrame,previous:previousWork,current:work});previousWork=idle?undefined:work;
 }
 if(idle)startupFrames.pause();else startupFrames.sample(now,pendingSimulationMs+performance.now()-viewStart,session?.state?.remaining??0);pendingSimulationMs=0;
 samples.push(now-previousFrame);previousFrame=now;frames++;
 if(profileCpu&&now-profileAt>2000){canvas.dataset.simulationProfile=JSON.stringify({seed:session?.match?.seed,costs:takeSimulationProfile()});canvas.dataset.openingTrace=JSON.stringify(openingTrace);const summary=(values:number[])=>{values.sort((a,b)=>a-b);return {p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};};canvas.dataset.cpuProfile=JSON.stringify({simulationAndInputMs:summary(cpuSamples.map(s=>s.simulation)),presentationMs:summary(cpuSamples.map(s=>s.presentation)),renderSubmissionAndCaptureMs:summary(cpuSamples.map(s=>s.submission)),drawStages:Object.fromEntries(Object.entries(drawStageSamples).map(([key,values])=>[key,summary(values)])),gpuMs:null});cpuSamples=[];drawStageSamples={};}
 if(now-profileAt>2000){canvas.dataset.startupFrames=JSON.stringify(startupFrames.report);samples.sort((a,b)=>a-b);if(session?.state?.engine){canvas.dataset.engineModule=session.state.engine.module;canvas.dataset.engineFrames=String(session.state.engineInputFrames);canvas.dataset.engineTick=String(session.state.tick);}canvas.dataset.profile=JSON.stringify({fps:frames*1000/(now-profileAt),p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],maxFrameMs:samples.at(-1),sampleFrames:samples.length,lateFrames:samples.filter(ms=>ms>1000/graphics.current.fps+2).length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,actors:session?.state?.actors.length??0,aliveActors:session?.state?.actors.filter(a=>a.alive).length??0,lightBudget:lightingBudget.status,idle,scale:adaptiveQuality.scale,detail:adaptiveQuality.detail});frames=0;profileAt=now;samples=[];}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();paused=true;showMenu();message('Graphics paused. Reload the page to restore the arena.');});
vr=new RoyaleVR(renderer,scene,camera,el('camera-settings'),{
 ready:()=>loaded&&!preparingMatch&&!!session?.state?.self?.alive,
 unlock:()=>{void royaleAudio.unlock();},
 enter:()=>{release();deathReplay.stop();cameraBlend.reset();resume();canvas.dataset.vr='immersive';},
 exit:()=>{release();cameraBlend.reset();vrWeapon?.root.removeFromParent();delete canvas.dataset.vr;showMenu();},
 pause:()=>{release();showMenu();}
});
renderer.setAnimationLoop(loop);void prepare().catch(failStartup);
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);vr?.dispose();vrWeapon?.dispose();capture.dispose();firstPerson?.dispose();royaleAudio.dispose();session?.leave();combatBlock?.dispose();practiceRange?.dispose();for(const a of actors.values()){a.sparks.dispose();a.contrast.dispose();a.nameplate.dispose();a.view.dispose();a.equipment.dispose();a.shield.dispose();}for(const item of items.values())item.dispose();equipmentLibrary?.dispose();scopeLibrary?.dispose();terrain?.terrain.dispose();fieldRing.dispose();nextRing.dispose();atmosphereSky.dispose();impactEffect.dispose();surfaceMarks.dispose();renderer.dispose();});










