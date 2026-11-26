import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {archiveDiagnosticSource,verifyDiagnosticSource,diagnosticInventory} from './archive-source.mjs';
import {hashFile,sha256} from './contract.mjs';

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
