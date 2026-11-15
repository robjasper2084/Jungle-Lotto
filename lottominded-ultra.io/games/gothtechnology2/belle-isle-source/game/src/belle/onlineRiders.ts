import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
import {HUMAN_PROFILE} from '../../runtime/ride-core/src/profiles.ts';
import {applySlideSeat} from './slideSeat.ts';
import type {ParkTerrain} from './terrain.ts';
import type {BelleOnlineRooms} from './onlineRooms.ts';
import {PLAYER_COLORS} from './onlineProtocol.ts';
import {authoredChoice} from './vehicles/choices.ts';
import {createVehicleModel,type VehicleModel} from './vehicles/models.ts';
type Remote={view:ThreeRiderView;label:T.Sprite;marker:T.Mesh;hover?:T.Object3D;last:number;color:string;model?:VehicleModel;selection?:string;generation?:number;loading?:boolean;retryAt?:number;closed?:boolean};
export class OnlineRiders{
 private riders=new Map<string,Remote>();private hoverAsset?:GLTF;private hoverLoading?:Promise<void>;private ring=new T.RingGeometry(.65,.73,24);
 private lastDiagnostics=0;
 constructor(private scene:T.Scene,private terrain:ParkTerrain,private rider:GLTF,private wheel:GLTF,private prepare:(model:T.Object3D)=>Promise<unknown>=async()=>{}){}
 update(online:BelleOnlineRooms,now:number,x:number,z:number){
  const ids=new Set(online.members.map(m=>m.id));for(const [id,r]of this.riders)if(!ids.has(id)){r.closed=true;r.model?.dispose();r.view.dispose();r.hover?.removeFromParent();r.label.removeFromParent();r.label.material.map?.dispose();r.label.material.dispose();r.marker.removeFromParent();(r.marker.material as T.Material).dispose();this.riders.delete(id);}
  let created=false;
  for(const [i,m]of online.members.entries()){
   if(m.id===online.self)continue;const sample=online.buffers.get(m.id)?.sample(now),distance=sample?Math.hypot(sample.pose.x-x,sample.pose.z-z):Infinity;let r=this.riders.get(m.id);
   if(!r&&sample&&distance<350&&!created){created=true;const view=new ThreeRiderView(this.rider,this.wheel,this.terrain,{...HUMAN_PROFILE,id:'DS_Armored_Rider_01'});view.root.traverse(o=>{if((o as T.Mesh).isMesh)(o as T.Mesh).castShadow=false;});const c=document.createElement('canvas');c.width=384;c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle='#071d26dd';ctx.fillRect(0,0,384,64);ctx.fillStyle=PLAYER_COLORS[i];ctx.fillRect(0,0,8,64);ctx.font='bold 26px system-ui';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.name,192,32,360);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const label=new T.Sprite(new T.SpriteMaterial({map,depthTest:true,depthWrite:false}));label.scale.set(2.4,.4,1);const marker=new T.Mesh(this.ring,new T.MeshBasicMaterial({color:PLAYER_COLORS[i],side:T.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;r={view,label,marker,last:0,color:PLAYER_COLORS[i]};this.riders.set(m.id,r);this.scene.add(view.root,label,marker);}
   if(!r)continue;if(r.color!==PLAYER_COLORS[i]){r.color=PLAYER_COLORS[i];(r.marker.material as T.MeshBasicMaterial).color.set(r.color);const map=r.label.material.map!,c=map.image as HTMLCanvasElement,ctx=c.getContext('2d')!;ctx.fillStyle=r.color;ctx.fillRect(0,0,8,64);map.needsUpdate=true;}const visible=!!sample&&distance<450;r.view.root.visible=visible&&sample!.mode!=='hover';r.label.visible=r.marker.visible=visible;if(r.hover)r.hover.visible=visible&&sample!.mode==='hover';if(r.model)r.model.root.visible=visible&&sample?.mode==='hover';if(!visible||!sample)continue;
   const p=sample.pose;r.label.position.set(p.x,p.y+(sample.vehicle==='corleo'?2.4:2.6),p.z);r.marker.position.set(p.x,p.y+.025,p.z);
   const choice=sample.mode==='hover'?authoredChoice(sample):undefined;
   const selection=choice?JSON.stringify(choice):'';
   if(selection!==r.selection){r.selection=selection;r.generation=(r.generation??0)+1;r.model?.dispose();r.model=undefined;r.loading=false;r.retryAt=0;}
   if(choice){
    r.view.root.visible=false;if(r.hover)r.hover.visible=false;
    if(!r.model&&!r.loading&&now>=(r.retryAt??0)){r.loading=true;const remote=r,generation=r.generation;void createVehicleModel(choice).then(async model=>{if(remote.closed||remote.generation!==generation){model.dispose();return;}try{await this.prepare(model.root);}catch(error){model.dispose();throw error;}if(remote.closed||remote.generation!==generation){model.dispose();return;}remote.model=model;remote.loading=false;this.scene.add(model.root);}).catch(error=>{if(remote.closed||remote.generation!==generation)return;remote.loading=false;remote.retryAt=performance.now()+10000;console.error('Remote vehicle failed to load',error);});}
    if(r.model){r.model.root.visible=true;r.model.update({x:p.x,y:p.y,z:p.z,heading:p.headingY,pitch:p.groundPitch,roll:p.groundRoll,speed:p.speed,lift:0,corleoAction:sample.corleoAction,corleoTime:sample.corleoTime,corleoPhase:sample.corleoPhase,rpm:choice.vehicle==='jetson'?Math.min(1,Math.max(0,(p.y-this.terrain.height(p.x,p.z))/.8)):0},Math.min(.1,(now-r.last)/1000),true,Math.min(1,Math.abs(p.speed)/21),sample.energy??1,sample.lights??true,sample.brake??false);}r.last=now;continue;
   }
   if(sample.mode==='hover'){
    if(!this.hoverAsset&&!this.hoverLoading)this.hoverLoading=new GLTFLoader().loadAsync('./belle/vehicles/hero-hoverbike.glb').then(asset=>{this.hoverAsset=asset;}).catch(()=>{});
    if(!r.hover&&this.hoverAsset){r.hover=clone(this.hoverAsset.scene);const clip=this.hoverAsset.animations.find(a=>a.name.includes('Ride_Steer'));if(clip){const mix=new T.AnimationMixer(r.hover);mix.clipAction(clip).play();mix.setTime(clip.duration*.5);}r.hover.traverse(o=>{if(o.name==='Hero_FPVArms')o.visible=false;if((o as T.Mesh).isMesh)(o as T.Mesh).castShadow=false;});this.scene.add(r.hover);}
    if(r.hover){r.hover.visible=true;r.hover.position.set(p.x,p.y,p.z);r.hover.rotation.set(0,p.headingY,0);}continue;
   }
   if(distance>140&&now-r.last<100)continue;r.last=now;r.view.apply(p);if(sample.mode==='slide'&&sample.seat>0)applySlideSeat(r.view,p.headingY,sample.seat);
  }
  if(now-this.lastDiagnostics>250){this.lastDiagnostics=now;const profile=document.getElementById('profile');if(profile)profile.dataset.onlineModels=JSON.stringify([...this.riders].map(([id,r])=>({id,choice:r.model?.choice,visible:r.model?.root.visible??false,position:r.model?.root.position.toArray(),instance:r.model?.root.uuid,corleoAction:r.model?.root.userData.corleoAction,corleoTime:r.model?.root.userData.corleoTime,corleoPhase:r.model?.root.userData.corleoPhase})));}
 }
}
