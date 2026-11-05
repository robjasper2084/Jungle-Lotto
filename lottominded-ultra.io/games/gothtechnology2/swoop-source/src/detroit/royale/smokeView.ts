import * as T from 'three';
import {smokeRadius,type SmokeCloud} from '../../../../ride-core/src/royale/smoke.ts';
const vertex=`varying vec3 worldPoint;
void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPoint=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const fragment=`precision highp sampler3D;
layout(location=0) out vec4 smokeColor;
#define gl_FragColor smokeColor
uniform sampler3D volumeNoise;
uniform vec3 center,extent;
uniform float time,opacity,floorY,inside,steps;
varying vec3 worldPoint;
void main(){
 if((inside<.5&&!gl_FrontFacing)||(inside>.5&&gl_FrontFacing))discard;
 vec3 direction=normalize(worldPoint-cameraPosition),o=(cameraPosition-center)/extent,d=direction/extent;
 float a=max(dot(d,d),0.000001),b=dot(o,d),c=dot(o,o)-1.0,disc=b*b-a*c;
 if(disc<0.0)discard;
 float enter=max(0.0,(-b-sqrt(disc))/a),leave=(-b+sqrt(disc))/a;
 if(leave<=enter)discard;
 float stepSize=(leave-enter)/max(steps,1.0);
 // Stable offsets break up march bands without flickering.
 float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 vec3 drift=vec3(time*.006,-time*.011,time*.004);
 vec4 sum=vec4(0.0);
 for(int i=0;i<28;i++){
  if(float(i)>=steps)break;
  vec3 world=cameraPosition+direction*(enter+(float(i)+jitter)*stepSize),p=(world-center)/extent;
  // Advected, warped density breaks up the spherical envelope at several scales.
   vec3 warp=vec3(texture(volumeNoise,p*.12+drift).r,texture(volumeNoise,p*.12+drift+vec3(.31,.17,.53)).r,texture(volumeNoise,p*.12+drift+vec3(.61,.43,.23)).r)-.5;
   vec3 turbulent=p+warp*.28;
   float n=texture(volumeNoise,turbulent*.14+drift).r*.52+texture(volumeNoise,turbulent*.33-drift*.7).r*.32+texture(volumeNoise,turbulent*.71+drift*.5).r*.16;
  float edge=1.0-smoothstep(.12,1.0,length(p)+(.5-n)*.95);
  float density=edge*smoothstep(.18,.72,n)*smoothstep(floorY,floorY+.30,world.y)*opacity;
  float alpha=1.0-exp(-density*stepSize*4.5);
  float shadow=texture(volumeNoise,(p+vec3(.2,.5,.1))*.075+drift).r;
  float sun=exp(-2.2*edge*max(0.0,shadow-.20));
  vec3 light=mix(vec3(.16,.19,.21),vec3(.61,.64,.65),clamp(.24+sun*.70+p.y*.12,0.0,1.0));
  sum.rgb+=(1.0-sum.a)*alpha*light;sum.a+=(1.0-sum.a)*alpha;
  if(sum.a>.985)break;
 }
 if(sum.a<.003)discard;
 gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

/** One bounded volume per authoritative cloud, with soft drifting density.
 * Texture/geometry are shared; reduced motion freezes internal turbulence. */
export class SmokeView extends T.Group{
 private geometry=new T.BoxGeometry(2,2,2);
 private noise:T.Data3DTexture;
 private cameraPoint=new T.Vector3();
 private clouds=new Map<string,T.Mesh<T.BoxGeometry,T.ShaderMaterial>>();
 constructor(){
  super();const data=new Uint8Array(32**3);let seed=0x46ae3;
  for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data[i]=seed>>>24;}
  this.noise=new T.Data3DTexture(data,32,32,32);this.noise.format=T.RedFormat;
  this.noise.minFilter=this.noise.magFilter=T.LinearFilter;
  this.noise.wrapS=this.noise.wrapT=this.noise.wrapR=T.RepeatWrapping;this.noise.unpackAlignment=1;this.noise.needsUpdate=true;
 }
 update(clouds:readonly SmokeCloud[],tick:number,reduced:boolean,steps=28){
  const wanted=new Set(clouds.map(c=>c.id));
  for(const [id,view]of this.clouds)if(!wanted.has(id)){this.remove(view);view.material.dispose();this.clouds.delete(id);}
  for(const c of clouds){let view=this.clouds.get(c.id);
   if(!view){
    const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,glslVersion:T.GLSL3,transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{volumeNoise:{value:this.noise},center:{value:new T.Vector3()},extent:{value:new T.Vector3()},time:{value:0},opacity:{value:1},floorY:{value:c.p.y},inside:{value:0},steps:{value:28}}});
    material.forceSinglePass=true;view=new T.Mesh(this.geometry,material);const mesh=view;
    view.onBeforeRender=(_renderer,_scene,camera)=>{
     const p=camera.getWorldPosition(this.cameraPoint).sub(mesh.position).divide(mesh.scale);
     const within=Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))<1;
     material.uniforms.inside.value=+within;
     // The exit shell can lie behind the road when the camera is inside.
     material.depthTest=!within;
    };
    this.clouds.set(c.id,view);this.add(view);
   }
   const radius=smokeRadius(c,tick),age=Math.max(0,(tick-c.start)/60);
   view.visible=radius>.025;view.position.set(c.p.x,c.p.y+1.4,c.p.z);view.scale.set(radius,radius/1.4,radius);
   const u=view.material.uniforms;u.center.value.copy(view.position);u.extent.value.copy(view.scale);u.floorY.value=c.p.y;
   u.time.value=reduced?0:age;u.steps.value=Math.max(12,Math.min(28,steps));u.opacity.value=Math.min(1,Math.max(0,(tick-c.start)/30),(c.end-tick)/60);
  }
 }
 dispose(){for(const view of this.clouds.values())view.material.dispose();this.clouds.clear();this.noise.dispose();this.geometry.dispose();this.clear();}
}
