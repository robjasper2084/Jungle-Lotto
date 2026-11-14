import type {WebGLRenderer} from 'three';

/** Bound queued GPU work to one complete animation callback, including every
 * split-screen view. Never block the main thread with finish()/a nonzero wait.
 * This is rendering backpressure, not a new simulation clock or readiness test.
 */
export class GpuFrameGate {
 private fence:WebGLSync|undefined;
 private gl:WebGL2RenderingContext;
 constructor(gl:WebGL2RenderingContext){this.gl=gl;}
 ready(){
  if(this.gl.isContextLost()){this.clear();return false;}
  if(!this.fence)return true;
  const state=this.gl.clientWaitSync(this.fence,0,0);
  if(state===this.gl.TIMEOUT_EXPIRED)return false;
  this.clear();
  if(state!==this.gl.ALREADY_SIGNALED&&state!==this.gl.CONDITION_SATISFIED)throw new Error('Frame GPU fence failed.');
  return true;
 }
 submitted(){
  if(this.gl.isContextLost())return;
  if(this.fence)throw new Error('A GPU frame is already in flight.');
  const fence=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!fence)throw new Error('Frame GPU fence unavailable.');
  this.fence=fence;this.gl.flush();
 }
 clear(){if(this.fence){this.gl.deleteSync(this.fence);this.fence=undefined;}}
}

type Renderer=Pick<WebGLRenderer,'getContext'|'setAnimationLoop'|'xr'|'info'|'dispose'>;
const installed=new WeakMap<object,()=>void>();
/** Install before the game registers its one animation loop. Fake compilers and
 * unsupported contexts remain untouched. XR keeps the browser's own scheduler.
 */
export function installGpuFramePacing(target:object):()=>void {
 const candidate=target as Partial<Renderer>;
 const existing=installed.get(candidate);if(existing)return existing;
 if(typeof candidate.getContext!=='function'||typeof candidate.setAnimationLoop!=='function'||typeof candidate.dispose!=='function'||!candidate.xr||!candidate.info)return ()=>{};
 const renderer=candidate as Renderer,gl=renderer.getContext() as WebGL2RenderingContext;
 if(typeof gl.fenceSync!=='function'||typeof gl.clientWaitSync!=='function')return ()=>{};
 const gate=new GpuFrameGate(gl),originalSet=renderer.setAnimationLoop,originalDispose=renderer.dispose;
 let stopped=false;
 const set:Renderer['setAnimationLoop']=callback=>{
  if(!callback){gate.clear();originalSet.call(renderer,null);return;}
  originalSet.call(renderer,(now,frame)=>{
   if(stopped)return;
   if(renderer.xr.isPresenting){gate.clear();callback(now,frame);return;}
   if(!gate.ready())return;
   const before=renderer.info.render.frame;
   // Preserve the real timestamp and run the entire callback exactly once.
   // A fence after this callback covers BOTH co-op views, not only the first.
   try{callback(now,frame);}
   finally{if(!stopped&&!renderer.xr.isPresenting&&renderer.info.render.frame!==before)gate.submitted();}
  });
 };
 const cleanup=()=>{
  if(stopped)return;stopped=true;gate.clear();installed.delete(candidate);
  if(renderer.setAnimationLoop===set)renderer.setAnimationLoop=originalSet;
  if(renderer.dispose===dispose)renderer.dispose=originalDispose;
 };
 const dispose:Renderer['dispose']=()=>{cleanup();originalDispose.call(renderer);};
 renderer.setAnimationLoop=set;renderer.dispose=dispose;installed.set(candidate,cleanup);return cleanup;
}
