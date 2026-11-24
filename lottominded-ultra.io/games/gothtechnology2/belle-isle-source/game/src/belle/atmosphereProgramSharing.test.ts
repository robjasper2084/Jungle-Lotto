import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {WebGLProperties} from 'three/src/renderers/webgl/WebGLProperties.js';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {dressSunsetGround} from './sunsetGround.ts';
import {batchStaticGround} from './staticGroundBatch.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {seasonalMaterial} from './seasonalMaterial.ts';
import {referenceTree} from './referenceTrees.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type SurfaceMesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
const textures:T.Texture[]=[];
before(async()=>{
 const load=T.TextureLoader.prototype.loadAsync;
 T.TextureLoader.prototype.loadAsync=async url=>{const texture=new T.Texture({width:1,height:1} as HTMLImageElement);texture.name=url;textures.push(texture);return texture;};
 try{await loadRealisticMaterials(renderer);}finally{T.TextureLoader.prototype.loadAsync=load;}
});
after(()=>textures.forEach(texture=>texture.dispose()));
const compile=(material:T.Material)=>{
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,
  numPointLights:4,numPointLightShadows:0} as Shader;
 material.onBeforeCompile(shader,renderer);return shader;
};
const pair=(shader:Shader)=>[shader.vertexShader,shader.fragmentShader];
const suffix='|belle-pbr-v1|belle-height-fog-clouds-v2';

