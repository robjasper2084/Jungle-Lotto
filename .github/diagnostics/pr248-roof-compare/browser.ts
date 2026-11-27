/** Controlled diagnostic, never an application entry or public-input acceptance driver. */
import * as T from 'three';
import {createWorld} from '@app/world.ts';
import {ParkTerrain,type ParkMap} from '@app/terrain.ts';
import {alignScottMap} from '@app/fountainLayout.ts';
import {prepareCoastGuardMap} from '@app/coastGuard.ts';
import {activityLandmarks} from '@app/activitiesPlan.ts';
import {playgroundLandmarks} from '@app/playgrounds.ts';
import {prepareReferencePreferences} from '@app/sunsetReferencePolicy.ts';
import {enableHardwareAntialiasing} from '@app/antiAliasingPolicy.ts';
import {installSharedGeometryBuffers} from '@app/sharedGeometryBuffers.ts';
import {planDetroitProps} from '@app/detroitProps.ts';
import {check,sha,f32,objectPath,roofPath,cameraReceipt,setRecordedCamera,sceneReceipt} from './scene-receipt';
import pins from './pins.json';
import {snapshotOwnedSubmission} from './submission-receipt.ts';
import {createEvidencePager} from './evidence-transfer.ts';
declare const __ROOF_VARIANT__:'before'|'candidate';

const root=window as any,mode=__ROOF_VARIANT__,{width,height}=pins.viewport;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const text=(e:unknown)=>e instanceof Error?e.stack||e.message:String(e);
const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
prepareReferencePreferences();
const aaDevice={coarsePointer:matchMedia('(pointer:coarse)').matches,deviceMemoryGB:(navigator as Navigator&{deviceMemory?:number}).deviceMemory,logicalCores:navigator.hardwareConcurrency};
const requestedMsaa=enableHardwareAntialiasing('automatic',aaDevice),rendererOutput={type:T.UnsignedByteType,nodes:false} as const;
const renderer=new T.WebGLRenderer({canvas,antialias:requestedMsaa,powerPreference:'high-performance',outputBufferType:rendererOutput.type});
renderer.setSize(width,height,false);renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,width/height,.08,22000),gl=renderer.getContext() as WebGL2RenderingContext;
const debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
const evidence:any={schema:1,diagnosticOnly:true,releaseAcceptance:false,mode,source:pins.sources[mode],gpu,
 scope:'Unmodified complete createWorld construction with original source-controlled culling/LOD. Recorded camera is assigned only to this separate fixture.',
 omissions:['No main.ts HUD, gameplay loop, native walking, player/companion/vehicle controllers, online riders, photography or race layer.',
  'World dynamics use the declared fixed simulation samples; no elapsed-time or 90-second performance acceptance.',
  'Original deferred prefetch ranges remain authoritative. The original public world landmark-preparation API completes the near-view queue; distant optional golf detail is not forced into view.'],
 construction:pins.construction,preparation:[],errors:[],cases:[]};
