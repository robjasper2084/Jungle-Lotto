import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLProperties} from 'three/src/renderers/webgl/WebGLProperties.js';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {animeRider} from './referenceActors.ts';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type SurfaceMesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
const textures:T.Texture[]=[];
before(async()=>{const load=T.TextureLoader.prototype.loadAsync;T.TextureLoader.prototype.loadAsync=async url=>{const texture=new T.Texture({width:1,height:1} as HTMLImageElement);texture.name=url;textures.push(texture);return texture;};try{await loadRealisticMaterials(renderer);}finally{T.TextureLoader.prototype.loadAsync=load;}});
after(()=>textures.forEach(texture=>texture.dispose()));
const compile=(material:T.Material)=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,numPointLights:4,numPointLightShadows:0} as Shader;material.onBeforeCompile(shader,renderer);return shader;};
const stages=(shader:Shader)=>[shader.vertexShader,shader.fragmentShader];
const mesh=(name='EUC_Rubber',side:T.Side=T.DoubleSide)=>new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({name,side}));

// Execute the installed renderer's actual per-material cache and uniform path.
// GL sinks retain submitted source only; this is not a native pixel assertion.
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


for(const [name,side,profile]of [['Station white painted cladding',T.FrontSide,[6,0,.0005]],['EUC_Rubber',T.DoubleSide,[9,0,.002]]] as const){
 test('fresh '+name+' preparation reuses the earlier program with separate surface bindings',async t=>{
  const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),early=mesh('ordinary concrete',side),late=mesh(name,side),cache=nativeMaterialCache();t.after(()=>owner.dispose());
  scene.add(early);await Promise.resolve();applyRealisticMaterials(early);const earlyProgram=cache.select(early,scene);
  const source=late.material,sourceCompile=source.onBeforeCompile,sourceKey=source.customProgramCacheKey,sourceUuid=source.uuid,geometry=late.geometry;
  scene.add(late);const made=applyRealisticMaterials(late,'',owner.prepareMaterial.bind(owner));assert.equal(made.length,1);await Promise.resolve();
  const lateProgram=cache.select(late,scene),a=cache.uniforms(early.material),b=cache.uniforms(late.material);
  assert.equal(lateProgram,earlyProgram);assert.deepEqual(stages(compile(late.material)),stages(compile(early.material)));
  assert.notEqual(a,b);assert.notEqual(a.skinProfile,b.skinProfile);assert.notEqual(a.skinColor,b.skinColor);assert.notEqual(a.skinColor.value,b.skinColor.value);assert.deepEqual((b.skinProfile.value as T.Vector3).toArray(),profile);
  assert.equal(a.belleCloudTime,owner.uniforms.belleCloudTime);assert.equal(b.belleCloudTime,owner.uniforms.belleCloudTime);owner.uniforms.belleCloudTime.value=43;assert.equal(b.belleCloudTime.value,43);
  assert.notEqual(late.material,source);assert.equal(source.onBeforeCompile,sourceCompile);assert.equal(source.customProgramCacheKey,sourceKey);assert.equal(source.uuid,sourceUuid);assert.equal(late.geometry,geometry);
  assert.equal(late.material.userData.realisticBaseIsStandard,true);assert.equal(late.material.userData.realisticProfile,name.startsWith('Station')?'paint|triplanar':'rubber|triplanar');
  const key=late.material.customProgramCacheKey(),count=owner.stats.materials;scene.remove(late);scene.add(late);await Promise.resolve();assert.equal(owner.stats.materials,count);assert.equal(late.material.customProgramCacheKey(),key);assert.equal(cache.select(late,scene),lateProgram);
 });
}

test('fresh preparation restores the exact completed surface callback and key on disposal',async()=>{
 const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),object=mesh();
 let restore:Parameters<WorldAtmosphere['prepareMaterial']>[1]|undefined;
 scene.add(object);applyRealisticMaterials(object,'',(material,original)=>{restore=original;owner.prepareMaterial(material,original);});await Promise.resolve();
 assert(restore);assert.notEqual(object.material.onBeforeCompile,restore.compile);assert.match(compile(object.material).vertexShader,/belleAtmosphereWorld/);
 owner.dispose();assert.equal(object.material.onBeforeCompile,restore.compile);assert.equal(object.material.customProgramCacheKey,restore.key);
 const shader=compile(object.material);assert.match(shader.vertexShader,/skinPosition/);assert.doesNotMatch(shader.vertexShader,/belleAtmosphereWorld/);
 const callback=object.material.onBeforeCompile,key=object.material.customProgramCacheKey;owner.prepareMaterial(object.material,restore);assert.equal(object.material.onBeforeCompile,callback);assert.equal(object.material.customProgramCacheKey,key);
});

for(const changeLights of [false,true])test('compiled prepared clone follows a new atmosphere owner'+(changeLights?' after light-state change':''),async()=>{
 const a=new T.Scene(),b=new T.Scene(),ownerA=new WorldAtmosphere(a,new T.Texture()),ownerB=new WorldAtmosphere(b,new T.Texture()),object=mesh(),cache=nativeMaterialCache();
 try{
  ownerA.uniforms.belleCloudTime.value=11;ownerB.uniforms.belleCloudTime.value=37;
  a.add(object);applyRealisticMaterials(object,'',ownerA.prepareMaterial.bind(ownerA));await Promise.resolve();
  const first=cache.select(object,a),old=cache.uniforms(object.material);assert.equal(old.belleCloudTime,ownerA.uniforms.belleCloudTime);
  b.add(object);await Promise.resolve();if(changeLights)cache.lightState.version++;
  const second=cache.select(object,b),current=cache.uniforms(object.material);
  assert.notEqual(second,first);assert.notEqual(current,old);assert.equal(current.belleCloudTime,ownerB.uniforms.belleCloudTime);assert.equal(current.belleCloudNoise,ownerB.uniforms.belleCloudNoise);assert.equal(current.belleCloudTime.value,37);
  assert.equal(second.vertexShader.source,first.vertexShader.source);assert.equal(second.fragmentShader.source,first.fragmentShader.source);
 }finally{ownerB.dispose();ownerA.dispose();}
});

