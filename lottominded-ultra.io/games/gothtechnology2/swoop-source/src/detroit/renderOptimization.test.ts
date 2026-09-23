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
