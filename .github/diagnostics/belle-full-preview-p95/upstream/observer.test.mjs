import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {PIN,MARKER_PREFIX,TRACE_CATEGORIES,gitBlob,sha256,isGameUrl,traceSummary,diagnosticVerdict,
 verifyOriginalVerdict,verifyArtifactMetadata,buildInventory,combinedExit} from './contract.mjs';
import {observeSync,observeAsync,observeCompletion,installPageEvidence,installDesktopStallTrace,drainTraceStream} from './observer.mjs';

assert(process.env.STRICT_DRIVER_PATH,'Set STRICT_DRIVER_PATH to the unchanged original driver');
const driver=await readFile(process.env.STRICT_DRIVER_PATH,'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const source={head:PIN.head,tree:PIN.tree,candidate:PIN.candidate,harness:{gitBlob:PIN.harness},
  artifact:{id:PIN.artifactId,zipSha256:PIN.artifactSha256},files:[]};
 const markers=[{label:'profile-start-click',atMs:1000},{label:'first-w-keydown',atMs:1100},{label:'w-keyup',atMs:91108}];
 const page={url:'http://127.0.0.1:1234/?profile=1&perfProbe=1',markers,errors:[],droppedMarkers:0};
 const trace={traceEvents:[
  ...['Browser','Renderer','GPU Process'].map((name,i)=>({ph:'M',name:'process_name',pid:i+1,args:{name}})),
  {ph:'M',name:'thread_name',pid:2,tid:9,args:{name:'CrRendererMain'}},
  ...markers.map(m=>({name:MARKER_PREFIX+m.label,cat:'blink.user_timing',pid:2,tid:9,ts:1_000_000+m.atMs*1000,ph:'R'})),
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:2_099_950,dur:100},
  {ph:'X',cat:'devtools.timeline',name:'FunctionCall',pid:2,tid:9,ts:90_000_000,dur:349500},
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:92_107_950,dur:100}]};
 const cpu={nodes:[{id:1,callFrame:{functionName:'nativeWork',url:'http://127.0.0.1:1234/assets/game.js',lineNumber:0,columnNumber:0}}],
  samples:[1,1,1,1],timeDeltas:[100_000,600_000,89_900_000,200_000],startTime:1_500_000,endTime:92_500_000};
 const settings={quality:'high',effectiveQuality:'high',pixelRatio:1,adaptiveScale:1,cap:60,world:{performanceDiagnostic:true},diagnosticReduction:true};
 const report={sourceHead:PIN.head,mode:'diagnostic',device:'desktop',requestedSeconds:90,renderBackend:'angle-metal',actualGpu:{renderer:'ANGLE Metal Renderer: Apple'},
  passed:false,baselinePassed:false,frameQualityAccepted:false,classification:'stalls-detected',releasePerformanceVerified:false,
  errors:[],failedRequests:[],input:{keydowns:200,keyups:1,heartbeatError:null},gpsRegression:null,profile:{
   viewport:[1440,900,1],settings:structuredClone(settings),settingsAtStart:structuredClone(settings),frames:3769,movingSeconds:71,distanceMetres:1242,
   stopReason:'trusted-W-keyup',activeSeconds:89.699,excludedSeconds:.3163,over250ms:1,metrics:{frameMs:{p95:48}}}};
 return {source,page,trace,cpu,report,traceComplete:{dataLossOccurred:false,stream:'raw-stream'},
  stop:{trigger:'native-w-keyup',cpuStopIssued:true,traceEndIssued:true,cpuStopped:true,traceEnded:true}};
}

test('exact original driver and gate decisions remain unchanged, including nonzero exits',()=>{
 assert.equal(gitBlob(Buffer.from(driver)),PIN.harness);const f=fixture(),before=JSON.stringify(f.report);
 assert.equal(verifyOriginalVerdict(f.report,driver),true);assert.equal(JSON.stringify(f.report),before);
 for(const change of [r=>r.passed=true,r=>r.baselinePassed=true,r=>r.frameQualityAccepted=true,r=>r.releasePerformanceVerified=true]){
  const broken=fixture().report;change(broken);assert.throws(()=>verifyOriginalVerdict(broken,driver));
 }
 assert.equal(combinedExit(23,1),23);assert.equal(combinedExit(0,1),1);assert.equal(combinedExit(1,0),1);assert.equal(combinedExit(0,0),0);
});

