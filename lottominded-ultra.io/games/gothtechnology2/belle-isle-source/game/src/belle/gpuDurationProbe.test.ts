import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpuDurationProbe,gpuDurationEnabled,gpuDurationContextExcluded,GPU_DURATION_API_STAGES,type GpuDurationFrameStart,type GpuDurationFrameEnd} from './gpuDurationProbe.ts';

function fixture(){
 let time=0,callback=0,contextReads=0,clockThrows=false,apiClockReads=0;
 let onCall:((call:{name:string;args:unknown[]})=>void)|undefined,apiClockOverride:(()=>number)|undefined;
 const legacyClockPositions:number[]=[];
 const calls:{name:string;args:unknown[]}[]=[],queries:{id:number;available:boolean;result:unknown}[]=[];
 const record=(name:string,args:unknown[]=[])=>{const call={name,args};calls.push(call);onCall?.(call);};
 const ext={TIME_ELAPSED_EXT:20,QUERY_COUNTER_BITS_EXT:21,GPU_DISJOINT_EXT:22};
 const gl={CURRENT_QUERY:1,QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,DRAW_FRAMEBUFFER_BINDING:4,SAMPLES:5,SAMPLE_BUFFERS:6,VENDOR:7,RENDERER:8,VERSION:9,
  get drawingBufferWidth(){record('drawingBufferWidth');return 1440;},get drawingBufferHeight(){record('drawingBufferHeight');return 900;},
  active:null as object|null,lost:false,disjoint:false,supported:true,bits:64,
  autoAvailable:false,throwEnd:false,throwBegin:false,throwParameter:false,allocationFails:false,
  getExtension(name:string){record('getExtension',[name]);return name==='EXT_disjoint_timer_query_webgl2'&&this.supported?ext:null;},
  getQuery(target:number,pname:number){record('getQuery',[target,pname]);assert.equal(target,ext.TIME_ELAPSED_EXT);return pname===ext.QUERY_COUNTER_BITS_EXT?this.bits:this.active;},
  getParameter(pname:number):unknown{
   record('getParameter',[pname]);if(this.throwParameter)throw Error('parameter');
   if(pname===ext.GPU_DISJOINT_EXT){const value=this.disjoint;this.disjoint=false;return value;}
   return new Map<number,unknown>([[this.DRAW_FRAMEBUFFER_BINDING,null],[this.SAMPLES,4],[this.SAMPLE_BUFFERS,1],[this.VENDOR,'Native vendor'],[this.RENDERER,'Native renderer'],[this.VERSION,'WebGL 2']]).get(pname);
  },
  getContextAttributes(){record('getContextAttributes');return {antialias:true};},
  isContextLost(){record('isContextLost');return this.lost;},
  createQuery(){record('createQuery');if(this.allocationFails)return null;const q={id:queries.length+1,available:this.autoAvailable,result:5_000_000_000};queries.push(q);return q;},
  deleteQuery(query:object){record('deleteQuery',[query]);},
  beginQuery(target:number,query:object){record('beginQuery',[target,query]);assert.equal(this.active,null);this.active=query;if(this.throwBegin)throw Error('begin');},
  endQuery(target:number){record('endQuery',[target]);assert.notEqual(this.active,null);if(this.throwEnd)throw Error('end');this.active=null;},
  getQueryParameter(query:object,pname:number):unknown{
   record('getQueryParameter',[query,pname]);assert.notEqual(this.active,query,'never poll an active query');
   const q=queries.find(q=>q===query)!;assert(q);
   if(pname===this.QUERY_RESULT_AVAILABLE)return q.available;
   assert.equal(pname,this.QUERY_RESULT);assert(q.available,'never request unavailable results');return q.result;
  },
 };
 const getContext=()=>{contextReads++;return gl as unknown as WebGL2RenderingContext;};
 const clock=()=>{legacyClockPositions.push(calls.length);if(clockThrows)throw Error('clock');return time;};
 const apiClock=()=>{apiClockReads++;return apiClockOverride?apiClockOverride():time;};
 const probe=createGpuDurationProbe(true,getContext,clock,apiClock)!;
 const begin=(flags:Partial<GpuDurationFrameStart>={})=>{callback++;time+=20;probe.beginFrame({rafTimeMs:callback*20,cpuStartMs:time,recording:true,eligible:true,excluded:false,...flags});};
 const end=(values:Partial<GpuDurationFrameEnd>={})=>{time+=4;probe.endFrame({cpuEndMs:time,renderSubmitCpuMs:2,eligible:true,drawCalls:400,triangles:2_000_000,renderPasses:3,shadowUpdateRequested:true,...values});};
 const tick=(count=1,flags:Partial<GpuDurationFrameStart>={})=>{for(let i=0;i<count;i++){begin(flags);try{end();}finally{probe.cancelFrame();}}};
 return {gl,ext,probe,calls,queries,getContext,clock,apiClock,begin,end,tick,legacyClockPositions,advance:(ms:number)=>{time+=ms;},
  get contextReads(){return contextReads;},get apiClockReads(){return apiClockReads;},get time(){return time;},set clockThrows(value:boolean){clockThrows=value;},
  set onCall(value:typeof onCall){onCall=value;},set apiClockOverride(value:typeof apiClockOverride){apiClockOverride=value;}};
}
const count=(f:ReturnType<typeof fixture>,name:string)=>f.calls.filter(c=>c.name===name).length;