let world:Awaited<ReturnType<typeof createWorld>>,current:any,draws:any[]=[],recordDraws=false,shared:any;
let ownedSnapshots:ReturnType<typeof snapshotOwnedSubmission>[]=[];
let requiredDetroitProps:{name:string;placements:number;instances:number}[]=[];
function publishedDetroitProps(){
 const matches=[];
 for(const stage of scene.children){
  if(!stage.visible||!stage.children.length||!stage.children.every(o=>(o as T.InstancedMesh).isInstancedMesh&&requiredDetroitProps.some(r=>r.name===o.name)))continue;
  const actual=requiredDetroitProps.map(r=>({...r,actual:stage.children.filter(o=>o.name===r.name).reduce((n,o)=>n+(o as T.InstancedMesh).count,0)}));
  if(actual.every(r=>r.actual===r.instances))matches.push({path:objectPath(stage),categories:actual,meshes:stage.children.length});
 }
 check(matches.length<=1,'Ambiguous published original Detroit prop stages');return matches[0]??null;
}
const pendingWork={loads:0,compiles:0,events:0,lastActivity:performance.now(),errors:[] as string[]};
const activity=()=>{pendingWork.events++;pendingWork.lastActivity=performance.now();};
for(const [method,delta] of [['itemStart',1],['itemEnd',-1]] as const){
 const original=T.DefaultLoadingManager[method];
 T.DefaultLoadingManager[method]=function(...args:Parameters<typeof original>){
  try{return Reflect.apply(original,this,args);}finally{pendingWork.loads+=delta;activity();}
 };
}
const compileAsync=renderer.compileAsync;
renderer.compileAsync=function(...args:Parameters<typeof compileAsync>){
 pendingWork.compiles++;activity();let promise:ReturnType<typeof compileAsync>;
 try{promise=Reflect.apply(compileAsync,this,args);}catch(e){pendingWork.compiles--;activity();pendingWork.errors.push(text(e));throw e;}
 // Observe settlement through a side chain; callers receive the exact original Promise.
 void promise.then(()=>{pendingWork.compiles--;activity();},e=>{pendingWork.compiles--;activity();pendingWork.errors.push(text(e));});
 return promise;
};
async function finishOriginalPreparation(){
 const start=performance.now();
 for(;;){
  check(performance.now()-start<90000,'Original scenery load/compile preparation did not become quiet');
  check(!pendingWork.errors.length&&pendingWork.loads>=0,'Original scenery preparation failed');
  await new Promise(r=>setTimeout(r,100));
  if(pendingWork.loads||pendingWork.compiles)continue;
  // This original update publishes a ready Detroit pack and applies original
  // distance/LOD choices. It neither substitutes meshes nor forces visibility.
  world.update(current.time,camera.position.x,camera.position.z,camera,false,false);
  await Promise.resolve();
  const published=publishedDetroitProps();
  if(published&&!pendingWork.loads&&!pendingWork.compiles&&performance.now()-pendingWork.lastActivity>=500)return {...pendingWork,publishedDetroitProps:published,waitMs:performance.now()-start};
 }
}
const counts=()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,points:renderer.info.render.points});
const direct=renderer.renderBufferDirect;
// Install before the original shared-buffer helper. This sees the actual
// geometry passed through its legitimate forwarding wrapper, not a synthetic draw.
renderer.renderBufferDirect=function(...args:Parameters<typeof direct>){
 const [cam,drawScene,geometry,material,object]=args,prior=counts(),target=renderer.getRenderTarget();
 const depth=!!((material as any).isMeshDepthMaterial||(material as any).isMeshDistanceMaterial);
 const pass=target===null&&drawScene===scene&&cam===camera&&!depth?'color':target!==null&&depth?'shadow':'auxiliary';
 try{return Reflect.apply(direct,this,args);}
 finally{if(recordDraws){const after=counts();const row:any={path:objectPath(object),name:object.name,pass,materialType:material.type,materialName:material.name,
  materialSide:material.side,renderOrder:object.renderOrder,castShadow:object.castShadow,receiveShadow:object.receiveShadow,
  submittedGeometry:{positionCount:geometry.getAttribute('position')?.count??0,indexCount:geometry.index?.count??0,start:geometry.drawRange.start,count:Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:'Infinity'},
  camera:cameraReceipt(cam as T.PerspectiveCamera),calls:after.calls-prior.calls,triangles:after.triangles-prior.triangles,lines:after.lines-prior.lines,points:after.points-prior.points};
  const owner=snapshotOwnedSubmission(geometry,(object as T.Mesh).geometry,args[5],roofPath(row.path));if(owner){row.submittedOwnership=owner.receipt;ownedSnapshots.push(owner);}draws.push(row);
 }}
};
async function fence(){
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(sync,'Native WebGL2 fence unavailable');gl.flush();const start=performance.now();
 try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return {submittedAt:start,completedAt:performance.now(),result:state===gl.ALREADY_SIGNALED?'ALREADY_SIGNALED':'CONDITION_SATISFIED'};
  check(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'Native GPU fence failed');check(performance.now()-start<90000,'Native GPU fence exceeded 90 seconds');await new Promise(r=>setTimeout(r,8));}}
 finally{gl.deleteSync(sync);}
}
function shadowMaps(){const rows:any[]=[];scene.traverse((o:any)=>{if(o.isLight&&o.shadow)rows.push({path:objectPath(o),type:o.type,castShadow:o.castShadow,intensity:o.shadow.intensity,
 bias:o.shadow.bias,normalBias:o.shadow.normalBias,radius:o.shadow.radius,mapSize:o.shadow.mapSize.toArray(),allocated:o.shadow.map?[o.shadow.map.width,o.shadow.map.height]:null,
 camera:cameraReceipt(o.shadow.camera)});});return rows;}
