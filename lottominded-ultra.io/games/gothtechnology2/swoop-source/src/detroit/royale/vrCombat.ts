import * as T from 'three';
import {XRHands} from '../../../../ride-core/src/xrHands.ts';
import {XRCombatInput} from './xrCombatInput.ts';
import type {RidePose} from '../../../../ride-core/src/controller.ts';
type Hooks={ready:()=>boolean;enter:()=>void;exit:()=>void;pause:()=>void;unlock:()=>void};
/** A real immersive WebXR origin. Only locomotion moves the room; banking,
 * recoil, death-camera animation and falls never rotate the user's headset. */
export class RoyaleVR {
 readonly origin=new T.Group();readonly input=new XRCombatInput();readonly hands:XRHands;
 readonly weaponMount=new T.Group();readonly button=document.createElement('button');readonly status=document.createElement('p');
 private session?:XRSession;private pending=false;private center?:{x:number;y:number;z:number;yaw:number};private yaw=0;private heading=0;
 private saved={position:new T.Vector3(),quaternion:new T.Quaternion(),shadows:false,near:.12};
 private panel=document.createElement('canvas');private ctx:CanvasRenderingContext2D;private texture:T.CanvasTexture;private hud:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;private text='';
 private aimPosition=new T.Vector3();private aimDirection=new T.Vector3();private rotation=new T.Quaternion();
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,private camera:T.PerspectiveCamera,host:HTMLElement,private hooks:Hooks){
  this.origin.name='Static Royale VR origin';scene.add(this.origin);this.hands=new XRHands(renderer,this.origin);
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.8);
  this.panel.width=1024;this.panel.height=256;this.ctx=this.panel.getContext('2d')!;this.texture=new T.CanvasTexture(this.panel);this.texture.colorSpace=T.SRGBColorSpace;
  this.hud=new T.Mesh(new T.PlaneGeometry(.85,.2125),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));this.hud.position.set(0,-.42,-1.3);this.hud.renderOrder=10000;this.hud.visible=false;camera.add(this.hud);
  this.button.type='button';this.button.id='royale-enter-vr';this.button.disabled=true;this.button.textContent='Checking VR…';this.button.onclick=()=>void this.toggle();
  this.status.setAttribute('role','status');host.append(this.button,this.status);this.status.textContent='Start a match, then enter VR. Two tracked controllers required. Left stick moves; right trigger fires; left trigger aims; right A reloads, B mounts; left X recovers, Y pauses. Right stick snaps / up hops / click swaps weapon. Left grip + right A heals; left grip + B holsters. Headset system menu exits VR.';
  navigator.xr?.addEventListener('devicechange',this.check);void this.check();
 }
 get active(){return !!this.session&&this.renderer.xr.isPresenting;}
 check=async()=>{if(this.active||this.pending)return;try{const supported=!!globalThis.isSecureContext&&!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');this.button.disabled=!supported;this.button.textContent=supported?'Enter VR':!globalThis.isSecureContext?'VR requires HTTPS':'VR headset unavailable';}catch{this.button.disabled=true;this.button.textContent='VR unavailable';}};
 async toggle(){
  if(this.pending)return;if(this.session){await this.session.end();return;}
  if(!this.hooks.ready()){this.status.textContent='Start a practice or online match first, then choose Enter VR in Settings.';return;}
  this.pending=true;this.button.disabled=true;this.hooks.unlock();
  try{
   const session=await navigator.xr!.requestSession('immersive-vr',{requiredFeatures:['local-floor']});this.session=session;
   this.saved.position.copy(this.camera.position);this.saved.quaternion.copy(this.camera.quaternion);this.saved.shadows=this.renderer.shadowMap.enabled;this.saved.near=this.camera.near;
   session.addEventListener('end',this.ended,{once:true});session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible'){this.input.reset();this.hooks.pause();}});
   this.origin.add(this.camera);this.camera.position.set(0,0,0);this.camera.quaternion.identity();this.camera.near=.025;
   this.center=undefined;this.yaw=0;this.input.reset();await this.renderer.xr.setSession(session);this.renderer.xr.setFoveation(1);this.renderer.shadowMap.enabled=false;
   this.button.textContent='Exit VR';this.hud.visible=true;this.hooks.enter();
  }catch(error){if(this.session)await this.session.end().catch(()=>{});this.status.textContent='VR could not start: '+(error instanceof Error?error.message:String(error));this.ended();}
  finally{this.pending=false;this.button.disabled=false;}
 }
 private ended=()=>{if(!this.session)return;this.session=undefined;this.input.reset();this.hands.update(false);this.weaponMount.removeFromParent();this.scene.add(this.camera);this.camera.position.copy(this.saved.position);this.camera.quaternion.copy(this.saved.quaternion);this.camera.near=this.saved.near;this.camera.updateProjectionMatrix();this.renderer.shadowMap.enabled=this.saved.shadows;this.hud.visible=false;this.button.textContent='Enter VR';this.button.disabled=false;this.hooks.exit();};
 poll(){return this.input.sample(this.session?.visibilityState==='visible'?Array.from(this.session.inputSources).filter(source=>{
  const tracked=this.hands.controller(source.handedness);return tracked?.grip.visible&&tracked.ray.visible;
 }):[]);}
 snap(angle:number){this.yaw+=angle;}
 update(p:RidePose,eyeHeight:number,frame?:XRFrame){
  if(!this.active)return;const ref=this.renderer.xr.getReferenceSpace(),pose=frame&&ref?frame.getViewerPose(ref):null;if(!pose){this.hands.update(false);this.input.reset();return;}
  const t=pose.transform;if(!this.center){this.heading=p.headingY;this.center={x:t.position.x,y:t.position.y,z:t.position.z,yaw:new T.Euler().setFromQuaternion(new T.Quaternion(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w),'YXZ').y};}
  // Free on-foot facing follows the controller without rotating the room again.
  if(!p.footMode&&p.crashBlend<.05)this.heading=p.headingY;
  const yaw=this.heading+Math.PI-this.center.yaw+this.yaw,c=Math.cos(yaw),s=Math.sin(yaw);
  this.origin.position.set(p.x-this.center.x*c-this.center.z*s,p.y+eyeHeight-this.center.y,p.z+this.center.x*s-this.center.z*c);this.origin.rotation.set(0,yaw,0);
  this.camera.position.set(t.position.x,t.position.y,t.position.z);this.camera.quaternion.set(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w);this.origin.updateMatrixWorld(true);
  this.hands.update(true);const right=this.hands.controller('right');if(right&&this.weaponMount.parent!==right.ray)right.ray.add(this.weaponMount);
 }
 aim(){const node=this.hands.controller('right')?.ray??this.camera;node.getWorldPosition(this.aimPosition);node.getWorldQuaternion(this.rotation);this.aimDirection.set(0,0,-1).applyQuaternion(this.rotation);return {position:this.aimPosition,direction:this.aimDirection,yaw:Math.atan2(this.aimDirection.x,this.aimDirection.z),pitch:Math.asin(T.MathUtils.clamp(this.aimDirection.y,-1,1))};}
 hudText(lines:string[]){const text=lines.join('|');if(text===this.text)return;this.text=text;const c=this.ctx;c.clearRect(0,0,1024,256);c.fillStyle='rgba(6,22,28,.72)';c.fillRect(0,0,1024,256);c.font='30px sans-serif';c.fillStyle='#d9fff8';lines.slice(0,5).forEach((line,i)=>c.fillText(line,22,40+i*43,980));this.texture.needsUpdate=true;}
 dispose(){navigator.xr?.removeEventListener('devicechange',this.check);void this.session?.end();this.hands.dispose();this.hud.removeFromParent();this.hud.geometry.dispose();this.hud.material.dispose();this.texture.dispose();this.origin.removeFromParent();}
}