test('flag off performs zero context acquisition, extension lookup, parameter or query calls',()=>{
 const f=fixture();
 for(const search of ['', '?gpu-duration=0','?profile=1&locationPerf=1','?gpu-duration=true']){
  const disabled=createGpuDurationProbe(gpuDurationEnabled(search),f.getContext,()=>{throw Error('clock must remain unused');},()=>{throw Error('API clock must remain unused');});
  disabled?.snapshot();disabled?.dispose();assert.equal(disabled,undefined);
 }
 assert.equal(f.contextReads,0);assert.deepEqual(f.calls,[]);
 f.probe.snapshot();f.probe.dispose();assert.equal(f.contextReads,0);assert.deepEqual(f.calls,[]);
 assert.equal(f.apiClockReads,0);assert.deepEqual(f.legacyClockPositions,[]);
});

test('ordinary full profile URL with the location QA panel remains eligible while real sensors are off',()=>{
 const search='?profile=1&locationPerf=1&gpu-duration=1';assert(gpuDurationEnabled(search));
 const normal={xr:false,coop:false,reducedScene:false,following:false,locationState:'off'};
 assert.equal(gpuDurationContextExcluded(normal),false);
 for(const key of ['xr','coop','reducedScene','following'] as const)assert(gpuDurationContextExcluded({...normal,[key]:true}));
 for(const state of ['requesting','tracking','follow','paused','denied'])assert(gpuDurationContextExcluded({...normal,locationState:state}));
 const f=fixture();f.tick(7,{excluded:gpuDurationContextExcluded(normal)});assert.equal(count(f,'beginQuery'),1);
 const source=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 assert.match(source,/gpuDurationContextExcluded\(\{xr:!!vr\?\.active,coop:!!coop\?\.active,reducedScene:localPerformanceProbe\(\),following:locationFollowing,locationState:realLocation\?\.snapshot\.status\}\)/);
 assert(!/gpuDuration[^\n]*!!locationPerformance/.test(source),'panel presence is not a privacy context');
});

test('only every seventh eligible recorded callback issues, without observing private/inactive contexts',()=>{
 const f=fixture();f.tick(20,{recording:false});f.tick(20,{eligible:false});f.tick(20,{excluded:true});
 assert.equal(f.contextReads,0);assert.deepEqual(f.calls,[]);
 f.tick(6);assert.equal(f.contextReads,0);f.tick();assert.equal(f.contextReads,1);assert.equal(count(f,'beginQuery'),1);assert.equal(count(f,'endQuery'),1);
 const s=f.probe.snapshot();assert.equal(s.counts.eligibleCallbacks,7);assert.equal(s.samples[0].callback,67);assert.equal(s.samples[0].eligibleCallback,7);
 assert.deepEqual(s.backend,{vendor:'Native vendor',renderer:'Native renderer',version:'WebGL 2',antialias:true});
 assert.deepEqual(s.samples[0].drawingBuffer,{width:1440,height:900});assert.deepEqual(s.samples[0].framebuffer,{defaultBound:true,samples:4,sampleBuffers:1});
});

