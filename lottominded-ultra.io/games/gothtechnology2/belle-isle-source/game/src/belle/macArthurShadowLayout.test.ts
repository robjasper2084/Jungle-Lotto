import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {cullMacArthurSpans,type MacArthurUvReceipt} from './macArthurSpanCulling.ts';
import {finishMacArthurConcrete} from './macArthurSurface.ts';
import {finishMacArthurRailings} from './macArthurRailFinish.ts';
import {tuneConservatoryMaterial} from './conservatoryVisuals.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from './realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from './photoReferenceSurfaces.ts';
import {dressSunsetGround} from './sunsetGround.ts';
import {addReferenceIsland} from './referenceIsland.ts';
import {LandmarkDetail} from './landmarkDetail.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';
import {installStagedLandmarkStudies} from './stagedLandmarkStudies.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
const names=['MacArthur_MacArthur_galvanized_crash_barrier','MacArthur_MacArthur_sidewalk_expansion_joints','MacArthur_Painted_steel_glazing_bars','MacArthur_Patinated_bronze'];
const hash=(bytes:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength)).digest('hex');
const receipt=(mesh:T.Mesh):MacArthurUvReceipt=>{assert(!Array.isArray(mesh.material));return {geometry:mesh.geometry,material:mesh.material,compile:mesh.material.onBeforeCompile,key:mesh.material.customProgramCacheKey};};
const approvals=(mesh:T.Mesh)=>new Map([[mesh,receipt(mesh)]]);
const compile=(material:T.Material)=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,numPointLights:4,numPointLightShadows:0} as Shader;material.onBeforeCompile(shader,renderer);return shader;};
function span(source:string,start:string,end:string){assert.equal(source.split(start).length,2);const a=source.indexOf(start),b=source.indexOf(end,a);assert(b>a);return source.slice(a,b);}
const transpile=(source:string)=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture(material:T.Material=new T.MeshStandardMaterial({side:T.DoubleSide})){
 const geometry=new T.BoxGeometry(160,2,8,16,1,1);geometry.clearGroups();geometry.deleteAttribute('uv');
 const mesh=new T.Mesh(geometry,material);mesh.name=names[0];mesh.updateMatrixWorld(true);return mesh;
}
function parameters(){
 let target:T.WebGLRenderTarget|null=null;
 const adapter={getRenderTarget:()=>target,state:{buffers:{depth:{getReversed:()=>false}}},outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const programFactory=WebGLPrograms as unknown as (...args:unknown[])=>{getParameters:(...args:unknown[])=>unknown;getProgramCacheKey:(p:unknown)=>string};
 const programs=programFactory(adapter,{get:()=>null},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},null,{numPlanes:0,numIntersection:0});
 const lights=Object.fromEntries(['directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap'].map(name=>[name,[]]));Object.assign(lights,{numSpotLightShadowsWithMaps:0,numLightProbes:0});
 const scene=new T.Scene(),offscreen=new T.WebGLRenderTarget(16,16),light=new T.DirectionalLight();
 return {keys(mesh:T.Mesh,material:T.Material){return [null,offscreen].map(value=>{target=value;return programs.getProgramCacheKey(programs.getParameters(material,lights,[light],scene,mesh,[]));});},dispose:()=>offscreen.dispose()};
}

