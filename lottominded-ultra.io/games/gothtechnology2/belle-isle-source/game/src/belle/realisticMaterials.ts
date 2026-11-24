import * as T from 'three';
import {startupPool,startupResource,warmTextureList} from './startupWork.ts';
import {retrySurfaceTexture} from './surfaceRetry.ts';
import {surfaceKind,type Surface} from './realisticMaterialRules.ts';
import {registerSharedGeometryShader} from './sharedGeometryBuffers.ts';
type Maps={color:T.Texture;detail:T.Texture};
const maps=new Map<Surface,Maps>();
let waterNormal:T.Texture|undefined;
export const realisticWaterNormal=()=>waterNormal;
const done=new WeakSet<T.Material>();
const profiles:Record<Surface,[number,number,number,number]>={
 // tiles per metre, pigment blend, relief, roughness
 marble:[.28,.45,.003,.61],bronze:[.8,.32,.0018,.57],copper:[.75,.45,.001,.65],ceramic:[5,0,.0004,.24],paint:[6,0,.0005,.5],granite:[1.5,.25,.002,.66],rope:[10,0,.002,.87],feather:[18,0,.0006,.78],leather:[12,0,.001,.65],cork:[8,.4,.003,.84],graphite:[12,0,.0006,.32],scales:[12,0,.0005,.34],
 asphalt:[.65,.70,.018,.94],grass:[.55,.78,.025,.94],concrete:[.6,.32,.008,.87],
 brick:[.45,.50,.018,.84],bark:[1.1,.65,.03,.94],sand:[.8,.65,.012,.93],
 limestone:[.7,.35,.012,.83],wood:[1,.50,.01,.78],metal:[4,0,.0008,.36],
 rubber:[9,0,.002,.76],leaf:[7,0,.001,.8],cloth:[14,0,.0015,.92],
 fur:[18,0,.0018,.9],skin:[22,0,.0007,.58],gravel:[.8,.60,.025,.93],roof:[.75,.30,.016,.84]
};
let ready:Promise<void>|undefined;
export function loadRealisticMaterials(renderer:T.WebGLRenderer){
 if(ready)return ready;
 const task=(async()=>{
  const loader=new T.TextureLoader(),controller=new AbortController(),owned=new Set<T.Texture>(),staged=new Map<Surface,Maps>();
  const deadline=setTimeout(()=>controller.abort(new Error('Island surface preparation timed out. Reload to retry.')),60000);
  const load=async(url:string)=>{
   const texture=await retrySurfaceTexture(attempt=>startupResource(loader.loadAsync(url+(attempt?'?retry='+attempt:'')),attempt?14000:30000,'Surface texture',t=>t.dispose(),controller.signal),controller.signal);
   owned.add(texture);return texture;
  };
  try{
   // At most three pairs decode at once, rather than fifty-six simultaneous requests.
   await startupPool(Object.keys(profiles) as Surface[],3,async name=>{
    try{
     const [color,detail]=await Promise.all(['color','detail'].map(suffix=>load('./belle/skins/'+name+'-'+suffix+'.webp')));
     for(const texture of [color,detail]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
     color.colorSpace=T.SRGBColorSpace;detail.colorSpace=T.NoColorSpace;
     await warmTextureList(renderer,[color,detail],controller.signal);staged.set(name,{color,detail});
    }catch(error){controller.abort(error);throw error;}
   },controller.signal);
   const water=await load('./belle/skins/water-normal.webp');water.colorSpace=T.NoColorSpace;water.wrapS=water.wrapT=T.RepeatWrapping;water.anisotropy=4;
   await warmTextureList(renderer,[water],controller.signal);
   for(const [name,textures] of staged)maps.set(name,textures);waterNormal=water;
  }catch(error){controller.abort(error);for(const texture of owned)texture.dispose();throw error;}
  finally{clearTimeout(deadline);}
 })();
 ready=task;void task.catch(()=>{if(ready===task)ready=undefined;});return task;
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
   // These overlays receive their texture asynchronously on the original material.
   // Cloning before that load finishes leaves a permanent opaque white patch.
   if(/decal|mascot charm/i.test(object.name))return material;
   const kind=surfaceKind(material.name,context+' '+object.name,material.metalness);if(!kind)return material;
   const textures=maps.get(kind);if(!textures)return material;
   // Clone only when one material covers different semantic parts of an actor.
   const normal=object.geometry.getAttribute('normal');
   let planar=!!normal&&!(object instanceof T.SkinnedMesh);
   if(planar)for(let i=0;i<normal.count;i++)if(Math.abs(normal.getY(i))<.999){planar=false;break;}
   const key=material.uuid+kind+(planar?'-planar':'');let m=clones.get(key);if(m)return m;
   m=material.clone();m.onBeforeCompile=material.onBeforeCompile;clones.set(key,m);done.add(m);
   const [scale,blend,relief,roughness]=/ballfield infield/i.test(material.name)?[6,.25,.002,.98]:profiles[kind];
   if(!m.alphaTest&&!m.transparent&&['asphalt','grass','sand','gravel'].includes(kind)){m.map=null;m.normalMap=null;m.bumpMap=null;m.roughnessMap=null;}const oldCompile=m.onBeforeCompile,oldKey=material.customProgramCacheKey();
   m.roughness=context==='boat'&&kind==='graphite'?.45:kind==='metal'?Math.max(.24,Math.min(.6,m.roughness)):roughness;
   m.userData.realisticSurface=kind;
   m.userData.realisticBaseIsStandard=material.onBeforeCompile===T.Material.prototype.onBeforeCompile;
   m.userData.realisticProfile=/ballfield infield/i.test(material.name)?'infield-'+kind:kind;
   m.onBeforeCompile=(shader,renderer)=>{
    oldCompile(shader,renderer);
    // The scale, pigment and relief belong to the material. A roof and a
    // limestone wall can use one linked shader with their own texture inputs.
    Object.assign(shader.uniforms,{skinColor:{value:textures.color},skinDetail:{value:textures.detail},
     skinProfile:{value:new T.Vector3(scale,blend,relief)},skinPlanar:{value:planar}});
    shader.vertexShader=`varying vec3 skinPosition;varying vec3 skinNormal;
#ifdef BELLE_ORIGINAL_SURFACE_COORDS
attribute vec3 originalSurfacePosition;attribute vec3 originalSurfaceNormal;
#endif
`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef BELLE_ORIGINAL_SURFACE_COORDS
skinPosition=originalSurfacePosition;skinNormal=originalSurfaceNormal;
#else
skinPosition=position;skinNormal=normal;
#endif`);
    // Projection and pigment are material uniforms, so the same authored base
    // shader can keep one program across these four surface combinations.
    shader.fragmentShader=`varying vec3 skinPosition;varying vec3 skinNormal;uniform sampler2D skinColor;uniform sampler2D skinDetail;uniform vec3 skinProfile;uniform bool skinPlanar;
vec3 skinWeights(){
 vec3 w=normalize(skinNormal);w*=w;w*=w;w*=w;return w/max(.0001,w.x+w.y+w.z);
}
vec3 sampleSkin(sampler2D tex,vec3 p,vec3 dx,vec3 dy,vec3 w){
 if(skinPlanar)return textureGrad(tex,p.xz,dx.xz,dy.xz).rgb;
 vec3 value=vec3(0.);
 if(w.x>0.)value+=textureGrad(tex,p.zy,dx.zy,dy.zy).rgb*w.x;
 if(w.y>0.)value+=textureGrad(tex,p.xz,dx.xz,dy.xz).rgb*w.y;
 if(w.z>0.)value+=textureGrad(tex,p.xy,dx.xy,dy.xy).rgb*w.z;
 return value;
}
`+shader.fragmentShader;
    // Preserve camera colors, character likeness and foliage alpha. Add grain without relighting the atlas.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec3 skinP=skinPosition*skinProfile.x;
vec3 skinPx=dFdx(skinP),skinPy=dFdy(skinP);
vec3 skinW=skinPlanar?vec3(0.,1.,0.):skinWeights();
// Height must be available to adjacent fragments on both sides of the fade.
vec3 skinD=sampleSkin(skinDetail,skinP,skinPx,skinPy,skinW);
float skinFade=1.-smoothstep(.08,.65,max(length(skinPx),length(skinPy)));
float skinGrain=mix(1.,.85+skinD.g*.30,skinFade);
diffuseColor.rgb*=skinGrain;
if(skinProfile.y>0.&&skinFade>0.){
 vec3 skinC=sampleSkin(skinColor,skinP,skinPx,skinPy,skinW);
 diffuseColor.rgb=mix(diffuseColor.rgb,skinC*diffuse,skinProfile.y*skinFade);
}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(skinD.r-.5)*.16*skinFade,.08,1.);
`);
    // Surface-gradient bump detail also works on meshes without UVs and alongside their existing normals.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 skinDx=dFdx(-vViewPosition),skinDy=dFdy(-vViewPosition);
vec3 skinRx=cross(skinDy,normal),skinRy=cross(normal,skinDx);
float skinDet=dot(skinDx,skinRx);
vec2 skinGradient=vec2(dFdx(skinD.g),dFdy(skinD.g))*skinProfile.z*skinFade;
vec3 skinGrad=sign(skinDet)*(skinGradient.x*skinRx+skinGradient.y*skinRy);
normal=normalize(abs(skinDet)*normal-skinGrad);
`);
   };
   registerSharedGeometryShader(m,oldCompile);
   m.customProgramCacheKey=()=>oldKey+'-higgsfield-surface-v5';m.needsUpdate=true;return m;
  });
  object.material=Array.isArray(object.material)?updated:updated[0];
 });
 return [...clones.values()];
}