test('availability is read only on later admitted callbacks; snapshots and cleanup do not poll',()=>{
 const f=fixture();f.gl.autoAvailable=true;f.tick(7);
 assert.equal(count(f,'getQueryParameter'),0,'even an already available fake result cannot be read in the issuing callback');
 const before=f.calls.length,s=f.probe.snapshot();assert.equal(s.counts.unresolved,1);assert.equal(s.gpuMs,null);
 s.samples[0].drawingBuffer.width=1;s.counts.issued=999;assert.equal(f.probe.snapshot().samples[0].drawingBuffer.width,1440);
 f.probe.cancelFrame();assert.equal(f.calls.length,before);
 f.tick();const result=f.probe.snapshot(),row=result.samples[0];
 assert.equal(result.counts.valid,1);assert.equal(row.gpuNanoseconds,5_000_000_000);assert.equal(row.gpuMs,5000,'retain more than 32 bits');
 assert.equal(row.resultCallback,8);assert.equal(row.resolutionDelayCallbacks,1);assert.equal(row.cpuElapsedMs,4);assert.equal(row.renderSubmitCpuMs,2);
 assert.equal(row.renderPasses,3);assert.equal(row.shadowUpdateRequested,true);
 assert.deepEqual(row.nextAdmittedCallback,{callback:8,rafTimeMs:160,intervalMs:20,eligible:true});assert.deepEqual(row.nextEligibleCallback,row.nextAdmittedCallback);
 assert.equal(row.association,'paired');assert.equal(count(f,'deleteQuery'),1);assert.equal(result.counts.issued,result.counts.valid+result.counts.rejected+result.counts.unresolved);
});

test('recording stop and private callbacks preserve unresolved results without readback or false pairing',()=>{
 const f=fixture();f.tick(7);f.queries[0].available=true;const before=f.calls.length;
 f.probe.breakAssociation();f.tick(4,{recording:false});f.tick(4,{excluded:true});
 assert.equal(f.calls.length,before);const s=f.probe.snapshot();assert.equal(s.counts.unresolved,1);assert.equal(s.samples[0].association,'interrupted');assert.equal(s.samples[0].nextEligibleCallback,null);
 f.tick();assert.equal(f.probe.snapshot().counts.valid,1);assert.equal(f.probe.snapshot().samples[0].nextEligibleCallback,null);
});

test('the next eligible association requires that admitted callback to complete successfully',()=>{
 for(const mode of ['ineligible','error','boundary'] as const){
  const f=fixture();f.tick(7);f.begin();
  let row=f.probe.snapshot().samples[0];assert.equal(row.nextEligibleCallback,null,'entry eligibility is not yet a completed callback');
  if(mode==='ineligible')f.end({eligible:false});
  if(mode==='boundary'){f.probe.breakAssociation();f.end();}
  f.probe.cancelFrame();row=f.probe.snapshot().samples[0];
  assert.equal(row.association,'interrupted');assert.equal(row.nextEligibleCallback,null);assert.equal(row.nextAdmittedCallback?.eligible,false);
 }
});

test('backpressure is bounded at four pending queries, without waiting or issuing a fifth',()=>{
 const f=fixture();f.tick(35);let s=f.probe.snapshot();assert.equal(s.counts.issued,4);assert.equal(s.counts.unresolved,4);assert.equal(s.counts.pendingPeak,4);assert.equal(s.skips.pendingLimit,1);
 assert.equal(count(f,'createQuery'),4);for(const q of f.queries)q.available=true;
 f.tick(7);s=f.probe.snapshot();assert.equal(s.counts.valid,4);assert.equal(s.counts.issued,5);assert.equal(s.counts.unresolved,1);
 assert(!f.calls.some(c=>/wait|finish|flush|fence|render/i.test(c.name)));
});