// Exercise the actual world/Oudolf construction spans without loading the full
// asynchronous world or copying a parallel implementation into this test.
const world=readFileSync(new URL('./world.ts',import.meta.url),'utf8'),oudolf=readFileSync(new URL('./oudolfScene.ts',import.meta.url),'utf8');
function span(source:string,start:string,end:string){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'authored construction span exists');return source.slice(a,b);}
const authored=ts.transpileModule(
 span(world,'const mat=','export async function createWorld')+
 span(world,'function poly(','function road(')+
 'function lawn(){'+span(world,'const grass=mat(',';const pavement=mat(')+";grass.name='Park lawn';return grass;}\n"+
 'function garden(grass){'+span(world,'const pitchSurface=mat(','for(const a of data.areas)')+'return {gardenSoil,gardenLawn};}\n'+
 'function cut(lawn){'+span(oudolf,'const cutLawn=lawn.clone()','add(aisles,cutLawn')+'return cutLawn;}\n',
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const construction=Function('T',authored+';return {lawn,garden,cut,poly};')(T) as {
 lawn:()=>T.MeshStandardMaterial;
 garden:(grass:T.MeshStandardMaterial)=>{gardenSoil:T.MeshStandardMaterial;gardenLawn:T.MeshStandardMaterial};
 cut:(lawn:T.MeshStandardMaterial)=>T.MeshStandardMaterial;
 poly:(points:[number,number][],height:number)=>T.BufferGeometry;
};

function keyBuilder(){
 let target:T.WebGLRenderTarget|null=null;
 const adapter={getRenderTarget:()=>target,state:{buffers:{depth:{getReversed:()=>false}}},outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const Programs=WebGLPrograms as unknown as (...args:unknown[])=>{getParameters:(material:T.Material,lights:unknown,shadows:T.Light[],scene:T.Scene,object:T.Object3D,grids:unknown[])=>{customProgramCacheKey:string};getProgramCacheKey:(parameters:unknown)=>string};
 const programs=Programs(adapter,{get:()=>null},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},null,{numPlanes:0,numIntersection:0});
 const lights=Object.fromEntries(['directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap'].map(name=>[name,[]]));
 Object.assign(lights,{numSpotLightShadowsWithMaps:0,numLightProbes:0});
 return {target:(value:typeof target)=>{target=value;},key:(mesh:SurfaceMesh,scene:T.Scene,custom=true)=>{
  const parameters=programs.getParameters(mesh.material,lights,[new T.DirectionalLight()],scene,mesh,[]);
  return programs.getProgramCacheKey(custom?parameters:{...parameters,customProgramCacheKey:''});
 }};
}

// Execute the installed renderer's actual per-material cache branch, with its
// native program/key/uniform factories. GL sinks only retain generated sources;
// this proves JavaScript cache/binding behavior, not GPU compilation or pixels.
function nativeMaterialCache(){
 assert.equal(T.REVISION,'185');
 const text=readFileSync(new URL('../../node_modules/three/src/renderers/WebGLRenderer.js',import.meta.url),'utf8');
 const file=ts.createSourceFile('WebGLRenderer.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const names=['getProgram','updateCommonMaterialProperties','materialNeedsLights'],functions=new Map<string,string>();
 function visit(node:ts.Node){
  if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text)){
   assert(!functions.has(node.name.text));functions.set(node.name.text,node.getText(file));
  }
  ts.forEachChild(node,visit);
 }
 visit(file);assert.equal(functions.size,names.length);
 const gl={VERTEX_SHADER:0x8b31,FRAGMENT_SHADER:0x8b30,createProgram:()=>({}),createShader:(type:number)=>({type,source:''}),
  shaderSource:(shader:{source:string},source:string)=>{shader.source=source;},compileShader(){},attachShader(){},bindAttribLocation(){},linkProgram(){}};
 const adapter={getContext:()=>gl,getRenderTarget:()=>null,state:{buffers:{depth:{getReversed:()=>false}}},outputColorSpace:T.SRGBColorSpace,
  toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const environments={get:()=>null},clipping={numPlanes:0,numIntersection:0,uniform:{value:[]}};
 const Programs=WebGLPrograms as unknown as (...args:unknown[])=>unknown;
 const programCache=Programs(adapter,environments,{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},{releaseStatesOfProgram(){}},clipping);
 const Properties=WebGLProperties as unknown as ()=>{get:(object:object)=>{uniforms:Record<string,T.IUniform>}};
 const properties=Properties();
 const lights=Object.fromEntries(['ambient','probe','directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap',
  'directionalShadow','spotShadow','pointShadow','directionalShadowMatrix','spotLightMatrix','pointShadowMatrix'].map(name=>[name,[]]));
 const lightState={...lights,version:1,numSpotLightShadowsWithMaps:0,numLightProbes:0,rectAreaLTC1:null,rectAreaLTC2:null};
 const state={state:{lights:{state:lightState},shadowsArray:[],lightProbeGridArray:[]}};
 type Program={cacheKey:string;vertexShader:{source:string};fragmentShader:{source:string}};
 const getProgram=Function('properties','programCache','environments','clipping','currentRenderState','_this','_nodesHandler','_emptyScene','onMaterialDispose',
  [...functions.values()].join('\n')+'\nreturn getProgram;')
  (properties,programCache,environments,clipping,state,adapter,null,new T.Scene(),()=>{}) as (material:T.Material,scene:T.Scene,object:T.Object3D)=>Program;
 return {lightState,select:(mesh:SurfaceMesh,scene:T.Scene)=>getProgram(mesh.material,scene,mesh),
  uniforms:(material:T.Material)=>properties.get(material).uniforms};
}

test('only leafless Standard trunks share the near/far key and keep separate construction-time selectors',t=>{
 const source=new T.MeshStandardMaterial({color:0x70513a,roughness:.95}),month={value:7},original=source.toJSON();
 const near=seasonalMaterial(source,false,false,false,month,true),far=seasonalMaterial(source,false,true,false,month,true);
 const materials:T.Material[]=[source,near.material,far.material];t.after(()=>materials.forEach(material=>material.dispose()));
 const shaders=[compile(near.material),compile(far.material)];
 assert.equal(near.material.customProgramCacheKey(),far.material.customProgramCacheKey());
 assert.equal(near.material.customProgramCacheKey(),'seasonal-trunk-selector-v1');
 assert.deepEqual(pair(shaders[0]),pair(shaders[1]));
 assert.deepEqual(shaders.map(shader=>shader.uniforms.treeFarLod.value),[false,true]);
 assert.notEqual(shaders[0].uniforms.treeFarLod,shaders[1].uniforms.treeFarLod);
 for(const material of [near.material,far.material]){
  assert.equal(material.side,T.DoubleSide);assert.equal(material.transparent,false);assert.equal(material.alphaTest,0);assert.equal(material.alphaToCoverage,false);assert.equal(material.roughness,.88);
 }
 // An old shader table cannot change a later compile's constructor choice or
 // the other material's table. Production has no per-frame selector mutation.
 shaders[0].uniforms.treeFarLod.value=true;
 const fresh=compile(near.material);assert.equal(fresh.uniforms.treeFarLod.value,false);assert.notEqual(fresh.uniforms.treeFarLod,shaders[0].uniforms.treeFarLod);
 for(const reference of [false,true])for(const distant of [false,true]){
  const leaf=seasonalMaterial(source,true,distant,false,month,reference).material;materials.push(leaf);
  const shader=compile(leaf);assert.equal(shader.uniforms.treeFarLod,undefined);assert.doesNotMatch(shader.fragmentShader,/treeFarLod/);
  assert.equal(leaf.customProgramCacheKey(),reference?'reference-seasonal-stable-'+distant:'seasonal-tree-stable-true-'+distant);
  assert.equal(leaf.alphaTest,distant?.34:.36);assert.equal(leaf.alphaToCoverage,true);
  assert(shader.fragmentShader.includes(distant?'if(lodSeed<1.0-treeWeight)discard;':'if(lodSeed>=treeWeight)discard;'));
 }
 for(const base of [new T.MeshBasicMaterial(),new T.MeshPhysicalMaterial()]){
  materials.push(base);
  for(const distant of [false,true]){
   const material=seasonalMaterial(base,false,distant,false,month).material;materials.push(material);
   assert.equal(material.customProgramCacheKey(),'seasonal-tree-stable-false-'+distant);assert.doesNotMatch(compile(material).fragmentShader,/treeFarLod/);
  }
 }
 assert.deepEqual(source.toJSON(),original,'the authored source material is unchanged');
});

test('leafless selector preserves both original discard predicates at reciprocal and fractional thresholds',t=>{
 const source=new T.MeshStandardMaterial(),material=seasonalMaterial(source,false,false,false,{value:7}).material;
 t.after(()=>{material.dispose();source.dispose();});
 const shader=compile(material),match=shader.fragmentShader.match(/#include <alphatest_fragment>([\s\S]*?)#include <alphahash_fragment>/);
 assert(match,'the actual compiled coverage block is present');
 assert.match(match[1],/if\(treeFarLod\)\{\s*if\(lodSeed<1\.0-treeWeight\)discard;\s*\}else\{\s*if\(lodSeed>=treeWeight\)discard;/);
 assert.match(match[1],/vec3 lodCell=floor\(localTreePos\*6\.0\);/);
 assert.match(match[1],/float lodSeed=fract\(52\.9829189\*fract\(dot\(lodCell,vec3\(\.06711056,\.00583715,\.02383154\)\)\)\);/);
 // Execute the actual selector/early-discard structure with a supplied hash
 // value. This checks the threshold contract, not GPU float rounding or pixels.
 const coverage=match[1].replace(/vec3 lodCell=[^;]+;/,'').replace(/float lodSeed=[^;]+;/,'').replaceAll('discard;','return true;');
 const discard=Function('treeFarLod','treeWeight','lodSeed',coverage+'\nreturn false;') as (far:boolean,weight:number,seed:number)=>boolean;
 const weights=new Float32Array([-.1,0,.1,.125,.25,.3,.5,.7,.75,.875,.9,1,1.1]);
 for(const weight of weights)for(const distant of [false,true]){
  const boundary=distant?1-weight:weight;
  const seeds=[0,Number.MIN_VALUE,.05,.125,.25,.5,.75,.875,.95,1,boundary-Number.EPSILON,boundary,boundary+Number.EPSILON];
  for(const seed of seeds){
   const original=weight<=0 || (weight<1 && (distant?seed<1.0-weight:seed>=weight));
   assert.equal(discard(distant,weight,seed),original,JSON.stringify({distant,weight,seed}));
  }
 }
 for(const near of [.125,.25,.5,.75,.875])for(const seed of [0,near-Number.EPSILON,near,near+Number.EPSILON,.99]){
  assert.notEqual(discard(false,near,seed),discard(true,1-near,seed),'original complementary binary thresholds select exactly one side');
 }
});

test('actual trunk chains keep near/far/near bindings through the pinned native material and bool-uniform caches',async t=>{
 const scene=new T.Scene(),noise=new T.Texture(),owner=new WorldAtmosphere(scene,noise),month={value:10};
 const sources=[false,true].map(far=>{
  const tree=referenceTree('maple',far,12),season=seasonalMaterial(tree.bark,false,far,false,month,true);
  tree.trunk.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array([far?.75:.25]),1));
  const mesh=new T.InstancedMesh(tree.trunk,season.material,1);mesh.name=(far?'Distant ':'Nearby ')+'maple trunk';
  mesh.setMatrixAt(0,new T.Matrix4());mesh.setColorAt(0,new T.Color(0xffffff));mesh.castShadow=!far;mesh.receiveShadow=true;mesh.frustumCulled=false;
  scene.add(mesh);return {tree,season,mesh,geometry:mesh.geometry,weight:mesh.geometry.getAttribute('lodWeight'),before:mesh.geometry.attributes.position.array.slice()};
 });
 const dressed:T.Material[]=[];
 t.after(()=>{owner.dispose();for(const row of sources){row.mesh.dispose();row.tree.trunk.dispose();row.tree.leaves.dispose();row.tree.bark.dispose();row.tree.foliage.dispose();row.season.material.dispose();}dressed.forEach(material=>material.dispose());noise.dispose();});
 await Promise.resolve();dressed.push(...applyRealisticMaterials(scene));assert.equal(dressed.length,2);
 const [near,far]=sources.map(row=>row.mesh);
 assert.notEqual(near.material,far.material);assert.equal(near.material.customProgramCacheKey(),far.material.customProgramCacheKey());
 for(const mesh of [near,far]){assert.equal(mesh.material.userData.realisticProfile,'bark|triplanar');assert.equal(mesh.material.userData.realisticBaseIsStandard,false);}
 const batch=new StaticPaletteBatch([near,far],new Set([near,far]));t.after(()=>batch.dispose());
 assert.deepEqual(batch.stats,{sourceDraws:0,batches:0},'a shared GPU key never authorizes sharing these instance-pool uniform bindings');
 const native=nativeMaterialCache(),first=native.select(near,scene),nearUniforms=native.uniforms(near.material),second=native.select(far,scene),farUniforms=native.uniforms(far.material);
 assert.equal(first,second,'the actual pinned Three cache acquires one program for the two materials');
 assert.notEqual(nearUniforms,farUniforms);assert.notEqual(nearUniforms.treeFarLod,farUniforms.treeFarLod);
 assert.deepEqual([nearUniforms.treeFarLod.value,farUniforms.treeFarLod.value],[false,true]);
 const calls:number[]=[];let current:number|undefined;
 const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>1,getActiveUniform:()=>({name:'treeFarLod',type:0x8b56,size:1}),getUniformLocation:()=>0,
  uniform1i:(_:unknown,value:boolean|number)=>{current=Number(value);calls.push(current);}};
 const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
 const uniforms=new Uniforms(gl,{});
 for(const mesh of [near,far,near,near,far,near]){
  assert.equal(native.select(mesh,scene),first);
  Uniforms.upload(gl,uniforms.seq,native.uniforms(mesh.material),{});
  assert.equal(current,Number(mesh===far),'the shared native uniform cache switches to this material value');
 }
 assert.deepEqual(calls,[0,1,0,1,0],'the pinned value cache skips only an actually unchanged bool');
 assert.equal(native.uniforms(near.material),nearUniforms);assert.equal(native.uniforms(far.material),farUniforms);
 for(const [i,row]of sources.entries()){
  row.season.update();assert.equal(native.uniforms(row.mesh.material).treeFarLod.value,i===1);
  assert.equal(row.mesh.geometry,row.geometry);assert.equal(row.mesh.geometry.getAttribute('lodWeight'),row.weight);assert.deepEqual(row.mesh.geometry.attributes.position.array,row.before);
  assert.equal(row.mesh.castShadow,i===0);assert.equal(row.mesh.receiveShadow,true);assert.equal(row.mesh.frustumCulled,false);
  assert.equal(row.mesh.customDepthMaterial,undefined);assert.equal(row.mesh.customDistanceMaterial,undefined);
 }
});

