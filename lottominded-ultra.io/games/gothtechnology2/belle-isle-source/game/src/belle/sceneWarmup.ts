import {Color,DynamicDrawUsage,Group,type Camera,type DirectionalLight,type InstancedMesh,type Object3D,type Scene,type WebGLRenderer} from 'three';

import {checkStartupAbort,startupPool,warmObjectTextures,yieldStartupTask} from './startupWork.ts';

type Compiler=Pick<WebGLRenderer,'compileAsync'> & Partial<Pick<WebGLRenderer,'compile'|'getContext'|'info'|'initTexture'|'shadowMap'>>;
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
   if(!object.visible){
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
// Poll each linked program rather than every material sharing it. All programs
// have already been submitted, so waiting in order does not serialize linking.
async function compileIslandPrograms(renderer:Compiler,roots:Object3D[],camera:Camera,scene:Scene,signal:AbortSignal){
 const gl=renderer.getContext?.(),ext=gl?.getExtension('KHR_parallel_shader_compile');
 if(!gl||!ext||!renderer.compile||!renderer.info?.programs)return false;
 for(const [i,root] of roots.entries()){
  if(i)await yieldStartupTask();
  checkStartupAbort(signal);renderer.compile(root,camera,scene);
 }
 gl.flush();
 const programs=renderer.info.programs.map(p=>p.program as WebGLProgram);
 for(const program of programs){
  while(!gl.getProgramParameter(program,ext.COMPLETION_STATUS_KHR)){
   checkStartupAbort(signal);
   if(gl.isContextLost())throw Error('WebGL context lost during island preparation');
   await new Promise(resolve=>setTimeout(resolve,16));
  }
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
   const timeout=setTimeout(()=>cancel.abort(new Error('Graphics preparation took too long. Please try starting again.')),this.timeoutMs);
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
    // Upload material textures under the loading lock, not in the first ridden frame.
    // A Guide trip can immediately expose a previously hidden island sector.
    // Upload its textures here while still compiling only the active shader set.
    await readyOrCancelled(warmObjectTextures(this.renderer,model??this.scene,cancel.signal),cancel.signal);
    // Smooth has no shadow-map pass. A later prepare in a mapped mode
    // gets a distinct cache entry and still warms both lighting variants.
    const varyingShadow=shadows.some(({light})=>!light.userData.fixedShadowLayout);
    for(const enabled of mappedShadows&&varyingShadow?[false,true]:[mappedShadows]){
     if(cancel.signal.aborted)throw cancelled(cancel.signal);
     for(const state of shadows)state.light.castShadow=state.light.userData.fixedShadowLayout?mappedShadows:enabled;
     if(!model&&await compileIslandPrograms(this.renderer,compileRoots,this.camera,this.scene,cancel.signal))continue;
     // Keep the compiler supplied while earlier programs link. Drain all work
     // for this light topology before changing the directional shadow policy.
     const submit=async(root:Object3D,i:number)=>{
      if(i>0)await readyOrCancelled(yieldStartupTask(),cancel.signal);
      if(cancel.signal.aborted)throw cancelled(cancel.signal);
      let ready:Promise<unknown>;
      try{if(model)model.visible=true;ready=this.renderer.compileAsync(root,this.camera,this.scene);}
      finally{if(model)model.visible=visible!;}
      await readyOrCancelled(ready,cancel.signal);
     };
     if(compileRoots.length===1)await submit(compileRoots[0],0);
     else await startupPool(compileRoots,4,submit,cancel.signal);
     if(!shadows.length)break;
    }
    if(cancel.signal.aborted)throw cancelled(cancel.signal);
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
