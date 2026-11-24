import * as T from 'three';
import {referenceTree} from '../src/belle/referenceTrees.ts';
import {trunkRootHeight} from '../src/belle/treeGrounding.ts';
import {seasonalMaterial as candidateSeasonal} from '../src/belle/seasonalMaterial.ts';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
// @ts-expect-error The driver supplies the exact preceding pure product module.
import {seasonalMaterial as baselineSeasonal} from 'virtual:belle-seasonal-baseline';

type Side='baseline'|'candidate';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Program={id:number;program:WebGLProgram;vertexShader:WebGLShader;fragmentShader:WebGLShader};
type Trunk=T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Row={id:string;objects:Record<Side,T.Group>;materials:Record<Side,T.Material[]>;camera:{far:number;positions:[[number,number,number],[number,number,number]];target:[number,number,number]};pose:(phase:number)=>void};
const sides:Side[]=['baseline','candidate'];
const nearNonbinary=Math.fround(.37),farNonbinary=Math.fround(1-nearNonbinary);
export const leaflessCaseIds=[
 'leafless-near-quarter','leafless-far-three-quarters',
 'leafless-near-half','leafless-far-half',
 'leafless-near-float32','leafless-far-float32',
 'leafless-near-full','leafless-far-full','leafless-near-far-near',
] as const;
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function encoded(array:ArrayBufferView){
 const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let binary='';
 for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return {type:array.constructor.name,bytes:bytes.length,base64:btoa(binary)};
}
function geometryInput(geometry:T.BufferGeometry){
 return {attributes:Object.fromEntries(Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,attribute])=>{
  assert(attribute instanceof T.BufferAttribute,'Ordinary actual reference-tree attributes required');
  return [name,{itemSize:attribute.itemSize,normalized:attribute.normalized,count:attribute.count,meshPerAttribute:(attribute as T.InstancedBufferAttribute).meshPerAttribute??null,...encoded(attribute.array)}];
 })),index:geometry.index?{itemSize:geometry.index.itemSize,count:geometry.index.count,...encoded(geometry.index.array)}:null,
 drawRange:{start:geometry.drawRange.start,count:Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:'Infinity'},groups:geometry.groups.map(group=>({...group}))};
}

/** Fixture-only actual construction; placements/weights/order are controlled inputs,
 * not a captured island workload. All supporting product modules are pinned by
 * the driver to a1c. Only seasonalMaterial differs between the two sides. */
