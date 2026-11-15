import * as T from 'three';
import {jetPower} from './boatEffectsState.ts';
import type {BoatController} from './boatController.ts';
/** Local thermal plume distortion and additive halos; no full-scene bloom pass. */
export class BoatJets{
 private time=0;private material:T.ShaderMaterial;private plumes:T.Mesh[]=[];private anchors:T.Object3D[]=[];
 private particles:T.Points;private positions=new Float32Array(64*3);private ages=new Float32Array(64);
 intensity=0;
 constructor(root:T.Object3D){
  this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
   uniforms:{time:{value:0},power:{value:0},motion:{value:1}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform float time;uniform float power;uniform float motion;varying vec2 vUv;
   void main(){float taper=1.-vUv.y;float heat=sin(vUv.y*32.-time*14.)*sin(vUv.y*15.+time*9.)*.08*motion;
   float x=(vUv.x-.5+heat*vUv.y)/max(.1,taper);float core=exp(-x*x*60.);float halo=exp(-x*x*9.)*.32;
   vec3 tint=mix(vec3(.02,.86,1.),vec3(.58,.13,1.),vUv.y);
   gl_FragColor=vec4(tint*(1.1+core),(core+halo)*taper*power*.72);}`});
  const geo=new T.PlaneGeometry(.9,1,1,8);geo.translate(0,.5,0);
  for(const name of ['Jet_Port','Jet_Starboard']){
   const anchor=root.getObjectByName(name);if(!anchor)throw Error('Boat asset is missing '+name);this.anchors.push(anchor);
   for(const rotation of [0,Math.PI/2]){const m=new T.Mesh(geo,this.material);m.rotation.x=-Math.PI/2;m.rotation.y=rotation;anchor.add(m);m.visible=false;this.plumes.push(m);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('life',new T.BufferAttribute(this.ages,1));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{power:{value:0}},vertexShader:'attribute float life;varying float fade;void main(){fade=1.-life;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(35./max(1.,-p.z),1.,12.);}',fragmentShader:'uniform float power;varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.14,.65,1.,max(0.,1.-d)*fade*power*.55);}'});
  this.particles=new T.Points(geometry,material);this.particles.frustumCulled=false;this.particles.visible=false;root.add(this.particles);
 }
 update(dt:number,sim:BoatController,running:boolean,reduced:boolean){
  if(running)this.time+=Math.min(.1,Math.max(0,dt));
  this.intensity=jetPower(sim.telemetry);this.material.uniforms.time.value=this.time;this.material.uniforms.power.value=this.intensity;this.material.uniforms.motion.value=reduced?0:1;
  for(const mesh of this.plumes){mesh.visible=this.intensity>.015;mesh.scale.y=.25+this.intensity*(reduced?.6:2.1);}
  this.particles.visible=this.intensity>.015&&!reduced;
  (this.particles.material as T.ShaderMaterial).uniforms.power.value=this.intensity;
  for(let i=0;i<64;i++){const anchor=this.anchors[i%2],age=(i*.618034+this.time*2)%1,k=i*3,spread=.04+age*.14;this.positions[k]=anchor.position.x+Math.sin(i*2.4)*spread;this.positions[k+1]=anchor.position.y+Math.cos(i*1.7)*spread;this.positions[k+2]=anchor.position.z-age*(.3+this.intensity*2.3);this.ages[i]=age;}
  this.particles.geometry.getAttribute('position').needsUpdate=true;this.particles.geometry.getAttribute('life').needsUpdate=true;
 }
}
