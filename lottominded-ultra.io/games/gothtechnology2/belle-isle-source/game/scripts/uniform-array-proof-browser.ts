/** Diagnostic only: one real, immutable d4 world and native renderer; only the
 * actual named uniform node's original/inline setter changes between arms.
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
// @ts-ignore The driver supplies controls from the SAME pinned Three graph.
import {uniformArrayProofControl} from 'fixture:uniform-array-control';

type Arm='original'|'inline';
type Draw={object:number;name:string;sourceGeometry:number;material:number;phase:string;start:number;count:number;program:number;substituted:boolean};
type CacheSnapshot={version:1;mode:Arm;generation:number;contexts:number;registeredUniforms:number;activeUniforms:number;setterCalls:number;nativeCalls:number;nativeSuccesses:number;nativeErrors:number;skippedCalls:number;fallbackCalls:number;contextResets:number;ownershipFailures:number};
type CacheDelta={setterCalls:number;nativeCalls:number;nativeSuccesses:number;nativeErrors:number;skippedCalls:number};
type GpuTiming={status:string;nanoseconds:number|null;queryId:number|null;resultAvailable:boolean;disjoint:boolean};
type PoolCounts={renderCalls:number;pooledCalls:number;colorCalls:number;shadowCalls:number};
type Submission={calls:number;triangles:number;draws:Draw[];cpuMs:number;fenceMs:number;gpu:GpuTiming};
type Frame=Submission&{rgba:Uint8Array;shadow:Uint8Array;poolDelta:PoolCounts;cache:CacheSnapshot;cacheBefore:CacheSnapshot;cacheDelta:CacheDelta;};
const arms:Arm[]=['original','inline'];
const width=960,height=600,canvas=document.querySelector('canvas')!;
const assert:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message);};
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,'0')).join('');
const textHash=(value:unknown)=>hash(new TextEncoder().encode(JSON.stringify(value)));
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext,debug=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),software=/SwiftShader|llvmpipe/i.test(gpu);
const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
assert(typeof gl.fenceSync==='function','WebGL2 completion fences are required');
if(!software)assert(timer,'Native elapsed GPU timer is required for this diagnostic');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,width/height,.08,22000);
const images:{name:string;png:string}[]=[],rows:Record<string,unknown>[]=[],controls:Record<string,unknown>[]=[],timings:Record<string,unknown>[]=[],errors:string[]=[];
const programEvidence=new Map<number,{id:number;linked:boolean;vertex:string;fragment:string}>();
let drawing:Draw[]|null=null,observePrograms=false,entryByObject=new Map<number,any>(),pool:any;
let nextQueryId=1;
let poolHooks:{render:T.WebGLRenderer['render'];direct:T.WebGLRenderer['renderBufferDirect'];before:T.Scene['onBeforeRender'];after:T.Scene['onAfterRender']};
const status=(value:string)=>console.log('uniform array proof '+value);
const cacheRead=():CacheSnapshot=>uniformArrayProofControl.read();
function cacheDelta(before:CacheSnapshot,after:CacheSnapshot):CacheDelta{
 assert(before.mode===after.mode&&before.generation===after.generation,'Uniform mode/generation changed inside a render');
 const delta={} as CacheDelta;for(const key of ['setterCalls','nativeCalls','nativeSuccesses','nativeErrors','skippedCalls'] as const){
  const value=after[key]-before[key];assert(Number.isSafeInteger(value)&&value>=0,'Invalid uniform counter delta '+key);delta[key]=value;
 }return delta;
}
function verifyPoolHooks(){assert(poolHooks&&renderer.render===poolHooks.render&&renderer.renderBufferDirect===poolHooks.direct&&scene.onBeforeRender===poolHooks.before&&scene.onAfterRender===poolHooks.after,'Original pool/render hooks changed between arms');}
const poolCounts=(stats:any):PoolCounts=>({renderCalls:stats.renderCalls,pooledCalls:stats.pooledCalls,colorCalls:stats.colorCalls,shadowCalls:stats.shadowCalls});
const poolDifference=(before:PoolCounts,after:PoolCounts):PoolCounts=>({renderCalls:after.renderCalls-before.renderCalls,pooledCalls:after.pooledCalls-before.pooledCalls,colorCalls:after.colorCalls-before.colorCalls,shadowCalls:after.shadowCalls-before.shadowCalls});

async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'Fence unavailable');gl.flush();const began=performance.now();try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-began;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-began<90000,'GPU fence exceeded90seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
function difference(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Readback length changed');let pixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);if(d)changed=true;maxChannelDelta=Math.max(maxChannelDelta,d);}if(changed)pixels++;}return {changedPixels:pixels,maxChannelDelta};}
function png(bytes:Uint8Array){const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d')!,data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(bytes.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return out.toDataURL('image/png');}
function save(name:string,frame:Frame){assert(!images.some(image=>image.name===name),'Duplicate capture '+name);images.push({name,png:png(frame.rgba)});}
function use(arm:Arm){uniformArrayProofControl.setMode(arm);assert(cacheRead().mode===arm,'Uniform mode did not change');}
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
async function submit(measure:boolean,forceShadow:boolean,captureDraws=false):Promise<Submission>{
 assert(renderer.getRenderTarget()===null,'Comparison must target the actual default framebuffer');
 verifyPoolHooks();drawing=captureDraws?[]:null;observePrograms=captureDraws;
 renderer.shadowMap.needsUpdate=forceShadow;
 let query:WebGLQuery|null=null,queryId:number|null=null;
 if(measure&&timer){assert(gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)===null,'GPU query already active');query=gl.createQuery();assert(query,'GPU query allocation failed');queryId=nextQueryId++;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
 const began=performance.now();try{renderer.render(scene,camera);}finally{if(query)gl.endQuery(timer!.TIME_ELAPSED_EXT);}
 const cpuMs=performance.now()-began,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,draws=drawing??[];drawing=null;observePrograms=false;
 const fenceMs=await fence(),gpuTiming:GpuTiming={status:measure?'unavailable':'not-requested',nanoseconds:null,queryId,resultAvailable:false,disjoint:false};
 if(query){try{gpuTiming.resultAvailable=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)===true;gpuTiming.disjoint=gl.getParameter(timer!.GPU_DISJOINT_EXT)===true;assert(gpuTiming.resultAvailable,'Completed elapsed query is unavailable');assert(!gpuTiming.disjoint,'Disjoint GPU elapsed query');gpuTiming.status='complete';gpuTiming.nanoseconds=Number(gl.getQueryParameter(query,gl.QUERY_RESULT));assert(Number.isFinite(gpuTiming.nanoseconds)&&gpuTiming.nanoseconds>=0,'Invalid GPU elapsed query');}finally{gl.deleteQuery(query);}}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native GL error or context loss');verifyPoolHooks();
 return {calls,triangles,draws,cpuMs,fenceMs,gpu:gpuTiming};
}
async function render(forceShadow=true):Promise<Frame>{
 const before=poolCounts(pool.read()),cacheBefore=cacheRead(),work=await submit(false,forceShadow,true);
 const rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 const shadowParts:Uint8Array[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow&&object.shadow.map){const target=object.shadow.map as T.WebGLRenderTarget,bytes=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);shadowParts.push(bytes);}});
 const shadow=new Uint8Array(shadowParts.reduce((size,part)=>size+part.length,0));let shadowOffset=0;for(const part of shadowParts){shadow.set(part,shadowOffset);shadowOffset+=part.length;}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native GL error or context loss');
 const after=poolCounts(pool.read()),poolDelta=poolDifference(before,after);
 verifyPoolHooks();const cache=cacheRead();
 return {...work,rgba,shadow,poolDelta,cache,cacheBefore,cacheDelta:cacheDelta(cacheBefore,cache)};
}
function normalize(draws:Draw[]){return draws.map(({substituted,...draw})=>draw);}
function matching(a:Frame,b:Frame){const color=difference(a.rgba,b.rgba),shadow=difference(a.shadow,b.shadow);return {...color,shadowChangedPixels:shadow.changedPixels,shadowMaxChannelDelta:shadow.maxChannelDelta,orderEqual:JSON.stringify(normalize(a.draws))===JSON.stringify(normalize(b.draws)),countsEqual:a.calls===b.calls&&a.triangles===b.triangles};}
async function warm(forceShadow=true){for(let i=0;i<3;i++)await submit(false,forceShadow);}
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

function cacheContract(cache:CacheSnapshot,arm:Arm){
 assert(cache.version===1&&cache.mode===arm,'Controller identity/mode mismatch');
 for(const key of ['generation','contexts','registeredUniforms','activeUniforms','setterCalls','nativeCalls','nativeSuccesses','nativeErrors','skippedCalls','fallbackCalls','contextResets','ownershipFailures'] as const)
  assert(Number.isSafeInteger(cache[key])&&cache[key]>=0,'Invalid controller field '+key);
 assert(cache.contexts===1&&cache.registeredUniforms>0,'The real renderer did not register named shadow uniforms');
 assert(cache.nativeErrors===0&&cache.fallbackCalls===0&&cache.contextResets===0&&cache.ownershipFailures===0,'Inline cache contract failed');
 assert(cache.nativeCalls===cache.nativeSuccesses,'Native upload accounting failed');
 assert(cache.activeUniforms===(arm==='inline'?cache.registeredUniforms:0),'Actual eligible node setters do not match the selected arm');
 if(arm==='original')assert(cache.setterCalls===0&&cache.nativeCalls===0&&cache.skippedCalls===0,'Candidate ran during original rendering');
}
function exact(frame:ReturnType<typeof matching>){return frame.changedPixels===0&&frame.maxChannelDelta===0&&frame.shadowChangedPixels===0&&frame.shadowMaxChannelDelta===0&&frame.orderEqual&&frame.countsEqual;}
function activity(frame:Frame){
 const substitutions=frame.draws.filter(draw=>draw.substituted),color=substitutions.filter(draw=>draw.phase==='color').length,shadow=substitutions.filter(draw=>draw.phase==='shadow').length;
 assert(frame.poolDelta.renderCalls>0&&color>0,'Original pooled path was not exercised');
 assert(substitutions.length===frame.poolDelta.pooledCalls&&color===frame.poolDelta.colorCalls&&shadow===frame.poolDelta.shadowCalls,'Observed substitutions disagree with original pool counters');
 return {substitutedColorDraws:color,substitutedShadowDraws:shadow};
}
const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;

(window as unknown as {__uniformArrayProof:()=>Promise<unknown>}).__uniformArrayProof=async()=>{
 let poolBefore:any=null,poolAfter:any=null,geometry:unknown=null;
 try{
  use('original');status('Constructing immutable original world');prepareReferencePreferences();
  const response=await fetch('/belle/map.json');assert(response.ok,'Original map unavailable');const map=await response.json();alignScottMap(map);prepareCoastGuardMap(map);
  for(const landmark of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some((item:any)=>item.id===landmark.id))map.landmarks.push(landmark);
  const terrain=new ParkTerrain(map,true),world=await createWorld(scene,renderer,map,terrain,status);
  world.setQuality('high');world.sky.preview(false);world.sky.setArtStyle('authentic',false);world.sky.configure({hour:14,cycle:false});world.sky.tick(0,false,true);
  assert(renderer.shadowMap.autoUpdate===false,'Original world shadow cadence must be explicit for both timing modes');
  // Fixed diagnostic viewport; preserves the complete original High scene.
  // Original software High would otherwise apply its .7 DPR budget here.
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  camera.position.set(0,6,0);camera.lookAt(150,4,270);camera.updateMatrixWorld(true);world.update(119,0,0,camera,false,false);await Promise.resolve();
  scene.updateMatrixWorld(true);installObserver();
  pool=installSharedGeometryBuffers(renderer,scene,{rendererOutput:{type:T.UnsignedByteType,nodes:false},maxDiagnosticEntries:4096});pool.prepare();await Promise.resolve();poolBefore=pool.read();
  poolHooks={render:renderer.render,direct:renderer.renderBufferDirect,before:scene.onBeforeRender,after:scene.onAfterRender};
  assert(poolBefore.supported&&poolBefore.preparationReady&&poolBefore.activeEntries>=200,'The original world did not prepare hundreds of eligible meshes');
  assert(poolBefore.observerErrors===0&&poolBefore.fallbacks===0,'Original pool preparation failed');entryByObject=new Map(poolBefore.entries.map((entry:any)=>[entry.sourceId,entry]));
  const objects=new Map<number,T.Object3D>();scene.traverse(object=>objects.set(object.id,object));
  const poses=[{name:'jefferson',position:[0,6,0],target:[160,4,290]},{name:'island',position:[480,8,830],target:[630,3,1050]},{name:'conservatory',position:[1290,7,1115],target:[1330.8,9,1174.7]}];
  let caseIndex=0;for(const pose of poses)for(const night of [false,true]){
   const id=pose.name+(night?'-night':'-day');status(id);use('original');
   camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateMatrixWorld(true);
   const frozenTime=120+caseIndex++;world.sky.configure({hour:night?21:14,cycle:false});world.sky.tick(0,false,true);world.update(frozenTime,camera.position.x,camera.position.z,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);
   await warm();const caseGeometry=await geometryReceipts(),geometrySha256=await textHash(caseGeometry);if(!geometry)geometry=caseGeometry;
   const captures=new Map<Arm,Frame>(),warmCaches=new Map<Arm,{before:CacheSnapshot;after:CacheSnapshot;delta:CacheDelta}>();
   for(const arm of arms){
    use(arm);const before=cacheRead();await warm();const after=cacheRead();cacheContract(after,arm);
    const warming={before,after,delta:cacheDelta(before,after)};warmCaches.set(arm,warming);
    if(arm==='inline')assert(warming.delta.nativeSuccesses>0&&warming.delta.skippedCalls>0,'Warmup did not upload and then skip actual named uniform payloads');
    const frame=await render();cacheContract(frame.cache,arm);captures.set(arm,frame);save(id+'-'+arm,frame);
   }
   const baseline=captures.get('original')!;use('original');const repeat=await render();save(id+'-repeat',repeat);
   const comparisons=[];for(const arm of arms){
    const frame=captures.get(arm)!,diff=matching(baseline,frame),substitutions=activity(frame);
    if(arm==='inline')assert(frame.cacheDelta.skippedCalls>0,'Warmed candidate did not skip a named native upload');
    comparisons.push({arm,...diff,...substitutions,calls:frame.calls,triangles:frame.triangles,rgbaSha256:await hash(frame.rgba),shadowSha256:await hash(frame.shadow),poolDelta:frame.poolDelta,cache:frame.cache,cacheBefore:frame.cacheBefore,cacheDelta:frame.cacheDelta,warmCache:warmCaches.get(arm),draws:frame.draws});
   }
   const repeatDiff=matching(baseline,repeat),afterGeometrySha256=await textHash(await geometryReceipts());
   rows.push({name:id,width,height,camera:{position:camera.position.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},hour:night?21:14,frozenTime,style:'authentic',bridgePreview:world.pictureBridgeEnabled,geometrySha256,afterGeometrySha256,geometryEqual:geometrySha256===afterGeometrySha256,repeatChangedPixels:repeatDiff.changedPixels,repeatMaxChannelDelta:repeatDiff.maxChannelDelta,repeatShadowChangedPixels:repeatDiff.shadowChangedPixels,repeatShadowMaxChannelDelta:repeatDiff.shadowMaxChannelDelta,repeatOrderEqual:repeatDiff.orderEqual,repeatCountsEqual:repeatDiff.countsEqual,comparisons,passed:exact(repeatDiff)&&geometrySha256===afterGeometrySha256&&comparisons.every(exact)});
   // Prove actual pooled geometry and actual mapped shadows affect these views.
   const eligible=[...new Set(baseline.draws.filter(draw=>draw.substituted&&draw.phase==='color').map(draw=>draw.object))].map(id=>objects.get(id)!);assert(eligible.length>0,'No actual pooled color sources to hide');
   use('original');const visibility=eligible.map(object=>object.visible);eligible.forEach(object=>object.visible=false);const hidden=await render();save(id+'-eligible-hidden-control',hidden);eligible.forEach((object,i)=>object.visible=visibility[i]);
   const lights:T.DirectionalLight[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow)lights.push(object);});assert(lights.length>0,'Actual world has no directional shadow light');
   for(const light of lights)light.castShadow=false;const shadowOff=await render();save(id+'-shadow-off-control',shadowOff);for(const light of lights)light.castShadow=true;
   const light=lights[0],originalPosition=light.position.clone();light.position.x+=45;light.updateMatrixWorld(true);
   use('original');await warm();const changedOriginal=await render();save(id+'-light-update-original-control',changedOriginal);
   // Warm the candidate at the unmodified light. Change its real matrix payload
   // and restore it WITHOUT switching or invalidating the candidate setter.
   light.position.copy(originalPosition);light.updateMatrixWorld(true);use('inline');await warm();cacheContract(cacheRead(),'inline');
   light.position.x+=45;light.updateMatrixWorld(true);const changedInline=await render();save(id+'-light-update-inline-control',changedInline);
   const uniformUpdate={arm:'inline',...matching(changedOriginal,changedInline),nativeShadowUploads:changedInline.cacheDelta.nativeSuccesses,cacheBefore:changedInline.cacheBefore,cache:changedInline.cache,cacheDelta:changedInline.cacheDelta};
   light.position.copy(originalPosition);light.updateMatrixWorld(true);const restoredInline=await render();save(id+'-light-restored-inline-control',restoredInline);
   const uniformRestore={arm:'inline',...matching(baseline,restoredInline),nativeShadowUploads:restoredInline.cacheDelta.nativeSuccesses,cacheBefore:restoredInline.cacheBefore,cache:restoredInline.cache,cacheDelta:restoredInline.cacheDelta};
   // Restore ORIGINAL actual setters, then enable freshly invalidated inline
   // setters. First requests must upload, followed by repeat skips at same pixels.
   const generationBefore=cacheRead().generation;use('original');const disabled=cacheRead();const toggleOriginal=await render();cacheContract(toggleOriginal.cache,'original');save(id+'-toggle-original-control',toggleOriginal);
   use('inline');const enabled=cacheRead();const toggleFirst=await render();cacheContract(toggleFirst.cache,'inline');save(id+'-toggle-inline-first-control',toggleFirst);
   const toggleRepeat=await render();cacheContract(toggleRepeat.cache,'inline');save(id+'-toggle-inline-repeat-control',toggleRepeat);
   const toggle={generationBefore,generationDisabled:disabled.generation,generationEnabled:enabled.generation,disabled,enabled,original:{...matching(baseline,toggleOriginal),cache:toggleOriginal.cache,cacheDelta:toggleOriginal.cacheDelta},first:{...matching(baseline,toggleFirst),cacheBefore:toggleFirst.cacheBefore,cache:toggleFirst.cache,cacheDelta:toggleFirst.cacheDelta},repeat:{...matching(baseline,toggleRepeat),cacheBefore:toggleRepeat.cacheBefore,cache:toggleRepeat.cache,cacheDelta:toggleRepeat.cacheDelta},firstNativeShadowUploads:toggleFirst.cacheDelta.nativeSuccesses,repeatNativeShadowUploads:toggleRepeat.cacheDelta.nativeSuccesses,repeatShadowSkips:toggleRepeat.cacheDelta.skippedCalls};
   const togglePassed=disabled.generation>generationBefore&&enabled.generation>disabled.generation&&toggle.firstNativeShadowUploads>0&&toggle.repeatNativeShadowUploads===0&&toggle.repeatShadowSkips>0&&exact(toggle.original)&&exact(toggle.first)&&exact(toggle.repeat);
   use('original');const restored=await render();save(id+'-restored-control',restored);const restoredDiff=matching(baseline,restored);
   controls.push({name:id,eligibleHiddenIds:eligible.map(object=>object.id),eligibleHiddenChangedPixels:difference(baseline.rgba,hidden.rgba).changedPixels,shadowOffChangedPixels:difference(baseline.rgba,shadowOff.rgba).changedPixels,uniformUpdateChangedPixels:difference(baseline.rgba,changedOriginal.rgba).changedPixels,uniformUpdate,uniformRestore,toggle:{...toggle,passed:togglePassed},restoredChangedPixels:restoredDiff.changedPixels,restoredMaxChannelDelta:restoredDiff.maxChannelDelta,restoredShadowChangedPixels:restoredDiff.shadowChangedPixels,restoredOrderEqual:restoredDiff.orderEqual,restoredCountsEqual:restoredDiff.countsEqual,passed:exact(restoredDiff)&&exact(uniformUpdate)&&uniformUpdate.nativeShadowUploads>0&&exact(uniformRestore)&&uniformRestore.nativeShadowUploads>0&&togglePassed});
   if(!software)for(const shadowMode of (night?['forced-refresh']:['forced-refresh','steady-color'])){
    const forceShadow=shadowMode==='forced-refresh',lanes=[];status(id+' '+shadowMode+' timing');
    for(let repetition=1;repetition<=8;repetition++)for(const arm of ['original','inline','inline','original'] as Arm[]){
     use(arm);const before=cacheRead();await warm(forceShadow);const after=cacheRead();cacheContract(after,arm);const samples=[];
     const lanePoolBefore=poolCounts(pool.read()),laneCacheBefore=cacheRead();
     for(let index=0;index<16;index++){
      // No diagnostic snapshots or per-draw observation in this consecutive
      // measured loop: their allocations could disturb later samples via GC.
      const sample=await submit(true,forceShadow);
      assert(sample.gpu.status==='complete'&&sample.gpu.nanoseconds!==null,'Native elapsed GPU query missing');
      samples.push({index,cpuMs:sample.cpuMs,fenceMs:sample.fenceMs,gpu:sample.gpu,calls:sample.calls,triangles:sample.triangles});
     }
     const lanePoolAfter=poolCounts(pool.read()),laneCache=cacheRead(),laneCacheDelta=cacheDelta(laneCacheBefore,laneCache);cacheContract(laneCache,arm);
     if(arm==='inline')assert(laneCacheDelta.skippedCalls>0,'Timed inline lane did not exercise cache');
     lanes.push({arm,repetition,framesPerLane:16,warmupRenders:3,warmCache:{before,after,delta:cacheDelta(before,after)},cpuMs:mean(samples.map(s=>s.cpuMs)),fenceMs:mean(samples.map(s=>s.fenceMs)),gpu:{status:'complete',nanoseconds:mean(samples.map(s=>s.gpu.nanoseconds!))},poolBefore:lanePoolBefore,poolAfter:lanePoolAfter,poolDelta:poolDifference(lanePoolBefore,lanePoolAfter),cacheBefore:laneCacheBefore,cache:laneCache,cacheDelta:laneCacheDelta,samples});
    }
    timings.push({name:id,shadowMode,baseline:'original',candidate:'inline',order:'ABBA',repetitions:8,framesPerLane:16,warmupRenders:3,lanes,scope:'Warmed frozen full-world snapshot with original shared pool. Each lane retains16 consecutive raw completed renders. Forced-refresh redraws original shadows each frame; steady-color retains the last completed original shadow map. CPU submission, actual GPU elapsed queries and completion fences are separate. No per-draw inspection during timing; neither mode is riding frame pacing.'});
   }
   verifyPoolHooks();assert(JSON.stringify(poolIdentity(pool.read()))===JSON.stringify(poolIdentity(poolBefore)),'Pool pages, eligibility or preparation changed');
  }
  use('original');poolAfter=pool.read();verifyPoolHooks();
 }catch(error){errors.push(error instanceof Error?error.stack||error.message:String(error));status('FAILED '+errors.at(-1));}
 finally{try{use('original');}catch(error){errors.push('Restoring original uniform setters failed: '+String(error));}}
 const programs=await Promise.all([...programEvidence.values()].map(async p=>({id:p.id,linked:p.linked,vertexSha256:await hash(new TextEncoder().encode(p.vertex)),fragmentSha256:await hash(new TextEncoder().encode(p.fragment)),vertex:p.vertex,fragment:p.fragment})));
 const inlineRows=rows.flatMap(row=>(row.comparisons as any[]).filter(c=>c.arm==='inline')),originalRows=rows.flatMap(row=>(row.comparisons as any[]).filter(c=>c.arm==='original'));
 const cacheCoverage={rows:inlineRows.length,
  substitutedColorDraws:originalRows.reduce((n,c)=>n+c.substitutedColorDraws,0),substitutedShadowDraws:originalRows.reduce((n,c)=>n+c.substitutedShadowDraws,0),
  namedShadowSkips:inlineRows.reduce((n,c)=>n+c.cacheDelta.skippedCalls,0),nativeShadowUpdates:controls.reduce((n,c)=>n+(c.uniformUpdate as any).nativeShadowUploads,0),nativeShadowRestores:controls.reduce((n,c)=>n+(c.uniformRestore as any).nativeShadowUploads,0),
  toggleFirstNativeUploads:controls.reduce((n,c)=>n+(c.toggle as any).firstNativeShadowUploads,0),toggleRepeatSkips:controls.reduce((n,c)=>n+(c.toggle as any).repeatShadowSkips,0),
  shadowChangedPixels:Math.max(0,...controls.map(c=>Number(c.shadowOffChangedPixels))),eligibleChangedPixels:Math.max(0,...controls.map(c=>Number(c.eligibleHiddenChangedPixels))),uniformUpdateChangedPixels:Math.max(0,...controls.map(c=>Number(c.uniformUpdateChangedPixels)))};
 const passed=errors.length===0&&rows.length===6&&rows.every(row=>row.passed)&&controls.length===6&&controls.every(c=>c.passed)&&programs.length>0&&programs.every(p=>p.linked)&&cacheCoverage.rows===6&&cacheCoverage.substitutedColorDraws>0&&cacheCoverage.substitutedShadowDraws>0&&cacheCoverage.namedShadowSkips>0&&cacheCoverage.nativeShadowUpdates>0&&cacheCoverage.nativeShadowRestores>0&&cacheCoverage.toggleFirstNativeUploads>0&&cacheCoverage.toggleRepeatSkips>0&&cacheCoverage.shadowChangedPixels>=16&&cacheCoverage.eligibleChangedPixels>=16&&cacheCoverage.uniformUpdateChangedPixels>=16&&poolBefore?.activeEntries>=200;
 return {schema:'belle-uniform-array-experiment-v1',gpu,width,height,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,software,rows,controls,timings,images,poolBefore,poolAfter,poolHooksPreserved:!!poolAfter,geometry,materials:materialReceipts(),programs,cacheCoverage,controller:cacheRead(),passed,errors,
  shadowReadback:'Exact RGBA8 shadow-target color attachments plus actual shadow draw/order checks and receiver shadow-off controls; native depth texture bytes are not claimed.',
  resourceScope:'Original renderer, source buffers and prepared shared pool remain active and resident in both arms. Only actual eligible named uniform node setters switch; no renderer wrapper, per-draw reflection, water cache or surface shader candidate is installed.',
  scope:'One constructed immutable d4 world with original geometry/materials/render hooks, three fixed views and Authentic day/night. Original native setter versus inline directionalShadowMatrix setter. Exact changing-light, restored-light and mode-invalidation controls. Optional approach assets are not requested; snapshot membership is recorded. Four art styles, optional stone bridge, actual riding/input, release performance and controls remain outside this initial experiment.'};
};
