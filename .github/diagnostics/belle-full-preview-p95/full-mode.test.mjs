import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {PIN,MARKER_PREFIX,TRACE_CATEGORIES,TRACE_START_PARAMS,sha256,isGameUrl,createTraceSummaryAccumulator,diagnosticVerdict,verifyOriginalVerdict,verifyDriver,verifyPageObservations,verifyTraceControls,verifyDistArchive,REPORT_PATH,ROCKS,buildInventory,verifyPreviewBuild} from './contract.mjs';
import {TRACE_CATEGORIES as UPSTREAM_TRACE_CATEGORIES} from './upstream/contract.mjs';
import {installDesktopStallTrace,installPageEvidence} from './observer.mjs';
import {verifySourceArtifact,onlyBuildTimingChanged} from './build-preview.mjs';
import {buildEmbeddedAssetIndex} from './embedded-assets.mjs';
const driver=await readFile(process.env.STRICT_DRIVER_PATH,'utf8');
const gps=await readFile(process.env.STRICT_GPS_PATH,'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function traceSummary(trace,cpu,page){const a=createTraceSummaryAccumulator(cpu,page);for(const e of trace.traceEvents)a.index(e);a.beginCoverage();for(const e of trace.traceEvents)a.observe(e);return a.finish();}
function fixture(){
 const source={head:PIN.head,tree:PIN.tree,diagnosticBuild:true,failedBuildByteReplay:false,harness:{gitBlob:PIN.harness},
  artifact:{kind:'new-diagnostic-build',zipSha256:'1'.repeat(64)},files:[]};
 const markers=[{label:'profile-start-click',atMs:1000},{label:'first-w-keydown',atMs:1100},{label:'w-keyup',atMs:91108}];
 const page={url:'http://127.0.0.1:1234/?profile=1&locationPerf=1',markers,errors:[],droppedMarkers:0,polyhavenRockReview:'loaded',previewRuntime:{polyhavenRockReview:'loaded'},browserObservations:{startAtMs:1000,endAtMs:91108,firstRafMs:1016,lastRafMs:91099,firstRafInvocationMs:1020,lastRafInvocationMs:91100,rafCallbacks:4000,limit:1024,available:{longtask:true,'long-animation-frame':true},tasks:[],animationFrames:[],rafGaps:[],transitions:[],dropped:{markers:0,tasks:0,animationFrames:0,rafGaps:0,transitions:0}}};
 const trace={traceEvents:[
  ...['Browser','Renderer','GPU Process'].map((name,i)=>({ph:'M',name:'process_name',pid:i+1,args:{name}})),
  {ph:'M',name:'thread_name',pid:2,tid:9,args:{name:'CrRendererMain'}},
  ...markers.map(m=>({name:MARKER_PREFIX+m.label,cat:'blink.user_timing',pid:2,tid:9,ts:1_000_000+m.atMs*1000,ph:'R'})),
  {ph:'X',cat:'gpu',name:'FixtureGpuScope',pid:3,tid:10,ts:4_000_000,dur:100},
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:2_099_950,dur:100},
  {ph:'X',cat:'devtools.timeline',name:'FunctionCall',pid:2,tid:9,ts:90_000_000,dur:349500},
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:92_107_950,dur:100}]};
 const cpu={nodes:[{id:1,callFrame:{functionName:'nativeWork',url:'http://127.0.0.1:1234/assets/game.js',lineNumber:0,columnNumber:0}}],
  samples:[1,1,1,1],timeDeltas:[100_000,600_000,89_900_000,200_000],startTime:1_500_000,endTime:92_500_000};
 const settings={quality:'high',effectiveQuality:'high',pixelRatio:1,adaptiveScale:1,cap:60,world:{performanceDiagnostic:false},diagnosticReduction:false};
 const report={sourceHead:PIN.head,mode:'full',device:'desktop',requestedSeconds:90,renderBackend:'angle-metal',actualGpu:{renderer:'ANGLE Metal Renderer: Apple'},
  passed:false,baselinePassed:false,frameQualityAccepted:false,classification:'stalls-detected',releasePerformanceVerified:false,
  errors:[],failedRequests:[],input:{keydowns:200,keyups:1,heartbeatError:null},gpsRegression:{passed:true},profile:{
   viewport:[1440,900,1],settings:structuredClone(settings),settingsAtStart:structuredClone(settings),frames:3769,movingSeconds:71,distanceMetres:1242,
   stopReason:'trusted-W-keyup',activeSeconds:89.699,excludedSeconds:.3163,over250ms:1,metrics:{frameMs:{p95:48}}}};
 return {source,page,trace,cpu,report,baselineWitness:{boundary:'first-page-url-after-native-w-keyup',errors:[],failedRequests:[]},traceComplete:{dataLossOccurred:false,stream:'raw-stream'},
  stop:{trigger:'native-w-keyup',cpuStopIssued:true,traceEndIssued:true,cpuStopped:true,traceEnded:true}};
}

