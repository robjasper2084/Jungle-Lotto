import type {TerrainSampler,Vec3} from './terrain.ts';
/** Overlapping body probes cover the rider above the wheel; the bottom probe
 * still clears ordinary curbs. A single axle-height sphere misses raised slabs. */
export function mountedClearance(terrain:TerrainSampler,feet:Vec3,direction:Vec3,distance:number,radius=.28,crouch=0){
 let nearest:number|null=null;
 for(const height of [.65,1.15-crouch*.2,1.65-crouch*.4]){
  const hit=terrain.raycastObstacle({x:feet.x,y:feet.y+height,z:feet.z},direction,nearest===null?distance:Math.min(distance,nearest+.001),radius);
  if(hit!==null)nearest=Math.min(nearest??Infinity,hit);
 }
 return nearest;
}
