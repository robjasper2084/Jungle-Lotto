/** Diagnostic only: the original d4 world, native Three and original shared
 * buffers. Only four factory-authorized meshes' renderOrder may change. */
import * as T from 'three';
// @ts-ignore Immutable Git graph supplied by the driver.
import {createWorld} from 'baseline:world.ts';
// @ts-ignore Immutable original factory.
import {ParkTerrain} from 'baseline:terrain.ts';
// @ts-ignore Same original shader provenance graph as createWorld.
import {installSharedGeometryBuffers} from 'baseline:sharedGeometryBuffers.ts';
// @ts-ignore Original boot map mutations.
import {alignScottMap} from 'baseline:fountainLayout.ts';
// @ts-ignore Original boot map mutations.
import {prepareCoastGuardMap} from 'baseline:coastGuard.ts';
// @ts-ignore Original boot landmarks.
import {activityLandmarks} from 'baseline:activitiesPlan.ts';
// @ts-ignore Original boot landmarks.
import {playgroundLandmarks} from 'baseline:playgrounds.ts';
// @ts-ignore Original preference policy.
import {prepareReferencePreferences} from 'baseline:sunsetReferencePolicy.ts';
// @ts-ignore Only exact, receipt-verified factory source injections may record.
import {opaqueSurfaceOwners} from 'fixture:opaque-order-owners';
import {createOpaqueSurfaceOrder,type OpaqueSurfaceOwner,type OpaqueSurfaceOrderMode} from '../src/belle/opaqueSurfaceOrder.ts';

