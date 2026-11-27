/** Isolated full-world correctness proof. Every application import is immutable 759 source. */
import * as T from 'three';
// @ts-ignore Immutable source graph resolved by the proof driver.
import {createWorld} from 'baseline:world.ts';
// @ts-ignore Immutable source graph.
import {ParkTerrain} from 'baseline:terrain.ts';
// @ts-ignore The original application's buffer preparation, without factory overrides.
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
// @ts-ignore Original authored look identifiers and preference key.
import {ART_STYLE_IDS,ART_STYLE_KEY} from 'baseline:artDirection.ts';
// @ts-ignore Original placement names used to identify the actual published props pack.
import {planDetroitProps} from 'baseline:detroitProps.ts';
// @ts-ignore Original pack asset URLs, independently bound to received bytes by the driver.
import districtModels from 'baseline:districtModelUrls.ts';

type Style='authentic'|'golden'|'noir'|'detroit2084';
type Mode='original'|'rg8'|'lost-g';
type Lane=Mode|'restored'|'lost-g-restored'|'shadow-off'|'shadow-restored';
type Pose={name:string;index:number;frozenTime:number;hour:number;position:number[];target:number[];recipe?:unknown};
type Draw={object:number;name:string;sourceGeometry:number;material:number;phase:string;start:number;count:number;program:number;substituted:boolean;nativeCalls:number;transformWords:number[]};
type PoolCounts={renderCalls:number;pooledCalls:number;colorCalls:number;shadowCalls:number};
type MatrixSnapshot={objects:{id:number;parentId:number|null;type:string;name:string;visible:boolean}[];bytes:Uint8Array};
type Shadow={lightId:number;textureUuid:string;width:number;height:number;bytes:Uint8Array};
type ShadowLight=T.Light&{shadow:T.LightShadow<T.Camera>};
type Frame={calls:number;triangles:number;draws:Draw[];rgba:Uint8Array;shadows:Shadow[];shadow:Uint8Array;poolDelta:PoolCounts;matrices:MatrixSnapshot;shadowLights:ReturnType<typeof shadowLightState>[]};
type Detail={name:string;texture:T.Texture;source:T.Source<unknown>;image:HTMLImageElement;initial:Record<string,unknown>};
type Upload={name:string;reason:string;textureUuid:string;sourceUuid:string;imageId:number;nativeTextureId:number;priorNativeTextureId:number|null;storage:unknown[];subImages:unknown[];mipmapCalls:number;state:Record<string,unknown>};
declare global {interface Window {
 persistWorldEvidence:(name:string,payload:unknown)=>Promise<{persisted:boolean;name:string}>;
 __rg8WorldProof:(options:{style:Style;partition:keyof typeof partitions})=>Promise<unknown>;
}}

