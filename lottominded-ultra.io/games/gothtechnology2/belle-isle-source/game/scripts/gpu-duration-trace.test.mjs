import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createGpuDurationTrace,inspectGpuTrace,GPU_TRACE_CATEGORIES,GPU_TRACE_LIMITS} from './gpu-duration-trace.mjs';

const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return {promise,resolve,reject};}
class Clock {
 now=0;next=1;pending=new Map();
 setTimeout=(fn,ms)=>{const id=this.next++;this.pending.set(id,{at:this.now+ms,fn});return id;};
 clearTimeout=id=>{this.pending.delete(id);};
 async advance(ms){
  const target=this.now+ms;
  for(;;){const next=[...this.pending].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!next)break;this.now=next[1].at;this.pending.delete(next[0]);next[1].fn();await flush();}
  this.now=target;await flush();
 }
}
const sampleRows=()=>[{sample:1,callback:7,apiWall:{calls:[
 {stage:'issue.samples',phase:'issue',startMs:1010,endMs:1100},
 {stage:'issue.sampleBuffers',phase:'issue',startMs:1100,endMs:1120},
 ]}}];
function markerReceipt(name){return {name,pageTimeOriginMs:1700000000000,pageNowBeforeMs:1000,markStartTimeMs:1000.1,pageNowAfterMs:1000.2};}
function traceDocument(marker){return {traceEvents:[
 {name:'thread_name',ph:'M',pid:1,tid:7,args:{name:'CrRendererMain'}},
 {name:'RunTask',cat:'toplevel',ph:'X',pid:1,tid:7,ts:900000,dur:20},
 {name:marker.name,cat:'blink.user_timing',ph:'R',pid:1,tid:7,ts:1000100},
 {name:'FunctionCall',cat:'devtools.timeline',ph:'X',pid:1,tid:7,ts:1010000,dur:120000},
 {name:'GLES2DecoderImpl::DoCommands',cat:'gpu',ph:'X',pid:2,tid:8,ts:1020000,dur:40000},
 {name:'DrawAndSwap',cat:'viz,cc',ph:'X',pid:2,tid:9,ts:1090000,dur:2000},
 {name:'RunTask',cat:'toplevel',ph:'X',pid:1,tid:7,ts:2000000,dur:20},
 ]};}
function fixture(overrides={}){
 const clock=new Clock(),commands=[],saved=new Map();let marker=null,opened=0,detached=0;
 class Session extends EventEmitter {
  async send(method,params){
   commands.push({method,params:structuredClone(params),at:clock.now});
   if(overrides.send){const result=overrides.send({method,params,clock,session:this,marker});if(result!==undefined)return result;}
   if(method==='Tracing.getCategories')return {categories:[]}; // Absence is advisory, not unsupported.
   if(method==='Tracing.start')return {};
   if(method==='Tracing.end'){
    this.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'owned-stream',traceFormat:'json',streamCompression:'none'});return {};
   }
   if(method==='IO.read')return {data:JSON.stringify(traceDocument(marker)),eof:true};
   if(method==='IO.close')return {};
   throw Error('Unexpected command '+method);
  }
  async detach(){detached++;if(overrides.detach)return overrides.detach();}
 }
 const session=new Session();
 const controller=createGpuDurationTrace({output:'/trace-test',
  environment:{platform:'darwin',device:'desktop',mode:'full',requestedSeconds:90,renderBackend:'angle-metal',actualGpu:{renderer:'ANGLE (Apple, ANGLE Metal Renderer: Test, Unspecified Version)'},...overrides.environment},
  createSession:()=>{opened++;return overrides.createSession?overrides.createSession(session):session;},
  browserVersion:()=> 'Chrome test protocol, not a native run',
  markClock:name=>{marker=markerReceipt(name);return overrides.markClock?overrides.markClock(marker):marker;},
  clock:()=>clock.now,timers:clock,
  save:async(path,data)=>{if(overrides.save)return overrides.save(path,data,saved);saved.set(basename(path),Buffer.from(data));},
 });
 return {controller,clock,commands,saved,session,get marker(){return marker;},get opened(){return opened;},get detached(){return detached;}};
}
async function stopped(f){assert.equal(await f.controller.start(),true);await f.clock.advance(GPU_TRACE_LIMITS.windowMs);}
const hasError=(result,pattern)=>result.errors.some(error=>pattern.test(error));

