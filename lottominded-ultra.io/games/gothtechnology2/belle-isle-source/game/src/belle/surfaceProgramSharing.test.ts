import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {finishBank} from './surfaceFinish.ts';
import {addPondServiceBuildings} from './pondServiceBuildings.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import type {ParkMap} from './terrain.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
function compile(material:T.Material){
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Shader;
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}
function sameProgram(materials:T.Material[],shaders:Shader[]){
 assert.equal(new Set(materials.map(material=>material.customProgramCacheKey())).size,1);
 assert.equal(new Set(shaders.map(shader=>shader.vertexShader)).size,1);
 assert.equal(new Set(shaders.map(shader=>shader.fragmentShader)).size,1);
}
function uniformProgram(active:{name:string;type:number}[]){
 const state=new Map<string,number|number[]>();
 const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>active.length,
  getActiveUniform:(_:unknown,i:number)=>({...active[i],size:1}),getUniformLocation:(_:unknown,name:string)=>name,
  uniform1i:(name:string,value:number)=>state.set(name,Number(value)),
  uniform3f:(name:string,x:number,y:number,z:number)=>state.set(name,[x,y,z].map(Math.fround))};
 // Exercise the installed r185 value cache, including its material switches.
 const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
 const program=new Uniforms(gl,{});
 return {state,upload:(shader:Shader)=>Uniforms.upload(gl,program.seq,shader.uniforms,{})};
}
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
function pond(){return addPondServiceBuildings(new T.Scene(),{...map,buildings:map.buildings.filter(building=>building.id==='507125653')});}
function pondMaterials(value:ReturnType<typeof pond>){
 return ['Service courtyard red brick','Annex weathered pitched roof'].map(name=>{
  const mesh=value.root.children.find(object=>(object as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material.name===name) as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  assert(mesh,'Missing actual service-building material '+name);return mesh.material;
 });
}
function geometryHash(root:T.Object3D){
 const hash=createHash('sha256');root.traverse(object=>{if(!(object instanceof T.Mesh))return;
  for(const attribute of [...Object.values(object.geometry.attributes),...(object.geometry.index?[object.geometry.index]:[])])hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
 });return hash.digest('hex');
}

test('bank finishes share a program while retaining original independently rounded levels and material state',()=>{
 const cases=[
  {water:0,top:2,stone:false,expected:[0,1.35,1.88]},
  {water:1.05,top:2,stone:false,expected:[1.05,.3,.83]},
  {water:1.05,top:2,stone:true,expected:[1.05,.3,.83]},
  // Quantizing the water level before subtracting it would give wrong endpoints.
  {water:1.05051,top:2.00049,stone:true,expected:[1.051,.3,.83]},
  {water:.33333333,top:1.00000001,stone:false,expected:[.333,.017,.547]},
 ];
 const mapTexture=new T.Texture(),normalTexture=new T.Texture();
 const textures={[mapTexture.uuid]:{uuid:mapTexture.uuid},[normalTexture.uuid]:{uuid:normalTexture.uuid}};
 const materials=cases.map((row,i)=>{
  const material=new T.MeshStandardMaterial({name:'bank '+i,color:0x718083,roughness:.87,metalness:.11,side:T.DoubleSide,map:mapTexture,normalMap:normalTexture});
  material.userData.authored='preserved';material.normalScale.set(.15,.15);
  const state=material.toJSON({textures} as T.JSONMeta),version=material.version;
  finishBank(material,row.water,row.top,row.stone);
  assert.deepEqual(material.toJSON({textures} as T.JSONMeta),state);assert.equal(material.version,version);
  assert.equal(material.map,mapTexture);assert.equal(material.normalMap,normalTexture);return material;
 });
 try{
  const shaders=materials.map(compile);sameProgram(materials,shaders);
  for(let i=0;i<cases.length;i++){
   assert.deepEqual(shaders[i].uniforms.bankLevels.value.toArray(),cases[i].expected);
   assert.equal(shaders[i].uniforms.bankStone.value,cases[i].stone);
  }
  const program=uniformProgram([{name:'bankLevels',type:0x8b51},{name:'bankStone',type:0x8b56}]);
  for(const i of [0,2,1,3,0,4,2,0]){
   program.upload(shaders[i]);assert.deepEqual(program.state.get('bankLevels'),cases[i].expected.map(Math.fround));assert.equal(program.state.get('bankStone'),Number(cases[i].stone));
  }
  shaders[0].uniforms.bankLevels.value.set(99,88,77);shaders[0].uniforms.bankStone.value=true;
  assert.deepEqual(shaders[1].uniforms.bankLevels.value.toArray(),cases[1].expected);assert.equal(shaders[1].uniforms.bankStone.value,false);
  const fresh=compile(materials[0]);assert.deepEqual(fresh.uniforms.bankLevels.value.toArray(),cases[0].expected);assert.equal(fresh.uniforms.bankStone.value,false);
  assert.notEqual(fresh.uniforms.bankLevels,shaders[0].uniforms.bankLevels);assert.notEqual(fresh.uniforms.bankStone,shaders[0].uniforms.bankStone);
 }finally{materials.forEach(material=>material.dispose());mapTexture.dispose();normalTexture.dispose();}
});

test('real pond brick and roof retain dimensions mortar and geometry through repeated shared-program material switches',()=>{
 const before=JSON.stringify(map.buildings),value=pond(),materials=pondMaterials(value),geometryBefore=geometryHash(value.root);
 try{
  const shaders=materials.map(compile);sameProgram(materials,shaders);
  const expected=[[.24,.075,.72],[.28,.24,.56]],colors=[0x795348,0x555449],roughness=[.91,.96];
  for(let i=0;i<materials.length;i++){
   const material=materials[i];assert.deepEqual(shaders[i].uniforms.servicePattern.value.toArray(),expected[i]);
   assert.equal(material.color.getHex(),colors[i]);assert.equal(material.roughness,roughness[i]);assert.equal(material.metalness,0);
   assert.equal(material.side,T.FrontSide);assert.equal(material.map,null);assert.equal(material.normalMap,null);assert.equal(material.transparent,false);assert.equal(material.opacity,1);assert.equal(material.depthWrite,true);
  }
  const program=uniformProgram([{name:'servicePattern',type:0x8b51}]);
  for(const i of [0,1,0,1,1,0]){program.upload(shaders[i]);assert.deepEqual(program.state.get('servicePattern'),expected[i].map(Math.fround));}
  assert.notEqual(shaders[0].uniforms.servicePattern,shaders[1].uniforms.servicePattern);assert.notEqual(shaders[0].uniforms.servicePattern.value,shaders[1].uniforms.servicePattern.value);
  shaders[0].uniforms.servicePattern.value.set(99,88,77);assert.deepEqual(shaders[1].uniforms.servicePattern.value.toArray(),expected[1]);
  const fresh=compile(materials[0]);assert.notEqual(fresh.uniforms.servicePattern,shaders[0].uniforms.servicePattern);assert.deepEqual(fresh.uniforms.servicePattern.value.toArray(),expected[0]);
  assert.equal(geometryHash(value.root),geometryBefore);assert.equal(JSON.stringify(map.buildings),before);
 }finally{value.dispose();}
});

test('uniform-sharing bank and service finishes remain excluded from palette batching after realistic dressing',async t=>{
 const textures:T.Texture[]=[],renderer={capabilities:{getMaxAnisotropy:()=>1},initTexture:()=>{}} as unknown as T.WebGLRenderer;
 const loader=t.mock.method(T.TextureLoader.prototype,'loadAsync',async()=>{const texture=new T.Texture({width:1,height:1});textures.push(texture);return texture;});
 try{await loadRealisticMaterials(renderer);}finally{loader.mock.restore();}
 const value=pond(),bank=new T.MeshStandardMaterial({name:'Bank stone'});finishBank(bank,1.05,2,true);
 const originals=[bank,...pondMaterials(value)],scene=new T.Scene(),geometry=new T.BoxGeometry(1,1,1),sources:T.Mesh[]=[],created:T.Material[]=[];
 let batch:StaticPaletteBatch|undefined;
 try{
  for(const material of originals)for(let i=0;i<2;i++){const mesh=new T.Mesh(geometry,material);mesh.name=material.name+' '+i;scene.add(mesh);sources.push(mesh);}
  created.push(...applyRealisticMaterials(scene));assert.equal(created.length,3);
  for(const mesh of sources){assert(!Array.isArray(mesh.material));assert(mesh.material.userData.realisticSurface);assert.equal(mesh.material.userData.realisticBaseIsStandard,false);}
  batch=new StaticPaletteBatch(sources);assert.deepEqual(batch.stats,{sourceDraws:0,batches:0},'matching GPU keys never authorize merging per-material custom uniforms');
 }finally{batch?.dispose();created.forEach(material=>material.dispose());geometry.dispose();bank.dispose();value.dispose();textures.forEach(texture=>texture.dispose());}
});
