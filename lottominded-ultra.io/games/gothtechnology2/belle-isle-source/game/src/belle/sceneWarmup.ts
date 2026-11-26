import {Color,DynamicDrawUsage,Group,type Camera,type DirectionalLight,type InstancedMesh,type Object3D,type Scene,type WebGLRenderer} from 'three';

import {checkStartupAbort,startupPool,warmObjectTextures,yieldStartupTask} from './startupWork.ts';

type Compiler=Pick<WebGLRenderer,'compileAsync'> & Partial<Pick<WebGLRenderer,'compile'|'getContext'|'info'|'initTexture'|'properties'|'shadowMap'>>;
type CompiledProgram=NonNullable<WebGLRenderer['info']['programs']>[number];
type Pending={promise:Promise<void>;signal?:AbortSignal;cancel:AbortController};
const white=new Color(0xffffff);

// Three selects the shader variant from the presence of instanceColor. A pool
// can be empty at spawn and receive its first colored instance well into a ride.
export function prepareColoredDetailPool(mesh:InstancedMesh){
 if(!mesh.instanceMatrix.count)return;
 mesh.setColorAt(0,white);
 mesh.instanceColor!.setUsage(DynamicDrawUsage);
}

/** Compile visible drawables and distance-selected pools against the live lights.
 * Hidden vehicles are prepared separately when the player selects them. */
class IslandWarmupRoot extends Group {
 private drawables:Object3D[];
 constructor(drawables:Object3D[]){super();this.drawables=drawables;}
 static batches(scene:Scene,camera:Camera){
  const drawables:Object3D[]=[];
  function collect(object:Object3D){
   if(!object.visible&&!object.userData.warmIslandShaders){
    const pool=object as InstancedMesh;
    if(!pool.isInstancedMesh||pool.count!==0||pool.instanceMatrix.count===0)return;
   }
   if('material' in object && object.layers.test(camera.layers))drawables.push(object);
   for(const child of object.children)collect(child);
  }
  collect(scene);
  const batches:IslandWarmupRoot[]=[];
  for(let i=0;i<Math.max(1,drawables.length);i+=64)batches.push(new IslandWarmupRoot(drawables.slice(i,i+64)));
  return batches;
 }
 override traverse(callback:(object:Object3D)=>void){for(const object of this.drawables)callback(object);}
}
const cancelled=(signal:AbortSignal)=>signal.reason instanceof Error?signal.reason:new DOMException('Ride preparation cancelled','AbortError');
function collectCompiledPrograms(renderer:Compiler,materials:ReturnType<WebGLRenderer['compile']>,pending:Map<WebGLProgram,CompiledProgram>){
 // In pinned Three r185, compile() returns the submitted materials, and each
 // material retains all its ordinary/instanced, side and lighting variants.
 // currentProgram alone would miss variants shared by several drawables.
 if(!renderer.properties||!(materials instanceof Set))return false;
 for(const material of materials){
  const properties=renderer.properties.get(material) as {programs?:Map<string,CompiledProgram>}|undefined;
  if(!(properties?.programs instanceof Map))return false;
  for(const entry of properties.programs.values())pending.set(entry.program as WebGLProgram,entry);
 }
 return true;
}
/** Submit every required light topology before polling. Keep each distinct GL
 * handle so a later submission cannot replace the material pointer we verify. */