test('synchronous factories preserve exact return identity, receiver, arguments and thrown errors',()=>{
 const token={},result={},nativeError=Error('native factory'),observerError=Error('observer'),errors=[];
 const owner={factory(value){assert.equal(this,owner);assert.equal(value,token);return result;}};
 const descriptor=Object.getOwnPropertyDescriptor(owner,'factory');
 const restore=observeSync(owner,'factory',{after:value=>{assert.equal(value,result);throw observerError;},onError:error=>errors.push(error)});
 assert.equal(owner.factory(token),result);assert.deepEqual(errors,[observerError]);restore();assert.deepEqual(Object.getOwnPropertyDescriptor(owner,'factory'),descriptor);
 owner.factory=()=>{throw nativeError;};observeSync(owner,'factory',{after:()=>assert.fail('Must not observe a failed native factory')});
 assert.throws(()=>owner.factory(),error=>error===nativeError);
 const inherited=Object.create({factory(){return result;}});const undo=observeSync(inherited,'factory');assert.equal(inherited.factory(),result);undo();assert.equal(Object.hasOwn(inherited,'factory'),false);
 const undoAgain=observeSync(inherited,'factory');const replacement=()=>{};inherited.factory=replacement;undoAgain();assert.equal(inherited.factory,replacement);
});

test('native click keeps receiver, arguments, fulfillment and error while observation failures remain separate',async()=>{
 const token={},result={},calls=[],nativeError=Error('native click'),observerError=Error('setup'),errors=[];
 const owner={async click(value){assert.equal(this,owner);assert.equal(value,token);calls.push('native');return result;}};
 observeAsync(owner,'click',{before:()=>{calls.push('before');throw observerError;},after:()=>{calls.push('after');throw observerError;},onError:error=>errors.push(error)});
 assert.equal(await owner.click(token),result);assert.deepEqual(calls,['before','native','after']);assert.deepEqual(errors,[observerError,observerError]);
 owner.click=async()=>{throw nativeError;};observeAsync(owner,'click',{before:()=>{throw observerError;}});
 await assert.rejects(owner.click(),error=>error===nativeError);
});

test('keyup observer returns the same native promise and preserves rejection without input substitution',async()=>{
 const token={},result={},nativeError=Error('native up'),observerError=Error('stop'),errors=[];let release,calls=0;
 const native=new Promise(ok=>{release=ok;});
 const owner={up(value){calls++;assert.equal(this,owner);assert.equal(value,token);return native;}};
 observeCompletion(owner,'up',{after:()=>{throw observerError;},onError:error=>errors.push(error)});
 const actual=owner.up(token);assert.equal(actual,native);assert.equal(calls,1);release(result);assert.equal(await actual,result);await tick();assert.deepEqual(errors,[observerError]);
 const rejected=Promise.reject(nativeError);owner.up=()=>rejected;const seen=[];observeCompletion(owner,'up',{onRejected:error=>seen.push(error)});
 assert.equal(owner.up(),rejected);await assert.rejects(rejected,error=>error===nativeError);await tick();assert.deepEqual(seen,[nativeError]);
 owner.up=()=>{throw nativeError;};observeCompletion(owner,'up');assert.throws(()=>owner.up(),error=>error===nativeError);
});

test('raw stream read/write, file-close and CDP-close errors remain separate and cleanup always runs',async()=>{
 const readError=Error('read'),fileError=Error('file close'),handleError=Error('handle close'),errors=[],calls=[];
 const session={async send(method){calls.push(method);throw method==='IO.read'?readError:handleError;}};
 const writer={async writeFile(){},async close(){throw fileError;}};
 const result=await drainTraceStream(session,'stream','unused',(where,error)=>errors.push({where,error}),async()=>writer);
 assert.equal(result.complete,false);assert.deepEqual(calls,['IO.read','IO.close']);assert.deepEqual(errors.map(e=>e.error),[readError,fileError,handleError]);
 const openError=Error('open'),openErrors=[];calls.length=0;
 const opened=await drainTraceStream(session,'stream','unused',(where,error)=>openErrors.push(error),async()=>{throw openError;});
 assert.equal(opened.complete,false);assert.deepEqual(calls,['IO.close']);assert.deepEqual(openErrors,[openError,handleError]);
});

