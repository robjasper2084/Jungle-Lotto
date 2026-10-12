export const wrapYaw=(yaw:number)=>Math.atan2(Math.sin(yaw),Math.cos(yaw));
/** Keep aim in world space on foot; authoritative heading follows this input. */
export class FootAim {
 active=false;heading=0;
 sync(p:{footMode:number;headingY:number}|undefined){
  const active=p?.footMode===2;
  if(active&&!this.active)this.heading=p!.headingY;
  this.active=active;
 }
 turn(delta:number){if(Number.isFinite(delta))this.heading=wrapYaw(this.heading+delta);}
 relative(p:{headingY:number}){return wrapYaw(this.heading-p.headingY);}
 reset(){this.active=false;this.heading=0;}
}
