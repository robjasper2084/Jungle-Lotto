import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,relative,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const game=resolve(import.meta.dirname,'..'),output=resolve(process.env.FIXED_SCENERY_PROOF_OUTPUT??resolve(game,'output/fixed-scenery-proof'));
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
const compileOnly=process.env.FIXED_SCENERY_COMPILE_ONLY==='1';
const localValidation=process.env.FIXED_SCENERY_LOCAL_VALIDATION==='1';
assert(!localValidation||(!process.env.GITHUB_ACTIONS&&!process.env.FIXED_SCENERY_SOURCE_SHA),'Local worktree validation is forbidden in CI or an exact-head gate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(output,{recursive:true});
const sourcePaths=['src/belle/staticLocalTransform.ts','src/belle/streetDetails.ts','src/belle/gardens.ts','src/belle/lakeHabitat.ts',
 'src/belle/realisticMaterials.ts','src/belle/photoReferenceSurfaces.ts','src/belle/sunsetGround.ts',
 'scripts/fixed-scenery-proof-browser.ts','scripts/fixed-scenery-native-proof.mjs','package-lock.json'];
const sources=[];
for(const path of sourcePaths){const file=resolve(game,path),bytes=await readFile(file),repoPath=relative(repo,file).split(sep).join('/');
 if(!compileOnly&&!localValidation)assert.deepEqual(bytes,execFileSync('git',['show',head+':'+repoPath],{cwd:repo,maxBuffer:20*1024*1024}),'Working source differs from checked-out commit: '+repoPath);
 sources.push({path:repoPath,bytes:bytes.length,sha256:sha(bytes)});
}
if(!compileOnly)assert.equal(head,process.env.FIXED_SCENERY_SOURCE_SHA??head,'Unexpected source revision');
const compiled=await build({entryPoints:[resolve(import.meta.dirname,'fixed-scenery-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,metafile:true,logLevel:'error'});
const javascript=compiled.outputFiles[0].contents;
const receipt={sourceHead:localValidation?null:head,baseHead:head,localValidation,compileOnly,fixtureSha256:sha(javascript),sources,bundledInputs:Object.keys(compiled.metafile.inputs),nativePixelAcceptance:false};
await writeFile(resolve(output,'source-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
if(compileOnly){console.log(JSON.stringify({...receipt,scope:'Bundle validation only; no browser or pixel acceptance.'}));}
else{
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
 const publicRoot=resolve(game,'public'),assets=new Map(),errors=[],failedRequests=[],httpErrors=[];
 const types={'.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp'};
 const server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://127.0.0.1').pathname;
   if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block;width:960px;height:600px}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
   if(path==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
   const filename=resolve(publicRoot,'.'+decodeURIComponent(path));
   if(!filename.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
   const bytes=await readFile(filename);assets.set(path,{path,bytes:bytes.length,sha256:sha(bytes)});
   res.setHeader('Content-Type',types[extname(filename)]||'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;const report={...receipt,platform:process.platform,passed:false,errors,failedRequests,httpErrors,captures:[],geometryReceipts:[],result:null};
 try{
  const native=process.platform==='darwin',executablePath=process.env.FIXED_SCENERY_BROWSER_EXECUTABLE;
  browser=await chromium.launch({...(!executablePath?{channel:'chrome'}:{executablePath}),headless:!native,
   args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(String(error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.__fixedSceneryProof==='function',null,{timeout:60000});
  const result=await page.evaluate(()=>window.__fixedSceneryProof()),images=result.images,geometryReceipts=result.geometryReceipts;
  delete result.images;delete result.geometryReceipts;report.result=result;
  assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual renderer '+result.gpu);
  for(const image of images){const bytes=Buffer.from(image.png.replace(/^data:image\/png;base64,/,''),'base64');
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),960);assert.equal(bytes.readUInt32BE(20),600);
   const file=image.name+'.png';await writeFile(resolve(output,file),bytes);report.captures.push({file,bytes:bytes.length,sha256:sha(bytes)});
  }
  for(const geometry of geometryReceipts){
   const row=result.rows.find(row=>row.name===geometry.name);assert(row,'Unknown geometric receipt');
   const baseline=Buffer.from(geometry.baseline.matrixFloat64Base64,'base64'),candidate=Buffer.from(geometry.candidate.matrixFloat64Base64,'base64');
   assert.equal(baseline.length,result.cachedNodes*32*8);assert.equal(candidate.length,baseline.length);
   assert.equal(sha(baseline),row.baselineMatrixSha256);assert.equal(sha(candidate),row.candidateMatrixSha256);
   assert.deepEqual(baseline,candidate,'Native matrix bytes differ');assert.deepEqual(geometry.baseline.frustum,geometry.candidate.frustum,'Native frustum receipts differ');
   assert.deepEqual(geometry.baseline.rays,geometry.candidate.rays,'Native raycast receipts differ');assert.equal(geometry.baseline.hitCount,geometry.candidate.hitCount);
   const file=geometry.name+'-geometry.json',bytes=Buffer.from(JSON.stringify(geometry,null,2)+'\n');
   await writeFile(resolve(output,file),bytes);report.geometryReceipts.push({file,bytes:bytes.length,sha256:sha(bytes)});
  }
  assert.equal(result.rows.length,12);assert.equal(report.captures.length,48);assert.equal(errors.length,0);assert.equal(failedRequests.length,0);assert.equal(httpErrors.length,0);
  assert.equal(report.geometryReceipts.length,12);
  assert.equal(result.passed,true,'Fixed scenery changed exact pixels, matrices, frustum, raycasts, draws, triangles, or failed a positive control');
  report.passed=true;report.nativePixelAcceptance=true;
 }catch(error){errors.push(String(error?.stack??error));process.exitCode=1;}
 finally{
  await browser?.close();await new Promise(ok=>server.close(ok));
  report.servedAssets=[...assets.values()];await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,sourceHead:report.sourceHead,localValidation:report.localValidation,renderer:report.result?.gpu,
   cases:report.result?.rows?.map(row=>({name:row.name,passed:row.passed,changedPixels:row.changedPixels})),captures:report.captures.length,geometryReceipts:report.geometryReceipts.length,errors}));
 }
}
