import {MAP_ORIGIN,toMap} from './geo-profile.ts';
import {indoorRideArea} from './indoorRiding.ts';
import type {DetroitWorld} from './world.ts';
import type {TerrainSampler,GroundSample,Vec3,ObstacleHit,NavigationObstacle} from './terrain.ts';
/** Metre-scale game coordinates, anchored at the Gratiot overpass trail center.
 * The source cartography and physics storage retain their shared map frame;
 * all simulation queries cross this reversible reflection/translation boundary. */
export class GeoTerrain implements TerrainSampler{
  readonly mapWorld:DetroitWorld;
  extraActors:()=>NavigationObstacle[]=()=>[];
  constructor(mapWorld:DetroitWorld,private passThrough?:(actor:NavigationObstacle)=>boolean,private rayOnlyPassThrough?:(actor:NavigationObstacle)=>boolean){this.mapWorld=mapWorld;}
  riderProtectionAt(x:number,z:number){const p=toMap(x,0,z);return !!indoorRideArea(p.x,p.z);}
  withActorPassThrough(predicate:(actor:NavigationObstacle)=>boolean){const view=new GeoTerrain(this.mapWorld,o=>!!this.passThrough?.(o)||predicate(o),this.rayOnlyPassThrough);view.extraActors=()=>this.extraActors();return view;}
  /** The rider controller sweeps character envelopes itself. Keep those actors
   * in navigation/recovery while avoiding a second box-shaped collision. */
  withActorRayPassThrough(predicate:(actor:NavigationObstacle)=>boolean){const view=new GeoTerrain(this.mapWorld,this.passThrough,o=>!!this.rayOnlyPassThrough?.(o)||predicate(o));view.extraActors=()=>this.extraActors();return view;}
  mountedClear(p:Vec3,heading:number,radius:number,height:number){return this.mapWorld.mountedClear(toMap(p.x,p.y,p.z),-heading,radius,height,this.passThrough);}
  reserveRecoverySpace(p:Vec3,radius:number,height:number){this.mapWorld.reserveRecoverySpace(toMap(p.x,p.y,p.z),radius,height);}
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){this.mapWorld.sampleGround(MAP_ORIGIN.x-x,z+MAP_ORIGIN.z,out,referenceY===undefined?undefined:referenceY+MAP_ORIGIN.y);out.height-=MAP_ORIGIN.y;out.normal.x*=-1;return out;}
  waterAt(x:number,z:number,referenceY:number){return this.mapWorld.waterAt(MAP_ORIGIN.x-x,z+MAP_ORIGIN.z,referenceY+MAP_ORIGIN.y);}
  navigationObstacles(x:number,z:number,radius:number){return this.mapWorld.navigationObstacles(MAP_ORIGIN.x-x,z+MAP_ORIGIN.z,radius).map<NavigationObstacle>(o=>({...o,x:MAP_ORIGIN.x-o.x,y:o.y-MAP_ORIGIN.y,z:o.z-MAP_ORIGIN.z,vx:-o.vx,onImpact:o.onImpact?impact=>o.onImpact!({...impact,vx:-impact.vx}):undefined})).concat(this.extraActors().filter(o=>Math.hypot(o.x-x,o.z-z)<radius+o.radius)).filter(o=>!this.passThrough?.(o));}
  raycast(origin:Vec3,direction:Vec3,maxDistance:number){return this.mapWorld.raycast(toMap(origin.x,origin.y,origin.z),{x:-direction.x,y:direction.y,z:direction.z},maxDistance);}
  raycastObstacle(origin:Vec3,direction:Vec3,maxDistance:number,sweepHalfWidth=0,sweepLateral?:Vec3,out?:ObstacleHit){return this.mapWorld.raycastObstacle(toMap(origin.x,origin.y,origin.z),{x:-direction.x,y:direction.y,z:direction.z},maxDistance,sweepHalfWidth,sweepLateral?{x:-sweepLateral.x,y:sweepLateral.y,z:sweepLateral.z}:undefined,out,o=>!!this.passThrough?.(o)||!!this.rayOnlyPassThrough?.(o));}
}
