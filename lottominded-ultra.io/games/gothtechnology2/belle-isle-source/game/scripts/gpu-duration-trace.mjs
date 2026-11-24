/** Bounded host scheduling evidence, not GPU execution attribution or release acceptance.
 * No GL calls, renderer hooks, extra renders, GPU-device categories or tracing flags. */
import {createHash,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const GPU_TRACE_CATEGORIES=Object.freeze(['toplevel','devtools.timeline','blink.user_timing','gpu','cc','viz']);
export const GPU_TRACE_LIMITS=Object.freeze({windowMs:10000,bufferKiB:16384,rawBytes:32*1024*1024,
 readBytes:64*1024,reads:1024,commandMs:5000,completionMs:10000,drainMs:15000,stopGraceMs:1000,
 categoryCount:2048,categoryLength:256,usageReceipts:32,errorCount:32,samples:256,callsPerSample:12});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const errorText=error=>String(error?.stack||error).slice(0,2048);

/** Passed directly to page.evaluate once, outside the game loop. Date.now is not a trace clock. */
export function markGpuTraceClock(name){
 const before=performance.now(),entry=performance.mark(name),after=performance.now();
 const receipt={name,pageTimeOriginMs:performance.timeOrigin,pageNowBeforeMs:before,markStartTimeMs:entry.startTime,pageNowAfterMs:after};
 performance.clearMarks(name);
 return receipt;
}

/** Inspect the retained JSON independently; a category inventory is only advisory. */
export function inspectGpuTrace(raw,marker,samples=[],observationMode='read-msaa'){
 const errors=[],events=JSON.parse(raw.toString('utf8'))?.traceEvents;
 if(!Array.isArray(events))throw Error('Export has no traceEvents array');
 if(observationMode!=='read-msaa'&&observationMode!=='omit-msaa')errors.push('Unknown GPU observation mode');
 const categories=new Set(),markers=[],forbiddenReceipts=[],coverage={mainThread:0,gpu:0,compositor:0},names={mainThread:new Set(),gpu:new Set(),compositor:new Set()};
 let forbiddenCount=0;
 let firstUs=Infinity,lastUs=-Infinity;
 const timed=event=>event&&event.ph!=='M'&&finite(event.ts)&&event.ts>=0;
 const cats=event=>typeof event.cat==='string'?event.cat.split(','):[];
 for(const event of events){
  // Verify the actual export, including untimed metadata, independently of the
  // requested filter. Ordinary CPU TimerFire/memory-task names remain allowed.
  const tokens=cats(event??{}),forbidden=tokens.filter(cat=>/^(?:disabled-by-default-)?(?:devtools(?:\.timeline)?\.(?:screenshot|video_screenshot)|memory-infra|gpu\.(?:device|timer))(?:[.:_-]|$)/i.test(cat));
  const capture=event?.name==='Screenshot'||(['v','V'].includes(event?.ph)&&event?.args&&Object.hasOwn(event.args,'dumps'));
  if(forbidden.length||capture){
   forbiddenCount++;
   if(forbiddenReceipts.length<32)forbiddenReceipts.push({name:typeof event?.name==='string'?event.name.slice(0,256):null,
    phase:typeof event?.ph==='string'?event.ph.slice(0,8):null,categories:forbidden.slice(0,16).map(cat=>cat.slice(0,256)),captureShape:!!capture});
  }
  if(!timed(event))continue;
  for(const cat of cats(event))if(categories.size<256)categories.add(cat);else if(!categories.has(cat)&&!errors.includes('Exported category inventory exceeds 256'))errors.push('Exported category inventory exceeds 256');
  firstUs=Math.min(firstUs,event.ts);lastUs=Math.max(lastUs,event.ts);
  if(event.name===marker?.name&&cats(event).includes('blink.user_timing')&&['R','I','i'].includes(event.ph)&&
   Number.isSafeInteger(event.pid)&&event.pid>=0&&Number.isSafeInteger(event.tid)&&event.tid>=0)markers.push(event);
 }
 if(forbiddenCount)errors.push('Forbidden screenshot, memory-dump or GPU-device/timer evidence appeared in the raw export');
 const unique=new Map(markers.map(event=>[JSON.stringify([event.pid,event.tid,event.ts]),event]));
 const validMarker=marker&&finite(marker.pageTimeOriginMs)&&finite(marker.pageNowBeforeMs)&&finite(marker.markStartTimeMs)&&finite(marker.pageNowAfterMs)&&
  marker.pageNowBeforeMs<=marker.markStartTimeMs&&marker.markStartTimeMs<=marker.pageNowAfterMs;
 if(!validMarker)errors.push('Page clock marker receipt is missing or invalid');
 if(unique.size!==1)errors.push('Expected one unambiguous exported User Timing clock marker; found '+unique.size);
 const anchor=validMarker&&unique.size===1?[...unique.values()][0]:null;
 const offset=anchor?anchor.ts-marker.markStartTimeMs*1000:null;
 const mappedCalls=[];
 for(const event of events){
  if(!timed(event)||!['X','B','E','b','e'].includes(event.ph))continue;
  const tokens=cats(event),groups=[];
  if(anchor&&event.pid===anchor.pid&&event.tid===anchor.tid&&tokens.some(cat=>cat==='toplevel'||cat==='devtools.timeline'))groups.push('mainThread');
  if(tokens.includes('gpu'))groups.push('gpu');
  if(tokens.some(cat=>cat==='cc'||cat==='viz'))groups.push('compositor');
  for(const group of groups){coverage[group]++;if(names[group].size<24&&typeof event.name==='string')names[group].add(event.name.slice(0,256));}
 }
 for(const [group,count]of Object.entries(coverage))if(!count)errors.push('Missing actual exported '+group+' event coverage');
 if(!Array.isArray(samples)||samples.length>GPU_TRACE_LIMITS.samples)errors.push('GPU sample inventory exceeds its existing bound');
 for(const row of (Array.isArray(samples)?samples:[]).slice(0,GPU_TRACE_LIMITS.samples)){
  const calls=Array.isArray(row?.apiWall?.calls)?row.apiWall.calls:[];
  if(calls.length>GPU_TRACE_LIMITS.callsPerSample)errors.push('GPU call inventory exceeds its existing bound');
  if(observationMode==='omit-msaa'&&calls.some(call=>call?.stage==='issue.samples'||call?.stage==='issue.sampleBuffers'))errors.push('Omission mode retained a forbidden MSAA getter receipt');
  if(offset===null)continue;
  for(const call of calls.slice(0,GPU_TRACE_LIMITS.callsPerSample)){
   if(!finite(call?.startMs)||!finite(call.endMs)||call.endMs<call.startMs)continue;
   const startUs=call.startMs*1000+offset,endUs=call.endMs*1000+offset;
   if(endUs<firstUs||startUs>lastUs)continue;
   mappedCalls.push({sample:row.sample,callback:row.callback,stage:call.stage,phase:call.phase,
    pageStartMs:call.startMs,pageEndMs:call.endMs,traceStartUs:startUs,traceEndUs:endUs,
    fullyInsideObservedEventSpan:startUs>=firstUs&&endUs<=lastUs});
  }
 }
 if(observationMode==='omit-msaa'){
  const required=['issue.createQuery','issue.beginQuery','close.endQuery'];
  if(!mappedCalls.some(row=>required.every(stage=>mappedCalls.some(call=>call.sample===row.sample&&call.stage===stage&&call.fullyInsideObservedEventSpan))))
   errors.push('No complete unchanged query issue/close receipt group overlaps the omission trace');
 }else for(const stage of ['issue.samples','issue.sampleBuffers'])if(!mappedCalls.some(call=>call.stage===stage&&call.fullyInsideObservedEventSpan))
  errors.push('No complete '+stage+' receipt overlaps the exported event span');
 return {eventCount:events.length,observationMode,exportedCategories:[...categories].sort(),coverage,
  forbiddenEvidence:{count:forbiddenCount,receipts:forbiddenReceipts,dropped:forbiddenCount-forbiddenReceipts.length},
  representativeEventNames:Object.fromEntries(Object.entries(names).map(([key,value])=>[key,[...value]])),
  observedEventSpan:finite(firstUs)?{firstUs,lastUs,spanMs:(lastUs-firstUs)/1000}:null,
  clock:anchor?{markerName:marker.name,pid:anchor.pid,tid:anchor.tid,traceMarkerUs:anchor.ts,pageMarkMs:marker.markStartTimeMs,
   pageTimeOriginMs:marker.pageTimeOriginMs,traceUsMinusPageMsTimes1000:offset,
   pageBracketWidthMs:marker.pageNowAfterMs-marker.pageNowBeforeMs,
   note:'Single User Timing anchor in this page. Timestamp precision and trace serialization add uncertainty; the page bracket is not a bound on every trace timestamp. Date.now and the Node clock are not equated to the trace clock.'}:null,
  mappedCalls,errors:[...new Set(errors)].slice(0,GPU_TRACE_LIMITS.errorCount),
  note:'Coverage counts timed category events, including unpaired B/E endpoints. GPU/compositor category counts do not establish GPU-process identity or execution duration. API call wall spans are mapped observations, not proof of CPU execution, GPU work or a causal wait. The first/last exported event timestamps are observed coverage, not exact recording start/stop. No per-command attribution is invented.'};
}

/** All protocol activity is opt-in at the caller. Timers stop recording during the
 * existing ride; finish is called only after ride/counter/profile snapshots. */
export function createGpuDurationTrace({output,createSession,markClock,browserVersion,environment,observationMode='read-msaa',
 clock=()=>performance.now(),timers={setTimeout,clearTimeout},save=writeFile}){
 const config={transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',bufferUsageReportingInterval:1000,
  traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:GPU_TRACE_LIMITS.bufferKiB,enableSampling:false,enableSystrace:false,
   includedCategories:[...GPU_TRACE_CATEGORIES],excludedCategories:['*']}};
 const meta={version:1,enabled:true,complete:false,status:'not-started',environment,observationMode,browserVersion:null,
  limits:{...GPU_TRACE_LIMITS},requestedConfig:config,categoryInventory:null,advertisedRequested:[],notAdvertisedRequested:[],
  categoryDiscoveryNote:'Tracing.getCategories is advisory. The fixed narrow request is never broadened; actual exported spans and the clock marker establish coverage.',
  ownership:'none',timing:{clock:'Node performance.now; no equality to page or trace clock assumed',createdMs:clock()},
  buffer:{receipts:[],dropped:0,peak:null,dataLossOccurred:null},marker:null,stream:null,
  raw:{file:'gpu-duration-trace.json',bytes:0,sha256:null,reads:0,eof:false},analysis:null,
  errors:[],droppedErrors:0,cleanup:{detached:false,streamClosed:false,stopUncertain:false},
  uncertainty:'Tracing adds host observer overhead. Requested window and Node command times bracket protocol activity only. No GPU-device/timer tracing categories, screenshot/memory-dump capture, decoder flags or game-loop markers are enabled.'};
 let session=null,owned=false,starting=false,pendingComplete=null,completion=null,completeResolve,stopTimer=null,endTask=null,finishTask=null,finalized=false;
 const completePromise=new Promise(ok=>{completeResolve=ok;});
 const addError=(label,error)=>{if(finalized)return;const value=label+(error===undefined?'':': '+errorText(error));
  if(meta.errors.includes(value))return;if(meta.errors.length<GPU_TRACE_LIMITS.errorCount)meta.errors.push(value);else meta.droppedErrors++;};
 const bounded=(task,label,ms=GPU_TRACE_LIMITS.commandMs)=>new Promise((ok,fail)=>{
  let settled=false;const timer=timers.setTimeout(()=>{settled=true;const error=Error(label+' timed out after '+ms+' ms');error.code='TRACE_TIMEOUT';fail(error);},ms);
  Promise.resolve(task).then(value=>{if(settled)return;settled=true;timers.clearTimeout(timer);ok(value);},error=>{if(settled)return;settled=true;timers.clearTimeout(timer);fail(error);});
 });
 const command=(method,params={})=>bounded(Promise.resolve().then(()=>session.send(method,params)),method);
 const onComplete=event=>{
  if(finalized)return;
  if(!owned){if(starting)pendingComplete=event;return;}
  if(completion){addError('Duplicate tracingComplete event');return;}
  completion={dataLossOccurred:event.dataLossOccurred,stream:typeof event.stream==='string'?event.stream:null,
   traceFormat:event.traceFormat??null,streamCompression:event.streamCompression??null};
  meta.timing.completeMs=clock();meta.buffer.dataLossOccurred=event.dataLossOccurred;meta.stream={...completion};
  if(event.dataLossOccurred!==false)addError('Trace reported data loss or omitted its loss receipt');
  if(!completion.stream)addError('ReturnAsStream completion omitted its stream');
  if(event.traceFormat!==undefined&&event.traceFormat!=='json')addError('Unsupported exported trace format');
  if(event.streamCompression!==undefined&&event.streamCompression!=='none')addError('Unsupported exported trace compression');
  completeResolve(completion);
 };
 const onUsage=event=>{
  if(finalized||(!owned&&!starting))return;
  const value=event.percentFull??event.value;
  if(!finite(value)||value<0||value>1)addError('Invalid trace buffer usage receipt');
  else{meta.buffer.peak=Math.max(meta.buffer.peak??0,value);if(value>=1)addError('Trace buffer filled; recordUntilFull may have truncated coverage');}
  const receipt={atMs:clock(),percentFull:finite(value)?value:null,eventCount:Number.isSafeInteger(event.eventCount)?event.eventCount:null};
  if(meta.buffer.receipts.length<GPU_TRACE_LIMITS.usageReceipts)meta.buffer.receipts.push(receipt);
  else{meta.buffer.dropped++;addError('Trace buffer-usage receipt bound exceeded');}
 };
 const onData=()=>addError('Unexpected ReportEvents payload in ReturnAsStream mode');
 async function detach(){
  if(!session||meta.cleanup.detached)return;
  session.off('Tracing.tracingComplete',onComplete);session.off('Tracing.bufferUsage',onUsage);session.off('Tracing.dataCollected',onData);
  try{await bounded(session.detach(),'CDP session detach');meta.cleanup.detached=true;}catch(error){addError('Dedicated session detach failed',error);}
 }
 function stop(reason){
  if(endTask)return endTask;
  if(!owned)return Promise.resolve();
  timers.clearTimeout(stopTimer);stopTimer=null;
  meta.timing.endReason=reason;meta.timing.endRequestMs=clock();
  if(reason==='node-window-timer'){
   meta.timing.stopTimerLatenessMs=Math.max(0,meta.timing.endRequestMs-meta.timing.plannedEndMs);
   if(meta.timing.stopTimerLatenessMs>GPU_TRACE_LIMITS.stopGraceMs)addError('Node stop timer exceeded its scheduling bound');
  }else addError('Recording ended before the requested Node-timed window');
  endTask=(async()=>{
   try{
    await command('Tracing.end');if(!finalized)meta.timing.endAcknowledgedMs=clock();
    // Watch completion without draining. A failed stop cannot keep recording
    // until the 90-second workload ends merely because finish has not run yet.
    if(!completion)await bounded(completePromise,'Tracing.tracingComplete',GPU_TRACE_LIMITS.completionMs);
   }catch(error){
    addError('Trace stop failed',error);
    if(!completion){meta.cleanup.stopUncertain=true;meta.timing.stopUncertainMs=clock();await detach();}
   }
  })();
  return endTask;
 }
 async function start(){
  if(meta.status!=='not-started')throw Error('Trace start may be attempted only once');
  meta.status='starting';
  try{
   if(observationMode!=='read-msaa'&&observationMode!=='omit-msaa')throw Error('Unknown GPU observation mode');
   if(environment.platform!=='darwin'||environment.device!=='desktop'||environment.mode!=='full'||environment.requestedSeconds!==90||environment.renderBackend!=='angle-metal'||
    !/ANGLE/i.test(environment.actualGpu?.renderer??'')||!/Metal/i.test(environment.actualGpu?.renderer??'')||/SwiftShader|llvmpipe|softpipe|software/i.test(environment.actualGpu?.renderer??''))
    throw Error('Trace requires the 90-second desktop full-scene native ANGLE/Metal workload on darwin');
   meta.browserVersion=browserVersion();
   let abandoned=false;const opening=Promise.resolve().then(createSession);
   opening.then(late=>{if(abandoned)Promise.resolve().then(()=>late.detach()).catch(()=>{});},()=>{});
   try{session=await bounded(opening,'Create dedicated CDP session');}catch(error){abandoned=true;throw error;}
   session.on('Tracing.tracingComplete',onComplete);session.on('Tracing.bufferUsage',onUsage);session.on('Tracing.dataCollected',onData);
   const discovered=(await command('Tracing.getCategories')).categories;
   if(!Array.isArray(discovered)||discovered.length>GPU_TRACE_LIMITS.categoryCount||!discovered.every(value=>typeof value==='string'&&value.length<=GPU_TRACE_LIMITS.categoryLength))
    throw Error('Category discovery returned an invalid or unbounded inventory');
   meta.categoryInventory=[...new Set(discovered)].sort();
   meta.advertisedRequested=GPU_TRACE_CATEGORIES.filter(value=>discovered.includes(value));
   meta.notAdvertisedRequested=GPU_TRACE_CATEGORIES.filter(value=>!discovered.includes(value));
   starting=true;meta.timing.startRequestMs=clock();
   try{await command('Tracing.start',config);}catch(error){meta.ownership=error?.code==='TRACE_TIMEOUT'?'start-uncertain':'rejected';throw error;}
   owned=true;starting=false;meta.ownership='accepted';meta.status='recording';meta.timing.startAcknowledgedMs=clock();
   if(pendingComplete)onComplete(pendingComplete);pendingComplete=null;
   meta.timing.plannedEndMs=meta.timing.startRequestMs+GPU_TRACE_LIMITS.windowMs;
   stopTimer=timers.setTimeout(()=>{void stop('node-window-timer');},Math.max(0,meta.timing.plannedEndMs-clock()));
   const name='belle-gpu-duration-clock-'+randomUUID();
   meta.timing.markerRequestMs=clock();
   meta.marker=await bounded(Promise.resolve().then(()=>markClock(name)),'Page User Timing clock marker');
   meta.timing.markerReceivedMs=clock();
   return true;
  }catch(error){
   starting=false;pendingComplete=null;meta.status='setup-failed';addError('Trace setup failed',error);
   if(owned)await stop('setup-failed');
   else await detach(); // Never end a rejected or uncertain/possibly foreign trace.
   return false;
  }
 }
 function finish(samples=[]){
  if(finishTask)return finishTask;
  finishTask=(async()=>{
   const chunks=[];let raw=Buffer.alloc(0);
   try{
    if(!owned)addError('No accepted trace recording was available');
    else{
     await stop('workload-finished');
     if(!completion&&!meta.cleanup.stopUncertain)await bounded(completePromise,'Tracing.tracingComplete',GPU_TRACE_LIMITS.completionMs);
     if(completion?.stream){
      meta.timing.drainStartedMs=clock();const deadline=meta.timing.drainStartedMs+GPU_TRACE_LIMITS.drainMs;
      while(!meta.raw.eof){
       if(meta.raw.reads>=GPU_TRACE_LIMITS.reads)throw Error('Trace stream read-count bound exceeded');
       const remaining=deadline-clock();if(remaining<=0)throw Error('Trace stream total drain deadline exceeded');
       meta.raw.reads++;
       const reply=await bounded(Promise.resolve().then(()=>session.send('IO.read',{handle:completion.stream,size:GPU_TRACE_LIMITS.readBytes})),
        'IO.read',Math.min(GPU_TRACE_LIMITS.commandMs,remaining));
       if(typeof reply?.data!=='string'||typeof reply.eof!=='boolean'||(reply.base64Encoded!==undefined&&typeof reply.base64Encoded!=='boolean'))throw Error('Invalid IO.read response');
       if(reply.data.length>GPU_TRACE_LIMITS.readBytes*2)throw Error('Trace stream chunk exceeded the requested bound');
       const chunk=Buffer.from(reply.data,reply.base64Encoded?'base64':'utf8');
       if(chunk.length>GPU_TRACE_LIMITS.readBytes)throw Error('Trace stream decoded chunk exceeded the requested bound');
       if(meta.raw.bytes+chunk.length>GPU_TRACE_LIMITS.rawBytes)throw Error('Trace raw-byte bound exceeded');
       chunks.push(chunk);meta.raw.bytes+=chunk.length;meta.raw.eof=reply.eof;
       if(clock()>deadline)throw Error('Trace stream total drain deadline exceeded');
       if(!chunk.length&&!reply.eof)throw Error('Trace stream returned an empty non-EOF chunk');
      }
      meta.timing.drainEndedMs=clock();
     }
    }
   }catch(error){addError('Trace export failed',error);}
   finally{
    timers.clearTimeout(stopTimer);stopTimer=null;
    if(owned&&completion?.stream){
     try{await command('IO.close',{handle:completion.stream});meta.cleanup.streamClosed=true;}catch(error){addError('Trace stream close failed',error);}
    }
    await detach();
   }
   raw=Buffer.concat(chunks);meta.raw.sha256=createHash('sha256').update(raw).digest('hex');
   try{await save(resolve(output,meta.raw.file),raw);}catch(error){addError('Raw trace retention failed',error);}
   if(meta.raw.eof){try{meta.analysis=inspectGpuTrace(raw,meta.marker,samples,observationMode);for(const error of meta.analysis.errors)addError('Trace evidence incomplete',error);}
    catch(error){addError('Trace parse/correlation failed',error);}}
   if(!meta.raw.eof)addError('Trace stream did not reach EOF');
   meta.timing.finalizedMs=clock();
   if(finite(meta.timing.startRequestMs)&&finite(meta.timing.endRequestMs))meta.timing.requestToEndRequestMs=meta.timing.endRequestMs-meta.timing.startRequestMs;
   meta.complete=meta.errors.length===0&&meta.raw.eof&&meta.cleanup.detached&&meta.cleanup.streamClosed;
   meta.status=meta.complete?'complete':'incomplete';
   // Close the receipt before handing it to callers. Late protocol promises
   // have no continuation that mutates this detached result or starts new input.
   finalized=true;const result=structuredClone(meta);
   try{await save(resolve(output,'gpu-duration-trace-metadata.json'),JSON.stringify(result,null,2)+'\n');}
   catch(error){result.complete=false;result.status='incomplete';result.errors.push('Trace metadata retention failed: '+errorText(error));}
   return result;
  })();
  return finishTask;
 }
 return Object.freeze({start,finish});
}