test('native page evidence requires trusted input and does not replace native clocks or input',()=>{
 let at=1000,requests=0,cancelled=0;const events={},marks=new Map(),win={};
 const performance={now:()=>at,timeOrigin:100000,mark:name=>marks.set(name,{startTime:at}),getEntriesByName:name=>marks.has(name)?[marks.get(name)]:[]};
 const nativeMark=performance.mark;
 const context={window:win,location:{hostname:'127.0.0.1',pathname:'/',search:'?profile=1&perfProbe=1',href:fixture().page.url},URLSearchParams,
  performance,innerWidth:1440,innerHeight:900,devicePixelRatio:1,Date,PerformanceObserver:{supportedEntryTypes:[]},
  document:{addEventListener:(name,fn)=>{events[name]=fn;}},requestAnimationFrame:()=>++requests,cancelAnimationFrame:()=>cancelled++};
 vm.runInNewContext('('+installPageEvidence.toString()+')({prefix:'+JSON.stringify(MARKER_PREFIX)+'})',context);
 const click={isTrusted:true,target:{closest:()=>({textContent:'Start 10-minute capture'})}};events.click(click);
 at=1090;events.keydown({isTrusted:false,code:'KeyW'});at=1100;events.keydown({isTrusted:true,code:'KeyW'});
 at=1200;events.keyup({isTrusted:false,code:'KeyW'});at=91108;events.keyup({isTrusted:true,code:'KeyW'});
 const evidence=JSON.parse(JSON.stringify(win.__belleDesktopStallEvidence()));assert.deepEqual(evidence.markers,fixture().page.markers);
 assert.equal(evidence.browserObservations.endAtMs-evidence.markers[1].atMs,90008);assert.equal(performance.mark,nativeMark);assert.equal(requests,1);assert.equal(cancelled,1);
});

test('real emitted renderer events and actual signed CPU samples cover native boundaries',()=>{
 const f=fixture(),s=traceSummary(f.trace,f.cpu,f.page);assert.deepEqual(s.errors,[]);assert.equal(s.nativeRide.durationMs,90008);
 assert.equal(s.rendererTimeline.events,3);assert.equal(s.cpuCoverage.rideSamples,2);assert.equal(s.longEvents[0].dur,349500);
 const mutations=[
  x=>x.trace.traceEvents=x.trace.traceEvents.filter(e=>e.ph!=='X'),
  x=>x.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.pid=3),
  x=>x.trace.traceEvents.find(e=>e.name==='process_name'&&e.pid===2).args.name='GPU Process',
  x=>x.page.markers[1].atMs+=20,x=>x.page.markers.push({...x.page.markers[0]}),x=>x.page.droppedMarkers=1,
  x=>x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'w-keyup').tid=10,
  x=>x.page.url='http://127.0.0.1:1234/?profile=1&locationPerf=1',
  x=>x.cpu.samples[0]=999,x=>x.cpu.timeDeltas[0]=NaN,x=>x.cpu.samples=[],
  x=>x.cpu.timeDeltas[3]=7000, // Header covers release, but last actual sample does not.
 ];
 for(const mutate of mutations){const bad=fixture();mutate(bad);assert(traceSummary(bad.trace,bad.cpu,bad.page).errors.length);}
 const signed=fixture();signed.cpu.samples=[1,1,1,1,1];signed.cpu.timeDeltas=[100000,600000,-4,89900004,200000];
 const actual=traceSummary(signed.trace,signed.cpu,signed.page);assert.deepEqual(actual.errors,[]);assert.equal(actual.cpuCoverage.negativeDeltas,1);assert.equal(signed.cpu.timeDeltas[2],-4);
});

