import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';

export const pins=JSON.parse(await readFile(new URL('./pins.json',import.meta.url),'utf8'));
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
export const json=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
export function checkout(root,mode){
 assert(pins.sources[mode],'Unknown application variant');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const actual={head:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}'])};
 assert.deepEqual(actual,pins.sources[mode],'Application checkout is not the pinned source');
 git(['diff','HEAD','--exit-code']);
 return actual;
}
export function artifactMetadata(a){
 const p=pins.artifact;
 assert.equal(a.id,p.id);assert.equal(a.name,p.name);assert.equal(a.size_in_bytes,p.bytes);
 assert.equal(a.expired,false);assert.equal(a.digest,'sha256:'+p.sha256);
 assert.equal(a.workflow_run?.id,p.run);assert.equal(a.workflow_run?.head_sha,p.head);
 return a;
}
export async function manifest(root){
 const files=[];
 async function walk(at=''){
  for(const e of (await readdir(resolve(root,at),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const path=at?at+'/'+e.name:e.name;assert(!e.isSymbolicLink(),'Unexpected symlink: '+path);
   if(e.isDirectory())await walk(path);else{assert(e.isFile());const b=await readFile(resolve(root,path));files.push({path,bytes:b.length,sha256:sha256(b)});}
  }
 }
 await walk();return {files,sha256:sha256(JSON.stringify(files))};
}
export async function verifyManifest(root,expected){assert.deepEqual(await manifest(root),expected,'Immutable served input changed: '+root);}
export async function modelPins(game,mode){
 const rows=[];
 for(const [file,sides] of Object.entries(pins.models)){
  const b=await readFile(resolve(game,'public/belle/staged-architecture',file)),p=sides[mode];
  assert.equal(b.length,p.bytes,file+' length');assert.equal(sha256(b),p.sha256,file+' hash');
  rows.push({file,bytes:b.length,sha256:p.sha256,gitBlob:gitBlob(b)});
 }
 return rows;
}
export async function helperPins(game){
 const rows=[];
 for(const [file,p] of Object.entries(pins.helpers)){
  const b=await readFile(resolve(game,'scripts',file));assert.equal(gitBlob(b),p.gitBlob);assert.equal(sha256(b),p.sha256);
  rows.push({file,bytes:b.length,...p});
 }
 return rows;
}
export async function prepareArchive(zip,metadata,dist,out){
 const a=artifactMetadata(JSON.parse(await readFile(metadata,'utf8'))),b=await readFile(zip);
 assert.equal(b.length,pins.artifact.bytes);assert.equal(sha256(b),pins.artifact.sha256);
 const archivePath=relative(out,zip);
 assert.equal(archivePath,'immutable-assets-15149060140.zip','Original input ZIP must be retained inside the evidence directory');
 const extraction=JSON.parse(execFileSync('python3',['-c',`
import json,pathlib,stat,sys,zipfile
archive,destination=map(pathlib.Path,sys.argv[1:]);destination.mkdir(parents=True,exist_ok=True)
assert not any(destination.iterdir()), 'Extraction target is not empty'
with zipfile.ZipFile(archive) as z:
 entries=z.infolist();assert len(entries)==len({e.filename for e in entries})
 for e in entries:
  p=pathlib.PurePosixPath(e.filename)
  assert not p.is_absolute() and '..' not in p.parts and '\\\\' not in e.filename
  assert not stat.S_ISLNK(e.external_attr>>16)
 assert z.testzip() is None, 'ZIP CRC failure'
 z.extractall(destination)
 print(json.dumps({'entries':len(entries),'uncompressedBytes':sum(e.file_size for e in entries),'allCrcVerified':True}))
`,zip,dist],{encoding:'utf8'}));
 assert.equal(extraction.entries,pins.artifact.entries);assert.equal(extraction.uncompressedBytes,pins.artifact.uncompressedBytes);
 const marker=JSON.parse(await readFile(resolve(dist,'staged-landmark-proof-build.json'),'utf8'));
 assert.equal(marker.sourceSha,pins.artifact.head);assert.equal(marker.stagedFlag,'VITE_STAGED_BELLE_ARCHITECTURE=1');
 assert.equal(sha256(await readFile(resolve(dist,'index.html'))),pins.artifact.indexSha256);
 for(const [file,p] of Object.entries(pins.models))assert.equal(sha256(await readFile(resolve(dist,'belle/staged-architecture',file))),p.before.sha256);
 await mkdir(out,{recursive:true});
 await json(resolve(out,'immutable-assets.json'),{artifact:a,extraction,marker,archivePath,archiveBytes:b.length,archiveSha256:sha256(b)});
 await json(resolve(out,'dist-manifest.json'),await manifest(dist));
}
async function diagnosticReceipt(root,head){
 assert.match(head,/^[0-9a-f]{40}$/);
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),head);
 git(['diff','HEAD','--exit-code']);
 const bundlePath='.github/diagnostics/pr248-roof-compare',bundle=resolve(root,bundlePath),files=await manifest(bundle);
 for(const row of files.files){
  const b=await readFile(resolve(bundle,row.path));
  assert.equal(gitBlob(b),git(['rev-parse',head+':'+bundlePath+'/'+row.path]),'Diagnostic file differs from committed bytes: '+row.path);
 }
 const path='.github/workflows/belle-pr248-roof-comparison.yml',b=await readFile(resolve(root,path));
 const workflow={path,archivePath:'workflow.yml',bytes:b.length,sha256:sha256(b),gitBlob:gitBlob(b)};
 assert.equal(workflow.gitBlob,git(['rev-parse',head+':'+path]),'Workflow differs from committed bytes');
 return {head,tree:git(['rev-parse','HEAD^{tree}']),manifest:files,workflow};
}
export async function verifyDiagnostic(root,out,head){
 const saved=JSON.parse(await readFile(resolve(out,'diagnostic-source.json'),'utf8'));
 assert.deepEqual(await diagnosticReceipt(root,head),saved,'Current diagnostic source differs from the original receipt');
 await verifyManifest(resolve(out,'diagnostic-source'),saved.manifest);
 const b=await readFile(resolve(out,saved.workflow.archivePath));
 assert.equal(b.length,saved.workflow.bytes);assert.equal(sha256(b),saved.workflow.sha256);assert.equal(gitBlob(b),saved.workflow.gitBlob);
 assert(b.equals(await readFile(resolve(root,saved.workflow.path))),'Archived workflow differs from executed source');
 assert((await readFile(resolve(out,'diagnostic-commit.txt'))).equals(execFileSync('git',['cat-file','-p',head],{cwd:root})),'Archived diagnostic commit differs');
 return saved;
}
export async function preserveDiagnostic(root,out,head){
 const receipt=await diagnosticReceipt(root,head),bundle=resolve(root,'.github/diagnostics/pr248-roof-compare');
 await cp(bundle,resolve(out,'diagnostic-source'),{recursive:true});
 await cp(resolve(root,receipt.workflow.path),resolve(out,receipt.workflow.archivePath));
 await writeFile(resolve(out,'diagnostic-commit.txt'),execFileSync('git',['cat-file','-p',head],{cwd:root}));
 await json(resolve(out,'diagnostic-source.json'),receipt);
 await verifyDiagnostic(root,out,head);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [cmd,...args]=process.argv.slice(2);
 if(cmd==='archive')await prepareArchive(...args);
 else if(cmd==='diagnostic')await preserveDiagnostic(...args);
 else throw Error('Expected archive or diagnostic');
}
