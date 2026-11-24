import {createPose,type RidePose} from '../../runtime/ride-core/src/controller.ts';
import {footCycleDistance} from '../../runtime/ride-core/src/onFootGait.ts';

export type LocationDisplayPoint={x:number;z:number;headingY:number|null;speedMps:number};

/** A local display pose, deliberately separate from RideCore and its saved/online state.
 * Real location never teleports a simulated vehicle or changes gameplay progress. */
export class LocationPresentation {
 private pose=createPose();

 begin(parked:Readonly<RidePose>){
  this.pose=createPose();
  Object.assign(this.pose,{footMode:2,footBlend:1,headingY:parked.headingY,
   parkX:parked.x,parkY:parked.y,parkZ:parked.z,parkHeading:parked.headingY});
 }

 update(point:LocationDisplayPoint,groundHeight:number,seconds:number):RidePose|null{
  if(![point.x,point.z,groundHeight,point.speedMps,seconds].every(Number.isFinite)||
   point.headingY!==null&&!Number.isFinite(point.headingY)||seconds<0)return null;
  const p=this.pose,dt=Math.min(seconds,.1),speed=Math.max(0,Math.min(point.speedMps,5.4));
  p.x=point.x;p.y=groundHeight;p.z=point.z;
  if(point.headingY!==null)p.headingY=point.headingY;
  p.speed=speed;p.velocityX=Math.sin(p.headingY)*speed;p.velocityZ=Math.cos(p.headingY)*speed;
  p.footTime+=dt;p.footCycle+=speed*dt/footCycleDistance(speed);p.footPhase=p.footCycle%1;
  return p;
 }
}
