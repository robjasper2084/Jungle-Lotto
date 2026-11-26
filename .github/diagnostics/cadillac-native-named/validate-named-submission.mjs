// Diagnostic evidence validation only. Original ride acceptance remains in the
// untouched strict driver, and its report is never rewritten by this module.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateNamedSubmission(report,expectedHead){
 assert.match(expectedHead,/^[0-9a-f]{40}$/);
 assert.equal(report.sourceHead,expectedHead);
 assert.equal(report.device,'desktop');assert.equal(report.mode,'full');assert.equal(report.requestedSeconds,90);
 assert.equal(report.renderBackend,'angle-metal');assert.match(report.actualGpu?.renderer??'',/Metal/i);
 const profile=report.profile;assert(profile);assert.equal(profile.stopReason,'trusted-W-keyup');
 assert(report.gpsRegression,'Original GPS results must be retained');
 assert.equal(profile.loopDiagnostics,undefined,'The manual loop/pacing observer must remain absent');
 for(const build of [profile.buildAtStart,profile.build]){
  assert.equal(build?.status,'unavailable');assert.equal(build?.reason,'manual comparison not selected');
 }
 for(const settings of [profile.settingsAtStart,profile.settings]){
  assert.equal(settings?.quality,'high');assert.equal(settings?.effectiveQuality,'high');assert.equal(settings?.pixelRatio,1);
  assert.equal(settings?.diagnosticReduction,false);assert.equal(settings?.world?.performanceDiagnostic,false);
 }
 const coverage=profile.submissionInstrumentation;
 for(const point of ['atStart','atFinish']){
  const observed=coverage?.[point];assert(observed?.installed,point+': submission observer was not installed');
  assert.equal(observed.context,'available');
  for(const name of ['renderer.renderBufferDirect','scene.updateMatrixWorld'])
   assert.equal(observed.hooks?.find(hook=>hook.name===name)?.status,'installed',point+': missing '+name);
 }
 assert(profile.submissionDiagnostics?.profiledCallbacks>0,'No measured submission callbacks');
 assert(profile.submissionDiagnostics.operations?.directDraw?.calls>0,'No actual direct-draw calls observed');
 assert(profile.renderDiagnostics?.profiledCallbacks>0,'No measured render callbacks');
 const rows=profile.renderDiagnostics.topRenderWork;assert(Array.isArray(rows)&&rows.length>0&&rows.length<=100);
 const named=rows.flatMap(row=>row.submission?.topDirectDraws??[])
  .filter(row=>Number.isFinite(row.cpuMs)&&row.cpuMs>=0&&(row.object||row.material));
 assert(named.length>0,'Missing bounded named draw evidence');
 return {
  scope:'DIAGNOSTIC ONLY: named render evidence is present. This result is not native release acceptance and does not replace original failures.',
  sourceHead:report.sourceHead,profileQuery:'1',renderSubmissionQuery:'1',
  originalResult:{passed:report.passed,baselinePassed:report.baselinePassed,frameQualityAccepted:report.frameQualityAccepted,
   releasePerformanceVerified:report.releasePerformanceVerified,p95:profile.metrics?.frameMs?.p95,over250ms:profile.over250ms,
   gpsPassed:report.gpsRegression.passed,errors:report.errors,failedRequests:report.failedRequests},
  submissionCoverage:coverage,submissionCallbacks:profile.submissionDiagnostics.profiledCallbacks,
  renderCallbacks:profile.renderDiagnostics.profiledCallbacks,locatedRenderRows:rows.length,namedDrawRows:named.length,
  caveat:'Direct draw timings include nested GL work and observer overhead. Partial GL hook coverage remains explicit. Current/preceding callback association does not establish the cause of a later frame gap.',
 };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
 console.log(JSON.stringify(validateNamedSubmission(report,process.argv[3]),null,2));
}
