import {REVISION} from 'three';

type Call=(this:unknown,...args:unknown[])=>unknown;
type Uniform={id:string;type:number;size:number;addr:unknown;setValue:Call};
type Program={getUniforms():{map?:Record<string,unknown>}};
type Renderer={
 getContext():unknown;
 renderBufferDirect:Call;
 dispose:Call;
 properties:{get(material:object):{currentProgram?:Program}|undefined};
 domElement?:Pick<EventTarget,'addEventListener'|'removeEventListener'>;
};
type Context={uniformMatrix4fv:Call};
type State={own:PropertyDescriptor;wrapper:Call;cache:Float32Array|null;method:unknown;location:unknown;serial:number;epoch:number};
const installed=new WeakMap<object,()=>void>();
const noop=()=>{};
const isObject=(value:unknown):value is object=>value!==null&&(typeof value==='object'||typeof value==='function');
const floatPrototype=Float32Array.prototype;
const typedPrototype=Object.getPrototypeOf(floatPrototype);
const typedLength=Object.getOwnPropertyDescriptor(typedPrototype,'length')!.get!;
const typedBuffer=Object.getOwnPropertyDescriptor(typedPrototype,'buffer')!.get!;
const bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength')!.get!;
const bufferResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;

/** Inspect only ordinary fixed Float32 storage. Do not replay user metadata
 * getters, convert ordinary arrays again, or cache shared/non-finite inputs. */
function finitePayload(value:unknown,length:number):Float32Array|null {
 if(!ArrayBuffer.isView(value)||Object.getPrototypeOf(value)!==floatPrototype)return null;
 try{
  if(Reflect.apply(typedLength,value,[])!==length)return null;
  const backing=Reflect.apply(typedBuffer,value,[]);
  Reflect.apply(bufferLength,backing,[]); // Rejects SharedArrayBuffer by brand.
  if(bufferResizable&&Reflect.apply(bufferResizable,backing,[]))return null;
 }catch{return null;}
 const data=value as Float32Array;
 for(let i=0;i<length;i++)if(!Number.isFinite(data[i]))return null;
 return data;
}
function sameValues(a:Float32Array,b:Float32Array,length:number){
 for(let i=0;i<length;i++)if(!Object.is(a[i],b[i]))return false;
 return true;
}
function ownFunction(target:object,name:string){
 const own=Object.getOwnPropertyDescriptor(target,name);
 return typeof own?.value==='function'?own:undefined;
}
function restore(target:object,name:string,own:PropertyDescriptor,wrapper:Call){
 // A later owner can seal its slot. The stopped wrapper already delegates;
 // inability to restore must not replace a real render/dispose result/error.
 try{if(Object.getOwnPropertyDescriptor(target,name)?.value===wrapper)Object.defineProperty(target,name,own);}catch{}
}

/** Cache only the measured directional-shadow matrix array in Three r185.
 *
 * Three owns these programs and uniform locations, just as for its existing
 * single-uniform caches. No raw GL method, shader, draw, timer, fence, or frame
 * scheduling is changed. The original array setter still flattens every input;
 * its final native upload is omitted only for an identical eligible payload.
 *
 * Inspecting a program AFTER renderBufferDirect returns adds no reflection:
 * r185 setProgram has already called getUniforms before every draw/early return.
 * Tests pin that contract to the installed 0.185.1 source and browser module.
 */