async function nativeMock({listedCategories=[],listingResponse,listingError=false,missingGpu=false,startFailure=false,missingTimeline=false,cpuFailure=false,endFailure=false,streamFailure=false,badScript=false,deferredCpu=false,browserCloseFailure=null,completion='normal',deferredBrowserClose=false,afterTraceRead=null,deferredAsset=false,embeddedImageIndex=null,extraSourceFiles=[],extraResponses=[]}={}){
 const f=fixture(),root=await mkdtemp(resolve(tmpdir(),'desktop-stall-observer-')),output=resolve(root,'capture'),js=Buffer.from('function nativeWork() {}');
 if(missingTimeline)f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.ph!=='X');
 if(missingGpu)f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.cat!=='gpu');
 f.source.files=[{file:'assets/game.js',bytes:js.length,sha256:sha256(js)},...extraSourceFiles];f.source.embeddedImageIndex=embeddedImageIndex;
 const calls=[];let closed=0,contextClosed=0,cpuResolve,readCount=0,browserCloseResolve,browserCloseEnteredResolve,assetResolve;
 const assetDeferred=new Promise(ok=>{assetResolve=ok;});
 const cpuDeferred=new Promise(ok=>{cpuResolve=ok;});
 const browserCloseDeferred=new Promise(ok=>{browserCloseResolve=ok;}),browserCloseEntered=new Promise(ok=>{browserCloseEnteredResolve=ok;});
 class BrowserSession extends EventEmitter{async send(method,params){
  calls.push({method,params});
  if(method==='Tracing.getCategories'){if(listingError)throw Error('enumeration unavailable');return listingResponse===undefined?{categories:listedCategories}:listingResponse;}
  if(method==='Tracing.start'){assert.equal(this.listenerCount('Tracing.tracingComplete'),1,'Completion observation must precede Tracing.start');if(startFailure)throw Error('native trace start failed');if(completion==='early')this.emit('Tracing.tracingComplete',f.traceComplete);return {};}
  if(method==='Tracing.end'){
   if(endFailure)throw Error('native trace stop failed');
   if(completion!=='deferred')queueMicrotask(()=>{
    this.emit('Tracing.tracingComplete',f.traceComplete);
    if(completion==='duplicate'){this.emit('Tracing.tracingComplete',f.traceComplete);this.emit('Tracing.tracingComplete',{...f.traceComplete,stream:'extra-stream'});}
   });return {};
  }
  if(method==='IO.read'){readCount++;if(streamFailure){if(readCount===1)return {data:'{"traceEvents":[',eof:false};throw Error('raw stream interrupted');}afterTraceRead?.();return {data:JSON.stringify(f.trace),eof:true};}
  return {};
 }}
 const browserSession=new BrowserSession(),pageSession={send:async(method,params)=>{
  calls.push({method,params});
  if(method==='Profiler.stop'){if(deferredCpu)await cpuDeferred;if(cpuFailure)throw Error('native CPU stop failed');return {profile:f.cpu};}
  if(method==='Target.getTargetInfo')return {targetInfo:{type:'page',url:f.page.url,targetId:'original-game'}};
  return {};
 }};
 const context={newCDPSession:async()=>pageSession,close:async()=>{calls.push({method:'native context.close'});contextClosed++;return 'context-closed';}};
 const button={async click(...args){calls.push({method:'native click',args,receiver:this});return 'clicked';}};
 const panel={getByRole(...args){calls.push({method:'native getByRole',args,receiver:this});return button;}};
 const nativeUp=Promise.resolve('released');
 class Page extends EventEmitter{
  keyboard={up:function(...args){calls.push({method:'native keyboard.up',args,receiver:this});return nativeUp;}};
  url(){calls.push({method:'native page.url'});return f.page.url;}
  isClosed(){return false;}async addInitScript(){}context(){return context;}
  locator(...args){calls.push({method:'native locator',args,receiver:this});return panel;}
  async evaluate(){return f.page;}
  async goto(){this.emit('response',{url:()=> 'http://127.0.0.1:1234/assets/game.js',status:()=>200,headers:()=>({'content-type':'application/javascript'}),body:async()=>{if(deferredAsset)await assetDeferred;return badScript?Buffer.from('wrong'):js;}});for(const response of extraResponses)this.emit('response',response);return 'navigated';}
 }
 const browser={newBrowserCDPSession:async()=>browserSession,newPage:async()=>new Page(),close:async()=>{closed++;calls.push({method:'native browser.close'});browserCloseEnteredResolve();if(deferredBrowserClose)await browserCloseDeferred;if(browserCloseFailure)throw browserCloseFailure;return 'browser-closed';}};
 const chromium={launch:async()=>browser};
 const observer=await installDesktopStallTrace(chromium,{game:root,output,source:f.source,driver});
 const launched=await chromium.launch({channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
 await launched.newPage();
 const page=await launched.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});
 assert.equal(await page.goto(f.page.url,{waitUntil:'domcontentloaded'}),'navigated');
 return {f,root,output,observer,calls,browser,page,panel,button,nativeUp,cpuResolve,assetResolve,context,browserSession,browserCloseResolve,browserCloseEntered,
  complete:event=>browserSession.emit('Tracing.tracingComplete',event??f.traceComplete),getCounts:()=>({closed,contextClosed}),
  async capture(){assert.equal(page.locator('#ride-profile'),panel);assert.equal(panel.getByRole('button',{name:'Start 10-minute capture'}),button);
   assert.equal(await button.click(),'clicked');const promise=page.keyboard.up('w');assert.equal(promise,nativeUp);assert.equal(await promise,'released');},
  async finish({closeContext=true}={}){calls.push({method:'original post-ride actions'});page.url();if(closeContext)await context.close();
   const reportPath=resolve(root,'output/sustained-profile/full/desktop/report.json');await mkdir(resolve(root,'output/sustained-profile/full/desktop'),{recursive:true});
   const before=JSON.stringify(f.report);await writeFile(reportPath,before);
   if(browserCloseFailure)await assert.rejects(browser.close(),error=>error===browserCloseFailure);else assert.equal(await browser.close(),'browser-closed');
   assert.equal(await readFile(reportPath,'utf8'),before);
   return JSON.parse(await readFile(resolve(output,'trace-evidence.json'),'utf8'));},
  async cleanup(){await rm(root,{recursive:true,force:true});}
 };
}

