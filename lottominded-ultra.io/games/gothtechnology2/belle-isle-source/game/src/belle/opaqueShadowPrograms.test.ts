import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLProperties} from 'three/src/renderers/webgl/WebGLProperties.js';
import {WebGLInfo} from 'three/src/renderers/webgl/WebGLInfo.js';
// @ts-expect-error The pinned private shader-text module has no declaration.
import * as vsm from 'three/src/renderers/shaders/ShaderLib/vsm.glsl.js';
import {installOpaqueShadowPrograms} from './opaqueShadowPrograms.ts';
import {cullMacArthurSpans,hasMacArthurSpanShadowProvenance} from './macArthurSpanCulling.ts';
import {installSharedGeometryBuffers} from './sharedGeometryBuffers.ts';
import {finishMacArthurConcrete} from './macArthurSurface.ts';
import {finishMacArthurRailings} from './macArthurRailFinish.ts';

type ShadowMap=T.WebGLRenderer['shadowMap'];
type DirectArgs=Parameters<T.WebGLRenderer['renderBufferDirect']>;
type Program={cacheKey:string;vertexShader:{source:string};fragmentShader:{source:string};usedTimes:number};
const engineRoot=new URL('../../node_modules/three/',import.meta.url);
const shadowSource=readFileSync(new URL('src/renderers/webgl/WebGLShadowMap.js',engineRoot),'utf8');
const rendererSource=readFileSync(new URL('src/renderers/WebGLRenderer.js',engineRoot),'utf8');

