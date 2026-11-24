import * as T from 'three';

/** An application adapter for the pinned three@0.185.1 BatchedMesh implementation.
 * The original callback still computes every ID, bound, sort and draw range. Only
 * its final, redundant indirect-texture dirty request can be coalesced. The full
 * Uint32 allocation (including its unused tail) is compared, never a draw count:
 * native onBeforeRender assigns _multiDrawCount AFTER requesting the update.
 *
 * This is deliberately limited to factory-owned, newly constructed native
 * batches/textures. Arbitrary private-data writes from application callbacks,
 * custom source/texture accessors, custom sorting and custom upload callbacks are
 * unsupported. Existing shader-only onBeforeCompile decorators are unaffected.
 * Replacement, disposal and a second renderer end optimization; rendering stays
 * native. Context loss/restore and external dirty marks invalidate the snapshot.
 * The package and native source fingerprints are pinned by the accompanying test.
 */
export type BatchedIndirectUpdateStats = Readonly<{
 supported:boolean;
 active:boolean;
 disabledReason:string|null;
 attempted:number;
 delegated:number;
 suppressed:number;
 fallback:number;
 externalMarks:number;
 invalidations:number;
}>;
export type BatchedIndirectUpdateHandle = Readonly<{
 read:()=>BatchedIndirectUpdateStats;
 dispose:()=>void;
}>;

const nativeBeforeRender=T.BatchedMesh.prototype.onBeforeRender;
const nativeBeforeShadow=T.BatchedMesh.prototype.onBeforeShadow;
const nativeGetMatrix=T.BatchedMesh.prototype.getMatrixAt;
const nativeGetSphere=T.BatchedMesh.prototype.getBoundingSphereAt;
const nativeGetIndex=T.BufferGeometry.prototype.getIndex;
const nativeMaterialBeforeRender=T.Material.prototype.onBeforeRender;
const nativeTextureUpdate=Object.getOwnPropertyDescriptor(T.Texture.prototype,'needsUpdate')!;
const nativeSourceUpdate=Object.getOwnPropertyDescriptor(T.Source.prototype,'needsUpdate')!;
const nativeImage=Object.getOwnPropertyDescriptor(T.Texture.prototype,'image')!;
const typedArrayPrototype=Object.getPrototypeOf(Uint32Array.prototype);
const bufferGetter=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get!;
const lengthGetter=Object.getOwnPropertyDescriptor(typedArrayPrototype,'length')!.get!;
const offsetGetter=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset')!.get!;
const byteLengthGetter=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get!;
const resizableGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
const handles=new WeakMap<T.Object3D,BatchedIndirectUpdateHandle>();
const layout:Readonly<Record<string,unknown>>=Object.freeze({
 wrapS:T.ClampToEdgeWrapping,wrapT:T.ClampToEdgeWrapping,
 magFilter:T.NearestFilter,minFilter:T.NearestFilter,anisotropy:1,
 internalFormat:null,format:T.RedIntegerFormat,type:T.UnsignedIntType,
 generateMipmaps:false,premultiplyAlpha:false,flipY:false,unpackAlignment:1,
 colorSpace:T.NoColorSpace,normalized:false,isRenderTargetTexture:false,
 isDataTexture:true,isTexture:true,
});
const layoutEntries=Object.entries(layout);

function own(object:object,key:PropertyKey):unknown {
 const d=Object.getOwnPropertyDescriptor(object,key);
 return d&&'value' in d?d.value:undefined;
}
function method(object:object,key:PropertyKey):unknown {
 for(let o:object|null=object;o;o=Object.getPrototypeOf(o)){
  const d=Object.getOwnPropertyDescriptor(o,key);
  if(d)return 'value' in d?d.value:undefined;
 }
 return undefined;
}
function sameAccessor(a:PropertyDescriptor|undefined,b:PropertyDescriptor){
 return !!a&&a.get===b.get&&a.set===b.set;
}
function nativePrototypes(){
 return T.REVISION==='185'&&
  Object.getPrototypeOf(T.DataTexture.prototype)===T.Texture.prototype&&
  !Object.getOwnPropertyDescriptor(T.DataTexture.prototype,'needsUpdate')&&
  sameAccessor(Object.getOwnPropertyDescriptor(T.Texture.prototype,'needsUpdate'),nativeTextureUpdate)&&
  sameAccessor(Object.getOwnPropertyDescriptor(T.Source.prototype,'needsUpdate'),nativeSourceUpdate)&&
  sameAccessor(Object.getOwnPropertyDescriptor(T.Texture.prototype,'image'),nativeImage)&&
  T.BatchedMesh.prototype.onBeforeRender===nativeBeforeRender&&
  T.BatchedMesh.prototype.onBeforeShadow===nativeBeforeShadow;
}
type Shape={texture:T.DataTexture;source:T.Source<unknown>;image:object;data:Uint32Array;buffer:ArrayBuffer;length:number;width:number;height:number};
type State={textureVersion:number;sourceVersion:number};
type Snapshot=State&{bytes:Uint32Array};

