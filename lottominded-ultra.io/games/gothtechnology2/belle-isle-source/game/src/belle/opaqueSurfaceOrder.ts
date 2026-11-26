import * as T from 'three';

export type OpaqueSurfaceKind='asphalt'|'approach'|'sky';
export type OpaqueSurfaceOwner=Readonly<{kind:OpaqueSurfaceKind;mesh:T.Mesh}>;
export type OpaqueSurfaceOrderMode='original'|'early-terrain'|'late-sky';

const expectedOrder:Record<OpaqueSurfaceKind,number>={asphalt:0,approach:0,sky:-100};
const earlyOrder:Record<Exclude<OpaqueSurfaceKind,'sky'>,number>={asphalt:-104,approach:-103};
const lateSkyOrder=1000000;

function requireContract(value:unknown,message:string):asserts value {
 if(!value)throw new Error('Opaque surface order experiment: '+message);
}

/** A disabled-by-default draw-order experiment, using references supplied by
 * the actual surface factories. Names never authorize a mesh. No geometry,
 * shader, material, depth state, visibility or render callbacks are changed.
 *
 * The proof must establish exact output and useful native savings before a
 * production factory may opt in. In particular, the late-sky candidate needs
 * whole-scene depth-writer and far-plane coverage; this small controller does
 * not claim that arbitrary opaque scenes can safely reorder their sky.
 */
export function createOpaqueSurfaceOrder(owners:readonly OpaqueSurfaceOwner[]){
 const seen=new Set<T.Mesh>();
 const entries=owners.map(({kind,mesh})=>{
  requireContract(Object.hasOwn(expectedOrder,kind),'unknown factory kind');
  requireContract(mesh instanceof T.Mesh&&!seen.has(mesh),'duplicate or non-mesh factory reference');
  seen.add(mesh);
  requireContract(Object.getPrototypeOf(mesh)===T.Mesh.prototype,'ordinary mesh required');
  requireContract(mesh.parent instanceof T.Scene,'factory mesh must be a direct scene child');
  requireContract(mesh.renderOrder===expectedOrder[kind],'original factory render order changed');
  requireContract(!Array.isArray(mesh.material),'one exact final material required');
  const entry={kind,mesh,geometry:mesh.geometry,material:mesh.material,parent:mesh.parent,
   originalOrder:mesh.renderOrder,assignedOrder:mesh.renderOrder};
  check(entry);
  return entry;
 });
 let mode:OpaqueSurfaceOrderMode='original',disposed=false;

 function check(entry:{kind:OpaqueSurfaceKind;mesh:T.Mesh;geometry:T.BufferGeometry;material:T.Material;parent:T.Scene}){
  const {kind,mesh,geometry,material,parent}=entry;
  requireContract(mesh.parent===parent&&mesh.geometry===geometry&&mesh.material===material,'factory ownership changed');
  requireContract(mesh.castShadow===false,'a shadow caster cannot be reordered by this experiment');
  requireContract(material.transparent===false&&material.opacity===1&&material.alphaTest===0&&
   material.alphaHash===false&&material.blending===T.NormalBlending&&material.colorWrite===true&&
   material.depthTest===true&&material.depthFunc===T.LessEqualDepth,'opaque depth-tested material required');
  requireContract(material.depthWrite===(kind!=='sky'),'factory depth-write contract changed');
  requireContract((material as T.MeshPhysicalMaterial).transmission===undefined||
   (material as T.MeshPhysicalMaterial).transmission===0,'transmission is outside this experiment');
 }

 function setMode(next:OpaqueSurfaceOrderMode){
  requireContract(!disposed,'controller is disposed');
  requireContract(next==='original'||next==='early-terrain'||next==='late-sky','unknown mode');
  // Validate the entire set before the first mutation. A caller's later order
  // change is never silently overwritten by a partially applied experiment.
  for(const entry of entries){check(entry);requireContract(entry.mesh.renderOrder===entry.assignedOrder,'render order changed outside controller');}
  for(const entry of entries){
   const order=next==='early-terrain'&&entry.kind!=='sky'?earlyOrder[entry.kind]:
    next==='late-sky'&&entry.kind==='sky'?lateSkyOrder:entry.originalOrder;
   if(entry.mesh.renderOrder!==order)entry.mesh.renderOrder=order;
   entry.assignedOrder=order;
  }
  mode=next;
 }

 function read(){return {mode,owners:entries.map(entry=>({kind:entry.kind,id:entry.mesh.id,name:entry.mesh.name,
  originalOrder:entry.originalOrder,order:entry.mesh.renderOrder,
  materialIds:[(entry.material as T.Material&{id:number}).id],geometryId:entry.geometry.id}))};}

 function dispose(){
  if(disposed)return;
  // Restore only orders we still own. Preserve any explicit subsequent change
  // made by the application rather than taking it over during cleanup.
  for(const entry of entries)if(entry.mesh.renderOrder===entry.assignedOrder)entry.mesh.renderOrder=entry.originalOrder;
  disposed=true;
 }
 return {setMode,read,dispose};
}