// Execute the pinned engine's real private getDepthMaterial/renderObject code,
// not a test reimplementation. Bind its imports to public Three's class graph:
// importing three/src/WebGLShadowMap directly would instead create different
// MeshDepthMaterial prototypes from the public bundled renderer used by Vite.
const shadowFile=ts.createSourceFile('WebGLShadowMap.js',shadowSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const imported:string[]=[];
for(const statement of shadowFile.statements)if(ts.isImportDeclaration(statement)){
 const binding=statement.importClause?.namedBindings;
 if(binding&&ts.isNamedImports(binding))for(const element of binding.elements)imported.push(element.name.text);
}
const nativeShadowText=shadowFile.statements.filter(s=>!ts.isImportDeclaration(s)&&!ts.isExportDeclaration(s)).map(s=>s.getText(shadowFile)).join('\n');
const NativeShadowMap=Function(...imported,'vsm',nativeShadowText+'\nreturn WebGLShadowMap;')(
 ...imported.map(name=>name==='warn'?console.warn:(T as unknown as Record<string,unknown>)[name]),vsm
) as new(renderer:T.WebGLRenderer,objects:unknown,capabilities:unknown)=>ShadowMap;

function rendererFunctions(names:string[]){
 const file=ts.createSourceFile('WebGLRenderer.js',rendererSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),found=new Map<string,string>();
 function visit(node:ts.Node){if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text)){
  assert(!found.has(node.name.text));found.set(node.name.text,node.getText(file));
 }ts.forEachChild(node,visit);}
 visit(file);assert.equal(found.size,names.length);return found;
}
const cacheFunctions=rendererFunctions(['getProgram','updateCommonMaterialProperties','materialNeedsLights','setProgram','onMaterialDispose','deallocateMaterial','releaseMaterialProgramReferences']);
const selection=cacheFunctions.get('setProgram')!;
const selectionEnd=selection.indexOf('let refreshProgram = false;');assert(selectionEnd>0);
// Stop after the actual cache decision, before GL uniform/state uploads. All
// native version/geometry/light predicates and getProgram/cache branches execute.
cacheFunctions.set('setProgram',selection.slice(0,selectionEnd)+'return program;\n}');
function nativeCache(){
 const deleted:unknown[]=[],gl={VERTEX_SHADER:0x8b31,FRAGMENT_SHADER:0x8b30,createProgram:()=>({}),
  createShader:(type:number)=>({type,source:''}),shaderSource:(shader:{source:string},source:string)=>{shader.source=source;},
  compileShader(){},attachShader(){},bindAttribLocation(){},linkProgram(){},deleteProgram:(program:unknown)=>deleted.push(program)};
 const context={target:null as T.WebGLRenderTarget|null};
 const renderer={getContext:()=>gl,getRenderTarget:()=>context.target,state:{buffers:{depth:{getReversed:()=>false}}},
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFShadowMap}};
 const environments={get:()=>null},clipping={numPlanes:0,numIntersection:0,uniform:{value:[]}};
 const Programs=WebGLPrograms as unknown as (...args:unknown[])=>{programs:Program[]};
 const programCache=Programs(renderer,environments,{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},{releaseStatesOfProgram(){}},clipping);
 const properties=new WebGLProperties();
 const lights=Object.fromEntries(['ambient','probe','directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap',
  'directionalShadow','spotShadow','pointShadow','directionalShadowMatrix','spotLightMatrix','pointShadowMatrix'].map(name=>[name,[]]));
 const currentRenderState={state:{lights:{state:{...lights,version:1,numSpotLightShadowsWithMaps:0,numLightProbes:0}},shadowsArray:[],lightProbeGridArray:[]}};
 const select=Function('properties','programCache','environments','clipping','currentRenderState','_this','_nodesHandler','_emptyScene','textures','ColorManagement','NoToneMapping',
  'let _currentRenderTarget=null,_clippingEnabled=false,_localClippingEnabled=false,_currentCamera=null,_currentMaterialId=-1;\n'+
  [...cacheFunctions.values()].join('\n')+'\nreturn function(camera,scene,geometry,material,object,target){_currentRenderTarget=target;return setProgram(camera,scene,geometry,material,object);};')
  (properties,programCache,environments,clipping,currentRenderState,renderer,null,new T.Scene(),{resetTextureUnits(){}},T.ColorManagement,T.NoToneMapping) as
  (camera:T.Camera,scene:T.Scene,geometry:T.BufferGeometry,material:T.Material,object:T.Object3D,target:T.WebGLRenderTarget|null)=>Program;
 return {deleted,programs:programCache.programs,select(args:DirectArgs,target:T.WebGLRenderTarget|null){
  context.target=target;return select(args[0],args[1]??new T.Scene(),args[2],args[3],args[4],target);
 }};
}
function subject(mapped=true){
 const material=new T.MeshStandardMaterial({side:T.DoubleSide,map:mapped?new T.Texture():null});
 const mesh=new T.Mesh(new T.BoxGeometry(2,2,2),material);mesh.castShadow=true;return mesh;
}
function fixture({adapt=true,meshes=[subject(),subject(false)],root=new T.Scene(),cache=true}:{adapt?:boolean;meshes?:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[];root?:T.Scene;cache?:boolean}={}){
 for(const mesh of meshes)if(!mesh.parent)root.add(mesh);
 const canvas=new EventTarget(),camera=new T.PerspectiveCamera(60,1,.1,5000),light=new T.DirectionalLight();
 camera.position.set(0,5,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 light.position.set(0,20,0);light.target.position.set(0,0,0);light.updateMatrixWorld();light.target.updateMatrixWorld();
 Object.assign(light.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.1,far:5000});light.shadow.camera.updateProjectionMatrix();
 const materialCache=nativeCache(),info=new WebGLInfo({} as WebGLRenderingContext);
 const rows:{args:DirectArgs;receiver:unknown;range:{start:number;count:number};target:T.WebGLRenderTarget|null;program?:Program}[]=[];
 const before:DirectArgs[]=[],returns=Symbol('direct'),nativeReturn=Symbol('render');let target:T.WebGLRenderTarget|null=null;
 const renderer={domElement:canvas,xr:{isPresenting:false},info,autoClear:true,localClippingEnabled:false,
  properties:new WebGLProperties(),state:{setBlending(){},setScissorTest(){},viewport(){},buffers:{color:{setClear(){}},depth:{getReversed:()=>false,setTest(){}}}},
  getRenderTarget:()=>target,setRenderTarget:(next:T.WebGLRenderTarget|null)=>{target=next;},getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  clear(){},getContext(){throw Error('The adapter must not inspect GL');},dispose(){f.disposals++;},
  shadowMap:null as unknown as ShadowMap,
  renderBufferDirect:function(this:unknown,...args:DirectArgs){
   const row={args,receiver:this,range:{...args[2].drawRange},target,program:cache&&args[1]===null?materialCache.select(args,target):undefined};
   rows.push(row);f.tap?.(row);return returns;
  },render:function(scene:T.Scene,cam:T.Camera){
   scene.updateMatrixWorld(true);cam.updateMatrixWorld();Reflect.apply(scene.onBeforeRender,scene,[renderer,scene,cam,target]);
   info.render.frame++;
   if(scene===root)renderer.shadowMap.render([light],scene,cam);
   scene.traverseVisible(object=>{
    if(!(object instanceof T.Mesh)||Array.isArray(object.material)||!object.material.visible)return;
    object.onBeforeRender(renderer as unknown as T.WebGLRenderer,scene,cam,object.geometry,object.material,null!);
    renderer.renderBufferDirect(cam,scene,object.geometry,object.material,object,null!);
    object.onAfterRender(renderer as unknown as T.WebGLRenderer,scene,cam,object.geometry,object.material,null!);
   });
   Reflect.apply(scene.onAfterRender,scene,[renderer,scene,cam]);return nativeReturn;
  }};
 const r=renderer as unknown as T.WebGLRenderer;
 const createShadow=()=>{const shadow=new NativeShadowMap(r,{update:(object:T.Mesh)=>object.geometry},{maxTextureSize:1024});shadow.enabled=true;return shadow;};
 renderer.shadowMap=createShadow();
 // Matches native listener ordering: its replacement runs before the adapter's.
 canvas.addEventListener('webglcontextrestored',()=>{renderer.shadowMap=f.restoreShadow?.()??createShadow();});
 const f={renderer:r,root,meshes,light,camera,rows,before,materialCache,returns,nativeReturn,canvas,disposals:0,
  tap:null as null|((row:typeof rows[number])=>void),restoreShadow:null as null|(()=>ShadowMap),handle:adapt?installOpaqueShadowPrograms(r,{nativeRenderer:true}):null,
  draw(){
   rows.length=0;before.length=0;root.updateMatrixWorld(true);camera.updateMatrixWorld();light.updateMatrixWorld();light.target.updateMatrixWorld();
   const delegate=r.renderBufferDirect;
   const observer=function(this:T.WebGLRenderer,...args:DirectArgs){before.push(args);return Reflect.apply(delegate,this,args);};
   r.renderBufferDirect=observer;
   try{r.shadowMap.render([light],root,camera);}finally{if(r.renderBufferDirect===observer)r.renderBufferDirect=delegate;}
   return rows;
  }};
 return f;
}

