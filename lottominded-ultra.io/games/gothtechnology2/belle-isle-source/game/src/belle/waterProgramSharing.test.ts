import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {createWater} from './water.ts';
import {riverWaveGLSL} from './riverWaves.ts';
import {flatRiverPatchIndex,riverFarRing,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS} from './riverPatch.ts';
import type {ParkMap,ParkTerrain} from './terrain.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type WaterMesh=T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
function setup(){
 const scene=new T.Scene();
 const map={island:[],mainland:[],waterSources:[],water:[{
  name:'program fixture',points:[[20,20],[30,20],[30,30],[20,30],[20,20]],holes:[],
 }]} as unknown as ParkMap;
 const water=createWater(scene,{} as T.WebGLRenderer,map,{land:()=>false} as unknown as ParkTerrain,
  (_points,y)=>new T.PlaneGeometry(10,10).rotateX(-Math.PI/2).translate(25,y,25));
 const near=scene.getObjectByName('Detroit River rolling waves') as WaterMesh;
 const far=scene.getObjectByName('Detroit River distant water') as WaterMesh;
 const lagoon=scene.getObjectByName('Lagoon · program fixture') as WaterMesh;
 assert(near&&far&&lagoon);
 const compile=(mesh:WaterMesh)=>{
  const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}} as Shader;
  mesh.material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
 };
 const dispose=()=>{
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  scene.traverse(object=>{if(object instanceof T.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
 };
 return {scene,water,near,far,lagoon,compile,dispose};
}
function geometryBytes(geometry:T.BufferGeometry){
 const hash=createHash('sha256');
 for(const [name,attribute]of Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))){
  hash.update(JSON.stringify([name,attribute.itemSize,attribute.normalized,attribute.array.constructor.name]));
  hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
 }
 const index=geometry.getIndex();if(index)hash.update(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength));
 return hash.digest('hex');
}