test('exact c722 and GPS helper identities, original full URL and original report path',()=>{
 verifyDriver(driver,gps);assert.equal(REPORT_PATH,'output/sustained-profile/full/desktop/report.json');
 for(const url of ['http://127.0.0.1/?profile=1&locationPerf=1','http://127.0.0.1:1234/?locationPerf=1&profile=1'])assert.equal(isGameUrl(url),true);
 for(const url of ['http://127.0.0.1/?profile=1&perfProbe=1','http://127.0.0.1/?profile=manual&locationPerf=1',
  'http://127.0.0.1/?profile=1&locationPerf=1&natureProfile=1','http://127.0.0.1/?profile=1&locationPerf=1&profile=1'])assert.equal(isGameUrl(url),false);
 assert.throws(()=>verifyDriver(driver+'\n',gps));assert.throws(()=>verifyDriver(driver,gps+'\n'));
});

test('source-extracted baseline and full final gates preserve every result without modifying the raw report',()=>{
 for(const baseline of [true,false])for(const gpsPassed of [true,false])for(const afterError of [true,false]){
  const f=fixture(),r=f.report;if(baseline){r.profile.over250ms=0;r.frameQualityAccepted=true;r.baselinePassed=true;r.classification='frame-budget-met';}
  r.gpsRegression.passed=gpsPassed;r.errors=afterError?['later native GPS page error']:[];r.passed=baseline&&gpsPassed&&!afterError;
  const raw=JSON.stringify(r);assert.equal(verifyOriginalVerdict(r,driver,f.baselineWitness),true);assert.equal(JSON.stringify(r),raw);
  const changed=structuredClone(r);changed.passed=!r.passed;assert.throws(()=>verifyOriginalVerdict(changed,driver,f.baselineWitness));
 }
 const f=fixture();assert.throws(()=>verifyOriginalVerdict(f.report,driver,null),/witness/);
 f.report.gpsRegression=null;const raw=JSON.stringify(f.report);assert.throws(()=>verifyOriginalVerdict(f.report,driver,f.baselineWitness),/GPS result absent/);assert.equal(JSON.stringify(f.report),raw);
});

test('baseline error prefix remains distinct from later errors and cannot be silently omitted or reordered',()=>{
 const f=fixture();f.report.profile.over250ms=0;f.report.frameQualityAccepted=true;f.report.classification='frame-budget-met';
 f.report.errors=['during ride','during GPS'];f.baselineWitness.errors=['during ride'];
 assert.equal(verifyOriginalVerdict(f.report,driver,f.baselineWitness),true);
 assert.throws(()=>verifyOriginalVerdict(f.report,driver,{...f.baselineWitness,errors:['during GPS']}),/prefix/);
 assert.throws(()=>verifyOriginalVerdict(f.report,driver,{...f.baselineWitness,errors:[]}),/baseline/);
});

