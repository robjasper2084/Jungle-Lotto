import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualPipelineProbe,pipelineDiagnosticRequested,PIPELINE_DIAGNOSTIC_LIMITS} from './pipelineDiagnostics.ts';
import {installGpuFramePacing,gpuFramePacingDiagnostics,type GpuFrameCapacity,type GpuFramePacingMode} from './gpuFramePacing.ts';

type Animation=(now:number,frame?:unknown)=>unknown;
function fixture(observe=true,capacity:GpuFrameCapacity=1,mode:GpuFramePacingMode='fence'){
 let clock=0,animation:Animation|null=null,nextFence=0,drawing=true;
 const calls:string[]=[],seen:{time:number;frame:unknown}[]=[],syncs:object[]=[];
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,
  state:2,lost:false,failFence:null as unknown,failWait:null as unknown,failDelete:null as unknown,
  isContextLost(){assert.equal(this,gl);calls.push('isContextLost');clock++;return this.lost;},
  fenceSync(condition:number,flags:number){assert.equal(this,gl);assert.equal(condition,1);assert.equal(flags,0);calls.push('fence');clock+=2;if(this.failFence)throw this.failFence;const sync={id:++nextFence};syncs.push(sync);return sync;},
  clientWaitSync(sync:object,flags:number,timeout:number){assert.equal(this,gl);assert.ok(syncs.includes(sync));assert.equal(flags,0);assert.equal(timeout,0);calls.push('wait');clock+=3;if(this.failWait)throw this.failWait;return this.state;},
  deleteSync(sync:object){assert.equal(this,gl);assert.ok(syncs.includes(sync));calls.push('delete');clock++;if(this.failDelete)throw this.failDelete;},
  flush(){assert.equal(this,gl);calls.push('flush');clock++;},
 };
 const renderer={domElement:new EventTarget(),xr:{isPresenting:false},info:{render:{frame:0}},getContext:()=>gl,
  setAnimationLoop(callback:Animation|null){assert.equal(this,renderer);calls.push(callback?'set-loop':'stop-loop');animation=callback;},
  dispose(){assert.equal(this,renderer);calls.push('dispose');},
 };
 const native={set:renderer.setAnimationLoop,fence:gl.fenceSync,wait:gl.clientWaitSync,delete:gl.deleteSync};
 const probe=observe?new ManualPipelineProbe(renderer,()=>clock):undefined;
 const cleanup=installGpuFramePacing(renderer,{capacity,mode});
 const body=(time:number,frame?:unknown)=>{seen.push({time,frame});if(!drawing)return;for(let view=0;view<4;view++){calls.push('view'+view);clock+=2;renderer.info.render.frame++;}};
 renderer.setAnimationLoop((time,frame)=>probe?probe.runGameFrame(()=>body(time,frame),true):body(time,frame));
 return {gl,renderer,calls,seen,syncs,probe,native,cleanup,tick:(time:number,frame?:unknown)=>{clock=time+2;return animation?.(time,frame);},clock:()=>clock,setClock:(value:number)=>{clock=value;},setDrawing:(value:boolean)=>{drawing=value;}};
}

test('pipeline observation requires a separate explicit localhost manual flag',()=>{
 for(const hostname of ['localhost','127.0.0.1','[::1]'])assert.equal(pipelineDiagnosticRequested({hostname,search:'?profile=manual&pipelineProbe=1'}),true);
 for(const hostname of ['example.com','localhost.evil.test'])assert.equal(pipelineDiagnosticRequested({hostname,search:'?profile=manual&pipelineProbe=1'}),false);
 for(const search of ['?profile=1&pipelineProbe=1','?profile=manual','?profile=manual&gpuProbe=frame','?profile=manual&pipelineProbe=0'])assert.equal(pipelineDiagnosticRequested({hostname:'localhost',search}),false);
});

