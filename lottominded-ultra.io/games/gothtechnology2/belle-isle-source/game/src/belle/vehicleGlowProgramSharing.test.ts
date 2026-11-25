import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {glowVehicle} from './referenceActors.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Halo=T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
const renderer={} as T.WebGLRenderer;
const compile=(material:T.Material)=>{
 const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as Shader;
 material.onBeforeCompile(shader,renderer);return shader;
};
function fixture(kind:'hover'|'wheel'){
 const root=new T.Group(),geometry=new T.BoxGeometry(.6,.3,.8);
 const sources=(kind==='hover'?['LED_Main_Front','LED_Main_Rear']:['Rim_Ring_1','CrashRail_-1']).map((name,i)=>{
  const material=new T.MeshStandardMaterial({color:0x324556,emissive:0x123456,emissiveIntensity:.5});
  const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(i-.5,.2,-.3);mesh.rotation.y=.4;mesh.scale.set(1,.8,1.2);root.add(mesh);return mesh;
 });
 const originalMaterials=sources.map(mesh=>mesh.material),decoy=new T.Mesh(geometry,new T.MeshStandardMaterial());decoy.name='Body';root.add(decoy);
 const transforms=sources.map(mesh=>[mesh.position.toArray(),mesh.quaternion.toArray(),mesh.scale.toArray()]);
 glowVehicle(root,kind);
 const halos=sources.flatMap(mesh=>mesh.children as Halo[]);
 return {root,sources,halos,decoy,geometry,originalMaterials,transforms,dispose(){
  const materials=new Set<T.Material>(originalMaterials);root.traverse(object=>{if(object instanceof T.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);});
  for(const material of materials)material.dispose();geometry.dispose();
 }};
}

test('real glow factory retains both shells, source geometry, native state and emissive controls for hover and wheel',t=>{
 for(const kind of ['hover','wheel'] as const){
  const row=fixture(kind);t.after(row.dispose);
  assert.equal(row.halos.length,4);assert.equal(row.decoy.children.length,0);assert.equal(new Set(row.halos.map(halo=>halo.material)).size,4);
  for(const [i,source]of row.sources.entries()){
   assert.deepEqual([source.position.toArray(),source.quaternion.toArray(),source.scale.toArray()],row.transforms[i]);
   assert.equal(source.geometry,row.geometry);assert.equal(source.children.length,2);
   if(kind==='wheel'){
    assert.notEqual(source.material,row.originalMaterials[i]);assert.equal(source.material.emissiveIntensity,2.8);
    assert(source.material.emissive.equals(new T.Color('#73e6ff')));assert(source.material.color.equals(new T.Color('#66b7cf')));
   }else assert.equal(source.material,row.originalMaterials[i]);
   for(const [j,halo]of (source.children as Halo[]).entries()){
    assert.equal(halo.parent,source);assert.equal(halo.geometry,source.geometry);assert.equal(halo.name,'LED halo');
    assert.deepEqual(halo.position.toArray(),[0,0,0]);assert.deepEqual(halo.scale.toArray(),[1,1,1]);assert.deepEqual(halo.quaternion.toArray(),[0,0,0,1]);
    assert.equal(halo.castShadow,false);assert.equal(halo.receiveShadow,false);assert.equal(halo.renderOrder,0);assert.equal(halo.frustumCulled,true);
    const m=halo.material;assert.equal(m.transparent,true);assert.equal(m.blending,T.AdditiveBlending);assert.equal(m.depthWrite,false);assert.equal(m.depthTest,true);assert.equal(m.side,T.BackSide);assert.equal(m.toneMapped,false);
    assert.equal(m.opacity,[.32,.09][j]);assert(m.color.equals(new T.Color(0x79dfff)));assert.equal(m.map,null);
   }
   for(const intensity of [0,.5,1,2,2.8]){
    source.material.emissive.setRGB(.2,.4,.6);source.material.emissiveIntensity=intensity;
    for(const [j,halo]of (source.children as Halo[]).entries()){
     (halo.onBeforeRender as ()=>void)();assert(halo.material.color.equals(source.material.emissive));assert.equal(halo.material.opacity,[.32,.09][j]*Math.min(1,intensity/2));
    }
   }
  }
 }
});

