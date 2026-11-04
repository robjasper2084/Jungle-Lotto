import {RideCore,type RideSpawn} from '../../runtime/ride-core/src/ridecore.ts';
import {createGroundSample} from '../../runtime/ride-core/src/terrain.ts';
import {ParkTerrain} from './terrain.ts';
/** Bounded rescue search, requested explicitly by Recover. Never changes collision geometry. */
export function islandRecoveryPoint(terrain:ParkTerrain,x:number,y:number,z:number,headingY:number):RideSpawn|null {
 const sample=createGroundSample();
 const safe=(px:number,pz:number,rescueHeading=headingY)=>{
  terrain.sampleGround(px,pz,sample,y);
  if(sample.offCourse||sample.normal.y<.88||terrain.obstructed(px,pz,.85))return null;
  // Do not move a rider through a bridge deck or off a raised gallery floor.
  if(Math.abs(sample.height-y)>1.2)return null;
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const hit=terrain.raycastObstacle({x:px,y:sample.height+1,z:pz},{x:Math.sin(angle),y:0,z:Math.cos(angle)},.7,.28);
   if(hit!==null)return null;
  }
  const forward=terrain.raycastObstacle({x:px,y:sample.height+1,z:pz},{x:Math.sin(rescueHeading),y:0,z:Math.cos(rescueHeading)},3,.35);
  if(forward!==null)return null;
  return {position:{x:px,y:sample.height,z:pz},headingY:rescueHeading};
 };
 const here=safe(x,z);if(here)return here;
 for(const radius of [1.5,2.5,4,6,9,13,18,26,36,48]){
  for(const offset of [0,.25,-.25,.5,-.5,.75,-.75,1,1.25,-1.25,1.5,-1.5,1.75,-1.75,2]){
   const a=headingY+Math.PI+offset*Math.PI/2,p=safe(x+Math.sin(a)*radius,z+Math.cos(a)*radius,a);if(p)return p;
  }
 }
 return null;
}
export function prepareIslandRecovery(core:RideCore,terrain:ParkTerrain):boolean {
 const p=core.current;
 // Keep the normal approach, lift and remount animation when freely on foot.
 if(p.footMode>0&&!core.controller.crashed&&!terrain.obstructed(p.x,p.z,.4)&&terrain.land(p.x,p.z,p.y))return false;
 const target=islandRecoveryPoint(terrain,p.x,p.y,p.z,p.headingY);
 if(!target)return false;
 core.controller.setRecoveryPoint(target);return true;
}