async function lawnCase(kind:'original'|'gardenSoil'|'gardenLawn'|'oudolf',rediscover:boolean){
 const scene=new T.Scene(),terrain=new CinematicTerrain(scene),noise=new T.Texture(),atmosphere=new WorldAtmosphere(scene,noise);
 const geometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),original=construction.lawn(),mesh=new T.Mesh(geometry,original);
 scene.add(mesh);await Promise.resolve();
 let unused:T.Material|undefined;
 if(kind!=='original'){
  let material:T.MeshStandardMaterial;
  if(kind==='oudolf')material=construction.cut(original);
  else{const garden=construction.garden(original);material=garden[kind];unused=garden[kind==='gardenLawn'?'gardenSoil':'gardenLawn'];}
  assert.equal(material.customProgramCacheKey(),original.customProgramCacheKey(),'actual clone site retains the source key');
  mesh.removeFromParent();mesh.material=material;scene.add(mesh);await Promise.resolve();
 }
 const before=mesh.material,color=before.color.clone(),geometryBytes=Array.from(geometry.attributes.position.array);
 applyRealisticMaterials(scene);dressSunsetGround(scene);
 const inherited=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey(),shader=compile(mesh.material);
 if(rediscover){mesh.removeFromParent();scene.add(mesh);await Promise.resolve();}
 assert.equal(mesh.material.customProgramCacheKey(),key,'a queued rediscovery keeps the inherited program identity');
 assert.deepEqual(pair(compile(mesh.material)),pair(shader),'rediscovery does not change either shader stage');
 assert(mesh.material.color.equals(color));assert.equal(mesh.geometry,geometry);assert.deepEqual(Array.from(geometry.attributes.position.array),geometryBytes);
 assert.equal(mesh.material.userData.realisticProfile,'grass|planar');assert.equal(mesh.material.userData.realisticBaseIsStandard,false);
 return {scene,mesh,atmosphere,inherited,key,shader:compile(mesh.material),dispose(){atmosphere.dispose();terrain.dispose();original.dispose();before.dispose();unused?.dispose();mesh.material.dispose();geometry.dispose();noise.dispose();}};
}

