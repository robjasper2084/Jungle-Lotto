import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuFrameGate,installGpuFramePacing,gpuFramePacingDiagnostics,attachGpuFramePacingProbe,nativeAppleMetalRenderer} from './gpuFramePacing.ts';
import {ManualLoopProbe} from './loopDiagnostics.ts';
function fixture(){
 const calls=[],gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,
  lost:false,state:2,isContextLost(){return this.lost;},fenceSync(){calls.push('fence');return {};},
  clientWaitSync(_f,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);return this.state;},
  deleteSync(){calls.push('delete');},flush(){calls.push('flush');}};
 let callback=null;const renderer={domElement:new EventTarget(),xr:{isPresenting:false},info:{render:{frame:0}},getContext:()=>gl,
  setAnimationLoop(fn){callback=fn;},dispose(){calls.push('dispose');}};
 return {calls,gl,renderer,tick:(time=10,frame=undefined)=>callback?.(time,frame)};
}
test('pending GPU work never queues a second frame or performs a blocking wait',()=>{
 const f=fixture(),g=new GpuFrameGate(f.gl);assert(g.ready());g.submitted();
 for(let i=0;i<100;i++)assert.equal(g.ready(),false);
 assert.deepEqual(f.calls,['fence','flush']);assert.throws(()=>g.submitted(),/already in flight/);
 f.gl.state=f.gl.CONDITION_SATISFIED;assert(g.ready());assert.deepEqual(f.calls,['fence','flush','delete']);
});
test('completed callbacks keep the real wall timestamp, without invented catch-up ticks',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer);
 f.renderer.setAnimationLoop(t=>{seen.push(t);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);f.tick(132);assert.deepEqual(seen,[100]);
 f.gl.state=f.gl.ALREADY_SIGNALED;f.tick(480);assert.deepEqual(seen,[100,480]);
});
test('a split-screen callback submits both cameras before its single fence',()=>{
 const f=fixture();installGpuFramePacing(f.renderer);
 f.renderer.setAnimationLoop(()=>{for(let i=0;i<2;i++){f.calls.push('view'+i);f.renderer.info.render.frame++;}});f.tick();
 assert.deepEqual(f.calls,['view0','view1','fence','flush']);
});
test('a retained countdown or suspended preparation without draws creates no GPU work',()=>{
 const f=fixture();installGpuFramePacing(f.renderer);let n=0;f.renderer.setAnimationLoop(()=>n++);
 f.tick(1);f.tick(2);assert.equal(n,2);assert.deepEqual(f.calls,[]);
});
test('XR retains its scheduler and exact frame object',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer);f.renderer.setAnimationLoop((t,x)=>{seen.push([t,x]);f.renderer.info.render.frame++;});
 f.tick(1);f.renderer.xr.isPresenting=true;const xr={};f.tick(2,xr);f.tick(3,xr);
 assert.equal(seen.length,3);assert.equal(seen[2][1],xr);assert.deepEqual(f.calls,['fence','flush','delete']);
});
test('context loss clears outstanding work and does not report GPU readiness',()=>{
 const f=fixture(),g=new GpuFrameGate(f.gl);g.submitted();f.gl.lost=true;assert.equal(g.ready(),false);
 f.gl.lost=false;assert(g.ready());g.submitted();assert.deepEqual(f.calls,['fence','flush','fence','flush']);
});
test('restoring WebGL between animation callbacks drops the stale fence and resumes drawing',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer);
 f.renderer.setAnimationLoop(t=>{seen.push(t);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);
 f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));
 f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
 f.gl.state=f.gl.WAIT_FAILED;
 f.tick(150);
 assert.deepEqual(seen,[100,150]);
 assert.deepEqual(f.calls,['fence','flush','fence','flush']);
 const diagnostics=gpuFramePacingDiagnostics(f.renderer);
 assert.equal(diagnostics.currentPendingFenceObservedSpanMs,0);
 assert.equal(diagnostics.pendingFenceResumptions,0);
});
test('failed and missing GPU fences remain errors, never successful frames',()=>{
 const f=fixture(),g=new GpuFrameGate(f.gl);g.submitted();f.gl.state=f.gl.WAIT_FAILED;assert.throws(()=>g.ready(),/fence failed/);
 f.gl.fenceSync=()=>null;assert.throws(()=>g.submitted(),/unavailable/);
});
test('installation is idempotent and stop/disposal release owned work',()=>{
 const f=fixture(),original=f.renderer.setAnimationLoop,a=installGpuFramePacing(f.renderer);assert.equal(installGpuFramePacing(f.renderer),a);
 f.renderer.setAnimationLoop(()=>f.renderer.info.render.frame++);f.tick();f.renderer.setAnimationLoop(null);f.tick();
 assert.deepEqual(f.calls,['fence','flush','delete']);f.renderer.dispose();a();assert.equal(f.renderer.setAnimationLoop,original);assert.equal(f.calls.filter(x=>x==='dispose').length,1);
});
test('cleanup never overwrites a later renderer wrapper',()=>{
 const f=fixture(),cleanup=installGpuFramePacing(f.renderer),later=()=>{};f.renderer.setAnimationLoop=later;cleanup();assert.equal(f.renderer.setAnimationLoop,later);
});
test('minimal shader compiler doubles are untouched',()=>{const r={compileAsync(){}};const before=Object.keys(r);installGpuFramePacing(r)();assert.deepEqual(Object.keys(r),before);});
test('gate diagnostics count skipped callbacks and observed wall spans without changing delivery',()=>{
 const f=fixture(),seen=[];assert.equal(gpuFramePacingDiagnostics(f.renderer),null);installGpuFramePacing(f.renderer);
 f.renderer.setAnimationLoop(t=>{seen.push(t);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);f.tick(132);
 const during=gpuFramePacingDiagnostics(f.renderer);
 assert.equal(during.animationCallbacks,3);assert.equal(during.executedCallbacks,1);assert.equal(during.submittedCallbacks,1);
 assert.equal(during.pendingFenceSkippedCallbacks,2);assert.equal(during.pendingFenceObservedSpanMs,16);assert.equal(during.currentPendingFenceObservedSpanMs,16);
 // Returned snapshots cannot mutate the live counters or change a prior snapshot.
 during.pendingFenceSkippedCallbacks=999;
 f.gl.state=f.gl.CONDITION_SATISFIED;f.tick(180);
 const after=gpuFramePacingDiagnostics(f.renderer);
 assert.deepEqual(seen,[100,180]);assert.equal(after.pendingFenceSkippedCallbacks,2);assert.equal(after.pendingFenceResumptions,1);
 assert.equal(after.pendingFenceObservedSpanMs,64);assert.equal(after.longestPendingFenceObservedSpanMs,64);assert.equal(after.currentPendingFenceObservedSpanMs,0);
 assert.equal(after.executedCallbacks,2);assert.equal(after.submittedCallbacks,2);assert.equal(during.executedCallbacks,1);
});
test('context loss, XR and stopped loops remain distinct from pending-fence skips',()=>{
 const f=fixture();const cleanup=installGpuFramePacing(f.renderer);
 f.renderer.setAnimationLoop(()=>f.renderer.info.render.frame++);f.tick(100);f.tick(116);
 f.gl.lost=true;f.tick(140);f.tick(160);
 let report=gpuFramePacingDiagnostics(f.renderer);
 assert.equal(report.pendingFenceSkippedCallbacks,1);assert.equal(report.contextLostSkippedCallbacks,2);assert.equal(report.pendingFenceResumptions,0);
 assert.equal(report.pendingFenceObservedSpanMs,24);assert.equal(report.currentPendingFenceObservedSpanMs,0);
 f.gl.lost=false;f.renderer.xr.isPresenting=true;f.tick(180);f.tick(200);
 report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.xrCallbacks,2);assert.equal(report.submittedCallbacks,1);
 f.renderer.setAnimationLoop(null);f.tick(500);cleanup();
 const stopped=gpuFramePacingDiagnostics(f.renderer);assert.equal(stopped.installed,false);assert.equal(stopped.animationCallbacks,6);
 assert.equal(stopped.pendingFenceObservedSpanMs,24);
});

