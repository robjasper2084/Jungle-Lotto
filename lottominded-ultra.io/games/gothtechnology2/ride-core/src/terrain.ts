export type Vec3={x:number;y:number;z:number};
export type SurfaceId='pavement'|'grass'|'brick'|'dirt'|'gravel'|'sand'|'metal'|'wood'|'ice';
export type GroundSample={height:number;normal:Vec3;surface:SurfaceId;offCourse:boolean};
export type ObstacleHit={distance:number;halfExtentX:number;halfExtentZ:number};
export type NavigationObstacle={id:string;x:number;y:number;z:number;radius:number;height:number;kind:string;vx:number;vz:number;/** Static geometry already checked by the terrain's swept ray query. */raycastSolid?:boolean};
export interface TerrainSampler {
  navigationObstacles?(x:number,z:number,radius:number):NavigationObstacle[];
  /** referenceY is the actor's current contact-plane height; omit for base terrain. */
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number):GroundSample;
  raycast(origin:Vec3,direction:Vec3,maxDistance:number):number|null;
  raycastObstacle(origin:Vec3,direction:Vec3,maxDistance:number,sweepHalfWidth?:number,sweepLateral?:Vec3,out?:ObstacleHit):number|null;
}
export function createGroundSample():GroundSample{return {height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false};}
