import * as T from 'three';

/** Async, off-scene presentation details. Collision volumes and landmark data
 * are provided by the map, so these visual-only models never gate movement.
 * Load ahead of the actual display radius; a failed load retries only after
 * the player leaves and returns, avoiding a request every animation frame.
 */
export function createApproachDetail<A extends {update:(x:number,z:number)=>void}>(
 scene:T.Scene,
 sites:readonly (readonly [number,number])[],
 triggerRadius:number,
 prepare:(stage:T.Group,camera:T.Camera)=>Promise<A>,
 onReady?:(asset:A)=>void
){
 let asset:A|undefined,task:Promise<void>|undefined,attemptedNear=false;
 const stats={ready:false,loading:false,attempts:0,failures:0};
 const near=(x:number,z:number)=>sites.some(([cx,cz])=>Math.hypot(x-cx,z-cz)<triggerRadius);
 function prepareAt(x:number,z:number,camera:T.Camera){
  if(asset)return Promise.resolve();
  if(task)return task;
  stats.loading=true;stats.attempts++;
  const stage=new T.Group();stage.name='Deferred Belle Isle presentation';
  task=Promise.resolve().then(()=>prepare(stage,camera)).then(result=>{
   result.update(x,z);
   scene.add(stage);asset=result;stats.ready=true;onReady?.(result);
  }).catch(error=>{
   stats.failures++;stage.removeFromParent();throw error;
  }).finally(()=>{stats.loading=false;task=undefined;});
  return task;
 }
 return {stats,prepareAt,
  update(x:number,z:number,camera:T.Camera,running=true){
   if(asset){asset.update(x,z);return;}
   if(!near(x,z)){attemptedNear=false;return;}
   if(!running||task||attemptedNear)return;
   attemptedNear=true;
   void prepareAt(x,z,camera).catch(error=>console.warn('Deferred Belle Isle scenery unavailable; it will retry on a new approach.',error));
  },
  get ready(){return !!asset;}
 };
}