function settings(){return {viewport:{width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio(),devicePixelRatio},aaDevice,requestedMsaa,
 actualContext:gl.getContextAttributes(),quality:world.quality.requested,effectiveQuality:world.quality.effective,scale:world.quality.scale,
 reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,focused:document.hasFocus(),visible:!document.hidden,
 hour:world.sky.hour,skySettings:world.sky.settings,artStyle:world.sky.artStyle,shadow:{enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type,autoUpdate:renderer.shadowMap.autoUpdate},
 toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,
 referenceFrameCap:60,fixtureFrameScheduling:'explicit frozen renders; no performance measurement or frame-cap claim'};}
function assertCamera(){
 const c=cameraReceipt(camera),p=current.reference.camera;
 check(same(c.gpu.view.bits,p.gpu.viewMatrixBits)&&same(c.gpu.projection.bits,p.gpu.projectionMatrixBits)&&same(c.gpu.position.bits,p.gpu.cameraPositionBits),'Actual diagnostic camera differs from recorded Float32 GPU inputs');
 check(same(c.projection,p.projection),'Recorded projection parameters changed');
}
function assertSettings(){const s=settings();check(s.viewport.width===1280&&s.viewport.height===800&&s.viewport.pixelRatio===1&&devicePixelRatio===1,'Native original-resolution viewport changed');
 check(s.quality==='high'&&s.effectiveQuality==='high'&&s.scale===1,'Original High quality changed');check(s.reducedMotion&&s.focused&&s.visible,'Native page must remain visible/focused/reduced motion');
 check(s.hour===12&&!s.skySettings.cycle&&s.skySettings.clouds==='clear'&&s.artStyle==='authentic'&&s.shadow.enabled&&s.shadow.type===T.PCFShadowMap,'Original noon/clear/PCF shadows changed');check(/Metal/.test(gpu)&&!/SwiftShader|llvmpipe/i.test(gpu),'Native Metal required');}
function roofObjects(){const result:T.Mesh[]=[];scene.traverse(o=>{if((o as T.Mesh).isMesh&&roofPath(objectPath(o)))result.push(o as T.Mesh);});
 check(result.length===3,'All three original Aquarium roof meshes must remain present');return result;}
