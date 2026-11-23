import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectHostTraceCategories,drainTraceStream,summarizeHostTrace} from './host-service-trace.mjs';

test('host tracing excludes device timers, per-command tracing and screenshots even when available',()=>{
  const result=selectHostTraceCategories(['toplevel','gpu','rail','blink.user_timing','cc','viz',
    'disabled-by-default-gpu.device','disabled-by-default-viz.gpu_composite_time','disabled-by-default-gpu.service','disabled-by-default-devtools.screenshot']);
  assert.deepEqual(result.included,['toplevel','cc','viz','gpu','rail','blink.user_timing']);
  assert(result.excluded.includes('disabled-by-default-gpu.device'));
  assert(result.excluded.includes('disabled-by-default-viz.gpu_composite_time'));
  assert(result.excluded.includes('disabled-by-default-devtools.video_screenshot'));
  assert.deepEqual(result.missing,['renderer.scheduler']);
  assert.throws(()=>selectHostTraceCategories(['toplevel','blink.user_timing']),/GPU host/);
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
    {ph:'X',cat:'cc',name:'Overlapping host task',pid:1,tid:2,ts:1060001000,dur:120000},
    {ph:'I',cat:'blink.user_timing',name:'end',pid:1,tid:2,ts:1090000000}
  ]};
  const result=summarizeHostTrace(trace,marks);
  assert.equal(result.bothMarkersRetained,true);assert.equal(result.alignmentValid,true);assert.deepEqual(result.alignment.map(row=>row.offsetMs),[1000000,1000000]);
  assert.equal(result.clockOffsetDifferenceMs,0);assert.equal(result.processes[7],'GPU Process');assert.equal(result.threads['7:9'],'CrGpuMain');
  assert.equal(result.largestCompleteHostEvents[0].durationMs,120);assert.match(result.note,/not GPU execution/);
  assert.equal(summarizeHostTrace({traceEvents:trace.traceEvents.slice(0,-1)},marks).bothMarkersRetained,false);
  assert.equal(summarizeHostTrace(trace,[marks[0],{...marks[1],timeOriginMs:marks[1].timeOriginMs+1}]).alignmentValid,false);
  assert.equal(summarizeHostTrace(trace,[marks[0],{...marks[1],startTimeMs:89998}]).alignmentValid,false);
});
