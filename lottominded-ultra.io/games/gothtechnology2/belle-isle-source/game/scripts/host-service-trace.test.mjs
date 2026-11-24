import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {selectHostTraceCategories,drainTraceStream,summarizeHostTrace,prepareHostServiceTrace} from './host-service-trace.mjs';

test('host tracing excludes device timers, per-command tracing and screenshots even when available',()=>{
  const result=selectHostTraceCategories(['toplevel','gpu','rail','blink.user_timing','cc','viz',
    'disabled-by-default-gpu.device','disabled-by-default-viz.gpu_composite_time','disabled-by-default-gpu.service','disabled-by-default-devtools.screenshot']);
  assert.deepEqual(result.included,['toplevel','renderer.scheduler','cc','viz','gpu','rail','blink.user_timing']);
  assert.deepEqual(result.requested,result.included);
  assert(result.excluded.includes('disabled-by-default-gpu.device'));
  assert(result.excluded.includes('disabled-by-default-viz.gpu_composite_time'));
  assert(result.excluded.includes('disabled-by-default-devtools.video_screenshot'));
  assert.deepEqual(result.missing,['renderer.scheduler']);
  assert(!result.included.some(name=>name.startsWith('disabled-by-default-')));
});
test('category discovery retains grouped names and treats unadvertised categories as unverified',()=>{
  const groups=['gpu,toplevel','blink.user_timing,devtools.timeline',' renderer.scheduler , cc ','gpu'];
  const result=selectHostTraceCategories(groups);
  assert.deepEqual(result.discoveredGroups,groups);
  assert.deepEqual(result.normalizedDiscoveredCategories,['blink.user_timing','cc','devtools.timeline','gpu','renderer.scheduler','toplevel']);
  assert.deepEqual(result.missing,['viz','rail']);
  assert(!result.included.includes('devtools.timeline'));
  assert.deepEqual(selectHostTraceCategories([]).missing,result.requested);
  assert(selectHostTraceCategories(['gpu,toplevel']).included.includes('blink.user_timing'));
  assert.throws(()=>selectHostTraceCategories([null]),/string groups/);
});