test('the lifetime issue limit is 256 and drains asynchronously without further GL calls after completion',()=>{
 const f=fixture();f.gl.autoAvailable=true;f.tick(7*256+1);
 const s=f.probe.snapshot();assert.equal(s.counts.issued,256);assert.equal(s.counts.valid,256);assert.equal(s.samples.length,256);assert.equal(s.counts.unresolved,0);assert.equal(count(f,'createQuery'),256);
 const before=f.calls.length;f.tick(100);assert.equal(f.calls.length,before);assert(f.probe.snapshot().skips.limit>0);
});

test('foreign elapsed queries are never ended, replaced, polled, or deleted',()=>{
 const f=fixture(),foreign={foreign:true};f.gl.active=foreign;f.tick(7);
 assert.equal(f.probe.snapshot().skips.foreignQuery,1);assert.equal(count(f,'createQuery'),0);assert.equal(count(f,'endQuery'),0);assert.equal(count(f,'deleteQuery'),0);assert.equal(f.gl.active,foreign);
 f.gl.active=null;f.tick(7);f.gl.active=foreign;f.queries[0].available=true;const polls=count(f,'getQueryParameter');f.tick();assert.equal(count(f,'getQueryParameter'),polls);assert.equal(f.gl.active,foreign);
 f.probe.dispose();assert.equal(f.gl.active,foreign);assert.equal(count(f,'endQuery'),1,'only the earlier owned query was ended');
});

test('a disjoint invalidates every pending query before any available result is accepted',()=>{
 const f=fixture();f.tick(21);assert.equal(f.queries.length,3);for(const q of f.queries)q.available=true;f.gl.disjoint=true;f.tick();
 const s=f.probe.snapshot();assert.equal(s.counts.rejected,3);assert.equal(s.counts.valid,0);assert.equal(s.counts.unresolved,0);assert.equal(s.counts.disjointEvents,1);assert.equal(s.rejectionReasons.disjoint,3);
 assert.equal(f.calls.filter(c=>c.name==='getQueryParameter'&&c.args[1]===f.gl.QUERY_RESULT).length,0);assert.equal(count(f,'deleteQuery'),3);
 f.tick(6);assert.equal(f.probe.snapshot().counts.issued,4,'a later clean sample can proceed');
});

test('lost contexts invalidate owned queries and do not issue or end queries after loss',()=>{
 const f=fixture();f.tick(7);f.gl.lost=true;f.tick();
 let s=f.probe.snapshot();assert.equal(s.status,'context-lost');assert.equal(s.counts.contextLosses,1);assert.equal(s.rejectionReasons['context-lost'],1);assert.equal(s.counts.unresolved,0);
 f.tick(14);assert.equal(count(f,'beginQuery'),1);assert.equal(count(f,'endQuery'),1);
 const active=fixture();active.tick(6);active.begin();active.gl.lost=true;active.end();active.probe.cancelFrame();s=active.probe.snapshot();assert.equal(s.status,'context-lost');assert.equal(count(active,'endQuery'),0);assert.equal(s.counts.rejected,1);
});

test('zero, negative, fractional, nonfinite, unsafe, and nonnumeric GPU results are rejected',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'123']){
  const f=fixture();f.tick(7);f.queries[0].result=value;f.queries[0].available=true;f.tick();
  const s=f.probe.snapshot();assert.equal(s.counts.valid,0);assert.equal(s.rejectionReasons['invalid-result'],1);assert.equal(s.gpuMs,null);assert.equal(count(f,'deleteQuery'),1);
 }
});