type Arm=OpaqueSurfaceOrderMode;
type OrderReceipt=ReturnType<ReturnType<typeof createOpaqueSurfaceOrder>['read']>;
type Draw={object:number;name:string;sourceGeometry:number;material:number;phase:string;start:number;count:number;program:number;substituted:boolean;renderOrder:number;groupOrder:number;transparent:boolean;transmission:number;depthTest:boolean;depthWrite:boolean;depthFunc:number};
type GpuTiming={status:string;nanoseconds:number|null;queryId:number|null;resultAvailable:boolean;disjoint:boolean};
type PoolCounts={renderCalls:number;pooledCalls:number;colorCalls:number;shadowCalls:number};
type Submission={calls:number;triangles:number;draws:Draw[];cpuMs:number;fenceMs:number;gpu:GpuTiming};
type Frame=Submission&{rgba:Uint8Array;shadow:Uint8Array;poolDelta:PoolCounts;orderReceipt:OrderReceipt};
type Pose={name:string;index:number;frozenTime:number;hour:number;position:number[];target:number[];recipe?:unknown};
const arms:Arm[]=['original','early-terrain','late-sky'],candidates:Arm[]=['early-terrain','late-sky'];
const allCases=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night','ramp-grazing-day','under-ramp-day'];
const partitions={all:allCases,'linux-a':allCases.slice(0,4),'linux-b':allCases.slice(4)};
const width=960,height=600,near=.08,far=22000;
const assert:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message);};
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,'0')).join('');
const textHash=(value:unknown)=>hash(new TextEncoder().encode(JSON.stringify(value)));
const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext,debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),software=/SwiftShader|llvmpipe/i.test(gpu),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
assert(typeof gl.fenceSync==='function','WebGL2 completion fences required');if(!software)assert(timer,'Native elapsed GPU timer required');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,width/height,near,far);
const images:{name:string;png:string}[]=[],rows:any[]=[],controls:any[]=[],timings:any[]=[],errors:string[]=[];
const programEvidence=new Map<number,{id:number;linked:boolean;vertex:string;fragment:string}>(),depthWriterEvidence=new Map<number,any>();
const originalOrderById=new Map<number,number>(),ownerById=new Map<number,OpaqueSurfaceOwner>();
let pool:any,controller:ReturnType<typeof createOpaqueSurfaceOrder>,ownerBaseline:OrderReceipt,entryByObject=new Map<number,any>(),nextQueryId=1;
let drawing:Draw[]|null=null,observePrograms=false,poolHooks:{render:unknown;direct:unknown;before:unknown;after:unknown}|undefined;
const status=(message:string)=>console.log('opaque order proof '+message);
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
const poolCounts=(stats:any):PoolCounts=>({renderCalls:stats.renderCalls,pooledCalls:stats.pooledCalls,colorCalls:stats.colorCalls,shadowCalls:stats.shadowCalls});
const poolDifference=(before:PoolCounts,after:PoolCounts):PoolCounts=>({renderCalls:after.renderCalls-before.renderCalls,pooledCalls:after.pooledCalls-before.pooledCalls,colorCalls:after.colorCalls-before.colorCalls,shadowCalls:after.shadowCalls-before.shadowCalls});
const errorText=(error:unknown)=>error instanceof Error?error.stack||error.message:String(error);
function verifyPoolHooks(){assert(poolHooks&&renderer.render===poolHooks.render&&renderer.renderBufferDirect===poolHooks.direct&&scene.onBeforeRender===poolHooks.before&&scene.onAfterRender===poolHooks.after,'Original pool hooks changed');}
function expectedOrder(arm:Arm,id:number,current:number){const owner=ownerById.get(id);return !owner?current:arm==='early-terrain'&&owner.kind!=='sky'?(owner.kind==='asphalt'?-104:-103):arm==='late-sky'&&owner.kind==='sky'?1000000:originalOrderById.get(id)!;}
function verifyOwners(arm:Arm){
 const receipt=controller.read();assert(receipt.mode===arm&&receipt.owners.length===4,'Owner mode or cardinality changed');
 for(const entry of receipt.owners){const owner=ownerById.get(entry.id),original=ownerBaseline.owners.find(o=>o.id===entry.id);assert(owner&&original,'Unknown owner');assert(owner.mesh.geometry.id===entry.geometryId&&owner.mesh.material===sceneMaterial(entry.materialIds[0]),'Actual factory object identity changed');assert(entry.kind===original.kind&&entry.geometryId===original.geometryId&&JSON.stringify(entry.materialIds)===JSON.stringify(original.materialIds)&&entry.originalOrder===original.originalOrder,'Factory receipt changed');assert(entry.order===expectedOrder(arm,entry.id,entry.originalOrder),'Incorrect actual factory order');}
 return receipt;
}
function sceneMaterial(id:number){for(const owner of ownerById.values()){const material=owner.mesh.material as T.Material&{id:number};if(material.id===id)return material;}return null;}
function use(arm:Arm){controller.setMode(arm);return verifyOwners(arm);}
function groupOrder(object:T.Object3D){for(let parent=object.parent;parent;parent=parent.parent)if((parent as T.Group).isGroup)return parent.renderOrder;return 0;}
function installObserver(){
 const direct=renderer.renderBufferDirect;
 renderer.renderBufferDirect=function(...args:Parameters<T.WebGLRenderer['renderBufferDirect']>){
  const result=direct.apply(this,args);
  if(drawing){const [,root,geometry,material,object,group]=args,source=(object as T.Mesh).geometry,entry=entryByObject.get(object.id),substituted=source!==geometry;
   const count=geometry.index?.count??geometry.attributes.position?.count??0,start=Math.max(geometry.drawRange.start,group?.start??0),end=Math.min(count,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity),offset=substituted?(geometry.index?entry?.indexOffset:entry?.vertexOffset):0;
   assert(!substituted||Number.isSafeInteger(offset),'Unattributed original pool substitution');const program=(renderer.properties.get(material) as any).currentProgram;assert(program?.program,'Direct submission has no native program');
   drawing.push({object:object.id,name:object.name,sourceGeometry:source?.id??-1,material:(material as T.Material&{id:number}).id,phase:root===null?'shadow':'color',start:start-offset,count:Math.max(0,end-start),program:program.id,substituted,renderOrder:object.renderOrder,groupOrder:groupOrder(object),transparent:material.transparent,transmission:(material as T.MeshPhysicalMaterial).transmission??0,depthTest:material.depthTest,depthWrite:material.depthWrite,depthFunc:material.depthFunc});
   if(observePrograms&&!programEvidence.has(program.id)){const attached=gl.getAttachedShaders(program.program)||[],vertex=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);assert(vertex&&fragment,'Actual attached shaders unavailable');programEvidence.set(program.id,{id:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS)===true,vertex:gl.getShaderSource(vertex)||'',fragment:gl.getShaderSource(fragment)||''});}
  }return result;
 };
}
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'Fence unavailable');gl.flush();const began=performance.now();try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-began;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-began<90000,'GPU fence exceeded90seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
async function submit(measure=false,capture=false):Promise<Submission>{
 assert(renderer.getRenderTarget()===null,'Default framebuffer required');verifyPoolHooks();drawing=capture?[]:null;observePrograms=capture;renderer.shadowMap.needsUpdate=true;
 let query:WebGLQuery|null=null,queryId:number|null=null;if(measure&&timer){assert(gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)===null,'GPU query already active');query=gl.createQuery();assert(query,'GPU query allocation failed');queryId=nextQueryId++;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
 const began=performance.now();try{renderer.render(scene,camera);}finally{if(query)gl.endQuery(timer!.TIME_ELAPSED_EXT);}
 const cpuMs=performance.now()-began,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,draws=drawing??[];drawing=null;observePrograms=false;
 const fenceMs=await fence(),timing:GpuTiming={status:measure?'unavailable':'not-requested',nanoseconds:null,queryId,resultAvailable:false,disjoint:false};
 if(query){try{timing.resultAvailable=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)===true;timing.disjoint=gl.getParameter(timer!.GPU_DISJOINT_EXT)===true;assert(timing.resultAvailable&&!timing.disjoint,'Unavailable/disjoint elapsed query');timing.nanoseconds=Number(gl.getQueryParameter(query,gl.QUERY_RESULT));assert(Number.isFinite(timing.nanoseconds)&&timing.nanoseconds>0,'Invalid GPU elapsed duration');timing.status='complete';}finally{gl.deleteQuery(query);}}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native GL error/context loss');verifyPoolHooks();return {cpuMs,fenceMs,calls,triangles,draws,gpu:timing};
}
async function warm(){for(let i=0;i<3;i++)await submit();}
async function render():Promise<Frame>{
 const before=poolCounts(pool.read()),work=await submit(false,true),rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 const parts:Uint8Array[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow&&object.shadow.map){const target=object.shadow.map as T.WebGLRenderTarget,bytes=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);parts.push(bytes);}});
 const shadow=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){shadow.set(part,offset);offset+=part.length;}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native readback error');const mode=controller.read().mode;
 return {...work,rgba,shadow,poolDelta:poolDifference(before,poolCounts(pool.read())),orderReceipt:verifyOwners(mode)};
}
function difference(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Readback length changed');let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);changed ||= delta>0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};}
function png(bytes:Uint8Array){const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d')!,data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(bytes.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return out.toDataURL('image/png');}
function save(name:string,frame:Frame){assert(!images.some(image=>image.name===name),'Duplicate capture '+name);images.push({name,png:png(frame.rgba)});}
const opaque=(draw:Draw)=>!draw.transparent&&draw.transmission===0;
function canonical(draw:Draw){return {...draw,renderOrder:originalOrderById.get(draw.object)??draw.renderOrder};}
function matching(a:Frame,b:Frame,arm:Arm){
 const color=difference(a.rgba,b.rgba),shadow=difference(a.shadow,b.shadow),originalColor=a.draws.filter(d=>d.phase==='color'),actualColor=b.draws.filter(d=>d.phase==='color');
 const expectedColor=[...originalColor.filter(opaque)].map(draw=>({...draw,renderOrder:expectedOrder(arm,draw.object,draw.renderOrder)})).sort((x,y)=>x.groupOrder-y.groupOrder||x.renderOrder-y.renderOrder).concat(originalColor.filter(d=>!opaque(d)));
 const canonicalList=(draws:Draw[])=>draws.map(d=>JSON.stringify(canonical(d))).sort();
 return {...color,shadowChangedPixels:shadow.changedPixels,shadowMaxChannelDelta:shadow.maxChannelDelta,colorOrderAllowed:JSON.stringify(expectedColor)===JSON.stringify(actualColor),shadowOrderEqual:JSON.stringify(a.draws.filter(d=>d.phase==='shadow'))===JSON.stringify(b.draws.filter(d=>d.phase==='shadow')),drawMultisetEqual:JSON.stringify(canonicalList(a.draws))===JSON.stringify(canonicalList(b.draws)),countsEqual:a.calls===b.calls&&a.triangles===b.triangles};
}
function exact(value:ReturnType<typeof matching>){return value.changedPixels===0&&value.maxChannelDelta===0&&value.shadowChangedPixels===0&&value.shadowMaxChannelDelta===0&&value.colorOrderAllowed&&value.shadowOrderEqual&&value.drawMultisetEqual&&value.countsEqual;}
function activity(frame:Frame){const substitutions=frame.draws.filter(d=>d.substituted),color=substitutions.filter(d=>d.phase==='color').length,shadow=substitutions.filter(d=>d.phase==='shadow').length;assert(frame.poolDelta.renderCalls>0&&color>0,'Original pool did not run');assert(substitutions.length===frame.poolDelta.pooledCalls&&color===frame.poolDelta.colorCalls&&shadow===frame.poolDelta.shadowCalls,'Actual pool substitutions disagree with counters');return {substitutedColorDraws:color,substitutedShadowDraws:shadow};}
function poolIdentity(stats:any){return {preparedEntries:stats.preparedEntries,activeEntries:stats.activeEntries,pageCount:stats.pageCount,poolBytes:stats.poolBytes,pages:stats.pages,preparationAttempts:stats.preparationAttempts,preparationRenders:stats.preparationRenders,preparationFrames:stats.preparationFrames,preparationReady:stats.preparationReady,fallbacks:stats.fallbacks,observerErrors:stats.observerErrors,contextLosses:stats.contextLosses};}
async function geometryReceipts(){
 const geometries=new Map<T.BufferGeometry,Promise<unknown>>(),meshes:Record<string,unknown>[]=[];
 scene.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;const geometry=mesh.geometry;
  if(!geometries.has(geometry))geometries.set(geometry,(async()=>{const attributes:Record<string,unknown>={};for(const [key,attribute]of Object.entries(geometry.attributes)){const a=attribute as T.BufferAttribute;attributes[key]={itemSize:a.itemSize,count:a.count,normalized:a.normalized,type:a.array.constructor.name,sha256:await hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))};}const index=geometry.index;return {id:geometry.id,attributes,index:index?{type:index.array.constructor.name,count:index.count,sha256:await hash(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength))}:null,groups:geometry.groups.map(g=>({...g}))};})());
  meshes.push({id:mesh.id,name:mesh.name,geometry:geometry.id,material:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>(m as T.Material&{id:number}).id),matrix:mesh.matrix.toArray(),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:originalOrderById.get(mesh.id)??mesh.renderOrder});
 });return {meshes,geometries:await Promise.all(geometries.values())};
}
function sceneMaterials(){const materials=new Set<T.Material>();scene.traverse(object=>{const material=(object as T.Mesh).material;if(material)for(const m of Array.isArray(material)?material:[material])materials.add(m);});return [...materials];}
function materialReceipts(){return sceneMaterials().map(material=>{
 const textures:Record<string,unknown>={},parameters=material as T.MeshStandardMaterial,properties=renderer.properties.get(material) as any;
 const values={...Object.fromEntries(Object.entries(material).filter(([,value])=>value instanceof T.Texture)),...Object.fromEntries(Object.entries(properties.uniforms??{}).map(([name,value])=>[name,(value as T.IUniform).value]))};
 for(const [name,value]of Object.entries(values))if(value instanceof T.Texture){const data=value.source.data as {width?:number;height?:number;currentSrc?:string;src?:string};textures[name]={uuid:value.uuid,name:value.name,url:data?.currentSrc||data?.src||null,width:data?.width,height:data?.height,colorSpace:value.colorSpace,channel:value.channel,format:value.format,type:value.type,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,anisotropy:value.anisotropy,matrix:value.matrix.toArray()};}
 return {id:(material as T.Material&{id:number}).id,name:material.name,type:material.type,materialSide:material.side,opacity:material.opacity,transparent:material.transparent,transmission:(material as T.MeshPhysicalMaterial).transmission??0,depthWrite:material.depthWrite,depthTest:material.depthTest,depthFunc:material.depthFunc,colorWrite:material.colorWrite,alphaTest:material.alphaTest,alphaHash:material.alphaHash,blending:material.blending,polygonOffset:material.polygonOffset,polygonOffsetFactor:material.polygonOffsetFactor,polygonOffsetUnits:material.polygonOffsetUnits,color:parameters.color?.toArray(),roughness:parameters.roughness,metalness:parameters.metalness,compile:String(material.onBeforeCompile),render:String(material.onBeforeRender),key:String(material.customProgramCacheKey),programKey:material.customProgramCacheKey(),textures};
 });}
