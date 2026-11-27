import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {archiveDiagnosticSource,verifyDiagnosticSource,diagnosticInventory} from './archive-source.mjs';
import {PIN,hashFile,sha256,gitBlob,buildInventory,verifyStagedBuild} from './contract.mjs';

test('diagnostic archive pins every source/workflow byte, head and tree before/after execution',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'full-desktop-stall-source-')),checkout=resolve(root,'repo'),evidence=resolve(root,'evidence');
 const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
 const paths=['.github/diagnostics/belle-staged-desktop-stall/preload.mjs','.github/diagnostics/belle-staged-desktop-stall/README.md','.github/workflows/belle-staged-desktop-stall-attribution.yml'];
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
  const extra=resolve(checkout,'.github/diagnostics/belle-staged-desktop-stall/untracked.mjs');await writeFile(extra,'extra');
  await assert.rejects(verifyDiagnosticSource(checkout,evidence),/not clean/);await rm(extra);
  await writeFile(resolve(evidence,receipt.files[0].archive),'tampered archive');await assert.rejects(verifyDiagnosticSource(checkout,evidence));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('immutable ZIP hashing is incremental and detects changed bytes',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'full-desktop-stall-zip-')),path=resolve(root,'input.zip');
 try{const bytes=Buffer.from('exact archived build bytes');await writeFile(path,bytes);assert.deepEqual(await hashFile(path),{bytes:bytes.length,sha256:sha256(bytes)});
  await writeFile(path,Buffer.concat([bytes,Buffer.from('changed')]));assert.notEqual((await hashFile(path)).sha256,sha256(bytes));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('staged build binding rejects missing or wrong markers, malformed manifests and missing entry scripts',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'staged-desktop-build-'));
 try{
  await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/game.js'),'original script');
  const index='<script type="module" src="./assets/game.js"></script>';
  await writeFile(resolve(root,'index.html'),index);
  await writeFile(resolve(root,'asset-manifest.json'),JSON.stringify(['assets/game.js']));
  const marker={sourceSha:PIN.head,indexSha256:sha256(Buffer.from(index)),stagedFlag:'VITE_STAGED_BELLE_ARCHITECTURE=1'};
  const markerPath=resolve(root,'staged-landmark-proof-build.json');
  await assert.rejects(verifyStagedBuild(root,await buildInventory(root)),/ENOENT/);
  await writeFile(markerPath,JSON.stringify(marker));
  const files=await buildInventory(root),result=await verifyStagedBuild(root,files);
  assert.deepEqual(result.entryScripts,['assets/game.js']);assert.equal(result.assets,1);
  assert.equal(result.sourceSha,PIN.head);assert.equal(result.stagedFlag,marker.stagedFlag);assert.equal(result.indexSha256,marker.indexSha256);
  await assert.rejects(verifyStagedBuild(root,[...files,files[0]]),/Duplicate/);
  await assert.rejects(verifyStagedBuild(root,files.filter(row=>row.file!=='staged-landmark-proof-build.json')),/receipt mismatch/);
  for(const [change,message] of [[{sourceSha:'0'.repeat(40)},/marker source/],[{stagedFlag:'VITE_STAGED_BELLE_ARCHITECTURE=0'},/marker flag/],[{indexSha256:'0'.repeat(64)},/marker index/]]){
   await writeFile(markerPath,JSON.stringify({...marker,...change}));
   await assert.rejects(verifyStagedBuild(root,await buildInventory(root)),message);
  }
  await writeFile(markerPath,JSON.stringify(marker));
  await assert.rejects(verifyStagedBuild(root,files.filter(row=>row.file!=='assets/game.js')),/absent staged build file/);
  await writeFile(resolve(root,'asset-manifest.json'),'["assets/game.js","assets/game.js"]');
  await assert.rejects(verifyStagedBuild(root,await buildInventory(root)),/Malformed/);
  await writeFile(resolve(root,'asset-manifest.json'),'[]');
  await writeFile(resolve(root,'index.html'),'<script src="./assets/missing.js"></script>');
  await writeFile(markerPath,JSON.stringify({...marker,indexSha256:sha256(await readFile(resolve(root,'index.html')))}));
  await assert.rejects(verifyStagedBuild(root,await buildInventory(root)),/unbound entry/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('independent downloader constants match the execution contract exactly',()=>{
 const downloader=new URL('./download-build.py',import.meta.url);
 const inspect='import ast,json,sys; tree=ast.parse(open(sys.argv[1]).read()); print(json.dumps({n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name)}))';
 const pins=JSON.parse(execFileSync('python3',['-c',inspect,downloader.pathname],{encoding:'utf8'}));
 assert.deepEqual(pins,{ARTIFACT_ID:PIN.artifactId,RUN_ID:PIN.runId,ARTIFACT_NAME:PIN.artifactName,CANDIDATE:PIN.candidate,
  EXPECTED_SHA256:PIN.artifactSha256,EXPECTED_BYTES:PIN.artifactBytes});
});
