// Diagnostic build receipts. This module never rewrites application source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,mkdtemp,rm,copyFile} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';

const gamePath='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const driverPath=gamePath+'/scripts/sustained-ride-profile.mjs';
const strictBlob='c722b5810a7693e5ece72ed00b4401e7cde7267a';
const statsPath='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/research/street-detail-stats.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const git=(app,args,options={})=>execFileSync('git',args,{cwd:app,...options});
const gitText=(app,args,options)=>git(app,args,options).toString('utf8').trim();
const writeJson=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');

async function sourceState(app,bundle,evidence,diagnosticHead,afterBuild){
 assert.match(diagnosticHead,/^[0-9a-f]{40}$/,'Expected exact diagnostic revision');
 const plan=JSON.parse(await readFile(join(bundle,'source-receipts.json'),'utf8'));
 assert.equal(plan.applicationBase,'75906273c0cd414c0d004320fc6f654b4783e5b1');
 assert.equal(gitText(app,['rev-parse','HEAD']),plan.applicationBase);
 assert.equal(gitText(app,['hash-object',driverPath]),strictBlob);
 const sourceFiles=plan.files.map(file=>file.path).sort();
 assert.equal(sourceFiles.length,2);
 const observed=gitText(app,['diff','--name-only']).split('\n').filter(Boolean).sort();
 const unexpected=observed.filter(path=>!sourceFiles.includes(path));
 assert.deepEqual(unexpected,afterBuild&&unexpected.length?[statsPath]:[],'Unexpected application change');
 for(const file of plan.files){
  assert.equal(sha256(git(app,['show',plan.applicationBase+':'+file.path])),file.beforeSha256,file.path+' original');
  assert.equal(sha256(await readFile(join(app,file.path))),file.afterSha256,file.path+' diagnostic');
 }
 await mkdir(evidence,{recursive:true});
 if(afterBuild){
  const receipt=JSON.parse(await readFile(join(evidence,'source-provenance.json'),'utf8'));
  assert.equal(receipt.applicationBase,plan.applicationBase);assert.equal(receipt.diagnosticRevision,diagnosticHead);
  assert.equal(receipt.patchSha256,sha256(await readFile(join(bundle,'application-diagnostic-only.patch'))));
  if(unexpected.length){
   const before=JSON.parse(gitText(app,['show',plan.applicationBase+':'+statsPath]));
   const after=JSON.parse(await readFile(join(app,statsPath),'utf8'));
   assert(Number.isFinite(after.buildMs));
   delete before.buildMs;delete after.buildMs;
   assert.deepEqual(after,before,'Only the generated street-statistic build duration may differ');
   await copyFile(join(app,statsPath),join(evidence,'generated-street-detail-stats.json'));
  }
  await writeFile(join(evidence,'after-build-tracked-delta.patch'),git(app,['diff','--binary']));
  await writeJson(join(evidence,'after-build-verification.json'),{
   diagnosticRevision:diagnosticHead,applicationSourceTree:receipt.applicationSourceTree,
   strictDriverGitBlob:strictBlob,sourceFilesVerified:sourceFiles,generatedStatisticsChanges:unexpected,
   note:'All compiled application source and assets still match the recorded two-file delta. The optional archived buildMs statistic is not application input.',
  });
  return;
 }
 assert.deepEqual(observed,sourceFiles,'The source delta must contain exactly the two reviewed files');
 const temporary=await mkdtemp(join(evidence,'source-index-'));
 let sourceTree;
 try{
  const env={...process.env,GIT_INDEX_FILE:join(temporary,'index')};
  git(app,['read-tree',plan.applicationBase],{env});
  git(app,['add','--',...sourceFiles],{env});
  sourceTree=gitText(app,['write-tree'],{env});
 }finally{await rm(temporary,{recursive:true,force:true});}
 await writeJson(join(evidence,'source-provenance.json'),{
  scope:'DIAGNOSTIC ONLY; a fresh build of the pinned application base plus the archived observation-only patch. This is not the untouched acceptance build.',
  applicationBase:plan.applicationBase,applicationBaseTree:gitText(app,['rev-parse','HEAD^{tree}']),
  applicationSourceTree:sourceTree,diagnosticRevision:diagnosticHead,
  reportSourceHeadMeaning:'The diagnostic revision that carries this patch and workflow; application base and exact patched source tree are separate fields above.',
  patchSha256:sha256(await readFile(join(bundle,'application-diagnostic-only.patch'))),
  files:plan.files,strictDriverGitBlob:strictBlob,
  originalObserverGitBlob:'007ef71a678d52e103492d5c4ecf74f38c3150af',
 });
 await writeFile(join(evidence,'application-base-commit.txt'),git(app,['cat-file','-p','HEAD']));
 await writeFile(join(evidence,'application-source-delta.patch'),git(app,['diff','--binary','--',...sourceFiles]));
 await copyFile(join(app,driverPath),join(evidence,'original-strict-driver.mjs'));
 await copyFile(join(bundle,'application-diagnostic-only.patch'),join(evidence,'reviewed-application.patch'));
 await copyFile(join(bundle,'source-receipts.json'),join(evidence,'reviewed-source-receipts.json'));
}

async function manifest(root){
 const entries=[];
 async function walk(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,item.name);
   if(item.isDirectory())await walk(path);
   else{assert(item.isFile(),'Unexpected non-file in build output');const bytes=await readFile(path);
    entries.push({path:relative(root,path).split(sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)});}
  }
 }
 await walk(root);assert(entries.length>0,'Empty build output');
 return entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

const [mode,...args]=process.argv.slice(2);
if(mode==='prepare'||mode==='after-build'){
 assert.equal(args.length,4);await sourceState(resolve(args[0]),resolve(args[1]),resolve(args[2]),args[3],mode==='after-build');
}else if(mode==='manifest-write'||mode==='manifest-check'){
 assert.equal(args.length,2);const actual=await manifest(resolve(args[0]));
 if(mode==='manifest-write')await writeJson(resolve(args[1]),actual);
 else assert.deepEqual(actual,JSON.parse(await readFile(resolve(args[1]),'utf8')),'Built files changed or do not match the recorded diagnostic artifact');
}else throw Error('Expected prepare, after-build, manifest-write or manifest-check');