test('bounded timer stops the fixed narrow trace; IO waits for explicit post-ride finish',async()=>{
 const f=fixture();await stopped(f);
 assert.deepEqual(f.commands.map(call=>call.method),['Tracing.getCategories','Tracing.start','Tracing.end']);
 const config=f.commands[1].params;
 assert.deepEqual(config.traceConfig.includedCategories,[...GPU_TRACE_CATEGORIES]);
 assert.deepEqual(config.traceConfig.excludedCategories,['*']);
 assert.equal(config.traceConfig.recordMode,'recordUntilFull');assert.equal(config.traceConfig.traceBufferSizeInKb,16384);
 assert.equal(config.transferMode,'ReturnAsStream');assert.equal(config.traceConfig.enableSampling,false);assert.equal(config.traceConfig.enableSystrace,false);
 const original=sampleRows(),before=structuredClone(original),result=await f.controller.finish(original);
 assert.equal(result.complete,true);assert.equal(result.timing.requestToEndRequestMs,10000);
 assert.equal(result.categoryInventory.length,0);assert.deepEqual(result.notAdvertisedRequested,[...GPU_TRACE_CATEGORIES]);
 assert.deepEqual(original,before);assert.equal(result.analysis.mappedCalls.length,2);
 assert.equal(result.analysis.clock.traceUsMinusPageMsTimes1000,0);assert.equal(result.analysis.clock.pid,1);assert.equal(result.analysis.clock.tid,7);
 assert.deepEqual(result.analysis.coverage,{mainThread:3,gpu:1,compositor:1});
 assert.equal(result.raw.sha256,createHash('sha256').update(f.saved.get('gpu-duration-trace.json')).digest('hex'));
 assert.deepEqual(JSON.parse(f.saved.get('gpu-duration-trace-metadata.json')),result);
 assert.equal(f.commands.filter(call=>call.method==='IO.close').length,1);assert.equal(f.detached,1);
 assert.strictEqual(await f.controller.finish([]),result);assert.equal(f.clock.pending.size,0);
});

test('driver default body is exactly the reviewed 5009 source after removing trace-only additions',async()=>{
 const source=await readFile(new URL('./gpu-duration-native-check.mjs',import.meta.url),'utf8');
 const stripped=source.replace(/^[ \t]*\/\/ GPU TRACE OPT-IN BEGIN\n[\s\S]*?^[ \t]*\/\/ GPU TRACE OPT-IN END\n/gm,'');
 assert.equal(createHash('sha256').update(stripped).digest('hex'),'714ade75a6cfa6e11f24cb47e424cc8c0ca73be9767ef8527c87d60f28961c2b');
 assert.match(source,/process\.env\.BELLE_GPU_TRACE==='1'/);
 assert.match(source,/seconds!==90/);
 assert.ok(source.indexOf('await trace.start()')<source.indexOf("await panel.getByRole('button',{name:'Start 10-minute capture'}).click()"));
 assert.ok(source.indexOf('await trace.finish(')>source.indexOf('CDP ending counters:'));
});

test('wrong environment or software identity creates no CDP session',async()=>{
 for(const environment of [{platform:'linux'},{device:'phone'},{mode:'diagnostic'},{requestedSeconds:30},{renderBackend:'swiftshader-fallback'},
  {actualGpu:{renderer:'Metal renderer alone'}},{actualGpu:{renderer:'ANGLE Metal SwiftShader'}}]){
  const f=fixture({environment});assert.equal(await f.controller.start(),false);
  const result=await f.controller.finish([]);assert.equal(result.complete,false);assert.equal(f.opened,0);assert.deepEqual(f.commands,[]);
  assert.equal(f.saved.has('gpu-duration-trace-metadata.json'),true);assert.equal(f.saved.get('gpu-duration-trace.json').length,0);
 }
});

test('rejected start never stops or closes a possibly foreign trace',async()=>{
 const original=Error('Tracing is already started');
 const f=fixture({send({method,session}){if(method==='Tracing.start'){
  session.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'foreign-stream'});throw original;
 }}});
 assert.equal(await f.controller.start(),false);const result=await f.controller.finish();
 assert.equal(result.ownership,'rejected');assert.ok(hasError(result,/Tracing is already started/));
 assert.deepEqual(f.commands.map(call=>call.method),['Tracing.getCategories','Tracing.start']);assert.equal(f.detached,1);
});

test('timed-out start detaches its dedicated session and cannot resume after late acceptance',async()=>{
 const pending=deferred(),f=fixture({send({method}){if(method==='Tracing.start')return pending.promise;}});
 const starting=f.controller.start();await flush();await f.clock.advance(5000);assert.equal(await starting,false);
 const result=await f.controller.finish(),before=JSON.stringify(result);
 pending.resolve({});f.session.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'late-stream'});await flush();await f.clock.advance(20000);
 assert.equal(result.ownership,'start-uncertain');assert.equal(f.detached,1);assert.equal(f.marker,null);
 assert.deepEqual(f.commands.map(call=>call.method),['Tracing.getCategories','Tracing.start']);assert.equal(JSON.stringify(result),before);
});