test('actual connected river materials share both shader stages and keep independent displacement bindings',t=>{
 const f=setup();t.after(f.dispose);
 const near=f.compile(f.near),far=f.compile(f.far),lagoon=f.compile(f.lagoon);
 assert.equal(near.vertexShader,far.vertexShader);assert.equal(near.fragmentShader,far.fragmentShader);
 assert.equal(f.near.material.customProgramCacheKey(),f.far.material.customProgramCacheKey());
 assert.equal(near.uniforms.riverDisplacement.value,true);assert.equal(far.uniforms.riverDisplacement.value,false);
 assert.notEqual(near.uniforms.riverDisplacement,far.uniforms.riverDisplacement);
 assert(near.vertexShader.includes('transformed.y+=('+riverWaveGLSL+')*edge;'),'Original near-wave calculation is retained');
 assert.match(near.vertexShader,/if\(riverDisplacement\)\{\s*vec2 wp=/);
 assert.match(near.vertexShader,/smoothstep\(165\.,195\.,/);
 assert.equal(near.uniforms.detroitDry.value,far.uniforms.detroitDry.value,'The existing common district mask remains bound');
 assert.equal(near.uniforms.riverNormals.value,far.uniforms.riverNormals.value);
 assert.equal(f.lagoon.material.customProgramCacheKey(),'lagoon-reactive-water-multiscale-ring-v11');
 assert.equal(lagoon.uniforms.riverDisplacement,undefined);assert.doesNotMatch(lagoon.vertexShader,/riverDisplacement/);
 assert.notEqual(lagoon.fragmentShader,near.fragmentShader);assert(f.lagoon.material.clearcoat>0);
 near.uniforms.riverDisplacement.value=false;
 assert.equal(f.compile(f.near).uniforms.riverDisplacement.value,true,'Recompilation restores the authored near choice');
 far.uniforms.riverDisplacement.value=true;
 assert.equal(f.compile(f.far).uniforms.riverDisplacement.value,false,'Recompilation restores the authored far choice');
});

test('pinned native uniform upload alternates near and far without retaining the previous material choice',t=>{
 const f=setup();t.after(f.dispose);const near=f.compile(f.near),far=f.compile(f.far),writes:number[]=[];
 const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>1,
  getActiveUniform:()=>({name:'riverDisplacement',size:1,type:0x8b56}),getUniformLocation:()=>0,
  uniform1i:(_location:unknown,value:number)=>writes.push(Number(value))};
 const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
 const uniforms=new Uniforms(gl,{});
 for(const shader of [near,far,near,far,near])Uniforms.upload(gl,uniforms.seq,shader.uniforms,{});
 assert.deepEqual(writes,[1,0,1,0,1]);
});

test('installed Three program parameters permit one river program for each native output configuration',t=>{
 const f=setup();t.after(f.dispose);assert.equal(T.REVISION,'185');
 let target:T.WebGLRenderTarget|null=null;
 const renderer={getRenderTarget:()=>target,state:{buffers:{depth:{getReversed:()=>false}}},
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 // Use Three's actual key builder. No renderer/GL behavior is substituted or
 // counted as native linked-program evidence by this CPU compatibility check.
 const Programs=WebGLPrograms as unknown as (...args:unknown[])=>{
  getParameters:(material:T.Material,lights:unknown,shadows:T.Light[],scene:T.Scene,object:T.Object3D,grids:unknown[])=>unknown;
  getProgramCacheKey:(parameters:unknown)=>string;
 };
 const programs=Programs(renderer,{get:()=>null},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},null,{numPlanes:0,numIntersection:0});
 const lights=Object.fromEntries(['directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap'].map(name=>[name,[]]));
 Object.assign(lights,{numSpotLightShadowsWithMaps:0,numLightProbes:0});
 const offscreen=new T.WebGLRenderTarget(32,32);t.after(()=>offscreen.dispose());
 const key=(mesh:WaterMesh)=>programs.getProgramCacheKey(programs.getParameters(mesh.material,lights,[new T.DirectionalLight()],f.scene,mesh,[]));
 for(const output of [null,offscreen]){
  target=output;
  assert.equal(key(f.near),key(f.far));assert.notEqual(key(f.near),key(f.lagoon));
 }
});

test('river quality changes and updates retain original patch/ring geometry, placement, masking and order',t=>{
 const f=setup();t.after(f.dispose);
 const nearMaterial=f.near.material,farMaterial=f.far.material,nearIndex=f.near.geometry.getIndex();
 const nearBytes=geometryBytes(f.near.geometry),farBytes=geometryBytes(f.far.geometry);
 const expectedNear=new T.PlaneGeometry(RIVER_PATCH_SIZE,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS,RIVER_PATCH_SEGMENTS).rotateX(-Math.PI/2);
 t.after(()=>expectedNear.dispose());assert.equal(nearBytes,geometryBytes(expectedNear));
 const ring=riverFarRing();
 assert.deepEqual(Array.from(f.far.geometry.getAttribute('position').array),Array.from(new Float32Array(ring.positions)));
 assert.deepEqual(Array.from(f.far.geometry.getIndex()!.array),ring.indices);
 const order={near:f.near.renderOrder,far:f.far.renderOrder};assert.equal(order.near,order.far);
 f.water.setQuality('smooth');
 assert.equal(f.near.material,f.far.material);assert(f.near.material instanceof T.MeshBasicMaterial);
 assert.deepEqual(Array.from(f.near.geometry.getIndex()!.array),Array.from(flatRiverPatchIndex()));
 assert.equal(geometryBytes(f.far.geometry),farBytes);
 for(const quality of ['high','automatic']){
  f.water.setQuality(quality);assert.equal(f.near.material,nearMaterial);assert.equal(f.far.material,farMaterial);
  assert.equal(f.near.geometry.getIndex(),nearIndex);assert.equal(geometryBytes(f.near.geometry),nearBytes);assert.equal(geometryBytes(f.far.geometry),farBytes);
 }
 const camera=new T.PerspectiveCamera();camera.position.set(13,9,-27);
 f.water.update(12.5,camera);assert.deepEqual(f.near.position.toArray(),[14,0,-26]);assert(f.far.position.equals(f.near.position));
 assert.equal(f.compile(f.near).uniforms.riverTime.value,12.5);assert.equal(f.compile(f.near).uniforms.riverDisplacement.value,true);assert.equal(f.compile(f.far).uniforms.riverDisplacement.value,false);
 assert.deepEqual({near:f.near.renderOrder,far:f.far.renderOrder},order);
 assert.equal(geometryBytes(f.near.geometry),nearBytes);assert.equal(geometryBytes(f.far.geometry),farBytes);
});