test('finally cleanup preserves original render errors and early returns without leaking active queries',()=>{
 const f=fixture(),original=new Error('original render');f.tick(6);
 assert.throws(()=>{f.begin();try{throw original;}finally{f.probe.cancelFrame();}},error=>error===original);
 assert.equal(f.gl.active,null);assert.equal(f.probe.snapshot().rejectionReasons['incomplete-callback'],1);assert.equal(count(f,'deleteQuery'),1);
 f.tick(6);const early=()=>{f.begin();try{return 42;}finally{f.probe.cancelFrame();}};assert.equal(early(),42);assert.equal(f.gl.active,null);assert.equal(f.probe.snapshot().counts.rejected,2);
 f.probe.cancelFrame();assert.equal(count(f,'deleteQuery'),2,'cleanup is idempotent');
});

test('failed begin, end, clock and parameter observations never throw into rendering and release owned objects',()=>{
 for(const failure of ['throwBegin','throwEnd','clock','throwParameter'] as const){
  const f=fixture();f.tick(6);
  if(failure==='throwBegin'||failure==='throwParameter')f.gl[failure]=true;
  assert.doesNotThrow(()=>f.begin());
  if(failure==='throwEnd')f.gl.throwEnd=true;
  if(failure==='clock')f.clockThrows=true;
  assert.doesNotThrow(()=>f.end());assert.doesNotThrow(()=>f.probe.cancelFrame());assert.doesNotThrow(()=>f.probe.dispose());
  const s=f.probe.snapshot();assert(s.counts.errors>0);assert.equal(s.counts.unresolved,0);assert.equal(count(f,'deleteQuery'),f.queries.length);
 }
});

test('unsupported timer capability is explicit and never creates queries',()=>{
 for(const mode of ['extension','bits'] as const){
  const f=fixture();if(mode==='extension')f.gl.supported=false;else f.gl.bits=0;
  f.tick(70);const s=f.probe.snapshot();assert.equal(s.status,'unsupported');assert.equal(s.counts.issued,0);assert.equal(count(f,'createQuery'),0);assert.equal(count(f,'getExtension'),1);
 }
});

test('changed eligibility and invalid CPU metadata close and reject their query rather than publishing a misleading result',()=>{
 for(const change of [{eligible:false},{cpuEndMs:NaN},{renderSubmitCpuMs:-1}]){
  const f=fixture();f.tick(6);f.begin();f.end(change);f.probe.cancelFrame();
  const s=f.probe.snapshot();assert.equal(s.counts.rejected,1);assert.equal(s.counts.unresolved,0);assert.equal(f.gl.active,null);assert.equal(count(f,'deleteQuery'),1);
 }
});

test('full callback integration brackets sky/world work and final rendering with finally cleanup, without altering frame gates',()=>{
 const source=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const begin=source.indexOf('gpuDuration?.beginFrame('),end=source.indexOf('gpuDuration?.endFrame(');
 assert(source.indexOf('now-lastRender<1000/frameCap-.8')<begin);
 assert(begin<source.indexOf('world.sky.observeFrame('));assert(begin<source.indexOf('world.sky.tick('));
 assert(begin<source.indexOf('if(coop?.active){',begin));assert(end>source.indexOf('const renderEnd=performance.now()',begin));
 assert(end<source.indexOf('rideProfile?.sample(',end));assert(source.indexOf('}finally{gpuDuration?.cancelFrame();}',end)>end);
 assert.match(source,/gpuDuration:gpuDuration\.snapshot\(\)/);
 assert.match(source,/resetRenderDiagnostics:\(\)=>\{[^}]*gpuDuration\?\.breakAssociation\(\)/);
});

