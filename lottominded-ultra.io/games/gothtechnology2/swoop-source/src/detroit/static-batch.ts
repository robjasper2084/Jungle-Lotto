import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Merge only compatible meshes; preserve originals if a batch cannot merge. */
export function batchStaticGroup(group:T.Group){
  group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert();
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[];objects:T.Mesh[]}>();
  group.traverse(o=>{
    const mesh=o as T.Mesh;
    if(!mesh.isMesh||!mesh.visible||(mesh as T.InstancedMesh).isInstancedMesh||(mesh as T.SkinnedMesh).isSkinnedMesh||Array.isArray(mesh.material)||Object.keys(mesh.geometry.morphAttributes).length)return;
    for(let parent=mesh.parent;parent&&parent!==group;parent=parent.parent)if(!parent.visible)return;
    const geometry=mesh.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    const signature=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>[k,a.itemSize,a.normalized,a.array.constructor.name].join(':')).join('|');
    const key=mesh.material.uuid+'|'+signature+'|'+Boolean(geometry.index)+'|'+mesh.castShadow+'|'+mesh.receiveShadow+'|'+mesh.renderOrder+'|'+mesh.layers.mask;
    let batch=batches.get(key);if(!batch){batch={material:mesh.material,geometries:[],objects:[]};batches.set(key,batch);}
    batch.geometries.push(geometry);batch.objects.push(mesh);
  });
  for(const batch of batches.values()){
    if(batch.objects.length<2){batch.objects[0].updateMatrix();batch.objects[0].matrixAutoUpdate=false;batch.geometries[0].dispose();continue;}
    const geometry=mergeGeometries(batch.geometries,false);
    if(geometry){const mesh=new T.Mesh(geometry,batch.material);mesh.castShadow=batch.objects[0].castShadow;mesh.receiveShadow=batch.objects[0].receiveShadow;mesh.renderOrder=batch.objects[0].renderOrder;mesh.layers.mask=batch.objects[0].layers.mask;mesh.updateMatrix();mesh.matrixAutoUpdate=false;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.userData.sourceObjects=batch.objects.map(o=>o.name);group.add(mesh);for(const original of batch.objects)original.removeFromParent();}
    for(const clone of batch.geometries)clone.dispose();
  }
}
