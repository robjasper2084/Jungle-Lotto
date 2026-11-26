import * as T from 'three';
import {BUMP_CENTER_CHUNKS} from './bumpCenterChunks.ts';
import {inheritAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {registerSharedGeometryShader} from './sharedGeometryBuffers.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type NativeShader=Shader&{map?:boolean;bumpMap?:boolean;normalMap?:boolean;mapUv?:string|false;bumpMapUv?:string|false;
 decodeVideoTexture?:boolean;opaque?:boolean;alphaMap?:boolean;alphaTest?:boolean;alphaHash?:boolean;alphaToCoverage?:boolean;
 numClippingPlanes?:number;numClipIntersection?:number;logarithmicDepthBuffer?:boolean};
type Hook='onBeforeCompile'|'customProgramCacheKey';
const uniform='belleReuseAlbedoBumpCenter',programFlag='BELLE_BUMP_CENTER_PROGRAM_SAFE';
const label='Higgsfield • warm limestone · MacArthur masonry';
const owners=new WeakMap<T.MeshStandardMaterial,{dispose:()=>void}>();
const centerLine='float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;';
const bump=BUMP_CENTER_CHUNKS.bumpmap_pars_fragment
 .replace('uniform float bumpScale;','uniform float bumpScale;\nuniform bool '+uniform+';')
 .replace('vec2 dHdxy_fwd()','vec2 dHdxy_fwd( float belleAlbedoBumpCenter )')
 .replace(centerLine,`float Hll;
#if ${programFlag} == 1
 if(${uniform}) Hll = bumpScale * belleAlbedoBumpCenter;
 else
#endif
 { ${centerLine.replace('float Hll =','Hll =')} }`);
const normal=BUMP_CENTER_CHUNKS.normal_fragment_maps.replace(
 'normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );',
 `#ifdef USE_MAP
 normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd( sampledDiffuseColor.x ), faceDirection );
 #else
 normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd( 0.0 ), faceDirection );
 #endif`);
const one=(text:string,token:string)=>text.split(token).length===2;
const skinPigmentBranch=`if(skinProfile.y>0.&&skinFade>0.){
 vec3 skinC=sampleSkin(skinColor,skinP,skinPx,skinPy,skinW);
 diffuseColor.rgb=mix(diffuseColor.rgb,skinC*diffuse,skinProfile.y*skinFade);
}`;
const stockChunks=()=>T.REVISION==='185'&&Object.entries(BUMP_CENTER_CHUNKS).every(([name,value])=>T.ShaderChunk[name as keyof typeof BUMP_CENTER_CHUNKS]===value);

/** This decision is compiled into EACH native program, not just kept in its
 * uniform table. r185 may retain the latest table when returning to an earlier
 * cached program. Its native UV/decode/discard conditions must remain decisive. */
function nativeContract(shader:NativeShader):boolean{
 return shader.map===true&&shader.bumpMap===true&&shader.normalMap===false&&
  typeof shader.mapUv==='string'&&/^uv[123]?$/.test(shader.mapUv)&&shader.mapUv===shader.bumpMapUv&&
  shader.decodeVideoTexture===false&&shader.opaque===true&&shader.alphaMap===false&&
  shader.alphaTest===false&&shader.alphaHash===false&&shader.alphaToCoverage===false&&
  shader.numClippingPlanes===0&&shader.numClipIntersection===0&&shader.logarithmicDepthBuffer===false;
}

