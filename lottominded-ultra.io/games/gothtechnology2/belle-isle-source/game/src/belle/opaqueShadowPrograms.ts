import * as T from 'three';
import {hasMacArthurSpanShadowProvenance} from './macArthurSpanCulling.ts';

/** The pinned r185 opaque BasicDepthPacking shader never reads diffuseColor
 * after its map sample. Removing that unused input shares the ordinary depth
 * program and its position-only layout. This adapter substitutes an owned,
 * fixed native material at the direct-draw boundary; it never edits Three's
 * private stock material, an object's material/geometry, or its shadow hooks.
 *
 * Install immediately after constructing the native WebGLRenderer. The caller
 * owns this construction/lifetime contract: no renderer node handler, private
 * shadow-map replacement, or modification of Three's native prototypes. The
 * actual shadow-map render function is captured here, before other wrappers.
 * Merely calling renderBufferDirect with scene=null does not establish scope.
 */
export type OpaqueShadowProgramOptions=Readonly<{nativeRenderer:true}>;
export type OpaqueShadowProgramStats=Readonly<{
 version:1;supported:boolean;active:boolean;disabledReason:string|null;
 shadowScopes:number;nestedScopes:number;qualifyingCalls:number;delegatedCalls:number;
 mappedDelegatedCalls:number;maplessDelegatedCalls:number;spanDelegatedCalls:number;fallbackCalls:number;
 contextGenerations:number;contextLosses:number;contextRestores:number;observerErrors:number;
 ownedMaterials:number;notes:readonly string[];
}>;
export type OpaqueShadowProgramHandle=Readonly<{read:()=>OpaqueShadowProgramStats;dispose:()=>void}>;
type ShadowMap=T.WebGLRenderer['shadowMap'];
type ShadowRecord={map:ShadowMap;original:ShadowMap['render'];descriptor:PropertyDescriptor;wrapped:ShadowMap['render']};
const owners=new WeakMap<T.WebGLRenderer,OpaqueShadowProgramHandle>();
const unavailable=Symbol('accessor');
const nativeCompile=T.Material.prototype.onBeforeCompile,nativeKey=T.Material.prototype.customProgramCacheKey;
const nativeMaterialRender=T.Material.prototype.onBeforeRender;
const nativeAlpha=Object.getOwnPropertyDescriptor(T.Material.prototype,'alphaTest')!;
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'] as const;
const nativeCallbacks=callbackNames.map(key=>T.Object3D.prototype[key]);
const stockTemplate=new T.MeshDepthMaterial({side:T.DoubleSide});
const ignoredStockFields=new Set(['id','uuid','map','version','userData','blendColor']);
const stockFields=Object.getOwnPropertyNames(stockTemplate).filter(key=>!ignoredStockFields.has(key));
const stockKeys=new Set([...Object.getOwnPropertyNames(stockTemplate),'_listeners','linewidth']);