async function withOutput(run){
  const directory=await mkdtemp(join(tmpdir(),'belle-trace-test-'));
  try{await run(join(directory,'trace.gz'));}finally{await rm(directory,{recursive:true,force:true});}
}
test('trace stream preserves binary chunks and closes the original stream',async()=>withOutput(async path=>{
  const chunks=[{data:Buffer.from([0,255,128]).toString('base64'),base64Encoded:true,eof:false},{data:'abc',eof:true}];
  const calls=[];const session={async send(method,params){calls.push({method,params});return method==='IO.read'?chunks.shift():{};}};
  const result=await drainTraceStream(session,'original',path,6);
  assert.deepEqual(await readFile(path),Buffer.from([0,255,128,97,98,99]));assert.equal(result.bytes,6);assert.equal(result.reads,2);
  assert.deepEqual(calls.at(-1),{method:'IO.close',params:{handle:'original'}});
  assert(calls.slice(0,-1).every(call=>call.method==='IO.read'&&call.params.handle==='original'&&call.params.size===1048576));
}));
test('trace export refuses overflow without writing the oversized chunk and still closes',async()=>withOutput(async path=>{
  const methods=[];const session={async send(method){methods.push(method);return {data:'oversized',eof:true};}};
  await assert.rejects(drainTraceStream(session,'bounded',path,2),/byte limit/);
  assert.equal((await readFile(path)).length,0);assert.deepEqual(methods,['IO.read','IO.close']);
}));
test('trace export propagates read failures and closes',async()=>withOutput(async path=>{
  let closed=false;const expected=Error('Original IO failure');
  const session={async send(method){if(method==='IO.read')throw expected;closed=true;return {};}};
  await assert.rejects(drainTraceStream(session,'broken',path),error=>error===expected);assert.equal(closed,true);
}));
test('trace export closes the browser stream when the destination cannot be opened',async()=>withOutput(async path=>{
  await writeFile(path,'existing evidence');const methods=[];
  const session={async send(method){methods.push(method);return {};}};
  await assert.rejects(drainTraceStream(session,'unopened',path),{code:'EEXIST'});
  assert.deepEqual(methods,['IO.close']);assert.equal(await readFile(path,'utf8'),'existing evidence');
}));
test('trace export rejects an empty nonterminal stream instead of spinning',async()=>withOutput(async path=>{
  let closed=false;const session={async send(method){if(method==='IO.close'){closed=true;return {};}return {data:'',eof:false};}};
  await assert.rejects(drainTraceStream(session,'empty',path),/empty nonterminal/);assert.equal(closed,true);
}));
test('clock alignment uses monotonic trace marks and retains host metadata without claiming GPU durations',()=>{
  const marks=[{name:'start',startTimeMs:60000,timeOriginMs:1800000000000},{name:'end',startTimeMs:90000,timeOriginMs:1800000000000}];
  const trace={traceEvents:[
    {ph:'M',name:'process_name',pid:7,args:{name:'GPU Process'}},
    {ph:'M',name:'thread_name',pid:7,tid:9,args:{name:'CrGpuMain'}},
    {ph:'I',cat:'blink.user_timing',name:'start',pid:1,tid:2,ts:1060000000},
    {ph:'X',cat:'gpu',name:'Host submit',pid:7,tid:9,ts:1060001000,dur:80000},
    {ph:'X',cat:'toplevel,renderer.scheduler',name:'Main task',pid:1,tid:2,ts:1060001000,dur:10000},
    {ph:'X',cat:'cc',name:'Overlapping host task',pid:1,tid:2,ts:1060001000,dur:120000},
    {ph:'I',cat:'blink.user_timing',name:'end',pid:1,tid:2,ts:1090000000}
  ]};
  const result=summarizeHostTrace(trace,marks);
  assert.equal(result.bothMarkersRetained,true);assert.equal(result.alignmentValid,true);assert.deepEqual(result.alignment.map(row=>row.offsetMs),[1000000,1000000]);
  assert.equal(result.clockOffsetDifferenceMs,0);assert.equal(result.processes[7],'GPU Process');assert.equal(result.threads['7:9'],'CrGpuMain');
  assert.deepEqual(result.eventCoverage,{gpuHostEvents:1,hostSchedulingEvents:1,forbiddenEvents:0,forbiddenObservedCategories:[],complete:true,note:result.eventCoverage.note});
  assert.equal(result.largestCompleteHostEvents[0].durationMs,120);assert.match(result.note,/not GPU execution/);
  assert.equal(summarizeHostTrace({traceEvents:trace.traceEvents.slice(0,-1)},marks).bothMarkersRetained,false);
  assert.equal(summarizeHostTrace(trace,[marks[0],{...marks[1],timeOriginMs:marks[1].timeOriginMs+1}]).alignmentValid,false);
  assert.equal(summarizeHostTrace(trace,[marks[0],{...marks[1],startTimeMs:89998}]).alignmentValid,false);
  const noGpu=summarizeHostTrace({traceEvents:trace.traceEvents.filter(event=>event.cat!=='gpu')},marks);
  assert.equal(noGpu.alignmentValid,true);assert.equal(noGpu.eventCoverage.complete,false);
  const noHost=summarizeHostTrace({traceEvents:trace.traceEvents.filter(event=>event.name!=='Main task')},marks);
  assert.equal(noHost.eventCoverage.complete,false);
  const forbidden=summarizeHostTrace({traceEvents:[...trace.traceEvents,{ph:'X',cat:'gpu,disabled-by-default-gpu.device',name:'Device timer',ts:1060001000,dur:1000}]},marks);
  assert.equal(forbidden.eventCoverage.complete,false);assert.equal(forbidden.eventCoverage.forbiddenEvents,1);
  assert.deepEqual(forbidden.eventCoverage.forbiddenObservedCategories,['disabled-by-default-gpu.device']);
  const metadataOnly=summarizeHostTrace({traceEvents:[...trace.traceEvents.filter(event=>event.cat!=='gpu'),{ph:'M',cat:'gpu',name:'metadata'}]},marks);
  assert.equal(metadataOnly.eventCoverage.gpuHostEvents,0);
  const untimed=summarizeHostTrace({traceEvents:[...trace.traceEvents.filter(event=>event.cat!=='gpu'),{ph:'I',cat:'gpu',name:'Untimed'}]},marks);
  assert.equal(untimed.eventCoverage.gpuHostEvents,0);
});

