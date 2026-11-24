import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import * as heroCandidate from '../runtime/ride-core/src/heroDetail.ts';
import {animeRider} from '../src/belle/referenceActors.ts';
import {batchArmoredInk} from '../src/belle/riderInkBatch.ts';
import {applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import type {FamilyCase,Side} from './program-family-fixtures.ts';
// @ts-expect-error The isolated driver retains and supplies exact baseline source.
import * as heroBaselineImport from 'virtual:belle-hero-detail-baseline';
// @ts-expect-error The isolated driver hashes and serves this exact shipped rig.
import assetManifestImport from 'virtual:belle-hero-index-asset';

type Mode='ink'|'detail'|'shadow';
type NativeProgram={id:number;program:WebGLProgram;vertexShader:WebGLShader;fragmentShader:WebGLShader};
type Proof={generated:boolean;pass:'color'|'shadow';name:string;geometryId:number;programId:number;materialId:number;count:number;normalized:boolean;type:number;stride:number;size:number;divisor:number;integer:boolean;boneTextureUnit:number;boneTextureSize:[number,number];activeAttributes:{name:string;location:number;type:number;size:number}[];control:boolean};
type HeroCase=FamilyCase&{
 familyUniformNames?:string[];
 familyMaterials?:Record<Side,T.Material[]>;
 contribution?:{expected:'visible'|'none';setVisible:(side:Side,visible:boolean)=>void;state:()=>unknown};
 nativeProof?:{reset:(side:Side)=>void;state:(side:Side)=>unknown};
 captureShadow?:boolean;
};
type Asset={url:string;path:string;bytes:number;sha256:string};
const asset=assetManifestImport as Asset;
const factories:Record<Side,typeof heroCandidate>={baseline:heroBaselineImport,candidate:heroCandidate};
const sides:Side[]=['baseline','candidate'];
const retained:unknown[]=[];
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const bytes=(array:ArrayBufferView)=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const digest=async(value:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value.slice().buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
const materialArray=(mesh:T.Mesh)=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
function geometrySnapshot(geometry:T.BufferGeometry){
 const rows=[...Object.entries(geometry.attributes),...(geometry.index?[['index',geometry.index] as const]:[])].map(([name,a])=>({name,attribute:a,values:bytes(a.array).slice(),itemSize:a.itemSize,normalized:a.normalized}));
 return ()=>{
  for(const row of rows){const a=row.name==='index'?geometry.index:geometry.getAttribute(row.name);assert(a,'Missing actual hero attribute '+row.name);
   // The candidate control changes only normalization and then restores the
   // original attribute. Numeric components and all other bytes stay fixed.
   assert(a.itemSize===row.itemSize,'Changed actual hero item size');const now=bytes(a.array);
   assert(now.length===row.values.length&&now.every((value,i)=>value===row.values[i]),'Changed actual hero geometry bytes '+row.name);
   if(row.name!=='skinIndex')assert(a===row.attribute&&a.normalized===row.normalized,'Changed non-index attribute object');
  }
 };
}

/** Actual shipped rig and production factories; the only intended source
 * difference is the completed generated skinIndex storage width. */
export async function createHeroIndexCases(renderer:T.WebGLRenderer):Promise<FamilyCase[]>{
 const gl=renderer.getContext() as WebGL2RenderingContext;
 const response=await fetch(asset.url);assert(response.ok,'Hero asset request failed');
 const data=new Uint8Array(await response.arrayBuffer());assert(data.length===asset.bytes&&await digest(data)===asset.sha256,'Hero asset source mismatch');
 const gltf=await new GLTFLoader().parseAsync(data.slice().buffer,'');retained.push(gltf,data);
 const result:HeroCase[]=[];
 // Pose1 comes first so the normalization control changes actual posed skinning.
 const specs=[...[1,2,0].flatMap(phase=>(['ink','detail','shadow'] as const).map(mode=>({phase,mode,padding:0}))),{phase:1,mode:'detail' as const,padding:208},{phase:1,mode:'shadow' as const,padding:208}];
 for(const {phase,mode,padding} of specs){
  const id='hero-'+mode+'-pose'+phase+(padding?'-large-palette':'');
  const family='hero-'+mode+(padding?'-large-palette':'');
  const row:HeroCase={id,family,expectedBaselinePrograms:1,objects:{} as Record<Side,T.Object3D>,decorateSurface:false,familyUniformNames:[],captureShadow:mode==='shadow'};
  const materials={} as Record<Side,T.Material[]>,details={} as Record<Side,T.SkinnedMesh>,originalIndices={} as Record<Side,T.BufferAttribute>,outlines={} as Record<Side,T.SkinnedMesh[]>;
  const proofs:Record<Side,Proof[]>={baseline:[],candidate:[]},visible:Record<Side,boolean>={baseline:true,candidate:true};
  const poses:Record<Side,()=>void>={} as Record<Side,()=>void>,checks:Record<Side,(()=>void)[]>={baseline:[],candidate:[]};
  const geometryReceipts:Record<Side,unknown[]>={baseline:[],candidate:[]};
  let control=false;
  function record(side:Side,mesh:T.SkinnedMesh,pass:'color'|'shadow',material:T.Material,group:T.Group|null){
   const p=(renderer.properties.get(material) as {currentProgram?:NativeProgram}).currentProgram;
   assert(p&&gl.getParameter(gl.CURRENT_PROGRAM)===p.program,'Hero receipt must observe the actual submitted program');
   assert(gl.getProgramParameter(p.program,gl.LINK_STATUS),'Unlinked hero shader');
   const location=gl.getAttribLocation(p.program,'skinIndex');assert(location>=0,'Actual skinIndex input inactive');
   const pointer={size:Number(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_SIZE)),type:Number(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_TYPE)),normalized:Boolean(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED)),stride:Number(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_STRIDE)),divisor:Number(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_DIVISOR)),integer:Boolean(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_INTEGER))};
   assert(gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_ENABLED)&&gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),'Missing enabled hero vertex buffer');
   const generated=mesh.geometry===details[side].geometry,expectedType=generated&&(side==='baseline'||padding>0)?gl.UNSIGNED_SHORT:gl.UNSIGNED_BYTE,expectedNormalized=side==='candidate'&&generated&&control;
   assert(pointer.type===expectedType&&pointer.size===4&&pointer.stride===(expectedType===gl.UNSIGNED_SHORT?8:4)&&pointer.normalized===expectedNormalized&&!pointer.integer&&pointer.divisor===0,'Actual hero skinIndex pointer differs from the independent expected binding');
   const boneLocation=gl.getUniformLocation(p.program,'boneTexture');assert(boneLocation!==null,'Actual boneTexture input inactive');
   const unit=Number(gl.getUniform(p.program,boneLocation)),texture=mesh.skeleton.boneTexture;assert(texture&&Number.isSafeInteger(unit)&&unit>=0,'Missing actual bone texture');
   const native=(renderer.properties.get(texture) as {__webglTexture?:WebGLTexture}).__webglTexture;assert(native,'Bone texture was not uploaded');
   const active=Number(gl.getParameter(gl.ACTIVE_TEXTURE));let bound:unknown;
   try{gl.activeTexture(gl.TEXTURE0+unit);bound=gl.getParameter(gl.TEXTURE_BINDING_2D);}finally{gl.activeTexture(active);}
   assert(bound===native,'Stale native bone texture binding');
   const inventory=[] as Proof['activeAttributes'];
   for(let i=0;i<Number(gl.getProgramParameter(p.program,gl.ACTIVE_ATTRIBUTES));i++){const a=gl.getActiveAttrib(p.program,i);assert(a,'Missing active hero attribute');inventory.push({name:a.name,location:gl.getAttribLocation(p.program,a.name),type:a.type,size:a.size});}
   const drawGroup=group as unknown as {count?:number}|null,count=drawGroup?.count??mesh.geometry.index?.count??mesh.geometry.attributes.position.count;
   assert(count>0,'Empty actual hero submission');
   proofs[side].push({generated,pass,name:mesh.name,geometryId:mesh.geometry.id,programId:p.id,materialId:(material as T.Material&{id:number}).id,count,...pointer,boneTextureUnit:unit,boneTextureSize:[texture.image.width,texture.image.height],activeAttributes:inventory,control:side==='candidate'&&control});
  }
  for(const side of sides){
   const actor=new T.Group(),rider=clone(gltf.scene);actor.add(rider);row.objects[side]=actor;
   if(gltf.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(gltf.animations[0]).play();mixer.setTime(0);retained.push(mixer);}
   if(padding){const prefix=new T.Group();for(let i=0;i<padding;i++){const bone=new T.Bone();bone.name='Index-padding-'+i;prefix.add(bone);}rider.add(prefix);rider.children.splice(rider.children.indexOf(prefix),1);rider.children.unshift(prefix);}
   const originalGeometry=new Set<T.BufferGeometry>();rider.traverse(o=>{if(o instanceof T.Mesh)originalGeometry.add(o.geometry);});
   const detailOwner=new factories[side].HeroDetail(rider);retained.push(detailOwner,actor);
   const detail=rider.getObjectByName('Fitted hero cuffs, knuckles and tailoring');assert(detail instanceof T.SkinnedMesh,'Actual HeroDetail mesh missing');details[side]=detail;
   const skin=detail.geometry.getAttribute('skinIndex') as T.BufferAttribute;originalIndices[side]=skin;
   assert(detail.geometry.attributes.position.count===14904&&detail.geometry.index?.count===14904,'Actual generated detail inventory changed');
   const expectedStorage=side==='candidate'&&!padding?'Uint8Array':'Uint16Array';assert(skin.array.constructor.name===expectedStorage&&skin.itemSize===4&&!skin.normalized,'Wrong generated candidate/baseline storage');
   assert(Math.max(...new Set(skin.array))===48+padding&&detail.skeleton.bones.length===54+padding,'Actual generated palette range changed');
   const canonical=new Uint16Array(skin.array);geometryReceipts[side].push({name:detail.name,vertices:14904,indices:14904,skinArray:skin.array.constructor.name,skinMin:Math.min(...new Set(skin.array)),skinMax:Math.max(...new Set(skin.array)),canonicalSkinSha256:await digest(bytes(canonical)),bones:detail.skeleton.bones.map(b=>b.name),attributes:await Promise.all(Object.entries(detail.geometry.attributes as Record<string,T.BufferAttribute>).map(async([name,a])=>({name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,arrayType:a.array.constructor.name,sha256:await digest(bytes(a.array))})))});
   checks[side].push(geometrySnapshot(detail.geometry),...[...originalGeometry].map(geometrySnapshot));
   // Match main.ts's actor dressing before the real anime/outline factories.
   applyRealisticMaterials(actor,'actor');animeRider(rider);batchArmoredInk(rider,actor);
   const ink:T.SkinnedMesh[]=[];rider.traverse(o=>{if(o instanceof T.SkinnedMesh&&o.userData.referenceInk&&(o.material as T.Material).visible)ink.push(o);});
   assert(ink.length===4,'Actual four-outline cohort missing');outlines[side]=ink;
   assert(JSON.stringify(ink.map(o=>[o.geometry.attributes.position.count,o.geometry.index?.count]).sort((a,b)=>Number(a[0])-Number(b[0])))===JSON.stringify([[560,3288],[560,3288],[14904,14904],[48659,139710]]),'Actual outlined geometry changed');
   // Keep all parents visible; material visibility preserves outline traversal
   // and the armored batch's original source visibility contract.
   actor.traverse(o=>{if(o instanceof T.Mesh)for(const material of materialArray(o))material.visible=false;});
   const chosen=mode==='ink'?ink.map(o=>o.material as T.Material):materialArray(detail);for(const m of chosen)m.visible=true;materials[side]=chosen;
   detail.castShadow=mode!=='ink';
   for(const mesh of ink){
    checks[side].push(geometrySnapshot(mesh.geometry));
    const previous=mesh.onAfterRender;mesh.onAfterRender=function(...args){previous.apply(this,args);record(side,mesh,'color',args[4],args[5]);};
   }
   const after=detail.onAfterRender;detail.onAfterRender=function(...args){after.apply(this,args);record(side,detail,'color',args[4],args[5]);};
   const afterShadow=detail.onAfterShadow;detail.onAfterShadow=function(...args){afterShadow.apply(this,args);record(side,detail,'shadow',args[5],args[6]);};
   const transforms:{object:T.Object3D;position:T.Vector3;quaternion:T.Quaternion;scale:T.Vector3}[]=[];
   rider.traverse(object=>{if(object instanceof T.Bone)transforms.push({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()});});
   poses[side]=()=>{
    for(const t of transforms){t.object.position.copy(t.position);t.object.quaternion.copy(t.quaternion);t.object.scale.copy(t.scale);}
    const b=(name:string)=>{const value=rider.getObjectByName(name);assert(value,'Actual pose bone missing '+name);return value;};
    if(phase>=1){b('LeftForeArm').rotation.z+=.25;b('RightForeArm').rotation.y-=.18;b('Spine').rotation.x+=.12;b('LeftFoot').rotation.x+=.17;}
    if(phase>=2){b('Hips').position.y+=.08;b('RightFoot').rotation.z-=.23;b('LeftHand').rotation.y+=.31;}
    rider.updateMatrixWorld(true);detail.skeleton.update();
   };
   actor.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(actor),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   if(side==='baseline')row.camera={far:80,positions:[[center.x+size.y*.8,center.y+size.y*.12,center.z+size.y*1.75],[center.x-size.y*.55,center.y-size.y*.10,center.z+size.y*1.15]],target:center.toArray() as [number,number,number]};
  }
  const canonical=(side:Side)=>(geometryReceipts[side][0] as {canonicalSkinSha256:string}).canonicalSkinSha256;
  assert(canonical('baseline')===canonical('candidate'),'Candidate changed numeric skin indices');
  row.familyMaterials=materials;row.pose=()=>{for(const side of sides)poses[side]();};
  row.setNegativeControl=enabled=>{
   assert(control!==enabled,'Hero control state did not transition');control=enabled;
   const original=originalIndices.candidate;
   // Rebind the same numeric components with intentionally wrong normalization.
   // Pose selection never overwrites this binding, and disabling restores the
   // exact original BufferAttribute object (not a reconstructed approximation).
   const changed=original.array instanceof Uint8Array?new T.Uint8BufferAttribute(original.array,4,true):new T.Uint16BufferAttribute(original.array,4,true);
   details.candidate.geometry.setAttribute('skinIndex',enabled?changed:original);
  };
  row.contribution={expected:'visible',setVisible:(side,present)=>{visible[side]=present;if(mode==='shadow')details[side].castShadow=present;else for(const material of materials[side])material.visible=present;},state:()=>({asset,mode,phase,padding,control,visible:{...visible},geometry:geometryReceipts})};
  row.nativeProof={reset:side=>{proofs[side].length=0;},state:side=>{
   for(const check of checks[side])check();
   return {mode,phase,padding,control:side==='candidate'&&control,contributionVisible:visible[side],rows:proofs[side].map(proof=>({...proof})),restoredAttribute:details[side].geometry.getAttribute('skinIndex')===originalIndices[side]};
  }};
  result.push(row);
 }
 return result;
}
