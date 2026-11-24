import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {dressSunsetGround} from './sunsetGround.ts';
import {batchStaticGround} from './staticGroundBatch.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';

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
 assert.equal(hasAtmosphereProgram(hook),false);assert.equal(material.customProgramCacheKey(),originalKey+suffix);
 const replacement=material.clone(),replacementHook:T.Material['onBeforeCompile']=shader=>{shader.fragmentShader='// replacement shader\n'+shader.fragmentShader;};
 replacement.onBeforeCompile=replacementHook;replacement.customProgramCacheKey=()=>originalKey+'-replacement';
 scene.add(new T.Mesh(new T.BoxGeometry(),replacement));await Promise.resolve();
 assert.equal(hasAtmosphereProgram(replacementHook),false);assert.equal(replacement.customProgramCacheKey(),originalKey+'-replacement'+suffix);
 assert.notEqual(replacement.customProgramCacheKey(),material.customProgramCacheKey());
 owner.dispose();assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey,keyFunction);assert.equal(replacement.onBeforeCompile,replacementHook);
 t.after(()=>{scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});noise.dispose();});
});

test('different atmosphere owners preserve shared shader identity while binding receiving-owner uniforms and restoring hooks',async t=>{
 const a=new T.Scene(),b=new T.Scene(),noiseA=new T.Texture(),noiseB=new T.Texture(),ownerA=new WorldAtmosphere(a,noiseA),ownerB=new WorldAtmosphere(b,noiseB);
 const source=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry();source.customProgramCacheKey=()=>'authored-owner-key';a.add(new T.Mesh(geometry,source));await Promise.resolve();
 const inherited=source.onBeforeCompile,key=source.customProgramCacheKey(),material=source.clone();material.onBeforeCompile=inherited;material.customProgramCacheKey=()=>key;
 const inheritedKey=material.customProgramCacheKey;b.add(new T.Mesh(geometry,material));await Promise.resolve();
 const shaderA=compile(source),shaderB=compile(material);
 assert.equal(material.customProgramCacheKey(),source.customProgramCacheKey());assert.deepEqual(pair(shaderA),pair(shaderB));
 assert.equal(shaderA.uniforms.belleCloudTime,ownerA.uniforms.belleCloudTime);assert.equal(shaderB.uniforms.belleCloudTime,ownerB.uniforms.belleCloudTime);
 assert.notEqual(shaderA.uniforms.belleCloudTime,shaderB.uniforms.belleCloudTime);assert.equal(shaderB.uniforms.belleCloudNoise.value,noiseB);
 ownerB.dispose();assert.equal(material.onBeforeCompile,inherited);assert.equal(material.customProgramCacheKey,inheritedKey);
 assert.equal(compile(material).uniforms.belleCloudTime,ownerA.uniforms.belleCloudTime);
 t.after(()=>{ownerA.dispose();source.dispose();material.dispose();geometry.dispose();noiseA.dispose();noiseB.dispose();});
});

test('new wind remains a distinct program and inherited wind keeps its own binding while atmosphere changes owner',async t=>{
 const a=new T.Scene(),b=new T.Scene(),c=new T.Scene(),noise=new T.Texture(),owners=[a,b,c].map(scene=>new WorldAtmosphere(scene,noise));
 const geometry=new T.BoxGeometry(),source=new T.MeshStandardMaterial();a.add(new T.Mesh(geometry,source));await Promise.resolve();
 const hair=source.clone();hair.onBeforeCompile=source.onBeforeCompile;const sourceKey=source.customProgramCacheKey();hair.customProgramCacheKey=()=>sourceKey;
 const mesh=new T.Mesh(geometry,hair);mesh.name='Hero_Dreadlocks';b.add(mesh);await Promise.resolve();
 const windy=mesh.material,windKey=windy.customProgramCacheKey(),shader=compile(windy);
 assert.notEqual(windKey,sourceKey);assert.match(windKey,/\|wind$/);assert.equal((shader.vertexShader.match(/uniform float belleWindTime,belleWindAmount;/g)||[]).length,1);
 owners[1].update(7,new T.Vector3(0,1,0),.4,1,0,'high',false,false);assert.equal(shader.uniforms.belleWindTime.value,7);
 const inherited=windy.clone();inherited.onBeforeCompile=windy.onBeforeCompile;inherited.customProgramCacheKey=()=>windKey;c.add(new T.Mesh(geometry,inherited));await Promise.resolve();
 const other=compile(inherited);assert.equal(inherited.customProgramCacheKey(),windKey);assert.deepEqual(pair(other),pair(shader));
 assert.equal(other.uniforms.belleWindTime,shader.uniforms.belleWindTime);assert.equal(other.uniforms.belleCloudTime,owners[2].uniforms.belleCloudTime);
 assert.notEqual(other.uniforms.belleCloudTime,shader.uniforms.belleCloudTime);
 t.after(()=>{for(const owner of owners.reverse())owner.dispose();source.dispose();hair.dispose();inherited.dispose();geometry.dispose();noise.dispose();});
});
