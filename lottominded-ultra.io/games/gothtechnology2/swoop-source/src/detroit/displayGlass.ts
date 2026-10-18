import * as T from 'three';

/** Thin shop glazing already carries alpha in its supplied GLB. Transmission
 * otherwise makes Three render the entire downtown scene again, even when the
 * case is hidden behind an opaque shop wall. Keep tint/roughness and alpha. */
export function useThinDisplayGlass(root:T.Object3D){
 const changed=new Set<T.MeshPhysicalMaterial>();
 root.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   const glass=material as T.MeshPhysicalMaterial;
   if(!glass.isMeshPhysicalMaterial||glass.transmission<=0||changed.has(glass))continue;
   glass.transmission=0;glass.transparent=true;glass.depthWrite=false;glass.forceSinglePass=true;glass.needsUpdate=true;changed.add(glass);
  }
 });return changed.size;
}