function initialShape(batch:T.BatchedMesh):Shape|null {
 const texture=own(batch,'_indirectTexture');
 if(!(texture instanceof T.DataTexture)||Object.getPrototypeOf(texture)!==T.DataTexture.prototype||
  Object.getOwnPropertyDescriptor(texture,'needsUpdate')||Object.getOwnPropertyDescriptor(texture,'image'))return null;
 const source=own(texture,'source');
 if(!(source instanceof T.Source)||Object.getPrototypeOf(source)!==T.Source.prototype||
  Object.getOwnPropertyDescriptor(source,'needsUpdate'))return null;
 const image=own(source,'data');
 if(!image||typeof image!=='object'||Object.getPrototypeOf(image)!==Object.prototype)return null;
 const data=own(image,'data'),width=own(image,'width'),height=own(image,'height');
 if(!(data instanceof Uint32Array)||Object.getPrototypeOf(data)!==Uint32Array.prototype||
  !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||Number(width)<=0||Number(height)<=0)return null;
 const buffer=bufferGetter.call(data) as ArrayBuffer,length=lengthGetter.call(data) as number;
 if(Object.getPrototypeOf(buffer)!==ArrayBuffer.prototype||
  (resizableGetter&&resizableGetter.call(buffer))||offsetGetter.call(data)!==0||
  byteLengthGetter.call(data)!==length*4||buffer.byteLength!==length*4||length!==Number(width)*Number(height))return null;
 return {texture,source,image,data,buffer,length,width:Number(width),height:Number(height)};
}
function nativeState(shape:Shape,setter:((value:unknown)=>void)|null):State|null {
 const {texture,source,image,data,buffer,length,width,height}=shape;
 if(!nativePrototypes()||Object.getPrototypeOf(texture)!==T.DataTexture.prototype||
  Object.getPrototypeOf(source)!==T.Source.prototype||Object.getOwnPropertyDescriptor(source,'needsUpdate')||
  Object.getOwnPropertyDescriptor(texture,'image')||
  own(texture,'source')!==source||own(source,'data')!==image||own(source,'dataReady')!==true||
  own(image,'data')!==data||own(image,'width')!==width||own(image,'height')!==height||
  Object.getPrototypeOf(data)!==Uint32Array.prototype||bufferGetter.call(data)!==buffer||
  lengthGetter.call(data)!==length||offsetGetter.call(data)!==0||byteLengthGetter.call(data)!==length*4||
  own(texture,'onUpdate')!==null)return null;
 const descriptor=Object.getOwnPropertyDescriptor(texture,'needsUpdate');
 if(setter?descriptor?.set!==setter||descriptor.get!==undefined:!!descriptor)return null;
 for(const [key,value] of layoutEntries)if(own(texture,key)!==value)return null;
 for(const key of ['wrapR','isExternalTexture']){
  const d=Object.getOwnPropertyDescriptor(texture,key);
  if(d&&(!('value' in d)||d.value!==undefined&&d.value!==false))return null;
 }
 for(const key of ['mipmaps','updateRanges']){
  const value=own(texture,key);
  if(!Array.isArray(value)||value.length!==0)return null;
 }
 const textureVersion=own(texture,'version'),sourceVersion=own(source,'version');
 if(!Number.isSafeInteger(textureVersion)||Number(textureVersion)<0||
  !Number.isSafeInteger(sourceVersion)||Number(sourceVersion)<0||
  Object.getOwnPropertyDescriptor(texture,'version')?.writable!==true||
  Object.getOwnPropertyDescriptor(source,'version')?.writable!==true)return null;
 return {textureVersion:Number(textureVersion),sourceVersion:Number(sourceVersion)};
}

/** Counts are lifetime setter decisions, NOT uploads, GPU work or completions.
 * attempted = delegated + suppressed; fallback is a subset of delegated.
 * External setter invocations delegate and invalidate but are counted separately.
 */
