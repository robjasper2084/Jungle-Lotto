/** Frozen full-preview diagnostic build contract, never failed-build replay. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createTraceSummaryAccumulator as upstreamAccumulator,TRACE_CATEGORIES as UPSTREAM_TRACE_CATEGORIES} from './upstream/contract.mjs';
export {sha256,gitBlob,hashFile,buildInventory,combinedExit} from './upstream/contract.mjs';
import {sha256,gitBlob,hashFile,buildInventory} from './upstream/contract.mjs';
import {verifyEmbeddedAssetIndex} from './embedded-assets.mjs';

// Only this active contract extends the frozen seven-category upstream copy.
export const TRACE_CATEGORIES=Object.freeze([...UPSTREAM_TRACE_CATEGORIES,'gpu']);
export const TRACE_START_PARAMS=Object.freeze({transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',bufferUsageReportingInterval:1000,
 traceConfig:Object.freeze({recordMode:'recordUntilFull',traceBufferSizeInKb:262144,includedCategories:TRACE_CATEGORIES})});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const categoryTokens=event=>typeof event?.cat==='string'?event.cat.split(',').map(value=>value.trim()):[];
const GPU_COVERAGE_PHASES=new Set(['B','E','X','I','i','b','e','n','s','t','f','R','C']);

/** Enumeration is advisory. Its raw result/error must survive independently of
 * the exact request and the actual native-window category coverage below. */
export function verifyTraceControls(evidence){
 const categories=evidence?.categories,query=categories?.query,start=evidence?.traceStart;
 assert(categories&&query&&start,'Missing recorded category query or trace-start request');
 assert.deepEqual(categories.requested,TRACE_CATEGORIES,'Requested trace categories changed');
 assert.equal(categories.enumerationAdvisory,true);assert.equal(query.method,'Tracing.getCategories');assert.deepEqual(query.params,{});
 assert(finite(query.startedHostMs)&&finite(query.finishedHostMs)&&query.startedHostMs>=0&&query.finishedHostMs>=query.startedHostMs,'Invalid category-query host timing');
 assert.equal(typeof query.responseReceived,'boolean');
 if(query.responseReceived){assert.equal(query.error,null);assert(Object.hasOwn(query,'response'),'Raw category-query response missing');}
 else{assert.equal(query.response,null);assert(typeof query.error==='string'&&query.error,'Category-query failure missing');
  assert(evidence.unsupported?.some(row=>row.method==='Tracing.getCategories'&&row.error===query.error),'Category-query failure not retained');}
 const available=query.responseReceived&&Array.isArray(query.response?.categories)?query.response.categories:null;
 const wellFormed=available!==null&&available.every(value=>typeof value==='string'&&value.length>0);
 assert.deepEqual(categories.available,available,'Advertised category list differs from raw response');
 assert.equal(categories.wellFormed,wellFormed);assert.equal(categories.gpuAdvertised,wellFormed&&available.includes('gpu'));
 assert.equal(start.method,'Tracing.start');assert.deepEqual(start.params,TRACE_START_PARAMS,'Actual trace-start configuration changed');
 assert.equal(start.completed,true);assert.equal(start.error,null);assert(Object.hasOwn(start,'response'),'Raw trace-start response missing');
 assert(finite(start.startedHostMs)&&finite(start.finishedHostMs)&&start.finishedHostMs>=start.startedHostMs,'Invalid trace-start host timing');
 assert(finite(evidence.arm?.hostStartMs)&&finite(evidence.arm?.hostReadyMs)&&query.finishedHostMs<=evidence.arm.hostStartMs&&
  evidence.arm.hostStartMs<=start.startedHostMs&&start.finishedHostMs<=evidence.arm.hostReadyMs,'Category query/start did not preserve original launch/arm order');
 assert.equal(evidence.arm.intervalUs,1000,'CPU sampling interval changed');
 return {requested:[...TRACE_CATEGORIES],enumerationAdvisory:true,enumerationState:!query.responseReceived?'error':!wellFormed?'malformed':available.length?'listed':'empty',
  gpuAdvertised:categories.gpuAdvertised,actualStartParams:start.params};
}

