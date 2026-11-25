import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {replaceableLegacyMesh,STUDY_SITES,installStagedLandmarkStudies} from './stagedLandmarkStudies.ts';

const originalFetch=globalThis.fetch;
function scene(){
 const root=new T.Group();
 for(const name of [
  '107310050_Conservatory restored gray steel',
  '107310050_Conservatory leaf 0',
  '107227742_Aquarium aged limestone',
  '107227742_Aquarium jade glazed tile',
  '9146545_Scott Fountain carved marble'
 ]){const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());mesh.name=name;root.add(mesh);}
 return root;
}
function loader(){
 let count=0;
 return {parseAsync:async(_bytes:ArrayBuffer,_path:string)=>{
  count++;
  const root=new T.Group();
  root.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({transparent:count%2===0,opacity:count%2===0?.5:1})));
  return {scene:root};
 }} as any;
}
async function modelFetch(url:RequestInfo|URL){
 const name=decodeURIComponent(String(url).split('/').at(-1)!);
 const raw=await readFile(new URL(`../../public/belle/staged-architecture/${name}`,import.meta.url));
 return new Response(new Uint8Array(raw),{status:200});
}

test('explicit identifier classifier protects interiors and leaves Scott and roads untouched',()=>{
 assert.equal(replaceableLegacyMesh('107310050','107310050_Conservatory restored gray steel'),true);
 assert.equal(replaceableLegacyMesh('107310050','107310050_Conservatory leaf 0'),false);
 assert.equal(replaceableLegacyMesh('107227742','107227742_Aquarium aged limestone'),true);
 assert.equal(replaceableLegacyMesh('107227742','107227742_Aquarium river gravel'),false);
 assert.equal(replaceableLegacyMesh('107227742','9146545_Scott stone'),false);
 assert.equal(STUDY_SITES.length,2);
});

test('six immutable authored GLBs pass the exact source-hash contract before detach',async t=>{
 for(const spec of STUDY_SITES){
  for(let index=0;index<3;index++)await t.test(spec.files[index],async()=>{
   const {createHash}=await import('node:crypto');
   const data=await readFile(new URL(`../../public/belle/staged-architecture/${spec.files[index]}`,import.meta.url));
   assert.equal(createHash('sha256').update(data).digest('hex'),spec.hashes[index]);
  });
 }
});

test('all six model levels load before facade detaches; only old exterior is removed, with rollback available',async()=>{
 globalThis.fetch=modelFetch as typeof fetch;
 try{
  const root=scene();const saved=[...root.children];
  const result=await installStagedLandmarkStudies(loader(),root);
  assert.deepEqual(result.installed.map(x=>x.removedFacades),[1,1]);
  assert.equal(root.getObjectByName('107310050_Conservatory restored gray steel'),undefined);
  assert.equal(root.getObjectByName('107227742_Aquarium aged limestone'),undefined);
  for(const interior of ['107310050_Conservatory leaf 0','107227742_Aquarium jade glazed tile','9146545_Scott Fountain carved marble'])assert.ok(root.getObjectByName(interior));
  const lods=root.children.filter(x=>x instanceof T.LOD) as T.LOD[];
  assert.equal(lods.length,2);
  assert.deepEqual(lods.map(x=>x.levels.length),[3,3]);
  assert.deepEqual(lods[0].position.toArray(),[1330.8,2,1174.7]);
  assert.deepEqual(lods[1].position.toArray(),[1363.78,2,1167.42]);
  assert.equal(lods[0].levels[1].object.visible,false);
  result.rollback();
  assert.equal(root.children.filter(x=>x instanceof T.LOD).length,0);
  for(const old of saved)assert.ok(root.getObjectByName(old.name));
 }finally{globalThis.fetch=originalFetch;}
});

test('missing or corrupted final LOD fails before touching legacy facades',async()=>{
 const root=scene(),before=[...root.children];let called=0;
 globalThis.fetch=(async(url:RequestInfo|URL)=>{
  called++;
  if(called===6)return new Response(new Uint8Array([9,9,9]),{status:200});
  return modelFetch(url);
 }) as typeof fetch;
 try{
  await assert.rejects(installStagedLandmarkStudies(loader(),root),/hash mismatch/);
  assert.deepEqual(root.children.map(x=>x.uuid),before.map(x=>x.uuid));
  assert.equal(root.children.filter(x=>x instanceof T.LOD).length,0);
 }finally{globalThis.fetch=originalFetch;}
});