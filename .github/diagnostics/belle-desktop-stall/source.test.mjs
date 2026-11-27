import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {archiveDiagnosticSource,verifyDiagnosticSource,diagnosticInventory} from './archive-source.mjs';
import {PIN,hashFile,sha256,gitBlob,buildInventory,verifyStagedBuild} from './contract.mjs';

test('diagnostic archive pins every source/workflow byte, head and tree before/after execution',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'desktop-stall-source-')),checkout=resolve(root,'repo'),evidence=resolve(root,'evidence');
 const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
 const paths=['.github/diagnostics/belle-desktop-stall/preload.mjs','.github/diagnostics/belle-desktop-stall/README.md','.github/workflows/belle-desktop-stall-attribution.yml'];
 try{
  await mkdir(checkout);for(const path of paths){await mkdir(dirname(resolve(checkout,path)),{recursive:true});await writeFile(resolve(checkout,path),'original '+path+'\n');}
  git(['init','-q','-b','upgrade-redesign']);git(['add','.']);git(['-c','user.name=Diagnostic fixture','-c','user.email=fixture@example.invalid','commit','-qm','Fixture','--no-gpg-sign']);
  const head=git(['rev-parse','HEAD']);const receipt=await archiveDiagnosticSource(checkout,evidence,head);
  assert.equal(receipt.head,head);assert.equal(receipt.tree,git(['rev-parse','HEAD^{tree}']));assert.deepEqual(receipt.files.map(f=>f.path),paths.slice().sort());
  assert(receipt.files.every(f=>!f.archive.split('/').some(part=>part.startsWith('.'))),'Archived paths must survive artifact hidden-file filtering');
  assert.deepEqual(await verifyDiagnosticSource(checkout,evidence),receipt);
  await assert.rejects(diagnosticInventory(checkout,'0'.repeat(40)));
  const changed=resolve(checkout,paths[0]),before=await readFile(changed);await writeFile(changed,'changed');
  await assert.rejects(verifyDiagnosticSource(checkout,evidence),/not clean/);await writeFile(changed,before);
  const extra=resolve(checkout,'.github/diagnostics/belle-desktop-stall/untracked.mjs');await writeFile(extra,'extra');
  await assert.rejects(verifyDiagnosticSource(checkout,evidence),/not clean/);await rm(extra);
  await writeFile(resolve(evidence,receipt.files[0].archive),'tampered archive');await assert.rejects(verifyDiagnosticSource(checkout,evidence));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('immutable ZIP hashing is incremental and detects changed bytes',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'desktop-stall-zip-')),path=resolve(root,'input.zip');
 try{const bytes=Buffer.from('exact archived build bytes');await writeFile(path,bytes);assert.deepEqual(await hashFile(path),{bytes:bytes.length,sha256:sha256(bytes)});
  await writeFile(path,Buffer.concat([bytes,Buffer.from('changed')]));assert.notEqual((await hashFile(path)).sha256,sha256(bytes));
 }finally{await rm(root,{recursive:true,force:true});}
});

async function stagedFixture(){
 assert(process.env.STRICT_STAGED_MANIFEST_PATH,'Set STRICT_STAGED_MANIFEST_PATH to the pinned source manifest');
 const manifestBytes=await readFile(process.env.STRICT_STAGED_MANIFEST_PATH);
 assert.equal(gitBlob(manifestBytes),PIN.stagedManifestBlob,'Test input must be the actual current source manifest');
 const manifest=JSON.parse(manifestBytes),root=await mkdtemp(resolve(tmpdir(),'desktop-stall-staged-'));
 const stagedPath='belle/staged-architecture/manifest.json';
 const lods=manifest.models.flatMap(model=>model.lods.map(lod=>({file:'belle/staged-architecture/'+lod.file,bytes:lod.bytes,sha256:lod.sha256})));
 const index=Buffer.from('<!doctype html><title>Metadata validation fixture</title>');
 const proof={sourceSha:PIN.head,indexSha256:sha256(index),stagedFlag:'VITE_STAGED_BELLE_ARCHITECTURE=1'};
 const assets=[stagedPath,...lods.map(row=>row.file)];
 await mkdir(dirname(resolve(root,stagedPath)),{recursive:true});
 await writeFile(resolve(root,stagedPath),manifestBytes);await writeFile(resolve(root,'index.html'),index);
 await writeFile(resolve(root,'staged-landmark-proof-build.json'),JSON.stringify(proof)+'\n');
 await writeFile(resolve(root,'asset-manifest.json'),JSON.stringify(assets)+'\n');
 // These rows exercise metadata binding to the real pinned manifest. Runtime
 // obtains them exclusively from buildInventory hashing the extracted GLBs.
 const files=[...await buildInventory(root),...lods];
 return {root,manifestBytes,manifest,proof,assets,lods,files,
  async replace(name,value){const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value)+'\n');
   await writeFile(resolve(root,name),bytes);const row=files.find(row=>row.file===name);row.bytes=bytes.length;row.sha256=sha256(bytes);},
  async cleanup(){await rm(root,{recursive:true,force:true});}};
}