test('the actual four MacArthur display inputs survive real queued construction and preserve geometry, shaders and every shadow range',async t=>{
 const oldSelf=globalThis.self,oldFetch=globalThis.fetch,oldLoad=T.TextureLoader.prototype.load;
 const textures:T.Texture[]=[];globalThis.self=globalThis as unknown as Window&typeof globalThis;
 T.TextureLoader.prototype.load=function(url,onLoad){const texture=new T.Texture({width:1,height:1,src:url} as HTMLImageElement);textures.push(texture);queueMicrotask(()=>onLoad?.(texture));return texture;};
 const requested:string[]=[];
 globalThis.fetch=async input=>{const url=String(input);assert(['./belle/landmark-detail.json','./belle/landmark-detail.bin'].includes(url),'Unexpected CPU network input: '+url);requested.push(url);return new Response(readFileSync(new URL('../../public/'+url.slice(2),import.meta.url)));};
 t.after(()=>{globalThis.self=oldSelf;globalThis.fetch=oldFetch;T.TextureLoader.prototype.load=oldLoad;textures.forEach(value=>value.dispose());});
 const bytes=readFileSync(new URL('../../public/belle/landmarks.glb',import.meta.url));assert.equal(hash(bytes),'560632f68f9f68974fef2f2f09f2e436f6742658ac864e35091e1c9a7c79e80f');
 const [asset]=await Promise.all([new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),loadRealisticMaterials(renderer)]);
 const scene=new T.Scene(),owner=new WorldAtmosphere(scene,new T.Texture());t.after(()=>owner.dispose());
 const world=readFileSync(new URL('./world.ts',import.meta.url),'utf8');
 const decoration=span(world,'scene.add(landmarks.scene);const bridgePhotoFinish=','\n // Remove only the old solid Yacht Club shell');
 // This exact world slice now includes an opt-in asynchronous staging block.
 // Bind the real module metadata instead of evaluating import.meta in a
 // dynamically constructed function, and await the actual decoration.
 assert.equal(decoration.split('import.meta').length,2,'Expected one staging metadata reference in the original world slice');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor as FunctionConstructor;
 const stages:string[]=[];
 await AsyncFunction('scene','landmarks','T','finishMacArthurConcrete','finishMacArthurRailings','tuneConservatoryMaterial','moduleMeta','loader','status','installStagedLandmarkStudies',
  transpile(decoration.replace('import.meta','moduleMeta')))(scene,asset,T,finishMacArthurConcrete,finishMacArthurRailings,tuneConservatoryMaterial,import.meta,new GLTFLoader(),(stage:string)=>stages.push(stage),installStagedLandmarkStudies);
 assert.deepEqual(stages,[],'The ordinary Node module path must not enable the opt-in staging build.');
 // The original landmarks were registered before the later whole-scene dress.
 await Promise.resolve();applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);
 const capture=span(world,'const macArthurShadowUvReceipts=','\n const referenceGarden=');
 const approved=Function('T','landmarks',transpile(capture)+'\nreturn macArthurShadowUvReceipts;')(T,asset) as Map<T.Mesh,MacArthurUvReceipt>;
 assert.equal(approved.size,4);assert.deepEqual([...approved.keys()].map(mesh=>mesh.name),names);
 // Execute the actual intervening asynchronous constructors, including real
 // startup yields and the installed Meshopt decoder, rather than flushing only
 // a resolved Promise. CPU texture pixels are the only mocked rendering input.
 const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
 await addReferenceIsland(scene,map,new ParkTerrain(map));
 const detail=new LandmarkDetail(asset);await detail.prepareDistant(scene);await Promise.resolve();
 assert(detail.stats.simplified>0);assert.deepEqual(requested.sort(),['./belle/landmark-detail.bin','./belle/landmark-detail.json']);
 for(const [mesh,input]of approved){assert.equal(mesh.material,input.material);assert.equal(mesh.geometry,input.geometry);assert.equal(input.material.onBeforeCompile,input.compile);assert.equal(input.material.customProgramCacheKey,input.key);}
 const selected:T.Mesh[]=[];asset.scene.traverse(object=>{if(object instanceof T.Mesh&&/^MacArthur[ _]/.test(object.name))selected.push(object);});assert.equal(selected.length,5);
 scene.updateMatrixWorld(true);
 const baseline=new T.Group(),copies=new Map<T.Mesh,T.Mesh>(),sources=new Map<T.Mesh,{geometry:T.BufferGeometry;attributes:Record<string,T.BufferAttribute|T.InterleavedBufferAttribute>;attributeHashes:Record<string,string>;index:T.BufferAttribute;indexHash:string;callback:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey'];stages:string[];nativeKeys:string[];depthKeys:string[];uniforms:Record<string,T.IUniform>}>();
 const native=parameters();t.after(native.dispose);const mappedDepth=new T.MeshDepthMaterial({side:T.DoubleSide,map:new T.Texture()});
 const observedRaycast=new Map<T.Mesh,T.BufferGeometry>();
 for(const mesh of selected){
  assert(!Array.isArray(mesh.material));const copy=new T.Mesh(mesh.geometry,mesh.material);copy.name=mesh.name;copy.matrixWorld.copy(mesh.matrixWorld);baseline.add(copy);copies.set(mesh,copy);
  const shader=compile(mesh.material);sources.set(mesh,{geometry:mesh.geometry,attributes:{...mesh.geometry.attributes},attributeHashes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,hash(a.array)])),index:mesh.geometry.index!,indexHash:hash(mesh.geometry.index!.array),callback:mesh.material.onBeforeCompile,key:mesh.material.customProgramCacheKey,stages:[shader.vertexShader,shader.fragmentShader],nativeKeys:native.keys(mesh,mesh.material),depthKeys:native.keys(mesh,mappedDepth),uniforms:shader.uniforms});
  const raycast=mesh.raycast;mesh.raycast=function(...args){observedRaycast.set(mesh,this.geometry);raycast.apply(this,args);};
 }
 cullMacArthurSpans(baseline);cullMacArthurSpans(asset.scene,approved);
 let payload=0,qualified=0;
 const center=new T.Box3().setFromObject(selected[0]).getCenter(new T.Vector3());
 const cameras:T.Camera[]=[];for(const sign of [-1,1]){const camera=new T.PerspectiveCamera(50,1.5,.1,2000);camera.position.copy(center).add(new T.Vector3(sign*250,60,sign*250));camera.lookAt(center);camera.updateMatrixWorld(true);cameras.push(camera);const shadow=new T.OrthographicCamera(-180,180,180,-180,.1,2000);shadow.position.copy(center).add(new T.Vector3(sign*250,400,sign*250));shadow.lookAt(center);shadow.updateMatrixWorld(true);cameras.push(shadow);}
 for(const direction of [new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1),new T.Vector3(0,0,-1)]){const pointFace=new T.PerspectiveCamera(90,1,.1,2000);pointFace.position.copy(center).add(new T.Vector3(0,15,0));pointFace.up.set(0,0,1);if(Math.abs(direction.z)>.9)pointFace.up.set(0,1,0);pointFace.lookAt(pointFace.position.clone().add(direction));pointFace.updateMatrixWorld(true);cameras.push(pointFace);}
 const viewRenderer={xr:{isPresenting:false},getRenderTarget:()=>null} as unknown as T.WebGLRenderer;
 const depth=new T.MeshDepthMaterial(),distance=new T.MeshDistanceMaterial();t.after(()=>{depth.dispose();distance.dispose();mappedDepth.map?.dispose();mappedDepth.dispose();});
 function ranges(mesh:T.Mesh){return cameras.map((camera,index)=>{
  const shadowMaterial=index<4?depth:distance,colorArgs=[viewRenderer,scene,camera,mesh.geometry,mesh.material,null];
  Reflect.apply(mesh.onBeforeRender,mesh,colorArgs);const color={...mesh.geometry.drawRange};Reflect.apply(mesh.onAfterRender,mesh,colorArgs);
  // Installed r185 passes (renderer, object, camera, shadowCamera, ...); the
  // shipped declaration still describes its second argument as a Scene.
  const shadowArgs=[viewRenderer,mesh,cameras[0],camera,mesh.geometry,shadowMaterial,null];
  Reflect.apply(mesh.onBeforeShadow,mesh,shadowArgs);const shadow={...mesh.geometry.drawRange};Reflect.apply(mesh.onAfterShadow,mesh,shadowArgs);
  assert.deepEqual(mesh.geometry.drawRange,{start:0,count:Infinity});return {color,shadow};
 });}
 for(const mesh of selected){
  const input=sources.get(mesh)!,copy=copies.get(mesh)!,display=mesh.geometry;assert(!Array.isArray(mesh.material));assert.notEqual(display,input.geometry);
  for(const [name,attribute]of Object.entries(input.attributes)){assert.equal(display.getAttribute(name),attribute);assert.equal(hash(attribute.array),input.attributeHashes[name]);}
  assert.equal(display.boundingBox,copy.geometry.boundingBox);assert.equal(display.boundingSphere,copy.geometry.boundingSphere);assert.deepEqual(display.groups,copy.geometry.groups);assert.deepEqual(display.index?.array,copy.geometry.index?.array);assert.equal(input.geometry.index,input.index);assert.equal(hash(input.index.array),input.indexHash);
  const uv=display.getAttribute('uv');if(approved.has(mesh)){qualified++;assert.equal(input.geometry.getAttribute('uv'),undefined);assert(uv.array instanceof Float32Array);assert.equal(uv.itemSize,2);assert.equal(uv.count,display.attributes.position.count);assert.equal(uv.normalized,false);assert(uv.array.every(value=>Object.is(value,0)));payload+=uv.array.byteLength;assert.equal(copy.geometry.getAttribute('uv'),undefined);}else assert.equal(uv,input.attributes.uv,'Warm limestone retains its authored UV object');
  assert.equal(mesh.material.onBeforeCompile,input.callback);assert.equal(mesh.material.customProgramCacheKey,input.key);const shader=compile(mesh.material);assert.deepEqual([shader.vertexShader,shader.fragmentShader],input.stages);assert.deepEqual(native.keys(mesh,mesh.material),input.nativeKeys);assert.deepEqual(native.keys(mesh,mappedDepth),input.depthKeys);
  for(const key of ['skinProfile','skinPlanar','skinColor','skinDetail','belleSunDirection','belleCloudNoise'])assert.deepEqual(shader.uniforms[key]?.value,input.uniforms[key]?.value,'Actual decorated color input changed: '+key);
  const actual=ranges(mesh);assert.deepEqual(actual,ranges(copy));assert(actual.some(row=>row.shadow.count<display.index!.count),'Actual shadow culling must remain exercised');
  const p=input.geometry.attributes.position,index=input.index;let hit=false;
  for(let i=0;i<index.count&&!hit;i+=3){
   const a=new T.Vector3().fromBufferAttribute(p,index.getX(i)),b=new T.Vector3().fromBufferAttribute(p,index.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,index.getX(i+2)),normal=b.clone().sub(a).cross(c.clone().sub(a));
   if(normal.lengthSq()<1e-12)continue; // Some shipped cylinder caps begin with a degenerate triangle.
   const direction=normal.normalize().transformDirection(mesh.matrixWorld),middle=a.clone().add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld),ray=new T.Raycaster(middle.clone().addScaledVector(direction,5),direction.clone().negate(),0,20),hits:T.Intersection[]=[];
   mesh.raycast(ray,hits);assert.equal(observedRaycast.get(mesh),input.geometry);hit=hits.length>0;
  }
  assert(hit,mesh.name+' must preserve an actual source-geometry ray hit');
 }
 assert.equal(qualified,4);assert.equal(payload,1668768);
 const batchingRenderer={extensions:{has:()=>true}} as unknown as T.WebGLRenderer;assert.equal(batchStaticArchitecture(new T.Scene(),batchingRenderer,[baseline],()=>false),undefined,'All actual bridge sources remain excluded from architecture batching');
});

