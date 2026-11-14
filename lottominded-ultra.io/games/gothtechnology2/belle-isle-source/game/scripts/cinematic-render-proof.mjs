/** Read-only current-frame/GPU proof. The 30-second startup bands are diagnostics,
 * not a persistent render counter. No frame clock, renderer or game state edits. */
import assert from 'node:assert/strict';
export function activeFrameCount(raw){
 if(typeof raw!=='string'||!/^\d+$/.test(raw))throw new Error('Current render counter is missing');
 const value=Number(raw);if(!Number.isSafeInteger(value))throw new Error('Invalid current render counter');return value;
}
export function hasCurrentFrames(before,after){
 return Number.isSafeInteger(before)&&Number.isSafeInteger(after)&&before>=0&&after>=before+3;
}
/** Runs in the page, after three newly observed eligible frames. */
export function awaitGpuPaint(){return new Promise((resolve,reject)=>{
 const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');
 if(!gl||gl.isContextLost())return reject(new Error('Live WebGL2 is required'));
 const submitted=performance.now(),fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!fence)return reject(new Error('Missing GPU fence'));
 let done=false,frame=0;
 const timer=setTimeout(()=>finish(new Error('GPU/paint exceeded 45 seconds')),45000);
 function finish(error,value){if(done)return;done=true;clearTimeout(timer);cancelAnimationFrame(frame);try{gl.deleteSync(fence);}catch(e){error??=e;}error?reject(error):resolve(value);}
 function poll(){
  if(gl.isContextLost())return finish(new Error('GPU context lost'));
  const state=gl.clientWaitSync(fence,0,0);
  if(state===gl.TIMEOUT_EXPIRED){frame=requestAnimationFrame(poll);return;}
  if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED)return finish(new Error('GPU fence failed'));
  const gpuReady=performance.now();
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>finish(null,{submitted,gpuReady,ready:performance.now(),paintOpportunities:2}));});
 }
 try{gl.flush();frame=requestAnimationFrame(poll);}catch(error){finish(error);}
});}
export async function observeCurrentRendering(page){
 const before=activeFrameCount(await page.locator('#profile').getAttribute('data-active-frames'));
 await page.waitForFunction(n=>{const raw=document.querySelector('#profile')?.dataset.activeFrames;if(typeof raw!=='string'||!/^\d+$/.test(raw))return false;const value=Number(raw);return Number.isSafeInteger(value)&&value>=n+3;},before,{timeout:90000});
 const after=activeFrameCount(await page.locator('#profile').getAttribute('data-active-frames'));
 assert(hasCurrentFrames(before,after),'At least three new active frames must be observed');
 const gpu=await page.evaluate(awaitGpuPaint);
 assert(gpu.ready-gpu.submitted<45000&&gpu.paintOpportunities===2,'GPU completion and paint must satisfy the original 45-second deadline');
 return {before,after,newFrames:after-before,gpu,scope:'Current eligible render progression plus GPU completion and two paint opportunities; not hardware FPS certification'};
}