const BASELINE='75906273c0cd414c0d004320fc6f654b4783e5b1';
const styles:Style[]=['authentic','golden','noir','detroit2084'];
const allCases=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night','ramp-grazing-day','under-ramp-day'];
const partitions={all:allCases,'linux-a':allCases.slice(0,4),'linux-b':allCases.slice(4)};
const detailNames=['asphalt','bark','brick','bronze','ceramic','cloth','concrete','copper','cork','feather','fur','granite','graphite','grass','gravel','leaf','leather','limestone','marble','metal','paint','roof','rope','rubber','sand','scales','skin','wood'].map(name=>name+'-detail.webp');
const width=960,height=600,near=.08,far=22000;
const assert:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message);};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const bytesEqual=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
const errorText=(error:unknown)=>error instanceof Error?error.stack||error.message:String(error);
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,'0')).join('');
const textHash=(value:unknown)=>hash(new TextEncoder().encode(JSON.stringify(value)));
const status=(message:string)=>console.log('rg8 world proof '+message);
const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext,debug=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),software=/SwiftShader/i.test(gpu);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,width/height,near,far);
const details=new Map<string,Detail>(),imageIds=new WeakMap<object,number>(),nativeTextureIds=new WeakMap<WebGLTexture,number>();
const uploadHistory:Upload[]=[],persistedNames:string[]=[],programEvidence=new Map<number,{id:number;linked:boolean;vertex:string;fragment:string}>(),savedPrograms=new Set<number>();
let nextImageId=1,nextNativeTextureId=1,used=false,started=0,pool:any;
let poolHooks:{render:T.WebGLRenderer['render'];direct:T.WebGLRenderer['renderBufferDirect'];before:T.Scene['onBeforeRender'];after:T.Scene['onAfterRender']}|undefined;
const originalInitTexture=renderer.initTexture;
const guard=()=>assert(performance.now()-started<35*60*1000,'Full-world proof exceeded the fixed35minute deadline');
const imageId=(image:object)=>{let id=imageIds.get(image);if(!id){id=nextImageId++;imageIds.set(image,id);}return id;};
const nativeId=(texture:WebGLTexture|undefined)=>{if(!texture)return null;let id=nativeTextureIds.get(texture);if(!id){id=nextNativeTextureId++;nativeTextureIds.set(texture,id);}return id;};
function textureState(texture:T.Texture){
 const image=texture.source.data as HTMLImageElement;
 return {textureUuid:texture.uuid,sourceUuid:texture.source.uuid,imageId:imageId(image),url:image.currentSrc||image.src,width:image.width,height:image.height,
  format:texture.format,internalFormat:texture.internalFormat,type:texture.type,colorSpace:texture.colorSpace,channel:texture.channel,
  minFilter:texture.minFilter,magFilter:texture.magFilter,wrapS:texture.wrapS,wrapT:texture.wrapT,anisotropy:texture.anisotropy,
  flipY:texture.flipY,premultiplyAlpha:texture.premultiplyAlpha,unpackAlignment:texture.unpackAlignment,generateMipmaps:texture.generateMipmaps,
  offset:texture.offset.toArray(),repeat:texture.repeat.toArray(),center:texture.center.toArray(),rotation:texture.rotation,matrix:texture.matrix.toArray(),matrixAutoUpdate:texture.matrixAutoUpdate};
}
function invariantState(value:Record<string,unknown>){const {format,internalFormat,...rest}=value;return rest;}
function observedInit(texture:T.Texture,reason:string,name:string):Upload {
 const storage:unknown[]=[],subImages:unknown[]=[];let mipmapCalls=0;
 const storageNative=gl.texStorage2D,subNative=gl.texSubImage2D,mipNative=gl.generateMipmap;
 const previous=nativeId((renderer.properties.get(texture) as any).__webglTexture);
 const storageHook:typeof gl.texStorage2D=function(target,levels,internalFormat,w,h){storage.push({target,levels,internalFormat,width:w,height:h});return storageNative.call(gl,target,levels,internalFormat,w,h);};
 const subHook=((...args:unknown[])=>{subImages.push({argumentCount:args.length,target:args[0],level:args[1],x:args[2],y:args[3],format:args[4],type:args[5],sameDecodedImage:args[6]===texture.image});return Reflect.apply(subNative,gl,args);}) as typeof gl.texSubImage2D;
 const mipHook:typeof gl.generateMipmap=function(target){mipmapCalls++;return mipNative.call(gl,target);};
 gl.texStorage2D=storageHook;gl.texSubImage2D=subHook;gl.generateMipmap=mipHook;
 try{originalInitTexture.call(renderer,texture);}finally{assert(gl.texStorage2D===storageHook&&gl.texSubImage2D===subHook&&gl.generateMipmap===mipHook,'Native upload observer replaced');gl.texStorage2D=storageNative;gl.texSubImage2D=subNative;gl.generateMipmap=mipNative;}
 const id=nativeId((renderer.properties.get(texture) as any).__webglTexture);assert(id!==null,'Detail upload has no native texture');
 const row={name,reason,textureUuid:texture.uuid,sourceUuid:texture.source.uuid,imageId:imageId(texture.image as object),nativeTextureId:id,priorNativeTextureId:previous,storage,subImages,mipmapCalls,state:textureState(texture)};
 uploadHistory.push(row);return row;
}
function validateUpload(row:Upload,mode:Mode){
 const storage=row.storage as any[],sub=row.subImages as any[],internal=mode==='original'?gl.RGBA8:mode==='rg8'?gl.RG8:gl.R8,format=mode==='original'?gl.RGBA:mode==='rg8'?gl.RG:gl.RED;
 assert(storage.length===1&&same(storage[0],{target:gl.TEXTURE_2D,levels:10,internalFormat:internal,width:512,height:512}),'Actual detail immutable storage differs: '+row.name+' '+mode);
 assert(sub.length===1&&same(sub[0],{argumentCount:7,target:gl.TEXTURE_2D,level:0,x:0,y:0,format,type:gl.UNSIGNED_BYTE,sameDecodedImage:true}),'Actual upload did not consume the original decoded image: '+row.name);
 assert(row.mipmapCalls===1,'Original mip generation missing');assert(gl.getError()===gl.NO_ERROR,'Native detail upload error');
}
function captureInitialDetails(){
 const hook:T.WebGLRenderer['initTexture']=function(this:T.WebGLRenderer,texture){
  const image=texture.image as HTMLImageElement|undefined,url=image?.currentSrc||image?.src;
  const name=url?new URL(url,location.href).pathname.split('/').at(-1):undefined;
  if(!name?.endsWith('-detail.webp'))return originalInitTexture.call(this,texture);
  assert(detailNames.includes(name),'Unexpected detail texture '+name);assert(!details.has(name),'Detail texture warmed twice or replaced: '+name);
  const sourceUrl=new URL(url!,location.href);assert(sourceUrl.origin===location.origin&&sourceUrl.pathname==='/belle/skins/'+name&&sourceUrl.search==='','Detail URL differs from the original source path');
  assert(image instanceof HTMLImageElement&&image.complete&&image.naturalWidth===512&&image.naturalHeight===512,'Original decoded detail image unavailable');
  const initial=textureState(texture);assert(initial.format===T.RGBAFormat&&initial.internalFormat===null&&initial.colorSpace===T.NoColorSpace&&initial.type===T.UnsignedByteType,'Baseline detail role/storage differs');
  assert(initial.flipY===true&&initial.premultiplyAlpha===false&&initial.unpackAlignment===4&&initial.generateMipmaps===true,'Baseline detail upload flags differ');
  details.set(name,{name,texture,source:texture.source,image,initial});validateUpload(observedInit(texture,'initial-original',name),'original');
 };
 renderer.initTexture=hook;return ()=>{assert(renderer.initTexture===hook,'Original texture warming observer changed');renderer.initTexture=originalInitTexture;};
}
function use(mode:Mode){
 assert(renderer.initTexture===originalInitTexture,'Startup upload observer remains installed');assert(same([...details.keys()].sort(),detailNames),'All28 original detail images are required');
 const uploads:Upload[]=[];
 for(const detail of details.values()){
  const {texture}=detail;assert(texture.source===detail.source&&texture.image===detail.image,'Texture/source/decoded image identity changed');
  assert(same(invariantState(textureState(texture)),invariantState(detail.initial)),'Original detail sampler/image state changed: '+detail.name);
  const format=mode==='original'?T.RGBAFormat:mode==='rg8'?T.RGFormat:T.RedFormat,internalFormat=mode==='original'?null:mode==='rg8'?'RG8':'R8';
  if(texture.format!==format||texture.internalFormat!==internalFormat){texture.format=format;texture.internalFormat=internalFormat;texture.needsUpdate=true;const row=observedInit(texture,mode,detail.name);validateUpload(row,mode);assert(row.nativeTextureId!==row.priorNativeTextureId,'Changed storage retained old native allocation');uploads.push(row);}
  assert(texture.format===format&&texture.internalFormat===internalFormat,'Detail lane storage mismatch');
 }
 return uploads;
}
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
async function persist(name:string,payload:unknown){guard();assert(/^[a-z0-9._-]+$/.test(name)&&!persistedNames.includes(name),'Invalid or duplicate evidence name');const receipt=await window.persistWorldEvidence(name,payload);assert(receipt?.persisted===true&&receipt.name===name,'Evidence persistence was not acknowledged: '+name);persistedNames.push(name);}
async function persistRaw(name:string,bytes:Uint8Array,format:string,extra:Record<string,unknown>={}){
 const compressed=new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 const sha256=await hash(bytes);await persist(name,{kind:format==='RGBA8-bottom-up'?'pixels':'binary',format,bytes:bytes.byteLength,sha256,gzipBase64:base64(compressed),...extra});return sha256;
}
function png(bytes:Uint8Array,w:number,h:number){const out=document.createElement('canvas');out.width=w;out.height=h;const ctx=out.getContext('2d')!,data=ctx.createImageData(w,h);for(let y=0;y<h;y++)data.data.set(bytes.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);ctx.putImageData(data,0,0);return out.toDataURL('image/png');}
const poolCounts=(stats:any):PoolCounts=>({renderCalls:stats.renderCalls,pooledCalls:stats.pooledCalls,colorCalls:stats.colorCalls,shadowCalls:stats.shadowCalls});
const poolDifference=(before:PoolCounts,after:PoolCounts):PoolCounts=>({renderCalls:after.renderCalls-before.renderCalls,pooledCalls:after.pooledCalls-before.pooledCalls,colorCalls:after.colorCalls-before.colorCalls,shadowCalls:after.shadowCalls-before.shadowCalls});
function poolIdentity(stats:any){return {preparedEntries:stats.preparedEntries,activeEntries:stats.activeEntries,pageCount:stats.pageCount,poolBytes:stats.poolBytes,pages:stats.pages,preparationAttempts:stats.preparationAttempts,preparationRenders:stats.preparationRenders,preparationFrames:stats.preparationFrames,preparationReady:stats.preparationReady,fallbacks:stats.fallbacks,observerErrors:stats.observerErrors,contextLosses:stats.contextLosses};}
function verifyPoolHooks(){assert(poolHooks&&renderer.render===poolHooks.render&&renderer.renderBufferDirect===poolHooks.direct&&scene.onBeforeRender===poolHooks.before&&scene.onAfterRender===poolHooks.after,'Original pool hooks changed');}
function matrixSnapshot():MatrixSnapshot {
 const objects:MatrixSnapshot['objects']=[],values:number[]=[];
 const add=(object:T.Object3D)=>{objects.push({id:object.id,parentId:object.parent?.id??null,type:object.type,name:object.name,visible:object.visible});values.push(...object.matrix.elements,...object.matrixWorld.elements);};
 scene.traverse(add);add(camera);scene.traverse(object=>{const shadow=(object as T.DirectionalLight).shadow;if(shadow?.camera)add(shadow.camera);});
 assert(values.every(Number.isFinite),'Nonfinite actual matrix');return {objects,bytes:new Uint8Array(new Float64Array(values).buffer)};
}
// The positive control changes sampled shadow attenuation only. Original
// castShadow membership, tree-caster selection, depth draws and targets remain.
function shadowLightState(light:ShadowLight){
 const shadow=light.shadow,map=shadow.map;
 return {lightId:light.id,lightUuid:light.uuid,type:light.type,visible:light.visible,castShadow:light.castShadow,layers:light.layers.mask,
  lightIntensity:light.intensity,lightColor:light.color.toArray(),shadowIntensity:shadow.intensity,shadowCameraId:shadow.camera.id,
  autoUpdate:shadow.autoUpdate,needsUpdate:shadow.needsUpdate,bias:shadow.bias,normalBias:shadow.normalBias,radius:shadow.radius,mapSize:shadow.mapSize.toArray(),
  map:map?{textureUuid:map.texture.uuid,depthTextureUuid:map.depthTexture?.uuid??null,width:map.width,height:map.height}:null};
}
function actualShadowLights(){const lights:ShadowLight[]=[];scene.traverse(object=>{if(object instanceof T.Light&&object.castShadow){const light=object as ShadowLight;assert(light.shadow?.camera,'Actual shadow light has no shadow camera');lights.push(light);}});return lights;}
async function withShadowIntensityZero(lights:readonly ShadowLight[],capture:()=>Promise<Frame>){
 const owned=lights.map(light=>({light,shadow:light.shadow,camera:light.shadow.camera,map:light.shadow.map,intensity:light.shadow.intensity}));
 const snapshot=()=>lights.map(shadowLightState),before=snapshot();
 assert(before.length>0&&new Set(before.map(row=>row.lightId)).size===before.length,'Unique original shadow lights required');
 assert(before.every(row=>row.castShadow&&Number.isFinite(row.shadowIntensity)&&row.shadowIntensity>=0&&row.shadowIntensity<=1),'Original shadow intensity is invalid');
 assert(before.some(row=>row.shadowIntensity>0&&row.map!==null),'No positive original mapped shadow contribution');
 const control={schema:'belle-shadow-intensity-control-v1',method:'LightShadow.intensity=0',before,disabled:[] as typeof before,afterCapture:[] as typeof before,restored:[] as typeof before};
 const identities=()=>owned.every(row=>row.light.shadow===row.shadow&&row.shadow.camera===row.camera&&row.shadow.map===row.map);
 try{
  for(const row of owned)row.shadow.intensity=0;
  control.disabled=snapshot();assert(same(control.disabled,before.map(row=>({...row,shadowIntensity:0}))),'Shadow control changed unrelated light state');
  const frame=await capture();control.afterCapture=snapshot();
  assert(identities()&&same(control.afterCapture,control.disabled),'Shadow control state drifted during capture');
  assert(same(frame.shadowLights,control.afterCapture),'Captured shadow-light state differs from the control');
  return {frame,control};
 }finally{
  for(const row of owned)row.shadow.intensity=row.intensity;
  control.restored=snapshot();assert(identities()&&same(control.restored,before),'Original shadow-light state was not restored');
 }
}
function beginCapture(draws:Draw[]){
 verifyPoolHooks();const direct=poolHooks!.direct;
 const observer:T.WebGLRenderer['renderBufferDirect']=function(this:T.WebGLRenderer,...args){
  const before=renderer.info.render.calls,result=direct.apply(this,args),[,root,geometry,material,object,group]=args;
  const count=geometry.index?.count??geometry.attributes.position?.count??0,start=Math.max(geometry.drawRange.start,group?.start??0),end=Math.min(count,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity),program=(renderer.properties.get(material) as any).currentProgram;
  assert(program?.program,'Actual native direct draw has no linked program');const values=[...object.matrixWorld.elements,...object.modelViewMatrix.elements,...object.normalMatrix.elements];assert(values.every(Number.isFinite),'Nonfinite submitted matrix');
  draws.push({object:object.id,name:object.name,sourceGeometry:geometry.id,material:(material as T.Material&{id:number}).id,phase:root===null?'shadow':'color',start,count:Math.max(0,end-start),program:program.id,substituted:false,nativeCalls:renderer.info.render.calls-before,transformWords:Array.from(new Uint32Array(new Float64Array(values).buffer))});
  if(!programEvidence.has(program.id)){const attached=gl.getAttachedShaders(program.program)||[],vertex=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=attached.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);assert(vertex&&fragment,'Actual attached shaders unavailable');programEvidence.set(program.id,{id:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS)===true,vertex:gl.getShaderSource(vertex)||'',fragment:gl.getShaderSource(fragment)||''});}
  return result;
 };
 renderer.renderBufferDirect=observer;return ()=>{assert(renderer.renderBufferDirect===observer,'Capture observer replaced during render');renderer.renderBufferDirect=direct;verifyPoolHooks();};
}
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'WebGL2 completion fence unavailable');gl.flush();const began=performance.now();try{for(;;){guard();const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-began<90000,'GPU fence exceeded90seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
async function submit(capture=false){guard();assert(renderer.getRenderTarget()===null,'Default framebuffer required');verifyPoolHooks();renderer.shadowMap.needsUpdate=true;const draws:Draw[]=[],restore=capture?beginCapture(draws):null;try{renderer.render(scene,camera);}finally{restore?.();}const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;await fence();assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native render error');verifyPoolHooks();return {calls,triangles,draws};}
async function warm(){for(let i=0;i<3;i++)await submit();}
async function render():Promise<Frame>{
 const before=pool.read(),work=await submit(true),after=pool.read(),rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 const shadows:Shadow[]=[];scene.traverse(object=>{const light=object as T.DirectionalLight;if(light.castShadow&&light.shadow?.map){const target=light.shadow.map as T.WebGLRenderTarget,bytes=new Uint8Array(target.width*target.height*4);assert(target.isWebGLRenderTarget,'Native shadow target unavailable');renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);shadows.push({lightId:light.id,textureUuid:target.texture.uuid,width:target.width,height:target.height,bytes});}});
 const shadow=new Uint8Array(shadows.reduce((n,s)=>n+s.bytes.length,0));let offset=0;for(const part of shadows){shadow.set(part.bytes,offset);offset+=part.bytes.length;}
 const entries=new Map<number,any>(before.entries.map((entry:any)=>[entry.sourceId,entry]));
 for(const entry of after.entries)for(const phase of ['color','shadow']){const count=entry[phase+'Calls']-(entries.get(entry.sourceId)?.[phase+'Calls']??0),draws=work.draws.filter(draw=>draw.object===entry.sourceId&&draw.phase===phase);assert(count===0||count===draws.length,'Partial or unattributed original buffer substitution');if(count)for(const draw of draws)draw.substituted=true;}
 const poolDelta=poolDifference(poolCounts(before),poolCounts(after));assert(work.draws.reduce((n,d)=>n+d.nativeCalls,0)===work.calls,'Direct submissions do not explain native draw count');
 assert(work.draws.filter(d=>d.substituted).length===poolDelta.pooledCalls&&work.draws.filter(d=>d.substituted&&d.phase==='color').length===poolDelta.colorCalls&&work.draws.filter(d=>d.substituted&&d.phase==='shadow').length===poolDelta.shadowCalls,'Source-specific buffer substitutions differ');
 assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'Native readback error');return {...work,rgba,shadows,shadow,poolDelta,matrices:matrixSnapshot(),shadowLights:actualShadowLights().map(shadowLightState)};
}
function difference(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Readback length changed');let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);changed ||= delta>0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};}
function matching(a:Frame,b:Frame){const color=difference(a.rgba,b.rgba),shadow=a.shadow.length===b.shadow.length?difference(a.shadow,b.shadow):{changedPixels:-1,maxChannelDelta:-1};return {...color,shadowChangedPixels:shadow.changedPixels,shadowMaxChannelDelta:shadow.maxChannelDelta,shadowTargetsEqual:same(a.shadows.map(({bytes,...s})=>s),b.shadows.map(({bytes,...s})=>s)),orderEqual:same(a.draws,b.draws),countsEqual:a.calls===b.calls&&a.triangles===b.triangles,poolDeltaEqual:same(a.poolDelta,b.poolDelta),matricesEqual:bytesEqual(a.matrices.bytes,b.matrices.bytes)&&same(a.matrices.objects,b.matrices.objects)};}
function exact(value:ReturnType<typeof matching>){return value.changedPixels===0&&value.maxChannelDelta===0&&value.shadowChangedPixels===0&&value.shadowMaxChannelDelta===0&&value.shadowTargetsEqual&&value.orderEqual&&value.countsEqual&&value.poolDeltaEqual&&value.matricesEqual;}

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
 for(const [name,value]of Object.entries(values))if(value instanceof T.Texture){const data=value.source.data as {width?:number;height?:number;currentSrc?:string;src?:string};textures[name]={uuid:value.uuid,name:value.name,url:data?.currentSrc||data?.src||null,width:data?.width,height:data?.height,colorSpace:value.colorSpace,channel:value.channel,format:[...details.values()].some(d=>d.texture===value)?T.RGBAFormat:value.format,internalFormat:[...details.values()].some(d=>d.texture===value)?null:value.internalFormat,type:value.type,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,anisotropy:value.anisotropy,matrix:value.matrix.toArray()};}
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

async function persistFrame(style:Style,pose:Pose,lane:Lane,frame:Frame,uploads:Upload[],geometrySha256:string,materialSha256:string,collisionSha256:string){
 const name=style+'-'+pose.name+'-'+lane,colorEvidenceName=name+'-color',matrixEvidenceName=name+'-matrices';
 const rgbaSha256=await persistRaw(colorEvidenceName,frame.rgba,'RGBA8-bottom-up',{width,height,pngDataUrl:png(frame.rgba,width,height)}),shadowTargets=[];
 for(const [index,shadow]of frame.shadows.entries()){const evidenceName=name+'-shadow-'+index,sha256=await persistRaw(evidenceName,shadow.bytes,'RGBA8-bottom-up',{width:shadow.width,height:shadow.height});shadowTargets.push({lightId:shadow.lightId,textureUuid:shadow.textureUuid,width:shadow.width,height:shadow.height,sha256,evidenceName});}
 const matrixSha256=await persistRaw(matrixEvidenceName,frame.matrices.bytes,'Float64-matrix-bytes',{littleEndian:true});
 for(const program of programEvidence.values())if(!savedPrograms.has(program.id)){await persist(style+'-program-'+program.id,{kind:'json',value:{...program,vertexSha256:await hash(new TextEncoder().encode(program.vertex)),fragmentSha256:await hash(new TextEncoder().encode(program.fragment))}});savedPrograms.add(program.id);}
 const receipt={name,caseName:pose.name,lane,style,calls:frame.calls,triangles:frame.triangles,rgbaSha256,colorEvidenceName,shadowSha256:await hash(frame.shadow),shadowTargets,draws:frame.draws,poolDelta:frame.poolDelta,matrixObjects:frame.matrices.objects,matrixSha256,matrixEvidenceName,geometrySha256,materialSha256,collisionSha256,shadowLights:frame.shadowLights,textures:[...details.values()].map(d=>({name:d.name,...textureState(d.texture),nativeTextureId:nativeId((renderer.properties.get(d.texture) as any).__webglTexture)})),uploads};
 await persist(name+'-frame',{kind:'json',value:receipt});return receipt;
}

window.__rg8WorldProof=async({style,partition})=>{
 assert(!used,'Exactly one look/partition is allowed in each fresh browser context');used=true;started=performance.now();
 const errors:string[]=[],completed:any[]=[],prelude:any[]=[];let selectedCases:string[]=[],casePlan:Pose[]=[],bridgeBasis:unknown=null,publication:unknown=null,poolBefore:any=null,poolAfter:any=null;
 try{
  assert(typeof window.persistWorldEvidence==='function','Durable evidence callback missing');assert(same(ART_STYLE_IDS,styles)&&styles.includes(style),'Original authored look identifiers differ');assert(Object.hasOwn(partitions,partition),'Unknown fixed partition');assert(software?partition!=='all':partition==='all','Backend/partition mismatch');assert(software||/Metal/.test(gpu),'Only actual Metal or SwiftShader accepted');selectedCases=partitions[partition];
  assert(typeof CompressionStream==='function'&&typeof gl.fenceSync==='function','Required lossless compression/completion APIs unavailable');
  assert(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4,'Explicit little-endian matrix receipt required');
  const context=gl.getContextAttributes();assert(context?.antialias&&gl.getParameter(gl.SAMPLES)===4,'Original4sample antialiasing required');
  prepareReferencePreferences();localStorage.setItem(ART_STYLE_KEY,style);const response=await fetch('/belle/map.json');assert(response.ok,'Pinned map unavailable');const map=await response.json();alignScottMap(map);prepareCoastGuardMap(map);for(const landmark of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some((item:any)=>item.id===landmark.id))map.landmarks.push(landmark);
  const terrain=new ParkTerrain(map,true),restoreInitial=captureInitialDetails();let world:any;
  try{world=await createWorld(scene,renderer,map,terrain,status);}finally{restoreInitial();}
  use('original');await persist(style+'-initial-textures',{kind:'json',value:{baseline:BASELINE,style,initialUploads:[...uploadHistory]}});world.setQuality('high');world.sky.preview(false);world.sky.setArtStyle(style,true);world.sky.configure({hour:14,cycle:false});world.sky.tick(0,false,true);assert(world.sky.artStyle===style,'Original style selection failed');
  assert(renderer.shadowMap.autoUpdate===false,'Original explicit shadow cadence changed');renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.position.set(0,6,0);camera.lookAt(150,4,270);camera.updateMatrixWorld(true);
  const propsNames=[...planDetroitProps(terrain).keys()].sort(),publicationStart=performance.now();let updates=0,streetRoot:T.Object3D|undefined,propsRoot:T.Object3D|undefined;
  for(;;){guard();world.update(119,0,0,camera,false,false);updates++;await Promise.resolve();
   const streets=scene.children.filter(root=>root.children.length===495&&root.children.every(child=>child instanceof T.InstancedMesh&&child.name==='Street at Sunset · city blocks'));
   const props=scene.children.filter(root=>root.children.length===63&&root.children.every(child=>child instanceof T.InstancedMesh&&propsNames.includes(child.name))&&same([...new Set(root.children.map(child=>child.name))].sort(),propsNames));
   assert(streets.length<=1&&props.length<=1,'Duplicate actual published pack roots');streetRoot=streets[0];propsRoot=props[0];if(streetRoot&&propsRoot)break;
   assert(performance.now()-publicationStart<300000,'Both actual Detroit packs must publish within five minutes');await new Promise(resolve=>setTimeout(resolve,50));
  }
  scene.updateMatrixWorld(true);publication={updates,elapsedMs:performance.now()-publicationStart,frozenTime:119,position:[0,6,0],packs:[{url:districtModels['street-at-sunset'],rootId:streetRoot.id,nodes:496,instancedMeshes:495,names:['Street at Sunset · city blocks']},{url:districtModels['detroit-scenery'],rootId:propsRoot.id,nodes:64,instancedMeshes:63,names:propsNames}]};
  const barrier=await fetch('/__asset_barrier');assert(barrier.ok,'Immutable asset publication barrier missing');const assetBarrier=await barrier.json();assert(assetBarrier.frozen===true&&assetBarrier.baseline===BASELINE,'Publication source binding differs');
  pool=installSharedGeometryBuffers(renderer,scene,{rendererOutput:{type:T.UnsignedByteType,nodes:false},maxDiagnosticEntries:4096});pool.prepare();await Promise.resolve();poolBefore=pool.read();poolHooks={render:renderer.render,direct:renderer.renderBufferDirect,before:scene.onBeforeRender,after:scene.onAfterRender};
  assert(poolBefore.supported&&poolBefore.preparationReady&&poolBefore.activeEntries>=200,'Original shared buffers did not prepare hundreds of meshes');assert(poolBefore.fallbacks===0&&poolBefore.observerErrors===0,'Original buffer preparation failed');
  ({poses:casePlan,bridgeBasis}=posesFor(map,terrain));assert(same(casePlan.map(p=>p.name),allCases),'Original fixed camera plan changed');
  const plan={version:1,styles,cases:allCases,partitions,controlCase:selectedCases[0],lanes:['original','rg8','restored'],controlLanes:['lost-g','lost-g-restored','shadow-off','shadow-restored'],warmupRenders:3,minimumControlPixels:16,deadlineMinutes:35};
  await persist(style+'-context',{kind:'json',value:{schema:'belle-rg8-world-proof-v1',baseline:BASELINE,style,partition,selectedCases,casePlan,bridgeBasis,plan,planSha256:await textHash(plan),gpu,software,width,height,near,far,dpr:renderer.getPixelRatio(),threeRevision:T.REVISION,context,samples:gl.getParameter(gl.SAMPLES),publication,assetBarrier,poolBefore,initialUploads:uploadHistory}});
  const lastIndex=Math.max(...selectedCases.map(name=>allCases.indexOf(name)));
  for(const pose of casePlan){if(pose.index>lastIndex)break;guard();const selected=selectedCases.includes(pose.name);status((selected?'':'prelude ')+style+' '+pose.name);use('original');camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateMatrixWorld(true);world.sky.configure({hour:pose.hour,cycle:false});world.sky.tick(0,false,true);world.update(pose.frozenTime,camera.position.x,camera.position.z,camera,false,false);await Promise.resolve();scene.updateMatrixWorld(true);await warm();
   if(!selected){prelude.push({name:pose.name,frozenTime:pose.frozenTime,warmupRenders:3});continue;}
   const geometry=await geometryReceipts(),geometrySha256=await textHash(geometry),materials=materialReceipts(),materialSha256=await textHash(materials);
   const collision=()=>({map,points:[pose.position,pose.target,[map.bridge.a[0],0,map.bridge.a[1]],[map.bridge.b[0],0,map.bridge.b[1]]].map(([x,,z])=>({x,z,height:terrain.height(x,z),land:terrain.land(x,z),obstructed:terrain.obstructed(x,z,.8)}))});
   const collisionSha256=await textHash(collision());await persist(style+'-'+pose.name+'-scene',{kind:'json',value:{geometry,materials,geometrySha256,materialSha256,collisionSha256,pose,style,prelude:[...prelude]}});
   const frames=new Map<Lane,Frame>(),frameNames:string[]=[],comparisons:any[]=[],issues:string[]=[],controls:any={};
   const capture=async(lane:Lane,mode:Mode)=>{const uploads=use(mode);await warm();const frame=await render();frames.set(lane,frame);
    const geometryAfter=await textHash(await geometryReceipts()),materialAfter=await textHash(materialReceipts()),collisionAfter=await textHash(collision());
    const receipt=await persistFrame(style,pose,lane,frame,uploads,geometryAfter,materialAfter,collisionAfter);frameNames.push(receipt.name+'-frame');
    if(geometryAfter!==geometrySha256)issues.push(lane+': source geometry changed');if(materialAfter!==materialSha256)issues.push(lane+': source material identity changed');if(collisionAfter!==collisionSha256)issues.push(lane+': original map/contact data changed');return frame;
   };
   const original=await capture('original','original');assert(original.shadow.length>0,'Original world shadow target missing');
   for(const [lane,mode]of [['rg8','rg8'],['restored','original']] as const){const frame=await capture(lane,mode),comparison={lane,...matching(original,frame)};comparisons.push(comparison);if(!exact(comparison))issues.push(lane+': exact whole-image/shadow/draw/program/matrix comparison failed');}
   if(pose.name===selectedCases[0]){
    const lost=await capture('lost-g','lost-g');controls.lostG=difference(original.rgba,lost.rgba);if(controls.lostG.changedPixels<16)issues.push('Lost-G positive control changed fewer than16pixels');
    const lostRestored=await capture('lost-g-restored','original');controls.lostGRestored=matching(original,lostRestored);if(!exact(controls.lostGRestored))issues.push('Lost-G restoration failed exact comparison');
    const {frame:off,control}=await withShadowIntensityZero(actualShadowLights(),()=>capture('shadow-off','original'));controls.shadowControl=control;
    controls.shadowOff=difference(original.rgba,off.rgba);if(controls.shadowOff.changedPixels<16)issues.push('Shadow-off positive control changed fewer than16pixels');
    const noncolor=matching(original,off);if(noncolor.shadowChangedPixels!==0||noncolor.shadowMaxChannelDelta!==0||!noncolor.shadowTargetsEqual||!noncolor.orderEqual||!noncolor.countsEqual||!noncolor.poolDeltaEqual||!noncolor.matricesEqual)issues.push('Shadow intensity control changed original noncolor evidence');
    if(!same(control.before,original.shadowLights))issues.push('Shadow intensity control did not start from the original light state');
    const shadowRestored=await capture('shadow-restored','original');controls.shadowRestored=matching(original,shadowRestored);if(!exact(controls.shadowRestored))issues.push('Shadow restoration failed exact comparison');
    if(!same(shadowRestored.shadowLights,original.shadowLights))issues.push('Shadow restoration changed the original light state');
   }
   const direction=camera.getWorldDirection(new T.Vector3()),plannedDirection=new T.Vector3().fromArray(pose.target).sub(camera.position).normalize();assert(direction.distanceTo(plannedDirection)<1e-12,'Actual camera differs from the fixed target');verifyPoolHooks();assert(same(poolIdentity(pool.read()),poolIdentity(poolBefore)),'Original pool pages/preparation/eligibility changed');
   const row={name:pose.name,style,pose,camera:{position:camera.position.toArray(),target:pose.target,direction:direction.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},frameNames,comparisons,controls,geometrySha256,materialSha256,collisionSha256,passed:issues.length===0,errors:issues};await persist(style+'-'+pose.name+'-case',{kind:'json',value:row});completed.push({name:pose.name,passed:row.passed,frameNames,controls});errors.push(...issues.map(issue=>pose.name+': '+issue));
  }
  use('original');verifyPoolHooks();poolAfter=pool.read();assert(same(poolIdentity(poolBefore),poolIdentity(poolAfter)),'Final pool identity differs');
 }catch(error){errors.push(errorText(error));status('FAILED '+errors.at(-1));}
 finally{try{if(details.size===28&&renderer.initTexture===originalInitTexture)use('original');}catch(error){errors.push('Restoring original texture storage: '+errorText(error));}}
 const passed=errors.length===0&&same(completed.map(row=>row.name),selectedCases)&&completed.every(row=>row.passed)&&programEvidence.size>0&&[...programEvidence.values()].every(program=>program.linked)&&!!poolAfter;
 const result={schema:'belle-rg8-world-proof-final-v1',baseline:BASELINE,style,partition,selectedCases,casePlan,bridgeBasis,prelude,publication,gpu,software,width,height,threeRevision:T.REVISION,completed,poolBefore,poolAfter,programIds:[...programEvidence.keys()],uploadCount:uploadHistory.length,uploadHistory,persistedNames:[...persistedNames],passed,errors,scope:'Exact full frozen original world appearance and state across four authored looks/eight planned poses. No full-game riding, controls-deadline or speed acceptance.',shadowReadback:'Exact RGBA8 shadow-target color attachments; native depth-texture bytes are not claimed.'};
 try{await persist(style+'-final',{kind:'json',value:result});}catch(error){result.passed=false;result.errors.push('Final evidence persistence: '+errorText(error));}return result;
};
