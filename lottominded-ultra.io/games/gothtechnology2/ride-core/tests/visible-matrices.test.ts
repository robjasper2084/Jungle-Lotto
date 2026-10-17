import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {visibleSceneryMatrices} from '../src/visibleMatrices.ts';

test('hidden scenery avoids descendant matrix work and flushes movement on reappearance',()=>{
 const scene=new T.Scene(),tile=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry());scene.add(tile);tile.add(mesh);
 let visits=0;const original=mesh.updateMatrixWorld;mesh.updateMatrixWorld=function(force){visits++;original.call(this,force);};
 visibleSceneryMatrices(tile);scene.updateMatrixWorld();assert.equal(visits,1);
 tile.visible=false;tile.position.x=20;mesh.position.z=3;
 for(let frame=0;frame<120;frame++)scene.updateMatrixWorld();assert.equal(visits,1);
 const streamed=new T.Object3D();streamed.position.y=5;tile.add(streamed);
 tile.visible=true;scene.updateMatrixWorld();assert.equal(visits,2);
 assert.deepEqual(mesh.getWorldPosition(new T.Vector3()).toArray(),[20,0,3]);assert.deepEqual(streamed.getWorldPosition(new T.Vector3()).toArray(),[20,5,0]);mesh.geometry.dispose();
});
test('manual position queries work while hidden, and multiple installations do not stack',()=>{
 const parent=new T.Group(),root=new T.Group(),child=new T.Object3D();parent.position.x=2;parent.add(root);root.add(child);
 visibleSceneryMatrices(root);const once=root.updateMatrixWorld;visibleSceneryMatrices(root);assert.equal(root.updateMatrixWorld,once);
 root.visible=false;root.position.y=6;child.position.z=4;assert.deepEqual(child.getWorldPosition(new T.Vector3()).toArray(),[2,6,4]);
});
