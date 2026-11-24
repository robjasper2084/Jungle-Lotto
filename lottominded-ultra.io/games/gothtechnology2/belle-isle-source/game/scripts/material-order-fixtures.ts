import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import * as atmosphereCandidate from '../src/belle/worldAtmosphere.ts';
import * as surfaceCandidate from '../src/belle/realisticMaterials.ts';
import {createPose} from '../runtime/ride-core/src/controller.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import {REFERENCE_STYLE} from '../src/belle/sunsetReferencePolicy.ts';
import type {ThreeRiderView} from '../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
import type {FamilyCase,Side} from './program-family-fixtures.ts';
// @ts-expect-error Exact pure318 source supplied and retained by the driver.
import * as atmosphereBaselineImport from 'virtual:belle-order-atmosphere-baseline';
// @ts-expect-error Exact pure318 source supplied and retained by the driver.
import * as surfaceBaselineImport from 'virtual:belle-order-surface-baseline';
// @ts-expect-error Actual constructor spans extracted from complete source files.
import * as baselineContractsImport from 'virtual:belle-order-contracts-baseline';
// @ts-expect-error Actual constructor spans extracted from complete source files.
import * as candidateContractsImport from 'virtual:belle-order-contracts-candidate';
// @ts-expect-error The driver hashes and serves the actual shipped GLBs.
import heroAssetImport from 'virtual:belle-hero-index-asset';
// @ts-expect-error The driver hashes and serves the actual shipped GLBs.
import glowAssetsImport from 'virtual:belle-glow-assets';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Owner=InstanceType<typeof atmosphereCandidate.WorldAtmosphere>;
type StandardMesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Asset={url:string;bytes:number;sha256:string;kind?:string};
type Contracts={cloudTexture:()=>T.DataTexture;createStation:(scene:T.Scene,sky:unknown)=>{root?:T.Group;update:(time:number,night:number)=>void};createActor:(scene:T.Scene,rider:GLTF,wheel:GLTF,terrain:unknown,core:unknown,world:unknown)=>ThreeRiderView};
type NativeProgram={id:number;program:WebGLProgram};
type MaterialProperties={currentProgram?:NativeProgram;uniforms?:Record<string,T.IUniform>};
type Binding={material:T.MeshStandardMaterial;shaders:Set<Shader>;profile:[number,number,number];surface:string;role:'late'|'reference';owner:Owner};
const sides:Side[]=['baseline','candidate'];
const atmospheres:Record<Side,typeof atmosphereCandidate>={baseline:atmosphereBaselineImport,candidate:atmosphereCandidate};
const surfaces:Record<Side,typeof surfaceCandidate>={baseline:surfaceBaselineImport,candidate:surfaceCandidate};
const contracts:Record<Side,Contracts>={baseline:baselineContractsImport,candidate:candidateContractsImport};
const retained:unknown[]=[];
const identities=new WeakMap<object,number>();let nextIdentity=1;
const identity=(value:object)=>{let id=identities.get(value);if(!id){id=nextIdentity++;identities.set(value,id);}return id;};
const names=['skinProfile','skinPlanar','belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength'];
const controlledProfile:[number,number,number]=[.25,.92,.035];
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
function texturePath(texture:T.Texture){const image=texture.image as HTMLImageElement;return new URL(image.currentSrc||image.src,location.href).pathname;}
async function asset(asset:Asset){
 const response=await fetch(asset.url);assert(response.ok,'Actual order asset request failed: '+asset.url);
 const bytes=new Uint8Array(await response.arrayBuffer());assert(bytes.length===asset.bytes&&await digest(bytes)===asset.sha256,'Actual order asset bytes differ');
 const result=await new GLTFLoader().parseAsync(bytes.slice().buffer,asset.url.slice(0,asset.url.lastIndexOf('/')+1));retained.push(result,bytes);return result;
}
function independentAsset(original:GLTF):GLTF{
 const scene=clone(original.scene),materials=new Map<T.Material,T.Material>();
 scene.traverse(object=>{if(object instanceof T.Mesh){const copy=(material:T.Material)=>{let value=materials.get(material);if(!value){value=material.clone();value.onBeforeCompile=material.onBeforeCompile;value.customProgramCacheKey=material.customProgramCacheKey;materials.set(material,value);}return value;};object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);}});
 assert(scene instanceof T.Group,'Actual GLTF scene root must remain a Group');return {...original,scene};
}
async function geometryReceipt(meshes:StandardMesh[]){
 const result=[];
 for(const mesh of meshes){const geometry=mesh.geometry,attributes=[];
  for(const [name,attribute]of [...Object.entries(geometry.attributes),...(geometry.index?[['index',geometry.index] as const]:[])]){
   const interleaved=attribute as T.InterleavedBufferAttribute,bytes=new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
   attributes.push({name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,arrayType:attribute.array.constructor.name,stride:interleaved.isInterleavedBufferAttribute?interleaved.data.stride:null,offset:interleaved.isInterleavedBufferAttribute?interleaved.offset:null,sha256:await digest(bytes)});
  }
  result.push({mesh:mesh.name,attributes,groups:geometry.groups,drawRange:{start:geometry.drawRange.start,count:String(geometry.drawRange.count)},matrix:mesh.matrixWorld.toArray()});
 }
 return result;
}

