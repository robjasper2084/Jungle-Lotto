import * as T from 'three';
import {inheritAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {registerSharedGeometryShader} from './sharedGeometryBuffers.ts';

export const MACARTHUR_BUMP_CENTER_KEY='macarthur-bump-center-candidate-v1';
export const MACARTHUR_BUMP_CENTER_ASSIGNMENT='belleMacArthurMapCenterRed = sampledDiffuseColor.r;';
export const MACARTHUR_BUMP_CENTER_READ='float Hll = bumpScale * belleMacArthurMapCenterRed;';

const mapFetch='vec4 sampledDiffuseColor = texture2D( map, vMapUv );';
const bumpCenter='float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;';
const installed=new WeakSet<T.Material>();

function requireContract(ok:unknown,message:string):asserts ok {
 if(!ok)throw new Error('MacArthur bump-center proof contract: '+message);
}
function occurrences(source:string,token:string){return source.split(token).length-1;}

function eligible(material:T.Material):material is T.MeshStandardMaterial {
 if(Object.getPrototypeOf(material)!==T.MeshStandardMaterial.prototype||!/MacArthur masonry/.test(material.name))return false;
 const m=material as T.MeshStandardMaterial,map=m.map;
 return !!map&&Object.getPrototypeOf(map)===T.Texture.prototype&&m.bumpMap===map&&m.normalMap===null&&
  !m.transparent&&m.opacity===1&&m.alphaTest===0&&!m.alphaHash&&!m.wireframe&&m.side===T.DoubleSide&&
  Number.isFinite(m.bumpScale)&&m.bumpScale!==0&&map.mapping===T.UVMapping&&map.channel===0&&
  map.colorSpace===T.SRGBColorSpace&&map.format===T.RGBAFormat&&map.type===T.UnsignedByteType&&
  !('isVideoTexture' in map)&&!('isRenderTargetTexture' in map&&map.isRenderTargetTexture)&&
  map.updateMatrix===T.Texture.prototype.updateMatrix&&
  Object.entries(m.defines||{}).every(([key,value])=>key==='STANDARD'&&value==='');
}

/** Opt-in, final-material experiment for the actual mapped MacArthur masonry.
 * Install after world bump assignment and all realistic/atmosphere decorators.
 * Never mutates ShaderChunk, the textures, UVs, maps, or bump/normal arithmetic.
 *
 * The paired immutable texture supplies both identical stock UV transforms.
 * Cache its raw map sample before color processing and reuse only the bump
 * center fetch. Both forward-offset fetches and all derivatives stay stock.
 * Unsupported materials are untouched. An enabled material that subsequently
 * violates its contract fails the proof loudly instead of drawing a stale
 * program. This helper has no production callers and is disabled by default.
 */
export function installMacArthurBumpCenterReuse(material:T.Material,options:Readonly<{enabled?:boolean}>={}):boolean {
 if(options.enabled!==true)return false;
 if(installed.has(material))return true;
 if(!eligible(material))return false;
 const map=material.map!,previousCompile=material.onBeforeCompile,previousRender=material.onBeforeRender;
 const previousKey=material.customProgramCacheKey();
 const mapChunk=T.ShaderChunk.map_fragment,bumpChunk=T.ShaderChunk.bumpmap_pars_fragment;
 const uvVertex=T.ShaderChunk.uv_vertex,uvParsVertex=T.ShaderChunk.uv_pars_vertex,uvParsFragment=T.ShaderChunk.uv_pars_fragment;
 const checkMaterial=(current:T.Material)=>requireContract(eligible(current)&&current.map===map&&current.bumpMap===map,'approved material or shared texture changed');
 requireContract(occurrences(mapChunk,mapFetch)===1,'stock map lookup changed');
 requireContract(occurrences(bumpChunk,bumpCenter)===1,'stock bump center lookup changed');
 const mapped=mapChunk.replace(mapFetch,mapFetch+'\n\t'+MACARTHUR_BUMP_CENTER_ASSIGNMENT);
 const bumped=bumpChunk.replace(bumpCenter,MACARTHUR_BUMP_CENTER_READ);

 material.onBeforeCompile=function(shader,renderer){
  checkMaterial(this);
  previousCompile.call(this,shader,renderer);
  checkMaterial(this);
  requireContract(T.ShaderChunk.map_fragment===mapChunk&&T.ShaderChunk.bumpmap_pars_fragment===bumpChunk&&
   T.ShaderChunk.uv_vertex===uvVertex&&T.ShaderChunk.uv_pars_vertex===uvParsVertex&&T.ShaderChunk.uv_pars_fragment===uvParsFragment,'shared stock shader chunks changed');
  requireContract(occurrences(shader.vertexShader,'#include <uv_vertex>')===1&&
   occurrences(shader.vertexShader,'#include <uv_pars_vertex>')===1,'stock UV construction missing or duplicated');
  requireContract(occurrences(shader.fragmentShader,'#include <uv_pars_fragment>')===1&&
   occurrences(shader.fragmentShader,'#include <map_fragment>')===1&&
   occurrences(shader.fragmentShader,'#include <bumpmap_pars_fragment>')===1&&
   occurrences(shader.fragmentShader,'#include <normal_fragment_maps>')===1,'stock map/bump path missing or duplicated');
  const source=shader.vertexShader+'\n'+shader.fragmentShader;
  requireContract(!/\b(?:vMapUv|vBumpMapUv|mapTransform|bumpMapTransform|MAP_UV|BUMPMAP_UV|sampledDiffuseColor|dHdxy_fwd|belleMacArthurMapCenterRed)\b/.test(source),'an inherited hook overrides stock map/bump sampling');
  shader.fragmentShader='float belleMacArthurMapCenterRed;\n'+shader.fragmentShader
   .replace('#include <map_fragment>',mapped)
   .replace('#include <bumpmap_pars_fragment>',bumped);
 };
 // An otherwise valid program must not survive a later independent map swap.
 // Preserve the prior callback and validate after it, before uniforms/draws.
 material.onBeforeRender=function(...args){previousRender.apply(this,args);checkMaterial(this);};
 inheritAtmosphereProgram(material,previousCompile);
 registerSharedGeometryShader(material,previousCompile);
 material.customProgramCacheKey=()=>previousKey+'|'+MACARTHUR_BUMP_CENTER_KEY;
 material.needsUpdate=true;
 installed.add(material);return true;
}
