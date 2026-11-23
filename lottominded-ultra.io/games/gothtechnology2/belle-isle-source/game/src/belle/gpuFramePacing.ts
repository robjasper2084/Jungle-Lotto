import type {WebGLRenderer} from 'three';
import {observeLoop,type ManualLoopProbe,type LoopToken,type LoopOutcome} from './loopDiagnostics.ts';

/** Bound queued GPU work across complete animation callbacks, including every
 * split-screen view. Never block the main thread with finish()/a nonzero wait.
 * This is rendering backpressure, not a new simulation clock or readiness test.
 */
export class GpuFrameGate {
 private readonly fences:WebGLSync[]=[];
 private readonly gl:WebGL2RenderingContext;
 private readonly capacity:1|2|3;
 constructor(gl:WebGL2RenderingContext,capacity:1|2|3=1){this.gl=gl;this.capacity=capacity;}
 get pending(){return this.fences.length>0;}
 ready(){
  if(this.gl.isContextLost()){this.forgetLostContext();return false;}
  // At most one more frame can be submitted per callback. Query completion
  // only when the queue needs a slot, and only poll the oldest fence.
  if(this.fences.length<this.capacity)return true;
  const fence=this.fences[0],state=this.gl.clientWaitSync(fence,0,0);
  if(state===this.gl.TIMEOUT_EXPIRED)return false;
  this.fences.shift();
  this.gl.deleteSync(fence);
  if(state!==this.gl.ALREADY_SIGNALED&&state!==this.gl.CONDITION_SATISFIED)throw new Error('Frame GPU fence failed.');
  return true;
 }
 submitted(probe?:ManualLoopProbe,callback?:LoopToken){
  if(this.gl.isContextLost())return;
  if(this.fences.length>=this.capacity)throw new Error('A GPU frame is already in flight at the queue limit.');
  const fenceTiming=observeLoop(probe,value=>value.beginScope(callback,'fenceSyncCpuMs'));
  let fence:WebGLSync|null;
  try{fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);}
  finally{observeLoop(probe,value=>value.endScope(fenceTiming));}
  if(!fence)throw new Error('Frame GPU fence unavailable.');
  this.fences.push(fence);
  const flushTiming=observeLoop(probe,value=>value.beginScope(callback,'flushCpuMs'));
  try{this.gl.flush();}finally{observeLoop(probe,value=>value.endScope(flushTiming));}
  return true;
 }
 clear(){for(const fence of this.fences)this.gl.deleteSync(fence);this.fences.length=0;}
 forgetLostContext(){this.fences.length=0;}
}

type Renderer=Pick<WebGLRenderer,'getContext'|'setAnimationLoop'|'xr'|'info'|'dispose'|'domElement'>;
const installed=new WeakMap<object,()=>void>();
const loopBindings=new WeakMap<object,{probe?:ManualLoopProbe}>();
export interface LoopProbeBinding {
 coverage():{installed:boolean;status:'installed'|'unavailable'|'detached'};
 detach():void;
}
/** Attach to the existing gate; do not add another scheduler or native wrapper. */
export function attachGpuFramePacingProbe(target:object,probe:ManualLoopProbe):LoopProbeBinding {
 const binding=loopBindings.get(target);let detached=false;
 const attached=!!binding&&!binding.probe;
 if(attached)binding.probe=probe;
 return {coverage:()=>({installed:attached&&!detached&&loopBindings.get(target)===binding&&binding?.probe===probe,
   status:detached?'detached':attached&&loopBindings.get(target)===binding&&binding?.probe===probe?'installed':'unavailable'}),
  detach(){if(detached)return;detached=true;if(attached&&binding?.probe===probe){binding.probe=undefined;observeLoop(probe,value=>value.cancelCallback());}}};
}
/** Lifetime observations of the gate, not GPU execution timings. Pending spans
 * start at the first skipped callback, so omit time before that first poll.
 * They include all callback modes and any time between polls (including hidden
 * tabs). They must not be added to CPU phases or used to adjust captured FPS.
 */
export interface GpuFramePacingDiagnostics {
 installed:boolean;
 maxQueuedFrames:number;
 animationCallbacks:number;
 executedCallbacks:number;
 submittedCallbacks:number;
 xrCallbacks:number;
 pendingFenceSkippedCallbacks:number;
 contextLostSkippedCallbacks:number;
 pendingFenceResumptions:number;
 pendingFenceObservedSpanMs:number;
 longestPendingFenceObservedSpanMs:number;
 currentPendingFenceObservedSpanMs:number;
}
const observations=new WeakMap<object,GpuFramePacingDiagnostics>();
export function gpuFramePacingDiagnostics(target:object):GpuFramePacingDiagnostics|null {
 const value=observations.get(target);return value?{...value}:null;
}
/** Install before the game registers its one animation loop. Fake compilers and
 * unsupported contexts remain untouched. XR keeps the browser's own scheduler.
 */
