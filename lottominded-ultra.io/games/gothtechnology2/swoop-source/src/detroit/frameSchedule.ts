/** Idle views refresh at 30 Hz; active riding and XR retain display refresh. */
export class FrameSchedule {
 private rendered=-Infinity;
 shouldRender(now:number,idle:boolean,xr:boolean,maxFps=Infinity){
  if(!xr&&now-this.rendered<1000/(idle?Math.min(30,maxFps):maxFps)-.5)return false;
  this.rendered=now;return true;
 }
}
