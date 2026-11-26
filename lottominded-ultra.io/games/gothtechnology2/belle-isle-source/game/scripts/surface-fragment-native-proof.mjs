/** Zero-tolerance, same-context surface proof against an independent Git baseline.
 * This is a targeted appearance gate, separate from the original full-game gates. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep,posix} from 'node:path';
import {build} from 'esbuild';

const game=resolve(import.meta.dirname,'..');
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();
const gamePath='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const baseline=process.env.SURFACE_PROOF_BASELINE_SHA||'d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c';
assert.match(baseline,/^[a-f0-9]{40}$/,'The comparison requires an immutable baseline SHA');
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
if(process.env.SURFACE_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.SURFACE_PROOF_SOURCE_SHA);
const width=Number(process.env.SURFACE_PROOF_WIDTH||960),height=Number(process.env.SURFACE_PROOF_HEIGHT||600);
assert(Number.isInteger(width)&&width>=320&&width<=1920&&Number.isInteger(height)&&height>=240&&height<=1200);
const output=resolve(game,'output/surface-fragment-proof');await mkdir(output,{recursive:true});
const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const pinnedSources=new Map(),assets=new Map(),assetBytes=new Map();
function pinned(path){
 assert(path.startsWith(gamePath+'/')&&!path.split('/').includes('..'),'Baseline path escaped the game');
 if(!pinnedSources.has(path)){
  const content=execFileSync('git',['show',baseline+':'+path],{cwd:repo,encoding:'utf8',maxBuffer:32*1024*1024});
  pinnedSources.set(path,{path,sha256:sha256(content),content});
 }
 return pinnedSources.get(path).content;
}
function construction(){
 const source=pinned(gamePath+'/src/belle/world.ts');
 const poly=source.split('\n').find(line=>line.startsWith('function poly('));
 const lawn=source.match(/grass\.onBeforeCompile=(shader=>\{[^\n]*?\});const pavement=/)?.[1];
 assert(poly&&lawn,'Pinned authored lawn/geometry construction could not be extracted');
 return 'import * as T from "three";type Point=[number,number];export '+poly+'\nexport function finishParkLawn(material:T.MeshStandardMaterial){material.onBeforeCompile='+lawn+';}';
}
function cloudConstruction(){
 const source=pinned(gamePath+'/src/belle/islandSky.ts');
 const fn=source.match(/function cloudTexture\(\)\{[\s\S]*?\n\}/)?.[0];
 assert(fn,'Pinned cloud texture constructor could not be extracted');
 return 'import * as T from "three";export '+fn;
}
const plugin={name:'independent-pinned-surface-baseline',setup(b){
 b.onResolve({filter:/^baseline:/},args=>{
  const name=args.path.slice('baseline:'.length);
  if(name==='world-materials')return {path:name,namespace:'pinned-construction'};
  return {path:gamePath+'/'+(name.startsWith('src/')||name.startsWith('runtime/')?name:'src/belle/'+name),namespace:'pinned-source'};
 });
 b.onResolve({filter:/^fixture:cloud-texture$/},()=>({path:'cloud-texture',namespace:'pinned-construction'}));
 b.onLoad({filter:/.*/,namespace:'pinned-construction'},args=>({contents:args.path==='world-materials'?construction():cloudConstruction(),loader:'ts',resolveDir:game}));
 b.onResolve({filter:/.*/,namespace:'pinned-source'},async args=>{
  if(args.path.startsWith('.'))return {path:posix.normalize(posix.join(posix.dirname(args.importer),args.path)),namespace:'pinned-source'};
  // Use the same ESM condition and game dependency root as the candidate.
  // require.resolve would select Three's separate CommonJS constructor graph.
  return b.resolve(args.path,{resolveDir:game,kind:args.kind});
 });
 b.onLoad({filter:/.*/,namespace:'pinned-source'},args=>({contents:pinned(args.path),loader:extname(args.path)==='.json'?'json':'ts',resolveDir:dirname(resolve(repo,args.path))}));
}};

const errors=[],failedRequests=[];
const report={schema:'belle-surface-fragment-proof-v1',baseline,sourceHead,width,height,platform:process.platform,
 passed:false,errors,failedRequests,fixtureSha256:null,pinnedSources:[],candidateInputs:[],assets:[],captures:[],result:null,
 scope:'Targeted material/geometry comparisons. No full-game performance, input, collision, physical-iPad, or release acceptance is implied.'};