test('API wall scopes preserve the original exact GL trace, arguments, values and legacy clock positions',()=>{
 const f=fixture();f.tick(7);
 const q=f.queries[0],e=f.ext,g=f.gl;
 assert.deepEqual(f.calls.map(call=>[call.name,...call.args]),[
  ['isContextLost'],['getExtension','EXT_disjoint_timer_query_webgl2'],['getQuery',e.TIME_ELAPSED_EXT,e.QUERY_COUNTER_BITS_EXT],
  ['getExtension','WEBGL_debug_renderer_info'],['getParameter',g.VENDOR],['getParameter',g.RENDERER],['getParameter',g.VERSION],['getContextAttributes'],
  ['isContextLost'],['getQuery',e.TIME_ELAPSED_EXT,g.CURRENT_QUERY],['getParameter',e.GPU_DISJOINT_EXT],
  ['drawingBufferWidth'],['drawingBufferHeight'],['getParameter',g.DRAW_FRAMEBUFFER_BINDING],['getParameter',g.SAMPLES],['getParameter',g.SAMPLE_BUFFERS],
  ['createQuery'],['beginQuery',e.TIME_ELAPSED_EXT,q],['getQuery',e.TIME_ELAPSED_EXT,g.CURRENT_QUERY],
  ['isContextLost'],['getQuery',e.TIME_ELAPSED_EXT,g.CURRENT_QUERY],['endQuery',e.TIME_ELAPSED_EXT],
 ]);
 assert.deepEqual(f.legacyClockPositions,[11,22],'Legacy issue/end reads retain their original positions and count');
 assert.equal(f.apiClockReads,20);const s=f.probe.snapshot(),row=s.samples[0];
 assert.equal(s.version,2);assert.deepEqual(row.apiWall.calls.map(call=>call.stage),GPU_DURATION_API_STAGES);
 assert.deepEqual(row.drawingBuffer,{width:1440,height:900});assert.deepEqual(row.framebuffer,{defaultBound:true,samples:4,sampleBuffers:1});
 assert.equal(row.issuedCpuTimeMs,164);assert.equal(row.cpuEndMs,168);assert.equal(row.queryBracketCpuMs,4);
 assert.equal(row.apiWall.dropped,0);
 for(const call of row.apiWall.calls){assert.equal(call.wallMs,0);assert.equal(call.outcome,'returned');assert.deepEqual(call.clockErrors,[]);}
 assert(!JSON.stringify(row.apiWall).includes('available'),'No GL query return object enters the snapshot');
 const before=f.apiClockReads;f.probe.snapshot();f.probe.snapshot();assert.equal(f.apiClockReads,before,'Reading cached reports does not read clocks');
});

test('each deliberately slow GL operation is localized to its own scalar wall receipt',()=>{
 // Positions are in the independently specified original trace above, including
 // separately observable drawing-buffer properties and the two close controls.
 const positions=[12,13,14,15,16,17,18,19,21,22];
 for(const [index,position]of positions.entries()){
  const f=fixture();f.onCall=()=>{if(f.calls.length===position)f.advance(37);};f.tick(7);
  const row=f.probe.snapshot().samples[0];assert.equal(row.apiWall.calls.length,10);
  for(const [i,call]of row.apiWall.calls.entries())assert.equal(call.wallMs,i===index?37:0,call.stage);
  assert.equal(row.apiWall.calls[index].stage,GPU_DURATION_API_STAGES[index]);
  assert.equal(row.queryBracketCpuMs,41,'Legacy bracket still contains setup, render and close');
  assert.equal(row.cpuElapsedMs,index<8?41:4,'Post-render controls stay outside the original render-end timestamp');
 }
});

test('new invalid or throwing clocks remain explicit metadata and never suppress a real GL operation',()=>{
 const cases=[
  {read:1,value:NaN,errors:['start-invalid']},{read:2,value:Infinity,errors:['end-invalid']},
  {read:1,value:-1,errors:['start-invalid']},{read:1,throws:true,errors:['start-threw']},{read:2,throws:true,errors:['end-threw']},
 ];
 for(const mode of cases){
  const f=fixture();let n=0;f.apiClockOverride=()=>{if(++n===mode.read){if(mode.throws)throw Error('new wall clock');return mode.value!;}return f.time;};
  f.tick(7);f.queries[0].available=true;f.tick();const s=f.probe.snapshot(),call=s.samples[0].apiWall.calls[0];
  assert.equal(s.counts.valid,1);assert.equal(s.counts.errors,0);assert.equal(count(f,'beginQuery'),1);assert.equal(count(f,'endQuery'),1);
  assert.equal(call.wallMs,null);assert.deepEqual(call.clockErrors,mode.errors);
  assert.equal(call[mode.read===1?'startMs':'endMs'],null,'An invalid observation is never replaced by zero');
 }
 const f=fixture();let n=0;f.apiClockOverride=()=>++n===1?f.time+1:f.time;f.tick(7);
 const call=f.probe.snapshot().samples[0].apiWall.calls[0];assert.equal(call.wallMs,null);assert.deepEqual(call.clockErrors,['regressed']);
 assert.equal(call.startMs,call.endMs!+1);assert.equal(count(f,'endQuery'),1);
});

