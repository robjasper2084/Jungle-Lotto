import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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

test('the shipped landmark GLB retains tank interiors, paths, rails, benches and complete water lilies',async()=>{
 const bytes=await readFile(new URL('../../public/belle/landmarks.glb',import.meta.url));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const names=new Set(gltf.nodes.map((node:{name?:string})=>node.name));
 const retained=[
  ['107227742','107227742_Aquarium illuminated habitat'],
  ['107227742','107227742_Aquarium aged handrails'],
  ['107227742','107227742_Aquarium worn step nosings'],
  ['107310050','107310050_Conservatory concrete paving'],
  ['107310050','107310050_Timber'],
  ['107310050','107310050_Water lily golden heart'],
 ] as const;
 for(const [id,name] of retained){
  assert.ok(names.has(name),'expected original geometry: '+name);
  assert.equal(replaceableLegacyMesh(id,name),false,'exterior swap must retain '+name);
 }
 for(const [id,name] of [
  ['107227742','107227742_Aquarium aged limestone'],
  ['107227742','107227742_Aquarium exterior copper roof'],
  ['107310050','107310050_Conservatory clear panes'],
  ['107310050','107310050_Conservatory restored gray steel'],
 ] as const){
  assert.ok(names.has(name),'expected original exterior: '+name);
  assert.equal(replaceableLegacyMesh(id,name),true);
 }
});


// Both the original and candidate carry rails, but in different parts of the
// entrance. Compare actual triangle bounds, not a broad material/name guess.
async function railTriangleBounds(file:string,keep:(name:string)=>boolean){
 const bytes=await readFile(file),jsonBytes=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.subarray(20,20+jsonBytes).toString('utf8'));
 const bin=28+jsonBytes,boxes:{min:number[];max:number[]}[]=[];
 function values(index:number){
  const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],offset=bin+(view.byteOffset||0)+(a.byteOffset||0);
  assert.equal(view.byteStride,undefined,'The pinned authored GLB stores tightly packed attributes');
  const count=a.count*(a.type==='VEC3'?3:1),size=a.componentType===5126||a.componentType===5125?4:2;
  assert.ok([5126,5125,5123].includes(a.componentType));
  return Array.from({length:count},(_,i)=>a.componentType===5126?bytes.readFloatLE(offset+i*size):a.componentType===5125?bytes.readUInt32LE(offset+i*size):bytes.readUInt16LE(offset+i*size));
 }
 for(const node of gltf.nodes){
  if(node.mesh===undefined||!keep(node.name||''))continue;
  for(const primitive of gltf.meshes[node.mesh].primitives){
   const p=values(primitive.attributes.POSITION),indices=primitive.indices===undefined?Array.from({length:p.length/3},(_,i)=>i):values(primitive.indices);
   for(let i=0;i<indices.length;i+=3){const vertices=indices.slice(i,i+3).map((v:number)=>p.slice(v*3,v*3+3));boxes.push({min:[0,1,2].map(axis=>Math.min(...vertices.map((v:number[])=>v[axis]))),max:[0,1,2].map(axis=>Math.max(...vertices.map((v:number[])=>v[axis])))});}
  }
 }
 return boxes;
}

test('retained merged Aquarium rails do not duplicate any staged entrance rail triangles',async()=>{
 const original=await railTriangleBounds(new URL('../../public/belle/landmarks.glb',import.meta.url).pathname,n=>n==='107227742_Aquarium aged handrails');
 assert.equal(original.length,9232);
 for(const file of STUDY_SITES.find(s=>s.id==='107227742')!.files){
  const staged=await railTriangleBounds(new URL('../../public/belle/staged-architecture/'+file,import.meta.url).pathname,n=>n.startsWith('Entrance/Rail'));
  let separation=Infinity;
  for(const a of original)for(const b of staged){let d2=0;for(let axis=0;axis<3;axis++){const d=Math.max(0,a.min[axis]-b.max[axis],b.min[axis]-a.max[axis]);d2+=d*d;}separation=Math.min(separation,Math.sqrt(d2));}
  if(file===STUDY_SITES.find(s=>s.id==='107227742')!.files[0])assert.ok(staged.length>0);
  assert.ok(separation>.35,file+' must not introduce duplicate old/new handrails: '+separation);
 }
});


test('actual GLTFLoader names preserve every retained interior and remove only the selected legacy exterior',async()=>{
 const bytes=await readFile(new URL('../../public/belle/landmarks.glb',import.meta.url));
 const loader=new GLTFLoader();
 // This structural import needs no image pixels. Use original binary geometry,
 // nodes, transforms and loader names; bypass only browser-only image decoding.
 loader.register(()=>({name:'structural-image-skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const loaded=await loader.parseAsync(Uint8Array.from(bytes).buffer,'');
 const checks=[
  ['107227742','Aquarium illuminated habitat',false],['107227742','Aquarium aged handrails',false],
  ['107227742','Aquarium worn step nosings',false],['107227742','Aquarium jade glazed tile',false],
  ['107227742','Aquarium black glazed tile',false],['107227742','Aquarium mosaic floor',false],
  ['107227742','Aquarium warm pendant light',false],['107227742','Aquarium aquatic plants',false],
  ['107227742','Aquarium tank glazing',false],['107227742','Aquarium river gravel',false],
  ['107310050','Conservatory concrete paving',false],['107310050','Timber',false],
  ['107310050','Water lily golden heart',false],['107227742','Aquarium aged limestone',true],
  ['107227742','Aquarium exterior copper roof',true],['107310050','Conservatory clear panes',true],
  ['107310050','Conservatory restored gray steel',true],
 ] as const;
 try{
  const authored=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  for(const spec of STUDY_SITES)for(const node of authored.nodes){
   if(!node.name?.startsWith(spec.id+'_'))continue;
   const imported=loaded.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName(node.name));
   assert.ok(imported,'Actual loaded site node: '+node.name);
   assert.equal(replaceableLegacyMesh(spec.id,imported.name),replaceableLegacyMesh(spec.id,node.name),'Authored/loaded classifier parity: '+node.name);
  }
  for(const [id,detail,expected] of checks){
   const name=T.PropertyBinding.sanitizeNodeName(id+'_'+detail),node=loaded.scene.getObjectByName(name);
   assert.ok(node,'actual loader produced '+name);assert.ok(node instanceof T.Mesh);
   assert.equal(replaceableLegacyMesh(id,node.name),expected,node.name);
  }
 }finally{
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  loaded.scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 }
});
