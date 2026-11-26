import assert from 'node:assert/strict';

export function validateDom(dom){
 assert.equal(dom.width,1280);assert.equal(dom.height,800);assert.equal(dom.dpr,1);
 assert.equal(dom.quality,'smooth');assert.equal(dom.fps,'30');assert.equal(dom.reducedMotion,true);
 assert.equal(dom.settingsVisible,false);assert.equal(dom.atStart,false);
 assert.match(dom.ride,/CADILLAC/i);
 return true;
}

export function validateObservation(observation,dom,nativeEvents){
 validateDom(dom);
 assert.equal(observation.ready,true,'Renderer observation coverage is incomplete');
 for(const field of ['renderer','render','direct','fenceSync','clientWaitSync','deleteSync'])assert.equal(observation.coverage?.[field],true,'Missing original observation coverage: '+field);
 assert.equal(observation.nestedRenders,0,'Nested renders cannot be attributed by this diagnostic');
 assert.equal(observation.nestedDirectCalls,0,'Nested direct calls cannot be attributed by this diagnostic');
 assert.equal(observation.armed,true);assert.equal(observation.limits.frames,3);
 assert.match(observation.nativeRenderer,/SwiftShader/i,'A different backend cannot substitute for the original software lane');
 assert.deepEqual(observation.errors,[],'Observer reported incomplete or invalid attribution');
 assert.equal(observation.overflow,false,'Diagnostic bounds were exceeded');
 assert.equal(observation.completedFrames,3,'Require three completed original application frames');
 assert.equal(observation.frames.length,3);
 let previousSubmitted=-Infinity;
 for(const frame of observation.frames){
  assert.equal(frame.completion.status,'complete');
  assert.equal(frame.threw,false);
  assert(frame.objects.length>0,'Empty per-object attribution');
  assert(frame.startedAtMs>=previousSubmitted,'Frame chronology regressed');
  assert(frame.submittedAtMs>=frame.startedAtMs);
  assert(frame.completion.fenceObservedAtMs>=frame.submittedAtMs);
  assert(frame.completion.completedAtMs>=frame.completion.fenceObservedAtMs);
  assert(frame.rendererFrameAfter>frame.rendererFrameBefore,'A native renderer frame did not advance');
  assert(frame.observedTotals.calls>0&&frame.observedTotals.triangles>0,'Missing real draw work');
  for(const key of ['calls','triangles','lines','points']){
   const sum=frame.objects.reduce((total,row)=>total+row.submitted[key],0);
   assert.equal(sum,frame.observedTotals[key],'Object counters do not conserve total '+key);
   assert.equal(sum,frame.nativeEndTotals[key],'Object counters do not conserve native renderer '+key);
   assert.equal(frame.observedColorTotals[key]+frame.observedShadowTotals[key],frame.observedTotals[key],'Color/shadow attribution does not conserve '+key);
   for(const row of frame.objects)assert(Number.isFinite(row.submitted[key])&&row.submitted[key]>=0,'Invalid object submission count');
  }
  previousSubmitted=frame.submittedAtMs;
 }
 assert(Array.isArray(nativeEvents)&&nativeEvents.length>0,'Missing native input evidence');
 assert(nativeEvents.every(event=>event.trusted),'Synthetic input cannot substitute for native controls');
 assert(nativeEvents.some(event=>event.type==='click'&&(event.target==='start'||event.control==='start')),'Missing original native Start receipt');
 assert(nativeEvents.some(event=>event.type==='keydown'&&event.target==='quality'),'Missing native quality selector receipt');
 assert(nativeEvents.some(event=>event.type==='keydown'&&event.target==='fps'),'Missing native FPS selector receipt');
 return{completedFrames:3,backend:observation.nativeRenderer,allInputsTrusted:true,
  timerStatus:observation.timer.status,pendingQueries:observation.pendingQueries,
  scope:'Diagnostic observation only. Original controls and native Metal acceptance are not run or replaced.'};
}
