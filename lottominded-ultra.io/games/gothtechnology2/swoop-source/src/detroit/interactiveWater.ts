import * as T from 'three';
import {createWaterGpu} from './waterGpu.ts';
import {fillRippleField,WATER_GRID,WATER_SPAN,WATER_EVENTS,WATER_LIFE,type WaterImpulse} from './waterRipples.ts';
const key='digital-static-interactive-water';
export class InteractiveWater{
 private surfaces:{mesh:T.Mesh;box:T.Box3}[]=[];private materials=new Set<T.Material>();
 private bytes=new Uint8Array(WATER_GRID*WATER_GRID*4);private texture=new T.DataTexture(this.bytes,WATER_GRID,WATER_GRID,T.RGBAFormat);
 private field={value:new T.Vector4(0,0,0,0)};private sampler:{value:T.DataTexture};
 private events:WaterImpulse[]=[];private center=new T.Vector3();private ray=new T.Raycaster();private point=new T.Vector2();private previous:T.Vector3|undefined;
 private gpu:Awaited<ReturnType<typeof createWaterGpu>>=null;private requested=false;private busy=false;private disposed=false;private next=0;private contactAt=0;private generation=0;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');private mode='auto';private backendEpoch=0;
 private reducedOverride=new URLSearchParams(location.search).has('reducedMotion');
 constructor(private canvas:HTMLCanvasElement,private camera:T.Camera){
  this.sampler={value:this.texture};fillRippleField(this.bytes,0,0,0,[]);this.texture.minFilter=this.texture.magFilter=T.LinearFilter;this.texture.generateMipmaps=false;this.texture.needsUpdate=true;this.texture.name='Interactive water normal field';
  try{this.mode=localStorage.getItem(key)??'auto';}catch{}this.mode=['auto','fallback','off'].includes(this.mode)?this.mode:'auto';
  canvas.addEventListener('pointerdown',this.poke);window.addEventListener('pagehide',this.hide);this.report();
 }
 private report(){this.canvas.dataset.waterBackend=this.mode==='off'?'off':this.gpu?'webgpu':this.requested?'compatible':'ready';this.canvas.dataset.waterSurfaces=String(this.surfaces.length);}
 register(root:T.Object3D){
  root.updateWorldMatrix(true,true);root.traverse(o=>{
   if(!(o instanceof T.Mesh)||Array.isArray(o.material)||!(/water/i.test(o.material.name)||o.material.userData.elmwoodWater))return;
   const mesh=o as T.Mesh;this.surfaces.push({mesh,box:new T.Box3().setFromObject(mesh)});
   if(this.materials.has(mesh.material as T.Material))return;this.materials.add(mesh.material as T.Material);
   const material=mesh.material as T.Material,before=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
   material.onBeforeCompile=(s,r)=>{
    before.call(material,s,r);s.uniforms.iwField=this.field;s.uniforms.iwTexture=this.sampler;
    s.vertexShader='varying vec3 iwWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\niwWorld=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader='varying vec3 iwWorld;uniform vec4 iwField;uniform sampler2D iwTexture;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`vec2 iwUV=(iwWorld.xz-iwField.xy)/${WATER_SPAN}.0+.5;
     if(iwField.w>.5&&abs(iwWorld.y-iwField.z)<.5&&all(greaterThan(iwUV,vec2(0.)))&&all(lessThan(iwUV,vec2(1.)))){
      vec3 iwSample=texture2D(iwTexture,iwUV).rgb;vec2 iwSlope=(iwSample.rg*255.-128.)/127.;
      normal=normalize(normal-mat3(viewMatrix)*vec3(iwSlope.x,0.,iwSlope.y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.79,.76),iwSample.b*.6);
      #ifdef USE_CLEARCOAT
      clearcoatNormal=normal;
      #endif
     }\n#include <lights_physical_fragment>`);
   };material.customProgramCacheKey=()=>cache()+'-interactive-water-1';material.needsUpdate=true;
  });this.report();
 }
 settings(parent:HTMLElement){
  const label=document.createElement('label');label.className='interactive-water-setting';label.textContent='Interactive water';const select=document.createElement('select');select.setAttribute('aria-label','Interactive water');
  for(const [value,text]of [['auto','Auto · WebGPU when available'],['fallback','Compatible · light ripples'],['off','Off · ambient water only']])select.add(new Option(text,value));select.value=this.mode;
  select.onchange=()=>{this.mode=select.value;try{localStorage.setItem(key,this.mode);}catch{}this.events=[];this.field.value.w=0;this.generation++;this.backendEpoch++;this.gpu?.dispose();this.gpu=null;this.requested=false;this.report();};label.append(select);parent.append(label);
 }
 private disabled(){return this.mode==='off'||this.reduced.matches||document.documentElement.dataset.reducedMotion==='true'||this.reducedOverride||document.hidden;}
 private visible(mesh:T.Object3D){for(let p:T.Object3D|null=mesh;p;p=p.parent)if(!p.visible)return false;return true;}
 private poke=(e:PointerEvent)=>{
  if(e.button!==0||this.disabled()||document.querySelector('dialog[open]')||document.querySelector<HTMLElement>('#menu:not([hidden])')?.getBoundingClientRect().width)return;
  const rect=this.canvas.getBoundingClientRect();this.point.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);this.ray.setFromCamera(this.point,this.camera as T.PerspectiveCamera);this.ray.far=90;
  const hit=this.ray.intersectObjects(this.surfaces.filter(s=>this.visible(s.mesh)).map(s=>s.mesh),false)[0];if(hit)this.impulse(hit.point,1);
 };
 impulse(p:{x:number;y:number;z:number},strength=.7){
  if(this.disabled())return;const time=performance.now()/1000;
  if(Math.hypot(p.x-this.center.x,p.z-this.center.z)>WATER_SPAN*.3||Math.abs(p.y-this.center.y)>.5){this.center.set(p.x,p.y,p.z);this.events=[];this.generation++;this.field.value.w=0;}
  this.events.push({x:p.x,z:p.z,time,strength:Math.min(1,Math.max(0,strength))});if(this.events.length>WATER_EVENTS)this.events.shift();this.canvas.dataset.waterInteractions=String(Number(this.canvas.dataset.waterInteractions??0)+1);
  if(!this.requested&&this.mode==='auto'){this.requested=true;const epoch=++this.backendEpoch;void createWaterGpu(()=>{this.gpu?.dispose();this.gpu=null;this.report();}).then(gpu=>{if(this.disposed||this.mode!=='auto'||epoch!==this.backendEpoch){gpu?.dispose();return;}this.gpu=gpu;this.report();}).catch(()=>this.report());}else if(this.mode==='fallback')this.requested=true;
 }
 update(actor?:{x:number;y:number;z:number},paused=false){
  const now=performance.now()/1000;if(this.disabled()||paused){this.field.value.w=0;this.previous=undefined;return;}
  if(actor&&now>=this.contactAt){this.contactAt=now+.16;const distance=this.previous?Math.hypot(actor.x-this.previous.x,actor.z-this.previous.z):0;
   if(!this.previous||distance>.3){this.previous=new T.Vector3(actor.x,actor.y,actor.z);const candidates=this.surfaces.filter(s=>actor.x>=s.box.min.x&&actor.x<=s.box.max.x&&actor.z>=s.box.min.z&&actor.z<=s.box.max.z&&Math.abs(actor.y-s.box.max.y)<1.3&&this.visible(s.mesh));
    if(candidates.length){this.ray.set(new T.Vector3(actor.x,actor.y+1,actor.z),new T.Vector3(0,-1,0));this.ray.far=2.3;const hit=this.ray.intersectObjects(candidates.map(s=>s.mesh),false)[0];if(hit&&Math.abs(actor.y-hit.point.y)<1.1)this.impulse(hit.point,Math.min(.85,.25+distance*.15));}
   }
  }
  this.events=this.events.filter(e=>now-e.time<WATER_LIFE);if(!this.events.length){this.field.value.w=0;return;}if(now<this.next||this.busy)return;this.next=now+(this.gpu ? .05 : .1);
  const generation=this.generation,c=this.center.clone(),started=performance.now(),complete=()=>{if(!this.disposed&&generation===this.generation){this.texture.needsUpdate=true;this.field.value.set(c.x,c.z,c.y,1);this.canvas.dataset.waterUpdateMs=(performance.now()-started).toFixed(2);}this.busy=false;};
  if(this.gpu){this.busy=true;void this.gpu.sample(c.x,c.z,now,this.events,this.bytes).then(complete).catch(()=>{this.gpu?.dispose();this.gpu=null;this.busy=false;this.report();});}
  else{fillRippleField(this.bytes,c.x,c.z,now,this.events);complete();}
 }
 private hide=(e:PageTransitionEvent)=>{if(!e.persisted)this.dispose();};
 dispose(){this.disposed=true;this.generation++;this.backendEpoch++;this.gpu?.dispose();this.texture.dispose();this.canvas.removeEventListener('pointerdown',this.poke);window.removeEventListener('pagehide',this.hide);}
}
