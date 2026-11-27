/** External observations around the exact original full-preview desktop driver. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MARKER_PREFIX,TRACE_CATEGORIES,TRACE_START_PARAMS,REPORT_PATH,isGameUrl,sha256,createTraceSummaryAccumulator,diagnosticVerdict,verifyOriginalVerdict,verifyPageObservations,verifyTraceControls} from './contract.mjs';
import {summarizeTraceFile} from './sustained-trace-json.mjs';
import {matchEmbeddedImage} from './embedded-assets.mjs';

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
export function observeAsync(owner,key,{before,after,settled,onError=()=>{}}={}){
 const original=owner[key];
 const observe=async(fn,...args)=>{try{await fn?.(...args);}catch(error){reportError(onError,error);}};
 return install(owner,key,async function(...args){
  await observe(before,args,this);
  try{const result=await Reflect.apply(original,this,args);await observe(after,result,args,this);return result;}
  finally{await observe(settled,args,this);}
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
 if(location.hostname!=='127.0.0.1'||location.pathname!=='/'||JSON.stringify([...new URLSearchParams(location.search)].sort())!==JSON.stringify([['locationPerf','1'],['profile','1']]))return;
 const limit=1024,markers=[],tasks=[],animationFrames=[],rafGaps=[],transitions=[],errors=[],observers=[];
 const dropped={markers:0,tasks:0,animationFrames:0,rafGaps:0,transitions:0};
 const available={longtask:false,'long-animation-frame':false};
 let started=false,finished=false,startAt=null,endAt=null,firstRaf=null,lastRaf=null,firstRafInvocation=null,lastRafInvocation=null,rafCallbacks=0,rafId=null,boundaryRevision=0,lastRafRevision=0;
 const retain=(kind,rows,row)=>{if(rows.length<limit)rows.push(row);else dropped[kind]++;};
 function mark(label){try{const name=prefix+label;performance.mark(name);const atMs=performance.getEntriesByName(name,'mark').at(-1).startTime;
  retain('markers',markers,{label,atMs});return atMs;}catch(error){errors.push(String(error));return null;}}
 const eligible=e=>startAt!==null&&e.startTime+e.duration>startAt&&(endAt===null||e.startTime<endAt);
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
 function transition(kind){if(!started||finished)return;boundaryRevision++;
  retain('transitions',transitions,{kind,atMs:performance.now(),hidden:document.hidden,focused:document.hasFocus(),revision:boundaryRevision});}
 document.addEventListener('visibilitychange',()=>transition('visibilitychange'));
 window.addEventListener('focus',()=>transition('window-focus'));window.addEventListener('blur',()=>transition('window-blur'));
 document.addEventListener('close',event=>{if(event.target?.id==='settings')transition('settings-close-event');},true);
 document.addEventListener('focus',event=>{if(event.target?.id==='game')transition('game-focus');},true);
 function frame(now){if(!started||finished)return;const invokedAt=performance.now();rafCallbacks++;
  if(firstRaf===null){firstRaf=now;firstRafInvocation=invokedAt;}if(lastRaf!==null&&now-lastRaf>50)retain('rafGaps',rafGaps,{startTimeMs:lastRaf,endTimeMs:now,durationMs:now-lastRaf,
   previousCallbackInvocationMs:lastRafInvocation,currentCallbackInvocationMs:invokedAt,
   boundaryChanged:boundaryRevision!==lastRafRevision,startRevision:lastRafRevision,endRevision:boundaryRevision});
  lastRaf=now;lastRafInvocation=invokedAt;lastRafRevision=boundaryRevision;rafId=requestAnimationFrame(frame);}
 document.addEventListener('click',event=>{if(event.isTrusted&&!started&&event.target?.closest?.('#ride-profile button')?.textContent?.startsWith('Start')){
  started=true;startAt=mark('profile-start-click');transition('profile-start');rafId=requestAnimationFrame(frame);
 }},true);
 document.addEventListener('keydown',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'&&!markers.some(m=>m.label==='first-w-keydown'))mark('first-w-keydown');},true);
 document.addEventListener('keyup',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'){
  finished=true;endAt=mark('w-keyup');if(rafId!==null)cancelAnimationFrame(rafId);
 }},true);
 Object.defineProperty(window,'__belleDesktopStallEvidence',{configurable:false,value:()=>{
  for(const {observer,collect} of observers){collect(observer.takeRecords());if(finished)observer.disconnect();}
  return {url:location.href,timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallTimeMs:Date.now(),
   viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},markers:markers.map(row=>({...row})),errors:[...errors],droppedMarkers:dropped.markers,
   previewRuntime:{polyhavenRockReview:document.documentElement?.dataset.polyhavenRockReview??null},
   browserObservations:{startAtMs:startAt,endAtMs:endAt,firstRafMs:firstRaf,lastRafMs:lastRaf,firstRafInvocationMs:firstRafInvocation,lastRafInvocationMs:lastRafInvocation,rafCallbacks,available,limit,dropped:{...dropped},tasks:[...tasks],animationFrames:[...animationFrames],rafGaps:[...rafGaps],transitions:[...transitions],
    scope:'Original profile click through trusted W-keyup. Boundary flags are native UI observations, not an invented copy of game eligibility. Overlapping tasks retain full native durations; these are not GPU execution timings.'}};
 }});
}

export async function installDesktopStallTrace(chromium,{game,output,source,driver,diagnosticSource=null}){
 await mkdir(output,{recursive:true});
 const evidence={diagnosticOnly:true,releaseAcceptance:false,source,diagnosticSource,host:{platform:process.platform,arch:process.arch},
  status:'starting',errors:[],errorRecords:[],unsupported:[],launches:[],pages:[],bufferUsage:[],droppedBufferUsage:0,
  scriptReceipts:[],assetReceipts:[],gameUrl:null,baselineWitness:null,stop:null,traceComplete:null,cpu:null,pageEvidence:null,summary:null,categories:null,traceStart:null,
  traceCompletion:{listenerAttachedHostMs:null,listenerDetachedHostMs:null,deadlineHostMs:null,timeoutHostMs:null,events:[]},traceStreams:[]};
 const fail=(where,error)=>{const message=errorText(error);evidence.errors.push(where+': '+message);evidence.errorRecords.push({where,message});};
 let persistQueue=Promise.resolve();
 const persist=()=>{const snapshot=JSON.stringify(evidence,null,2)+'\n';persistQueue=persistQueue.then(()=>writeFile(resolve(output,'trace-evidence.json'),snapshot)).catch(error=>fail('evidence.write',error));return persistQueue;};
 const optional=async(session,method)=>{try{return await cdp(session,method);}catch(error){evidence.unsupported.push({method,error:errorText(error)});return null;}};
 let browserSession,gameSession,gamePage,armed=false,recording=false,cpuRecording=false,arming,stopping,flushing,finishing,originalReport=null;
 let completionListener,completionResolve,completionReject,completionTimer;
 const traceTasks=new Set(),traceStreams=new Map();
 const responseTasks=new Set(),observedPanels=new WeakSet(),observedButtons=new WeakSet();
 const sourceErrors=[],sourceFailedRequests=[];let sourceObservation=false;
 let assetActive=0;const assetWaiters=[];
 const assetSlot=async()=>{if(assetActive<2){assetActive++;return;}await new Promise(ok=>assetWaiters.push(ok));};
 const assetRelease=()=>{const next=assetWaiters.shift();if(next)next();else assetActive--;};
 await persist();

 async function arm(){
  if(arming){fail('capture.arm',Error('Original capture click attempted more than once'));return arming;}
  arming=(async()=>{
   evidence.arm={hostStartMs:performance.now(),intervalUs:1000};
   if(!browserSession||!gameSession){fail('capture.arm',Error('Missing original game CDP sessions'));return;}
   try{evidence.previewAtArm=await bounded(gamePage.evaluate(()=>({polyhavenRockReview:document.documentElement.dataset.polyhavenRockReview??null})),'preview identity');
    assert.equal(evidence.previewAtArm?.polyhavenRockReview,'loaded','Preview assets were not loaded by the unmodified game');
   }catch(error){fail('preview identity',error);}
   observeTimelineCompletion();
   const traceStart=evidence.traceStart={method:'Tracing.start',params:structuredClone(TRACE_START_PARAMS),startedHostMs:performance.now(),finishedHostMs:null,completed:false,response:null,error:null};
   try{traceStart.response=await cdp(browserSession,traceStart.method,traceStart.params);recording=true;traceStart.completed=true;
   }catch(error){traceStart.error=errorText(error);fail('Tracing.start',error);}
   finally{traceStart.finishedHostMs=performance.now();}
   try{await cdp(gameSession,'Profiler.start');cpuRecording=true;}catch(error){fail('Profiler.start',error);}
   armed=true;evidence.arm.hostReadyMs=performance.now();evidence.status='armed';await persist();
  })();return arming;
 }
 async function streamTrace(complete,receipt){
  receipt.io=await drainTraceStream(browserSession,complete.stream,resolve(output,receipt.file),fail);
  receipt.finishedHostMs=performance.now();
  receipt.deadlineExceeded=evidence.traceCompletion.deadlineHostMs!==null&&receipt.finishedHostMs>evidence.traceCompletion.deadlineHostMs;
  if(receipt.deadlineExceeded)fail('trace.stream deadline',Error('Raw trace flush completed after the unchanged absolute 60-second collection deadline; late bytes retained'));
  if(receipt.file==='browser-trace.json'){
   evidence.traceIo=receipt.io;evidence.traceFlushed=receipt.io.complete;evidence.traceFlushHostMs=receipt.finishedHostMs;
  }
  await persist();
 }
 async function joinTraceStreams(){while(traceTasks.size)await Promise.allSettled([...traceTasks]);}
 function observeTimelineCompletion(){
  if(completionListener)return;
  evidence.traceCompletion.listenerAttachedHostMs=performance.now();
  completionListener=complete=>{
   const hostMs=performance.now(),observation=evidence.traceCompletion;
   const early=!evidence.stop?.traceEndIssued;
   const late=observation.deadlineHostMs!==null&&(observation.timeoutHostMs!==null||hostMs>observation.deadlineHostMs);
   const receipt={ordinal:observation.events.length+1,hostMs,phase:early?'before-stop':late?'after-deadline':'after-stop',event:complete};
   observation.events.push(receipt);
   if(receipt.ordinal===1)evidence.traceComplete=complete;else fail('trace.completion',Error('Duplicate tracingComplete event'));
   if(early)fail('trace.completion',Error('Timeline completed before the native stop request'));
   if(late)fail('trace.completion',Error('Timeline completion arrived after the unchanged 60-second deadline'));
   clearTimeout(completionTimer);
   try{
    assert(typeof complete?.stream==='string'&&complete.stream,'Missing raw timeline stream');
    if(traceStreams.has(complete.stream))receipt.archive=traceStreams.get(complete.stream).file;
    else{
     const stream={handle:complete.stream,file:traceStreams.size?'browser-trace-extra-'+(traceStreams.size+1)+'.json':'browser-trace.json',receivedHostMs:hostMs};
     traceStreams.set(complete.stream,stream);evidence.traceStreams.push(stream);receipt.archive=stream.file;
     const task=streamTrace(complete,stream).catch(error=>fail('trace.stream archive',error)).finally(()=>traceTasks.delete(task));traceTasks.add(task);
    }
   }catch(error){fail('trace.completion stream',error);}
   completionResolve?.(complete);void persist();
  };
  browserSession.on('Tracing.tracingComplete',completionListener);
 }
 async function closeTimelineObservation(){
  evidence.traceCompletion.listenerDetachedHostMs=performance.now();
  if(completionListener)browserSession.off('Tracing.tracingComplete',completionListener);
  clearTimeout(completionTimer);
  completionReject?.(Error('Browser close settled before timeline completion'));
  await flushing;await joinTraceStreams();
  evidence.verdict=diagnosticVerdict({source,report:originalReport,traceComplete:evidence.traceComplete,summary:evidence.summary,errors:evidence.errors,stop:evidence.stop});
  await persist();
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
    evidence.traceCompletion.deadlineHostMs=evidence.stop.hostStartMs+60000;
    const completion=new Promise((ok,reject)=>{
     completionResolve=ok;completionReject=reject;
     if(evidence.traceCompletion.events.length){ok(evidence.traceComplete);return;}
     completionTimer=setTimeout(()=>{
      evidence.traceCompletion.timeoutHostMs=performance.now();reject(Error('Timeline flush timed out'));void persist();
     },Math.max(0,evidence.traceCompletion.deadlineHostMs-performance.now()));
    });
    evidence.stop.traceEndIssued=true;
    const endRequest=cdp(browserSession,'Tracing.end').then(()=>{recording=false;evidence.stop.traceEnded=true;evidence.stop.traceEndHostMs=performance.now();})
     .catch(error=>{fail('Tracing.end',error);throw error;});
    operations.push(endRequest);
    // Flush is independent from recording stop and from final report binding.
    flushing=Promise.all([endRequest,completion]).then(()=>joinTraceStreams()).catch(error=>fail('trace.flush',error)).finally(()=>{
     clearTimeout(completionTimer);completionResolve=null;completionReject=null;
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
   await stopping;await flushing;await joinTraceStreams();await Promise.allSettled([...responseTasks]);
   if(browserSession)evidence.processesAtEnd=await optional(browserSession,'SystemInfo.getProcessInfo');
   let report=null;
   try{const bytes=await readFile(resolve(game,REPORT_PATH));
    report=JSON.parse(bytes);originalReport=report;evidence.originalReportSha256=sha256(bytes);await writeFile(resolve(output,'original-report.json'),bytes);
    verifyOriginalVerdict(report,driver,evidence.baselineWitness);
   }catch(error){fail('original report',error);}
   try{const profile=await readFile(resolve(output,'renderer.cpuprofile'));evidence.cpuProfileSha256=sha256(profile);
    const result=await summarizeTraceFile(resolve(output,'browser-trace.json'),JSON.parse(profile),evidence.pageEvidence,{createAccumulator:createTraceSummaryAccumulator});
    evidence.traceSha256=result.sha256;evidence.traceReceipt=result.receipt;evidence.summary=result.summary;
   }catch(error){if(error.traceReceipt){evidence.traceReceipt=error.traceReceipt;evidence.traceSha256=error.traceReceipt.sha256;}fail('raw evidence summary',error);}
   if(evidence.launches.length!==1||evidence.pages.filter(p=>p.observedGame).length!==1)fail('target identity',Error('Expected one original Metal launch and one original observed game target'));
   if(!armed||!evidence.scriptReceipts.length)fail('source identity',Error('Capture was not armed or browser-consumed script receipts are missing'));
   if(evidence.previewAtArm?.polyhavenRockReview!=='loaded'||evidence.pageEvidence?.previewRuntime?.polyhavenRockReview!=='loaded')fail('preview identity',Error('Preview runtime marker missing at capture boundaries'));
   try{verifyPageObservations(evidence.pageEvidence);}catch(error){fail('page observation coverage',error);}
   try{verifyTraceControls(evidence);}catch(error){fail('trace controls',error);}
   evidence.verdict=diagnosticVerdict({source,report,traceComplete:evidence.traceComplete,summary:evidence.summary,errors:evidence.errors,stop:evidence.stop});
   evidence.status='finished';await persist();return evidence;
  })();return finishing;
 }

 observeAsync(chromium,'launch',{onError:error=>fail('launch observer',error),after:async(browser,args)=>{
  evidence.launches.push(args[0]);
  observeAsync(browser,'close',{before:finish,settled:closeTimelineObservation,onError:error=>fail('browser close observer',error)});
  observeAsync(browser,'newPage',{onError:error=>fail('newPage observer',error),after:async(page,args)=>{
   const entry={options:args[0]??null,observedGame:false};evidence.pages.push(entry);
   if(gamePage||args[0]?.viewport?.width!==1440||args[0]?.viewport?.height!==900)return;
   assert.deepEqual(args,[{viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'}],'Original desktop page options changed');
   gamePage=page;entry.observedGame=true;await page.addInitScript(installPageEvidence,{prefix:MARKER_PREFIX});
   // The frozen c722 driver registers its own handlers immediately before goto.
   // These independent mirrors begin at that same first navigation and never
   // edit the driver's report. The GPS helper's first synchronous page.url()
   // follows baseline evaluation with no intervening await or browser action.
   page.on('pageerror',error=>{if(sourceObservation)sourceErrors.push(error.message);});
   page.on('console',message=>{if(sourceObservation&&message.type()==='error')sourceErrors.push(message.text());});
   page.on('response',response=>{if(sourceObservation&&response.status()>=400)sourceErrors.push('HTTP '+response.status()+' '+response.url());});
   page.on('requestfailed',request=>{if(sourceObservation)sourceFailedRequests.push((request.failure()?.errorText||'failed')+' '+request.url());});
   observeSync(page,'url',{onError:error=>fail('pre-GPS boundary',error),after:value=>{
    if(evidence.baselineWitness||!stopping)return;
    assert(isGameUrl(value),'Pre-GPS URL changed');
    evidence.baselineWitness={boundary:'first-page-url-after-native-w-keyup',hostMs:performance.now(),errors:[...sourceErrors],failedRequests:[...sourceFailedRequests]};
   }});
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
    evidence.contextClose={requestedHostMs:performance.now(),nativeAllowedHostMs:null,settledHostMs:null};
    try{
     if(!stopping){fail('context close',Error('Game context closed before native collection stop'));await stop('context-close-fallback');}
     await stopping;evidence.contextCloseAfterStop=true;
     if(flushing)await bounded(flushing,'context trace completion/flush',Math.max(0,evidence.traceCompletion.deadlineHostMs-performance.now()));
     await bounded(Promise.allSettled([...responseTasks]),'asset receipts before native context close',Math.max(0,evidence.traceCompletion.deadlineHostMs-performance.now()));
    }finally{evidence.contextClose.nativeAllowedHostMs=performance.now();void persist();}
   },settled:async()=>{evidence.contextClose.settledHostMs=performance.now();await persist();}});
   page.on('response',response=>{
    // The trace covers startup and the original ride; subsequent GPS responses
    // belong to the untouched driver's own reports, outside this asset window.
    if(stopping)return;
    let url;try{url=new URL(response.url());}catch(error){fail('asset receipt URL',error);return;}
    const receipt={url:response.url(),status:response.status(),mimeType:response.headers()['content-type']??null,observedHostMs:performance.now(),phase:stopping?'after-native-keyup':armed?'during-capture':'before-capture',receivedBy:'browser-response-body',complete:false};
    evidence.assetReceipts.push(receipt);
    const task=(async()=>{await assetSlot();try{
     const remaining=evidence.traceCompletion.deadlineHostMs===null?15000:Math.min(15000,evidence.traceCompletion.deadlineHostMs-performance.now());
     assert(remaining>0,'Asset receipt exceeded the unchanged post-stop collection deadline');
     assert(isGameUrl(evidence.gameUrl),'Missing original game origin');
     const origin=new URL(evidence.gameUrl).origin,embedded=url.protocol==='blob:';
     const resourceUrl=embedded?new URL(url.pathname):url;
     assert(resourceUrl.protocol==='http:'&&resourceUrl.origin===origin&&!resourceUrl.username&&!resourceUrl.password&&!url.hash&&(!embedded||(!url.search&&!resourceUrl.search&&!resourceUrl.hash)),'Unbound nonlocal asset: '+response.url());
     receipt.kind=embedded?'embedded-blob':'http-file';
     const name=embedded?response.url():decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
     if(!embedded&&name==='favicon.ico'&&response.status()===204){Object.assign(receipt,{file:null,bytes:0,sha256:sha256(Buffer.alloc(0)),complete:true,expectedEmptyResponse:true});return;}
     const expected=embedded?null:source.files.find(row=>row.file===name);if(!embedded)assert(expected,'Unbound application asset: '+name);assert.equal(response.status(),200,'Asset response failed');
     receipt.bodyStartedHostMs=performance.now();receipt.bodyPhase=stopping?'after-native-keyup':armed?'during-capture':'before-capture';
     const bytes=await bounded(response.body(),'asset body '+name,remaining);
     const digest=sha256(bytes),file='assets/'+digest+'.bin';await mkdir(resolve(output,'assets'),{recursive:true});await writeFile(resolve(output,file),bytes);
     Object.assign(receipt,{file,bytes:bytes.length,sha256:digest,bodyFinishedHostMs:performance.now()});
     receipt.deadlineExceeded=evidence.traceCompletion.deadlineHostMs!==null&&receipt.bodyFinishedHostMs>evidence.traceCompletion.deadlineHostMs;
     assert(!receipt.deadlineExceeded,'Asset body/write completed after the unchanged absolute 60-second collection deadline; bytes retained');
     if(embedded){
      receipt.embeddedMatches=matchEmbeddedImage(source.embeddedImageIndex,bytes,receipt.mimeType);
      assert(receipt.embeddedMatches.length>0,'Blob payload does not match a verified embedded image');
     }else{assert.equal(bytes.length,expected.bytes,'Asset length mismatch');assert.equal(digest,expected.sha256,'Consumed asset hash mismatch');}
     receipt.bindingFinishedHostMs=performance.now();
     receipt.deadlineExceeded=evidence.traceCompletion.deadlineHostMs!==null&&receipt.bindingFinishedHostMs>evidence.traceCompletion.deadlineHostMs;
     assert(!receipt.deadlineExceeded,'Asset source binding completed after the unchanged absolute 60-second collection deadline; bytes retained');receipt.complete=true;
     if(!embedded&&url.pathname.endsWith('.js'))evidence.scriptReceipts.push({...receipt});
    }finally{assetRelease();}})().catch(error=>{receipt.error=errorText(error);fail('asset receipt',error);});responseTasks.add(task);task.finally(()=>responseTasks.delete(task));
   });
   observeAsync(page,'goto',{onError:error=>fail('navigation observer',error),before:args=>{assert(isGameUrl(args[0]),'Original full game navigation changed');assert.equal(evidence.gameUrl,null,'Original game page navigated more than once');evidence.gameUrl=args[0];sourceObservation=true;},after:async(_result,args)=>{
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
  // Keep the original one launch-time query. Empty/malformed/error enumeration
  // is advisory; actual literal-gpu coverage must be present in the raw ride.
  const query={method:'Tracing.getCategories',params:{},startedHostMs:performance.now(),finishedHostMs:null,responseReceived:false,response:null,error:null};
  const categories=evidence.categories={available:null,requested:[...TRACE_CATEGORIES],enumerationAdvisory:true,wellFormed:false,gpuAdvertised:false,query};
  try{query.response=await cdp(browserSession,query.method,query.params);query.responseReceived=true;
   categories.available=Array.isArray(query.response?.categories)?query.response.categories:null;
   categories.wellFormed=categories.available!==null&&categories.available.every(value=>typeof value==='string'&&value.length>0);
   categories.gpuAdvertised=categories.wellFormed&&categories.available.includes('gpu');
  }catch(error){query.error=errorText(error);evidence.unsupported.push({method:query.method,error:query.error});}
  finally{query.finishedHostMs=performance.now();}
  await persist();
  browserSession.on('Tracing.bufferUsage',value=>{if(evidence.bufferUsage.length<1024)evidence.bufferUsage.push({...value,observedHostMs:performance.now()});else evidence.droppedBufferUsage++;});
 }});
 return {evidence,finish,stop,arm};
}
