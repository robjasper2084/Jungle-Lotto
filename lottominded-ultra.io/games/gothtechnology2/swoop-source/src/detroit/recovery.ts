import {createGroundSample,type TerrainSampler,type Vec3,type NavigationObstacle} from './terrain.ts';
export type MountedVolume={radius:number;height:number};
export type RideSpawn={position:Vec3;headingY:number};
export const DEFAULT_MOUNTED_VOLUME:MountedVolume={radius:.48,height:2.15};
export const RECOVERY_SPACE_SECONDS=1.2;

/** Same vertical envelope and swept clearance for recovery and traffic activation. */
export function actorBlocksMountedSpace(o:NavigationObstacle,p:Vec3,volume:MountedVolume,seconds=RECOVERY_SPACE_SECONDS){
 if(o.y>p.y+volume.height||o.y+o.height<p.y+.1)return false;
 const dx=o.x-p.x,dz=o.z-p.z,v2=o.vx*o.vx+o.vz*o.vz;
 const t=v2?Math.max(0,Math.min(seconds,-(dx*o.vx+dz*o.vz)/v2)):0;
 return Math.hypot(dx+o.vx*t,dz+o.vz*t)<volume.radius+o.radius+.35;
}

/** Full mounted envelope plus tyre support and a short prediction of moving actors. */
export function clearMountedPosition(terrain:TerrainSampler,p:Vec3,heading:number,volume:MountedVolume){
 const sample=createGroundSample(),g=terrain.sampleGround(p.x,p.z,sample,p.y);
 if(g.offCourse||g.normal.y<.91||Math.abs(g.height-p.y)>.12)return false;
 for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const edge=terrain.sampleGround(p.x+x*volume.radius,p.z+z*volume.radius,createGroundSample(),p.y);
  if(edge.offCourse||Math.abs(edge.height-p.y)>.22)return false;
 }
 if(terrain.mountedClear){if(!terrain.mountedClear(p,heading,volume.radius,volume.height))return false;}
 else for(const y of [.2,volume.height*.5,volume.height-.1])for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  if(terrain.raycastObstacle({x:p.x,y:p.y+y,z:p.z},{x:Math.sin(a),y:0,z:Math.cos(a)},volume.radius,.1)!==null)return false;
 }
 for(const o of terrain.navigationObstacles?.(p.x,p.z,12)??[]){
  if(actorBlocksMountedSpace(o,p,volume))return false;
 }
 return true;
}
export function safeRecovery(terrain:TerrainSampler,preferred:RideSpawn,volume=DEFAULT_MOUNTED_VOLUME):RideSpawn|undefined{
 const s=Math.sin(preferred.headingY),c=Math.cos(preferred.headingY);
 // Try behind the last clear point before lateral shoulders. Bounded: 35 candidates / 8 m.
 for(const back of [0,1.5,3,5,8])for(const side of [0,-1.2,1.2,-2.4,2.4,-3.6,3.6]){
  const x=preferred.position.x-s*back+c*side,z=preferred.position.z-c*back-s*side;
  const y=terrain.sampleGround(x,z,createGroundSample(),preferred.position.y).height;
  const position={x,y,z};if(clearMountedPosition(terrain,position,preferred.headingY,volume))return {position,headingY:preferred.headingY};
 }
 return undefined;
}
