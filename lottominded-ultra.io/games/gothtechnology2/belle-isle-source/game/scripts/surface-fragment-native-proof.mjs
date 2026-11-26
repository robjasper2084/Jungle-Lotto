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

const NATIVE_TIMING='native-8x16-abba-v1',SOFTWARE_TIMING='legacy-software';
const timingCases=['lawn','asphalt','masonry'].flatMap(subject=>['near','mid','grazing'].map(view=>({subject,view,name:subject+'-'+view})));
const average=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const finiteNonnegative=(value,message)=>assert(Number.isFinite(value)&&value>=0,message);
function validateTimings(result,native,width,height){
 assert.equal(result.timingMode,native?NATIVE_TIMING:SOFTWARE_TIMING,'Timing protocol/backend mismatch');
 assert.equal(result.timings?.length,9,'All nine original authentic-style timing comparisons must remain');
 assert.deepEqual(result.timings.map(t=>t.subject+'-'+t.view),timingCases.map(t=>t.name),'Missing, duplicate or reordered timing comparison');
 const queryIds=new Set(),comparisons=[];let measuredFrames=0,warmupFrames=0,totalLanes=0,totalGroups=0;
 for(const timing of result.timings){
  const name=timing.subject+'-'+timing.view,row=result.rows.find(row=>row.name===name+'-authentic');
  assert(row,name+': missing corresponding exact pixel row');
  assert.equal(timing.width,width,name+': width');assert.equal(timing.height,height,name+': height');
  assert.equal(timing.optimizationApplied,timing.subject!=='lawn',name+': withdrawn lawn must remain original regression coverage');
  assert.equal(timing.order,'ABBA',name+': lane order');
  const repetitions=native?8:timing.subject==='masonry'?3:1;
  assert.equal(timing.repetitions,repetitions,name+': group count');assert.equal(timing.lanes?.length,repetitions*4,name+': lane count');
  if(native){
   assert.equal(timing.protocol,NATIVE_TIMING,name+': protocol');assert.equal(timing.style,'authentic',name+': style');
   assert.equal(timing.framesPerLane,16,name+': frames per lane');assert.equal(timing.warmupRenders,3,name+': warmups');
   assert(Number.isSafeInteger(timing.observation?.meshes)&&timing.observation.meshes>0,name+': observation ownership receipt');
   assert.equal(timing.observation.removed,true,name+': per-draw observers remained installed');
   assert.equal(timing.observation.restored,true,name+': original observer references were not restored');
  }
  const recomputed=[];
  for(const [index,lane]of timing.lanes.entries()){
   const side=['baseline','candidate','candidate','baseline'][index%4],repetition=Math.floor(index/4)+1,label=name+' group'+repetition+' lane'+(index%4);
   assert.equal(lane.side,side,label+': ABBA side');assert.equal(lane.repetition,repetition,label+': group index');
   assert.equal(lane.calls,row[side+'Calls'],label+': display draw count');assert.equal(lane.triangles,row[side+'Triangles'],label+': display triangle count');
   finiteNonnegative(lane.cpuMs,label+': CPU duration');finiteNonnegative(lane.fenceMs,label+': completion-fence duration');
   if(!native){
    assert(['available','unavailable','disjoint'].includes(lane.gpu?.status),label+': software elapsed status');
    if(lane.gpu.status==='available')finiteNonnegative(lane.gpu.nanoseconds,label+': software elapsed value');
    measuredFrames++;continue;
   }
   assert.equal(lane.lane,index%4,label+': lane index');assert.equal(lane.framesPerLane,16,label+': frame count');assert.equal(lane.warmupRenders,3,label+': warmup count');
   assert.equal(lane.samples?.length,16,label+': every consecutive raw frame is required');
   for(const [sampleIndex,sample]of lane.samples.entries()){
    const sampleLabel=label+' sample'+sampleIndex;assert.equal(sample.index,sampleIndex,sampleLabel+': frame sequence');
    finiteNonnegative(sample.cpuMs,sampleLabel+': CPU duration');finiteNonnegative(sample.fenceMs,sampleLabel+': completion-fence duration');
    assert.equal(sample.calls,lane.calls,sampleLabel+': draw count');assert.equal(sample.triangles,lane.triangles,sampleLabel+': triangle count');
    assert.equal(sample.gpu?.status,'complete',sampleLabel+': no unavailable/disjoint/invalid sample may be removed');
    assert.equal(sample.gpu.resultAvailable,true,sampleLabel+': completed elapsed query');assert.equal(sample.gpu.disjoint,false,sampleLabel+': disjoint query');
    assert(Number.isSafeInteger(sample.gpu.nanoseconds)&&sample.gpu.nanoseconds>=0,sampleLabel+': raw elapsed nanoseconds');
    assert(Number.isSafeInteger(sample.gpu.queryId)&&sample.gpu.queryId===measuredFrames+1,sampleLabel+': unique global query sequence');
    assert(!queryIds.has(sample.gpu.queryId),sampleLabel+': duplicated native query');queryIds.add(sample.gpu.queryId);measuredFrames++;
   }
   const cpuMs=average(lane.samples.map(sample=>sample.cpuMs)),fenceMs=average(lane.samples.map(sample=>sample.fenceMs)),gpuNanoseconds=average(lane.samples.map(sample=>sample.gpu.nanoseconds));
   assert.equal(lane.cpuMs,cpuMs,label+': CPU lane mean must use all16 raw samples');assert.equal(lane.fenceMs,fenceMs,label+': fence lane mean must use all16 raw samples');
   assert.equal(lane.gpu.status,'complete',label+': completed lane status');assert.equal(lane.gpu.nanoseconds,gpuNanoseconds,label+': GPU lane mean must use all16 raw samples');
   recomputed.push({side,repetition,cpuMs,fenceMs,gpuNanoseconds});warmupFrames+=3;
  }
  totalLanes+=timing.lanes.length;totalGroups+=repetitions;
  if(native){
   const groups=Array.from({length:8},(_,groupIndex)=>{
    const group=recomputed.slice(groupIndex*4,groupIndex*4+4),summarize=side=>{
     const own=group.filter(lane=>lane.side===side);
     return {cpuMs:average(own.map(lane=>lane.cpuMs)),fenceMs:average(own.map(lane=>lane.fenceMs)),gpuNanoseconds:average(own.map(lane=>lane.gpuNanoseconds))};
    };
    const baseline=summarize('baseline'),candidate=summarize('candidate');
    return {repetition:groupIndex+1,baseline,candidate,delta:{cpuMs:candidate.cpuMs-baseline.cpuMs,fenceMs:candidate.fenceMs-baseline.fenceMs,gpuNanoseconds:candidate.gpuNanoseconds-baseline.gpuNanoseconds}};
   });
   assert.deepEqual(timing.groups,groups,name+': group summaries must be independently recoverable from all raw samples');
   comparisons.push({name,optimizationApplied:timing.subject!=='lawn',lanes:recomputed,groups,meanPairedDelta:{cpuMs:average(groups.map(group=>group.delta.cpuMs)),fenceMs:average(groups.map(group=>group.delta.fenceMs)),gpuNanoseconds:average(groups.map(group=>group.delta.gpuNanoseconds))}});
  }
 }
 if(native){assert.equal(measuredFrames,4608);assert.equal(queryIds.size,4608);assert.equal(warmupFrames,864);assert.equal(totalLanes,288);assert.equal(totalGroups,72);}
 else{assert.equal(measuredFrames,60);assert.equal(totalLanes,60);assert.equal(totalGroups,15);}
 return {protocol:result.timingMode,comparisons:9,groups:totalGroups,lanes:totalLanes,measuredFrames,warmupFrames,uniqueCompletedGpuQueries:queryIds.size,recomputed:comparisons,
  interpretation:'Each native comparison has eight whole paired ABBA groups. Individual raw frames are not independent experimental units. CPU render submission, GPU elapsed time and completion-fence wait remain separate; fences and counters do not establish frame speed. Report all views and regressions. No outlier removal or performance threshold is applied by this appearance diagnostic.'};
}