test('actual original, garden and Oudolf lawn lifecycles share source and native program identity with independent bindings',async t=>{
 const cases:Awaited<ReturnType<typeof lawnCase>>[]=[];
 for(const kind of ['original','gardenSoil','gardenLawn','oudolf'] as const)for(const rediscover of [false,true])cases.push(await lawnCase(kind,rediscover));
 t.after(()=>cases.forEach(row=>row.dispose()));
 assert.equal(new Set(cases.map(row=>row.mesh.material.customProgramCacheKey())).size,1);
 assert.equal(new Set(cases.map(row=>row.shader.vertexShader)).size,1);assert.equal(new Set(cases.map(row=>row.shader.fragmentShader)).size,1);
 for(const row of cases){
  assert.equal((row.shader.vertexShader.match(/varying vec3 belleAtmosphereWorld;/g)||[]).length,1);
  assert.equal((row.shader.fragmentShader.match(/float belleLawnFootprint=/g)||[]).length,1);
  assert.equal((row.mesh.material as T.Material&{index0AttributeName?:string}).index0AttributeName,undefined);
 }
 const keys=keyBuilder(),target=new T.WebGLRenderTarget(16,16);t.after(()=>target.dispose());
 for(const output of [null,target]){keys.target(output);assert.equal(new Set(cases.map(row=>keys.key(row.mesh,row.scene))).size,1);assert.equal(new Set(cases.map(row=>keys.key(row.mesh,row.scene,false))).size,1);}
 assert.equal(new Set(cases.map(row=>row.shader.uniforms)).size,cases.length);
 assert.equal(new Set(cases.map(row=>row.shader.uniforms.skinProfile)).size,cases.length);
 assert.equal(new Set(cases.map(row=>row.shader.uniforms.sunsetPigment)).size,cases.length);
 assert.equal(new Set(cases.map(row=>row.shader.uniforms.belleCloudTime)).size,cases.length);
 assert(new Set(cases.map(row=>row.shader.uniforms.sunsetPigment.value.toArray().join(','))).size>=3,'authored lawn colors retain distinct pigment ratios');
 for(const row of cases){assert.deepEqual(row.shader.uniforms.skinProfile.value.toArray(),[.55,.78,.025]);assert.equal(row.shader.uniforms.skinPlanar.value,true);}
 const repeated=compile(cases[0].mesh.material);assert.notEqual(repeated.uniforms.skinProfile,cases[0].shader.uniforms.skinProfile);
 const batch=new StaticPaletteBatch(cases.map(row=>row.mesh));t.after(()=>batch.dispose());assert.equal(batch.stats.batches,0,'custom lawn uniforms remain excluded from palette merging');

 await t.test('the installed uniform uploader switches pigment, projection, textures and owner time through one shared program',()=>{
  const active=[{name:'skinProfile',size:1,type:0x8b51},{name:'skinPlanar',size:1,type:0x8b56},{name:'sunsetPigment',size:1,type:0x8b51},{name:'belleCloudTime',size:1,type:0x1406},{name:'skinColor',size:1,type:0x8b5e}];
  const values=new Map<string,number|number[]>(),bound=new Map<number,T.Texture>();let unit=0;
  const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>active.length,getActiveUniform:(_:unknown,i:number)=>active[i],getUniformLocation:(_:unknown,name:string)=>name,
   uniform1i:(name:string,value:number)=>values.set(name,Number(value)),uniform1f:(name:string,value:number)=>values.set(name,value),uniform3f:(name:string,x:number,y:number,z:number)=>values.set(name,[x,y,z])};
  const sampler={allocateTextureUnit:()=>unit++,setTexture2D:(texture:T.Texture,index:number)=>bound.set(index,texture)};
  const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
  const uniforms=new Uniforms(gl,{});
  cases.forEach((row,i)=>row.atmosphere.uniforms.belleCloudTime.value=10+i);
  for(const i of [0,2,6,4,7,1,3,5,0]){
   const row=cases[i];unit=0;bound.clear();Uniforms.upload(gl,uniforms.seq,row.shader.uniforms,sampler);
   assert.deepEqual(values.get('skinProfile'),[.55,.78,.025]);assert.equal(values.get('skinPlanar'),1);
   assert.deepEqual(values.get('sunsetPigment'),row.shader.uniforms.sunsetPigment.value.toArray());assert.equal(values.get('belleCloudTime'),10+i);
   assert.equal(bound.get(Number(values.get('skinColor'))),row.shader.uniforms.skinColor.value);
  }
 });
});