export function installBatchedIndirectUpdates(batch:T.BatchedMesh):BatchedIndirectUpdateHandle {
 const existing=handles.get(batch);if(existing)return existing;
 let supported=false,active=false,disabledReason:string|null=null;
 let attempted=0,delegated=0,suppressed=0,fallback=0,externalMarks=0,invalidations=0;
 let snapshot:Snapshot|null=null,scope:{eligible:boolean}|null=null;
 let shape:Shape|null=null,renderer:object|null=null,canvas:EventTarget|null=null,contextLost=false;
 const originalCallback=Object.getOwnPropertyDescriptor(batch,'onBeforeRender');
 const invalidate=()=>{snapshot=null;invalidations++;};
 const handle:BatchedIndirectUpdateHandle=Object.freeze({
  read:()=>Object.freeze({supported,active,disabledReason,attempted,delegated,suppressed,fallback,externalMarks,invalidations}),
  dispose:()=>disable('disposed'),
 });
 function detach(){
  try{if(Object.getOwnPropertyDescriptor(batch,'onBeforeRender')?.value===wrapped){
    if(originalCallback)Object.defineProperty(batch,'onBeforeRender',originalCallback);
    else delete (batch as unknown as Record<string,unknown>).onBeforeRender;
  }}catch{/* An application-frozen descriptor stays as a native pass-through. */}
  if(shape){
   try{if(Object.getOwnPropertyDescriptor(shape.texture,'needsUpdate')?.set===setNeedsUpdate)
     delete (shape.texture as unknown as Record<string,unknown>).needsUpdate;
   }catch{/* Never replace a new application-owned descriptor. */}
   try{shape.texture.removeEventListener('dispose',onTextureDispose);}catch{}
  }
  if(canvas){
   try{canvas.removeEventListener('webglcontextlost',onContextLost);}catch{}
   try{canvas.removeEventListener('webglcontextrestored',onContextRestored);}catch{}
  }
  canvas=null;renderer=null;
 }
 function disable(reason:string){
  if(!active){if(disabledReason===null)disabledReason=reason;return;}
  active=false;disabledReason=reason;invalidate();detach();
 }
 function onTextureDispose(){disable('texture-disposed');}
 function onContextLost(){contextLost=true;invalidate();}
 function onContextRestored(){contextLost=false;invalidate();}
 function observeRenderer(value:unknown){
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==T.WebGLRenderer.prototype||
   own(value,'isWebGLRenderer')!==true)return false;
  const next=own(value,'domElement') as EventTarget|undefined;
  if(!next||typeof next.addEventListener!=='function'||typeof next.removeEventListener!=='function')return false;
  if(renderer&&renderer!==value){disable('multiple-renderers');return false;}
  if(canvas&&canvas!==next){disable('canvas-replaced');return false;}
  if(!renderer){
   renderer=value;canvas=next;
   canvas.addEventListener('webglcontextlost',onContextLost);
   canvas.addEventListener('webglcontextrestored',onContextRestored);
  }
  return !contextLost;
 }
 function qualified(args:unknown[]){
  if(!active||!shape)return false;
  if(!nativePrototypes()){disable('native-implementation-changed');return false;}
  if(own(batch,'_indirectTexture')!==shape.texture){disable('texture-replaced');return false;}
  return observeRenderer(args[0])&&active&&
   Object.getPrototypeOf(batch)===T.BatchedMesh.prototype&&
   method(batch,'onBeforeRender')===wrapped&&method(batch,'onBeforeShadow')===nativeBeforeShadow&&
   method(batch,'getMatrixAt')===nativeGetMatrix&&method(batch,'getBoundingSphereAt')===nativeGetSphere&&
   own(batch,'customSort')===null&&!!args[3]&&typeof args[3]==='object'&&
   method(args[3],'getIndex')===nativeGetIndex&&!!args[4]&&typeof args[4]==='object'&&
   method(args[4],'onBeforeRender')===nativeMaterialBeforeRender;
 }
 function wrapped(this:T.BatchedMesh,...args:Parameters<T.BatchedMesh['onBeforeRender']>){
  if(this!==batch)return Reflect.apply(nativeBeforeRender,this,args);
  const previous=scope;
  let eligible=false;
  try{eligible=!previous&&qualified(args);}catch{disable('observation-failed');}
  if(previous){previous.eligible=false;invalidate();}
  scope={eligible};
  try{
   const current=!active?method(batch,'onBeforeRender'):null;
   return Reflect.apply(typeof current==='function'&&current!==wrapped?current:nativeBeforeRender,this,args);
  }
  catch(error){invalidate();throw error;}
  finally{scope=previous;}
 }
 function setNeedsUpdate(this:T.Texture,value:unknown){
  const external=this!==shape?.texture||!scope||value!==true;
  if(external){externalMarks++;invalidate();}else attempted++;
  if(this===shape?.texture&&!nativePrototypes()){
   if(!external){delegated++;fallback++;}
   disable('native-implementation-changed');
   if(Object.getOwnPropertyDescriptor(this,'needsUpdate')?.set!==setNeedsUpdate){
    // A later application prototype change owns this operation after detaching.
    // Use ordinary strict assignment, retaining its setter or assignment failure.
    this.needsUpdate=value as boolean;return;
   }
   return nativeTextureUpdate.set!.call(this,value);
  }
  if(external||!shape||!scope)return nativeTextureUpdate.set!.call(this,value);
  let state:State|null=null,bytes:Uint32Array|null=null;
  if(scope.eligible&&active){
   try{
    state=nativeState(shape,setNeedsUpdate);
    if(state&&snapshot&&state.textureVersion===snapshot.textureVersion&&state.sourceVersion===snapshot.sourceVersion){
     let equal=true;
     for(let i=0;i<shape.length;i++)if(shape.data[i]!==snapshot.bytes[i]){equal=false;break;}
     if(equal){suppressed++;return;}
    }
    if(state){bytes=new Uint32Array(shape.length);for(let i=0;i<shape.length;i++)bytes[i]=shape.data[i];}
   }catch{state=null;bytes=null;}
  }
  delegated++;
  if(!state||!bytes)fallback++;
  snapshot=null;
  // Do not catch or translate a native setter exception, and never clear its
  // version. An earlier delegated request may still be awaiting its first upload.
  nativeTextureUpdate.set!.call(this,value);
  if(state&&bytes){
   try{
    const after=nativeState(shape,setNeedsUpdate);
    if(after&&after.textureVersion===state.textureVersion+1&&after.sourceVersion===state.sourceVersion+1)
     snapshot={...after,bytes};
   }catch{/* A failed observation simply leaves the next mark native. */}
  }
 }
 try{
  if(!nativePrototypes()||Object.getPrototypeOf(batch)!==T.BatchedMesh.prototype||
   method(batch,'onBeforeRender')!==nativeBeforeRender||method(batch,'onBeforeShadow')!==nativeBeforeShadow||
   method(batch,'getMatrixAt')!==nativeGetMatrix||method(batch,'getBoundingSphereAt')!==nativeGetSphere||
   own(batch,'customSort')!==null)throw new Error('unsupported-batch');
  shape=initialShape(batch);
  const initial=shape&&nativeState(shape,null);
  if(!initial||initial.textureVersion!==0||initial.sourceVersion!==0)throw new Error('unsupported-initial-texture');
  Object.defineProperty(shape!.texture,'needsUpdate',{configurable:true,enumerable:nativeTextureUpdate.enumerable,set:setNeedsUpdate});
  Object.defineProperty(batch,'onBeforeRender',{configurable:true,writable:true,enumerable:originalCallback?.enumerable??false,value:wrapped});
  shape!.texture.addEventListener('dispose',onTextureDispose);
  supported=true;active=true;handles.set(batch,handle);
 }catch(error){
  disabledReason=error instanceof Error?error.message:'installation-failed';
  detach();
 }
 return handle;
}

/** Boundary-only collection. No renderer/GL reads, global strong registry or
 * per-frame traversal. Returned values are copies; counts keep setter semantics.
 */
export function batchedIndirectUpdateDiagnostics(root:T.Object3D){
 const totals={attempted:0,delegated:0,suppressed:0,fallback:0,externalMarks:0,invalidations:0};
 const batches:{objectId:number;name:string;stats:BatchedIndirectUpdateStats}[]=[];
 let activeBatches=0;
 root.traverse(object=>{
  const handle=handles.get(object);if(!handle)return;
  const stats=handle.read();if(stats.active)activeBatches++;
  for(const key of Object.keys(totals) as (keyof typeof totals)[])totals[key]+=stats[key];
  batches.push({objectId:object.id,name:object.name,stats});
 });
 return {version:1 as const,installedBatches:batches.length,activeBatches,totals,batches};
}