function timedFixture(){
 let time=0,clockCalls=0,callback=null,renderFrame=0,frameReads=0;
 const trace=[],callbackError=Error('callback sentinel'),flushError=Error('flush sentinel');
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,
  state:3,lost:false,throwFlush:false,
  isContextLost(){assert.equal(this,gl);trace.push('lost');time+=1;return this.lost;},
  fenceSync(condition,flags){assert.equal(this,gl);assert.equal(condition,1);assert.equal(flags,0);trace.push('fence');time+=5;return {fence:true};},
  clientWaitSync(fence,flags,timeout){assert.equal(this,gl);assert.deepEqual(fence,{fence:true});assert.equal(flags,0);assert.equal(timeout,0);trace.push('poll');time+=2;return this.state;},
  deleteSync(fence){assert.equal(this,gl);assert.deepEqual(fence,{fence:true});trace.push('delete');time+=3;},
  flush(){assert.equal(this,gl);trace.push('flush');time+=6;if(this.throwFlush)throw flushError;}};
 const render={get frame(){frameReads++;trace.push('frame-read');return renderFrame;}};
 const renderer={xr:{isPresenting:false},info:{render},getContext(){assert.equal(this,renderer);return gl;},
  setAnimationLoop(fn){assert.equal(this,renderer);callback=fn;},dispose(){assert.equal(this,renderer);trace.push('dispose');}};
 const probe=new ManualLoopProbe(()=>{clockCalls++;return time;});
 return {trace,gl,renderer,probe,callbackError,flushError,clockCalls:()=>clockCalls,frameReads:()=>frameReads,
  draw(){trace.push('draw');renderFrame++;time+=4;},advance(ms){time+=ms;},tick:(now=100,xr=undefined)=>callback?.(now,xr)};
}