let browser,server;
try{
 const compiled=await build({entryPoints:[resolve(import.meta.dirname,'surface-fragment-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',plugins:[plugin],metafile:true});
 const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);
 for(const input of Object.keys(compiled.metafile.inputs).sort()){
  if(input.startsWith('pinned-source:')||input.startsWith('pinned-construction:'))continue;
  const filename=resolve(game,input);
  if(!filename.startsWith(repo+sep)||filename.includes(sep+'node_modules'+sep))continue;
  report.candidateInputs.push({path:filename.slice(repo.length+1),sha256:sha256(await readFile(filename))});
 }
 const changedSurfaceModules=new Set(['surfaceFinish.ts','asphaltPolish.ts','bridgeMaterialFinish.ts','macArthurSurface.ts','cinematicTerrain.ts','parkLawn.ts','lawnFragmentOptimization.ts'].map(name=>gamePath+'/src/belle/'+name));
 // Paired materials use shared geometry. Refuse to extend that claim to a
 // silently changed geometry factory, collision path, lighting or PBR helper.
 for(const input of report.candidateInputs){
  if(!input.path.startsWith(gamePath+'/src/')||changedSurfaceModules.has(input.path))continue;
  assert.equal(input.sha256,sha256(pinned(input.path)),'A shared fixture dependency changed outside this material-only proof: '+input.path);
 }
 report.candidateTrackedDiffSha256=sha256(execFileSync('git',['diff','HEAD','--',gamePath+'/src',gamePath+'/scripts'],{cwd:repo,maxBuffer:32*1024*1024}));
 await writeFile(resolve(output,'fixture.js'),javascript);
 const publicRoot=resolve(game,'public');
 const types={'.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://127.0.0.1').pathname;
   if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
   if(path==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
   const decoded=decodeURIComponent(path),filename=resolve(publicRoot,'.'+decoded);
   if(!filename.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
   let bytes=assetBytes.get(decoded);
   if(!bytes)bytes=await readFile(filename);
   if(!assets.has(decoded)){
    const assetPath=gamePath+'/public'+decoded;
    const expectedBlob=execFileSync('git',['rev-parse',baseline+':'+assetPath],{cwd:repo,encoding:'utf8'}).trim();
    const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(blob,expectedBlob,'Served asset differs from pinned baseline: '+decoded);
    assets.set(decoded,{path:assetPath,bytes:bytes.length,gitBlob:blob,sha256:sha256(bytes)});
    assetBytes.set(decoded,bytes);
   }
   res.setHeader('Content-Type',types[extname(filename)]||'application/octet-stream');res.end(bytes);
  }catch(error){errors.push(String(error));res.writeHead(500);res.end('Fixture asset failed verification');}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const native=process.platform==='darwin',executablePath=process.env.SURFACE_PROOF_BROWSER_PATH;
 const launch={headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 browser=await chromium.launch({...launch,...(executablePath?{executablePath}:{channel:'chrome'})});
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('[surface-proof]'))console.log(message.text());});
 report.browserVersion=browser.version();
 await page.goto('http://127.0.0.1:'+server.address().port+'/?width='+width+'&height='+height,{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.__surfaceFragmentProof==='function',{},{timeout:60000});
 const result=await page.evaluate(()=>window.__surfaceFragmentProof());
 const images=result.images;delete result.images;report.result=result;
 for(const capture of images||[]){
  assert.match(capture.name,/^[a-zA-Z0-9_.-]+$/);
  const bytes=Buffer.from(capture.png.replace(/^data:image\/png;base64,/,''),'base64');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const filename=capture.name+'.png';await writeFile(resolve(output,filename),bytes);
  report.captures.push({file:filename,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
 }
 assert.equal(result.rows?.length,36,'All three surfaces, four styles, and three views must be compared');
 const expectedCases=['lawn','asphalt','masonry'].flatMap(subject=>['near','mid','grazing'].flatMap(view=>['authentic','golden','noir','detroit2084'].map(style=>subject+'-'+view+'-'+style))).sort();
 assert.deepEqual(result.rows.map(row=>row.name).sort(),expectedCases,'Duplicate or missing required case identifiers');
 assert((images?.length||0)>=72,'Each case must retain both actual renders');
 assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU backend '+result.gpu);
 for(const row of result.rows){
  for(const name of ['changedPixels','maxChannelDelta','repeatChangedPixels','shadowChangedPixels','shadowRepeatChangedPixels'])assert.equal(row[name],0,row.name+': '+name);
  assert.equal(row.orderEqual,true,row.name+': draw order');assert.equal(row.geometryEqual,true,row.name+': submitted geometry');
 }
 assert.equal(result.coverage?.length,3,'All subject controls must complete');
 for(const coverage of result.coverage){
  assert(coverage.activeFilterPixels>=16&&coverage.inactiveFilterPixels>=16&&coverage.effectiveDetailPixels>=16&&coverage.passed===true,'Ineffective controls: '+coverage.subject);
 }
 assert.equal(errors.length,0,'Shader, page or asset error');assert.equal(failedRequests.length,0);
 assert.equal(result.passed,true,'At least one exact pixel, determinism, visibility, material, geometry or shadow comparison failed');
 report.passed=true;
}catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
finally{
 await browser?.close();if(server)await new Promise(ok=>server.close(ok));
 report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assets=[...assets.values()];
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,sourceHead,baseline,gpu:report.result?.gpu,rows:report.result?.rows?.length,failedRows:report.result?.rows?.filter(row=>!row.passed),errors,report:resolve(output,'report.json')}));
}
