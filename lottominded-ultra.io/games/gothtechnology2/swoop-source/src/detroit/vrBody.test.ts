import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SkinnedMesh,Mesh,Vector3} from 'three';
import {Hero} from './actors.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';
async function mesh(id:string,lod:number){
  const buf=await readFile(resolve('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
const data=new Map([['DS_EUC_01',await mesh('DS_EUC_01',1)]]);
for(const {id} of RIDER_CHOICES){
 data.set(id,await mesh(id,id==='DS_Man_01'?0:1));
 test(id+' keeps animated body and wheel in VR and restores the full head on exit',()=>{
  const hero=new Hero(data,undefined,id);hero.apply(createPose());
  const original=new Map<Mesh,Mesh['geometry']>();let before=0,after=0;
  hero.rider.traverse(o=>{const m=o as Mesh;if(m.isMesh){original.set(m,m.geometry);before+=m.geometry.index?.count??m.geometry.getAttribute('position').count;}});
  const feet=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3()));
  hero.visibility.setVR(true);hero.visibility.setVR(true);
  assert.equal(hero.rider.visible,true);assert.equal(hero.vehicle.visible,true);assert.ok(hero.vrEyeHeight>.8&&hero.vrEyeHeight<2.5);
  hero.rider.traverse(o=>{const m=o as SkinnedMesh;if(!m.isMesh||!m.visible)return;
   after+=m.geometry.index?.count??m.geometry.getAttribute('position').count;
   if(m.isSkinnedMesh){
    assert.ok(m.geometry.index!.count>0,'body triangles remain');
    assert.notEqual(m.geometry,original.get(m),'VR must not mutate the shared asset');
    const indices=new Set(m.geometry.index!.array),skin=m.geometry.getAttribute('skinIndex'),weight=m.geometry.getAttribute('skinWeight');
    for(const limb of ['LeftHand','RightHand','LeftFoot','RightFoot']){
     const bone=m.skeleton.bones.findIndex(b=>b.name===limb);if(bone<0)continue;
     assert.ok([...indices].some(i=>[0,1,2,3].some(c=>skin.getComponent(i,c)===bone&&weight.getComponent(i,c)>.5)),limb+' remains visible');
    }
   }
  });
  assert.ok(after>0&&after<before,'head-level triangles are removed');
  hero.apply({...createPose(),rollAngle:.2,crouch:.3});
  assert.ok(hero.legs.every(l=>l.foot.getWorldPosition(new Vector3()).toArray().every(Number.isFinite)));
  hero.apply(createPose());hero.legs.forEach((l,i)=>assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(feet[i])<1e-5));
  hero.visibility.setVR(false);for(const [m,g] of original)assert.equal(m.geometry,g,'original geometry restored');
  hero.dispose();
 });
}
