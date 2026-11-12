import {HoverIdleMotion,idleHoverInputActive} from './hoverIdleMotion.ts';
import type {CockpitRadio} from './cockpitRadio.ts';
import {waitForRideModel} from './rideModelWait.ts';
import {installHoverPresentation} from './visualPolishHud.ts';
import {hoverHelpText} from './visualPolishPolicy.ts';
import {attachMichiganPlate} from './michiganPlate.ts';
import {speedMph} from './speedUnits.ts';
import {HoverFirstPerson} from './hoverFirstPerson.ts';


import {applyRealisticMaterials} from './realisticMaterials.ts';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HoverControls} from './hoverControls.ts';
import {DRIVE_GEARS,gearLabel,type DriveGear} from './hoverTransmission.ts';
import {CockpitLcd} from './cockpitLcd.ts';
import {HoverAudio} from './hoverAudio.ts';
import {HoverController,type FlightObstacle,type FlightMode} from './hoverController.ts';
import {JarvsAvionics} from './jarvsAvionics.ts';
import {segment,type ParkTerrain} from './terrain.ts';
import './hover.css';
import {HoverLighting,LED_COLORS} from './hoverLighting.ts';
import {HoverRiderRig} from './hoverRiderMotion.ts';
type Pose={x:number;y:number;z:number;headingY:number};
type Hooks={pose:()=>Pose;blocked:()=>boolean;entered:()=>void;exited:(p:{x:number;y:number;z:number;heading:number})=>void;touch:()=>boolean;nightAmount?:()=>number;obstacle?:FlightObstacle;vehicleLocked?:()=>boolean;restartTrial?:()=>void;prepareScene?:(model:T.Object3D,signal?:AbortSignal)=>Promise<void>};
const keyCodes=['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyQ','Space','ShiftLeft','ShiftRight','KeyG','KeyF','KeyL','KeyH','KeyK','KeyR','KeyC','BracketLeft','BracketRight','KeyX','Minus','Equal'];
export class HoverRide {
 readonly sim:HoverController;
 riding=false;
 private fittedArms?:HoverFirstPerson;private radio?:CockpitRadio;private radioCanvas?:HTMLCanvasElement;
 setRadio(radio:CockpitRadio,canvas:HTMLCanvasElement){this.radio=radio;this.radioCanvas=canvas;this.cockpit?.connectRadio(radio,canvas);}
 private model:T.Group|undefined;private cockpit?:CockpitLcd;private controls?:HoverControls;private driveSelect!:HTMLSelectElement;
 private loading:Promise<void>|undefined;
 private mountGeneration=0;private mountAbort:AbortController|undefined;private savedDriveGear?:DriveGear;
 private savedFlightMode:FlightMode|undefined;
 private pressed=new Set<string>();
 private stick={x:0,y:0,id:-1,cx:0,cy:0};private flightSelect!:HTMLSelectElement;
 private rider:HoverRiderRig|undefined;
 private motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 private motionCheckbox=document.querySelector<HTMLInputElement>('#motion');
 private steerBlend=0;
 private idleHover=new HoverIdleMotion();private idleFirstPerson=true;
 private rotors:T.Object3D[]=[];
 private pods:{o:T.Object3D;q:T.Quaternion}[]=[];
 private gear:{o:T.Object3D;q:T.Quaternion}[]=[];
 private bars:T.Object3D|undefined;
 private barsRest=new T.Quaternion();
 private hero:T.Object3D|undefined;
 private cockpitHidden:T.Object3D[]=[];
 private fpvArms:T.Object3D|undefined;
 private lights:T.MeshStandardMaterial[]=[];
 private brakes:T.MeshStandardMaterial[]=[];
 private localRotation=new T.Quaternion();
 private localEuler=new T.Euler();private yAxis=new T.Vector3(0,1,0);private zAxis=new T.Vector3(0,0,1);
 private lightOn=true;private highBeam=false;private ledColor='#79dfff';private ledMode='solid';private lighting?:HoverLighting;private ledInput!:HTMLInputElement;private ledSelect!:HTMLSelectElement;
 private gearBlend=0;
 private messageUntil=0;
 private lastUI=0;
 private sound=new HoverAudio();
 private readonly jarvs:JarvsAvionics;
 private jarvsDisplay!:HTMLElement;
 private enterButton:HTMLButtonElement;
 private hud:HTMLElement;
 private notice:HTMLElement;
 private speed:HTMLElement;
 private altitude:HTMLElement;
 private mode:HTMLElement;
 private touchPad:HTMLElement;
 constructor(scene:T.Scene,readonly terrain:ParkTerrain,private hooks:Hooks){
  this.sim=new HoverController(terrain,terrain.map.spawn,hooks.obstacle);
  // Reuses existing world geometry and traffic raycasts, sampled at most 4Hz.
  // No AI model, extra camera, network call, or startup work is introduced.
  this.jarvs=new JarvsAvionics({
   floor:(x,z)=>this.sim.floor(x,z),
   obstacle:(origin,direction,distance)=>{
    const terrainHit=this.terrain.raycastFlight(origin,direction,distance,1.02);
    const trafficHit=this.hooks.obstacle?.(origin,direction,distance,1.02);
    if(terrainHit===null)return trafficHit??null;
    return trafficHit===null||trafficHit===undefined?terrainHit:Math.min(terrainHit,trafficHit);
   }
  });
  this.enterButton=document.createElement('button');this.enterButton.id='hover-enter';this.enterButton.textContent='Ride hoverbike · B';
  document.querySelector('header nav')!.prepend(this.enterButton);this.enterButton.onclick=()=>{if(this.riding)this.exit();else void this.mount(scene);};
  this.hud=document.createElement('section');this.hud.id='hover-hud';this.hud.hidden=true;this.hud.setAttribute('aria-label','Hoverbike controls');
  this.hud.innerHTML='<div class="hover-title"><span>SWOOP / 2084</span><strong>HOVERBIKE</strong></div><div class="hover-instruments"><div><b id="hover-speed">0</b><span>MPH</span></div><div><b id="hover-altitude">0.2</b><span>METRES AGL</span></div><output id="hover-mode">LANDED</output><output id="hover-drive" aria-label="Drive gear">AUTO</output><div class="hover-energy"><label for="hover-energy">FAN ENERGY</label><meter id="hover-energy" min="0" max="1" value="1"></meter><span id="hover-energy-text">100%</span></div></div><p id="hover-notice" role="status">Take off to ride.</p><div class="hover-actions"><button data-hold="ShiftLeft" id="hover-boost" aria-label="Hold for speed boost (Shift)" aria-pressed="false">BOOST · Shift</button><button data-hover="takeoff">Take off · G</button><button data-hover="lights" aria-pressed="true">Headlights · L</button><button data-hover="sound" aria-pressed="false">Sound off</button><button data-hover="reset">Recover · R</button><button data-hover="exit">Get off · F</button></div><div class="hover-cruise" role="group" aria-label="Cruise speed lock"><button data-hover="cruise" id="hover-cruise" aria-pressed="false" title="Lock current speed; brake to cancel">Lock speed · X</button><div id="hover-cruise-adjust" hidden><button data-hover="cruise-down" aria-label="Decrease cruise speed by 5 mph">−</button><output id="hover-cruise-target" aria-live="polite">Cruise off</output><button data-hover="cruise-up" aria-label="Increase cruise speed by 5 mph">+</button></div></div><details class="hover-lighting"><summary>Flight & lighting</summary><div><label>Flight mode<select id="hover-flight-mode"><option value="drone">Drone · altitude hold</option><option value="classic">Classic · momentum</option></select></label><label>Drive gear<select id="hover-drive-gear"><option value="auto">Automatic</option><option value="0">Neutral</option><option value="1">1 · Precision</option><option value="2">2 · Cruise</option><option value="3">3 · Sport</option></select></label><p class="hover-drive-help">Hold clutch C to shift with [ / ]. Neutral cuts drive; hover stays active.</p><button data-hold="KeyC" aria-label="Hold clutch">Clutch · C</button><label>LED color<input type="color" id="hover-led-color" value="#79dfff"></label><label>LED effect<select id="hover-led-mode"><option value="solid">Solid color</option><option value="cycle">Slow color cycle</option><option value="off">LEDs off</option></select></label><button data-hover="color">Next color · K</button><button data-hover="beam" aria-pressed="false">High beam · H</button></div></details><p class="hover-help">W / S speed · A / D steer · E / Q up / down · Space brake · X lock speed · − / = adjust · Shift boost · V camera · drag to look</p><div class="hover-touch" aria-label="Hoverbike touch controls"><div id="hover-flight-stick" aria-label="Flight joystick" role="group"><span>MOVE</span><i></i></div><div class="hover-steer"><button data-hold="ArrowLeft" aria-label="Turn left">←</button><button data-hold="ArrowRight" aria-label="Turn right">→</button></div><div class="hover-lift"><button data-hold="KeyE" aria-label="Ascend">↑ UP</button><button data-hold="KeyQ" aria-label="Descend">↓ DOWN</button></div><div class="hover-pedals"><button data-hold="Space">BRAKE</button><button data-hold="KeyS">REVERSE</button><button data-hold="KeyW" class="hover-throttle">THROTTLE</button></div></div>';
  document.body.append(this.hud);
  this.jarvsDisplay=document.createElement('aside');
  this.jarvsDisplay.id='jarvs-avionics';
  this.jarvsDisplay.setAttribute('aria-label','JARVS flight avionics');
  this.jarvsDisplay.innerHTML='<strong>JARVS</strong><output id="jarvs-readiness" aria-label="JARVS readiness">STANDBY</output><output id="jarvs-radar" aria-label="Forward hazard scan">RADAR STANDBY</output><span id="jarvs-advice">Standing by</span><small id="jarvs-context">SENSORS OFF</small>';
  this.hud.querySelector('.hover-instruments')!.after(this.jarvsDisplay);
  this.notice=this.hud.querySelector('#hover-notice')!;this.speed=this.hud.querySelector('#hover-speed')!;this.altitude=this.hud.querySelector('#hover-altitude')!;this.mode=this.hud.querySelector('#hover-mode')!;this.touchPad=this.hud.querySelector('.hover-touch')!;
    this.soundButton();const voiceLabel=document.createElement('label'),voiceToggle=document.createElement('input');voiceLabel.textContent='Spoken hazard warnings';voiceToggle.type='checkbox';voiceToggle.checked=this.sound.voiceEnabled;voiceToggle.onchange=()=>this.sound.setVoice(voiceToggle.checked);voiceLabel.append(voiceToggle);this.hud.querySelector('.hover-lighting>div')!.append(voiceLabel);
  const assistLabel=document.createElement('label'),assistToggle=document.createElement('input');
  assistLabel.textContent='JARVS clearance assist · optional';assistToggle.id='jarvs-assist';assistToggle.type='checkbox';
  assistToggle.checked=false;assistToggle.onchange=()=>{this.jarvs.assistEnabled=assistToggle.checked;};
  assistLabel.append(assistToggle);this.hud.querySelector('.hover-lighting>div')!.append(assistLabel);
installHoverPresentation(this.hud);
  this.flightSelect=this.hud.querySelector('#hover-flight-mode')!;let savedMode='classic';try{savedMode=localStorage.getItem('belle-flight-mode')||'classic';}catch{}this.sim.setMode(savedMode==='drone'?'drone':'classic');this.flightSelect.value=this.sim.mode;
  this.flightSelect.onchange=()=>{if(this.hooks.vehicleLocked?.()){this.flightSelect.value=this.sim.mode;return;}this.clear();this.sim.setMode(this.flightSelect.value==='classic'?'classic':'drone');try{localStorage.setItem('belle-flight-mode',this.sim.mode);}catch{}this.refresh();};
  this.driveSelect=this.hud.querySelector('#hover-drive-gear')!;this.driveSelect.onchange=()=>this.selectGear(this.driveSelect.value==='auto'?'auto':Number(this.driveSelect.value) as DriveGear);

  this.bindFlightStick();
  this.ledInput=this.hud.querySelector('#hover-led-color')!;this.ledSelect=this.hud.querySelector('#hover-led-mode')!;
  try{const prefs=JSON.parse(localStorage.getItem('belle-hover-lighting')||'{}');if(/^#[0-9a-f]{6}$/i.test(prefs.color))this.ledColor=prefs.color;if(['solid','cycle','off'].includes(prefs.mode))this.ledMode=prefs.mode;}catch{}this.ledInput.value=this.ledColor;this.ledSelect.value=this.ledMode;
  this.ledInput.oninput=()=>{this.ledColor=this.ledInput.value;this.saveLighting();};this.ledSelect.onchange=()=>{this.ledMode=this.ledSelect.value;this.saveLighting();};
  this.hud.querySelectorAll<HTMLButtonElement>('[data-hover]').forEach(b=>b.onclick=()=>{
   if(b.dataset.hover==='reset'&&this.hooks.vehicleLocked?.()){this.hooks.restartTrial?.();return;}
   if(this.hooks.blocked())return;
   switch(b.dataset.hover){case'cruise':this.toggleCruise();break;case'cruise-down':this.sim.adjustCruise(-5);this.refresh();break;case'cruise-up':this.sim.adjustCruise(5);this.refresh();break;case'takeoff':this.toggleFlight();break;case'lights':this.toggleLights();break;case'beam':this.toggleBeam();break;case'color':this.nextColor();break;case'sound':this.toggleSound();break;case'reset':this.recover();break;case'exit':this.exit();break;}
  });
  this.hud.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach(b=>{
   const key=b.dataset.hold!;
   b.onpointerdown=e=>{if(this.hooks.blocked()||e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);this.pressed.add(key);b.dataset.held='true';};
   const release=()=>{this.pressed.delete(key);delete b.dataset.held;};b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;
  });
  window.addEventListener('keydown',e=>{
   if(e.defaultPrevented)return;
   if(e.code==='KeyB'&&!e.repeat&&!this.hooks.blocked()&&!(e.target as HTMLElement).matches('input,select,textarea')){
    e.preventDefault();if(this.riding)this.exit();else void this.mount(scene);
   }
  });
 }
 private releaseStick(){this.stick.x=this.stick.y=0;this.stick.id=-1;const pad=this.hud.querySelector<HTMLElement>('#hover-flight-stick');if(pad){pad.classList.remove('is-active');pad.style.removeProperty('left');pad.style.removeProperty('top');pad.style.removeProperty('position');const knob=pad.querySelector<HTMLElement>('i');if(knob)knob.style.transform='translate(-50%,-50%)';}}
 private bindFlightStick(){
  const pad=this.hud.querySelector<HTMLElement>('#hover-flight-stick')!,knob=pad.querySelector<HTMLElement>('i')!,holder=document.createElement('div'),zone=document.createElement('div');holder.className='hover-stick-holder';zone.id='hover-move-zone';pad.replaceWith(holder);holder.append(zone);zone.append(pad);
  zone.onpointerdown=e=>{if(e.button!==0||this.hooks.blocked()||this.stick.id!==-1)return;e.preventDefault();const floating=document.body.dataset.joystickMode!=='fixed',r=pad.getBoundingClientRect(),z=zone.getBoundingClientRect();this.stick={x:0,y:0,id:e.pointerId,cx:floating?e.clientX:r.left+r.width/2,cy:floating?e.clientY:r.top+r.height/2};if(floating){pad.style.position='absolute';pad.style.left=(e.clientX-z.left-r.width/2)+'px';pad.style.top=(e.clientY-z.top-r.height/2)+'px';}pad.classList.add('is-active');zone.setPointerCapture(e.pointerId);move(e);};
  const move=(e:PointerEvent)=>{if(e.pointerId!==this.stick.id)return;if(this.hooks.blocked()){this.releaseStick();return;}e.preventDefault();const radius=pad.getBoundingClientRect().width*.37;let x=(e.clientX-this.stick.cx)/radius,y=(this.stick.cy-e.clientY)/radius;const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;this.stick.x=Math.abs(x)<.08?0:x;this.stick.y=Math.abs(y)<.08?0:y;knob.style.transform='translate(calc(-50% + '+x*radius+'px),calc(-50% - '+y*radius+'px))';};
  zone.onpointermove=move;const end=(e:PointerEvent)=>{if(e.pointerId!==this.stick.id)return;this.releaseStick();if(zone.hasPointerCapture(e.pointerId))zone.releasePointerCapture(e.pointerId);};zone.onpointerup=end;zone.onpointercancel=end;zone.onlostpointercapture=end;
 }
 get riderObject(){return this.hero;}
 get previewVehicle(){return this.model?.getObjectByName('HoverBikeRoot');}
 captureAudio(){return this.sound.capture();}
 private async load(scene:T.Scene){
  if(this.model)return;
  if(!this.loading)this.loading=(async()=>{
   const gltf=await new GLTFLoader().loadAsync('./belle/vehicles/hero-hoverbike.glb');
   this.model=gltf.scene;this.model.name='Playable hero and hoverbike';
   const seated=gltf.animations.find(a=>a.name.includes('Ride_Steer'));if(seated){const mixer=new T.AnimationMixer(this.model);mixer.clipAction(seated).play();mixer.setTime(seated.duration*.5);}
   this.model.traverse(o=>{
    if(o.name.startsWith('Rotor_'))this.rotors.push(o);
    if(/^Pod_(FL|FR|RL|RR)$/.test(o.name))this.pods.push({o,q:o.quaternion.clone()});
    if(/^LandingGear_[LR]$/.test(o.name))this.gear.push({o,q:o.quaternion.clone()});
    if(o.name==='HandlebarPivot'){this.bars=o;this.barsRest.copy(o.quaternion);}
    if(o.name==='HeroRoot')this.hero=o;
    if(o.name==='Hero_FPVArms'){this.fpvArms=o;o.visible=false;}
    if(o.name==='Hero_Head'||o.name==='Hero_Dreadlocks'||o.name==='Hero_Body'||o.name==='Hero_UpperArms'||o.name==='Hero_Arms')this.cockpitHidden.push(o);
    if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;
     for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat instanceof T.MeshStandardMaterial){
      if(mat.name==='Running_Light_Blue'&&!this.lights.includes(mat))this.lights.push(mat);
      if(mat.name==='Brake_Light_Red'&&!this.brakes.includes(mat))this.brakes.push(mat);
     }
    }
   });
   this.fittedArms=new HoverFirstPerson(this.model.getObjectByName('HoverBikeRoot')??this.model);this.rider=HoverRiderRig.create(this.model);this.controls=new HoverControls(this.model);
   applyRealisticMaterials(this.model);await attachMichiganPlate(this.model);this.cockpit=new CockpitLcd(this.model.getObjectByName('HoverBikeRoot')??this.model);if(this.radio&&this.radioCanvas)this.cockpit.connectRadio(this.radio,this.radioCanvas);this.lighting=new HoverLighting(this.model.getObjectByName('HoverBikeRoot')??this.model,this.lights);this.model.visible=false;scene.add(this.model);

  })().catch(e=>{this.loading=undefined;throw e;});
  await this.loading;
 }
 private spawnNear(p:Pose){
  const roads=this.terrain.map.roads.filter(r=>!r.foot&&r.width>=4);
  const choices=roads.flatMap(r=>r.points.slice(1).map((b,i)=>{
   const a=r.points[i],s=segment(p.x,p.z,a,b),x=a[0]+(b[0]-a[0])*s.t,z=a[1]+(b[1]-a[1])*s.t;
   return{x,z,heading:Math.atan2(b[0]-a[0],b[1]-a[1]),d:s.d};
  })).sort((a,b)=>a.d-b.d);
  const near=choices.find(p=>this.terrain.land(p.x,p.z)&&!this.terrain.obstructed(p.x,p.z,2));
  return near||this.terrain.map.spawn;
 }
 async prepare(scene:T.Scene,forRide=false,signal?:AbortSignal){
  if(signal?.aborted)throw new DOMException('Ride preparation cancelled','AbortError');
  await waitForRideModel(this.load(scene),20000,signal);
  if(signal?.aborted)throw new DOMException('Ride preparation cancelled','AbortError');
  if(forRide&&this.model)await this.hooks.prepareScene?.(this.model,signal);
 }
 async mount(scene:T.Scene){
  if(this.hooks.blocked()||this.hooks.vehicleLocked?.()||this.enterButton.disabled||this.mountAbort)return;
  const generation=++this.mountGeneration;const preparation=this.mountAbort=new AbortController();
  void this.sound.unlock();this.enterButton.disabled=true;this.enterButton.textContent='Preparing hoverbike…';
  try{
   await this.prepare(scene,true,preparation.signal);
   if(generation!==this.mountGeneration||this.hooks.blocked()||this.hooks.vehicleLocked?.())return;
   const p=this.spawnNear(this.hooks.pose());this.sim.reset(p.x,p.z,p.heading);this.resetRider();
   this.riding=true;this.model!.visible=true;this.hero&&(this.hero.visible=true);
   document.body.classList.add('on-hoverbike');this.hud.hidden=false;this.hooks.entered();
   this.say('Press G to take off. E / Q changes height.');this.refresh();
  }catch(e){if(generation===this.mountGeneration&&!preparation.signal.aborted){console.error('Hoverbike load failed',e);this.enterButton.textContent='Retry hoverbike';}}
  finally{if(generation===this.mountGeneration){this.mountAbort=undefined;this.enterButton.disabled=!!this.hooks.vehicleLocked?.();if(this.model)this.enterButton.textContent=this.riding?'Get off hoverbike · B':'Ride hoverbike · B';}}
 }
 /** prepare() loads assets first; this synchronous placement cannot outlive a cancelled start. */
 beginTrial(p:{x:number;y:number;z:number;heading:number}){
  if(!this.model)return false;
  ++this.mountGeneration;this.clear();this.jarvs.reset();
  if(!this.sim.startFlight(p))return false;
  this.savedFlightMode??=this.sim.mode;this.savedDriveGear??=this.sim.drive.gear;this.sim.drive.gear='auto';this.driveSelect.value='auto';this.sim.setMode('drone');this.flightSelect.value='drone';this.resetRider();
  this.riding=true;this.model.visible=true;this.hero&&(this.hero.visible=true);
  document.body.classList.add('on-hoverbike');this.hud.hidden=false;this.hooks.entered();
  this.say('Sky Circuit · Drone flight · Follow the numbered rings.');this.refresh();
  return true;
 }
 endTrial(){if(this.savedDriveGear!==undefined){this.sim.drive.gear=this.savedDriveGear;this.driveSelect.value=String(this.savedDriveGear);this.savedDriveGear=undefined;}if(this.savedFlightMode!==undefined){this.sim.setMode(this.savedFlightMode);this.flightSelect.value=this.savedFlightMode;this.savedFlightMode=undefined;}this.refresh();}
 clear(){this.releaseStick();this.pressed.clear();this.sim.stop();this.rider?.suspend();this.idleHover.suspend();this.hud.querySelectorAll('[data-held]').forEach(b=>b.removeAttribute('data-held'));this.sound.silence();}
 private resetRider(){
  this.idleHover.reset();
  this.steerBlend=0;if(this.bars)this.bars.quaternion.copy(this.barsRest);
  const p=this.sim.pose;if(this.model){this.model.position.set(p.x,p.y,p.z);this.model.rotation.set(p.pitch,p.heading,p.roll,'YXZ');}
  this.rider?.reset(p,this.sim.landed);
 }
 key(e:KeyboardEvent){
  if(!this.riding||!keyCodes.includes(e.code))return false;e.preventDefault();this.pressed.add(e.code);
  if(!e.repeat)switch(e.code){case'KeyX':this.toggleCruise();break;case'Minus':this.sim.adjustCruise(-5);break;case'Equal':this.sim.adjustCruise(5);break;case'KeyG':this.toggleFlight();break;case'KeyF':this.exit();break;case'KeyL':this.toggleLights();break;case'KeyH':this.toggleBeam();break;case'KeyK':this.nextColor();break;case'KeyR':this.recover();break;case'BracketLeft':this.shiftGear(-1);break;case'BracketRight':this.shiftGear(1);break;}
  return true;
 }
 keyUp(code:string){this.pressed.delete(code);}
 private selectGear(gear:DriveGear){
  if(this.hooks.blocked()||this.hooks.vehicleLocked?.()){this.driveSelect.value=String(this.sim.drive.gear);return;}
  this.sim.drive.clutch=Number(this.pressed.has('KeyC'));
  if(!this.sim.drive.select(gear,this.sim.landed))this.say('Hold clutch · C while selecting a gear.');
  else this.say('Drive · '+gearLabel(gear));this.driveSelect.value=String(this.sim.drive.gear);this.refresh();
 }
 private shiftGear(direction:number){const i=DRIVE_GEARS.indexOf(this.sim.drive.gear);this.selectGear(DRIVE_GEARS[Math.max(0,Math.min(DRIVE_GEARS.length-1,i+direction))]);}
 private toggleFlight(){if(this.hooks.vehicleLocked?.())return;void this.sound.unlock();if(this.sim.flying&&this.sim.clearance>.3){this.sim.land();this.say('Landing… wait for the skids to settle.');}else{this.sim.launch();this.say('Lift fans online. Ready to ride.');}}
 private toggleCruise(){const was=this.sim.cruiseSpeed!==null;this.sim.toggleCruise();this.say(this.sim.cruiseSpeed!==null?'Speed locked at '+speedMph(this.sim.cruiseSpeed)+' mph. Brake to cancel.':was?'Cruise off.':'Take off and ride above 5 mph to lock speed.');this.refresh();}
 private toggleLights(){this.lightOn=!this.lightOn;this.hud.querySelector('[data-hover="lights"]')!.setAttribute('aria-pressed',String(this.lightOn));}
 private saveLighting(){try{localStorage.setItem('belle-hover-lighting',JSON.stringify({color:this.ledColor,mode:this.ledMode}));}catch{}}
 private nextColor(){this.ledColor=LED_COLORS[(LED_COLORS.indexOf(this.ledColor)+1)%LED_COLORS.length];this.ledInput.value=this.ledColor;this.ledMode='solid';this.ledSelect.value='solid';this.saveLighting();}
 private toggleBeam(){this.highBeam=!this.highBeam;this.hud.querySelector('[data-hover="beam"]')!.setAttribute('aria-pressed',String(this.highBeam));}
 private soundButton(){const b=this.hud.querySelector('[data-hover="sound"]')!;b.textContent=this.sound.enabled?'Sound on':'Sound off';b.setAttribute('aria-pressed',String(this.sound.enabled));}
 private toggleSound(){this.sound.toggle();this.soundButton();}
 private recover(){if(this.hooks.vehicleLocked?.()){this.hooks.restartTrial?.();return;}this.clear();this.sim.reset();this.resetRider();this.say('Recovered to the last landing spot.');}
 exit(){
  if(this.hooks.vehicleLocked?.())return;
  const point=this.sim.exitPoint();
  if(!point){this.say('Land on clear ground before getting off. Press G to land.');return;}
  this.leaveForTravel();this.hooks.exited(point);
 }
 leaveForTravel(){++this.mountGeneration;this.mountAbort?.abort();this.mountAbort=undefined;this.endTrial();this.clear();this.riding=false;this.idleHover.reset();this.sim.land();this.jarvs.reset();this.hud.hidden=true;this.model&&(this.model.visible=false);document.body.classList.remove('on-hoverbike');this.enterButton.disabled=!!this.hooks.vehicleLocked?.();this.enterButton.textContent='Ride hoverbike · B';}
 private say(message:string){this.notice.textContent=message;this.messageUntil=performance.now()+4500;}
 private refresh(){
  const p=this.sim.pose,jarvs=this.jarvs.snapshot;
  this.jarvsDisplay.dataset.status=jarvs.status;
  this.jarvsDisplay.dataset.intensity=jarvs.intensity;
  this.jarvsDisplay.querySelector('#jarvs-readiness')!.textContent=jarvs.status;
  this.jarvsDisplay.querySelector('#jarvs-radar')!.textContent=jarvs.radarMeters===null?'RADAR CLEAR':'RADAR '+Math.round(jarvs.radarMeters)+'m';
  this.jarvsDisplay.querySelector('#jarvs-advice')!.textContent=jarvs.advice;
  this.jarvsDisplay.querySelector('#jarvs-context')!.textContent=jarvs.signalLock?'SIGNAL LOCK · '+jarvs.memoryCells+' ROUTE CELLS':'SENSORS STANDBY';
  this.cockpit?.update({speed:p.speed,height:p.y-this.sim.floor(p.x,p.z),heading:p.heading,landed:this.sim.landed,landing:this.sim.clearance<.3,boost:this.sim.boostActive,collision:this.sim.collision,lights:this.lightOn,drone:this.sim.mode==='drone',cruiseSpeed:this.sim.cruiseSpeed,gear:this.sim.drive.gear,clutch:this.sim.drive.clutch,throttle:this.sim.drive.throttle,brake:this.sim.drive.brake,jarvs:{status:jarvs.status,signalLock:jarvs.signalLock}});
  this.hud.querySelector<HTMLMeterElement>('#hover-energy')!.value=this.sim.boostEnergy;this.hud.querySelector('#hover-energy-text')!.textContent=Math.round(this.sim.boostEnergy*100)+'%';this.hud.querySelector('#hover-boost')!.setAttribute('aria-pressed',String(this.sim.boostActive));
  this.speed.textContent=String(speedMph(p.speed));
  const locked=this.sim.cruiseSpeed!==null,lockButton=this.hud.querySelector<HTMLButtonElement>('#hover-cruise')!;
  lockButton.setAttribute('aria-pressed',String(locked));lockButton.textContent=locked?'Cruise on · X':'Lock speed · X';
  this.hud.querySelector<HTMLElement>('#hover-cruise-adjust')!.hidden=!locked;
  const target=this.hud.querySelector('#hover-cruise-target')!,label=locked?speedMph(this.sim.cruiseSpeed!)+' MPH':'Cruise off';if(target.textContent!==label)target.textContent=label;
  this.altitude.textContent=Math.max(0,p.y-this.sim.floor(p.x,p.z)).toFixed(1);
  this.mode.textContent=this.sim.landed?'LANDED':this.sim.clearance<.3?'LANDING':this.sim.boostActive?'BOOST':locked?'CRUISE':this.sim.mode==='drone'?'ALTITUDE HOLD':'IN FLIGHT';
  // Lock the visible flight-mode selector while Sky Circuit owns the vehicle.
  const trialVehicleLocked=!!this.hooks.vehicleLocked?.();
  this.flightSelect.disabled=trialVehicleLocked;
  this.hud.querySelector<HTMLButtonElement>('[data-hover="takeoff"]')!.disabled=trialVehicleLocked;
  this.hud.querySelector<HTMLButtonElement>('[data-hover="exit"]')!.disabled=trialVehicleLocked;
  this.hud.querySelector('[data-hover="takeoff"]')!.textContent=this.sim.flying&&this.sim.clearance>.3?'Land · G':'Take off · G';
  this.touchPad.hidden=!this.hooks.touch();
  this.hud.querySelector('#hover-drive')!.textContent=gearLabel(this.sim.drive.gear);
  // Read-only applied-pose telemetry supports real-input regression captures.
  // It does not expose controls or alter the player's scene or simulation.
  const rider=this.rider?.diagnostics;this.hud.dataset.riderRig=rider?.contacts===4?'anchored':'unavailable';
  this.hud.dataset.riderMotion=this.motionPreference.matches||this.motionCheckbox?.checked?'reduced':'reactive';
  this.hud.dataset.idleHoverY=this.idleHover.offsetY.toFixed(5);this.hud.dataset.idleHoverWeight=this.idleHover.strength.toFixed(4);this.hud.dataset.idleHoverEligible=String(this.idleHover.isIdle);
  if(rider){this.hud.dataset.riderLean=rider.lean.toFixed(4);this.hud.dataset.riderPitch=rider.pitch.toFixed(4);this.hud.dataset.riderCompression=rider.compression.toFixed(4);this.hud.dataset.riderHandError=rider.handError.toFixed(5);this.hud.dataset.riderFootError=rider.footError.toFixed(5);}
   this.hud.querySelector('.hover-help')!.textContent=this.sim.mode==='drone'?'W / S forward / back · A / D strafe · ← / → turn · E / Q height · position hold on release · Space brake · X lock speed · − / = adjust · Shift boost':'W / S speed · A / D steer · E / Q height · Space brake · X lock speed · − / = adjust · Shift boost · drag to look';
  if(performance.now()>this.messageUntil)this.notice.textContent=this.sim.collision?'Contact — brake and steer clear.':this.sim.hazard?'Caution · obstacle ahead':this.sim.landed?'Ready for takeoff.':'Michigan 2084 · Explore the island';
 }
 update(dt:number,running:boolean,clock:number){
  if(!this.riding||!this.model)return;
  const has=(a:string,b?:string)=>this.pressed.has(a)||!!b&&this.pressed.has(b);
  const drone=this.sim.mode==='drone',horizontal=Number(has('KeyD'))-Number(has('KeyA'))+this.stick.x;
  const steer=T.MathUtils.clamp(Number(has('ArrowRight'))-Number(has('ArrowLeft'))+(drone?0:horizontal),-1,1);
  const pilotLift=Number(has('KeyE'))-Number(has('KeyQ'));
  const lift=this.jarvs.assistLift(pilotLift,this.sim.mode,!!this.hooks.vehicleLocked?.());
  if(running)this.sim.advance(dt,{throttle:Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown'))+this.stick.y,strafe:drone?horizontal:0,steer,lift,brake:has('Space'),clutch:Number(has('KeyC')),boost:has('ShiftLeft','ShiftRight')});
  const p=this.sim.pose;
  const avionics=this.jarvs.update({now:performance.now(),x:p.x,y:p.y,z:p.z,heading:p.heading,speed:p.speed,
   clearance:this.sim.clearance,flying:this.sim.flying,landed:this.sim.landed,collision:this.sim.collision,hazard:this.sim.hazard,
   mode:this.sim.mode,blocked:!running||this.hooks.blocked(),racing:!!this.hooks.vehicleLocked?.()});
  if(running&&avionics.announcement)this.sound.announce(avionics.announcement.text,avionics.announcement.priority);
  const reducedMotion=this.motionPreference.matches||this.motionCheckbox?.checked===true;
  const idleY=this.idleHover.update(dt,p,{
   flying:this.sim.flying,landed:this.sim.landed,landing:this.sim.clearance<=.3,
   collision:this.sim.collision,hazard:this.sim.hazard,racing:!!this.hooks.vehicleLocked?.(),
   running:running&&!this.hooks.blocked()&&!document.hidden&&document.hasFocus(),reducedMotion,
   inputActive:idleHoverInputActive(this.pressed,this.stick,lift,this.sim.cruiseSpeed!==null,this.sim.boostActive),
   height:this.sim.flying&&!this.sim.landed?p.y-this.sim.floor(p.x,p.z):0,firstPerson:this.idleFirstPerson,
  });
  // Move the entire render hierarchy (bike, rider, grips, LCD) from the authoritative pose.
  // Never accumulate onto the last render transform or feed visual Y back into simulation.
  this.model.position.set(p.x,p.y+idleY,p.z);
  this.model.rotation.set(p.pitch,p.heading,p.roll,'YXZ');
  if(running){
   this.steerBlend=T.MathUtils.damp(this.steerBlend,steer,7,dt);
   this.rotors.forEach((r,i)=>r.rotateY(dt*p.rpm*(i%2?-1:1)*32));
   this.pods.forEach(({o,q},i)=>o.quaternion.copy(q).multiply(this.localRotation.setFromEuler(this.localEuler.set(p.pitch*.4,0,steer*.08*(i%2?-1:1)))));
   this.gearBlend=T.MathUtils.damp(this.gearBlend,this.sim.flying&&this.sim.clearance>.4?1:0,3,dt);
   this.gear.forEach(({o,q},i)=>o.quaternion.copy(q).multiply(this.localRotation.setFromAxisAngle(this.zAxis,this.gearBlend*(i?-.65:.65))));
   if(this.bars)this.bars.quaternion.copy(this.barsRest).multiply(this.localRotation.setFromAxisAngle(this.yAxis,-this.steerBlend*.18));
  }
  this.controls?.update(dt,this.sim.drive);this.fittedArms?.update(dt,this.sim.throttleDemand);
  this.rider?.update(dt,p,this.sim.landed,this.steerBlend,running,reducedMotion);
  this.lighting?.update(dt,running,this.ledColor,this.ledMode,this.lightOn,this.highBeam,reducedMotion,this.hooks.nightAmount?.()??1);
  this.brakes.forEach(m=>m.emissiveIntensity=has('Space')?4:this.lightOn?.65:0);
  if(running)this.sound.warn(this.sim.impactSpeed,this.sim.hazard);
  this.sound.update(p.rpm,p.speed,p.lift,this.sim.flying,this.sim.landed,has('Space'),running&&document.hasFocus());
  if(clock-this.lastUI>.1){this.lastUI=clock;this.refresh();}
 }
 camera(camera:T.PerspectiveCamera,first:boolean,yaw:number,pitch:number,dt:number,snap:boolean,photo=false,reduced=false){
  if(!this.riding)return;
  this.idleFirstPerson=first; // Camera remains anchored to physics; only model heave is attenuated.
  this.cockpit?.setVisible(!photo);this.cockpit?.setInteraction(camera,first&&!photo&&this.riding&&!this.hooks.blocked());
  const p=this.sim.pose;this.cockpitHidden.forEach(o=>o.visible=!first);if(this.fpvArms)this.fpvArms.visible=false;this.fittedArms?.setVisible(first&&!photo);
  const angle=p.heading+yaw,forward=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
  const look=new T.Vector3(p.x,p.y+1.15,p.z),desired=new T.Vector3();
  if(first){desired.set(p.x-Math.sin(p.heading)*.40,p.y+1.58,p.z-Math.cos(p.heading)*.40);look.copy(desired).addScaledVector(forward,12);look.y-=Math.tan(Math.min(1.25,pitch+(photo?0:.12)))*12;}
  else{desired.copy(look).addScaledVector(forward,-5.4);desired.y+=2.2+pitch*3;desired.y=Math.max(desired.y,this.sim.floor(desired.x,desired.z)+.7);
   const dir=desired.clone().sub(look),length=dir.length();dir.normalize();const hit=this.terrain.raycastFlight(look,dir,length,.2);if(hit!==null)desired.copy(look).addScaledVector(dir,Math.max(.5,hit-.3));
  }
  // A cockpit camera must move with the vehicle: chase lag moves it metres behind at road speed.
  camera.position.lerp(desired,first||snap?1:1-Math.exp(-dt*9));if(!first)look.y+=Math.max(0,-pitch-.25)*6;camera.lookAt(look);
  if(first&&!photo&&!reduced)camera.rotateZ(-p.roll*.18);
  const fov=(first?72:63)+(!photo&&!reduced&&this.sim.boostActive?6:0),next=T.MathUtils.damp(camera.fov,fov,4,dt);
  if(Math.abs(camera.fov-fov)>.01){camera.fov=snap?fov:next;camera.updateProjectionMatrix();}
 }
}
