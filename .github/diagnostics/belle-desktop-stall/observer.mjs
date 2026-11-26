/** External observations around the exact original full-desktop driver. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MARKER_PREFIX,TRACE_CATEGORIES,isGameUrl,sha256,createTraceSummaryAccumulator,diagnosticVerdict,verifyOriginalVerdict} from './contract.mjs';
import {summarizeTraceFile} from './sustained-trace-json.mjs';

const errorText=error=>error?.stack||String(error);
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const reportError=(handler,error)=>{try{handler(error);}catch{/* Observer error reporting cannot replace a native result. */}};

function install(owner,key,wrapped){
 const descriptor=Object.getOwnPropertyDescriptor(owner,key);
 Object.defineProperty(owner,key,{configurable:true,writable:true,value:wrapped});
 return ()=>{if(owner[key]!==wrapped)return;if(descriptor)Object.defineProperty(owner,key,descriptor);else delete owner[key];};
}
/** Locator factories stay synchronous and return the exact native object. */
export function observeSync(owner,key,{after,onError=()=>{}}={}){
 const original=owner[key];
 return install(owner,key,function(...args){
  const result=Reflect.apply(original,this,args);
  try{const observation=after?.(result,args,this);if(observation?.then)observation.catch(error=>reportError(onError,error));}
  catch(error){reportError(onError,error);}return result;
 });
}
/** Await a setup hook, then call a native asynchronous operation exactly once. */
export function observeAsync(owner,key,{before,after,onError=()=>{}}={}){
 const original=owner[key];
 const observe=async(fn,...args)=>{try{await fn?.(...args);}catch(error){reportError(onError,error);}};
 return install(owner,key,async function(...args){
  await observe(before,args,this);const result=await Reflect.apply(original,this,args);
  await observe(after,result,args,this);return result;
 });
}
/** Keep the exact native promise and its rejection; observe only its completion. */
export function observeCompletion(owner,key,{after,onRejected,onError=()=>{}}={}){
 const original=owner[key];
 return install(owner,key,function(...args){
  const result=Reflect.apply(original,this,args),receiver=this;
  Promise.resolve(result).then(
   value=>{try{Promise.resolve(after?.(value,args,receiver)).catch(error=>reportError(onError,error));}catch(error){reportError(onError,error);}},
   error=>{try{Promise.resolve(onRejected?.(error,args,receiver)).catch(problem=>reportError(onError,problem));}catch(problem){reportError(onError,problem);}}
  );return result;
 });
}
export async function bounded(promise,label,timeout=15000){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' observation timed out')),timeout);})]);}
 finally{clearTimeout(timer);}
}
export async function cdp(session,method,params={}){return bounded(session.send(method,params),method);}

