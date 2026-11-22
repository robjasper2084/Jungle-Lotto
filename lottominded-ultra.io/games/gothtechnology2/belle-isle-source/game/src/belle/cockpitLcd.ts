import {cockpitScale} from './cinematicPolicy.ts';
import type {CockpitRadio,CockpitRadioAction} from './cockpitRadio.ts';
import * as T from 'three';
import {cockpitTelemetry,jarvsLcdReading,type CockpitInput} from './cockpitTelemetry.ts';
/** Physical cockpit instrument; one small unlit texture, refreshed at HUD rate. */
export class CockpitLcd{
 readonly root=new T.Group();private radio?:CockpitRadio;private view?:T.Camera;private interactive=false;private panel!:T.Mesh;private ray=new T.Raycaster();private pointer=new T.Vector2();private pressed=-1;
 private access?:HTMLElement;private screenToggle?:HTMLButtonElement;private lcdPage:'jarvs'|'radio'='jarvs';private lastInput?:CockpitInput;private brackets=new T.Group();private canvas=document.createElement('canvas');private context:CanvasRenderingContext2D;private texture:T.CanvasTexture;
 private notifiedPaint?:readonly unknown[];private paintGeneration=0;private contextLost=false;private fonts?:FontFaceSet;private reuseSupported=false;
 private updateCalls=0;private completedPaints=0;private textureUpdateRequests=0;private reusedUpdates=0;private invalidations=0;
 constructor(parent:T.Object3D){
  this.root.name='Hoverbike LCD dashboard';this.canvas.width=512;this.canvas.height=384;this.context=this.canvas.getContext('2d')!;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.minFilter=T.LinearFilter;this.texture.generateMipmaps=false;
  const housing=new T.Mesh(new T.BoxGeometry(.48,.367,.035),new T.MeshStandardMaterial({color:0x11191c,roughness:.53,metalness:.45}));const panel=new T.Mesh(new T.PlaneGeometry(.444,.333),new T.MeshBasicMaterial({map:this.texture,toneMapped:false}));this.panel=panel;panel.position.z=.019;panel.name='Speed altitude heading display';this.root.add(housing,panel);
  this.root.position.set(0,1.57,.50);this.root.rotation.set(-Math.atan2(.55,.84),Math.PI,0,'YXZ');parent.add(this.root);
  const bracketMaterial=new T.MeshStandardMaterial({color:0x1c252b,metalness:.68,roughness:.42});
  parent.add(this.brackets);
  for(const x of[-.12,.12]){const a=new T.Vector3(x,1.23,.20),b=new T.Vector3(x,1.48,.44),delta=b.clone().sub(a);const bracket=new T.Mesh(new T.CylinderGeometry(.016,.016,delta.length(),8),bracketMaterial);bracket.name='Dashboard support bracket';bracket.position.copy(a).add(b).multiplyScalar(.5);bracket.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());this.brackets.add(bracket);}
  this.observePaintLifecycle();
 }
 /** Lifetime CPU-side counts; notifications are not driver uploads or GPU work.
  * Every update still paints. Reused updates omit only a duplicate notification.
  * Invalidations count lifecycle/failure requests, including an empty cache. */
 get diagnostics(){return Object.freeze({source:'hoverbike-lcd' as const,updateCalls:this.updateCalls,completedPaints:this.completedPaints,textureUpdateRequests:this.textureUpdateRequests,reusedUpdates:this.reusedUpdates,invalidations:this.invalidations,reuseSupported:this.reuseSupported});}
 private invalidatePaint(){this.notifiedPaint=undefined;this.paintGeneration++;this.invalidations++;}
 private observePaintLifecycle(){
  // Optional platform APIs never become a requirement for drawing the display.
  // Without font monitoring, retain the original notification on every paint.
  try{
   if(typeof this.canvas.addEventListener!=='function')return;
   this.canvas.addEventListener('contextlost',()=>{this.contextLost=true;this.invalidatePaint();});
   this.canvas.addEventListener('contextrestored',()=>{this.contextLost=false;this.invalidatePaint();});
   const fonts=document.fonts;if(!fonts||typeof fonts.addEventListener!=='function')return;
   for(const event of ['loading','loadingdone','loadingerror'])fonts.addEventListener(event,()=>this.invalidatePaint());
   const ready=fonts.ready;if(ready&&typeof ready.then==='function')void ready.then(()=>this.invalidatePaint(),()=>this.invalidatePaint());
   this.fonts=fonts;this.reuseSupported=true;
  }catch{this.reuseSupported=false;}
 }
 private reusableSurface(){
  try{return this.reuseSupported&&!this.contextLost&&this.fonts?.status==='loaded'&&!(typeof this.context.isContextLost==='function'&&this.context.isContextLost());}
  catch{return false;}
 }
 private paintEnvironment(){
  // These reads are optional optimization probes, never prerequisites to paint.
  try{
   const c=this.context;if(typeof c.getTransform!=='function'||typeof c.getLineDash!=='function')return;
   const m=c.getTransform(),dash=c.getLineDash();
   const key=[c.textAlign,c.textBaseline,c.direction,c.globalAlpha,c.globalCompositeOperation,c.filter,c.shadowColor,c.shadowBlur,c.shadowOffsetX,c.shadowOffsetY,c.fontKerning,c.fontStretch,c.fontVariantCaps,c.letterSpacing,c.wordSpacing,c.lineCap,c.lineJoin,c.miterLimit,c.lineDashOffset,
    dash.length,...dash,m.a,m.b,m.c,m.d,m.e,m.f,this.canvas.width,this.canvas.height];
   // Equal commands need an opaque full-surface reset to be idempotent. This
   // private context never clips; arbitrary external context mutation is not owned here.
   const overwrites=this.canvas.width===512&&this.canvas.height===384&&c.globalAlpha===1&&c.globalCompositeOperation==='source-over'&&(c.filter===undefined||c.filter==='none')&&m.a===1&&m.b===0&&m.c===0&&m.d===1&&m.e===0&&m.f===0;
   return{key,overwrites};
  }catch{return;}
 }
 connectRadio(radio:CockpitRadio,canvas:HTMLCanvasElement){this.radio=radio;
  const access=this.access=document.createElement('nav');access.className='cockpit-radio-access';access.setAttribute('aria-label','Cockpit radio and JARVS controls');access.hidden=true;
  const actions:CockpitRadioAction[]=['previous','toggle','next','quieter','louder','library'];
  ['Previous track','Play or pause','Next track','Volume down','Volume up','Music library'].forEach((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=e=>{e.stopPropagation();radio.command(actions[i]);};access.append(b);});
  const toggle=this.screenToggle=document.createElement('button');toggle.type='button';toggle.textContent='Show radio display';toggle.setAttribute('aria-label','Switch between JARVS and radio LCD readouts');toggle.onclick=e=>{e.stopPropagation();this.togglePage();};access.append(toggle);document.body.append(access);
  const hit=(e:PointerEvent)=>{if(!this.interactive||!this.root.visible||!this.view||e.target!==canvas)return -1;const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.view);const uv=this.ray.intersectObject(this.panel,false)[0]?.uv;if(!uv)return -1;const x=uv.x*512,y=(1-uv.y)*384;if(y<312||y>370||x<18||x>=490)return -1;return Math.min(6,Math.floor((x-18)/68));};
  document.addEventListener('pointerdown',e=>{const i=hit(e);if(i<0)return;this.pressed=i;e.preventDefault();e.stopImmediatePropagation();},true);
  document.addEventListener('pointerup',e=>{if(this.pressed<0)return;const i=hit(e),pressed=this.pressed;this.pressed=-1;e.preventDefault();e.stopImmediatePropagation();if(i===pressed){if(i===6)this.togglePage();else radio.command((['previous','toggle','next','quieter','louder','library'] as CockpitRadioAction[])[i]);}},true);
  document.addEventListener('pointercancel',()=>{this.pressed=-1;},true);
 }
 private togglePage(){this.lcdPage=this.lcdPage==='jarvs'?'radio':'jarvs';if(this.screenToggle)this.screenToggle.textContent=this.lcdPage==='jarvs'?'Show radio display':'Show JARVS display';if(this.lastInput)this.update(this.lastInput);}
 setInteraction(camera:T.Camera,enabled:boolean){const scale=cockpitScale(document.body.dataset.cockpitDensity==='compact',innerWidth);if(this.root.scale.x!==scale)this.root.scale.setScalar(scale);this.view=camera;this.interactive=enabled;if(this.access)this.access.hidden=!enabled;}
 setVisible(visible:boolean){this.root.visible=visible;this.brackets.visible=visible;}
 update(input:CockpitInput){
  this.updateCalls++;this.lastInput=input;const previous=this.notifiedPaint,generation=this.paintGeneration;this.notifiedPaint=undefined;
  try{
  const p=cockpitTelemetry(input),c=this.context;
  // The first logo uses the entry alignment (initially "start", later "left").
  // Other untouched Canvas2D state is included without changing its semantics.
  const environment=this.paintEnvironment();
  c.fillStyle='#071a20';c.fillRect(0,0,512,384);
  c.strokeStyle='#35606c';c.lineWidth=2;c.strokeRect(8,8,496,368);c.fillStyle='#7bc9d7';c.font='bold 19px monospace';c.fillText('SWOOP / 2084',24,37);c.textAlign='right';c.fillStyle=p.warning?'#ffb36d':'#a5ecbc';c.fillText(p.warning||p.mode,488,37);c.textAlign='left';
  const avionics=jarvsLcdReading(input.jarvs);
  c.textAlign='right';c.font='bold 12px monospace';
  c.fillStyle=avionics.status==='CRITICAL'?'#ffab85':avionics.status==='CAUTION'?'#ffd783':'#9ceaca';
  c.fillText('JARVS '+avionics.status,486,58);c.textAlign='left';
  c.fillStyle='#edfaf8';c.font='bold 99px monospace';c.fillText(String(p.speed).padStart(2,'0'),22,143);c.font='17px monospace';c.fillStyle='#87b9c6';c.fillText('MPH',30,168);
  c.fillStyle='#edfaf8';c.font='bold 37px monospace';c.fillText(p.height+' m',282,104);c.font='15px monospace';c.fillStyle='#87b9c6';c.fillText('ABOVE GROUND',284,128);c.fillStyle='#d5efea';c.font='bold 26px monospace';c.fillText(p.compass+' '+String(p.bearing).padStart(3,'0')+'°',282,173);
  c.fillStyle='#163c45';c.fillRect(23,188,466,2);c.font='18px monospace';c.fillStyle=p.lights?'#87dfec':'#789398';c.fillText('GEAR '+p.gear,24,218);c.fillStyle='#365059';c.fillRect(24,231,150,6);c.fillStyle='#7ee3cb';c.fillRect(24,231,150*p.throttle,6);c.textAlign='right';c.fillStyle='#d4dbc0';const driveLabel=p.driveState==='DRIVE'?(input.boost?'BOOST':(p.lights?'LIGHTS ON':'LIGHTS OFF')):p.driveState;c.fillText(driveLabel,486,224);c.textAlign='left';const radio=this.radio?.snapshot();
  c.fillStyle='#163c45';c.fillRect(23,244,466,2);
  const page=this.lcdPage;let radioStatus:string|undefined,radioTitle:string|undefined;
  if(page==='jarvs'){
   const tone=avionics.status==='CRITICAL'?'#ffab85':avionics.status==='CAUTION'?'#ffd783':'#9ceaca';
   c.fillStyle=tone;c.fillRect(23,245,466*avionics.risk,3);
   c.font='bold 15px monospace';c.fillStyle=tone;c.fillText('JARVS / '+avionics.status,24,265);
   c.textAlign='right';c.font='13px monospace';c.fillStyle='#87b9c6';c.fillText(avionics.cells,488,265);c.textAlign='left';
   c.fillStyle='#e0f3ed';c.font='bold 16px monospace';c.fillText(avionics.radar,24,286);
   c.textAlign='right';c.font='15px monospace';c.fillText(avionics.terrain,488,286);c.textAlign='left';
   c.font='13px monospace';c.fillStyle=tone;c.fillText(avionics.advice,24,305,335);
   c.textAlign='right';c.font='bold 12px monospace';c.fillStyle='#b5ddc7';c.fillText(avionics.assist,488,305);c.textAlign='left';
  }else{
   c.font='bold 15px monospace';c.fillStyle='#84cad1';c.fillText('RIDE RADIO',24,269);c.textAlign='right';radioStatus=radio?.playing?'PLAYING':'STANDBY';c.fillText(radioStatus,488,269);c.textAlign='left';c.fillStyle='#edf4ed';c.font='19px monospace';radioTitle=(radio?.title||'Add your soundtrack').slice(0,32);c.fillText(radioTitle,24,299);
  }
  const playLabel=radio?.playing?'PAUSE':'PLAY',pageLabel=this.lcdPage==='jarvs'?'RADIO':'JARVS';
  const labels=['PREV',playLabel,'NEXT','VOL -','VOL +','MUSIC',pageLabel];
  for(let i=0;i<labels.length;i++){const x=18+i*68;c.fillStyle=i===6?'#23565b':'#122e36';c.fillRect(x,316,64,47);c.strokeStyle='#3d7078';c.strokeRect(x,316,64,47);c.fillStyle='#e9f4e8';c.font='bold 12px monospace';c.textAlign='center';c.fillText(labels[i],x+32,344);}c.textAlign='left';
  this.completedPaints++;
  const key=[...(environment?.key??[]),!!p.warning,p.warning||p.mode,avionics.status,String(p.speed).padStart(2,'0'),p.height,p.compass,String(p.bearing).padStart(3,'0'),p.lights,p.gear,150*p.throttle,driveLabel,page,playLabel,pageLabel,
   ...(page==='jarvs'?[466*avionics.risk,avionics.cells,avionics.radar,avionics.terrain,avionics.advice,avionics.assist]:[radioStatus,radioTitle])];
  const reusable=environment?.overwrites===true&&this.reusableSurface()&&key.every(value=>value===null||(typeof value!=='object'&&typeof value!=='function'))&&generation===this.paintGeneration;
  if(reusable&&previous&&previous.length===key.length&&key.every((value,i)=>Object.is(value,previous[i])))this.reusedUpdates++;
  else{this.texture.needsUpdate=true;this.textureUpdateRequests++;}
  if(reusable&&generation===this.paintGeneration)this.notifiedPaint=key;
  }catch(error){this.invalidatePaint();throw error;}
 }
}
