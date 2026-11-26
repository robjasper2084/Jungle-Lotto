import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import {execFileSync} from 'node:child_process';
import {ORIGINAL_HARNESS_BLOB,MARKER_PREFIX,gitBlob,sha256,buildInventory,generatedTimingReceipt,
 failExit,isGameUrl,traceSummary,diagnosticVerdict,writeBuildInputs,writeBuildReceipt,verifyBuildReceipt} from './sustained-trace-contract.mjs';
import {observeMethod,installSustainedTrace} from './sustained-trace-observer.mjs';
import {scanTraceFile,summarizeTraceFile} from './sustained-trace-stream.mjs';

const traceBytes=trace=>Buffer.from('{"traceEvents":[\n'+trace.traceEvents.map(event=>JSON.stringify(event)).join(',\n')+'\n]}\n');

function fixture(){
 const source={head:'pinned-source',tree:'pinned-tree',harness:{gitBlob:ORIGINAL_HARNESS_BLOB},files:[]};
 const markers=[{label:'profile-start-click',atMs:1000},{label:'first-w-keydown',atMs:1100},{label:'w-keyup',atMs:91108}];
 const page={url:'http://127.0.0.1:1234/?profile=1&perfProbe=1',markers,errors:[],droppedMarkers:0};
 const trace={traceEvents:[
  ...['Browser','Renderer','GPU Process'].map((name,i)=>({ph:'M',name:'process_name',pid:i+1,args:{name}})),
  {ph:'M',name:'thread_name',pid:2,tid:9,args:{name:'CrRendererMain'}},
  ...markers.map(m=>({name:MARKER_PREFIX+m.label,cat:'blink.user_timing',pid:2,tid:9,ts:1_000_000+m.atMs*1000,ph:'R'})),
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:2_099_950,dur:100},
  {ph:'X',cat:'devtools.timeline',name:'FunctionCall',pid:2,tid:9,ts:90_000_000,dur:466700},
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:92_107_950,dur:100}]};
 const cpu={nodes:[{id:1,callFrame:{functionName:'nativeWork',url:page.url+'assets/game.js',lineNumber:0,columnNumber:0}}],
  samples:[1,1,1,1],timeDeltas:[100_000,600_000,89_900_000,200_000],startTime:1_500_000,endTime:92_500_000};
 const report={sourceHead:source.head,mode:'diagnostic',device:'phone',requestedSeconds:90,renderBackend:'angle-metal',
  actualGpu:{renderer:'ANGLE Metal Renderer: Apple'},passed:false,profile:{
   viewport:[390,844,1],settings:{quality:'smooth',effectiveQuality:'smooth',pixelRatio:1,adaptiveScale:1,cap:60,world:{performanceDiagnostic:true}},
   stopReason:'trusted-W-keyup',activeSeconds:90.1,excludedSeconds:.3163,over250ms:2,metrics:{frameMs:{p95:33.5}}}};
 return {source,page,trace,cpu,report,traceComplete:{dataLossOccurred:false,stream:'raw-stream'}};
}

test('original 90-second harness bytes and existing nonzero exits remain binding',async()=>{
 const bytes=await readFile(new URL('./sustained-ride-profile.mjs',import.meta.url));
 assert.equal(gitBlob(bytes),ORIGINAL_HARNESS_BLOB);
 assert.equal(failExit(undefined),1);assert.equal(failExit(0),1);assert.equal(failExit(23),23);
});

test('observers retain native receiver, argument identity, result, and exception',async()=>{
 const token={},value={},nativeFailure=Error('native failure'),observerFailure=Error('observer failure'),seen=[];
 const owner={async work(arg){assert.equal(this,owner);assert.equal(arg,token);seen.push('native');return value;}};
 const original=owner.work;
 const restore=observeMethod(owner,'work',{before:()=>{seen.push('before');throw observerFailure;},
  after:()=>{seen.push('after');throw observerFailure;},onError:error=>assert.equal(error,observerFailure)});
 assert.equal(await owner.work(token),value);assert.deepEqual(seen,['before','native','after']);restore();assert.equal(owner.work,original);
 owner.work=async()=>{throw nativeFailure;};observeMethod(owner,'work',{before:()=>{throw observerFailure;}});
 await assert.rejects(owner.work(),error=>error===nativeFailure);
 const restoreAgain=observeMethod(owner,'work');const replacement=()=>{};owner.work=replacement;restoreAgain();assert.equal(owner.work,replacement);
});

