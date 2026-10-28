import * as T from 'three';
import {waterNoise} from '../../../ride-core/src/waterNoise.ts';
/** Metre-scale wind ripples and dielectric HDR reflection, without another scene render. */
export function waterSurface(time:{value:number},deep='#183b3e',shallow='#52736c'){
 const m=new T.MeshPhysicalMaterial({name:'Detroit depth water',color:'white',roughness:.16,metalness:0,ior:1.333,clearcoat:0,envMapIntensity:.9,side:T.DoubleSide});
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{riverTime:time,riverNoise:{value:waterNoise()},waterDeep:{value:new T.Color(deep)},waterShallow:{value:new T.Color(shallow)}});
  s.vertexShader='varying vec3 waterWorld;\nattribute float waterDepth;varying float surfaceDepth;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterWorld=(modelMatrix*vec4(position,1.)).xyz;surfaceDepth=waterDepth;');
  s.fragmentShader=`uniform float riverTime;uniform sampler2D riverNoise;uniform vec3 waterDeep,waterShallow;varying vec3 waterWorld;varying float surfaceDepth;
   float riverHeight(vec2 p){
    float broad=texture2D(riverNoise,p*.009-vec2(.0008,.0016)*riverTime).r-.5;
    float chop=texture2D(riverNoise,mat2(.8,-.6,.6,.8)*p*.065+vec2(.006,-.011)*riverTime).g-.5;
    float capillary=texture2D(riverNoise,p*.23-vec2(.014,.022)*riverTime).b-.5;
    return broad*.19+chop*.032+capillary*.0035;
   }
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(waterShallow,waterDeep,1.-exp(-max(.02,surfaceDepth)*.65));');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float riverH=riverHeight(waterWorld.xz);
   vec3 riverX=dFdx(waterWorld),riverY=dFdy(waterWorld),riverUp=vec3(0.,1.,0.);
   vec3 riverR1=cross(riverY,riverUp),riverR2=cross(riverUp,riverX);float riverDet=dot(riverX,riverR1);
   vec3 riverGradient=dFdx(riverH)*riverR1+dFdy(riverH)*riverR2;
   normal=normalize(mat3(viewMatrix)*normalize(max(abs(riverDet),.000001)*riverUp-sign(riverDet)*riverGradient));`);
 };m.customProgramCacheKey=()=> 'detroit-depth-wind-water-v2';return m;
}
export function waterDepths(g:T.BufferGeometry,depth:(x:number,z:number)=>number){const p=g.attributes.position,a=new Float32Array(p.count);for(let i=0;i<p.count;i++)a[i]=Math.max(.02,depth(p.getX(i),p.getZ(i)));g.setAttribute('waterDepth',new T.BufferAttribute(a,1));}
