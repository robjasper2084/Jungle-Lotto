import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeTreeBatch,planTree} from './trees.ts';

test('tree variations remain grounded and within the existing off-trail planting envelope',()=>{
  const species=new Set<number>();
  for(let seed=0;seed<100;seed++){
    const site={x:230,y:4.7,z:-610,h:6.5+seed%12*.5,seed},plan=planTree(site);species.add(plan.species);
    assert.equal(plan.limbs[0].a.y,site.y);
    for(const limb of plan.limbs){
      assert.ok([...limb.a.toArray(),...limb.b.toArray(),limb.r,limb.tip].every(Number.isFinite));
      assert.ok(limb.a.distanceTo(limb.b)>.001&&limb.r>=limb.tip&&limb.tip>0);
      assert.ok(limb.a.y>=site.y&&limb.b.y>=site.y);
    }
    for(const spray of plan.sprays){
      assert.ok(spray.p.y-spray.size*.71>site.y+1.4,'lowest foliage clears people at the trunk');
      assert.ok(Math.hypot(spray.p.x-site.x,spray.p.z-site.z)+spray.size*.8<6,'crown stays away from trail centre');
      assert.ok(spray.p.y+spray.size*.8<site.y+site.h+1.3,'bounded crown height');
    }
  }
  assert.equal(species.size,2);
});

test('tree shapes repeat reliably and moving a map site only translates its geometry',()=>{
  const site={x:0,y:0,z:0,h:9,seed:74},a=planTree(site),b=planTree(site),offset=new T.Vector3(123,5,-345);
  assert.deepEqual(a,b);
  const c=planTree({...site,x:offset.x,y:offset.y,z:offset.z});
  a.sprays.forEach((p,i)=>assert.ok(p.p.clone().add(offset).distanceTo(c.sprays[i].p)<1e-10));
});

test('distance detail never removes the whole crown and shadows use matching leaf alpha',()=>{
  const material=new T.MeshStandardMaterial({alphaTest:.38}),batch=makeTreeBatch([{x:0,y:0,z:0,h:10,seed:1},{x:10,y:0,z:0,h:8,seed:8}],new T.MeshStandardMaterial(),[material,material],{value:0});
  batch.update(200);assert.ok(batch.group.visible);assert.ok(batch.detail.every(m=>!m.visible));
  assert.ok(batch.leaves.filter(m=>!batch.detail.includes(m)).every(m=>m.visible&&m.count>0));
  batch.update(20);assert.ok(batch.detail.every(m=>m.visible));assert.ok(batch.stems.castShadow);
  for(const mesh of batch.leaves){
    assert.equal((mesh.customDepthMaterial as T.MeshDepthMaterial).alphaTest,material.alphaTest);
    assert.ok(Number.isFinite(mesh.boundingSphere!.radius));
    for(let i=0;i<mesh.count;i++){const matrix=new T.Matrix4();mesh.getMatrixAt(i,matrix);assert.ok(matrix.determinant()>0);}
  }
  batch.update(351);assert.equal(batch.group.visible,false);
});
