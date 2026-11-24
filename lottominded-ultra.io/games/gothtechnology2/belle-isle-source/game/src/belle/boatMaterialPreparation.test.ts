import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import type * as TS from 'typescript';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLProperties} from 'three/src/renderers/webgl/WebGLProperties.js';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {WORLD_VERTEX,WORLD_FRAGMENT} from './atmosphereShaders.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {addCoastGuard} from './coastGuard.ts';
import {makeBoat} from './riverBoats.ts';
import {BoatRide} from './boatRide.ts';
import {animeRider} from './referenceActors.ts';
import type {ParkTerrain} from './terrain.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type SurfaceMesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Restore=Parameters<WorldAtmosphere['prepareMaterial']>[1];
const ts=createRequire(import.meta.url)('typescript') as typeof TS;
const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
const hash=(array:ArrayBufferView)=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const textures:T.Texture[]=[],savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
// Canvas/DOM stubs let the real constructors run. They do not supply any GL
// result; submitted-source/cache checks below are explicitly CPU checks.
const context=new Proxy<Record<PropertyKey,unknown>>({}, {get(target,key){if(key in target)return target[key];if(key==='measureText')return()=>({width:20});if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});return()=>{};}});
function element(){return {width:0,height:0,dataset:{},style:{},hidden:false,innerHTML:'',textContent:'',getContext:()=>context,
 append(){},prepend(){},remove(){},setAttribute(){},focus(){},setPointerCapture(){},classList:{add(){},remove(){}},querySelector:()=>element(),querySelectorAll:()=>[]};}
