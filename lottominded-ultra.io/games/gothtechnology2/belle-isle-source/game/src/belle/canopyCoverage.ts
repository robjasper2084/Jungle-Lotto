import type {Material} from 'three';
const prepared=new WeakSet<Material>();
/** Keep leaf mip levels readable with the renderer's existing multisampling.
 * Bounded autumn pigment uses the existing instance tint; original neutral trees
 * stay neutral. No new geometry, texture sample, light or animation loop. */
export function prepareCanopyCoverage(material:Material,far=false){
 material.transparent=false;material.depthWrite=true;
 // Thin real leaf atlases need a lower cutout threshold than full-crown cards.
 // Keep zero-alpha background clipped and retain MSAA edge coverage.
 material.alphaTest=far?.25:.12;material.alphaToCoverage=true;
 // Shared source leaf materials are normalized by each instance builder.
 // Reapply the coverage policy even when the shader hook is already installed.
 if(prepared.has(material))return;
 prepared.add(material);
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.call(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  const marker='#include <map_fragment>';
  if(!shader.fragmentShader.includes(marker))throw Error('Canopy coverage: original map shader missing');
  shader.fragmentShader=shader.fragmentShader.replace(marker,marker+`
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
 float belleAutumn=clamp((vColor.r-vColor.b)*2.2,0.0,1.0);
 float belleLeafLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.72,1.04,.38)*belleLeafLight,belleAutumn*.52);
#endif
`);
 };
 material.customProgramCacheKey=()=>key+'|belle-canopy-coverage-v2';
 material.needsUpdate=true;
}
