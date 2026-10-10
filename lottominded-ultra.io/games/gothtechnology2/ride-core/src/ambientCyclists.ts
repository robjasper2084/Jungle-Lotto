import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CommunityView} from './cyclingView.ts';
import type {TerrainSampler,NavigationObstacle} from './terrain.ts';
import type {RoutePoint} from './communityRide.ts';
import {AmbientCyclistTraffic} from './ambientCyclistTraffic.ts';
export {cyclistCircuit,packStarts,AMBIENT_CYCLIST_PACE,AmbientCyclistTraffic} from './ambientCyclistTraffic.ts';
/** Rendering wrapper: only nearby cyclists need articulated models each frame. */
export class AmbientCyclistPacks {
 readonly traffic:AmbientCyclistTraffic;readonly views:CommunityView[]=[];private reportAt=0;
 get rides(){return this.traffic.rides;}get starts(){return this.traffic.starts;}
 constructor(scene:T.Scene,assets:Map<string,GLTF>,terrain:TerrainSampler,points:readonly RoutePoint[],seed?:number){
  this.traffic=new AmbientCyclistTraffic(terrain,points,seed);
  for(const [pack,ride]of this.rides.entries()){const view=new CommunityView(ride,assets);view.root.name='Cyclist pack '+(pack+1)+' · 10 riders';view.root.visible=false;scene.add(view.root);this.views.push(view);}
 }
 restart(seed?:number,observer?:{x:number;z:number}){this.traffic.restart(seed,observer);}
 update(dt:number,observer:{x:number;z:number},visible:boolean,paused=false,contacts:readonly NavigationObstacle[]=[]){
  this.views.forEach(v=>v.root.visible=visible);if(!visible)return;
  this.traffic.update(dt,observer,paused,contacts);this.views.forEach(v=>v.update(true,paused?0:dt,observer));
 }
 report(canvas:HTMLCanvasElement,dt:number){this.reportAt+=dt;if(this.reportAt<.5)return;this.reportAt=0;canvas.dataset.ambientPacks=JSON.stringify(this.traffic.telemetry());}
 obstacles(){return this.traffic.obstacles();}
 dispose(){this.views.forEach(v=>v.dispose());}
}
