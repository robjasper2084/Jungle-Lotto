import * as T from 'three';
import {createPose,type RidePose} from './controller.ts';
import {RideGhostTrack,readGhost,sampleGhost,GHOST_SECONDS,type GhostRun} from './rideGhost.ts';
type View={root:T.Object3D;apply(p:RidePose):void;dispose():void};
/** Shared free-ride ghost controls. Only one extra rig, created on explicit play. */
export class RideGhostView{
 readonly panel=document.createElement('section');private record=document.createElement('button');private play=document.createElement('button');private note=document.createElement('p');
 private run?:GhostRun;private track?:RideGhostTrack;private view?:View;private materials:T.Material[]=[];private rig='';private available=false;private clock=0;private pose=createPose();private uiAt=0;private key:string;
 constructor(readonly map:string,private scene:T.Scene,private create:(rig:string)=>View|undefined){
  this.key='saved-ride-ghost-v1:'+map;try{this.run=readGhost(localStorage.getItem(this.key),map);}catch{}
  this.panel.className='saved-ride-ghost';this.panel.innerHTML='<h3>Ghost rider</h3><p>Record up to two minutes, then ride beside your saved ghost. One saved run per map. Ghosts are translucent, cannot collide or shoot, and do not count as opponents.</p>';
  this.record.textContent='Record ghost';this.play.textContent='Ride with saved ghost';this.note.setAttribute('role','status');
  this.record.onclick=()=>{if(this.track){this.save();return;}if(!this.available)return;this.hide();this.uiAt=0;this.track=new RideGhostTrack();this.sync('Recording starts when you resume riding.');};
  this.play.onclick=()=>{if(this.view){this.hide();return;}if(!this.available||!this.run)return;if(this.run.rig!==this.rig){this.sync('Select the same rider and wheel as the saved run, or record a new ghost.');return;}const v=this.create(this.run.rig);if(!v){this.sync('Start a ride with this rider first.');return;}this.view=v;this.clock=0;v.root.name='Saved ghost · '+map;
   v.root.traverse(o=>{if((o as T.Light).isLight)o.visible=false;const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=false;mesh.receiveShadow=false;const tint=(m:T.Material)=>{const copy=m.clone();copy.transparent=true;copy.opacity=.32;copy.depthWrite=false;if('color'in copy)(copy as T.MeshStandardMaterial).color.set(0x7ce9e5);this.materials.push(copy);return copy;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(tint):tint(mesh.material);});this.scene.add(v.root);this.sync('Ghost follows its saved route. Resume riding to begin.');};
  const clear=document.createElement('button');clear.textContent='Clear saved ghost';clear.onclick=()=>{this.hide();this.track=undefined;this.run=undefined;try{localStorage.removeItem(this.key);}catch{}this.sync('Saved ghost cleared.');};
  this.panel.append(this.record,this.play,clear,this.note);this.panel.addEventListener('keydown',e=>e.stopPropagation());this.sync();
 }
 private sync(message?:string){this.record.textContent=this.track?'Save ghost':'Record ghost';this.record.disabled=!this.available&&!this.track;this.play.textContent=this.view?'Hide ghost':'Ride with saved ghost';this.play.disabled=!this.view&&(!this.run||!this.available||!!this.track);if(message)this.note.textContent=message;else this.note.textContent=this.run?'Saved run ready · '+this.run.frames.at(-1)![0].toFixed(1)+' seconds':'Record a ride to create your ghost.';}
 private save(){if(!this.track)return;const r=this.track.finish(this.map,this.rig);this.track=undefined;if(r.frames.length<2){this.sync('Ride a little longer before saving.');return;}this.run=r;try{localStorage.setItem(this.key,JSON.stringify(r));this.sync('Ghost saved on this device.');}catch{this.sync('Device storage is full. This ghost is available until the page closes.');}}
 private hide(){this.view?.dispose();this.view=undefined;this.materials.forEach(m=>m.dispose());this.materials=[];this.sync();}
 suspend(){if(!this.available)return;if(this.track)this.save();this.available=false;if(this.view)this.view.root.visible=false;this.sync();}
 update(dt:number,p:RidePose|undefined,rig:string,active:boolean,available:boolean){
  if(rig!==this.rig){this.save();this.hide();this.rig=rig;}if(this.available!==available){this.available=available;this.sync();}
  if(!available&&this.track)this.save();if(this.view)this.view.root.visible=available;
  if(!active||!p)return;
  if(this.track){this.track.step(dt,p);if(this.track.time>=GHOST_SECONDS)this.save();else if(this.track.time-this.uiAt>.5){this.uiAt=this.track.time;this.note.textContent='Recording ghost · '+Math.floor(this.track.time)+' / '+GHOST_SECONDS+' s';}}
  if(this.view&&this.run){this.clock+=Math.max(0,dt);if(this.clock>this.run.frames.at(-1)![0]){this.hide();this.sync('Ghost finished. Play it again from Settings.');}else {this.view.apply(sampleGhost(this.run,this.clock,this.pose));
   // Two nearly identical rigs at the starting line shimmer through each other.
   // Keep recording time moving, but reveal the ghost only after they separate.
   this.view.root.visible=available&&Math.hypot(this.pose.x-p.x,this.pose.y-p.y,this.pose.z-p.z)>.8;
  }}
 }
}