function opaqueDepthWriters(){
 const records=sceneMaterials().filter(m=>!m.transparent&&((m as T.MeshPhysicalMaterial).transmission??0)===0).map(m=>({id:(m as T.Material&{id:number}).id,name:m.name,type:m.type,transparent:m.transparent,transmission:(m as T.MeshPhysicalMaterial).transmission??0,depthTest:m.depthTest,depthWrite:m.depthWrite,depthFunc:m.depthFunc,colorWrite:m.colorWrite,opacity:m.opacity,alphaTest:m.alphaTest,alphaHash:m.alphaHash,blending:m.blending}));
 for(const record of records)depthWriterEvidence.set(record.id,record);return records;
}
function posesFor(map:any,terrain:any){
 const poses:Pose[]=[],original=[{name:'jefferson',position:[0,6,0],target:[160,4,290]},{name:'island',position:[480,8,830],target:[630,3,1050]},{name:'conservatory',position:[1290,7,1115],target:[1330.8,9,1174.7]}];
 for(const pose of original)for(const night of [false,true])poses.push({name:pose.name+(night?'-night':'-day'),index:poses.length,frozenTime:120+poses.length,hour:night?21:14,position:pose.position,target:pose.target});
 const {a,b,length,width:bridgeWidth}=map.bridge,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
 const point=(s:number,w:number,heightOffset:number)=>{const x=a[0]+ux*s+uz*w,z=a[1]+uz*s-ux*w,terrainHeight=terrain.height(x,z);return {s,w,heightOffset,terrainHeight,position:[x,terrainHeight+heightOffset,z]};};
 const grazing={position:point(-130,bridgeWidth/2+.35,.18),target:point(-6,bridgeWidth/2-.35,.04)},under={position:point(-60,0,-.65),target:point(8,bridgeWidth/2+4,.1)};
 for(const [name,recipe]of [['ramp-grazing-day',grazing],['under-ramp-day',under]] as const)poses.push({name,index:poses.length,frozenTime:120+poses.length,hour:14,position:recipe.position.position,target:recipe.target.position,recipe});
 return {poses,bridgeBasis:{a:[...a],b:[...b],length,width:bridgeWidth,ux,uz}};
}