function roofRegion(){
 const roof=roofObjects().find(o=>objectPath(o).includes('107227742_STAGED_LOD0#'))!;check(roof,'Aquarium LOD0 roof missing');
 check(same(f32(roof.matrixWorld.toArray()).bits,f32(current.reference.aquariumMatrixWorld).bits),'Recorded Aquarium model transform changed');
 const projected=[];
 // A fixed union bound for both the existing shell and added end closures.
 // Padding includes nearby roof ribs. This is a diagnostic crop, never a mask
 // that permits changes elsewhere in the image or world.
 for(const x of [-6.9,6.9])for(const y of [7.6,9.8])for(const z of [-38.2,38.2]){
  const v=new T.Vector3(x,y,z).applyMatrix4(roof.matrixWorld).project(camera);check(v.z>-1&&v.z<1,'Roof region is outside camera depth');projected.push([(v.x+1)*width/2,(1-v.y)*height/2]);
 }
 const x=Math.max(0,Math.floor(Math.min(...projected.map(v=>v[0])))-12),y=Math.max(0,Math.floor(Math.min(...projected.map(v=>v[1])))-12);
 const right=Math.min(width,Math.ceil(Math.max(...projected.map(v=>v[0])))+12),bottom=Math.min(height,Math.ceil(Math.max(...projected.map(v=>v[1])))+12);
 check(right>x&&bottom>y,'Empty roof region');return {x,y,width:right-x,height:bottom-y,padding:12,localBounds:[[-6.9,7.6,-38.2],[6.9,9.8,38.2]],projected};
}
function draw():any{
 assertCamera();assertSettings();check(!pendingWork.loads&&!pendingWork.compiles&&!pendingWork.errors.length&&publishedDetroitProps(),'Original asset work/publication is incomplete during frozen render');draws=[];ownedSnapshots=[];recordDraws=true;const before=renderer.info.render.frame;
 try{renderer.render(scene,camera);}finally{recordDraws=false;}
 assertCamera();check(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native WebGL render failed');
 const observer=root.__landmarkComparisonObserver.snapshot();
 check(observer.latest?.valid&&observer.fresh,'Incomplete original renderer submission observation');
 const expected=mode==='before'?48:98;
 const roof=draws.filter(d=>d.pass==='color'&&roofPath(d.path)&&d.calls>0);
 check(roof.length===1&&roof[0].path.includes('107227742_STAGED_LOD0#')&&roof[0].triangles===expected,'Actual color submission is not the original full-detail roof');
 const copies=ownedSnapshots.slice(),receipt={frameBefore:before,frameAfter:renderer.info.render.frame,camera:cameraReceipt(camera),settings:settings(),draws:draws.slice(),observer,
  preparationActivity:{events:pendingWork.events,loads:pendingWork.loads,compiles:pendingWork.compiles,errors:pendingWork.errors.slice()}};
 // Hash synchronous copies only after native readPixels/toDataURL. The draw
 // itself and every source-owned buffer stay synchronous and unchanged.
 return Object.defineProperty(receipt,'settleOwners',{value:()=>Promise.all(copies.map(o=>o!.settle(sha)))});
}
const ready=(async()=>{
 check(root.__roofDeterminism&&root.__landmarkComparisonObserver,'Original observer and explicit construction seed must be installed before modules');
 const r=await fetch('./belle/map.json');check(r.ok,'Immutable map unavailable');const map=await r.json() as ParkMap;
 alignScottMap(map);prepareCoastGuardMap(map);for(const p of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some(l=>l.id===p.id))map.landmarks.push(p);
 const terrain=new ParkTerrain(map,true);world=await createWorld(scene,renderer,map,terrain,s=>evidence.preparation.push(s));
 requiredDetroitProps=[...planDetroitProps(terrain)].filter(([,items])=>items.length).map(([name,items])=>{
  const primitives=(pins.detroitProps.primitiveCounts as Record<string,number>)[name];check(primitives>0,'Unpinned original Detroit prop category: '+name);
  return {name,placements:items.length,instances:items.length*primitives};
 });check(requiredDetroitProps.length>0,'Original Detroit prop plan unexpectedly empty');
 world.sky.preview(false);world.setQuality('high');world.sky.configure({hour:12,cycle:false,clouds:'clear'});world.sky.tick(0,false,true);
 shared=installSharedGeometryBuffers(renderer,scene,{rendererOutput});shared.prepare();
 for(const roof of roofObjects())check(!roof.geometry.getAttribute('normal'),'Reviewed flat roof unexpectedly gained normals/batching eligibility');
 evidence.constructed={settings:settings(),stats:JSON.parse(JSON.stringify(world.stats)),random:root.__roofDeterminism(),sharedBuffers:shared.read(),requiredDetroitProps};return evidence.constructed;
})();
ready.catch(e=>evidence.errors.push(text(e)));
async function prepare(index:number){
 await ready;check(Number.isInteger(index)&&index===evidence.cases.length&&index<pins.nativeBeforeEvidence.views.length,'Views must run once in the pinned order');
 current={index,name:pins.nativeBeforeEvidence.views[index].name,reference:pins.nativeBeforeEvidence.views[index],time:pins.construction.simulationTimeSeconds+index,
  captures:[],preparationPasses:[]};evidence.cases.push(current);setRecordedCamera(camera,current.reference.camera);assertCamera();
 // Trigger the source's ordinary near-view prefetch. This original method then
 // waits for the queued landmark work; no replacement geometry or material.
 world.update(current.time,camera.position.x,camera.position.z,camera,true,true);
 await world.prepareCadillacLandmarks(camera,camera.position.x,camera.position.z);
 check(world.stats.playgrounds.loaded&&world.stats.yachtClub.meshes>0,'Original landmark preparation did not complete');
 current.preparationQuiet=await finishOriginalPreparation();
 await world.sky.prepareReflections(camera,camera.position.x,camera.position.z);scene.updateMatrixWorld(true);
 await renderer.compileAsync(scene,camera);await fence();
 const first=draw();first.shadowMaps=shadowMaps();current.preparationPasses.push(first);await fence();await first.settleOwners();
 check(first.draws.some((d:any)=>d.pass==='shadow'&&d.calls>0&&d.triangles>0),'Original scheduled shadow pass has no actual native submissions');
 check(first.shadowMaps.some((s:any)=>s.castShadow&&s.intensity>0&&s.allocated?.[0]>0&&s.allocated?.[1]>0),'Original High shadow map is not allocated');
 const observer=root.__landmarkComparisonObserver;
 if(index===0){check(observer.canArm(),'Original observer cannot arm after complete preparation');current.captureWindow=observer.arm();}
 for(let i=0;i<2;i++){const frame=draw();current.preparationPasses.push(frame);await fence();await frame.settleOwners();}
 check(observer.ready(),'Original observer is not ready for native captures');
 current.roofRegion=roofRegion();current.scene=await sceneReceipt(scene);current.stats=JSON.parse(JSON.stringify(world.stats));current.random=root.__roofDeterminism();
 return {name:current.name,roofRegion:current.roofRegion};
}
const rawBase64=(bytes:Uint8Array)=>{let b='';for(let i=0;i<bytes.length;i+=32768)b+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(b);};
async function capture(index:number){
 check(current&&index===current.captures.length&&index<2,'Exactly two ordered frozen captures per variant/view');
 const receipt=draw(),pixels=new Uint8Array(width*height*4);
 // Same synchronous task: preserveDrawingBuffer stays at its original false.
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);check(gl.getError()===gl.NO_ERROR,'Original framebuffer read failed');
 const png=canvas.toDataURL('image/png');const completion=await fence();await receipt.settleOwners();
 const row={index,...receipt,roofRegion:current.roofRegion,pixelSha256:await sha(pixels),completion,random:root.__roofDeterminism()};
 current.captures.push(row);return {...row,png,rawRgbaBase64:rawBase64(pixels)};
}
async function finishCase(){
 check(current.captures.length===2,'Missing frozen native captures');
 current.sceneAfter=await sceneReceipt(scene);
 if(current.index+1<pins.nativeBeforeEvidence.views.length){
  // The original cadence needs one intervening color-only frame at a distinct
  // simulation time. Keep all four captured samples unchanged; a repeated
  // frozen timestamp never advances that cadence. Do not force shadow flags.
  const time=current.time+1/60,updateFlags={running:false,allowDeferred:false};
  world.update(time,camera.position.x,camera.position.z,camera,updateFlags.running,updateFlags.allowDeferred);
  const frame=draw();const completion=await fence();await frame.settleOwners();
  current.transitionAfterCapture={time,stepSeconds:1/60,updateFlags,...frame,completion};
 }
 return {name:current.name};
}
const wrap=(fn:Function)=>async(...args:any[])=>{try{return await fn(...args);}catch(e){evidence.errors.push(text(e));throw e;}};
const transfer=createEvidencePager(()=>evidence,{mode,source:pins.sources[mode]});
root.__roofCompare=Object.freeze({ready:()=>ready,prepare:wrap(prepare),capture:wrap(capture),finishCase:wrap(finishCase),read:()=>evidence,transfer});
