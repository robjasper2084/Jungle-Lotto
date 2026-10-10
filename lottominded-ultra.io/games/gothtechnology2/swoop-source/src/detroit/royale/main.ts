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
import {RouteSky} from '../routeSky.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {WEAPONS,neutral,DT,PROTECTION,weaponSocket,type Command} from '../../../../ride-core/src/royale/rules.ts';
import {RoyaleSession} from '../../../../ride-core/src/royaleClient.ts';
import {createGraphicsQuality,startupAntialias} from '../graphicsQuality.ts';
import {FrameSchedule} from '../frameSchedule.ts';
import {EquipmentLibrary,WeaponView,type EquipmentView} from './equipment.ts';
import {CombatRig} from './combatRig.ts';
import {FieldBoundary} from './fieldBoundary.ts';
import {AimGesture,deadZone,readBindings,type AimPreset} from './combatControls.ts';
import {WHEELS,wheelProfile} from '../../../../ride-core/src/royale/wheelProfiles.ts';
import {FIRE_MODES} from '../../../../ride-core/src/royale/combatProfiles.ts';
const el=<K extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as K;
const canvas=el<HTMLCanvasElement>('arena'),dialog=el<HTMLDialogElement>('lobby'),skin=el<HTMLSelectElement>('skin'),query=new URLSearchParams(location.search);
const fromElmwood=query.get('from')==='elmwood',back=el<HTMLAnchorElement>('return');if(fromElmwood){back.href='../elmwood-explorer/elmwood.html';back.textContent='← Elmwood Explorer';}
if(engineRequested())back.href+=(back.href.includes('?')?'&':'?')+'engine=breadflower';
const menuBack=el<HTMLAnchorElement>('return-menu');menuBack.href=back.href;menuBack.textContent=back.textContent;
dialog.close();dialog.showModal();
for(const r of RIDER_CHOICES)skin.add(new Option(r.label,r.id));skin.value='DS_Man_01';
const wheel=el<HTMLSelectElement>('wheel');for(const w of WHEELS)wheel.add(new Option(w.name+' · '+Math.round(w.topKph)+' km/h',w.id));
const aimGesture=new AimGesture();let touchAds=false;let bindings=readBindings(null),lookYaw=0,lookPitch=0,firstPerson=false;
try{bindings=readBindings(JSON.parse(localStorage.getItem('royale-combat-bindings')??'null'));const preset=localStorage.getItem('royale-aim-preset');if(['classic','hold','toggle'].includes(preset??''))aimGesture.preset=preset as AimPreset;}catch{}
el<HTMLSelectElement>('aim-preset').value=aimGesture.preset;el<HTMLSelectElement>('aim-preset').onchange=e=>{aimGesture.reset();aimGesture.preset=(e.target as HTMLSelectElement).value as AimPreset;try{localStorage.setItem('royale-aim-preset',aimGesture.preset);}catch{}};
for(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const label=document.createElement('label');label.textContent=key;const input=document.createElement('button');input.textContent=bindings[key];input.onclick=()=>{input.textContent='Press a key…';input.onkeydown=e=>{e.preventDefault();e.stopPropagation();bindings=readBindings({...bindings,[key]:e.code});try{localStorage.setItem('royale-combat-bindings',JSON.stringify(bindings));}catch{}location.reload();};};label.append(input);el('bindings').append(label);}
const scene=new T.Scene();scene.background=new T.Color('#afc2ca');scene.fog=new T.Fog('#afc2ca',280,1200);
const camera=new T.PerspectiveCamera(62,1,.12,4200);camera.position.set(65,85,100);camera.lookAt(0,0,0);
const renderer=new T.WebGLRenderer({canvas,antialias:startupAntialias()});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
scene.add(new RouteSky());const sky=new T.HemisphereLight('#e9f6ff','#8b8d72',1.15);scene.add(sky);const sun=new T.DirectionalLight('#ffebc1',2);sun.position.set(90,170,30);scene.add(sun);
const graphics=createGraphicsQuality(renderer,scene,canvas);
const fill=new T.DirectionalLight('#c1d7ed',.55);fill.position.set(-30,20,-25);scene.add(fill);
const quality=el<HTMLSelectElement>('quality');try{quality.value=localStorage.getItem('swoop-graphics-quality')??'auto';}catch{}
quality.onchange=()=>{try{localStorage.setItem('swoop-graphics-quality',quality.value);}catch{}location.reload();};

