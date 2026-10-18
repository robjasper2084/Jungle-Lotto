import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Split only the rendered material ranges. Building roofs and walls can then
 * join their neighbours without changing UVs, materials or collision geometry. */
function splitMaterials(group:T.Group,opaqueOnly=false){
 const candidates:T.Mesh[]=[];
 group.traverse(o=>{const m=o as T.Mesh;if(m.isMesh&&Array.isArray(m.material)&&!('isSkinnedMesh' in m)&&!('isInstancedMesh' in m)&&m.visible&&!Object.keys(m.geometry.morphAttributes).length)candidates.push(m);});
 for(const mesh of candidates){
  let hidden=false;for(let p=mesh.parent;p&&p!==group;p=p.parent)if(!p.visible)hidden=true;
  if(hidden||!mesh.parent||mesh.children.length||opaqueOnly&&(mesh.material as T.Material[]).some(m=>m.transparent)||!mesh.geometry.groups.length||Object.values(mesh.geometry.attributes).some(a=>(a as T.InterleavedBufferAttribute).isInterleavedBufferAttribute))continue;
  const source=mesh.geometry,materials=mesh.material as T.Material[],parts:T.Mesh[]=[];
  const limit=source.index?.count??source.attributes.position.count;
  for(const range of source.groups){
   const start=Math.max(range.start,source.drawRange.start),end=Math.min(range.start+range.count,source.drawRange.start+source.drawRange.count,limit);
   if(end<=start||!materials[range.materialIndex??0])continue;
   const geometry=new T.BufferGeometry(),vertices:number[]=[],indices:number[]=[],remap=new Map<number,number>();
   for(let i=start;i<end;i++){const vertex=source.index?source.index.getX(i):i;let compact=remap.get(vertex);if(compact===undefined){compact=vertices.length;remap.set(vertex,compact);vertices.push(vertex);}indices.push(compact);}
   geometry.setIndex(indices);
   for(const [name,attribute] of Object.entries(source.attributes)){
    const a=attribute as T.BufferAttribute,ArrayType=a.array.constructor as {new(length:number):T.TypedArray},values=new ArrayType(vertices.length*a.itemSize);
    for(let i=0;i<vertices.length;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.array[vertices[i]*a.itemSize+c];
    const compact=new T.BufferAttribute(values,a.itemSize,a.normalized);compact.gpuType=a.gpuType;geometry.setAttribute(name,compact);
   }
   const part=new T.Mesh(geometry,materials[range.materialIndex??0]);part.name=mesh.name;
   part.position.copy(mesh.position);part.quaternion.copy(mesh.quaternion);part.scale.copy(mesh.scale);
   part.matrix.copy(mesh.matrix);part.matrixAutoUpdate=mesh.matrixAutoUpdate;
   part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;part.renderOrder=mesh.renderOrder;part.layers.mask=mesh.layers.mask;
   part.userData={...mesh.userData};parts.push(part);
  }
  if(parts.length){mesh.parent.add(...parts);mesh.removeFromParent();}
 }
}
/** Merge only compatible meshes; preserve originals if a batch cannot merge. */
export function batchStaticGroup(group:T.Group,options:{opaqueOnly?:boolean}={}){
  splitMaterials(group,options.opaqueOnly);
  // Explicit queries must also work when a distance-culled root is hidden.
  group.updateWorldMatrix(true,true);
  const inverse=group.matrixWorld.clone().invert();
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[];objects:T.Mesh[]}>();
  group.traverse(o=>{
    const mesh=o as T.Mesh;
    if(!mesh.isMesh||!mesh.visible||(mesh as T.InstancedMesh).isInstancedMesh||(mesh as T.SkinnedMesh).isSkinnedMesh||Array.isArray(mesh.material)||options.opaqueOnly&&mesh.material.transparent||Object.keys(mesh.geometry.morphAttributes).length)return;
    for(let parent=mesh.parent;parent&&parent!==group;parent=parent.parent)if(!parent.visible)return;
    const geometry=mesh.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    const signature=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>[k,a.itemSize,a.normalized,a.array.constructor.name,(a as T.BufferAttribute).gpuType].join(':')).join('|');
    const key=mesh.material.uuid+'|'+signature+'|'+Boolean(geometry.index)+'|'+mesh.castShadow+'|'+mesh.receiveShadow+'|'+mesh.renderOrder+'|'+mesh.layers.mask;
    let batch=batches.get(key);if(!batch){batch={material:mesh.material,geometries:[],objects:[]};batches.set(key,batch);}
    batch.geometries.push(geometry);batch.objects.push(mesh);
  });
  for(const batch of batches.values()){
    if(batch.objects.length<2){if(batch.objects[0].matrixAutoUpdate)batch.objects[0].updateMatrix();batch.objects[0].matrixAutoUpdate=false;batch.geometries[0].dispose();continue;}
    const geometry=mergeGeometries(batch.geometries,false);
    if(geometry){const mesh=new T.Mesh(geometry,batch.material);mesh.castShadow=batch.objects[0].castShadow;mesh.receiveShadow=batch.objects[0].receiveShadow;mesh.renderOrder=batch.objects[0].renderOrder;mesh.layers.mask=batch.objects[0].layers.mask;mesh.updateMatrix();mesh.matrixAutoUpdate=false;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.userData.sourceObjects=batch.objects.map(o=>o.name);group.add(mesh);for(const original of batch.objects)original.removeFromParent();}
    for(const clone of batch.geometries)clone.dispose();
  }
}
