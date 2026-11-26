/** Diagnostic only: one real, immutable d4 world and native renderer; only the
 * shared-buffer hooks and separately installed uniform cache change per arm.
 * No application animation loop, physics, input or release gate is replaced. */
import * as T from 'three';
// @ts-ignore The driver resolves this graph from the immutable Git commit.
import {createWorld} from 'baseline:world.ts';
// @ts-ignore Immutable original factory.
import {ParkTerrain} from 'baseline:terrain.ts';
// @ts-ignore This MUST share knownShaders with the original world's decorators.
import {installSharedGeometryBuffers} from 'baseline:sharedGeometryBuffers.ts';
// @ts-ignore Original boot map preparation.
import {alignScottMap} from 'baseline:fountainLayout.ts';
// @ts-ignore Original boot map preparation.
import {prepareCoastGuardMap} from 'baseline:coastGuard.ts';
// @ts-ignore Original boot map preparation.
import {activityLandmarks} from 'baseline:activitiesPlan.ts';
// @ts-ignore Original boot map preparation.
import {playgroundLandmarks} from 'baseline:playgrounds.ts';
// @ts-ignore Original default presentation and season preferences.
import {prepareReferencePreferences} from 'baseline:sunsetReferencePolicy.ts';
import {installShadowMatrixCache,readShadowMatrixCacheDiagnostics} from '../src/belle/shadowMatrixCache.ts';

type Arm='pooled'|'native'|'pooled-cache'|'native-cache';
type Hooks={render:PropertyDescriptor;direct:PropertyDescriptor;before:PropertyDescriptor|undefined;after:PropertyDescriptor|undefined};
type Draw={object:number;name:string;sourceGeometry:number;material:number;phase:string;start:number;count:number;program:number;substituted:boolean};
type Frame={rgba:Uint8Array;shadow:Uint8Array;calls:number;triangles:number;draws:Draw[];cpuMs:number;fenceMs:number;gpu:{status:string;nanoseconds:number|null};poolDelta:{renderCalls:number;pooledCalls:number;colorCalls:number;shadowCalls:number};cache:ReturnType<typeof readShadowMatrixCacheDiagnostics>;};
const arms:Arm[]=['pooled','native','pooled-cache','native-cache'];
const width=960,height=600,canvas=document.querySelector('canvas')!;
const assert:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message);};
const allCases=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night'];
const partitions={all:allCases,'linux-a':['jefferson-day','jefferson-night','island-day'],'linux-b':['island-night','conservatory-day','conservatory-night']};
const partitionQuery=new URL(location.href).searchParams.getAll('partition');
assert(partitionQuery.length===1&&Object.hasOwn(partitions,partitionQuery[0]),'Exactly one fixed proof partition is required');
const partition=partitionQuery[0] as keyof typeof partitions,expectedCases=partitions[partition];
const partitionPlan={version:1,cases:allCases,partitions};
const lastCaseIndex=Math.max(...expectedCases.map(name=>allCases.indexOf(name))),prelude:{name:string;frozenTime:number;warmupRenders:number}[]=[];
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,'0')).join('');
const textHash=(value:unknown)=>hash(new TextEncoder().encode(JSON.stringify(value)));
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext,debug=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),software=/SwiftShader|llvmpipe/i.test(gpu);
assert(software?partition!=='all':partition==='all','Software requires a fixed Linux partition; native proof requires every original case');
const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
assert(typeof gl.fenceSync==='function','WebGL2 completion fences are required');
if(!software)assert(timer,'Native elapsed GPU timer is required for this diagnostic');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,width/height,.08,22000);
const images:{name:string;png:string}[]=[],rows:Record<string,unknown>[]=[],controls:Record<string,unknown>[]=[],timings:Record<string,unknown>[]=[],errors:string[]=[];
const programEvidence=new Map<number,{id:number;linked:boolean;vertex:string;fragment:string}>();
let drawing:Draw[]|null=null,observePrograms=false,entryByObject=new Map<number,any>(),pool:any,stopCache:(()=>void)|undefined;
let nativeHooks:Hooks,pooledHooks:Hooks;
const status=(value:string)=>console.log('shared geometry proof '+value);

