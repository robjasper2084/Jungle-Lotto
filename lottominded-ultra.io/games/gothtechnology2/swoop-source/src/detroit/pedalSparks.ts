import * as T from 'three';
import {reducedEffects} from './rideEffects.ts';
import type {RidePose} from './controller.ts';

/** Short contact sparks pooled once; no objects allocated during scraping. */
export class PedalSparks {
 private positions=new Float32Array(96*3);private velocity=new Float32Array(96*3);private age=new Float32Array(96);
 private geometry=new T.BufferGeometry();private next=0;private spawn=0;
 readonly mesh:T.Points;
 constructor(scene:T.Scene){this.positions.fill(-10000);this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3));this.mesh=new T.Points(this.geometry,new T.PointsMaterial({color:0xffc46c,size:.035,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}));this.mesh.frustumCulled=false;scene.add(this.mesh);}
 update(dt:number,p:RidePose,active:boolean){if(reducedEffects()){this.reset();return;}if(!active)return;dt=Math.min(dt,.05);
  for(let i=0;i<96;i++)if(this.age[i]>0){this.age[i]-=dt;const j=i*3;if(this.age[i]<=0){this.positions[j+1]=-10000;continue;}this.velocity[j+1]-=7*dt;for(let k=0;k<3;k++)this.positions[j+k]+=this.velocity[j+k]*dt;}
  if(p.scrape>0&&p.scrapeHard>0)this.spawn+=p.scrape*p.scrapeHard*dt*100;else this.spawn=0;
  while(this.spawn>=1){this.spawn--;const i=this.next++%96,j=i*3,seed=(i*17%31)/31;this.age[i]=.13+seed*.1;
   this.positions[j]=p.scrapeX;this.positions[j+1]=p.scrapeY+.025;this.positions[j+2]=p.scrapeZ;
   this.velocity[j]=-p.velocityX*.2+(seed-.5)*1.4;this.velocity[j+1]=.6+seed*.8;this.velocity[j+2]=-p.velocityZ*.2+(seed-.5);
  }
  this.geometry.attributes.position.needsUpdate=true;
 }
 reset(){this.age.fill(0);this.positions.fill(-10000);this.spawn=0;this.geometry.attributes.position.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();(this.mesh.material as T.Material).dispose();}
}
