import {CinematicTerrain} from './cinematicTerrain.ts';
import * as T from 'three';
import {installRiderPresentation} from '../../runtime/elmwood-source/src/detroit/riding/riderPresentation.ts';
import {articulateEuc,presentationBudget} from './presentationPolicy.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {SkyReflections} from './skyReflections.ts';
import {SkyAircraft} from './skyAircraft.ts';
/** Lifecycle owner for Belle-only render enhancements. Physics never enters here. */
export class BroaderPresentation {
 private renderer:T.WebGLRenderer;private clock=0;private liveClock=0;private reduced=false;private running=false;private disposed=false;
 private terrain:CinematicTerrain;private atmosphere:WorldAtmosphere;private reflections:SkyReflections;private aircraft:SkyAircraft;private restoreRider:()=>void;
 constructor(scene:T.Scene,renderer:T.WebGLRenderer,sky:T.ShaderMaterial,noise:T.Texture){
  this.renderer=renderer;this.terrain=new CinematicTerrain(scene);this.atmosphere=new WorldAtmosphere(scene,noise);this.reflections=new SkyReflections(scene,renderer,sky);this.aircraft=new SkyAircraft(scene);
  this.restoreRider=installRiderPresentation((target,pose)=>articulateEuc(target,pose,this.clock,this.reduced));
  window.addEventListener('pagehide',this.hide);
 }
 private hide=(event:PageTransitionEvent)=>{if(!event.persisted)this.dispose();};
 tick(seconds:number,running:boolean,reduced:boolean){
  // Online sky time may keep advancing while this client is paused; decorative
  // animation and probe work still obey this client's visible foreground state.
  const live=running&&!document.hidden&&document.hasFocus()&&document.getElementById('pause')?.textContent!=='Resume'&&!document.querySelector('dialog[open]');
  this.running=live;this.reduced=reduced;if(live&&Number.isFinite(seconds))this.liveClock+=Math.max(0,Math.min(.1,seconds));if(live&&!reduced&&Number.isFinite(seconds))this.clock+=Math.max(0,Math.min(.1,seconds));
 }
 update(hour:number,coverage:number,day:number,overcast:number,direction:T.Vector3,quality:string,preview:boolean,externalReflections=false){
  if(this.disposed)return;const xr=this.renderer.xr.isPresenting,budget=presentationBudget(quality,xr);
  this.atmosphere.update(this.clock,direction,coverage,day,overcast,quality,this.reduced,xr);
  this.aircraft.update(this.clock,day,!preview&&!this.reduced&&budget.aircraft);
  if(!externalReflections)this.reflections.update(this.liveClock,hour,coverage,quality,!preview&&this.running);
 }
 prepareReflections(hour:number,coverage:number,quality:string){this.reflections.prepare(this.liveClock,hour,coverage,quality);}
 protectStartup(){this.reflections.protect();}
 observeFrame(frameMs:number,eligible:boolean){this.reflections.observe(frameMs,eligible);}
 get stats(){return{atmosphere:this.atmosphere.stats,reflections:this.reflections.stats};}
 dispose(){if(this.disposed)return;this.disposed=true;window.removeEventListener('pagehide',this.hide);this.restoreRider();this.aircraft.dispose();this.atmosphere.dispose();this.terrain.dispose();this.reflections.dispose();}
}