test('observing a real bounded gate preserves every native call, timestamp, XR frame, all views and lifecycle ordering',()=>{
 const run=(observe:boolean)=>{
  const f=fixture(observe,3),xrFrame={view:'xr'};f.probe?.startCapture();
  for(const time of [100,116,132,148])f.tick(time);
  f.gl.state=f.gl.ALREADY_SIGNALED;f.tick(300);
  f.renderer.xr.isPresenting=true;f.tick(316,xrFrame);
  f.renderer.xr.isPresenting=false;f.gl.lost=true;f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.tick(400);
  f.gl.lost=false;f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(450);
  f.renderer.setAnimationLoop(null);f.renderer.dispose();f.probe?.stopCapture();
  return {calls:f.calls,seen:f.seen,pacing:gpuFramePacingDiagnostics(f.renderer)};
 };
 assert.deepEqual(run(true),run(false));
});

test('browser-mode observation preserves delivery, errors and lifecycle without adding native GPU work',()=>{
 const run=(observe:boolean)=>{
  const f=fixture(observe,1,'browser'),frame={native:'frame'},xrFrame={native:'xr'};f.probe?.startCapture();
  f.tick(100,frame);f.setDrawing(false);f.tick(116);f.setDrawing(true);f.tick(132);
  f.gl.lost=true;f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.tick(148);
  f.gl.lost=false;f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(164);
  f.renderer.xr.isPresenting=true;f.tick(180,xrFrame);f.renderer.xr.isPresenting=false;
  const originalError={native:'callback error'},body=()=>{throw originalError;};
  f.renderer.setAnimationLoop(()=>f.probe?f.probe.runGameFrame(body,true):body());
  assert.throws(()=>f.tick(196),value=>value===originalError);
  f.renderer.setAnimationLoop(null);f.tick(212);f.renderer.dispose();f.probe?.stopCapture();
  assert.equal(f.syncs.length,0);assert.ok(f.calls.every(x=>!['fence','wait','delete','flush'].includes(x)));
  assert.deepEqual(f.seen.map(x=>x.time),[100,116,132,164,180]);
  assert.equal(f.seen[0].frame,frame);assert.equal(f.seen.at(-1)!.frame,xrFrame);
  return {calls:f.calls,seen:f.seen,pacing:gpuFramePacingDiagnostics(f.renderer)};
 };
 assert.deepEqual(run(true),run(false));
});

test('browser ledger preserves null completion and separates actual render observations from zero application fences',()=>{
 const f=fixture(true,1,'browser');f.probe!.startCapture();
 f.tick(100);f.setDrawing(false);f.tick(116);f.setDrawing(true);f.gl.lost=true;f.tick(132);
 f.gl.lost=false;f.tick(200);f.renderer.xr.isPresenting=true;f.tick(216,{native:'xr'});
 const callsBefore=f.calls.slice(),r=f.probe!.stopCapture();assert.deepEqual(f.calls,callsBefore);
 assert.equal(r.coverage.complete,true);assert.equal(r.observerErrors,0);
 assert.deepEqual(r.callbacks.map(x=>x.originalTimestampMs),[100,116,132,200,216]);
 assert.deepEqual(r.callbacks.map(x=>x.gameCalls),[1,1,0,1,1]);
 assert.deepEqual(r.callbacks.map(x=>x.renderedDelta),[1,0,0,1,0]);
 assert.deepEqual(r.callbacks.map(x=>x.outcome),['executed-no-fence','executed-no-fence','context-lost','executed-no-fence','xr']);
 for(const row of r.callbacks){
  assert.equal(row.pendingBefore,null);assert.equal(row.pendingAfter,null);assert.equal(row.completedDelta,null);
  assert.equal(row.submittedDelta,0);
 }
 assert.equal(r.counts.executedCallbacks,4);assert.equal(r.counts.contextLostSkippedCallbacks,1);
 assert.equal(r.counts.fenceSyncCalls,0);assert.equal(r.counts.clientWaitSyncCalls,0);assert.equal(r.counts.deleteSyncCalls,0);
 assert.deepEqual(r.syncEvents,[]);assert.deepEqual(r.fences,{atStart:[],finished:[],pending:[]});
 assert.equal(r.pacing.atFinish?.renderedCallbacks,2);assert.equal(r.pacing.atFinish?.completedCallbacks,null);
 assert.equal(r.pacing.atFinish?.capacity,null);assert.equal(r.pacing.atFinish?.peakPendingCallbacks,null);
 f.renderer.xr.isPresenting=false;f.tick(300);assert.deepEqual(f.probe!.snapshot(),r);
});