test('unapproved materials and changed geometry, material or function identities never acquire UVs',()=>{
 for(const change of ['unapproved','compile','key','material','geometry'] as const){
  const mesh=fixture(),original=mesh.geometry,map=approvals(mesh);
  if(change==='compile')mesh.material.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 authoredUv;\n'+shader.vertexShader;};
  if(change==='key')mesh.material.customProgramCacheKey=()=>'unknown-authored-uv';
  if(change==='material')mesh.material=new T.MeshStandardMaterial({side:T.DoubleSide});
  if(change==='geometry')mesh.geometry=original.clone();
  cullMacArthurSpans(mesh,change==='unapproved'?undefined:map);assert.equal(mesh.geometry.getAttribute('uv'),undefined,change);assert.equal(original.getAttribute('uv'),undefined);
 }
 const unknown=fixture();unknown.material.onBeforeCompile=shader=>{shader.fragmentShader='varying vec2 customUv;\n'+shader.fragmentShader;};cullMacArthurSpans(unknown);assert.equal(unknown.geometry.getAttribute('uv'),undefined,'Unknown hooks without audited caller receipts are never approved by name/class');
});

test('authored inputs and every unapproved native material path retain their original UV and shadow behavior',()=>{
 const mutations:Record<string,(mesh:T.Mesh)=>void>={
  uv:mesh=>mesh.geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count*2).fill(.37),2)),
  uv1:mesh=>mesh.geometry.setAttribute('uv1',new T.Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count*2).fill(.23),2)),
  defaults:mesh=>Object.assign(mesh.material,{defaultAttributeValues:{uv:[0,0]}}),
  customDepth:mesh=>{mesh.customDepthMaterial=new T.MeshDepthMaterial();},customDistance:mesh=>{mesh.customDistanceMaterial=new T.MeshDistanceMaterial();},
  transparent:mesh=>{(mesh.material as T.Material).transparent=true;},opacity:mesh=>{(mesh.material as T.Material).opacity=.5;},alphaTest:mesh=>{(mesh.material as T.Material).alphaTest=.01;},alphaHash:mesh=>{(mesh.material as T.Material).alphaHash=true;},alphaCoverage:mesh=>{(mesh.material as T.Material).alphaToCoverage=true;},
  frontSide:mesh=>{(mesh.material as T.Material).side=T.FrontSide;},shadowSide:mesh=>{(mesh.material as T.Material).shadowSide=T.BackSide;},wireframe:mesh=>{(mesh.material as T.MeshStandardMaterial).wireframe=true;},clipping:mesh=>{(mesh.material as T.Material).clippingPlanes=[new T.Plane(new T.Vector3(1,0,0))];},
  defines:mesh=>{const material=mesh.material as T.MeshStandardMaterial;material.defines={...material.defines,USE_UV:''};},nullDefines:mesh=>Object.assign(mesh.material,{defines:null}),missingDefines:mesh=>Object.assign(mesh.material,{defines:undefined}),
  morph:mesh=>{mesh.geometry.morphAttributes.normal=[mesh.geometry.attributes.normal.clone()];},
  physical:mesh=>{mesh.material=new T.MeshPhysicalMaterial({side:T.DoubleSide});},basic:mesh=>{mesh.material=new T.MeshBasicMaterial({side:T.DoubleSide});},shader:mesh=>{mesh.material=new T.ShaderMaterial({side:T.DoubleSide});},
  materialRender:mesh=>{(mesh.material as T.Material).onBeforeRender=()=>{};},
 };
 for(const name of ['map','alphaMap','aoMap','lightMap','bumpMap','normalMap','displacementMap','emissiveMap','metalnessMap','roughnessMap'] as const)mutations[name]=mesh=>{(mesh.material as T.MeshStandardMaterial)[name]=new T.Texture();};
 for(const hook of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'] as const)mutations[hook]=mesh=>{mesh[hook]=()=>{};};
 for(const [name,mutate]of Object.entries(mutations)){const mesh=fixture();mutate(mesh);const source=mesh.geometry,uv=source.getAttribute('uv'),uv1=source.getAttribute('uv1'),material=mesh.material,depth=mesh.customDepthMaterial,distance=mesh.customDistanceMaterial;assert(!Array.isArray(material));const compile=material.onBeforeCompile,key=material.customProgramCacheKey;cullMacArthurSpans(mesh,approvals(mesh));assert.equal(mesh.geometry.getAttribute('uv'),uv,name);assert.equal(mesh.geometry.getAttribute('uv1'),uv1,name);assert.equal(source.getAttribute('uv'),uv);assert.equal(mesh.material,material);assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey,key);assert.equal(mesh.customDepthMaterial,depth);assert.equal(mesh.customDistanceMaterial,distance);}
});

test('specialized meshes cannot join the static display-only UV cohort',()=>{
 const example=fixture(),material=new T.MeshStandardMaterial({side:T.DoubleSide});
 const skinned=new T.SkinnedMesh(example.geometry,material),instanced=new T.InstancedMesh(example.geometry,material,1),batched=new T.BatchedMesh(1,example.geometry.attributes.position.count,example.geometry.index!.count,material);batched.addInstance(batched.addGeometry(example.geometry));
 for(const mesh of [skinned,instanced,batched]){mesh.name=names[0];cullMacArthurSpans(mesh,approvals(mesh));assert.equal(mesh.geometry.getAttribute('uv'),undefined);}
});
