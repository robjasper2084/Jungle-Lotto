/** Validate external observations after the original process has exited. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verifyPinnedInputs,verifyOriginalVerdict,createTraceSummaryAccumulator,diagnosticVerdict,sha256,PIN,REPORT_PATH,verifyPageObservations,verifyTraceControls} from './contract.mjs';
import {summarizeTraceFile} from './sustained-trace-json.mjs';
import {verifyAssetReceipts} from './asset-receipts.mjs';
import {verifyNativeGpuSample} from './native-gpu-sample.mjs';
import {verifyNativeGpuInput} from './native-gpu-input.mjs';

const game=resolve(process.argv[2]),directory=resolve(process.argv[3]),capture=resolve(directory,'capture');
const failures=[];let summary={diagnosticOnly:true,releaseAcceptance:false,collectionComplete:false};
try{
 const source=await verifyPinnedInputs(game,directory);
 const originalDriver=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.deepEqual(originalDriver,await readFile(resolve(directory,'original-strict-driver.mjs')),'Original driver changed during diagnostic');
 assert.deepEqual(source,JSON.parse(await readFile(resolve(directory,'source-receipt.json'),'utf8')),'Source/build receipt changed during diagnostic');
 const evidence=JSON.parse(await readFile(resolve(capture,'trace-evidence.json'),'utf8'));
 const traceControls=verifyTraceControls(evidence);
 verifyPageObservations(evidence.pageEvidence);assert.equal(evidence.previewAtArm?.polyhavenRockReview,'loaded');
 assert.equal(evidence.traceCompletion.deadlineHostMs,evidence.stop.hostStartMs+60000);
 for(const stream of evidence.traceStreams){assert.equal(stream.deadlineExceeded,false);assert(stream.finishedHostMs<=evidence.traceCompletion.deadlineHostMs,'Raw stream flush exceeded absolute deadline');}
 const diagnosticReceiptBytes=await readFile(resolve(directory,'diagnostic-source-receipt.json')),diagnosticReceipt=JSON.parse(diagnosticReceiptBytes);
 assert.deepEqual(evidence.diagnosticSource,{head:diagnosticReceipt.head,tree:diagnosticReceipt.tree,files:diagnosticReceipt.files.length,receiptSha256:sha256(diagnosticReceiptBytes)},'Diagnostic source identity changed');
 const reportBytes=await readFile(resolve(game,REPORT_PATH));
 assert.deepEqual(reportBytes,await readFile(resolve(capture,'original-report.json')),'Observer changed the original report');
 const report=JSON.parse(reportBytes);assert.equal(sha256(reportBytes),evidence.originalReportSha256);
 verifyOriginalVerdict(report,originalDriver.toString(),evidence.baselineWitness);
 const nativeInput=verifyNativeGpuInput(evidence.nativeGpuInput);
 const nativeSample=JSON.parse(await readFile(resolve(capture,'native-gpu-sample.json'),'utf8'));
 assert.deepEqual(nativeSample,evidence.nativeGpuSample,'Native sample receipt changed after collection');
 const nativeGpuSampleValidation=await verifyNativeGpuSample(nativeSample,{readCapturedFile:file=>readFile(resolve(capture,file)),
  rideStartHostMs:nativeInput.startHostMs,rideStopHostMs:nativeInput.endHostMs,browserVersion:evidence.browser,systemInfo:evidence.systemInfo});
 assert.deepEqual(nativeGpuSampleValidation,nativeSample.validation,'Native stack validation did not replay exactly');
 assert.equal(nativeSample.collectionComplete,true);assert.equal(nativeSample.validationPassed,true);
 const cpu=await readFile(resolve(capture,'renderer.cpuprofile'));assert.equal(sha256(cpu),evidence.cpuProfileSha256);
 const streamed=await summarizeTraceFile(resolve(capture,'browser-trace.json'),JSON.parse(cpu),evidence.pageEvidence,{createAccumulator:createTraceSummaryAccumulator});
 assert.equal(streamed.sha256,evidence.traceSha256);assert.deepEqual(streamed.receipt,evidence.traceReceipt);
 const observed=streamed.summary;
 assert.deepEqual(observed,evidence.summary,'Trace/CPU summary does not match saved raw evidence');
 const verdict=diagnosticVerdict({source,report,traceComplete:evidence.traceComplete,summary:observed,errors:evidence.errors,stop:evidence.stop});
 assert.deepEqual(verdict,evidence.verdict,'Collector verdict does not match original raw evidence');
 assert.equal(evidence.status,'finished');assert.equal(evidence.traceFlushed,true);assert.equal(evidence.stop.trigger,'native-w-keyup');
 assert.equal(evidence.errors.length,0,JSON.stringify(evidence.errors));assert.equal(verdict.collectionComplete,true,JSON.stringify(verdict.errors));
 assert(evidence.scriptReceipts.length>0,'No browser-consumed script receipts');
 assert.equal(evidence.gameUrl,evidence.pageEvidence.url,'Original game origin changed during capture');
 const assetVerification=await verifyAssetReceipts(evidence.assetReceipts,{sourceFiles:source.files,gameUrl:evidence.gameUrl,
  deadlineHostMs:evidence.traceCompletion.deadlineHostMs,embeddedImageIndex:source.embeddedImageIndex,
  readCapturedFile:file=>readFile(resolve(capture,file))});
 const scripts=evidence.assetReceipts.filter(r=>r.kind==='http-file'&&!r.expectedEmptyResponse&&new URL(r.url).pathname.endsWith('.js'));
 const stableReceipts=rows=>rows.map(r=>JSON.stringify(r)).sort();
 assert.deepEqual(stableReceipts(evidence.scriptReceipts),stableReceipts(scripts),'Script receipts are not the complete matching HTTP response subset');
 const exit=JSON.parse(await readFile(resolve(capture,'process-exit.json'),'utf8'));
 const statusText=(await readFile(resolve(directory,'original-process-exit.txt'),'utf8')).trim();
 assert(/^\d+$/.test(statusText));const originalStatus=Number(statusText);
 assert.equal(exit.code,originalStatus);assert.equal(exit.collectorNeverSetProcessExitCode,true);
 assert.equal(originalStatus,report.passed?0:1,'Original process exit does not match its unchanged report');
 assert(report.gpsRegression&&typeof report.gpsRegression.passed==='boolean','Original full GPS result missing');
 summary={...verdict,originalProcessExit:originalStatus,originalReportSha256:evidence.originalReportSha256,
  traceSha256:evidence.traceSha256,cpuProfileSha256:evidence.cpuProfileSha256,sourceHead:PIN.head,tree:PIN.tree,diagnosticSource:evidence.diagnosticSource,
  nativeRide:observed.nativeRide,rendererTimeline:observed.rendererTimeline,cpuCoverage:observed.cpuCoverage,
  longestNativeEvents:observed.longEvents,originalGpsPassed:report.gpsRegression.passed,assetVerification,traceControls,gpuCategoryCoverage:observed.gpuCategoryCoverage,
  nativeInput,nativeGpuSampleValidation};
}catch(error){if(error.traceReceipt)summary.traceReceipt=error.traceReceipt;failures.push(error.stack||String(error));}
summary.validationErrors=failures;summary.validationPassed=failures.length===0;
await writeFile(resolve(directory,'validation.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({validationPassed:summary.validationPassed,collectionComplete:summary.collectionComplete,
 originalHarnessPassed:summary.originalHarnessPassed??null,originalP95Ms:summary.originalP95Ms??null,
 originalIntervalsOver250ms:summary.originalIntervalsOver250ms??null,releaseAcceptance:false,errors:failures.slice(0,3)}));
if(failures.length)process.exitCode=1;