test('full capture stops on exact original native keyup before GPS and keeps all original collection limits',async()=>{
 const h=await nativeMock();try{
  await h.capture();const e=await h.finish();assert.equal(e.verdict.collectionComplete,true,JSON.stringify(e.errors));
  assert.equal(e.verdict.originalBaselinePassed,false);assert.equal(e.verdict.originalGpsPassed,true);assert.equal(e.verdict.originalHarnessPassed,false);assert.equal(e.verdict.releaseAcceptance,false);
  assert.equal(e.stop.trigger,'native-w-keyup');assert.equal(e.traceCompletion.deadlineHostMs-e.stop.hostStartMs,60000);
  assert(h.calls.findIndex(c=>c.method==='Tracing.end')<h.calls.findIndex(c=>c.method==='native page.url'));
  const start=h.calls.find(c=>c.method==='Tracing.start').params;assert.equal(start.traceConfig.recordMode,'recordUntilFull');assert.equal(start.traceConfig.traceBufferSizeInKb,262144);
  assert.deepEqual(start.traceConfig.includedCategories,TRACE_CATEGORIES);assert.equal(h.calls.find(c=>c.method==='Profiler.setSamplingInterval').params.interval,1000);
  assert.deepEqual(start,TRACE_START_PARAMS);assert.deepEqual(e.traceStart.params,start);assert.equal(verifyTraceControls(e).enumerationState,'empty');
  assert.equal(e.summary.gpuCategoryCoverage.observed,true);assert.equal(e.summary.gpuCategoryCoverage.gameRenderer.events,0);assert.equal(e.summary.gpuCategoryCoverage.gpuProcess.events,1);
  assert.deepEqual(e.baselineWitness.errors,[]);assert.equal(e.assetReceipts.length,1);assert.equal(e.assetReceipts[0].complete,true);
  assert.deepEqual(h.getCounts(),{closed:1,contextClosed:1});
 }finally{await h.cleanup();}
});

test('gpu is the sole added literal category and leaves the frozen seven-category upstream export untouched',()=>{
 const original=['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing','v8','disabled-by-default-v8.gc','renderer.scheduler'];
 assert.deepEqual(UPSTREAM_TRACE_CATEGORIES,original);assert.deepEqual(TRACE_CATEGORIES,[...original,'gpu']);
 assert(Object.isFrozen(UPSTREAM_TRACE_CATEGORIES)&&Object.isFrozen(TRACE_CATEGORIES));
 assert.deepEqual(TRACE_START_PARAMS,{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',bufferUsageReportingInterval:1000,
  traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:262144,includedCategories:[...original,'gpu']}});
});

test('raw launch enumeration remains advisory including empty, malformed, extra categories and actual errors',async()=>{
 for(const example of [
  {options:{},state:'empty',response:{categories:[]}},
  {options:{listedCategories:['gpu','other.extra']},state:'listed',response:{categories:['gpu','other.extra']}},
  {options:{listedCategories:['toplevel']},state:'listed',response:{categories:['toplevel']}},
  {options:{listingResponse:{categories:['gpu',null],extra:{retained:1}}},state:'malformed',response:{categories:['gpu',null],extra:{retained:1}}},
  {options:{listingResponse:{unexpected:'missing list'}},state:'malformed',response:{unexpected:'missing list'}},
  {options:{listingResponse:null},state:'malformed',response:null},
  {options:{listingError:true},state:'error',response:null},
 ]){
  const h=await nativeMock(example.options);try{
   await h.capture();const e=await h.finish(),controls=verifyTraceControls(e);
   assert.equal(e.verdict.collectionComplete,true,JSON.stringify(e.errors));assert.equal(controls.enumerationState,example.state);
   assert.deepEqual(e.categories.query.response,example.response);assert.equal(h.calls.filter(c=>c.method==='Tracing.getCategories').length,1);
   assert(h.calls.findIndex(c=>c.method==='Tracing.getCategories')<h.calls.findIndex(c=>c.method==='Target.getTargetInfo'));
   assert.equal(e.categories.query.responseReceived,example.state!=='error');
   if(example.state==='error')assert(e.categories.query.error.includes('enumeration unavailable'));
   assert.equal(e.verdict.originalHarnessPassed,false);assert.equal(e.verdict.originalGpsPassed,true);
  }finally{await h.cleanup();}
 }
});

test('recorded categories, actual start parameters and host ordering are independently validated',async()=>{
 const h=await nativeMock();try{await h.capture();const e=await h.finish();verifyTraceControls(e);
  for(const mutate of [x=>x.categories.requested.push('gpu.service'),x=>x.categories.available.push('gpu'),x=>x.categories.gpuAdvertised=true,
   x=>delete x.categories.query.response,x=>x.categories.query.finishedHostMs=x.categories.query.startedHostMs-1,
   x=>x.traceStart.params.traceConfig.includedCategories.pop(),x=>x.traceStart.params.traceConfig.traceBufferSizeInKb++,
   x=>x.traceStart.params.streamCompression='gzip',x=>x.traceStart.completed=false,x=>x.traceStart.error='unreported failure',x=>delete x.traceStart.response,
   x=>x.traceStart.finishedHostMs=x.arm.hostReadyMs+1,x=>x.arm.intervalUs=999]){
   const changed=structuredClone(e);mutate(changed);assert.throws(()=>verifyTraceControls(changed));
  }
 }finally{await h.cleanup();}
});

