import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {HeartProjectiles} from './heartProjectiles.ts';
import {ImpactEffect} from './impactEffect.ts';

test('first shot and first hit reuse the already compiled instanced-color shader layout',()=>{
 const shots=new HeartProjectiles(),impact=new ImpactEffect(),mesh=impact.children[0] as T.InstancedMesh;
 try{
  const sparks=shots.sparks.instanceColor,burst=mesh.instanceColor;
  assert(sparks);assert(burst);assert.equal(shots.sparks.count,0);assert.equal(mesh.count,0);
  const camera=new T.PerspectiveCamera(),shot={id:'one',p:{x:0,y:1,z:0},v:{x:0,y:0,z:180}};
  shots.update([shot],camera,0,false);shot.p.z=2;shots.update([shot],camera,.02,false);
  impact.hit(shot.p,100,true);impact.update(200,false);
  assert.equal(shots.sparks.instanceColor,sparks);assert.equal(mesh.instanceColor,burst);
  assert(shots.sparks.count>0);assert(mesh.count>0);
 }finally{shots.dispose();impact.dispose();}
});