test('clock mapping binds native CPU samples to the real game renderer and ride bounds',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page);
 assert.deepEqual(summary.errors,[]);assert.equal(summary.gameRendererPid,2);assert.equal(summary.clockMapping.spreadUs,0);
 assert.equal(summary.nativeRide.durationMs,90008);assert.equal(summary.nativeRide.traceDurationMs,90008);assert.equal(summary.rendererTimeline.events,3);assert.equal(summary.cpuCoverage.rideSamples,2);
 assert.equal(summary.browserProcesses.length,1);assert.equal(summary.gpuProcesses.length,1);assert.equal(summary.longEvents[0].dur,466700);
 const mutations=[
  x=>x.trace.traceEvents.pop()&&x.trace.traceEvents.pop(),
  x=>x.page.url='http://127.0.0.1:1234/?profile=manual&perfProbe=1',
  x=>x.page.markers[1].atMs+=20,
  x=>x.cpu.startTime=3_000_000,
  x=>x.cpu.endTime=90_000_000,
  x=>x.cpu.samples=[],
  x=>x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'w-keyup').pid=3,
  x=>x.page.droppedMarkers=1,
  x=>x.page.markers.push({...x.page.markers[0]}),
  x=>x.page.markers[0].atMs=NaN,
  x=>x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'first-w-keydown').cat='not-user-timing',
  x=>x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'first-w-keydown').tid=10,
  x=>x.trace.traceEvents=x.trace.traceEvents.filter(e=>e.ph!=='X'),
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.pid=3),
  x=>x.trace.traceEvents.find(e=>e.name==='process_name'&&e.pid===2).args.name='GPU Process',
  x=>{x.cpu.samples=[1];x.cpu.timeDeltas=[100_000];},
  x=>x.cpu.samples[1]=999,
  x=>x.cpu.timeDeltas[1]=NaN,
  x=>x.cpu.timeDeltas[1]=200_000_000,
  x=>x.cpu.timeDeltas='1234',
 ];
 for(const mutate of mutations){const broken=fixture();mutate(broken);assert.ok(traceSummary(broken.trace,broken.cpu,broken.page).errors.length);}
 assert.equal(isGameUrl('https://example.com/?profile=1&perfProbe=1'),false);
});

test('trace collection preserves failed ride metrics and never qualifies release acceptance',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page),verdict=diagnosticVerdict({...f,summary});
 assert.equal(verdict.collectionComplete,true);assert.equal(verdict.releaseAcceptance,false);assert.equal(verdict.originalHarnessPassed,false);
 assert.equal(verdict.originalP95Ms,33.5);assert.equal(verdict.originalIntervalsOver250ms,2);
 const mutations=[
  x=>x.source.harness.gitBlob='different',x=>x.report.sourceHead='old-head',x=>x.report.mode='full',
  x=>x.report.requestedSeconds=30,x=>x.report.actualGpu.renderer='SwiftShader',x=>x.report.profile.viewport[2]=2,
  x=>x.report.profile.settings.quality='high',x=>x.report.profile.settings.adaptiveScale=.5,
  x=>x.report.profile.settings.cap=30,x=>x.report.profile.settings.world.performanceDiagnostic=false,
  x=>x.report.profile.stopReason='timeout',x=>x.report.profile.activeSeconds=89.99,
  x=>x.traceComplete.dataLossOccurred=true,x=>delete x.traceComplete.dataLossOccurred,x=>delete x.traceComplete.stream,
 ];
 for(const mutate of mutations){const broken=fixture();mutate(broken);const result=diagnosticVerdict({...broken,summary});
  assert.equal(result.collectionComplete,false);assert.equal(result.releaseAcceptance,false);}
 assert.equal(diagnosticVerdict({...f,summary:null}).collectionComplete,false);
});

