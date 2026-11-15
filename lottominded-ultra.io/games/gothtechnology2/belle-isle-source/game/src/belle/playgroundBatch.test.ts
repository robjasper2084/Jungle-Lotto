import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchPlaygroundMeshes} from './playgroundBatch.ts';
// glTF primitives with a single material have no multi-material draw groups.
function box(w=1,h=1,d=1){const g=new T.BoxGeometry(w,h,d);g.clearGroups();return g;}


test('playground batching retains each original world transform, material and shadows',()=>{
 const scene=new T.Scene(),root=new T.Group(),site={objects:[] as T.Mesh[]};
 scene.add(root);root.position.set(11,0,-4);root.rotation.y=Math.PI/6;
 const material=new T.MeshStandardMaterial({color:0x8899aa,roughness:.8});
 const a=new T.Mesh(box(2,1,1),material),b=new T.Mesh(box(1,3,2),material);
 a.position.set(-3,2,0);b.position.set(4,2,0);
 for(const mesh of [a,b]){mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);site.objects.push(mesh);}
 root.updateMatrixWorld(true);
 const expected=[a.matrixWorld.clone(),b.matrixWorld.clone()];
 const result=batchPlaygroundMeshes(scene,[site]);
 assert.deepEqual(result,{sourceMeshes:2,renderMeshes:1,joinedSources:2,batches:1});
 assert.equal(a.parent,null);assert.equal(b.parent,null);
 const batched=site.objects[0] as unknown as T.BatchedMesh;
 assert.equal(batched.isBatchedMesh,true);
 assert.equal(batched.material,material);assert.equal(batched.castShadow,true);assert.equal(batched.receiveShadow,true);
 assert.equal(batched.parent,scene);
 for(let i=0;i<2;i++){
  const matrix=new T.Matrix4();batched.getMatrixAt(i,matrix);
  for(let n=0;n<16;n++)assert.ok(Math.abs(matrix.elements[n]-expected[i].elements[n])<1e-5,'matrix '+i+' element '+n);
 }
});

test('playground batches remain separated by site and retain site-level culling',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),sites=[{objects:[] as T.Mesh[]},{objects:[] as T.Mesh[]}];
 for(const [i,site] of sites.entries())for(let j=0;j<2;j++){
  const mesh=new T.Mesh(box(),material);mesh.position.set(i*300+j*2,0,0);
  scene.add(mesh);site.objects.push(mesh);
 }
 const result=batchPlaygroundMeshes(scene,sites);
 assert.equal(result.renderMeshes,2);assert.equal(result.batches,2);
 assert.notEqual(sites[0].objects[0],sites[1].objects[0]);
 sites[0].objects[0].visible=false;
 assert.equal(sites[1].objects[0].visible,true);
});

test('shared triplanar surface shaders keep local-space vertices and source transforms',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial();
 material.userData.realisticSurface='concrete';material.onBeforeCompile=()=>{};
 const objects=[new T.Mesh(box(),material),new T.Mesh(box(),material)];
 objects[0].position.x=-5;objects[1].position.x=5;objects.forEach(m=>scene.add(m));
 const site={objects};
 assert.equal(batchPlaygroundMeshes(scene,[site]).batches,1);
 const batched=site.objects[0] as T.BatchedMesh;
 assert.equal(batched.material,material);
 assert.equal(batched.geometry.attributes.position.getX(0),objects[0].geometry.attributes.position.getX(0));
 const matrix=new T.Matrix4();batched.getMatrixAt(1,matrix);
 assert.equal(matrix.elements[12],5);
});

test('transparent and unknown custom shader materials remain untouched',()=>{
 const scene=new T.Scene(),frosted=new T.MeshStandardMaterial({transparent:true,opacity:.6});
 const procedural=new T.MeshStandardMaterial();procedural.onBeforeCompile=()=>{};
 const site={objects:[] as T.Mesh[]};
 for(const material of [frosted,frosted,procedural,procedural]){
  const mesh=new T.Mesh(box(),material);scene.add(mesh);site.objects.push(mesh);
 }
 const report=batchPlaygroundMeshes(scene,[site]);
 assert.equal(report.batches,0);assert.equal(report.renderMeshes,4);
 assert.ok(site.objects.every(m=>m.parent===scene));
});
