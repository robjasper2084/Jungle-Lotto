import * as T from 'three';
import type {RidePose,RideActions} from '../../runtime/ride-core/src/controller.ts';
import {vrHeading,vrOrigin} from '../../runtime/ride-core/src/xrInput.ts';
import {XRHands} from '../../runtime/ride-core/src/xrHands.ts';
import {BelleVRInput,comfortThrottle} from './vrInput.ts';
import type {ParkTerrain} from './terrain.ts';

type Place={label:string;go:()=>void};
type Hooks={ready:()=>boolean;pose:()=>RidePose;enter:()=>void;exit:()=>void;clear:()=>void;places:()=>Place[]};
type Choice={label:string;run:()=>void};

/** One renderer / one RideCore. Head pose stays tracked; only the floor origin
 * moves. DOM controls are mirrored by a controller-operated in-headset guide. */
export class BelleVR {
 readonly rig=new T.Group();
 readonly input=new BelleVRInput();
 private hands:XRHands;
 private session:XRSession|null=null;
 private pending=false;private supported=false;private entered=false;
 private menuOpen=true;private selected=0;private choices:Choice[]=[];private choicesKey='';
 private comfort=true;private yaw=0;private heading=0;private headYaw=0;private currentHeadYaw=0;
 private center={x:0,z:0};private recenterPending=true;
 private tracking=false;private unsafe=false;private connected=false;private fadeUntil=0;
 private panelCanvas=document.createElement('canvas');private ctx:CanvasRenderingContext2D;
 private texture:T.CanvasTexture;private panel:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 private curtain=new T.Mesh(new T.SphereGeometry(.25,12,8),new T.MeshBasicMaterial({color:0x071417,side:T.BackSide,depthTest:false,depthWrite:false,toneMapped:false}));
 private lastText='';private head=new T.Vector3();private eye=new T.Vector3();private direction=new T.Vector3();
 private quaternion=new T.Quaternion();private euler=new T.Euler(0,0,0,'YXZ');
 private button:HTMLButtonElement;private settingsButton:HTMLButtonElement;private status:HTMLElement;
 private savedShadow=true;private savedCameraAuto=true;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,private camera:T.PerspectiveCamera,private terrain:ParkTerrain,private hooks:Hooks){
  this.rig.name='Belle Isle VR floor origin';scene.add(this.rig);
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.8);
  this.hands=new XRHands(renderer,this.rig);
  this.panelCanvas.width=1024;this.panelCanvas.height=768;this.ctx=this.panelCanvas.getContext('2d')!;
  this.texture=new T.CanvasTexture(this.panelCanvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=T.LinearFilter;
  this.panel=new T.Mesh(new T.PlaneGeometry(1.35,1.0125),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
  this.panel.renderOrder=10002;this.panel.frustumCulled=false;camera.add(this.panel);this.panel.visible=false;
  this.curtain.renderOrder=10001;this.curtain.frustumCulled=false;camera.add(this.curtain);this.curtain.visible=false;
  this.button=document.getElementById('enter-vr') as HTMLButtonElement;
  this.settingsButton=document.getElementById('settings-vr') as HTMLButtonElement;
  this.status=document.getElementById('vr-status')!;
  this.button.onclick=this.settingsButton.onclick=()=>this.toggle();
  navigator.xr?.addEventListener('devicechange',()=>void this.check());
  window.addEventListener('blur',()=>{if(this.active)this.pause();});
  document.addEventListener('visibilitychange',()=>{if(this.active)this.pause();});
  renderer.xr.addEventListener('sessionend',()=>this.ended());
  void this.check();
 }
 get active(){return this.entered&&this.renderer.xr.isPresenting;}
 get suspended(){return this.menuOpen||!this.tracking||!this.connected||this.unsafe||this.session?.visibilityState!=='visible';}
 private label(label:string,disabled:boolean,message?:string){for(const b of [this.button,this.settingsButton]){b.textContent=label;b.disabled=disabled;}if(message)this.status.textContent=message;}
 refresh(){if(this.supported&&!this.active&&!this.pending)this.label('Enter VR',!this.hooks.ready());}
 private async check(){
  if(this.active||this.pending)return;
  this.supported=false;
  if(!isSecureContext){this.label('VR needs HTTPS',true,'On Quest, open an HTTPS game link in Quest Browser. A PC’s localhost address cannot be opened from the headset.');return;}
  if(!navigator.xr){this.label('VR unavailable',true,'Use Meta Quest Browser with Touch controllers. This browser can continue in normal screen mode.');return;}
  try{this.supported=await navigator.xr.isSessionSupported('immersive-vr');this.label(this.supported?'Enter VR':'Connect VR headset',!this.supported||!this.hooks.ready(),this.supported?'Start your ride, then enter VR. Seated or standing: use your headset floor calibration.':'No immersive VR headset detected. Normal screen controls remain available.');}
  catch{this.label('VR unavailable',true,'The browser could not check VR support. Try Meta Quest Browser.');}
 }
 private async toggle(){
  if(this.pending)return;
  if(this.active){await this.session?.end().catch(()=>{});return;}
  if(!this.supported||!this.hooks.ready())return;
  this.pending=true;this.label('Starting VR…',true);
  let session:XRSession|undefined;
  try{
   // Keep requestSession directly in the user's click gesture.
   session=await navigator.xr!.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
   this.session=session;this.savedShadow=this.renderer.shadowMap.enabled;this.savedCameraAuto=this.renderer.xr.cameraAutoUpdate;
   this.entered=true;this.hooks.enter();this.rig.add(this.camera);this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);
   this.renderer.shadowMap.enabled=false;this.renderer.xr.cameraAutoUpdate=false;
   this.heading=this.hooks.pose().headingY;this.yaw=0;this.recenterPending=true;this.tracking=false;this.menuOpen=true;this.selected=0;this.input.reset();
   session.addEventListener('visibilitychange',()=>{if(session!.visibilityState!=='visible')this.pause();});
   session.addEventListener('inputsourceschange',()=>{this.input.reset();this.pause();});
   session.addEventListener('end',()=>this.ended(),{once:true});
   await this.renderer.xr.setSession(session);this.renderer.xr.setFoveation(1);
   this.label('Exit VR',false,'VR active · Y opens the island guide · X recovers · A walks/rides.');
  }catch(error){
   if(session)await session.end().catch(()=>{});this.ended();
   this.label('Try VR again',false,'VR did not start: '+(error instanceof Error?error.message:String(error)));
  }finally{this.pending=false;}
 }
 private ended(){
  if(!this.entered)return;
  this.entered=false;this.session=null;this.pendingAction='';this.input.reset();this.hands.update(false);this.panel.visible=this.curtain.visible=false;
  this.scene.add(this.camera);this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);
  this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);
  this.renderer.shadowMap.enabled=this.savedShadow;this.renderer.xr.cameraAutoUpdate=this.savedCameraAuto;
  this.hooks.exit();this.label('Enter VR',false,'VR ended. Resume your screen ride or enter VR again.');
 }
 pause(){this.menuOpen=true;this.selected=0;this.pendingAction='';this.input.reset();this.hooks.clear();}
 relocated(){if(!this.active)return;this.heading=this.hooks.pose().headingY;this.yaw=0;this.recenterPending=true;this.fadeUntil=performance.now()+180;this.input.reset();}
 private menu(){
  const p=this.hooks.pose(),key=p.footMode+':'+this.comfort;if(key===this.choicesKey)return;this.choicesKey=key;const leave=()=>{this.menuOpen=false;this.input.reset();this.hooks.clear();};
  this.choices=[
   {label:'Resume exploring',run:leave},
   {label:p.footMode?'Mount wheel (stand beside it)':'Get off wheel (stop first)',run:()=>{leave();this.pendingAction='mount';}},
   {label:'Recover rider',run:()=>{leave();this.pendingAction='recover';}},
   {label:'Recenter view',run:()=>{this.recenterPending=true;this.input.reset();}},
   {label:'Ride speed: '+(this.comfort?'Comfort · 22 km/h':'Full speed'),run:()=>{this.comfort=!this.comfort;this.input.reset();}},
   {label:'Exit VR',run:()=>void this.session?.end().catch(()=>{})},
   ...this.hooks.places().map(p=>({label:p.label,run:()=>{p.go();this.relocated();leave();}})),
  ];
 }
 private pendingAction:''|'mount'|'recover'='';private issued=false;
 /** Sample tracking and controls before physics; never advance while focus or controllers are lost. */
 poll(frame:XRFrame|undefined):Partial<RideActions>{
  this.issued=false;
  if(!this.active)return {};
  const reference=this.renderer.xr.getReferenceSpace(),view=frame&&reference?frame.getViewerPose(reference):null;
  this.tracking=!!view;
  if(!view||this.session?.visibilityState!=='visible'){this.pause();this.pendingAction='';return {};}
  const t=view.transform;this.head.set(t.position.x,t.position.y,t.position.z);
  this.quaternion.set(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w);this.currentHeadYaw=this.euler.setFromQuaternion(this.quaternion,'YXZ').y;
  if(this.recenterPending){this.center={x:t.position.x,z:t.position.z};this.headYaw=this.currentHeadYaw;this.recenterPending=false;}
  const controls=this.input.sample(Array.from(this.session!.inputSources),this.menuOpen);this.connected=controls.ready;
  if(controls.menu){this.menuOpen=!this.menuOpen;this.input.reset();this.pendingAction='';this.hooks.clear();return {};}
  if(controls.recenter){this.recenterPending=true;this.pendingAction='';this.input.reset();this.hooks.clear();return {};}
  if(this.menuOpen){
   this.menu();this.selected=(this.selected+controls.step+controls.page*8+this.choices.length)%this.choices.length;
   if(controls.select)this.choices[this.selected].run();
   return {};
  }
  const p=this.hooks.pose();this.yaw-=controls.snap;
  this.checkClearance(p);
  if(this.suspended){if(this.unsafe)this.pendingAction='';return {};}
  if(controls.mount)this.pendingAction='mount';
  if(controls.recover)this.pendingAction='recover';
  const action=this.pendingAction;
  this.issued=!!action;
  // In walking mode the left stick strafes relative to tracked gaze. On the
  // wheel it steers the same physical controller used by the desktop game.
  const facing=p.footMode===2?this.heading+this.yaw-this.headYaw+this.currentHeadYaw:undefined;
  return {throttle:p.footMode?(controls.brake?0:controls.throttle):comfortThrottle(controls.throttle,p.speed,controls.brake,this.comfort),steer:controls.steer,facingYaw:facing,
   dismount:controls.mount||action==='mount',recover:controls.recover||action==='recover',reset:(controls.recover||action==='recover')&&p.crashBlend>0,
   hop:controls.hop,hopHeld:controls.hopHeld,crouch:false,trick:0,run:false};
 }
 consumed(steps:number){if(steps>0&&this.issued)this.pendingAction='';}
 private checkClearance(p:RidePose){
  const o=vrOrigin(p,this.heading,this.yaw,this.headYaw,this.center,true);
  this.direction.copy(this.head).applyAxisAngle(T.Object3D.DEFAULT_UP,o.yaw).add(new T.Vector3(o.x,o.y,o.z));
  this.eye.set(p.x,this.direction.y,p.z);this.direction.sub(this.eye);const d=this.direction.length();
  this.unsafe=d>1.5||(d>.03&&this.terrain.raycastObstacle(this.eye,this.direction.clone().normalize(),d,.12)!==null);
 }
 update(p:RidePose,dt:number){
  if(!this.active)return;
  if(!p.footMode)this.heading=vrHeading(this.heading,p,false,p.crashBlend>0,dt);
  const o=vrOrigin(p,this.heading,this.yaw,this.headYaw,this.center,true);
  this.rig.position.set(o.x,o.y,o.z);this.rig.rotation.set(0,o.yaw,0);this.rig.updateMatrixWorld(true);
  this.renderer.xr.updateCamera(this.camera);this.hands.update(this.tracking);
  this.checkClearance(p);
  this.curtain.visible=!this.tracking||this.unsafe||performance.now()<this.fadeUntil;
  const warning=!this.tracking?'Headset tracking paused':this.unsafe?'Step back toward your starting spot':!this.connected?'Wake both controllers; release sticks/buttons':'';
  this.panel.visible=true;
  const page=Math.floor(this.selected/8),parkDistance=Math.hypot(p.x-p.parkX,p.z-p.parkZ);
  const text=JSON.stringify([this.menuOpen,page,this.selected,warning,Math.round(Math.abs(p.speed)*3.6),p.footMode,p.crashBlend>.1,Math.ceil(parkDistance),this.comfort]);
  if(text===this.lastText)return;this.lastText=text;
  const c=this.ctx;c.clearRect(0,0,1024,768);
  if(this.menuOpen){
   this.menu();this.panel.position.set(0,0,-1.8);this.panel.scale.setScalar(1);
   c.fillStyle='rgba(6,27,33,.96)';c.fillRect(0,0,1024,768);c.fillStyle='#a2ede2';c.font='bold 36px system-ui';c.fillText('BELLE ISLE · VR ISLAND GUIDE',35,54);
   c.fillStyle='#e5ede7';c.font='23px system-ui';c.fillText('Left stick ↑↓ choose · Right stick ←→ page · A / trigger select',35,93);
   this.choices.slice(page*8,page*8+8).forEach((choice,i)=>{const y=122+i*62,selected=page*8+i===this.selected;c.fillStyle=selected?'#6cd6c3':'#183a42';c.fillRect(26,y,972,55);c.fillStyle=selected?'#092426':'#edf3e9';c.font='27px system-ui';c.fillText(choice.label,43,y+37,930);});
   c.fillStyle='#c5d9da';c.font='23px system-ui';c.fillText('Page '+(page+1)+' / '+Math.ceil(this.choices.length/8)+' · Y closes guide',35,658);
   c.fillStyle='#f5de9c';c.fillText(warning||'Left stick moves · A walk/ride · B hop · X recover',35,708,950);
  }else{
   this.panel.position.set(0,-.52,-1.65);this.panel.scale.set(.77,.77,1);
   c.fillStyle='rgba(6,27,33,.82)';c.fillRect(0,610,1024,158);c.fillStyle='#edf5ec';c.font='bold 32px system-ui';
   c.fillText(warning||(p.crashBlend>.1?'Fallen · X to recover':p.footMode?'On foot · Wheel '+Math.ceil(parkDistance)+' m':Math.round(Math.abs(p.speed)*3.6)+' km/h · '+(this.comfort?'Comfort ride':'Full speed')),30,657,960);
   c.font='25px system-ui';c.fillText('Y guide / pause · A walk / ride · X recover · Click stick: recenter',30,711,960);
  }
  this.texture.needsUpdate=true;
 }
}
