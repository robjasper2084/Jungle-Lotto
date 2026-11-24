import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import {REFERENCE_STYLE} from '../src/belle/sunsetReferencePolicy.ts';
import {createPose} from '../runtime/ride-core/src/controller.ts';
import type {ThreeRiderView} from '../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
import type {BoatRide} from '../src/belle/boatRide.ts';
import type {FamilyCase,Side} from './program-family-fixtures.ts';
// @ts-expect-error Exact pure043 and candidate constructor spans supplied by the driver.
import * as beforeImport from 'virtual:belle-boat-order-contracts-baseline';
// @ts-expect-error Exact pure043 and candidate constructor spans supplied by the driver.
import * as afterImport from 'virtual:belle-boat-order-contracts-candidate';
// @ts-expect-error Complete shipped assets are pinned, retained and served by the driver.
import assetsImport from 'virtual:belle-boat-order-assets';
// @ts-expect-error These existing complete assets retain their original source pins.
import heroAssetImport from 'virtual:belle-hero-index-asset';
// @ts-expect-error These existing complete assets retain their original source pins.
import glowAssetsImport from 'virtual:belle-glow-assets';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Mesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Asset={url:string;bytes:number;sha256:string;kind?:string};
type Station={root?:T.Group;update:(time:number,night:number)=>void};
type Contracts={cloudTexture:()=>T.DataTexture;createStation:(scene:T.Scene,sky:unknown)=>Station;createActor:(scene:T.Scene,rider:GLTF,wheel:GLTF,terrain:unknown,core:unknown,world:unknown)=>ThreeRiderView;createBoats:(scene:T.Scene,terrain:unknown,hero:ThreeRiderView,world:unknown,boatAssets:GLTF[])=>BoatRide};
type Kind='response'|'offshore'|'hydroplane'|'reference';
type Binding={material:T.MeshStandardMaterial;owner:WorldAtmosphere;kind:Kind;profile:[number,number,number];surface:string;shaders:Set<Shader>;side:Side};
type Properties={currentProgram?:{id:number;program:WebGLProgram};uniforms?:Record<string,T.IUniform>};
const contracts:Record<Side,Contracts>={baseline:beforeImport,candidate:afterImport};
const sides:Side[]=['baseline','candidate'];
const retained:unknown[]=[];
const ids=new WeakMap<object,number>();let nextId=1;
const identity=(value:object)=>{let id=ids.get(value);if(!id){id=nextId++;ids.set(value,id);}return id;};
const uniformNames=['skinProfile','skinPlanar','belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength'];
const profileFor=(kind:Kind):[number,number,number]=>kind==='reference'?[.6,.32,.008]:kind==='response'?[6,0,.0005]:kind==='offshore'?[12,0,.001]:[9,0,.002];
const surfaceFor=(kind:Kind)=>kind==='reference'?'concrete':kind==='response'?'paint':kind==='offshore'?'leather':'rubber';
const controlledProfile:[number,number,number]=[.25,.92,.035];
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
const texturePath=(texture:T.Texture)=>{const image=texture.image as HTMLImageElement;return new URL(image.currentSrc||image.src,location.href).pathname;};
async function loadAsset(asset:Asset){
 const response=await fetch(asset.url);assert(response.ok,'Actual boat-order asset unavailable: '+asset.url);
 const bytes=new Uint8Array(await response.arrayBuffer());assert(bytes.length===asset.bytes&&await hash(bytes)===asset.sha256,'Actual boat-order asset identity changed');
 const value=await new GLTFLoader().parseAsync(bytes.slice().buffer,asset.url.slice(0,asset.url.lastIndexOf('/')+1));retained.push(value,bytes);return value;
}
function copyAsset(source:GLTF):GLTF{
 const scene=clone(source.scene),materials=new Map<T.Material,T.Material>();
 scene.traverse(object=>{if(object instanceof T.Mesh){const copy=(material:T.Material)=>{let value=materials.get(material);if(!value){value=material.clone();value.onBeforeCompile=material.onBeforeCompile;value.customProgramCacheKey=material.customProgramCacheKey;materials.set(material,value);}return value;};object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);}});
 assert(scene instanceof T.Group,'Actual boat-order asset root changed');return {...source,scene};
}
function meshes(root:T.Object3D){const values:T.Mesh[]=[];root.traverse(object=>{if(object instanceof T.Mesh)values.push(object);});return values;}
async function geometry(root:T.Object3D){
 const records=[];root.updateMatrixWorld(true);
 for(const [slot,mesh]of meshes(root).entries()){
  const attributes=[];for(const [name,value]of [...Object.entries(mesh.geometry.attributes),...(mesh.geometry.index?[['index',mesh.geometry.index] as const]:[])]){
   const interleaved=value as T.InterleavedBufferAttribute;attributes.push({name,itemSize:value.itemSize,count:value.count,normalized:value.normalized,arrayType:value.array.constructor.name,stride:interleaved.isInterleavedBufferAttribute?interleaved.data.stride:null,offset:interleaved.isInterleavedBufferAttribute?interleaved.offset:null,sha256:await hash(new Uint8Array(value.array.buffer,value.array.byteOffset,value.array.byteLength))});
  }
  records.push({slot,name:mesh.name,attributes,groups:mesh.geometry.groups,drawRange:{start:mesh.geometry.drawRange.start,count:String(mesh.geometry.drawRange.count)},matrix:mesh.matrixWorld.toArray(),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,visible:mesh.visible,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(material=>({name:material.name,type:material.type,side:material.side,transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite,depthTest:material.depthTest,alphaTest:material.alphaTest,profile:material.userData.realisticProfile??null,baseIsStandard:material.userData.realisticBaseIsStandard??null}))});
 }
 return records;
}
function boundsFor(root:T.Object3D){const bounds=new T.Box3();root.updateMatrixWorld(true);root.traverseVisible(object=>{if(object instanceof T.Mesh)bounds.expandByObject(object);});assert(!bounds.isEmpty(),'Actual boat has no visible bounds');return bounds;}

