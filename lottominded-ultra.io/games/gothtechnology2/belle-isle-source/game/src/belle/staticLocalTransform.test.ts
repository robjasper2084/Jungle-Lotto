import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cacheStaticLocalTransform} from './staticLocalTransform.ts';

test('a cached local transform follows moving and reparented ancestors exactly',()=>{
 const original=new T.Group();original.position.set(3,-2,7);original.rotation.set(.27,-.62,.41);original.scale.set(1.3,-.8,2.2);
 const cached=original.clone(),parents=[new T.Group(),new T.Group()];
 assert.equal(cacheStaticLocalTransform(cached),cached);
 assert.equal(cached.matrixAutoUpdate,false);assert.equal(cached.matrixWorldAutoUpdate,true);
 const child=new T.Object3D(),otherChild=child.clone();original.add(child);cached.add(otherChild);
 parents[0].add(original);parents[1].add(cached);
 for(let step=0;step<6;step++){
  for(const parent of parents){parent.position.set(step*17,-step*.4,step*3);parent.rotation.set(step*.05,-step*.13,step*.03);parent.scale.set(1+step*.1,1-step*.04,1+step*.2);}
  for(const item of [child,otherChild]){item.position.set(step,2-step,-step);item.rotation.y=step*.3;}
  parents.forEach(parent=>parent.updateMatrixWorld(true));
  assert.deepEqual(cached.matrix.elements,original.matrix.elements);
  assert.deepEqual(cached.matrixWorld.elements,original.matrixWorld.elements);
  assert.deepEqual(otherChild.matrixWorld.elements,child.matrixWorld.elements);
  assert.equal(otherChild.matrixAutoUpdate,true,'Descendants keep their own animation policy');
 }
 const newParents=[new T.Group(),new T.Group()];
 newParents.forEach(parent=>{parent.position.set(-91,4,37);parent.rotation.z=.65;parent.scale.set(2,.4,-1);});
 newParents[0].add(original);newParents[1].add(cached);newParents.forEach(parent=>parent.updateMatrixWorld(true));
 assert.deepEqual(cached.matrixWorld.elements,original.matrixWorld.elements);
 assert.deepEqual(otherChild.matrixWorld.elements,child.matrixWorld.elements);
});

test('manual matrices are retained and an explicit local update still propagates',()=>{
 const manual=new T.Object3D();manual.matrixAutoUpdate=false;
 manual.matrix.set(1,.2,0,8,0,2,.3,-7,.1,0,1,6,0,0,0,1);
 const authored=manual.matrix.elements.slice(),worldMode=manual.matrixWorldAutoUpdate;
 cacheStaticLocalTransform(manual);assert.deepEqual(manual.matrix.elements,authored);assert.equal(manual.matrixWorldAutoUpdate,worldMode);
 const original=new T.Object3D(),cached=cacheStaticLocalTransform(original.clone());
 for(const o of [original,cached]){o.position.set(9,8,7);o.rotation.set(.1,.2,.3);o.scale.set(.8,2,1);}
 cached.updateMatrix();original.updateMatrixWorld(true);cached.updateMatrixWorld(true);
 assert.deepEqual(cached.matrixWorld.elements,original.matrixWorld.elements);
 cached.matrixAutoUpdate=true;cached.position.x=23;original.position.x=23;
 original.updateMatrixWorld(true);cached.updateMatrixWorld(true);
 assert.deepEqual(cached.matrixWorld.elements,original.matrixWorld.elements);
});