before(async()=>{
 Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{dataset:{}},body:element(),createElement:()=>element(),querySelector:()=>element(),querySelectorAll:()=>[],getElementById:()=>element()}});
 const load=T.TextureLoader.prototype.loadAsync;T.TextureLoader.prototype.loadAsync=async url=>{const texture=new T.Texture({width:1,height:1} as HTMLImageElement);texture.name=url;textures.push(texture);return texture;};
 try{await loadRealisticMaterials(renderer);}finally{T.TextureLoader.prototype.loadAsync=load;}
});
after(()=>{textures.forEach(texture=>texture.dispose());if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else Reflect.deleteProperty(globalThis,'document');});
const compile=(material:T.Material)=>{
 const base=material instanceof T.MeshBasicMaterial?T.ShaderLib.basic:T.ShaderLib.standard;
 const shader={uniforms:{},vertexShader:base.vertexShader,fragmentShader:base.fragmentShader,numPointLights:4,numPointLightShadows:0} as Shader;
 if(material instanceof T.ShaderMaterial){shader.vertexShader=material.vertexShader;shader.fragmentShader=material.fragmentShader;shader.uniforms={...material.uniforms};}
 material.onBeforeCompile(shader,renderer);return shader;
};
const meshes=(root:T.Object3D)=>{const result:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh)result.push(o);});return result;};
const materials=(root:T.Object3D)=>[...new Set(meshes(root).flatMap(o=>Array.isArray(o.material)?o.material:[o.material]))];
const selected=(root:T.Object3D,name:string)=>meshes(root).filter((o):o is SurfaceMesh=>!Array.isArray(o.material)&&o.material instanceof T.MeshStandardMaterial&&o.material.name===name);
const value=(v:unknown):unknown=>v instanceof T.Texture?{name:v.name,colorSpace:v.colorSpace,wrapS:v.wrapS,wrapT:v.wrapT,flipY:v.flipY}:v&&typeof v==='object'&&'toArray' in v?(v as T.Vector3).toArray():v;
function state(material:T.Material){
 const names=['type','name','color','emissive','emissiveIntensity','roughness','metalness','opacity','transparent','alphaTest','alphaHash','side','shadowSide','depthWrite','depthTest','depthFunc','colorWrite','blending','premultipliedAlpha','toneMapped','fog','visible','map','normalMap','bumpMap','roughnessMap','metalnessMap','alphaMap','envMap','normalScale','bumpScale','envMapIntensity','defines','userData'];
 return Object.fromEntries(names.filter(name=>name in material).map(name=>[name,value((material as unknown as Record<string,unknown>)[name])]));
}
function snapshot(root:T.Object3D){
 const rows:unknown[]=[];
 const visit=(object:T.Object3D,path:string)=>{
  if(object instanceof T.Mesh){const g=object.geometry as T.BufferGeometry;
   rows.push({path,name:object.name,transform:[...object.position.toArray(),...object.quaternion.toArray(),...object.scale.toArray()],visible:object.visible,cast:object.castShadow,receive:object.receiveShadow,
    renderOrder:object.renderOrder,layers:object.layers.mask,groups:g.groups,drawRange:{start:g.drawRange.start,count:String(g.drawRange.count)},
    attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,hash:hash(a.array)}])),index:g.index?hash(g.index.array):null,
    materials:(Array.isArray(object.material)?object.material:[object.material]).map(state),depth:!!object.customDepthMaterial,distance:!!object.customDistanceMaterial});
  }
  object.children.forEach((child,i)=>visit(child,path+'/'+i));
 };visit(root,'');return rows;
}
function exactAuthoredOrderOnly(before:string,after:string,world:string){
 if(before===after)return;
 // Both complete blocks are taken from the actual composed shader. No sorting
 // or line-wise canonicalization can conceal changes inside helper functions.
 assert(before.startsWith(world));const end=before.indexOf('#define STANDARD');assert(end>world.length);
 const surface=before.slice(world.length,end);assert(surface.startsWith('varying vec3 skinPosition;varying vec3 skinNormal;'));
 assert.equal(after,surface+world+before.slice(end));
}
function compareTrees(a:T.Object3D,b:T.Object3D){
 assert.deepEqual(snapshot(a),snapshot(b),'All geometry bytes, node transforms and material state remain unchanged');
 const am=meshes(a),bm=meshes(b);assert.equal(am.length,bm.length);
 for(let i=0;i<am.length;i++){
  const aMaterial=am[i].material,bMaterial=bm[i].material,aa=Array.isArray(aMaterial)?aMaterial:[aMaterial],bb=Array.isArray(bMaterial)?bMaterial:[bMaterial];assert.equal(aa.length,bb.length);
  for(let j=0;j<aa.length;j++){
   const x=compile(aa[j]),y=compile(bb[j]);exactAuthoredOrderOnly(x.vertexShader,y.vertexShader,WORLD_VERTEX);exactAuthoredOrderOnly(x.fragmentShader,y.fragmentShader,WORLD_FRAGMENT);
   assert.deepEqual(Object.fromEntries(Object.entries(x.uniforms).map(([name,u])=>[name,value(u.value)])),Object.fromEntries(Object.entries(y.uniforms).map(([name,u])=>[name,value(u.value)])));
   for(const stage of [x.vertexShader,y.vertexShader])assert((stage.match(/varying vec3 skinPosition;/g)??[]).length<=1,'No constructor may dress a surface twice');
   for(const stage of [x.fragmentShader,y.fragmentShader])assert((stage.match(/vec3 sampleSkin\(/g)??[]).length<=1);
  }
 }
}

// Execute the pinned renderer's getProgram path and actual WebGLPrograms cache.
// GL functions retain submitted GLSL, without pretending to compile/rasterize it.
function materialCache(){
 assert.equal(T.REVISION,'185');const text=readFileSync(resolve('node_modules/three/src/renderers/WebGLRenderer.js'),'utf8');
 const file=ts.createSourceFile('WebGLRenderer.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),names=['getProgram','updateCommonMaterialProperties','materialNeedsLights'],functions=new Map<string,string>();
 function visit(node:TS.Node){if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text)){assert(!functions.has(node.name.text));functions.set(node.name.text,node.getText(file));}ts.forEachChild(node,visit);}visit(file);assert.equal(functions.size,3);
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createProgram:()=>({}),createShader:(type:number)=>({type,source:''}),shaderSource:(shader:{source:string},source:string)=>{shader.source=source;},compileShader(){},attachShader(){},bindAttribLocation(){},linkProgram(){}};
 const adapter={getContext:()=>gl,getRenderTarget:()=>null,state:{buffers:{depth:{getReversed:()=>false}}},outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const environments={get:()=>null},clipping={numPlanes:0,numIntersection:0,uniform:{value:[]}},Programs=WebGLPrograms as unknown as (...args:unknown[])=>{getParameters:(...args:unknown[])=>Record<string,unknown>;getProgramCacheKey:(p:Record<string,unknown>)=>string};
 const cache=Programs(adapter,environments,{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},{releaseStatesOfProgram(){}},clipping);
 const Properties=WebGLProperties as unknown as ()=>{get:(material:T.Material)=>{uniforms:Record<string,T.IUniform>}},properties=Properties();
 const arrays=Object.fromEntries(['ambient','probe','directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap','directionalShadow','spotShadow','pointShadow','directionalShadowMatrix','spotLightMatrix','pointShadowMatrix'].map(name=>[name,[]]));
 const lights={...arrays,version:1,numSpotLightShadowsWithMaps:0,numLightProbes:0,rectAreaLTC1:null,rectAreaLTC2:null},renderState={state:{lights:{state:lights},shadowsArray:[],lightProbeGridArray:[]}};
 type Program={cacheKey:string;vertexShader:{source:string};fragmentShader:{source:string}};
 const select=Function('properties','programCache','environments','clipping','currentRenderState','_this','_nodesHandler','_emptyScene','onMaterialDispose',[...functions.values()].join('\n')+'\nreturn getProgram;')(properties,cache,environments,clipping,renderState,adapter,null,new T.Scene(),()=>{}) as (material:T.Material,scene:T.Scene,object:T.Object3D)=>Program;
 return {lights,select:(mesh:SurfaceMesh,scene:T.Scene)=>select(mesh.material,scene,mesh),uniforms:(material:T.Material)=>properties.get(material).uniforms,
  baseKey:(mesh:SurfaceMesh,scene:T.Scene)=>cache.getProgramCacheKey({...cache.getParameters(mesh.material,lights,[],scene,mesh,[]),customProgramCacheKey:''})};
}
async function reference(scene:T.Scene,side:T.Side){const object=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({name:'ordinary concrete',side}));object.castShadow=object.receiveShadow=true;scene.add(object);await Promise.resolve();applyRealisticMaterials(object);return object;}
function preparation(owner:WorldAtmosphere){const restores=new Map<T.Material,Restore>();return{restores,prepare:(material:T.MeshStandardMaterial,restore:Restore)=>{assert(!restores.has(material));restores.set(material,restore);owner.prepareMaterial(material,restore);}};}
const terrain={land:()=>false,raycastFlight:()=>null,raycastCamera:()=>null} as unknown as ParkTerrain;
async function asset(file:string){const bytes=readFileSync(resolve('public',file)),loader=new GLTFLoader();loader.register(()=>({name:'CPU_ONLY_TEXTURES',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(Uint8Array.from(bytes).buffer,'');}
async function constructBoats(prepared:boolean,edit?:(assets:{offshore:T.Object3D;hydroplane:T.Object3D})=>void){
 const [offshore,hydroplane,rider]=await Promise.all([asset('belle/vehicles/speedboat.glb'),asset('belle/vehicles/hydroplane.glb'),asset('exports/rigged-heroes/DS_Armored_Rider_01.glb')]);
 const assets={offshore:offshore.scene,hydroplane:hydroplane.scene};edit?.(assets);
 const originals=new Map(materials(offshore.scene).concat(materials(hydroplane.scene)).map(material=>[material,{uuid:material.uuid,compile:material.onBeforeCompile,key:material.customProgramCacheKey}]));
 const geometries=new Map(meshes(offshore.scene).concat(meshes(hydroplane.scene)).map(mesh=>[mesh,{geometry:mesh.geometry,attributes:{...mesh.geometry.attributes},index:mesh.geometry.index}]));
 const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),refs={front:await reference(scene,T.FrontSide),double:await reference(scene,T.DoubleSide)},preparedMaterials=preparation(owner);
 // The runtime rider is already decorated before its two skeleton clones. The
 // actual rig/IK remains active; its unknown authored shader must stay queued.
 scene.add(rider.scene);applyRealisticMaterials(rider.scene,'actor');animeRider(rider.scene);await Promise.resolve();
 const riderMaterials=new Map(materials(rider.scene).map(material=>[material,{compile:material.onBeforeCompile,key:material.customProgramCacheKey}]));
 const ride=new BoatRide(scene,terrain,rider.scene,{allowed:()=>true,enter(){},exit(){},night:()=>.4,...(prepared?{prepareMaterial:preparedMaterials.prepare}:{})},assets);
 for(const [material,old]of originals){assert.equal(material.uuid,old.uuid);assert.equal(material.onBeforeCompile,old.compile);assert.equal(material.customProgramCacheKey,old.key);}
 for(const [mesh,old]of geometries){assert.equal(mesh.geometry,old.geometry);assert.equal(mesh.geometry.index,old.index);for(const [name,attribute]of Object.entries(old.attributes))assert.equal(mesh.geometry.attributes[name],attribute);}
 for(const [material,old]of riderMaterials){assert.equal(material.onBeforeCompile,old.compile);assert.equal(material.customProgramCacheKey,old.key);assert(!preparedMaterials.restores.has(material));}
 await Promise.resolve();return {scene,owner,refs,assets,ride,...preparedMaterials};
}

test('both actual Coast Guard response boats prepare once and share the earlier FrontSide program',async()=>{
 const build=async(prepared:boolean)=>{const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),ref=await reference(scene,T.FrontSide),p=preparation(owner);const coast=addCoastGuard(scene,prepared?p.prepare:undefined);applyRealisticMaterials(coast.root,'',owner.prepareMaterial.bind(owner));applyRealisticMaterials(scene);await Promise.resolve();return{scene,owner,ref,coast,...p};};
 const before=await build(false),after=await build(true);try{
  compareTrees(before.coast.root,after.coast.root);assert.equal(after.coast.stats.responseBoats,2);assert.equal(after.restores.size,12);
  const cache=materialCache(),referenceProgram=cache.select(after.ref,after.scene),baselineCache=materialCache(),oldReference=baselineCache.select(before.ref,before.scene);
  const hulls=selected(after.coast.root,'Boat painted hull'),oldHulls=selected(before.coast.root,'Boat painted hull');assert.equal(hulls.length,2);assert.equal(oldHulls.length,2);assert.notEqual(hulls[0].material,hulls[1].material);
  for(let i=0;i<hulls.length;i++){
   assert.notEqual(baselineCache.select(oldHulls[i],before.scene),oldReference);assert.equal(cache.select(hulls[i],after.scene),referenceProgram);assert.equal(cache.baseKey(hulls[i],after.scene),cache.baseKey(after.ref,after.scene));
   const u=cache.uniforms(hulls[i].material),r=cache.uniforms(after.ref.material);assert.notEqual(u,r);assert.notEqual(u.skinProfile,r.skinProfile);assert.notEqual(u.skinColor.value,r.skinColor.value);assert.deepEqual(u.skinProfile.value.toArray(),[6,0,.0005]);assert.equal(u.skinPlanar.value,false);assert.equal(u.belleCloudTime,after.owner.uniforms.belleCloudTime);
  }
  assert.notEqual(cache.uniforms(hulls[0].material).skinProfile,cache.uniforms(hulls[1].material).skinProfile);
  const keys=hulls.map(o=>o.material.customProgramCacheKey()),count=after.owner.stats.materials;after.scene.remove(after.coast.root);after.scene.add(after.coast.root);await Promise.resolve();assert.equal(after.owner.stats.materials,count);assert.deepEqual(hulls.map(o=>o.material.customProgramCacheKey()),keys);
  before.coast.update(13,.7);after.coast.update(13,.7);assert.deepEqual(snapshot(before.coast.root),snapshot(after.coast.root));
  after.owner.dispose();for(const [material,restore]of after.restores){assert.equal(material.onBeforeCompile,restore.compile);assert.equal(material.customProgramCacheKey,restore.key);assert.doesNotMatch(compile(material).vertexShader,/belleAtmosphereWorld/);assert.match(compile(material).vertexShader,/skinPosition/);}
 }finally{before.owner.dispose();after.owner.dispose();}
});

test('actual offshore and hydroplane constructors preserve every surface and merge only compatible native shader axes',async()=>{
 const before=await constructBoats(false),after=await constructBoats(true);try{
  compareTrees(before.assets.offshore,after.assets.offshore);compareTrees(before.assets.hydroplane,after.assets.hydroplane);
  const cache=materialCache(),referenceProgram=cache.select(after.refs.double,after.scene),oldCache=materialCache(),oldReference=oldCache.select(before.refs.double,before.scene);
  for(const [kind,name,profile,counts]of [['offshore','Charcoal marine upholstery',[12,0,.001],[1536,3564]],['hydroplane','Hydro cockpit charcoal',[9,0,.002],[1536,1248]]] as const){
   const current=selected(after.assets[kind],name),old=selected(before.assets[kind],name);assert.equal(current.length,2);assert.deepEqual(current.map(o=>o.geometry.index!.count),counts);
   for(let i=0;i<current.length;i++){
    assert.equal(current[i].material.side,T.DoubleSide);assert.equal(current[i].material.userData.realisticBaseIsStandard,true);assert.equal(cache.baseKey(current[i],after.scene),cache.baseKey(after.refs.double,after.scene));
    assert.notEqual(oldCache.select(old[i],before.scene),oldReference);assert.equal(cache.select(current[i],after.scene),referenceProgram);
    const u=cache.uniforms(current[i].material),r=cache.uniforms(after.refs.double.material);assert.deepEqual(u.skinProfile.value.toArray(),profile);assert.equal(u.skinPlanar.value,false);assert.equal(u.belleCloudTime,after.owner.uniforms.belleCloudTime);assert.notEqual(u,r);assert.notEqual(u.skinColor.value,r.skinColor.value);
   }
  }
  const offshore=selected(after.assets.offshore,'Charcoal marine upholstery')[0],hydro=selected(after.assets.hydroplane,'Hydro cockpit charcoal')[0];assert.notEqual(offshore.material,hydro.material);assert.notEqual(cache.uniforms(offshore.material).skinProfile,cache.uniforms(hydro.material).skinProfile);assert.notEqual(cache.uniforms(offshore.material).skinDetail.value,cache.uniforms(hydro.material).skinDetail.value);
  for(const kind of ['offshore','hydroplane'] as const){before.ride.board(kind);after.ride.board(kind);before.ride.update(1/60,true,2,true);after.ride.update(1/60,true,2,true);assert.deepEqual(before.ride.sim.pose,after.ride.sim.pose);assert.deepEqual(snapshot(before.assets[kind]),snapshot(after.assets[kind]));}
  before.ride.leave();after.ride.leave();assert.deepEqual(snapshot(before.assets.offshore),snapshot(after.assets.offshore));assert.deepEqual(snapshot(before.assets.hydroplane),snapshot(after.assets.hydroplane));
  after.owner.dispose();for(const [material,restore]of after.restores){assert.equal(material.onBeforeCompile,restore.compile);assert.equal(material.customProgramCacheKey,restore.key);assert.doesNotMatch(compile(material).vertexShader,/belleAtmosphereWorld/);}
 }finally{before.owner.dispose();after.owner.dispose();}
});

for(const authored of ['hook','key'] as const)test('actual boat '+authored+' remains isolated from optional native-base preparation',async()=>{
 const calls:{receiver:unknown}[]=[];
 const edit=(assets:{offshore:T.Object3D})=>{const material=selected(assets.offshore,'Charcoal marine upholstery')[0].material;if(authored==='hook')material.onBeforeCompile=function(this:T.Material,shader){calls.push({receiver:this});shader.uniforms.authoredBoat={value:23};};else material.customProgramCacheKey=()=> 'authored-boat-key';};
 const before=await constructBoats(false,edit),after=await constructBoats(true,edit);try{
  const a=selected(before.assets.offshore,'Charcoal marine upholstery')[0].material,b=selected(after.assets.offshore,'Charcoal marine upholstery')[0].material;
  assert(!after.restores.has(b));assert.equal(a.customProgramCacheKey(),b.customProgramCacheKey());const x=compile(a),y=compile(b);assert.equal(x.vertexShader,y.vertexShader);assert.equal(x.fragmentShader,y.fragmentShader);
  if(authored==='hook'){assert.equal(x.uniforms.authoredBoat.value,23);assert.equal(y.uniforms.authoredBoat.value,23);assert(calls.length>=2);assert(calls.every(row=>row.receiver===undefined),'The pre-existing realistic wrapper receiver is retained');}
 }finally{before.owner.dispose();after.owner.dispose();}
});

test('an already selected response material follows a new owner through the actual renderer cache',async()=>{
 const a=new T.Scene(),b=new T.Scene(),ownerA=new WorldAtmosphere(a,new T.Texture()),ownerB=new WorldAtmosphere(b,new T.Texture()),boat=makeBoat('response',ownerA.prepareMaterial.bind(ownerA)),cache=materialCache();
 try{
  ownerA.uniforms.belleCloudTime.value=11;ownerB.uniforms.belleCloudTime.value=37;a.add(boat);await Promise.resolve();const hull=selected(boat,'Boat painted hull')[0],first=cache.select(hull,a),old=cache.uniforms(hull.material);
  assert.equal(old.belleCloudTime,ownerA.uniforms.belleCloudTime);b.add(boat);await Promise.resolve();cache.lights.version++;const second=cache.select(hull,b),current=cache.uniforms(hull.material);
  assert.notEqual(second,first);assert.notEqual(current,old);assert.equal(current.belleCloudTime,ownerB.uniforms.belleCloudTime);assert.equal(current.belleCloudTime.value,37);assert.equal(second.vertexShader.source,first.vertexShader.source);assert.equal(second.fragmentShader.source,first.fragmentShader.source);
 }finally{ownerB.dispose();ownerA.dispose();}
});