/** Actual response factory and both complete BoatRide assets. The BoatRide
 * constructor performs its real dock setup. Afterwards each complete asset is
 * attached to its own fixture case without changing its authored/docked matrix;
 * BoatRide, its original scene, hidden cloned riders and unused effects remain
 * alive. No original boat geometry, material or shader is substituted. */
export async function createBoatOrderCases(renderer:T.WebGLRenderer):Promise<FamilyCase[]>{
 await loadRealisticMaterials(renderer);
 const assets=assetsImport as Asset[],offshore=assets.find(asset=>asset.kind==='offshore'),hydroplane=assets.find(asset=>asset.kind==='hydroplane');assert(offshore&&hydroplane,'Both actual boat assets are required');
 const wheel=(glowAssetsImport as Asset[]).find(asset=>asset.kind==='wheel');assert(wheel,'Actual rider wheel asset missing');
 const originals={rig:await loadAsset(heroAssetImport as Asset),wheel:await loadAsset(wheel),offshore:await loadAsset(offshore),hydroplane:await loadAsset(hydroplane)};
 // BoatRide's actual UI constructor requires this ordinary navigation host.
 // It is hidden only in the isolated validation page; no game UI is replaced.
 const navigation=document.createElement('header');navigation.hidden=true;navigation.append(document.createElement('nav'));document.body.append(navigation);retained.push(navigation);
 const result:FamilyCase[]=[];
 for(const familyKind of ['response','ride'] as const){
  const family='boat-order-'+familyKind,referenceId=family+'-reference',kinds:Exclude<Kind,'reference'>[]=familyKind==='response'?['response']:['offshore','hydroplane'];
  const expectedSide=familyKind==='response'?T.FrontSide:T.DoubleSide;
  const owners={} as Record<Side,WorldAtmosphere>,scenes={} as Record<Side,T.Scene>,references={} as Record<Side,Mesh>;
  const objects:Record<string,Record<Side,T.Object3D>>={},selected:Record<string,Record<Side,Mesh[]>>={},materials:Record<string,Record<Side,T.Material[]>>={};
  const stations:Partial<Record<Side,Station>>={},rides:Partial<Record<Side,BoatRide>>={},actors:Partial<Record<Side,ThreeRiderView>>={};
  const bindings=new Map<T.Material,Binding>(),saved=new Map<T.IUniform,unknown>();
  const rows:Record<Side,unknown[]>={baseline:[],candidate:[]},allRows:Record<Side,unknown[]>={baseline:[],candidate:[]};
  const snapshots:Record<string,Record<Side,Awaited<ReturnType<typeof geometry>>>>={};
  let phase=0,control=false,activeKind:Kind=familyKind==='response'?'response':'offshore';
  const direction=(view:number)=>new T.Vector3(view===0?.41:-.27,.84,view===0?.35:.46).normalize();
  const input=(binding:Binding,name:string)=>{
   if(name==='skinProfile')return new T.Vector3(...(control&&binding.side==='candidate'&&binding.kind!=='reference'?controlledProfile:binding.profile));
   if(name==='skinPlanar')return false;
   if(name==='belleSunDirection')return direction(phase);
   if(name==='belleCloudTime')return phase===0?17:29;
   if(name==='belleCloudCoverage')return phase===0?.37:.61;
   if(name==='belleCloudStrength')return phase===0?.21:.33;
   throw Error('Unknown boat-order uniform '+name);
  };
  const applyControl=(binding:Binding,shader:Shader)=>{
   if(!control||binding.side!=='candidate'||binding.kind==='reference')return;
   const reference=bindings.get(references.candidate.material),source=reference&&[...reference.shaders].at(-1);assert(source,'Reference must draw before boat control');
   for(const name of ['skinProfile','skinColor','skinDetail']){const uniform=shader.uniforms[name];assert(uniform,'Boat control uniform missing');if(!saved.has(uniform))saved.set(uniform,uniform.value);uniform.value=name==='skinProfile'?new T.Vector3(...controlledProfile):source.uniforms[name].value;}
  };
  const hook=(material:T.MeshStandardMaterial,owner:WorldAtmosphere,kind:Kind,side:Side)=>{
   const binding:Binding={material,owner,kind,side,profile:profileFor(kind),surface:surfaceFor(kind),shaders:new Set()};bindings.set(material,binding);
   const previous=material.onBeforeCompile;material.onBeforeCompile=function(shader,r){previous.call(this,shader,r);binding.shaders.add(shader);applyControl(binding,shader);};
  };
  const install=(root:T.Object3D,side:Side,kind:Kind)=>{
   for(const [slot,mesh]of meshes(root).entries()){
    const previous=mesh.onAfterRender;mesh.onAfterRender=function(...args){previous.apply(this,args);
     const material=args[4],properties=renderer.properties.get(material) as Properties,program=properties.currentProgram,table=properties.uniforms;assert(program&&table,'Actual boat draw has no program/table');
     const gl=renderer.getContext() as WebGL2RenderingContext;assert(gl.getParameter(gl.CURRENT_PROGRAM)===program.program,'Boat receipt is not at its actual draw');
     const observed:Record<string,unknown>={};for(const name of uniformNames){const location=gl.getUniformLocation(program.program,name);if(location!==null){const value=gl.getUniform(program.program,location);observed[name]=typeof value==='number'||typeof value==='boolean'?value:Array.from(value);}}
     allRows[side].push({kind,slot,mesh:mesh.name,materialName:material.name,materialType:material.type,materialId:(material as T.Material&{id:number}).id,programId:program.id,group:(args[5] as unknown as {materialIndex?:number}|null)?.materialIndex??0,side:material.side,profile:material.userData.realisticProfile??null,uniforms:observed});
     const binding=bindings.get(material);if(!binding)return;
     assert([...binding.shaders].some(shader=>shader.uniforms===table),'Actual boat selected an unobserved uniform table');
     const values:Record<string,unknown>={};for(const name of uniformNames){const location=gl.getUniformLocation(program.program,name);assert(location!==null,'Inactive boat input '+name);const expected=input(binding,name),value=gl.getUniform(program.program,location),want=typeof expected==='boolean'?expected:typeof expected==='number'?Math.fround(expected):expected.toArray().map(Math.fround),got=typeof expected==='boolean'?Boolean(value):typeof expected==='number'?value:Array.from(value);assert(JSON.stringify(want)===JSON.stringify(got),'Wrong actual boat input '+name);values[name]={expected:want,observed:got};}
     const ownerObjectsMatch=['belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength','belleCloudNoise'].every(name=>table[name]===(binding.owner.uniforms as unknown as Record<string,T.IUniform>)[name]);assert(ownerObjectsMatch,'Boat uniform owner changed');
     const samplers=[],active=gl.getParameter(gl.ACTIVE_TEXTURE);try{for(const name of ['skinColor','skinDetail','belleCloudNoise']){
      const location=gl.getUniformLocation(program.program,name);assert(location!==null,'Inactive boat sampler '+name);const unit=Number(gl.getUniform(program.program,location)),texture=table[name].value as T.Texture;assert(texture instanceof T.Texture,'Missing boat sampler texture');
      const surface=control&&side==='candidate'&&kind!=='reference'?'concrete':binding.surface,expectedUrl=name==='belleCloudNoise'?null:'/belle/skins/'+surface+(name==='skinColor'?'-color.webp':'-detail.webp'),observedUrl=name==='belleCloudNoise'?null:texturePath(texture);assert(expectedUrl===observedUrl,'Boat surface texture changed');
      const native=(renderer.properties.get(texture) as {__webglTexture?:WebGLTexture}).__webglTexture;assert(native,'Boat texture has no native object');gl.activeTexture(gl.TEXTURE0+unit);assert(gl.getParameter(gl.TEXTURE_BINDING_2D)===native,'Boat texture binding is stale');if(name==='belleCloudNoise')assert(texture===binding.owner.uniforms.belleCloudNoise.value,'Boat cloud texture owner changed');samplers.push({name,unit,textureId:texture.id,expectedUrl,observedUrl,boundExpected:true});
     }}finally{gl.activeTexture(active);}
     assert(gl.getParameter(gl.ACTIVE_TEXTURE)===active,'Boat query changed texture state');
     rows[side].push({kind,slot,mesh:mesh.name,materialName:material.name,materialId:(material as T.Material&{id:number}).id,programId:program.id,side:material.side,tableId:identity(table),profileUniformId:identity(table.skinProfile),ownerId:identity(binding.owner),ownerObjectsMatch,baseIsStandard:material.userData.realisticBaseIsStandard,profile:material.userData.realisticProfile,values,samplers,activeTextureRestored:true});
    };
   }
  };
  for(const side of sides){
   const scene=new T.Scene(),owner=new WorldAtmosphere(scene,contracts[side].cloudTexture());scenes[side]=scene;owners[side]=owner;
   const reference=new T.Mesh(new T.BoxGeometry(1.1,1.2,1.1,3,3,3),new T.MeshStandardMaterial({name:'ordinary concrete',side:expectedSide,color:0xb9a58b,roughness:.6}));reference.position.y=.65;reference.castShadow=reference.receiveShadow=true;scene.add(reference);await Promise.resolve();applyRealisticMaterials(reference);references[side]=reference;
   const sky={prepareMaterial:(...args:Parameters<WorldAtmosphere['prepareMaterial']>)=>owner.prepareMaterial(...args),nightAmount:{value:0}};
   if(familyKind==='response'){
    const station=contracts[side].createStation(scene,sky);stations[side]=station;const root=station.root??scene.getObjectByName('Coast Guard Station Belle Isle');assert(root,'Actual response station root missing');applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);if(REFERENCE_STYLE)dressSunsetGround(scene);objects.response??={} as Record<Side,T.Object3D>;objects.response[side]=scene;
   }else{
    const terrain={sampleGround(_x:number,_z:number,out:object){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},land:()=>false,raycastFlight:()=>null,raycastCamera:()=>null};
    const hero=contracts[side].createActor(scene,copyAsset(originals.rig),copyAsset(originals.wheel),terrain,{current:createPose()},{sky});hero.lights.update(createPose(),false,0);actors[side]=hero;
    // Match main's async asset load boundary before the real BoatRide constructor.
    await Promise.resolve();const boatAssets=[copyAsset(originals.offshore),copyAsset(originals.hydroplane)];
    const ride=contracts[side].createBoats(scene,terrain,hero,{sky,trafficRay:undefined},boatAssets);rides[side]=ride;hero.root.visible=false;ride.update(0,false,1.25,true);
    for(const [index,kind]of ['offshore','hydroplane'].entries()){objects[kind]??={} as Record<Side,T.Object3D>;objects[kind][side]=boatAssets[index].scene;}
   }
   await Promise.resolve();scene.updateMatrixWorld(true);scene.remove(reference);
   for(const kind of kinds){
    const root=objects[kind][side],name=kind==='response'?'Boat painted hull':kind==='offshore'?'Charcoal marine upholstery':'Hydro cockpit charcoal';
    const picked=meshes(root).filter((mesh):mesh is Mesh=>!Array.isArray(mesh.material)&&mesh.material instanceof T.MeshStandardMaterial&&mesh.material.name===name&&mesh.material.userData.realisticProfile===surfaceFor(kind)+'|triplanar');assert(picked.length===2,'Actual boat target inventory changed: '+kind);
    selected[kind]??={} as Record<Side,Mesh[]>;selected[kind][side]=picked;materials[kind]??={} as Record<Side,T.Material[]>;materials[kind][side]=[...new Set(picked.map(mesh=>mesh.material))];assert(materials[kind][side].length===(kind==='response'?2:1),'Actual boat material sharing changed');
    for(const material of materials[kind][side]){assert(material.side===expectedSide,'Boat material native side changed');hook(material as T.MeshStandardMaterial,owner,kind,side);}
    install(root,side,kind);
   }
   hook(reference.material,owner,'reference',side);install(reference,side,'reference');retained.push(scene,owner,stations[side],rides[side],actors[side]);
  }
  for(const kind of kinds){snapshots[kind]={baseline:await geometry(objects[kind].baseline),candidate:await geometry(objects[kind].candidate)};assert(JSON.stringify(snapshots[kind].baseline)===JSON.stringify(snapshots[kind].candidate),'Full actual boat geometry/material state changed: '+kind);}
  const keys=(side:Side)=>new Set([...kinds.flatMap(kind=>materials[kind][side]),references[side].material].map(material=>material.customProgramCacheKey()));assert(keys('baseline').size===2&&keys('candidate').size===1,'Boat native-compatible key family did not reduce2→1');
  const pose=(kind:Kind,view:number)=>{activeKind=kind;phase=view;for(const side of sides){const owner=owners[side];owner.uniforms.belleSunDirection.value.copy(direction(view));owner.uniforms.belleCloudTime.value=view===0?17:29;owner.uniforms.belleCloudCoverage.value=view===0?.37:.61;owner.uniforms.belleCloudStrength.value=view===0?.21:.33;owner.uniforms.belleAirStrength.value=.16;stations[side]?.update(view===0?1.25:6.75,0);rides[side]?.update(0,false,view===0?1.25:6.75,true);scenes[side].updateMatrixWorld(true);for(const k of kinds)objects[k][side].updateMatrixWorld(true);}};
  const state=(kind:Kind)=>({reset:(side:Side)=>{rows[side].length=0;allRows[side].length=0;},state:(side:Side)=>({kind:'boat-material-order',family,vessel:kind,referenceCaseId:referenceId,phase,control:control&&side==='candidate'&&kind!=='reference',expectedSide,expectedMaterialCount:kind==='response'?2:1,sourceScope:kind==='response'?'Actual addCoastGuard response boats and complete station':kind==='reference'?'Earlier ordinary reference':'Complete shipped '+kind+' through actual BoatRide dock construction',geometry:kind==='reference'?undefined:snapshots[kind][side],selectedMeshes:kind==='reference'?[references[side].name]:selected[kind][side].map(mesh=>mesh.name),rows:[...rows[side]],allRows:[...allRows[side]],activeKind})});
  const common={family,expectedBaselinePrograms:2,decorateSurface:false,familyUniformNames:uniformNames,requiredUniforms:uniformNames,expectedUniform:(material:T.Material,name:string)=>{const binding=bindings.get(material);assert(binding,'Unknown boat family material');return input(binding,name);}};
  for(const kind of kinds){
   const caseId='boat-order-'+kind+'-late',root=objects[kind].baseline;
   const bounds=kind==='response'?new T.Box3():boundsFor(root);if(kind==='response')for(const mesh of selected[kind].baseline)bounds.expandByObject(mesh);
   const sphere=bounds.getBoundingSphere(new T.Sphere()),radius=Math.max(.25,sphere.radius),center=sphere.center;
   const position=(axis:[number,number,number],distance:number)=>new T.Vector3(...axis).normalize().multiplyScalar(radius*distance).add(center).toArray() as [number,number,number];
   result.push({...common,id:caseId,objects:objects[kind],familyMaterials:materials[kind],pose:view=>pose(kind,view),nativeProof:state(kind),camera:{far:Math.max(80,radius*20),positions:[position([1,1.25,1.5],3.1),position([-1.6,1.15,-1],3.3)],target:center.toArray() as [number,number,number]},contribution:{expected:'visible',setVisible:(side,visible)=>{for(const mesh of selected[kind][side])mesh.visible=visible;},state:()=>({kind,fullGeometry:snapshots[kind],selectedOnly:true})},setNegativeControl:enabled=>{control=enabled;if(enabled){for(const binding of bindings.values())for(const shader of binding.shaders)applyControl(binding,shader);}else{for(const [uniform,value]of saved)uniform.value=value;saved.clear();}}});
  }
  result.push({...common,id:referenceId,objects:references,familyMaterials:{baseline:[references.baseline.material],candidate:[references.candidate.material]},pose:view=>pose('reference',view),nativeProof:state('reference')});
  pose(kinds[0],0);
 }
 assert(result.length===5&&new Set(result.map(row=>row.id)).size===5,'Actual boat-order case inventory changed');return result;
}
