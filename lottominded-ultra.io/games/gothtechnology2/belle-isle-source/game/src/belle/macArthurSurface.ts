import * as T from 'three';
import {finishBridgeMaterial,type BridgeFinishOptions} from './bridgeMaterialFinish.ts';

/** Weather MacArthur arch masonry without mutating shared landmark materials.
 * The original collision, bridge geometry and metal railings are untouched. */
export function finishMacArthurConcrete(root:T.Object3D,options:BridgeFinishOptions={}){
 const cached=new WeakMap<T.Material,T.MeshStandardMaterial>();
 const stats={meshes:0,newMaterials:0};
 root.traverse(obj=>{
  if(!(obj instanceof T.Mesh))return;
  const label=obj.name;
  if(!/macarthur|mac arthur/i.test(label))return;
  const raw=Array.isArray(obj.material)?obj.material:[obj.material];
  const targets=raw.map(material=>{
   if(!(material instanceof T.MeshStandardMaterial))return material;
   const kind=(label+' '+material.name).toLowerCase();
   if(!/arch|pier|abutment|concrete|stone|masonry|support|span|parapet/.test(kind))return material;
   if(/rail|steel|metal|iron|light|lamp|glazing|glass/.test(kind))return material;
   let updated=cached.get(material);
   if(!updated){
    updated=material.clone();updated.name=material.name+' · MacArthur masonry';
    finishBridgeMaterial(updated,'aged-concrete',options);
    cached.set(material,updated);stats.newMaterials++;
   }
   return updated;
  });
  if(targets.some((m,i)=>m!==raw[i])){
   obj.material=Array.isArray(obj.material)?targets:targets[0];
   stats.meshes++;
  }
 });
 return stats;
}
