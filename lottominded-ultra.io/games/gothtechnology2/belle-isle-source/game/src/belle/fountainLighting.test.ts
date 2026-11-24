import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFountainLighting,FOUNTAIN_COLORS,FOUNTAIN_CUE_SECONDS} from './fountainLighting.ts';
import {open} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {addScottDetails} from './fountainDetail.ts';
import type {ParkMap} from './terrain.ts';
test('fountain colors vary, stay finite, and loop without a flash',()=>{
 const lights=createFountainLighting(),first=lights.primary.value.clone(),cycle=FOUNTAIN_COLORS.length*FOUNTAIN_CUE_SECONDS;
 lights.update(36);
 assert(lights.primary.value.toArray().some((v,i)=>Math.abs(v-first.toArray()[i])>.2));
 for(let t=0;t<cycle;t+=.25){lights.update(t);for(const c of [lights.primary.value,lights.secondary.value])for(const v of c.toArray())assert(Number.isFinite(v)&&v>=0&&v<=1);}
 lights.update(cycle-.001);const before=lights.primary.value.clone();lights.update(cycle+.001);
 assert(lights.primary.value.toArray().every((v,i)=>Math.abs(v-before.toArray()[i])<.00001));
 lights.update(cycle);assert.deepEqual(lights.primary.value.toArray(),first.toArray());
});
test('independent fountain materials sample identical colors at the same time',()=>{
 const water=createFountainLighting(),stone=createFountainLighting();water.update(47.125);stone.update(47.125);
 assert.deepEqual(water.primary.value.toArray(),stone.primary.value.toArray());assert.deepEqual(water.secondary.value.toArray(),stone.secondary.value.toArray());
});

