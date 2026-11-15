import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Static, opaque playground pieces only; do not alter collision or animations.
 * Group by actual material identity AND site so distant playgrounds still cull.
 * All geometry is baked in world space before the original meshes are detached.
 */
export function batchPlaygroundMeshes(scene:T.Scene,sites:readonly {objects:T.Mesh[]}[]){
 const sourceMeshes=sites.reduce((sum,site)=>sum+site.objects.length,0);
 let batches=0,joinedSources=0;
 for(const site of sites){
  const candidates=new Map<string,T.Mesh[]>();
  for(const mesh of site.objects){
   mesh.updateWorldMatrix(true,false);
   const m=mesh.material,g=mesh.geometry;
   if(!(m instanceof T.MeshStandardMaterial)||m.transparent||m.opacity!==1||m.alphaTest>0||
      m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||!mesh.parent||
      mesh.children.length||!(mesh as T.SkinnedMesh).isSkinnedMesh||
      (mesh as T.InstancedMesh).isInstancedMesh||Object.values(g.morphAttributes).some(a=>a.length)||
      g.groups.length>1||!g.attributes.position||!g.attributes.normal||
      mesh.matrixWorld.determinant()<=0)continue;
   const attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b))
     .map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name]);
   const key=[m.uuid,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,
     !!g.index,JSON.stringify(attributes)].join('|');
   const group=candidates.get(key);
   if(group)group.push(mesh);else candidates.set(key,[mesh]);
  }
  const replacements=new Map<T.Mesh,T.Mesh>();
  for(const sources of candidates.values()){
   if(sources.length<2)continue;
   const geometries=sources.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
   let merged:T.BufferGeometry|null=null;
   try{merged=mergeGeometries(geometries,false);}
   finally{for(const geometry of geometries)geometry.dispose();}
   if(!merged)continue;
   merged.computeBoundingSphere();merged.computeBoundingBox();
   const first=sources[0],joined=new T.Mesh(merged,first.material);
   joined.name='Belle Isle static playground batch';
   joined.castShadow=first.castShadow;joined.receiveShadow=first.receiveShadow;
   joined.renderOrder=first.renderOrder;joined.layers.mask=first.layers.mask;
   scene.add(joined);
   for(const mesh of sources){replacements.set(mesh,joined);mesh.removeFromParent();}
   batches++;joinedSources+=sources.length;
  }
  if(replacements.size){
   const next:T.Mesh[]=[],seen=new Set<T.Mesh>();
   for(const mesh of site.objects){
    const replacement=replacements.get(mesh)??mesh;
    if(!seen.has(replacement)){seen.add(replacement);next.push(replacement);}
   }
   site.objects.splice(0,site.objects.length,...next);
  }
 }
 return {sourceMeshes,renderMeshes:sites.reduce((sum,site)=>sum+site.objects.length,0),joinedSources,batches};
}
