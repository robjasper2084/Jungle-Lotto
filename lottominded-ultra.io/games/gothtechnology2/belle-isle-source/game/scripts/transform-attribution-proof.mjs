import assert from 'node:assert/strict';
import * as T from 'three';
import {installTransformAttribution} from '../src/belle/transformAttributionDiagnostic.ts';
const scene=new T.Scene(),root=new T.Group(),child=new T.Object3D(),other=new T.Group();
scene.add(root,other);root.add(child);child.position.set(1,2,3);
const originalScene=scene.updateMatrixWorld,originalRoot=root.updateMatrixWorld;
const probe=installTransformAttribution(scene,{street:[root],waterfront:[other]});
probe.start();for(let i=0;i<32;i++){root.position.x=i;scene.updateMatrixWorld(true);assert.equal(child.matrixWorld.elements[12],i+1);}
const r=probe.finish();assert.equal(r.pass,32);assert.equal(r.rows.length,2);assert.deepEqual(r.rows.map(x=>x.rootsCalls),[[1,1],[1,1]]);assert.equal(r.dropped,0);assert.equal(scene.updateMatrixWorld,originalScene);assert.equal(root.updateMatrixWorld,originalRoot);
assert.throws(()=>installTransformAttribution(scene,{a:[root],b:[root]}));assert.throws(()=>installTransformAttribution(scene,{a:[child]}));
console.log('Actual Three transform observer preserves dynamic transforms, direct ownership, call counts and restoration');