test('manual loop timings have an independent native-duration ledger and do not add GL calls',()=>{
 const f=timedFixture();installGpuFramePacing(f.renderer);const binding=attachGpuFramePacingProbe(f.renderer,f.probe);
 assert.deepEqual(binding.coverage(),{installed:true,status:'installed'});f.probe.startCapture();
 f.renderer.setAnimationLoop(function(now,xr){assert.equal(this,undefined);assert.equal(now,100);assert.equal(xr,undefined);f.draw();});f.tick(100);
 assert.deepEqual(f.trace,['lost','frame-read','draw','frame-read','lost','fence','flush']);
 const report=f.probe.snapshot(),row=report.topCallbacks[0];
 assert.equal(row.scopes.totalWrapperCpuMs.cpuMs,17);assert.equal(row.scopes.gateReadyCpuMs.cpuMs,1);
 assert.equal(row.scopes.callbackBodyCpuMs.cpuMs,4);assert.equal(row.scopes.gateSubmittedCpuMs.cpuMs,12);
 assert.equal(row.scopes.fenceSyncCpuMs.cpuMs,5);assert.equal(row.scopes.flushCpuMs.cpuMs,6);
 assert.equal(row.scopes.profileSampleCpuMs,null);assert.equal(row.outcome,'executed');
 assert.equal(f.frameReads(),2,'observer outcome must not add a frame getter read');
});

test('observed and unobserved gate paths preserve the same native trace and callback delivery',()=>{
 const run=observe=>{
  const f=timedFixture();installGpuFramePacing(f.renderer);
  if(observe){attachGpuFramePacingProbe(f.renderer,f.probe);f.probe.startCapture();}
  const seen=[];f.renderer.setAnimationLoop(function(now,xr){assert.equal(this,undefined);seen.push([now,xr?.tag??null]);if(now!==300)f.draw();});
  f.tick(100);f.gl.state=f.gl.TIMEOUT_EXPIRED;f.tick(116);f.tick(132);
  f.gl.state=f.gl.CONDITION_SATISFIED;f.tick(180);f.gl.lost=true;f.tick(200);f.gl.lost=false;
  f.renderer.xr.isPresenting=true;const xr={tag:'xr'};f.tick(220,xr);f.renderer.xr.isPresenting=false;f.tick(300);
  f.renderer.setAnimationLoop(null);f.tick(400);f.renderer.dispose();
  return {trace:f.trace,seen,counters:gpuFramePacingDiagnostics(f.renderer),report:f.probe.snapshot(),clockCalls:f.clockCalls()};
 };
 const ordinary=run(false),observed=run(true);
 assert.deepEqual(observed.trace,ordinary.trace);assert.deepEqual(observed.seen,ordinary.seen);assert.deepEqual(observed.counters,ordinary.counters);
 assert.equal(ordinary.clockCalls,0);assert(observed.clockCalls>0);
 const rows=observed.report.topCallbacks;
 assert.equal(rows.filter(row=>row.outcome==='pending-fence').length,2);
 assert.equal(rows.filter(row=>row.outcome==='context-lost').length,1);
 assert.equal(rows.filter(row=>row.outcome==='xr').length,1);
 assert.equal(rows.filter(row=>row.outcome==='no-draw').length,1);
 for(const row of rows.filter(row=>row.outcome==='pending-fence'||row.outcome==='context-lost')){
  assert.equal(row.scopes.callbackBodyCpuMs,null);assert.equal(row.scopes.gateSubmittedCpuMs,null);
 }
 const xrRow=rows.find(row=>row.outcome==='xr');assert.equal(xrRow.scopes.gateReadyCpuMs,null);assert.equal(xrRow.scopes.fenceSyncCpuMs,null);
});

test('inactive, stopped and detached observers make zero clock calls while native rendering continues',()=>{
 const f=timedFixture();installGpuFramePacing(f.renderer);const binding=attachGpuFramePacingProbe(f.renderer,f.probe);
 f.renderer.setAnimationLoop(()=>f.draw());f.tick(100);f.tick(120);assert.equal(f.clockCalls(),0);
 f.probe.startCapture();f.tick(140);assert(f.clockCalls()>0);f.probe.stopCapture();const stopped=f.clockCalls();
 f.tick(160);assert.equal(f.clockCalls(),stopped);
 f.probe.startCapture();binding.detach();const detached=f.clockCalls();f.tick(180);assert.equal(f.clockCalls(),detached);
 assert.deepEqual(binding.coverage(),{installed:false,status:'detached'});
 assert.equal(f.trace.filter(value=>value==='draw').length,5);
});

