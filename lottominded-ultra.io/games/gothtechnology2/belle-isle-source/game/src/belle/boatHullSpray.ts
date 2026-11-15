import * as T from 'three';
import type {BoatController} from './boatController.ts';
import {hullSprayStrength} from './boatEffectsState.ts';
/** Fixed particles for the rooster tail and both hull-contact chines. */
export class BoatSpray{
 private count=256;private positions=new Float32Array(this.count*3);private velocities=new Float32Array(this.count*3);private age=new Float32Array(this.count).fill(9);private opacity=new Float32Array(this.count);
 private next=0;private carry=0;private serial=0;private geometry=new T.BufferGeometry();private points:T.Points;
 constructor(scene:T.Scene){
  this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
  this.geometry.setAttribute('opacity',new T.BufferAttribute(this.opacity,1).setUsage(T.DynamicDrawUsage));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,
   vertexShader:'attribute float opacity;varying float vAlpha;void main(){vAlpha=opacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(85./max(1.,-p.z),1.,36.);}',
   fragmentShader:'varying float vAlpha;void main(){vec2 p=gl_PointCoord*2.-1.;float d=dot(p,p);float bubbles=.65+.35*sin(p.x*24.)*sin(p.y*19.);gl_FragColor=vec4(.86,.96,1.,(1.-smoothstep(.15,1.,d))*bubbles*vAlpha*.42);}'});
  this.points=new T.Points(this.geometry,material);this.points.name='Hull contact foam and rooster tail';this.points.frustumCulled=false;this.points.visible=false;scene.add(this.points);
 }
 clear(){this.age.fill(9);this.points.visible=false;this.carry=0;}
 update(dt:number,sim:BoatController|undefined,running:boolean,reduced=false){
  if(!running)return;dt=Math.min(.1,Math.max(0,dt));
  if(sim){
   const p=sim.pose,hydro=sim.kind==='hydroplane',tail=Math.min(1,Math.max(0,(p.speed-5)/(hydro?55:22))),contact=hullSprayStrength({...sim.telemetry,speed:p.speed}),dx=Math.sin(p.heading),dz=Math.cos(p.heading);
   this.carry+=dt*(tail*85+contact*95)*(reduced?.3:1);
   while(this.carry>=1){
    this.carry--;const i=this.next++%this.count,k=i*3,n=this.serial++,side=n%2?1:-1,chine=n%3!==0,spread=Math.sin(n*2.39996),along=chine?sim.profile.length*(.05+.25*Math.cos(n)):-sim.profile.length*.48,lateral=chine?side*sim.profile.beam*.46:spread*.25;
    this.positions[k]=p.x+dx*along+dz*lateral;this.positions[k+1]=.20;this.positions[k+2]=p.z+dz*along-dx*lateral;
    const out=chine?side*(1.8+contact*4):spread*2,forward=p.speed*(chine?.5:.25)-7;
    this.velocities[k]=dx*forward+dz*out;this.velocities[k+1]=chine?1+contact*4:(hydro?15:4)*tail+Math.cos(n*1.7);this.velocities[k+2]=dz*forward-dx*out;this.age[i]=0;
   }
  }
  let visible=false;
  for(let i=0;i<this.count;i++){const k=i*3;this.opacity[i]=0;if(this.age[i]>1.9){this.positions[k+1]=-100;continue;}this.age[i]+=dt;this.velocities[k+1]-=9.81*dt;for(let j=0;j<3;j++)this.positions[k+j]+=this.velocities[k+j]*dt;if(this.positions[k+1]<.05)this.age[i]=9;else{visible=true;this.opacity[i]=Math.max(0,1-this.age[i]/1.9);}}
  this.points.visible=visible;for(const attr of ['position','opacity'])this.geometry.getAttribute(attr).needsUpdate=true;
 }
}
