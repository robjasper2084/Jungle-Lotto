import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import * as Three from 'three';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {repoRoot} from '../scripts/paths.mjs';
import {GAME_ROOT,applyEdits,swoopEdits} from '../scripts/source-transforms.mjs';
import {assetManifest} from '../scripts/asset-manifest.mjs';

const sourceRoot=GAME_ROOT+'/swoop-source/src/detroit/';
const origin='http://127.0.0.1:8317/';
async function compiledSource(name,dependencies={}){
 const path=sourceRoot+name,original=await readFile(resolve(repoRoot,path),'utf8');
 const changed=applyEdits(original,swoopEdits(original,path));
 const {outputText}=ts.transpileModule(changed,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const module={exports:{}};
 vm.runInNewContext(outputText,{module,exports:module.exports,require:specifier=>{
  if(!Object.hasOwn(dependencies,specifier))throw Error('Unexpected scene-builder dependency in asset request test: '+specifier);
  return dependencies[specifier];
 }},{filename:name});
 return module.exports;
}

async function builders(){
 const requests=[];
 class TextureLoader{async loadAsync(url){requests.push({kind:'texture',url});return new Three.Texture();}}
 class GLTFLoader{async loadAsync(url){requests.push({kind:'model',url});return {scene:new Three.Group(),animations:[]};}}
 const data=await compiledSource('architectureData.ts');
 const dependencies={three:{...Three,TextureLoader},'./compressedGLTFLoader.ts':{GLTFLoader},'./architectureData.ts':data,'./world.ts':{hash:()=>.5}};
 return {requests,data,atwater:await compiledSource('atwater.ts',dependencies),architecture:await compiledSource('architecture.ts',dependencies)};
}

/** Verify the final loader URL without repairing it in the test. Follow actual
 * GLB image/buffer URIs relative to that URL, exactly as the real loader does. */
async function assertAssetGraph(requests){
 const manifest=assetManifest(),checked=new Set();
 async function inspect(url){
  assert.match(url,/^\/__swoop-assets__\//,'the actual scene-builder request must already own its namespace: '+url);
  const normalized=new URL(url,origin);assert.equal(normalized.origin,new URL(origin).origin);
  const pathname=normalized.pathname;if(checked.has(pathname))return;checked.add(pathname);
  const record=manifest[pathname];assert.ok(record,'requested original asset has a source record: '+pathname);
  const bytes=await readFile(resolve(repoRoot,record.source));
  assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),record.gitBlob,pathname);
  if(!pathname.endsWith('.glb'))return;
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  for(const value of [...(json.images??[]),...(json.buffers??[])]){
   if(!value.uri||value.uri.startsWith('data:'))continue;
   const dependency=new URL(value.uri,normalized);assert.equal(dependency.origin,normalized.origin);
   await inspect(dependency.pathname+dependency.search);
  }
 }
 for(const request of requests)await inspect(request.url);
 return checked;
}

test('transformed Atwater loader consumes the original skyline data as a valid namespaced request',async()=>{
 const {atwater,data,requests}=await builders();
 const scene=new Three.Scene();await atwater.buildAtwaterSkyline(scene);
 assert.equal(scene.children.length,1);
 assert.deepEqual(requests,[{kind:'model',url:'/__swoop-assets__/exports/atwater/renaissance-center.glb'}]);
 assert.equal(requests[0].url,data.SKYLINE_PATH);
 await assertAssetGraph(requests);
});

test('transformed architecture executes every landmark path join and preserves real asset dependencies',async()=>{
 const {architecture,data,requests}=await builders();
 const scene=new Three.Scene(),groups=new Map();
 const groupAt=z=>{let group=groups.get(z);if(!group){group=new Three.Group();groups.set(z,group);scene.add(group);}return group;};
 try{
  const result=await architecture.createArchitecture(scene,groupAt,[]);
  assert.equal(result.landmarks,data.DETROIT_LANDMARKS.length+1);
  assert.deepEqual(requests.filter(request=>request.kind==='model').map(request=>request.url),[...data.DETROIT_LANDMARKS.map(landmark=>'/__swoop-assets__/exports/architecture/'+landmark.id+'.glb'),'/__swoop-assets__/exports/atwater/renaissance-center.glb']);
  assert.equal(requests.filter(request=>request.kind==='texture').length,4);
  const checked=await assertAssetGraph(requests);
  assert.ok([...checked].some(url=>url.startsWith('/__swoop-assets__/shared-textures/')),'landmark GLB relative image dependencies remain in the source namespace');
 }finally{scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])material.dispose();});}
});