test('a failed duplicate observer attachment cannot detach the original owner',()=>{
 const f=timedFixture();installGpuFramePacing(f.renderer);const first=attachGpuFramePacingProbe(f.renderer,f.probe),second=attachGpuFramePacingProbe(f.renderer,f.probe);
 assert.equal(first.coverage().installed,true);assert.equal(second.coverage().installed,false);second.detach();
 assert.equal(first.coverage().installed,true);f.probe.startCapture();f.renderer.setAnimationLoop(()=>f.draw());f.tick();
 assert.equal(f.probe.snapshot().completedCallbacks,1);first.detach();assert.equal(first.coverage().installed,false);
 const unsupported=attachGpuFramePacingProbe({},new ManualLoopProbe(()=>{throw Error('must not read');}));
 assert.deepEqual(unsupported.coverage(),{installed:false,status:'unavailable'});unsupported.detach();
});

test('callback and submission error identity and original finally precedence survive observation',()=>{
 for(const observe of [false,true])for(const throwFlush of [false,true]){
  const f=timedFixture();installGpuFramePacing(f.renderer);if(observe){attachGpuFramePacingProbe(f.renderer,f.probe);f.probe.startCapture();}
  f.gl.throwFlush=throwFlush;f.renderer.setAnimationLoop(()=>{f.draw();throw f.callbackError;});
  assert.throws(()=>f.tick(),error=>error===(throwFlush?f.flushError:f.callbackError));
  assert.deepEqual(f.trace,['lost','frame-read','draw','frame-read','lost','fence','flush']);
  if(observe){const row=f.probe.snapshot().topCallbacks[0];assert.equal(row.outcome,'error');assert.equal(row.scopes.flushCpuMs.cpuMs,6);}
 }
});

test('observer failures and invalid clocks do not mask native exceptions or stop native work',()=>{
 const f=timedFixture();installGpuFramePacing(f.renderer);attachGpuFramePacingProbe(f.renderer,f.probe);f.probe.startCapture();
 f.probe.endScope=()=>{throw Error('observer sentinel');};
 f.renderer.setAnimationLoop(()=>{f.draw();throw f.callbackError;});assert.throws(()=>f.tick(),error=>error===f.callbackError);
 assert.equal(f.probe.capturing,false);const clocks=f.clockCalls();assert.throws(()=>f.tick(120),error=>error===f.callbackError);assert.equal(f.clockCalls(),clocks);
 const g=timedFixture();const bad=new ManualLoopProbe(()=>{throw Error('clock sentinel');});installGpuFramePacing(g.renderer);attachGpuFramePacingProbe(g.renderer,bad);bad.startCapture();
 g.renderer.setAnimationLoop(()=>g.draw());assert.doesNotThrow(()=>g.tick());assert.equal(g.trace.filter(value=>value==='draw').length,1);
 assert(bad.snapshot().invalidObservations>0);assert.equal(bad.snapshot().allCallbacks.invalidCallbacks,1);
});

function queuedFixture(){
 const f=fixture(),fences=[],states=new Map(),polls=[],deleted=[];
 f.gl.fenceSync=function(condition,flags){assert.equal(condition,this.SYNC_GPU_COMMANDS_COMPLETE);assert.equal(flags,0);const fence={id:fences.length+1};fences.push(fence);states.set(fence,this.TIMEOUT_EXPIRED);f.calls.push('fence'+fence.id);return fence;};
 f.gl.clientWaitSync=function(fence,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);assert(states.has(fence),'only live owned fences may be polled');polls.push(fence.id);return states.get(fence);};
 f.gl.deleteSync=function(fence){assert(states.has(fence),'each live fence is deleted once');states.delete(fence);deleted.push(fence.id);f.calls.push('delete'+fence.id);};
 return {...f,fences,states,polls,deleted,complete(id){states.set(fences[id-1],f.gl.CONDITION_SATISFIED);}};
}

test('only positively identified native Apple Metal canvases select browser pacing',()=>{
 for(const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version)','ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)'])assert.equal(nativeAppleMetalRenderer(name),true,name);
 for(const name of ['',null,undefined,42,'WebKit WebGL','Apple GPU','Apple M1','Apple A17 GPU','Apple unknown renderer','ANGLE (NVIDIA, NVIDIA GeForce RTX 4090, D3D11)','ANGLE (Apple, ANGLE Metal Renderer: Apple SwiftShader)','ANGLE Metal Renderer: Apple M1 llvmpipe','ANGLE Metal Renderer: Apple M2 softpipe','Apple software rasterizer'])assert.equal(nativeAppleMetalRenderer(name),false,String(name));
});

