import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const cache=new Map<string,{geometry:T.BufferGeometry;users:number}>();
/** Combine rigid siblings only. Articulated pivots and named grip sockets remain intact. */
export function batchRigidChildren(root:T.Object3D){
 const releases:(()=>void)[]=[];
 const parents:T.Object3D[]=[];root.traverse(o=>parents.push(o));
 for(const parent of parents){
  const bins=new Map<string,T.Mesh[]>();
  for(const child of parent.children){
   const m=child as T.Mesh;
   if(!m.isMesh||(m as T.SkinnedMesh).isSkinnedMesh||(m as T.InstancedMesh).isInstancedMesh||m.children.length||!m.visible||/^(Grip|BikeStyle|City wire basket)/.test(m.name)||Array.isArray(m.material)||m.material.transparent||Object.keys(m.geometry.morphAttributes).length||m.geometry.drawRange.start!==0||m.geometry.drawRange.count!==Infinity)continue;
   m.updateMatrix();if(m.matrix.determinant()<=0)continue;
   const signature=Object.entries(m.geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>[k,a.itemSize,a.normalized,a.array.constructor.name,(a as T.BufferAttribute).gpuType].join(':')).join('|');
   const key=[m.material.uuid,signature,!!m.geometry.index,m.castShadow,m.receiveShadow,m.renderOrder,m.layers.mask].join('|');
   const bin=bins.get(key)??[];bin.push(m);bins.set(key,bin);
  }
  for(const meshes of bins.values()){
   if(meshes.length<2)continue;
   const key=meshes.map(m=>m.geometry.uuid+':'+m.matrix.elements.join(',')).join('|');
   let entry=cache.get(key);
   if(!entry){
    const pieces=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    if(!geometry)continue;geometry.computeBoundingBox();geometry.computeBoundingSphere();entry={geometry,users:0};cache.set(key,entry);
   }
   entry.users++;const owned=entry;
   const mesh=new T.Mesh(entry.geometry,meshes[0].material);mesh.name='Batched rigid bicycle parts';
   mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;mesh.renderOrder=meshes[0].renderOrder;mesh.layers.mask=meshes[0].layers.mask;mesh.updateMatrix();mesh.matrixAutoUpdate=false;
   parent.add(mesh);meshes.forEach(m=>m.removeFromParent());
   releases.push(()=>{mesh.removeFromParent();if(--owned.users===0){owned.geometry.dispose();cache.delete(key);}});
  }
 }
 let disposed=false;return()=>{if(disposed)return;disposed=true;releases.forEach(release=>release());};
}