test('source/provenance assumptions are pinned to the exact installed Three 0.185.1 shadow and renderer implementations',()=>{
 assert.equal(JSON.parse(readFileSync(new URL('package.json',engineRoot),'utf8')).version,'0.185.1');
 assert.equal(createHash('sha256').update(shadowSource).digest('hex'),'7d69ca09821ed119d7e1db25e88ad43c2b8c7dd87e8746e1c63f8b86086b3e05');
 assert.equal(createHash('sha256').update(rendererSource).digest('hex'),'867948b57a6abb84d4cfd7619b38ea14fbb2c100c1b6f78d59de2383662ab7a0');
 assert(shadowSource.includes('object.onAfterShadow( renderer, object, camera, shadowCamera, geometry, depthMaterial, null )'));
});

test('actual native selection/cache removes mapped stock leakage, shares the ordinary key/sources, and leaves stock versions and arguments intact',()=>{
 const baseline=fixture({adapt:false});baseline.draw();
 assert(baseline.rows[0].program!.vertexShader.source.includes('#define USE_MAP'));
 assert.equal(baseline.rows[0].program,baseline.rows[1].program,'actual setProgram retains mapped stock program for following mapless object');
 const f=fixture();f.draw();
 const owned=f.rows[0].args[3],stock=f.before[0][3];
 assert.notEqual(owned,stock);assert.equal(f.rows[1].args[3],owned);assert.equal(f.before[1][3],stock);
 assert.equal(stock.version,0);assert.equal(owned.version,0);assert.equal(owned.name,'');
 assert.equal((stock as T.MeshDepthMaterial).map,null,'native selection still assigns the last source map');
 assert.equal((owned as T.MeshDepthMaterial).map,null);assert.equal(f.rows[0].program,f.rows[1].program);
 assert(!f.rows[0].program!.vertexShader.source.includes('#define USE_MAP'));
 const plain=new T.MeshDepthMaterial({side:T.DoubleSide}),args=[...f.rows[0].args] as DirectArgs;args[3]=plain;
 const program=f.materialCache.select(args,f.rows[0].target);
 assert.equal(program,f.rows[0].program,'full actual Three program cache reuses an independently created ordinary depth material');
 for(let i=0;i<2;i++)for(const index of [0,1,2,4,5])assert.equal(f.rows[i].args[index],f.before[i][index]);
 const beforePrograms=f.materialCache.programs.length;f.draw();assert.equal(f.materialCache.programs.length,beforePrograms);
 assert.equal(f.rows[0].args[3],owned);assert.equal(owned.version,0);
 assert.equal(f.handle!.read().mappedDelegatedCalls,2);assert.equal(f.handle!.read().maplessDelegatedCalls,2);
 plain.dispose();f.handle!.dispose();assert.equal(f.materialCache.programs.length,0,'native material disposal releases the owned cached program');
});

