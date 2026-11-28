import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {resolve} from 'node:path';
import * as T from 'three';
import {repoRoot} from '../scripts/paths.mjs';
import {applyEdits,belleStartupWorkEdits,BELLE_ROOT} from '../scripts/source-transforms.mjs';
import {registerSwoopTextureRoot} from '../src/sourceTextureWarmup.ts';

const original=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/startupWork.ts'),'utf8');
const patched=applyEdits(original,belleStartupWorkEdits(original));
const helper=new URL('../src/sourceTextureWarmup.ts',import.meta.url).href;
const executable=stripTypeScriptTypes(patched.replace("'@dequindre-preview/sourceTextureWarmup'",JSON.stringify(helper)),{mode:'strip'});
const {warmObjectTextures}=await import('data:text/javascript;base64,'+Buffer.from(executable).toString('base64'));
const texture=name=>{const value=new T.Texture({width:2048,height:2048});value.name=name;return value;};
const mesh=map=>new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({map}));

test('actual host texture warmup keeps every host asset and only visible registered source assets',async()=>{
  const scene=new T.Scene(),source=new T.Group(),hiddenSource=new T.Group(),hiddenHost=new T.Group();
  hiddenSource.visible=hiddenHost.visible=false;
  scene.add(source,hiddenHost);
  source.add(hiddenSource);
  const visible=texture('source-visible'),hidden=texture('source-hidden-ancestor'),selfHidden=texture('source-self-hidden');
  const hostVisible=texture('host-visible'),hostHidden=texture('host-hidden'),shared=texture('shared'),uniform=texture('host-hidden-uniform');
  source.add(mesh(visible));hiddenSource.add(mesh(hidden));
  const hiddenMesh=mesh(selfHidden);hiddenMesh.visible=false;source.add(hiddenMesh);
  // The hidden source use comes first. It must not prevent a later host use
  // of this identical material/texture from receiving the original warmup.
  const sharedMaterial=new T.MeshStandardMaterial({map:shared});
  hiddenSource.add(new T.Mesh(new T.BufferGeometry(),sharedMaterial));
  hiddenHost.add(mesh(hostHidden),new T.Mesh(new T.BufferGeometry(),sharedMaterial));
  hiddenHost.add(new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial({uniforms:{images:{value:[uniform,shared]}}})));
  scene.add(mesh(hostVisible));
  const unregister=registerSwoopTextureRoot(source),uploads=[];
  const renderer={initTexture:value=>uploads.push(value)};
  try{
    assert.equal(await warmObjectTextures(renderer,scene),5);
    assert.deepEqual(new Set(uploads),new Set([visible,hostVisible,hostHidden,shared,uniform]));
    assert.equal(await warmObjectTextures(renderer,scene),0,'original renderer/version cache remains authoritative');
    hiddenSource.visible=true;hiddenMesh.visible=true;
    assert.equal(await warmObjectTextures(renderer,scene),2,'previously hidden source textures prepare when the source view reveals them');
    assert.deepEqual(new Set(uploads),new Set([visible,hidden,selfHidden,hostVisible,hostHidden,shared,uniform]));
    assert.equal(uploads.length,7,'shared texture uploads only once');
    assert.equal(hidden.image.width,2048,'original image dimensions are unchanged');
  }finally{unregister();}
});

test('source eligibility follows the full ancestor chain and unregistering restores original warm policy',async()=>{
  const scene=new T.Scene(),hiddenParent=new T.Group(),source=new T.Group();
  hiddenParent.visible=false;scene.add(hiddenParent);hiddenParent.add(source);
  const image=texture('source-under-hidden-host-parent');source.add(mesh(image));
  const unregister=registerSwoopTextureRoot(source),uploads=[];
  const renderer={initTexture:value=>uploads.push(value)};
  try{
    assert.equal(await warmObjectTextures(renderer,scene),0);
    unregister();
    assert.equal(await warmObjectTextures(renderer,scene),1);
    assert.deepEqual(uploads,[image]);
  }finally{unregister();}
});

test('actual original texture upload loop preserves cancellation and completed-upload caching',async()=>{
  const scene=new T.Scene(),source=new T.Group();scene.add(source);
  const images=[texture('first'),texture('second'),texture('third')];
  source.add(...images.map(mesh));
  const unregister=registerSwoopTextureRoot(source),reason=new Error('cancelled preparation');
  try{
    const alreadyCancelled=new AbortController();alreadyCancelled.abort(reason);
    const rejected=[];
    await assert.rejects(warmObjectTextures({initTexture:value=>rejected.push(value)},scene,alreadyCancelled.signal),error=>error===reason);
    assert.equal(rejected.length,0);
    const controller=new AbortController(),uploads=[];
    const renderer={initTexture:value=>{uploads.push(value);if(uploads.length===1)controller.abort(reason);}};
    await assert.rejects(warmObjectTextures(renderer,scene,controller.signal),error=>error===reason);
    assert.deepEqual(uploads,[images[0]]);
    assert.equal(await warmObjectTextures(renderer,scene),2);
    assert.deepEqual(uploads,images);
  }finally{unregister();}
});

test('source-only warmup hook refuses changed or missing original callbacks',()=>{
  assert.throws(()=>belleStartupWorkEdits(original+'\n'),/source has changed/);
  assert.throws(()=>belleStartupWorkEdits(original.replace('root.traverse(object=>{const material=','root.traverse(object=>{const absent='),{verify:false}),/exactly one/);
});
