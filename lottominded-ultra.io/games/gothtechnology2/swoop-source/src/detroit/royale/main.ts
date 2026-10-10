import {DeathReplay} from './deathReplay.ts';
import {ImpactEffect} from './impactEffect.ts';
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
import {CAMERA_PROFILE} from '../../../../ride-core/src/cameraProfile.ts';
import {clearRideCamera} from '../cameraClearance.ts';
import {loadEngineForPage,engineRequested} from '../../../../ride-core/src/engine/browser.ts';
import {engineReady} from '../../../../ride-core/src/engine/runtime.ts';
import './style.css';
import * as T from 'three';
import {GLTFLoader} from '../compressedGLTFLoader.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';
import {Hero} from '../actors.ts';
import {RIDER_CHOICES,riderChoice} from '../riderChoices.ts';
import {DowntownArena} from '../../../../ride-core/src/royale/downtownArena.ts';
import {TagTerrain} from '../../../../ride-core/src/tag/fixture.ts';
import {loadFixture} from '../../../../ride-core/src/fixtureLoader.ts';
import {buildDetroitArenaScene} from './detroitScene.ts';
import {RouteSky,DAY_SUN,DAY_HAZE} from '../routeSky.ts';
import {followStableSun} from '../stableSun.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {WEAPONS,neutral,DT,PROTECTION,weaponSocket,type Command} from '../../../../ride-core/src/royale/rules.ts';
import {RoyaleSession} from '../../../../ride-core/src/royaleClient.ts';
import {createGraphicsQuality,startupAntialias} from '../graphicsQuality.ts';
import {FrameSchedule} from '../frameSchedule.ts';
import {AdaptiveQuality} from '../adaptiveQuality.ts';
import {touchLayout} from './touchLayout.ts';
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
dialog.close();dialog.showModal();
for(const r of RIDER_CHOICES)skin.add(new Option(r.label,r.id));skin.value=riderChoice(null);
const wheel=el<HTMLSelectElement>('wheel');for(const w of WHEELS)wheel.add(new Option(w.name+' · '+Math.round(w.topKph)+' km/h',w.id));
const stanceGesture=new StanceGesture();const leanGesture=new LeanGesture();const aimGesture=new AimGesture();let touchAds=false,adsSensitivity=.65,touchDisplay='auto',touchAim='toggle',stickMode='fixed';const resetPointers:Array<()=>void>=[];
for(const [id,fallback] of [['ads-sensitivity','0.65'],['touch-display','auto'],['touch-aim','toggle'],['touch-lean','toggle'],['stick-mode','fixed']]){const field=el<HTMLInputElement>(id);try{field.value=localStorage.getItem('royale-'+id)??fallback;}catch{field.value=fallback;}const apply=()=>{if(id==='ads-sensitivity')adsSensitivity=T.MathUtils.clamp(Number(field.value)||.65,.2,1.5);if(id==='touch-display')touchDisplay=field.value;if(id==='touch-aim'){touchAim=field.value;touchAds=false;}if(id==='touch-lean'){leanGesture.mode=field.value==='hold'?'hold':'toggle';leanGesture.reset();}if(id==='stick-mode')stickMode=field.value;};field.onchange=()=>{apply();try{localStorage.setItem('royale-'+id,field.value);}catch{}};apply();}
let bindings=readBindings(null),lookYaw=0,lookPitch=0;
const cameraModes=['chase','first','front','side','orbit','drone'] as const;
type ViewMode=typeof cameraModes[number];let viewMode:ViewMode='chase',sensitivity=1;const cameraBlend=new CameraBlend();
try{const saved=localStorage.getItem('royale-camera');if(cameraModes.includes(saved as ViewMode))viewMode=saved as ViewMode;const value=Number(localStorage.getItem('royale-aim-sensitivity'));if(value>=.4&&value<=2)sensitivity=value;}catch{}
function setCamera(mode:ViewMode){viewMode=mode;el<HTMLSelectElement>('camera-view').value=mode;try{localStorage.setItem('royale-camera',mode);}catch{}}
function cycleCamera(){setCamera(cameraModes[(cameraModes.indexOf(viewMode)+1)%cameraModes.length]);}
setCamera(viewMode);el<HTMLSelectElement>('camera-view').onchange=e=>setCamera((e.target as HTMLSelectElement).value as ViewMode);
const sensitivityInput=el<HTMLInputElement>('aim-sensitivity');sensitivityInput.value=String(sensitivity);sensitivityInput.oninput=()=>{sensitivity=Number(sensitivityInput.value);try{localStorage.setItem('royale-aim-sensitivity',String(sensitivity));}catch{}};
mountCameraPreferences(el('camera-settings'));mountHudTransparency(el('camera-settings'));gyroscope.mount(el('camera-settings'),true);
try{bindings=readBindings(JSON.parse(localStorage.getItem('royale-combat-bindings')??'null'));const preset=localStorage.getItem('royale-aim-preset');if(['classic','hold','toggle'].includes(preset??''))aimGesture.preset=preset as AimPreset;}catch{}
el<HTMLSelectElement>('aim-preset').value=aimGesture.preset;el<HTMLSelectElement>('aim-preset').onchange=e=>{aimGesture.reset();aimGesture.preset=(e.target as HTMLSelectElement).value as AimPreset;try{localStorage.setItem('royale-aim-preset',aimGesture.preset);}catch{}};
for(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const label=document.createElement('label');label.textContent=key;const input=document.createElement('button');input.textContent=bindings[key];input.onclick=()=>{input.textContent='Press a key…';input.onkeydown=e=>{e.preventDefault();e.stopPropagation();bindings=readBindings({...bindings,[key]:e.code});try{localStorage.setItem('royale-combat-bindings',JSON.stringify(bindings));}catch{}for(const b of el('bindings').querySelectorAll('button'))b.textContent=bindings[b.dataset.binding as keyof typeof bindings];input.onkeydown=null;};};input.dataset.binding=key;label.append(input);el('bindings').append(label);}
const scene=new T.Scene();scene.background=new T.Color(DAY_HAZE);scene.fog=new T.Fog(DAY_HAZE,280,1200);
const camera=new T.PerspectiveCamera(62,1,.12,4200);camera.position.set(65,85,100);camera.lookAt(0,0,0);
const renderer=new T.WebGLRenderer({canvas,antialias:startupAntialias()});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.type=T.PCFShadowMap;
const atmosphereSky=new RouteSky();scene.add(atmosphereSky);const sky=new T.HemisphereLight('#d3e9f6','#5e665b',.72);scene.add(sky);const sun=new T.DirectionalLight('#fff0d7',2.15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:36,bottom:-30,near:.1,far:100});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);followStableSun(sun,{x:0,y:0,z:0},DAY_SUN);
const graphics=createGraphicsQuality(renderer,scene,canvas);
const fill=new T.DirectionalLight('#c1d7ed',.18);fill.position.set(-12,8,-13);scene.add(fill,fill.target);
graphics.mount(el('graphics-settings'));