test('capacity is explicitly bounded to one, two or three with the old default retained',()=>{
 const f=fixture();assert.equal(new GpuFrameGate(f.gl).capacity,1);assert.equal(new GpuFrameGate(f.gl,2).capacity,2);assert.equal(new GpuFrameGate(f.gl,3).capacity,3);
 for(const capacity of [0,-1,4,1.5,NaN,Infinity,'2',null]){
  assert.throws(()=>new GpuFrameGate(f.gl,capacity),RangeError);
  assert.throws(()=>installGpuFramePacing(fixture().renderer,{capacity}),RangeError);
 }
 installGpuFramePacing(f.renderer);assert.equal(gpuFramePacingDiagnostics(f.renderer).capacity,1);
});

test('two callbacks stay bounded and a later signaled fence never bypasses an older pending fence',()=>{
 const f=queuedFixture(),g=new GpuFrameGate(f.gl,2);assert(g.ready());g.submitted();assert(g.ready());g.submitted();
 assert.equal(g.pendingCount,2);for(let i=0;i<50;i++)assert.equal(g.ready(),false);
 f.complete(2);assert.equal(g.ready(),false);assert(f.polls.every(id=>id===1));assert.deepEqual(f.deleted,[]);
 assert.throws(()=>g.submitted(),/queue limit/);assert.equal(f.fences.length,2);
 f.complete(1);assert(g.ready());assert.deepEqual(f.polls.slice(-2),[1,2]);assert.deepEqual(f.deleted,[1,2]);
 assert.equal(g.pendingCount,0);assert.equal(g.completed,2);assert.equal(g.peakPending,2);
});

test('reaping only the oldest completed callback opens exactly one slot',()=>{
 const f=queuedFixture(),g=new GpuFrameGate(f.gl,2);g.submitted();g.submitted();f.complete(1);
 assert(g.ready());assert.equal(g.pendingCount,1);assert.equal(g.completed,1);assert.deepEqual(f.deleted,[1]);
 g.submitted();assert.equal(g.pendingCount,2);assert.equal(g.ready(),false);assert.equal(f.polls.at(-1),2);
 f.complete(2);f.complete(3);assert(g.ready());assert.equal(g.completed,3);assert.deepEqual(f.deleted,[1,2,3]);
});

test('native two-callback pacing keeps exact timestamps and one fence after every co-op view',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:2});
 f.renderer.setAnimationLoop((now,frame)=>{seen.push([now,frame]);for(let view=0;view<4;view++){f.calls.push('view'+view);f.renderer.info.render.frame++;}});
 const first={},second={},third={};f.tick(100,first);f.tick(116,second);f.tick(132,{});
 assert.deepEqual(seen,[[100,first],[116,second]]);assert.deepEqual(f.calls,['view0','view1','view2','view3','fence1','flush','view0','view1','view2','view3','fence2','flush']);
 f.complete(1);f.tick(180,third);assert.deepEqual(seen,[[100,first],[116,second],[180,third]]);assert.equal(f.fences.length,3);
 const snapshot=gpuFramePacingDiagnostics(f.renderer);assert.equal(snapshot.capacity,2);assert.equal(snapshot.pendingCallbacks,2);assert.equal(snapshot.completedCallbacks,1);assert.equal(snapshot.peakPendingCallbacks,2);assert.equal(snapshot.submittedCallbacks,3);assert.equal(snapshot.pendingFenceSkippedCallbacks,1);
 snapshot.capacity=9;snapshot.pendingCallbacks=99;assert.equal(gpuFramePacingDiagnostics(f.renderer).capacity,2);assert.equal(gpuFramePacingDiagnostics(f.renderer).pendingCallbacks,2);
});

test('native two-callback XR entry clears the full queue and preserves the browser frame object',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:2});f.renderer.setAnimationLoop((now,frame)=>{seen.push([now,frame]);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);f.renderer.xr.isPresenting=true;const xr={};f.tick(132,xr);f.tick(148,xr);
 assert.deepEqual(f.deleted,[1,2]);assert.equal(f.fences.length,2);assert.equal(seen[2][1],xr);assert.equal(seen[3][1],xr);
 let report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.pendingCallbacks,0);assert.equal(report.completedCallbacks,0);assert.equal(report.xrCallbacks,2);
 f.renderer.xr.isPresenting=false;f.tick(180);report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.pendingCallbacks,1);assert.equal(report.submittedCallbacks,3);
});

