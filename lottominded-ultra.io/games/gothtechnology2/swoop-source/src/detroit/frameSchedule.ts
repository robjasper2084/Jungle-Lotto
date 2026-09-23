/** Idle views refresh at 30 Hz; active riding and XR retain display refresh. */
export class FrameSchedule {
 private rendered=-Infinity;
 shouldRender(now:number,idle:boolean,xr:boolean){
  if(idle&&!xr&&now-this.rendered<1000/30-.5)return false;
  this.rendered=now;return true;
 }
}
