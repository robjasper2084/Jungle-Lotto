import * as T from 'three';

/** Batch only fixed opaque playground meshes with identical material/render state.
 * BatchedMesh retains each source's local vertices and a separate world matrix:
 * the triplanar surface shaders must NOT be baked into world-space geometry.
 * Sites stay independent to retain their original per-playground distance culling.
 */
export function batchPlaygroundMeshes(scene:T.Object3D,sites:readonly {objects:T.Mesh[]}[]){
 const sourceMeshes=sites.reduce((sum,site)=>sum+site.objects.length,0);
 let batches=0,joinedSources=0;
 for(const site of sites){
  const candidates=new Map<string,T.Mesh[]>();
  for(const mesh of site.objects){
   mesh.updateWorldMatrix(true,false);
   const m=mesh.material,g=mesh.geometry;
   if(!(m instanceof T.MeshStandardMaterial)||m.transparent||m.opacity!==1||m.alphaTest>0||
      (!m.userData.realisticSurface&&m.onBeforeCompile!==T.Material.prototype.onBeforeCompile)||
      !mesh.parent||mesh.children.length||(mesh as T.SkinnedMesh).isSkinnedMesh||
      (mesh as T.InstancedMesh).isInstancedMesh||(mesh as T.BatchedMesh).isBatchedMesh||
      Object.values(g.morphAttributes).some(a=>a.length)||g.groups.length>1||
      !g.attributes.position||!g.attributes.normal||mesh.matrixWorld.determinant()<=0)continue;
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
   const first=sources[0],materials=first.material as T.MeshStandardMaterial;
   const geometries=[...new Set(sources.map(mesh=>mesh.geometry))];
   const vertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0);
   const indices=geometries.reduce((n,g)=>n+(g.index?.count??0),0);
   let batch:T.BatchedMesh|undefined;
   try{
    batch=new T.BatchedMesh(sources.length,vertices,indices,materials);
    const ids=new Map<T.BufferGeometry,number>();
    for(const g of geometries)ids.set(g,batch.addGeometry(g));
    for(const source of sources){
     const id=batch.addInstance(ids.get(source.geometry)!);
     batch.setMatrixAt(id,source.matrixWorld);
    }
    batch.name='Belle Isle static playground batch';
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;
    batch.perObjectFrustumCulled=true;batch.sortObjects=false;
    batch.computeBoundingBox();batch.computeBoundingSphere();
    scene.add(batch);
   }catch(error){
    batch?.dispose();console.warn('Playground batch unavailable; using original meshes.',error);
    continue;
   }
   for(const mesh of sources){replacements.set(mesh,batch);mesh.removeFromParent();}
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
