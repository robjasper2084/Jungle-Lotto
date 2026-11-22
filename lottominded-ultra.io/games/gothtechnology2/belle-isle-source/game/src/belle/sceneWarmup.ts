import {Group,type Camera,type DirectionalLight,type Object3D,type Scene,type WebGLRenderer} from 'three';

import {warmObjectTextures,yieldStartupTask} from './startupWork.ts';

type Compiler=Pick<WebGLRenderer,'compileAsync'> & Partial<Pick<WebGLRenderer,'initTexture'|'shadowMap'|'getContext'>>;
type Pending={promise:Promise<void>;signal?:AbortSignal;cancel:AbortController};
/** compileAsync normally visits even invisible geometry. Supply Smooth's active
 * drawables while the real target scene continues to provide all the lighting.
 * No game object is cloned, reparented or removed from the scene. */
class SmoothWarmupRoot extends Group {
 private drawables:Object3D[];
 constructor(drawables:Object3D[]){super();this.drawables=drawables;}
 static batches(scene:Scene,camera:Camera){
  const drawables:Object3D[]=[];
  scene.traverseVisible(object=>{
   if('material' in object && object.layers.test(camera.layers))drawables.push(object);
  });
  const batches:SmoothWarmupRoot[]=[];
  for(let i=0;i<Math.max(1,drawables.length);i+=64)batches.push(new SmoothWarmupRoot(drawables.slice(i,i+64)));
  return batches;
 }
 override traverse(callback:(object:Object3D)=>void){for(const object of this.drawables)callback(object);}
}
const cancelled=(signal:AbortSignal)=>signal.reason instanceof Error?signal.reason:new DOMException('Ride preparation cancelled','AbortError');
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
   let stage='painting the preparation screen';
   const timeout=setTimeout(()=>cancel.abort(new Error('Graphics preparation took too long while '+stage+'. Please try starting again.')),this.timeoutMs);
   const visible=model?.visible;
   // Rider-only preparation must not recompile every island material. A model
   // with lights changes the scene light topology and still needs the full scene.
   let addsLights=false;model?.traverse?.(object=>{if((object as Object3D&{isLight?:boolean}).isLight)addsLights=true;});
   const compileRoots=!model&&!mappedShadows?SmoothWarmupRoot.batches(this.scene,this.camera):[model&&!addsLights?model:this.scene];
   const shadows:{light:DirectionalLight;enabled:boolean}[]=[];
   this.scene.traverse(object=>{const light=object as DirectionalLight;if(light.isDirectionalLight)shadows.push({light,enabled:light.castShadow});});
   try{
    // Paint the existing Preparing label before shader submission begins.
    await readyOrCancelled(this.paint(),cancel.signal);
    // Upload material textures under the loading lock, not in the first ridden frame.
    // A Guide trip can immediately expose a previously hidden island sector.
    // Upload its textures here while still compiling only the active shader set.
    stage='uploading scene textures';
    await readyOrCancelled(warmObjectTextures(this.renderer,model??this.scene,cancel.signal),cancel.signal);
    // Smooth has no shadow-map pass. A later prepare in a mapped mode
    // gets a distinct cache entry and still warms both lighting variants.
    for(const enabled of mappedShadows?[false,true]:[false]){
     if(cancel.signal.aborted)throw cancelled(cancel.signal);
     for(const state of shadows)state.light.castShadow=enabled;
     // compileAsync collects synchronously, then awaits driver readiness.
     for(const [i,root] of compileRoots.entries()){
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
     }
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
