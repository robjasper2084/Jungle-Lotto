import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DogCompanion} from './companion.ts';
import {DogView} from './dog-view.ts';
import {DetroitWorld,SPOTS,heightAt} from './world.ts';
import type {TerrainSampler} from '../simulation/world.ts';
const flat:TerrainSampler={sampleGround(x,z,out){out.height=0;out.offCourse=false;out.normal={x:0,y:1,z:0};out.surface='pavement';return out;},raycastObstacle(){return null;}};
test('dog starts on the rider left and keeps up with a moving rider',()=>{
  const dog=new DogCompanion(flat),r={x:0,z:0,headingY:0,speed:7};dog.reset(r);
  assert.ok(dog.x>1&&dog.x<1.5);
  for(let i=0;i<600;i++){r.z+=7/60;dog.update(r,1/60);assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)<2.5);}
  assert.ok(dog.speed>6.5&&dog.speed<7.5);
});
test('dog follows turns and settles into idle after a stop',()=>{
  const dog=new DogCompanion(flat),r={x:0,z:0,headingY:0,speed:5};dog.reset(r);
  for(let i=0;i<600;i++){r.headingY+=.004;r.x+=Math.sin(r.headingY)*5/60;r.z+=Math.cos(r.headingY)*5/60;dog.update(r,1/60);}
  assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)<2.5);
  r.speed=0;for(let i=0;i<240;i++)dog.update(r,1/60);
  assert.equal(dog.speed,0);assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)>1);
  const before=[dog.x,dog.y,dog.z,dog.heading];dog.update({...r,z:r.z+5},0);assert.deepEqual([dog.x,dog.y,dog.z,dog.heading],before);
});
test('dog faces the direction of travel when the wheel reverses',()=>{
  const dog=new DogCompanion(flat),r={x:0,z:0,headingY:0,speed:-3};dog.reset(r);
  for(let i=0;i<240;i++){r.z-=3/60;dog.update(r,1/60);}
  assert.ok(Math.cos(dog.heading)<-.98);assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)<2.5);
  assert.ok(dog.x>1,'stays on rider left while reversing');
});
test('all city spawns include a grounded nearby dog, and it switches sides at a wall',async()=>{
  const world=await new DetroitWorld().init(),dog=new DogCompanion(world);
  for(const s of SPOTS){dog.reset({...s,headingY:s.heading,speed:0});assert.ok(Number.isFinite(dog.y));assert.ok(Math.hypot(dog.x-s.x,dog.z-s.z)<2);}
  const p=SPOTS[0];world.addBox({x:p.x+.9,y:heightAt(p.x,p.z)+1,z:p.z,hx:.15,hy:1,hz:2,kind:'test-wall'});world.step();
  dog.reset({x:p.x,z:p.z,headingY:0,speed:0});assert.ok(dog.x<p.x,'obstructed left side uses clear right');
});
const loader=new GLTFLoader();loader.register(()=>({name:'headless-textures',loadTexture:()=>Promise.resolve(new T.Texture())}));
const buffer=await fs.readFile(new URL('../../public/exports/glb/DS_Boerboel_01/DS_Boerboel_01_LOD1.glb',import.meta.url));
const asset=await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
test('shipped dog contains distinct moving trot and run skeleton animations',()=>{
  assert.deepEqual(asset.animations.map(a=>a.name),['Dog_Idle','Dog_Trot','Dog_Run']);
  for(const name of ['Dog_Trot','Dog_Run']){
    const view=new DogView(asset);view.mixer.stopAllAction();const clip=asset.animations.find(a=>a.name===name)!;view.mixer.clipAction(clip).reset().setEffectiveWeight(1).play();
    view.mixer.setTime(0);view.model.updateMatrixWorld(true);const paw=view.model.getObjectByName('front_paw_L')!,first=paw.getWorldPosition(new T.Vector3());
    view.mixer.setTime(clip.duration*.4);view.model.updateMatrixWorld(true);assert.ok(paw.getWorldPosition(new T.Vector3()).distanceTo(first)>.12,name+' moves paws');
  }
});
test('dog animation freezes with pause and blends to running with movement',()=>{
  const dog=new DogCompanion(flat);dog.reset({x:0,z:0,headingY:0,speed:0});const view=new DogView(asset);
  dog.speed=6.7;for(let i=0;i<90;i++)view.update(dog,1/60);assert.equal(view.gait,'run');
  const time=view.mixer.time;view.update(dog,0);assert.equal(view.mixer.time,time);
  dog.speed=0;for(let i=0;i<90;i++)view.update(dog,1/60);assert.equal(view.gait,'idle');
});

test('dog gait loops close without a rest-pose snap',()=>{
  for(const clip of asset.animations){
    const view=new DogView(asset);view.mixer.stopAllAction();const action=view.mixer.clipAction(clip).reset().setEffectiveWeight(1).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const bones:T.Object3D[]=[];view.model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o);});
    view.mixer.setTime(0);view.model.updateMatrixWorld(true);const start=bones.map(b=>b.getWorldPosition(new T.Vector3()));
    view.mixer.setTime(clip.duration);view.model.updateMatrixWorld(true);
    for(let i=0;i<bones.length;i++)assert.ok(start[i].distanceTo(bones[i].getWorldPosition(new T.Vector3()))<.002,clip.name+' '+bones[i].name+' closes');
  }
});

test('animated dog skin does not stretch short mesh edges into long spikes',()=>{
  for(const name of ['Dog_Trot','Dog_Run']){
    const view=new DogView(asset);view.mixer.stopAllAction();const clip=asset.animations.find(a=>a.name===name)!;view.mixer.clipAction(clip).reset().setEffectiveWeight(1).play();
    let mesh!:T.SkinnedMesh;view.model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)mesh=o as T.SkinnedMesh;});
    const pos=mesh.geometry.attributes.position,indices=mesh.geometry.index!,rest=Array.from({length:pos.count},(_,i)=>new T.Vector3().fromBufferAttribute(pos,i));
    const posed=rest.map(p=>p.clone());
    for(let step=0;step<16;step++){
      view.mixer.setTime(clip.duration*step/16);view.model.updateMatrixWorld(true);mesh.skeleton.update();
      posed.forEach((p,i)=>mesh.applyBoneTransform(i,p.copy(rest[i])));
      for(let tri=0;tri<indices.count;tri+=3)for(let e=0;e<3;e++){
        const a=indices.getX(tri+e),b=indices.getX(tri+(e+1)%3),original=rest[a].distanceTo(rest[b]),deformed=posed[a].distanceTo(posed[b]);
        assert.ok(!(deformed>.09&&deformed>original*4),name+' skin spike at '+step+'/16: '+original.toFixed(3)+' -> '+deformed.toFixed(3));
      }
    }
  }
});

test('gait cadence follows travel distance and stays phase-aligned through speed changes',()=>{
  const dog=new DogCompanion(flat);dog.reset({x:0,z:0,headingY:0,speed:0});const view=new DogView(asset);
  for(const speed of [1,3,6.4,2,0]){
    dog.speed=speed;for(let i=0;i<45;i++)view.update(dog,1/60);
    // DogView clones clips to remove tail tracks. Query its active clips by name.
    const trot=view['actions'].find(a=>a.getClip().name==='Dog_Trot')!,run=view['actions'].find(a=>a.getClip().name==='Dog_Run')!;
    assert.ok(Math.abs(trot.time/trot.getClip().duration-run.time/run.getClip().duration)<1e-6);
    const time=run.time;view.update(dog,0);assert.equal(run.time,time);
  }
});
