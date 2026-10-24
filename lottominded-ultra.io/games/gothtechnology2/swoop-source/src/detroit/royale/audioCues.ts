import type {TerrainSampler,Vec3} from '../../../../ride-core/src/terrain.ts';
/** Camera-relative right/left bearing. No sound reveals actors absent from a snapshot. */
export function spatialCue(dx:number,dz:number,heading:number){const distance=Math.hypot(dx,dz);return {gain:distance>100?0:1/(1+distance/16),pan:Math.max(-.85,Math.min(.85,(dx*Math.cos(heading)-dz*Math.sin(heading))/Math.max(4,distance)))};}
export {wheelCue} from '../../../../ride-core/src/rideSoundCues.ts';

export function environmentalCue(from:Vec3,to:Vec3,heading:number,terrain?:TerrainSampler){
 const dx=from.x-to.x,dy=from.y-to.y,dz=from.z-to.z,distance=Math.hypot(dx,dy,dz),base=spatialCue(dx,dz,heading);
 const wall=distance>.2?terrain?.raycastObstacle(to,{x:dx/distance,y:dy/distance,z:dz/distance},distance,.03):null;
 const occluded=wall!=null&&wall<distance-.2,behind=dx*Math.sin(heading)+dz*Math.cos(heading)<0;
 return{gain:base.gain*(occluded?.36:1)*(behind?.85:1),pan:base.pan,filter:occluded?.3:1,occluded,elevation:dy};
}
