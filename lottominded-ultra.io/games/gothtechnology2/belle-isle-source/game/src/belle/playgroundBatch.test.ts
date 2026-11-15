import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchPlaygroundMeshes} from './playgroundBatch.ts';

test('playground batching preserves world-space geometry, material, and shadows',()=>{
 const scene=new T.Scene(),root=new T.Group(),site={objects:[] as T.Mesh[]};
 scene.add(root);root.position.set(11,0,-4);root.rotation.y=Math.PI/6;
 const material=new T.MeshStandardMaterial({color:0x8899aa,roughness:.8});
 const a=new T.Mesh(new T.BoxGeometry(2,1,1),material),b=new T.Mesh(new T.BoxGeometry(1,3,2),material);
 a.position.set(-3,2,0);b.position.set(4,2,0);
 for(const mesh of [a,b]){mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);site.objects.push(mesh);}
 root.updateMatrixWorld(true);
 const expected=new T.Box3().setFromObject(root);
 const report=batchPlaygroundMeshes(scene,[site]);
 assert.deepEqual(report,{sourceMeshes:2,renderMeshes:1,joinedSources:2,batches:1});
 assert.equal(a.parent,null);assert.equal(b.parent,null);
 const merged=site.objects[0];
 assert.equal(merged.material,material);assert.equal(merged.castShadow,true);assert.equal(merged.receiveShadow,true);
 assert.equal(merged.parent,scene);
 const actual=new T.Box3().setFromObject(merged);
 for(const axis of ['x','y','z'] as const){
  assert.ok(Math.abs(actual.min[axis]-expected.min[axis])<1e-4,axis+' min');
  assert.ok(Math.abs(actual.max[axis]-expected.max[axis])<1e-4,axis+' max');
 }
});

test('playground batches stay inside their own site and retain site-level culling',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),sites=[{objects:[] as T.Mesh[]},{objects:[] as T.Mesh[]}];
 for(const [i,site] of sites.entries())for(let j=0;j<2;j++){
  const mesh=new T.Mesh(new T.BoxGeometry(),material);mesh.position.set(i*300+j*2,0,0);
  scene.add(mesh);site.objects.push(mesh);
 }
 const result=batchPlaygroundMeshes(scene,sites);
 assert.equal(result.renderMeshes,2);assert.equal(result.batches,2);
 assert.notEqual(sites[0].objects[0],sites[1].objects[0]);
 sites[0].objects[0].visible=false;
 assert.equal(sites[1].objects[0].visible,true);
});

test('transparent and custom shader materials remain untouched',()=>{
 const scene=new T.Scene(),frosted=new T.MeshStandardMaterial({transparent:true,opacity:.6});
 const procedural=new T.MeshStandardMaterial();procedural.onBeforeCompile=()=>{};
 const site={objects:[] as T.Mesh[]};
 for(const material of [frosted,frosted,procedural,procedural]){
  const mesh=new T.Mesh(new T.BoxGeometry(),material);scene.add(mesh);site.objects.push(mesh);
 }
 const report=batchPlaygroundMeshes(scene,[site]);
 assert.equal(report.batches,0);assert.equal(report.renderMeshes,4);
 assert.ok(site.objects.every(m=>m.parent===scene));
});