export function installShadowMatrixCache(target:object):()=>void {
 const existing=installed.get(target);if(existing)return existing;
 if(REVISION!=='185')return noop;
 const candidate=target as Partial<Renderer>;
 const directOwn=ownFunction(target,'renderBufferDirect'),disposeOwn=ownFunction(target,'dispose');
 if(!directOwn||!disposeOwn||typeof candidate.getContext!=='function'||typeof candidate.properties?.get!=='function')return noop;
 let gl:Context;
 try{
  const context=candidate.getContext();
  if(!isObject(context)||typeof Reflect.get(context,'uniformMatrix4fv')!=='function')return noop;
  gl=context as Context;
 }catch{return noop;}
 const renderer=candidate as Renderer,originalDirect=directOwn.value as Call,originalDispose=disposeOwn.value as Call;
 const states=new WeakMap<Uniform,State>(),nodes=new Set<WeakRef<Uniform>>();
 let programs=new WeakSet<object>(),stopped=false,epoch=0;

 function restoreNodes(){
  for(const ref of nodes){
   const node=ref.deref();if(!node)continue;
   const state=states.get(node);if(!state)continue;
   state.cache=null;state.serial++;
   restore(node,'setValue',state.own,state.wrapper);states.delete(node);
  }
  nodes.clear();
 }
 function reset(){epoch++;restoreNodes();programs=new WeakSet();}
 function observeMaterial(material:unknown){
  if(!isObject(material))return;
  const program=renderer.properties.get(material)?.currentProgram;
  if(!isObject(program)||typeof program.getUniforms!=='function'||programs.has(program))return;
  programs.add(program);
  const value=program.getUniforms()?.map?.directionalShadowMatrix;
  if(!isObject(value))return;
  const node=value as Uniform,own=ownFunction(node,'setValue');
  const id=Object.getOwnPropertyDescriptor(node,'id')?.value,type=Object.getOwnPropertyDescriptor(node,'type')?.value;
  const size=Object.getOwnPropertyDescriptor(node,'size')?.value,address=Object.getOwnPropertyDescriptor(node,'addr');
  // Active uniform sizes are fixed for a linked program. Larger arrays retain
  // their original setter; bound this optional cache to at most 256 scalars.
  if(!own||id!=='directionalShadowMatrix'||type!==0x8b5c||!Number.isInteger(size)||size<1||size>16||!address||!('value'in address)||!isObject(address.value))return;
  const original=own.value as Call,length=size*16,location=address.value;
  const state:State={own,wrapper:noop,cache:null,method:null,location:null,serial:0,epoch};
  function forward(method:Call,args:unknown[]){
   try{
    const data=args.length===3&&args[0]===location&&args[1]===false?finitePayload(args[2],length):null;
    if(data&&state.cache&&state.method===method&&state.location===args[0]&&sameValues(state.cache,data,length))return;
    const serial=++state.serial;
    const next=data?(state.cache??new Float32Array(length)):null;
    state.cache=null;
    if(next)for(let i=0;i<length;i++)next[i]=data![i];
    const result=Reflect.apply(method,gl,args);
    // A nested call, context transition, or instrumented-method mutation must
    // not commit a stale payload after the original invocation returns.
    if(next&&data&&!stopped&&state.epoch===epoch&&serial===state.serial&&sameValues(next,data,length)){
     state.cache=next;state.method=method;state.location=args[0];
    }
    return result;
   }catch(error){state.cache=null;state.serial++;throw error;}
  }
  let selectedMethod:unknown,selectedForward:Call|undefined;
  const forwarding={get uniformMatrix4fv(){
   try{
    // JS resolves the method BEFORE evaluating this.addr and the other call
    // arguments. Keep that ordering, even if either accessor reenters a setter.
    const method=Reflect.get(gl,'uniformMatrix4fv');
    if(typeof method!=='function'){state.cache=null;state.serial++;return method;}
    if(method!==selectedMethod){
     selectedMethod=method;
     // Close over this lookup, rather than the mutable memoized method: a
     // nested argument getter can select a different method before invocation.
     selectedForward=(...args)=>forward(method as Call,args);
    }
    return selectedForward;
   }catch(error){state.cache=null;state.serial++;throw error;}
  }};
  const wrapper:Call=function(...args){
   if(stopped||state.epoch!==epoch||this!==node||args[0]!==gl){
    state.cache=null;state.serial++;return Reflect.apply(original,this,args);
   }
   const forwarded=args.slice();forwarded[0]=forwarding;
   try{return Reflect.apply(original,this,forwarded);}
   catch(error){state.cache=null;state.serial++;throw error;}
  };
  state.wrapper=wrapper;
  Object.defineProperty(node,'setValue',{...own,value:wrapper});states.set(node,state);
  // Weak references let discarded shader variants and their caches be freed.
  for(const ref of nodes)if(!ref.deref())nodes.delete(ref);
  nodes.add(new WeakRef(node));
 }
 const direct:Call=function(...args){
  const result=Reflect.apply(originalDirect,this,args);
  if(!stopped&&this===renderer){
   try{observeMaterial(args[3]);}catch{cleanup();} // Optional optimization fails closed.
  }
  return result;
 };
 const dispose:Call=function(...args){cleanup();return Reflect.apply(originalDispose,this,args);};
 function cleanup(){
  if(stopped)return;stopped=true;reset();
  try{renderer.domElement?.removeEventListener('webglcontextlost',reset);}catch{}
  try{renderer.domElement?.removeEventListener('webglcontextrestored',reset);}catch{}
  restore(target,'renderBufferDirect',directOwn!,direct);restore(target,'dispose',disposeOwn!,dispose);
  installed.delete(target);
 }
 try{
  Object.defineProperty(target,'renderBufferDirect',{...directOwn,value:direct});
  Object.defineProperty(target,'dispose',{...disposeOwn,value:dispose});
  renderer.domElement?.addEventListener('webglcontextlost',reset);
  renderer.domElement?.addEventListener('webglcontextrestored',reset);
 }catch{cleanup();return noop;}
 installed.set(target,cleanup);return cleanup;
}
