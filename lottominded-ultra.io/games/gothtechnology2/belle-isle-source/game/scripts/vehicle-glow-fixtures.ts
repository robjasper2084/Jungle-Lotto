import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {HUMAN_PROFILE} from '../runtime/ride-core/src/profiles.ts';
import {applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import * as glowCandidate from '../src/belle/referenceActors.ts';
import type {FamilyCase,Side} from './program-family-fixtures.ts';
// @ts-expect-error The driver supplies the complete exact preceding product source.
import * as glowBaselineImport from 'virtual:belle-glow-baseline';
// @ts-expect-error The driver hashes, retains and serves only these exact assets.
import assetManifestImport from 'virtual:belle-glow-assets';

type Kind='wheel'|'hover';
type Halo=T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
type Source=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Asset={kind:Kind;url:string;path:string;bytes:number;sha256:string};
const manifest=assetManifestImport as Asset[];
const factories:Record<Side,typeof glowCandidate>={baseline:glowBaselineImport,candidate:glowCandidate};
const sides:Side[]=['baseline','candidate'];
const retained:unknown[]=[];
const inventories:Record<Kind,[string,number,number][]>= {
 wheel:[['CrashRail_1',32,126],['CrashRail_-1',32,126],['Rim_Ring_1',260,1377],['Rim_Ring_-1',258,1377]],
 hover:[['LED_Main_Front',729,3840],['LED_Main_Rear',729,3840],['LED_FL',585,3072],['LED_FR',585,3072],['LED_RL',585,3072],['LED_RR',585,3072]],
};
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const selected=(name:string,kind:Kind)=>kind==='hover'?/^LED_/.test(name):/^Rim_Ring|^CrashRail/.test(name);
const bytes=(array:ArrayBufferView)=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const digest=async(value:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value.slice().buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
function attributes(geometry:T.BufferGeometry){return [...Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b)),...(geometry.index?[['index',geometry.index] as const]:[])];}
async function geometryEvidence(source:Source){
 const geometry=source.geometry,rows=[] as {name:string;itemSize:number;count:number;normalized:boolean;arrayType:string;stride:number|null;offset:number|null;sha256:string;original:Uint8Array}[];
 for(const [name,attribute]of attributes(geometry)){
  const interleaved=attribute as T.InterleavedBufferAttribute;
  rows.push({name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,arrayType:attribute.array.constructor.name,stride:interleaved.isInterleavedBufferAttribute?interleaved.data.stride:null,offset:interleaved.isInterleavedBufferAttribute?interleaved.offset:null,sha256:await digest(bytes(attribute.array)),original:bytes(attribute.array).slice()});
 }
 const checks=()=>{
  assert(source.geometry===geometry,'Glow source geometry object changed: '+source.name);
  const current=attributes(geometry);assert(current.length===rows.length,'Glow source attribute inventory changed');
  for(const [index,[name,attribute]]of current.entries()){
   const original=rows[index],now=bytes(attribute.array),interleaved=attribute as T.InterleavedBufferAttribute;
   assert(name===original.name&&attribute.itemSize===original.itemSize&&attribute.count===original.count&&attribute.normalized===original.normalized&&attribute.array.constructor.name===original.arrayType,'Glow source attribute metadata changed');
   assert((interleaved.isInterleavedBufferAttribute?interleaved.data.stride:null)===original.stride&&(interleaved.isInterleavedBufferAttribute?interleaved.offset:null)===original.offset,'Glow source interleaving changed');
   assert(now.length===original.original.length&&now.every((value,i)=>value===original.original[i]),'Glow source attribute bytes changed: '+source.name+' '+name);
  }
 };
 return {source:source.name,geometry,checks,receipt:{source:source.name,attributes:rows.map(({original,...row})=>row)}};
}