test('both 90-second active frame time and native input bounds remain independently required',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page),verdict=diagnosticVerdict({...f,summary});
 assert.equal(verdict.collectionComplete,true);assert.equal(verdict.originalActiveSeconds,90.1);assert.equal(verdict.originalExcludedSeconds,.3163);
 assert.equal(verdict.nativeCapture.durationMs,90008);assert.equal(verdict.originalHarnessPassed,false);
 // Historical 8b33's 89.699 active seconds stay incomplete despite a 90s input hold.
 f.report.profile.activeSeconds=89.699;f.report.passed=true;
 const incomplete=diagnosticVerdict({...f,summary});assert.equal(incomplete.collectionComplete,false);
 assert.equal(incomplete.originalHarnessPassed,true);assert.equal(incomplete.originalActiveSeconds,89.699);
 assert.equal(incomplete.originalExcludedSeconds,.3163);assert.equal(incomplete.releaseAcceptance,false);
 assert.ok(incomplete.errors.includes('Original trusted 90-second capture incomplete'));
 f.report.profile.activeSeconds=90;assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,true);
 f.report.profile.activeSeconds=NaN;assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,false);
 // A long active total must never substitute for a short trusted input window.
 f.report.profile.activeSeconds=95;f.report.profile.excludedSeconds=5;
 f.page.markers.at(-1).atMs=91099;f.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'w-keyup').ts=92_099_000;
 const short=traceSummary(f.trace,f.cpu,f.page);assert.deepEqual(short.errors,[]);assert.equal(short.nativeRide.durationMs,89999);
 assert.equal(diagnosticVerdict({...f,summary:short}).collectionComplete,false);
 assert.equal(diagnosticVerdict({...f,summary:null}).collectionComplete,false);
});

test('native signed CPU deltas are retained while sample times still cover the ride',()=>{
 const f=fixture();f.cpu.samples=[1,1,1,1,1];f.cpu.timeDeltas=[100_000,600_000,-4,89_900_004,200_000];
 const unchanged=structuredClone(f);
 const summary=traceSummary(f.trace,f.cpu,f.page);assert.deepEqual(summary.errors,[]);assert.equal(summary.cpuCoverage.negativeDeltas,1);
 assert.equal(summary.cpuCoverage.lastSampleUs,92_300_000);assert.equal(f.cpu.timeDeltas[2],-4);
 assert.deepEqual(f,unchanged);assert.equal(summary.cpuCoverage.minimumRawDeltaUs,-4);
 assert.equal(summary.cpuCoverage.rideSamples,3);assert.equal(summary.cpuCoverage.firstRideSampleUs,2_199_996);
 assert.equal(summary.cpuCoverage.lastRideSampleUs,92_100_000);assert.equal(summary.cpuCoverage.maximumRawDeltaEndingDuringRideUs,89_900_004);
 assert.equal(summary.cpuCoverage.initialUnsampledUs,99_996);assert.equal(summary.cpuCoverage.finalUnsampledUs,8_000);
 assert.equal(summary.nativeActivity.gpu.events,0);assert.match(summary.nativeActivity.gpu.limitation,/metadata alone is not coverage/);
 f.trace.traceEvents.push({ph:'X',name:'GpuTask',cat:'gpu',pid:3,tid:11,ts:3_000_000,dur:5000});
 assert.equal(traceSummary(f.trace,f.cpu,f.page).nativeActivity.gpu.durationEvents,1);
});