function guardedSource(shader:NativeShader):boolean{
 let fragment=shader.fragmentShader;const vertex=shader.vertexShader;
 // A previous known helper can be inherited through a realistic/atmosphere
 // clone. Normalize only our exact text, then bind this compilation's own flag.
 fragment=fragment.replace(bump,'#include <bumpmap_pars_fragment>').replace(normal,'#include <normal_fragment_maps>')
  .replace(/^#define BELLE_BUMP_CENTER_PROGRAM_SAFE [01]\n/,'');
 const tokens=['#include <map_fragment>','#include <bumpmap_pars_fragment>','#include <normal_fragment_maps>'];
 if(!stockChunks()||tokens.some(token=>!one(fragment,token))||!one(vertex,'#include <uv_vertex>')||!one(vertex,'#include <uv_pars_vertex>')||
  fragment.indexOf(tokens[0])>fragment.indexOf(tokens[2])||
  /\b(?:sampledDiffuseColor|dHdxy_fwd|vMapUv|vBumpMapUv|mapTransform|bumpMapTransform|MAP_UV|BUMPMAP_UV|DECODE_VIDEO_TEXTURE|discard|gl_FragDepth)\b/.test(fragment+'\n'+vertex))return false;
 const start=fragment.indexOf('void main()');if(start<0||start>fragment.indexOf(tokens[0]))return false;
 const beforeBump=fragment.slice(start,fragment.indexOf(tokens[2])).replace(skinPigmentBranch,'')
  .replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 // The one audited pigment branch uses textureGrad and neither discards nor
 // alters the albedo sample/UVs. Other injected early control flow is excluded.
 if(/\b(?:if|for|while|do|switch|return|break|continue)\b/.test(beforeBump))return false;
 shader.fragmentShader='#define '+programFlag+' '+Number(nativeContract(shader))+'\n'+fragment.replace(tokens[1],bump).replace(tokens[2],normal);
 return true;
}

function opaqueOwner(material:T.MeshStandardMaterial){
 return material.constructor===T.MeshStandardMaterial&&!material.transparent&&material.opacity===1&&material.blending===T.NormalBlending&&
  !material.alphaMap&&!material.alphaTest&&!material.alphaHash&&!material.alphaToCoverage&&!material.normalMap&&material.clippingPlanes===null&&
  !!material.defines&&Object.keys(material.defines).every(name=>name==='STANDARD')&&material.defines.STANDARD==='';
}
function tableAlias(uniforms:Shader['uniforms']):boolean{
 const names=['map','bumpMap','mapTransform','bumpMapTransform'] as const;
 if(names.some(name=>!uniforms[name]||!Object.getOwnPropertyDescriptor(uniforms[name],'value')?.writable))return false;
 const texture=uniforms.map.value as T.Texture|null,other=uniforms.bumpMap.value as T.Texture|null;
 const a=uniforms.mapTransform.value,b=uniforms.bumpMapTransform.value;
 return !!texture&&texture===other&&texture.isTexture===true&&!(texture as T.VideoTexture).isVideoTexture&&
  !(texture as T.Texture&{isVideoFrameTexture?:boolean}).isVideoFrameTexture&&texture.mapping===T.UVMapping&&
  a?.constructor===T.Matrix3&&b?.constructor===T.Matrix3&&a.elements.every(Number.isFinite)&&b.elements.every(Number.isFinite)&&a.equals(b);
}

function restore(material:T.Material,name:Hook,before:PropertyDescriptor|undefined,current:Function){
 if(material[name]!==current)return;
 const now=Object.getOwnPropertyDescriptor(material,name);if(now&&!now.configurable)return;
 if(before)Object.defineProperty(material,name,before);else Reflect.deleteProperty(material,name);
}

/** Final-owner installation. The application never changes maps, defines,
 * render callbacks, geometry, uniforms or program keys as eligibility changes.
 * Native refreshMaterialUniforms fills each material's table before the native
 * upload reads this getter. If an upload is skipped, both its sampler bindings
 * and the flag remain from that same previous upload. Foreign/inherited hooks
 * bind a fresh false flag to the SAME guarded program, never the source owner. */
export function installBumpCenterReuse(material:T.MeshStandardMaterial):(()=>void)|undefined{
 const existing=owners.get(material);if(existing)return existing.dispose;
 if(material.constructor!==T.MeshStandardMaterial||material.name!==label||
  material.userData.realisticProfile!=='brick|triplanar'||material.userData.realisticSurface!=='brick'||
  !opaqueOwner(material)||!Object.isExtensible(material))return;
 const descriptors=Object.fromEntries((['onBeforeCompile','customProgramCacheKey'] as Hook[]).map(name=>[name,Object.getOwnPropertyDescriptor(material,name)])) as Record<Hook,PropertyDescriptor|undefined>;
 if(Object.values(descriptors).some(d=>d&&(!('value' in d)||!d.writable||!d.configurable)))return;
 const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
 if(typeof previousCompile!=='function'||typeof previousKey!=='function')return;
 let disposed=false;
 const compile:T.Material['onBeforeCompile']=function(this:T.Material,...args){
  const result=Reflect.apply(previousCompile,this,args),shader=args[0] as NativeShader,owned=this===material;
  const nativeSafe=nativeContract(shader),rewritten=guardedSource(shader),uniforms=shader.uniforms;
  if(rewritten){
   // Frozen getter cannot acquire needsUpdate=false and silently miss a native
   // refresh. The alias is read from the actual sampler/matrix TABLE, never
   // material.map, which may intentionally differ while a native upload waits.
   uniforms[uniform]=Object.freeze({get value(){return !disposed&&owned&&nativeSafe&&
    material.onBeforeCompile===compile&&material.customProgramCacheKey===key&&opaqueOwner(material)&&stockChunks()&&tableAlias(uniforms);}});
  }else if(uniforms[uniform]){
   // An inherited exact guarded program may be followed by an unsupported
   // decorator. Its already-present binding must remain permanently native.
   uniforms[uniform]=Object.freeze({value:false});
  }
  return result;
 };
 const key:T.Material['customProgramCacheKey']=function(this:T.Material,...args){return Reflect.apply(previousKey,this,args)+'|belle-albedo-bump-center-v2';};
 for(const [name,value] of Object.entries({onBeforeCompile:compile,customProgramCacheKey:key})){
  const before=descriptors[name as Hook];Object.defineProperty(material,name,{value,writable:true,configurable:true,enumerable:before?.enumerable??false});
 }
 inheritAtmosphereProgram(material,previousCompile);registerSharedGeometryShader(material,previousCompile);material.needsUpdate=true;
 function dispose(){
  if(disposed)return;disposed=true;owners.delete(material);material.removeEventListener('dispose',dispose);
  restore(material,'onBeforeCompile',descriptors.onBeforeCompile,compile);restore(material,'customProgramCacheKey',descriptors.customProgramCacheKey,key);
  // A fully frozen material cannot restore hooks or increment version; its
  // existing guarded program is nevertheless safe because the getter is false.
  if(Object.getOwnPropertyDescriptor(material,'version')?.writable!==false)material.needsUpdate=true;
 }
 owners.set(material,{dispose});material.addEventListener('dispose',dispose);return dispose;
}

/** Material replacement emits no Scene.childadded. Run once at the explicit
 * post-decoration landmark boundary, after queued atmosphere work. */
export function reuseMacArthurBumpCenters(root:T.Object3D):number{
 const materials=new Set<T.MeshStandardMaterial>();root.traverse(object=>{
  if(!(object instanceof T.Mesh)||!object.name.startsWith('MacArthur'))return;
  for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof T.MeshStandardMaterial)materials.add(material);
 });
 let installed=0;for(const material of materials)if(installBumpCenterReuse(material))installed++;return installed;
}
