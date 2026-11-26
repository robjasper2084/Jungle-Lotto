/** Targeted, same-context shader equivalence on the shipped pavement and
 * MacArthur asset. This does not replace any full-game or controls gate. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,extname,sep} from 'node:path';
import {build} from 'esbuild';
import * as T from 'three';
import {SHADER_REUSE_BASELINE} from './shader-reuse-baseline.ts';
import {BUMP_CENTER_CHUNKS} from '../src/belle/bumpCenterChunks.ts';
import {SHADER_PROOF_CASES,SHADER_PROOF_SIZE} from './shader-reuse-cases.ts';
import {assertShaderReuseResult,compareRgba,verifyCapturedPixels,sha256} from './shader-reuse-proof-contract.mjs';

const game=resolve(import.meta.dirname,'..'),repo=resolve(game,'../../../../..'),prefix=relative(repo,game).split(sep).join('/');
const output=resolve(process.env.SHADER_REUSE_OUT??resolve(game,'output/shader-reuse-proof'));
const baselineRepo=resolve(process.env.SHADER_REUSE_BASELINE_REPO??resolve(repo,'.shader-reuse-baseline'));
const backend=process.env.SHADER_REUSE_BACKEND??(process.platform==='darwin'?'metal':'swiftshader');
const sourceSha=process.env.SHADER_REUSE_SOURCE_SHA??process.env.GITHUB_SHA;
const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
const playwrightRoot=dirname(require.resolve('playwright-core/package.json'));
const {PNG}=require(resolve(playwrightRoot,'lib/utilsBundle.js'));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const errors=[],failedRequests=[],assetFailures=[],assets=new Map(),shaderFiles=new Map(),captures=new Map(),pending=new Set(),pairedPixels=new Map();
const report={scope:'Targeted shipped-asset shader equivalence; not full-scene performance or controls acceptance.',sourceSha,
 sourceTree:null,baseline:null,backend,platform:process.platform,threeRevision:T.REVISION,browser:null,renderer:null,
 passed:false,errors,failedRequests,assetFailures,sourceFiles:[],shaderFiles:[],captures:[],independentPixelPairs:[],result:null};
let server,browser,deadline;
await mkdir(output,{recursive:true});await mkdir(resolve(output,'sources'),{recursive:true});await mkdir(resolve(output,'shaders'),{recursive:true});
const remember=(promise)=>{pending.add(promise);promise.finally(()=>pending.delete(promise));return promise;};
const treeFiles=(cwd,commit,path)=>{
 const entries=execFileSync('git',['ls-tree','-r','-z',commit,'--',path],{cwd,encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
 return new Map(entries.map(entry=>{const match=entry.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/s);assert(match,'Unexpected source tree entry');return[match[2],match[1]];}));
};
try{
 assert.match(sourceSha??'',/^[a-f0-9]{40}$/,'An exact source SHA is required');assert(backend==='metal'||backend==='swiftshader');
 if(backend==='metal')assert.equal(process.platform,'darwin','Metal proof requires its native macOS runner');
 assert.equal(git(repo,'rev-parse','HEAD'),sourceSha);assert.equal(git(repo,'status','--porcelain','--untracked-files=no'),'','Candidate tracked files changed');
 report.sourceTree=git(repo,'rev-parse','HEAD^{tree}');
 assert.equal(git(baselineRepo,'rev-parse','HEAD'),SHADER_REUSE_BASELINE.sourceSha);assert.equal(git(baselineRepo,'rev-parse','HEAD^{tree}'),SHADER_REUSE_BASELINE.treeSha);
 assert.equal(git(baselineRepo,'status','--porcelain','--untracked-files=no'),'','Original baseline checkout changed');
 const original=await readFile(resolve(baselineRepo,SHADER_REUSE_BASELINE.asphaltPath));
 assert.equal(sha256(original),SHADER_REUSE_BASELINE.asphaltSourceSha256);
 const oldBlock=original.toString().match(/export const ASPHALT_PATCH_DETAIL\s*=\s*`([\s\S]*)`;\s*$/)?.[1];
 assert.equal(oldBlock,SHADER_REUSE_BASELINE.asphaltBlock);assert.equal(sha256(oldBlock),SHADER_REUSE_BASELINE.asphaltBlockSha256);
 await writeFile(resolve(output,'sources/original759-asphaltPolish.ts'),original);
 const originalTree=treeFiles(baselineRepo,SHADER_REUSE_BASELINE.sourceSha,prefix),candidateTree=treeFiles(repo,sourceSha,prefix);
 for(const file of ['package-lock.json','src/belle/realisticMaterials.ts','src/belle/macArthurSurface.ts','src/belle/bridgeMaterialFinish.ts',
  'src/belle/worldAtmosphere.ts','src/belle/atmosphereProgramIdentity.ts','src/belle/photoReferenceSurfaces.ts','src/belle/sunsetGround.ts',
  'src/belle/macArthurSpanCulling.ts','src/belle/groundDrawRange.ts','src/belle/pavement.ts','src/belle/islandSky.ts']){
  const path=prefix+'/'+file,bytes=await readFile(resolve(game,file));assert.equal(blob(bytes),candidateTree.get(path));
  assert.equal(candidateTree.get(path),originalTree.get(path),'Untouched native factory/source drift: '+file);
  report.sourceFiles.push({file,bytes:bytes.length,sha256:sha256(bytes),gitBlob:blob(bytes),originalGitBlob:originalTree.get(path)});
 }
 const fixture=await readFile(resolve(import.meta.dirname,'shader-reuse-proof-browser.ts'),'utf8'),islandSky=await readFile(resolve(game,'src/belle/islandSky.ts'),'utf8');
 const cloudSource=text=>text.match(/function cloudTexture\(\)\{[\s\S]*?\n\}/)?.[0];assert(cloudSource(islandSky));assert.equal(cloudSource(fixture),cloudSource(islandSky),'Fixture cloud sampler drifted from the actual source');
 const nativeChunks={};for(const[name,expected]of Object.entries(BUMP_CENTER_CHUNKS)){
  assert.equal(T.ShaderChunk[name],expected,'Pinned native Three shader chunk changed: '+name);nativeChunks[name]={text:expected,sha256:sha256(expected)};
 }
 await writeFile(resolve(output,'sources/untouched-native-shader-chunks.json'),JSON.stringify(nativeChunks,null,2)+'\n');
 report.baseline={sourceSha:SHADER_REUSE_BASELINE.sourceSha,sourceTree:SHADER_REUSE_BASELINE.treeSha,
  asphaltSourceSha256:sha256(original),asphaltBlockSha256:sha256(oldBlock),nativeChunkHashes:Object.fromEntries(Object.entries(nativeChunks).map(([k,v])=>[k,v.sha256]))};
 const compiled=await build({entryPoints:[resolve(import.meta.dirname,'shader-reuse-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',
  define:{'import.meta.env.DEV':'false'},metafile:true});
 const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);report.fixtureSourceSha256=sha256(fixture);
 await writeFile(resolve(output,'sources/proof.js'),javascript);
 for(const input of Object.keys(compiled.metafile.inputs).sort()){
  const path=resolve(input);if(!path.startsWith(game+sep)||path.includes(sep+'node_modules'+sep))continue;
  const bytes=await readFile(path),file=relative(repo,path).split(sep).join('/');assert.equal(blob(bytes),candidateTree.get(file),'Bundled source differs from exact candidate: '+file);
 }
 const publicRoot=await realpath(resolve(game,'public'));
 const mime={'.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
 const assetRow=async(file,bytes)=>{
  const path=prefix+'/public/'+file,gitBlob=blob(bytes);assert.equal(gitBlob,candidateTree.get(path),'Served bytes differ from candidate: '+file);
  assert.equal(gitBlob,originalTree.get(path),'Source asset changed from original759: '+file);
  const row={file,bytes:bytes.length,sha256:sha256(bytes),gitBlob,baselineGitBlob:originalTree.get(path),served:true,received:false};
  const previous=assets.get(file);if(previous){assert.equal(previous.sha256,row.sha256);return previous;}assets.set(file,row);return row;
 };
 server=createServer((req,res)=>void remember((async()=>{
  try{
   const path=new URL(req.url,'http://127.0.0.1').pathname;
   if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><title>Targeted shader equivalence</title><style>html,body{margin:0}canvas{display:block;width:960px;height:600px}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(path==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
   if(path==='/fixture-receipt.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sourceSha,sourceTree:report.sourceTree,fixtureSha256:report.fixtureSha256}));return;}
   const filename=await realpath(resolve(publicRoot,'.'+decodeURIComponent(path)));assert(filename.startsWith(publicRoot+sep),'Asset path escaped the public root');
   const bytes=await readFile(filename);await assetRow(relative(publicRoot,filename).split(sep).join('/'),bytes);res.setHeader('Content-Type',mime[extname(filename)]??'application/octet-stream');res.end(bytes);
  }catch(error){assetFailures.push(String(error));res.writeHead(500);res.end();}
 })()));
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const launch=backend==='metal'?{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}:
  {channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 browser=await chromium.launch(launch);report.browser={version:browser.version(),playwright:require('@playwright/test/package.json').version,launch};
 const page=await browser.newPage({viewport:SHADER_PROOF_SIZE,deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('shader proof '))console.log(message.text());});
 page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 page.on('response',response=>void remember((async()=>{
  try{const url=new URL(response.url());if(!url.pathname.startsWith('/belle/'))return;assert.equal(response.status(),200,'Asset HTTP failure');
   const file=decodeURIComponent(url.pathname.slice(1)),bytes=await response.body(),row=assets.get(file);assert(row,'Unattested source asset response: '+file);
   assert.equal(bytes.length,row.bytes);assert.equal(sha256(bytes),row.sha256);row.received=true;
  }catch(error){assetFailures.push(String(error));}
 })()));
 await page.exposeFunction('__saveShaderSource',async row=>{
  for(const [stage,text] of [['vertex',row.vertex],['fragment',row.fragment]]){
   const hash=sha256(text);assert.equal(hash,row[stage+'Sha256']);if(shaderFiles.has(hash))continue;
   const file='shaders/'+hash+'.'+(stage==='vertex'?'vert':'frag')+'.glsl';shaderFiles.set(hash,{stage,file,sha256:hash,bytes:Buffer.byteLength(text)});await writeFile(resolve(output,file),text);
  }
 });
 await page.exposeFunction('__saveShaderCapture',async row=>{
  assert(SHADER_PROOF_CASES.some(spec=>spec.id===row.id));assert(['baseline','candidate','target-hidden','shadow-off','effect-off'].includes(row.role));
  const key=row.id+'-'+row.role;assert(!captures.has(key),'Duplicate actual capture');assert.match(row.png,/^data:image\/png;base64,/);
  const bytes=Buffer.from(row.png.slice('data:image/png;base64,'.length),'base64'),decoded=PNG.sync.read(bytes),pixelReceipt=verifyCapturedPixels(decoded,row);
  const file=key+'.png',receipt={id:row.id,role:row.role,file,bytes:bytes.length,sha256:sha256(bytes),width:decoded.width,height:decoded.height,...pixelReceipt};
  captures.set(key,receipt);await writeFile(resolve(output,file),bytes);
  if(row.role==='baseline')pairedPixels.set(row.id,Buffer.from(decoded.data));
  if(row.role==='candidate'){
   const before=pairedPixels.get(row.id);assert(before,'Candidate capture arrived without its original baseline');
   report.independentPixelPairs.push({id:row.id,...compareRgba(before,decoded.data),baselinePngRgbaSha256:sha256(before),candidatePngRgbaSha256:sha256(decoded.data)});pairedPixels.delete(row.id);
  }
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load',timeout:90000});await page.bringToFront();
 await page.waitForFunction(()=>typeof window.__shaderReuseProof==='function',null,{timeout:60000});
 // Fixture deadline only. Original full-scene 90 s and 32/34 minute controls
 // workloads remain in their own byte-unchanged workflows.
 const result=await Promise.race([page.evaluate(()=>window.__shaderReuseProof()),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Targeted shader fixture exceeded 12 minutes')),12*60*1000);})]);
 clearTimeout(deadline);report.result=result;report.renderer=result.gpu;
 while(pending.size)await Promise.allSettled([...pending]);
 for(const native of result.assets){const received=assets.get(native.file);assert(received&&received.received,'Missing native source body receipt');assert.equal(native.sha256,received.sha256);assert.equal(native.bytes,received.bytes);}
 result.assets=[...assets.values()].sort((a,b)=>a.file.localeCompare(b.file));assert.equal(assetFailures.length,0);assert.equal(failedRequests.length,0);assert.equal(errors.length,0);
 assertShaderReuseResult(result,{backend,sourceSha,sourceTree:report.sourceTree});
 assert.equal(report.independentPixelPairs.length,SHADER_PROOF_CASES.length);assert.equal(captures.size,SHADER_PROOF_CASES.length*5);
 for(const row of report.independentPixelPairs){assert.equal(row.changedPixels,0,row.id+' saved PNG pixels changed');assert.equal(row.maxChannelDelta,0);assert.equal(row.baselinePngRgbaSha256,row.candidatePngRgbaSha256);}
 for(const row of result.rows)for(const capture of row.captures){const saved=captures.get(row.id+'-'+capture.role);assert(saved);assert.equal(saved.readPixelsSha256,capture.rgbaSha256);}
 assert.equal(git(repo,'rev-parse','HEAD'),sourceSha);assert.equal(git(repo,'status','--porcelain','--untracked-files=no'),'','Tracked source changed during the fixture');
 report.passed=true;
}catch(error){errors.push(error?.stack??String(error));process.exitCode=1;}
finally{
 clearTimeout(deadline);await browser?.close();if(server)await new Promise(ok=>server.close(ok));while(pending.size)await Promise.allSettled([...pending]);
 report.shaderFiles=[...shaderFiles.values()];report.captures=[...captures.values()];report.assets=[...assets.values()];
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceSha,sourceTree:report.sourceTree,backend,renderer:report.renderer,passed:report.passed,pairs:report.independentPixelPairs.length,captures:report.captures.length,errors,failedRequests,assetFailures}));
}
