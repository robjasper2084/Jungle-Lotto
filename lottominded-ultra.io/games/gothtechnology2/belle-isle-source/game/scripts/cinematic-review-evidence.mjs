/** Finalization helpers for real cinematic browser evidence. No game-state writes. */
export function recordEvidenceError(entry, phase, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  entry.errors.push(`${phase}: ${message}`);
  (entry.failureDetails ??= []).push({at: new Date().toISOString(), phase, message});
  if (phase.startsWith('cleanup')) entry.cleanupFailed = true;
  entry.passed = false;
}

export function observeEvidence(entry, phase, callback) {
  try { callback(); }
  catch (error) { recordEvidenceError(entry, `observer:${phase}`, error); }
}

export function finalizeCinematicCase(entry) {
  entry.passed = entry.functionalPassed === true && !entry.failure && !entry.cleanupFailed
    && Array.isArray(entry.errors) && entry.errors.length === 0
    && Array.isArray(entry.failedRequests) && entry.failedRequests.length === 0
    && (entry.requestFailureDetails?.length ?? 0) === 0
    && (entry.failureDetails?.length ?? 0) === 0;
  return entry.passed;
}

/** Try both cleanup operations even when the first fails. Never suppress a failure. */
export async function cleanupCinematicCase(entry, stopTrace, closeContext) {
  for (const [phase, operation] of [['cleanup:trace', stopTrace], ['cleanup:context', closeContext]]) {
    try { await operation(); }
    catch (error) { recordEvidenceError(entry, phase, error); }
  }
  return finalizeCinematicCase(entry);
}

/** Re-evaluate after browser.close: late observer/request errors cannot preserve a green result. */
export function finalizeCinematicReport(report, expectedCaseCount) {
  const results = report.cases.map(finalizeCinematicCase);
  report.passed = !report.failure && report.errors.length === 0
    && Number.isInteger(expectedCaseCount) && expectedCaseCount > 0
    && report.cases.length === expectedCaseCount && results.every(Boolean);
  if (!report.passed) report.liveVerified = false;
  return report.passed;
}

/** Verify a NEW real hoverbike frame after the caller observes subsequent
 * renderer submissions. GPU completion and two paint opportunities are mandatory.
 * Browser-serialized, read-only; does not seed game or draw replacement pixels.
 */
export function waitForCinematicFlightFrame(canvas) {
 const snapshot=()=>{
  const body=document.body, hud=document.getElementById('hover-hud');
  if(document.visibilityState!=='visible'||body.classList.contains('at-start')
    ||!body.classList.contains('on-hoverbike')||document.querySelector('dialog[open]')
    ||!hud||hud.hidden)throw Error('Cinematic frame requires visible riding hoverbike, without a dialog.');
  return {width:canvas.width,height:canvas.height,hoverMounted:true};
 };
 const initial=snapshot(), gl=canvas.getContext('webgl2');
 if(!gl||gl.isContextLost()||initial.width<=0||initial.height<=0)throw Error('Cinematic frame requires a live nonempty WebGL2 canvas.');
 return new Promise((resolve,reject)=>{
  let sync,pollTimer,paintFrame,deadline,settled=false,paints=0;
  const submittedAt=performance.now();let completedAt;
  const finish=error=>{
   if(settled)return;settled=true;
   clearTimeout(pollTimer);clearTimeout(deadline);
   if(paintFrame!==undefined)cancelAnimationFrame(paintFrame);
   try{if(sync)gl.deleteSync(sync);}catch(cleanupError){error??=cleanupError;}
   if(error){reject(error);return;}
   try{if(gl.isContextLost())throw Error('Cinematic WebGL context lost before capture.');
    resolve({...snapshot(),gpuSubmittedAt:submittedAt,gpuCompletedAt:completedAt,paintOpportunities:paints});
   }catch(stateError){reject(stateError);}
  };
  const paint=()=>{if(settled)return;try{snapshot();}catch(error){finish(error);return;}
   if(++paints===2)finish();else paintFrame=requestAnimationFrame(paint);};
  const poll=()=>{if(settled)return;try{
   snapshot();if(gl.isContextLost())throw Error('Cinematic WebGL context lost while waiting.');
   const value=gl.clientWaitSync(sync,0,0);
   if(value===gl.WAIT_FAILED)throw Error('Cinematic GPU fence failed.');
   if(value===gl.TIMEOUT_EXPIRED){pollTimer=setTimeout(poll,16);return;}
   if(value!==gl.ALREADY_SIGNALED&&value!==gl.CONDITION_SATISFIED)throw Error('Unexpected cinematic GPU fence result.');
   completedAt=performance.now();paintFrame=requestAnimationFrame(paint);
  }catch(error){finish(error);}};
  deadline=setTimeout(()=>finish(Error('Cinematic GPU frame evidence exceeded 45 seconds.')),45000);
  try{sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
   if(!sync)throw Error('Cinematic GPU fence unavailable.');
   gl.flush();poll();
  }catch(error){finish(error);}
 });
}
