/** Idle views refresh at 30 Hz; active riding and XR retain display refresh. */
export class FrameSchedule {
 private deadline=-Infinity;private interval=0;
 shouldRender(now:number,idle:boolean,xr:boolean,maxFps=Infinity){
  if(xr){this.deadline=-Infinity;return true;}
  const interval=1000/(idle?Math.min(30,maxFps):maxFps);
  if(interval!==this.interval||!Number.isFinite(this.deadline)||now>this.deadline+interval*3){this.interval=interval;this.deadline=now;}
  if(now+.5<this.deadline)return false;
  // Preserve phase through small callback delays; resetting to now can halve FPS.
  this.deadline+=interval;return true;
 }
}
