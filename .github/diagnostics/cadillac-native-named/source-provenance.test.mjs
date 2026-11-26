import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {runtimeAssetReference,retainedRuntimeAsset,verifyRuntimeAssets,verifyRequiredSourceAssets} from './source-provenance.mjs';

const manifest=()=>structuredClone(runtimeAssetReference.files);

test('the full original759 artifact defines all unchanged runtime assets, including both real drivers',()=>{
 const actual=manifest();
 actual.push({path:'index.html',bytes:1,sha256:'diagnostic-index'},
  {path:'assets/main-diagnostic.js',bytes:1,sha256:'diagnostic-main'});
 const result=verifyRuntimeAssets(actual);
 assert.equal(result.files,191);assert.equal(result.originalArtifact.id,15127074963);
 for(const asset of runtimeAssetReference.sourceAssets)assert(actual.some(entry=>entry.path===asset.bundledPath&&entry.sha256===asset.sha256&&entry.bytes===asset.bytes));
 assert.equal(retainedRuntimeAsset('deployment-health.mjs'),true,'Unchanged standalone runtime code remains covered');
});

test('the actual sparse-build failure is rejected when its two real hero GLBs are absent',()=>{
 const omitted=new Set(runtimeAssetReference.sourceAssets.map(asset=>asset.bundledPath));
 const actual=manifest().filter(entry=>!omitted.has(entry.path));
 assert.equal(actual.length,189);
 assert.throws(()=>verifyRuntimeAssets(actual),/Missing original759 runtime assets/);
});

test('changed geometry, extra assets, and duplicate paths fail full runtime equality',()=>{
 const changed=manifest();changed.find(entry=>entry.path===runtimeAssetReference.sourceAssets[0].bundledPath).sha256='0'.repeat(64);
 assert.throws(()=>verifyRuntimeAssets(changed),/runtime asset bytes changed/);
 const extra=manifest();extra.push({path:'extra.glb',bytes:1,sha256:'0'.repeat(64)});
 assert.throws(()=>verifyRuntimeAssets(extra),/Unexpected runtime assets/);
 const duplicate=manifest();duplicate.push({...duplicate[0]});
 assert.throws(()=>verifyRuntimeAssets(duplicate),/Duplicate runtime asset paths/);
});

test('both exact original source GLBs must be materialized before the build',async()=>{
 assert(process.env.APP_GAME,'APP_GAME must identify the pinned original application');
 const app=resolve(process.env.APP_GAME,'../../../../..');
 const assets=await verifyRequiredSourceAssets(app);assert.equal(assets.length,2);
 const missing=await mkdtemp(resolve(tmpdir(),'missing-cadillac-source-'));
 try{
  await assert.rejects(verifyRequiredSourceAssets(missing),/ENOENT/);
  const path=resolve(missing,runtimeAssetReference.sourceAssets[0].path);
  await mkdir(dirname(path),{recursive:true});await writeFile(path,'different bytes');
  await assert.rejects(verifyRequiredSourceAssets(missing),/Required original source asset size/);
 }finally{await rm(missing,{recursive:true,force:true});}
});
