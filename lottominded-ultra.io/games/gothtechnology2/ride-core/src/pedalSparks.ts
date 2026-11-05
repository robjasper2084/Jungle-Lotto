import * as T from 'three';
import type {RidePose} from './controller.ts';

type ContactPose=Pick<RidePose,'scrape'|'scrapeHard'|'scrapeX'|'scrapeY'|'scrapeZ'|'velocityX'|'velocityZ'|'speed'|'footMode'|'crashBlend'|'airHeight'>;
const CAPACITY=96;

/** One reusable draw call per scraping wheel, driven by physical pedal contact. */
export class PedalSparks {
 private positions=new Float32Array(CAPACITY*6);
 private colors=new Float32Array(CAPACITY*6);
 private velocity=new Float32Array(CAPACITY*3);
 private age=new Float32Array(CAPACITY);
 private lifetime=new Float32Array(CAPACITY);
 private geometry=new T.BufferGeometry();
 private next=0;private spawn=0;private live=0;private disposed=false;
 readonly mesh:T.LineSegments;
 get count(){return this.live;}
 constructor(scene:T.Scene){
  this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
  this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,3).setUsage(T.DynamicDrawUsage));
  this.mesh=new T.LineSegments(this.geometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  this.mesh.name='Pedal contact sparks';this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
 }
 update(dt:number,p:ContactPose,active:boolean,reducedMotion=false){
  if(this.disposed)return;
  if(!active||reducedMotion||!Number.isFinite(dt)){this.reset();return;}
  if(dt<=0)return;
  // Drop elapsed background time rather than emitting a burst after a stall.
  dt=Math.min(dt,.05);
  for(let i=0;i<CAPACITY;i++)if(this.age[i]>0){
   this.age[i]=Math.max(0,this.age[i]-dt);
   const j=i*6,v=i*3;
   this.velocity[v+1]-=8*dt;
   for(let k=0;k<3;k++)this.positions[j+k]+=this.velocity[v+k]*dt;
  }
  const contact=p.scrape>0&&p.scrapeHard>0&&Math.abs(p.speed)>.5&&p.footMode===0&&p.crashBlend<.05&&p.airHeight<.03
   &&Number.isFinite(p.scrape+p.scrapeX+p.scrapeY+p.scrapeZ+p.velocityX+p.velocityZ);
  if(contact)this.spawn+=Math.min(1,p.scrape)*dt*180;else this.spawn=0;
  while(this.spawn>=1){
   this.spawn--;const i=this.next++%CAPACITY,j=i*6,v=i*3,seed=(i*17%31)/31;
   this.age[i]=this.lifetime[i]=.18+seed*.12;
   this.positions[j]=p.scrapeX;this.positions[j+1]=p.scrapeY+.025;this.positions[j+2]=p.scrapeZ;
   this.velocity[v]=-p.velocityX*.28+(seed-.5)*2;
   this.velocity[v+1]=.8+seed*1.3;
   this.velocity[v+2]=-p.velocityZ*.28+((i*11%23)/23-.5)*2;
  }
  this.live=0;
  for(let i=0;i<CAPACITY;i++){
   const j=i*6,v=i*3,fade=this.age[i]>0?this.age[i]/this.lifetime[i]:0;
   if(fade>0)this.live++;
   // Short golden streaks stay legible against sunlit asphalt without lights or bloom.
   for(let k=0;k<3;k++)this.positions[j+3+k]=this.positions[j+k]-this.velocity[v+k]*.035;
   this.colors[j]=fade;this.colors[j+1]=fade*.78;this.colors[j+2]=fade*.3;
   this.colors[j+3]=fade*.45;this.colors[j+4]=fade*.16;this.colors[j+5]=0;
  }
  this.mesh.visible=this.live>0;
  this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
 }
 reset(){if(!this.live&&!this.spawn)return;this.age.fill(0);this.colors.fill(0);this.live=0;this.spawn=0;this.mesh.visible=false;this.geometry.attributes.color.needsUpdate=true;}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.mesh.removeFromParent();this.geometry.dispose();(this.mesh.material as T.Material).dispose();}
}
