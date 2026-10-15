import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {batchStaticGroup} from './static-batch.ts';import {FrameSchedule} from './frameSchedule.ts';
test('static batching retains indexed vertices, transforms and separate shadow flags',()=>{
 const group=new T.Group(),material=new T.MeshBasicMaterial(),source=new T.BoxGeometry();
 for(let i=0;i<3;i++){const mesh=new T.Mesh(source,material);mesh.position.x=i*3;mesh.castShadow=i===2;group.add(mesh);}
 batchStaticGroup(group);const meshes=group.children as T.Mesh[];assert.equal(meshes.length,2);
 assert.equal(meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),source.attributes.position.count*3);
 assert.equal(meshes.reduce((n,m)=>n+(m.geometry.index?.count??0),0),source.index!.count*3);
 assert.equal(meshes.filter(m=>m.castShadow).length,1);assert.ok(meshes.every(m=>!m.matrixAutoUpdate));
 assert.ok(new T.Box3().setFromObject(group).max.x>6);
});
test('idle rendering halves 60Hz work but active and XR frames are never throttled',()=>{
 const schedule=new FrameSchedule();let rendered=0;for(let i=0;i<60;i++)if(schedule.shouldRender(i*1000/60,true,false))rendered++;
 assert.equal(rendered,30);assert.equal(schedule.shouldRender(990,false,false),true);assert.equal(schedule.shouldRender(991,true,true),true);
});
test('hidden support surfaces stay hidden when static art is batched',()=>{const group=new T.Group(),hidden=new T.Group(),material=new T.MeshBasicMaterial();hidden.visible=false;group.add(hidden);hidden.add(new T.Mesh(new T.BoxGeometry(),material));for(let i=0;i<2;i++)group.add(new T.Mesh(new T.BoxGeometry(),material));const support=new T.Mesh(new T.BoxGeometry(10,1,10),material);support.visible=false;group.add(support);batchStaticGroup(group);assert.equal(support.visible,false);assert.equal(hidden.visible,false);assert.equal(group.children.filter(o=>(o as T.Mesh).isMesh&&o.visible).length,1);});

test('multi-material buildings batch by facade and roof without duplicating hidden triangles',()=>{
 const group=new T.Group(),roof=new T.MeshBasicMaterial(),facade=new T.MeshBasicMaterial();
 for(let i=0;i<12;i++){
  const geometry=new T.BoxGeometry(2,3,4);geometry.clearGroups();geometry.addGroup(0,12,0);geometry.addGroup(12,24,1);
  const m=new T.Mesh(geometry,[roof,facade]);m.position.set(i*4,0,0);m.castShadow=m.receiveShadow=true;group.add(m);
 }
 const before=new T.Box3().setFromObject(group);batchStaticGroup(group);
 const meshes=group.children.filter(m=>(m as T.Mesh).isMesh) as T.Mesh[];
 assert.equal(meshes.length,2);assert.deepEqual(new T.Box3().setFromObject(group),before);
 assert.equal(meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count),0),12*36);
 assert.equal(meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),12*24,'retain compact shared vertices rather than expanding every triangle');
 assert(meshes.every(m=>m.castShadow&&m.receiveShadow));
});
