import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DETROIT_LANDMARKS,SKYLINE_ID} from './architectureData.ts';
import {worldSolids,SPOTS} from './world.ts';

async function landmark(id:string){
  const buf=await readFile(resolve('../../exports/architecture',id+'.glb')),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Decode actual exported geometry and transforms, excluding browser-only image decoding.
  assert.ok(j.images?.length||id===SKYLINE_ID);assert.ok(j.meshes.length>3);
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,pad=Buffer.alloc(length,32);json.copy(pad);
  const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+length);
  return (await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'')).scene;
}
for(const l of DETROIT_LANDMARKS)test(l.name+' exports at architectural scale with a protective footprint',async()=>{
  const model=await landmark(l.id);model.rotation.y=l.rotation;model.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3());
  assert.ok(size.toArray().every(Number.isFinite));assert.ok(size.y>l.height*.8&&size.y<l.height+1);
  assert.ok(size.x<=l.hx*2+2,`width ${size.x}`);assert.ok(size.z<=l.hz*2+2,`depth ${size.z}`);
  assert.ok(bounds.min.y>-.2&&bounds.min.y<.2,`ground ${bounds.min.y}`);
});
test('Renaissance Center has a 221 m central tower and full multi-tower footprint',async()=>{
  const model=await landmark(SKYLINE_ID),size=new Box3().setFromObject(model).getSize(new Vector3());
  assert.ok(size.y>220&&size.y<226);assert.ok(size.x>140&&size.z>140);
});
test('landmarks keep the trail, warehouse footprints and sightseeing spawns clear',()=>{
  const solids=worldSolids();
  for(const l of DETROIT_LANDMARKS){
    assert.ok(Math.abs(l.x)-l.hx>5);
    for(const b of solids.filter(s=>s.kind==='warehouse'))assert.ok(Math.abs(l.x-b.x)>l.hx+b.hx||Math.abs(l.z-b.z)>l.hz+b.hz);
    for(const p of SPOTS)assert.ok(Math.abs(p.x-l.x)>l.hx+2||Math.abs(p.z-l.z)>l.hz+2);
  }
});
