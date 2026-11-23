import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuFrameGate,installGpuFramePacing,gpuFramePacingDiagnostics,attachGpuFramePacingProbe} from './gpuFramePacing.ts';
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
test('three-frame pacing overlaps real draws and waits when every slot is occupied',()=>{
 const f=fixture(),seen=[];installGpuFramePacing(f.renderer,3);
 f.renderer.setAnimationLoop(t=>{seen.push(t);f.renderer.info.render.frame++;});
 let polls=0;
 f.gl.clientWaitSync=()=>{polls++;return f.gl.TIMEOUT_EXPIRED;};
 for(const time of [100,116,132])f.tick(time);
 assert.equal(polls,0);
 for(const time of [148,164])f.tick(time);
 assert.deepEqual(seen,[100,116,132]);
 assert.deepEqual(f.calls,['fence','flush','fence','flush','fence','flush']);
 f.gl.clientWaitSync=()=>++polls===3?f.gl.CONDITION_SATISFIED:f.gl.TIMEOUT_EXPIRED;
 f.tick(180);f.tick(196);
 assert.deepEqual(seen,[100,116,132,180]);
 assert.equal(polls,4);
 assert.equal(gpuFramePacingDiagnostics(f.renderer).pendingFenceSkippedCallbacks,3);
 f.renderer.setAnimationLoop(null);
 assert.equal(f.calls.filter(call=>call==='delete').length,4);
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
