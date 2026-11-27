/** Archive and verify the complete isolated diagnostic source, without secrets. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gitBlob,sha256} from './contract.mjs';

const prefix='.github/diagnostics/belle-view-preflight/';
const workflow='.github/workflows/belle-native-view-preflight.yml';
export async function diagnosticInventory(checkout,expectedHead){
 const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
 const head=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
 assert.match(expectedHead??'',/^[a-f0-9]{40}$/,'Expected diagnostic head is required');assert.equal(head,expectedHead);
 assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'','Diagnostic checkout is not clean');
 const paths=git(['ls-files','-z','--',prefix,workflow]).split('\0').filter(Boolean).sort();
 assert(paths.includes(workflow)&&paths.some(path=>path.startsWith(prefix)),'Diagnostic sources/workflow missing');
 const files=[];
 for(const path of paths){
  assert(path===workflow||path.startsWith(prefix));assert(!path.split('/').includes('..'));
  const absolute=resolve(checkout,path),info=await lstat(absolute);assert(info.isFile()&&!info.isSymbolicLink(),'Diagnostic source must be a regular file: '+path);
  const bytes=await readFile(absolute),blob=gitBlob(bytes);assert.equal(blob,git(['rev-parse',head+':'+path]),'Diagnostic file differs from its Git blob');
  files.push({path,gitBlob:blob,bytes:bytes.length,sha256:sha256(bytes),archive:'diagnostic-source/'+path.slice('.github/'.length)});
 }
 return {version:1,head,tree,files};
}
export async function archiveDiagnosticSource(checkout,evidence,expectedHead){
 const receipt=await diagnosticInventory(checkout,expectedHead);await mkdir(evidence,{recursive:true});
 for(const file of receipt.files){const destination=resolve(evidence,file.archive);await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,await readFile(resolve(checkout,file.path)),{flag:'wx'});
 }
 await writeFile(resolve(evidence,'diagnostic-source-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
export async function verifyDiagnosticSource(checkout,evidence){
 const before=JSON.parse(await readFile(resolve(evidence,'diagnostic-source-receipt.json'),'utf8'));
 const after=await diagnosticInventory(checkout,before.head);assert.deepEqual(after,before,'Diagnostic source/tree changed during execution');
 for(const file of before.files){const archived=await readFile(resolve(evidence,file.archive));assert.equal(archived.length,file.bytes);
  assert.equal(sha256(archived),file.sha256,'Archived diagnostic source changed');assert.equal(gitBlob(archived),file.gitBlob);
  assert.deepEqual(archived,await readFile(resolve(checkout,file.path)),'Archive/checkout bytes differ');
 }
 await writeFile(resolve(evidence,'diagnostic-source-after.json'),JSON.stringify({...after,unchanged:true,archivedBytesVerified:true},null,2)+'\n');return after;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,checkout,evidence]=process.argv.slice(2);assert(['capture','verify'].includes(mode));assert(checkout&&evidence);
 const receipt=await (mode==='capture'?archiveDiagnosticSource(resolve(checkout),resolve(evidence),process.env.DIAGNOSTIC_EXPECTED_HEAD):verifyDiagnosticSource(resolve(checkout),resolve(evidence)));
 console.log(JSON.stringify({mode,diagnosticHead:receipt.head,diagnosticTree:receipt.tree,sourceFiles:receipt.files.length,unchanged:mode==='verify'}));
}