test('actual 34-pitch static batch keeps its inherited atmosphere key after queued realistic-clone discovery',async t=>{
 const scene=new T.Scene(),noise=new T.Texture(),owner=new WorldAtmosphere(scene,noise),pitch=new T.MeshStandardMaterial({color:0x728260,roughness:.8});
 const ordinary=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({roughness:.8}));scene.add(ordinary);
 const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as {areas:{kind:string;points:[number,number][]}[]};
 const patches=map.areas.filter(area=>area.kind==='pitch'&&area.points.length>=4).map(area=>{
  const mesh=new T.Mesh(construction.poly(area.points,2.012),pitch);mesh.receiveShadow=true;scene.add(mesh);return mesh;
 });
 assert.equal(patches.length,34);await Promise.resolve();
 assert.deepEqual(batchStaticGround(patches),{before:34,after:1});
 const joined=scene.getObjectByName('Joined ground · ') as SurfaceMesh;assert(joined);
 assert.equal(joined.geometry.index!.count,411);assert.equal(joined.geometry.attributes.position.count,205);
 applyRealisticMaterials(scene);
 const shaders=[ordinary,joined].map(mesh=>compile(mesh.material)),keys=[ordinary,joined].map(mesh=>mesh.material.customProgramCacheKey());
 assert.equal(keys[0],keys[1]);await Promise.resolve();
 assert.deepEqual([ordinary,joined].map(mesh=>mesh.material.customProgramCacheKey()),keys);
 assert.deepEqual(pair(compile(joined.material)),pair(shaders[1]));assert.deepEqual(pair(shaders[0]),pair(shaders[1]));
 assert.deepEqual(shaders.map(shader=>shader.uniforms.skinPlanar.value),[false,true]);
 assert.equal(shaders[0].uniforms.belleCloudTime,shaders[1].uniforms.belleCloudTime);
 assert.notEqual(shaders[0].uniforms.skinProfile,shaders[1].uniforms.skinProfile);
 const native=keyBuilder();assert.equal(native.key(ordinary,scene),native.key(joined,scene));
 t.after(()=>{owner.dispose();noise.dispose();pitch.dispose();ordinary.geometry.dispose();ordinary.material.dispose();joined.geometry.dispose();joined.material.dispose();});
});