test('late dedicated-session creation is detached without issuing any trace command',async()=>{
 const pending=deferred(),f=fixture({createSession:()=>pending.promise});
 const starting=f.controller.start();await flush();await f.clock.advance(5000);assert.equal(await starting,false);
 const result=await f.controller.finish(),before=JSON.stringify(result);pending.resolve(f.session);await flush();
 assert.equal(f.detached,1);assert.deepEqual(f.commands,[]);assert.equal(JSON.stringify(result),before);
});

test('missing tracing protocol is explicit and never starts a broader fallback',async()=>{
 const f=fixture({send({method}){if(method==='Tracing.getCategories')throw Error('Method not found');}});
 assert.equal(await f.controller.start(),false);const result=await f.controller.finish();
 assert.ok(hasError(result,/Method not found/));assert.deepEqual(f.commands.map(call=>call.method),['Tracing.getCategories']);
});

test('loss and full-buffer receipts fail evidence while preserving the complete raw export',async()=>{
 const f=fixture({send({method,session}){if(method==='Tracing.end'){
  session.emit('Tracing.tracingComplete',{dataLossOccurred:true,stream:'owned-stream'});return {};
 }}});
 assert.equal(await f.controller.start(),true);
 f.session.emit('Tracing.bufferUsage',{percentFull:1,eventCount:200});await f.clock.advance(10000);
 const result=await f.controller.finish(sampleRows());
 assert.equal(result.complete,false);assert.equal(result.raw.eof,true);assert.equal(result.buffer.peak,1);
 assert.ok(hasError(result,/data loss/));assert.ok(hasError(result,/buffer filled/));assert.ok(f.saved.get('gpu-duration-trace.json').length>0);
});

test('buffer usage metadata remains bounded and its overflow is explicit',async()=>{
 const f=fixture();assert.equal(await f.controller.start(),true);
 for(let i=0;i<40;i++)f.session.emit('Tracing.bufferUsage',{value:.2,eventCount:i});
 await f.clock.advance(10000);const result=await f.controller.finish(sampleRows());
 assert.equal(result.buffer.receipts.length,32);assert.equal(result.buffer.dropped,8);assert.ok(hasError(result,/receipt bound/));
});

test('raw bytes survive JSON parse failure, with exact hash and stream cleanup',async()=>{
 const data='{"traceEvents": [ broken';const f=fixture({send({method}){if(method==='IO.read')return {data,eof:true};}});
 await stopped(f);const result=await f.controller.finish(sampleRows());
 assert.equal(f.saved.get('gpu-duration-trace.json').toString(),data);assert.equal(result.raw.sha256,createHash('sha256').update(data).digest('hex'));
 assert.ok(hasError(result,/parse\/correlation/));assert.equal(result.cleanup.streamClosed,true);assert.equal(f.detached,1);
});

test('actual coverage and clock anchor are checked independently from advertised categories',()=>{
 const marker=markerReceipt('anchor'),valid=traceDocument(marker);
 for(const [change,pattern]of [
  [document=>{document.traceEvents=document.traceEvents.filter(event=>event.name!=='anchor');},/clock marker/],
  [document=>{document.traceEvents.push({...document.traceEvents[2],ts:1000200});},/clock marker/],
  [document=>{document.traceEvents=document.traceEvents.filter(event=>event.cat!=='gpu');},/gpu event/],
  [document=>{document.traceEvents=document.traceEvents.filter(event=>event.cat!=='viz,cc');},/compositor event/],
  [document=>{document.traceEvents=document.traceEvents.filter(event=>!['toplevel','devtools.timeline'].includes(event.cat));},/mainThread event/],
  [document=>{document.traceEvents[2].pid=undefined;},/clock marker/],
 ]){
  const document=structuredClone(valid);change(document);const result=inspectGpuTrace(Buffer.from(JSON.stringify(document)),marker,sampleRows());
  assert.ok(result.errors.some(error=>pattern.test(error)));
 }
 const noCalls=inspectGpuTrace(Buffer.from(JSON.stringify(valid)),marker,[]);assert.ok(noCalls.errors.some(error=>/issue.samples/.test(error)));
});

