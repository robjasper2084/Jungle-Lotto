import * as T from 'three';
import {SurfaceEffects} from './rideEffects.ts';
import type {EffectPatch} from './effectRules.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import type {Hero} from './actors.ts';
import type {CompanionView} from './companionView.ts';
import type {RidePose} from './controller.ts';
/** Ground-following contact shadows plus bounded, surface-aware tire effects. */
export class ContactEffects {
 private shadows:T.Mesh[]=[];readonly surface:SurfaceEffects;private sample=createGroundSample();
 private point=new T.Vector3();private up=new T.Vector3(0,0,1);private normal=new T.Vector3();
 private terrain:TerrainSampler;
 constructor(scene:T.Scene,terrain:TerrainSampler,patches:readonly EffectPatch[]=[]){
  this.surface=new SurfaceEffects(scene,terrain,patches);
  this.terrain=terrain;const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,3,32,32,32);
  gradient.addColorStop(0,'rgba(10,19,18,.55)');gradient.addColorStop(.45,'rgba(10,19,18,.3)');gradient.addColorStop(1,'rgba(10,19,18,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new T.CanvasTexture(c);
  const geometry=new T.PlaneGeometry(1,1);
  for(let i=0;i<7;i++){const m=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,transparent:true,opacity:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.renderOrder=2;m.visible=false;scene.add(m);this.shadows.push(m);}
 }
 reset(){this.surface.reset();this.shadows.forEach(m=>m.visible=false);}
 step(dt:number,p:RidePose,grounded:boolean){this.surface.step(dt,p,grounded);}
 land(p:RidePose,impact:number){return this.surface.land(p,impact);}
 update(_dt:number,p:RidePose,hero:Hero,dog:CompanionView|undefined,dogEnabled:boolean,_active:boolean){
  const place=(i:number,point:T.Vector3,sx:number,sz:number,visible=true)=>{
   const m=this.shadows[i],g=this.terrain.sampleGround(point.x,point.z,this.sample,p.y),lift=Math.max(0,point.y-g.height);
   m.visible=visible&&!g.offCourse&&lift<1.4;if(!m.visible)return;
   m.position.set(point.x,g.height+.045,point.z);this.normal.set(g.normal.x,g.normal.y,g.normal.z).normalize();m.quaternion.setFromUnitVectors(this.up,this.normal);m.rotateZ(-p.headingY);
   m.scale.set(sx*(1+lift*.25),sz*(1+lift*.25),1);(m.material as T.MeshBasicMaterial).opacity=Math.max(0,1-lift/1.4);
  };
  place(0,this.point.set(p.x,p.y,p.z),.5,.8,p.crashBlend<.01);
  hero.legs.forEach((leg,i)=>place(i+1,leg.foot.getWorldPosition(this.point),.25,.45));
  if(dog)dog.paws.forEach((paw,i)=>place(i+3,paw.foot.getWorldPosition(this.point),.25,.29,dogEnabled));
  else for(let i=3;i<7;i++)this.shadows[i].visible=false;
  this.surface.render();
 }
 dispose(){
  (this.shadows[0]?.material as T.MeshBasicMaterial).map?.dispose();
  this.shadows[0]?.geometry.dispose();for(const m of this.shadows){m.removeFromParent();(m.material as T.Material).dispose();}
  this.surface.dispose();
 }
}