test('actual native coverage/custom/group/deformation paths and unknown object callbacks stay untouched',()=>{
 const variants:((mesh:T.Mesh<T.BoxGeometry,T.MeshStandardMaterial>,renderer:T.WebGLRenderer)=>void)[]=[
  mesh=>{mesh.material.alphaTest=.5;},mesh=>{mesh.material.alphaMap=new T.Texture();},mesh=>{mesh.material.alphaHash=true;},
  mesh=>{mesh.material.alphaToCoverage=true;},mesh=>{mesh.material.displacementMap=new T.Texture();},
  (mesh,renderer)=>{renderer.localClippingEnabled=true;mesh.material.clippingPlanes=[new T.Plane(new T.Vector3(1,0,0))];mesh.material.clipShadows=true;},
  mesh=>{mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});},
  mesh=>{mesh.customDistanceMaterial=new T.MeshDistanceMaterial();},mesh=>{mesh.material.transparent=true;},
  mesh=>{mesh.onBeforeShadow=()=>{};},mesh=>{mesh.onAfterShadow=()=>{};},mesh=>{mesh.material.side=T.FrontSide;},
  mesh=>{mesh.morphTargetInfluences=[];},mesh=>{mesh.material=[mesh.material] as unknown as T.MeshStandardMaterial;}
 ];
 for(const change of variants){
  const mesh=subject(),f=fixture({meshes:[mesh],cache:false});change(mesh,f.renderer);f.draw();
  assert(f.rows.length>0);assert.equal(f.handle!.read().delegatedCalls,0);
  f.rows.forEach((row,i)=>assert.deepEqual(row.args,f.before[i]));f.handle!.dispose();
 }
 const point=fixture({cache:false});(point.light as unknown as {isPointLight:boolean}).isPointLight=true;point.draw();
 assert.equal(point.handle!.read().delegatedCalls,0);assert(point.rows.every(row=>row.args[3] instanceof T.MeshDistanceMaterial));point.handle!.dispose();
});

