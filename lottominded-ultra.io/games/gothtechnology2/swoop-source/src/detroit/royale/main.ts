import {fpsAim} from './fpsAim.ts';
import {FirstPersonView} from './firstPersonView.ts';
import {footEyeHeight} from './fpsMotion.ts';
import {parseRoomInvitation,roomInvitationLink} from '../../../../ride-core/src/roomInvitation.ts';
import {PlayerNameplate} from './playerNameplate.ts';
import {eliminationLabel} from './playerIdentity.ts';
import {RoyaleAudio} from './audio.ts';
const royaleAudio=new RoyaleAudio();
import {CombatBlockTerrain} from '../../../../ride-core/src/royale/combatBlock.ts';
import {CombatBlockView} from './combatBlockView.ts';
import {PracticeRangeView} from './practiceRangeView.ts';
let combatBlock:CombatBlockView|undefined;
let practiceRange:PracticeRangeView|undefined;
const activeTerrain=()=>combatBlock?.terrain??practiceRange?.layout.terrain??terrain;
function closeRange(){if(combatBlock){session.leave();combatBlock.dispose();combatBlock=undefined;scenery.root.visible=true;companions?.dispose();companions=new RoyaleCompanions(scene,assetMap,terrain);clearActorViews();}practiceRange?.dispose();practiceRange=undefined;}
import {FootAim} from './footAim.ts';
const footAim=new FootAim();
import {ScopeSensitivityControls} from './scopeSensitivity.ts';
const scopeSensitivity=new ScopeSensitivityControls();
import {DeathReplay} from './deathReplay.ts';
import {ImpactEffect} from './impactEffect.ts';
import {RiderPresentation} from './riderPresentation.ts';
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
import {combatEye,chaseEye,dragAim,stickAxes} from './combatView.ts';
import {FootControls} from '../../../../ride-core/src/onFootControls.ts';
import {CameraBlend,mountCameraPreferences,cameraTransitionsEnabled} from '../../../../ride-core/src/cameraPresentation.ts';
import {CAMERA_PROFILE} from '../../../../ride-core/src/cameraProfile.ts';
import {clearRideCamera} from '../cameraClearance.ts';
import {loadEngineForPage,engineRequested} from '../../../../ride-core/src/engine/browser.ts';
import {engineReady} from '../../../../ride-core/src/engine/runtime.ts';
import './style.css';
import './lobby.css';
import * as T from 'three';
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
import {FrameSchedule} from '../frameSchedule.ts';
import {AdaptiveQuality} from '../adaptiveQuality.ts';
import {touchLayout} from './touchLayout.ts';
import {contextualActions} from './actionVisibility.ts';
import {assetConcurrency,loadAssetQueue} from '../assetQueue.ts';
import {EquipmentLibrary,WeaponView,type EquipmentView} from './equipment.ts';
import {CombatRig} from './combatRig.ts';
import {FieldBoundary} from './fieldBoundary.ts';
import {AimGesture,LeanGesture,StanceGesture,deadZone,readBindings,type AimPreset} from './combatControls.ts';
import {WHEELS,wheelProfile} from '../../../../ride-core/src/royale/wheelProfiles.ts';
import {EQUIPMENT_SOCKETS} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {FIRE_MODES} from '../../../../ride-core/src/royale/combatProfiles.ts';
const el=<K extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as K;
const canvas=el<HTMLCanvasElement>('arena'),dialog=el<HTMLDialogElement>('lobby'),skin=el<HTMLSelectElement>('skin'),query=new URLSearchParams(location.search);
const fromElmwood=query.get('from')==='elmwood',back=el<HTMLAnchorElement>('return');if(fromElmwood){back.href='../elmwood-explorer/elmwood.html';back.textContent='← Elmwood Explorer';}
if(engineRequested())back.href+=(back.href.includes('?')?'&':'?')+'engine=breadflower';
const menuBack=el<HTMLAnchorElement>('return-menu');menuBack.href=back.href;menuBack.textContent=back.textContent;
dialog.close();if(!el<HTMLDialogElement>('royale-startup').open)dialog.showModal();
for(const r of RIDER_CHOICES)skin.add(new Option(r.label,r.id));skin.value=riderChoice(null);
const wheel=el<HTMLSelectElement>('wheel');for(const w of WHEELS)wheel.add(new Option(w.name+' · '+Math.round(w.topKph)+' km/h',w.id));
const stanceGesture=new StanceGesture();const leanGesture=new LeanGesture();const aimGesture=new AimGesture();let touchAds=false,adsSensitivity=.65,touchDisplay='auto',touchAim='toggle',stickMode='floating';const resetPointers:Array<()=>void>=[];
for(const [id,fallback] of [['ads-sensitivity','0.65'],['touch-display','auto'],['touch-aim','toggle'],['touch-lean','toggle'],['stick-mode','floating']]){const field=el<HTMLInputElement>(id);try{field.value=localStorage.getItem('royale-'+id+(id==='stick-mode'?'-v2':''))??fallback;}catch{field.value=fallback;}const apply=()=>{if(id==='ads-sensitivity')adsSensitivity=T.MathUtils.clamp(Number(field.value)||.65,.2,1.5);if(id==='touch-display')touchDisplay=field.value;if(id==='touch-aim'){touchAim=field.value;touchAds=false;}if(id==='touch-lean'){leanGesture.mode=field.value==='hold'?'hold':'toggle';leanGesture.reset();}if(id==='stick-mode')stickMode=field.value;};field.onchange=()=>{apply();try{localStorage.setItem('royale-'+id+(id==='stick-mode'?'-v2':''),field.value);}catch{}};apply();}
let bindings=readBindings(null),lookYaw=0,lookPitch=0;
const cameraModes=['chase','first','front','side','orbit','drone'] as const;
type ViewMode=typeof cameraModes[number];let viewMode:ViewMode='chase',sensitivity=1;const cameraBlend=new CameraBlend();
try{const saved=localStorage.getItem('royale-camera');if(cameraModes.includes(saved as ViewMode))viewMode=saved as ViewMode;const value=Number(localStorage.getItem('royale-aim-sensitivity'));if(value>=.4&&value<=2)sensitivity=value;}catch{}
function setCamera(mode:ViewMode){viewMode=mode;el<HTMLSelectElement>('camera-view').value=mode;try{localStorage.setItem('royale-camera',mode);}catch{}}
function cycleCamera(){if(footAim.active){footView=footView==='first'?'chase':'first';saveFootView();}else setCamera(cameraModes[(cameraModes.indexOf(viewMode)+1)%cameraModes.length]);}
setCamera(viewMode);el<HTMLSelectElement>('camera-view').onchange=e=>setCamera((e.target as HTMLSelectElement).value as ViewMode);
let footView:'first'|'chase'='first';
try{if(localStorage.getItem('royale-foot-view')==='chase')footView='chase';}catch{}
const footViewLabel=document.createElement('label'),footViewSelect=document.createElement('select');footViewLabel.textContent='On-foot view';footViewSelect.id='foot-camera-view';footViewSelect.add(new Option('First person · combat','first'));footViewSelect.add(new Option('Third person · combat','chase'));footViewSelect.value=footView;footViewLabel.append(footViewSelect);el('camera-settings').append(footViewLabel);
function saveFootView(){footViewSelect.value=footView;try{localStorage.setItem('royale-foot-view',footView);}catch{}}
footViewSelect.onchange=()=>{footView=footViewSelect.value==='first'?'first':'chase';saveFootView();};
const sensitivityInput=el<HTMLInputElement>('aim-sensitivity');sensitivityInput.value=String(sensitivity);sensitivityInput.oninput=()=>{sensitivity=Number(sensitivityInput.value);try{localStorage.setItem('royale-aim-sensitivity',String(sensitivity));}catch{}};
royaleAudio.mount(el('ride-settings'));mountCameraPreferences(el('camera-settings'));mountHudTransparency(el('camera-settings'));gyroscope.mount(el('camera-settings'),true);scopeSensitivity.mount(el('camera-settings'));
try{bindings=readBindings(JSON.parse(localStorage.getItem('royale-combat-bindings')??'null'));const preset=localStorage.getItem('royale-aim-preset');if(['classic','hold','toggle'].includes(preset??''))aimGesture.preset=preset as AimPreset;}catch{}
el<HTMLSelectElement>('aim-preset').value=aimGesture.preset;el<HTMLSelectElement>('aim-preset').onchange=e=>{aimGesture.reset();aimGesture.preset=(e.target as HTMLSelectElement).value as AimPreset;try{localStorage.setItem('royale-aim-preset',aimGesture.preset);}catch{}};
for(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const label=document.createElement('label');label.textContent=key;const input=document.createElement('button');input.textContent=bindings[key];input.onclick=()=>{input.textContent='Press a key…';input.onkeydown=e=>{e.preventDefault();e.stopPropagation();bindings=readBindings({...bindings,[key]:e.code});try{localStorage.setItem('royale-combat-bindings',JSON.stringify(bindings));}catch{}for(const b of el('bindings').querySelectorAll('button'))b.textContent=bindings[b.dataset.binding as keyof typeof bindings];input.onkeydown=null;};};input.dataset.binding=key;label.append(input);el('bindings').append(label);}
const scene=new T.Scene();scene.background=new T.Color(ROYALE_HAZE);scene.fog=new T.Fog(ROYALE_HAZE,280,1200);
const camera=new T.PerspectiveCamera(62,1,.12,4200);camera.position.set(65,85,100);camera.lookAt(0,0,0);
const renderer=new T.WebGLRenderer({canvas,antialias:startupAntialias()});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.type=T.PCFShadowMap;
const atmosphereSky=new RouteSky();scene.add(atmosphereSky);const sky=new T.HemisphereLight('#92bdd5','#4b5553',.8);scene.add(sky);const sun=new T.DirectionalLight('#ffd4a1',1.55);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:36,bottom:-30,near:.1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);followStableSun(sun,{x:0,y:0,z:0},ROYALE_SUN);
const graphics=createGraphicsQuality(renderer,scene,canvas);
const fill=new T.DirectionalLight('#86cddc',.3);fill.position.set(-12,8,-13);scene.add(fill,fill.target);
graphics.mount(el('graphics-settings'));

