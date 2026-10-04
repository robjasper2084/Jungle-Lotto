import type * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CommunityRide,LaneRoute,COMMUNITY_PACE} from './communityRide.ts';
import {CommunityView} from './cyclingView.ts';
import {communityPanel} from './communityPanel.ts';
import type {TerrainSampler,NavigationObstacle} from './terrain.ts';
/** Shared event presentation; routes, input, travel and crowd adapters stay in each host. */
export class CyclingSession {
  readonly ride:CommunityRide;readonly view:CommunityView;readonly ui:ReturnType<typeof communityPanel>;
  private uiClock=0;private savedRun=-1;
  constructor(readonly map:string,scene:T.Scene,assets:Map<string,GLTF>,terrain:TerrainSampler,route:LaneRoute,readonly player:()=>{x:number;y:number;z:number;speed:number},travel:()=>void,focus:()=>void){
    this.ride=new CommunityRide(route,terrain,COMMUNITY_PACE,4);this.view=new CommunityView(this.ride,assets);scene.add(this.view.root);this.view.root.visible=false;
    this.ui=communityPanel(map+' community ride',this.ride,player,travel,focus);this.ui.update(false);
  }
  update(dt:number,visible:boolean,paused:boolean,contacts:readonly NavigationObstacle[],vehicle:string){
    if(visible&&!paused){let remaining=Math.min(.1,Math.max(0,dt));while(remaining>0){const step=Math.min(remaining,1/60);this.ride.step(step,this.player(),contacts);remaining-=step;}}
    const p=this.player(),near=this.ride.riders.some(r=>Math.hypot(r.x-p.x,r.z-p.z)<90);if(visible&&near)this.view.update(true,paused?0:dt,p);else this.view.update(false);
    this.uiClock+=dt;if(this.uiClock>.1||!visible){this.uiClock=0;this.ui.update(visible);}
    if(this.ride.completed&&this.savedRun!==this.ride.runId){this.savedRun=this.ride.runId;try{localStorage.setItem('digital-static-community-v1-'+this.map+'-'+vehicle,JSON.stringify({completed:true,seconds:Math.round(this.ride.elapsed),at:Date.now(),rules:1}));}catch{}}
  }
}