test('data guards do not execute mutable source accessors or accept a custom compile/key on incoming depth',()=>{
 for(const adapt of [false,true]){
  const mesh=subject(),map=mesh.material.map;let reads=0;
  Object.defineProperty(mesh.material,'map',{configurable:true,get(){reads++;return map;}});
  const f=fixture({adapt,meshes:[mesh],cache:false});f.draw();assert.equal(reads,2,'only actual native getDepthMaterial map reads execute');
  if(adapt){assert.equal(f.handle!.read().delegatedCalls,0);f.handle!.dispose();}
 }
 const f=fixture({cache:false});f.draw();const stock=f.before[0][3];
 stock.onBeforeCompile=()=>{};const before=f.handle!.read().delegatedCalls;f.draw();
 assert.equal(f.handle!.read().delegatedCalls,before);assert(f.rows.every(row=>row.args[3]===stock));f.handle!.dispose();
});

test('foreign direct/null-scene calls, nested shadow passes, and native throw identity are preserved',()=>{
 const f=fixture({cache:false}),arbitrary=new T.MeshDepthMaterial({side:T.DoubleSide}),args=[f.camera,null,f.meshes[0].geometry,arbitrary,f.meshes[0],null] as unknown as DirectArgs;
 assert.equal(Reflect.apply(f.renderer.renderBufferDirect,{},args),f.returns);assert.equal(f.rows.at(-1)!.args[3],arbitrary);
 assert.equal(Reflect.apply(f.renderer.renderBufferDirect,f.renderer,args),f.returns);assert.equal(f.handle!.read().delegatedCalls,0);
 f.root.updateMatrixWorld(true);const foreign={...f.renderer.shadowMap};
 assert.equal(Reflect.apply(f.renderer.shadowMap.render,foreign,[[f.light],f.root,f.camera]),undefined);
 assert.equal(f.handle!.read().delegatedCalls,0,'a borrowed native shadow method does not open an eligible owner scope');
 let nested=false;f.tap=()=>{if(!nested){nested=true;f.renderer.shadowMap.render([f.light],f.root,f.camera);}};
 f.draw();assert.equal(f.handle!.read().nestedScopes,1);assert.equal(f.handle!.read().delegatedCalls,1,'nested pass and tainted outer tail fall back');
 const error=Object.freeze({native:true});f.tap=()=>{throw error;};assert.throws(()=>f.draw(),value=>value===error);
 f.tap=null;const calls=f.handle!.read().delegatedCalls;f.draw();assert.equal(f.handle!.read().delegatedCalls,calls+2);
 f.handle!.dispose();
});

test('context replacement retires only owned material and adopts only the same native shadow implementation',()=>{
 const f=fixture();f.draw();const first=f.rows[0].args[3],stock=f.before[0][3];let ownedDisposed=0,stockDisposed=0;
 first.addEventListener('dispose',()=>ownedDisposed++);stock.addEventListener('dispose',()=>stockDisposed++);
 const oldMap=f.renderer.shadowMap;f.canvas.dispatchEvent(new Event('webglcontextlost'));
 assert.equal(ownedDisposed,1);assert.equal(stockDisposed,0);assert.equal(f.handle!.read().active,false);
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));assert.notEqual(f.renderer.shadowMap,oldMap);
 f.draw();assert.notEqual(f.rows[0].args[3],first);assert.notEqual(f.before[0][3],stock);
 assert.equal(f.handle!.read().contextGenerations,2);assert.equal(f.handle!.read().active,true);
 f.renderer.dispose();assert.equal(f.disposals,1);assert.equal(f.handle!.read().active,false);assert.equal(stockDisposed,0);
 const altered=fixture({cache:false});
 // Even with the same prototype, an unexpected render implementation cannot
 // acquire this renderer's trusted generation through a restoration event.
 const unexpected=Object.assign(Object.create(Object.getPrototypeOf(altered.renderer.shadowMap)),altered.renderer.shadowMap,{render(){}}) as ShadowMap;
 altered.restoreShadow=()=>unexpected;
 altered.canvas.dispatchEvent(new Event('webglcontextlost'));
 altered.canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(altered.handle!.read().disabledReason,'unexpected-restored-shadow-map');assert.equal(altered.handle!.read().active,false);
 const before=altered.handle!.read().delegatedCalls;altered.renderer.renderBufferDirect(...[altered.camera,null,altered.meshes[0].geometry,new T.MeshDepthMaterial(),altered.meshes[0],null] as unknown as DirectArgs);
 assert.equal(altered.handle!.read().delegatedCalls,before);altered.handle!.dispose();
});

