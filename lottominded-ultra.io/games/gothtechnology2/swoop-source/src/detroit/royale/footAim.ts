export const wrapYaw=(yaw:number)=>Math.atan2(Math.sin(yaw),Math.cos(yaw));
/** Keep aim in world space on foot; authoritative heading follows this input. */
export class FootAim {
 active=false;heading=0;private steering=false;private bodyHeading=0;
 sync(p:{footMode:number;headingY:number}|undefined){
  const active=p?.footMode===2;
  if(active&&!this.active)this.heading=p!.headingY;
  else if(active&&this.steering)this.heading=wrapYaw(this.heading+wrapYaw(p!.headingY-this.bodyHeading));
  if(p)this.bodyHeading=p.headingY;
  this.active=active;
 }
 /** Normal movement uses the shared turn/stride motor with any held item.
  * Only active combat locks facing to aim and turns side input into strafing. */
 commandYaw(i:{aimMode:number;fire:boolean;lean:number;brawl:boolean}){
  this.steering=this.active&&!i.aimMode&&!i.fire&&!i.lean&&!i.brawl;
  return this.active&&!this.steering?this.heading:null;
 }
 turn(delta:number){if(Number.isFinite(delta))this.heading=wrapYaw(this.heading+delta);}
 relative(p:{headingY:number}){return wrapYaw(this.heading-p.headingY);}
 reset(){this.active=this.steering=false;this.heading=this.bodyHeading=0;}
}
