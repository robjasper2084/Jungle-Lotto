import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {solveLimb} from '../../runtime/ride-core/src/limbIK.ts';
import {BoatController} from './boatController.ts';
import {BoatCockpit} from './boatCockpit.ts';
import {BoatSpray} from './boatSpray.ts';
import {BOAT_PROFILES,type BoatKind} from './boatProfiles.ts';
import {speedMph} from './speedUnits.ts';
import type {ParkTerrain} from './terrain.ts';
import type {FlightObstacle} from './hoverController.ts';
type Hooks={allowed:()=>boolean;enter:()=>void;exit:()=>void;night:()=>number};
function prepareBoat(group:T.Object3D,hero:T.Object3D){
 const required=(name:string)=>{const node=group.getObjectByName(name);if(!node)throw Error('Boat asset is missing '+name);return node;};
 const eye=required('Driver_Eye'),hip=required('Driver_Hip'),wheel=required('Helm_Wheel'),panel=required('Cockpit_Display');if(!(panel instanceof T.Mesh))throw Error('Boat instrument panel must be a mesh');
 group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.transparent){m.depthWrite=false;m.side=T.DoubleSide;}}});
 const rider=clone(hero);rider.position.set(0,0,0);rider.rotation.set(0,0,0);rider.scale.setScalar(.82);group.add(rider);group.updateMatrixWorld(true);
 const hips=rider.getObjectByName('Hips');
 if(hips){
  const target=hip.getWorldPosition(new T.Vector3());hips.position.copy(hips.parent!.worldToLocal(target.clone()));group.updateMatrixWorld(true);
  for(const [side,sign]of [['Left',1],['Right',-1]] as const){
   for(const arm of [false,true]){
    const upper=rider.getObjectByName(side+(arm?'Arm':'UpLeg')),knee=rider.getObjectByName(side+(arm?'ForeArm':'Leg')),foot=rider.getObjectByName(side+(arm?'Hand':'Foot'));
    if(!upper||!knee||!foot)continue;
    const end=arm?wheel.getWorldPosition(new T.Vector3()).add(new T.Vector3(sign*.13,0,-.04)):target.clone().add(new T.Vector3(sign*.14,-.39,.49));
    solveLimb({upper,knee,foot},end,new T.Vector3(arm?sign:0,arm?-.4:1,arm?-.2:.2),undefined,.98);
   }
  }
 }
 group.updateMatrixWorld(true);group.visible=false;
 const lamps=['Nav_Port','Nav_Starboard'].map(required);return{group,rider,wheel,eye,lamps,cockpit:new BoatCockpit(panel)};
}
export class BoatRide{
 riding=false;private kind:BoatKind='hydroplane';private sims:Record<BoatKind,BoatController>;private boats:Record<BoatKind,ReturnType<typeof prepareBoat>>;
 private keys=new Set<string>();private hud=document.createElement('section');private info=document.createElement('output');private telemetry=document.createElement('div');private nextHud=0;private reduced=false;private spray:BoatSpray;
 get sim(){return this.sims[this.kind];}private get vessel(){return this.boats[this.kind];}
 constructor(scene:T.Scene,terrain:ParkTerrain,hero:T.Object3D,private hooks:Hooks,assets:Record<BoatKind,T.Object3D>,traffic?:FlightObstacle){
  this.sims={offshore:new BoatController(terrain,traffic,'offshore'),hydroplane:new BoatController(terrain,traffic,'hydroplane')};this.boats={offshore:prepareBoat(assets.offshore,hero),hydroplane:prepareBoat(assets.hydroplane,hero)};
  for(const value of Object.values(this.boats))scene.add(value.group);
  this.spray=new BoatSpray(scene);
  this.hud.id='boat-hud';this.hud.hidden=true;this.hud.innerHTML='<strong id="boat-name"></strong><p>W / S throttle · A / D steer · Space brake assist · V cockpit</p><div class="boat-buttons"><button data-boat="KeyA" aria-label="Steer boat left">←</button><button data-boat="KeyW">Throttle</button><button data-boat="KeyS">Reverse assist</button><button data-boat="KeyD" aria-label="Steer boat right">→</button><button data-boat="Space">Brake</button><button id="boat-exit">Return to shore · F</button></div>';this.telemetry.id='boat-telemetry';this.telemetry.setAttribute('aria-label','Live boat telemetry');this.hud.prepend(this.info,this.telemetry);document.body.append(this.hud);
  this.hud.querySelectorAll<HTMLButtonElement>('[data-boat]').forEach(b=>{b.onpointerdown=e=>{if(!this.hooks.allowed())return;e.preventDefault();b.setPointerCapture(e.pointerId);this.keys.add(b.dataset.boat!);};const up=()=>this.keys.delete(b.dataset.boat!);b.onpointerup=b.onpointercancel=b.onlostpointercapture=up;b.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(this.hooks.allowed())this.keys.add(b.dataset.boat!);}};b.onkeyup=e=>{e.stopPropagation();up();};b.onblur=up;});this.hud.querySelector<HTMLButtonElement>('#boat-exit')!.onclick=()=>this.exit();
  for(const kind of ['hydroplane','offshore'] as const){const button=document.createElement('button');button.id=kind==='hydroplane'?'boat-enter':'speedboat-enter';button.textContent=BOAT_PROFILES[kind].name+' · bridge channel';button.onclick=()=>{document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());this.board(kind);};document.querySelector('header nav')!.append(button);}
 }
 board(kind:BoatKind=this.kind){if(!this.hooks.allowed())return;this.leave();this.kind=kind;this.hooks.enter();const b=this.sim.terrain.map.bridge,dx=(b.b[0]-b.a[0])/b.length,dz=(b.b[1]-b.a[1])/b.length,t=9.5/19;this.sim.reset(b.a[0]+(b.b[0]-b.a[0])*t-dz*48,b.a[1]+(b.b[1]-b.a[1])*t+dx*48,Math.atan2(dz,-dx));this.riding=true;this.hud.hidden=false;this.vessel.group.visible=true;this.hud.querySelector('#boat-name')!.textContent=BOAT_PROFILES[kind].name.toUpperCase();document.body.classList.add('on-boat');document.body.dataset.boatKind=kind;this.nextHud=0;this.vessel.cockpit.update(this.sim,0,true);document.getElementById('game')?.focus();}
 key(e:KeyboardEvent){if(!this.riding||!['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyF','KeyR'].includes(e.code))return false;e.preventDefault();this.keys.add(e.code);if(e.code==='KeyF'&&!e.repeat)this.exit();if(e.code==='KeyR'&&!e.repeat)this.board();return true;}
 keyUp(code:string){this.keys.delete(code);}
 clear(){this.keys.clear();this.sim.stop();}
 leave(){this.clear();this.spray.clear();this.riding=false;this.hud.hidden=true;for(const boat of Object.values(this.boats))boat.group.visible=false;document.body.classList.remove('on-boat');delete document.body.dataset.boatKind;}
 private exit(){if(!this.hooks.allowed())return;this.leave();this.hooks.exit();}
 update(dt:number,running:boolean,time:number,reduced=false){
  if(!this.riding)return;this.reduced=reduced;const has=(a:string,b:string)=>this.keys.has(a)||this.keys.has(b);
  if(running)this.sim.advance(dt,Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown')),Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),this.keys.has('Space'));
  const p=this.sim.pose,t=this.sim.telemetry,v=this.vessel;v.group.position.set(p.x,p.y+.05,p.z);v.group.rotation.set(p.pitch,p.heading,p.roll,'YXZ');v.wheel.rotation.z=-t.steer*.65;
  for(const lamp of v.lamps)lamp.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial){o.material.emissive.copy(o.material.color);o.material.emissiveIntensity=this.hooks.night()>.2?1.8:.15;}});
  v.cockpit.update(this.sim,time);
  this.spray.update(dt,this.sim,running);
  if(time>=this.nextHud){this.nextHud=time+.1;this.info.textContent=speedMph(p.speed)+' MPH · '+(this.sim.collision?'Hull contact — steer clear':t.planing>.8?'On plane':'Bridge channel');this.telemetry.textContent=Math.abs(p.speed).toFixed(1)+' m/s · '+(this.kind==='hydroplane'?'N2 '+t.powerPercent.toFixed(0)+'%':Math.round(t.rpm)+' RPM')+' · Power '+t.powerPercent.toFixed(0)+'% · '+t.gForce.toFixed(2)+' G';this.hud.dataset.speed=p.speed.toFixed(3);this.hud.dataset.heading=p.heading.toFixed(4);this.hud.dataset.power=t.powerPercent.toFixed(1);this.hud.dataset.collision=String(this.sim.collision);}
 }
 camera(camera:T.PerspectiveCamera,first:boolean,yaw:number,pitch:number,dt:number,snap:boolean){
  const p=this.sim.pose,v=this.vessel,lead=this.reduced?0:this.sim.telemetry.yawRate*.20,a=p.heading+yaw+lead,look=new T.Vector3(p.x,p.y+.9,p.z),at=look.clone();v.rider.visible=!first;this.hud.dataset.view=first?'cockpit':'chase';v.group.updateMatrixWorld(true);
  camera.up.set(0,1,0);
  if(first){v.eye.getWorldPosition(at);look.copy(at).add(new T.Vector3(Math.sin(a)*10,-Math.tan(pitch+(this.reduced?0:p.pitch))*10,Math.cos(a)*10));}
  else{const follow=this.kind==='hydroplane'?12:10;at.add(new T.Vector3(-Math.sin(a)*follow,3.6+pitch*3,-Math.cos(a)*follow));const d=at.clone().sub(look),l=d.length();d.normalize();const h=this.sim.terrain.raycastCamera(look,d,l,.2);if(h!==null)at.copy(look).addScaledVector(d,Math.max(.3,h-.2));}
  camera.position.lerp(at,first||snap?1:1-Math.exp(-dt*8));camera.lookAt(look);const fov=first?68:60;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
 }
 get wake(){const p=this.sim.pose,t=this.sim.telemetry;return this.riding?{x:p.x,z:p.z,dx:Math.sin(p.heading),dz:Math.cos(p.heading),length:this.kind==='hydroplane'?36+55*t.planing:24+15*t.planing,width:this.kind==='hydroplane'?4.5:3,power:Math.min(.95,Math.abs(p.speed)/18)}:null;}
}