// Read data descriptors without invoking user accessors. alphaTest is the one
// supported native getter, validated separately against the pinned prototype.
function descriptor(object:object,key:PropertyKey):PropertyDescriptor|undefined {
 for(let p:object|null=object;p;p=Object.getPrototypeOf(p)){
  const found=Object.getOwnPropertyDescriptor(p,key);if(found)return found;
 }
 return undefined;
}
function value(object:object,key:PropertyKey):unknown {
 const d=descriptor(object,key);return d?('value'in d?d.value:unavailable):undefined;
}
function zeroAlpha(material:T.Material):boolean {
 const d=descriptor(material,'alphaTest');
 return d?.get===nativeAlpha.get&&d?.set===nativeAlpha.set&&value(material,'_alphaTest')===0;
}
function fixedStock(material:T.Material):material is T.MeshDepthMaterial {
 if(Object.getPrototypeOf(material)!==T.MeshDepthMaterial.prototype||!zeroAlpha(material)||
  value(material,'onBeforeCompile')!==nativeCompile||value(material,'customProgramCacheKey')!==nativeKey||
  value(material,'onBeforeRender')!==nativeMaterialRender||value(material,'linewidth')!==undefined)return false;
 // Unknown additions (defines, alternate map inputs, GLSL overrides, etc.) are
 // deliberately unsupported even if their current value appears harmless.
 if(Object.getOwnPropertyNames(material).some(key=>!stockKeys.has(key)&&
  !['onBeforeCompile','customProgramCacheKey','onBeforeRender'].includes(key)))return false;
 for(const key of stockFields)if(value(material,key)!==value(stockTemplate,key))return false;
 const blend=value(material,'blendColor');
 return !!blend&&typeof blend==='object'&&value(blend,'r')===0&&value(blend,'g')===0&&value(blend,'b')===0;
}
function nativeCallbacksOnly(mesh:T.Mesh):boolean {
 return callbackNames.every((key,i)=>value(mesh,key)===nativeCallbacks[i]);
}
function sourceState(mesh:T.Mesh,depth:T.MeshDepthMaterial):{mapped:boolean;span:boolean}|null {
 const material=value(mesh,'material');
 // The observed bridge and the ordinary opaque depth peers use Standard PBR.
 // Arrays/groups, shader materials, subclasses and skinned/instanced objects
 // stay on their native paths; no broad callback allowlist is introduced.
 if(!material||typeof material!=='object'||Object.getPrototypeOf(material)!==T.MeshStandardMaterial.prototype||
  value(mesh,'customDepthMaterial')!==undefined||value(mesh,'customDistanceMaterial')!==undefined||
  value(mesh,'morphTargetInfluences')!==undefined||value(mesh,'isSkinnedMesh')===true||
  value(mesh,'isInstancedMesh')===true||value(mesh,'isBatchedMesh')===true)return null;
 const source=material as T.MeshStandardMaterial;
 if(value(source,'visible')!==true||value(source,'transparent')!==false||value(source,'opacity')!==1||
  value(source,'wireframe')!==false||!zeroAlpha(source)||value(source,'alphaHash')!==false||
  value(source,'alphaToCoverage')!==false||value(source,'alphaMap')!==null||
  value(source,'displacementMap')!==null||value(source,'clippingPlanes')!==null||
  value(source,'clipShadows')!==false||value(source,'clipIntersection')!==false)return null;
 const side=value(source,'shadowSide');
 if(side!==T.DoubleSide&&(side!==null||value(source,'side')!==T.DoubleSide))return null;
 const map=value(source,'map');
 if(map!==value(depth,'map'))return null;
 if(map!==null&&(!map||typeof map!=='object'||value(map,'isTexture')!==true||
  value(map,'channel')!==0||value(map,'isVideoTexture')===true||value(map,'onUpdate')!==null))return null;
 // Source color-shader hooks are intentionally allowed: native getDepthMaterial
 // does not call/copy them. All coverage and private-clone conditions are false.
 const span=hasMacArthurSpanShadowProvenance(mesh);
 if(!span&&!nativeCallbacksOnly(mesh))return null;
 return {mapped:map!==null,span};
}
function replace(object:object,key:PropertyKey,d:PropertyDescriptor,fn:Function){
 Object.defineProperty(object,key,{...d,value:fn});
}