test('timing failure cannot replace an original operation exception, and real begin failure still cleans its query',()=>{
 const f=fixture(),original=Error('original GL failure');f.apiClockOverride=()=>{throw Error('wall clock');};
 const timing={calls:[],dropped:0};let attempted=0;
 const invoke=()=>Reflect.apply(Reflect.get(f.probe,'apiCall'),f.probe,[timing,'issue.beginQuery','issue',()=>{attempted++;throw original;}]);
 assert.throws(invoke,error=>error===original);assert.equal(attempted,1);
 assert.equal(Reflect.get(timing.calls[0],'outcome'),'threw');assert.deepEqual(Reflect.get(timing.calls[0],'clockErrors'),['start-threw','end-threw']);
 f.gl.throwBegin=true;f.tick(7);const row=f.probe.snapshot().samples[0];
 assert.equal(row.rejectionReason,'observer-error');assert.equal(f.gl.active,null);assert.equal(count(f,'deleteQuery'),1);
 assert.deepEqual(row.apiWall.calls.slice(-3).map(call=>[call.stage,call.phase,call.outcome]),[
  ['issue.beginQuery','issue','threw'],['close.ownership','cleanup','returned'],['close.endQuery','cleanup','returned'],
 ]);
});

test('failed close cleanup is bounded and future dropped timing receipts cannot suppress operations',()=>{
 const f=fixture();f.tick(6);f.begin();f.gl.throwEnd=true;f.end();const row=f.probe.snapshot().samples[0];
 assert.equal(row.apiWall.calls.length,12);assert.equal(row.apiWall.dropped,0);
 assert.deepEqual(row.apiWall.calls.slice(-4).map(call=>[call.phase,call.outcome]),[['end','returned'],['end','threw'],['cleanup','returned'],['cleanup','threw']]);
 const before=f.apiClockReads;f.probe.cancelFrame();f.probe.dispose();assert.equal(f.apiClockReads,before);
 const timing={calls:[],dropped:0};let operations=0;
 for(let i=0;i<15;i++)assert.equal(Reflect.apply(Reflect.get(f.probe,'apiCall'),f.probe,[timing,'close.ownership','cleanup',()=>++operations]),i+1);
 assert.equal(timing.calls.length,12);assert.equal(timing.dropped,3);assert.equal(operations,15);assert.equal(f.apiClockReads-before,24);
});

test('a setup exception or null allocation before issue creates no invented row or zero timing sample',()=>{
 for(const mode of ['width','allocation'] as const){
  const f=fixture();if(mode==='width')f.onCall=call=>{if(call.name==='drawingBufferWidth')throw Error('width getter');};else f.gl.allocationFails=true;
  f.tick(7);const s=f.probe.snapshot();assert.equal(s.counts.issued,0);assert.equal(s.counts.errors,1);assert.deepEqual(s.samples,[]);assert.equal(count(f,'beginQuery'),0);
 }
});