test('unknown authored callbacks and replacements retain their exact original keys without acquiring provenance from text',async t=>{
 const scene=new T.Scene(),noise=new T.Texture(),owner=new WorldAtmosphere(scene,noise),material=new T.MeshStandardMaterial();
 const originalKey='authored'+suffix,hook:T.Material['onBeforeCompile']=shader=>{shader.fragmentShader='// authored shader\n'+shader.fragmentShader;};
 material.onBeforeCompile=hook;material.customProgramCacheKey=()=>originalKey;
 const keyFunction=material.customProgramCacheKey;scene.add(new T.Mesh(new T.BoxGeometry(),material));await Promise.resolve();
 assert.equal(hasAtmosphereProgram(hook,owner),false);assert.equal(material.customProgramCacheKey(),originalKey+suffix);
 const replacement=material.clone(),replacementHook:T.Material['onBeforeCompile']=shader=>{shader.fragmentShader='// replacement shader\n'+shader.fragmentShader;};
 replacement.onBeforeCompile=replacementHook;replacement.customProgramCacheKey=()=>originalKey+'-replacement';
 scene.add(new T.Mesh(new T.BoxGeometry(),replacement));await Promise.resolve();
 assert.equal(hasAtmosphereProgram(replacementHook,owner),false);assert.equal(replacement.customProgramCacheKey(),originalKey+'-replacement'+suffix);
 assert.notEqual(replacement.customProgramCacheKey(),material.customProgramCacheKey());
 owner.dispose();assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey,keyFunction);assert.equal(replacement.onBeforeCompile,replacementHook);
 t.after(()=>{scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});noise.dispose();});
});

