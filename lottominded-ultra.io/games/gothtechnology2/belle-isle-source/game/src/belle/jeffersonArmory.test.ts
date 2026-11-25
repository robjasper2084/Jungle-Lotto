import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {JEFFERSON_ARMORY,prepareJeffersonArmoryStudy} from './jeffersonArmory.ts';
const path=new URL('../../public/belle/jefferson-armory/Naval_Armory_Jefferson_All_LODs.glb',import.meta.url);
test('exact original source model SHA and three LOD roots remain intact',async()=>{
 const data=await readFile(path);
 assert.equal(data.length,2764484);
 assert.equal(createHash('sha256').update(data).digest('hex'),JEFFERSON_ARMORY.sha256);
 assert.equal(data.subarray(0,4).toString(),'glTF');
 const chunk=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));
 const names=new Set(chunk.nodes.map((n:{name:string})=>n.name));
 for(const name of ['LOD0','LOD1','LOD2'])assert(names.has(name));
 assert.deepEqual([...JEFFERSON_ARMORY.levelsM],[0,180,480]);
 assert.equal(JEFFERSON_ARMORY.id,'59264442');
});
test('bad hash refuses replacement and keeps original visual group intact',async()=>{
 const originalFetch=globalThis.fetch;const scene=new T.Group(),legacy=new T.Group();scene.add(legacy);
 globalThis.fetch=(async()=>new Response(new Uint8Array([1,2,3]))) as typeof fetch;
 try{
  await assert.rejects(prepareJeffersonArmoryStudy({parseAsync(){throw Error('Should not parse');}} as never,scene),/hash mismatch/);
  assert.deepEqual(scene.children,[legacy]);assert.equal(legacy.parent,scene);
 }finally{globalThis.fetch=originalFetch;}
});
test('staged model has three distance LODs and no opaque glass shadow',async()=>{
 const originalFetch=globalThis.fetch;const bytes=await readFile(path);
 globalThis.fetch=(async()=>new Response(new Uint8Array(bytes))) as typeof fetch;
 const stage=new T.Group();
 const fakeLoader={parseAsync:async()=>{
  const scene=new T.Group();
  for(let i=0;i<3;i++){
   const group=new T.Group();group.name='LOD'+i;
   group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({name:i?'stone':'glass',transparent:i===0,opacity:i===0?.5:1})));scene.add(group);
  }
  return {scene};
 }} as never;
 try{
  const study=await prepareJeffersonArmoryStudy(fakeLoader,stage);
  assert.equal(stage.children[0],study.lod);
  assert.deepEqual(study.lod.levels.map(a=>a.distance),[0,180,480]);
  assert.deepEqual(study.lod.position.toArray(),[347.303359,2,-198.411080]);
  assert.equal((study.lod.levels[0].object.children[0] as T.Mesh).castShadow,false);
  assert.equal((study.lod.levels[2].object.children[0] as T.Mesh).castShadow,true);
 }finally{globalThis.fetch=originalFetch;}
});