test('context loss and restoration forget both stale fences without polling or deleting them',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:2});f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);const polled=f.polls.length;f.gl.lost=true;f.tick(132);assert.equal(f.polls.length,polled);assert.deepEqual(f.deleted,[]);
 let report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.pendingCallbacks,0);assert.equal(report.completedCallbacks,0);assert.equal(report.contextLostSkippedCallbacks,1);
 f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.gl.lost=false;f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(180);
 assert.deepEqual(seen,[100,116,180]);assert.equal(f.polls.length,polled);assert.equal(gpuFramePacingDiagnostics(f.renderer).pendingCallbacks,1);
});

test('WAIT_FAILED is sticky even when native two-callback capacity has a spare slot',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:2});f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});
 f.tick(100);f.states.set(f.fences[0],f.gl.WAIT_FAILED);assert.throws(()=>f.tick(116),/fence failed/);assert.deepEqual(f.deleted,[1]);
 assert.throws(()=>f.tick(132),/fence failed/);assert.deepEqual(seen,[100]);assert.equal(gpuFramePacingDiagnostics(f.renderer).completedCallbacks,0);
 f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(180);assert.deepEqual(seen,[100,180]);
});

test('missing fences and failed flushes never reopen native capacity on the next callback',()=>{
 for(const mode of ['missing','flush']){
  const f=queuedFixture(),seen=[],error=Error('native flush failed');installGpuFramePacing(f.renderer,{capacity:2});
  if(mode==='missing')f.gl.fenceSync=()=>null;else f.gl.flush=()=>{throw error;};
  f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});
  assert.throws(()=>f.tick(100),e=>mode==='missing'?/unavailable/.test(e.message):e===error);
  assert.throws(()=>f.tick(116),/fence failed/);assert.deepEqual(seen,[100]);
 }
});

test('context loss inside a callback does not count an older pending fence as a new submission',()=>{
 const f=queuedFixture();installGpuFramePacing(f.renderer,{capacity:2});
 f.renderer.setAnimationLoop(now=>{f.renderer.info.render.frame++;if(now===116)f.gl.lost=true;});f.tick(100);f.tick(116);
 const report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.submittedCallbacks,1);assert.equal(report.pendingCallbacks,0);assert.equal(report.completedCallbacks,0);assert.deepEqual(f.deleted,[]);
});

test('stop and cleanup release a full native queue once without inventing completed callbacks',()=>{
 for(const mode of ['stop','dispose','cleanup']){
  const f=queuedFixture(),original=f.renderer.setAnimationLoop,cleanup=installGpuFramePacing(f.renderer,{capacity:2});f.renderer.setAnimationLoop(()=>f.renderer.info.render.frame++);f.tick(100);f.tick(116);
  if(mode==='stop')f.renderer.setAnimationLoop(null);else if(mode==='dispose')f.renderer.dispose();else cleanup();
  assert.deepEqual(f.deleted,[1,2]);assert.equal(gpuFramePacingDiagnostics(f.renderer).pendingCallbacks,0);assert.equal(gpuFramePacingDiagnostics(f.renderer).completedCallbacks,0);
  cleanup();assert.deepEqual(f.deleted,[1,2]);assert.equal(f.renderer.setAnimationLoop,original);
 }
});

test('stopping from inside a callback cannot create a fence after the loop was cleared',()=>{
 const f=queuedFixture();installGpuFramePacing(f.renderer,{capacity:2});f.renderer.setAnimationLoop(()=>{f.renderer.info.render.frame++;f.renderer.setAnimationLoop(null);});f.tick(100);f.tick(116);
 assert.equal(f.fences.length,0);assert.equal(gpuFramePacingDiagnostics(f.renderer).submittedCallbacks,0);
});

test('three-slot FIFO rejects a fourth submission and reuses only actually completed slots',()=>{
 const f=queuedFixture(),g=new GpuFrameGate(f.gl,3);
 for(let i=0;i<3;i++){assert(g.ready());g.submitted();}
 assert.equal(g.pendingCount,3);assert.equal(g.ready(),false);assert.throws(()=>g.submitted(),/queue limit/);
 f.complete(2);f.complete(3);assert.equal(g.ready(),false);assert.equal(f.polls.at(-1),1);assert.deepEqual(f.deleted,[]);
 f.complete(1);assert(g.ready());assert.deepEqual(f.deleted,[1,2,3]);assert.equal(g.completed,3);
 for(let i=0;i<3;i++)g.submitted();f.complete(4);assert(g.ready());assert.equal(g.pendingCount,2);assert.equal(g.completed,4);
 g.submitted();assert.equal(g.pendingCount,3);assert.equal(g.ready(),false);assert.equal(f.polls.at(-1),5);assert.equal(g.peakPending,3);
 f.complete(5);f.complete(6);f.complete(7);assert(g.ready());assert.equal(g.completed,7);assert.equal(g.pendingCount,0);
});

