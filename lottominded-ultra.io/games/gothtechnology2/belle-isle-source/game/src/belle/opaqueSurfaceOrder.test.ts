import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOpaqueSurfaceOrder,type OpaqueSurfaceOwner} from './opaqueSurfaceOrder.ts';

function fixture(){
 const scene=new T.Scene();
 const owners:OpaqueSurfaceOwner[]=(['asphalt','approach','approach','sky'] as const).map(kind=>{
  const material=kind==='sky'?new T.ShaderMaterial({depthWrite:false}):new T.MeshStandardMaterial();
  const mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);mesh.renderOrder=kind==='sky'?-100:0;
  // Factory authority comes from the reference, not these deliberately generic names.
  mesh.name='unnamed display surface';scene.add(mesh);return {kind,mesh};
 });
 return {scene,owners};
}
function state(owners:readonly OpaqueSurfaceOwner[]){return owners.map(({mesh})=>({
  order:mesh.renderOrder,geometry:mesh.geometry,material:mesh.material,parent:mesh.parent,
  before:mesh.onBeforeRender,after:mesh.onAfterRender,cast:mesh.castShadow,receive:mesh.receiveShadow,
  visible:mesh.visible,matrix:mesh.matrix.toArray(),matrixWorld:mesh.matrixWorld.toArray()
 }));}

test('factory controller is inactive by default and only selected draw orders change',()=>{
 const {owners}=fixture(),before=state(owners),control=createOpaqueSurfaceOrder(owners);
 assert.equal(control.read().mode,'original');assert.deepEqual(state(owners),before);
 control.setMode('early-terrain');assert.deepEqual(owners.map(o=>o.mesh.renderOrder),[-104,-103,-103,-100]);
 control.setMode('late-sky');assert.deepEqual(owners.map(o=>o.mesh.renderOrder),[0,0,0,1000000]);
 control.setMode('original');assert.deepEqual(state(owners),before);
 assert.deepEqual(control.read().owners.map(o=>o.originalOrder),[0,0,0,-100]);
});

test('geometry, exact final materials, callbacks and nonselected scene objects stay authoritative',()=>{
 const {scene,owners}=fixture(),unrelated=owners[0].mesh.clone();unrelated.name='Joined island pavement · asphalt';scene.add(unrelated);
 const before=state(owners),control=createOpaqueSurfaceOrder(owners);
 for(const mode of ['early-terrain','late-sky'] as const){
  control.setMode(mode);const after=state(owners);
  for(let i=0;i<after.length;i++)assert.deepEqual({...after[i],order:before[i].order},before[i]);
  assert.equal(unrelated.renderOrder,0);
 }
 control.dispose();assert.deepEqual(state(owners),before);control.dispose();
 assert.throws(()=>control.setMode('original'),/disposed/);
});

test('unsupported factory sources fail before changing any order',()=>{
 const changes:[string,(owner:OpaqueSurfaceOwner)=>void][]=[
  ['transparent',o=>(o.mesh.material as T.Material).transparent=true],
  ['opacity',o=>(o.mesh.material as T.Material).opacity=.5],
  ['no depth write',o=>(o.mesh.material as T.Material).depthWrite=false],
  ['no depth test',o=>(o.mesh.material as T.Material).depthTest=false],
  ['different depth function',o=>(o.mesh.material as T.Material).depthFunc=T.AlwaysDepth],
  ['alpha test',o=>(o.mesh.material as T.Material).alphaTest=.5],
  ['alpha hash',o=>(o.mesh.material as T.Material).alphaHash=true],
  ['additive',o=>(o.mesh.material as T.Material).blending=T.AdditiveBlending],
  ['shadow caster',o=>o.mesh.castShadow=true],
  ['different original order',o=>o.mesh.renderOrder=4],
  ['detached',o=>o.mesh.removeFromParent()],
  ['material array',o=>o.mesh.material=[o.mesh.material as T.Material]],
 ];
 for(const [label,change] of changes){const {owners}=fixture();change(owners[1]);const orders=owners.map(o=>o.mesh.renderOrder);
  assert.throws(()=>createOpaqueSurfaceOrder(owners),/Opaque surface order experiment/,label);
  assert.deepEqual(owners.map(o=>o.mesh.renderOrder),orders,label);
 }
 const {owners}=fixture();assert.throws(()=>createOpaqueSurfaceOrder([...owners,owners[0]]),/duplicate/);
});

test('later source/material changes reject the complete transition atomically',()=>{
 for(const mutate of [
  (o:OpaqueSurfaceOwner)=>{o.mesh.geometry=o.mesh.geometry.clone();},
  (o:OpaqueSurfaceOwner)=>{o.mesh.material=(o.mesh.material as T.Material).clone();},
  (o:OpaqueSurfaceOwner)=>{(o.mesh.material as T.Material).transparent=true;},
  (o:OpaqueSurfaceOwner)=>{o.mesh.castShadow=true;},
  (o:OpaqueSurfaceOwner)=>{o.mesh.renderOrder=17;},
 ]){
  const {owners}=fixture(),control=createOpaqueSurfaceOrder(owners);mutate(owners.at(-2)!);
  const orders=owners.map(o=>o.mesh.renderOrder);assert.throws(()=>control.setMode('early-terrain'),/experiment/);
  assert.deepEqual(owners.map(o=>o.mesh.renderOrder),orders);
 }
});

test('cleanup restores owned orders while respecting a later explicit application order',()=>{
 const {owners}=fixture(),control=createOpaqueSurfaceOrder(owners);control.setMode('early-terrain');owners[0].mesh.renderOrder=23;
 control.dispose();assert.deepEqual(owners.map(o=>o.mesh.renderOrder),[23,0,0,-100]);
});