test('current staged proof binds source, compile flag, index and all twelve real-manifest LOD receipts',async()=>{
 const f=await stagedFixture();
 try{
  const receipt=await verifyStagedBuild(f.root,f.files);
  assert.equal(receipt.sourceSha,PIN.head);assert.equal(receipt.modelCount,4);assert.equal(receipt.lodCount,12);
  assert.equal(receipt.manifest.gitBlob,PIN.stagedManifestBlob);assert.deepEqual(receipt.lods,f.lods);
  for(const [field,value,pattern] of [
   ['sourceSha','e6b3daab8d5159c97ec45d8913c9e58cc6031914',/Staged build source/],
   ['stagedFlag','VITE_STAGED_BELLE_ARCHITECTURE=0',/Staged build flag/],
   ['indexSha256','0'.repeat(64),/Staged build index/],
  ]){
   await f.replace('staged-landmark-proof-build.json',{...f.proof,[field]:value});
   await assert.rejects(verifyStagedBuild(f.root,f.files),pattern);
  }
  await f.replace('staged-landmark-proof-build.json',f.proof);
  await f.replace('asset-manifest.json',f.assets.slice(1));
  await assert.rejects(verifyStagedBuild(f.root,f.files),/absent from asset manifest/);
  await f.replace('asset-manifest.json',[...f.assets,f.assets[0]]);
  await assert.rejects(verifyStagedBuild(f.root,f.files),/Malformed asset manifest/);
  await f.replace('asset-manifest.json',f.assets);
  for(const mutate of [
   m=>m.productionReady=true,m=>m.nativePerformanceAccepted=true,m=>m.models.pop(),
   m=>m.models[0].lods.pop(),m=>m.models[0].lods[0].file='../escaped.glb',
   m=>m.models[0].lods[0].sha256='0'.repeat(64),
  ]){const changed=structuredClone(f.manifest);mutate(changed);await f.replace('belle/staged-architecture/manifest.json',changed);
   await assert.rejects(verifyStagedBuild(f.root,f.files),/manifest differs from pinned source/);
  }
 }finally{await f.cleanup();}
});

test('missing, duplicate, extra and corrupted staged assets cannot qualify the default or partial build',async()=>{
 const f=await stagedFixture();
 try{
  const name=f.lods[0].file;
  await assert.rejects(verifyStagedBuild(f.root,f.files.filter(row=>row.file!==name)),/Missing staged GLB/);
  await assert.rejects(verifyStagedBuild(f.root,[...f.files,f.lods[0]]),/Duplicate compiled inventory/);
  for(const [field,value,pattern] of [['bytes',1,/Staged GLB size/],['sha256','0'.repeat(64),/Staged GLB hash/]]){
   const changed=structuredClone(f.files);changed.find(row=>row.file===name)[field]=value;
   await assert.rejects(verifyStagedBuild(f.root,changed),pattern);
  }
  await assert.rejects(verifyStagedBuild(f.root,[...f.files,{file:'belle/staged-architecture/unbound.glb',bytes:1,sha256:'0'.repeat(64)}]),/Unexpected staged build files/);
  // Exercise the actual runtime hash reader, not only fabricated inventory
  // comparisons: corrupted GLB bytes must not match the manifest's promises.
  for(const row of f.lods)await writeFile(resolve(f.root,row.file),'corrupted asset bytes');
  await assert.rejects(verifyStagedBuild(f.root,await buildInventory(f.root)),/Staged GLB size mismatch/);
  await rm(resolve(f.root,'staged-landmark-proof-build.json'));
  await assert.rejects(verifyStagedBuild(f.root,await buildInventory(f.root)),/ENOENT/);
 }finally{await f.cleanup();}
});

test('independent downloader constants match the execution contract exactly',()=>{
 const downloader=new URL('./download-build.py',import.meta.url);
 const inspect='import ast,json,sys; tree=ast.parse(open(sys.argv[1]).read()); print(json.dumps({n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name)}))';
 const pins=JSON.parse(execFileSync('python3',['-c',inspect,downloader.pathname],{encoding:'utf8'}));
 assert.deepEqual(pins,{ARTIFACT_ID:PIN.artifactId,RUN_ID:PIN.runId,ARTIFACT_NAME:PIN.artifactName,CANDIDATE:PIN.candidate,
  EXPECTED_SHA256:PIN.artifactSha256,EXPECTED_BYTES:PIN.artifactBytes});
});