test('actual literal gpu events prove only category coverage on either mapped role and retain raw phases and IDs',()=>{
 const f=fixture();f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.cat!=='gpu');
 const scopes=[
  {ph:'B',cat:'gpu,toplevel.flow',name:'FixtureBegin',pid:2,tid:9,ts:3_000_000,id:'raw-begin'},
  {ph:'E',cat:'gpu',pid:2,tid:9,ts:3_000_001,id:'raw-end'},
  {ph:'s',cat:'gpu,toplevel.flow',name:'FixtureFlow',pid:2,tid:9,ts:3_000_002,id2:{global:'unchanged-1'}},
  {ph:'f',cat:'gpu,toplevel.flow',name:'FixtureFlow',pid:2,tid:9,ts:3_000_003,id2:{global:'unchanged-1'}},
 ];
 f.trace.traceEvents.push(...scopes);const before=JSON.stringify(f.trace);let summary=traceSummary(f.trace,f.cpu,f.page);
 assert.equal(summary.gpuCategoryCoverage.observed,true);assert.equal(summary.gpuCategoryCoverage.gameRenderer.events,4);assert.equal(summary.gpuCategoryCoverage.gpuProcess.events,0);
 assert.deepEqual(summary.gpuCategoryCoverage.gameRenderer.phases,{B:1,E:1,s:1,f:1});assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,true);
 assert.equal(JSON.stringify(f.trace),before,'Coverage must not reconstruct or rewrite any raw phase/ID');
 f.trace.traceEvents=f.trace.traceEvents.filter(e=>!scopes.includes(e));f.trace.traceEvents.push({...scopes[0],pid:3,tid:10});summary=traceSummary(f.trace,f.cpu,f.page);
 assert.equal(summary.gpuCategoryCoverage.gameRenderer.events,0);assert.equal(summary.gpuCategoryCoverage.gpuProcess.events,1);
 assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,true,'No renderer wait occurrence is required');
});

test('metadata, nonliteral categories, unrelated processes and out-of-window or malformed events cannot certify gpu coverage',()=>{
 const valid={ph:'X',cat:'gpu',name:'FixtureGpu',pid:3,tid:10,ts:4_000_000,dur:100};
 for(const changes of [{cat:'gpu.service'},{cat:'disabled-by-default-gpu.service'},{cat:'xgpu'},{ph:'M'},{ph:'?'},{pid:99},{tid:NaN},{ts:NaN},
  {ts:2_099_999},{ts:92_108_000},{dur:-1},{dur:NaN}]){
  const f=fixture();f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.cat!=='gpu');f.trace.traceEvents.push({...valid,...changes});
  const summary=traceSummary(f.trace,f.cpu,f.page),verdict=diagnosticVerdict({...f,summary});
  assert.equal(summary.gpuCategoryCoverage.observed,false,JSON.stringify(changes));assert.equal(verdict.collectionComplete,false);
  assert(verdict.errors.some(error=>error.includes('GPU category coverage unsupported')));
 }
 const f=fixture();f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.cat!=='gpu');f.trace.traceEvents.push({...valid,ts:2_100_000});
 assert.equal(traceSummary(f.trace,f.cpu,f.page).gpuCategoryCoverage.observed,true,'Trusted start is inclusive; end is exclusive');
});

test('zero gpu coverage or trace-start failure preserves original native W, GPS, report and failure priority',async()=>{
 for(const options of [{missingGpu:true},{startFailure:true}]){
  const h=await nativeMock(options);try{
   const before=JSON.stringify(h.f.report);await h.capture();const e=await h.finish();
   assert.equal(e.verdict.collectionComplete,false);assert.equal(e.verdict.originalHarnessPassed,false);assert.equal(e.verdict.originalGpsPassed,true);
   assert.equal(JSON.stringify(h.f.report),before);assert.equal(h.calls.filter(c=>c.method==='native keyboard.up').length,1);
   assert(h.calls.some(c=>c.method==='original post-ride actions'));assert(h.calls.some(c=>c.method==='native page.url'));assert.deepEqual(h.getCounts(),{closed:1,contextClosed:1});
   if(options.missingGpu){assert.equal(e.traceFlushed,true);assert.deepEqual(JSON.parse(await readFile(resolve(h.output,'browser-trace.json'),'utf8')),h.f.trace);
    assert(e.verdict.errors.some(error=>error.includes('GPU category coverage unsupported')));}
   else{assert.equal(e.traceStart.completed,false);assert(e.traceStart.error.includes('native trace start failed'));assert(e.errors.some(error=>error.includes('Tracing.start')));}
  }finally{await h.cleanup();}
 }
});

