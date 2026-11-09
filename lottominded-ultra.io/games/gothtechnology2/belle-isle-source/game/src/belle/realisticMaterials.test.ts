import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surfaceKind} from './realisticMaterialRules.ts';
import * as T from 'three';
import {prepareCanopyCoverage} from './canopyCoverage.ts';

test('surface treatment preserves optical surfaces, the readable plate and controllable lights',()=>{
 for(const name of ['Running_Light_Blue','Brake_Light_Red','Michigan_Blue','Plate_White','Cinema_Lens_Coating','Cinema_Monitor_Blue','Conservatory clear panes','Aquarium tank glazing','Aquarium mosaic floor','Aquarium illuminated habitat']){
  assert.equal(surfaceKind(name,'',.5),null,name);
 }
});
test('actor details remain distinct from architecture and road finishes',()=>{
 assert.equal(surfaceKind('Material_0','Boerboel'),'fur');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Head'),'skin');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Body'),'cloth');
 assert.equal(surfaceKind('Skin_Grip_Rubber','Camera'),'rubber');
 assert.equal(surfaceKind('Island asphalt','Joined island pavement'),'asphalt');
 assert.equal(surfaceKind('Weathered red brick','Casino'),'brick');
 assert.equal(surfaceKind('PH Bark Brown 02','Nearby maple'),'bark');
});
test('new skins distinguish natural materials and retain optical glazing',()=>{
 for(const [name,kind]of [['Monument white marble','marble'],['Monument aged bronze','bronze'],['Aquarium exterior copper roof','copper'],['Aquarium jade glazed tile','ceramic'],['Station white painted cladding','paint'],['Fishing cork handle','cork'],['Fishing rod graphite','graphite'],['Freshwater fish scales','scales'],['Pigeon ash feathers','feather'],['Climbing rope','rope'],['Black seat leather','leather']])assert.equal(surfaceKind(name,''),kind,name);
 assert.equal(surfaceKind('Station reflective glazing',''),null);
});


test('near river and lagoons cannot receive the fallback concrete finish',()=>{
 for(const object of ['Detroit River rolling waves','Detroit River distant water','Lagoon · Lake Okonoka','Lagoon · Blue Heron','Koi pond · clear surface']){
  for(const metalness of [0,.035,.08,.5])assert.equal(surfaceKind('',object,metalness),null,object);
 }
 // Nearby architecture and the submerged gravel are not optical water.
 assert.equal(surfaceKind('Concrete','Lagoon bridge'), 'concrete');
 assert.equal(surfaceKind('','Koi pond gravel bed'),'gravel');
 assert.equal(surfaceKind('Weathered red brick','Riverfront building'),'brick');
});


test('canopy coverage preserves atlases and composes the original material hook once',()=>{
 for(const far of [false,true]){
  const map=new T.Texture(),material=far?new T.MeshBasicMaterial({map,alphaTest:.35}):new T.MeshStandardMaterial({map,alphaTest:.45});
  let calls=0;material.onBeforeCompile=s=>{calls++;s.fragmentShader='// original leaf shader\n'+s.fragmentShader;};material.customProgramCacheKey=()=> 'original-atlas';
  prepareCanopyCoverage(material,far);prepareCanopyCoverage(material,far);
  assert.equal(material.map,map);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.alphaToCoverage,true);assert.equal(material.alphaTest,far?.25:.30);
  const lib=far?T.ShaderLib.basic:T.ShaderLib.standard;const shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert.equal(calls,1);assert(shader.fragmentShader.includes('// original leaf shader'));
  assert.equal((shader.fragmentShader.match(/float belleAutumn=/g)||[]).length,1);
  assert(shader.fragmentShader.includes('#include <alphatest_fragment>'));
  assert.equal((shader.fragmentShader.match(/texture2D/g)||[]).length,(lib.fragmentShader.match(/texture2D/g)||[]).length);
  assert.equal(material.customProgramCacheKey(),'original-atlas|belle-canopy-coverage-v1');
  material.dispose();map.dispose();
 }
});
test('canopy color fails closed on an incompatible shader instead of silently dropping texture work',()=>{
 const material=new T.MeshStandardMaterial();prepareCanopyCoverage(material);
 assert.throws(()=>material.onBeforeCompile({vertexShader:'',fragmentShader:'void main(){}',uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0],{} as T.WebGLRenderer),/original map shader missing/);
 material.dispose();
});