test('ledger associates skipped and executed callbacks with exact native timeout and first-signaled observations',()=>{
 const f=fixture();f.probe!.startCapture();f.tick(100);f.tick(116);f.tick(132);f.gl.state=f.gl.CONDITION_SATISFIED;f.tick(200);
 const report=f.probe!.stopCapture();
 assert.equal(report.coverage.complete,true);assert.equal(report.observerErrors,0);
 assert.deepEqual(report.callbacks.map(x=>x.originalTimestampMs),[100,116,132,200]);
 assert.deepEqual(report.callbacks.map(x=>x.outcome),['executed','pending-fence','pending-fence','executed']);
 assert.deepEqual(report.callbacks.map(x=>x.gateCallback),[1,2,3,4]);
 assert.equal(report.counts.callbacks,4);assert.equal(report.counts.executedCallbacks,2);assert.equal(report.counts.pendingFenceSkippedCallbacks,2);
 assert.equal(report.counts.fenceSyncCalls,2);assert.equal(report.counts.clientWaitSyncCalls,3);assert.equal(report.counts.deleteSyncCalls,1);
 const fence=report.fences.finished[0],last=report.callbacks[3],next=report.fences.pending[0];
 assert.equal(fence.createdCallbackId,report.callbacks[0].id);assert.equal(fence.lastTimeout?.callbackId,report.callbacks[2].id);
 assert.equal(fence.firstSignaled?.callbackId,last.id);assert.equal(fence.disposition,'deleted-after-signaled');
 assert.ok(fence.lastTimeout!.enteredWallMs!<fence.lastTimeout!.exitedWallMs!);
 assert.ok(fence.lastTimeout!.exitedWallMs!<fence.firstSignaled!.enteredWallMs!);
 assert.ok(fence.firstSignaled!.exitedWallMs!<=last.gameEnteredWallMs!);
 assert.ok(last.gameExitedWallMs!<=next.createdEnteredWallMs!,'the single fence follows all four game views');
 assert.equal(last.completedDelta,1);assert.equal(last.submittedDelta,1);assert.equal(last.renderedDelta,1);
 assert.ok(report.syncEvents.filter(x=>x.method==='clientWaitSync').every(x=>x.flags===0&&x.timeoutNs===0));
});

test('manual boundaries retain preexisting fences and freeze extraction without issuing any native calls',()=>{
 const f=fixture();f.tick(50);f.probe!.startCapture();f.tick(100);f.gl.state=f.gl.ALREADY_SIGNALED;f.tick(150);
 const callsBefore=f.calls.slice(),report=f.probe!.stopCapture();assert.deepEqual(f.calls,callsBefore);
 assert.equal(report.fences.atStart.length,1);assert.equal(report.fences.atStart[0].createdCapture,0);
 assert.equal(report.fences.finished[0].id,report.fences.atStart[0].id);
 f.tick(200);assert.deepEqual(f.probe!.snapshot(),report,'post-Stop menu work cannot mutate the captured ledger');
 report.callbacks[0].outcome='mutated';assert.notEqual(f.probe!.snapshot().callbacks[0].outcome,'mutated');
 f.probe!.startCapture();f.tick(250);const next=f.probe!.stopCapture();
 assert.equal(next.capture,2);assert.equal(next.callbacks.length,1);assert.equal(next.fences.atStart.length,1);
 assert.equal(next.dropped.callbacks,0);
});

test('WAIT_FAILED with spare native queue capacity remains an original error, never a successful completion',()=>{
 const f=fixture(true,3);f.probe!.startCapture();f.tick(100);f.gl.state=f.gl.WAIT_FAILED;
 assert.throws(()=>f.tick(116),/GPU fence failed/);
 const r=f.probe!.stopCapture();assert.equal(r.counts.waitFailed,1);assert.equal(r.counts.signaled,0);
 assert.equal(r.callbacks[1].outcome,'error');assert.equal(r.callbacks[1].completedDelta,0);
 assert.equal(r.fences.finished[0].disposition,'deleted-after-wait-failed');assert.equal(r.fences.finished[0].firstSignaled,null);
 assert.equal(f.seen.length,1);
});