async function prepareIslandPrograms(renderer:Compiler,roots:Object3D[],scene:Scene,camera:Camera,policies:boolean[],
 setShadows:(enabled:boolean)=>void,signal:AbortSignal,onStage:(stage:string)=>void,onNewLink:()=>void,model?:Object3D){
 const gl=renderer.getContext?.(),extension=gl?.getExtension?.('KHR_parallel_shader_compile');
 if(!gl||!extension||!renderer.compile||!renderer.info?.programs)return false;
 const existing=new Set(renderer.info.programs.map(entry=>entry.program));
 const pending=new Map<WebGLProgram,(typeof renderer.info.programs)[number]>();
 for(const enabled of policies){
  setShadows(enabled);
  let scoped=true;
  for(const [i,root] of roots.entries()){
   if(i)await yieldStartupTask();
   checkStartupAbort(signal);
   onStage('submitting island shader batch '+(i+1)+'/'+roots.length+(enabled?' with shadows':' without shadows'));
   const visible=model?.visible;
   if(model)model.visible=true;
   try{
    const materials=renderer.compile(root,camera,scene);
    if(!collectCompiledPrograms(renderer,materials,pending))scoped=false;
   }
   finally{if(model)model.visible=visible!;}
  }
  // Structural compilers without Three's material-program map keep the full
  // validation path. Native preparation ignores unrelated cached programs.
  if(!scoped)for(const entry of renderer.info.programs)pending.set(entry.program as WebGLProgram,entry);
  gl.flush();await yieldStartupTask();
 }
 const total=pending.size;let lastReported=-1;
 while(pending.size){
  checkStartupAbort(signal);
  if(gl.isContextLost())throw Error('WebGL context lost during island preparation');
  if(pending.size!==lastReported){
   lastReported=pending.size;onStage('waiting for island shaders ('+(total-pending.size)+' of '+total+' programs verified)');
  }
  let sliceStart=performance.now();
  for(const [handle,entry] of pending){
   if(!gl.getProgramParameter(handle,extension.COMPLETION_STATUS_KHR))break;
   if(!gl.getProgramParameter(handle,gl.LINK_STATUS))throw Error('Island shader link failed: '+gl.getProgramInfoLog(handle));
   if(!existing.has(handle))onNewLink();
   // Prime Three's reflected uniforms and attributes before the first ride.
   entry.getUniforms();
   pending.delete(handle);
   if(performance.now()-sliceStart>=8){await yieldStartupTask();checkStartupAbort(signal);sliceStart=performance.now();}
  }
  if(pending.size)await new Promise(resolve=>setTimeout(resolve,10));
 }
 checkStartupAbort(signal);return true;
}
function readyOrCancelled<T>(ready:Promise<T>,signal:AbortSignal){
 return new Promise<T>((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(cancelled(signal));};
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  ready.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}
/** Warm both shadow policies and the actual bike light layout before handoff.
 * Temporary visibility is used only to collect programs; no preview is drawn.
 * Driver preparation is best effort: it is not a rendered-frame/GPU benchmark.
 */
export class SceneWarmup {
 private completed=new Set<string>();
 private pending=new Map<string,Pending>();
 private tail:Promise<void>=Promise.resolve();
 private renderer:Compiler;private scene:Scene;private camera:Camera;private busy:(value:boolean)=>void;private paint:()=>Promise<void>;private timeoutMs:number;
 constructor(renderer:Compiler,scene:Scene,camera:Camera,busy:(value:boolean)=>void,paint:()=>Promise<void>=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))),timeoutMs=45_000){this.renderer=renderer;this.scene=scene;this.camera=camera;this.busy=busy;this.paint=paint;this.timeoutMs=timeoutMs;}
 /** Submit the mapped island's current programs while the rider assets load.
  * No light or model visibility is changed. prepare() still validates the
  * complete scene, including actors, both lighting states and textures. */
 primeIsland(){
  const gl=this.renderer.getContext?.();
  if(!this.renderer.compile||!this.renderer.shadowMap?.enabled||!gl||gl.isContextLost()||!gl.getExtension('KHR_parallel_shader_compile'))return;
  this.renderer.compile(this.scene,this.camera,this.scene);
  gl.flush();
 }
 prepare(model?:Object3D,signal?:AbortSignal){
  if(signal?.aborted)return Promise.reject(cancelled(signal));
  const mappedShadows=this.renderer.shadowMap?.enabled!==false;
  const key=(model?.uuid??'island')+(mappedShadows?'-mapped':'-contact');
  if(this.completed.has(key))return Promise.resolve();
  const existing=this.pending.get(key);if(existing&&existing.signal===signal&&!existing.cancel.signal.aborted)return existing.promise;
  const cancel=new AbortController(),abort=()=>cancel.abort(signal?.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const task=this.tail.then(async()=>{
   if(cancel.signal.aborted)throw cancelled(cancel.signal);
   if(this.completed.has(key))return;
   this.busy(true);
   let stage='painting the preparation screen';
   const started=performance.now(),hardDeadline=started+Math.min(90_000,2*this.timeoutMs);
   let deadline=Math.min(started+this.timeoutMs,hardDeadline);
   const expire=()=>cancel.abort(new Error('Graphics preparation took too long while '+stage+'. Please try starting again.'));
   // Keep one timer. A sweep can verify hundreds of programs at once.
   const armTimer=(scheduled:number,delay:number):ReturnType<typeof setTimeout>=>setTimeout(()=>{
    const remaining=deadline-performance.now();
    if(scheduled===deadline||remaining<=0)expire();
    else timeout=armTimer(deadline,remaining);
   },Math.ceil(delay));
   let timeout=armTimer(deadline,deadline-started);
   const checkDeadline=()=>{
    const now=performance.now();
    // A synchronous driver call can outlast the timer that is waiting to run.
    if(now>=deadline)expire();
    if(cancel.signal.aborted)throw cancelled(cancel.signal);
    return now;
   };
   const onNewLink=()=>{
    deadline=Math.min(checkDeadline()+this.timeoutMs,hardDeadline);
   };
   const visible=model?.visible;
   // Rider-only preparation must not recompile every island material. A model
   // with lights changes the scene light topology and still needs the full scene.
   let addsLights=false;model?.traverse?.(object=>{if((object as Object3D&{isLight?:boolean}).isLight)addsLights=true;});
   const compileRoots=!model?IslandWarmupRoot.batches(this.scene,this.camera):[!addsLights?model:this.scene];
   const shadows:{light:DirectionalLight;enabled:boolean}[]=[];
   this.scene.traverse(object=>{const light=object as DirectionalLight;if(light.isDirectionalLight)shadows.push({light,enabled:light.castShadow});});
   try{
    // Paint the existing Preparing label before shader submission begins.
    await readyOrCancelled(this.paint(),cancel.signal);
    checkDeadline();
    // Upload material textures under the loading lock, not in the first ridden frame.
    // A Guide trip can immediately expose a previously hidden island sector.
    // Upload its textures here while still compiling only the active shader set.
    stage='uploading scene textures';
    await readyOrCancelled(warmObjectTextures(this.renderer,model??this.scene,cancel.signal),cancel.signal);
    checkDeadline();
    // Smooth has no shadow-map pass. A later prepare in a mapped mode
    // gets a distinct cache entry and still warms both lighting variants.
    const varyingShadow=shadows.some(({light})=>!light.userData.fixedShadowLayout);
    const policies=mappedShadows&&varyingShadow?[false,true]:[mappedShadows];
    const setShadows=(enabled:boolean)=>{for(const {light} of shadows)light.castShadow=light.userData.fixedShadowLayout?mappedShadows:enabled;};
    const islandReady=await readyOrCancelled(prepareIslandPrograms(this.renderer,compileRoots,this.scene,this.camera,
     policies,setShadows,cancel.signal,message=>{checkDeadline();stage=message;},onNewLink,model),cancel.signal);
    for(const enabled of islandReady?[]:policies){
     if(cancel.signal.aborted)throw cancelled(cancel.signal);
     setShadows(enabled);
     // Keep the compiler supplied while earlier programs link. Drain all work
     // for this light topology before changing the directional shadow policy.
     const submit=async(root:Object3D,i:number)=>{
      if(i>0)await readyOrCancelled(yieldStartupTask(),cancel.signal);
      if(cancel.signal.aborted)throw cancelled(cancel.signal);
      stage='compiling shader batch '+(i+1)+'/'+compileRoots.length+(enabled?' with shadows':' without shadows');
      let ready:Promise<unknown>;
      try{if(model)model.visible=true;ready=this.renderer.compileAsync(root,this.camera,this.scene);}
      finally{if(model)model.visible=visible!;}
      // No frames are drawn under the preparation lock. Submit queued GL work
      // before waiting for asynchronous shader completion on the driver.
      this.renderer.getContext?.().flush();
      await readyOrCancelled(ready,cancel.signal);
     };
     if(compileRoots.length===1)await submit(compileRoots[0],0);
     else await startupPool(compileRoots,4,submit,cancel.signal);
     // Preserve model uniform-cache warmup on drivers without the parallel
     // shader path; their first visible draw must not perform reflection work.
     if(model){
      let sliceStart=performance.now();
      for(const program of this.renderer.info?.programs??[]){
       checkDeadline();program.getUniforms();
       if(performance.now()-sliceStart>=8){
        await readyOrCancelled(yieldStartupTask(),cancel.signal);sliceStart=performance.now();
       }
      }
     }
     if(!shadows.length)break;
    }
    checkDeadline();
    this.completed.add(key);
   }finally{
    clearTimeout(timeout);
    if(model)model.visible=visible!;
    for(const state of shadows)state.light.castShadow=state.enabled;
    this.busy(false);
   }
  }).finally(()=>{signal?.removeEventListener('abort',abort);});
  const entry={promise:task,signal,cancel};this.pending.set(key,entry);
  this.tail=task.catch(()=>{});
  const remove=()=>{if(this.pending.get(key)===entry)this.pending.delete(key);};void task.then(remove,remove);
  return task;
 }
}