test('metadata and bounding timestamps cannot substitute for actual observations during trusted W input',()=>{
 const mutations=[
  x=>{x.cpu.samples=[1];x.cpu.timeDeltas=[2000];}, // Published b074 counterexample: sample precedes ride.
  x=>{x.cpu.samples=[1,1];x.cpu.timeDeltas=[100_000,90_700_000];}, // Header/sample bounds span ride; no samples inside.
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach((e,i)=>{e.ts=i?93_000_000:1_900_000;e.dur=100;}),
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.ph='M'),
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.dur=0),
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.tid=99),
  x=>x.cpu.nodes.push({...x.cpu.nodes[0]}),
  x=>x.cpu.samples.fill(99),x=>x.cpu.timeDeltas[1]=null,x=>x.cpu.timeDeltas.pop(),
  x=>{x.page.markers[1].atMs=92000;x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'first-w-keydown').ts=93_000_000;},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);const summary=traceSummary(f.trace,f.cpu,f.page);
  assert.ok(summary.errors.length);assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,false);}
});

test('streamed events match the array summary and preserve the original failed verdict',async()=>{
 const f=fixture(),root=await mkdtemp(resolve(tmpdir(),'belle-trace-stream-')),path=resolve(root,'trace.json');
 try{
  const bytes=traceBytes(f.trace);await writeFile(path,bytes);
  const {summary,receipt}=await summarizeTraceFile(path,f.cpu,f.page);
  assert.deepEqual(summary,traceSummary(f.trace,f.cpu,f.page));assert.equal(receipt.sha256,sha256(bytes));
  assert.equal(receipt.bytes,bytes.length);assert.equal(receipt.events,f.trace.traceEvents.length);assert.equal(receipt.passes,2);
  assert.equal(receipt.completeDocument,true);assert.equal(receipt.unchangedBetweenPasses,true);
  const verdict=diagnosticVerdict({...f,summary});assert.equal(verdict.collectionComplete,true);
  assert.equal(verdict.originalHarnessPassed,false);assert.equal(verdict.originalIntervalsOver250ms,2);assert.equal(verdict.releaseAcceptance,false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('stream reader validates final inline metadata, escaped delimiters and split UTF-8 bytes',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-framing-')),path=resolve(root,'trace.json');
 try{
  const event={name:'é }, ], "metadata": escaped \\ text',args:{list:[{x:1}]}},seen=[];
  const bytes=Buffer.from('{"traceEvents":[\n'+JSON.stringify(event)+'],"metadata":\n{"complete":true}}\n');
  await writeFile(path,bytes);const receipt=await scanTraceFile(path,value=>seen.push(value),{highWaterMark:1});
  assert.deepEqual(seen,[event]);assert.equal(receipt.sha256,sha256(bytes));assert.deepEqual(receipt.topLevelKeys,['traceEvents','metadata']);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('malformed or truncated trace fails closed while the full unchanged file is still hashed',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-bad-stream-')),path=resolve(root,'trace.json');
 const cases=[
  Buffer.from('{"traceEvents":[\n{"ts":1},\n]}'),
  Buffer.from('{"traceEvents":[\n{"ts":1}\n{"ts":2}]}'),
  Buffer.from('{"traceEvents":[\n{"ts":1}'),
  Buffer.from('{"traceEvents":[\n{"ts":1}],"metadata":'),
  Buffer.from('{"traceEvents":[\n{"ts":NaN}]}'),
  Buffer.from('{"traceEvents":[\n{"ts":1}],"metadata":{"value":Infinity}}'),
  Buffer.from('{"traceEvents":[\n{"ts":1}],"traceEvents":[]}'),
  Buffer.from('{"traceEvents":[\n{"ts":1} extra]}'),
  Buffer.concat([Buffer.from('{"traceEvents":[\n{"name":"'),Buffer.from([0xff]),Buffer.from('"}]}')]),
 ];
 try{for(const bytes of cases){await writeFile(path,bytes);let failure;
   try{await scanTraceFile(path,()=>{},{highWaterMark:13});}catch(error){failure=error;}
   assert.ok(failure);assert.equal(failure.traceReceipt.completeFile,true);assert.equal(failure.traceReceipt.completeDocument,false);
   assert.equal(failure.traceReceipt.sha256,sha256(bytes));assert.equal(failure.traceReceipt.bytes,bytes.length);
   assert.deepEqual(await readFile(path),bytes);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

test('build inventory detects changed bytes and rejects symlinks; timing exception permits only buildMs',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-inventory-'));
 try{
  await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/game.js'),'original');
  const first=await buildInventory(root);await writeFile(resolve(root,'assets/game.js'),'changed');
  assert.notDeepEqual(await buildInventory(root),first);
  await symlink(resolve(root,'assets/game.js'),resolve(root,'linked.js'));await assert.rejects(buildInventory(root),/symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
 const before=Buffer.from('{"boxes":46034,"buildMs":1,"notes":["unchanged"]}');
 const after=Buffer.from('{"boxes":46034,"buildMs":2,"notes":["unchanged"]}');
 const receipt=generatedTimingReceipt(before,after);assert.equal(receipt.onlyBuildMsChanged,true);assert.equal(receipt.beforeSha256,sha256(before));
 assert.throws(()=>generatedTimingReceipt(before,Buffer.from('{"boxes":1,"buildMs":2,"notes":["unchanged"]}')),/beyond buildMs/);
 assert.throws(()=>generatedTimingReceipt(before,Buffer.from('{"boxes":46034,"notes":["unchanged"]}')),/timing/);
});

test('clean input pin survives generated timing noise and rejects changed source, head, or downloaded build',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-source-')),game=resolve(root,'app/game'),previousSha=process.env.GITHUB_SHA;
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const timing=Buffer.from('{"boxes":46034,"buildMs":1}');
 try{
  await mkdir(resolve(game,'scripts'),{recursive:true});await mkdir(resolve(root,'app/research'),{recursive:true});
  await writeFile(resolve(game,'scripts/sustained-ride-profile.mjs'),await readFile(new URL('./sustained-ride-profile.mjs',import.meta.url)));
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),timing);
  git(['init','-q']);git(['add','.']);git(['-c','user.name=Trace fixture','-c','user.email=trace@example.invalid','commit','-qm','Fixture','--no-gpg-sign']);
  await mkdir(resolve(game,'dist'));await writeFile(resolve(game,'dist/index.html'),'fixture');await writeFile(resolve(game,'dist/asset-manifest.json'),'[]');
  const pin=await writeBuildInputs(game);process.env.GITHUB_SHA=pin.head;
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),'{"boxes":46034,"buildMs":2}');
  const receipt=await writeBuildReceipt(game);assert.equal(receipt.generatedTiming.onlyBuildMsChanged,true);
  await assert.rejects(verifyBuildReceipt(game,receipt),/checkout must be clean/);
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),timing);
  assert.equal((await verifyBuildReceipt(game,receipt)).head,pin.head);
  await writeFile(resolve(game,'dist/index.html'),'changed');await assert.rejects(verifyBuildReceipt(game,receipt),/mismatch: files/);
  await writeFile(resolve(game,'dist/index.html'),'fixture');process.env.GITHUB_SHA='wrong-sha';await assert.rejects(verifyBuildReceipt(game,receipt),/GITHUB_SHA/);
  process.env.GITHUB_SHA=pin.head;
  const changed=structuredClone(receipt);changed.generatedTiming.afterText='{"boxes":1,"buildMs":2}';
  await assert.rejects(verifyBuildReceipt(game,changed),/beyond buildMs/);
  await writeFile(resolve(game,'scripts/sustained-ride-profile.mjs'),'changed source');
  await assert.rejects(writeBuildInputs(game),/clean before/);await assert.rejects(verifyBuildReceipt(game,receipt),/checkout must be clean/);
 }finally{
  if(previousSha===undefined)delete process.env.GITHUB_SHA;else process.env.GITHUB_SHA=previousSha;
  await rm(root,{recursive:true,force:true});
 }
});

async function observerFixture({listedCategories=[],listingError=false,missingTimeline=false}={}){
 const f=fixture(),root=await mkdtemp(resolve(tmpdir(),'belle-trace-observer-')),output=resolve(root,'trace'),js=Buffer.from('function nativeWork() {}');
 if(missingTimeline)f.trace.traceEvents=f.trace.traceEvents.filter(event=>event.ph!=='X');
 f.source.files=[{file:'assets/game.js',bytes:js.length,sha256:sha256(js)}];
 let closed=0,failures=0;const calls=[];
 class BrowserSession extends EventEmitter{
  async send(method,params){
   calls.push({method,params});
   if(method==='Tracing.getCategories'){if(listingError)throw Error('Enumeration unavailable');return {categories:listedCategories};}
   if(method==='Tracing.end'){queueMicrotask(()=>this.emit('Tracing.tracingComplete',f.traceComplete));return {};}
   if(method==='IO.read')return {data:traceBytes(f.trace).toString(),eof:true};
   return {};
  }
 }
 const browserSession=new BrowserSession(),pageSession={send:async method=>{
  if(method==='Profiler.stop')return {profile:f.cpu};
  if(method==='Target.getTargetInfo')return {targetInfo:{type:'page',url:f.page.url,targetId:'actual-game'}};
  return {};
 }};
 class Page extends EventEmitter{
  isClosed(){return false;} async addInitScript(){} context(){return {newCDPSession:async()=>pageSession};}
  async evaluate(){return f.page;}
  async goto(){this.emit('response',{url:()=> 'http://127.0.0.1:1234/assets/game.js',status:()=>200,body:async()=>js});return null;}
 }
 const browser={newBrowserCDPSession:async()=>browserSession,newPage:async()=>new Page(),close:async()=>{closed++;}};
 const chromium={launch:async()=>browser};
 try{
  await mkdir(resolve(root,'output/sustained-profile/diagnostic/phone'),{recursive:true});
  const originalBytes=Buffer.from(JSON.stringify(f.report));await writeFile(resolve(root,'output/sustained-profile/diagnostic/phone/report.json'),originalBytes);
  await installSustainedTrace(chromium,{game:root,output,source:f.source,onFailure:()=>failures++});
  const launched=await chromium.launch({channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
  await launched.newPage();
  const page=await launched.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.goto(f.page.url,{waitUntil:'domcontentloaded'});await launched.close();
  const evidence=JSON.parse(await readFile(resolve(output,'trace-evidence.json'),'utf8'));
  assert.equal(closed,1);assert.equal(evidence.verdict.originalHarnessPassed,false);assert.equal(evidence.verdict.releaseAcceptance,false);
  assert.deepEqual(await readFile(resolve(output,'original-report.json')),originalBytes);
  assert.deepEqual(await readFile(resolve(output,evidence.scriptReceipts[0].file)),js);
  assert.deepEqual(JSON.parse(await readFile(resolve(output,'renderer.cpuprofile'),'utf8')),f.cpu);
  assert.deepEqual(JSON.parse(await readFile(resolve(output,'browser-trace.json'),'utf8')),f.trace);
  const requested=['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing',
   'v8','disabled-by-default-v8.gc','renderer.scheduler','gpu','viz','cc','disabled-by-default-gpu.service'];
  const start=calls.find(call=>call.method==='Tracing.start');assert.ok(start,'always request native tracing despite enumeration');
  assert.deepEqual(start.params,{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',
   traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:262144,includedCategories:requested}});
  assert.deepEqual(evidence.categories.selected,requested);assert.equal(evidence.categories.enumerationAdvisory,true);
  assert.deepEqual(evidence.categories.available,listingError?null:listedCategories);
  assert.equal(evidence.verdict.collectionComplete,!missingTimeline);assert.equal(failures===0,!missingTimeline);
  if(missingTimeline)assert(evidence.verdict.errors.includes('Renderer timeline work does not cover native ride boundaries'));
  if(listingError)assert(evidence.unsupported.some(row=>row.method==='Tracing.getCategories'));
  return evidence;
 }finally{await rm(root,{recursive:true,force:true});}
}
test('empty category enumeration still records and validates actual native trace, CPU and original failed report',async()=>{
 await observerFixture();
});
test('partial or unsupported enumeration never filters required requested categories',async()=>{
 await observerFixture({listedCategories:['gpu']});await observerFixture({listingError:true});
});
test('empty enumeration never excuses missing actual renderer timeline events',async()=>{
 await observerFixture({missingTimeline:true});
});
