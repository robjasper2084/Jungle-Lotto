import * as T from 'three';
import type {ParkMap,ParkTerrain} from './terrain.ts';
import {addSunsetGarden} from './sunsetGarden.ts';
import {roadIndex} from './streetPlan.ts';
export const REFERENCE_PLACES=[
 {name:'Sunset Point',x:44,z:1497,radius:340},
 {name:'Fountain & Casino',x:440,z:1300,radius:250},
 {name:'Aquarium & gardens',x:1335,z:1230,radius:260},
 {name:'Belle Isle Beach',x:1885,z:257,radius:260},
 {name:'Yacht Club',x:2306,z:-226,radius:240},
 {name:'Nature Center',x:3127,z:-9,radius:280},
 {name:'Blue Heron Lagoon',x:3740,z:-180,radius:260}
] as const;
export async function addReferenceIsland(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const occupied=roadIndex(map.roads,true);
 const gardens=[await addSunsetGarden(scene,map,terrain,undefined,occupied)];
 for(const [i,place] of REFERENCE_PLACES.slice(1).entries()){
  gardens.push(await addSunsetGarden(scene,map,terrain,{...place,trees:0,seed:209585+i,shore:place.name!=='Belle Isle Beach'},occupied));
 }
 const eye=new T.Vector3();
 return{setQuality(q:string){gardens.forEach(g=>g.setQuality(q));},update(x:number,z:number,camera:T.Camera){
  camera.getWorldPosition(eye);gardens.forEach(g=>g.update(x,z,eye.x,eye.z));
 },stats:gardens.map(g=>g.stats)};
}