export function installGpuFramePacing(target:object,maxQueuedFrames:1|2|3=1):()=>void {
 const candidate=target as Partial<Renderer>;
 const existing=installed.get(candidate);if(existing)return existing;
 if(typeof candidate.getContext!=='function'||typeof candidate.setAnimationLoop!=='function'||typeof candidate.dispose!=='function'||!candidate.xr||!candidate.info)return ()=>{};
 const renderer=candidate as Renderer,gl=renderer.getContext() as WebGL2RenderingContext;
 if(typeof gl.fenceSync!=='function'||typeof gl.clientWaitSync!=='function')return ()=>{};
 const gate=new GpuFrameGate(gl,maxQueuedFrames),originalSet=renderer.setAnimationLoop,originalDispose=renderer.dispose;
 const observed:GpuFramePacingDiagnostics={installed:true,maxQueuedFrames,animationCallbacks:0,executedCallbacks:0,submittedCallbacks:0,xrCallbacks:0,pendingFenceSkippedCallbacks:0,contextLostSkippedCallbacks:0,pendingFenceResumptions:0,pendingFenceObservedSpanMs:0,longestPendingFenceObservedSpanMs:0,currentPendingFenceObservedSpanMs:0};
 observations.set(candidate,observed);
 const loopBinding:{probe?:ManualLoopProbe}={};loopBindings.set(candidate,loopBinding);
 let lastPendingTimestamp:number|undefined;
 const observePending=(now:number)=>{
  if(lastPendingTimestamp!==undefined){const elapsed=Math.max(0,now-lastPendingTimestamp);observed.pendingFenceObservedSpanMs+=elapsed;observed.currentPendingFenceObservedSpanMs+=elapsed;observed.longestPendingFenceObservedSpanMs=Math.max(observed.longestPendingFenceObservedSpanMs,observed.currentPendingFenceObservedSpanMs);}
  lastPendingTimestamp=now;
 };
 const endPending=(now?:number)=>{if(lastPendingTimestamp!==undefined&&now!==undefined)observePending(now);lastPendingTimestamp=undefined;observed.currentPendingFenceObservedSpanMs=0;};
 // A suspended tab can lose and restore WebGL between animation callbacks.
 // Once the context changes, a sync from the old context cannot be polled.
 const resetContext=()=>{gate.forgetLostContext();endPending();};
 renderer.domElement?.addEventListener('webglcontextlost',resetContext);
 renderer.domElement?.addEventListener('webglcontextrestored',resetContext);
 let stopped=false;
 const set:Renderer['setAnimationLoop']=callback=>{
  if(!callback){gate.clear();endPending();originalSet.call(renderer,null);return;}
  originalSet.call(renderer,(now,frame)=>{
   if(stopped)return;
   observed.animationCallbacks++;
   const probe=loopBinding.probe,loop=observeLoop(probe,value=>value.beginCallback(observed.animationCallbacks,now));
   let outcome:LoopOutcome='error';
   try{
    if(renderer.xr.isPresenting){
     gate.clear();endPending(now);observed.xrCallbacks++;observed.executedCallbacks++;
     const body=observeLoop(probe,value=>value.beginScope(loop,'callbackBodyCpuMs'));
     try{callback(now,frame);}finally{observeLoop(probe,value=>value.endScope(body));}
     outcome='xr';return;
    }
    const readyTiming=observeLoop(probe,value=>value.beginScope(loop,'gateReadyCpuMs'));let ready:boolean;
    try{ready=gate.ready();}finally{observeLoop(probe,value=>value.endScope(readyTiming));}
    if(!ready){
     if(gate.pending){observed.pendingFenceSkippedCallbacks++;observePending(now);outcome='pending-fence';}
     else{observed.contextLostSkippedCallbacks++;endPending(now);outcome='context-lost';}
     return;
    }
    if(lastPendingTimestamp!==undefined)observed.pendingFenceResumptions++;
    endPending(now);observed.executedCallbacks++;
    const before=renderer.info.render.frame;let didRender:boolean|undefined;
    // Preserve the real timestamp and run the entire callback exactly once.
    // A fence after this callback covers BOTH co-op views, not only the first.
    const body=observeLoop(probe,value=>value.beginScope(loop,'callbackBodyCpuMs'));
    try{try{callback(now,frame);}finally{observeLoop(probe,value=>value.endScope(body));}}
    finally{if(!stopped&&!renderer.xr.isPresenting&&(didRender=renderer.info.render.frame!==before)){
     const submittedTiming=observeLoop(probe,value=>value.beginScope(loop,'gateSubmittedCpuMs'));
     try{if(gate.submitted(probe,loop))observed.submittedCallbacks++;}
     finally{observeLoop(probe,value=>value.endScope(submittedTiming));}
    }}
    outcome=didRender===false?'no-draw':'executed';
   }finally{observeLoop(probe,value=>value.finishCallback(loop,outcome));}
  });
 };
 const cleanup=()=>{
  if(stopped)return;stopped=true;gate.clear();endPending();observed.installed=false;installed.delete(candidate);
  renderer.domElement?.removeEventListener('webglcontextlost',resetContext);
  renderer.domElement?.removeEventListener('webglcontextrestored',resetContext);
  observeLoop(loopBinding.probe,value=>value.cancelCallback());loopBinding.probe=undefined;loopBindings.delete(candidate);
  if(renderer.setAnimationLoop===set)renderer.setAnimationLoop=originalSet;
  if(renderer.dispose===dispose)renderer.dispose=originalDispose;
 };
 const dispose:Renderer['dispose']=()=>{cleanup();originalDispose.call(renderer);};
 renderer.setAnimationLoop=set;renderer.dispose=dispose;installed.set(candidate,cleanup);return cleanup;
}