test('thickness keeps authored decimal quantization and operation order with an independent uniform per material and compilation',t=>{
 const row=fixture('wheel');t.after(row.dispose);const shaders=row.halos.map(halo=>compile(halo.material));
 assert.equal(new Set(row.halos.map(halo=>halo.material.customProgramCacheKey())).size,1);
 assert.equal(new Set(shaders.map(shader=>shader.vertexShader)).size,1);assert.equal(new Set(shaders.map(shader=>shader.fragmentShader)).size,1);
 assert.equal(new Set(shaders.map(shader=>shader.uniforms.referenceGlowThickness)).size,row.halos.length);
 for(const [i,shader]of shaders.entries()){
  const literal=[.018,.045][i%2].toFixed(3);assert.equal(shader.uniforms.referenceGlowThickness.value,Number(literal));
  // Restore the authored literal only for comparison: every other byte and the
  // original normal multiply / transformed add order must remain unchanged.
  const restored=shader.vertexShader.replace('uniform float referenceGlowThickness;\n','').replace('transformed+=normal*referenceGlowThickness;','transformed+=normal*'+literal+';');
  assert.equal(restored,T.ShaderLib.basic.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*'+literal+';'));
  assert.equal(shader.fragmentShader,T.ShaderLib.basic.fragmentShader);
 }
 const again=compile(row.halos[0].material);assert.notEqual(again.uniforms.referenceGlowThickness,shaders[0].uniforms.referenceGlowThickness);
 shaders[0].uniforms.referenceGlowThickness.value=.045;assert.equal(again.uniforms.referenceGlowThickness.value,.018);assert.equal(shaders[2].uniforms.referenceGlowThickness.value,.018);
});

test('pinned Three parameter keys and uniform uploader retain distinct shell thickness through one shared program',t=>{
 const rows=[fixture('hover'),fixture('wheel')];t.after(()=>rows.forEach(row=>row.dispose()));const halos=rows.flatMap(row=>row.halos);
 let target:T.WebGLRenderTarget|null=null;
 const adapter={getRenderTarget:()=>target,state:{buffers:{depth:{getReversed:()=>false}}},outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const Programs=WebGLPrograms as unknown as (...args:unknown[])=>{getParameters:(material:T.Material,lights:unknown,shadows:T.Light[],scene:T.Scene,object:T.Object3D,grids:unknown[])=>unknown;getProgramCacheKey:(parameters:unknown)=>string};
 const programs=Programs(adapter,{get:()=>null},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},null,{numPlanes:0,numIntersection:0});
 const lights=Object.fromEntries(['directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap'].map(name=>[name,[]]));Object.assign(lights,{numSpotLightShadowsWithMaps:0,numLightProbes:0});
 const scene=new T.Scene(),offscreen=new T.WebGLRenderTarget(16,16);t.after(()=>offscreen.dispose());
 for(const output of [null,offscreen]){
  target=output;assert.equal(new Set(halos.map(halo=>programs.getProgramCacheKey(programs.getParameters(halo.material,lights,[],scene,halo,[])))).size,1);
 }
 const shaders=halos.map(halo=>compile(halo.material));let delivered:number|undefined;
 const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>1,getActiveUniform:()=>({name:'referenceGlowThickness',size:1,type:0x1406}),getUniformLocation:()=>0,uniform1f:(_location:number,value:number)=>{delivered=Math.fround(value);}};
 const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
 const linked=new Uniforms(gl,{});
 for(const i of [0,1,6,7,3,4,5,2,0]){Uniforms.upload(gl,linked.seq,shaders[i].uniforms,{});assert.equal(delivered,Math.fround([.018,.045][i%2]));}
 const saved=shaders[0].uniforms.referenceGlowThickness.value;shaders[0].uniforms.referenceGlowThickness.value=.045;
 Uniforms.upload(gl,linked.seq,shaders[0].uniforms,{});assert.equal(delivered,Math.fround(.045));
 shaders[0].uniforms.referenceGlowThickness.value=saved;Uniforms.upload(gl,linked.seq,shaders[0].uniforms,{});assert.equal(delivered,Math.fround(.018));
});

test('shipped wheel rim and rail geometries are reused unchanged by all eight shells',async t=>{
 const bytes=readFileSync(new URL('../../public/exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'');
 const sources:T.Mesh[]=[];gltf.scene.traverse(object=>{if(object instanceof T.Mesh&&/^Rim_Ring|^CrashRail/.test(object.name))sources.push(object);});
 assert.deepEqual(sources.map(mesh=>[mesh.name,mesh.geometry.attributes.position.count,mesh.geometry.index!.count]),[['CrashRail_1',32,126],['CrashRail_-1',32,126],['Rim_Ring_1',260,1377],['Rim_Ring_-1',258,1377]]);
 const geometry=sources.map(mesh=>mesh.geometry),snapshots=geometry.map(g=>JSON.stringify(g.toJSON()));glowVehicle(gltf.scene,'wheel');
 for(const [i,source]of sources.entries()){
  assert.equal(source.geometry,geometry[i]);assert.equal(JSON.stringify(source.geometry.toJSON()),snapshots[i]);
  assert.equal(source.children.length,2);for(const halo of source.children as Halo[])assert.equal(halo.geometry,source.geometry);
 }
 t.after(()=>{const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();gltf.scene.traverse(object=>{if(object instanceof T.Mesh){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();});
});