test('in-flight disposal, later wrappers and cleanup errors do not replace native results or exceptions',()=>{
 const f=fixture({cache:false}),original=f.renderer.renderBufferDirect;
 const outer=function(this:T.WebGLRenderer,...args:DirectArgs){return Reflect.apply(original,this,args);};f.renderer.renderBufferDirect=outer;
 const failure=Object.freeze({failure:true});f.tap=row=>{
  row.args[3].addEventListener('dispose',()=>{throw Error('hostile disposal observer');});f.handle!.dispose();throw failure;
 };
 assert.throws(()=>f.draw(),error=>error===failure);assert.equal(f.renderer.renderBufferDirect,outer);
 assert.equal(f.handle!.read().active,false);assert.equal(f.handle!.read().ownedMaterials,0);assert.equal(f.handle!.read().observerErrors,1);
 f.tap=null;f.draw();assert(f.rows.every((row,i)=>row.args[3]===f.before[i][3]));
});

test('actual sharedGeometryBuffers composition forwards pooled page geometry and unchanged draw ranges',()=>{
 const meshes=[subject(),subject(false)];meshes.forEach((mesh,i)=>{mesh.position.x=i*3;});
 const f=fixture({meshes,cache:false}),source=meshes.map(mesh=>mesh.geometry);
 const pool=installSharedGeometryBuffers(f.renderer,f.root,{rendererOutput:{type:T.UnsignedByteType,nodes:false}});pool.prepare();
 assert.equal(pool.read().preparedEntries,2);f.rows.length=0;f.renderer.render(f.root,f.camera);
 const shadows=f.rows.filter(row=>row.args[1]===null);assert.equal(shadows.length,2);
 assert(shadows.every((row,i)=>row.args[2]!==source[i]&&(row.args[4] as T.Mesh).geometry===source[i]));
 assert.equal(f.handle!.read().delegatedCalls,2);assert.equal(pool.read().shadowCalls,2);
 for(const row of shadows)assert.equal(row.args[2].drawRange.start,0);
 pool.dispose();f.handle!.dispose();
});