test('three-slot delivery retains real timestamps and one fence after all four views',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:3});
 f.renderer.setAnimationLoop((now,frame)=>{seen.push([now,frame]);for(let view=0;view<4;view++){f.calls.push(now+':view'+view);f.renderer.info.render.frame++;}});
 const frames=[{},{},{},{}];f.tick(100,frames[0]);f.tick(116,frames[1]);f.tick(132,frames[2]);f.tick(148,{});
 assert.deepEqual(seen,[[100,frames[0]],[116,frames[1]],[132,frames[2]]]);assert.equal(f.fences.length,3);
 for(let i=0;i<3;i++)assert.deepEqual(f.calls.slice(i*6,(i+1)*6),[...[100,116,132].slice(i,i+1).flatMap(now=>[0,1,2,3].map(view=>now+':view'+view)),'fence'+(i+1),'flush']);
 f.complete(1);f.tick(211,frames[3]);assert.deepEqual(seen.at(-1),[211,frames[3]]);
 const report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.capacity,3);assert.equal(report.pendingCallbacks,3);assert.equal(report.peakPendingCallbacks,3);assert.equal(report.completedCallbacks,1);assert.equal(report.submittedCallbacks,4);assert.equal(report.pendingFenceSkippedCallbacks,1);
});

test('a full three-slot queue is safely released or forgotten across every native lifecycle boundary',()=>{
 for(const mode of ['xr','context','stop','dispose','cleanup']){
  const f=queuedFixture(),seen=[],cleanup=installGpuFramePacing(f.renderer,{capacity:3});f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});f.tick(100);f.tick(116);f.tick(132);f.tick(148);
  assert.deepEqual(seen,[100,116,132]);
  if(mode==='xr'){f.renderer.xr.isPresenting=true;f.tick(164,{});assert.deepEqual(seen,[100,116,132,164]);}
  else if(mode==='context'){f.gl.lost=true;f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.tick(164);f.gl.lost=false;f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));}
  else if(mode==='stop')f.renderer.setAnimationLoop(null);else if(mode==='dispose')f.renderer.dispose();else cleanup();
  const report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.capacity,3);assert.equal(report.pendingCallbacks,0);assert.equal(report.peakPendingCallbacks,3);assert.equal(report.completedCallbacks,0);assert.deepEqual(f.deleted,mode==='context'?[]:[1,2,3]);
  if(mode==='context'){const polled=f.polls.length;f.tick(200);assert.equal(f.polls.length,polled);assert.equal(gpuFramePacingDiagnostics(f.renderer).pendingCallbacks,1);}
  cleanup();
 }
});

test('three-slot spare capacity never overrides a failed oldest fence',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{capacity:3});f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});
 f.tick(100);f.tick(116);f.states.set(f.fences[0],f.gl.WAIT_FAILED);assert.throws(()=>f.tick(132),/fence failed/);assert.deepEqual(f.deleted,[1,2]);
 assert.throws(()=>f.tick(148),/fence failed/);assert.deepEqual(seen,[100,116]);assert.equal(gpuFramePacingDiagnostics(f.renderer).completedCallbacks,0);
 f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(200);assert.deepEqual(seen,[100,116,200]);
});

test('browser pacing delivers every original callback and all co-op views without native fences',()=>{
 const f=queuedFixture(),seen=[];installGpuFramePacing(f.renderer,{mode:'browser'});
 f.renderer.setAnimationLoop(function(now,frame){assert.equal(this,undefined);seen.push([now,frame]);for(let view=0;view<4;view++){f.calls.push('view'+view);f.renderer.info.render.frame++;}});
 const frames=[{id:1},{id:2},{id:3}];for(let i=0;i<frames.length;i++)f.tick([100,116,400][i],frames[i]);
 assert.deepEqual(seen,[[100,frames[0]],[116,frames[1]],[400,frames[2]]]);
 assert.deepEqual(f.calls,Array.from({length:3},()=>['view0','view1','view2','view3']).flat());
 assert.deepEqual(f.fences,[]);assert.deepEqual(f.polls,[]);assert.deepEqual(f.deleted,[]);
 const report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.mode,'browser');assert.equal(report.executedCallbacks,3);assert.equal(report.renderedCallbacks,3);assert.equal(report.submittedCallbacks,0);
 for(const key of ['capacity','pendingCallbacks','completedCallbacks','peakPendingCallbacks'])assert.equal(report[key],null,key);
});

