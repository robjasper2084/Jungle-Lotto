import * as T from 'three';
import {aircraftFrame} from './presentationPolicy.ts';
/** Decorative, world-anchored high-altitude traffic. No collisions or live telemetry. */
export class SkyAircraft {
 private root=new T.Group();private plane:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
 private trail:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;private positions=new Float32Array(25*4*3);private opacity=new Float32Array(25*4);private last=-Infinity;private frame=aircraftFrame(0);private behind=aircraftFrame(0);
 constructor(scene:T.Scene){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([
   0,0,8,-.7,0,-6,.7,0,-6, 0,0,3,-9,0,-1,0,0,-3, 0,0,3,0,0,-3,9,0,-1,
   0,0,-4,-3,0,-7,0,0,-6, 0,0,-4,0,0,-6,3,0,-7, 0,0,-3,0,2,-6,0,0,-7
  ],3));geo.computeBoundingSphere();
  this.plane=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xcbd2d7,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,fog:false}));this.plane.scale.setScalar(2);
  const trailGeo=new T.BufferGeometry(),indices:number[]=[];
  for(let engine=0;engine<2;engine++)for(let i=0;i<24;i++){const a=engine*50+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  trailGeo.setAttribute('position',new T.BufferAttribute(this.positions,3));trailGeo.setAttribute('trailAlpha',new T.BufferAttribute(this.opacity,1));trailGeo.setIndex(indices);
  const material=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(.67,.72,.75)},visibility:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:'attribute float trailAlpha;varying float alpha;void main(){alpha=trailAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'uniform vec3 tint;uniform float visibility;varying float alpha;void main(){gl_FragColor=vec4(tint,alpha*visibility);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  this.trail=new T.Mesh(trailGeo,material);this.trail.frustumCulled=false;
  this.root.name='Distant aircraft and fading contrails';this.root.add(this.plane,this.trail);this.root.visible=false;scene.add(this.root);
 }
 update(clock:number,day:number,enabled:boolean){
  const f=aircraftFrame(clock,this.frame);this.root.visible=enabled&&day>.2&&f.visible;if(!this.root.visible)return;
  this.plane.position.set(f.x,f.y,f.z);this.plane.rotation.y=f.heading;this.plane.material.opacity=f.fade*.65;
  this.trail.material.uniforms.visibility.value=f.fade*day;
  if(clock-this.last<.2)return;this.last=clock;
  const rightX=Math.cos(f.heading),rightZ=-Math.sin(f.heading);
  for(let engine=0;engine<2;engine++)for(let i=0;i<25;i++){
   const age=i*.5,behind=aircraftFrame(clock-age,this.behind),width=.7+age*.55,engineOffset=(engine===0?-1:1)*3;
   for(let side=0;side<2;side++){
    const index=engine*50+i*2+side,offset=engineOffset+(side===0?-width:width);
    this.positions[index*3]=behind.x+rightX*offset;this.positions[index*3+1]=f.y+age*.08;this.positions[index*3+2]=behind.z+rightZ*offset;
    this.opacity[index]=behind.visible?.28*Math.sin(Math.PI*i/24)**.7*(1-i/25):0;
   }
  }
  this.trail.geometry.attributes.position.needsUpdate=true;this.trail.geometry.attributes.trailAlpha.needsUpdate=true;
 }
 dispose(){this.root.removeFromParent();this.plane.geometry.dispose();this.plane.material.dispose();this.trail.geometry.dispose();this.trail.material.dispose();}
}
