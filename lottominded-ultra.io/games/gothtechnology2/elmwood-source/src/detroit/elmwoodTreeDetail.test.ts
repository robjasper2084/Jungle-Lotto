import test from 'node:test';import assert from 'node:assert/strict';import {open} from 'node:fs/promises';
import {TREE_LODS,treeDetail,treeModel} from './elmwoodTreeDetail.ts';
async function inspect(name:string){const f=await open(new URL('../../public/elmwood/models/'+name+'.glb',import.meta.url));try{const header=Buffer.alloc(20);await f.read(header,0,20,0);const b=Buffer.alloc(header.readUInt32LE(12));await f.read(b,0,b.length,20);const j=JSON.parse(b.toString());return {triangles:j.meshes.flatMap((m:any)=>m.primitives).reduce((n:number,p:any)=>n+j.accessors[p.indices??p.attributes.POSITION].count/3,0),materials:j.materials.map((m:any)=>m.name).sort()};}finally{await f.close();}}
test('compact tree assets reduce geometry while retaining the authored materials',async()=>{
 for(const id of TREE_LODS){const full=await inspect(id),lod=await inspect(treeModel(id,'compact'));assert(lod.triangles<full.triangles*.6,id);assert.deepEqual(lod.materials,full.materials,id);}
 assert.equal(treeModel('elmwood-chapel','compact'),'elmwood-chapel');assert.equal(treeModel('black-walnut','compact'),'black-walnut');
 assert.equal(treeModel('white-oak',treeDetail('ultra')),'white-oak');assert.equal(treeDetail('balanced'),'compact');
});
