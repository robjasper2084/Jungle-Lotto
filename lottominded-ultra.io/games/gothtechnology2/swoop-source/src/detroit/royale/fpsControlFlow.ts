/** Browser adaptation of Burntwax's sprint/aim/shoot priority and reload states.
 * Consumes existing explicit button states; pointer coordinates are never inputs.
 * It shapes local intent only. The server still owns eligibility, ammo and hits. */
export type FpsControlIntent={enabled:boolean;onFoot:boolean;moving:boolean;sprint:boolean;aimMode:number;fire:boolean;reloading:boolean;low:boolean};
export class FpsControlFlow {
 private sprint=false;private aim=false;private serial=0;
 private sprintOrder=0;private aimOrder=0;
 aimSuppressed=false;
 reset(){this.sprint=this.aim=this.aimSuppressed=false;this.serial=this.sprintOrder=this.aimOrder=0;}
 update(i:FpsControlIntent){
  if(!i.enabled||!i.onFoot){this.reset();return {aimMode:i.aimMode,fire:i.fire,sprint:i.sprint};}
  // Combat wins simultaneous edges. Aim and fire remain compatible in either
  // press/release order; a subsequent sprint press can lower held/toggled ADS.
  if(i.sprint&&!this.sprint)this.sprintOrder=++this.serial;
  if(i.aimMode>0&&!this.aim)this.aimOrder=++this.serial;
  this.sprint=i.sprint;this.aim=i.aimMode>0;
  const sprintWins=i.sprint&&i.moving&&!i.low&&!i.reloading&&!i.fire&&this.sprintOrder>(this.aim?this.aimOrder:0);
  this.aimSuppressed=i.reloading||sprintWins;
  return {aimMode:this.aimSuppressed?0:i.aimMode,fire:i.reloading?false:i.fire,sprint:sprintWins};
 }
}

/** View-only bounded sway inspired by Burntwax BobAndSway. Turn rates are in
 * radians/sec, not per-frame pixel deltas. No camera or muzzle authority moves. */
export class FpsWeaponSway {
 x=0;y=0;roll=0;
 reset(){this.x=this.y=this.roll=0;}
 update(dt:number,turnX:number,turnY:number,cycle:number,speed:number,grounded:boolean,ads:boolean,reduced:boolean,shot:boolean){
  if(reduced||!Number.isFinite(dt)||dt>.2){this.reset();return this;}
  if(dt<=0)return this;
  const clamp=(n:number,max:number)=>Number.isFinite(n)?Math.max(-max,Math.min(max,n)):0;
  const weight=ads?.03:shot?.18:1,walk=grounded?Math.min(1,Math.abs(speed)/2.35):0,phase=Number.isFinite(cycle)?cycle*Math.PI*2:0;
  const x=(clamp(turnX,1.8)*.012+Math.sin(phase)*.006*walk)*weight;
  const y=(clamp(turnY,1.8)*.009+Math.sin(phase*2)*.008*walk)*weight;
  const roll=(clamp(turnX,1.8)*.015+Math.sin(phase)*.008*walk)*weight;
  const a=1-Math.exp(-14*dt);this.x+=(x-this.x)*a;this.y+=(y-this.y)*a;this.roll+=(roll-this.roll)*a;
  return this;
 }
}
