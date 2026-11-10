import type {Material} from 'three';
const prepared=new WeakMap<Material,boolean>();
/** Full-size silhouettes cross-dissolve; fractional scale makes BOTH crowns shrink.
 * Complementary, stable screen-door masks use existing opaque draw batches.
 * No transparency sorting, added meshes, texture samples or frame loop. */
export function prepareVegetationLod(material:Material,far=false){
 if(prepared.has(material)){
  if(prepared.get(material)!==far)throw Error('Near and far trees cannot share a mutable LOD material');
  return;
 }
 prepared.set(material,far);
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.call(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  const vertex='#include <begin_vertex>',fragment='#include <alphatest_fragment>';
  if(!shader.vertexShader.includes(vertex)||!shader.fragmentShader.includes(fragment))throw Error('Vegetation LOD shader contract changed');
  shader.vertexShader='attribute float belleLodCoverage;varying float vBelleLodCoverage;\n'+shader.vertexShader.replace(vertex,vertex+'\nvBelleLodCoverage=belleLodCoverage;');
  shader.fragmentShader='varying float vBelleLodCoverage;\n'+shader.fragmentShader.replace(fragment,fragment+`
 float belleLodNoise=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
 if(vBelleLodCoverage<=0.0 || ${far?'1.0-belleLodNoise':'belleLodNoise'}>vBelleLodCoverage)discard;
`);
 };
 material.customProgramCacheKey=()=>key+'|belle-full-size-lod-v1-'+(far?'far':'near');
 material.needsUpdate=true;
}
/** Visibility is binary here: all intermediate coverage is in the fragment mask. */
export function vegetationScale(coverage:number){return Number.isFinite(coverage)&&coverage>0?1:0;}
