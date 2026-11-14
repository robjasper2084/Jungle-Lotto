import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inPlaceCorleoClip,disposeCorleoModel} from './corleoAnimation.ts';

test('all ten shipped CORLEO clips match provenance and remain in place',async()=>{
 const directory=new URL('../../public/belle/vehicles/corleo/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 assert.equal(manifest.files.length,10);
 for(const file of manifest.files){
  const bytes=await readFile(new URL(file.name,directory));
  assert.equal(bytes.length,file.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
  const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
  const source=gltf.animations.find(c=>c.name===file.animation);assert.ok(source,file.name);
  const original=source.tracks.find(t=>t.name==='CR_Root.position');assert.ok(original);
  const saved=original.values.slice();
  const clip=inPlaceCorleoClip(source,file.name.includes('_JUMP'));
  const root=gltf.scene.getObjectByName('CR_Root');assert.ok(root);
  const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(clip).play();
  for(let frame=0;frame<90;frame++){mixer.update(clip.duration/30);assert.ok(Math.abs(root.position.x)<.00001);assert.ok(Math.abs(root.position.z)<.00001);assert.ok(Number.isFinite(root.position.y));}
  assert.deepEqual(original.values,saved,'source clip must stay unchanged');
  const positions=clip.tracks.find(t=>t.name==='CR_Root.position')!;
  if(file.name.includes('_CRAWL'))assert.ok(positions.values[1]<.5,'preserve the authored low stance');
  if(file.name.includes('_JUMP'))for(let i=1;i<positions.values.length;i+=3)assert.ok(Math.abs(positions.values[i]-1.62)<.00001,'physics owns jump height');
  mixer.stopAllAction();disposeCorleoModel(gltf.scene);
 }
});