export async function createLeaflessProgramCases(renderer:T.WebGLRenderer){
 const gl=renderer.getContext() as WebGL2RenderingContext;
 const trees=[referenceTree('maple',false,12),referenceTree('maple',true,12)];
 const month={value:10},noise=new T.DataTexture(new Uint8Array([83,83,83,255,168,168,168,255,125,125,125,255,211,211,211,255]),2,2,T.RGBAFormat);
 noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.needsUpdate=true;
 const owners:WorldAtmosphere[]=[],retained:unknown[]=[trees,noise];
 const materials={} as Record<Side,[T.MeshStandardMaterial,T.MeshStandardMaterial]>;
 const compiled=new Map<T.Material,Set<Shader>>(),farByMaterial=new Map<T.Material,boolean>();
 const tableIds=new WeakMap<object,number>();let nextTable=1;
 const controls=new Map<boolean,Map<T.IUniform,unknown>>();
 const instances:{case:string;side:Side;far:boolean;slot:number;mesh:Trunk;source:T.BufferGeometry;rootOffset:number}[]=[];
 const proof:{color:unknown[];shadow:unknown[]}={color:[],shadow:[]};
 let active:{id:string;side:Side;subjectPresent:boolean}|null=null;
 const tableId=(table:object)=>{let id=tableIds.get(table);if(!id){id=nextTable++;tableIds.set(table,id);}return id;};
 const native=(material:T.Material)=>renderer.properties.get(material) as {currentProgram?:Program;uniforms?:Record<string,T.IUniform>};
 for(const side of sides){
  const world=new T.Scene(),owner=new WorldAtmosphere(world,noise);owners.push(owner);retained.push(world,owner);
  const seeds=trees.map((tree,index)=>{
   const far=index===1,source=tree.bark.clone();source.side=T.DoubleSide;source.roughness=Math.max(.78,source.roughness);source.metalness=0;
   const season=(side==='baseline'?baselineSeasonal:candidateSeasonal)(source,false,far,false,month,true);
   const geometry=tree.trunk.clone();geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array([far?.75:.25]),1));
   const mesh=new T.InstancedMesh(geometry,season.material,1);mesh.name=(far?'Distant ':'Nearby ')+'maple trunk';
   mesh.setMatrixAt(0,new T.Matrix4());mesh.setColorAt(0,new T.Color(1,1,1));mesh.castShadow=!far;mesh.receiveShadow=true;mesh.frustumCulled=false;
   season.update();world.add(mesh);retained.push(source,season,mesh);return mesh;
  });
  await Promise.resolve();
  const dressed=applyRealisticMaterials(world);assert(dressed.length===2,'Both real seasonal trunk materials must receive bark dressing');
  materials[side]=seeds.map(mesh=>mesh.material) as [T.MeshStandardMaterial,T.MeshStandardMaterial];
  assert(materials[side][0]!==materials[side][1],'Near and far must retain distinct material identities');
  materials[side].forEach((material,index)=>{
   const far=index===1;assert(material.userData.realisticProfile==='bark|triplanar','Actual trunk bark classification missing');
   assert(material.userData.realisticBaseIsStandard===false,'Authored seasonal callback provenance must remain custom');
   farByMaterial.set(material,far);const previous=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);let rows=compiled.get(material);if(!rows){rows=new Set();compiled.set(material,rows);}rows.add(shader);
    if(side==='candidate'){
     assert(shader.uniforms.treeFarLod?.value===far,'Constructor far value must independently initialize the native table');
     const saved=controls.get(far);if(saved){saved.set(shader.uniforms.treeFarLod,far);shader.uniforms.treeFarLod.value=!far;}
    }
   };
  });
 }
 const pose=(phase:number)=>{for(const owner of owners)owner.update(2.5+phase*4.25,new T.Vector3(.28,.65,-.31).normalize(),.57,.9,.15,'high',false,false);};
 const specifications=[
  {id:leaflessCaseIds[0],far:false,weight:.25},{id:leaflessCaseIds[1],far:true,weight:.75},
  {id:leaflessCaseIds[2],far:false,weight:.5},{id:leaflessCaseIds[3],far:true,weight:.5},
  {id:leaflessCaseIds[4],far:false,weight:nearNonbinary},{id:leaflessCaseIds[5],far:true,weight:farNonbinary},
  {id:leaflessCaseIds[6],far:false,weight:1},{id:leaflessCaseIds[7],far:true,weight:1},
 ];
 const rows:Row[]=[];
 function makeMesh(id:string,side:Side,far:boolean,weight:number,slot:number,sequence:boolean){
  const source=trees[far?1:0].trunk,geometry=source.clone(),rootOffset=trunkRootHeight(trees[0].trunk.attributes.position.array,0);
  geometry.translate(0,-rootOffset,0);geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array([weight]),1));
  const mesh=new T.InstancedMesh(geometry,materials[side][far?1:0],1);mesh.name=(far?'Distant ':'Nearby ')+'maple trunk';
  const matrix=new T.Matrix4().compose(new T.Vector3(sequence?(slot-1)*4.2:0,0,0),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.17),new T.Vector3(1,1,1));
  mesh.setMatrixAt(0,matrix);mesh.setColorAt(0,new T.Color(.91,.97,.86));mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.castShadow=!far;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.renderOrder=sequence?30+slot:30;
  const entry={case:id,side,far,slot,mesh,source,rootOffset};instances.push(entry);
  let colorBefore:{calls:number;triangles:number}|null=null,shadowBefore:typeof colorBefore=null;
  mesh.onBeforeRender=()=>{colorBefore={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
  mesh.onAfterRender=()=>{
   assert(active?.id===id&&active.side===side&&active.subjectPresent,'Unexpected leafless color callback identity');
   assert(colorBefore,'Missing original color submission boundary');
   const calls=renderer.info.render.calls-colorBefore.calls,triangles=renderer.info.render.triangles-colorBefore.triangles;
   assert(calls===1&&triangles>0,'Actual nonempty native instanced trunk draw required');
   const property=native(mesh.material),program=property.currentProgram,uniforms=property.uniforms;
   assert(program&&uniforms,'Native material program/table missing');
   const values:Record<string,unknown>={};
   for(const name of ['skinProfile','skinPlanar','belleCloudTime','belleCloudCoverage','belleCloudStrength','belleSunDirection',...(side==='candidate'?['treeFarLod']:[])]){
    const uniform=uniforms[name];assert(uniform,'Actual native table missing '+name);const location=gl.getUniformLocation(program.program,name);assert(location!==null,'Inactive native trunk input '+name);
    const value=uniform.value,expected=typeof value==='boolean'?value:typeof value==='number'?Math.fround(value):value.toArray().map(Math.fround);
    const raw=gl.getUniform(program.program,location),observed=typeof value==='boolean'?Boolean(raw):typeof value==='number'?raw:Array.from(raw);
    assert(JSON.stringify(observed)===JSON.stringify(expected),'Native trunk material binding mismatch '+name);
    if(name==='treeFarLod')assert(observed===(controls.has(far)?!far:far),'Native selector disagrees with independent constructor/explicit control truth');
    values[name]={expected,observed};
   }
   assert(!mesh.customDepthMaterial&&!mesh.customDistanceMaterial,'Actual trunk retains default native shadow materials');
   proof.color.push({case:id,side,slot,far,constructorFar:far,controlActive:controls.has(far),expectedSelector:controls.has(far)?!far:far,
    objectId:mesh.id,materialId:mesh.material.id,programId:program.id,uniformTableId:tableId(uniforms),calls,triangles,weight:geometry.getAttribute('lodWeight').getX(0),
    count:mesh.count,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,values});colorBefore=null;
  };
  mesh.onBeforeShadow=()=>{shadowBefore={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
  mesh.onAfterShadow=()=>{
   assert(active?.id===id&&active.side===side&&active.subjectPresent&&shadowBefore,'Unexpected leafless shadow boundary');
   const calls=renderer.info.render.calls-shadowBefore.calls,triangles=renderer.info.render.triangles-shadowBefore.triangles;
   assert(!far&&calls===1&&triangles>0,'Only original near trunks may make native shadow submissions');
   proof.shadow.push({case:id,side,slot,far,objectId:mesh.id,calls,triangles,defaultDepth:mesh.customDepthMaterial===undefined,defaultDistance:mesh.customDistanceMaterial===undefined});shadowBefore=null;
  };
  return mesh;
 }
 for(const spec of [...specifications,{id:leaflessCaseIds[8],far:false,weight:.25}]){
  const sequence=spec.id===leaflessCaseIds[8],objects={} as Record<Side,T.Group>,rowMaterials={} as Record<Side,T.Material[]>;
  for(const side of sides){
   const group=new T.Group();group.name=spec.id;
   (sequence?[{far:false,weight:.25},{far:true,weight:.75},{far:false,weight:.25}]:[spec]).forEach((entry,index)=>group.add(makeMesh(spec.id,side,entry.far,entry.weight,index,sequence)));
   objects[side]=group;rowMaterials[side]=[...new Set(group.children.map(mesh=>(mesh as Trunk).material))];
  }
  rows.push({id:spec.id,objects,materials:rowMaterials,pose,camera:{far:100,positions:sequence?[[24,13,27],[28,7,24]]:[[13,8,16],[17,5,12]],target:[0,5.5,0]}});
 }
 function inputs(){return instances.map(({case:id,side,far,slot,mesh,source,rootOffset})=>({case:id,side,slot,constructorFar:far,species:'maple',height:12,rootOffset,
  geometry:geometryInput(mesh.geometry),sourceGeometry:geometryInput(source),instanceMatrix:encoded(mesh.instanceMatrix.array),instanceColor:encoded(mesh.instanceColor!.array),
  instanceCount:mesh.count,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,frustumCulled:mesh.frustumCulled,renderOrder:mesh.renderOrder,
  sideMode:mesh.material.side,transparent:mesh.material.transparent,alphaTest:mesh.material.alphaTest,alphaToCoverage:mesh.material.alphaToCoverage,
  defaultDepth:mesh.customDepthMaterial===undefined,defaultDistance:mesh.customDistanceMaterial===undefined}));}
 const originalInputs=JSON.stringify(inputs());pose(0);
 function begin(id:string,side:Side,subjectPresent:boolean){active={id,side,subjectPresent};proof.color.length=0;proof.shadow.length=0;}
 function capture(){
  assert(active,'Leafless capture must have a selected case');
  const expected=active.subjectPresent?(active.id===leaflessCaseIds[8]?3:1):0;
  assert(proof.color.length===expected,'All requested leafless color objects must actually submit');
  const color=proof.color as {far:boolean;materialId:number;programId:number;uniformTableId:number}[];
  const expectedShadow=active.subjectPresent?(active.id===leaflessCaseIds[8]?2:active.id.startsWith('leafless-near-')?1:0):0;
  assert(proof.shadow.length===expectedShadow,'Every original near caster must submit exactly once; far/hidden trunks must not cast');
  if(active.subjectPresent&&active.id===leaflessCaseIds[8]){
   assert(JSON.stringify(color.map(row=>row.far))==='[false,true,false]','Actual color callbacks must retain fixture near/far/near order');
   assert(color[0].materialId===color[2].materialId&&color[0].uniformTableId===color[2].uniformTableId&&color[0].uniformTableId!==color[1].uniformTableId,'Same near material/table must be reused around distinct far table');
   assert(new Set(color.map(row=>row.programId)).size===(active.side==='candidate'?1:2),'Native near/far program identity count is wrong');
  }
  return {color:[...proof.color],shadow:[...proof.shadow]};
 }
 function setControl(far:boolean,enabled:boolean){
  if(!enabled){for(const [uniform,value]of controls.get(far)??[])uniform.value=value;controls.delete(far);return;}
  assert(!controls.has(far),'Selector control is already active');const material=materials.candidate[far?1:0],saved=new Map<T.IUniform,unknown>();
  for(const shader of compiled.get(material)??[]){const uniform=shader.uniforms.treeFarLod;assert(uniform?.value===far,'Control must start at constructor truth');saved.set(uniform,uniform.value);uniform.value=!far;}
  assert(saved.size>0,'Selector control material has not compiled');controls.set(far,saved);
 }
 return {rows,begin,capture,setControl,inputs,
  controlCases:[{far:false,id:leaflessCaseIds[0]},{far:true,id:leaflessCaseIds[1]}],
  state:()=>({caseIds:[...leaflessCaseIds],inputsUnchanged:JSON.stringify(inputs())===originalInputs,controlsActive:controls.size,
   owners:owners.map(owner=>owner.stats),scope:'Actual maple reference geometry/material chain; controlled fixture placements, order and LOD weights. Zero-weight endpoint remains CPU-only. Native color coverage is checked separately from ground shadows.'})};
}