test('actual forbidden capture evidence fails even without timestamps; ordinary CPU task names remain allowed',()=>{
 const marker=markerReceipt('anchor'),valid=traceDocument(marker);
 for(const extra of [
  {cat:'gpu,disabled-by-default-gpu.device',name:'Device work',ph:'M'},
  {cat:'disabled-by-default-gpu.timer',name:'Timer event'},
  {cat:'disabled-by-default-devtools.screenshot',name:'Capture'},
  {cat:'devtools.video_screenshot',name:'Video capture'},
  {cat:'disabled-by-default-memory-infra',name:'Dump'},
  {cat:'devtools.timeline',name:'Screenshot'},
  {cat:'other',name:'dump',ph:'v',args:{dumps:{}}},
 ]){
  const document=structuredClone(valid);document.traceEvents.push(extra);
  const result=inspectGpuTrace(Buffer.from(JSON.stringify(document)),marker,sampleRows());
  assert.equal(result.forbiddenEvidence.count,1);assert.equal(result.forbiddenEvidence.receipts.length,1);
  assert.ok(result.errors.some(error=>/Forbidden screenshot/.test(error)));
 }
 const ordinary=structuredClone(valid);
 ordinary.traceEvents.push({cat:'toplevel',name:'TimerFire',ph:'X',pid:1,tid:7,ts:1300000,dur:2},
  {cat:'toplevel',name:'MemoryPressureTask',ph:'X',pid:1,tid:7,ts:1400000,dur:2});
 const allowed=inspectGpuTrace(Buffer.from(JSON.stringify(ordinary)),marker,sampleRows());
 assert.deepEqual(allowed.errors,[]);assert.equal(allowed.forbiddenEvidence.count,0);
 const many=structuredClone(valid);many.traceEvents.push(...Array.from({length:40},()=>({name:'Screenshot'})));
 const bounded=inspectGpuTrace(Buffer.from(JSON.stringify(many)),marker,sampleRows());
 assert.equal(bounded.forbiddenEvidence.count,40);assert.equal(bounded.forbiddenEvidence.receipts.length,32);assert.equal(bounded.forbiddenEvidence.dropped,8);
});

test('clock-marker failure retains the owned trace and never changes into game-loop marking',async()=>{
 const f=fixture({markClock(){throw Error('Page marker unavailable');}});
 assert.equal(await f.controller.start(),false);const result=await f.controller.finish(sampleRows());
 assert.equal(f.commands.filter(call=>call.method==='Tracing.end').length,1);assert.ok(hasError(result,/Page marker unavailable/));
 assert.equal(result.raw.eof,true);assert.ok(f.saved.get('gpu-duration-trace.json').length>0);
});

test('read timeout closes the owned stream; a late reply cannot mutate retained evidence',async()=>{
 const pending=deferred(),f=fixture({send({method}){if(method==='IO.read')return pending.promise;}});
 await stopped(f);const finishing=f.controller.finish(sampleRows());await flush();await f.clock.advance(5000);
 const result=await finishing,before=JSON.stringify(result);pending.resolve({data:'late',eof:true});await flush();
 assert.ok(hasError(result,/IO.read timed out/));assert.equal(result.cleanup.streamClosed,true);assert.equal(f.detached,1);
 assert.equal(result.raw.bytes,0);assert.equal(JSON.stringify(result),before);assert.equal(f.commands.filter(call=>call.method==='IO.read').length,1);
});

test('overall drain deadline is independent of successful per-read replies, including final EOF',async()=>{
 let reads=0;const f=fixture({send({method,clock}){if(method==='IO.read'){reads++;clock.now+=4000;return {data:'x',eof:reads===4};}}});
 await stopped(f);const result=await f.controller.finish(sampleRows());
 assert.equal(reads,4);assert.ok(hasError(result,/total drain deadline/));assert.equal(result.raw.bytes,4);assert.equal(result.cleanup.streamClosed,true);
});

test('read-count bound applies independently of the raw-byte bound',async()=>{
 const f=fixture({send({method}){if(method==='IO.read')return {data:'x',eof:false};}});
 await stopped(f);const result=await f.controller.finish(sampleRows());
 assert.equal(result.raw.reads,1024);assert.equal(result.raw.bytes,1024);assert.ok(hasError(result,/read-count bound/));assert.equal(result.cleanup.streamClosed,true);
});

test('raw bytes stop at 32 MiB with retained partial bytes and explicit overflow',async()=>{
 const chunk='x'.repeat(GPU_TRACE_LIMITS.readBytes),f=fixture({send({method}){if(method==='IO.read')return {data:chunk,eof:false};}});
 await stopped(f);const result=await f.controller.finish(sampleRows());
 assert.equal(result.raw.bytes,32*1024*1024);assert.equal(f.saved.get('gpu-duration-trace.json').length,result.raw.bytes);
 assert.ok(hasError(result,/raw-byte bound/));assert.equal(result.cleanup.streamClosed,true);
});

