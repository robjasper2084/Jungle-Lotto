import type {Camera,Scene,WebGLRenderer} from 'three';

/** Shadows may refresh more slowly than input/animation. Large camera moves and
 * explicit quality changes bypass the interval so teleports never keep old shadows. */
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
  if(renderer.xr.isPresenting){renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled;return;}
  if(!renderer.shadowMap.enabled)return;
  const camera=c as Camera,now=performance.now();
  renderer.shadowMap.needsUpdate=cadence.due(now,camera.position,30,renderer.shadowMap.needsUpdate);
  if(canvas&&now-reportAt>1000){canvas.dataset.shadowBudget=JSON.stringify({updates:cadence.updates,skips:cadence.skips,hz:30});reportAt=now;}
 };
 return cadence;
}
