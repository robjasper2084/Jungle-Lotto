/** Diagnostic only. The immutable d4 full world includes both actually
 * published Detroit packs. Only explicit factory-owned static matrix work is
 * bypassed; no production call enables this helper. */
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
// @ts-ignore Pinned model URLs used by the original actual loader.
import districtModels from 'baseline:districtModelUrls.ts';
import {setStaticWorldTransformsEnabled,readStaticWorldTransforms} from '../src/belle/staticWorldTransforms.ts';

type Arm='original'|'static';
type Receipt=ReturnType<typeof readStaticWorldTransforms>;
type Draw={object:number;name:string;sourceGeometry:number;material:number;phase:string;start:number;count:number;program:number;substituted:boolean;nativeCalls:number;transformWords:number[]};
type GpuTiming={status:string;nanoseconds:number|null;queryId:number|null;resultAvailable:boolean;disjoint:boolean};
type PoolCounts={renderCalls:number;pooledCalls:number;colorCalls:number;shadowCalls:number};
type Submission={calls:number;triangles:number;draws:Draw[];cpuMs:number;fenceMs:number;gpu:GpuTiming};
type MatrixSnapshot={objects:{id:number;parentId:number|null;type:string;name:string;visible:boolean}[];bytes:Uint8Array};
type Frame=Submission&{rgba:Uint8Array;shadow:Uint8Array;poolDelta:PoolCounts;registry:Receipt;matrices:MatrixSnapshot};
type Pose={name:string;index:number;frozenTime:number;hour:number;position:number[];target:number[];recipe?:unknown};
const arms:Arm[]=['original','static'];
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
const programEvidence=new Map<number,{id:number;linked:boolean;vertex:string;fragment:string}>();
const expectedOwners=[{owner:'detroit-initial',roots:143,nodes:200},{owner:'lake-habitat',roots:42,nodes:147},{owner:'detroit-stream:'+districtModels['street-at-sunset'],roots:1,nodes:496},{owner:'detroit-stream:'+districtModels['detroit-scenery'],roots:1,nodes:64}];
let pool:any,ownerBaseline:Receipt,ownerRoots:T.Object3D[]=[],nextQueryId=1;
let poolHooks:{render:T.WebGLRenderer['render'];direct:T.WebGLRenderer['renderBufferDirect'];before:T.Scene['onBeforeRender'];after:T.Scene['onAfterRender']}|undefined;
const status=(message:string)=>console.log('static transforms proof '+message);
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
const poolCounts=(stats:any):PoolCounts=>({renderCalls:stats.renderCalls,pooledCalls:stats.pooledCalls,colorCalls:stats.colorCalls,shadowCalls:stats.shadowCalls});
const poolDifference=(before:PoolCounts,after:PoolCounts):PoolCounts=>({renderCalls:after.renderCalls-before.renderCalls,pooledCalls:after.pooledCalls-before.pooledCalls,colorCalls:after.colorCalls-before.colorCalls,shadowCalls:after.shadowCalls-before.shadowCalls});
const errorText=(error:unknown)=>error instanceof Error?error.stack||error.message:String(error);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const bytesEqual=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
function verifyPoolHooks(){assert(poolHooks&&renderer.render===poolHooks.render&&renderer.renderBufferDirect===poolHooks.direct&&scene.onBeforeRender===poolHooks.before&&scene.onAfterRender===poolHooks.after,'Original pool hooks changed or capture observer remained installed');}
function verifyOwners(arm:Arm){
 const receipt=readStaticWorldTransforms(scene),enabled=arm==='static';
 assert(receipt.enabled===enabled&&receipt.registeredOwners===4&&receipt.registeredRoots===187&&receipt.registeredNodes===907,'Exact factory owner population or mode changed');
 assert(receipt.invalidations===0&&receipt.rejectedRegistrations===0&&receipt.rejections.length===0,'A factory contract was invalidated/rejected');
 assert(receipt.activeOwners===(enabled?4:0)&&receipt.activeRoots===(enabled?187:0)&&receipt.activeNodes===(enabled?907:0),'Actual active static population differs');
 for(const expected of expectedOwners){const owner=receipt.owners.find(item=>item.owner===expected.owner);assert(owner&&owner.eligible&&!owner.invalidated&&owner.active===enabled&&owner.rootCount===expected.roots&&owner.nodeCount===expected.nodes,'Missing actual final factory owner '+expected.owner);assert(owner.rootIds.length===expected.roots&&owner.nodeIds.length===expected.nodes,'Incomplete actual owner IDs');
  for(const root of owner.roots){assert(scene.getObjectById(root.id)?.parent?.id===root.parentId,'Original factory root detached');assert(root.updateMatrixWorld===(enabled?'barrier':'original'),'Actual root matrix method differs from selected mode');}
  const originalNodes=ownerBaseline?new Map(ownerBaseline.owners.find(item=>item.owner===owner.owner)!.nodes.map(node=>[node.id,node])):null;
  for(const node of owner.nodes){assert(scene.getObjectById(node.id),'Owned node disappeared');if(enabled)assert(!node.matrixAutoUpdate&&!node.matrixWorldAutoUpdate&&!node.matrixWorldNeedsUpdate,'Active immutable transform flags changed');else{assert(node.updateMatrixWorld==='original','Disabled mode changed a matrix method');if(originalNodes){const original=originalNodes.get(node.id);assert(original,'Original node flags missing');for(const key of ['matrixAutoUpdate','matrixWorldAutoUpdate','matrixWorldNeedsUpdate'] as const)assert(node[key]===original[key],'Original matrix flags were not restored: '+node.id+' '+key);}}}
 }
 if(ownerBaseline){const identity=(value:Receipt)=>value.owners.map(owner=>({owner:owner.owner,rootIds:owner.rootIds,nodeIds:owner.nodeIds,roots:owner.roots.map(({id,parentId,nodeCount})=>({id,parentId,nodeCount}))}));assert(same(identity(receipt),identity(ownerBaseline)),'Factory owner identity changed');}
 return receipt;
}
function laneRegistry(receipt:Receipt){return {...receipt,owners:receipt.owners.map(({roots,nodes,...owner})=>({...owner,flagBits:nodes.map(node=>(node.matrixAutoUpdate?1:0)|(node.matrixWorldAutoUpdate?2:0)|(node.matrixWorldNeedsUpdate?4:0)),flagCounts:{matrixAutoUpdate:nodes.filter(node=>node.matrixAutoUpdate).length,matrixWorldAutoUpdate:nodes.filter(node=>node.matrixWorldAutoUpdate).length,matrixWorldNeedsUpdate:nodes.filter(node=>node.matrixWorldNeedsUpdate).length}}))};}
function use(arm:Arm){assert(setStaticWorldTransformsEnabled(scene,arm==='static'),'Static controller rejected selected mode');return verifyOwners(arm);}
function matrixSnapshot():MatrixSnapshot{
 const objects:MatrixSnapshot['objects']=[],values:number[]=[];
 const add=(object:T.Object3D)=>{objects.push({id:object.id,parentId:object.parent?.id??null,type:object.type,name:object.name,visible:object.visible});values.push(...object.matrix.elements,...object.matrixWorld.elements);};
 scene.traverse(add);add(camera);scene.traverse(object=>{if(object instanceof T.DirectionalLight)add(object.shadow.camera);});
 assert(values.every(Number.isFinite),'Nonfinite actual matrix');return {objects,bytes:new Uint8Array(new Float64Array(values).buffer)};
}
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
function beginCapture(draws:Draw[]){
 verifyPoolHooks();const direct=poolHooks!.direct;
 const observer:T.WebGLRenderer['renderBufferDirect']=function(...args){
  const beforeCalls=renderer.info.render.calls,result=direct.apply(this,args),[,root,geometry,material,object,group]=args;
  const count=geometry.index?.count??geometry.attributes.position?.count??0,start=Math.max(geometry.drawRange.start,group?.start??0),end=Math.min(count,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity),program=(renderer.properties.get(material) as any).currentProgram;
  assert(program?.program,'Actual native direct draw has no linked program');
  const values=[...object.matrixWorld.elements,...object.modelViewMatrix.elements,...object.normalMatrix.elements];assert(values.every(Number.isFinite),'Nonfinite submitted matrix');
  draws.push({object:object.id,name:object.name,sourceGeometry:geometry.id,material:(material as T.Material&{id:number}).id,phase:root===null?'shadow':'color',start,count:Math.max(0,end-start),program:program.id,substituted:false,nativeCalls:renderer.info.render.calls-beforeCalls,transformWords:Array.from(new Uint32Array(new Float64Array(values).buffer))});
  if(!programEvidence.has(program.id)){const attached=gl.getAttachedShaders(program.program)||[],vertex=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);assert(vertex&&fragment,'Actual attached shaders unavailable');programEvidence.set(program.id,{id:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS)===true,vertex:gl.getShaderSource(vertex)||'',fragment:gl.getShaderSource(fragment)||''});}
  return result;
 };
 renderer.renderBufferDirect=observer;
 return ()=>{assert(renderer.renderBufferDirect===observer,'Capture hook replaced during render');renderer.renderBufferDirect=direct;verifyPoolHooks();};
}
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'Fence unavailable');gl.flush();const began=performance.now();try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-began;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-began<90000,'GPU fence exceeded90seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
async function submit(measure=false,capture=false):Promise<Submission>{
 assert(renderer.getRenderTarget()===null,'Default framebuffer required');verifyPoolHooks();renderer.shadowMap.needsUpdate=true;
 const draws:Draw[]=[],restore=capture?beginCapture(draws):null;let query:WebGLQuery|null=null,queryId:number|null=null;
 if(measure&&timer){assert(gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)===null,'GPU query already active');query=gl.createQuery();assert(query,'GPU query allocation failed');queryId=nextQueryId++;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
 let cpuMs=0;const began=performance.now();try{renderer.render(scene,camera);cpuMs=performance.now()-began;}finally{if(query)gl.endQuery(timer!.TIME_ELAPSED_EXT);restore?.();}
 const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
 const fenceMs=await fence(),timing:GpuTiming={status:measure?'unavailable':'not-requested',nanoseconds:null,queryId,resultAvailable:false,disjoint:false};
 if(query){try{timing.resultAvailable=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)===true;timing.disjoint=gl.getParameter(timer!.GPU_DISJOINT_EXT)===true;assert(timing.resultAvailable&&!timing.disjoint,'Unavailable/disjoint elapsed query');timing.nanoseconds=Number(gl.getQueryParameter(query,gl.QUERY_RESULT));assert(Number.isFinite(timing.nanoseconds)&&timing.nanoseconds>0,'Invalid GPU elapsed duration');timing.status='complete';}finally{gl.deleteQuery(query);}}
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native GL error/context loss');verifyPoolHooks();return {cpuMs,fenceMs,calls,triangles,draws,gpu:timing};
}
async function warm(){for(let i=0;i<3;i++)await submit();}
async function render():Promise<Frame>{
 const before=pool.read(),work=await submit(false,true),after=pool.read(),rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 const parts:Uint8Array[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow&&object.shadow.map){const target=object.shadow.map as T.WebGLRenderTarget,bytes=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);parts.push(bytes);}});
 const shadow=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){shadow.set(part,offset);offset+=part.length;}
 const beforeEntries=new Map<number,any>(before.entries.map((entry:any)=>[entry.sourceId,entry]));
 for(const entry of after.entries)for(const phase of ['color','shadow']){const prior=beforeEntries.get(entry.sourceId),count=entry[phase+'Calls']-(prior?.[phase+'Calls']??0),draws=work.draws.filter(draw=>draw.object===entry.sourceId&&draw.phase===phase);assert(count===0||count===draws.length,'Partial or unattributed original buffer substitution');if(count)for(const draw of draws)draw.substituted=true;}
 const poolDelta=poolDifference(poolCounts(before),poolCounts(after));assert(work.draws.reduce((n,draw)=>n+draw.nativeCalls,0)===work.calls,'Actual direct submissions do not explain native draw count');
 const substitutions=work.draws.filter(draw=>draw.substituted);assert(substitutions.length===poolDelta.pooledCalls&&substitutions.filter(draw=>draw.phase==='color').length===poolDelta.colorCalls&&substitutions.filter(draw=>draw.phase==='shadow').length===poolDelta.shadowCalls,'Actual source-specific buffer substitution counters differ');
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native readback error');const mode=readStaticWorldTransforms(scene).enabled?'static':'original';
 return {...work,rgba,shadow,poolDelta,registry:verifyOwners(mode),matrices:matrixSnapshot()};
}
function difference(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Readback length changed');let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);changed ||= delta>0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};}
function png(bytes:Uint8Array){const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d')!,data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(bytes.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return out.toDataURL('image/png');}
function save(name:string,frame:Frame){assert(!images.some(image=>image.name===name),'Duplicate capture '+name);images.push({name,png:png(frame.rgba)});}

function matching(a:Frame,b:Frame){const color=difference(a.rgba,b.rgba),shadow=a.shadow.length===b.shadow.length?difference(a.shadow,b.shadow):{changedPixels:-1,maxChannelDelta:-1};return {...color,shadowChangedPixels:shadow.changedPixels,shadowMaxChannelDelta:shadow.maxChannelDelta,orderEqual:same(a.draws,b.draws),countsEqual:a.calls===b.calls&&a.triangles===b.triangles,matricesEqual:bytesEqual(a.matrices.bytes,b.matrices.bytes)&&same(a.matrices.objects,b.matrices.objects)};}
function exact(value:ReturnType<typeof matching>){return value.changedPixels===0&&value.maxChannelDelta===0&&value.shadowChangedPixels===0&&value.shadowMaxChannelDelta===0&&value.orderEqual&&value.countsEqual&&value.matricesEqual;}
function immediateDrawIdentity(a:Frame,b:Frame){return a.draws.length===b.draws.length&&a.draws.every((draw,index)=>{const other=b.draws[index],{program,...identity}=draw,{program:otherProgram,...otherIdentity}=other,first=programEvidence.get(program),second=programEvidence.get(otherProgram);return same(identity,otherIdentity)&&!!first&&!!second&&first.vertex===second.vertex&&first.fragment===second.fragment;});}
function matrixTransformsEqual(a:Frame,b:Frame){return bytesEqual(a.matrices.bytes,b.matrices.bytes)&&same(a.matrices.objects.map(({visible,...o})=>o),b.matrices.objects.map(({visible,...o})=>o));}
async function frameReceipt(frame:Frame){return {calls:frame.calls,triangles:frame.triangles,rgbaSha256:await hash(frame.rgba),shadowSha256:await hash(frame.shadow),poolDelta:frame.poolDelta,draws:frame.draws,registry:frame.registry,matrixObjects:frame.matrices.objects,matrixBytes:base64(frame.matrices.bytes),matrixSha256:await hash(frame.matrices.bytes)};}
function poolIdentity(stats:any){return {preparedEntries:stats.preparedEntries,activeEntries:stats.activeEntries,pageCount:stats.pageCount,poolBytes:stats.poolBytes,pages:stats.pages,preparationAttempts:stats.preparationAttempts,preparationRenders:stats.preparationRenders,preparationFrames:stats.preparationFrames,preparationReady:stats.preparationReady,fallbacks:stats.fallbacks,observerErrors:stats.observerErrors,contextLosses:stats.contextLosses};}
async function geometryReceipts(){
 const geometries=new Map<T.BufferGeometry,Promise<unknown>>(),meshes:Record<string,unknown>[]=[],instanceBuffers:Promise<unknown>[]=[];
 scene.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;const geometry=mesh.geometry;
  if(!geometries.has(geometry))geometries.set(geometry,(async()=>{const attributes:Record<string,unknown>={};for(const [key,attribute]of Object.entries(geometry.attributes)){const a=attribute as T.BufferAttribute;attributes[key]={itemSize:a.itemSize,count:a.count,normalized:a.normalized,type:a.array.constructor.name,sha256:await hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))};}const index=geometry.index;return {id:geometry.id,attributes,index:index?{type:index.array.constructor.name,count:index.count,sha256:await hash(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength))}:null,groups:geometry.groups.map(g=>({...g}))};})());
  if((mesh as T.InstancedMesh).isInstancedMesh){const instanced=mesh as T.InstancedMesh;instanceBuffers.push((async()=>({id:mesh.id,count:instanced.count,matrix:await hash(new Uint8Array(instanced.instanceMatrix.array.buffer,instanced.instanceMatrix.array.byteOffset,instanced.instanceMatrix.array.byteLength)),color:instanced.instanceColor?await hash(new Uint8Array(instanced.instanceColor.array.buffer,instanced.instanceColor.array.byteOffset,instanced.instanceColor.array.byteLength)):null}))());}
  meshes.push({id:mesh.id,name:mesh.name,parentId:mesh.parent?.id??null,geometry:geometry.id,material:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>(m as T.Material&{id:number}).id),matrix:mesh.matrix.toArray(),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder});
 });return {meshes,geometries:await Promise.all(geometries.values()),instanceBuffers:await Promise.all(instanceBuffers)};
}
function sceneMaterials(){const materials=new Set<T.Material>();scene.traverse(object=>{const material=(object as T.Mesh).material;if(material)for(const m of Array.isArray(material)?material:[material])materials.add(m);});return [...materials];}
function materialReceipts(){return sceneMaterials().map(material=>{
 const textures:Record<string,unknown>={},parameters=material as T.MeshStandardMaterial,properties=renderer.properties.get(material) as any;
 const values={...Object.fromEntries(Object.entries(material).filter(([,value])=>value instanceof T.Texture)),...Object.fromEntries(Object.entries(properties.uniforms??{}).map(([name,value])=>[name,(value as T.IUniform).value]))};
 for(const [name,value]of Object.entries(values))if(value instanceof T.Texture){const data=value.source.data as {width?:number;height?:number;currentSrc?:string;src?:string};textures[name]={uuid:value.uuid,name:value.name,url:data?.currentSrc||data?.src||null,width:data?.width,height:data?.height,colorSpace:value.colorSpace,channel:value.channel,format:value.format,type:value.type,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,anisotropy:value.anisotropy,matrix:value.matrix.toArray()};}
 return {id:(material as T.Material&{id:number}).id,name:material.name,type:material.type,materialSide:material.side,opacity:material.opacity,transparent:material.transparent,transmission:(material as T.MeshPhysicalMaterial).transmission??0,depthWrite:material.depthWrite,depthTest:material.depthTest,depthFunc:material.depthFunc,colorWrite:material.colorWrite,alphaTest:material.alphaTest,alphaHash:material.alphaHash,blending:material.blending,polygonOffset:material.polygonOffset,polygonOffsetFactor:material.polygonOffsetFactor,polygonOffsetUnits:material.polygonOffsetUnits,color:parameters.color?.toArray(),roughness:parameters.roughness,metalness:parameters.metalness,compile:String(material.onBeforeCompile),render:String(material.onBeforeRender),key:String(material.customProgramCacheKey),programKey:material.customProgramCacheKey(),textures};
 });}
