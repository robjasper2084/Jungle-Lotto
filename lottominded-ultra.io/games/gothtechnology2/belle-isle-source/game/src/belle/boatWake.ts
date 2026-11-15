import * as T from 'three';
import {WakeHistory} from './boatEffectsState.ts';
import {riverWaveGLSL} from './riverWaves.ts';
import type {BoatController} from './boatController.ts';
/** One transparent draw; 1016 triangles maximum, no render target.
 * Foam rides above the coarse river triangles to avoid intersection cut lines. */
export class BoatWake{
 readonly history=new WakeHistory();
 private position=new Float32Array(128*5*3);private uv=new Float32Array(128*5*2);private alpha=new Float32Array(128*5);
 private geometry=new T.BufferGeometry();private material:T.ShaderMaterial;private mesh:T.Mesh;
 constructor(scene:T.Scene){
  this.geometry.setAttribute('position',new T.BufferAttribute(this.position,3).setUsage(T.DynamicDrawUsage));
  this.geometry.setAttribute('uv',new T.BufferAttribute(this.uv,2).setUsage(T.DynamicDrawUsage));
  this.geometry.setAttribute('opacity',new T.BufferAttribute(this.alpha,1).setUsage(T.DynamicDrawUsage));
  const indices=[];for(let i=0;i<127;i++)for(let j=0;j<4;j++){const a=i*5+j;indices.push(a,a+1,a+5,a+1,a+6,a+5);}this.geometry.setIndex(indices);
  this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},riverTime:{value:0},light:{value:1}},
   vertexShader:`uniform float riverTime;attribute float opacity;varying vec2 vUv;varying float vAlpha;void main(){vUv=uv;vAlpha=opacity;vec3 p=position;vec2 wp=p.xz;p.y+=${riverWaveGLSL};gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
   fragmentShader:`uniform float time;uniform float light;varying vec2 vUv;varying float vAlpha;
    void main(){float x=abs(vUv.x*2.-1.);float ripple=sin(vUv.y*5.+sin(vUv.x*24.)-time*.8)*.5+.5;
    float crest=exp(-pow((x-.78)*9.,2.));float churn=(1.-smoothstep(.0,.65,x))*.24;
    float foam=(crest+churn)*(.45+.55*ripple)*(1.-smoothstep(.88,1.,x));gl_FragColor=vec4(vec3(.79,.93,.96)*light,foam*vAlpha*.48);}`});
  this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='Persistent hull wake';this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
 }
 break(){this.history.break();}
 update(dt:number,sim:BoatController|undefined,running:boolean,waterTime=0,light=1){
  if(!running)return;const h=this.history;h.advance(dt);
  if(sim&&Math.abs(sim.pose.speed)>1.5){const p=sim.pose;h.add(p.x-Math.sin(p.heading)*sim.profile.length*.46,p.z-Math.cos(p.heading)*sim.profile.length*.46,p.heading,sim.profile.beam,Math.min(1,Math.abs(p.speed)/16));}
  for(let i=0;i<h.count;i++){
   const s=h.at(i)!,age=h.time-s.time,prev=h.at(i-1),next=h.at(i+1),width=s.width+age*1.1;
   const connected=(!prev||prev.chain===s.chain)&&(!next||next.chain===s.chain);
   for(let side=0;side<5;side++){const n=i*5+side,k=n*3,offset=(side/4-.5)*width;this.position[k]=s.x+s.dz*offset;this.position[k+1]=.14;this.position[k+2]=s.z-s.dx*offset;this.uv[n*2]=side/4;this.uv[n*2+1]=s.distance;this.alpha[n]=connected?s.power*Math.pow(1-age/h.lifetime,2)*Math.min(1,i/3):0;}
  }
  this.geometry.setDrawRange(0,Math.max(0,h.count-1)*24);for(const attr of ['position','uv','opacity'])this.geometry.getAttribute(attr).needsUpdate=true;
  this.material.uniforms.time.value=h.time;this.material.uniforms.riverTime.value=waterTime;this.material.uniforms.light.value=light;this.mesh.visible=h.count>1;
 }
}