function timingSelfTest(){
 let queryId=0;const result={timingMode:NATIVE_TIMING,rows:[],timings:[]};
 for(const {subject,view,name}of timingCases){
  result.rows.push({name:name+'-authentic',baselineCalls:5,candidateCalls:5,baselineTriangles:321,candidateTriangles:321});
  const lanes=[];
  for(let repetition=1;repetition<=8;repetition++)for(const [lane,side]of ['baseline','candidate','candidate','baseline'].entries()){
   const samples=Array.from({length:16},(_,index)=>({index,cpuMs:repetition+index/16+(side==='candidate'?.25:0),fenceMs:2+index/4,calls:5,triangles:321,gpu:{status:'complete',nanoseconds:1000000+queryId,queryId:++queryId,resultAvailable:true,disjoint:false}}));
   lanes.push({side,repetition,lane,framesPerLane:16,warmupRenders:3,cpuMs:average(samples.map(s=>s.cpuMs)),fenceMs:average(samples.map(s=>s.fenceMs)),gpu:{status:'complete',nanoseconds:average(samples.map(s=>s.gpu.nanoseconds))},calls:5,triangles:321,samples});
  }
  const groups=Array.from({length:8},(_,i)=>{
   const subset=lanes.slice(i*4,i*4+4),summarize=side=>{const own=subset.filter(lane=>lane.side===side);return {cpuMs:average(own.map(lane=>lane.cpuMs)),fenceMs:average(own.map(lane=>lane.fenceMs)),gpuNanoseconds:average(own.map(lane=>lane.gpu.nanoseconds))};};
   const baseline=summarize('baseline'),candidate=summarize('candidate');return {repetition:i+1,baseline,candidate,delta:{cpuMs:candidate.cpuMs-baseline.cpuMs,fenceMs:candidate.fenceMs-baseline.fenceMs,gpuNanoseconds:candidate.gpuNanoseconds-baseline.gpuNanoseconds}};
  });
  result.timings.push({subject,view,optimizationApplied:subject!=='lawn',width:960,height:600,style:'authentic',protocol:NATIVE_TIMING,order:'ABBA',repetitions:8,framesPerLane:16,warmupRenders:3,observation:{meshes:12,removed:true,restored:true},lanes,groups});
 }
 const audit=validateTimings(result,true,960,600);assert.equal(audit.measuredFrames,4608);assert.equal(audit.recomputed.length,9);
 const corruptions=[
  r=>{r.timings.pop();},r=>{r.timings[1]=structuredClone(r.timings[0]);},r=>{r.timings[0].lanes.pop();},r=>{r.timings[0].lanes[0].samples.pop();},
  r=>{r.timings[0].lanes[0].samples[1].gpu.queryId=1;},r=>{r.timings[0].lanes[0].samples[1].index=0;},r=>{r.timings[0].lanes[0].samples[1].gpu.status='disjoint';},
  r=>{r.timings[0].lanes[0].samples[1].gpu.disjoint=true;},r=>{r.timings[0].lanes[0].samples[1].gpu.resultAvailable=false;},r=>{r.timings[0].lanes[0].samples[1].gpu.nanoseconds=NaN;},
  r=>{r.timings[0].lanes[0].samples[1].cpuMs=NaN;},r=>{r.timings[0].lanes[0].samples[1].fenceMs=-1;},r=>{r.timings[0].lanes[0].samples[1].calls++;},
  r=>{r.timings[0].lanes[0].samples[1].triangles++;},r=>{r.timings[0].lanes[0].cpuMs++;},r=>{r.timings[0].lanes[0].fenceMs++;},r=>{r.timings[0].lanes[0].gpu.nanoseconds++;},
  r=>{r.timings[0].groups[0].delta.cpuMs++;},r=>{r.timings[0].groups[0].candidate.gpuNanoseconds++;},r=>{r.timings[0].lanes[0].side='candidate';},
  r=>{r.timings[0].lanes[0].repetition=2;},r=>{r.timings[0].lanes[0].warmupRenders=2;},r=>{r.timings[0].observation.removed=false;},r=>{r.timings[0].observation.restored=false;},
  r=>{r.timings[0].optimizationApplied=true;},r=>{r.timingMode=SOFTWARE_TIMING;},
 ];
 for(const [index,corrupt]of corruptions.entries()){const changed=structuredClone(result);corrupt(changed);assert.throws(()=>validateTimings(changed,true,960,600),undefined,'Corrupt timing receipt '+index+' was accepted');}
 const software=structuredClone(result);software.timingMode=SOFTWARE_TIMING;
 for(const timing of software.timings){timing.repetitions=timing.subject==='masonry'?3:1;timing.lanes=timing.lanes.slice(0,timing.repetitions*4);for(const lane of timing.lanes)lane.gpu={status:'available',nanoseconds:lane.gpu.nanoseconds};}
 assert.equal(validateTimings(software,false,960,600).measuredFrames,60);
 return {passed:true,nativeFrames:4608,nativeGroups:72,rejectedCorruptions:corruptions.length,softwareFrames:60};
}
if(process.argv.includes('--timing-self-test')){console.log(JSON.stringify(timingSelfTest()));process.exit(0);}

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
const native=process.platform==='darwin';
const timingPlan={protocol:native?NATIVE_TIMING:SOFTWARE_TIMING,comparisons:timingCases,style:'authentic',nativeGroupsPerComparison:8,nativeFramesPerLane:16,nativeWarmupRendersPerLane:3,nativeMeasuredFrames:4608,nativeWarmupFrames:864,
 motivation:'Increase paired-block coverage to resolve the earlier one-block asphalt grazing signal, possible near-view regression, and inconclusive three-block masonry measurements. Preserve all nine original timing comparisons, including unchanged lawn controls. No candidate activation or result-based case selection.',
 method:'Individual render submission, elapsed query, and completion fence per raw frame. Original shadows refresh each render. No draw observer or diagnostic snapshot during native timing. Eight whole ABBA groups are the paired units; keep every raw sample. Pixel cases, controls, zero tolerances and the workflow deadline are unchanged.'};