test('different atmosphere owners retain the original key boundary while binding receiving-owner uniforms and restoring hooks',async t=>{
 const a=new T.Scene(),b=new T.Scene(),noiseA=new T.Texture(),noiseB=new T.Texture(),ownerA=new WorldAtmosphere(a,noiseA),ownerB=new WorldAtmosphere(b,noiseB);
 const source=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry();source.customProgramCacheKey=()=>'authored-owner-key';a.add(new T.Mesh(geometry,source));await Promise.resolve();
 const inherited=source.onBeforeCompile,key=source.customProgramCacheKey(),material=source.clone();material.onBeforeCompile=inherited;material.customProgramCacheKey=()=>key;
 const inheritedKey=material.customProgramCacheKey;b.add(new T.Mesh(geometry,material));await Promise.resolve();
 const shaderA=compile(source),shaderB=compile(material);
 assert.equal(material.customProgramCacheKey(),source.customProgramCacheKey()+suffix);assert.deepEqual(pair(shaderA),pair(shaderB));
 assert.equal(shaderA.uniforms.belleCloudTime,ownerA.uniforms.belleCloudTime);assert.equal(shaderB.uniforms.belleCloudTime,ownerB.uniforms.belleCloudTime);
 assert.notEqual(shaderA.uniforms.belleCloudTime,shaderB.uniforms.belleCloudTime);assert.equal(shaderB.uniforms.belleCloudNoise.value,noiseB);
 ownerB.dispose();assert.equal(material.onBeforeCompile,inherited);assert.equal(material.customProgramCacheKey,inheritedKey);
 assert.equal(compile(material).uniforms.belleCloudTime,ownerA.uniforms.belleCloudTime);
 t.after(()=>{ownerA.dispose();source.dispose();material.dispose();geometry.dispose();noiseA.dispose();noiseB.dispose();});
});

test('already-compiled material changing atmosphere owner refreshes native cached uniforms',async t=>{
 for(const changedLights of [false,true])await t.test(changedLights?'changed native light state':'unchanged native light state',async t=>{
  const a=new T.Scene(),b=new T.Scene(),noiseA=new T.Texture(),noiseB=new T.Texture(),ownerA=new WorldAtmosphere(a,noiseA),ownerB=new WorldAtmosphere(b,noiseB);
  const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(),mesh=new T.Mesh(geometry,material),native=nativeMaterialCache();
  let compiled=0;material.onBeforeCompile=()=>{compiled++;};material.customProgramCacheKey=()=>'cached-owner-regression';
  t.after(()=>{ownerB.dispose();ownerA.dispose();material.dispose();geometry.dispose();noiseA.dispose();noiseB.dispose();});
  ownerA.uniforms.belleCloudTime.value=11;ownerB.uniforms.belleCloudTime.value=37;
  a.add(mesh);await Promise.resolve();
  const first=native.select(mesh,a),firstUniforms=native.uniforms(material),version=material.version;
  assert.equal(compiled,1);assert.equal(firstUniforms.belleCloudTime,ownerA.uniforms.belleCloudTime);
  assert.equal(native.select(mesh,a),first);assert.equal(compiled,1,'the real native cache reuses this material before transfer');
  b.add(mesh);await Promise.resolve();if(changedLights)native.lightState.version++;
  assert(material.version>version,'owner discovery invalidates the material through the existing public setter');
  const second=native.select(mesh,b),secondUniforms=native.uniforms(material);
  assert.equal(secondUniforms.belleCloudTime,ownerB.uniforms.belleCloudTime,'the cached uniform table must bind the receiving owner');
  assert.equal(secondUniforms.belleCloudTime.value,37);assert.equal(secondUniforms.belleCloudNoise.value,noiseB);
  assert.equal(compiled,2);assert.notEqual(second,first);assert.notEqual(second.cacheKey,first.cacheKey);
  assert.notEqual(secondUniforms,firstUniforms);assert.deepEqual([second.vertexShader.source,second.fragmentShader.source],[first.vertexShader.source,first.fragmentShader.source]);
  assert.equal(native.select(mesh,b),second);assert.equal(compiled,2);
 });
});

