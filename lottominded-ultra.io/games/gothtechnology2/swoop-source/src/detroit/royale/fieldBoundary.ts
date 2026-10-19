import * as T from 'three';
/** Terrain-following footprint plus a transparent, unlit energy curtain.
 * One low-poly mesh, no textures, lights, collision or post-processing passes. */
export class FieldBoundary extends T.LineLoop {
 private radius=-1;private cx=NaN;private cz=NaN;
 private arcs:T.LineSegments;
 readonly barrier?:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 constructor(color:string,opacity:number,barrier=false){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(192*3),3));
  super(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,fog:false,depthWrite:false}));
  const arcGeometry=new T.BufferGeometry();arcGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(48*6),3));
  this.arcs=new T.LineSegments(arcGeometry,new T.LineBasicMaterial({color:'#adfff0',transparent:true,opacity:.65,depthWrite:false}));this.arcs.frustumCulled=false;this.arcs.visible=false;this.add(this.arcs);
  if(barrier){
   const count=192,wall=new T.BufferGeometry(),indices:number[]=[];
   wall.setAttribute('position',new T.BufferAttribute(new Float32Array((count+1)*2*3),3));
   wall.setAttribute('uv',new T.BufferAttribute(new Float32Array((count+1)*2*2),2));
   for(let i=0;i<count;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}wall.setIndex(indices);
   const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{time:{value:0},motion:{value:1},detail:{value:1}},
    vertexShader:`varying vec2 vField;void main(){vField=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
     uniform float time,motion,detail;varying vec2 vField;
     void main(){
      float height=vField.y*45.0;
      float vertical=pow(max(0.0,cos(vField.x*1.0472)),36.0);
      float horizontal=pow(max(0.0,cos(height*2.0944-time*.45*motion)),28.0);
      float ripple=.5+.5*sin(height*.7-time*.6*motion+sin(vField.x*.05));
      float ribbon=pow(max(0.0,cos(vField.x*.18+sin(height*.9-time*.65*motion)*.7)),65.0)*detail;
      float base=exp(-height*.65),fade=1.0-smoothstep(.55,1.0,vField.y);
      float energy=max(vertical*.5,horizontal*.32)+ribbon*.65+base*.7;
      vec3 color=mix(vec3(.025,.18,.7),vec3(.35,.85,1.0),clamp(energy,0.0,1.0));
      gl_FragColor=vec4(color,(.14+.12*ripple+.22*energy)*fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
     }`});
   this.barrier=new T.Mesh(wall,material);this.barrier.name='Static Field energy barrier';this.barrier.frustumCulled=false;this.barrier.renderOrder=2;this.add(this.barrier);
  }
 }
 energize(time:number,remaining:number,reduced:boolean,low:boolean){
  const warning=remaining<8;const material=this.material as T.LineBasicMaterial;
  material.color.set(this.barrier?'#49adff':warning?'#ffb36e':'#63efd9');material.opacity=reduced?.85:.78+Math.sin(time*(warning?4:1.5))*.12;
  if(this.barrier){const u=this.barrier.material.uniforms;u.time.value=reduced?0:time;u.motion.value=reduced?0:1;u.detail.value=low?0:1;this.barrier.visible=this.radius>.1;}
  this.arcs.visible=!low&&!reduced&&this.radius>0;if(!this.arcs.visible)return;
  const base=this.geometry.getAttribute('position'),out=this.arcs.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<48;i++){const at=(i*4+Math.floor(time*7))%base.count,next=(at+1)%base.count;const h=.5+(Math.sin(i*2.7+time*3)+1)*(warning?1.5:.7);
   out.setXYZ(i*2,base.getX(at),base.getY(at),base.getZ(at));out.setXYZ(i*2+1,base.getX(next),base.getY(next)+h,base.getZ(next));}
  out.needsUpdate=true;
 }
 update(x:number,z:number,radius:number,ground:(x:number,z:number)=>number){
  if(x===this.cx&&z===this.cz&&Math.abs(radius-this.radius)<.5)return;
  this.cx=x;this.cz=z;this.radius=radius;
  const vertices=this.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<vertices.count;i++){
   const a=i/vertices.count*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
   vertices.setXYZ(i,px,ground(px,pz)+.35,pz);
  }
  vertices.needsUpdate=true;this.geometry.computeBoundingSphere();
  if(this.barrier){const wall=this.barrier.geometry,points=wall.getAttribute('position') as T.BufferAttribute,uv=wall.getAttribute('uv') as T.BufferAttribute,count=points.count/2-1;
   // Reuse the footprint's terrain samples; the curtain adds no ground rays.
   for(let i=0;i<=count;i++){const a=i/count*Math.PI*2,j=i%count,px=vertices.getX(j),pz=vertices.getZ(j),y=vertices.getY(j)-.55;
    points.setXYZ(i*2,px,y,pz);points.setXYZ(i*2+1,px,y+45,pz);uv.setXY(i*2,a*radius,0);uv.setXY(i*2+1,a*radius,1);
   }points.needsUpdate=true;uv.needsUpdate=true;wall.computeBoundingSphere();
  }
 }
 dispose(){this.geometry.dispose();(this.material as T.Material).dispose();this.arcs.geometry.dispose();(this.arcs.material as T.Material).dispose();this.barrier?.geometry.dispose();this.barrier?.material.dispose();this.removeFromParent();}
}