/** Actual constructor/asset proof under controlled fixture lighting. The wheel
 * is deliberately unbatched: the measured ordinary rubber program has no
 * BELLE_ORIGINAL_SURFACE_COORDS axis. The whole vehicle remains visible. */
export async function createMaterialOrderCases(renderer:T.WebGLRenderer):Promise<FamilyCase[]>{
 await surfaces.baseline.loadRealisticMaterials(renderer);
 const rig=await asset(heroAssetImport as Asset),wheelManifest=(glowAssetsImport as Asset[]).find(row=>row.kind==='wheel');assert(wheelManifest,'Actual wheel manifest missing');
 const wheel=await asset(wheelManifest),result:FamilyCase[]=[];
 for(const kind of ['station','wheel'] as const){
  const family='order-'+kind,lateId=family+'-late',referenceId=family+'-reference';
  const owners={} as Record<Side,Owner>,scenes={} as Record<Side,T.Scene>,references={} as Record<Side,StandardMesh>,lateObjects={} as Record<Side,T.Object3D>;
  const lateMeshes={} as Record<Side,StandardMesh[]>,lateMaterials={} as Record<Side,T.Material[]>,referenceMaterials={} as Record<Side,T.Material[]>;
  const actors:Partial<Record<Side,ThreeRiderView>>={},stations:Partial<Record<Side,ReturnType<Contracts['createStation']>>>={};
  const bindings=new Map<T.Material,Binding>(),rows:Record<Side,unknown[]>={baseline:[],candidate:[]},controls=new Map<T.IUniform,unknown>();
  const expectedSide=kind==='station'?T.FrontSide:T.DoubleSide;
  let phase=0,control=false;
  const direction=(p:number)=>new T.Vector3(p===0?.41:-.27,.84,p===0?.35:.46).normalize();
  const expected=(binding:Binding,name:string)=>{
   if(name==='skinProfile')return new T.Vector3(...(control&&binding.role==='late'&&bindings.get(binding.material)===binding&&lateMaterials.candidate.includes(binding.material)?controlledProfile:binding.profile));
   if(name==='skinPlanar')return false;
   if(name==='belleSunDirection')return direction(phase);
   if(name==='belleCloudTime')return phase===0?17:29;
   if(name==='belleCloudCoverage')return phase===0?.37:.61;
   if(name==='belleCloudStrength')return phase===0?.21:.33;
   throw Error('Unknown order uniform '+name);
  };
  const applyControl=(binding:Binding,shader:Shader)=>{
   if(!control||binding.role!=='late'||!lateMaterials.candidate.includes(binding.material))return;
   const referenceBinding=bindings.get(referenceMaterials.candidate[0]);assert(referenceBinding,'Reference material binding missing');
   const referenceShader=[...referenceBinding.shaders].at(-1);assert(referenceShader,'Earlier reference must render before the order control');
   for(const name of ['skinProfile','skinColor','skinDetail']){
    const uniform=shader.uniforms[name];assert(uniform,'Order control input missing');if(!controls.has(uniform))controls.set(uniform,uniform.value);
    uniform.value=name==='skinProfile'?new T.Vector3(...controlledProfile):referenceShader.uniforms[name].value;
   }
  };
  const hook=(material:T.MeshStandardMaterial,owner:Owner,role:'late'|'reference')=>{
   const profile=role==='reference'?[.6,.32,.008] as [number,number,number]:kind==='station'?[6,0,.0005] as [number,number,number]:[9,0,.002] as [number,number,number];
   const binding:Binding={material,owner,role,profile,surface:role==='reference'?'concrete':kind==='station'?'paint':'rubber',shaders:new Set()};bindings.set(material,binding);
   const previous=material.onBeforeCompile;material.onBeforeCompile=function(shader,r){previous.call(this,shader,r);binding.shaders.add(shader);applyControl(binding,shader);};
  };
  const installReceipt=(mesh:StandardMesh,side:Side)=>{
   const previous=mesh.onAfterRender;mesh.onAfterRender=function(...args){previous.apply(this,args);
    const material=args[4];assert(!Array.isArray(material),'Order material must be scalar');const binding=bindings.get(material);if(!binding)return;
    const properties=renderer.properties.get(material) as MaterialProperties,program=properties.currentProgram,table=properties.uniforms;
    assert(program&&table,'Actual order material has no native program/table');assert([...binding.shaders].some(shader=>shader.uniforms===table),'Renderer selected an unobserved order uniform table');
    const gl=renderer.getContext() as WebGL2RenderingContext;assert(gl.getParameter(gl.CURRENT_PROGRAM)===program.program,'Order receipt is not at its actual submitted program');
    const values:Record<string,unknown>={};
    for(const name of names){
     const value=expected(binding,name),location=gl.getUniformLocation(program.program,name);assert(location!==null,'Inactive order uniform '+name);
     const actual=gl.getUniform(program.program,location),want=typeof value==='boolean'?value:typeof value==='number'?Math.fround(value):value.toArray().map(Math.fround),got=typeof value==='boolean'?Boolean(actual):typeof value==='number'?actual:Array.from(actual);
     assert(JSON.stringify(got)===JSON.stringify(want),'Wrong order uniform '+name);values[name]={expected:want,observed:got};
    }
    const ownerObjectsMatch=['belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength','belleCloudNoise'].every(name=>table[name]===(binding.owner.uniforms as unknown as Record<string,T.IUniform>)[name]);
    assert(ownerObjectsMatch,'Order material captured a different owner uniform');
    const samplers=[];const priorTexture=gl.getParameter(gl.ACTIVE_TEXTURE);
    try{for(const name of ['skinColor','skinDetail','belleCloudNoise']){
     const location=gl.getUniformLocation(program.program,name);assert(location!==null,'Inactive order sampler '+name);const unit=Number(gl.getUniform(program.program,location));
     const texture=table[name]?.value as T.Texture;assert(texture instanceof T.Texture,'Order sampler texture missing');
     const changed=control&&side==='candidate'&&binding.role==='late',surface=changed?'concrete':binding.surface;
     const expectedUrl=name==='belleCloudNoise'?null:'/belle/skins/'+surface+(name==='skinColor'?'-color.webp':'-detail.webp');
     const observedUrl=name==='belleCloudNoise'?null:texturePath(texture);assert(expectedUrl===observedUrl,'Wrong order surface texture '+name);
     const expectedTexture=(renderer.properties.get(texture) as {__webglTexture?:WebGLTexture}).__webglTexture;assert(expectedTexture,'Order texture has no native object');
     gl.activeTexture(gl.TEXTURE0+unit);const bound=gl.getParameter(gl.TEXTURE_BINDING_2D);assert(bound===expectedTexture,'Wrong actual order sampler binding');
     if(name==='belleCloudNoise')assert(texture===binding.owner.uniforms.belleCloudNoise.value,'Wrong actual owner cloud texture');
     samplers.push({name,unit,textureId:texture.id,expectedUrl,observedUrl,boundExpected:true});
    }}finally{gl.activeTexture(priorTexture);}
    assert(gl.getParameter(gl.ACTIVE_TEXTURE)===priorTexture,'Order sampler query changed active texture');
    rows[side].push({mesh:mesh.name,materialId:(material as T.Material&{id:number}).id,programId:program.id,role:binding.role,side:material.side,tableId:identity(table),profileUniformId:identity(table.skinProfile),ownerId:identity(binding.owner),ownerObjectsMatch,baseIsStandard:material.userData.realisticBaseIsStandard,profile:material.userData.realisticProfile,values,samplers,activeTextureRestored:true});
   };
  };
  for(const side of sides){
   const scene=new T.Scene(),owner=new atmospheres[side].WorldAtmosphere(scene,contracts[side].cloudTexture());owners[side]=owner;scenes[side]=scene;
   const reference=new T.Mesh(new T.BoxGeometry(1.1,1.2,1.1,3,3,3),new T.MeshStandardMaterial({name:'ordinary concrete',side:expectedSide,color:0xb9a58b,roughness:.6}));reference.position.y=.65;reference.castShadow=reference.receiveShadow=true;scene.add(reference);
   await Promise.resolve();surfaces[side].applyRealisticMaterials(reference);references[side]=reference;
   const sky={prepareMaterial:(...args:Parameters<Owner['prepareMaterial']>)=>owner.prepareMaterial(...args)};
   if(kind==='station'){
    const station=contracts[side].createStation(scene,sky);stations[side]=station;const root=station.root??scene.getObjectByName('Coast Guard Station Belle Isle');assert(root,'Actual station root missing');
    surfaces[side].applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);if(REFERENCE_STYLE)dressSunsetGround(scene);lateObjects[side]=root;
   }else{
    const terrain={sampleGround(_x:number,_z:number,out:object){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});}};
    const hero=contracts[side].createActor(scene,independentAsset(rig),independentAsset(wheel),terrain,{current:createPose()},{sky});actors[side]=hero;
    hero.lights.update(createPose(),false,0);hero.rider.visible=false;lateObjects[side]=hero.vehicle;
   }
   await Promise.resolve();scene.updateMatrixWorld(true);
   const selected:StandardMesh[]=[];lateObjects[side].traverse(object=>{if(object instanceof T.Mesh&&!Array.isArray(object.material)&&object.material instanceof T.MeshStandardMaterial&&object.material.name===(kind==='station'?'Station white painted cladding':'EUC_Rubber')&&object.material.userData.realisticProfile===(kind==='station'?'paint':'rubber')+'|triplanar')selected.push(object as StandardMesh);});
   assert(selected.length===(kind==='station'?2:6),'Actual dressed order target inventory changed: '+kind);
   lateMeshes[side]=selected;lateMaterials[side]=[...new Set(selected.map(mesh=>mesh.material))];referenceMaterials[side]=[reference.material];assert(lateMaterials[side].length===1,'Actual target should share its original surface material');
   for(const material of lateMaterials[side]){assert(material.side===expectedSide,'Native side changed');hook(material as T.MeshStandardMaterial,owner,'late');}
   hook(reference.material,owner,'reference');for(const mesh of [...selected,reference])installReceipt(mesh,side);
   // Keep the actual constructor scene and hero parent chain intact. Only the
   // ordinary reference leaves that scene after its owner dressing is complete.
   scene.remove(reference);retained.push(scene,owner,actors[side],stations[side]);
  }
  const receipts={baseline:await geometryReceipt(lateMeshes.baseline),candidate:await geometryReceipt(lateMeshes.candidate)};
  assert(JSON.stringify(receipts.baseline)===JSON.stringify(receipts.candidate),'Actual order geometry/transform bytes changed');
  const count=(side:Side)=>new Set([...lateMaterials[side],...referenceMaterials[side]].map(material=>material.customProgramCacheKey())).size;
  assert(count('baseline')===2&&count('candidate')===1,'Actual order custom key count did not reduce2→1');
  const pose=(view:number)=>{phase=view;for(const side of sides){const owner=owners[side];owner.uniforms.belleSunDirection.value.copy(direction(view));owner.uniforms.belleCloudTime.value=view===0?17:29;owner.uniforms.belleCloudCoverage.value=view===0?.37:.61;owner.uniforms.belleCloudStrength.value=view===0?.21:.33;owner.uniforms.belleAirStrength.value=.16;
   stations[side]?.update(view===0?1.25:6.75,0);if(actors[side]){actors[side]!.apply(createPose());actors[side]!.lights.update(createPose(),false,0);}scenes[side].updateMatrixWorld(true);
  }};
  const nativeProof=(role:'late'|'reference')=>({reset:(side:Side)=>{rows[side].length=0;},state:(side:Side)=>({kind:'material-order',family,role,referenceCaseId:referenceId,control:control&&side==='candidate'&&role==='late',phase,expectedSide,sourceScope:kind==='wheel'?'Actual ThreeRiderView source vehicle; no wheel/ink batching':'Actual addCoastGuard scene/root',selectedMeshes:role==='late'?lateMeshes[side].map(mesh=>mesh.name):[references[side].name],geometry:role==='late'?receipts[side]:undefined,wheelLights:actors[side]?.lights.status,rows:[...rows[side]]})});
  const common={family,expectedBaselinePrograms:2,decorateSurface:false,familyUniformNames:names,requiredUniforms:names,pose,expectedUniform:(material:T.Material,name:string)=>{const binding=bindings.get(material);assert(binding,'Unknown actual order material');return expected(binding,name);}};
  const late:FamilyCase={...common,id:lateId,objects:scenes,familyMaterials:lateMaterials,nativeProof:nativeProof('late'),setNegativeControl:enabled=>{control=enabled;if(enabled){for(const material of lateMaterials.candidate){const binding=bindings.get(material)!;for(const shader of binding.shaders)applyControl(binding,shader);}}else{for(const [uniform,value]of controls)uniform.value=value;controls.clear();}}};
  const reference:FamilyCase={...common,id:referenceId,objects:references,familyMaterials:referenceMaterials,nativeProof:nativeProof('reference')};
  const bounds=new T.Box3();for(const mesh of lateMeshes.baseline)bounds.expandByObject(mesh);const sphere=bounds.getBoundingSphere(new T.Sphere()),radius=Math.max(.25,sphere.radius),center=sphere.center;
  const position=(direction:[number,number,number],distance:number)=>new T.Vector3(...direction).normalize().multiplyScalar(radius*distance).add(center).toArray() as [number,number,number];
  late.camera={far:Math.max(80,radius*20),positions:kind==='station'?[position([1,.65,1.5],2.8),position([-1,.45,-1.5],3.4)]:[position([1.25,.75,1.8],3.4),position([-1.8,.5,-1.25],4.8)],target:center.toArray() as [number,number,number]};
  pose(0);result.push(late,reference);
 }
 assert(result.length===4,'Material order case inventory changed');return result;
}