/** Each cleanup error survives independently, including an initial open error. */
export async function drainTraceStream(session,handle,path,onError,openFile=open){
 let file,written=false,fileClosed=false,handleClosed=false;
 try{
  file=await openFile(path,'w');let done=false;
  while(!done){const chunk=await cdp(session,'IO.read',{handle,size:1024*1024});
   await file.writeFile(Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8'));done=chunk.eof;}
  written=true;
 }catch(error){onError('trace.stream.read/write',error);}
 finally{
  if(file){try{await file.close();fileClosed=true;}catch(error){onError('trace.file.close',error);}}
  try{await cdp(session,'IO.close',{handle});handleClosed=true;}catch(error){onError('trace.handle.close',error);}
 }
 return {written,fileClosed,handleClosed,complete:written&&fileClosed&&handleClosed};
}

/** Native event labels and read-only browser observations; never game state. */
export function installPageEvidence({prefix}){
 if(location.hostname!=='127.0.0.1'||location.pathname!=='/'||new URLSearchParams(location.search).get('profile')!=='1'||new URLSearchParams(location.search).get('locationPerf')!=='1')return;
 const limit=1024,markers=[],tasks=[],animationFrames=[],rafGaps=[],errors=[],observers=[];
 const dropped={markers:0,tasks:0,animationFrames:0,rafGaps:0};
 const available={longtask:false,'long-animation-frame':false};
 let started=false,finished=false,startAt=null,endAt=null,lastRaf=null,rafId=null;
 const retain=(kind,rows,row)=>{if(rows.length<limit)rows.push(row);else dropped[kind]++;};
 function mark(label){try{const name=prefix+label;performance.mark(name);const atMs=performance.getEntriesByName(name,'mark').at(-1).startTime;
  retain('markers',markers,{label,atMs});return atMs;}catch(error){errors.push(String(error));return null;}}
 const eligible=e=>startAt!==null&&e.startTime>=startAt&&(endAt===null||e.startTime<endAt);
 function collectTasks(entries){for(const e of entries)if(eligible(e))retain('tasks',tasks,{startTimeMs:e.startTime,durationMs:e.duration,name:e.name});}
 function collectAnimationFrames(entries){for(const e of entries)if(eligible(e))retain('animationFrames',animationFrames,{
  startTimeMs:e.startTime,durationMs:e.duration,renderStartMs:e.renderStart,styleAndLayoutStartMs:e.styleAndLayoutStart,blockingDurationMs:e.blockingDuration,
  scripts:Array.from(e.scripts??[],s=>({startTimeMs:s.startTime,durationMs:s.duration,executionStartMs:s.executionStart,
   forcedStyleAndLayoutDurationMs:s.forcedStyleAndLayoutDuration,pauseDurationMs:s.pauseDuration,invoker:s.invoker,invokerType:s.invokerType,
   sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,sourceCharPosition:s.sourceCharPosition,windowAttribution:s.windowAttribution}))});}
 for(const [type,collect] of [['longtask',collectTasks],['long-animation-frame',collectAnimationFrames]]){
  try{if(!PerformanceObserver.supportedEntryTypes?.includes(type))continue;
   const observer=new PerformanceObserver(list=>collect(list.getEntries()));observer.observe({type});observers.push({observer,collect});available[type]=true;
  }catch(error){errors.push(type+': '+String(error));}
 }
 function frame(now){if(!started||finished)return;if(lastRaf!==null&&now-lastRaf>50)retain('rafGaps',rafGaps,{startTimeMs:lastRaf,endTimeMs:now,durationMs:now-lastRaf});
  lastRaf=now;rafId=requestAnimationFrame(frame);}
 document.addEventListener('click',event=>{if(event.isTrusted&&!started&&event.target?.closest?.('#ride-profile button')?.textContent?.startsWith('Start')){
  started=true;startAt=mark('profile-start-click');rafId=requestAnimationFrame(frame);
 }},true);
 document.addEventListener('keydown',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'&&!markers.some(m=>m.label==='first-w-keydown'))mark('first-w-keydown');},true);
 document.addEventListener('keyup',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'){
  finished=true;endAt=mark('w-keyup');if(rafId!==null)cancelAnimationFrame(rafId);
 }},true);
 Object.defineProperty(window,'__belleDesktopStallEvidence',{configurable:false,value:()=>{
  for(const {observer,collect} of observers){collect(observer.takeRecords());if(finished)observer.disconnect();}
  return {url:location.href,timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallTimeMs:Date.now(),
   viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},markers:markers.map(row=>({...row})),errors:[...errors],droppedMarkers:dropped.markers,
   browserObservations:{startAtMs:startAt,endAtMs:endAt,available,limit,dropped:{...dropped},tasks:[...tasks],animationFrames:[...animationFrames],rafGaps:[...rafGaps],
    scope:'Original profile click through trusted W-keyup. Boundary-overlapping tasks retain full native durations; these are not GPU execution timings.'}};
 }});
}

