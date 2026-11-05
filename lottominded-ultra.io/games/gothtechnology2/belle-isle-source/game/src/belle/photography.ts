import {applyRealisticMaterials} from './realisticMaterials.ts';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {solveLimb, type LimbChain} from '../../runtime/ride-core/src/limbIK.ts';
import {CameraCapture} from './cameraCapture.ts';
import {CameraRearLcd} from './cameraRearLcd.ts';
import {makePhotoGrip} from './photoGrip.ts';
import {LENSES,lensFov,exposureScale} from './photoMath.ts';
type Kind='static'|'heart'|'bass';
type AudioFeed={stream:MediaStream;release:()=>void};
export class Photography {
 readonly capture:CameraCapture;readonly rig=new T.Group();readonly carried=new T.Group();
 private lcd=new CameraRearLcd();private overlay=new T.PerspectiveCamera(60,1,.025,10);private models=new Map<Kind,T.Object3D>();private body?:T.Object3D;private kind:Kind='static';private mm=35;
 private armGeometry:T.BufferGeometry[]=[];private lens=new T.Group();private arms!:T.Object3D;private actorId='';private limbs:LimbChain[]=[];private rests:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];
 private bodyChoice=document.createElement('select');private lensChoice=document.createElement('select');private loadPromise:Promise<void>;
 get active(){return this.capture.active;}
 constructor(private scene:T.Scene,private canvas:HTMLCanvasElement,hero:T.Object3D,changed:()=>void,audio:()=>AudioFeed|undefined){
  this.capture=new CameraCapture(canvas,changed,audio);this.capture.viewfinder=false;
  this.rig.name='Hero camera and authored arms';this.rig.visible=false;scene.add(this.rig,this.carried);
  this.prepareArms(hero);
  const label=(name:string,select:HTMLSelectElement)=>{const l=document.createElement('label');l.textContent=name;l.append(select);this.capture.panel.prepend(l);};
  this.bodyChoice.setAttribute('aria-label','Camera body');for(const [value,text] of [['static','Static · Field'],['heart','Heart · Studio'],['bass','Bass · Cinema']])this.bodyChoice.add(new Option(text,value));label('CAMERA',this.bodyChoice);
  this.lensChoice.setAttribute('aria-label','Camera lens');for(const l of LENSES)this.lensChoice.add(new Option(l.name,String(l.mm)));this.lensChoice.value='35';label('LENS',this.lensChoice);
  this.bodyChoice.onchange=()=>{this.kind=this.bodyChoice.value as Kind;this.equip();};this.lensChoice.onchange=()=>{this.mm=Number(this.lensChoice.value);this.makeLens();};
  this.loadPromise=this.load().catch(e=>{console.warn('Camera equipment unavailable',e);this.bodyChoice.disabled=true;this.bodyChoice.title='Camera model unavailable; photo capture still works';});
 }
 private prepareArms(hero:T.Object3D){if(this.arms){this.arms.removeFromParent();this.armGeometry.forEach(g=>g.dispose());this.armGeometry=[];}this.actorId=hero.uuid;this.limbs=[];this.rests=[];if(hero.name==='HeroRoot'){this.bakeHoverArms(hero);return;}
  this.arms=clone(hero);this.rig.add(this.arms);this.arms.position.set(0,-1.47,0);this.arms.scale.setScalar(hero.name==='HeroRoot'?.9:1);this.arms.rotation.set(0,Math.PI,0);
  const names=['Left','Right'];const keep=new Set<T.Object3D>();
  for(const side of names){const suffix=side==='Left'?'L':'R',upper=this.arms.getObjectByName(side+'Arm')??this.arms.getObjectByName('UpperArm_'+suffix),knee=this.arms.getObjectByName(side+'ForeArm')??this.arms.getObjectByName('ForeArm_'+suffix),foot=this.arms.getObjectByName(side+'Hand')??this.arms.getObjectByName('Hand_'+suffix);if(upper&&knee&&foot){this.limbs.push({upper,knee,foot});upper.traverse(o=>keep.add(o));}}
  this.arms.traverse(o=>{if(o instanceof T.Bone)this.rests.push({o,p:o.position.clone(),q:o.quaternion.clone()});if(!(o instanceof T.Mesh))return;if(hero.name==='HeroRoot'&&['Hero_Arms','Hero_UpperArms'].includes(o.name)){o.visible=false;return;}o.frustumCulled=false;o.castShadow=false;
   if(o instanceof T.SkinnedMesh){const source=o.geometry,skin=source.getAttribute('skinIndex'),weights=source.getAttribute('skinWeight'),index=source.index;if(!skin||!weights){o.visible=false;return;}const kept:number[]=[],isArm=(v:number)=>{let w=0;for(let i=0;i<4;i++)if(keep.has(o.skeleton.bones[skin.getComponent(v,i)]))w+=weights.getComponent(v,i);return w>.7;};const geometry=source.clone();geometry.clearGroups();for(const group of source.groups.length?source.groups:[{start:0,count:index?.count??source.attributes.position.count,materialIndex:0}]){const start=kept.length;for(let i=group.start;i<group.start+group.count;i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;if(isArm(a)&&isArm(b)&&isArm(c))kept.push(a,b,c);}geometry.addGroup(start,kept.length-start,group.materialIndex);}geometry.setIndex(kept);o.geometry=geometry;this.armGeometry.push(geometry);o.visible=kept.length>0;
   }else{o.visible=!!o.parent&&keep.has(o.parent);}
  });

 }
 private bakeHoverArms(_hero:T.Object3D){
  this.arms=makePhotoGrip();this.rig.add(this.arms);
  this.arms.traverse(o=>{if(o instanceof T.Mesh)this.armGeometry.push(o.geometry);});
 }
 private async load(){const loader=new GLTFLoader();await Promise.all((['static','heart','bass'] as Kind[]).map(async kind=>{const gltf=await loader.loadAsync('./belle/cameras/'+kind+'.glb');gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.frustumCulled=false;}});applyRealisticMaterials(gltf.scene);this.models.set(kind,gltf.scene);}));this.equip();}
 private equip(){if(this.body)this.body.removeFromParent();const source=this.models.get(this.kind);if(!source)return;this.body=source.clone(true);this.body.position.set(.12,-.08,-.72);this.body.rotation.y=Math.PI;this.rig.add(this.body);this.lcd.mount(this.body,this.kind);this.makeLens();this.carried.clear();const carried=source.clone(true);carried.scale.setScalar(.72);this.carried.add(carried);}
 private makeLens(){this.lens.removeFromParent();this.lens=new T.Group();this.lens.name=this.mm+' mm interchangeable lens';if(!this.body)return;const length=.035+(this.mm/135)*.14;const barrel=new T.Mesh(new T.CylinderGeometry(.052,.054,length,32),new T.MeshStandardMaterial({color:0x151a1d,roughness:.48,metalness:.55}));barrel.name='Lens barrel graphite';barrel.rotation.x=Math.PI/2;barrel.position.z=.26+length/2;this.lens.add(barrel);for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(.054,.0025,6,32),new T.MeshStandardMaterial({color:i===0?0xc8b57c:0x242b2c,roughness:.6,metalness:.6}));ring.position.z=.26+i*length/4;this.lens.add(ring);}const glass=new T.Mesh(new T.CircleGeometry(.048,32),new T.MeshStandardMaterial({color:0x193f4d,metalness:.8,roughness:.12}));glass.name='Lens optical glass';glass.position.z=.262+length;this.lens.add(glass);applyRealisticMaterials(this.lens);this.body.add(this.lens);}
 key(e:KeyboardEvent){if(e.code==='KeyP'&&!e.repeat){e.preventDefault();this.capture.setActive(!this.active);return true;}if(!this.active)return false;if(e.code==='Escape'){this.capture.setActive(false);return true;}if(['Equal','NumpadAdd','BracketRight'].includes(e.code)){e.preventDefault();this.capture.setZoom(this.capture.zoom+.1);}if(['Minus','NumpadSubtract','BracketLeft'].includes(e.code)){e.preventDefault();this.capture.setZoom(this.capture.zoom-.1);}if(e.code==='Space'&&!e.repeat){e.preventDefault();this.capture.shutter();}if(e.code==='KeyR'&&!e.repeat){e.preventDefault();this.capture.toggleRecording();}return true;}
 close(){if(this.active)this.capture.setActive(false);}
 update(camera:T.PerspectiveCamera,available:boolean,hero:T.Object3D,now:number){
  this.capture.update(available);this.rig.visible=this.active&&!this.capture.finder;this.carried.visible=!this.active&&available&&hero.visible&&(()=>{let o:T.Object3D|null=hero;while(o){if(!o.visible)return false;o=o.parent;}return true;})();
  if(this.carried.visible){hero.updateWorldMatrix(true,true);const hand=hero.getObjectByName('RightHand')??hero.getObjectByName('Hand_R');if(hand){this.carried.position.copy(hand.getWorldPosition(new T.Vector3()));this.carried.quaternion.copy(hero.getWorldQuaternion(new T.Quaternion()));this.carried.position.y-=.08;}else this.carried.visible=false;}
  if(!this.active)return;
  if(hero.uuid!==this.actorId)this.prepareArms(hero);
  const frame=this.capture.frame();camera.fov=lensFov(this.mm,this.capture.zoom,this.canvas.height,this.capture.finder?frame.h:this.canvas.height);camera.updateProjectionMatrix();
  this.rig.position.copy(camera.position);this.rig.quaternion.copy(camera.quaternion);const compact=Math.min(1,Math.max(.6,camera.aspect/.9));this.rig.scale.set(compact,compact,1);if(compact<1)this.rig.position.add(new T.Vector3(-.07,0,0).applyQuaternion(camera.quaternion));this.overlay.position.copy(camera.position);this.overlay.quaternion.copy(camera.quaternion);this.overlay.aspect=camera.aspect;this.overlay.updateProjectionMatrix();
  for(const r of this.rests){r.o.position.copy(r.p);r.o.quaternion.copy(r.q);}this.rig.updateMatrixWorld(true);
  for(const [i,arm]of this.limbs.entries()){const local=new T.Vector3(i===0?-.025:.245,-.13,i===0?-.86:-.68);const target=this.rig.localToWorld(local),hint=new T.Vector3(i===0?-.5:.5,-1,0).applyQuaternion(camera.quaternion);const shoulder=arm.upper.getWorldPosition(new T.Vector3()),elbow=arm.knee.getWorldPosition(new T.Vector3()),wrist=arm.foot.getWorldPosition(new T.Vector3()),length=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist);const offset=new T.Vector3(i===0?-.45:.45,-.94,.25).normalize().multiplyScalar(length*.94).applyQuaternion(camera.quaternion);arm.upper.position.copy(arm.upper.parent!.worldToLocal(target.clone().add(offset)));arm.upper.updateWorldMatrix(true,true);solveLimb(arm,target,hint);}
  this.rig.updateMatrixWorld(true);
 }
 render(renderer:T.WebGLRenderer,camera:T.Camera,now:number){const exposure=renderer.toneMappingExposure;try{renderer.toneMappingExposure=exposure*exposureScale(this.capture.exposure);this.lcd.render(renderer,this.scene,camera,this.rig,now,false,()=>this.capture.afterRender(now),this.overlay);}finally{renderer.toneMappingExposure=exposure;}}
}
/** Mix only game output tracks, never a microphone. */
export function mixGameAudio(feeds:(AudioFeed|undefined)[]):AudioFeed|undefined{const active=feeds.filter((f):f is AudioFeed=>!!f);if(!active.length)return;const context=new AudioContext(),out=context.createMediaStreamDestination();const sources=active.map(f=>{const s=context.createMediaStreamSource(f.stream);s.connect(out);return s;});void context.resume();return{stream:out.stream,release:()=>{sources.forEach(s=>s.disconnect());active.forEach(f=>f.release());out.stream.getTracks().forEach(t=>t.stop());void context.close();}};}