export function installOpaqueShadowPrograms(renderer:T.WebGLRenderer,options:OpaqueShadowProgramOptions):OpaqueShadowProgramHandle {
 const existing=owners.get(renderer);if(existing)return existing;
 const directDescriptor=Object.getOwnPropertyDescriptor(renderer,'renderBufferDirect');
 const disposeDescriptor=Object.getOwnPropertyDescriptor(renderer,'dispose');
 const originalDirect=value(renderer,'renderBufferDirect') as T.WebGLRenderer['renderBufferDirect'];
 const originalDispose=value(renderer,'dispose') as T.WebGLRenderer['dispose'];
 const initial=value(renderer,'shadowMap') as ShadowMap|undefined;
 const initialRender=initial&&value(initial,'render');
 const canvas=renderer.domElement;
 let disabledReason:string|null=T.REVISION!=='185'?'unsupported-three-revision':options?.nativeRenderer!==true?'missing-constructor-contract':
  !directDescriptor?.configurable||!disposeDescriptor?.configurable||typeof originalDirect!=='function'||typeof originalDispose!=='function'||
  !initial||typeof initialRender!=='function'||!Object.getOwnPropertyDescriptor(initial,'render')?.configurable?'unsupported-render-hooks':
  !canvas?.addEventListener||!canvas?.removeEventListener?'context-events-unavailable':null;
 const supported=disabledReason===null;
 const nativeShadowPrototype=initial&&Object.getPrototypeOf(initial);
 const nativeShadowSource=typeof initialRender==='function'?Function.prototype.toString.call(initialRender):'';
 const counts={shadowScopes:0,nestedScopes:0,qualifyingCalls:0,delegatedCalls:0,mappedDelegatedCalls:0,maplessDelegatedCalls:0,
  spanDelegatedCalls:0,fallbackCalls:0,contextGenerations:1,contextLosses:0,contextRestores:0,observerErrors:0};
 let record:ShadowRecord|null=null,stock:T.MeshDepthMaterial|null=null,owned:T.MeshDepthMaterial|null=null;
 let disposed=false,disposeRequested=false,lost=false,shadowDepth=0,directDepth=0,epoch=0,scopeEpoch=-1,scopeAllowed=false,tainted=false,retirePending=false;

 function retire(){
  stock=null;retirePending=true;
  if(shadowDepth||directDepth)return;
  const previous=owned;owned=null;retirePending=false;
  if(previous){
   previous.removeEventListener('dispose',onOwnedDispose);
   try{previous.dispose();}catch{counts.observerErrors++;disabledReason='owned-depth-disposal-failed';}
  }
 }
 function onOwnedDispose(){disabledReason='owned-depth-disposed';stock=null;}
 function flush(){
  if(shadowDepth||directDepth)return;
  try{if(retirePending)retire();if(disposeRequested)finishDispose();}
  catch{counts.observerErrors++;disabledReason='cleanup-failed';scopeAllowed=false;}
 }
 function bindShadow(map:ShadowMap):boolean {
  const original=value(map,'render'),d=Object.getOwnPropertyDescriptor(map,'render');
  if(Object.getPrototypeOf(map)!==nativeShadowPrototype||typeof original!=='function'||!d?.configurable||
   Function.prototype.toString.call(original)!==nativeShadowSource)return false;
  const next:ShadowRecord={map,original:original as ShadowMap['render'],descriptor:d,wrapped:null as unknown as ShadowMap['render']};
  next.wrapped=function(this:ShadowMap,...args:Parameters<ShadowMap['render']>){
   const wasAllowed=scopeAllowed,wasEpoch=scopeEpoch,wasTainted=tainted;
   if(shadowDepth){counts.nestedScopes++;tainted=true;}
   shadowDepth++;counts.shadowScopes++;
   scopeAllowed=this===map&&record===next&&value(renderer,'shadowMap')===map&&!disposed&&!disposeRequested&&!disabledReason&&!lost&&
    shadowDepth===1&&directDepth===0&&value(map,'type')===T.PCFShadowMap;
   scopeEpoch=epoch;
   try{return Reflect.apply(next.original,this,args);}
   finally{
    const nested=tainted;shadowDepth--;scopeAllowed=wasAllowed&&!nested;scopeEpoch=wasEpoch;
    tainted=shadowDepth?wasTainted||nested:false;flush();
   }
  };
  replace(map,'render',d,next.wrapped);record=next;return true;
 }
 function direct(this:T.WebGLRenderer,...args:Parameters<T.WebGLRenderer['renderBufferDirect']>){
  let substitute:T.MeshDepthMaterial|null=null;
  if(this===renderer&&shadowDepth){
   try{
    const [,scene,,material,object,group]=args;
    if(scopeAllowed&&!tainted&&scopeEpoch===epoch&&!directDepth&&!lost&&!disposed&&!disposeRequested&&!disabledReason&&
     record&&value(renderer,'shadowMap')===record.map&&scene===null&&group===null&&
     Object.getPrototypeOf(object)===T.Mesh.prototype&&fixedStock(material)){
     const state=sourceState(object as T.Mesh,material);
     if(state&&(!stock||stock===material)){
      counts.qualifyingCalls++;stock=material;
      if(!owned){owned=new T.MeshDepthMaterial({side:T.DoubleSide});owned.addEventListener('dispose',onOwnedDispose);}
      if(!retirePending&&fixedStock(owned)&&owned.map===null){
       substitute=owned;counts.delegatedCalls++;
       if(state.mapped)counts.mappedDelegatedCalls++;else counts.maplessDelegatedCalls++;
       if(state.span)counts.spanDelegatedCalls++;
      }
     }
    }
   }catch{counts.observerErrors++;}
   if(!substitute)counts.fallbackCalls++;
  }
  directDepth++;
  try{
   if(substitute){const forwarded=[...args] as Parameters<T.WebGLRenderer['renderBufferDirect']>;forwarded[3]=substitute;return Reflect.apply(originalDirect,this,forwarded);}
   return Reflect.apply(originalDirect,this,args);
  }finally{directDepth--;flush();}
 }
 function onLost(){lost=true;epoch++;scopeAllowed=false;counts.contextLosses++;retire();}
 function onRestored(){
  counts.contextRestores++;counts.contextGenerations++;epoch++;scopeAllowed=false;retire();
  if(disposed||disposeRequested)return;
  // Three registered its restore listener before installation and has already
  // constructed a new public shadowMap. Never adopt an unrelated replacement.
  try{
   if(record&&value(record.map,'render')===record.wrapped)Object.defineProperty(record.map,'render',record.descriptor);
   record=null;lost=false;
   if(!bindShadow(value(renderer,'shadowMap') as ShadowMap))disabledReason='unexpected-restored-shadow-map';
  }
  catch{counts.observerErrors++;disabledReason='unexpected-restored-shadow-map';}
 }
 function rendererDispose(this:T.WebGLRenderer,...args:Parameters<T.WebGLRenderer['dispose']>){
  if(this===renderer)dispose();return Reflect.apply(originalDispose,this,args);
 }
 function read():OpaqueShadowProgramStats {
  return {version:1,supported,active:supported&&!disposed&&!disposeRequested&&!disabledReason&&!lost,
   disabledReason:disposed||disposeRequested?'disposed':lost?'context-lost':disabledReason,...counts,ownedMaterials:owned?1:0,
   notes:['Counts are CPU direct-draw delegations, including calls that throw; they are not observed GL draws, native pipeline states, GPU timings or completions.',
    'Only fixed opaque DoubleSide Standard-material meshes in the captured native PCF shadow pass qualify. Custom coverage, deformation, grouped materials and unknown shadow callbacks stay native.',
    'Mapped and mapless peers use one unchanged native mapless depth material. Source geometry, selected draw range, original stock shadow-hook arguments and draw order are preserved.']};
 }
 function dispose(){if(disposed||disposeRequested)return;disposeRequested=true;scopeAllowed=false;retire();flush();}
 function finishDispose(){
  if(disposed)return;disposed=true;
  if(value(renderer,'renderBufferDirect')===direct)Object.defineProperty(renderer,'renderBufferDirect',directDescriptor!);
  if(value(renderer,'dispose')===rendererDispose)Object.defineProperty(renderer,'dispose',disposeDescriptor!);
  if(record&&value(record.map,'render')===record.wrapped)Object.defineProperty(record.map,'render',record.descriptor);
  canvas?.removeEventListener('webglcontextlost',onLost);canvas?.removeEventListener('webglcontextrestored',onRestored);
  record=null;retire();owners.delete(renderer);
 }
 const handle:OpaqueShadowProgramHandle={read,dispose};
 if(supported){
  try{
   if(!bindShadow(initial!))throw Error('Unexpected native shadow map');
   replace(renderer,'renderBufferDirect',directDescriptor!,direct);replace(renderer,'dispose',disposeDescriptor!,rendererDispose);
   canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);owners.set(renderer,handle);
  }catch{counts.observerErrors++;disabledReason='installation-failed';dispose();}
 }
 return handle;
}
