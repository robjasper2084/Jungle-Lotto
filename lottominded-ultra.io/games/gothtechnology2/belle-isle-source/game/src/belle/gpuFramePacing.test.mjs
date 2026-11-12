import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuFrameGate,installGpuFramePacing} from './gpuFramePacing.ts';
function fixture(){
 const calls=[],gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,
  lost:false,state:2,isContextLost(){return this.lost;},fenceSync(){calls.push('fence');return {};},
  clientWaitSync(_f,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);return this.state;},
  deleteSync(){calls.push('delete');},flush(){calls.push('flush');}};
 let callback=null;const renderer={xr:{isPresenting:false},info:{render:{frame:0}},getContext:()=>gl,
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
 f.gl.lost=false;assert(g.ready());g.submitted();assert.equal(f.calls.filter(x=>x==='delete').length,1);
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
