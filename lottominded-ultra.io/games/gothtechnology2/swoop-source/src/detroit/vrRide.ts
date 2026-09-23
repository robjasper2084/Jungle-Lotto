import * as T from 'three';
import type {RidePose} from './controller.ts';
import {XRControllerInput,VRLeanDrive,vrHeading,vrOrigin,vrGazeSteer} from './xrInput.ts';

type Hooks={ready:()=>boolean;enter:()=>void;exit:()=>void;pause:()=>void;unlockAudio:()=>void;message:(text:string)=>void};
/** Headset pose stays physical: locomotion changes only the origin, never head pitch/roll. */
export class VRRide {
 readonly rig=new T.Group();readonly input=new XRControllerInput();
 readonly button=document.createElement('button');readonly status=document.createElement('small');
 eyeHeight=1.75;hudEnabled=false;readonly hudButton=document.createElement('button');
 steeringMode:'controller'|'head'='controller';private gazeSteer=0;private gazeForward=new T.Vector3();private gazeRotation=new T.Quaternion();
 driveMode:'controller'|'lean'='controller';private leanDrive=new VRLeanDrive();private leanOffset=new T.Vector3();
 private calibratedHeight=1.75;private calibratedRiderHeight=0;
 comfort=true;private viewYaw=0;private heading=0;private initialized=false;private pending=false;private wands=false;
 private recenterPending=true;private headYaw=0;private center={x:0,z:0};
 private savedShadows=true;private texture:T.CanvasTexture;private hud:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 private panel=document.createElement('canvas');private context:CanvasRenderingContext2D;private lastText='';
 constructor(private renderer:T.WebGLRenderer,scene:T.Scene,private camera:T.PerspectiveCamera,container:HTMLElement,private hooks:Hooks){
  this.rig.name='RideCore VR origin';scene.add(this.rig);this.rig.add(camera);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.8);
  this.panel.width=768;this.panel.height=256;this.context=this.panel.getContext('2d')!;this.texture=new T.CanvasTexture(this.panel);this.texture.colorSpace=T.SRGBColorSpace;
  this.hud=new T.Mesh(new T.PlaneGeometry(.60,.20),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));this.hud.position.set(0,-.62,-1.25);this.hud.renderOrder=10000;camera.add(this.hud);this.hud.visible=false;
  for(let i=0;i<2;i++){const grip=renderer.xr.getControllerGrip(i),handle=new T.Mesh(new T.CapsuleGeometry(.018,.08,3,6),new T.MeshStandardMaterial({color:i?'#d5be73':'#69bab0'}));handle.rotation.x=Math.PI/2;grip.add(handle);this.rig.add(grip);}
  this.button.id='enterVR';this.button.textContent='Checking VR…';this.button.disabled=true;this.button.onclick=()=>void this.toggle();container.append(this.button);
  const label=document.createElement('label'),select=document.createElement('select');label.className='vrComfort';label.textContent='VR ride speed ';select.setAttribute('aria-label','VR ride speed');
  for(const [value,text]of [['comfort','Comfort · 22 km/h'],['full','Full riding speed']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}select.onchange=()=>{this.comfort=select.value==='comfort';};label.append(select);container.append(label);
  this.hudButton.id='vrHudToggle';this.hudButton.type='button';this.hudButton.onclick=()=>this.toggleHud();container.append(this.hudButton);this.syncHud();
  const steeringLabel=document.createElement('label'),steeringSelect=document.createElement('select');steeringLabel.className='vrComfort';steeringLabel.textContent='VR steering ';steeringSelect.setAttribute('aria-label','VR steering');
  for(const [value,text]of [['controller','Controller steering'],['head','Look-to-steer']]){const option=document.createElement('option');option.value=value;option.textContent=text;steeringSelect.append(option);}
  steeringSelect.onchange=()=>{this.steeringMode=steeringSelect.value==='head'?'head':'controller';this.initialized=false;this.recenterPending=true;this.gazeSteer=0;};steeringLabel.append(steeringSelect);container.append(steeringLabel);
  const steeringHint=document.createElement('small');steeringHint.textContent='Choose steering and drive independently. Recenter upright: Quest right stick click; Vive hold left grip + right pad center click.';container.append(steeringHint);
  const driveLabel=document.createElement('label'),driveSelect=document.createElement('select');driveLabel.className='vrComfort';driveLabel.textContent='VR drive ';driveSelect.setAttribute('aria-label','VR drive');
  for(const [value,text]of [['controller','Controller acceleration'],['lean','Body-lean drive']]){const option=document.createElement('option');option.value=value;option.textContent=text;driveSelect.append(option);}
  driveSelect.onchange=()=>{this.driveMode=driveSelect.value==='lean'?'lean':'controller';this.recenterPending=true;this.leanDrive.reset();};driveLabel.append(driveSelect);container.append(driveLabel);
  const driveHint=document.createElement('small');driveHint.textContent='Lean forward: go. Lean back: brake, then reverse. Upright: slow to stop. Left trigger always brakes.';container.append(driveHint);
  const hudHint=document.createElement('small');hudHint.textContent='VR HUD on/off: click left stick (Quest), or center of right touchpad (Vive).';container.append(hudHint);
  this.status.id='vrStatus';this.status.setAttribute('role','status');container.append(this.status);navigator.xr?.addEventListener('devicechange',()=>{if(!this.active)void this.check();});void this.check();
 }
 toggleHud(){this.hudEnabled=!this.hudEnabled;this.syncHud();}
 private syncHud(){this.hud.visible=this.active&&this.hudEnabled;this.hudButton.textContent='VR HUD: '+(this.hudEnabled?'on':'off');this.hudButton.setAttribute('aria-pressed',String(this.hudEnabled));}
 get active(){return this.renderer.xr.isPresenting;}
 async check(){
  if(!globalThis.isSecureContext){this.button.textContent='VR requires HTTPS';this.status.textContent='Open this game over HTTPS on your headset, or localhost on the connected PC.';return;}
  if(!navigator.xr){this.button.textContent='VR unavailable';this.status.textContent='Open in a WebXR-capable headset browser or a PC browser connected to a VR headset.';return;}
  try{const supported=await navigator.xr.isSessionSupported('immersive-vr');this.button.disabled=!supported;this.button.textContent=supported?'Enter VR':'Connect a VR headset';this.status.textContent=supported?'Choose your map and rider, then enter VR.':'No immersive VR headset is available in this browser.';}
  catch{this.button.textContent='VR unavailable';this.status.textContent='This browser could not check the VR device.';}
 }
 async enterFromPackage(){await this.check();if(!this.button.disabled&&!this.active)await this.toggle();}
 private async toggle(){
  if(this.pending)return;if(this.active){await this.renderer.xr.getSession()?.end();return;}
  if(!this.hooks.ready()){this.hooks.message('Wait for the map and rider to finish loading.');return;}
  this.pending=true;this.button.disabled=true;this.hooks.unlockAudio();
  let session:XRSession|undefined;
  try{
   session=await navigator.xr!.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
   session.addEventListener('end',()=>this.ended(),{once:true});
   session.addEventListener('visibilitychange',()=>{if(session!.visibilityState!=='visible')this.hooks.pause();});
   await this.renderer.xr.setSession(session);this.savedShadows=this.renderer.shadowMap.enabled;this.renderer.shadowMap.enabled=false;
   this.input.reset();this.leanDrive.reset();this.gazeSteer=0;this.initialized=false;this.viewYaw=0;this.recenterPending=true;this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);this.syncHud();
   this.button.textContent='Exit VR';this.status.textContent='VR active · left stick ride · Y pause · system button exits';this.hooks.enter();
  }catch(error){if(session)await session.end().catch(()=>{});this.status.textContent='VR did not start. '+(error instanceof Error?error.message:String(error));this.button.textContent='Try VR again';}
  finally{this.pending=false;this.button.disabled=false;}
 }
 private ended(){this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);this.hud.visible=false;this.input.reset();this.renderer.shadowMap.enabled=this.savedShadows;this.button.textContent='Enter VR';this.button.disabled=false;this.status.textContent='VR ended. Resume the flat-screen ride or enter again.';this.hooks.exit();}
 poll(speed:number){const p=this.input.sample(Array.from(this.renderer.xr.getSession()?.inputSources??[]),speed);this.wands=p.wands;return p;}
 look(snap:number,recenter:boolean){if(recenter){this.viewYaw=0;this.recenterPending=true;this.initialized=false;this.gazeSteer=0;this.leanDrive.reset();}else this.viewYaw-=snap;}
 drive(controller:number,p:RidePose,dt:number,braking:boolean,frame?:XRFrame){
  if(!this.active||this.driveMode==='controller')return controller;
  if(braking){this.leanDrive.reset();return p.speed>0?-1:p.speed<0?1:0;}
  const reference=this.renderer.xr.getReferenceSpace(),view=frame&&reference?frame.getViewerPose(reference):null;
  if(!view||this.recenterPending||p.crashBlend>0){this.leanDrive.reset();return 0;}
  const position=view.transform.position;
  this.leanOffset.set(position.x-this.center.x,0,position.z-this.center.z).applyAxisAngle(T.Object3D.DEFAULT_UP,this.rig.rotation.y);
  const forward=this.leanOffset.x*Math.sin(p.headingY)+this.leanOffset.z*Math.cos(p.headingY);
  return this.leanDrive.sample(forward,p.speed,dt);
 }
 steering(controller:number,p:RidePose,dt:number,frame?:XRFrame){
  if(!this.active||this.steeringMode==='controller')return controller;
  const reference=this.renderer.xr.getReferenceSpace(),view=frame&&reference?frame.getViewerPose(reference):null;
  if(!view||this.recenterPending||p.crashBlend>0||p.airBlend>.1){this.gazeSteer=0;return 0;}
  const o=view.transform.orientation;
  this.gazeRotation.set(o.x,o.y,o.z,o.w);this.gazeForward.set(0,0,-1).applyQuaternion(this.gazeRotation).applyAxisAngle(T.Object3D.DEFAULT_UP,this.rig.rotation.y);
  if(Math.hypot(this.gazeForward.x,this.gazeForward.z)<.15){this.gazeSteer=0;return 0;}
  const target=vrGazeSteer(Math.atan2(this.gazeForward.x,this.gazeForward.z),p.headingY,p.speed);
  this.gazeSteer+=(target-this.gazeSteer)*(1-Math.exp(-8*Math.max(0,dt)));return this.gazeSteer;
 }
 update(p:RidePose,paused:boolean,crashed:boolean,trick:string,trickActive:boolean,dt:number,frame?:XRFrame){
  if(!this.active)return;
  const reference=this.renderer.xr.getReferenceSpace(),view=frame&&reference?frame.getViewerPose(reference):null;
  if(view&&(this.recenterPending||this.calibratedRiderHeight!==this.eyeHeight)){this.calibratedHeight=view.transform.position.y;this.calibratedRiderHeight=this.eyeHeight;const t=view.transform;this.center={x:t.position.x,z:t.position.z};this.headYaw=new T.Euler().setFromQuaternion(new T.Quaternion(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w),'YXZ').y;this.recenterPending=false;}
  if(!this.initialized){this.heading=p.headingY;this.initialized=true;}
  // Spins and falls animate the rider, not the headset. Keep a level horizon.
  // In gaze mode the world stays stable as the wheel aligns with the gaze target.
  // Rotating the room with every wheel turn would make the target run away forever.
  if(this.steeringMode==='controller')this.heading=vrHeading(this.heading,p,trickActive,crashed,dt);
  const origin=vrOrigin(p,this.heading,this.viewYaw,this.headYaw,this.center,this.comfort);this.rig.position.set(origin.x,origin.y+this.eyeHeight-this.calibratedHeight,origin.z);this.rig.rotation.set(0,origin.yaw,0);
  if(!this.hudEnabled)return;
  const text=[Math.round(Math.abs(p.speed)*3.6)+' km/h',crashed?(this.wands?'FALLEN · Click left pad top':'FALLEN · X to recover'):paused?(this.wands?'PAUSED · Click left pad bottom':'PAUSED · Y to resume'):trick,this.comfort?'COMFORT':'FULL SPEED',this.wands?'wands':'sticks'].join('|');
  if(text!==this.lastText){this.lastText=text;const c=this.context;c.clearRect(0,0,768,256);c.fillStyle='rgba(12,37,34,.86)';c.fillRect(0,0,768,256);c.fillStyle='#f3e6ba';c.font='bold 40px sans-serif';c.fillText(text.split('|')[0],28,52);c.font='25px sans-serif';c.fillText(text.split('|')[1],28,94);c.fillStyle='#d8e4df';c.font='20px sans-serif';c.fillText(this.wands?'Left pad: ride · L trigger: brake · R trigger: hop':'Left stick: ride · Left trigger: brake · Grip: crouch',28,137);c.fillText(this.wands?'Click left pad: top recover / bottom pause':'Right trigger: hop · A: trick · B: next trick',28,170);c.fillText(this.wands?'Right pad: top choose / bottom trick / center HUD':'X: recover · Y: pause · Left stick click: hide HUD',28,203);c.fillText(text.split('|')[2]+(this.wands?' · Right pad sides: look · Grip: crouch':' · Right stick click: recenter'),28,237);this.texture.needsUpdate=true;}
 }
}
