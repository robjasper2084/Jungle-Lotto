import * as T from 'three';
export const DAY_SUN=new T.Vector3(22,35,24).normalize();
export const DUSK_SUN=new T.Vector3(36,8,24).normalize();
/** One low-cost sky draw, stable in split screen and stereo. Sun direction also drives shadows. */
export class RouteSky extends T.Mesh<T.SphereGeometry,T.ShaderMaterial>{
 constructor(){
  super(new T.SphereGeometry(1,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDirection:{value:DAY_SUN.clone()},dusk:{value:0}},
   vertexShader:`varying vec3 direction;void main(){direction=position;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=clip.xyww;gl_Position.z*=0.99999;}`,
   fragmentShader:`precision highp float;varying vec3 direction;uniform vec3 sunDirection;uniform float dusk;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(direction);float h=max(d.y,0.);float glow=pow(max(0.,dot(d,normalize(sunDirection))),48.);
     vec3 horizon=mix(vec3(.63,.77,.86),vec3(.42,.22,.20),dusk),zenith=mix(vec3(.12,.37,.66),vec3(.035,.075,.16),dusk);
     vec3 color=mix(horizon,zenith,pow(h,.45));color+=mix(vec3(.18,.13,.05),vec3(.48,.20,.05),dusk)*glow;
     vec2 p=d.xz/max(.18,d.y+.18)*2.6;float n=noise(p)*.58+noise(p*2.07)*.28+noise(p*4.13)*.14;
     float cloud=smoothstep(.55,.75,n)*smoothstep(.04,.22,h)*(1.-smoothstep(.78,.98,h));
     color=mix(color,mix(vec3(.87,.91,.94),vec3(.38,.29,.31),dusk),cloud*.88);
     float disk=smoothstep(.99975,.99990,dot(d,normalize(sunDirection)));color+=mix(vec3(1.8,1.5,1.05),vec3(1.8,.65,.20),dusk)*disk;
     gl_FragColor=vec4(color,1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }` }));this.frustumCulled=false;this.renderOrder=-100;this.name='Detroit daylight and cloud sky';
 }
 setDusk(value:boolean){this.material.uniforms.dusk.value=value?1:0;this.material.uniforms.sunDirection.value.copy(value?DUSK_SUN:DAY_SUN);}
}