(window as unknown as {__opaqueOrderProof:(partition?:keyof typeof partitions)=>Promise<unknown>}).__opaqueOrderProof=async(partition='all')=>{
 let poolBefore:any=null,poolAfter:any=null,geometry:unknown=null,casePlan:Pose[]=[],bridgeBasis:unknown=null,ownerFinal:OrderReceipt|undefined;
 const prelude:{name:string;frozenTime:number;warmupRenders:number}[]=[];
 const candidateFailures:Record<string,string[]>={'early-terrain':[],'late-sky':[]};
 let selectedCases:string[]=[];
 try{
  assert(Object.hasOwn(partitions,partition),'Unknown fixed partition');assert(software?partition!=='all':partition==='all','Native requires all cases; software requires fixed partition');selectedCases=partitions[partition];
  status('Constructing immutable original world');prepareReferencePreferences();const response=await fetch('/belle/map.json');assert(response.ok,'Pinned map unavailable');const map=await response.json();alignScottMap(map);prepareCoastGuardMap(map);for(const landmark of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some((item:any)=>item.id===landmark.id))map.landmarks.push(landmark);
  const terrain=new ParkTerrain(map,true),world=await createWorld(scene,renderer,map,terrain,status);world.setQuality('high');world.sky.preview(false);world.sky.setArtStyle('authentic',false);world.sky.configure({hour:14,cycle:false});world.sky.tick(0,false,true);
  assert(renderer.shadowMap.autoUpdate===false,'Original shadow cadence must remain explicit');renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  camera.position.set(0,6,0);camera.lookAt(150,4,270);camera.updateMatrixWorld(true);world.update(119,0,0,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);
  const owners=opaqueSurfaceOwners as OpaqueSurfaceOwner[];assert(owners.length===4&&owners.filter(o=>o.kind==='asphalt').length===1&&owners.filter(o=>o.kind==='approach').length===2&&owners.filter(o=>o.kind==='sky').length===1,'Exact original factory owner count missing');
  for(const owner of owners){assert(!ownerById.has(owner.mesh.id),'Duplicate factory owner');ownerById.set(owner.mesh.id,owner);originalOrderById.set(owner.mesh.id,owner.mesh.renderOrder);assert(groupOrder(owner.mesh)===0,'Factory owner group order changed');}
  controller=createOpaqueSurfaceOrder(owners);ownerBaseline=controller.read();use('original');installObserver();
  pool=installSharedGeometryBuffers(renderer,scene,{rendererOutput:{type:T.UnsignedByteType,nodes:false},maxDiagnosticEntries:4096});pool.prepare();await Promise.resolve();poolBefore=pool.read();poolHooks={render:renderer.render,direct:renderer.renderBufferDirect,before:scene.onBeforeRender,after:scene.onAfterRender};
  assert(poolBefore.supported&&poolBefore.preparationReady&&poolBefore.activeEntries>=200,'Original pool did not prepare hundreds of eligible meshes');assert(poolBefore.fallbacks===0&&poolBefore.observerErrors===0,'Original pool preparation failed');entryByObject=new Map(poolBefore.entries.map((entry:any)=>[entry.sourceId,entry]));
  ({poses:casePlan,bridgeBasis}=posesFor(map,terrain));assert(JSON.stringify(casePlan.map(p=>p.name))===JSON.stringify(allCases),'Original fixed case plan changed');const lastIndex=Math.max(...selectedCases.map(name=>allCases.indexOf(name)));
  for(const pose of casePlan){if(pose.index>lastIndex)continue;const selected=selectedCases.includes(pose.name),id=pose.name;status((selected?'':'prelude ')+id);use('original');camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateMatrixWorld(true);world.sky.configure({hour:pose.hour,cycle:false});world.sky.tick(0,false,true);world.update(pose.frozenTime,camera.position.x,camera.position.z,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);await warm();
   if(!selected){prelude.push({name:id,frozenTime:pose.frozenTime,warmupRenders:3});continue;}
   const caseGeometry=await geometryReceipts(),geometrySha256=await textHash(caseGeometry),materialSha256=await textHash(materialReceipts());if(!geometry)geometry=caseGeometry;const depthWriters=opaqueDepthWriters(),skyMaterialId=ownerBaseline.owners.find(o=>o.kind==='sky')!.materialIds[0],lateSkyAssumption=depthWriters.every(m=>m.depthTest&&(m.id===skyMaterialId?!m.depthWrite:m.depthWrite));
   const frames=new Map<Arm,Frame>(),comparisons:any[]=[];let baseline:Frame|undefined;
   for(const arm of arms){
    try{use(arm);await warm();const frame=await render();frames.set(arm,frame);save(id+'-'+arm,frame);if(arm==='original')baseline=frame;assert(baseline,'Original comparison frame missing');const diff=matching(baseline,frame,arm),activityReceipt=activity(frame),frameGeometrySha256=await textHash(await geometryReceipts()),frameMaterialSha256=await textHash(materialReceipts());
     const issues:string[]=[];if(!exact(diff))issues.push('Exact pixels/draw permutation failed');if(frameGeometrySha256!==geometrySha256||frameMaterialSha256!==materialSha256)issues.push('Source geometry/material identity changed');if(arm==='late-sky'&&!lateSkyAssumption)issues.push('Whole-world opaque depth-writer assumption failed');
     const comparison={arm,...diff,...activityReceipt,calls:frame.calls,triangles:frame.triangles,rgbaSha256:await hash(frame.rgba),shadowSha256:await hash(frame.shadow),poolDelta:frame.poolDelta,draws:frame.draws,orderReceipt:frame.orderReceipt,geometrySha256:frameGeometrySha256,materialSha256:frameMaterialSha256,passed:issues.length===0,errors:issues};comparisons.push(comparison);if(arm!=='original')candidateFailures[arm].push(...issues.map(issue=>id+': '+issue));
    }catch(error){const message=errorText(error);comparisons.push({arm,passed:false,errors:[message]});if(arm==='original')errors.push(id+' original: '+message);else candidateFailures[arm].push(id+': '+message);}
   }
   if(!baseline){errors.push(id+': cannot compare without original frame');continue;}
   use('original');const repeat=await render();save(id+'-repeat',repeat);const repeatDiff=matching(baseline,repeat,'original'),afterGeometrySha256=await textHash(await geometryReceipts()),afterMaterialSha256=await textHash(materialReceipts());
   const viewDirection=camera.getWorldDirection(new T.Vector3()),plannedDirection=new T.Vector3().fromArray(pose.target).sub(camera.position).normalize();assert(viewDirection.distanceTo(plannedDirection)<1e-12,'Actual camera direction differs from the fixed target');
   rows.push({name:id,width,height,near,far,camera:{position:camera.position.toArray(),target:[...pose.target],direction:viewDirection.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},hour:pose.hour,frozenTime:pose.frozenTime,style:'authentic',bridgePreview:world.pictureBridgeEnabled,geometrySha256,afterGeometrySha256,geometryEqual:geometrySha256===afterGeometrySha256,materialSha256,afterMaterialSha256,materialEqual:materialSha256===afterMaterialSha256,opaqueDepthWriters:depthWriters,repeatChangedPixels:repeatDiff.changedPixels,repeatMaxChannelDelta:repeatDiff.maxChannelDelta,repeatShadowChangedPixels:repeatDiff.shadowChangedPixels,repeatShadowMaxChannelDelta:repeatDiff.shadowMaxChannelDelta,repeatOrderEqual:repeatDiff.colorOrderAllowed&&repeatDiff.shadowOrderEqual&&repeatDiff.drawMultisetEqual,repeatCountsEqual:repeatDiff.countsEqual,comparisons,passed:exact(repeatDiff)&&geometrySha256===afterGeometrySha256&&materialSha256===afterMaterialSha256&&comparisons.length===3&&comparisons.every(c=>c.passed)});
   try{
    const terrainOwners=owners.filter(o=>o.kind!=='sky').map(o=>o.mesh),skyOwners=owners.filter(o=>o.kind==='sky').map(o=>o.mesh);
    const hide=async(objects:T.Object3D[],suffix:string)=>{const visibility=objects.map(o=>o.visible);try{objects.forEach(o=>o.visible=false);const frame=await render();save(id+'-'+suffix,frame);return frame;}finally{objects.forEach((o,i)=>o.visible=visibility[i]);}};
    const hidden=await hide(terrainOwners,'terrain-hidden-control'),skyHidden=await hide(skyOwners,'sky-hidden-control');
    const lights:T.DirectionalLight[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow)lights.push(object);});assert(lights.length>0,'No actual directional shadow light');let shadowOff:Frame;try{lights.forEach(light=>light.castShadow=false);shadowOff=await render();save(id+'-shadow-off-control',shadowOff);}finally{lights.forEach(light=>light.castShadow=true);}
    use('original');const restored=await render();save(id+'-restored-control',restored);const restoredDiff=matching(baseline,restored,'original');
    controls.push({name:id,terrainHiddenIds:terrainOwners.map(o=>o.id),skyHiddenIds:skyOwners.map(o=>o.id),terrainHiddenChangedPixels:difference(baseline.rgba,hidden.rgba).changedPixels,skyHiddenChangedPixels:difference(baseline.rgba,skyHidden.rgba).changedPixels,shadowOffChangedPixels:difference(baseline.rgba,shadowOff.rgba).changedPixels,restoredChangedPixels:restoredDiff.changedPixels,restoredMaxChannelDelta:restoredDiff.maxChannelDelta,restoredShadowChangedPixels:restoredDiff.shadowChangedPixels,restoredShadowMaxChannelDelta:restoredDiff.shadowMaxChannelDelta,restoredOrderEqual:restoredDiff.colorOrderAllowed&&restoredDiff.shadowOrderEqual&&restoredDiff.drawMultisetEqual,restoredCountsEqual:restoredDiff.countsEqual,passed:exact(restoredDiff)});
   }catch(error){errors.push(id+' controls: '+errorText(error));controls.push({name:id,passed:false,error:errorText(error)});}
   if(!software&&pose.index<6)for(const candidate of candidates){
    const lanes:any[]=[],timingErrors:string[]=[];status(id+' '+candidate+' timing');
    try{for(let repetition=1;repetition<=8;repetition++)for(const arm of ['original',candidate,candidate,'original'] as Arm[]){
      use(arm);await warm();const orderBefore=verifyOwners(arm),poolBeforeLane=poolCounts(pool.read()),samples=[];
      for(let index=0;index<16;index++){const sample=await submit(true);assert(sample.gpu.status==='complete','Native elapsed GPU query missing');samples.push({index,cpuMs:sample.cpuMs,fenceMs:sample.fenceMs,gpu:sample.gpu,calls:sample.calls,triangles:sample.triangles});}
      const poolAfterLane=poolCounts(pool.read()),orderReceipt=verifyOwners(arm);lanes.push({arm,repetition,framesPerLane:16,warmupRenders:3,orderBefore,orderReceipt,cpuMs:mean(samples.map(s=>s.cpuMs)),fenceMs:mean(samples.map(s=>s.fenceMs)),gpu:{status:'complete',nanoseconds:mean(samples.map(s=>s.gpu.nanoseconds!))},poolBefore:poolBeforeLane,poolAfter:poolAfterLane,poolDelta:poolDifference(poolBeforeLane,poolAfterLane),samples});
     }}catch(error){timingErrors.push(errorText(error));candidateFailures[candidate].push(id+' timing: '+errorText(error));}
    timings.push({name:id,shadowMode:'forced-refresh',baseline:'original',candidate,order:'ABBA',repetitions:8,framesPerLane:16,warmupRenders:3,orderReceipt:controller.read(),lanes,errors:timingErrors,passed:timingErrors.length===0&&lanes.length===32,scope:'Original complete frozen world, forced original shadow refresh. Eight complete ABBA groups;16 consecutive measured renders per lane after3 warm renders. CPU submission, actual elapsed GPU queries and completion fences are separate. No per-draw inspection or diagnostic snapshots inside measured16-render loop; no riding frame-rate claim.'});
   }
   use('original');verifyPoolHooks();assert(JSON.stringify(poolIdentity(pool.read()))===JSON.stringify(poolIdentity(poolBefore)),'Original pool pages/preparation/eligibility changed');
  }
  use('original');poolAfter=pool.read();ownerFinal=verifyOwners('original');
 }catch(error){errors.push(errorText(error));status('FAILED '+errors.at(-1));}
 finally{if(controller){try{use('original');ownerFinal=controller.read();}catch(error){errors.push('Restoring original orders: '+errorText(error));}controller.dispose();}}
 const programs=await Promise.all([...programEvidence.values()].map(async program=>({...program,vertexSha256:await hash(new TextEncoder().encode(program.vertex)),fragmentSha256:await hash(new TextEncoder().encode(program.fragment))})));
 const coverage={terrainChangedPixels:Math.max(0,...controls.map(c=>Number(c.terrainHiddenChangedPixels)||0)),skyChangedPixels:Math.max(0,...controls.map(c=>Number(c.skyHiddenChangedPixels)||0)),shadowChangedPixels:Math.max(0,...controls.map(c=>Number(c.shadowOffChangedPixels)||0))};
 const candidateResults=candidates.map(arm=>({arm,passed:candidateFailures[arm].length===0&&rows.length===selectedCases.length&&rows.every(row=>row.comparisons.find((c:any)=>c.arm===arm)?.passed),errors:candidateFailures[arm]}));
 const passed=errors.length===0&&rows.length===selectedCases.length&&rows.every(row=>row.passed)&&controls.length===selectedCases.length&&controls.every(control=>control.passed)&&candidateResults.every(candidate=>candidate.passed)&&programs.length>0&&programs.every(program=>program.linked)&&coverage.terrainChangedPixels>=16&&coverage.skyChangedPixels>=16&&coverage.shadowChangedPixels>=16&&!!poolAfter;
 return {schema:'belle-opaque-order-experiment-v1',partition,expectedCases:selectedCases,selectedCases,casePlan,bridgeBasis,partitionPlanSha256:await textHash({version:1,cases:allCases,partitions}),prelude,gpu,width,height,near,far,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,software,rows,controls,timings,images,ownerBaseline,ownerFinal,poolBefore,poolAfter,poolHooksPreserved:!!poolAfter,geometry,materials:materialReceipts(),opaqueDepthWriters:[...depthWriterEvidence.values()],programs,coverage,candidateResults,passed,errors,
  shadowReadback:'Exact RGBA8 shadow-target color attachments, ordered original shadow submissions and receiver shadow-off controls. Native depth-texture bytes are not claimed.',
  scope:'One immutable d4 world. Only factory-authorized asphalt/approach/sky renderOrder changes; original shaders, material/depth state, geometry, shared buffers and draw counts remain. Six original Authentic day/night views plus two actual ramp-edge/under-ramp views at near.08/far22000. Quantized depth ties are failures, with no epsilon or depth-function substitution. Four art styles, optional stone bridge, actual riding/input and unchanged release gates remain outside this initial diagnostic.'};
};