test('pre-GPS witness observes original error order; the full result preserves a later GPS failure',async()=>{
 const h=await nativeMock();try{
  h.f.report.profile.over250ms=0;h.f.report.frameQualityAccepted=true;h.f.report.classification='frame-budget-met';h.f.report.baselinePassed=true;
  await h.capture();h.page.url();h.page.emit('console',{type:()=> 'error',text:()=> 'later native GPS page error'});
  h.f.report.errors.push('later native GPS page error');h.f.report.passed=false;
  const e=await h.finish();assert.equal(e.verdict.collectionComplete,true,JSON.stringify(e.errors));assert.deepEqual(e.baselineWitness.errors,[]);
  assert.equal(e.verdict.originalBaselinePassed,true);assert.equal(e.verdict.originalHarnessPassed,false);
 }finally{await h.cleanup();}
});

test('any truncated page observations invalidate complete attribution while raw data remains',async()=>{
 for(const kind of ['tasks','animationFrames','rafGaps','transitions']){
  const h=await nativeMock();try{h.f.page.browserObservations.dropped[kind]=1;await h.capture();const e=await h.finish();
   assert.equal(e.verdict.collectionComplete,false);assert.equal(e.pageEvidence.browserObservations.dropped[kind],1);
   assert(e.errors.some(s=>s.includes('Bounded observer overflow')));assert.equal(e.traceFlushed,true);
  }finally{await h.cleanup();}
 }
});

test('full mode and preview identity failures remain separate from original process outcome',async()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page);assert.equal(diagnosticVerdict({...f,summary}).collectionComplete,true);
 for(const mutate of [x=>x.report.mode='diagnostic',x=>x.report.profile.settings.diagnosticReduction=true,
  x=>x.report.profile.settingsAtStart.world.performanceDiagnostic=true,x=>x.source.failedBuildByteReplay=true,x=>x.report.gpsRegression=null]){
  const bad=fixture();mutate(bad);assert.equal(diagnosticVerdict({...bad,summary}).collectionComplete,false);
 }
 const h=await nativeMock();try{h.f.page.polyhavenRockReview=null;await h.capture();const e=await h.finish();
  assert.equal(e.verdict.collectionComplete,false);assert.equal(e.verdict.originalHarnessPassed,false);assert(e.errors.some(s=>s.includes('Preview')));
 }finally{await h.cleanup();}
});

test('sixty-second timeout, late raw data and original native closure remain unchanged in full mode',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=await nativeMock({completion:'deferred',deferredBrowserClose:true});
 try{await h.capture();await h.observer.stop('must-not-replace-native-trigger');const finished=h.finish();await tick();
  t.mock.timers.tick(59000);await tick();assert.equal(h.getCounts().contextClosed,0);
  t.mock.timers.tick(1000);await h.browserCloseEntered;assert.equal(h.getCounts().contextClosed,1);
  h.complete();h.browserCloseResolve();const e=await finished;
  assert.equal(e.traceCompletion.events[0].phase,'after-deadline');assert.equal(e.verdict.collectionComplete,false);
  assert(e.errors.some(x=>x.includes('Timeline flush timed out')));assert(e.errors.some(x=>x.includes('unchanged 60-second deadline')));
  assert.equal(e.traceFlushed,true);assert.equal(e.verdict.originalHarnessPassed,false);
 }finally{h.browserCloseResolve();await h.cleanup();}
});

test('exact-candidate source-art receipt is pinned independently from reconstructed dist',()=>{
 const metadata={id:PIN.sourceArtifactId,name:'polyhaven-opaque-review',expired:false,size_in_bytes:PIN.sourceArtifactBytes,
  workflow_run:{id:PIN.sourceArtifactRun,head_sha:PIN.head},digest:'sha256:'+PIN.sourceArtifactSha256};verifySourceArtifact(metadata);
 for(const mutate of [x=>x.expired=true,x=>x.workflow_run.head_sha='b80',x=>x.digest='sha256:wrong',x=>x.size_in_bytes--,x=>x.id--]){
  const bad=structuredClone(metadata);mutate(bad);assert.throws(()=>verifySourceArtifact(bad));}
 assert.equal(onlyBuildTimingChanged('{"buildMs":1,"boxes":46034}','{"buildMs":2,"boxes":46034}'),true);
 assert.throws(()=>onlyBuildTimingChanged('{"buildMs":1,"boxes":46034}','{"buildMs":2,"boxes":46035}'));
});

