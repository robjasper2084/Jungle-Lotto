import type {NavigationObstacle} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/terrain.ts';
import {toSourceMap,toSwoopMapDirection,SWOOP_MIN_SCALE} from './geo.ts';

/** Read the existing Belle companion; no model, controller or body is created. */
export type CompanionPose={x:number;y:number;z:number;heading:number;speed:number};
export type CompanionProvider=()=>CompanionPose|null|undefined;

let provider:CompanionProvider|undefined;
const velocity={x:0,y:0,z:0};
const obstacle:NavigationObstacle={id:'companion',x:0,y:0,z:0,radius:.36/SWOOP_MIN_SCALE,height:.85,kind:'dog',vx:0,vz:0};
const actors:NavigationObstacle[]=[];

/** The preview getter supplies a pose only while the existing ground dog is
 * visible. Disabling the dog, riding in the Cadillac, or hiding its view removes
 * its crowd envelope on the next query. An old cleanup cannot detach a newer
 * registration after an application lifecycle transition. */
export function registerCompanionProvider(next:CompanionProvider){
  provider=next;
  return ()=>{if(provider===next){provider=undefined;actors.length=0;}};
}

/** Source crowd simulation consumes this reused snapshot synchronously. Position
 * and velocity both cross the Belle -> source MAP boundary exactly once. Keep
 * the source game's .36m/.85m dog envelope, conservatively projected in XZ. */
export function sourceCompanionObstacles():NavigationObstacle[]{
  const dog=provider?.();
  if(!dog||!Number.isFinite(dog.x)||!Number.isFinite(dog.y)||!Number.isFinite(dog.z)||!Number.isFinite(dog.heading)||!Number.isFinite(dog.speed)){
    actors.length=0;return actors;
  }
  toSourceMap(dog.x,dog.y,dog.z,obstacle);
  toSwoopMapDirection(Math.sin(dog.heading)*dog.speed,0,Math.cos(dog.heading)*dog.speed,velocity);
  obstacle.vx=velocity.x;obstacle.vz=velocity.z;
  actors[0]=obstacle;actors.length=1;return actors;
}
