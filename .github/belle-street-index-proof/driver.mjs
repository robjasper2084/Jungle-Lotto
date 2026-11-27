#!/usr/bin/env node
/** Immutable targeted proof driver. An unbound candidate permits compilation only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,extname,posix,sep} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {sha256,blobHash,safeName,expectedBinaryBytes,decodePng,requireCandidate,auditSavedEvidence,finalVerdict} from './validation.mjs';

const GAME='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const ROOT='lottominded-ultra.io/games/gothtechnology2';
const BASELINE='75906273c0cd414c0d004320fc6f654b4783e5b1';
const BASELINE_TREE='9f0351be133dd370a676090d27559a0adaf00605';
const PREFIX='.github/belle-street-index-proof';
const RUNTIME=['src/belle/staticPaletteBatch.ts','src/belle/indexedStreetDisplayGeometry.ts'].map(p=>GAME+'/'+p);
const PROOF_FILES=['browser.ts','driver.mjs','validation.mjs','contract.test.mjs','plan.json','pins.json','README.md'].map(p=>PREFIX+'/'+p).concat('.github/workflows/belle-street-index-proof.yml');
const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{maxBuffer:128*1024*1024,timeout:60000,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
const gitText=(dir,...args)=>git(dir,...args).toString('utf8').trim();
const writeJson=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const tree=(repo,rev)=>new Map(git(repo,'ls-tree','-rz',rev).toString('utf8').split('\0').filter(Boolean).map(row=>{const match=/^(\d+) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(row);assert(match,'Unexpected Git tree record');return[match[4],{mode:match[1],type:match[2],blob:match[3]}];}));
const bounded=(promise,ms,label)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+' ms')),ms);})]).finally(()=>clearTimeout(timer));};
export function compareCandidateTrees(original,candidate,expected){
 const changes=[];for(const path of new Set([...original.keys(),...candidate.keys()])){const a=original.get(path),b=candidate.get(path);if(JSON.stringify(a)!==JSON.stringify(b))changes.push({path,a,b});}
 assert.deepEqual(changes.map(x=>x.path).sort(),expected.map(x=>x.path).sort(),'Candidate changes exceed the eight declared paths');
 for(const change of changes){const e=expected.find(x=>x.path===change.path);assert(change.b&&change.b.type==='blob');assert.equal(change.b.mode,e.mode);assert.equal(change.b.blob,e.blob);assert.equal(change.a?'modified':'added',e.status);}
 return changes.map(x=>({path:x.path,before:x.a??null,after:x.b}));
}
function parseArgs(args){const out={};for(let i=0;i<args.length;i++){const key=args[i];if(key==='--compile-only'){out.compileOnly=true;continue;}if(key==='--compile-tree-only'){out.compileTreeOnly=true;continue;}assert(['--original','--candidate','--output','--backend','--dependencies','--preview-snapshot'].includes(key),'Unknown option '+key);assert(args[i+1]&&!args[i+1].startsWith('--'),'Missing option value');out[key.slice(2)]=args[++i];}return out;}

export async function main(options){
 const proofDirectory=import.meta.dirname,publication=resolve(proofDirectory,'../..');
 const original=resolve(options.original||'.'),candidate=resolve(options.candidate||'.'),output=resolve(options.output||'street-index-output'),compileOnly=options.compileOnly===true,backend=options.backend;
 assert(compileOnly||['metal','swiftshader'].includes(backend),'A fixed backend is required');assert(!options.compileTreeOnly||compileOnly,'Tree-only provenance can never authorize browser execution');
 await mkdir(output,{recursive:true});assert.equal((await readdir(output)).length,0,'Use a new evidence directory; no replacement successes');
 const planBytes=await readFile(resolve(proofDirectory,'plan.json')),plan=JSON.parse(planBytes),pins=JSON.parse(await readFile(resolve(proofDirectory,'pins.json'),'utf8'));
 assert.equal(plan.baseline,BASELINE);assert.equal(plan.baselineTree,BASELINE_TREE);assert.equal(pins.baseline,BASELINE);assert.equal(pins.baselineTree,BASELINE_TREE);assert.equal(sha256(planBytes),pins.unboundPlanSha256,'Frozen case plan changed');assert.equal(plan.candidate,null,'The case-plan template must stay unbound; bind only pins.json');
 const report={schema:'belle-street-index-proof-v1',baseline:BASELINE,baselineTree:BASELINE_TREE,candidate:pins.candidate?.commit??null,candidateTree:pins.candidate?.tree??null,candidateBound:!!pins.candidate,compileOnly,backend:backend??null,startedAt:new Date().toISOString(),compiled:false,validated:false,passed:false,errors:[],requests:[],cleanup:{complete:false,errors:[]},scope:plan.scope,originalAssets:[],proofFiles:[]};
 const provenance={baseline:BASELINE,baselineTree:BASELINE_TREE,candidate:pins.candidate,planSha256:sha256(planBytes),sourceInventory:[],bundleInputs:[],assets:[],candidateChanges:[],dependencies:[],proofFiles:report.proofFiles};
 const originalTree=tree(original,BASELINE),sourceCache=new Map(),assets=new Map(),moduleReceipts=new Map(),candidateBytes=new Map();
 const checkBytes=(bytes,record)=>{assert.equal(bytes.length,record.bytes,record.path+' size');assert.equal(blobHash(bytes),record.blob,record.path+' Git blob');assert.equal(sha256(bytes),record.sha256,record.path+' SHA256');return bytes;};
 const originalBytes=path=>{assert(path.startsWith(ROOT+'/')&&!path.split('/').includes('..')&&!path.includes('\\'),'Unsafe immutable path');let bytes=sourceCache.get(path);if(bytes)return bytes;const entry=originalTree.get(path);assert(entry?.type==='blob'&&['100644','100755'].includes(entry.mode),'Original regular blob missing '+path);bytes=git(original,'cat-file','blob',entry.blob);assert.equal(blobHash(bytes),entry.blob);sourceCache.set(path,bytes);return bytes;};
 let browser,context,server,closing=false,failureRevision=0,deadlineTimer;
 const fail=message=>{report.errors.push(String(message));failureRevision++;};
 const pendingPersistence=new Set(),receipts=new Map(),requested=new Set();
 const recordFile=async(name,bytes)=>{safeName(name);await writeFile(resolve(output,name),bytes,{flag:'wx'});return{name,bytes:bytes.length,sha256:sha256(bytes)};};
 const persist=async(name,payload)=>{
  assert(!closing,'Evidence arrived after finalization');safeName(name);assert(!receipts.has(name),'Duplicate immutable receipt '+name);receipts.set(name,null);assert(payload&&['json','binary','pixels'].includes(payload.kind));let receipt={name,kind:payload.kind,files:[]};
  if(payload.kind==='json'){const bytes=Buffer.from(JSON.stringify(payload.value,null,2)+'\n');assert(bytes.length<=64*1024*1024,'JSON receipt bound');receipt.files.push(await recordFile(name+'.json',bytes));receipt.value=payload.value;
   if(name==='start'){assert(backend==='metal'?/Metal/i.test(payload.value.gpu)&&!/SwiftShader|llvmpipe|software/i.test(payload.value.gpu):/SwiftShader/i.test(payload.value.gpu),'Actual renderer does not match the fixed backend');assert.equal(payload.value.threeRevision,'185');assert.deepEqual(payload.value.viewport,plan.viewport);assert.equal(payload.value.candidate,pins.candidate.commit);report.actualRenderer=payload.value.gpu;}
  }
  else{
   const expected=expectedBinaryBytes(payload);assert(expected>0&&expected<=64*1024*1024);assert.equal(payload.bytes,expected);assert.match(payload.sha256??'',/^[a-f0-9]{64}$/);assert(typeof payload.gzipBase64==='string'&&payload.gzipBase64.length<=96*1024*1024);const compressed=Buffer.from(payload.gzipBase64,'base64'),raw=gunzipSync(compressed,{maxOutputLength:expected});assert.equal(raw.length,expected);assert.equal(sha256(raw),payload.sha256);
   const {gzipBase64,png,...metadata}=payload;receipt={...receipt,...metadata};receipt.files.push(await recordFile(name+'.raw.gz',compressed));if(png){assert(payload.kind==='pixels'&&/^data:image\/png;base64,/.test(png));const pngBytes=Buffer.from(png.slice('data:image/png;base64,'.length),'base64');assert.equal(decodePng(pngBytes,payload.width,payload.height).readPixelsSha256,payload.sha256,'PNG/raw disagreement');receipt.files.push(await recordFile(name+'.png',pngBytes));receipt.png=true;}
  }
  assert(!closing,'Late persistence may not become complete evidence');receipts.set(name,receipt);await writeFile(resolve(output,'evidence.ndjson'),JSON.stringify(receipt)+'\n',{flag:'a'});return{persisted:true,name};
 };
 const exposed=(name,payload)=>{const task=persist(name,payload);pendingPersistence.add(task);task.finally(()=>pendingPersistence.delete(task)).catch(()=>{});return task;};
 try{
  assert.equal(gitText(original,'rev-parse',BASELINE+'^{tree}'),BASELINE_TREE);
  for(const record of [...pins.sources,...pins.assets,...pins.packages])checkBytes(originalBytes(record.path),record);
  for(const record of pins.assets){const url=record.path.slice((GAME+'/public').length);assets.set(url,{...record,url,requests:0});}
  provenance.assets=[...assets.values()];
  assert.equal(pins.expectedCandidateFiles.length,8);assert.equal(pins.expectedCandidateFiles.filter(x=>x.status==='added').length,2);
  if(pins.candidate){
   const bound=requireCandidate({candidate:pins.candidate});assert.deepEqual(bound.files,pins.expectedCandidateFiles,'Bound files differ from the pre-reviewed exact eight-file recipe');
   if(options.compileTreeOnly){assert.equal(gitText(candidate,'cat-file','-t',bound.tree),'tree');report.candidateCommitVerified=false;report.compilationBinding='Exact immutable candidate tree only; remote commit binding was independently verified by root and must be reverified before execution.';}
   else{assert.equal(gitText(candidate,'rev-parse',bound.commit+'^{tree}'),bound.tree);assert.equal(gitText(candidate,'rev-parse',bound.commit+'^'),BASELINE);assert.equal(gitText(candidate,'show','-s','--format=%P',bound.commit),BASELINE,'Candidate must have exactly the original parent');report.candidateCommitVerified=true;}
   provenance.candidateCommitVerified=report.candidateCommitVerified;provenance.candidateChanges=compareCandidateTrees(originalTree,tree(candidate,bound.tree),pins.expectedCandidateFiles);
   for(const record of bound.files)candidateBytes.set(record.path,checkBytes(git(candidate,'cat-file','blob',bound.tree+':'+record.path),record));
  }else{
   assert(compileOnly,'UNBOUND candidate: execution is prohibited');assert(options['preview-snapshot'],'Compilation requires the reviewed frozen preview snapshot');
   for(const record of pins.preview.files){const bytes=checkBytes(await readFile(resolve(options['preview-snapshot'],record.path)),record);candidateBytes.set(record.path,bytes);}
   report.preview={tree:pins.preview.tree,files:pins.preview.files,sourceOnly:true,executableCandidate:false};
  }
  for(const path of PROOF_FILES){const bytes=await readFile(resolve(publication,path)),record={path,blob:blobHash(bytes),sha256:sha256(bytes),bytes:bytes.length};if(!compileOnly)assert.equal(gitText(publication,'rev-parse','HEAD:'+path),record.blob,'Proof file differs from the exact diagnostic head');report.proofFiles.push(record);}
  if(!compileOnly){report.proofHead=gitText(publication,'rev-parse','HEAD');report.proofTree=gitText(publication,'rev-parse','HEAD^{tree}');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','Only the original workflow attempt is allowed');}
  const dependencyRoot=resolve(options.dependencies||resolve(original,GAME)),require=createRequire(resolve(dependencyRoot,'package.json')),{build}=require('esbuild'),threeRoot=dirname(dirname(require.resolve('three')));
  for(const [path,record]of Object.entries(pins.three.files)){const bytes=await readFile(resolve(threeRoot,path));assert.equal(bytes.length,record.bytes);assert.equal(sha256(bytes),record.sha256,'Pinned Three source changed '+path);provenance.dependencies.push({path:'three/'+path,...record});}
  assert.equal(JSON.parse(await readFile(resolve(threeRoot,'package.json'),'utf8')).version,pins.three.version);
  const effectivePlan={...plan,candidate:pins.candidate,candidateBinding:pins.candidate?'Immutable final candidate bound by pins.json':'UNBOUND: compile preview only'};
  const originalClass=GAME+'/src/belle/__proof_original_StaticPaletteBatch.ts',cloud=GAME+'/src/belle/__proof_cloudTexture.ts';
  // Exact original bytes are retained beside the candidate source, and both
  // occupy the same virtual module directory. All relative imports share IDs.
  await writeFile(resolve(output,'staticPaletteBatch.original.ts'),originalBytes(GAME+'/src/belle/staticPaletteBatch.ts'));
  await writeFile(resolve(output,'staticPaletteBatch.ts'),candidateBytes.get(RUNTIME[0]));await writeFile(resolve(output,'indexedStreetDisplayGeometry.ts'),candidateBytes.get(RUNTIME[1]));
  const loadPinned=path=>{
   let origin=path,role='original',bytes,extraction;
   if(path===originalClass){origin=GAME+'/src/belle/staticPaletteBatch.ts';bytes=originalBytes(origin);}
   else if(path===cloud){origin=GAME+'/src/belle/islandSky.ts';const source=originalBytes(origin).toString('utf8'),start=source.indexOf('function cloudTexture(){'),end=source.indexOf('\n}\nconst fragment=',start)+2;assert(start>=0&&end>start);const body=source.slice(start,end);bytes=Buffer.from("import * as T from 'three';\n"+body+'\nexport {cloudTexture};\n');extraction={sourceSha256:sha256(originalBytes(origin)),startUtf16:start,endUtf16:end,exactBodySha256:sha256(body),wrapper:'import original shared Three; exact private cloudTexture body; named export only'};}
   else if(RUNTIME.includes(path)){bytes=candidateBytes.get(path);role='candidate';assert(bytes,'Candidate runtime source missing');}
   else bytes=originalBytes(path);
   const record={virtualPath:path,sourcePath:origin,role,blob:blobHash(bytes),sha256:sha256(bytes),bytes:bytes.length,...(extraction?{extraction}:{})};moduleReceipts.set(path,record);return bytes.toString('utf8');
  };
  const plugin={name:'one-immutable-street-graph',setup(builder){
   builder.onResolve({filter:/^proof:plan$/},()=>({path:'plan',namespace:'proof-plan'}));builder.onLoad({filter:/.*/,namespace:'proof-plan'},()=>({contents:JSON.stringify(effectivePlan),loader:'json'}));
   builder.onResolve({filter:/^original:/},args=>({path:args.path==='original:cloudTexture'?cloud:originalClass,namespace:'pinned-street'}));
   builder.onResolve({filter:/^(baseline|candidate):/},args=>{const [role,name]=args.path.split(':');assert(!name.includes('/')&&!name.includes('..'));const path=GAME+'/src/belle/'+name;if(role==='candidate')assert.equal(path,RUNTIME[0]);return{path,namespace:'pinned-street'};});
   builder.onResolve({filter:/^three(?:\/|$)/},args=>({path:args.path==='three'?resolve(threeRoot,'build/three.module.js'):require.resolve(args.path)}));
   builder.onResolve({filter:/.*/,namespace:'pinned-street'},args=>{assert(args.path.startsWith('.'),'Unexpected bare game dependency '+args.path);const path=posix.normalize(posix.join(posix.dirname(args.importer),args.path));assert(path.startsWith(GAME+'/src/belle/')&&!path.includes('..'));return{path,namespace:'pinned-street'};});
   builder.onLoad({filter:/.*/,namespace:'pinned-street'},args=>({contents:loadPinned(args.path),loader:extname(args.path)==='.json'?'json':'ts'}));
  }};
  const built=await build({absWorkingDir:proofDirectory,entryPoints:[resolve(proofDirectory,'browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,metafile:true,logLevel:'error',plugins:[plugin],define:{'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'}});
  for(const path of Object.keys(built.metafile.inputs)){
   if(path.startsWith('pinned-street:')||path==='proof-plan:plan'||path==='<define:import.meta.env>'){provenance.bundleInputs.push({path,immutableVirtual:true});continue;}
   const absolute=resolve(proofDirectory,path);assert(absolute===resolve(proofDirectory,'browser.ts')||absolute.startsWith(threeRoot+sep),'Unpinned application dependency leaked into the graph: '+path);provenance.bundleInputs.push({path,sha256:sha256(await readFile(absolute))});
  }
  for(const name of ['streetBatchOrder.ts','atmosphereProgramIdentity.ts','worldAtmosphere.ts','realisticMaterials.ts','batchedIndirectUpdates.ts'])assert.equal([...moduleReceipts.keys()].filter(p=>p.endsWith('/'+name)).length,1,'Shared state module duplicated '+name);
  assert(moduleReceipts.has(originalClass)&&moduleReceipts.has(RUNTIME[0])&&moduleReceipts.has(RUNTIME[1]));
  provenance.sourceInventory=[...moduleReceipts.values()].sort((a,b)=>a.virtualPath.localeCompare(b.virtualPath));provenance.bundleSha256=sha256(built.outputFiles[0].contents);report.bundleSha256=provenance.bundleSha256;
  await writeFile(resolve(output,'bundle.js'),built.outputFiles[0].contents);await writeJson(resolve(output,'bundle-meta.json'),built.metafile);await writeJson(resolve(output,'provenance.json'),provenance);report.compiled=true;
  if(compileOnly){report.validationScope='Source-only compilation of the shared original/frozen candidate graph; no browser, pixels, native buffers, timings or release acceptance.';return report;}
  requireCandidate(effectivePlan);
  const playwrightRequire=createRequire(resolve(original,ROOT,'package.json')),playwright=playwrightRequire('@playwright/test');assert.equal(JSON.parse(await readFile(playwrightRequire.resolve('@playwright/test/package.json'),'utf8')).version,pins.playwrightVersion);
  const servedAssets=new Map();let origin;
  server=createServer((request,response)=>{try{const url=new URL(request.url,'http://127.0.0.1'),path=url.pathname;response.setHeader('Cache-Control','no-store');
   if(path==='/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Street indexed-copy proof</title><style>html,body{margin:0}</style><canvas></canvas><script type="module" src="/bundle.js"></script>');return;}
   if(path==='/bundle.js'){response.setHeader('Content-Type','application/javascript');response.end(built.outputFiles[0].contents);return;}
   const asset=assets.get(path);assert(asset&&!url.search,'Unplanned request '+request.url);asset.requests++;servedAssets.set(path,asset);response.setHeader('Content-Type',path.endsWith('.json')?'application/json':path.endsWith('.webp')?'image/webp':'application/octet-stream');response.end(originalBytes(asset.path));
  }catch(error){fail(error);response.writeHead(404);response.end('Unplanned immutable asset request');}});
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});origin='http://127.0.0.1:'+server.address().port;
  const args=backend==='metal'?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'];report.browserLaunch={channel:'chrome',headless:backend!=='metal',args,viewport:{width:plan.viewport.width,height:plan.viewport.height},deviceScaleFactor:1};
  browser=await playwright.chromium.launch({channel:'chrome',headless:backend!=='metal',args});browser.on('disconnected',()=>{if(!closing)fail('Unexpected browser disconnect');});context=await browser.newContext({viewport:{width:plan.viewport.width,height:plan.viewport.height},deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>fail('Page error: '+e));page.on('crash',()=>fail('Page crashed'));page.on('requestfailed',r=>{report.requests.push({url:r.url(),failure:r.failure()});failureRevision++;});page.on('response',r=>{if(r.status()>=400){report.requests.push({url:r.url(),status:r.status()});failureRevision++;}});
  page.on('request',r=>{const url=new URL(r.url());if(url.origin!==origin){report.requests.push({url:r.url(),unexpectedOrigin:true});failureRevision++;}requested.add(url.pathname);});
  await page.exposeFunction('persistStreetEvidence',exposed);
  const deadline=Date.now()+plan.bounds.driverMs;deadlineTimer=setTimeout(()=>{fail('Original fixed driver deadline expired');void browser?.close().catch(e=>fail(e));},plan.bounds.driverMs);
  await page.goto(origin,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>typeof window.runStreetIndexProof==='function',{},{timeout:60000});
  report.browser=await bounded(page.evaluate(()=>window.runStreetIndexProof()),Math.max(1,deadline-Date.now()),'Complete fixed street proof');
  assert(backend==='metal'?/Metal/i.test(report.browser.gpu)&&!/SwiftShader|llvmpipe|software/i.test(report.browser.gpu):/SwiftShader/i.test(report.browser.gpu),'Actual renderer does not match fixed backend');
  assert.equal(report.browser.candidate,pins.candidate.commit);assert.equal(report.browser.candidateTree,pins.candidate.tree);assert.equal(report.browser.passed,true,'Browser retained a failed case or query');
  assert.equal(servedAssets.size,59,'Every original surface asset must actually be consumed');for(const asset of servedAssets.values())assert(asset.requests>0);report.originalAssets=[...servedAssets.values()];provenance.assets=report.originalAssets;await writeJson(resolve(output,'provenance.json'),provenance);
  await Promise.all([...pendingPersistence]);assert.equal(report.errors.length,0);assert.equal(report.requests.length,0);
  const revision=failureRevision;report.audit=await auditSavedEvidence(output,effectivePlan,report);assert.equal(failureRevision,revision,'A late browser failure invalidated the artifact audit');assert.equal(report.errors.length,0);assert.equal(report.requests.length,0);report.validated=true;
 }catch(error){fail(error);}
 finally{
  clearTimeout(deadlineTimer);closing=true;
  try{await bounded((async()=>{await Promise.allSettled([...pendingPersistence]);if(context)await context.close();if(browser)await browser.close();if(server)await new Promise((yes,no)=>server.close(e=>e?no(e):yes()));})(),plan.bounds.closeMs,'Owned proof cleanup');report.cleanup.complete=true;}catch(error){report.cleanup.errors.push(String(error));fail(error);}
  report.finishedAt=new Date().toISOString();report.passed=!compileOnly&&finalVerdict(report);const finalRevision=failureRevision;await writeJson(resolve(output,'report.json'),report);
  if(failureRevision!==finalRevision||(!compileOnly&&report.passed&&!finalVerdict(report))){report.passed=false;await writeJson(resolve(output,'report.json'),report);}
  if(!compileOnly&&!report.passed)process.exitCode=1;if(compileOnly&&report.errors.length)process.exitCode=1;
  console.log('STREET_INDEX_PROOF_JSON='+JSON.stringify({compiled:report.compiled,compileOnly,candidateBound:report.candidateBound,passed:report.passed,backend,completed:report.browser?.completed,errors:report.errors,cleanup:report.cleanup,bundleSha256:report.bundleSha256}));
 }
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await main(parseArgs(process.argv.slice(2)));
