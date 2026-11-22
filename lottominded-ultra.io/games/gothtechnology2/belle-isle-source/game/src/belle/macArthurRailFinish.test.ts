import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {finishMacArthurRailings} from './macArthurRailFinish.ts';
test('MacArthur rail PBR is cached, physically differentiated and geometry-neutral',()=>{
 const root=new T.Group();
 const coated=new T.MeshStandardMaterial({color:0x333b40,name:'Powder-coated aluminum'});
 const bare=new T.MeshStandardMaterial({color:0xaaaaaa,name:'Bare aluminum'});
 const r1=new T.Mesh(new T.BoxGeometry(),coated),r2=new T.Mesh(new T.BoxGeometry(),coated);
 const r3=new T.Mesh(new T.BoxGeometry(),bare),casino=new T.Mesh(new T.BoxGeometry(),coated);
 r1.name='MacArthur bridge railing one';r2.name='MacArthur rail two';r3.name='MacArthur_MacArthur galvanized crash barrier';casino.name='Casino Way Bridge rail';
 root.add(r1,r2,r3,casino);const geometries=[r1.geometry,r2.geometry,r3.geometry];
 assert.deepEqual(finishMacArthurRailings(root),{meshes:3,newMaterials:2});
 assert.equal(r1.material,r2.material);assert.notEqual(r1.material,coated);
 assert.equal((r1.material as T.MeshStandardMaterial).metalness,.06);
 assert.equal((r1.material as T.MeshStandardMaterial).roughness,.56);
 assert.equal((r3.material as T.MeshStandardMaterial).metalness,.62);
 assert.equal((r3.material as T.MeshStandardMaterial).roughness,.43);
 assert.equal(casino.material,coated);
 assert.deepEqual([r1.geometry,r2.geometry,r3.geometry],geometries);
 assert.deepEqual(finishMacArthurRailings(root),{meshes:0,newMaterials:0});
});
test('unrelated scene meshes and optical materials are untouched',()=>{
 const root=new T.Group(),glass=new T.MeshStandardMaterial({name:'Glass lamp'});
 const lamp=new T.Mesh(new T.BoxGeometry(),glass);lamp.name='MacArthur bridge railing lamp';root.add(lamp);
 assert.deepEqual(finishMacArthurRailings(root),{meshes:0,newMaterials:0});
 assert.equal(lamp.material,glass);
});