test('already-compiled same-owner clone keeps its native program and correct inherited bindings',async t=>{
 const scene=new T.Scene(),noise=new T.Texture(),owner=new WorldAtmosphere(scene,noise),source=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry();
 let compiled=0;source.onBeforeCompile=()=>{compiled++;};source.customProgramCacheKey=()=>'same-owner-cache';
 scene.add(new T.Mesh(geometry,source));await Promise.resolve();
 const material=source.clone(),key=source.customProgramCacheKey();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=()=>key;
 const mesh=new T.Mesh(geometry,material),native=nativeMaterialCache(),first=native.select(mesh,scene),uniforms=native.uniforms(material);
 t.after(()=>{owner.dispose();source.dispose();material.dispose();geometry.dispose();noise.dispose();});
 assert.equal(compiled,1);assert.equal(uniforms.belleCloudTime,owner.uniforms.belleCloudTime);
 scene.add(mesh);await Promise.resolve();owner.uniforms.belleCloudTime.value=23;
 assert.equal(material.customProgramCacheKey(),key);assert.equal(native.select(mesh,scene),first);assert.equal(compiled,1);
 assert.equal(native.uniforms(material),uniforms);assert.equal(uniforms.belleCloudTime.value,23);
});

test('new and inherited wind retain their program boundaries while atmosphere changes owner',async t=>{
 const a=new T.Scene(),b=new T.Scene(),c=new T.Scene(),noise=new T.Texture(),owners=[a,b,c].map(scene=>new WorldAtmosphere(scene,noise));
 const geometry=new T.BoxGeometry(),source=new T.MeshStandardMaterial();a.add(new T.Mesh(geometry,source));await Promise.resolve();
 const hair=source.clone();hair.onBeforeCompile=source.onBeforeCompile;const sourceKey=source.customProgramCacheKey();hair.customProgramCacheKey=()=>sourceKey;
 const mesh=new T.Mesh(geometry,hair);mesh.name='Hero_Dreadlocks';b.add(mesh);await Promise.resolve();
 const windy=mesh.material,windKey=windy.customProgramCacheKey(),shader=compile(windy);
 assert.notEqual(windKey,sourceKey);assert.match(windKey,/\|wind$/);assert.equal((shader.vertexShader.match(/uniform float belleWindTime,belleWindAmount;/g)||[]).length,1);
 owners[1].update(7,new T.Vector3(0,1,0),.4,1,0,'high',false,false);assert.equal(shader.uniforms.belleWindTime.value,7);
 const inherited=windy.clone();inherited.onBeforeCompile=windy.onBeforeCompile;inherited.customProgramCacheKey=()=>windKey;c.add(new T.Mesh(geometry,inherited));await Promise.resolve();
 const other=compile(inherited);assert.equal(inherited.customProgramCacheKey(),windKey+suffix);assert.deepEqual(pair(other),pair(shader));
 assert.equal(other.uniforms.belleWindTime,shader.uniforms.belleWindTime);assert.equal(other.uniforms.belleCloudTime,owners[2].uniforms.belleCloudTime);
 assert.notEqual(other.uniforms.belleCloudTime,shader.uniforms.belleCloudTime);
 t.after(()=>{for(const owner of owners.reverse())owner.dispose();source.dispose();hair.dispose();inherited.dispose();geometry.dispose();noise.dispose();});
});