test('browser pacing preserves the pre-body context-loss skip and original recovery timestamp',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer,{mode:'browser'});
 f.renderer.setAnimationLoop(now=>{seen.push(now);f.renderer.info.render.frame++;});f.tick(100);
 f.gl.lost=true;f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.tick(116);f.tick(400);
 assert.deepEqual(seen,[100]);f.gl.lost=false;f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(700);
 assert.deepEqual(seen,[100,700]);assert.deepEqual(f.calls,[]);
 const report=gpuFramePacingDiagnostics(f.renderer);assert.equal(report.contextLostSkippedCallbacks,2);assert.equal(report.pendingFenceSkippedCallbacks,0);assert.equal(report.renderedCallbacks,2);
});

test('browser mode keeps the existing XR scheduler and exact frame object without fences',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer,{mode:'browser'});
 f.renderer.setAnimationLoop((now,frame)=>{seen.push([now,frame]);f.renderer.info.render.frame++;});f.tick(100);
 f.renderer.xr.isPresenting=true;const frame={session:'native-xr'};f.tick(120,frame);f.tick(140,frame);
 f.renderer.xr.isPresenting=false;f.tick(300);
 assert.deepEqual(seen,[[100,undefined],[120,frame],[140,frame],[300,undefined]]);assert.deepEqual(f.calls,[]);
 assert.equal(gpuFramePacingDiagnostics(f.renderer).xrCallbacks,2);
});

test('browser-mode stop inside a callback and disposal never create replacement scheduling work',()=>{
 const f=fixture(),original=f.renderer.setAnimationLoop,cleanup=installGpuFramePacing(f.renderer,{mode:'browser'});let runs=0;
 assert.equal(installGpuFramePacing(f.renderer,{mode:'browser'}),cleanup);
 f.renderer.setAnimationLoop(()=>{runs++;f.renderer.info.render.frame++;f.renderer.setAnimationLoop(null);});f.tick(100);f.tick(200);assert.equal(runs,1);
 f.renderer.setAnimationLoop(()=>runs++);f.tick(400);assert.equal(runs,2);f.renderer.dispose();f.tick(500);cleanup();
 assert.equal(runs,2);assert.equal(f.renderer.setAnimationLoop,original);assert.deepEqual(f.calls,['dispose']);assert.equal(gpuFramePacingDiagnostics(f.renderer).installed,false);
});

test('browser observer reports real callbacks and render-counter changes with no invented GPU timings',()=>{
 const f=timedFixture();installGpuFramePacing(f.renderer,{mode:'browser'});const binding=attachGpuFramePacingProbe(f.renderer,f.probe);f.probe.startCapture();
 f.renderer.setAnimationLoop(now=>{if(now===100)f.draw();});f.tick(100);f.tick(200);f.gl.lost=true;f.tick(300);
 assert.equal(binding.coverage().installed,true);assert.deepEqual(f.trace,['lost','frame-read','draw','frame-read','lost','frame-read','frame-read','lost']);
 const report=f.probe.snapshot();assert.equal(report.completedCallbacks,3);
 assert.deepEqual(report.topCallbacks.map(row=>row.outcome).sort(),['context-lost','executed','no-draw']);
 for(const row of report.topCallbacks)for(const scope of ['gateSubmittedCpuMs','fenceSyncCpuMs','flushCpuMs'])assert.equal(row.scopes[scope],null,scope);
 assert.equal(gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,1);assert.equal(gpuFramePacingDiagnostics(f.renderer).completedCallbacks,null);
});

test('browser observation preserves exceptions and identical native calls',()=>{
 const run=observe=>{
  const f=timedFixture();installGpuFramePacing(f.renderer,{mode:'browser'});if(observe){attachGpuFramePacingProbe(f.renderer,f.probe);f.probe.startCapture();}
  f.renderer.setAnimationLoop(()=>{f.draw();throw f.callbackError;});assert.throws(()=>f.tick(480),error=>error===f.callbackError);
  if(observe)assert.equal(f.probe.snapshot().topCallbacks[0].outcome,'error');
  return {trace:f.trace,diagnostics:gpuFramePacingDiagnostics(f.renderer)};
 };
 assert.deepEqual(run(true),run(false));
});

test('browser pacing does not depend on sync methods and does not change independent warmup gates',()=>{
 const f=fixture();delete f.gl.fenceSync;delete f.gl.clientWaitSync;installGpuFramePacing(f.renderer,{mode:'browser'});let runs=0;f.renderer.setAnimationLoop(()=>runs++);f.tick(100);assert.equal(runs,1);
 const warmup=fixture(),gate=new GpuFrameGate(warmup.gl);gate.submitted();assert.equal(gate.ready(),false);assert.deepEqual(warmup.calls,['fence','flush']);
 assert.throws(()=>installGpuFramePacing(fixture().renderer,{mode:'invalid'}),RangeError);
});