test('all five authored MacArthur casters retain real culling, shader hooks and stock arguments while sharing one native mapless program',async t=>{
 const load=T.TextureLoader.prototype.load,self=Object.getOwnPropertyDescriptor(globalThis,'self'),textures:T.Texture[]=[];
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture<HTMLImageElement>();textures.push(texture);queueMicrotask(()=>onLoad?.(texture));return texture;};
 Object.defineProperty(globalThis,'self',{value:globalThis,configurable:true});
 let model:Awaited<ReturnType<GLTFLoader['parseAsync']>>;
 try{const bytes=readFileSync(new URL('../../public/belle/landmarks.glb',import.meta.url));model=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');}
 finally{T.TextureLoader.prototype.load=load;if(self)Object.defineProperty(globalThis,'self',self);else delete (globalThis as unknown as {self?:unknown}).self;}
 const meshes:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
 model.scene.traverse(object=>{if(object instanceof T.Mesh&&/^MacArthur[ _]/.test(object.name)){object.castShadow=true;object.geometry.computeBoundingSphere();meshes.push(object);}});
 assert.deepEqual(meshes.map(mesh=>mesh.geometry.attributes.position.count),[85024,33696,15840,46080,112980]);
 assert.equal(meshes.filter(mesh=>mesh.material.map).length,1);
 const root=new T.Scene();root.add(model.scene);root.updateMatrixWorld(true);
 finishMacArthurConcrete(root);finishMacArthurRailings(root);
 const before=meshes.map(mesh=>({geometry:mesh.geometry,attributes:{...mesh.geometry.attributes},index:Array.from(mesh.geometry.index!.array),material:mesh.material}));
 cullMacArthurSpans(root);assert(meshes.every(hasMacArthurSpanShadowProvenance));
 const geometry=meshes.map(mesh=>mesh.geometry),bounds=new T.Box3();for(const mesh of meshes)bounds.union(new T.Box3().setFromObject(mesh));
 const center=bounds.getCenter(new T.Vector3()),radius=Math.max(...bounds.getSize(new T.Vector3()).toArray())*.65;
 function setView(f:ReturnType<typeof fixture>,extent:number){
  f.light.position.copy(center).add(new T.Vector3(0,700,0));f.light.target.position.copy(center);
  Object.assign(f.light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});f.light.shadow.camera.updateProjectionMatrix();
 }
 const baseline=fixture({adapt:false,root,meshes});setView(baseline,radius);baseline.draw();
 const ranges=baseline.rows.map(row=>row.range);assert.equal(ranges.length,5);
 const f=fixture({root,meshes});setView(f,radius);f.draw();
 assert.deepEqual(f.rows.map(row=>row.range),ranges);assert.equal(f.rows.length,5);
 assert.equal(f.handle!.read().spanDelegatedCalls,5);assert.equal(f.handle!.read().mappedDelegatedCalls,1);assert.equal(f.handle!.read().maplessDelegatedCalls,4);
 assert.equal(new Set(f.rows.map(row=>row.program)).size,1);assert(!f.rows[0].program!.vertexShader.source.includes('#define USE_MAP'));
 assert(f.before.every(args=>args[3]===f.before[0][3]));assert(f.rows.every(row=>row.args[3]!==f.before[0][3]));
 setView(baseline,160);baseline.draw();const selected=baseline.rows.map(row=>row.range);setView(f,160);f.draw();
 assert.deepEqual(f.rows.map(row=>row.range),selected);assert(selected.some((range,i)=>range.count>0&&range.count<geometry[i].index!.count));
 meshes.forEach((mesh,i)=>{
  assert.equal(mesh.geometry,geometry[i]);assert.equal(mesh.material,before[i].material);
  assert.deepEqual(mesh.geometry.drawRange,{start:0,count:Infinity});
  for(const [name,attribute]of Object.entries(before[i].attributes))assert.equal(mesh.geometry.getAttribute(name),attribute);
  assert.deepEqual(Array.from(mesh.geometry.index!.array).sort((a,b)=>a-b),before[i].index.slice().sort((a,b)=>a-b));
 });
 const pool=installSharedGeometryBuffers(f.renderer,root,{rendererOutput:{type:T.UnsignedByteType,nodes:false}});pool.prepare();
 assert.equal(pool.read().entries.filter(entry=>meshes.some(mesh=>entry.sourceId===mesh.id)).length,0,'actual bridge callbacks retain native geometry fallback');
 pool.dispose();f.handle!.dispose();
 // Unknown predecessor, later callback changes and display-geometry replacement
 // are not admitted by a name or material tag.
 const special=new T.Mesh(new T.BoxGeometry(200,1,2),new T.MeshStandardMaterial({side:T.DoubleSide}));special.name='MacArthur unknown';special.onBeforeShadow=()=>{};
 cullMacArthurSpans(special);assert.equal(hasMacArthurSpanShadowProvenance(special),false);
 meshes[0].onAfterShadow=()=>{};assert.equal(hasMacArthurSpanShadowProvenance(meshes[0]),false);
 meshes[1].geometry=before[1].geometry;assert.equal(hasMacArthurSpanShadowProvenance(meshes[1]),false);
 t.after(()=>{textures.forEach(texture=>texture.dispose());root.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});});
});
