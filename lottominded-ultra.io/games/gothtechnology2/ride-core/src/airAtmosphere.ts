import * as T from 'three';
/** Subtle windborne motes: one small draw, no full-screen pass or physics work. */
export class AirAtmosphere {
 readonly root:T.Points;private time={value:0};private focus={value:new T.Vector3()};
 constructor(parent:T.Object3D){
  const positions=new Float32Array(72*3);for(let i=0;i<72;i++){positions[i*3]=(i*.61803398875%1)*44-22;positions[i*3+1]=.6+(i*.41421356%1)*6;positions[i*3+2]=(i*.7320508%1)*44-22;}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));
  const m=new T.ShaderMaterial({uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),time:this.time,focus:this.focus},fog:true,transparent:true,depthWrite:false,
   vertexShader:`uniform float time;uniform vec3 focus;varying float fade;
    #include <fog_pars_vertex>
    void main(){vec3 p=position;
     p.x=mod(p.x+time*.23-focus.x+22.,44.)-22.+focus.x;
     p.z=mod(p.z+time*.09+sin(time*.13+position.x)*.5-focus.z+22.,44.)-22.+focus.z;
     p.y+=focus.y+sin(time*.32+position.z)*.16;
     fade=(1.-smoothstep(12.,21.,length(p.xz-focus.xz)))*(.65+.35*sin(position.x));
     vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(25./max(1.,-mvPosition.z),1.,2.5);
     #include <fog_vertex>
    }`,
   fragmentShader:`varying float fade;
    #include <fog_pars_fragment>
    void main(){float r=length(gl_PointCoord-.5);float a=(1.-smoothstep(.1,.5,r))*fade*.13;gl_FragColor=vec4(.82,.76,.61,a);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     #include <fog_fragment>
    }`
  });this.root=new T.Points(g,m);this.root.name='Subtle windborne atmosphere';this.root.frustumCulled=false;parent.add(this.root);
 }
 update(time:number,p:{x:number;y?:number;z:number},low:boolean,reduced:boolean){this.root.visible=!reduced;this.root.geometry.setDrawRange(0,low?20:72);this.focus.value.set(p.x,p.y??0,p.z);this.time.value=time;}
 dispose(){this.root.geometry.dispose();(this.root.material as T.Material).dispose();this.root.removeFromParent();}
}
