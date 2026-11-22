import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {finishMacArthurConcrete} from './macArthurSurface.ts';

test('MacArthur arch finish is isolated, cached and leaves collision geometry untouched',()=>{
 const root=new T.Group(),shared=new T.MeshStandardMaterial({color:0xcccccc,name:'Concrete'}),
  metal=new T.MeshStandardMaterial({color:0x555555,name:'Painted steel'});
 const arch=new T.Mesh(new T.BoxGeometry(2,1,3),shared);arch.name='MacArthur bridge arch 1';
 const pier=new T.Mesh(new T.BoxGeometry(1,5,1),shared);pier.name='MacArthur bridge pier 2';
 const rail=new T.Mesh(new T.BoxGeometry(1,1,1),metal);rail.name='MacArthur bridge railing';
 const other=new T.Mesh(new T.BoxGeometry(1,1,1),shared);other.name='Belle Isle Casino masonry';
 root.add(arch,pier,rail,other);
 const archGeo=arch.geometry,pierGeo=pier.geometry;
 const stats=finishMacArthurConcrete(root);
 assert.equal(stats.meshes,2);assert.equal(stats.newMaterials,1);
 assert.equal(arch.material,pier.material);
 assert.notEqual(arch.material,shared);
 assert.equal(arch.geometry,archGeo);assert.equal(pier.geometry,pierGeo);
 assert.equal(rail.material,metal);assert.equal(other.material,shared);
 assert((arch.material as T.MeshStandardMaterial).customProgramCacheKey().includes('aged-concrete'));
 assert.equal(shared.name,'Concrete');
});
test('finishing a scene without named MacArthur masonry is a no-op',()=>{
 const obj=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());
 obj.name='Casino balcony';assert.deepEqual(finishMacArthurConcrete(obj),{meshes:0,newMaterials:0});
});