/** Actual shipped vehicle geometry and actual factory; no substitute shells. */
export async function createVehicleGlowCases():Promise<FamilyCase[]>{
 const result:FamilyCase[]=[];
 for(const kind of ['wheel','hover'] as const){
  const asset=manifest.find(row=>row.kind===kind);assert(asset,'Missing verified glow asset '+kind);
  const response=await fetch(asset.url);assert(response.ok,'Glow asset request failed: '+asset.url);
  const assetBytes=new Uint8Array(await response.arrayBuffer());assert(assetBytes.length===asset.bytes&&await digest(assetBytes)===asset.sha256,'Glow asset bytes differ from retained source: '+kind);
  const gltf=await new GLTFLoader().parseAsync(assetBytes.slice().buffer,'');retained.push(gltf,assetBytes);
  for(const controlState of ['authored','dim','off'] as const){
   const item:FamilyCase={id:'glow-'+kind+'-'+controlState,family:'glow-'+kind,expectedBaselinePrograms:2,objects:{} as Record<Side,T.Object3D>,decorateSurface:false,familyUniformNames:['referenceGlowThickness']};
   // The baseline intentionally has literals, so its receipt does not require
   // the candidate-only uniform. Native receipts are installed on candidate halos.
   const familyMaterials={} as Record<Side,T.Material[]>,halos={} as Record<Side,Halo[]>,sources={} as Record<Side,Source[]>;
   const originalControls={} as Record<Side,{color:T.Color;intensity:number}[]>;
   const proofs={} as Record<Side,Awaited<ReturnType<typeof geometryEvidence>>[]>;
   const bounds={} as Record<Side,T.Box3>,uniforms=new Map<T.Material,Set<T.IUniform<number>>>(),thicknesses=new Map<T.Material,number>();
   let swapped=false;
   for(const side of sides){
    // A common immutable parsed asset fixes image decoding and object creation
    // order. Each side/state owns its skeleton, materials and mutable controls.
    const root=clone(gltf.scene),copies=new Map<T.Material,T.Material>();
    root.traverse(object=>{if(object instanceof T.Mesh){
     const copy=(material:T.Material)=>{let result=copies.get(material);if(!result){result=material.clone();result.onBeforeCompile=material.onBeforeCompile;result.customProgramCacheKey=material.customProgramCacheKey;copies.set(material,result);}return result;};
     object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
    }});
    const vehicle=kind==='hover'?root.getObjectByName('HoverBikeRoot'):root;
    assert(vehicle,'Actual HoverBikeRoot missing');
    if(kind==='wheel')vehicle.scale.setScalar(HUMAN_PROFILE.wheelScale);
    let mixer:T.AnimationMixer|undefined;
    if(kind==='hover'){
     const clip=gltf.animations.find(animation=>animation.name.includes('Ride_Steer'));
     if(clip){mixer=new T.AnimationMixer(root);mixer.clipAction(clip).play();mixer.setTime(clip.duration*.5);}
    }
    root.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    applyRealisticMaterials(root,kind==='wheel'?'actor':'');
    const selectedSources:Source[]=[];
    vehicle.traverse(object=>{if(object instanceof T.Mesh&&selected(object.name,kind)){
     assert(!Array.isArray(object.material)&&object.material instanceof T.MeshStandardMaterial,'Unexpected actual glow source material');selectedSources.push(object as Source);
    }});
    assert(JSON.stringify(selectedSources.map(source=>[source.name,source.geometry.attributes.position.count,source.geometry.index?.count]))===JSON.stringify(inventories[kind]),'Actual glow geometry inventory changed: '+kind);
    const geometryProofs=[];for(const source of selectedSources)geometryProofs.push(await geometryEvidence(source));
    factories[side].glowVehicle(vehicle,kind);
    const shells=selectedSources.flatMap(source=>{
     assert(source.children.length===2,'Factory did not produce exactly two ordered shells: '+source.name);
     return source.children.map((object,index)=>{
      assert(object instanceof T.Mesh&&object.material instanceof T.MeshBasicMaterial,'Actual glow shell missing');
      const halo=object as Halo;assert(halo.geometry===source.geometry&&halo.name==='LED halo'&&halo.parent===source,'Actual factory geometry/parenting changed');
      const thickness=Number([.018,.045][index].toFixed(3));thicknesses.set(halo.material,thickness);
      if(side==='candidate'){
       const before=halo.material.onBeforeCompile,bindings=new Set<T.IUniform<number>>();uniforms.set(halo.material,bindings);
       halo.material.onBeforeCompile=function(shader,renderer){
        before.call(this,shader,renderer);const uniform=shader.uniforms.referenceGlowThickness as T.IUniform<number>;
        assert(uniform&&uniform.value===thickness,'Candidate did not initialize the original rounded thickness');bindings.add(uniform);
        if(swapped)uniform.value=thickness===.018?.045:.018;
       };
      }
      return halo;
     });
    });
    assert(shells.length===(kind==='wheel'?8:12),'Actual halo draw inventory changed');
    sources[side]=selectedSources;halos[side]=shells;proofs[side]=geometryProofs;familyMaterials[side]=shells.map(halo=>halo.material);
    originalControls[side]=selectedSources.map(source=>({color:source.material.emissive.clone(),intensity:source.material.emissiveIntensity}));
    assert(originalControls[side].some(control=>control.intensity>0),'Authored halo state has no emissive source');
    root.updateMatrixWorld(true);bounds[side]=new T.Box3().setFromObject(vehicle);item.objects[side]=root;retained.push(gltf,mixer,assetBytes,geometryProofs);
   }
   assert(JSON.stringify(proofs.baseline.map(row=>row.receipt))===JSON.stringify(proofs.candidate.map(row=>row.receipt)),'Baseline/candidate actual geometry bytes differ');
   assert(bounds.baseline.equals(bounds.candidate),'Baseline/candidate vehicle bounds differ');
   const sphere=bounds.baseline.getBoundingSphere(new T.Sphere()),centre=sphere.center,radius=Math.max(.25,sphere.radius);
   const cameraPosition=(direction:number[],distance:number)=>new T.Vector3(...direction as [number,number,number]).normalize().multiplyScalar(radius*distance).add(centre).toArray() as [number,number,number];
   item.camera={far:Math.max(80,radius*30),positions:[cameraPosition([1.25,.75,1.8],3.4),cameraPosition([-1.8,.5,-1.25],4.8)],target:centre.toArray() as [number,number,number]};
   item.pose=()=>{for(const side of sides)for(const [i,source]of sources[side].entries()){
    if(controlState==='authored'){source.material.emissive.copy(originalControls[side][i].color);source.material.emissiveIntensity=originalControls[side][i].intensity;}
    else{source.material.emissive.setRGB(.2,.4,.6);source.material.emissiveIntensity=controlState==='off'?0:.5;}
   }};
   item.familyMaterials=familyMaterials;
   item.expectedUniform=(material,name)=>{assert(name==='referenceGlowThickness'&&thicknesses.has(material),'Unknown halo receipt binding');const value=thicknesses.get(material)!;return swapped?(value===.018?.045:.018):value;};
   item.setNegativeControl=enabled=>{swapped=enabled;for(const [material,bindings]of uniforms){const value=thicknesses.get(material)!;for(const uniform of bindings)uniform.value=enabled?(value===.018?.045:.018):value;}};
   item.contribution={expected:controlState==='off'?'none':'visible',setVisible:(side,visible)=>{for(const halo of halos[side])halo.visible=visible;},state:()=>{
    for(const side of sides){for(const proof of proofs[side])proof.checks();for(const [index,halo]of halos[side].entries()){
     const source=sources[side][Math.floor(index/2)],material=halo.material;
     assert(halo.geometry===source.geometry&&halo.parent===source&&source.children[index%2]===halo,'Actual shell geometry/order changed');
     assert(material.transparent&&material.blending===T.AdditiveBlending&&!material.depthWrite&&material.depthTest&&material.side===T.BackSide&&!material.toneMapped&&!halo.castShadow&&!halo.receiveShadow,'Original halo native state changed');
    }}
    return {kind,controlState,asset,swapped,haloCount:halos.candidate.length,geometryUnchanged:true,sourceGeometry:Object.fromEntries(sides.map(side=>[side,proofs[side].map(row=>row.receipt)])),controls:Object.fromEntries(sides.map(side=>[side,sources[side].map(source=>({source:source.name,color:source.material.emissive.toArray(),intensity:source.material.emissiveIntensity}))]))};
   }};
   item.pose(0);result.push(item);
  }
 }
 assert(result.length===6,'Vehicle glow case inventory changed');return result;
}