const fieldRing=new FieldBoundary('#63efd9',.9);scene.add(fieldRing);
const nextRing=new FieldBoundary('#efc568',.75);scene.add(nextRing);
let radarMap:RoyaleRadarMap|undefined;let shieldAsset:GLTF;let companions:RoyaleCompanions|undefined;
const nameHead=new T.Vector3();
const actors=new Map<string,{nameplate:PlayerNameplate;view:Hero;equipment:WeaponView;weapon:T.Group;shield:ShieldEffect;rig:CombatRig;wheelId:string;optic:T.Group;motion:RiderPresentation}>(),assetMap=new Map<string,GLTF>(),items=new Map<string,EquipmentView|ScopePickup>();
let scopeLibrary:ScopeLibrary,selectedScope:Scope|null=null,ownedScopeKey='',scopePadHeld=false;
function changeScope(){selectedScope=cycleScope(session?.state?.self?.scopes??[],selectedScope);canvas.focus();}
el('scope-select').onclick=changeScope;
new ResizeObserver(()=>{document.documentElement.style.setProperty('--royale-hud-bottom',el('hud').getBoundingClientRect().bottom+'px');loadLayout();}).observe(el('hud'));
let firstPerson:FirstPersonView|undefined;
let equipmentLibrary:EquipmentLibrary,equipmentTime=0,equipmentRound='',equipmentShots=0,previousShotTick=-999;
const seenShots=new Set<string>(),reducedEquipmentMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scenery:Awaited<ReturnType<typeof buildDetroitArenaScene>>;
let ambientPacks:AmbientCyclistPacks|undefined;let jazzVisit:JazzVisit|undefined;
let terrain:DowntownArena,session:RoyaleSession,loaded=false,acc=0,last=performance.now(),hudAt=0,paused=false,layoutEditing=false,aimYaw=0,aimPitch=0,slot=0;
const footControls=new FootControls();const deathReplay=new DeathReplay(),impactEffect=new ImpactEffect();scene.add(impactEffect);const seenImpacts=new Set<string>(),fallenAt=new Map<string,number>();let hitFlashUntil=0;const matchFeedback=new MatchPresentation();let previousShield=50,shieldSerial=-1;
const bots=()=>Math.min(Number(el<HTMLSelectElement>('bot-count').value),Number(el<HTMLSelectElement>('match-size').value)-1);
el('reentry-confirm').onclick=()=>{deathReplay.stop();release();session.requestReentry(true,el<HTMLSelectElement>('respawn-location').value||undefined);};el('reentry-decline').onclick=()=>session.requestReentry(false);
function playDeathReplay(){release();deathReplay.start(performance.now());if(deathReplay.playing)dialog.close();}el('death-replay').onclick=playDeathReplay;el('reentry-replay').onclick=playDeathReplay;el('replay-stop').onclick=()=>deathReplay.stop();
const keys=new Set<string>(),held=new Set<string>(),tap=new Set<string>();let throttle=0,steer=0,aimPointer:number|undefined,aimX=0,aimY=0,stickPointer:number|undefined;
const message=(s:string)=>el('message').textContent=s;
function release(){footControls.clear();stanceGesture.reset();leanGesture.reset();touchAds=false;aimGesture.reset();lookYaw=lookPitch=0;keys.clear();held.clear();tap.clear();steer=throttle=0;aimPointer=stickPointer=undefined;resetPointers.forEach(reset=>reset());session?.release();}
function finishLayoutEditing(){if(layoutEditing)saveLayout();layoutEditing=false;el('touch').classList.remove('editing');el('layout-done').hidden=true;release();}
function clearResults(){el('results').replaceChildren();el('rematch').hidden=true;}
function showMenu(){finishLayoutEditing();paused=true;if(dialog.open)dialog.close();dialog.showModal();el('resume').hidden=!session?.state;el('quit').hidden=!session?.state;}
function resume(){void royaleAudio.unlock();finishLayoutEditing();paused=false;dialog.close();canvas.focus();loadLayout();}
const openSettings=()=>{showMenu();el<HTMLDetailsElement>('ride-settings').open=true;el('camera-view').focus();};
el('settings-open').onclick=openSettings;
// A modal makes the page header inert. Keep equivalent navigation inside its top layer.
const lobbyNav=document.createElement('nav');lobbyNav.className='lobby-nav';lobbyNav.setAttribute('aria-label','Lobby navigation');
const lobbyBack=back.cloneNode(true) as HTMLAnchorElement;lobbyBack.id='lobby-return';
const lobbySettings=document.createElement('button');lobbySettings.textContent='Settings';lobbySettings.onclick=openSettings;
const lobbyHome=document.createElement('button');lobbyHome.textContent='Loadout';lobbyHome.onclick=()=>{el<HTMLDetailsElement>('ride-settings').open=false;dialog.scrollTop=0;lobbyBack.focus({preventScroll:true});};
lobbyNav.append(lobbyBack,lobbySettings,lobbyHome);dialog.prepend(lobbyNav);dialog.scrollTop=0;
el('menu').onclick=showMenu;el('resume').onclick=resume;dialog.addEventListener('cancel',e=>{e.preventDefault();if(session?.state)resume();});
async function run(work:()=>void|Promise<void>){try{message('');await work();}catch(e){message((e as Error).message);}}
function preparationItemDone(){const root=el('royale-startup');root.dataset.completed=String(Number(root.dataset.completed??0)+1);}
function preparationStage(completed:number,label:string){const root=el('royale-startup');if(completed===0){root.dataset.total=String(10+3+RIDER_CHOICES.length+WHEELS.filter(w=>w.id!=='euc').length);root.dataset.completed='0';}else preparationItemDone();message(label);}
async function prepare(){preparationStage(0,'Warming up the arena…');const hdr=await new HDRLoader().loadAsync(new URL('../../../art/nvidia/detroit-skylight.hdr',import.meta.url).href),pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.36;hdr.dispose();pm.dispose();await loadEngineForPage(true);if(!engineReady())throw Error('Compiled arena could not load. Return to normal riding or retry.');preparationStage(1,'Loading the original Detroit map…');terrain=new DowntownArena(await TagTerrain.create(await loadFixture(new URL('./love-tag/swoop-detroit.json',location.href).href)));preparationStage(2,'Building the Detroit skyline…');session=new RoyaleSession(terrain);radarMap=new RoyaleRadarMap(terrain);scenery=await buildDetroitArenaScene(scene,terrain);canvas.dataset.riverfront=JSON.stringify(scenery.root.userData.riverfront);canvas.dataset.arena=terrain.arenaIdentity.arena;canvas.dataset.collision=terrain.arenaIdentity.collision;
 preparationStage(3,'Preparing riders…');const loader=new GLTFLoader();await loadAssetQueue(['DS_EUC_01','DS_Cyclist_01','DS_Bicycle_01',...RIDER_CHOICES.map(r=>r.id)],assetConcurrency(),async id=>{assetMap.set(id,await loader.loadAsync(['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'].includes(id)?'/exports/rigged-heroes/'+id+'.glb':'/exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb'));preparationItemDone();});
 preparationStage(4,'Preparing companions…');assetMap.set('DS_Boerboel_01',await loader.loadAsync('/exports/polish/royale-equipment/royale-dog.glb'));companions=new RoyaleCompanions(scene,assetMap,terrain);
 preparationStage(5,'Tuning the wheels…');await loadAssetQueue(WHEELS.filter(w=>w.id!=='euc'),assetConcurrency(),async w=>{assetMap.set(w.asset,await loader.loadAsync('/exports/electric/'+w.asset+'.glb'));preparationItemDone();});
 preparationStage(6,'Loading equipment…');equipmentLibrary=await EquipmentLibrary.load(loader,new URL('./exports/polish/royale-equipment/',location.href));canvas.dataset.equipment='Higgsfield-Blender-Unity:7-equipment-models;Blender-dog-power-clips';
 preparationStage(7,'Calibrating scopes…');scopeLibrary=new ScopeLibrary(await loader.loadAsync('/exports/polish/royale-equipment/scope.glb'));
 preparationStage(8,'Charging shields…');shieldAsset=await loader.loadAsync('/exports/polish/royale-equipment/rider-shield.glb');
 preparationStage(9,'Final arena checks…');session.comms?.root.addEventListener('toggle',()=>{if(session.comms?.inputBlocked)release();});
 const mapTransform=terrain.terrain.fixture.transform;ambientPacks=new AmbientCyclistPacks(scene,assetMap,terrain,cyclistCircuit(Array.from({length:100},(_,i)=>{const p=cutPoint(60+i*(LENGTH-120)/99);return {x:(p.x-mapTransform.tx)/mapTransform.sx,z:p.z-mapTransform.tz,width:5};})));canvas.dataset.ambientPackSizes='10,10';canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks.starts);
 jazzVisit=new JazzVisit(scenery.jazz.clubs,()=>{const was=paused;paused=true;release();return was;},was=>{paused=was;release();canvas.focus();},()=>session.state?.actors.find(a=>a.id===session.me)?.pose.footMode?'walk':'ride',{toMap:(x,y,z)=>terrain.sourcePosition({x,y,z})});
 graphics.apply();preparationItemDone();loaded=true;loadedAt=performance.now();canvas.dataset.loadMs=String(Math.round(loadedAt));el<HTMLButtonElement>('practice').disabled=false;rangeButton.disabled=false;blockButton.disabled=false;el('practice').textContent='Practice with AI opponents →';message('Original Detroit arena ready. Choose six or ten riders; AI fills empty seats when enabled.');
 if(incomingInvitation){applyInvitation(incomingInvitation);el<HTMLDetailsElement>('online').open=true;el('online-status').textContent='Your invitation is ready. Select Join game.';}
}
function relayControls(){const relay=!!relayConfig&&el<HTMLInputElement>('use-relay').checked;el<HTMLInputElement>('endpoint').closest('label')!.hidden=relay;el<HTMLInputElement>('test-code').closest('label')!.hidden=!relay;const note=el('supabase-test').querySelector('.note');if(note)note.textContent=relay?'Temporary remote test. The host computer must remain on and the access code must be current.':'Direct local match server · no test access code needed.';}
el<HTMLInputElement>('use-relay').onchange=relayControls;
function practice(training=false){closeRange();if(training)practiceRange=new PracticeRangeView(scene,terrain);footAim.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;void royaleAudio.unlock();clearResults();session.offline(skin.value,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,training?0:bots(),practiceRange?.layout.terrain);slot=0;resume();}
el('practice').onclick=()=>run(()=>practice());
const rangeButton=document.createElement('button');rangeButton.id='practice-range';rangeButton.textContent='Shooting range · 10–100 m';rangeButton.disabled=!loaded;rangeButton.onclick=()=>run(()=>practice(true));el('practice').after(rangeButton);
const blockButton=document.createElement('button');blockButton.id='combat-block';blockButton.textContent='Combat block · close-range AI';blockButton.disabled=!loaded;rangeButton.after(blockButton);
blockButton.onclick=()=>run(async()=>{closeRange();session.leave();const block=await CombatBlockTerrain.create();combatBlock=new CombatBlockView(scene,block);scenery.root.visible=false;companions?.dispose();companions=new RoyaleCompanions(scene,assetMap,block);clearActorViews();footAim.reset();aimYaw=aimPitch=lookYaw=lookPitch=0;void royaleAudio.unlock();clearResults();session.offline(skin.value,wheel.value,6,true,2,block);slot=0;resume();});

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
el('rematch').onclick=()=>run(()=>{if(session.room){session.readyUp();session.start();}else practice();});
el('quit').onclick=()=>{finishLayoutEditing();closeRange();session.leave();clearResults();paused=false;el('resume').hidden=el('quit').hidden=true;el('join').hidden=el('create').hidden=false;el<HTMLInputElement>('code').closest('label')!.hidden=false;el('online-status').textContent='You left the room. Join an invitation or create another room.';message('You left the match.');};
el('connection-menu').onclick=()=>{showMenu();el<HTMLDetailsElement>('online').open=true;el('reconnect').focus();};
el('invite').onclick=()=>run(async()=>{
 const test=el<HTMLInputElement>('use-relay').checked?el<HTMLInputElement>('test-code').value.trim():undefined;
 const link=roomInvitationLink(location.href,session.code,test),field=el<HTMLInputElement>('invite-link');field.hidden=false;field.value=link;
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),status=el('invite-status');
 if(navigator.share&&!local){try{await navigator.share({title:'Static Royale',text:'Join my Static Royale room '+session.code,url:link});status.textContent='Invitation shared.';return;}catch(error){if((error as Error).name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(link);status.textContent=local?'Invite copied. This preview link opens on this computer; other devices need the same hosted game build.':'Invite copied. Your friend can open it and select Join game.';}catch{field.focus();field.select();status.textContent='Copy the invitation above and send it to your friend.';}
});
void fetch('./royale-config.json').then(r=>r.ok?r.json():{}).then((c:{supabaseTest?:{endpoint:string;publishableKey:string};serverUrl?:string})=>{relayConfig=c.supabaseTest;el('supabase-test').hidden=!relayConfig;el<HTMLInputElement>('use-relay').checked=!['localhost','127.0.0.1'].includes(location.hostname);el<HTMLInputElement>('endpoint').value=c.serverUrl||(['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8226':'');if(incomingInvitation?.testCode)applyInvitation(incomingInvitation);relayControls();}).catch(()=>{});
function buttonAction(action:string){if(action==='crouch'||action==='prone'){stanceGesture.down(action==='crouch'?1:2);return;}if(action==='hop')stanceGesture.reset();if(action==='lean-left'||action==='lean-right'){leanGesture.down(action==='lean-left'?-1:1);return;}if(action==='scope'){changeScope();return;}if(action==='camera'){cycleCamera();return;}if(action==='fire-left'){tap.add('fire-left');return;}if(action==='aim'){if(touchAim==='toggle')touchAds=!touchAds;return;}if(action==='switch'){slot=1-slot;return;}tap.add(action);}
window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,select,textarea,button')||dialog.open||deathReplay.playing||session?.comms?.inputBlocked)return;
 if([...Object.values(bindings),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'||e.code===bindings.loadout){showMenu();return;}
 if(!keys.has(e.code)){if(e.code===bindings.crouch)stanceGesture.down(1);if(e.code===bindings.prone)stanceGesture.down(2);if(e.code===bindings.hop)stanceGesture.reset();for(const [key,action] of [['hop','hop'],['utility','utility'],['repair','repair'],['recover','recover'],['reload','reload'],['pickup','swap'],['cycleMode','cycleMode'],['dogAttack','dog-attack'],['dogRadar','dog-radar'],['brawl','brawl'],['evade','evade']] as const)if(e.code===bindings[key])tap.add(action);if(e.code===bindings.camera)cycleCamera();if(e.code===bindings.scope)changeScope();}
 keys.add(e.code);if(e.code==='Digit1')slot=0;if(e.code==='Digit2')slot=1;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);window.addEventListener('gamepaddisconnected',release);
document.addEventListener('visibilitychange',()=>{release();last=performance.now();acc=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(dialog.open)return;e.preventDefault();slot=1-slot;},{passive:false});
const aimGain=(gain:number)=>gain*sensitivity*scopeSensitivity.gain(selectedScope,'look')*(aimMode()===2?adsSensitivity*scopeSensitivity.gain(selectedScope,'ads')/scopeZoom(selectedScope):1);
function syncFootAim(){footAim.sync(session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose);}
function look(dx:number,dy:number,gain:number){syncFootAim();const g=aimGain(gain),next=dragAim(aimYaw,aimPitch,dx,dy,g);if(footAim.active){footAim.turn(-dx*g);aimYaw=0;}else aimYaw=next.yaw;aimPitch=next.pitch;}
canvas.addEventListener('pointerdown',e=>{if(dialog.open||deathReplay.playing||e.pointerType!=='mouse'&&(aimPointer!==undefined||e.clientX<innerWidth*.4))return;canvas.focus();canvas.setPointerCapture(e.pointerId);aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;if(e.pointerType==='mouse'){if(e.button===0){held.add('fire');tap.add('fire');}if(e.button===2)aimGesture.down(performance.now());}});
canvas.addEventListener('pointermove',e=>{if(dialog.open||deathReplay.playing||aimPointer!==e.pointerId&&document.pointerLockElement!==canvas)return;
 const dx=e.pointerType==='mouse'?e.movementX:e.clientX-aimX,dy=e.pointerType==='mouse'?e.movementY:e.clientY-aimY;
 if((keys.has(bindings.freeLook)||held.has('free-look'))){lookYaw=T.MathUtils.clamp(lookYaw-dx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-dy*.003,-.8,.8);}
 else look(dx,dy,.004);
 aimX=e.clientX;aimY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{if(e.button===2)aimGesture.up(performance.now());if(e.button===0)held.delete('fire');if(aimPointer===e.pointerId)aimPointer=undefined;});
canvas.addEventListener('pointercancel',release);
canvas.addEventListener('lostpointercapture',e=>{if(aimPointer===e.pointerId){held.delete('fire');aimPointer=undefined;}});
const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
const layoutKey=()=> 'static-royale-touch-'+orientation();
function saveLayout(){const result:Record<string,{x:number;y:number}>={};for(const node of el('touch').children){const h=node as HTMLElement;if(h.dataset.customPosition){const r=h.getBoundingClientRect();result[h.id||h.dataset.action!]={x:r.left/innerWidth,y:r.top/innerHeight};}}try{localStorage.setItem(layoutKey(),JSON.stringify(result));}catch{}}
function loadLayout(){
 let data:Record<string,{x:number;y:number}>={};try{data=JSON.parse(localStorage.getItem(layoutKey())??'{}')??{};}catch{}
 const touch=el('touch'),padding=getComputedStyle(touch),safe={left:parseFloat(padding.paddingLeft)||0,right:parseFloat(padding.paddingRight)||0,top:parseFloat(padding.paddingTop)||0,bottom:parseFloat(padding.paddingBottom)||0};
 const layout=touchLayout(innerWidth,innerHeight,Number(el<HTMLInputElement>('button-size').value),el('hud').getBoundingClientRect().bottom||188,safe);touch.style.setProperty('--touch-size',layout.size+'px');
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
 const down=(e:PointerEvent)=>{if(pointer!==undefined||h.id==='move-pad'&&stickPointer!==undefined||!layoutEditing&&h instanceof HTMLButtonElement&&h.disabled)return;e.preventDefault();pointer=e.pointerId;ridingAim.set(pointer,{x:e.clientX,y:e.clientY});h.setPointerCapture(pointer);const r=h.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;
  if(layoutEditing)return;if(h.id==='move-pad'){stickPointer=pointer;originX=stickMode==='floating'?e.clientX:r.left+r.width/2;originY=stickMode==='floating'?e.clientY:r.top+r.height/2;homeLeft=h.style.left;homeTop=h.style.top;if(stickMode==='floating'){h.style.left=(originX-r.width/2)+'px';h.style.top=(originY-r.height/2)+'px';}const axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;}
  else if(h.id==='aim-pad'){aimPointer=pointer;aimX=e.clientX;aimY=e.clientY;}else {held.add(act()!);buttonAction(act()!);}h.classList.add('active');
 };h.addEventListener('pointerdown',down);if(h.id==='move-pad')beginFloatingMove=down;
 h.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;
  if(layoutEditing){h.style.left=T.MathUtils.clamp(e.clientX-dx,0,innerWidth-h.offsetWidth)+'px';h.style.top=T.MathUtils.clamp(e.clientY-dy,0,innerHeight-h.offsetHeight)+'px';h.style.right=h.style.bottom='auto';h.dataset.customPosition='true';return;}
  if(h.id==='move-pad'&&pointer===stickPointer){const r=h.getBoundingClientRect(),axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;h.style.setProperty('--stick-x',(steer*28)+'px');h.style.setProperty('--stick-y',(-throttle*28)+'px');}
  else if((act()==='fire'||act()==='free-look')&&pointer!==undefined){const mx=e.clientX-(ridingAim.get(pointer)?.x??e.clientX),my=e.clientY-(ridingAim.get(pointer)?.y??e.clientY);ridingAim.set(pointer,{x:e.clientX,y:e.clientY});if(act()==='free-look'){lookYaw=T.MathUtils.clamp(lookYaw-mx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-my*.004,-.8,.8);}else look(mx,my,.004);}
  else if(h.id==='aim-pad'&&pointer===aimPointer){look(e.clientX-aimX,e.clientY-aimY,.004);aimX=e.clientX;aimY=e.clientY;}
 });
 const up=()=>{if(pointer===undefined)return;if(pointer!==undefined)ridingAim.delete(pointer);if(h.id==='move-pad'&&pointer===stickPointer){stickPointer=undefined;steer=throttle=0;h.style.setProperty('--stick-x','0px');h.style.setProperty('--stick-y','0px');h.style.left=homeLeft;h.style.top=homeTop;}if(pointer===aimPointer)aimPointer=undefined;held.delete(act()!);pointer=undefined;h.classList.remove('active');if(layoutEditing)saveLayout();};
 resetPointers.push(up);for(const type of ['pointerup','pointercancel','lostpointercapture'])h.addEventListener(type,e=>{if((e as PointerEvent).pointerId===pointer)up();});
}
function aimMode(){return touchAds||touchAim==='hold'&&held.has('aim')||navigator.getGamepads?.()[0]?.buttons[6]?.pressed?2:aimGesture.get(performance.now());}
function command():Command{const c=neutral(session.state?.round??'');const pad=navigator.getGamepads?.()[0];const axis=(n:number)=>deadZone(pad?.axes[n]??0);
 const scopePressed=!!pad?.buttons[12]?.pressed;if(scopePressed&&!scopePadHeld)changeScope();scopePadHeld=scopePressed;
 c.throttle=T.MathUtils.clamp(throttle+Number(keys.has(bindings.forward)||keys.has('ArrowUp'))-Number(keys.has(bindings.brake)||keys.has('ArrowDown'))-axis(1),-1,1);
 c.steer=T.MathUtils.clamp(steer+Number(keys.has(bindings.right)||keys.has('ArrowRight'))-Number(keys.has(bindings.left)||keys.has('ArrowLeft'))+axis(0),-1,1);
 look(axis(2)*6,axis(3)*4.5,.004);const gyro=gyroscope.consume(1/60,!dialog.open&&!paused,aimMode()===2||viewMode==='first');const gyroGain=scopeSensitivity.gain(aimMode()===2?selectedScope:null,'gyro')/(aimMode()===2?scopeZoom(selectedScope):1);gyro.yaw*=gyroGain;gyro.pitch*=gyroGain;if(footAim.active){footAim.turn(-gyro.yaw);aimYaw=0;}else aimYaw=T.MathUtils.clamp(aimYaw-gyro.yaw,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch+gyro.pitch,-.65,.65);c.facingYaw=footAim.active?footAim.heading:null;c.aimYaw=aimYaw;c.aimPitch=aimPitch;
 c.fire=(held.has('fire')||held.has('fire-left')||tap.has('fire')||tap.has('fire-left'))||!!pad?.buttons[7]?.pressed;c.aimMode=aimMode();if(c.fire&&!footAim.active&&!c.aimMode&&viewMode!=='first'&&viewMode!=='chase')setCamera('chase');
 c.reload=tap.has('reload')||!!pad?.buttons[2]?.pressed;c.cycleMode=tap.has('cycleMode');c.lean=leanGesture.get(keys.has(bindings.leanLeft),keys.has(bindings.leanRight),held.has('lean-left'),held.has('lean-right'));c.crouch=stanceGesture.value===1;c.prone=stanceGesture.value===2;
 c.hop=tap.has('hop')||!!pad?.buttons[0]?.pressed;c.hopHeld=held.has('hop')||keys.has(bindings.hop)||!!pad?.buttons[0]?.pressed;c.dismount=footControls.consume();c.burst=footControls.run||held.has('burst')||keys.has(bindings.burst)||!!pad?.buttons[4]?.pressed;
 const brawling=!!session.state?.self?.combat.melee?.brawl;c.brawl=tap.has('brawl');c.light=brawling&&c.fire;c.heavy=brawling&&c.reload;if(brawling){c.fire=false;c.reload=false;c.aimMode=0;}c.evade=tap.has('evade')?(c.throttle<-.2?2:c.steer<-.1?-1:1):0;
 c.dogAttack=tap.has('dog-attack');c.dogRadar=tap.has('dog-radar');c.utility=tap.has('utility')||!!pad?.buttons[5]?.pressed;c.repair=tap.has('repair')||!!pad?.buttons[3]?.pressed;c.recover=tap.has('recover');c.swap=tap.has('swap');c.slot=slot;
 const self=session.state?.actors.find(a=>a.id===session.me),pose=session.prediction?.controller.poseValue??self?.pose;
 if(self&&pose?.footMode&&footAim.active&&(footView==='first'||c.aimMode===2)&&!brawling){const facing={...pose,headingY:c.facingYaw??pose.headingY},aim=fpsAim(facing,self.skin,footAim.heading,aimPitch,self.combat.aimBlend,self.combat.lean,activeTerrain(),session.state?.actors.filter(a=>a.id!==session.me)??[]);c.aimYaw=aim.aimYaw;c.aimPitch=aim.aimPitch;}
 tap.clear();return c;
}
function clearActorViews(){for(const a of actors.values()){a.view.dispose();a.equipment.dispose();a.nameplate.dispose();a.shield.dispose();}actors.clear();}
function view(id:string,choice:string,wheelId:string){let a=actors.get(id);if(a&&a.view.riderId===riderChoice(choice)&&a.wheelId===wheelId)return a;if(a){a.nameplate.dispose();a.view.dispose();a.equipment.dispose();a.shield.dispose();}
 const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheelId).asset)!);const hero=new Hero(models,activeTerrain(),riderChoice(choice)),equipment=new WeaponView(equipmentLibrary),weapon=equipment.root;scene.add(hero.root,weapon);
 const optic=scopeLibrary.model();optic.position.set(0,.105,.08);weapon.add(optic);
 const shield=new ShieldEffect(shieldAsset);scene.add(shield);const nameplate=new PlayerNameplate();scene.add(nameplate.root);a={nameplate,view:hero,equipment,weapon,shield,optic,rig:new CombatRig(hero,equipment),wheelId,motion:new RiderPresentation()};actors.set(id,a);return a;
}
const heartShots=new HeartProjectiles();scene.add(heartShots);
function draw(now:number){
 session?.comms?.place(dialog.open?el('room'):undefined);

 firstPerson?.hide();
 const delta=equipmentTime?Math.min(.1,(now-equipmentTime)/1000):0;equipmentTime=now;
 const motionDelta=paused&&!session?.room?0:delta,reducedMotion=reducedEquipmentMotion.matches||document.documentElement.dataset.reducedMotion==='true'||query.has('reducedMotion');
 atmosphereSky.update(motionDelta,ROYALE_SUN,.42,0,graphics.current.shadows===0,reducedMotion,paused&&!session?.room,scene.fog?.color);canvas.dataset.atmosphere=JSON.stringify(atmosphereSky.status);
 const replayFrame=deathReplay.sample(now);const replaying=!!replayFrame;const s=replayFrame?.state??session?.state;el('replay-status').hidden=!replaying;el('replay-status').querySelector('span')!.textContent=deathReplay.kind==='killer'?'Killer replay · attacker perspective':'Last-view replay · received positions only';el('replay-status').setAttribute('aria-label',deathReplay.kind==='killer'?'Killer replay':'Last-view replay');if(!s){matchFeedback.hide();for(const a of actors.values()){a.nameplate.root.visible=a.view.root.visible=a.weapon.visible=a.shield.visible=false;}companions?.dispose();jazzVisit?.stop();heartShots.reset();for(const m of items.values())m.root.visible=false;el('hud').hidden=el('reticle').hidden=el('scope-mask').hidden=true;return;}const rendered=new Set<string>();
 if(!replaying)practiceRange?.update(s,session.me,now);
 radarMap?.update(s,now,!combatBlock&&!dialog.open&&!!s.self?.alive);
 const bikeObserver=s.actors.find(a=>a.id===session.me)?.pose??terrain.spawns[0].position;ambientPacks?.update(delta,bikeObserver,!combatBlock&&!dialog.open,paused,s.actors.filter(a=>a.alive).map(a=>({id:a.id,...a.pose,radius:.65,height:1.8,kind:'rider' as const,vx:Math.sin(a.pose.headingY)*a.pose.speed,vz:Math.cos(a.pose.headingY)*a.pose.speed})));ambientPacks?.report(canvas,delta);
 royaleAudio.update(s,session.me,!dialog.open&&!paused&&!replaying,!!session.comms?.inputBlocked,Math.atan2(-camera.matrixWorld.elements[8],-camera.matrixWorld.elements[10]),activeTerrain());canvas.dataset.audio=JSON.stringify(royaleAudio.status);
 if(equipmentRound!==s.round){jazzVisit?.stop();equipmentRound=s.round;companions?.dispose();selectedScope=null;ownedScopeKey='';ambientPacks?.restart(undefined,bikeObserver);canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks?.starts);seenShots.clear();seenImpacts.clear();fallenAt.clear();shieldSerial=-1;for(const a of actors.values())a.motion=new RiderPresentation();impactEffect.reset();deathReplay.reset();previousShotTick=-999;for(const item of items.values())item.dispose();items.clear();}
 const owned=s.self?.scopes??[],scopeKey=owned.join(',');if(scopeKey!==ownedScopeKey){selectedScope=bestScope(owned);ownedScopeKey=scopeKey;}if(selectedScope&&!owned.includes(selectedScope))selectedScope=null;
 const firing=new Set<string>();
 matchFeedback.update(s,session.me,now,dialog.open||paused||replaying,reducedMotion);
 if(s.self){if(shieldSerial===s.self.spawnSerial&&previousShield>0&&s.self.shield===0){actors.get(s.self.id)?.shield.hit(true);matchFeedback.shieldBreak(now);}previousShield=s.self.shield;shieldSerial=s.self.spawnSerial;}
 // Only accepted server/offline-authority shots trigger recoil. No click-predicted damage or fire.
 if(s.self&&s.self.shotAt!==previousShotTick){if(s.self.shotAt>=0&&s.tick-s.self.shotAt<12)firing.add(s.self.id);previousShotTick=s.self.shotAt;}
 for(const projectile of s.projectiles){const key=projectile.owner+':'+projectile.shot;if(!seenShots.has(key)){seenShots.add(key);if(projectile.owner!==s.self?.id)firing.add(projectile.owner);}}
 for(const actor of s.actors){const a=view(actor.id,actor.skin,actor.wheelId??'euc');if(!actor.alive&&!fallenAt.has(actor.id))fallenAt.set(actor.id,s.tick);if(actor.alive)fallenAt.delete(actor.id);const falling=!actor.alive&&s.tick-(fallenAt.get(actor.id)??s.tick)<210;a.view.rider.visible=true;a.view.root.visible=actor.alive||falling;a.weapon.visible=actor.alive;a.shield.visible=actor.alive&&(actor.shieldActive||actor.protected||a.shield.reacting);a.shield.scale.setScalar(actor.protected&&!actor.shieldActive?.88:1);rendered.add(actor.id);let pose={...actor.pose};
  if(!replaying&&actor.id===session.me&&session.room&&session.prediction)pose={...session.prediction.controller.poseValue};
  else if(!replaying&&session.room)pose=session.remotePoses.pose(actor.id,pose,actor.spawnSerial,now);
  pose=a.motion.sample({...pose,seated:0},s.tick,actor.alive,actor.spawnSerial,firing.has(actor.id),reducedMotion,s.phase==='results'&&s.winner===actor.id,motionDelta);pose.stopFoot=0;a.view.apply({...pose,seated:0});a.view.visibility.setFirstPerson(!!replayFrame?.focus&&actor.id===replayFrame.focus);const yaw=actor.id===session.me&&!replaying?(footAim.active?footAim.relative(pose):aimYaw):actor.aimYaw,pitch=actor.id===session.me&&!replaying?aimPitch:actor.aimPitch;
  a.optic.visible=!!(actor.id===session.me?selectedScope:actor.scope);a.equipment.select(actor.weapon);if(firing.has(actor.id)&&a.equipment.fire(reducedMotion))equipmentShots++;a.equipment.update(motionDelta,reducedMotion);a.weapon.visible=actor.alive&&pose.crashBlend<.05&&s.phase!=='results';
  if(firing.has(actor.id))a.rig.interruptPickup();
  if(actor.alive&&pose.crashBlend<.05&&s.phase!=='results')a.rig.apply({...pose,seated:0},yaw,pitch,actor.combat,s.tick,(actor as typeof actor&{healingUntil?:number}).healingUntil||0);
  if(actor.id===session.me)canvas.dataset.rig=JSON.stringify({rider:actor.skin,wheel:actor.wheelId,rightError:a.rig.errorR,leftError:a.rig.errorL,supportLocked:a.rig.supportLocked});
  a.shield.position.set(pose.x,pose.y+1,pose.z);a.shield.rotation.y=pose.headingY-Math.PI/2;
  a.shield.update(motionDelta,reducedMotion,graphics.current.shadows===0,actor.shieldActive||actor.protected);
 }
 for(const [id,a]of actors)if(!rendered.has(id)){a.nameplate.root.visible=false;a.view.root.visible=false;a.weapon.visible=false;a.shield.visible=false;}

 companions?.update(s.actors,s.roster,s.tick,motionDelta,graphics.current.shadows===0,reducedMotion,s.phase==='results'?s.winner:undefined);canvas.dataset.companions=String(s.actors.filter(a=>a.alive).length);
 const presentLoot=new Set(s.loot.map(item=>item.id));
 for(const loot of s.loot){let item=items.get(loot.id);if(!item){item=isScope(loot.kind)?scopeLibrary.pickup(loot.kind):equipmentLibrary.create(loot.kind);items.set(loot.id,item);scene.add(item.root);}item.root.visible=Math.hypot(loot.p.x-bikeObserver.x,loot.p.z-bikeObserver.z)<100;item.root.position.set(loot.p.x,loot.p.y+.65,loot.p.z);item.root.scale.setScalar(isScope(loot.kind)?1:1.7);if(item.root.visible)item.update(motionDelta,reducedMotion);}
 for(const [id,item]of items)if(!presentLoot.has(id))item.root.visible=false;
 canvas.dataset.equipmentShots=String(equipmentShots);canvas.dataset.equipmentWeapon=s.actors.find(a=>a.id===session.me)?.weapon??'';
 fieldRing.update(s.field.x,s.field.z,s.field.radius,(x,z)=>activeTerrain().ground(x,z).height);
 fieldRing.energize(s.tick/60,s.field.remaining,reducedMotion,graphics.current.shadows===0);
 nextRing.update(s.field.x,s.field.z,s.field.nextRadius,(x,z)=>activeTerrain().ground(x,z).height);
 canvas.dataset.field=JSON.stringify(s.field);
 const self=s.actors.find(a=>a.id===session.me);if(self){const p=!replaying&&session.room&&session.prediction?session.prediction.controller.poseValue:self.pose,mode=self.combat.melee?.brawl?0:replaying?(self.combat.aimBlend>.8?2:0):aimMode(),ads=mode===2;
 if(!keys.has(bindings.freeLook)&&!held.has('free-look')){lookYaw*=Math.exp(-delta*10);lookPitch*=Math.exp(-delta*10);}
 const renderAimYaw=footAim.active&&!replaying?footAim.relative(p):aimYaw;
 const heading=p.headingY+renderAimYaw+lookYaw+self.combat.kickYaw,pitch=aimPitch+lookPitch+self.combat.kickPitch;
 const scale=self.skin.startsWith('DS_Mascot_')?.48:1,socket=weaponSocket(p,self.skin,renderAimYaw,aimPitch,self.combat.aimBlend,self.combat.lean);
 const at=new T.Vector3(socket.grip.x,socket.grip.y+.10*scale,socket.grip.z),forward=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const gameView=p.footMode?footView:viewMode;
 const activeMode=ads?'ads':mode===1&&gameView!=='first'?'shoulder':gameView;
 const profile=CAMERA_PROFILE.cameras.find(c=>c.mode===(activeMode==='shoulder'?'chase':activeMode))!;
 const eyeView=ads||gameView==='first';
 const angle=activeMode==='orbit'?p.headingY+lookYaw+renderAimYaw:heading;
 const mine=actors.get(self.id),sight=mine?.equipment.socket(EQUIPMENT_SOCKETS.sight_axis)??at;
 const desired=eyeView&&p.footMode?new T.Vector3(p.x,p.y+footEyeHeight(scale,p.footCrouch,p.footProne),p.z):eyeView?combatEye(sight,heading,pitch,scale,ads):
   activeMode==='chase'||activeMode==='shoulder'?chaseEye(at,heading,activeMode==='shoulder'?2.4:profile.back,profile.height,profile.side):
   at.clone().add(new T.Vector3(-Math.sin(angle)*profile.back+Math.cos(angle)*profile.side,profile.height,-Math.cos(angle)*profile.back-Math.sin(angle)*profile.side));
 clearRideCamera(activeTerrain(),desired,at,p.y);
 followStableSun(sun,p,ROYALE_SUN);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
 if(!combatBlock)scenery.update(p,now/1000);camera.position.copy(desired);
 camera.lookAt(eyeView||activeMode==='chase'||activeMode==='shoulder'?desired.clone().addScaledVector(forward,100):at);
 camera.fov=ads?scopedFov(profile.fov,selectedScope):profile.fov;cameraBlend.apply(camera,(p.footMode?'foot-':'ride-')+activeMode,delta,reducedMotion||!cameraTransitionsEnabled());
 clearRideCamera(activeTerrain(),camera.position,at,p.y);camera.updateProjectionMatrix();
 canvas.dataset.cameraMode=viewMode;canvas.dataset.cameraActive=activeMode;canvas.dataset.cameraFov=camera.fov.toFixed(2);
 canvas.dataset.grounding=JSON.stringify({rider:{x:p.x,y:p.y,z:p.z},source:terrain.sourcePosition(p),floor:terrain.ground(p.x,p.z,p.y).height,park:{x:p.parkX,y:p.parkY,z:p.parkZ},dog:self.dog,camera:camera.position.toArray(),cameraFloor:terrain.ground(camera.position.x,camera.position.z,p.y).height});
 if(mine){mine.view.rider.visible=true;mine.view.visibility.setFirstPerson(eyeView);if(ads&&selectedScope)mine.weapon.visible=false;
  if(eyeView&&p.footMode&&self.alive&&!replaying&&p.crashBlend<.05&&s.phase!=='results'){
   if(!firstPerson||firstPerson.skin!==self.skin){firstPerson?.dispose();firstPerson=new FirstPersonView(assetMap,equipmentLibrary,riderChoice(self.skin));scene.add(firstPerson.root);}
   mine.view.rider.visible=false;mine.weapon.visible=false;
   const presentation=firstPerson.update({...p,seated:0},self.combat,self.weapon,s.tick,renderAimYaw,aimPitch,camera,motionDelta,firing.has(self.id),ads,reducedMotion,activeTerrain(),s.self?.healingUntil||0);
   if(ads&&selectedScope)firstPerson.hide();canvas.dataset.fpsPresentation=JSON.stringify(presentation);
  }else canvas.dataset.fpsPresentation='world';
 }
 el('scope-mask').hidden=!ads||!selectedScope||dialog.open||!self.alive;
 el('scope-magnification').textContent=selectedScope?SCOPES[selectedScope].label:'';
 canvas.dataset.optics=JSON.stringify({selected:selectedScope,owned,zoom:ads?scopeZoom(selectedScope):1,available:s.loot.filter(l=>isScope(l.kind)).length});
 canvas.dataset.aim=JSON.stringify({yaw:renderAimYaw,worldYaw:heading,freeFootAim:footAim.active,pitch:aimPitch,ads,steer,throttle,fire:held.has('fire')||held.has('fire-left'),lean:self.combat.lean,crouch:p.footCrouch,prone:p.footProne,footMode:p.footMode});for(const direction of [-1,1]){const b=el('touch').querySelector<HTMLButtonElement>(direction<0?'[data-action=lean-left]':'[data-action=lean-right]');b?.setAttribute('aria-pressed',String(self.combat.lean*direction>.1));}
 for(const [action,pressed]of [['crouch',p.footMode?p.footCrouch>.5:stanceGesture.value===1],['prone',p.footProne>.5]] as const)el('touch').querySelector('[data-action='+action+']')?.setAttribute('aria-pressed',String(pressed));
 jazzVisit?.update(p.x,p.z,!dialog.open&&!replaying&&self.alive&&!session.room);
 const adsButton=el('touch').querySelector<HTMLButtonElement>('[data-action=aim]')!;adsButton.setAttribute('aria-pressed',String(ads));

 }
 if(replayFrame){camera.position.fromArray(replayFrame.camera.position);camera.quaternion.fromArray(replayFrame.camera.quaternion);camera.fov=replayFrame.camera.fov;camera.updateProjectionMatrix();}else deathReplay.observe(s,now,{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov});if(!replaying)deathReplay.installKillcam(session.killcam);
 for(const actor of s.actors){const a=actors.get(actor.id)!,rider=s.roster.find(r=>r.id===actor.id);if(a.view.head)a.view.head.getWorldPosition(nameHead);else nameHead.set(actor.pose.x,actor.pose.y+1.8,actor.pose.z);a.nameplate.update(rider?.name??'Rider',!!rider?.bot,nameHead,camera,!!session.room&&!dialog.open&&a.view.root.visible&&actor.id!==(replayFrame?.focus??session.me));}
 const liveDeath=session.state?.self;const killedText=liveDeath&&!liveDeath.alive?eliminationLabel(liveDeath.elimination):'';
 el('eliminated-by').textContent=killedText;el('eliminated-by').hidden=!killedText;el('reentry-killer').textContent=killedText;
 canvas.dataset.playerNames=JSON.stringify([...actors.values()].filter(a=>a.nameplate.root.visible).map(a=>a.nameplate.root.name));
 el('death-replay').textContent=el('reentry-replay').textContent=deathReplay.kind==='killer'?'Watch killer replay':'Watch last-view replay';
 if(!replaying)for(const e of s.events){if(e.kind.startsWith('pickup')&&s.tick-e.tick<40){actors.get(e.actor)?.rig.pickup(e.tick);if(e.actor===session.me)firstPerson?.pickup(e.tick);}if(e.kind!=='hit'&&e.kind!=='dog-knockoff'&&e.kind!=='melee-hit')continue;const key=s.round+':'+e.tick+':'+e.kind+':'+e.actor+':'+e.target;if(seenImpacts.has(key))continue;seenImpacts.add(key);if(s.tick-e.tick>30)continue;const victim=s.actors.find(a=>a.id===e.target);if(victim){impactEffect.hit(victim.pose,now,victim.shieldActive);const attacker=s.actors.find(a=>a.id===e.actor),relative=attacker?Math.atan2(attacker.pose.x-victim.pose.x,attacker.pose.z-victim.pose.z)-victim.pose.headingY:undefined;actors.get(victim.id)?.motion.hit(relative===undefined?0:Math.sin(relative),relative===undefined?1:Math.cos(relative));if(victim.shieldActive||victim.id===s.self?.id&&s.self.shield>0)actors.get(victim.id)?.shield.hit();if(e.target===session.me)matchFeedback.damage(now,relative===undefined?undefined:relative-aimYaw-lookYaw);}
 if(e.actor===session.me&&e.target!==session.me)matchFeedback.hit(now);if(e.target===session.me){hitFlashUntil=now+450;el('hit-flash').dataset.kind=e.kind==='dog-knockoff'?'knockdown':'bullet';}}
 if(seenImpacts.size>128){const oldest=seenImpacts.values().next().value;if(oldest)seenImpacts.delete(oldest);}
 impactEffect.visible=!replaying;impactEffect.update(now,reducedMotion);el('hit-flash').style.opacity=now<hitFlashUntil?'1':'0';
 heartShots.update(s.projectiles,camera,now/1000,reducedMotion);
 canvas.dataset.projectileEffect='hearts-and-sparkles';canvas.dataset.animationPass='rider-weight;confirmed-hit;shield-ripple;field-energy;dog-interpolation;full-fall;match-moments';
 if(now-hudAt>150){hudAt=now;const me=s.self;el('hud').hidden=false;for(const [action,label,until]of [['dog-attack','Dog',me?.dogPower.ready??0],['dog-radar','Radar',me?.dogPower.radarReady??0]] as const){const b=el('touch').querySelector<HTMLButtonElement>('[data-action='+action+']')!;b.disabled=!me?.dogPower.charges||until>s.tick;b.textContent=until>s.tick?label+' '+Math.ceil((until-s.tick)/60)+'s':label+' '+(me?.dogPower.charges??0);}el('phase').textContent=s.phase==='deployment'?'DEPLOYING · '+Math.ceil((PROTECTION-s.tick)/60)+'s':s.remaining+' RIDERS REMAIN';
  const liveSelf=session.state?.self;const eligible=!!liveSelf?.reentry.eligible&&!dialog.open&&!replaying;el('reentry-panel').hidden=!eligible;el('reentry-countdown').textContent=liveSelf?'Choose within '+Math.max(0,Math.ceil((liveSelf.reentry.until-(session.state?.tick??0))/60))+'s. Ten seconds of protection; fighting ends it.':'';const stock=liveSelf?.reentry.remaining??0;el('respawn-stock').textContent=combatBlock?'Local training · restart from Menu':'Respawns left · '+stock+' / 3';el('reentry-title').textContent='Eliminated · '+stock+' respawn'+(stock===1?'':'s')+' left';el('reentry-confirm').textContent='Respawn · '+stock+' left';
  const location=el<HTMLSelectElement>('respawn-location'),choices=liveSelf?.reentry.choices??[],signature=JSON.stringify(choices);if(location.dataset.choices!==signature){const selected=location.value;location.replaceChildren(new Option('Safest available location',''),...choices.map(n=>new Option(n.label,n.id)));if(choices.some(n=>n.id===selected))location.value=selected;location.dataset.choices=signature;}
  location.disabled=!choices.length;el<HTMLButtonElement>('reentry-confirm').disabled=!eligible||!choices.length;el('respawn-availability').textContent=eligible&&!choices.length?'No safe point right now. Checking for openings…':eligible&&/no longer safe|No safe respawn point|Re-entry was rejected/.test(session.message)?session.message:'';
  el<HTMLButtonElement>('reentry-replay').disabled=!deathReplay.available;el('death-replay').hidden=!deathReplay.available||!!liveSelf?.alive;
  el<HTMLProgressElement>('health-meter').value=me?.integrity??0;el('health-value').textContent=String(Math.ceil(me?.integrity??0));el<HTMLProgressElement>('shield-meter').value=me?.shield??0;el('shield-value').textContent=String(Math.ceil(me?.shield??0));const healing=!!me&&me.healingUntil>s.tick;el('health-feedback').textContent=healing?'Healing · '+Math.ceil((me!.healingUntil-s.tick)/60)+'s':me?.reentry.protectedUntil&&me.reentry.protectedUntil>s.tick?'Protected · '+Math.ceil((me.reentry.protectedUntil-s.tick)/60)+'s · combat cancels':me?'Health packs · '+me.repairs+' · H to heal':'';const healthButton=el('touch').querySelector<HTMLButtonElement>('[data-action=repair]')!;healthButton.textContent=healing?'Healing…':'Heal '+(me?.repairs??0);healthButton.disabled=!me?.repairs||healing||!me.alive;
  el('vitals').textContent=me?'Integrity '+Math.ceil(me.integrity)+' / Shield '+Math.ceil(me.shield)+' / Flow '+Math.round(me.energy):'Spectator · private live positions';
  const brawling=!!me?.combat.melee?.brawl,foot=self?.pose.footMode===2;for(const [action,label]of [['fire',brawling?'Jab':'Fire'],['reload',brawling?'Kick / palm':'Reload'],['brawl',brawling?'Weapon':'Brawl']] as const)el('touch').querySelector<HTMLButtonElement>('[data-action='+action+']')!.textContent=label;el<HTMLButtonElement>('touch').querySelector<HTMLButtonElement>('[data-action=brawl]')!.disabled=!foot;el<HTMLButtonElement>('touch').querySelector<HTMLButtonElement>('[data-action=evade]')!.disabled=!foot;
  const w=me?.loadout[me.slot];el('weapon').textContent=brawling?'Brawl stance · click / Jab to strike · R / Kick for heavy':w?WEAPONS[w].name+' · '+me!.combat.magazine[w]+' / '+(me!.ammo[w]-me!.combat.magazine[w])+' · '+FIRE_MODES[me!.combat.fireMode]+(me!.combat.reloadStart>=0?' · Reloading…':''):'';
  const empty=!!w&&!brawling&&me!.combat.magazine[w]===0;el('weapon').dataset.empty=String(empty);el('touch').querySelector<HTMLElement>('[data-action=reload]')!.dataset.needed=String(empty);if(empty&&me!.combat.reloadStart<0)el('weapon').textContent+=me!.ammo[w!]>0?' · Reload':' · Out of ammo';
  const scopeKeyLabel=bindings.scope.replace(/^(Key|Digit)/,'');const scopeLabel=selectedScope?SCOPES[selectedScope].label:'Iron sights';el('scope-select').textContent='Scope · '+scopeLabel+' · '+scopeKeyLabel;el<HTMLButtonElement>('scope-select').disabled=!owned.length;el<HTMLButtonElement>('scope-select').title=owned.length?'Switch collected scopes':'Find a scope and ride or walk over it';
  const scopeTouch=el('touch').querySelector<HTMLButtonElement>('[data-action=scope]')!;scopeTouch.textContent=selectedScope?SCOPES[selectedScope].zoom+'×':'Scope';scopeTouch.disabled=!owned.length;
  if(me&&!layoutEditing){
   const profile=w?WEAPONS[w]:undefined,magazine=w?me.combat.magazine[w]:0;
   const canSwap=!!self&&me.loadout.length>=2&&s.loot.some(l=>l.available&&(l.kind==='static'||l.kind==='heart'||l.kind==='bass')&&!me.loadout.includes(l.kind)&&Math.hypot(l.p.x-self.pose.x,l.p.z-self.pose.z)<=2.5);
   const visible=contextualActions({foot,brawling,crashed:!!me.controller.fields.crashed,dogCharges:me.dogPower.charges,scopes:owned.length,weapons:me.loadout.length,health:me.integrity,healthPacks:me.repairs,healing,shields:me.utility,canSwap,magazine,capacity:profile?.magazine??0,reserve:w?me.ammo[w]-magazine:0,reloading:me.combat.reloadStart>=0,fireModes:profile?.modes??0});
   for(const b of el('touch').querySelectorAll<HTMLButtonElement>('button[data-action]')){const action=b.dataset.action!;if(!b.classList.contains('active'))b.hidden=visible[action]===false;if(b.hidden){held.delete(action);tap.delete(action);}}
   el('scope-select').hidden=!visible.scope;
  }
  const nearby=s.loot.filter(l=>isScope(l.kind)).map(l=>({l,d:Math.hypot(l.p.x-bikeObserver.x,l.p.z-bikeObserver.z)})).sort((a,b)=>a.d-b.d)[0];
  const pickup=s.events.filter(e=>e.actor===session.me&&e.kind.startsWith('pickup-scope')&&s.tick-e.tick<180).at(-1);
  el('scope-status').textContent=pickup?'Collected '+SCOPES[pickup.kind.slice(7) as Scope].label+' · Scope / '+scopeKeyLabel+' to switch':nearby&&nearby.d<30?SCOPES[nearby.l.kind as Scope].label+' · '+Math.ceil(nearby.d)+' m · ride or walk over to collect':'';
  el('speed').textContent=self?Math.round(Math.abs(self.pose.speed)*3.6)+' / '+Math.round(wheelProfile(self.wheelId).topKph)+' km/h · '+wheelProfile(self.wheelId).name+' · game estimate':'';
  el('field').textContent='Field '+Math.round(s.field.radius)+'m → '+Math.round(s.field.nextRadius)+'m · '+Math.ceil(s.field.remaining)+'s';
  el('reticle').hidden=!me?.alive||dialog.open||!!(selectedScope&&aimMode()===2)||(!footAim.active&&!aimMode()&&viewMode!=='chase'&&viewMode!=='first');el('touch').hidden=(!(touchDisplay==='on'||touchDisplay==='auto'&&matchMedia('(any-pointer:coarse)').matches)||dialog.open||replaying||!me?.alive)&&!layoutEditing;
  el('hint').textContent=layoutEditing?'Move controls, then open Menu to finish.':empty&&me!.combat.reloadStart<0?(me!.ammo[w!]>0?'Empty magazine · tap Reload or '+bindings.reload.replace(/^Key/,''):'Out of ammunition · find ammo or switch weapon'):!footAim.active&&Math.abs(aimYaw)>1.20?'Turn toward your target to aim farther.':replaying?(deathReplay.kind==='killer'?'Killer perspective · recorded by the server':'Last-view replay'):me&&!me.alive?me.reentry.eligible?'Eliminated · choose a respawn location':(deathReplay.kind==='killer'?'Eliminated · killer replay available':'Eliminated · last-view replay available'):s.phase==='deployment'?'Spawn protection · weapons unlock when the countdown ends':me&&Math.hypot((self?.pose.x??0)-s.field.x,(self?.pose.z??0)-s.field.z)>s.field.radius?'Outside the Static Field — ride toward the gold circle!':!el('touch').hidden?'Left stick: move · right side: aim · Fire: shoot · ADS: sights':foot?'WASD move · Shift sprint · mouse aim · R reload · J return to wheel':'WASD ride · mouse aim · click fire · right click ADS · R reload · J get off/on';
  el('room').hidden=!session.room;el('roomcode').textContent='Room '+session.code+(session.botFill?' · AI fill on':' · '+s.size+' human seats · AI fill off');
  el('ready').hidden=session.ready.includes(session.me);const inRoom=!!session.room;el<HTMLInputElement>('code').closest('label')!.hidden=inRoom;el('create').hidden=el('join').hidden=inRoom;if(inRoom&&s.phase==='lobby')el('online-status').textContent='Room '+session.code+' · '+(session.ready.includes(session.me)?'You’re ready':'Preparing your rider…')+(session.host===session.me?' · Share invite, then Start match.':' · Waiting for the host to start.');
  el<HTMLButtonElement>('launch').disabled=session.host!==session.me;el('roster').replaceChildren(...s.roster.map(a=>{const li=document.createElement('li');li.textContent=a.name+(a.bot?' · AI':session.ready.includes(a.id)?' · Ready':' · Loading / not ready')+(!a.connected?' · Disconnected':'');return li;}));
  if(session.message)message(session.message);
  if(s.phase==='lobby'&&!dialog.open){showMenu();}if(s.phase==='deployment'&&dialog.open&&session.room){resume();}
  if(s.phase==='results'){if(!dialog.open&&!replaying&&now-matchFeedback.resultsStarted>2600)showMenu();el('rematch').hidden=false;el('results').textContent=(s.winner===session.me?'YOU WIN':s.winner?(s.roster.find(a=>a.id===s.winner)?.name??'Rider')+' WINS':'DRAW')+' · '+s.reason;const stats=s.results.find(r=>r.id===session.me);if(stats)el('results').textContent+=' — '+stats.kills+' eliminations · '+stats.damage+' damage · '+stats.distance+' m ridden';if(killedText)el('results').textContent+=' · '+killedText;}
 }
}
window.addEventListener('resize',()=>{release();graphics.resize();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();loadLayout();});
camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
const schedule=new FrameSchedule(),adaptiveQuality=new AdaptiveQuality();let loadedAt=Infinity,frames=0,profileAt=performance.now(),samples:number[]=[],previousFrame=performance.now();
function loop(now:number){requestAnimationFrame(loop);const rawFrameMs=now-last,delta=Math.min(.15,rawFrameMs/1000);last=now;if(document.hidden)return;
 const idle=paused||dialog.open||layoutEditing||!session?.state||session.state.phase==='results';
 if(graphics.choice!=='auto')adaptiveQuality.reset();
 if(adaptiveQuality.sample(rawFrameMs,loaded&&!idle&&graphics.choice==='auto'&&now-loadedAt>5000,graphics.current.fps)){graphics.setAdaptiveDetail(adaptiveQuality.detail);graphics.setResolutionScale(adaptiveQuality.scale);}
 const connection=session?.connectionStatus(now);el('connection-status').hidden=!connection?.text||dialog.open;el('connection-text').textContent=connection?.text??'';canvas.dataset.connection=connection?.state??'offline';
 if(!session?.state||session.state.phase!=='results')clearResults();
 footControls.update(session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose??{},loaded&&!dialog.open&&!!session?.state?.self?.alive,true,(session?.state?.self?.integrity??100)<=15);
 if(loaded&&session.state&&(!paused||session.room)&&!layoutEditing){acc+=delta;let n=0;while(acc>=DT&&n++<9){try{session.step(dialog.open||paused||deathReplay.playing||session.comms?.inputBlocked?neutral(session.state.round):command());}catch(error){paused=true;release();showMenu();message('The simulation stopped safely. Start a new practice or reconnect: '+(error as Error).message);break;}acc-=DT;}}else acc=0;
 if(!schedule.shouldRender(now,idle,false,graphics.current.fps))return;draw(now);renderer.render(scene,camera);samples.push(now-previousFrame);previousFrame=now;frames++;
 if(now-profileAt>2000){samples.sort((a,b)=>a-b);if(session?.state?.engine){canvas.dataset.engineModule=session.state.engine.module;canvas.dataset.engineFrames=String(session.state.engineInputFrames);canvas.dataset.engineTick=String(session.state.tick);}canvas.dataset.profile=JSON.stringify({fps:frames*1000/(now-profileAt),p95:samples[Math.floor(samples.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,idle,scale:adaptiveQuality.scale,detail:adaptiveQuality.detail});frames=0;profileAt=now;samples=[];}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();paused=true;showMenu();message('Graphics paused. Reload the page to restore the arena.');});
requestAnimationFrame(loop);void run(prepare);
window.addEventListener('pagehide',()=>{firstPerson?.dispose();royaleAudio.dispose();session?.leave();combatBlock?.dispose();practiceRange?.dispose();for(const a of actors.values()){a.nameplate.dispose();a.view.dispose();a.equipment.dispose();a.shield.dispose();}for(const item of items.values())item.dispose();equipmentLibrary?.dispose();scopeLibrary?.dispose();terrain?.terrain.dispose();atmosphereSky.dispose();impactEffect.dispose();renderer.dispose();});










