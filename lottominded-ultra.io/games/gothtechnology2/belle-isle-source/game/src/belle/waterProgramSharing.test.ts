import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {createWater} from './water.ts';
import {riverWaveGLSL,riverWaveHeight} from './riverWaves.ts';
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

test('actual connected river materials share the byte-identical original near shader and preserve lagoon state',t=>{
 const f=setup();t.after(f.dispose);
 const near=f.compile(f.near),far=f.compile(f.far),lagoon=f.compile(f.lagoon);
 assert.equal(near.vertexShader,far.vertexShader);assert.equal(near.fragmentShader,far.fragmentShader);
 assert.equal(f.near.material.customProgramCacheKey(),f.far.material.customProgramCacheKey());
 // SHA-256 of the actual e424aac64ad82f2448c11717c38c592d666c2af9
 // createWater near hook applied to the pinned r185 physical ShaderLib,
 // including the unchanged district-mask wrapper. This pins every source byte.
 assert.equal(T.REVISION,'185');
 assert.equal(createHash('sha256').update(near.vertexShader).digest('hex'),'7429edb753fea2bfd36ae798b5e046e92a6ae1e4544bdfecc93497d5c208db3c');
 assert.equal(createHash('sha256').update(near.fragmentShader).digest('hex'),'5f158bee5759641f0b75734efade43408f8847ec51353daaa70fbebf90a9e9d3');
 assert(near.vertexShader.includes('transformed.y+=('+riverWaveGLSL+')*edge;'),'Original near-wave calculation is retained');
 assert.equal(near.uniforms.riverDisplacement,undefined);assert.equal(far.uniforms.riverDisplacement,undefined);
 assert.doesNotMatch(near.vertexShader,/riverDisplacement/);
 assert.match(near.vertexShader,/smoothstep\(165\.,195\.,/);
 assert.equal(near.uniforms.detroitDry.value,far.uniforms.detroitDry.value,'The existing common district mask remains bound');
 assert.equal(near.uniforms.riverNormals.value,far.uniforms.riverNormals.value);
 assert.equal(near.uniforms.riverTime,far.uniforms.riverTime);assert.equal(near.uniforms.riverCentre,far.uniforms.riverCentre);
 assert.equal(f.lagoon.material.customProgramCacheKey(),'lagoon-reactive-water-multiscale-ring-v11');
 assert.doesNotMatch(lagoon.vertexShader,/riverDisplacement|transformed\.y\+=/);
 assert.notEqual(lagoon.fragmentShader,near.fragmentShader);assert(f.lagoon.material.clearcoat>0);
 assert.equal(f.compile(f.near).vertexShader,near.vertexShader);assert.equal(f.compile(f.far).vertexShader,far.vertexShader);
});

test('every actual far-ring vertex retains exactly zero wave displacement through camera translations',t=>{
 const f=setup();t.after(f.dispose);const shader=f.compile(f.far),camera=new T.PerspectiveCamera();
 const position=f.far.geometry.getAttribute('position'),before=geometryBytes(f.far.geometry);
 const cameras=[[0,0,0],[13.37,9,-27.23],[-3797.13,42,845.77],[1344.49,8,2876.5],[9000.25,11,-9000.75]];
 const vertex=new T.Vector3(),f32=Math.fround;let checked=0;
 for(const [i,coordinates]of cameras.entries()){
  camera.position.fromArray(coordinates);f.water.update([0,1.25,6.75,123.5,7200][i],camera);f.far.updateMatrixWorld(true);
  assert(f.far.position.equals(f.near.position));
  const centre=shader.uniforms.riverCentre.value as T.Vector2,time=shader.uniforms.riverTime.value as number;
  assert.deepEqual(centre.toArray(),[f.far.position.x,f.far.position.z]);
  for(let j=0;j<position.count;j++){
   vertex.fromBufferAttribute(position,j).applyMatrix4(f.far.matrixWorld);
   // Model translation and the shared centre are also checked at float32
   // precision. This is an envelope proof, not a simulation of GPU sin().
   const x=f32(vertex.x),z=f32(vertex.z),distance=Math.max(Math.abs(f32(x-f32(centre.x))),Math.abs(f32(z-f32(centre.y))));
   assert(distance>=200);const edge=1-T.MathUtils.smoothstep(distance,165,195);assert.equal(edge,0);
   assert.equal(position.getY(j),0);assert.equal(position.getY(j)+riverWaveHeight(x,z,time)*edge,0);checked++;
  }
 }
 assert.equal(checked,position.count*cameras.length);assert.equal(geometryBytes(f.far.geometry),before);
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
 assert.equal(f.compile(f.near).uniforms.riverTime.value,12.5);assert.equal(f.compile(f.far).uniforms.riverTime.value,12.5);
 assert.deepEqual(f.compile(f.far).uniforms.riverCentre.value.toArray(),[14,-26]);
 assert.deepEqual({near:f.near.renderOrder,far:f.far.renderOrder},order);
 assert.equal(geometryBytes(f.near.geometry),nearBytes);assert.equal(geometryBytes(f.far.geometry),farBytes);
});
