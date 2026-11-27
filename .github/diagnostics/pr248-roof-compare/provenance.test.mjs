import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {preserveDiagnostic,verifyDiagnostic} from './provenance.mjs';

async function fixture(){
 const root=await mkdtemp(resolve(tmpdir(),'roof-provenance-'));
 const source=resolve(root,'source'),out=resolve(root,'evidence');
 const bundle=resolve(source,'.github/diagnostics/pr248-roof-compare');
 const workflow=resolve(source,'.github/workflows/belle-pr248-roof-comparison.yml');
 await mkdir(bundle,{recursive:true});await mkdir(resolve(source,'.github/workflows'),{recursive:true});await mkdir(out);
 await writeFile(resolve(bundle,'entry.mjs'),'export const scope = "diagnostic";\n');
 await writeFile(workflow,'name: original evidence workflow\n');
 const git=args=>execFileSync('git',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','--quiet']);git(['add','.']);
 git(['-c','user.name=Diagnostic Contract','-c','user.email=diagnostic-contract@example.invalid','commit','--quiet','-m','Immutable test fixture']);
 const head=git(['rev-parse','HEAD']);
 return {root,source,out,bundle,workflow,head,git};
}

test('Archived workflow, diagnostic source and commit are bound to original Git bytes',async()=>{
 const f=await fixture();
 try{
  await preserveDiagnostic(f.source,f.out,f.head);
  const saved=await verifyDiagnostic(f.source,f.out,f.head);
  assert.equal(saved.workflow.path,'.github/workflows/belle-pr248-roof-comparison.yml');
  assert.equal(saved.workflow.archivePath,'workflow.yml');
  for(const path of ['workflow.yml','diagnostic-source/entry.mjs','diagnostic-commit.txt']){
   const file=resolve(f.out,path),original=await readFile(file);
   await writeFile(file,Buffer.concat([original,Buffer.from('changed\n')]));
   await assert.rejects(verifyDiagnostic(f.source,f.out,f.head));
   await writeFile(file,original);await verifyDiagnostic(f.source,f.out,f.head);
  }
 }finally{await rm(f.root,{recursive:true,force:true});}
});

test('Changed current source, a wrong head and an untracked diagnostic file are rejected',async()=>{
 const f=await fixture();
 try{
  await preserveDiagnostic(f.source,f.out,f.head);
  await assert.rejects(verifyDiagnostic(f.source,f.out,'0'.repeat(40)));
  const original=await readFile(f.workflow);await writeFile(f.workflow,'name: changed workflow\n');
  await assert.rejects(verifyDiagnostic(f.source,f.out,f.head));await writeFile(f.workflow,original);
  const untracked=resolve(f.bundle,'untracked.mjs');await writeFile(untracked,'export const extra = true;\n');
  await assert.rejects(verifyDiagnostic(f.source,f.out,f.head));await rm(untracked);
  await verifyDiagnostic(f.source,f.out,f.head);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
