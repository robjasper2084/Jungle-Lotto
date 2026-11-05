const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

/** Local input assistance only: normal throttle commands still pass through physics
 * and the multiplayer authority. Two forward pushes must return through neutral. */
export class CruiseControl {
  active=false;
  targetSpeed=0;
  private forward=false;
  private firstPush=-Infinity;
  private integral=0;

  reset(){this.active=false;this.targetSpeed=0;this.integral=0;this.forward=false;this.firstPush=-Infinity;}
  lock(speed:number){
    if(!Number.isFinite(speed)||speed<.5)return false;
    this.active=true;this.targetSpeed=speed;this.integral=0;return true;
  }
  toggle(speed:number){if(this.active)this.reset();else this.lock(speed);}
  update(throttle:number,speed:number,dt:number,allowed=true,braking=false,now=performance.now()){
    if(!allowed||braking||throttle<-.05||!Number.isFinite(speed)){
      this.reset();return throttle;
    }
    if(throttle<.25)this.forward=false;
    if(throttle>=.65&&!this.forward){
      this.forward=true;
      if(now-this.firstPush<=450){this.lock(speed);this.firstPush=-Infinity;}
      else this.firstPush=now;
    }
    if(!this.active)return throttle;
    const error=this.targetSpeed-speed;
    // Integrate road drag / grade so cruise holds the captured speed instead of
    // settling below it. Steering and all collision limits remain in the engine.
    this.integral=clamp(this.integral+error*clamp(dt,0,.06)*.3,-.55,.7);
    return clamp(error*.8+this.integral,-.7,1);
  }
  get label(){return this.active?`CRUISE · ${Math.round(this.targetSpeed*3.6)} km/h`:'';}
}
