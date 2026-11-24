import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpuDurationProbe,gpuDurationEnabled,gpuDurationContextExcluded,type GpuDurationFrameStart,type GpuDurationFrameEnd} from './gpuDurationProbe.ts';

function fixture(){
 let time=0,callback=0,contextReads=0,clockThrows=false;
 const calls:{name:string;args:unknown[]}[]=[],queries:{id:number;available:boolean;result:unknown}[]=[];
 const ext={TIME_ELAPSED_EXT:20,QUERY_COUNTER_BITS_EXT:21,GPU_DISJOINT_EXT:22};
 const gl={CURRENT_QUERY:1,QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,DRAW_FRAMEBUFFER_BINDING:4,SAMPLES:5,SAMPLE_BUFFERS:6,VENDOR:7,RENDERER:8,VERSION:9,
  drawingBufferWidth:1440,drawingBufferHeight:900,active:null as object|null,lost:false,disjoint:false,supported:true,bits:64,
  autoAvailable:false,throwEnd:false,throwBegin:false,throwParameter:false,allocationFails:false,
  getExtension(name:string){calls.push({name:'getExtension',args:[name]});return name==='EXT_disjoint_timer_query_webgl2'&&this.supported?ext:null;},
  getQuery(target:number,pname:number){calls.push({name:'getQuery',args:[target,pname]});assert.equal(target,ext.TIME_ELAPSED_EXT);return pname===ext.QUERY_COUNTER_BITS_EXT?this.bits:this.active;},
  getParameter(pname:number):unknown{
   calls.push({name:'getParameter',args:[pname]});if(this.throwParameter)throw Error('parameter');
   if(pname===ext.GPU_DISJOINT_EXT){const value=this.disjoint;this.disjoint=false;return value;}
   return new Map<number,unknown>([[this.DRAW_FRAMEBUFFER_BINDING,null],[this.SAMPLES,4],[this.SAMPLE_BUFFERS,1],[this.VENDOR,'Native vendor'],[this.RENDERER,'Native renderer'],[this.VERSION,'WebGL 2']]).get(pname);
  },
  getContextAttributes(){calls.push({name:'getContextAttributes',args:[]});return {antialias:true};},
  isContextLost(){calls.push({name:'isContextLost',args:[]});return this.lost;},
  createQuery(){calls.push({name:'createQuery',args:[]});if(this.allocationFails)return null;const q={id:queries.length+1,available:this.autoAvailable,result:5_000_000_000};queries.push(q);return q;},
  deleteQuery(query:object){calls.push({name:'deleteQuery',args:[query]});},
  beginQuery(target:number,query:object){calls.push({name:'beginQuery',args:[target,query]});assert.equal(this.active,null);this.active=query;if(this.throwBegin)throw Error('begin');},
  endQuery(target:number){calls.push({name:'endQuery',args:[target]});assert.notEqual(this.active,null);if(this.throwEnd)throw Error('end');this.active=null;},
  getQueryParameter(query:object,pname:number):unknown{
   calls.push({name:'getQueryParameter',args:[query,pname]});assert.notEqual(this.active,query,'never poll an active query');
   const q=queries.find(q=>q===query)!;assert(q);
   if(pname===this.QUERY_RESULT_AVAILABLE)return q.available;
   assert.equal(pname,this.QUERY_RESULT);assert(q.available,'never request unavailable results');return q.result;
  },
 };
 const getContext=()=>{contextReads++;return gl as unknown as WebGL2RenderingContext;};
 const clock=()=>{if(clockThrows)throw Error('clock');return time;};
 const probe=createGpuDurationProbe(true,getContext,clock)!;
 const begin=(flags:Partial<GpuDurationFrameStart>={})=>{callback++;time+=20;probe.beginFrame({rafTimeMs:callback*20,cpuStartMs:time,recording:true,eligible:true,excluded:false,...flags});};
 const end=(values:Partial<GpuDurationFrameEnd>={})=>{time+=4;probe.endFrame({cpuEndMs:time,renderSubmitCpuMs:2,eligible:true,drawCalls:400,triangles:2_000_000,renderPasses:3,shadowUpdateRequested:true,...values});};
 const tick=(count=1,flags:Partial<GpuDurationFrameStart>={})=>{for(let i=0;i<count;i++){begin(flags);try{end();}finally{probe.cancelFrame();}}};
 return {gl,ext,probe,calls,queries,getContext,clock,begin,end,tick,get contextReads(){return contextReads;},set clockThrows(value:boolean){clockThrows=value;}};
}
const count=(f:ReturnType<typeof fixture>,name:string)=>f.calls.filter(c=>c.name===name).length;

test('flag off performs zero context acquisition, extension lookup, parameter or query calls',()=>{
 const f=fixture();
 for(const search of ['', '?gpu-duration=0','?profile=1&locationPerf=1','?gpu-duration=true']){
  const disabled=createGpuDurationProbe(gpuDurationEnabled(search),f.getContext,()=>{throw Error('clock must remain unused');});
  disabled?.snapshot();disabled?.dispose();assert.equal(disabled,undefined);
 }
 assert.equal(f.contextReads,0);assert.deepEqual(f.calls,[]);
 f.probe.snapshot();f.probe.dispose();assert.equal(f.contextReads,0);assert.deepEqual(f.calls,[]);
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
