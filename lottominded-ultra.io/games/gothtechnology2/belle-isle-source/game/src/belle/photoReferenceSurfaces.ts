import * as T from 'three';

type Finish='masonry'|'concrete'|'paint'|'rubber';
/** Small, filtered surface variation over existing PBR maps. Chaining preserves
 * the normal/roughness maps and fountain lighting already installed by the world. */
export function photoSurfaceFinish(material:T.MeshStandardMaterial,finish:Finish){
 if(material.userData.photoSurfaceFinish)return;
 material.userData.photoSurfaceFinish=finish;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.vertexShader='varying vec3 photoSurfaceWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nphotoSurfaceWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 photoSurfaceWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 ps=photoSurfaceWorld;
   float broad=.5+.25*sin(ps.x*1.7+sin(ps.z*.9))+.25*sin(ps.z*2.1+ps.y*1.3);
   float filterGrain=1.-smoothstep(.2,1.2,length(fwidth(ps))*65.);
   float grain=fract(sin(dot(floor(ps*57.),vec3(12.9898,78.233,37.719)))*43758.5453);
   diffuseColor.rgb*=mix(1.,.91+.18*grain,filterGrain);
   ${finish==='masonry'?`float baseDamp=1.-smoothstep(2.1,3.8,ps.y);diffuseColor.rgb*=.94+.06*broad-baseDamp*.09;`:''}
   ${finish==='concrete'?`vec2 joints=abs(fract(ps.xz/1.5+.5)-.5);vec2 aa=max(fwidth(ps.xz/1.5),vec2(.001));float seam=1.-smoothstep(.003,.007+max(aa.x,aa.y),min(joints.x,joints.y));diffuseColor.rgb*=1.-seam*.18;diffuseColor.rgb*=.94+.06*broad;`:''}
   ${finish==='paint'?`float patina=smoothstep(.76,.96,broad)*.22;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.45,.30),patina);`:''}
   ${finish==='rubber'?`diffuseColor.rgb*=mix(1.,.85+.28*grain,filterGrain*.45);`:''}
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+${finish==='paint'?'.07':'.035'}*(broad-.5),.25,1.);
  `);
 };material.customProgramCacheKey=()=>key+'-photo-finish-'+finish+'-v1';material.needsUpdate=true;
}

export function applyPhotoReferenceSurfaces(root:T.Object3D){
 root.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof T.MeshStandardMaterial))continue;
   const name=material.name;
   if(name==='Casino buff masonry'||name==='Casino pale carved trim')photoSurfaceFinish(material,'masonry');
   else if(name==='Canal bridge limestone'||name==='Pale edge concrete')photoSurfaceFinish(material,'concrete');
   else if(name==='Casino bridge red cast iron'||/powder.coated/i.test(name))photoSurfaceFinish(material,'paint');
   else if(/speckled rubber/i.test(name))photoSurfaceFinish(material,'rubber');
  }
 });
}