const fieldRing=new FieldBoundary('#63efd9',.9);scene.add(fieldRing);
const nextRing=new FieldBoundary('#efc568',.75);scene.add(nextRing);
const actors=new Map<string,{view:Hero;equipment:WeaponView;weapon:T.Group;shield:T.Mesh;rig:CombatRig;wheelId:string}>(),assetMap=new Map<string,GLTF>(),shots:T.Mesh[]=[],items=new Map<string,EquipmentView>();
let equipmentLibrary:EquipmentLibrary,equipmentTime=0,equipmentRound='',equipmentShots=0,previousShotTick=-999;
const seenShots=new Set<string>(),reducedEquipmentMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scenery:Awaited<ReturnType<typeof buildDetroitArenaScene>>;
let terrain:DowntownArena,session:RoyaleSession,loaded=false,acc=0,last=performance.now(),hudAt=0,paused=false,layoutEditing=false,aimYaw=0,aimPitch=0,slot=0;
const keys=new Set<string>(),held=new Set<string>(),tap=new Set<string>();let throttle=0,steer=0,aimPointer:number|undefined,aimX=0,aimY=0,stickPointer:number|undefined;
const message=(s:string)=>el('message').textContent=s;
function release(){touchAds=false;aimGesture.reset();lookYaw=lookPitch=0;keys.clear();held.clear();tap.clear();steer=throttle=0;aimPointer=stickPointer=undefined;session?.release();}
function showMenu(){release();paused=true;if(dialog.open)dialog.close();dialog.showModal();el('resume').hidden=!session?.state;el('quit').hidden=!session?.state;}
function resume(){paused=false;dialog.close();canvas.focus();}
el('menu').onclick=showMenu;el('resume').onclick=resume;dialog.addEventListener('cancel',e=>{e.preventDefault();if(session?.state)resume();});
async function run(work:()=>void|Promise<void>){try{message('');await work();}catch(e){message((e as Error).message);}}
async function prepare(){const hdr=await new HDRLoader().loadAsync(new URL('../../../art/nvidia/detroit-skylight.hdr',import.meta.url).href),pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.6;hdr.dispose();pm.dispose();await loadEngineForPage(true);if(!engineReady())throw Error('Compiled arena could not load. Return to normal riding or retry.');message('Loading the original Detroit map…');terrain=new DowntownArena(await TagTerrain.create(await loadFixture(new URL('./love-tag/swoop-detroit.json',location.href).href)));session=new RoyaleSession(terrain);scenery=await buildDetroitArenaScene(scene,terrain);canvas.dataset.arena=terrain.arenaIdentity.arena;canvas.dataset.collision=terrain.arenaIdentity.collision;
 const loader=new GLTFLoader();await Promise.all(['DS_EUC_01',...RIDER_CHOICES.map(r=>r.id)].map(async id=>assetMap.set(id,await loader.loadAsync('/exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb'))));
 await Promise.all(WHEELS.filter(w=>w.id!=='euc').map(async w=>assetMap.set(w.asset,await loader.loadAsync('/exports/electric/'+w.asset+'.glb'))));
 equipmentLibrary=await EquipmentLibrary.load(loader,new URL('./exports/polish/royale-equipment/',location.href));canvas.dataset.equipment='Higgsfield-Blender-Unity:6-models:6-clips';
 loaded=true;el<HTMLButtonElement>('practice').disabled=false;el('practice').textContent='Ride with 5 AI opponents →';message('Original Detroit arena ready. Online rooms need six ready riders, or explicit AI fill.');
 if(query.get('room')){el<HTMLInputElement>('code').value=query.get('room')!;el<HTMLDetailsElement>('online').open=true;}
}
el<HTMLInputElement>('use-relay').onchange=()=>{el<HTMLInputElement>('endpoint').closest('label')!.hidden=el<HTMLInputElement>('use-relay').checked;};
el('practice').onclick=()=>run(()=>{session.offline(skin.value,wheel.value);slot=0;resume();});
let relayConfig:{endpoint:string;publishableKey:string}|undefined;
async function connectRoom(create:boolean){if(!loaded)throw Error('Wait for the arena to finish loading.');const code=el<HTMLInputElement>('code').value.trim(),name=el<HTMLInputElement>('name').value,fill=el<HTMLInputElement>('botfill').checked,spectate=el<HTMLInputElement>('spectate').checked;
if(relayConfig&&el<HTMLInputElement>('use-relay').checked)await session.supabase({...relayConfig,accessCode:el<HTMLInputElement>('test-code').value.trim()},create,code,name,skin.value,fill,spectate,wheel.value);
else await session.online(el<HTMLInputElement>('endpoint').value,create,code,name,skin.value,fill,spectate,wheel.value);}
el('create').onclick=()=>run(()=>connectRoom(true));
el('join').onclick=()=>run(()=>connectRoom(false));
el('ready').onclick=()=>session.readyUp();el('launch').onclick=()=>session.start();el('reconnect').onclick=()=>run(()=>{if(relayConfig&&el<HTMLInputElement>('use-relay').checked)session.relayConfig={...relayConfig,accessCode:el<HTMLInputElement>('test-code').value.trim()};return session.reconnect();});
el('rematch').onclick=()=>{session.readyUp();session.start();if(!session.room)resume();};
el('quit').onclick=()=>{session.leave();release();paused=false;el('resume').hidden=el('quit').hidden=el('rematch').hidden=true;message('You left the match.');};
el('invite').onclick=()=>run(async()=>{const u=new URL(location.href);u.searchParams.set('room',session.code);const field=el<HTMLInputElement>('invite-link');field.hidden=false;field.value=u.href;try{await navigator.clipboard.writeText(u.href);message('Invitation copied.');}catch{field.select();message('Select and copy this invitation.');}});
void fetch('./royale-config.json').then(r=>r.ok?r.json():{}).then((c:{supabaseTest?:{endpoint:string;publishableKey:string};serverUrl?:string})=>{relayConfig=c.supabaseTest;el('supabase-test').hidden=!relayConfig;el<HTMLInputElement>('endpoint').closest('label')!.hidden=!!relayConfig;el<HTMLInputElement>('endpoint').value=c.serverUrl||(['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8226':'');}).catch(()=>{});
function buttonAction(action:string){if(action==='aim'){touchAds=!touchAds;return;}if(action==='switch'){slot=1-slot;return;}tap.add(action);}
window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,select,textarea,button')||dialog.open)return;
 if([...Object.values(bindings),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'||e.code===bindings.loadout){showMenu();return;}
 if(!keys.has(e.code)){for(const [key,action] of [['hop','hop'],['utility','utility'],['repair','repair'],['recover','recover'],['reload','reload'],['pickup','swap'],['cycleMode','cycleMode']] as const)if(e.code===bindings[key])tap.add(action);if(e.code===bindings.camera)firstPerson=!firstPerson;}
 keys.add(e.code);if(e.code==='Digit1')slot=0;if(e.code==='Digit2')slot=1;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);window.addEventListener('gamepaddisconnected',release);
document.addEventListener('visibilitychange',()=>{release();last=performance.now();acc=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(dialog.open)return;e.preventDefault();slot=1-slot;},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(dialog.open)return;canvas.focus();canvas.setPointerCapture(e.pointerId);aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;if(e.pointerType==='mouse'){if(e.button===0)held.add('fire');if(e.button===2)aimGesture.down(performance.now());}});
canvas.addEventListener('pointermove',e=>{if(dialog.open||e.pointerType!=='mouse'&&aimPointer!==e.pointerId)return;
 const dx=e.pointerType==='mouse'?e.movementX:e.clientX-aimX,dy=e.pointerType==='mouse'?e.movementY:e.clientY-aimY;
 if(keys.has(bindings.freeLook)){lookYaw=T.MathUtils.clamp(lookYaw+dx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-dy*.003,-.8,.8);}
 else{aimYaw=T.MathUtils.clamp(aimYaw+dx*.004,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch-dy*.003,-.65,.65);}
 aimX=e.clientX;aimY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{if(e.button===2)aimGesture.up(performance.now());if(e.button===0)held.delete('fire');aimPointer=undefined;});
canvas.addEventListener('pointercancel',release);
canvas.addEventListener('lostpointercapture',()=>{held.delete('fire');aimPointer=undefined;});
const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
const layoutKey=()=> 'static-royale-touch-'+orientation();
function saveLayout(){const result:Record<string,{x:number;y:number}>={};for(const node of el('touch').children){const h=node as HTMLElement;if(h.style.left){const r=h.getBoundingClientRect();result[h.id||h.dataset.action!]={x:r.left/innerWidth,y:r.top/innerHeight};}}try{localStorage.setItem(layoutKey(),JSON.stringify(result));}catch{}}
function loadLayout(){let data:any={};try{data=JSON.parse(localStorage.getItem(layoutKey())??'{}');}catch{}for(const n of el('touch').children){const h=n as HTMLElement,p=data[h.id||h.dataset.action!];h.style.left=h.style.top=h.style.right=h.style.bottom='';if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){h.style.left=Math.min(innerWidth-h.offsetWidth,Math.max(0,p.x*innerWidth))+'px';h.style.top=Math.min(innerHeight-h.offsetHeight,Math.max(0,p.y*innerHeight))+'px';h.style.right=h.style.bottom='auto';}}}
el('layout').onclick=()=>{layoutEditing=!layoutEditing;el('touch').classList.toggle('editing',layoutEditing);el('touch').hidden=false;dialog.close();el('hint').textContent='Drag controls to move them. Open Menu to finish.';release();};
el('reset-layout').onclick=()=>{try{localStorage.removeItem(layoutKey());}catch{}loadLayout();};
el<HTMLInputElement>('button-size').oninput=e=>{el('touch').style.setProperty('--touch-size',(e.target as HTMLInputElement).value+'px');try{localStorage.setItem('royale-touch-size',(e.target as HTMLInputElement).value);}catch{}};
try{const size=Number(localStorage.getItem('royale-touch-size'));if(size>=48&&size<=86){el<HTMLInputElement>('button-size').value=String(size);el('touch').style.setProperty('--touch-size',size+'px');}}catch{}
for(const node of Array.from(el('touch').children)){
 const h=node as HTMLElement;let pointer:number|undefined,dx=0,dy=0;const act=()=>h.dataset.action;
 h.addEventListener('pointerdown',e=>{if(pointer!==undefined)return;e.preventDefault();pointer=e.pointerId;h.setPointerCapture(pointer);const r=h.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;
  if(layoutEditing)return;if(h.id==='move-pad'){if(stickPointer!==undefined)return;stickPointer=pointer;steer=(e.clientX-(r.left+r.width/2))/(r.width/2);throttle=-(e.clientY-(r.top+r.height/2))/(r.height/2);}
  else if(h.id==='aim-pad'){aimPointer=pointer;aimX=e.clientX;aimY=e.clientY;}else {held.add(act()!);buttonAction(act()!);}h.classList.add('active');
 });
 h.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;
  if(layoutEditing){h.style.left=T.MathUtils.clamp(e.clientX-dx,0,innerWidth-h.offsetWidth)+'px';h.style.top=T.MathUtils.clamp(e.clientY-dy,0,innerHeight-h.offsetHeight)+'px';h.style.right=h.style.bottom='auto';return;}
  if(h.id==='move-pad'&&pointer===stickPointer){const r=h.getBoundingClientRect();steer=T.MathUtils.clamp((e.clientX-r.left-r.width/2)/(r.width/2),-1,1);throttle=T.MathUtils.clamp(-(e.clientY-r.top-r.height/2)/(r.height/2),-1,1);}
  else if(h.id==='aim-pad'&&pointer===aimPointer){aimYaw=T.MathUtils.clamp(aimYaw+(e.clientX-aimX)*.008,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch-(e.clientY-aimY)*.006,-.65,.65);aimX=e.clientX;aimY=e.clientY;}
 });
 const up=()=>{if(h.id==='move-pad'&&pointer===stickPointer){stickPointer=undefined;steer=throttle=0;}if(pointer===aimPointer)aimPointer=undefined;held.delete(act()!);pointer=undefined;h.classList.remove('active');if(layoutEditing)saveLayout();};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])h.addEventListener(type,up);
}
function aimMode(){return touchAds||navigator.getGamepads?.()[0]?.buttons[6]?.pressed?2:aimGesture.get(performance.now());}
function command():Command{const c=neutral(session.state?.round??'');const pad=navigator.getGamepads?.()[0];const axis=(n:number)=>deadZone(pad?.axes[n]??0);
 c.throttle=T.MathUtils.clamp(throttle+Number(keys.has(bindings.forward)||keys.has('ArrowUp'))-Number(keys.has(bindings.brake)||keys.has('ArrowDown'))-axis(1),-1,1);
 c.steer=T.MathUtils.clamp(steer+Number(keys.has(bindings.right)||keys.has('ArrowRight'))-Number(keys.has(bindings.left)||keys.has('ArrowLeft'))+axis(0),-1,1);
 aimYaw=T.MathUtils.clamp(aimYaw+axis(2)*.024,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch-axis(3)*.018,-.65,.65);c.aimYaw=aimYaw;c.aimPitch=aimPitch;
 c.fire=held.has('fire')||!!pad?.buttons[7]?.pressed;c.aimMode=aimMode();
 c.reload=tap.has('reload')||!!pad?.buttons[2]?.pressed;c.cycleMode=tap.has('cycleMode');c.lean=Number(keys.has(bindings.leanRight))-Number(keys.has(bindings.leanLeft));c.crouch=keys.has(bindings.crouch);
 c.hop=tap.has('hop')||!!pad?.buttons[0]?.pressed;c.hopHeld=held.has('hop')||keys.has(bindings.hop)||!!pad?.buttons[0]?.pressed;c.burst=held.has('burst')||keys.has(bindings.burst)||!!pad?.buttons[4]?.pressed;
 c.utility=tap.has('utility')||!!pad?.buttons[5]?.pressed;c.repair=tap.has('repair')||!!pad?.buttons[3]?.pressed;c.recover=tap.has('recover');c.swap=tap.has('swap');c.slot=slot;tap.clear();return c;
}
function view(id:string,choice:string,wheelId:string){let a=actors.get(id);if(a&&a.view.riderId===riderChoice(choice)&&a.wheelId===wheelId)return a;if(a){a.view.dispose();a.equipment.dispose();a.shield.removeFromParent();a.shield.geometry.dispose();(a.shield.material as T.Material).dispose();}
 const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheelId).asset)!);const hero=new Hero(models,terrain,riderChoice(choice)),equipment=new WeaponView(equipmentLibrary),weapon=equipment.root;scene.add(hero.root,weapon);
 const shield=new T.Mesh(new T.SphereGeometry(1.1,12,8,0,Math.PI),new T.MeshBasicMaterial({color:'#5cdcdf',wireframe:true,transparent:true,opacity:.3}));scene.add(shield);a={view:hero,equipment,weapon,shield,rig:new CombatRig(hero,equipment),wheelId};actors.set(id,a);return a;
}
const shotGeometry=new T.SphereGeometry(.15,7,5),shotMaterial=new T.MeshBasicMaterial({color:'#9bffde'});
function draw(now:number){
 const delta=equipmentTime?Math.min(.1,(now-equipmentTime)/1000):0;equipmentTime=now;
 const motionDelta=paused&&!session?.room?0:delta,reducedMotion=reducedEquipmentMotion.matches||document.documentElement.dataset.reducedMotion==='true';
 const s=session?.state;if(!s){for(const a of actors.values()){a.view.root.visible=a.weapon.visible=a.shield.visible=false;}for(const m of shots)m.visible=false;for(const m of items.values())m.root.visible=false;el('hud').hidden=el('reticle').hidden=true;return;}const rendered=new Set<string>();
 if(equipmentRound!==s.round){equipmentRound=s.round;seenShots.clear();previousShotTick=-999;for(const item of items.values())item.dispose();items.clear();}
 const firing=new Set<string>();
 // Only accepted server/offline-authority shots trigger recoil. No click-predicted damage or fire.
 if(s.self&&s.self.shotAt!==previousShotTick){if(s.self.shotAt>=0&&s.tick-s.self.shotAt<12)firing.add(s.self.id);previousShotTick=s.self.shotAt;}
 for(const projectile of s.projectiles){const key=projectile.owner+':'+projectile.shot;if(!seenShots.has(key)){seenShots.add(key);if(projectile.owner!==s.self?.id)firing.add(projectile.owner);}}
 for(const actor of s.actors){const a=view(actor.id,actor.skin,actor.wheelId??'euc');a.view.root.visible=actor.alive;a.weapon.visible=actor.alive;a.shield.visible=actor.alive&&actor.shieldActive;rendered.add(actor.id);let pose={...actor.pose};
  if(actor.id===session.me&&session.room&&session.prediction)pose={...session.prediction.controller.poseValue};
  else if(session.room){const old=session.previous?.actors.find(x=>x.id===actor.id)?.pose,t=T.MathUtils.clamp((now-session.received)/50,0,1);if(old){pose.x=T.MathUtils.lerp(old.x,pose.x,t);pose.y=T.MathUtils.lerp(old.y,pose.y,t);pose.z=T.MathUtils.lerp(old.z,pose.z,t);pose.headingY=old.headingY+Math.atan2(Math.sin(pose.headingY-old.headingY),Math.cos(pose.headingY-old.headingY))*t;}}
  pose.stopFoot=0;a.view.apply({...pose,seated:0});const yaw=actor.id===session.me?aimYaw:actor.aimYaw,pitch=actor.id===session.me?aimPitch:actor.aimPitch;
  a.equipment.select(actor.weapon);if(firing.has(actor.id)&&a.equipment.fire(reducedMotion))equipmentShots++;a.equipment.update(motionDelta,reducedMotion);a.weapon.visible=actor.alive&&pose.crashBlend<.05;
  if(a.weapon.visible)a.rig.apply({...pose,seated:0},yaw,pitch,actor.combat,s.tick);
  if(actor.id===session.me)canvas.dataset.rig=JSON.stringify({rider:actor.skin,wheel:actor.wheelId,rightError:a.rig.errorR,leftError:a.rig.errorL,supportLocked:a.rig.supportLocked});
  a.shield.position.set(pose.x,pose.y+1,pose.z);a.shield.rotation.y=pose.headingY-Math.PI/2;
 }
 for(const [id,a]of actors)if(!rendered.has(id)){a.view.root.visible=false;a.weapon.visible=false;a.shield.visible=false;}
 for(let i=0;i<s.projectiles.length;i++){const p=s.projectiles[i];if(!shots[i]){shots[i]=new T.Mesh(shotGeometry,shotMaterial);scene.add(shots[i]);}shots[i].visible=true;shots[i].position.set(p.p.x,p.p.y,p.p.z);}
 for(let i=s.projectiles.length;i<shots.length;i++)shots[i].visible=false;
 const presentLoot=new Set(s.loot.map(item=>item.id));
 for(const loot of s.loot){let item=items.get(loot.id);if(!item){item=equipmentLibrary.create(loot.kind);items.set(loot.id,item);scene.add(item.root);}item.root.visible=true;item.root.position.set(loot.p.x,loot.p.y+.65,loot.p.z);item.root.scale.setScalar(1.7);item.update(motionDelta,reducedMotion);}
 for(const [id,item]of items)if(!presentLoot.has(id))item.root.visible=false;
 canvas.dataset.equipmentShots=String(equipmentShots);canvas.dataset.equipmentWeapon=s.actors.find(a=>a.id===session.me)?.weapon??'';
 fieldRing.update(s.field.x,s.field.z,s.field.radius,(x,z)=>terrain.ground(x,z).height);
 nextRing.update(s.field.x,s.field.z,s.field.nextRadius,(x,z)=>terrain.ground(x,z).height);
 canvas.dataset.field=JSON.stringify(s.field);
 const self=s.actors.find(a=>a.id===session.me);if(self){const p=session.room&&session.prediction?session.prediction.controller.poseValue:self.pose,mode=aimMode(),ads=mode===2;
 if(!keys.has(bindings.freeLook)){lookYaw*=Math.exp(-delta*10);lookPitch*=Math.exp(-delta*10);}
 const heading=p.headingY+aimYaw+lookYaw+self.combat.kickYaw,pitch=aimPitch+lookPitch+self.combat.kickPitch;
 const scale=self.skin.startsWith('DS_Mascot_')?.48:1,socket=weaponSocket(p,self.skin,aimYaw,aimPitch,self.combat.aimBlend,self.combat.lean);
 const at=new T.Vector3(socket.grip.x,socket.grip.y+.10*scale,socket.grip.z),forward=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const desired=ads||firstPerson?at.clone().addScaledVector(forward,-.06*scale):at.clone().addScaledVector(forward,mode===1?-2.4:-5.5).add(new T.Vector3(Math.cos(heading)*.4,.65,-Math.sin(heading)*.4));
 const ray=desired.clone().sub(at),length=ray.length(),hit=terrain.raycast(at,ray.normalize(),length);if(hit!==null)desired.copy(at).addScaledVector(ray,Math.max(.03,hit-.25));desired.y=Math.max(desired.y,terrain.ground(desired.x,desired.z,p.y).height+.25);
 scenery.update(p,now/1000);camera.position.copy(desired);camera.lookAt(desired.clone().addScaledVector(forward,100));const fov=ads?43:62;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
 const mine=actors.get(self.id);if(mine)mine.view.rider.visible=!(ads||firstPerson); // view-only head/body occlusion, authoritative rig continues evaluating
 }
 if(now-hudAt>150){hudAt=now;const me=s.self;el('hud').hidden=false;el('phase').textContent=s.phase==='deployment'?'DEPLOYING · '+Math.ceil((PROTECTION-s.tick)/60)+'s':s.remaining+' RIDERS REMAIN';
  el('vitals').textContent=me?'Integrity '+Math.ceil(me.integrity)+' / Shield '+Math.ceil(me.shield)+' / Flow '+Math.round(me.energy):'Spectator · private live positions';
  const w=me?.loadout[me.slot];el('weapon').textContent=w?WEAPONS[w].name+' · '+me!.combat.magazine[w]+' / '+(me!.ammo[w]-me!.combat.magazine[w])+' · '+FIRE_MODES[me!.combat.fireMode]+(me!.combat.reloadStart>=0?' · Reloading…':''):'';
  el('speed').textContent=self?Math.round(Math.abs(self.pose.speed)*3.6)+' / '+Math.round(wheelProfile(self.wheelId).topKph)+' km/h · '+wheelProfile(self.wheelId).name+' · game estimate':'';
  el('field').textContent='Field '+Math.round(s.field.radius)+'m → '+Math.round(s.field.nextRadius)+'m · '+Math.ceil(s.field.remaining)+'s';
  el('reticle').hidden=!me?.alive||dialog.open;el('touch').hidden=(!matchMedia('(pointer:coarse)').matches||dialog.open||!me?.alive)&&!layoutEditing;
  el('hint').textContent=layoutEditing?'Move controls, then open Menu to finish.':Math.abs(aimYaw)>1.20?'Turn your wheel to aim farther.':me&&!me.alive?'Eliminated · one life per round':s.phase==='deployment'?'Spawn protection · weapons unlock when the countdown ends':me&&Math.hypot((self?.pose.x??0)-s.field.x,(self?.pose.z??0)-s.field.z)>s.field.radius?'Outside the Static Field — ride toward the gold circle!':'WASD ride · mouse aim · click fire · right click ADS · R reload · K recover';
  el('room').hidden=!session.room;el('roomcode').textContent='Room '+session.code+(session.botFill?' · AI fill on':' · six human riders');
  el<HTMLButtonElement>('launch').disabled=session.host!==session.me;el('roster').replaceChildren(...s.roster.map(a=>{const li=document.createElement('li');li.textContent=a.name+(a.bot?' · AI':session.ready.includes(a.id)?' · Ready':' · Loading / not ready')+(!a.connected?' · Disconnected':'');return li;}));
  if(session.message)message(session.message);
  if(s.phase==='lobby'&&!dialog.open){showMenu();}if(s.phase==='deployment'&&dialog.open&&session.room){resume();}
  if(s.phase==='results'){if(!dialog.open)showMenu();el('rematch').hidden=false;el('results').textContent=(s.winner===session.me?'YOU WIN':s.winner?(s.roster.find(a=>a.id===s.winner)?.name??'Rider')+' WINS':'DRAW')+' · '+s.reason;const stats=s.results.find(r=>r.id===session.me);if(stats)el('results').textContent+=' — '+stats.kills+' eliminations · '+stats.damage+' damage · '+stats.distance+' m ridden';}
 }
}
el('menu').addEventListener('click',()=>{layoutEditing=false;el('touch').classList.remove('editing');});
window.addEventListener('resize',()=>{release();graphics.resize();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();loadLayout();});
camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
const schedule=new FrameSchedule();let frames=0,profileAt=performance.now(),samples:number[]=[],previousFrame=performance.now();
function loop(now:number){requestAnimationFrame(loop);const delta=Math.min(.15,(now-last)/1000);last=now;if(document.hidden)return;
 if(loaded&&session.state&&(!paused||session.room)&&!layoutEditing){acc+=delta;let n=0;while(acc>=DT&&n++<9){session.step(dialog.open?neutral(session.state.round):command());acc-=DT;}}else acc=0;
 if(!schedule.shouldRender(now,false,false,graphics.current.fps))return;draw(now);renderer.render(scene,camera);samples.push(now-previousFrame);previousFrame=now;frames++;
 if(now-profileAt>2000){samples.sort((a,b)=>a-b);if(session?.state?.engine){canvas.dataset.engineModule=session.state.engine.module;canvas.dataset.engineFrames=String(session.state.engineInputFrames);canvas.dataset.engineTick=String(session.state.tick);}canvas.dataset.profile=JSON.stringify({fps:frames*1000/(now-profileAt),p95:samples[Math.floor(samples.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});frames=0;profileAt=now;samples=[];}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();paused=true;showMenu();message('Graphics paused. Reload the page to restore the arena.');});
requestAnimationFrame(loop);void run(prepare);
window.addEventListener('pagehide',()=>{session?.leave();for(const a of actors.values()){a.view.dispose();a.equipment.dispose();}for(const item of items.values())item.dispose();equipmentLibrary?.dispose();terrain?.terrain.dispose();renderer.dispose();});

