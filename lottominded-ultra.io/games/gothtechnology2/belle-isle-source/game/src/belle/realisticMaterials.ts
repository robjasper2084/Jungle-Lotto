import * as T from 'three';
import {surfaceKind,type Surface} from './realisticMaterialRules.ts';
type Maps={color:T.Texture;detail:T.Texture};
const maps=new Map<Surface,Maps>();
let waterNormal:T.Texture|undefined;
export const realisticWaterNormal=()=>waterNormal;
const done=new WeakSet<T.Material>();
const profiles:Record<Surface,[number,number,number,number]>={
 // tiles per metre, pigment blend, relief, roughness
 asphalt:[.65,.70,.018,.94],grass:[.55,.78,.025,.94],concrete:[.6,.32,.008,.87],
 brick:[.45,.50,.018,.84],bark:[1.1,.65,.03,.94],sand:[.8,.65,.012,.93],
 limestone:[.7,.35,.012,.83],wood:[1,.50,.01,.78],metal:[4,0,.0008,.36],
 rubber:[9,0,.002,.76],leaf:[7,0,.001,.8],cloth:[14,0,.0015,.92],
 fur:[18,0,.0018,.9],skin:[22,0,.0007,.58],gravel:[.8,.60,.025,.93],roof:[.75,.30,.016,.84]
};
let ready:Promise<void>|undefined;
export function loadRealisticMaterials(renderer:T.WebGLRenderer){
 return ready??=(async()=>{const loader=new T.TextureLoader();await Promise.all((Object.keys(profiles) as Surface[]).map(async name=>{
  const [color,detail]=await Promise.all(['color','detail'].map(suffix=>loader.loadAsync('./belle/skins/'+name+'-'+suffix+'.webp')));
  for(const texture of [color,detail]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  color.colorSpace=T.SRGBColorSpace;maps.set(name,{color,detail});
 }));waterNormal=await loader.loadAsync('./belle/skins/water-normal.webp');waterNormal.wrapS=waterNormal.wrapT=T.RepeatWrapping;waterNormal.anisotropy=4;})();
}
/** Photographic detail is projected in model space, so it does not slide while riding.
 * Existing albedo/alpha maps, articulated pivots, skins and custom shaders are retained.
 * Detail green is luminance-derived height, red is authored roughness (not a scanned PBR map).
 */
export function applyRealisticMaterials(root:T.Object3D,context=''){
 const clones=new Map<string,T.MeshStandardMaterial>();
 root.traverse(object=>{if(!(object instanceof T.Mesh))return;
  const original=Array.isArray(object.material)?object.material:[object.material];
  const updated=original.map(material=>{
   if(!(material instanceof T.MeshStandardMaterial)||done.has(material))return material;
   const kind=surfaceKind(material.name,context+' '+object.name,material.metalness);if(!kind)return material;
   const textures=maps.get(kind);if(!textures)return material;
   // Clone only when one material covers different semantic parts of an actor.
   const key=material.uuid+kind;let m=clones.get(key);if(m)return m;
   m=material.clone();m.onBeforeCompile=material.onBeforeCompile;clones.set(key,m);done.add(m);
   const [scale,blend,relief,roughness]=/ballfield infield/i.test(material.name)?[6,.25,.002,.98]:profiles[kind];
   if(!m.alphaTest&&!m.transparent&&['asphalt','grass','sand','gravel'].includes(kind)){m.map=null;m.normalMap=null;m.bumpMap=null;m.roughnessMap=null;}const oldCompile=m.onBeforeCompile,oldKey=material.customProgramCacheKey();
   m.roughness=kind==='metal'?Math.max(.24,Math.min(.6,m.roughness)):roughness;
   m.userData.realisticSurface=kind;
   m.onBeforeCompile=(shader,renderer)=>{
    oldCompile(shader,renderer);
    Object.assign(shader.uniforms,{skinColor:{value:textures.color},skinDetail:{value:textures.detail}});
    shader.vertexShader='varying vec3 skinPosition;varying vec3 skinNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nskinPosition=position;skinNormal=normal;');
    shader.fragmentShader=`varying vec3 skinPosition;varying vec3 skinNormal;uniform sampler2D skinColor;uniform sampler2D skinDetail;
vec3 skinWeights(){vec3 w=pow(abs(normalize(skinNormal)),vec3(8.));return w/max(.0001,w.x+w.y+w.z);}
vec3 sampleSkin(sampler2D tex,vec3 p){vec3 w=skinWeights();return texture2D(tex,p.zy).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}
`+shader.fragmentShader;
    // Preserve camera colors, character likeness and foliage alpha. Add grain without relighting the atlas.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec3 skinP=skinPosition*${scale.toFixed(4)};
vec3 skinC=sampleSkin(skinColor,skinP);vec3 skinD=sampleSkin(skinDetail,skinP);
float skinFade=1.-smoothstep(.08,.65,max(length(dFdx(skinP)),length(dFdy(skinP))));
float skinGrain=mix(1.,.85+skinD.g*.30,skinFade);
diffuseColor.rgb*=skinGrain;
${blend>0?`diffuseColor.rgb=mix(diffuseColor.rgb,skinC*diffuse,${blend.toFixed(3)}*skinFade);`:''}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(skinD.r-.5)*.16*skinFade,.08,1.);
`);
    // Surface-gradient bump detail also works on meshes without UVs and alongside their existing normals.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 skinDx=dFdx(-vViewPosition),skinDy=dFdy(-vViewPosition);
vec3 skinRx=cross(skinDy,normal),skinRy=cross(normal,skinDx);
float skinDet=dot(skinDx,skinRx);
vec2 skinGradient=vec2(dFdx(skinD.g),dFdy(skinD.g))*${relief.toFixed(6)}*skinFade;
vec3 skinGrad=sign(skinDet)*(skinGradient.x*skinRx+skinGradient.y*skinRy);
normal=normalize(abs(skinDet)*normal-skinGrad);
`);
   };
   m.customProgramCacheKey=()=>oldKey+'-higgsfield-surface-v1-'+kind;m.needsUpdate=true;return m;
  });
  object.material=Array.isArray(object.material)?updated:updated[0];
 });
}