export async function installDesktopStallTrace(chromium,{game,output,source,driver,diagnosticSource=null}){
 await mkdir(output,{recursive:true});
 const evidence={diagnosticOnly:true,releaseAcceptance:false,source,diagnosticSource,host:{platform:process.platform,arch:process.arch},
  status:'starting',errors:[],errorRecords:[],unsupported:[],launches:[],pages:[],bufferUsage:[],droppedBufferUsage:0,
  scriptReceipts:[],stop:null,traceComplete:null,cpu:null,pageEvidence:null,summary:null};
 const fail=(where,error)=>{const message=errorText(error);evidence.errors.push(where+': '+message);evidence.errorRecords.push({where,message});};
 let persistQueue=Promise.resolve();
 const persist=()=>{const snapshot=JSON.stringify(evidence,null,2)+'\n';persistQueue=persistQueue.then(()=>writeFile(resolve(output,'trace-evidence.json'),snapshot)).catch(error=>fail('evidence.write',error));return persistQueue;};
 const optional=async(session,method)=>{try{return await cdp(session,method);}catch(error){evidence.unsupported.push({method,error:errorText(error)});return null;}};
 let browserSession,gameSession,gamePage,armed=false,recording=false,cpuRecording=false,arming,stopping,flushing,finishing;
 const responseTasks=new Set(),observedPanels=new WeakSet(),observedButtons=new WeakSet(),seenScripts=new Set();
 await persist();

 async function arm(){
  if(arming){fail('capture.arm',Error('Original capture click attempted more than once'));return arming;}
  arming=(async()=>{
   evidence.arm={hostStartMs:performance.now(),intervalUs:1000};
   if(!browserSession||!gameSession){fail('capture.arm',Error('Missing original game CDP sessions'));return;}
   try{await cdp(browserSession,'Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',bufferUsageReportingInterval:1000,
    traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:262144,includedCategories:[...TRACE_CATEGORIES]}});recording=true;
   }catch(error){fail('Tracing.start',error);}
   try{await cdp(gameSession,'Profiler.start');cpuRecording=true;}catch(error){fail('Profiler.start',error);}
   armed=true;evidence.arm.hostReadyMs=performance.now();evidence.status='armed';await persist();
  })();return arming;
 }
 async function streamTrace(complete){
  evidence.traceComplete=complete;assert(complete?.stream,'Missing raw timeline stream');
  evidence.traceIo=await drainTraceStream(browserSession,complete.stream,resolve(output,'browser-trace.json'),fail);
  evidence.traceFlushed=evidence.traceIo.complete;evidence.traceFlushHostMs=performance.now();await persist();
 }
 function stop(trigger){
  if(stopping)return stopping;
  evidence.stop={trigger,hostStartMs:performance.now(),cpuStopIssued:false,traceEndIssued:false,cpuStopped:false,traceEnded:false};
  evidence.status='stopping';
  stopping=(async()=>{
   const operations=[];
   if(cpuRecording){
    evidence.stop.cpuStopIssued=true;
    operations.push(cdp(gameSession,'Profiler.stop').then(async result=>{
     cpuRecording=false;evidence.stop.cpuStopped=true;evidence.stop.cpuStopHostMs=performance.now();
     // Retain raw bytes before any sample validation, including malformed output.
     await save(resolve(output,'renderer.cpuprofile'),result.profile);
     evidence.cpu={file:'renderer.cpuprofile',samples:result.profile?.samples?.length??0,startTime:result.profile?.startTime,endTime:result.profile?.endTime};
    }).catch(error=>fail('Profiler.stop/archive',error)));
   }else fail('capture.stop',Error('CPU recording was not active'));
   if(recording){
    let timer,completeHandler;
    const completion=new Promise((ok,reject)=>{
     completeHandler=value=>{clearTimeout(timer);ok(value);};browserSession.once('Tracing.tracingComplete',completeHandler);
     timer=setTimeout(()=>{browserSession.off('Tracing.tracingComplete',completeHandler);reject(Error('Timeline flush timed out'));},60000);
    });
    evidence.stop.traceEndIssued=true;
    const endRequest=cdp(browserSession,'Tracing.end').then(()=>{recording=false;evidence.stop.traceEnded=true;evidence.stop.traceEndHostMs=performance.now();})
     .catch(error=>{fail('Tracing.end',error);throw error;});
    operations.push(endRequest);
    // Flush is independent from recording stop and from final report binding.
    flushing=Promise.all([endRequest,completion]).then(([,complete])=>streamTrace(complete)).catch(error=>fail('trace.flush',error)).finally(()=>{
     clearTimeout(timer);browserSession.off('Tracing.tracingComplete',completeHandler);
    });
   }else fail('capture.stop',Error('Timeline recording was not active'));
   if(gamePage&&!gamePage.isClosed()){
    operations.push(bounded(Promise.resolve().then(()=>gamePage.evaluate(()=>window.__belleDesktopStallEvidence?.()||null)),'page evidence').then(value=>{evidence.pageEvidence=value;}).catch(error=>fail('page evidence',error)));
    operations.push(cdp(gameSession,'Performance.getMetrics').then(value=>{evidence.metricClockEnd=value;}).catch(error=>fail('ending clock',error)));
   }else fail('page evidence',Error('Original game target closed before stop'));
   await Promise.allSettled(operations);
   evidence.stop.hostJoinedMs=performance.now();evidence.status='stopped';await persist();
  })();return stopping;
 }
 async function finish(){
  if(finishing)return finishing;
  finishing=(async()=>{
   if(!stopping){fail('capture.finish',Error('Original native W release did not stop collection'));await stop('browser-close-fallback');}
   await stopping;await flushing;await Promise.allSettled([...responseTasks]);
   if(browserSession)evidence.processesAtEnd=await optional(browserSession,'SystemInfo.getProcessInfo');
   let report=null;
   try{const bytes=await readFile(resolve(game,'output/sustained-profile/full/desktop/report.json'));
    report=JSON.parse(bytes);evidence.originalReportSha256=sha256(bytes);await writeFile(resolve(output,'original-report.json'),bytes);
    verifyOriginalVerdict(report,driver);
   }catch(error){fail('original report',error);}
   try{const profile=await readFile(resolve(output,'renderer.cpuprofile'));evidence.cpuProfileSha256=sha256(profile);
    const result=await summarizeTraceFile(resolve(output,'browser-trace.json'),JSON.parse(profile),evidence.pageEvidence,{createAccumulator:createTraceSummaryAccumulator});
    evidence.traceSha256=result.sha256;evidence.traceReceipt=result.receipt;evidence.summary=result.summary;
   }catch(error){if(error.traceReceipt){evidence.traceReceipt=error.traceReceipt;evidence.traceSha256=error.traceReceipt.sha256;}fail('raw evidence summary',error);}
   if(evidence.launches.length!==1||evidence.pages.filter(p=>p.observedGame).length!==1)fail('target identity',Error('Expected one original Metal launch and one original observed game target'));
   if(!armed||!evidence.scriptReceipts.length)fail('source identity',Error('Capture was not armed or browser-consumed script receipts are missing'));
   evidence.verdict=diagnosticVerdict({source,report,traceComplete:evidence.traceComplete,summary:evidence.summary,errors:evidence.errors,stop:evidence.stop});
   evidence.status='finished';await persist();return evidence;
  })();return finishing;
 }

 observeAsync(chromium,'launch',{onError:error=>fail('launch observer',error),after:async(browser,args)=>{
  evidence.launches.push(args[0]);
  observeAsync(browser,'close',{before:finish,onError:error=>fail('browser close observer',error)});
  observeAsync(browser,'newPage',{onError:error=>fail('newPage observer',error),after:async(page,args)=>{
   const entry={options:args[0]??null,observedGame:false};evidence.pages.push(entry);
   if(gamePage||args[0]?.viewport?.width!==1440||args[0]?.viewport?.height!==900)return;
   assert.deepEqual(args,[{viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'}],'Original desktop page options changed');
   gamePage=page;entry.observedGame=true;await page.addInitScript(installPageEvidence,{prefix:MARKER_PREFIX});
   observeSync(page,'locator',{onError:error=>fail('locator observer',error),after:(panel,args)=>{
    if(args[0]!=='#ride-profile'||observedPanels.has(panel))return;observedPanels.add(panel);
    assert.deepEqual(args,['#ride-profile'],'Original panel locator changed');
    observeSync(panel,'getByRole',{onError:error=>fail('button locator observer',error),after:(button,args)=>{
     if(args[0]!=='button'||args[1]?.name!=='Start 10-minute capture'||observedButtons.has(button))return;observedButtons.add(button);
     observeAsync(button,'click',{before:arm,onError:error=>fail('capture click observer',error)});
    }});
   }});
   observeCompletion(page.keyboard,'up',{onError:error=>fail('keyup observer',error),after:(_result,args)=>{
    if(args[0]==='w'){if(args.length!==1)fail('keyup arguments',Error('Original keyboard release arguments changed'));return stop('native-w-keyup');}
   },onRejected:(error,args)=>{if(args[0]==='w')fail('original keyup rejected',error);}});
   observeAsync(page.context(),'close',{onError:error=>fail('context close observer',error),before:async()=>{
    if(!stopping){fail('context close',Error('Game context closed before native collection stop'));await stop('context-close-fallback');}
    await stopping;evidence.contextCloseAfterStop=true;
   }});
   page.on('response',response=>{
    let url;try{url=new URL(response.url());if(url.hostname!=='127.0.0.1'||!url.pathname.endsWith('.js')||seenScripts.has(response.url()))return;
     seenScripts.add(response.url());}catch(error){fail('script receipt URL',error);return;}
    const task=(async()=>{const name=decodeURIComponent(url.pathname).slice(1),expected=source.files.find(row=>row.file===name);
     assert(expected,'Unbound application script: '+name);assert.equal(response.status(),200,'Script response failed');
     const bytes=await response.body();assert.equal(bytes.length,expected.bytes,'Script length mismatch');assert.equal(sha256(bytes),expected.sha256,'Consumed script hash mismatch');
     const file='scripts/'+expected.sha256+'.js';await mkdir(resolve(output,'scripts'),{recursive:true});await writeFile(resolve(output,file),bytes);
     evidence.scriptReceipts.push({url:response.url(),file,bytes:bytes.length,sha256:expected.sha256,receivedBy:'browser-response-body'});
    })().catch(error=>fail('script receipt',error));responseTasks.add(task);task.finally(()=>responseTasks.delete(task));
   });
   observeAsync(page,'goto',{onError:error=>fail('navigation observer',error),after:async(_result,args)=>{
    assert(isGameUrl(args[0]),'Original full game navigation changed');
    gameSession=await page.context().newCDPSession(page);
    evidence.targetAtStart=await cdp(gameSession,'Target.getTargetInfo');assert.equal(evidence.targetAtStart.targetInfo.type,'page');
    assert(isGameUrl(evidence.targetAtStart.targetInfo.url),'Profiler attached to wrong target');
    evidence.frameTree=await cdp(gameSession,'Page.getFrameTree');
    await cdp(gameSession,'Performance.enable',{timeDomain:'timeTicks'});evidence.metricClockStart=await cdp(gameSession,'Performance.getMetrics');
    await cdp(gameSession,'Profiler.enable');await cdp(gameSession,'Profiler.setSamplingInterval',{interval:1000});
   }});
  }});
  assert.deepEqual(args,[{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}],'Original launch options changed');
  browserSession=await browser.newBrowserCDPSession();
  evidence.browser=await cdp(browserSession,'Browser.getVersion');evidence.systemInfo=await optional(browserSession,'SystemInfo.getInfo');
  evidence.processesAtStart=await optional(browserSession,'SystemInfo.getProcessInfo');
  const supported=await optional(browserSession,'Tracing.getCategories');
  evidence.categories={available:Array.isArray(supported?.categories)?supported.categories:null,requested:[...TRACE_CATEGORIES],enumerationAdvisory:true};
  browserSession.on('Tracing.bufferUsage',value=>{if(evidence.bufferUsage.length<1024)evidence.bufferUsage.push(value);else evidence.droppedBufferUsage++;});
 }});
 return {evidence,finish,stop,arm};
}