export const GAME='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
export const PIN=Object.freeze({
 head:'9d2162e39188dcd0e42565f398b736734e481f73',tree:'5a7f56b36477b615b96b5e19094c3d11d9a4c6cf',
 canonicalMerge:'55ed556cda718d94636f42c75644a05e64117872',canonicalPreviewRun:45960190700,
 harness:'c722b5810a7693e5ece72ed00b4401e7cde7267a',
 harnessSha256:'8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5',
 gpsHelper:'1ef56565ceb8892fb918a6848972ea8b9f37c2fd',server:'86d780f2a77eff0e9e46beacd35a558903d3ec29',
 sourceArtifactId:15182411775,sourceArtifactRun:45960190700,sourceArtifactBytes:204251647,
 sourceArtifactSha256:'9e3cc0edeaf7a6fe4c95b7618b3c82cf0eeb9cb183439e141e73c2204fd5fbce',
});
export const ROCKS=Object.freeze([
 {folder:'namaqualand_boulder_03',file:'boulder-automatic.glb',bytes:5193764,sha256:'a50c56ecf25cbe1b82f1a0211e9433d2695f4224017dfe3a820d160d6b0a035e'},
 {folder:'rock_moss_set_01',file:'moss-1-automatic.glb',bytes:4210124,sha256:'3d25cd5c7f3cda897382f1a216a1891d4011486d6baf2cd050cb24f8ddade859'},
 {folder:'rock_moss_set_01',file:'moss-2-automatic.glb',bytes:4220544,sha256:'35bfa44ed938a1ac450a4332cf62b78b686441336214e33093096ee9382e8d78'},
]);
export const MARKER_PREFIX='belle-full-preview-p95:';
export const REPORT_PATH='output/sustained-profile/full/desktop/report.json';
export function verifySourceArtifact(metadata){
 assert.equal(metadata.id,PIN.sourceArtifactId);assert.equal(metadata.name,'polyhaven-opaque-review');assert.equal(metadata.expired,false);
 assert.equal(metadata.workflow_run.id,PIN.sourceArtifactRun);assert.equal(metadata.workflow_run.head_sha,PIN.head);
 assert.equal(metadata.size_in_bytes,PIN.sourceArtifactBytes);assert.equal(metadata.digest,'sha256:'+PIN.sourceArtifactSha256);
}
export function verifyDistArchive(archive,files){
 const inspect=`import pathlib,sys,zipfile,stat,hashlib,json\nseen=set();rows=[]\nwith zipfile.ZipFile(sys.argv[1]) as z:\n for e in z.infolist():\n  p=pathlib.PurePosixPath(e.filename);assert e.filename and not p.is_absolute() and '..' not in p.parts and '\\\\' not in e.filename and e.filename not in seen and not stat.S_ISLNK(e.external_attr>>16);seen.add(e.filename)\n  if e.is_dir():continue\n  h=hashlib.sha256();n=0\n  with z.open(e) as f:\n   for b in iter(lambda:f.read(1048576),b''):h.update(b);n+=len(b)\n  rows.append({'file':e.filename,'bytes':n,'sha256':h.hexdigest()})\nprint(json.dumps(rows))\n`;
 const rows=JSON.parse(execFileSync('python3',['-c',inspect,archive],{encoding:'utf8',maxBuffer:16*1024*1024}));
 const sort=xs=>xs.slice().sort((a,b)=>a.file.localeCompare(b.file,'en'));
 assert.deepEqual(sort(rows),sort(files),'Retained dist ZIP contents differ from the complete build inventory');return true;
}
export function isGameUrl(value){
 try{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.pathname==='/'&&!u.hash&&!u.username&&!u.password&&
  JSON.stringify([...u.searchParams].sort())===JSON.stringify([['locationPerf','1'],['profile','1']]);}catch{return false;}
}
export function createTraceSummaryAccumulator(cpu,page,options={}){
 const configured={markerPrefix:MARKER_PREFIX,isGameUrl,...options},base=upstreamAccumulator(cpu,page,configured);
 const markerRows=new Map(['profile-start-click','first-w-keydown','w-keyup'].map(label=>[configured.markerPrefix+label,[]])),gpuPids=new Set();
 let coverage,observeIndex=0;
 const role=pids=>({pids,events:0,phases:{},firstEvent:null,lastEvent:null});
 const index=event=>{
  base.index(event);
  if(event.ph==='M'&&event.name==='process_name'&&finite(event.pid)&&/gpu/i.test(event.args?.name||''))gpuPids.add(event.pid);
  if(markerRows.has(event.name)&&categoryTokens(event).includes('blink.user_timing')&&finite(event.ts)&&finite(event.pid)&&finite(event.tid))markerRows.get(event.name).push(event);
 };
 const beginCoverage=()=>{
  base.beginCoverage();
  const markers=[...markerRows.values()].map(rows=>[...new Map(rows.map(event=>[[event.pid,event.tid,event.ts].join(':'),event])).values()]);
  const valid=markers.every(rows=>rows.length===1)&&new Set(markers.map(rows=>[rows[0]?.pid,rows[0]?.tid].join(':'))).size===1;
  const [start,down,end]=valid?markers.map(rows=>rows[0]):[];
  const ordered=valid&&start.ts<=down.ts&&down.ts<end.ts;
  coverage={category:'gpu',observed:false,nativeWindow:ordered?{startTraceUs:down.ts,endTraceUs:end.ts}:null,
   gameRenderer:role(ordered?[start.pid]:[]),gpuProcess:role([...gpuPids]),otherProcessEvents:0,
   selection:'Known non-metadata trace phase; literal comma-separated gpu token; finite PID/TID/timestamp; event timestamp in [trusted first W-keydown, trusted W-keyup). Complete events also require finite nonnegative dur. No async/flow pairing or duration inference.',
   limitation:'Category coverage only. A captured event does not prove a client wait, a renderer-to-service dependency, GPU execution, queue depth or presentation. Every raw phase/ID remains in the trace archive.'};
 };
 const observe=event=>{
  base.observe(event);const traceEventIndex=observeIndex++;
  const window=coverage?.nativeWindow;
  if(!window||!GPU_COVERAGE_PHASES.has(event.ph)||!categoryTokens(event).includes('gpu')||!finite(event.pid)||!finite(event.tid)||!finite(event.ts)||
   event.ts<window.startTraceUs||event.ts>=window.endTraceUs)return;
  if(event.ph==='X'&&(!finite(event.dur)||event.dur<0||!finite(event.ts+event.dur)))return;
  let matched=false;
  for(const current of [coverage.gameRenderer,coverage.gpuProcess])if(current.pids.includes(event.pid)){
   matched=true;current.events++;current.phases[event.ph]=(current.phases[event.ph]??0)+1;
   const ref={traceEventIndex,ph:event.ph,pid:event.pid,tid:event.tid,ts:event.ts};
   if(current.firstEvent===null||event.ts<current.firstEvent.ts)current.firstEvent=ref;
   if(current.lastEvent===null||event.ts>current.lastEvent.ts)current.lastEvent=ref;
  }
  if(!matched)coverage.otherProcessEvents++;
 };
 const finish=()=>{
  const summary=base.finish();
  // The unchanged upstream checks still establish marker/renderer identity.
  if(coverage.nativeWindow&&(summary.gameRendererPid!==coverage.gameRenderer.pids[0]||summary.nativeRide?.startTraceUs!==coverage.nativeWindow.startTraceUs||
   summary.nativeRide?.endTraceUs!==coverage.nativeWindow.endTraceUs))summary.errors.push('GPU category coverage disagrees with original mapped native boundaries');
  coverage.observed=coverage.gameRenderer.events+coverage.gpuProcess.events>0;
  summary.gpuCategoryCoverage=coverage;return summary;
 };
 return {index,beginCoverage,observe,finish};
}
export function verifyPageObservations(page){
 const o=page?.browserObservations;assert(o&&typeof o==='object','Missing complete page observation payload');
 assert.equal(o.limit,1024);assert(o.dropped&&typeof o.dropped==='object');
 const keys=['markers','tasks','animationFrames','rafGaps','transitions'];assert.deepEqual(Object.keys(o.dropped).sort(),keys.slice().sort());
 for(const key of keys){assert(Number.isSafeInteger(o.dropped[key])&&o.dropped[key]>=0,'Malformed observation drop count: '+key);
  assert.equal(o.dropped[key],0,'Bounded observer overflow: '+key);assert(Array.isArray(key==='markers'?page.markers:o[key]),'Missing observation array: '+key);}
 assert.equal(page.droppedMarkers,o.dropped.markers);
 for(const key of ['longtask','long-animation-frame'])assert.equal(typeof o.available?.[key],'boolean','Missing explicit observer availability: '+key);
 if(!o.available.longtask)assert.equal(o.tasks.length,0);if(!o.available['long-animation-frame'])assert.equal(o.animationFrames.length,0);
 assert(Number.isFinite(o.startAtMs)&&Number.isFinite(o.endAtMs)&&o.startAtMs<o.endAtMs,'Invalid page observation boundaries');
 assert(Number.isSafeInteger(o.rafCallbacks)&&o.rafCallbacks>=2,'Independent RAF observer did not run');
 assert(Number.isFinite(o.firstRafMs)&&Number.isFinite(o.lastRafMs)&&o.firstRafMs<=o.lastRafMs,'Invalid supplied RAF timestamps');
 assert(Number.isFinite(o.firstRafInvocationMs)&&Number.isFinite(o.lastRafInvocationMs)&&o.firstRafInvocationMs>=o.startAtMs&&o.firstRafInvocationMs<=o.lastRafInvocationMs&&o.lastRafInvocationMs<=o.endAtMs,'Invalid independent RAF invocation bounds');
 assert.equal(page.previewRuntime?.polyhavenRockReview,'loaded','Preview marker absent in captured page evidence');return true;
}
export function verifyDriver(driver,gps){
 assert.equal(gitBlob(Buffer.from(driver)),PIN.harness,'Original c722 driver bytes changed');
 assert.equal(sha256(Buffer.from(driver)),PIN.harnessSha256);
 if(gps!==undefined){assert.equal(gitBlob(Buffer.from(gps)),PIN.gpsHelper,'Original GPS helper changed');
  assert(gps.includes('const sourceUrl=page.url(),viewport=page.viewportSize(),browser=page.context().browser();'),'Pre-GPS observation boundary changed');}
}
/** GPS may append errors after baselinePassed was computed. Preserve the exact
 * observed pre-GPS error prefixes instead of recomputing history from final errors. */