test('bf2 positive-duration and native-process observations remain stronger than metadata alone',()=>{
 const f=fixture();
 f.trace.traceEvents.push(
  {ph:'X',cat:'toplevel',name:'BrowserTask',pid:1,tid:10,ts:3_000_000,dur:1000},
  {ph:'X',cat:'gpu',name:'GpuTask',pid:3,tid:11,ts:4_000_000,dur:2000});
 const summary=traceSummary(f.trace,f.cpu,f.page);assert.deepEqual(summary.errors,[]);
 assert.equal(summary.nativeActivity.browser.events,1);assert.equal(summary.nativeActivity.browser.durationEvents,1);
 assert.equal(summary.nativeActivity.gpu.events,1);assert.equal(summary.nativeActivity.gpu.maximumDurationUs,2000);
 assert.equal(summary.categoryEvidence.gameRendererTimelineEvents,2);
 assert.equal(summary.cpuCoverage.unknownNodes,0);assert.equal(summary.cpuCoverage.samplesOutsideProfileBounds,0);
 const zero=fixture();zero.trace.traceEvents.filter(e=>e.ph==='X').forEach(e=>e.dur=0);
 assert(traceSummary(zero.trace,zero.cpu,zero.page).errors.some(s=>s.includes('Renderer timeline')));
 const absent=traceSummary(fixture().trace,f.cpu,f.page);assert.equal(absent.nativeActivity.gpu.events,0);
 assert.match(absent.nativeActivity.gpu.limitation,/metadata alone is not coverage/);
});

test('collection completeness never clears the failed ride or accepts a shorter native window',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page),v=diagnosticVerdict({...f,summary});
 assert.equal(v.collectionComplete,true);assert.equal(v.originalHarnessPassed,false);assert.equal(v.originalP95Ms,48);assert.equal(v.originalIntervalsOver250ms,1);assert.equal(v.releaseAcceptance,false);
 for(const mutate of [x=>x.source.harness.gitBlob='wrong',x=>x.source.artifact.zipSha256='wrong',x=>x.report.sourceHead='old',
  x=>x.report.mode='full',x=>x.report.profile.settings.cap=30,x=>x.report.profile.settingsAtStart.quality='smooth',
  x=>x.report.profile.settings.world.performanceDiagnostic=false,x=>x.report.actualGpu.renderer='SwiftShader',
  x=>x.traceComplete.dataLossOccurred=true,x=>delete x.traceComplete.dataLossOccurred,x=>x.stop.trigger='browser-close-fallback',x=>x.stop.cpuStopped=false]){
  const bad=fixture();mutate(bad);assert.equal(diagnosticVerdict({...bad,summary}).collectionComplete,false);
 }
 f.report.profile.activeSeconds=95;f.report.profile.excludedSeconds=5;f.page.markers[2].atMs=91099;
 f.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'w-keyup').ts=92_099_000;
 const short=traceSummary(f.trace,f.cpu,f.page);assert.deepEqual(short.errors,[]);assert.equal(short.nativeRide.durationMs,89999);
 assert.equal(diagnosticVerdict({...f,summary:short}).collectionComplete,false);
 assert.equal(isGameUrl('http://127.0.0.1/?profile=1&perfProbe=1&perfProbe=1'),false);
});

