import * as T from 'three';
/** Dielectric water: inexpensive moving normals and depth colour, no extra render pass. */
export function waterSurface(time:{value:number},deep='#24494e',shallow='#5c8075'){
 const m=new T.MeshPhysicalMaterial({name:'Detroit depth water',color:'white',roughness:.24,metalness:0,ior:1.333,clearcoat:.18,clearcoatRoughness:.24,envMapIntensity:.7,side:T.DoubleSide});
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{riverTime:time,waterDeep:{value:new T.Color(deep)},waterShallow:{value:new T.Color(shallow)}});
  s.vertexShader='varying vec3 waterWorld;\nattribute float waterDepth;varying float surfaceDepth;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterWorld=(modelMatrix*vec4(position,1.)).xyz;surfaceDepth=waterDepth;');
  s.fragmentShader=`uniform float riverTime;uniform vec3 waterDeep,waterShallow;varying vec3 waterWorld;varying float surfaceDepth;
   float ripple(vec2 p){float a=sin(p.x*.87+p.y*.43-riverTime*.8);float b=sin(p.x*1.72-p.y*1.13+riverTime*.63+a*.55);return a*.022+b*.009+sin(p.x*3.4+p.y*2.1-riverTime*1.3+b*.4)*.003;}
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(waterShallow,waterDeep,1.-exp(-max(.02,surfaceDepth)*.8));');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 p=waterWorld.xz;float h=ripple(p);vec3 n=normalize(vec3((h-ripple(p+vec2(.08,0.)))/.08,1.,(h-ripple(p+vec2(0.,.08)))/.08));normal=normalize(mat3(viewMatrix)*n);`);
  s.fragmentShader=s.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>','#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal=normal;\n#endif');
 };m.customProgramCacheKey=()=> 'detroit-depth-ripple-v1';return m;
}
export function waterDepths(g:T.BufferGeometry,depth:(x:number,z:number)=>number){const p=g.attributes.position,a=new Float32Array(p.count);for(let i=0;i<p.count;i++)a[i]=Math.max(.02,depth(p.getX(i),p.getZ(i)));g.setAttribute('waterDepth',new T.BufferAttribute(a,1));}
