import {MAP_ORIGIN,toMap} from './geo-profile.ts';
import type {DetroitWorld} from './world.ts';
import type {TerrainSampler,GroundSample,Vec3,ObstacleHit,NavigationObstacle} from './terrain.ts';
/** Metre-scale game coordinates, anchored at the Gratiot overpass trail center.
 * The source cartography and physics storage retain their shared map frame;
 * all simulation queries cross this reversible reflection/translation boundary. */
export class GeoTerrain implements TerrainSampler{
  readonly mapWorld:DetroitWorld;
  extraActors:()=>NavigationObstacle[]=()=>[];
  constructor(mapWorld:DetroitWorld){this.mapWorld=mapWorld;}
  mountedClear(p:Vec3,heading:number,radius:number,height:number){return this.mapWorld.mountedClear(toMap(p.x,p.y,p.z),-heading,radius,height);}
  reserveRecoverySpace(p:Vec3,radius:number,height:number){this.mapWorld.reserveRecoverySpace(toMap(p.x,p.y,p.z),radius,height);}
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){this.mapWorld.sampleGround(MAP_ORIGIN.x-x,z+MAP_ORIGIN.z,out,referenceY===undefined?undefined:referenceY+MAP_ORIGIN.y);out.height-=MAP_ORIGIN.y;out.normal.x*=-1;return out;}
  navigationObstacles(x:number,z:number,radius:number){return this.mapWorld.navigationObstacles(MAP_ORIGIN.x-x,z+MAP_ORIGIN.z,radius).map<NavigationObstacle>(o=>({...o,x:MAP_ORIGIN.x-o.x,y:o.y-MAP_ORIGIN.y,z:o.z-MAP_ORIGIN.z,vx:-o.vx,onImpact:o.onImpact?impact=>o.onImpact!({...impact,vx:-impact.vx}):undefined})).concat(this.extraActors().filter(o=>Math.hypot(o.x-x,o.z-z)<radius+o.radius));}
  raycast(origin:Vec3,direction:Vec3,maxDistance:number){return this.mapWorld.raycast(toMap(origin.x,origin.y,origin.z),{x:-direction.x,y:direction.y,z:direction.z},maxDistance);}
  raycastObstacle(origin:Vec3,direction:Vec3,maxDistance:number,sweepHalfWidth=0,sweepLateral?:Vec3,out?:ObstacleHit){return this.mapWorld.raycastObstacle(toMap(origin.x,origin.y,origin.z),{x:-direction.x,y:direction.y,z:direction.z},maxDistance,sweepHalfWidth,sweepLateral?{x:-sweepLateral.x,y:sweepLateral.y,z:sweepLateral.z}:undefined,out);}
}