function posesFor(map:any,terrain:any){
 const poses:Pose[]=[],original=[{name:'jefferson',position:[0,6,0],target:[160,4,290]},{name:'island',position:[480,8,830],target:[630,3,1050]},{name:'conservatory',position:[1290,7,1115],target:[1330.8,9,1174.7]}];
 for(const pose of original)for(const night of [false,true])poses.push({name:pose.name+(night?'-night':'-day'),index:poses.length,frozenTime:120+poses.length,hour:night?21:14,position:pose.position,target:pose.target});
 const {a,b,length,width:bridgeWidth}=map.bridge,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
 const point=(s:number,w:number,heightOffset:number)=>{const x=a[0]+ux*s+uz*w,z=a[1]+uz*s-ux*w,terrainHeight=terrain.height(x,z);return {s,w,heightOffset,terrainHeight,position:[x,terrainHeight+heightOffset,z]};};
 const grazing={position:point(-130,bridgeWidth/2+.35,.18),target:point(-6,bridgeWidth/2-.35,.04)},under={position:point(-60,0,-.65),target:point(8,bridgeWidth/2+4,.1)};
 for(const [name,recipe]of [['ramp-grazing-day',grazing],['under-ramp-day',under]] as const)poses.push({name,index:poses.length,frozenTime:120+poses.length,hour:14,position:recipe.position.position,target:recipe.target.position,recipe});
 return {poses,bridgeBasis:{a:[...a],b:[...b],length,width:bridgeWidth,ux,uz}};
}


