/** Throttle distance-only scenery decisions, never animation, input or physics. */
export class SpatialUpdateGate {
 private x=NaN;private z=NaN;private time=-Infinity;private settings='';
 due(x:number,z:number,time:number,settings=''){
  if(!Number.isFinite(this.x)||time<this.time||time-this.time>=.15||Math.hypot(x-this.x,z-this.z)>=4||settings!==this.settings){this.x=x;this.z=z;this.time=time;this.settings=settings;return true;}return false;
 }
}
