/** Idle views refresh at 30 Hz; active riding and XR retain display refresh. */
export function frameSeconds(now:number,previous:number){
 // A queued RAF timestamp may precede performance.now() used after async warmup.
 // Feed a neutral frame to physics, then resume from the next display callback.
 return Number.isFinite(now)&&Number.isFinite(previous)?Math.max(0,Math.min(.1,(now-previous)/1000)):0;
}
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