const report={schema:'belle-surface-fragment-proof-v3',baseline,sourceHead,width,height,platform:process.platform,timingPlan,timingValidation:null,
 passed:false,errors,failedRequests,fixtureSha256:null,pinnedSources:[],candidateInputs:[],assets:[],captures:[],worldLawnExtraction:null,result:null,
 scope:'Targeted material/geometry comparisons. No full-game performance, input, collision, physical-iPad, or release acceptance is implied.'};
let browser,server;
try{
 const worldPath=gamePath+'/src/belle/world.ts',originalWorld=pinned(worldPath),currentWorld=await readFile(resolve(repo,worldPath),'utf8');
 const originalHook=originalWorld.match(/grass\.onBeforeCompile=(shader=>\{[^\n]*?\});const pavement=/)?.[1];
 const importAnchor="import {finishAsphalt,finishBank} from './surfaceFinish.ts';",helperImport="import {finishParkLawn} from './parkLawn.ts';";
 assert(originalHook&&originalWorld.split(importAnchor).length===2&&!originalWorld.includes(helperImport),'Pinned production lawn extraction anchors changed');
 const inlineHook='grass.onBeforeCompile='+originalHook+';';assert.equal(originalWorld.split(inlineHook).length,2,'The original lawn hook must occur exactly once');
 const expectedWorld=originalWorld.replace(importAnchor,importAnchor+'\n'+helperImport).replace(inlineHook,'finishParkLawn(grass);');
 report.worldLawnExtraction={path:worldPath,originalSha256:sha256(originalWorld),currentSha256:sha256(currentWorld),expectedSha256:sha256(expectedWorld),originalHookSha256:sha256(originalHook),helperExtractionOnly:currentWorld===expectedWorld};
 assert.equal(report.worldLawnExtraction.helperExtractionOnly,true,'Production world.ts differs beyond the exact original lawn helper extraction and import');
 // The fixture serves pinned original bytes directly, rather than the build's
 // generated gzip transport. Both material paths use this same loader mode.
 const compiled=await build({entryPoints:[resolve(import.meta.dirname,'surface-fragment-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',plugins:[plugin],metafile:true,define:{'import.meta.env.PROD':'false'}});
 const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);
 for(const input of Object.keys(compiled.metafile.inputs).sort()){
  if(input.startsWith('pinned-source:')||input.startsWith('pinned-construction:'))continue;
  const filename=resolve(game,input);
  if(!filename.startsWith(repo+sep)||filename.includes(sep+'node_modules'+sep))continue;
  report.candidateInputs.push({path:filename.slice(repo.length+1),sha256:sha256(await readFile(filename))});
 }
 const changedSurfaceModules=new Set(['surfaceFinish.ts','asphaltPolish.ts','bridgeMaterialFinish.ts','macArthurSurface.ts','macArthurBumpCenterReuse.ts','parkLawn.ts'].map(name=>gamePath+'/src/belle/'+name));
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
 const executablePath=process.env.SURFACE_PROOF_BROWSER_PATH;
 const launch={headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
 browser=await chromium.launch({...launch,...(executablePath?{executablePath}:{channel:'chrome'})});
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('[surface-proof]'))console.log(message.text());});
 report.browserVersion=browser.version();
 await page.goto('http://127.0.0.1:'+server.address().port+'/?width='+width+'&height='+height+'&timing='+(native?NATIVE_TIMING:SOFTWARE_TIMING),{waitUntil:'load'});
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
 assert.equal(result.grassWithdrawal?.status,'withdrawn','Grass must remain a withdrawn candidate');
 assert.equal(result.grassWithdrawal?.candidateEnabled,false,'Grass proof may only cover the original implementation');
 for(const name of ['callbackEqual','cacheKeyEqual','vertexShaderEqual','fragmentShaderEqual','passed'])assert.equal(result.lawnEquivalence?.[name],true,'Original lawn equality failed: '+name);
 for(const name of ['callbackSha256','cacheKeySha256','vertexShaderSha256','fragmentShaderSha256']){
  assert.match(result.lawnEquivalence.original[name],/^[a-f0-9]{64}$/,'Missing original lawn receipt: '+name);
  assert.equal(result.lawnEquivalence.current[name],result.lawnEquivalence.original[name],'Original lawn receipt differs: '+name);
 }
 assert.equal(result.rows?.length,36,'All three surfaces, four styles, and three views must be compared');
 const expectedCases=['lawn','asphalt','masonry'].flatMap(subject=>['near','mid','grazing'].flatMap(view=>['authentic','golden','noir','detroit2084'].map(style=>subject+'-'+view+'-'+style))).sort();
 assert.deepEqual(result.rows.map(row=>row.name).sort(),expectedCases,'Duplicate or missing required case identifiers');
 const captureNames=report.captures.map(capture=>capture.file);
 assert.equal(new Set(captureNames).size,captureNames.length,'Capture names must be unique');
 for(const name of expectedCases)for(const side of ['baseline','default','candidate']){
  assert(captureNames.includes(name+'-'+side+'.png'),'Missing required render: '+name+'-'+side);
 }
 for(const capture of report.captures){
  assert.equal(capture.width,width,capture.file+': capture width');assert.equal(capture.height,height,capture.file+': capture height');
 }
 assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU backend '+result.gpu);
 for(const row of result.rows){
  assert.equal(row.optimizationApplied,row.subject!=='lawn',row.name+': withdrawn grass must be reported as original regression coverage');
  for(const name of ['changedPixels','maxChannelDelta','defaultChangedPixels','defaultMaxChannelDelta','defaultShadowChangedPixels','repeatChangedPixels','shadowChangedPixels','shadowRepeatChangedPixels'])assert.equal(row[name],0,row.name+': '+name);
  for(const name of ['orderEqual','defaultOrderEqual','geometryEqual','defaultGeometryEqual'])assert.equal(row[name],true,row.name+': '+name);
  for(const side of ['default','candidate']){
   assert.equal(row[side+'RgbaSha256'],row.baselineRgbaSha256,row.name+': '+side+' RGBA hash');
   assert.equal(row[side+'ShadowSha256'],row.baselineShadowSha256,row.name+': '+side+' shadow hash');
  }
 }
 for(const material of result.materials.filter(material=>material.subject==='lawn')){
  assert.equal(material.guardObserved,false,'Withdrawn grass guard appeared in an authored material');
  assert.equal(material.linkedGuardObserved,false,'Withdrawn grass guard appeared in a linked material');
 }
 assert.equal(result.coverage?.length,3,'All subject controls must complete');
 for(const coverage of result.coverage){
  assert(coverage.activeFilterPixels>=16&&coverage.inactiveFilterPixels>=16&&coverage.effectiveDetailPixels>=16&&coverage.passed===true,'Ineffective controls: '+coverage.subject);
 }
 const bump=result.masonryBumpCenterControl;
 assert(bump&&bump.installedMaterials>0&&bump.effectivePixels>=16&&bump.passed===true,'The mapped bump-center reuse must have a visibly effective control');
 assert.equal(bump.restoredChangedPixels,0,'Mapped bump-center control did not restore the original image');
 assert.deepEqual(bump.views,['near','mid','grazing'],'Mapped bump-center control coverage');
 assert(result.materials.some(material=>material.subject==='masonry'&&material.side==='candidate'&&material.bumpCenterReuseInstalled===true&&material.bumpCenterMarkerObserved===true&&material.linkedBumpCenterMarkerObserved===true&&material.nativeLinked===true&&material.submitted===true),'No submitted, linked MacArthur material used the mapped bump-center candidate');
 for(const material of result.materials.filter(material=>material.side==='baseline'||material.side==='default')){
  for(const name of ['bumpCenterReuseInstalled','bumpCenterMarkerObserved','linkedBumpCenterMarkerObserved'])assert.equal(material[name],false,'Mapped bump-center candidate leaked into '+material.side);
 }
 report.timingValidation=validateTimings(result,native,width,height);
 assert.equal(errors.length,0,'Shader, page or asset error');assert.equal(failedRequests.length,0);
 assert.equal(result.passed,true,'At least one exact pixel, determinism, visibility, material, geometry or shadow comparison failed');
 report.passed=true;
}catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
finally{
 await browser?.close();if(server)await new Promise(ok=>server.close(ok));
 report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assets=[...assets.values()];
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,sourceHead,baseline,gpu:report.result?.gpu,rows:report.result?.rows?.length,failedRows:report.result?.rows?.filter(row=>!row.passed),fixtureErrors:report.result?.errors,errors,report:resolve(output,'report.json')}));
}