test('native sync exceptions and broken observer clocks preserve the exact original exception and call',()=>{
 const f=fixture();f.probe!.startCapture();f.tick(100);const error={sentinel:'native wait'};f.gl.failWait=error;
 assert.throws(()=>f.tick(116),value=>value===error);
 const r=f.probe!.stopCapture();assert.equal(r.counts.nativeSyncErrors,1);assert.equal(r.syncEvents.find(x=>x.result==='threw')?.method,'clientWaitSync');
 const g=fixture(false);g.cleanup();const clockError=Error('observer clock');
 const probe=new ManualPipelineProbe(g.renderer,()=>{throw clockError;});probe.startCapture();
 assert.equal(g.gl.fenceSync(1,0),g.syncs[0]);
 assert.ok(probe.snapshot().observerErrors>0);assert.equal(probe.snapshot().counts.fenceSyncCalls,1);
});

test('context loss clears observations without deleting or signaling native fences',()=>{
 const f=fixture(true,3);f.probe!.startCapture();f.tick(100);f.tick(116);f.tick(132);
 const before=f.calls.slice();f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));
 assert.deepEqual(f.calls,before);const r=f.probe!.snapshot();assert.equal(r.fences.pending.length,0);
 assert.equal(r.fences.finished.length,3);assert.ok(r.fences.finished.every(x=>x.disposition==='context-lost'&&x.firstSignaled===null));
 assert.equal(r.lifecycleEvents[0].kind,'context-lost');
 f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick(200);
 assert.equal(f.probe!.snapshot().fences.pending.length,1);
});

test('bounded rings retain the newest events and explicitly count dropped history',()=>{
 const f=fixture();f.gl.state=f.gl.ALREADY_SIGNALED;f.probe!.startCapture();
 const n=Math.max(PIPELINE_DIAGNOSTIC_LIMITS.callbacks,Math.ceil(PIPELINE_DIAGNOSTIC_LIMITS.syncEvents/3),PIPELINE_DIAGNOSTIC_LIMITS.finishedFences)+5;
 for(let i=0;i<n;i++)f.tick(i*20);
 const r=f.probe!.stopCapture();assert.equal(r.counts.callbacks,n);
 assert.equal(r.callbacks.length,PIPELINE_DIAGNOSTIC_LIMITS.callbacks);assert.equal(r.dropped.callbacks,n-r.callbacks.length);
 assert.equal(r.syncEvents.length,PIPELINE_DIAGNOSTIC_LIMITS.syncEvents);assert.ok(r.dropped.syncEvents>0);
 assert.equal(r.fences.finished.length,PIPELINE_DIAGNOSTIC_LIMITS.finishedFences);assert.ok(r.dropped.finishedFences>0);
 assert.equal(r.callbacks.at(-1)!.originalTimestampMs,(n-1)*20);assert.equal(r.fences.pending.length,1);
});

test('tracking overflow does not reject native fences and failed installation reports partial coverage',()=>{
 const f=fixture();f.probe!.startCapture();
 for(let i=0;i<PIPELINE_DIAGNOSTIC_LIMITS.trackedFences+3;i++)assert.ok(f.gl.fenceSync(1,0));
 const r=f.probe!.stopCapture();assert.equal(r.fences.pending.length,PIPELINE_DIAGNOSTIC_LIMITS.trackedFences);assert.equal(r.counts.untrackedFences,3);
 const g=fixture(false);g.cleanup();const original=g.gl.fenceSync;
 Object.defineProperty(g.gl,'fenceSync',{value:original,writable:false,configurable:false});
 const partial=new ManualPipelineProbe(g.renderer);partial.startCapture();assert.ok(g.gl.fenceSync(1,0));
 const p=partial.stopCapture();assert.equal(p.coverage.complete,false);assert.equal(p.coverage.hooks.find(x=>x.name==='fenceSync')?.status,'failed');assert.equal(g.gl.fenceSync,original);
});

test('disposal restores owned hooks without overwriting a later wrapper or changing native cleanup',()=>{
 const f=fixture();f.probe!.startCapture();f.tick(100);
 const later=()=>f.gl.TIMEOUT_EXPIRED;f.gl.clientWaitSync=later;
 f.cleanup();f.probe!.dispose();assert.equal(f.gl.fenceSync,f.native.fence);assert.equal(f.gl.deleteSync,f.native.delete);
 assert.equal(f.gl.clientWaitSync,later);assert.equal(f.renderer.setAnimationLoop,f.native.set);
});