const driverSource=readFileSync(new URL('../../scripts/gpu-duration-native-check.mjs',import.meta.url),'utf8');
// Execute only the driver's pure reconciliation code. Browser startup/input is
// outside this slice and is neither imported nor simulated by these tests.
const driver=Function(driverSource.slice(driverSource.indexOf('const gpuApiWallStages='),driverSource.indexOf('const game='))+
 ';return {validateGpuApiWall,validateGpuDuration,summarizeGpuApiWall};')() as {
 validateGpuApiWall:(row:unknown)=>string[];validateGpuDuration:(snapshot:unknown,actual:unknown)=>string[];
 summarizeGpuApiWall:(snapshot:unknown)=>{stage:string;calls:number;wallMs:{count:number;sum:number;mean:number;p50:number;p95:number;max:number}|null}[];
};
test('the separate driver reconciles raw wall receipts and computes per-stage statistics without GL reads',()=>{
 const f=fixture();f.gl.autoAvailable=true;f.onCall=call=>{if(call.name==='getParameter'&&call.args[0]===f.gl.SAMPLES)f.advance(37);};f.tick(63);
 const s=f.probe.snapshot(),before=f.calls.length;assert.equal(s.counts.valid,8);assert.equal(s.counts.unresolved,1);
 assert.deepEqual(driver.validateGpuDuration(s,s.backend),[]);
 const stages=driver.summarizeGpuApiWall(s),slow=stages.find(stage=>stage.stage==='issue.samples')!;
 assert.equal(slow.calls,9);assert.deepEqual(slow.wallMs,{count:9,sum:333,mean:37,p50:37,p95:37,max:37});
 assert(stages.filter(stage=>stage!==slow).every(stage=>stage.wallMs?.sum===0));assert.equal(f.calls.length,before);
 assert(driver.summarizeGpuApiWall(null).every(stage=>stage.wallMs===null),'Unobserved stages have no fabricated zero-duration aggregate');
});

test('a live pending query may retain only issue receipts without being drained for the report',()=>{
 const f=fixture();f.gl.autoAvailable=true;f.tick(62);f.begin();const s=f.probe.snapshot(),row=s.samples.at(-1)!;
 assert.equal(row.status,'pending');assert.equal(row.cpuEndMs,null);assert.equal(row.apiWall.calls.length,8);assert.equal(s.counts.valid,8);
 const before=f.calls.length;assert.deepEqual(driver.validateGpuDuration(s,s.backend),[]);assert.equal(f.calls.length,before);f.probe.cancelFrame();
});

test('driver rejects modified wall arithmetic, order, containing scopes and invalid-clock substitutions',()=>{
 const f=fixture();f.gl.autoAvailable=true;f.tick(57);const source=f.probe.snapshot();
 const mutations:( (s:typeof source)=>void)[]=[
  s=>{s.samples[0].apiWall.calls[0].wallMs=1;},s=>{s.samples[0].apiWall.calls.reverse();},
  s=>{s.samples[0].apiWall.calls[0].startMs=s.samples[0].issuedCpuTimeMs-1;s.samples[0].apiWall.calls[0].wallMs=1;},
  s=>{s.samples[0].apiWall.calls.at(-1)!.endMs!+=1;s.samples[0].apiWall.calls.at(-1)!.wallMs=1;},
  s=>{s.samples[0].apiWall.calls[0].startMs=null;s.samples[0].apiWall.calls[0].clockErrors=['start-threw'];},
  s=>{s.samples[0].apiWall.dropped=1;},s=>{s.samples[0].apiWall.calls.pop();},
 ];
 for(const mutate of mutations){const changed=structuredClone(source);mutate(changed);assert(driver.validateGpuDuration(changed,changed.backend).length>0);}
 const g=fixture();g.gl.throwBegin=true;g.tick(7);const failed=g.probe.snapshot().samples[0];
 assert.deepEqual(driver.validateGpuApiWall(failed),[],'A real issue throw can be followed by cleanup');
 const impossible=structuredClone(failed);impossible.apiWall.calls.splice(7,0,{...impossible.apiWall.calls[5],stage:'issue.ownershipAfterBegin'});
 assert(driver.validateGpuApiWall(impossible).some(error=>error.includes('terminate its phase')));
 const badClose=structuredClone(source.samples[0]);badClose.apiWall.calls[8].outcome='threw';
 assert(driver.validateGpuApiWall(badClose).some(error=>error.includes('terminate its phase')));
});
