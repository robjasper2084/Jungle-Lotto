/** Bounded browser host/service observation. Never enables GPU device timers. */
import assert from 'node:assert/strict';
import {open,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';

const requestedCategories=[
  'toplevel','renderer.scheduler','cc','viz','gpu','rail','blink.user_timing'
];
const forbiddenCategories=[
  'disabled-by-default-gpu.device','disabled-by-default-viz.gpu_composite_time','disabled-by-default-gpu.service',
  'disabled-by-default-devtools.screenshot','disabled-by-default-devtools.timeline.screenshot','disabled-by-default-devtools.video_screenshot'
];
export function selectHostTraceCategories(available){
  const supported=new Set(available);
  const included=requestedCategories.filter(name=>supported.has(name));
  assert(included.includes('blink.user_timing'),'Trace must support exact page clock markers');
  assert(included.includes('gpu'),'GPU host/service events are required');
  assert(included.some(name=>name==='toplevel'||name==='renderer.scheduler'),'Host scheduling events are required');
  return {included,excluded:[...forbiddenCategories],missing:requestedCategories.filter(name=>!supported.has(name))};
}
export async function drainTraceStream(session,handle,path,maxBytes=256*1024*1024){
  let file;
  let bytes=0,reads=0;const started=Date.now();
  try{
    file=await open(path,'wx');
    for(;;){
      assert(reads<4096&&Date.now()-started<60000,'Trace export exceeded its read or wall-time bound');
      const chunk=await session.send('IO.read',{handle,size:1048576});reads++;
      const data=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');
      assert(bytes+data.length<=maxBytes,'Trace export exceeds its explicit byte limit');
      await file.writeFile(data);bytes+=data.length;
      if(chunk.eof)break;
      assert(data.length>0,'Trace stream returned an empty nonterminal chunk');
    }
  }finally{
    try{await file?.close();}finally{await session.send('IO.close',{handle});}
  }
  return {bytes,reads,maxBytes};
}
async function deadline(promise,label,milliseconds=15000){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
async function pageClockMarker(page,name){
  return deadline(page.evaluate(name=>{
    const mark=performance.mark(name);
    return {name,startTimeMs:mark.startTime,timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallMs:Date.now()};
  },name),'Page trace clock marker');
}
export function summarizeHostTrace(trace,clockMarkers){
  assert(Array.isArray(trace.traceEvents),'JSON trace events are required');
  const categories={},phases={},processes={},threads={},durationEvents=[],gpuNames=new Set();
  const matches=clockMarkers.map(marker=>({marker,events:[]}));
  let firstTs=Infinity,lastTs=-Infinity;
  for(const event of trace.traceEvents){
    categories[event.cat??'']=(categories[event.cat??'']??0)+1;
    phases[event.ph??'']=(phases[event.ph??'']??0)+1;
    if(event.ph==='M'&&event.name==='process_name')processes[event.pid]=event.args?.name??null;
    if(event.ph==='M'&&event.name==='thread_name')threads[event.pid+':'+event.tid]=event.args?.name??null;
    if(Number.isFinite(event.ts)){firstTs=Math.min(firstTs,event.ts);lastTs=Math.max(lastTs,event.ts+(event.dur??0));}
    if(String(event.cat).includes('gpu')&&gpuNames.size<200)gpuNames.add(event.name);
    for(const match of matches){
      if(!String(event.cat).includes('blink.user_timing'))continue;
      if(event.name===match.marker.name||event.args?.markName===match.marker.name||event.args?.data?.markName===match.marker.name)
        match.events.push({ts:event.ts,pid:event.pid,tid:event.tid,phase:event.ph,name:event.name});
    }
    if(event.ph==='X'&&Number.isFinite(event.dur)&&event.dur>=1000){
      const row={name:event.name,category:event.cat,pid:event.pid,tid:event.tid,startUs:event.ts,durationMs:event.dur/1000};
      let index=durationEvents.findIndex(existing=>existing.durationMs<row.durationMs);
      if(index===-1)index=durationEvents.length;
      if(index<100){durationEvents.splice(index,0,row);if(durationEvents.length>100)durationEvents.pop();}
    }
  }
  const alignment=matches.map(({marker,events})=>{
    const event=events.find(event=>Number.isFinite(event.ts));
    return {...marker,traceMatches:events,offsetMs:event?event.ts/1000-marker.startTimeMs:null};
  });
  const offsets=alignment.map(row=>row.offsetMs).filter(Number.isFinite);
  const bothMarkersRetained=alignment.length===2&&offsets.length===2;
  const clockOffsetDifferenceMs=bothMarkersRetained?offsets[1]-offsets[0]:null;
  const alignmentToleranceMs=1;
  const alignmentValid=bothMarkersRetained&&Number.isFinite(alignment[0].timeOriginMs)&&alignment[0].timeOriginMs===alignment[1].timeOriginMs&&
    alignment[1].startTimeMs>alignment[0].startTimeMs&&Math.abs(clockOffsetDifferenceMs)<=alignmentToleranceMs;
  return {eventCount:trace.traceEvents.length,categories,phases,processes,threads,gpuEventNames:[...gpuNames],
    firstTraceTimeUs:Number.isFinite(firstTs)?firstTs:null,lastTraceTimeUs:Number.isFinite(lastTs)?lastTs:null,
    alignment,bothMarkersRetained,alignmentValid,alignmentToleranceMs,
    clockOffsetDifferenceMs,largestCompleteHostEvents:durationEvents,
    note:'Trace timestamps are monotonic microseconds. Subtract the measured offset to align with the original performance.now ledger; do not subtract epoch timeOrigin or rescale. Listed X durations are overlapping host/service spans, not GPU execution times. B/E and async spans remain in the raw trace.'};
}
export async function prepareHostServiceTrace(browser,page,caseName){
  const native=await deadline(browser.newBrowserCDPSession(),'Browser CDP session');
  const session={send:(method,params)=>deadline(native.send(method,params),method),
    on:(method,listener)=>native.on(method,listener),once:(method,listener)=>native.once(method,listener),
    detach:()=>deadline(native.detach(),'CDP detach',5000)};
  try{
  const metadata={version:1,status:'preparing',scope:'CPU host/service submission and browser scheduling; not GPU execution timing',
    browser:await session.send('Browser.getVersion'),system:await session.send('SystemInfo.getInfo'),
    processesAtStart:await session.send('SystemInfo.getProcessInfo'),clockMarkers:[],bufferUsage:{samples:0,maxPercentFull:0,maxEventCount:0},
    note:'A separate query-off case starts this trace after 60 seconds of genuine held input. GPU device timers, per-command service tracing, screenshots, sampling and systrace are disabled. The late traced interval includes trace overhead and is not interchangeable with the untraced pair.'};
  const {categories}=await session.send('Tracing.getCategories');
  metadata.categories=selectHostTraceCategories(categories);
  metadata.config={transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',tracingBackend:'chrome',bufferUsageReportingInterval:1000,
    traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:65536,enableSampling:false,enableSystrace:false,
      includedCategories:metadata.categories.included,excludedCategories:metadata.categories.excluded}};
  session.on('Tracing.bufferUsage',event=>{
    metadata.bufferUsage.samples++;
    metadata.bufferUsage.maxPercentFull=Math.max(metadata.bufferUsage.maxPercentFull,event.percentFull??event.value??0);
    metadata.bufferUsage.maxEventCount=Math.max(metadata.bufferUsage.maxEventCount,event.eventCount??0);
  });
  let complete;
  const completed=new Promise(resolve=>{complete=resolve;});
  session.once('Tracing.tracingComplete',event=>complete(event));
  const markerPrefix='belle-'+caseName+'-'+Date.now();
  let attempted=false,recording=false,ended=false,endRequested=false;metadata.status='prepared';
  return {metadata,async start(){
    assert(!attempted&&!ended,'Trace starts exactly once');attempted=true;
    await session.send('Tracing.start',metadata.config);recording=true;metadata.status='recording';
    metadata.clockMarkers.push(await pageClockMarker(page,markerPrefix+'-trace-start'));
  },async stop(output){
    if(ended)return metadata;ended=true;
    let streamHandle,streamOwnedByDrain=false;
    try{
      if(!attempted){metadata.status='not-started';return metadata;}
      try{metadata.clockMarkers.push(await pageClockMarker(page,markerPrefix+'-trace-end'));}
      catch(error){metadata.markerError=String(error);}
      try{metadata.processesAtFinish=await session.send('SystemInfo.getProcessInfo');}
      catch(error){metadata.processSnapshotError=String(error);}
      endRequested=true;await session.send('Tracing.end');
      let timer;
      const completion=await Promise.race([completed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Trace completion timed out')),30000);})]).finally(()=>clearTimeout(timer));
      metadata.completion=completion;
      assert(completion.stream,'Browser did not return its trace stream');
      streamHandle=completion.stream;
      assert.equal(completion.traceFormat,'json','Unexpected trace stream format');
      assert.equal(completion.streamCompression,'gzip','Unexpected trace stream compression');
      metadata.file='host-service-trace.json.gz';
      streamOwnedByDrain=true;
      metadata.export=await drainTraceStream(session,completion.stream,resolve(output,metadata.file));
      const compressed=await readFile(resolve(output,metadata.file));
      const decoded=gunzipSync(compressed,{maxOutputLength:512*1024*1024});
      metadata.export.decodedBytes=decoded.length;metadata.export.maxDecodedBytes=512*1024*1024;
      metadata.summary=summarizeHostTrace(JSON.parse(decoded.toString('utf8')),metadata.clockMarkers);
      metadata.completeInterval=recording&&completion.dataLossOccurred===false&&metadata.bufferUsage.maxPercentFull<1&&metadata.summary.bothMarkersRetained;
      metadata.alignmentValid=metadata.summary.alignmentValid;
      metadata.status=metadata.completeInterval&&metadata.alignmentValid?'complete':'incomplete';
      return metadata;
    }catch(error){
      metadata.status='failed';metadata.error=String(error?.stack??error);
      if(streamHandle&&!streamOwnedByDrain)await session.send('IO.close',{handle:streamHandle}).catch(cleanup=>{metadata.streamCloseError=String(cleanup);});
      if(attempted&&!endRequested){endRequested=true;await session.send('Tracing.end').catch(cleanup=>{metadata.endError=String(cleanup);});}
      throw error;
    }
    finally{await session.detach().catch(error=>{metadata.detachError=String(error);});}
  }};
  }catch(error){await session.detach().catch(()=>{});throw error;}
}