const fieldRing=new FieldBoundary('#63efd9',.9);scene.add(fieldRing);
const nextRing=new FieldBoundary('#efc568',.75);scene.add(nextRing);
let radarMap:RoyaleRadarMap|undefined;let shieldAsset:GLTF;let companions:RoyaleCompanions|undefined;
const actors=new Map<string,{view:Hero;equipment:WeaponView;weapon:T.Group;shield:ShieldEffect;rig:CombatRig;wheelId:string;optic:T.Group}>(),assetMap=new Map<string,GLTF>(),items=new Map<string,EquipmentView|ScopePickup>();
let scopeLibrary:ScopeLibrary,selectedScope:Scope|null=null,ownedScopeKey='',scopePadHeld=false;
function changeScope(){selectedScope=cycleScope(session?.state?.self?.scopes??[],selectedScope);canvas.focus();}
el('scope-select').onclick=changeScope;
new ResizeObserver(()=>{document.documentElement.style.setProperty('--royale-hud-bottom',el('hud').getBoundingClientRect().bottom+'px');loadLayout();}).observe(el('hud'));
let equipmentLibrary:EquipmentLibrary,equipmentTime=0,equipmentRound='',equipmentShots=0,previousShotTick=-999;
const seenShots=new Set<string>(),reducedEquipmentMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scenery:Awaited<ReturnType<typeof buildDetroitArenaScene>>;
let ambientPacks:AmbientCyclistPacks|undefined;let jazzVisit:JazzVisit|undefined;
let terrain:DowntownArena,session:RoyaleSession,loaded=false,acc=0,last=performance.now(),hudAt=0,paused=false,layoutEditing=false,aimYaw=0,aimPitch=0,slot=0;
const footControls=new FootControls();const deathReplay=new DeathReplay(),impactEffect=new ImpactEffect();scene.add(impactEffect);const seenImpacts=new Set<string>(),fallenAt=new Map<string,number>();let hitFlashUntil=0;
const bots=()=>Math.min(Number(el<HTMLSelectElement>('bot-count').value),Number(el<HTMLSelectElement>('match-size').value)-1);
el('reentry-confirm').onclick=()=>{deathReplay.stop();release();session.requestReentry(true);};el('reentry-decline').onclick=()=>session.requestReentry(false);
function playDeathReplay(){release();deathReplay.start(performance.now());if(deathReplay.playing)dialog.close();}el('death-replay').onclick=playDeathReplay;el('reentry-replay').onclick=playDeathReplay;el('replay-stop').onclick=()=>deathReplay.stop();
const keys=new Set<string>(),held=new Set<string>(),tap=new Set<string>();let throttle=0,steer=0,aimPointer:number|undefined,aimX=0,aimY=0,stickPointer:number|undefined;
const message=(s:string)=>el('message').textContent=s;
function release(){footControls.clear();stanceGesture.reset();leanGesture.reset();touchAds=false;aimGesture.reset();lookYaw=lookPitch=0;keys.clear();held.clear();tap.clear();steer=throttle=0;aimPointer=stickPointer=undefined;resetPointers.forEach(reset=>reset());session?.release();}
function finishLayoutEditing(){if(layoutEditing)saveLayout();layoutEditing=false;el('touch').classList.remove('editing');el('layout-done').hidden=true;release();}
function clearResults(){el('results').replaceChildren();el('rematch').hidden=true;}
function showMenu(){finishLayoutEditing();paused=true;if(dialog.open)dialog.close();dialog.showModal();el('resume').hidden=!session?.state;el('quit').hidden=!session?.state;}
function resume(){finishLayoutEditing();paused=false;dialog.close();canvas.focus();loadLayout();}
el('settings-open').onclick=()=>{showMenu();el<HTMLDetailsElement>('ride-settings').open=true;el('camera-view').focus();};
el('menu').onclick=showMenu;el('resume').onclick=resume;dialog.addEventListener('cancel',e=>{e.preventDefault();if(session?.state)resume();});
async function run(work:()=>void|Promise<void>){try{message('');await work();}catch(e){message((e as Error).message);}}
async function prepare(){const hdr=await new HDRLoader().loadAsync(new URL('../../../art/nvidia/detroit-skylight.hdr',import.meta.url).href),pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.36;hdr.dispose();pm.dispose();await loadEngineForPage(true);if(!engineReady())throw Error('Compiled arena could not load. Return to normal riding or retry.');message('Loading the original Detroit map…');terrain=new DowntownArena(await TagTerrain.create(await loadFixture(new URL('./love-tag/swoop-detroit.json',location.href).href)));session=new RoyaleSession(terrain);radarMap=new RoyaleRadarMap(terrain);scenery=await buildDetroitArenaScene(scene,terrain);canvas.dataset.arena=terrain.arenaIdentity.arena;canvas.dataset.collision=terrain.arenaIdentity.collision;
 const loader=new GLTFLoader();await loadAssetQueue(['DS_EUC_01','DS_Cyclist_01','DS_Bicycle_01',...RIDER_CHOICES.map(r=>r.id)],assetConcurrency(),async id=>assetMap.set(id,await loader.loadAsync('/exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb')));
 assetMap.set('DS_Boerboel_01',await loader.loadAsync('/exports/polish/royale-equipment/royale-dog.glb'));companions=new RoyaleCompanions(scene,assetMap,terrain);
 await loadAssetQueue(WHEELS.filter(w=>w.id!=='euc'),assetConcurrency(),async w=>assetMap.set(w.asset,await loader.loadAsync('/exports/electric/'+w.asset+'.glb')));
 equipmentLibrary=await EquipmentLibrary.load(loader,new URL('./exports/polish/royale-equipment/',location.href));canvas.dataset.equipment='Higgsfield-Blender-Unity:7-equipment-models;Blender-dog-power-clips';
 scopeLibrary=new ScopeLibrary(await loader.loadAsync('/exports/polish/royale-equipment/scope.glb'));
 shieldAsset=await loader.loadAsync('/exports/polish/royale-equipment/rider-shield.glb');
 session.voice?.root.addEventListener('toggle',()=>{if(session.voice?.root.open)release();});
 const mapTransform=terrain.terrain.fixture.transform;ambientPacks=new AmbientCyclistPacks(scene,assetMap,terrain,cyclistCircuit(Array.from({length:100},(_,i)=>{const p=cutPoint(60+i*(LENGTH-120)/99);return {x:(p.x-mapTransform.tx)/mapTransform.sx,z:p.z-mapTransform.tz,width:5};})));canvas.dataset.ambientPackSizes='10,10';canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks.starts);
 jazzVisit=new JazzVisit(scene,scenery.jazz.clubs,assetMap,()=>actors.get(session.me)!.view,()=>{const was=paused;paused=true;release();return was;},was=>{paused=was;release();canvas.focus();},{toMap:(x,y,z)=>terrain.sourcePosition({x,y,z}),toLocal:(x,y,z)=>{const t=terrain.terrain.fixture.transform;return{x:(x-t.tx)/t.sx,y:y-t.ty,z:z-t.tz};}});
 graphics.apply();loaded=true;loadedAt=performance.now();canvas.dataset.loadMs=String(Math.round(loadedAt));el<HTMLButtonElement>('practice').disabled=false;el('practice').textContent='Practice with AI opponents →';message('Original Detroit arena ready. Choose six or ten riders; AI fills empty seats when enabled.');
 if(query.get('room')){el<HTMLInputElement>('code').value=query.get('room')!;el<HTMLDetailsElement>('online').open=true;}
}
el<HTMLInputElement>('use-relay').onchange=()=>{el<HTMLInputElement>('endpoint').closest('label')!.hidden=el<HTMLInputElement>('use-relay').checked;};
function practice(){clearResults();session.offline(skin.value,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,bots());slot=0;resume();}
el('practice').onclick=()=>run(practice);
let relayConfig:{endpoint:string;publishableKey:string}|undefined;
async function connectRoom(create:boolean){if(!loaded)throw Error('Wait for the arena to finish loading.');const code=el<HTMLInputElement>('code').value.trim(),name=el<HTMLInputElement>('name').value,fill=el<HTMLInputElement>('botfill').checked,spectate=el<HTMLInputElement>('spectate').checked;
if(relayConfig&&el<HTMLInputElement>('use-relay').checked)await session.supabase({...relayConfig,accessCode:el<HTMLInputElement>('test-code').value.trim()},create,code,name,skin.value,fill,spectate,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,bots());
else await session.online(el<HTMLInputElement>('endpoint').value,create,code,name,skin.value,fill,spectate,wheel.value,el<HTMLSelectElement>('match-size').value==='10'?10:6,el<HTMLInputElement>('bot-chase').checked,bots());clearResults();}
el('create').onclick=()=>run(()=>connectRoom(true));
el('join').onclick=()=>run(()=>connectRoom(false));
el('ready').onclick=()=>session.readyUp();el('launch').onclick=()=>session.start();el('reconnect').onclick=()=>run(()=>{if(relayConfig&&el<HTMLInputElement>('use-relay').checked)session.relayConfig={...relayConfig,accessCode:el<HTMLInputElement>('test-code').value.trim()};return session.reconnect();});
el('rematch').onclick=()=>run(()=>{if(session.room){session.readyUp();session.start();}else practice();});
el('quit').onclick=()=>{finishLayoutEditing();session.leave();clearResults();paused=false;el('resume').hidden=el('quit').hidden=true;message('You left the match.');};
el('connection-menu').onclick=()=>{showMenu();el<HTMLDetailsElement>('online').open=true;el('reconnect').focus();};
el('invite').onclick=()=>run(async()=>{const u=new URL(location.href);u.searchParams.set('room',session.code);const field=el<HTMLInputElement>('invite-link');field.hidden=false;field.value=u.href;try{await navigator.clipboard.writeText(u.href);message('Invitation copied.');}catch{field.select();message('Select and copy this invitation.');}});
void fetch('./royale-config.json').then(r=>r.ok?r.json():{}).then((c:{supabaseTest?:{endpoint:string;publishableKey:string};serverUrl?:string})=>{relayConfig=c.supabaseTest;el('supabase-test').hidden=!relayConfig;el<HTMLInputElement>('endpoint').closest('label')!.hidden=!!relayConfig;el<HTMLInputElement>('endpoint').value=c.serverUrl||(['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8226':'');}).catch(()=>{});
function buttonAction(action:string){if(action==='crouch'||action==='prone'){stanceGesture.down(action==='crouch'?1:2);return;}if(action==='hop')stanceGesture.reset();if(action==='lean-left'||action==='lean-right'){leanGesture.down(action==='lean-left'?-1:1);return;}if(action==='scope'){changeScope();return;}if(action==='camera'){cycleCamera();return;}if(action==='fire-left'){tap.add('fire-left');return;}if(action==='aim'){if(touchAim==='toggle')touchAds=!touchAds;return;}if(action==='switch'){slot=1-slot;return;}tap.add(action);}
window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,select,textarea,button')||dialog.open||deathReplay.playing||session?.voice?.root.open)return;
 if([...Object.values(bindings),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'||e.code===bindings.loadout){showMenu();return;}
 if(!keys.has(e.code)){if(e.code===bindings.crouch)stanceGesture.down(1);if(e.code===bindings.prone)stanceGesture.down(2);if(e.code===bindings.hop)stanceGesture.reset();for(const [key,action] of [['hop','hop'],['utility','utility'],['repair','repair'],['recover','recover'],['reload','reload'],['pickup','swap'],['cycleMode','cycleMode'],['dogAttack','dog-attack'],['dogRadar','dog-radar']] as const)if(e.code===bindings[key])tap.add(action);if(e.code===bindings.camera)cycleCamera();if(e.code===bindings.scope)changeScope();}
 keys.add(e.code);if(e.code==='Digit1')slot=0;if(e.code==='Digit2')slot=1;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);window.addEventListener('gamepaddisconnected',release);
document.addEventListener('visibilitychange',()=>{release();last=performance.now();acc=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(dialog.open)return;e.preventDefault();slot=1-slot;},{passive:false});
const aimGain=(gain:number)=>gain*sensitivity*(aimMode()===2?adsSensitivity/scopeZoom(selectedScope):1);
function look(dx:number,dy:number,gain:number){const next=dragAim(aimYaw,aimPitch,dx,dy,aimGain(gain));aimYaw=next.yaw;aimPitch=next.pitch;}
canvas.addEventListener('pointerdown',e=>{if(dialog.open||deathReplay.playing||e.pointerType!=='mouse'&&(aimPointer!==undefined||e.clientX<innerWidth*.4))return;canvas.focus();canvas.setPointerCapture(e.pointerId);aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;if(e.pointerType==='mouse'){if(e.button===0){held.add('fire');tap.add('fire');}if(e.button===2)aimGesture.down(performance.now());}});
canvas.addEventListener('pointermove',e=>{if(dialog.open||deathReplay.playing||e.pointerType!=='mouse'&&aimPointer!==e.pointerId)return;
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
el('layout').onclick=()=>{release();paused=true;layoutEditing=true;el('touch').classList.add('editing');el('touch').hidden=false;el('layout-done').hidden=false;dialog.close();loadLayout();el('hint').textContent='Drag controls. Tap Done to save and return.';};
el('layout-done').onclick=()=>session?.state?resume():showMenu();
el('reset-layout').onclick=()=>{try{localStorage.removeItem(layoutKey());}catch{}loadLayout();};
el<HTMLInputElement>('button-size').oninput=e=>{try{localStorage.setItem('royale-touch-size',(e.target as HTMLInputElement).value);}catch{}loadLayout();};
try{const size=Number(localStorage.getItem('royale-touch-size'));if(size>=48&&size<=86){el<HTMLInputElement>('button-size').value=String(size);el('touch').style.setProperty('--touch-size',size+'px');}}catch{}
const ridingAim=new Map<number,{x:number;y:number}>();
for(const node of Array.from(el('touch').children)){
 const h=node as HTMLElement;let pointer:number|undefined,dx=0,dy=0,originX=0,originY=0;const act=()=>h.dataset.action;
 h.addEventListener('pointerdown',e=>{if(pointer!==undefined)return;e.preventDefault();pointer=e.pointerId;ridingAim.set(pointer,{x:e.clientX,y:e.clientY});h.setPointerCapture(pointer);const r=h.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;
  if(layoutEditing)return;if(h.id==='move-pad'){if(stickPointer!==undefined)return;stickPointer=pointer;originX=stickMode==='floating'?e.clientX:r.left+r.width/2;originY=stickMode==='floating'?e.clientY:r.top+r.height/2;const axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;}
  else if(h.id==='aim-pad'){aimPointer=pointer;aimX=e.clientX;aimY=e.clientY;}else {held.add(act()!);buttonAction(act()!);}h.classList.add('active');
 });
 h.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;
  if(layoutEditing){h.style.left=T.MathUtils.clamp(e.clientX-dx,0,innerWidth-h.offsetWidth)+'px';h.style.top=T.MathUtils.clamp(e.clientY-dy,0,innerHeight-h.offsetHeight)+'px';h.style.right=h.style.bottom='auto';h.dataset.customPosition='true';return;}
  if(h.id==='move-pad'&&pointer===stickPointer){const r=h.getBoundingClientRect(),axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width/2);steer=axes.steer;throttle=axes.throttle;h.style.setProperty('--stick-x',(steer*28)+'px');h.style.setProperty('--stick-y',(-throttle*28)+'px');}
  else if((act()==='fire'||act()==='free-look')&&pointer!==undefined){const mx=e.clientX-(ridingAim.get(pointer)?.x??e.clientX),my=e.clientY-(ridingAim.get(pointer)?.y??e.clientY);ridingAim.set(pointer,{x:e.clientX,y:e.clientY});if(act()==='free-look'){lookYaw=T.MathUtils.clamp(lookYaw-mx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-my*.004,-.8,.8);}else look(mx,my,.004);}
  else if(h.id==='aim-pad'&&pointer===aimPointer){look(e.clientX-aimX,e.clientY-aimY,.004);aimX=e.clientX;aimY=e.clientY;}
 });
 const up=()=>{if(pointer===undefined)return;if(pointer!==undefined)ridingAim.delete(pointer);if(h.id==='move-pad'&&pointer===stickPointer){stickPointer=undefined;steer=throttle=0;h.style.setProperty('--stick-x','0px');h.style.setProperty('--stick-y','0px');}if(pointer===aimPointer)aimPointer=undefined;held.delete(act()!);pointer=undefined;h.classList.remove('active');if(layoutEditing)saveLayout();};
 resetPointers.push(up);for(const type of ['pointerup','pointercancel','lostpointercapture'])h.addEventListener(type,e=>{if((e as PointerEvent).pointerId===pointer)up();});
}
function aimMode(){return touchAds||touchAim==='hold'&&held.has('aim')||navigator.getGamepads?.()[0]?.buttons[6]?.pressed?2:aimGesture.get(performance.now());}
function command():Command{const c=neutral(session.state?.round??'');const pad=navigator.getGamepads?.()[0];const axis=(n:number)=>deadZone(pad?.axes[n]??0);
 const scopePressed=!!pad?.buttons[12]?.pressed;if(scopePressed&&!scopePadHeld)changeScope();scopePadHeld=scopePressed;
 c.throttle=T.MathUtils.clamp(throttle+Number(keys.has(bindings.forward)||keys.has('ArrowUp'))-Number(keys.has(bindings.brake)||keys.has('ArrowDown'))-axis(1),-1,1);
 c.steer=T.MathUtils.clamp(steer+Number(keys.has(bindings.right)||keys.has('ArrowRight'))-Number(keys.has(bindings.left)||keys.has('ArrowLeft'))+axis(0),-1,1);
 look(axis(2)*6,axis(3)*4.5,.004);const gyro=gyroscope.consume(1/60,!dialog.open&&!paused,aimMode()===2||viewMode==='first');aimYaw=T.MathUtils.clamp(aimYaw-gyro.yaw,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch+gyro.pitch,-.65,.65);c.aimYaw=aimYaw;c.aimPitch=aimPitch;
 c.fire=(held.has('fire')||held.has('fire-left')||tap.has('fire')||tap.has('fire-left'))||!!pad?.buttons[7]?.pressed;c.aimMode=aimMode();if(c.fire&&!c.aimMode&&viewMode!=='first'&&viewMode!=='chase')setCamera('chase');
 c.reload=tap.has('reload')||!!pad?.buttons[2]?.pressed;c.cycleMode=tap.has('cycleMode');c.lean=leanGesture.get(keys.has(bindings.leanLeft),keys.has(bindings.leanRight),held.has('lean-left'),held.has('lean-right'));c.crouch=stanceGesture.value===1;c.prone=stanceGesture.value===2;
 c.hop=tap.has('hop')||!!pad?.buttons[0]?.pressed;c.hopHeld=held.has('hop')||keys.has(bindings.hop)||!!pad?.buttons[0]?.pressed;c.dismount=footControls.consume();c.burst=footControls.run||held.has('burst')||keys.has(bindings.burst)||!!pad?.buttons[4]?.pressed;
 c.dogAttack=tap.has('dog-attack');c.dogRadar=tap.has('dog-radar');c.utility=tap.has('utility')||!!pad?.buttons[5]?.pressed;c.repair=tap.has('repair')||!!pad?.buttons[3]?.pressed;c.recover=tap.has('recover');c.swap=tap.has('swap');c.slot=slot;tap.clear();return c;
}
function view(id:string,choice:string,wheelId:string){let a=actors.get(id);if(a&&a.view.riderId===riderChoice(choice)&&a.wheelId===wheelId)return a;if(a){a.view.dispose();a.equipment.dispose();a.shield.dispose();}
 const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheelId).asset)!);const hero=new Hero(models,terrain,riderChoice(choice)),equipment=new WeaponView(equipmentLibrary),weapon=equipment.root;scene.add(hero.root,weapon);
 const optic=scopeLibrary.model();optic.position.set(0,.105,.08);weapon.add(optic);
 const shield=new ShieldEffect(shieldAsset);scene.add(shield);a={view:hero,equipment,weapon,shield,optic,rig:new CombatRig(hero,equipment),wheelId};actors.set(id,a);return a;
}
const heartShots=new HeartProjectiles();scene.add(heartShots);
function draw(now:number){
 if(session?.voice){const parent=dialog.open?dialog:document.body;if(session.voice.root.parentNode!==parent)parent.append(session.voice.root);}

 const delta=equipmentTime?Math.min(.1,(now-equipmentTime)/1000):0;equipmentTime=now;
 const motionDelta=paused&&!session?.room?0:delta,reducedMotion=reducedEquipmentMotion.matches||document.documentElement.dataset.reducedMotion==='true'||query.has('reducedMotion');
 atmosphereSky.tick(motionDelta,scene.fog?.color,graphics.current.shadows===0,reducedMotion,paused&&!session?.room);canvas.dataset.atmosphere=JSON.stringify(atmosphereSky.status);
 const replayFrame=deathReplay.sample(now);const replaying=!!replayFrame;const s=replayFrame?.state??session?.state;el('replay-status').hidden=!replaying;if(!s){for(const a of actors.values()){a.view.root.visible=a.weapon.visible=a.shield.visible=false;}companions?.dispose();jazzVisit?.stop();heartShots.reset();for(const m of items.values())m.root.visible=false;el('hud').hidden=el('reticle').hidden=el('scope-mask').hidden=true;return;}const rendered=new Set<string>();
 radarMap?.update(s,now,!dialog.open&&!!s.self?.alive);
 const bikeObserver=s.actors.find(a=>a.id===session.me)?.pose??terrain.spawns[0].position;ambientPacks?.update(delta,bikeObserver,!dialog.open,paused,s.actors.filter(a=>a.alive).map(a=>({id:a.id,...a.pose,radius:.65,height:1.8,kind:'rider' as const,vx:Math.sin(a.pose.headingY)*a.pose.speed,vz:Math.cos(a.pose.headingY)*a.pose.speed})));ambientPacks?.report(canvas,delta);
 if(equipmentRound!==s.round){jazzVisit?.stop();equipmentRound=s.round;companions?.dispose();selectedScope=null;ownedScopeKey='';ambientPacks?.restart(undefined,bikeObserver);canvas.dataset.ambientPackStarts=JSON.stringify(ambientPacks?.starts);seenShots.clear();seenImpacts.clear();fallenAt.clear();impactEffect.reset();deathReplay.reset();previousShotTick=-999;for(const item of items.values())item.dispose();items.clear();}
 const owned=s.self?.scopes??[],scopeKey=owned.join(',');if(scopeKey!==ownedScopeKey){selectedScope=bestScope(owned);ownedScopeKey=scopeKey;}if(selectedScope&&!owned.includes(selectedScope))selectedScope=null;
 const firing=new Set<string>();
 // Only accepted server/offline-authority shots trigger recoil. No click-predicted damage or fire.
 if(s.self&&s.self.shotAt!==previousShotTick){if(s.self.shotAt>=0&&s.tick-s.self.shotAt<12)firing.add(s.self.id);previousShotTick=s.self.shotAt;}
 for(const projectile of s.projectiles){const key=projectile.owner+':'+projectile.shot;if(!seenShots.has(key)){seenShots.add(key);if(projectile.owner!==s.self?.id)firing.add(projectile.owner);}}
 for(const actor of s.actors){const a=view(actor.id,actor.skin,actor.wheelId??'euc');if(!actor.alive&&!fallenAt.has(actor.id))fallenAt.set(actor.id,s.tick);if(actor.alive)fallenAt.delete(actor.id);const falling=!actor.alive&&s.tick-(fallenAt.get(actor.id)??s.tick)<90;a.view.root.visible=actor.alive||falling;a.weapon.visible=actor.alive;a.shield.visible=actor.alive&&(actor.shieldActive||actor.protected);a.shield.scale.setScalar(actor.protected&&!actor.shieldActive?.88:1);rendered.add(actor.id);let pose={...actor.pose};
  if(!replaying&&actor.id===session.me&&session.room&&session.prediction)pose={...session.prediction.controller.poseValue};
  else if(!replaying&&session.room){const previous=session.previous?.actors.find(x=>x.id===actor.id);const old=previous?.spawnSerial===actor.spawnSerial?previous.pose:undefined,t=T.MathUtils.clamp((now-session.received)/50,0,1);if(old){pose.x=T.MathUtils.lerp(old.x,pose.x,t);pose.y=T.MathUtils.lerp(old.y,pose.y,t);pose.z=T.MathUtils.lerp(old.z,pose.z,t);pose.headingY=old.headingY+Math.atan2(Math.sin(pose.headingY-old.headingY),Math.cos(pose.headingY-old.headingY))*t;}}
  if(falling)pose.crashBlend=Math.min(1,(s.tick-(fallenAt.get(actor.id)??s.tick))/24);pose.stopFoot=0;a.view.apply({...pose,seated:0});const yaw=actor.id===session.me&&!replaying?aimYaw:actor.aimYaw,pitch=actor.id===session.me&&!replaying?aimPitch:actor.aimPitch;
  a.optic.visible=!!(actor.id===session.me?selectedScope:actor.scope);a.equipment.select(actor.weapon);if(firing.has(actor.id)&&a.equipment.fire(reducedMotion))equipmentShots++;a.equipment.update(motionDelta,reducedMotion);a.weapon.visible=actor.alive&&pose.crashBlend<.05;
  if(a.weapon.visible)a.rig.apply({...pose,seated:0},yaw,pitch,actor.combat,s.tick);
  if(actor.id===session.me)canvas.dataset.rig=JSON.stringify({rider:actor.skin,wheel:actor.wheelId,rightError:a.rig.errorR,leftError:a.rig.errorL,supportLocked:a.rig.supportLocked});
  a.shield.position.set(pose.x,pose.y+1,pose.z);a.shield.rotation.y=pose.headingY-Math.PI/2;
  a.shield.update(motionDelta,reducedMotion,graphics.current.shadows===0);
 }
 for(const [id,a]of actors)if(!rendered.has(id)){a.view.root.visible=false;a.weapon.visible=false;a.shield.visible=false;}

 companions?.update(s.actors,s.roster,s.tick,motionDelta,graphics.current.shadows===0);canvas.dataset.companions=String(s.actors.filter(a=>a.alive).length);
 const presentLoot=new Set(s.loot.map(item=>item.id));
 for(const loot of s.loot){let item=items.get(loot.id);if(!item){item=isScope(loot.kind)?scopeLibrary.pickup(loot.kind):equipmentLibrary.create(loot.kind);items.set(loot.id,item);scene.add(item.root);}item.root.visible=Math.hypot(loot.p.x-bikeObserver.x,loot.p.z-bikeObserver.z)<100;item.root.position.set(loot.p.x,loot.p.y+.65,loot.p.z);item.root.scale.setScalar(isScope(loot.kind)?1:1.7);if(item.root.visible)item.update(motionDelta,reducedMotion);}
 for(const [id,item]of items)if(!presentLoot.has(id))item.root.visible=false;
 canvas.dataset.equipmentShots=String(equipmentShots);canvas.dataset.equipmentWeapon=s.actors.find(a=>a.id===session.me)?.weapon??'';
 fieldRing.update(s.field.x,s.field.z,s.field.radius,(x,z)=>terrain.ground(x,z).height);
 nextRing.update(s.field.x,s.field.z,s.field.nextRadius,(x,z)=>terrain.ground(x,z).height);
 canvas.dataset.field=JSON.stringify(s.field);
 const self=s.actors.find(a=>a.id===session.me);if(self){const p=!replaying&&session.room&&session.prediction?session.prediction.controller.poseValue:self.pose,mode=replaying?(self.combat.aimBlend>.8?2:0):aimMode(),ads=mode===2;
 if(!keys.has(bindings.freeLook)&&!held.has('free-look')){lookYaw*=Math.exp(-delta*10);lookPitch*=Math.exp(-delta*10);}
 const heading=p.headingY+aimYaw+lookYaw+self.combat.kickYaw,pitch=aimPitch+lookPitch+self.combat.kickPitch;
 const scale=self.skin.startsWith('DS_Mascot_')?.48:1,socket=weaponSocket(p,self.skin,aimYaw,aimPitch,self.combat.aimBlend,self.combat.lean);
 const at=new T.Vector3(socket.grip.x,socket.grip.y+.10*scale,socket.grip.z),forward=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const activeMode=ads?'ads':mode===1?'shoulder':viewMode;
 const profile=CAMERA_PROFILE.cameras.find(c=>c.mode===(activeMode==='shoulder'?'chase':activeMode))!;
 const eyeView=ads||viewMode==='first'&&mode!==1;
 const angle=activeMode==='orbit'?p.headingY+lookYaw+aimYaw:heading;
 const mine=actors.get(self.id),sight=mine?.equipment.socket(EQUIPMENT_SOCKETS.sight_axis)??at;
 const desired=eyeView?combatEye(sight,heading,pitch,scale,ads):
   activeMode==='chase'||activeMode==='shoulder'?at.clone().addScaledVector(forward,activeMode==='shoulder'?-2.4:-profile.back).add(new T.Vector3(Math.cos(heading)*profile.side,profile.height,-Math.sin(heading)*profile.side)):
   at.clone().add(new T.Vector3(-Math.sin(angle)*profile.back+Math.cos(angle)*profile.side,profile.height,-Math.cos(angle)*profile.back-Math.sin(angle)*profile.side));
 clearRideCamera(terrain,desired,at,p.y);
 followStableSun(sun,p,DAY_SUN);fill.position.set(p.x-12,p.y+8,p.z-13);fill.target.position.set(p.x,p.y+1,p.z);
 scenery.update(p,now/1000);camera.position.copy(desired);
 camera.lookAt(eyeView||activeMode==='chase'||activeMode==='shoulder'?desired.clone().addScaledVector(forward,100):at);
 camera.fov=ads?scopedFov(profile.fov,selectedScope):profile.fov;cameraBlend.apply(camera,activeMode,delta,reducedEquipmentMotion.matches||!cameraTransitionsEnabled());
 clearRideCamera(terrain,camera.position,at,p.y);camera.updateProjectionMatrix();
 canvas.dataset.cameraMode=viewMode;canvas.dataset.cameraActive=activeMode;canvas.dataset.cameraFov=camera.fov.toFixed(2);
 if(mine){mine.view.rider.visible=!eyeView;if(ads&&selectedScope)mine.weapon.visible=false;}
 el('scope-mask').hidden=!ads||!selectedScope||dialog.open||!self.alive;
 el('scope-magnification').textContent=selectedScope?SCOPES[selectedScope].label:'';
 canvas.dataset.optics=JSON.stringify({selected:selectedScope,owned,zoom:ads?scopeZoom(selectedScope):1,available:s.loot.filter(l=>isScope(l.kind)).length});
 canvas.dataset.aim=JSON.stringify({yaw:aimYaw,pitch:aimPitch,ads,steer,throttle,fire:held.has('fire')||held.has('fire-left'),lean:self.combat.lean,crouch:p.footCrouch,prone:p.footProne,footMode:p.footMode});for(const direction of [-1,1]){const b=el('touch').querySelector<HTMLButtonElement>(direction<0?'[data-action=lean-left]':'[data-action=lean-right]');b?.setAttribute('aria-pressed',String(self.combat.lean*direction>.1));}
 for(const [action,pressed]of [['crouch',p.footMode?p.footCrouch>.5:stanceGesture.value===1],['prone',p.footProne>.5]] as const)el('touch').querySelector('[data-action='+action+']')?.setAttribute('aria-pressed',String(pressed));
 jazzVisit?.update(p.x,p.z,!dialog.open&&!replaying&&self.alive,camera);
 const adsButton=el('touch').querySelector<HTMLButtonElement>('[data-action=aim]')!;adsButton.setAttribute('aria-pressed',String(ads));

 }
 if(replayFrame){camera.position.fromArray(replayFrame.camera.position);camera.quaternion.fromArray(replayFrame.camera.quaternion);camera.fov=replayFrame.camera.fov;camera.updateProjectionMatrix();}else deathReplay.observe(s,now,{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov});
 if(!replaying)for(const e of s.events){if(e.kind!=='hit'&&e.kind!=='dog-knockoff')continue;const key=s.round+':'+e.tick+':'+e.kind+':'+e.actor+':'+e.target;if(seenImpacts.has(key))continue;seenImpacts.add(key);if(s.tick-e.tick>30)continue;const victim=s.actors.find(a=>a.id===e.target);if(victim)impactEffect.hit(victim.pose,now,victim.shieldActive);if(e.target===session.me){hitFlashUntil=now+450;el('hit-flash').dataset.kind=e.kind==='dog-knockoff'?'knockdown':'bullet';}}
 if(seenImpacts.size>128){const oldest=seenImpacts.values().next().value;if(oldest)seenImpacts.delete(oldest);}
 impactEffect.visible=!replaying;impactEffect.update(now,reducedMotion);el('hit-flash').style.opacity=now<hitFlashUntil?'1':'0';
 heartShots.update(s.projectiles,camera,now/1000,reducedMotion);
 canvas.dataset.projectileEffect='hearts-and-sparkles';
 if(now-hudAt>150){hudAt=now;const me=s.self;el('hud').hidden=false;for(const [action,label,until]of [['dog-attack','Dog',me?.dogPower.ready??0],['dog-radar','Radar',me?.dogPower.radarReady??0]] as const){const b=el('touch').querySelector<HTMLButtonElement>('[data-action='+action+']')!;b.disabled=!me?.dogPower.charges||until>s.tick;b.textContent=until>s.tick?label+' '+Math.ceil((until-s.tick)/60)+'s':label+' '+(me?.dogPower.charges??0);}el('phase').textContent=s.phase==='deployment'?'DEPLOYING · '+Math.ceil((PROTECTION-s.tick)/60)+'s':s.remaining+' RIDERS REMAIN';
  const liveSelf=session.state?.self;const eligible=!!liveSelf?.reentry.eligible&&!dialog.open&&!replaying;el('reentry-panel').hidden=!eligible;el('reentry-countdown').textContent=liveSelf?'Confirm within '+Math.max(0,Math.ceil((liveSelf.reentry.until-(session.state?.tick??0))/60))+'s. New safe location; protection ends when you fight.':'';el<HTMLButtonElement>('reentry-replay').disabled=!deathReplay.available;el('death-replay').hidden=!deathReplay.available||!!liveSelf?.alive;
  el<HTMLProgressElement>('health-meter').value=me?.integrity??0;el('health-value').textContent=String(Math.ceil(me?.integrity??0));el<HTMLProgressElement>('shield-meter').value=me?.shield??0;el('shield-value').textContent=String(Math.ceil(me?.shield??0));const healing=!!me&&me.healingUntil>s.tick;el('health-feedback').textContent=healing?'Healing · '+Math.ceil((me!.healingUntil-s.tick)/60)+'s':me?.reentry.protectedUntil&&me.reentry.protectedUntil>s.tick?'Protected · '+Math.ceil((me.reentry.protectedUntil-s.tick)/60)+'s · combat cancels':me?'Health packs · '+me.repairs+' · H to heal':'';const healthButton=el('touch').querySelector<HTMLButtonElement>('[data-action=repair]')!;healthButton.textContent=healing?'Healing…':'Heal '+(me?.repairs??0);healthButton.disabled=!me?.repairs||healing||!me.alive;
  el('vitals').textContent=me?'Integrity '+Math.ceil(me.integrity)+' / Shield '+Math.ceil(me.shield)+' / Flow '+Math.round(me.energy):'Spectator · private live positions';
  const w=me?.loadout[me.slot];el('weapon').textContent=w?WEAPONS[w].name+' · '+me!.combat.magazine[w]+' / '+(me!.ammo[w]-me!.combat.magazine[w])+' · '+FIRE_MODES[me!.combat.fireMode]+(me!.combat.reloadStart>=0?' · Reloading…':''):'';
  const scopeKeyLabel=bindings.scope.replace(/^(Key|Digit)/,'');const scopeLabel=selectedScope?SCOPES[selectedScope].label:'Iron sights';el('scope-select').textContent='Scope · '+scopeLabel+' · '+scopeKeyLabel;el<HTMLButtonElement>('scope-select').disabled=!owned.length;el<HTMLButtonElement>('scope-select').title=owned.length?'Switch collected scopes':'Find a scope and ride or walk over it';
  const scopeTouch=el('touch').querySelector<HTMLButtonElement>('[data-action=scope]')!;scopeTouch.textContent=selectedScope?SCOPES[selectedScope].zoom+'×':'Scope';scopeTouch.disabled=!owned.length;
  const nearby=s.loot.filter(l=>isScope(l.kind)).map(l=>({l,d:Math.hypot(l.p.x-bikeObserver.x,l.p.z-bikeObserver.z)})).sort((a,b)=>a.d-b.d)[0];
  const pickup=s.events.filter(e=>e.actor===session.me&&e.kind.startsWith('pickup-scope')&&s.tick-e.tick<180).at(-1);
  el('scope-status').textContent=pickup?'Collected '+SCOPES[pickup.kind.slice(7) as Scope].label+' · Scope / '+scopeKeyLabel+' to switch':nearby&&nearby.d<30?SCOPES[nearby.l.kind as Scope].label+' · '+Math.ceil(nearby.d)+' m · ride or walk over to collect':'';
  el('speed').textContent=self?Math.round(Math.abs(self.pose.speed)*3.6)+' / '+Math.round(wheelProfile(self.wheelId).topKph)+' km/h · '+wheelProfile(self.wheelId).name+' · game estimate':'';
  el('field').textContent='Field '+Math.round(s.field.radius)+'m → '+Math.round(s.field.nextRadius)+'m · '+Math.ceil(s.field.remaining)+'s';
  el('reticle').hidden=!me?.alive||dialog.open||!!(selectedScope&&aimMode()===2)||(!aimMode()&&viewMode!=='chase'&&viewMode!=='first');el('touch').hidden=(!(touchDisplay==='on'||touchDisplay==='auto'&&matchMedia('(any-pointer:coarse)').matches)||dialog.open||replaying||!me?.alive)&&!layoutEditing;
  el('hint').textContent=layoutEditing?'Move controls, then open Menu to finish.':Math.abs(aimYaw)>1.20?'Turn your wheel to aim farther.':replaying?'Last-view replay':me&&!me.alive?me.reentry.eligible?'Eliminated · one re-entry available':'Eliminated · last-view replay available':s.phase==='deployment'?'Spawn protection · weapons unlock when the countdown ends':me&&Math.hypot((self?.pose.x??0)-s.field.x,(self?.pose.z??0)-s.field.z)>s.field.radius?'Outside the Static Field — ride toward the gold circle!':!el('touch').hidden?'Left stick: move · right side: aim · Fire: shoot · ADS: sights':'WASD ride · mouse aim · click fire · right click ADS · R reload · J get off/on';
  el('room').hidden=!session.room;el('roomcode').textContent='Room '+session.code+(session.botFill?' · AI fill on':' · '+s.size+' human seats · AI fill off');
  el<HTMLButtonElement>('launch').disabled=session.host!==session.me;el('roster').replaceChildren(...s.roster.map(a=>{const li=document.createElement('li');li.textContent=a.name+(a.bot?' · AI':session.ready.includes(a.id)?' · Ready':' · Loading / not ready')+(!a.connected?' · Disconnected':'');return li;}));
  if(session.message)message(session.message);
  if(s.phase==='lobby'&&!dialog.open){showMenu();}if(s.phase==='deployment'&&dialog.open&&session.room){resume();}
  if(s.phase==='results'){if(!dialog.open&&!replaying)showMenu();el('rematch').hidden=false;el('results').textContent=(s.winner===session.me?'YOU WIN':s.winner?(s.roster.find(a=>a.id===s.winner)?.name??'Rider')+' WINS':'DRAW')+' · '+s.reason;const stats=s.results.find(r=>r.id===session.me);if(stats)el('results').textContent+=' — '+stats.kills+' eliminations · '+stats.damage+' damage · '+stats.distance+' m ridden';}
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
 footControls.update(session?.prediction?.controller.poseValue??session?.state?.actors.find(a=>a.id===session.me)?.pose??{},loaded&&!dialog.open&&!!session?.state?.self?.alive);
 if(loaded&&session.state&&(!paused||session.room)&&!layoutEditing){acc+=delta;let n=0;while(acc>=DT&&n++<9){try{session.step(dialog.open||paused||deathReplay.playing||session.voice?.root.open?neutral(session.state.round):command());}catch(error){paused=true;release();showMenu();message('The simulation stopped safely. Start a new practice or reconnect: '+(error as Error).message);break;}acc-=DT;}}else acc=0;
 if(!schedule.shouldRender(now,idle,false,graphics.current.fps))return;draw(now);renderer.render(scene,camera);samples.push(now-previousFrame);previousFrame=now;frames++;
 if(now-profileAt>2000){samples.sort((a,b)=>a-b);if(session?.state?.engine){canvas.dataset.engineModule=session.state.engine.module;canvas.dataset.engineFrames=String(session.state.engineInputFrames);canvas.dataset.engineTick=String(session.state.tick);}canvas.dataset.profile=JSON.stringify({fps:frames*1000/(now-profileAt),p95:samples[Math.floor(samples.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,idle,scale:adaptiveQuality.scale,detail:adaptiveQuality.detail});frames=0;profileAt=now;samples=[];}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();paused=true;showMenu();message('Graphics paused. Reload the page to restore the arena.');});
requestAnimationFrame(loop);void run(prepare);
window.addEventListener('pagehide',()=>{session?.leave();for(const a of actors.values()){a.view.dispose();a.equipment.dispose();a.shield.dispose();}for(const item of items.values())item.dispose();equipmentLibrary?.dispose();scopeLibrary?.dispose();terrain?.terrain.dispose();atmosphereSky.dispose();impactEffect.dispose();renderer.dispose();});










