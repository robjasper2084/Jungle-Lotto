import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const directory=resolve(process.argv[2]);
const read=async name=>JSON.parse(await readFile(join(directory,name),'utf8'));
const report=await read('report.json'),observer=await read('phone-stall-observation.json'),profile=await read('renderer.cpuprofile');
assert.equal(report.sourceHead,'61a9db36df072850f4bcea4536471e3d92e07453');
assert.equal(observer.sourceHead,report.sourceHead);
assert.equal(report.device,'phone');assert.equal(report.mode,'diagnostic');assert.equal(report.requestedSeconds,90);
assert.deepEqual(report.viewport,{width:390,height:844});
assert.equal(report.renderBackend,'angle-metal');assert.match(report.actualGpu.renderer,/Metal/);
assert.equal(report.profile.stopReason,'trusted-W-keyup');
for(const settings of [report.profile.settingsAtStart,report.profile.settings]){
 assert.equal(settings.quality,'smooth');assert.equal(settings.effectiveQuality,'smooth');assert.equal(settings.cap,60);
 assert.equal(settings.pixelRatio,1);assert.equal(settings.adaptiveScale,1);assert.equal(settings.world.performanceDiagnostic,true);
}
assert.equal(report.releasePerformanceVerified,false);
assert.equal(report.frameQualityAccepted,report.profile.metrics.frameMs.p95<=50&&report.profile.over250ms===0);
assert(report.input.keydowns>=1&&report.input.keyups>=1);
assert.equal(report.input.heartbeatError,null);assert.equal(observer.driverBlob,'c722b5810a7693e5ece72ed00b4401e7cde7267a');
assert.equal(observer.profileQuery,'1');assert.equal(observer.sceneQuery,'perfProbe=1');
assert.equal(observer.errors.length,0,JSON.stringify(observer.errors));
assert(observer.inputUpReturnedMs-observer.inputDownReturnedMs>=90000);
assert.equal(observer.browser.nativeInputComplete,true);
assert(observer.browser.trustedWKeyupMs>observer.browser.firstTrustedWKeydownMs);
assert(observer.clockAlignment.afterCdpSeconds>=observer.clockAlignment.beforeCdpSeconds);
assert(profile.samples.length>0);assert.equal(profile.samples.length,profile.timeDeltas.length);
assert(profile.endTime>profile.startTime);assert(profile.nodes.length>0);
const nodeById=new Map(profile.nodes.map(node=>[node.id,node]));
const total=new Map();
for(let i=0;i<profile.samples.length;i++){
 const id=profile.samples[i],delta=profile.timeDeltas[i];
 if(Number.isFinite(delta)&&delta>=0&&nodeById.has(id))total.set(id,(total.get(id)??0)+delta);
}
const largestLongTasks=observer.browser.tasks.slice().sort((a,b)=>b.durationMs-a.durationMs).slice(0,20);
const summary={scope:'Diagnostic observations only. A green observed run does not clear the earlier failure or authorize release.',
 sourceHead:report.sourceHead,originalVerdictPreserved:report.passed,originalClassification:report.classification,
 p95Ms:report.profile.metrics.frameMs.p95,stallsOver250ms:report.profile.over250ms,maxFrameMs:report.profile.maxFrameMs,
 inputHeldNodeMs:observer.inputUpReturnedMs-observer.inputDownReturnedMs,
 clockAlignment:observer.clockAlignment,largestLongTasks,
 browserRafStalls:observer.browser.rafGaps.filter(row=>row.durationMs>250),
 observerDroppedRows:observer.browser.dropped,
 sampleCount:profile.samples.length,
 sampleWeightedSelf: [...total].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([id,us])=>({weightedMs:us/1000,callFrame:nodeById.get(id).callFrame})),
 caveat:'V8 weighted samples estimate CPU attribution. Missing samples and system scheduling are not GPU timings; boundary-overlapping tasks require clock-bound interpretation.'};
await writeFile(join(directory,'phone-stall-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({source:report.sourceHead,passed:report.passed,p95Ms:summary.p95Ms,stalls:summary.stallsOver250ms,maxFrameMs:summary.maxFrameMs,samples:summary.sampleCount,largestLongTaskMs:largestLongTasks[0]?.durationMs??null}));
