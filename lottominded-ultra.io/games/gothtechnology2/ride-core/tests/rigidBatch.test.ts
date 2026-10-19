import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchRigidChildren} from '../src/rigidBatch.ts';
test('rigid batches share geometry, retain sockets and follow their articulated parent',()=>{
 const source=new T.Group(),pivot=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 source.add(pivot);pivot.name='Wheel pivot';
 for(let i=0;i<4;i++){const part=new T.Mesh(geometry,material);part.position.x=i;part.castShadow=true;pivot.add(part);}
 const grip=new T.Mesh(geometry,material);grip.name='Grip001';pivot.add(grip);
 const a=source.clone(true),b=source.clone(true),before=new T.Box3().setFromObject(a),releaseA=batchRigidChildren(a),releaseB=batchRigidChildren(b);
 assert.equal(pivot.children.length,5,'source stays unchanged');
 assert.equal(a.children[0].children.length,2);
 assert.ok(a.getObjectByName('Grip001'));
 assert.ok(new T.Box3().setFromObject(a).equals(before));
 const ma=a.getObjectByName('Batched rigid bicycle parts') as T.Mesh,mb=b.getObjectByName('Batched rigid bicycle parts') as T.Mesh;
 assert.equal(ma.geometry,mb.geometry);assert.equal(ma.castShadow,true);
 a.children[0].rotation.y=.6;source.children[0].rotation.y=.6;
 a.updateMatrixWorld(true);source.updateMatrixWorld(true);
 const actual=new T.Box3().setFromObject(a,true),expected=new T.Box3().setFromObject(source,true);
 assert.ok(actual.min.distanceTo(expected.min)<1e-6&&actual.max.distanceTo(expected.max)<1e-6);
 let disposed=0;ma.geometry.addEventListener('dispose',()=>disposed++);
 releaseA();releaseA();assert.equal(disposed,0);releaseB();assert.equal(disposed,1);
 geometry.dispose();material.dispose();
});