async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'Fence unavailable');gl.flush();const began=performance.now();try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-began;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-began<90000,'GPU fence exceeded90seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
function difference(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Readback length changed');let pixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);if(d)changed=true;maxChannelDelta=Math.max(maxChannelDelta,d);}if(changed)pixels++;}return {changedPixels:pixels,maxChannelDelta};}
function png(bytes:Uint8Array){const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d')!,data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(bytes.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return out.toDataURL('image/png');}
function save(name:string,frame:Frame){assert(!images.some(image=>image.name===name),'Duplicate capture '+name);images.push({name,png:png(frame.rgba)});}
function ownHooks():Hooks{return {render:Object.getOwnPropertyDescriptor(renderer,'render')!,direct:Object.getOwnPropertyDescriptor(renderer,'renderBufferDirect')!,before:Object.getOwnPropertyDescriptor(scene,'onBeforeRender'),after:Object.getOwnPropertyDescriptor(scene,'onAfterRender')};}
function put(target:object,key:string,value:PropertyDescriptor|undefined){if(value)Object.defineProperty(target,key,value);else Reflect.deleteProperty(target,key);}
function use(arm:Arm){
 stopCache?.();stopCache=undefined;
 const hooks=arm.startsWith('pooled')?pooledHooks:nativeHooks;
 put(renderer,'render',hooks.render);put(renderer,'renderBufferDirect',hooks.direct);put(scene,'onBeforeRender',hooks.before);put(scene,'onAfterRender',hooks.after);
 if(arm.endsWith('-cache'))stopCache=installShadowMatrixCache(renderer);
}
function installObserver(){
 const direct=renderer.renderBufferDirect;
 renderer.renderBufferDirect=function(...args:Parameters<T.WebGLRenderer['renderBufferDirect']>){
  const result=direct.apply(this,args);
  if(drawing){const [,root,geometry,material,object,group]=args,source=(object as T.Mesh).geometry,entry=entryByObject.get(object.id),substituted=source!==geometry;
   const count=geometry.index?.count??geometry.attributes.position?.count??0,start=Math.max(geometry.drawRange.start,group?.start??0),end=Math.min(count,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity);
   const offset=substituted?(geometry.index?entry?.indexOffset:entry?.vertexOffset):0;
   assert(!substituted||Number.isSafeInteger(offset),'Unattributed geometry substitution');
   const program=(renderer.properties.get(material) as any).currentProgram;
   assert(program?.program,'A real direct submission has no native program');
   drawing.push({object:object.id,name:object.name,sourceGeometry:source?.id??-1,material:(material as T.Material&{id:number}).id,phase:root===null?'shadow':'color',start:start-offset,count:Math.max(0,end-start),program:program.id,substituted});
   if(observePrograms&&!programEvidence.has(program.id)){
    const attached=gl.getAttachedShaders(program.program)||[],vertex=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);
    assert(vertex&&fragment,'Linked shaders are unavailable');programEvidence.set(program.id,{id:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS)===true,vertex:gl.getShaderSource(vertex)||'',fragment:gl.getShaderSource(fragment)||''});
   }
  }
  return result;
 };
}
async function render(capture=true,measure=false,forceShadow=true):Promise<Frame>{
 assert(renderer.getRenderTarget()===null,'Comparison must target the actual default framebuffer');
 const before=pool.read();drawing=capture?[]:null;observePrograms=capture;
 renderer.shadowMap.needsUpdate=forceShadow;
 let query:WebGLQuery|null=null;
 if(measure&&timer){assert(gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)===null,'GPU query already active');query=gl.createQuery();assert(query,'GPU query allocation failed');gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
 const began=performance.now();try{renderer.render(scene,camera);}finally{if(query)gl.endQuery(timer!.TIME_ELAPSED_EXT);}
 const cpuMs=performance.now()-began,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,draws=drawing??[];drawing=null;observePrograms=false;
 const fenceMs=await fence(),gpuTiming={status:measure?'unavailable':'not-requested',nanoseconds:null as number|null};
 if(query){try{assert(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE),'Completed elapsed query is unavailable');assert(!gl.getParameter(timer!.GPU_DISJOINT_EXT),'Disjoint GPU elapsed query');gpuTiming.status='complete';gpuTiming.nanoseconds=Number(gl.getQueryParameter(query,gl.QUERY_RESULT));assert(Number.isFinite(gpuTiming.nanoseconds)&&gpuTiming.nanoseconds>=0,'Invalid GPU elapsed query');}finally{gl.deleteQuery(query);}}
 const rgba=new Uint8Array(capture?width*height*4:0);if(capture)gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 const shadowParts:Uint8Array[]=[];if(capture)scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow&&object.shadow.map){const target=object.shadow.map as T.WebGLRenderTarget,bytes=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);shadowParts.push(bytes);}});
 const shadow=new Uint8Array(shadowParts.reduce((size,part)=>size+part.length,0));let shadowOffset=0;for(const part of shadowParts){shadow.set(part,shadowOffset);shadowOffset+=part.length;}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native GL error or context loss');
 const after=pool.read(),poolDelta={renderCalls:after.renderCalls-before.renderCalls,pooledCalls:after.pooledCalls-before.pooledCalls,colorCalls:after.colorCalls-before.colorCalls,shadowCalls:after.shadowCalls-before.shadowCalls};
 return {rgba,shadow,calls,triangles,draws,cpuMs,fenceMs,gpu:gpuTiming,poolDelta,cache:readShadowMatrixCacheDiagnostics(renderer)};
}
function normalize(draws:Draw[]){return draws.map(({substituted,...draw})=>draw);}
function matching(a:Frame,b:Frame){const color=difference(a.rgba,b.rgba),shadow=difference(a.shadow,b.shadow);return {...color,shadowChangedPixels:shadow.changedPixels,shadowMaxChannelDelta:shadow.maxChannelDelta,orderEqual:JSON.stringify(normalize(a.draws))===JSON.stringify(normalize(b.draws)),countsEqual:a.calls===b.calls&&a.triangles===b.triangles};}
async function warm(forceShadow=true){for(let i=0;i<3;i++)await render(false,false,forceShadow);}
async function geometryReceipts(){
 const geometries=new Map<T.BufferGeometry,Promise<unknown>>(),meshes:Record<string,unknown>[]=[];
 scene.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;const geometry=mesh.geometry;
  if(!geometries.has(geometry))geometries.set(geometry,(async()=>{const attributes:Record<string,unknown>={};for(const [key,attribute]of Object.entries(geometry.attributes)){const a=attribute as T.BufferAttribute;attributes[key]={itemSize:a.itemSize,count:a.count,normalized:a.normalized,type:a.array.constructor.name,sha256:await hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))};}const i=geometry.index;return {id:geometry.id,attributes,index:i?{type:i.array.constructor.name,count:i.count,sha256:await hash(new Uint8Array(i.array.buffer,i.array.byteOffset,i.array.byteLength))}:null,groups:geometry.groups.map(g=>({...g}))};})());
  meshes.push({id:mesh.id,name:mesh.name,geometry:geometry.id,material:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>(m as T.Material&{id:number}).id),matrix:mesh.matrix.toArray(),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder});
 });return {meshes,geometries:await Promise.all(geometries.values())};
}
function poolIdentity(stats:any){return {preparedEntries:stats.preparedEntries,activeEntries:stats.activeEntries,pageCount:stats.pageCount,poolBytes:stats.poolBytes,pages:stats.pages,preparationAttempts:stats.preparationAttempts,preparationRenders:stats.preparationRenders,preparationFrames:stats.preparationFrames,preparationReady:stats.preparationReady,fallbacks:stats.fallbacks,observerErrors:stats.observerErrors,contextLosses:stats.contextLosses};}
function materialReceipts(){const materials=new Set<T.Material>();scene.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);});return [...materials].map(material=>{
 const textures:Record<string,unknown>={},parameters=material as T.MeshStandardMaterial;
 const properties=renderer.properties.get(material) as any;
 const values={...Object.fromEntries(Object.entries(material).filter(([,value])=>value instanceof T.Texture)),...Object.fromEntries(Object.entries(properties.uniforms??{}).map(([name,value])=>[name,(value as T.IUniform).value]))};
 for(const [name,value]of Object.entries(values))if(value instanceof T.Texture){const data=value.source.data as {width?:number;height?:number;currentSrc?:string;src?:string};textures[name]={uuid:value.uuid,name:value.name,url:data?.currentSrc||data?.src||null,width:data?.width,height:data?.height,colorSpace:value.colorSpace,channel:value.channel,format:value.format,type:value.type,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,anisotropy:value.anisotropy,matrix:value.matrix.toArray()};}
 return {id:(material as T.Material&{id:number}).id,name:material.name,type:material.type,materialSide:material.side,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,depthTest:material.depthTest,color:parameters.color?.toArray(),roughness:parameters.roughness,metalness:parameters.metalness,textures};
 });}