(window as unknown as {__staticTransformsProof:(partition?:keyof typeof partitions)=>Promise<unknown>}).__staticTransformsProof=async(partition='all')=>{
 let poolBefore:any=null,poolAfter:any=null,geometry:unknown=null,casePlan:Pose[]=[],bridgeBasis:unknown=null,ownerFinal:Receipt|undefined,publication:any=null;
 const prelude:{name:string;frozenTime:number;warmupRenders:number}[]=[];let selectedCases:string[]=[];
 const checkpoints:{schema:string;partition:string;sequence:number;name:string;sha256:string;bytes:number;persisted:boolean}[]=[],completed:{name:string;rowPassed:boolean;controlPassed:boolean;timingCount:number;timingsPassed:boolean;imageCount:number;hiddenChangedPixels:number;shadowChangedPixels:number}[]=[],attempted=new Set<string>(),linkedProgramIds=new Set<number>();
 let checkpointToken='',checkpointSourceHead='',checkpointBaseline='',allProgramsLinked=true,activePose:Pose|null=null;
 const context=()=>({schema:'belle-static-transforms-experiment-v1',partition,expectedCases:selectedCases,selectedCases,casePlan,bridgeBasis,partitionPlanSha256:null,prelude,gpu,width,height,near,far,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,software,expectedOwners,publication,ownerBaseline,poolBefore,geometry,materials:materialReceipts()});
 async function checkpointView(pose:Pose){
  assert(!attempted.has(pose.name),'Checkpoint attempted twice for '+pose.name);attempted.add(pose.name);
  const programs=await Promise.all([...programEvidence.values()].map(async program=>({...program,vertexSha256:await hash(new TextEncoder().encode(program.vertex)),fragmentSha256:await hash(new TextEncoder().encode(program.fragment))})));
  const sequence=checkpoints.length,previousSha256=checkpoints.at(-1)?.sha256??null;
  const payload={schema:'belle-static-transforms-checkpoint-v1',sourceHead:checkpointSourceHead,baseline:checkpointBaseline,partition,sequence,name:pose.name,caseIndex:pose.index,previousSha256,context:{...context(),partitionPlanSha256:await textHash({version:1,cases:allCases,partitions})},rows,controls,timings,images,programs,errors:[...errors]};
  const body=JSON.stringify(payload),bytes=new TextEncoder().encode(body),sha256=await hash(bytes);
  const response=await fetch('/__static_transforms_checkpoint/'+sequence,{method:'POST',headers:{'Content-Type':'application/json','X-Static-Proof-Token':checkpointToken,'X-Static-Proof-Sha256':sha256},body});
  assert(response.ok,'Checkpoint persistence failed for '+pose.name+' ('+response.status+')');const receipt=await response.json();
  assert(receipt.schema==='belle-static-transforms-checkpoint-ack-v1'&&receipt.partition===partition&&receipt.sequence===sequence&&receipt.name===pose.name&&receipt.sha256===sha256&&receipt.bytes===bytes.byteLength&&receipt.persisted===true,'Checkpoint acknowledgement identity/hash differs');
  checkpoints.push(receipt);const row=rows.find(row=>row.name===pose.name),control=controls.find(control=>control.name===pose.name);
  completed.push({name:pose.name,rowPassed:!!row?.passed,controlPassed:!!control?.passed,timingCount:timings.length,timingsPassed:timings.every(timing=>timing.passed),imageCount:images.length,hiddenChangedPixels:Number(control?.hiddenChangedPixels)||0,shadowChangedPixels:Number(control?.shadowOffChangedPixels)||0});
  for(const program of programs){linkedProgramIds.add(program.id);allProgramsLinked&&=program.linked;}
  // Only acknowledged, durably saved view evidence is released. Rendering,
  // warmup and measured ABBA lanes never perform checkpoint I/O.
  rows.length=0;controls.length=0;timings.length=0;images.length=0;programEvidence.clear();activePose=null;
  status('Persisted checkpoint '+(sequence+1)+'/'+selectedCases.length+' '+pose.name+' '+sha256);
 }

 try{
  assert(Object.hasOwn(partitions,partition),'Unknown fixed partition');assert(software?partition!=='all':partition==='all','Native requires all cases; software requires fixed partition');selectedCases=partitions[partition];
  status('Constructing immutable original world');prepareReferencePreferences();const response=await fetch('/belle/map.json');assert(response.ok,'Pinned map unavailable');const map=await response.json();alignScottMap(map);prepareCoastGuardMap(map);for(const landmark of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some((item:any)=>item.id===landmark.id))map.landmarks.push(landmark);
  const terrain=new ParkTerrain(map,true),world=await createWorld(scene,renderer,map,terrain,status);world.setQuality('high');world.sky.preview(false);world.sky.setArtStyle('authentic',false);world.sky.configure({hour:14,cycle:false});world.sky.tick(0,false,true);
  assert(renderer.shadowMap.autoUpdate===false,'Original shadow cadence must remain explicit');renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  camera.position.set(0,6,0);camera.lookAt(150,4,270);camera.updateMatrixWorld(true);
  const publicationStart=performance.now();let updates=0,lastStatus=0;
  for(;;){world.update(119,0,0,camera,false,false);updates++;await Promise.resolve();const receipt=readStaticWorldTransforms(scene);assert(!receipt.enabled,'Factory bookkeeping must default disabled');
   if(expectedOwners.every(expected=>receipt.owners.some(owner=>owner.owner===expected.owner))){verifyOwners('original');break;}
   assert(performance.now()-publicationStart<300000,'Both actual Detroit packs must publish within five minutes');if(performance.now()-lastStatus>10000){status('Awaiting actual streamed street/scenery publication');lastStatus=performance.now();}await new Promise(resolve=>setTimeout(resolve,50));
  }
  scene.updateMatrixWorld(true);ownerBaseline=verifyOwners('original');ownerRoots=ownerBaseline.owners.flatMap(owner=>owner.rootIds.map(id=>{const root=scene.getObjectById(id);assert(root,'Published factory root absent');return root;}));
  assert(new Set(ownerRoots).size===187,'Factory owner roots overlap');publication={updates,elapsedMs:performance.now()-publicationStart,frozenTime:119,position:[0,6,0],owners:expectedOwners,registry:ownerBaseline};
  const barrier=await fetch('/__asset_barrier');assert(barrier.ok,'Asset publication barrier unavailable');const barrierData=await barrier.json();checkpointToken=barrierData.checkpointToken;checkpointSourceHead=barrierData.sourceHead;checkpointBaseline=barrierData.baseline;assert(typeof checkpointToken==='string'&&checkpointToken.length===64&&/^[a-f0-9]{40}$/.test(checkpointSourceHead)&&checkpointBaseline==='d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c','Checkpoint capability/source binding unavailable');publication.assetBarrier={frozen:barrierData.frozen,requests:barrierData.requests};
  pool=installSharedGeometryBuffers(renderer,scene,{rendererOutput:{type:T.UnsignedByteType,nodes:false},maxDiagnosticEntries:4096});pool.prepare();await Promise.resolve();poolBefore=pool.read();poolHooks={render:renderer.render,direct:renderer.renderBufferDirect,before:scene.onBeforeRender,after:scene.onAfterRender};
  assert(poolBefore.supported&&poolBefore.preparationReady&&poolBefore.activeEntries>=200,'Original shared buffers did not prepare hundreds of meshes');assert(poolBefore.fallbacks===0&&poolBefore.observerErrors===0,'Original buffer preparation failed');
  ({poses:casePlan,bridgeBasis}=posesFor(map,terrain));assert(same(casePlan.map(p=>p.name),allCases),'Fixed case plan changed');const lastIndex=Math.max(...selectedCases.map(name=>allCases.indexOf(name)));
  for(const pose of casePlan){if(pose.index>lastIndex)continue;const selected=selectedCases.includes(pose.name),id=pose.name;status((selected?'':'prelude ')+id);use('original');camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateMatrixWorld(true);world.sky.configure({hour:pose.hour,cycle:false});world.sky.tick(0,false,true);world.update(pose.frozenTime,camera.position.x,camera.position.z,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);await warm();
   if(!selected){prelude.push({name:id,frozenTime:pose.frozenTime,warmupRenders:3});continue;}
   activePose=pose;const caseGeometry=await geometryReceipts(),geometrySha256=await textHash(caseGeometry),materialSha256=await textHash(materialReceipts());if(!geometry)geometry=caseGeometry;
   const frames=new Map<Arm,Frame>(),comparisons:any[]=[];let baseline:Frame|undefined;
   for(const arm of arms){try{use(arm);await warm();const frame=await render();frames.set(arm,frame);save(id+'-'+arm,frame);if(arm==='original')baseline=frame;assert(baseline,'Original comparison frame missing');const diff=matching(baseline,frame),frameGeometrySha256=await textHash(await geometryReceipts()),frameMaterialSha256=await textHash(materialReceipts()),issues:string[]=[];
     if(!exact(diff))issues.push('Exact pixels, matrices, native draw order or counts differ');if(frameGeometrySha256!==geometrySha256||frameMaterialSha256!==materialSha256)issues.push('Source geometry/material identity changed');comparisons.push({arm,...diff,...await frameReceipt(frame),geometrySha256:frameGeometrySha256,materialSha256:frameMaterialSha256,passed:issues.length===0,errors:issues});
    }catch(error){comparisons.push({arm,passed:false,errors:[errorText(error)]});errors.push(id+' '+arm+': '+errorText(error));}}
   if(!baseline){errors.push(id+': cannot compare without original frame');await checkpointView(pose);continue;}
   use('original');await warm();const repeat=await render();save(id+'-repeat',repeat);const repeatDiff=matching(baseline,repeat),afterGeometrySha256=await textHash(await geometryReceipts()),afterMaterialSha256=await textHash(materialReceipts());
   const viewDirection=camera.getWorldDirection(new T.Vector3()),plannedDirection=new T.Vector3().fromArray(pose.target).sub(camera.position).normalize();assert(viewDirection.distanceTo(plannedDirection)<1e-12,'Actual camera direction differs from fixed target');
   rows.push({name:id,width,height,near,far,camera:{position:camera.position.toArray(),target:[...pose.target],direction:viewDirection.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},hour:pose.hour,frozenTime:pose.frozenTime,style:'authentic',bridgePreview:world.pictureBridgeEnabled,geometrySha256,afterGeometrySha256,geometryEqual:geometrySha256===afterGeometrySha256,materialSha256,afterMaterialSha256,materialEqual:materialSha256===afterMaterialSha256,repeat:{...repeatDiff,...await frameReceipt(repeat)},comparisons,passed:exact(repeatDiff)&&geometrySha256===afterGeometrySha256&&materialSha256===afterMaterialSha256&&comparisons.length===2&&comparisons.every(c=>c.passed)});
   try{
    const hidden=new Map<Arm,Frame>(),shadowOff=new Map<Arm,Frame>(),visibility=ownerRoots.map(root=>root.visible);
    try{for(const arm of arms){use(arm);ownerRoots.forEach(root=>root.visible=false);await warm();const frame=await render();hidden.set(arm,frame);save(id+'-hidden-'+arm+'-control',frame);}}finally{ownerRoots.forEach((root,index)=>root.visible=visibility[index]);}
    const lights:T.DirectionalLight[]=[];scene.traverse(object=>{if(object instanceof T.DirectionalLight&&object.castShadow)lights.push(object);});assert(lights.length>0,'No actual directional shadow light');
    try{for(const arm of arms){use(arm);lights.forEach(light=>light.castShadow=false);await warm();const frame=await render();shadowOff.set(arm,frame);save(id+'-shadow-off-'+arm+'-control',frame);}}finally{lights.forEach(light=>light.castShadow=true);}
    use('static');const immediate=await render();save(id+'-immediate-restored-control',immediate);const immediateDiff=matching(baseline,immediate);
    await warm();const restored=await render();save(id+'-restored-static-control',restored);const restoredDiff=matching(baseline,restored);
    use('original');await warm();const originalRestored=await render();save(id+'-restored-original-control',originalRestored);const originalRestoredDiff=matching(baseline,originalRestored);
    const hiddenDiff=matching(hidden.get('original')!,hidden.get('static')!),shadowOffDiff=matching(shadowOff.get('original')!,shadowOff.get('static')!);
    const controlGeometrySha256=await textHash(await geometryReceipts()),controlMaterialSha256=await textHash(materialReceipts());
    const transformsPreserved=matrixTransformsEqual(baseline,hidden.get('original')!)&&matrixTransformsEqual(baseline,hidden.get('static')!);
    const immediateDrawIdentityEqual=immediateDrawIdentity(baseline,immediate);
    const immediatePixels=immediateDiff.changedPixels===0&&immediateDiff.maxChannelDelta===0&&immediateDiff.shadowChangedPixels===0&&immediateDiff.shadowMaxChannelDelta===0&&immediateDiff.countsEqual&&immediateDiff.matricesEqual;
    controls.push({name:id,hiddenIds:ownerRoots.map(root=>root.id),hiddenChangedPixels:difference(baseline.rgba,hidden.get('original')!.rgba).changedPixels,shadowOffChangedPixels:difference(baseline.rgba,shadowOff.get('original')!.rgba).changedPixels,hidden:{...hiddenDiff,original:await frameReceipt(hidden.get('original')!),static:await frameReceipt(hidden.get('static')!)},shadowOff:{...shadowOffDiff,original:await frameReceipt(shadowOff.get('original')!),static:await frameReceipt(shadowOff.get('static')!)},immediate:{...immediateDiff,...await frameReceipt(immediate)},restored:{...restoredDiff,...await frameReceipt(restored)},originalRestored:{...originalRestoredDiff,...await frameReceipt(originalRestored)},warmupRenders:3,transformsPreserved,immediateDrawIdentityEqual,geometrySha256:controlGeometrySha256,materialSha256:controlMaterialSha256,passed:transformsPreserved&&controlGeometrySha256===geometrySha256&&controlMaterialSha256===materialSha256&&exact(hiddenDiff)&&exact(shadowOffDiff)&&immediatePixels&&immediateDrawIdentityEqual&&exact(restoredDiff)&&exact(originalRestoredDiff)});
   }catch(error){errors.push(id+' controls: '+errorText(error));controls.push({name:id,passed:false,error:errorText(error)});}
   if(!software&&pose.index<6){const lanes:any[]=[],timingErrors:string[]=[];status(id+' complete render and separate matrix timing');
    try{for(let repetition=1;repetition<=16;repetition++)for(const arm of ['original','static','static','original'] as Arm[]){
      use(arm);await warm();verifyPoolHooks();const registryBefore=laneRegistry(verifyOwners(arm)),poolBeforeLane=poolCounts(pool.read()),matrixSamples=[];
      for(let i=0;i<3;i++)scene.updateMatrixWorld();const matrixBefore=matrixSnapshot();
      for(let index=0;index<16;index++){const began=performance.now();scene.updateMatrixWorld();matrixSamples.push({index,cpuMs:performance.now()-began});}
      const matrixAfter=matrixSnapshot();assert(bytesEqual(matrixBefore.bytes,matrixAfter.bytes)&&same(matrixBefore.objects,matrixAfter.objects),'Matrix-only timing changed actual transforms');
      const samples=[];for(let index=0;index<16;index++){const sample=await submit(true);assert(sample.gpu.status==='complete','Native elapsed GPU query missing');samples.push({index,cpuMs:sample.cpuMs,fenceMs:sample.fenceMs,gpu:sample.gpu,calls:sample.calls,triangles:sample.triangles});}
      const poolAfterLane=poolCounts(pool.read()),registryAfter=laneRegistry(verifyOwners(arm));lanes.push({arm,repetition,framesPerLane:16,warmupRenders:3,registryBefore,registryAfter,observerAbsent:true,cpuMs:mean(samples.map(s=>s.cpuMs)),fenceMs:mean(samples.map(s=>s.fenceMs)),gpu:{status:'complete',nanoseconds:mean(samples.map(s=>s.gpu.nanoseconds!))},matrixOnly:{warmupCalls:3,calls:16,cpuMs:mean(matrixSamples.map(s=>s.cpuMs)),samples:matrixSamples,beforeSha256:await hash(matrixBefore.bytes),afterSha256:await hash(matrixAfter.bytes)},poolBefore:poolBeforeLane,poolAfter:poolAfterLane,poolDelta:poolDifference(poolBeforeLane,poolAfterLane),samples});
     }}catch(error){timingErrors.push(errorText(error));errors.push(id+' timing: '+errorText(error));}
    timings.push({name:id,shadowMode:'forced-refresh',baseline:'original',candidate:'static',order:'ABBA',repetitions:16,framesPerLane:16,warmupRenders:3,lanes,errors:timingErrors,passed:timingErrors.length===0&&lanes.length===64,scope:'Complete frozen d4 world including both published Detroit packs. CPU render submission is primary; actual elapsed GPU queries and completion waits are separate. Sixteen whole ABBA groups with16 measured renders per lane. Matrix-only calls are separately timed before each render lane. Capture observer is physically absent from every measured render. No riding FPS or release claim.'});
   }
   await checkpointView(pose);
   use('original');verifyPoolHooks();assert(same(poolIdentity(pool.read()),poolIdentity(poolBefore)),'Original buffer pages/preparation/eligibility changed');
  }
  use('original');poolAfter=pool.read();ownerFinal=verifyOwners('original');
 }catch(error){errors.push(errorText(error));status('FAILED '+errors.at(-1));if(activePose&&!attempted.has(activePose.name)&&(rows.length||controls.length||timings.length||images.length)){try{await checkpointView(activePose);}catch(checkpointError){errors.push('Saving partial view: '+errorText(checkpointError));}}}
 finally{try{if(ownerBaseline){use('original');ownerFinal=verifyOwners('original');}}catch(error){errors.push('Restoring original matrix behavior: '+errorText(error));}}
 const coverage={hiddenChangedPixels:Math.max(0,...completed.map(row=>row.hiddenChangedPixels)),shadowChangedPixels:Math.max(0,...completed.map(row=>row.shadowChangedPixels))};
 const timingCount=completed.reduce((sum,row)=>sum+row.timingCount,0);
 const passed=errors.length===0&&same(completed.map(row=>row.name),selectedCases)&&completed.every(row=>row.rowPassed&&row.controlPassed&&row.timingsPassed&&row.imageCount===10)&&linkedProgramIds.size>0&&allProgramsLinked&&coverage.hiddenChangedPixels>=16&&coverage.shadowChangedPixels>=16&&!!poolAfter&&timingCount===(software?0:6);
 return {transport:'belle-static-transforms-checkpoint-final-v1',checkpoints,completed,metadata:{schema:'belle-static-transforms-experiment-v1',partition,expectedCases:selectedCases,selectedCases,casePlan,bridgeBasis,partitionPlanSha256:await textHash({version:1,cases:allCases,partitions}),prelude,gpu,width,height,near,far,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,software,expectedOwners,publication,ownerBaseline,ownerFinal,poolBefore,poolAfter,poolHooksPreserved:!!poolAfter,geometry,materials:materialReceipts(),coverage,passed,errors,
  shadowReadback:'Exact RGBA8 shadow-target color attachments, ordered original shadow submissions and actual receiver shadow-off controls. Native depth-texture bytes are not claimed.',
  scope:'Initial diagnostic only. Immutable d4 full world with three registration-only factory source overrides and the disabled static matrix helper. Both real Detroit asset packs are published before measurement. Eight Authentic views, optional stone off; all source geometry, material, texture, matrix bytes, linked programs, draw order and shadows must match. Original four-style/stone, full-game90-second riding, collision/input and release gates remain separately required.'}};
};