function compileStone(material:T.Material){
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}
function disposeStoneScene(...roots:T.Object3D[]){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 for(const root of roots)root.traverse(object=>{if(object instanceof T.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
}
async function shippedScottMaterials(){
 // Read only the GLB JSON chunk. Load the actual shipped material definitions
 // through Three without decoding the unrelated 59 MB landmark geometry/textures.
 const file=await open(new URL('../../public/belle/landmarks.glb',import.meta.url));
 let document:{materials:{name?:string}[]};
 try{
  const header=Buffer.alloc(20);assert.equal((await file.read(header,0,header.length,0)).bytesRead,header.length);
  assert.equal(header.toString('ascii',0,4),'glTF');assert.equal(header.readUInt32LE(16),0x4e4f534a);
  const bytes=Buffer.alloc(header.readUInt32LE(12));assert.equal((await file.read(bytes,0,bytes.length,20)).bytesRead,bytes.length);
  document=JSON.parse(bytes.toString('utf8'));
 }finally{await file.close();}
 const names=['Monument pale granite','Monument white marble'];
 const materials=names.map(name=>{const matches=document.materials.filter(material=>material.name===name);assert.equal(matches.length,1,name);return matches[0];});
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify({asset:{version:'2.0'},materials,scenes:[{nodes:[]}],scene:0}),'');
 const sources=await Promise.all(materials.map((_,i)=>gltf.parser.getDependency('material',i))) as T.MeshStandardMaterial[];
 for(const material of sources)assert(material instanceof T.MeshStandardMaterial);
 return sources;
}

test('shipped Scott granite and marble share decorated shader identity while retaining materials and independent bindings',async()=>{
 const sources=await shippedScottMaterials(),originals=sources.map(material=>material.toJSON());
 const scene=new T.Scene(),architecture=new T.Group(),night={value:.6},lighting=createFountainLighting();
 const geometry=new T.BoxGeometry(1,1,1),meshes=sources.map(material=>{
  const mesh=new T.Mesh(geometry,material);mesh.name='9146545_'+material.name;architecture.add(mesh);return mesh;
 });
 try{
  addScottDetails(scene,{} as ParkMap,architecture,night,{value:0},lighting);
  const materials=meshes.map(mesh=>mesh.material),shaders=materials.map(compileStone);
  assert.notEqual(sources[0].uuid,sources[1].uuid);
  assert.notEqual(materials[0],materials[1],'only the GPU program identity is shared');
  assert.equal(materials[0].customProgramCacheKey(),materials[1].customProgramCacheKey());
  assert.equal(shaders[0].vertexShader,shaders[1].vertexShader);assert.equal(shaders[0].fragmentShader,shaders[1].fragmentShader);
  for(let i=0;i<sources.length;i++){
   const material=materials[i],source=sources[i],uniforms=shaders[i].uniforms;
   assert.notEqual(material,source);assert.deepEqual(source.toJSON(),originals[i],'authored material is untouched');
   assert(material.color.equals(source.color));assert.equal(material.roughness,source.roughness);assert.equal(material.metalness,source.metalness);
   assert.equal(material.name,source.name);assert.equal(material.side,T.DoubleSide);assert.equal(material.transparent,source.transparent);assert.equal(material.depthWrite,source.depthWrite);
   assert.equal(material.map,source.map);assert.equal(material.normalMap,source.normalMap);
   assert.equal(uniforms.fountainPrimary,lighting.uniforms.fountainPrimary);assert.equal(uniforms.fountainSecondary,lighting.uniforms.fountainSecondary);assert.equal(uniforms.fountainNight,night);
  }
  const first=shaders[0].uniforms.fountainCentre,second=shaders[1].uniforms.fountainCentre,centre=second.value.clone();
  assert.notEqual(first,second);assert.notEqual(first.value,second.value);first.value.set(-100,-200);
  assert(second.value.equals(centre),'one material cannot overwrite another material centre');
  const recompiled=compileStone(materials[0]);assert.notEqual(recompiled.uniforms.fountainCentre,first);assert(recompiled.uniforms.fountainCentre.value.equals(centre));
  lighting.update(47.125);night.value=.25;
  for(const shader of shaders){assert.equal(shader.uniforms.fountainNight.value,.25);assert(shader.uniforms.fountainPrimary.value.equals(lighting.primary.value));}
  const cascade=scene.getObjectByName('Scott stepped cascades · shell bowls and paired stairs') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  assert(cascade);assert.equal(cascade.material.side,T.FrontSide,'native side variants remain distinct from the two-sided monument');
 }finally{disposeStoneScene(scene,architecture);for(const material of sources)material.dispose();}
});

test('Scott program sharing preserves authored hook identity and captures each original key with its receiver',()=>{
 const scene=new T.Scene(),architecture=new T.Group(),geometry=new T.BoxGeometry(1,1,1),calls=[0,0,0],keyCalls=[0,0,0];
 const inputs=[{variant:'A',value:1},{variant:'A',value:2},{variant:'B',value:3}];
 const authored=inputs.map(input=>({value:input.value}));
 const sources=inputs.map((input,i)=>{
  const material=new T.MeshStandardMaterial({name:'Scott authored marble '+i});material.userData.authoredKey='stone-'+input.variant;
  material.customProgramCacheKey=function(){keyCalls[i]++;return this.userData.authoredKey;};
  material.onBeforeCompile=shader=>{calls[i]++;shader.uniforms.authoredStone=authored[i];shader.fragmentShader='// authored '+input.variant+'\n'+shader.fragmentShader;};
  const mesh=new T.Mesh(geometry,material);mesh.name='9146545_Marble_'+i;architecture.add(mesh);return material;
 });
 try{
  addScottDetails(scene,{} as ParkMap,architecture,{value:0},{value:0},createFountainLighting());
  assert.deepEqual(keyCalls,[1,1,1],'capture the authored key once at dressing');
  const materials=architecture.children.map(object=>(object as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material);
  // Later source changes must not pair the captured GLSL hook with a new key.
  for(const source of sources){source.userData.authoredKey='changed';source.onBeforeCompile=()=>{throw Error('uncaptured replacement hook');};}
  const shaders=materials.map(compileStone);
  assert.deepEqual(calls,[1,1,1]);assert.deepEqual(keyCalls,[1,1,1]);
  assert.equal(materials[0].customProgramCacheKey(),'stone-A-scott-carved-uplight-cycle-v2');
  assert.equal(materials[0].customProgramCacheKey(),materials[1].customProgramCacheKey());
  assert.notEqual(materials[0].customProgramCacheKey(),materials[2].customProgramCacheKey());
  assert.equal(shaders[0].fragmentShader,shaders[1].fragmentShader);assert.notEqual(shaders[0].fragmentShader,shaders[2].fragmentShader);
  for(let i=0;i<inputs.length;i++){assert.equal(shaders[i].uniforms.authoredStone,authored[i]);assert.equal(shaders[i].uniforms.authoredStone.value,inputs[i].value);assert(shaders[i].fragmentShader.includes('// authored '+inputs[i].variant));}
  assert.notEqual(shaders[0].uniforms.authoredStone,shaders[1].uniforms.authoredStone);assert.notEqual(shaders[0].uniforms.fountainCentre,shaders[1].uniforms.fountainCentre);
  shaders[0].uniforms.authoredStone.value=11;assert.equal(shaders[1].uniforms.authoredStone.value,2);
  assert.deepEqual(keyCalls,[1,1,1],'compilation and cache lookup never reevaluate the mutable source key');
 }finally{disposeStoneScene(scene,architecture);for(const material of sources)material.dispose();}
});