test('compiled preview requires all original three GLB hashes and rejects injected manual marker',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'full-preview-contract-'));try{
  await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/main.js'),'compiled preview test');
  await writeFile(resolve(root,'index.html'),'<script src="./assets/main.js"></script>');
  await writeFile(resolve(root,'asset-manifest.json'),JSON.stringify(ROCKS.map(x=>'belle/polyhaven-review/'+x.file)));
  const files=[...await buildInventory(root),...ROCKS.map(x=>({file:'belle/polyhaven-review/'+x.file,bytes:x.bytes,sha256:x.sha256}))];
  await verifyPreviewBuild(root,files);const altered=structuredClone(files);altered.at(-1).sha256='0'.repeat(64);await assert.rejects(verifyPreviewBuild(root,altered));
  await assert.rejects(verifyPreviewBuild(root,[...files,{file:'__belle_test_build.json',bytes:0,sha256:'0'.repeat(64)}]),/injected/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('missing or malformed page observations cannot pass merely with valid clock markers',()=>{
 const f=fixture();assert.equal(verifyPageObservations(f.page),true);
 for(const mutate of [p=>delete p.browserObservations,p=>delete p.browserObservations.dropped,
  p=>delete p.browserObservations.dropped.rafGaps,p=>p.browserObservations.dropped.tasks=-1,p=>p.browserObservations.dropped.tasks=NaN,
  p=>delete p.browserObservations.tasks,p=>delete p.browserObservations.available,p=>p.browserObservations.rafCallbacks=0]){
  const bad=structuredClone(f.page);mutate(bad);assert.throws(()=>verifyPageObservations(bad));}
 const unavailable=structuredClone(f.page);unavailable.browserObservations.available={longtask:false,'long-animation-frame':false};assert.equal(verifyPageObservations(unavailable),true);
});

test('timely tracingComplete cannot hide a raw flush after the absolute deadline; all bytes survive',async t=>{
 let now=100;t.mock.method(performance,'now',()=>now);
 const h=await nativeMock({afterTraceRead:()=>{now=60101;}});try{
  await h.capture();const e=await h.finish();assert.equal(e.traceCompletion.events[0].phase,'after-stop');
  assert.equal(e.traceStreams[0].deadlineExceeded,true);assert.equal(e.verdict.collectionComplete,false);assert.equal(e.traceFlushed,true);
  assert(e.errors.some(x=>x.includes('Raw trace flush completed after')));
  assert.deepEqual(JSON.parse(await readFile(resolve(h.output,'browser-trace.json'),'utf8')),h.f.trace);
 }finally{await h.cleanup();}
});

test('an asset write that finishes after the absolute deadline is a retained failure',async t=>{
 let now=100;t.mock.method(performance,'now',()=>now);
 const h=await nativeMock({deferredAsset:true});try{
  await h.capture();await tick();now=h.observer.evidence.traceCompletion.deadlineHostMs+1;h.assetResolve();
  const e=await h.finish(),asset=e.assetReceipts[0];assert.equal(asset.deadlineExceeded,true);assert.equal(asset.complete,false);assert.equal(e.verdict.collectionComplete,false);
  assert(asset.file&&asset.sha256);assert.equal(sha256(await readFile(resolve(h.output,asset.file))),asset.sha256);
 }finally{h.assetResolve();await h.cleanup();}
});

test('native response observation binds real embedded-image bytes and retains unknown or mismatched blob bodies as failures',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'embedded-observer-fixture-'));
 try{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  const text=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:png.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:png.length}],images:[{bufferView:0,mimeType:'image/png'}]}));
  const json=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(json);const bin=Buffer.alloc(Math.ceil(png.length/4)*4);png.copy(bin);
  const glb=Buffer.alloc(12+8+json.length+8+bin.length);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(json.length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);const at=20+json.length;
  glb.writeUInt32LE(bin.length,at);glb.writeUInt32LE(0x004e4942,at+4);bin.copy(glb,at+8);
  const js=Buffer.from('function nativeWork() {}');await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/game.js'),js);await writeFile(resolve(root,'image.glb'),glb);
  const glbRow={file:'image.glb',bytes:glb.length,sha256:sha256(glb)};
  const index=await buildEmbeddedAssetIndex(root,[{file:'assets/game.js',bytes:js.length,sha256:sha256(js)},glbRow]);
  const changed=Buffer.from(png);changed[changed.length-1]^=1;
  for(const row of [
   {name:'valid',url:'blob:http://127.0.0.1:1234/valid',payload:png,mime:'image/png',pass:true,read:true},
   {name:'unknown bytes',url:'blob:http://127.0.0.1:1234/unknown',payload:changed,mime:'image/png',pass:false,read:true},
   {name:'wrong MIME',url:'blob:http://127.0.0.1:1234/mime',payload:png,mime:'image/jpeg',pass:false,read:true},
   {name:'different port',url:'blob:http://127.0.0.1:4321/foreign',payload:png,mime:'image/png',pass:false,read:false},
  ]){
   let bodyReads=0;const response={url:()=>row.url,status:()=>200,headers:()=>({'content-type':row.mime}),body:async()=>{bodyReads++;return row.payload;}};
   const h=await nativeMock({embeddedImageIndex:index,extraSourceFiles:[glbRow],extraResponses:[response]});
   try{
    await h.capture();const e=await h.finish(),receipt=e.assetReceipts.find(x=>x.url===row.url);
    assert.equal(e.gameUrl,h.f.page.url);assert.equal(bodyReads,row.read?1:0,row.name);assert.equal(receipt.complete,row.pass,row.name);
    assert.equal(e.verdict.collectionComplete,row.pass,row.name);assert.equal(e.originalHarnessPassed,undefined);
    if(row.read){assert.equal(receipt.bytes,row.payload.length);assert.equal(receipt.sha256,sha256(row.payload));assert.deepEqual(await readFile(resolve(h.output,receipt.file)),row.payload);}
    if(row.pass){assert.equal(receipt.kind,'embedded-blob');assert.deepEqual(receipt.embeddedMatches,index.candidates);assert(receipt.bindingFinishedHostMs>=receipt.bodyFinishedHostMs);}
    else assert(receipt.error&&e.errors.length>0,row.name);
    assert.equal(e.verdict.originalHarnessPassed,false,'The original failed performance verdict is never replaced by collection success');
   }finally{await h.cleanup();}
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

test('retained dist archive is checked by every member byte, not only its ZIP hash',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'preview-dist-archive-'));try{
  const zip=resolve(root,'dist.zip');execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('index.html','index'); z.writestr('assets/main.js','main'); z.close()",zip]);
  const files=[{file:'index.html',bytes:5,sha256:sha256('index')},{file:'assets/main.js',bytes:4,sha256:sha256('main')}];
  assert.equal(verifyDistArchive(zip,files),true);assert.throws(()=>verifyDistArchive(zip,files.slice(0,1)));
  const changed=structuredClone(files);changed[1].sha256='0'.repeat(64);assert.throws(()=>verifyDistArchive(zip,changed));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('full page observer keeps native trusted boundaries and explicitly marks a focus-changing RAF gap',()=>{
 let at=1000,rafId=0,cancelled=0,taskCallback;const listeners={},windowListeners={},marks=new Map(),frames=[];
 const perf={now:()=>at,timeOrigin:100000,mark:name=>marks.set(name,{startTime:at}),getEntriesByName:name=>marks.has(name)?[marks.get(name)]:[]};
 const win={addEventListener:(kind,fn)=>{windowListeners[kind]=fn;}};
 const document={hidden:false,hasFocus:()=>true,documentElement:{dataset:{polyhavenRockReview:'loaded'}},addEventListener:(kind,fn)=>{(listeners[kind]??=[]).push(fn);}};
 const requestAnimationFrame=fn=>{frames.push(fn);return ++rafId;};
 class PagePerformanceObserver{static supportedEntryTypes=['longtask'];constructor(callback){taskCallback=callback;}observe(){}takeRecords(){return [];}disconnect(){}}
 const context={window:win,location:{hostname:'127.0.0.1',pathname:'/',search:'?profile=1&locationPerf=1',href:fixture().page.url},URLSearchParams,
  performance:perf,innerWidth:1440,innerHeight:900,devicePixelRatio:1,Date,PerformanceObserver:PagePerformanceObserver,document,requestAnimationFrame,cancelAnimationFrame:()=>cancelled++};
 vm.runInNewContext('('+installPageEvidence.toString()+')({prefix:'+JSON.stringify(MARKER_PREFIX)+'})',context);
 const fire=(kind,event)=>listeners[kind].forEach(fn=>fn(event));
 fire('click',{isTrusted:true,target:{closest:()=>({textContent:'Start 10-minute capture'})}});
 taskCallback({getEntries:()=>[{startTime:900,duration:100,name:'ends-at-boundary'},{startTime:950,duration:100,name:'crosses-boundary'}]});
 at=1100;fire('keydown',{isTrusted:false,code:'KeyW'});fire('keydown',{isTrusted:true,code:'KeyW'});frames.shift()(990);
 at=1120;windowListeners.blur();at=1166;frames.shift()(1166);at=91108;fire('keyup',{isTrusted:true,code:'KeyW'});
 const page=JSON.parse(JSON.stringify(win.__belleDesktopStallEvidence()));assert.equal(verifyPageObservations(page),true);
 assert.equal(page.browserObservations.rafGaps.length,1);assert.equal(page.browserObservations.rafGaps[0].durationMs,176);assert.equal(page.browserObservations.rafGaps[0].boundaryChanged,true);
 assert(page.browserObservations.firstRafMs<page.browserObservations.startAtMs);assert(page.browserObservations.firstRafInvocationMs>=page.browserObservations.startAtMs);
 assert.deepEqual(page.markers,fixture().page.markers);assert.equal(cancelled,1);assert.equal(context.requestAnimationFrame,requestAnimationFrame);
 assert.equal(page.browserObservations.available.longtask,true);assert.equal(page.browserObservations.available['long-animation-frame'],false);
 assert.deepEqual(page.browserObservations.tasks,[{startTimeMs:950,durationMs:100,name:'crosses-boundary'}]);
});