async function collectedTrace(path,{omitEnd=false,omitGpu=false}={}){
  const calls=[],listeners=new Map(),marks=[];let compressed;
  const native={on(name,listener){listeners.set(name,listener);},once(name,listener){listeners.set(name,listener);},
    async detach(){calls.push({method:'detach'});},async send(method,params){
      calls.push({method,params});
      if(method==='Browser.getVersion')return {product:'Chrome/test'};
      if(method==='SystemInfo.getInfo')return {gpu:{}};
      if(method==='SystemInfo.getProcessInfo')return {processInfo:[]};
      if(method==='Tracing.getCategories')return {categories:['gpu,toplevel','cc','viz','rail']};
      if(method==='Tracing.end'){
        const traceEvents=(omitEnd?marks.slice(0,1):marks).map(mark=>({ph:'I',cat:'blink.user_timing',name:mark.name,pid:1,tid:2,ts:(1000000+mark.startTimeMs)*1000}));
        traceEvents.push({ph:'X',cat:'toplevel',name:'Main task',pid:1,tid:2,ts:1060001000,dur:1000});
        if(!omitGpu)traceEvents.push({ph:'X',cat:'gpu',name:'Host submit',pid:7,tid:9,ts:1060001000,dur:1000});
        compressed=gzipSync(JSON.stringify({traceEvents}));
        listeners.get('Tracing.tracingComplete')({stream:'trace-stream',traceFormat:'json',streamCompression:'gzip',dataLossOccurred:false});
      }
      if(method==='IO.read')return {data:compressed.toString('base64'),base64Encoded:true,eof:true};
      return {};
    }};
  const page={async evaluate(callback,name){
    assert.equal(typeof callback,'function');
    const startTimeMs=marks.length?90000:60000;
    const mark={name,startTimeMs,timeOriginMs:1800000000000,nowMs:startTimeMs,wallMs:1800000000000+startTimeMs};
    marks.push(mark);return mark;
  }};
  const collector=await prepareHostServiceTrace({async newBrowserCDPSession(){return native;}},page,'A2');
  assert.equal(collector.metadata.status,'prepared');assert.equal(calls.some(call=>call.method==='Tracing.start'),false);
  await collector.start();
  const metadata=await collector.stop(dirname(path));
  return {metadata,calls};
}
test('trace collection verifies real markers and host events even when discovery omitted the marker category',async()=>withOutput(async path=>{
  const {metadata,calls}=await collectedTrace(path);
  assert.deepEqual(metadata.categories.discoveredGroups,['gpu,toplevel','cc','viz','rail']);
  assert.deepEqual(metadata.categories.missing,['renderer.scheduler','blink.user_timing']);
  const config=calls.find(call=>call.method==='Tracing.start').params;
  assert.deepEqual(config.traceConfig.includedCategories,metadata.categories.requested);
  assert.equal(config.traceConfig.recordMode,'recordUntilFull');assert.equal(config.traceConfig.traceBufferSizeInKb,65536);
  assert.equal(config.streamCompression,'gzip');assert.equal(config.transferMode,'ReturnAsStream');
  assert.equal(metadata.status,'complete');assert.equal(metadata.alignmentValid,true);assert.equal(metadata.eventCoverage.complete,true);
  assert.equal(metadata.summary.bothMarkersRetained,true);assert.equal(metadata.clockMarkers.length,2);
  assert.deepEqual(calls.slice(-2).map(call=>call.method),['IO.close','detach']);
}));
test('trace collection remains incomplete without the actual end marker',async()=>withOutput(async path=>{
  const {metadata}=await collectedTrace(path,{omitEnd:true});
  assert.equal(metadata.status,'incomplete');assert.equal(metadata.completeInterval,false);assert.equal(metadata.alignmentValid,false);
}));
test('trace collection remains incomplete without actual GPU host coverage',async()=>withOutput(async path=>{
  const {metadata}=await collectedTrace(path,{omitGpu:true});
  assert.equal(metadata.status,'incomplete');assert.equal(metadata.completeInterval,true);assert.equal(metadata.alignmentValid,true);
  assert.equal(metadata.eventCoverage.gpuHostEvents,0);assert.equal(metadata.eventCoverage.complete,false);
}));
