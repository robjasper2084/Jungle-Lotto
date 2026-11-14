import * as T from 'three';import type {BoatController} from './boatController.ts';
/** Bounded, single-draw spray. Water streaks still use the existing river shader. */
export class BoatSpray{
 private count=192;private positions=new Float32Array(this.count*3);private velocities=new Float32Array(this.count*3);private age=new Float32Array(this.count).fill(9);private next=0;private carry=0;private serial=0;
 private geometry=new T.BufferGeometry();private points:T.Points;
 constructor(scene:T.Scene){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d')!,g=c.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,32,32);
  this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.points=new T.Points(this.geometry,new T.PointsMaterial({map:new T.CanvasTexture(canvas),color:0xe6f1f4,size:.9,transparent:true,opacity:.30,depthWrite:false}));this.points.name='Bounded hydroplane rooster tail';this.points.frustumCulled=false;this.points.visible=false;scene.add(this.points);
 }
 clear(){this.age.fill(9);this.points.visible=false;this.carry=0;}
 update(dt:number,sim:BoatController,running:boolean){
  if(!running)return;dt=Math.min(.1,Math.max(0,dt));const p=sim.pose,hydro=sim.kind==='hydroplane',strength=Math.min(1,Math.max(0,(p.speed-6)/(hydro?55:22))),dx=Math.sin(p.heading),dz=Math.cos(p.heading);
  this.carry+=dt*strength*85;
  while(this.carry>=1){this.carry--;const i=this.next++%this.count,k=i*3,n=this.serial++,spread=Math.sin(n*2.39996);this.positions[k]=p.x-dx*sim.profile.length*.48+dz*spread*.25;this.positions[k+1]=.18;this.positions[k+2]=p.z-dz*sim.profile.length*.48-dx*spread*.25;this.velocities[k]=dx*(p.speed*.25-7)+dz*spread*2;this.velocities[k+1]=(hydro?15:4)*strength+Math.cos(n*1.7);this.velocities[k+2]=dz*(p.speed*.25-7)-dx*spread*2;this.age[i]=0;}
  let visible=false;
  for(let i=0;i<this.count;i++){const k=i*3;if(this.age[i]>1.9){this.positions[k+1]=-100;continue;}this.age[i]+=dt;this.velocities[k+1]-=9.81*dt;for(let j=0;j<3;j++)this.positions[k+j]+=this.velocities[k+j]*dt;if(this.positions[k+1]<.05)this.age[i]=9;else visible=true;}
  this.points.visible=visible;this.geometry.getAttribute('position').needsUpdate=true;
 }
}
