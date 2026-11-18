import * as T from 'three';
/** Keep MacArthur's aluminum railings distinct from Casino Way's red
 * King Bridge Company cast-iron scrollwork. These are existing mesh materials:
 * no extra geometry, UV maps, texture fetches, draw passes or collision edits. */
export function finishMacArthurRailings(root:T.Object3D){
 const cache=new WeakMap<T.MeshStandardMaterial,T.MeshStandardMaterial>();
 const stats={meshes:0,newMaterials:0};
 root.traverse(object=>{
  if(!(object instanceof T.Mesh)||!/macarthur|mac arthur/i.test(object.name)||!/rail|balustrade|guard/i.test(object.name))return;
  const original=Array.isArray(object.material)?object.material:[object.material];
  const processed=original.map(material=>{
   if(!(material instanceof T.MeshStandardMaterial)||material.userData.macArthurRailFinish||/lamp|light|glass|emissive/i.test(material.name))return material;
   let clone=cache.get(material);
   if(!clone){
    clone=material.clone();
    const coated=/paint|powder|coat|enamel/i.test(material.name);
    // Paint is a dielectric over aluminum; exposed aluminum is metallic.
    clone.metalness=coated?.06:.62;
    clone.roughness=coated?.56:.43;
    clone.envMapIntensity=Math.min(clone.envMapIntensity,1);
    clone.userData={...clone.userData,macArthurRailFinish:true};
    clone.name=material.name+' · MacArthur aluminum finish';
    cache.set(material,clone);stats.newMaterials++;
   }
   return clone;
  });
  if(processed.some((x,i)=>x!==original[i])){object.material=Array.isArray(object.material)?processed:processed[0];stats.meshes++;}
 });
 return stats;
}