export function verifyOriginalVerdict(report,driver,baselineWitness){
 verifyDriver(driver);assert.equal(report.mode,'full','Original full lane changed');
 assert(baselineWitness&&Array.isArray(baselineWitness.errors)&&Array.isArray(baselineWitness.failedRequests),'Missing pre-GPS error-prefix witness');
 assert.equal(baselineWitness.boundary,'first-page-url-after-native-w-keyup');
 for(const key of ['errors','failedRequests']){
  assert(Array.isArray(report[key]));assert.deepEqual(report[key].slice(0,baselineWitness[key].length),baselineWitness[key],'Pre-GPS prefix mismatch: '+key);
 }
 const start=driver.indexOf(' const stats=report.profile;'),end=driver.indexOf(" if(mode==='full')",start);
 assert(start>=0&&end>start);const baseline=driver.slice(start,end);
 assert(baseline.includes('report.baselinePassed=report.passed;'));
 const expected=structuredClone(report);expected.errors=[...baselineWitness.errors];expected.failedRequests=[...baselineWitness.failedRequests];
 new Function('report',baseline)(expected);
 for(const key of ['baselinePassed','frameQualityAccepted','classification','releasePerformanceVerified'])assert.equal(report[key],expected[key],'Original baseline verdict mismatch: '+key);
 assert(report.gpsRegression&&typeof report.gpsRegression.passed==='boolean','Original full GPS result absent; preserve raw failure');
 const final='report.passed=report.baselinePassed&&report.gpsRegression.passed&&!report.errors.length&&!report.failedRequests.length;';
 assert.equal(driver.split(final).length,2,'Original full verdict source changed');
 expected.errors=structuredClone(report.errors);expected.failedRequests=structuredClone(report.failedRequests);new Function('report',final)(expected);
 assert.equal(report.passed,expected.passed,'Original full verdict mismatch');return true;
}
export async function verifyPreviewBuild(directory,files){
 const inventory=new Map(files.map(row=>[row.file,row]));assert.equal(inventory.size,files.length);
 assert(!inventory.has('__belle_test_build.json')&&!inventory.has('staged-landmark-proof-build.json'),'No injected manual/staged marker in the original full query');
 const index=await readFile(resolve(directory,'index.html')),manifest=await readFile(resolve(directory,'asset-manifest.json'));
 for(const [file,bytes] of [['index.html',index],['asset-manifest.json',manifest]])assert.deepEqual(inventory.get(file),{file,bytes:bytes.length,sha256:sha256(bytes)});
 const assets=JSON.parse(manifest);assert(Array.isArray(assets)&&assets.every(x=>typeof x==='string')&&new Set(assets).size===assets.length);
 assert(assets.every(x=>inventory.has(x)),'Manifest references missing build file');
 for(const rock of ROCKS){const file='belle/polyhaven-review/'+rock.file;assert(assets.includes(file));
  assert.deepEqual(inventory.get(file),{file,bytes:rock.bytes,sha256:rock.sha256},'Original three-GLB bytes changed: '+file);}
 const scripts=[...index.toString().matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(x=>x[1].replace(/^\.\//,'').replace(/^\//,''));
 assert(scripts.length&&scripts.every(x=>inventory.has(x)),'Unbound index script');
 return {selection:'new exact-source full-preview diagnostic build; failed preview compiled bytes were not archived',indexSha256:sha256(index),assetManifestSha256:sha256(manifest),assets:assets.length,entryScripts:scripts,rocks:ROCKS};
}
export async function verifyPinnedInputs(game,evidenceDirectory){
 const git=args=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),PIN.head);assert.equal(git(['rev-parse','HEAD^{tree}']),PIN.tree);
 assert.equal(process.env.GITHUB_SHA,PIN.head,'Report must name actual application checkout, not fabricate the earlier merge');
 assert.equal(git(['diff','--name-only','HEAD','--']),'','Tracked application inputs changed');
 const driver=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs')),gps=await readFile(resolve(game,'scripts/gps-full-scene-check.mjs'));
 verifyDriver(driver.toString(),gps.toString());assert.equal(gitBlob(await readFile(resolve(game,'scripts/coop-static-server.mjs'))),PIN.server);
 const build=JSON.parse(await readFile(resolve(evidenceDirectory,'preview-build-receipt.json'),'utf8'));
 assert.equal(build.diagnosticBuild,true);assert.equal(build.failedBuildByteReplay,false);assert.equal(build.head,PIN.head);assert.equal(build.tree,PIN.tree);
 assert.deepEqual(build.buildCommand,['npm','run','build']);assert.deepEqual(build.buildEnvironment,{VITE_POLYHAVEN_ROCK_PREVIEW:'1'});
 assert.equal(build.distArchive,'rebuilt-preview-dist.zip');assert.equal(build.buildExit,0);assert.equal(build.cleanTrackedInputs,true);
 assert.equal(build.sourceArtifactId,PIN.sourceArtifactId);assert.equal(build.sourceArtifactSha256,PIN.sourceArtifactSha256);assert.deepEqual(build.rocks,ROCKS);
 verifySourceArtifact(JSON.parse(await readFile(resolve(evidenceDirectory,'source-artifact-metadata.json'),'utf8')));
 assert.deepEqual(await hashFile(resolve(evidenceDirectory,'source-artifact.zip')),{bytes:PIN.sourceArtifactBytes,sha256:PIN.sourceArtifactSha256},'Retained source-art ZIP changed');
 assert.deepEqual(build.commands.map(x=>x.argv),[['npm','ci'],['npm','run','check'],['npm','test'],['npm','run','build']]);
 for(const [i,name] of ['ci','check','test','build'].entries()){
  assert.equal(build.commands[i].status,0);assert.deepEqual(await hashFile(resolve(evidenceDirectory,name+'.log')),build.commands[i].log,'Build preparation log changed: '+name);}
 assert.deepEqual(await hashFile(resolve(evidenceDirectory,build.distArchive)),build.distArchiveReceipt,'Retained complete dist ZIP changed');
 const files=await buildInventory(resolve(game,'dist'));assert.deepEqual(files,build.files,'Served build differs from frozen diagnostic build');
 verifyDistArchive(resolve(evidenceDirectory,build.distArchive),files);
 // The entire retained ZIP, not a consumed-asset subset, binds every served file.
 const previewBuild=await verifyPreviewBuild(resolve(game,'dist'),files);
 assert.equal(build.embeddedImageIndexFile,'embedded-image-index.json');
 const embeddedImageIndexBytes=await readFile(resolve(evidenceDirectory,build.embeddedImageIndexFile));
 assert.deepEqual({bytes:embeddedImageIndexBytes.length,sha256:sha256(embeddedImageIndexBytes)},build.embeddedImageIndexReceipt,'Retained embedded-image index changed');
 const embeddedImageIndex=await verifyEmbeddedAssetIndex(resolve(game,'dist'),files,JSON.parse(embeddedImageIndexBytes));
 return {head:PIN.head,tree:PIN.tree,harness:{gitBlob:PIN.harness,sha256:sha256(driver),bytes:driver.length},
  diagnosticBuild:true,failedBuildByteReplay:false,canonicalPreviewRun:PIN.canonicalPreviewRun,canonicalMerge:PIN.canonicalMerge,
  artifact:{kind:'new-diagnostic-build',zipSha256:build.distArchiveReceipt.sha256,bytes:build.distArchiveReceipt.bytes},
  buildReceiptSha256:sha256(await readFile(resolve(evidenceDirectory,'preview-build-receipt.json'))),previewBuild,files,embeddedImageIndex};
}
export function diagnosticVerdict({source,report,traceComplete,summary,errors=[],stop}){
 const reasons=[...errors,...(summary?.errors||[])],check=(ok,why)=>{if(!ok)reasons.push(why);};
 check(summary&&Number.isFinite(summary.gameRendererPid),'Actual renderer/timestamp summary absent');
 check(summary?.gpuCategoryCoverage?.observed===true,'No literal gpu-category activity captured during trusted W input on the mapped game renderer or identified GPU process; GPU category coverage unsupported');
 check(source?.head===PIN.head&&source?.tree===PIN.tree&&source?.harness?.gitBlob===PIN.harness,'Source/driver mismatch');
 check(source?.diagnosticBuild===true&&source?.failedBuildByteReplay===false&&source?.artifact?.kind==='new-diagnostic-build','New build provenance missing');
 check(report?.sourceHead===PIN.head&&report?.mode==='full'&&report?.device==='desktop'&&report?.requestedSeconds===90,'Original full desktop lane changed');
 check(report?.renderBackend==='angle-metal'&&/Metal/i.test(report?.actualGpu?.renderer||'')&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report?.actualGpu?.renderer||''),'Native Metal absent');
 check(JSON.stringify(report?.profile?.viewport)===JSON.stringify([1440,900,1]),'Viewport/DPR changed');
 for(const key of ['settingsAtStart','settings']){const s=report?.profile?.[key];
  check(s?.quality==='high'&&s?.effectiveQuality==='high'&&s?.pixelRatio===1&&s?.adaptiveScale===1&&s?.cap===60,'Quality/scale/cap changed: '+key);
  check(s?.world?.performanceDiagnostic===false&&s?.diagnosticReduction===false,'Full scene changed: '+key);}
 check(report?.profile?.stopReason==='trusted-W-keyup'&&summary?.nativeRide?.durationMs>=90000,'Original native 90-second ride incomplete');
 check(report?.gpsRegression&&typeof report.gpsRegression.passed==='boolean','Original full GPS report absent');
 check(report?.releasePerformanceVerified===false,'Original release classification changed');
 check(stop?.trigger==='native-w-keyup'&&stop.cpuStopIssued&&stop.traceEndIssued&&stop.cpuStopped&&stop.traceEnded,'Trace did not stop on original native release');
 check(traceComplete?.dataLossOccurred===false&&typeof traceComplete?.stream==='string','Trace lost data or has no stream');
 return {diagnosticOnly:true,releaseAcceptance:false,diagnosticBuild:true,failedBuildByteReplay:false,collectionComplete:reasons.length===0,errors:reasons,
  originalHarnessPassed:report?.passed??null,originalBaselinePassed:report?.baselinePassed??null,originalGpsPassed:report?.gpsRegression?.passed??null,
  originalP95Ms:report?.profile?.metrics?.frameMs?.p95??null,originalIntervalsOver250ms:report?.profile?.over250ms??null,nativeCapture:summary?.nativeRide??null,
  limitations:['Fixed CPU sampling, trace recording, page observers and asset receipts add unquantified overhead; no numeric correction or acceptance substitution.',
   'The rebuilt preview is pinned and retained, but is not proven byte-identical to the earlier unretained preview bundle.',
   'Independent RAF gaps are timestamped; original eligible slow rows have no timestamps and cannot be exactly joined by matching rounded durations.',
   'GPU-process tasks are host-process activity, not measured GPU execution, queue wait or presentation.',
   'The added literal gpu category and any wait/scheduler scopes add unquantified recording overhead. Category coverage does not establish a wait or a renderer-to-service dependency; exact-browser source semantics require separate verification.']};
}
