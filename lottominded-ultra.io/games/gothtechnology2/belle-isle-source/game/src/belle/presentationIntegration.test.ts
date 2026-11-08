import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {WorldAtmosphere} from './worldAtmosphere.ts';import {SkyReflections} from './skyReflections.ts';import {SkyAircraft} from './skyAircraft.ts';
import {installRiderPresentation,presentRider} from '../../runtime/elmwood-source/src/detroit/riding/riderPresentation.ts';
import type {RiderMotionTarget} from '../../runtime/elmwood-source/src/detroit/riding/riderMotion.ts';
import type {RidePose} from '@digital-static/ridecore';
function materialShader(){return {vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];}
test('actual Three standard shader composition preserves earlier material work',()=>{
 const scene=new T.Scene(),m=new T.MeshStandardMaterial();m.onBeforeCompile=s=>{s.fragmentShader='// earlier material\n'+s.fragmentShader;};m.customProgramCacheKey=()=> 'original';
 scene.add(new T.Mesh(new T.BoxGeometry(),m));const a=new WorldAtmosphere(scene,new T.Texture());a.flush();const s=materialShader();m.onBeforeCompile(s,{} as T.WebGLRenderer);
 assert.match(s.fragmentShader,/earlier material/);assert.match(s.fragmentShader,/directLight.color\*=belleCloudShade/);assert.match(s.fragmentShader,/belleDensity/);assert.ok(m.customProgramCacheKey().startsWith('original'));
 a.flush();const t=materialShader();m.onBeforeCompile(t,{} as T.WebGLRenderer);assert.equal((t.vertexShader.match(/varying vec3 belleAtmosphereWorld;/g)||[]).length,1);
 a.dispose();assert.equal(m.customProgramCacheKey(),'original');
});
test('added actors acquire local wind materials and matching shadow deformation',async()=>{
 const scene=new T.Scene(),a=new WorldAtmosphere(scene,new T.Texture()),original=new T.MeshStandardMaterial({name:'cloth'}),mesh=new T.Mesh(new T.BoxGeometry(),original);mesh.name='Hero_Dreadlocks';scene.add(mesh);await Promise.resolve();
 assert.notEqual(mesh.material,original);assert.equal(a.stats.windMeshes,1);assert.ok(mesh.customDepthMaterial&&mesh.customDistanceMaterial);
 const s=materialShader();(mesh.material as T.Material).onBeforeCompile(s,{} as T.WebGLRenderer);assert.match(s.vertexShader,/belleWindRange/);
 const depth={vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];mesh.customDepthMaterial!.onBeforeCompile(depth,{} as T.WebGLRenderer);assert.match(depth.vertexShader,/belleWindRange/);
 a.update(2,new T.Vector3(0,1,0),.6,1,.1,'high',true,false);assert.equal(s.uniforms.belleWindAmount.value,0);
 a.dispose();assert.equal(mesh.material,original);assert.equal(mesh.customDepthMaterial,undefined);
});
test('rigid meshes and pre-existing custom shadow contracts are not replaced',()=>{
 const scene=new T.Scene(),m=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),m);mesh.name='Hero_Body';mesh.customDepthMaterial=new T.MeshDepthMaterial();scene.add(mesh);const a=new WorldAtmosphere(scene,new T.Texture());a.flush();assert.equal(mesh.material,m);assert.equal(a.stats.windMeshes,0);a.dispose();
});
test('rider presentation cleanup supports nested applications and out-of-order disposal',()=>{
 const t={pitch:1} as RiderMotionTarget,p={} as RidePose;const a=installRiderPresentation(m=>m.pitch=2),b=installRiderPresentation(m=>m.pitch=3);a();presentRider(t,p);assert.equal(t.pitch,3);b();t.pitch=1;presentRider(t,p);assert.equal(t.pitch,1);b();
});
test('aircraft uses bounded geometry and hides with its quality/comfort switch',()=>{
 const scene=new T.Scene(),aircraft=new SkyAircraft(scene);aircraft.update(80,1,true);assert.equal(scene.children[0].visible,true);aircraft.update(80,1,false);assert.equal(scene.children[0].visible,false);aircraft.dispose();assert.equal(scene.children.length,0);
});
test('reflection source is isolated and restores render state even on a failure',()=>{
 const listeners=new Map<string,unknown>(),scene=new T.Scene(),fallback=new T.Texture();scene.environment=fallback;const target=new T.WebGLRenderTarget();let actual:T.WebGLRenderTarget|null=target,restored=false;
 const renderer={xr:{enabled:true,isPresenting:false},toneMapping:T.ACESFilmicToneMapping,autoClear:false,
  domElement:{addEventListener:(n:string,f:unknown)=>listeners.set(n,f),removeEventListener:(n:string)=>listeners.delete(n)},getContext:()=>({isContextLost:()=>false}),getRenderTarget:()=>actual,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>0,
  getViewport:(v:T.Vector4)=>v.set(0,0,640,480),getScissor:(v:T.Vector4)=>v.set(1,2,3,4),getScissorTest:()=>true,getClearColor:(c:T.Color)=>c.set('#123456'),getClearAlpha:()=>.5,
  setRenderTarget:(t:T.WebGLRenderTarget|null)=>{actual=t;restored=t===target;},setViewport:()=>{},setScissor:()=>{},setScissorTest:()=>{},setClearColor:()=>{}} as unknown as T.WebGLRenderer;
 const sky=new T.ShaderMaterial({vertexShader:'void main(){}',fragmentShader:'void main(){}'}),r=new SkyReflections(scene,renderer,sky);
 const internals=r as unknown as {generator:{fromScene:()=>T.WebGLRenderTarget;dispose:()=>void}};internals.generator.fromScene=()=>{actual=null;throw Error('simulated renderer failure');};internals.generator.dispose=()=>{};
 const warn=console.warn;console.warn=()=>{};try{r.update(3,12,.6,'automatic',true);}finally{console.warn=warn;}
 assert.ok(restored);assert.equal(scene.environment,fallback);assert.equal(renderer.xr.enabled,true);assert.equal(r.stats.disabled,true);r.dispose();assert.equal(listeners.size,0);
});