test('authored base callbacks and authored cache keys retain their existing composition and receiver',async()=>{
 for(const customHook of [false,true]){
  const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),object=mesh();let calls=0,receiver:unknown=Symbol('not called'),preparations=0;
  if(customHook)object.material.onBeforeCompile=function(this:T.Material,shader){calls++;receiver=this;shader.uniforms.authored={value:23};};
  else object.material.customProgramCacheKey=()=> 'authored-native-base-key';
  const originalKey=object.material.customProgramCacheKey();scene.add(object);
  applyRealisticMaterials(object,'',()=>{preparations++;throw Error('Unknown authored identity must remain unprepared');});await Promise.resolve();
  const shader=compile(object.material);assert.equal(preparations,0);assert.equal(object.material.customProgramCacheKey(),originalKey+'-higgsfield-surface-v5|belle-pbr-v1|belle-height-fog-clouds-v2');
  if(customHook){assert.equal(calls,1);assert.equal(receiver,undefined,'Existing realistic wrapper invokes an authored callback without binding this');assert.equal(shader.uniforms.authored.value,23);}
  owner.dispose();
 }
});

test('preparing only the wheel leaves the rider anime and wind pass queued in its original order',async()=>{
 const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture()),root=new T.Group(),vehicle=new T.Group(),rider=new T.Group(),body=mesh('riding cloth'),wheel=mesh();body.name='Hero_Body';root.add(vehicle,rider);vehicle.add(wheel);rider.add(body);scene.add(root);
 applyRealisticMaterials(vehicle,'actor',owner.prepareMaterial.bind(owner));applyRealisticMaterials(root,'actor');animeRider(rider);
 assert.equal(owner.stats.windMeshes,0);assert.equal(body.customDepthMaterial,undefined);assert.equal(body.material.customProgramCacheKey(),'reference-original-rider-anime-v1');assert.doesNotMatch(compile(body.material).vertexShader,/belleAtmosphereWorld/);
 await Promise.resolve();assert.equal(owner.stats.windMeshes,1);assert(body.customDepthMaterial);assert(body.customDistanceMaterial);
 const shader=compile(body.material);assert.match(shader.vertexShader,/belleWindRange/);assert.match(shader.vertexShader,/belleAtmosphereWorld/);assert.match(shader.fragmentShader,/animeBand/);assert.doesNotMatch(shader.fragmentShader,/skinWeights/);
 owner.dispose();
});

test('actual shipped wheel preserves loaded material identities and all attribute objects during scoped surface preparation',async()=>{
 const bytes=readFileSync(new URL('../../public/exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb',import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'CPU_MATERIAL_TEST',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const source=new Map<T.Material,{uuid:string;compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']}>();gltf.scene.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])source.set(material,{uuid:material.uuid,compile:material.onBeforeCompile,key:material.customProgramCacheKey});});
 const display=gltf.scene.clone(true),geometry=new Map<T.Mesh,T.BufferGeometry>();display.traverse(o=>{if(o instanceof T.Mesh)geometry.set(o,o.geometry);});
 const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture());scene.add(display);applyRealisticMaterials(display,'actor',owner.prepareMaterial.bind(owner));
 // Observe before the ordinary queued pass, which can independently decorate
 // source-shared materials intentionally excluded by the surface classifier.
 for(const [material,row]of source){assert.equal(material.uuid,row.uuid);assert.equal(material.onBeforeCompile,row.compile);assert.equal(material.customProgramCacheKey,row.key);}
 for(const [object,g]of geometry)assert.equal(object.geometry,g);
 await Promise.resolve();const rubber:SurfaceMesh[]=[];display.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)&&o.material.name==='EUC_Rubber')rubber.push(o as SurfaceMesh);});assert.equal(rubber.length,9);
 const dressed=rubber.filter(o=>o.material.userData.realisticSurface==='rubber'),cushion=rubber.find(o=>o.name==='Top_Cushion')!,optical=rubber.filter(o=>['Headlamp_Recess','Rear_Lamp_Housing'].includes(o.name));
 assert.equal(dressed.length,6);assert.equal(optical.length,2);
 for(const object of dressed){assert.equal(object.material.userData.realisticBaseIsStandard,true);assert.deepEqual((compile(object.material).uniforms.skinProfile.value as T.Vector3).toArray(),[9,0,.002]);}
 assert.equal(new Set(dressed.map(o=>o.material)).size,1,'The six same-profile pieces retain their shared surface clone');
 assert.notEqual(cushion.material,dressed[0].material);assert.equal(cushion.material.userData.realisticProfile,'cloth|triplanar');assert.deepEqual((compile(cushion.material).uniforms.skinProfile.value as T.Vector3).toArray(),[14,0,.0015]);
 for(const object of optical){assert(source.has(object.material),'Existing optical exclusions keep the actual source material');assert.equal(object.material.userData.realisticSurface,undefined);assert.equal(compile(object.material).uniforms.skinProfile,undefined);}
 owner.dispose();
});
