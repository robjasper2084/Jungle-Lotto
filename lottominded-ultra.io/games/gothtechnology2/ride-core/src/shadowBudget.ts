import type {Camera,Object3D,Scene,WebGLRenderer} from 'three';

const animatedScenes=new WeakSet<Scene>();
/** A cached depth map belongs to its rendered pose. Reusing it after skinning
 * makes the old silhouette sweep across the new body as flashing self-shadow. */
export function invalidateAnimatedShadow(root:Object3D){
 let node:Object3D|null=root;
 while(node){if(!node.visible)return;if((node as Scene).isScene){animatedScenes.add(node as Scene);return;}node=node.parent;}
}

/** Cache static shadows only. Animated casters invalidate the map before render. */
export class ShadowCadence {
 private at=-Infinity;private x=NaN;private y=NaN;private z=NaN;
 updates=0;skips=0;
 due(now:number,camera:{x:number;y:number;z:number},fps=30,dirty=false){
  const moved=Math.hypot(camera.x-this.x,camera.y-this.y,camera.z-this.z);
  if(dirty||!Number.isFinite(this.x)||now<this.at||now-this.at>=1000/fps-.5||moved>8){
   this.at=now;this.x=camera.x;this.y=camera.y;this.z=camera.z;this.updates++;return true;
  }
  this.skips++;return false;
 }
}

export function installShadowBudget(renderer:WebGLRenderer,scene:Scene,canvas?:HTMLCanvasElement){
 const cadence=new ShadowCadence(),original=scene.onBeforeRender;let reportAt=0;
 renderer.shadowMap.autoUpdate=false;
 scene.onBeforeRender=function(r,s,c,...rest){
  original.call(this,r,s,c,...rest);
  const animated=animatedScenes.delete(scene);
  if(renderer.xr.isPresenting){renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled;return;}
  if(!renderer.shadowMap.enabled)return;
  const camera=c as Camera,now=performance.now();
  renderer.shadowMap.needsUpdate=cadence.due(now,camera.position,30,renderer.shadowMap.needsUpdate||animated);
  if(canvas&&now-reportAt>1000){canvas.dataset.shadowBudget=JSON.stringify({updates:cadence.updates,skips:cadence.skips,mode:animated?'pose-synchronized':'static-cache',staticHz:30});reportAt=now;}
 };
 return cadence;
}