test('empty non-EOF and oversized replies cannot spin or exceed a chunk bound',async()=>{
 for(const reply of [{data:'',eof:false},{data:'x'.repeat(GPU_TRACE_LIMITS.readBytes+1),eof:true}]){
  const f=fixture({send({method}){if(method==='IO.read')return reply;}});await stopped(f);
  const result=await f.controller.finish();assert.equal(result.raw.reads,1);assert.equal(result.complete,false);assert.equal(result.raw.bytes,0);
 }
});

test('base64 CDP chunks are decoded before byte accounting and exact raw hashing',async()=>{
 const f=fixture({send({method,marker}){if(method==='IO.read')return {data:Buffer.from(JSON.stringify(traceDocument(marker))).toString('base64'),base64Encoded:true,eof:true};}});
 await stopped(f);const result=await f.controller.finish(sampleRows());assert.equal(result.complete,true);
 assert.deepEqual(JSON.parse(f.saved.get('gpu-duration-trace.json')),traceDocument(f.marker));
});

test('completion timeout detaches and late events cannot mutate or reopen finalized collection',async()=>{
 const f=fixture({send({method}){if(method==='Tracing.end')return {};}});
 await stopped(f);const finishing=f.controller.finish();await flush();await f.clock.advance(10000);
 const result=await finishing,before=JSON.stringify(result);
 f.session.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'late-stream'});await flush();
 assert.ok(hasError(result,/tracingComplete timed out/));assert.equal(f.detached,1);assert.equal(JSON.stringify(result),before);
 assert.equal(f.commands.some(call=>call.method==='IO.read'||call.method==='IO.close'),false);
});

test('timer-triggered rejected stop detaches before workload finish instead of recording until then',async()=>{
 const f=fixture({send({method}){if(method==='Tracing.end')throw Error('end rejected');}});
 await stopped(f);assert.equal(f.detached,1);assert.equal(f.commands.some(call=>call.method==='IO.read'),false);
 const result=await f.controller.finish();assert.equal(result.cleanup.stopUncertain,true);assert.ok(hasError(result,/end rejected/));
 assert.equal(f.commands.filter(call=>call.method==='Tracing.end').length,1);
});

test('timer-triggered hung stop detaches at its command bound and never retries after late acknowledgement',async()=>{
 const pending=deferred(),f=fixture({send({method}){if(method==='Tracing.end')return pending.promise;}});
 await stopped(f);assert.equal(f.detached,0);await f.clock.advance(5000);assert.equal(f.detached,1);
 const result=await f.controller.finish(),before=JSON.stringify(result);assert.equal(result.cleanup.stopUncertain,true);
 pending.resolve({});f.session.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'too-late'});await flush();
 assert.equal(f.commands.filter(call=>call.method==='Tracing.end').length,1);assert.equal(JSON.stringify(result),before);
});

test('acknowledged stop with missing completion detaches on its watchdog without waiting for finish',async()=>{
 const f=fixture({send({method}){if(method==='Tracing.end')return {};}});
 await stopped(f);assert.equal(f.detached,0);await f.clock.advance(10000);assert.equal(f.detached,1);
 const result=await f.controller.finish();assert.ok(hasError(result,/tracingComplete timed out/));assert.equal(result.cleanup.stopUncertain,true);
});

test('cleanup failures do not replace export failure or trigger an end retry',async()=>{
 const f=fixture({send({method}){if(method==='IO.read')throw Error('original export error');if(method==='IO.close')throw Error('close error');},detach(){throw Error('detach error');}});
 await stopped(f);const result=await f.controller.finish();
 assert.ok(hasError(result,/original export error/));assert.ok(hasError(result,/close error/));assert.ok(hasError(result,/detach error/));
 assert.equal(f.commands.filter(call=>call.method==='Tracing.end').length,1);assert.equal(result.complete,false);
});

test('raw and metadata retention failures stay explicit instead of claiming complete evidence',async()=>{
 const f=fixture({save(path,data,saved){if(basename(path)==='gpu-duration-trace.json')throw Error('disk full');saved.set(basename(path),Buffer.from(data));}});
 await stopped(f);const result=await f.controller.finish(sampleRows());assert.ok(hasError(result,/Raw trace retention failed.*disk full/s));assert.equal(result.complete,false);
 const g=fixture({save(){throw Error('disk unavailable');}});await stopped(g);const failed=await g.controller.finish(sampleRows());
 assert.ok(hasError(failed,/metadata retention failed/));assert.equal(failed.complete,false);
});
