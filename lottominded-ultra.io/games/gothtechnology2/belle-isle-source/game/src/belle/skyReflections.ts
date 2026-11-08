import * as T from 'three';
import {presentationBudget,reflectionRequired} from './presentationPolicy.ts';
/** A small, sky-only probe. Never captures the player, world or UI recursively. */
export class SkyReflections {
 private scene:T.Scene;private renderer:T.WebGLRenderer;private generator:T.PMREMGenerator;
 private probeScene=new T.Scene();private probe:T.Mesh<T.SphereGeometry,T.ShaderMaterial>;
 private target:T.WebGLRenderTarget|undefined;private fallback:T.Texture|null;
 private last=-Infinity;private lastHour=0;private lastCoverage=0;private disabled=false;private disposed=false;
 private lastCost=0;private captures=0;
 constructor(scene:T.Scene,renderer:T.WebGLRenderer,source:T.ShaderMaterial){
  this.scene=scene;this.renderer=renderer;this.fallback=scene.environment;this.generator=new T.PMREMGenerator(renderer);
  const material=source.clone();material.uniforms=source.uniforms;material.toneMapped=false;material.fog=false;
  // Keep a dark ground hemisphere instead of reflecting a bright horizon below.
  material.fragmentShader=material.fragmentShader.replace('gl_FragColor=vec4(max(color,vec3(0.)),1.);','color=mix(vec3(.045,.055,.042)*(.18+.82*daylight),color,smoothstep(-.20,.015,d.y));\n gl_FragColor=vec4(max(color,vec3(0.)),1.);');
  this.probe=new T.Mesh(new T.SphereGeometry(10,16,12),material);this.probe.frustumCulled=false;this.probeScene.add(this.probe);
  renderer.domElement.addEventListener('webglcontextrestored',this.restored);
 }
 private restored=()=>{this.disabled=false;this.last=-Infinity;};
 update(clock:number,hour:number,coverage:number,quality:string,active:boolean){
  if(this.disposed||this.disabled||!active||this.renderer.xr.isPresenting||this.renderer.getContext().isContextLost())return;
  const budget=presentationBudget(quality),interval=this.lastCost>40?Math.max(120,budget.reflectionInterval):budget.reflectionInterval;
  if(!reflectionRequired(clock,this.last,hour,this.lastHour,coverage,this.lastCoverage,interval))return;
  const renderer=this.renderer,oldTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const xr=renderer.xr.enabled,tone=renderer.toneMapping,autoClear=renderer.autoClear;
  const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest();
  const clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),begin=performance.now();
  try{
   const next=this.generator.fromScene(this.probeScene,0,.1,100,{size:budget.reflectionSize});
   const previous=this.target;this.target=next;this.scene.environment=next.texture;previous?.dispose();
   this.last=clock;this.lastHour=hour;this.lastCoverage=coverage;this.captures++;
  }catch(error){this.disabled=true;console.warn('Dynamic sky reflections unavailable; keeping the last valid environment.',error);}
  finally{
   this.lastCost=performance.now()-begin;
   renderer.setRenderTarget(oldTarget,face,mip);renderer.xr.enabled=xr;renderer.toneMapping=tone;renderer.autoClear=autoClear;
   renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);
  }
 }
 get stats(){return{captures:this.captures,captureCpuMs:this.lastCost,usingFallback:!this.target,disabled:this.disabled};}
 dispose(){if(this.disposed)return;this.disposed=true;this.renderer.domElement.removeEventListener('webglcontextrestored',this.restored);if(this.scene.environment===this.target?.texture)this.scene.environment=this.fallback;this.target?.dispose();this.generator.dispose();this.probe.geometry.dispose();this.probe.material.dispose();}
}