(window as unknown as {__sharedGeometryProof:()=>Promise<unknown>}).__sharedGeometryProof=async()=>{
 let poolBefore:any=null,poolAfter:any=null,geometry:unknown=null;
 try{
  status('Constructing immutable original world');prepareReferencePreferences();
  const response=await fetch('/belle/map.json');assert(response.ok,'Original map unavailable');const map=await response.json();alignScottMap(map);prepareCoastGuardMap(map);
  for(const landmark of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some((item:any)=>item.id===landmark.id))map.landmarks.push(landmark);
  const terrain=new ParkTerrain(map,true),world=await createWorld(scene,renderer,map,terrain,status);
  world.setQuality('high');world.sky.preview(false);world.sky.setArtStyle('authentic',false);world.sky.configure({hour:14,cycle:false});world.sky.tick(0,false,true);
  assert(renderer.shadowMap.autoUpdate===false,'Original world shadow cadence must be explicit for both timing modes');
  // Fixed proof dimensions in both backends. This overrides only the original
  // software renderer's .7 DPR budget; it preserves all High scene contents.
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  camera.position.set(0,6,0);camera.lookAt(150,4,270);camera.updateMatrixWorld(true);world.update(119,0,0,camera,false,false);await Promise.resolve();
  scene.updateMatrixWorld(true);installObserver();nativeHooks=ownHooks();
  pool=installSharedGeometryBuffers(renderer,scene,{rendererOutput:{type:T.UnsignedByteType,nodes:false},maxDiagnosticEntries:4096});pool.prepare();await Promise.resolve();pooledHooks=ownHooks();poolBefore=pool.read();
  assert(poolBefore.supported&&poolBefore.preparationReady&&poolBefore.activeEntries>=200,'The actual world did not prepare hundreds of original eligible meshes');
  assert(poolBefore.observerErrors===0&&poolBefore.fallbacks===0,'Original pool preparation failed');entryByObject=new Map(poolBefore.entries.map((entry:any)=>[entry.sourceId,entry]));
  const objects=new Map<number,T.Object3D>();scene.traverse(object=>objects.set(object.id,object));
  const poses=[{name:'jefferson',position:[0,6,0],target:[160,4,290]},{name:'island',position:[480,8,830],target:[630,3,1050]},{name:'conservatory',position:[1290,7,1115],target:[1330.8,9,1174.7]}];
  for(const pose of poses)for(const night of [false,true]){
   const id=pose.name+(night?'-night':'-day'),caseIndex=allCases.indexOf(id);assert(caseIndex>=0,'Unexpected original case');if(caseIndex>lastCaseIndex)continue;
   const selected=expectedCases.includes(id);status((selected?'':'prelude ')+id);
   stopCache?.();stopCache=undefined;use('native');camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateMatrixWorld(true);
   const frozenTime=120+caseIndex;world.sky.configure({hour:night?21:14,cycle:false});world.sky.tick(0,false,true);world.update(frozenTime,camera.position.x,camera.position.z,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);
   // Warm the original view-selection hooks before fingerprinting their stable
   // source state; first-use BatchedMesh shadow selection is intentional.
   use('pooled');await warm();use('native');await warm();
   // Preserve the original prior-pose visibility/caster hysteresis in Linux-b.
   // The selected cases retain every original capture, control and warmup.
   if(!selected){prelude.push({name:id,frozenTime,warmupRenders:6});continue;}
   const caseGeometry=await geometryReceipts(),geometrySha256=await textHash(caseGeometry);
   if(!geometry)geometry=caseGeometry;
   const captures=new Map<Arm,Frame>();
   for(const arm of arms){use(arm);await warm();const frame=await render();captures.set(arm,frame);save(id+'-'+arm,frame);}
   const baseline=captures.get('pooled')!;use('pooled');const repeat=await render();save(id+'-repeat',repeat);
   const comparisons=arms.map(arm=>{const frame=captures.get(arm)!,diff=matching(baseline,frame),pooled=arm.startsWith('pooled'),substitutions=frame.draws.filter(d=>d.substituted);
    assert(pooled?frame.poolDelta.pooledCalls>0&&substitutions.length>0:frame.poolDelta.pooledCalls===0&&frame.poolDelta.renderCalls===0&&substitutions.length===0,'Arm did not exercise its declared native/pool path: '+id+' '+arm);
    assert(substitutions.length===frame.poolDelta.pooledCalls&&substitutions.filter(d=>d.phase==='color').length===frame.poolDelta.colorCalls&&substitutions.filter(d=>d.phase==='shadow').length===frame.poolDelta.shadowCalls,'Independent direct substitutions disagree with pool counters');
    const cache=frame.cache,shadow=cache?.uniforms.directionalShadowMatrix;
    if(arm.endsWith('-cache'))assert(cache?.active&&shadow&&shadow.observedUniforms>0&&shadow.skippedCalls>0,'Named shadow cache did not skip a native repeated upload');
    return {arm,...diff,calls:frame.calls,triangles:frame.triangles,rgbaSha256:'',shadowSha256:'',poolDelta:frame.poolDelta,substitutedColorDraws:substitutions.filter(d=>d.phase==='color').length,substitutedShadowDraws:substitutions.filter(d=>d.phase==='shadow').length,cache,draws:frame.draws};
   });for(const comparison of comparisons){comparison.rgbaSha256=await hash(captures.get(comparison.arm)!.rgba);comparison.shadowSha256=await hash(captures.get(comparison.arm)!.shadow);}
   const repeatDiff=difference(baseline.rgba,repeat.rgba),shadowRepeat=difference(baseline.shadow,repeat.shadow),afterGeometrySha256=await textHash(await geometryReceipts());
   rows.push({name:id,width,height,camera:{position:camera.position.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},hour:night?21:14,frozenTime,style:'authentic',bridgePreview:world.pictureBridgeEnabled,geometrySha256,afterGeometrySha256,geometryEqual:geometrySha256===afterGeometrySha256,repeatChangedPixels:repeatDiff.changedPixels,repeatMaxChannelDelta:repeatDiff.maxChannelDelta,repeatShadowChangedPixels:shadowRepeat.changedPixels,comparisons,passed:repeatDiff.changedPixels===0&&shadowRepeat.changedPixels===0&&geometrySha256===afterGeometrySha256&&comparisons.every(c=>c.changedPixels===0&&c.maxChannelDelta===0&&c.shadowChangedPixels===0&&c.orderEqual&&c.countsEqual)});
   // Actual eligible source meshes must affect the rendered world. No proxy
   // caster or substitute surface is used for either positive control.
   const eligible=[...new Set(baseline.draws.filter(draw=>draw.substituted&&draw.phase==='color').map(draw=>draw.object))].map(id=>objects.get(id)!);assert(eligible.length>0,'No actual pooled color sources to hide');
   use('native');const visibility=eligible.map(object=>object.visible);eligible.forEach(object=>object.visible=false);const hidden=await render();save(id+'-eligible-hidden-control',hidden);eligible.forEach((object,i)=>object.visible=visibility[i]);
   const lights:T.DirectionalLight[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow)lights.push(object);});assert(lights.length>0,'Actual world has no directional shadow light');
   for(const light of lights)light.castShadow=false;const shadowOff=await render();save(id+'-shadow-off-control',shadowOff);for(const light of lights)light.castShadow=true;
   const light=lights[0],originalPosition=light.position.clone();light.position.x+=45;light.updateMatrixWorld(true);
   use('pooled');await warm();const changedOriginal=await render();save(id+'-light-update-original-control',changedOriginal);
   const updateComparisons=[];
   for(const arm of ['pooled-cache','native-cache'] as Arm[]){
    light.position.copy(originalPosition);light.updateMatrixWorld(true);use(arm);await warm();const before=readShadowMatrixCacheDiagnostics(renderer)!;
    light.position.x+=45;light.updateMatrixWorld(true);const changed=await render();save(id+'-light-update-'+arm+'-control',changed);const after=readShadowMatrixCacheDiagnostics(renderer)!;
    updateComparisons.push({arm,...matching(changedOriginal,changed),nativeShadowUploads:after.uniforms.directionalShadowMatrix.nativeSuccesses-before.uniforms.directionalShadowMatrix.nativeSuccesses});
   }
   light.position.copy(originalPosition);light.updateMatrixWorld(true);use('pooled');await warm();const restored=await render();save(id+'-restored-control',restored);
   const restoredDiff=difference(baseline.rgba,restored.rgba),uniformUpdateChangedPixels=difference(baseline.rgba,changedOriginal.rgba).changedPixels;
   controls.push({name:id,eligibleHiddenIds:eligible.map(object=>object.id),eligibleHiddenChangedPixels:difference(baseline.rgba,hidden.rgba).changedPixels,shadowOffChangedPixels:difference(baseline.rgba,shadowOff.rgba).changedPixels,uniformUpdateChangedPixels,uniformUpdates:updateComparisons,restoredChangedPixels:restoredDiff.changedPixels,restoredMaxChannelDelta:restoredDiff.maxChannelDelta,passed:restoredDiff.changedPixels===0&&updateComparisons.every(c=>c.changedPixels===0&&c.maxChannelDelta===0&&c.shadowChangedPixels===0&&c.orderEqual&&c.countsEqual&&c.nativeShadowUploads>0)});
   if(!software)for(const shadowMode of (night?['forced-refresh']:['forced-refresh','steady-color']))for(const compared of ['native','pooled-cache','native-cache'] as Arm[]){
    const forceShadow=shadowMode==='forced-refresh',lanes=[];for(let repetition=1;repetition<=8;repetition++)for(const arm of ['pooled',compared,compared,'pooled'] as Arm[]){use(arm);await warm(forceShadow);const sample=await render(false,true,forceShadow);lanes.push({arm,repetition,cpuMs:sample.cpuMs,fenceMs:sample.fenceMs,gpu:sample.gpu,calls:sample.calls,triangles:sample.triangles,poolDelta:sample.poolDelta,cache:sample.cache});}
    timings.push({name:id,shadowMode,baseline:'pooled',candidate:compared,order:'ABBA',repetitions:8,lanes,scope:'Warmed frozen full-world snapshot. Forced-refresh redraws original shadows each frame; steady-color retains the last completed original shadow map. No per-draw observer during timing; elapsed GPU query and completion fence reported separately. Neither mode is riding frame pacing.'});
   }
   assert(JSON.stringify(poolIdentity(pool.read()))===JSON.stringify(poolIdentity(poolBefore)),'Pool pages, eligibility or preparation changed during the experiment');
  }
  use('native');poolAfter=pool.read();
 }catch(error){errors.push(error instanceof Error?error.stack||error.message:String(error));status('FAILED '+errors.at(-1));}
 finally{stopCache?.();stopCache=undefined;}
 const programs=await Promise.all([...programEvidence.values()].map(async p=>({id:p.id,linked:p.linked,vertexSha256:await hash(new TextEncoder().encode(p.vertex)),fragmentSha256:await hash(new TextEncoder().encode(p.fragment)),vertex:p.vertex,fragment:p.fragment})));
 const cacheRows=rows.flatMap(row=>(row.comparisons as any[]).filter(c=>c.arm.endsWith('-cache')));
 const originalRows=rows.flatMap(row=>(row.comparisons as any[]).filter(c=>c.arm==='pooled'));
 const cacheCoverage={rows:cacheRows.length,
  substitutedColorDraws:originalRows.reduce((n,c)=>n+c.substitutedColorDraws,0),substitutedShadowDraws:originalRows.reduce((n,c)=>n+c.substitutedShadowDraws,0),
  namedShadowSkips:cacheRows.reduce((n,c)=>n+(c.cache?.uniforms.directionalShadowMatrix.skippedCalls??0),0),
  nativeShadowUpdates:controls.reduce((n,c)=>n+(c.uniformUpdates as any[]).reduce((m,u)=>m+u.nativeShadowUploads,0),0),
  shadowChangedPixels:Math.max(0,...controls.map(c=>Number(c.shadowOffChangedPixels))),
  eligibleChangedPixels:Math.max(0,...controls.map(c=>Number(c.eligibleHiddenChangedPixels))),
  uniformUpdateChangedPixels:Math.max(0,...controls.map(c=>Number(c.uniformUpdateChangedPixels)))};
 const passed=errors.length===0&&rows.length===expectedCases.length&&rows.every(row=>row.passed)&&controls.length===expectedCases.length&&controls.every(c=>c.passed)&&programs.length>0&&programs.every(p=>p.linked)&&cacheCoverage.rows===expectedCases.length*2&&cacheCoverage.substitutedColorDraws>0&&cacheCoverage.substitutedShadowDraws>0&&cacheCoverage.namedShadowSkips>0&&cacheCoverage.nativeShadowUpdates>0&&cacheCoverage.shadowChangedPixels>=16&&cacheCoverage.eligibleChangedPixels>=16&&cacheCoverage.uniformUpdateChangedPixels>=16&&poolBefore?.activeEntries>=200;
 return {schema:'belle-shared-geometry-experiment-v1',partition,expectedCases,partitionPlanSha256:await textHash(partitionPlan),prelude,gpu,width,height,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,software,rows,controls,timings,images,poolBefore,poolAfter,geometry,materials:materialReceipts(),programs,cacheCoverage,passed,errors,shadowReadback:'Exact RGBA8 shadow-target color attachments plus actual shadow draw/order checks and receiver shadow-off controls; native depth texture bytes are not claimed.',resourceScope:'Original source buffers and the one prepared pool remain resident in every arm. This isolates submission-path cost; it does not measure startup time, allocation or memory savings from never creating a pool.',
  scope:'One constructed immutable d4 world, original material/geometry factories and render hooks, three fixed views and Authentic day/night. Original pooled vs native no-pool vs pooled-cache vs native-cache. All four named uniform activities are reported; only directionalShadowMatrix has a changing-payload pixel control here. Optional approach assets are not requested; snapshot membership is recorded. Four-art-style/optional-stone-bridge coverage, water-array mutation controls, actual riding/input, release performance and controls remain outside this initial diagnostic.'};
};
