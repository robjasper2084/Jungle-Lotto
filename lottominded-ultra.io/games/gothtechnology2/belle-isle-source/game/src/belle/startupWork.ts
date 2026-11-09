import type {Object3D,Texture,WebGLRenderer} from 'three';

/** A real task boundary, not a resolved Promise: lets input and loading UI paint. */
export const yieldStartupTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const abortError=(signal?:AbortSignal)=>signal?.reason??new DOMException('Preparation cancelled','AbortError');
export function checkStartupAbort(signal?:AbortSignal){if(signal?.aborted)throw abortError(signal);}

/** Bounded concurrent asset work. A failure stops new dispatch; issued work settles
 * before the caller owns cleanup, so late callbacks cannot publish partial state. */
export async function startupPool<T,R>(items:readonly T[],concurrency:number,work:(value:T,index:number)=>Promise<R>,signal?:AbortSignal):Promise<R[]>{
 if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>8)throw Error('Invalid startup concurrency');
 checkStartupAbort(signal);let cursor=0,failed=false,failure:unknown;const results=new Array<R>(items.length);
 const worker=async()=>{while(!failed){checkStartupAbort(signal);const index=cursor++;if(index>=items.length)return;
  try{results[index]=await work(items[index],index);}catch(error){failed=true;failure=error;}
  if(!failed)await yieldStartupTask();
 }};
 const settled=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)},worker));
 if(failed)throw failure;const rejected=settled.find(r=>r.status==='rejected');if(rejected?.status==='rejected')throw rejected.reason;
 checkStartupAbort(signal);return results;
}

/** Enforces a deadline without pretending underlying image decoding is cancellable.
 * Late successful resources are disposed instead of becoming an unowned texture. */
export function startupResource<T>(promise:Promise<T>,timeoutMs:number,label:string,release:(value:T)=>void,signal?:AbortSignal):Promise<T>{
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>120000)return Promise.reject(Error('Invalid startup deadline'));
 return new Promise<T>((resolve,reject)=>{
  let settled=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);};
  const fail=(error:unknown)=>{if(settled)return;settled=true;cleanup();reject(error);};
  const onAbort=()=>fail(abortError(signal));
  timer=setTimeout(()=>fail(Error(label+' exceeded its preparation deadline')),timeoutMs);
  signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();
  promise.then(value=>{if(settled){release(value);return;}settled=true;cleanup();resolve(value);},fail);
 });
}

const uploaded=new WeakMap<object,WeakMap<Texture,number>>();
export type TextureInitializer=Partial<Pick<WebGLRenderer,'initTexture'>>;
/** Uploads cached textures only once per renderer/version, in short UI-friendly batches.
 * Never touches framebuffer textures; those are owned by their render-target passes. */
export async function warmTextureList(renderer:TextureInitializer,textures:Iterable<Texture>,signal?:AbortSignal,yieldTask=yieldStartupTask){
 if(!renderer.initTexture)return 0;
 let versions=uploaded.get(renderer);if(!versions){versions=new WeakMap();uploaded.set(renderer,versions);}
 let count=0,batch=0,begin=performance.now();
 for(const texture of new Set(textures)){
  checkStartupAbort(signal);
  if(texture.isRenderTargetTexture||!texture.image||versions.get(texture)===texture.version)continue;
  renderer.initTexture(texture);versions.set(texture,texture.version);count++;batch++;
  if(batch>=2||performance.now()-begin>=4){await yieldTask();checkStartupAbort(signal);batch=0;begin=performance.now();}
 }
 return count;
}
/** Material maps and ShaderMaterial uniform textures. Realistic surface maps that
 * exist only inside onBeforeCompile are warmed by their own asset loader. */
export async function warmObjectTextures(renderer:TextureInitializer,root:Object3D,signal?:AbortSignal){
 if(!renderer.initTexture)return 0;
 const textures=new Set<Texture>();const add=(v:unknown)=>{if(v&&typeof v==='object'&&(v as Texture).isTexture)textures.add(v as Texture);};
 root.traverse(object=>{const material=(object as Object3D&{material?:object|object[]}).material;
  for(const m of material?(Array.isArray(material)?material:[material]):[]){for(const value of Object.values(m))add(value);
   const uniforms=(m as {uniforms?:Record<string,{value:unknown}>}).uniforms;
   for(const uniform of Object.values(uniforms??{})){const value=uniform.value;if(Array.isArray(value))value.forEach(add);else add(value);}
  }
 });
 return warmTextureList(renderer,textures,signal);
}

/** Scene reflection capture is allowed in a loading overlay, never during the
 * protected initial gameplay window or immediately after a measured slow frame. */
export class ReflectionStartupGate{
 private until=0;private stable=0;
 protect(now:number,milliseconds=30000){if(Number.isFinite(now)&&Number.isFinite(milliseconds))this.until=Math.max(this.until,now+Math.max(0,Math.min(120000,milliseconds)));this.stable=0;}
 observe(frameMs:number,eligible:boolean){this.stable=eligible&&Number.isFinite(frameMs)&&frameMs>0&&frameMs<=40?Math.min(120,this.stable+1):0;}
 allowed(now:number){return Number.isFinite(now)&&now>=this.until&&this.stable>=30;}
 get stats(){return {protectedUntilMs:this.until,stableFrames:this.stable};}
}
