import type {MeshStandardMaterial} from 'three';

/** Small, filtered surface variation in the existing material pass. No texture
 * downloads, additional render passes or time-varying grain. */
export function surfaceFinish(material:MeshStandardMaterial,kind:'cloth'|'shell'|'metal'|'ground'){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.vertexShader='varying vec3 finishPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition=position;');
  shader.fragmentShader='varying vec3 finishPosition;\n'+shader.fragmentShader;
  const scale=kind==='cloth'?440:kind==='metal'?310:kind==='ground'?.45:95;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec3 fp=finishPosition*${scale.toFixed(2)};
   float footprint=max(length(dFdx(fp)),length(dFdy(fp)));
   float visibleGrain=1.-smoothstep(.35,1.3,footprint);
   float weave=sin(fp.x*3.14159)*sin(fp.y*3.14159)*sin(fp.z*3.14159);
   float broad=sin(finishPosition.x*2.7+sin(finishPosition.z*1.9))*sin(finishPosition.y*3.1+finishPosition.z*.73);
   roughnessFactor=clamp(roughnessFactor+weave*visibleGrain*${kind==='metal'?'.065':'.035'},.12,1.);
   diffuseColor.rgb*=1.+weave*visibleGrain*${kind==='cloth'?'.045':'.018'}+broad*${kind==='ground'?'.075':'.018'};
  `);
 };
 material.customProgramCacheKey=()=>key+'/surface-finish-v1/'+kind;material.needsUpdate=true;
 return material;
}
