import * as T from 'three';

/** Anime finish on the original meshes, UVs and rig. No replacement character. */
export function animeRider(root:T.Object3D){
 const meshes:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&!o.userData.referenceInk)meshes.push(o);});
 const materials=new Map<T.Material,T.Material>();
 for(const mesh of meshes){
  const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const mapped=source.map(m=>{if(materials.has(m))return materials.get(m)!;if(!(m instanceof T.MeshStandardMaterial))return m;const toon=m.clone();toon.name=m.name+' · anime';toon.roughness=.88;toon.metalness=.02;toon.normalScale.setScalar(.30);toon.envMapIntensity=.25;
   toon.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
// Lift the existing dark costume/skin textures without changing their painted identity.
diffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(.001)),vec3(.60));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float animeAlbedo=max(.025,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
float animeLight=dot(outgoingLight,vec3(.2126,.7152,.0722))/animeAlbedo;
float animeBand=.52+smoothstep(.48,.53,animeLight)*.30+smoothstep(1.0,1.05,animeLight)*.38;
vec3 animeShadow=mix(vec3(.74,.77,.98),vec3(1.08,1.02,.88),smoothstep(.48,.53,animeLight));
float animeRim=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.5);
outgoingLight=diffuseColor.rgb*animeBand*animeShadow+vec3(.12,.18,.21)*animeRim;
#include <opaque_fragment>`);
   };toon.customProgramCacheKey=()=> 'reference-original-rider-anime-v1';materials.set(m,toon);return toon;});
  mesh.material=Array.isArray(mesh.material)?mapped:mapped[0];
  const ink=new T.MeshBasicMaterial({color:0x171624,side:T.BackSide});ink.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*.006;');};ink.customProgramCacheKey=()=> 'reference-rider-ink-v1';
  let outline:T.Mesh;if(mesh instanceof T.SkinnedMesh){const skinned=new T.SkinnedMesh(mesh.geometry,ink);skinned.skeleton=mesh.skeleton;skinned.bindMode=mesh.bindMode;skinned.bindMatrix.copy(mesh.bindMatrix);skinned.bindMatrixInverse.copy(mesh.bindMatrixInverse);outline=skinned;}else outline=new T.Mesh(mesh.geometry,ink);
  outline.name='Anime ink · '+mesh.name;outline.userData.referenceInk=true;outline.frustumCulled=false;outline.castShadow=false;outline.receiveShadow=false;mesh.add(outline);
 }
}

/** Soft emissive shells follow the existing LED/rail geometry and controls; no new lights or postprocess. */
export function glowVehicle(root:T.Object3D,kind:'hover'|'wheel'){
 const sources:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&(kind==='hover'?/^LED_/.test(o.name):/^Rim_Ring|^CrashRail/.test(o.name)))sources.push(o);});
 for(const mesh of sources){
  let source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial;
  if(kind==='wheel'){source=source.clone();source.emissive.set('#73e6ff');source.emissiveIntensity=2.8;source.color.set('#66b7cf');mesh.material=source;}
  for(const [thickness,opacity]of [[.018,.32],[.045,.09]]){
   const material=new T.MeshBasicMaterial({color:0x79dfff,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,side:T.BackSide,toneMapped:false});
   material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed+=normal*${thickness.toFixed(3)};`);};material.customProgramCacheKey=()=> 'reference-vehicle-glow-'+thickness;
   const halo=new T.Mesh(mesh.geometry,material);halo.name='LED halo';halo.castShadow=false;halo.receiveShadow=false;halo.onBeforeRender=()=>{material.color.copy(source.emissive);material.opacity=opacity*Math.min(1,source.emissiveIntensity/2);};mesh.add(halo);
  }
 }
}