test('artifact pins, build bytes and symlinks fail closed',async()=>{
 const metadata={id:PIN.artifactId,name:PIN.artifactName,expired:false,workflow_run:{id:PIN.runId,head_sha:PIN.candidate},digest:'sha256:'+PIN.artifactSha256,size_in_bytes:PIN.artifactBytes};
 verifyArtifactMetadata(metadata);
 for(const mutate of [x=>x.id++,x=>x.name='belle-staged-architecture-verified-build',x=>x.expired=true,x=>x.workflow_run.id++,x=>x.workflow_run.head_sha='wrong',x=>x.digest='sha256:wrong',x=>x.size_in_bytes--]){
  const bad=structuredClone(metadata);mutate(bad);assert.throws(()=>verifyArtifactMetadata(bad));
 }
 const root=await mkdtemp(resolve(tmpdir(),'desktop-stall-inventory-'));
 try{await writeFile(resolve(root,'game.js'),'first');const before=await buildInventory(root);await writeFile(resolve(root,'game.js'),'other');assert.notDeepEqual(await buildInventory(root),before);
  await symlink(resolve(root,'game.js'),resolve(root,'link.js'));await assert.rejects(buildInventory(root),/symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
});

async function nativeMock({listedCategories=[],listingError=false,missingTimeline=false,cpuFailure=false,endFailure=false,streamFailure=false,badScript=false,deferredCpu=false,browserCloseFailure=null,completion='normal',deferredBrowserClose=false}={}){
 const f=fixture(),root=await mkdtemp(resolve(tmpdir(),'desktop-stall-observer-')),output=resolve(root,'capture'),js=Buffer.from('function nativeWork() {}');
 if(missingTimeline)f.trace.traceEvents=f.trace.traceEvents.filter(e=>e.ph!=='X');
 f.source.files=[{file:'assets/game.js',bytes:js.length,sha256:sha256(js)}];
 const calls=[];let closed=0,contextClosed=0,cpuResolve,readCount=0,browserCloseResolve,browserCloseEnteredResolve;
 const cpuDeferred=new Promise(ok=>{cpuResolve=ok;});
 const browserCloseDeferred=new Promise(ok=>{browserCloseResolve=ok;}),browserCloseEntered=new Promise(ok=>{browserCloseEnteredResolve=ok;});
 class BrowserSession extends EventEmitter{async send(method,params){
  calls.push({method,params});
  if(method==='Tracing.getCategories'){if(listingError)throw Error('enumeration unavailable');return {categories:listedCategories};}
  if(method==='Tracing.start'){assert.equal(this.listenerCount('Tracing.tracingComplete'),1,'Completion observation must precede Tracing.start');if(completion==='early')this.emit('Tracing.tracingComplete',f.traceComplete);return {};}
  if(method==='Tracing.end'){
   if(endFailure)throw Error('native trace stop failed');
   if(completion!=='deferred')queueMicrotask(()=>{
    this.emit('Tracing.tracingComplete',f.traceComplete);
    if(completion==='duplicate'){this.emit('Tracing.tracingComplete',f.traceComplete);this.emit('Tracing.tracingComplete',{...f.traceComplete,stream:'extra-stream'});}
   });return {};
  }
  if(method==='IO.read'){readCount++;if(streamFailure){if(readCount===1)return {data:'{"traceEvents":[',eof:false};throw Error('raw stream interrupted');}return {data:JSON.stringify(f.trace),eof:true};}
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
  isClosed(){return false;}async addInitScript(){}context(){return context;}
  locator(...args){calls.push({method:'native locator',args,receiver:this});return panel;}
  async evaluate(){return f.page;}
  async goto(){this.emit('response',{url:()=> 'http://127.0.0.1:1234/assets/game.js',status:()=>200,body:async()=>badScript?Buffer.from('wrong'):js});return 'navigated';}
 }
 const browser={newBrowserCDPSession:async()=>browserSession,newPage:async()=>new Page(),close:async()=>{closed++;calls.push({method:'native browser.close'});browserCloseEnteredResolve();if(deferredBrowserClose)await browserCloseDeferred;if(browserCloseFailure)throw browserCloseFailure;return 'browser-closed';}};
 const chromium={launch:async()=>browser};
 const observer=await installDesktopStallTrace(chromium,{game:root,output,source:f.source,driver});
 const launched=await chromium.launch({channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
 await launched.newPage();
 const page=await launched.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});
 assert.equal(await page.goto(f.page.url,{waitUntil:'domcontentloaded'}),'navigated');
 return {f,root,output,observer,calls,browser,page,panel,button,nativeUp,cpuResolve,context,browserSession,browserCloseResolve,browserCloseEntered,
  complete:event=>browserSession.emit('Tracing.tracingComplete',event??f.traceComplete),getCounts:()=>({closed,contextClosed}),
  async capture(){assert.equal(page.locator('#ride-profile'),panel);assert.equal(panel.getByRole('button',{name:'Start 10-minute capture'}),button);
   assert.equal(await button.click(),'clicked');const promise=page.keyboard.up('w');assert.equal(promise,nativeUp);assert.equal(await promise,'released');},
  async finish({closeContext=true}={}){calls.push({method:'original post-ride actions'});if(closeContext)await context.close();
   const reportPath=resolve(root,'output/sustained-profile/diagnostic/desktop/report.json');await mkdir(resolve(root,'output/sustained-profile/diagnostic/desktop'),{recursive:true});
   const before=JSON.stringify(f.report);await writeFile(reportPath,before);
   if(browserCloseFailure)await assert.rejects(browser.close(),error=>error===browserCloseFailure);else assert.equal(await browser.close(),'browser-closed');
   assert.equal(await readFile(reportPath,'utf8'),before);
   return JSON.parse(await readFile(resolve(output,'trace-evidence.json'),'utf8'));},
  async cleanup(){await rm(root,{recursive:true,force:true});}
 };
}

test('pinned driver lifecycle mock arms before click, stops before post-ride actions, and binds the report only at close',async()=>{
 const h=await nativeMock();
 try{await h.capture();const stopped=h.calls.findIndex(c=>c.method==='Tracing.end'),clicked=h.calls.findIndex(c=>c.method==='native click');
  assert(h.calls.findIndex(c=>c.method==='Tracing.start')<clicked);assert(h.calls.findIndex(c=>c.method==='Profiler.start')<clicked);
  assert(stopped>=0);assert.equal(h.getCounts().closed,0);
  const e=await h.finish();assert(stopped<h.calls.findIndex(c=>c.method==='original post-ride actions'));
  assert.equal(e.verdict.collectionComplete,true);assert.equal(e.verdict.originalHarnessPassed,false);assert.equal(e.verdict.releaseAcceptance,false);
  assert.equal(e.stop.trigger,'native-w-keyup');assert.equal(e.traceFlushed,true);assert.equal(e.contextCloseAfterStop,true);assert.equal(e.errors.length,0);
  assert.deepEqual(e.categories.available,[]);assert.deepEqual(h.calls.find(c=>c.method==='Tracing.start').params.traceConfig.includedCategories,[...TRACE_CATEGORIES]);
  assert.equal(h.calls.filter(c=>c.method==='Profiler.stop').length,1);assert.equal(h.calls.filter(c=>c.method==='Tracing.end').length,1);
  assert.deepEqual(h.getCounts(),{closed:1,contextClosed:1});
 }finally{await h.cleanup();}
});

test('native browser-close rejection keeps its error identity and collected evidence',async()=>{
 const nativeError=Error('original browser close failed'),h=await nativeMock({browserCloseFailure:nativeError});
 try{await h.capture();const e=await h.finish();assert.equal(e.status,'finished');assert.equal(e.verdict.originalHarnessPassed,false);assert.equal(h.getCounts().closed,1);
  assert.equal(h.browserSession.listenerCount('Tracing.tracingComplete'),0);assert(Number.isFinite(e.traceCompletion.listenerDetachedHostMs));}
 finally{await h.cleanup();}
});

test('unsupported category enumeration stays advisory, but absent timeline work fails actual collection',async()=>{
 for(const options of [{listingError:true},{listedCategories:['gpu']},{missingTimeline:true}]){
  const h=await nativeMock(options);try{await h.capture();const e=await h.finish();
   assert.equal(e.verdict.collectionComplete,!options.missingTimeline);assert.deepEqual(e.categories.requested,[...TRACE_CATEGORIES]);
   if(options.missingTimeline)assert(e.verdict.errors.some(s=>s.includes('Renderer timeline')));
  }finally{await h.cleanup();}
 }
});

test('original context close joins pending CPU stop, and every stop error is retained',async()=>{
 const h=await nativeMock({deferredCpu:true,cpuFailure:true,endFailure:true});
 try{await h.capture();let resolved=false;const closing=h.context.close().then(()=>{resolved=true;});await tick();
  assert.equal(resolved,false);assert.equal(h.getCounts().contextClosed,0);
  h.cpuResolve();await closing;const e=await h.finish();
  assert.equal(e.verdict.collectionComplete,false);assert(e.errors.some(s=>s.includes('native CPU stop failed')));assert(e.errors.some(s=>s.includes('native trace stop failed')));
  assert.equal(e.stop.cpuStopIssued,true);assert.equal(e.stop.traceEndIssued,true);assert.equal(e.stop.cpuStopped,false);assert.equal(e.stop.traceEnded,false);
  assert.equal(h.calls.filter(c=>c.method==='Profiler.stop').length,1);assert.equal(h.calls.filter(c=>c.method==='Tracing.end').length,1);
 }finally{h.cpuResolve();await h.cleanup();}
});

test('partial trace and script mismatch remain archived failures without suppressing native completion',async()=>{
 for(const options of [{streamFailure:true},{badScript:true}]){
  const h=await nativeMock(options);try{await h.capture();const e=await h.finish();assert.equal(e.verdict.collectionComplete,false);
   assert.equal(h.getCounts().closed,1);assert.equal(e.verdict.originalHarnessPassed,false);
   if(options.streamFailure){assert.equal(await readFile(resolve(h.output,'browser-trace.json'),'utf8'),'{"traceEvents":[');assert(e.errors.some(s=>s.includes('raw stream interrupted')));}
   if(options.badScript)assert(e.errors.some(s=>s.includes('Script length mismatch')));
  }finally{await h.cleanup();}
 }
});

test('completion before stop is observed and archived, while the original click and native release still run once',async()=>{
 const h=await nativeMock({completion:'early'});
 try{await h.capture();const e=await h.finish();
  assert.equal(e.traceCompletion.events[0].phase,'before-stop');assert(e.errors.some(s=>s.includes('completed before the native stop')));
  assert.equal(e.traceFlushed,true);assert.equal(e.verdict.collectionComplete,false);assert.equal(e.verdict.originalHarnessPassed,false);
  assert.deepEqual(JSON.parse(await readFile(resolve(h.output,'browser-trace.json'),'utf8')),h.f.trace);
  for(const method of ['native click','native keyboard.up','native context.close','native browser.close'])assert.equal(h.calls.filter(c=>c.method===method).length,1);
 }finally{await h.cleanup();}
});

test('duplicate completion payloads retain timestamps and unique streams without rereading the same handle',async()=>{
 const h=await nativeMock({completion:'duplicate'});
 try{await h.capture();const e=await h.finish();
  assert.equal(e.traceCompletion.events.length,3);assert(e.traceCompletion.events.every(row=>Number.isFinite(row.hostMs)));
  assert.equal(e.traceCompletion.events[1].archive,'browser-trace.json');assert.equal(e.traceCompletion.events[2].archive,'browser-trace-extra-2.json');
  assert.equal(e.traceStreams.length,2);assert.equal(h.calls.filter(c=>c.method==='IO.read').length,2);assert.equal(h.calls.filter(c=>c.method==='IO.close').length,2);
  assert.deepEqual(JSON.parse(await readFile(resolve(h.output,'browser-trace-extra-2.json'),'utf8')),h.f.trace);
  assert.equal(e.verdict.collectionComplete,false);assert(e.errors.filter(s=>s.includes('Duplicate tracingComplete')).length===2);
 }finally{await h.cleanup();}
});

test('context close waits for pending completion and raw flush after the original keyup, then invokes native close once',async()=>{
 const h=await nativeMock({completion:'deferred'});
 try{await h.capture();await h.observer.stop('must-not-replace-native-trigger');const finished=h.finish();await tick();
  assert.equal(h.getCounts().contextClosed,0);assert.equal(h.calls.filter(c=>c.method==='native keyboard.up').length,1);
  h.complete();const e=await finished;
  assert.equal(h.getCounts().contextClosed,1);assert.equal(e.stop.trigger,'native-w-keyup');assert.equal(e.verdict.collectionComplete,true);
  assert(h.calls.findIndex(c=>c.method==='IO.close')<h.calls.findIndex(c=>c.method==='native context.close'));
  assert(e.contextClose.requestedHostMs<=e.contextClose.nativeAllowedHostMs);assert(e.contextClose.nativeAllowedHostMs<=e.contextClose.settledHostMs);
 }finally{await h.cleanup();}
});

test('the unchanged deadline releases context close and remains a failure when a late stream arrives during browser close',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const h=await nativeMock({completion:'deferred',deferredBrowserClose:true});
 try{await h.capture();await h.observer.stop('must-not-replace-native-trigger');const finished=h.finish();await tick();
  assert.equal(h.getCounts().contextClosed,0);assert.equal(h.observer.evidence.traceCompletion.deadlineHostMs-h.observer.evidence.stop.hostStartMs,60000);
  t.mock.timers.tick(59000);await tick();assert.equal(h.getCounts().contextClosed,0);
  t.mock.timers.tick(1000);await h.browserCloseEntered;
  assert.equal(h.getCounts().contextClosed,1);assert.equal(h.browserSession.listenerCount('Tracing.tracingComplete'),1);
  assert(h.observer.evidence.errors.some(s=>s.includes('Timeline flush timed out')));
  h.complete();h.browserCloseResolve();const e=await finished;
  assert.equal(e.traceCompletion.events[0].phase,'after-deadline');assert(e.errors.some(s=>s.includes('Timeline flush timed out')));
  assert(e.errors.some(s=>s.includes('after the unchanged 60-second deadline')));assert.equal(e.verdict.collectionComplete,false);
  assert.equal(e.traceFlushed,true);assert.deepEqual(JSON.parse(await readFile(resolve(h.output,'browser-trace.json'),'utf8')),h.f.trace);
  assert.equal(h.browserSession.listenerCount('Tracing.tracingComplete'),0);
  for(const method of ['native click','native keyboard.up','native context.close','native browser.close'])assert.equal(h.calls.filter(c=>c.method===method).length,1);
 }finally{h.browserCloseResolve();await h.cleanup();}
});

test('CPU, trace-end and stream failures cannot suppress original context closure or erase earlier errors',async()=>{
 for(const options of [{cpuFailure:true},{endFailure:true},{streamFailure:true}]){
  const h=await nativeMock(options);try{await h.capture();const e=await h.finish();
   assert.equal(h.getCounts().contextClosed,1);assert.equal(h.getCounts().closed,1);assert.equal(e.verdict.collectionComplete,false);assert(e.errors.length>0);
   assert.equal(e.stop.trigger,'native-w-keyup');assert(Number.isFinite(e.contextClose.nativeAllowedHostMs));assert(Number.isFinite(e.contextClose.settledHostMs));
  }finally{await h.cleanup();}
 }
});

test('actual reduced-lane lifecycle closes the browser directly after the unchanged report',async()=>{
 const h=await nativeMock();
 try{await h.capture();const e=await h.finish({closeContext:false});
  assert.equal(e.verdict.collectionComplete,true);assert.equal(e.verdict.originalHarnessPassed,false);
  assert.equal(e.verdict.originalGpsPassed,null);assert.equal(e.releaseAcceptance,false);
  assert.equal(e.stop.trigger,'native-w-keyup');assert.equal(e.traceFlushed,true);
  assert.deepEqual(h.getCounts(),{closed:1,contextClosed:0});
  assert.equal(h.calls.filter(c=>c.method==='native keyboard.up').length,1);
  assert.equal(e.traceCompletion.deadlineHostMs-e.stop.hostStartMs,60000);
  assert.deepEqual(TRACE_CATEGORIES,['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing',
   'v8','disabled-by-default-v8.gc','renderer.scheduler']);
 }finally{await h.cleanup();}
});

test('reduced-lane direct browser close retains the sixty-second completion timeout and recovered late failure',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const h=await nativeMock({completion:'deferred',deferredBrowserClose:true});
 try{await h.capture();await h.observer.stop('must-not-replace-native-trigger');
  const finished=h.finish({closeContext:false});await tick();
  t.mock.timers.tick(59000);await tick();assert.deepEqual(h.getCounts(),{closed:0,contextClosed:0});
  t.mock.timers.tick(1000);await h.browserCloseEntered;
  assert.deepEqual(h.getCounts(),{closed:1,contextClosed:0});
  h.complete();h.browserCloseResolve();const e=await finished;
  assert.equal(e.traceCompletion.events[0].phase,'after-deadline');
  assert.equal(e.verdict.collectionComplete,false);assert.equal(e.verdict.originalHarnessPassed,false);
  assert(e.errors.some(s=>s.includes('Timeline flush timed out')));
  assert(e.errors.some(s=>s.includes('after the unchanged 60-second deadline')));
  assert.equal(e.traceFlushed,true);assert.equal(h.calls.filter(c=>c.method==='native keyboard.up').length,1);
 }finally{h.browserCloseResolve();await h.cleanup();}
});
