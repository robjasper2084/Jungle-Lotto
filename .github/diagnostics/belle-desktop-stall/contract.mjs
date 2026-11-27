/** Immutable full-desktop diagnostic evidence. Never a release verdict. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

export const PIN=Object.freeze({head:'7b69bf2b48d6177f5eb346021793ba79922be79e',candidate:'7b69bf2b48d6177f5eb346021793ba79922be79e',
 tree:'f8b443a9eb1bba9513a72f2f99e5088530abf544',harness:'c722b5810a7693e5ece72ed00b4401e7cde7267a',
 runId:45923547836,artifactId:15165683648,artifactName:'belle-staged-architecture-verified-build',
 artifactBytes:176935336,artifactSha256:'1fbb6f6e38cce8a93f59a65d900ab55a59809fd52433061d2795601885d38921',
 stagedManifestBlob:'6f6f4af0d3c8b88ae74a4f987da908bea8a1d208'});
export const MARKER_PREFIX='belle-desktop-stall:';
export const TRACE_CATEGORIES=Object.freeze(['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing',
 'v8','disabled-by-default-v8.gc','renderer.scheduler','gpu','viz','cc','disabled-by-default-gpu.service']);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
export const combinedExit=(original,diagnostic)=>original!==0?original:diagnostic;
export async function hashFile(path){
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}
 return {bytes,sha256:hash.digest('hex')};
}
export function isGameUrl(value){
 try{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.pathname==='/'&&!u.hash&&!u.username&&!u.password&&
  JSON.stringify([...u.searchParams].sort())===JSON.stringify([['locationPerf','1'],['profile','1']]);}catch{return false;}
}
export function verifyArtifactMetadata(metadata){
 assert.equal(metadata.id,PIN.artifactId);assert.equal(metadata.name,PIN.artifactName);assert.equal(metadata.expired,false);
 assert.equal(metadata.workflow_run.id,PIN.runId);assert.equal(metadata.workflow_run.head_sha,PIN.candidate);
 assert.equal(metadata.digest,'sha256:'+PIN.artifactSha256);assert.equal(metadata.size_in_bytes,PIN.artifactBytes);
}
export async function buildInventory(directory){
 const rows=[];
 async function visit(path){for(const entry of await readdir(path,{withFileTypes:true})){
  const file=resolve(path,entry.name),name=relative(directory,file).split('\\').join('/');
  assert(!entry.isSymbolicLink(),'Build symlink: '+name);
  if(entry.isDirectory())await visit(file);else{assert((await lstat(file)).isFile(),'Unexpected build entry: '+name);
   const bytes=await readFile(file);rows.push({file:name,bytes:bytes.length,sha256:sha256(bytes)});}
 }}
 await visit(directory);return rows.sort((a,b)=>a.file.localeCompare(b.file,'en'));
}
/** Verify the staged flag and every model/LOD against the actual hashed build
 * inventory. The manifest itself must be the exact blob from the pinned tree.
 * This receipt does not assert that staged architecture is release accepted. */
export async function verifyStagedBuild(directory,files){
 const inventory=new Map(files.map(row=>[row.file,row]));
 assert.equal(inventory.size,files.length,'Duplicate compiled inventory path');
 const read=async name=>{
  const bytes=await readFile(resolve(directory,name)),row=inventory.get(name);
  assert(row,'Missing staged build receipt: '+name);
  assert.equal(row.bytes,bytes.length,'Staged receipt size mismatch: '+name);
  assert.equal(row.sha256,sha256(bytes),'Staged receipt hash mismatch: '+name);
  return bytes;
 };
 const proof=JSON.parse(await read('staged-landmark-proof-build.json'));
 assert.equal(proof.sourceSha,PIN.head,'Staged build source changed');
 assert.equal(proof.stagedFlag,'VITE_STAGED_BELLE_ARCHITECTURE=1','Staged build flag changed');
 assert.equal(proof.indexSha256,inventory.get('index.html')?.sha256,'Staged build index mismatch');
 const manifestPath='belle/staged-architecture/manifest.json',manifestBytes=await read(manifestPath);
 assert.equal(gitBlob(manifestBytes),PIN.stagedManifestBlob,'Staged manifest differs from pinned source');
 const manifest=JSON.parse(manifestBytes);
 assert.equal(manifest.schema,'staged-belle-landmarks/v1');assert.equal(manifest.productionReady,false);
 assert.equal(manifest.nativePerformanceAccepted,false);assert.equal(manifest.runtimeGate,'VITE_STAGED_BELLE_ARCHITECTURE=1');
 assert(Array.isArray(manifest.models)&&manifest.models.length===4,'Expected four staged models');
 const lods=[];
 for(const model of manifest.models){
  assert(Array.isArray(model.lods)&&model.lods.length===3,'Expected three staged LODs per model');
  assert.deepEqual(model.lods.map(lod=>lod.lod).sort(),[0,1,2],'Staged LOD levels changed');
  for(const lod of model.lods){
   assert.match(lod.file,/^[a-zA-Z0-9_.-]+\.glb$/);assert.match(lod.sha256,/^[a-f0-9]{64}$/);
   assert(Number.isSafeInteger(lod.bytes)&&lod.bytes>0);
   const file='belle/staged-architecture/'+lod.file,row=inventory.get(file);
   assert(row,'Missing staged GLB: '+file);
   assert.equal(row.bytes,lod.bytes,'Staged GLB size mismatch: '+file);
   assert.equal(row.sha256,lod.sha256,'Staged GLB hash mismatch: '+file);
   lods.push({file,bytes:row.bytes,sha256:row.sha256});
  }
 }
 assert.equal(new Set(lods.map(row=>row.file)).size,12,'Expected twelve distinct staged GLBs');
 const stagedPaths=[manifestPath,...lods.map(row=>row.file)].sort();
 assert.deepEqual(files.filter(row=>row.file.startsWith('belle/staged-architecture/')).map(row=>row.file).sort(),stagedPaths,'Unexpected staged build files');
 const assets=JSON.parse(await read('asset-manifest.json'));
 assert(Array.isArray(assets)&&assets.every(file=>typeof file==='string')&&new Set(assets).size===assets.length,'Malformed asset manifest');
 assert(stagedPaths.every(file=>assets.includes(file)),'Staged files absent from asset manifest');
 return {sourceSha:proof.sourceSha,stagedFlag:proof.stagedFlag,indexSha256:proof.indexSha256,
  manifest:{gitBlob:gitBlob(manifestBytes),sha256:sha256(manifestBytes),bytes:manifestBytes.length},modelCount:manifest.models.length,lodCount:lods.length,lods};
}
export async function verifyPinnedInputs(game,evidenceDirectory){
 const git=args=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
 const head=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
 assert.equal(head,PIN.head);assert.equal(tree,PIN.tree);assert.equal(process.env.GITHUB_SHA,PIN.head);
 assert.equal(git(['diff','--name-only','HEAD','--']),'','Tracked application inputs changed');
 const bytes=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.equal(gitBlob(bytes),PIN.harness,'Original driver bytes changed');
 const metadata=JSON.parse(await readFile(resolve(evidenceDirectory,'artifact-metadata.json'),'utf8'));verifyArtifactMetadata(metadata);
 const receipt=JSON.parse(await readFile(resolve(evidenceDirectory,'artifact-provenance.json'),'utf8'));
 assert.equal(receipt.zipSha256,PIN.artifactSha256);assert.equal(receipt.bytes,PIN.artifactBytes);
 assert.equal(receipt.artifactId,PIN.artifactId);assert.equal(receipt.runId,PIN.runId);
 assert.equal(receipt.candidate,PIN.candidate);assert.equal(receipt.applicationHead,PIN.head);assert.equal(receipt.identicalSourceTree,PIN.tree);
 assert.equal(receipt.archive,'immutable-input-build.zip');
 assert.deepEqual(await hashFile(resolve(evidenceDirectory,receipt.archive)),{bytes:PIN.artifactBytes,sha256:PIN.artifactSha256},'Archived immutable input ZIP changed');
 const expected=JSON.parse(await readFile(resolve(evidenceDirectory,'dist-manifest.json'),'utf8')).sort((a,b)=>a.file.localeCompare(b.file,'en'));
 const files=await buildInventory(resolve(game,'dist'));assert.deepEqual(files,expected,'Compiled build bytes changed');
 assert.equal(receipt.files,files.length,'Immutable artifact file count changed');
 assert(files.some(row=>row.file==='index.html')&&files.some(row=>row.file==='asset-manifest.json'),'Incomplete build');
 const stagedBuild=await verifyStagedBuild(resolve(game,'dist'),files);
 return {head,tree,candidate:PIN.candidate,harness:{gitBlob:gitBlob(bytes),sha256:sha256(bytes),bytes:bytes.length},
  artifact:{id:PIN.artifactId,runId:PIN.runId,zipSha256:PIN.artifactSha256,bytes:PIN.artifactBytes},stagedBuild,files};
}
export function verifyOriginalVerdict(report,driver){
 assert.equal(gitBlob(Buffer.from(driver)),PIN.harness,'Original gate source changed');
 const start=driver.indexOf(' const stats=report.profile;'),end=driver.indexOf(" if(mode==='full')",start);
 assert(start>=0&&end>start);const baseline=driver.slice(start,end);
 assert(baseline.includes('report.baselinePassed=report.passed;'));
 const full=driver.split('\n').find(line=>line.includes('report.passed=report.baselinePassed&&report.gpsRegression.passed'));
 assert(full);const expected=structuredClone(report);new Function('report',baseline)(expected);new Function('report',full)(expected);
 for(const key of ['passed','baselinePassed','frameQualityAccepted','classification','releasePerformanceVerified'])assert.equal(report[key],expected[key],'Original verdict mismatch: '+key);
 return true;
}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const categories=event=>typeof event.cat==='string'?event.cat.split(',').map(value=>value.trim()):[];

/** Both array fixtures and bounded file passes use these same checks. Every raw
 * event is retained; only the pre-existing top-100 long-event summary is bounded.
 * CPU timestamps always use the original signed deltas, without interpolation. */
export function createTraceSummaryAccumulator(cpu,pageEvidence,{markerPrefix=MARKER_PREFIX,isGameUrl:matchesGameUrl=isGameUrl}={}){
 const processes=[],threads=[],markerEvents=[],longEvents=[],observedCategories=Object.create(null);
 let count=0,summary,start,down,end;
 const index=event=>{
  count++;
  if(event.ph==='M'&&event.name==='process_name')processes.push({pid:event.pid,name:event.args?.name});
  if(event.ph==='M'&&event.name==='thread_name')threads.push({pid:event.pid,tid:event.tid,name:event.args?.name});
  for(const category of categories(event))observedCategories[category]=(observedCategories[category]??0)+1;
  if(typeof event.name==='string'&&event.name.startsWith(markerPrefix))markerEvents.push(event);
  if(event.ph==='X'&&finite(event.dur)&&event.dur>=50000){
   longEvents.push({name:event.name,cat:event.cat,pid:event.pid,tid:event.tid,ts:event.ts,dur:event.dur});
   longEvents.sort((a,b)=>b.dur-a.dur);if(longEvents.length>100)longEvents.pop();
  }
 };
 const beginCoverage=()=>{
  const errors=[],mapped=[];
  for(const label of ['profile-start-click','first-w-keydown','w-keyup']){
   const markers=(Array.isArray(pageEvidence?.markers)?pageEvidence.markers:[]).filter(row=>row.label===label);
   const matches=markerEvents.filter(e=>e.name===markerPrefix+label&&categories(e).includes('blink.user_timing')&&finite(e.ts)&&finite(e.pid)&&finite(e.tid));
   const unique=[...new Map(matches.map(e=>[[e.pid,e.tid,e.ts].join(':'),e])).values()];
   if(markers.length!==1||!finite(markers[0].atMs)||markers[0].atMs<0||unique.length!==1){errors.push('Missing or ambiguous clock marker: '+label);continue;}
   mapped.push({label,pageMs:markers[0].atMs,traceUs:unique[0].ts,pid:unique[0].pid,tid:unique[0].tid,offsetUs:unique[0].ts-markers[0].atMs*1000});
  }
  const offsets=mapped.map(x=>x.offsetUs),spreadUs=offsets.length?Math.max(...offsets)-Math.min(...offsets):null;
  if(mapped.length!==3||new Set(mapped.map(x=>[x.pid,x.tid].join(':'))).size!==1||spreadUs>1000)errors.push('Page/trace timestamp mapping incomplete or inconsistent');
  start=mapped.find(x=>x.label==='profile-start-click');down=mapped.find(x=>x.label==='first-w-keydown');end=mapped.find(x=>x.label==='w-keyup');
  if(!start||!down||!end||!(start.pageMs<=down.pageMs&&down.pageMs<end.pageMs&&start.traceUs<=down.traceUs&&down.traceUs<end.traceUs))errors.push('Native ride boundary order is invalid');
  const nativeRide=down&&end?{startPageMs:down.pageMs,endPageMs:end.pageMs,durationMs:end.pageMs-down.pageMs,
   startTraceUs:down.traceUs,endTraceUs:end.traceUs,traceDurationMs:(end.traceUs-down.traceUs)/1000,
   basis:'Trusted first W-keydown to W-keyup; eligible active frame time is a separate measurement.'}:null;
  const rendererPid=mapped[0]?.pid,rendererTid=mapped[0]?.tid;
  if(!processes.some(p=>p.pid===rendererPid&&/renderer/i.test(p.name||'')))errors.push('Actual game renderer process absent from trace metadata');
  if(!start||!end||!finite(cpu?.startTime)||!finite(cpu?.endTime)||!(cpu.startTime<=start.traceUs&&cpu.endTime>=end.traceUs))errors.push('CPU profile does not cover mapped ride boundaries');
  if(!matchesGameUrl(pageEvidence?.url)||pageEvidence?.droppedMarkers||pageEvidence?.errors?.length)errors.push('Invalid game target or page observer evidence');
  const browserProcesses=processes.filter(p=>/browser/i.test(p.name||'')),gpuProcesses=processes.filter(p=>/gpu/i.test(p.name||''));
  const activity=rows=>({pids:rows.map(p=>p.pid),events:0,durationEvents:0,firstEventUs:null,lastEventUs:null,maximumDurationUs:0});
  summary={errors,events:count,processes,threads,gameRendererPid:rendererPid??null,gameRendererTid:rendererTid??null,
   observedCategories:{...observedCategories},rendererTimeline:{events:0,duringRide:0,firstUs:null,lastUs:null},cpuCoverage:null,nativeRide,
   categoryEvidence:{userTimingMarkers:mapped.length,gameRendererTimelineEvents:0},
   browserProcesses,gpuProcesses,nativeActivity:{browser:activity(browserProcesses),gpu:activity(gpuProcesses)},
   clockMapping:{markers:mapped,spreadUs,pageToTraceOffsetUs:offsets.length?offsets.reduce((a,b)=>a+b,0)/offsets.length:null,
    note:'PerformanceMark startTime is paired with its native trace timestamp. CPU header bounds cover the capture markers; actual samples span the native W interval. Native process tasks remain observations, not GPU-execution certification.'},longEvents};
 };
 const observe=event=>{
  assert.ok(summary,'Begin coverage before observing events');
  const duration=event.ph==='X'&&finite(event.ts)&&finite(event.dur)&&event.dur>0&&finite(event.ts+event.dur);
  if(duration&&event.pid===summary.gameRendererPid&&event.tid===summary.gameRendererTid&&categories(event).some(c=>c==='devtools.timeline'||c==='disabled-by-default-devtools.timeline')){
   const timeline=summary.rendererTimeline;timeline.events++;
   timeline.firstUs=timeline.firstUs===null?event.ts:Math.min(timeline.firstUs,event.ts);
   timeline.lastUs=timeline.lastUs===null?event.ts+event.dur:Math.max(timeline.lastUs,event.ts+event.dur);
   if(down&&end&&event.ts<end.traceUs&&event.ts+event.dur>down.traceUs)timeline.duringRide++;
   if(down&&end&&event.ts>=down.traceUs&&event.ts<end.traceUs)summary.categoryEvidence.gameRendererTimelineEvents++;
  }
  if(!down||!end||!finite(event.ts)||event.ts<down.traceUs||event.ts>=end.traceUs)return;
  for(const row of Object.values(summary.nativeActivity))if(event.ph!=='M'&&row.pids.includes(event.pid)){
   row.events++;if(duration){row.durationEvents++;row.maximumDurationUs=Math.max(row.maximumDurationUs,event.dur);}
   row.firstEventUs=row.firstEventUs===null?event.ts:Math.min(row.firstEventUs,event.ts);
   row.lastEventUs=row.lastEventUs===null?event.ts:Math.max(row.lastEventUs,event.ts);
  }
 };
 const finish=()=>{
  assert.ok(summary,'Begin coverage before finishing');
  const {errors,rendererTimeline:timeline}=summary;
  // Metadata, zero-duration records and menu-only work cannot prove ride coverage.
  if(!down||!end||!timeline.duringRide||timeline.firstUs===null||timeline.lastUs===null||timeline.firstUs>down.traceUs||timeline.lastUs<end.traceUs)errors.push('Renderer timeline work does not cover native ride boundaries');
  if(!Array.isArray(cpu?.nodes)||!cpu.nodes.length||!Array.isArray(cpu?.samples)||!cpu.samples.length||!Array.isArray(cpu.timeDeltas)||cpu.samples.length!==cpu.timeDeltas.length||
   !finite(cpu.startTime)||!finite(cpu.endTime)||cpu.endTime<cpu.startTime)errors.push('Missing or malformed CPU call-stack samples');
  else{
   const ids=new Set(cpu.nodes.map(node=>node.id));
   const coverage={samples:cpu.samples.length,firstSampleUs:null,lastSampleUs:null,rideSamples:0,
    firstRideSampleUs:null,lastRideSampleUs:null,initialUnsampledUs:null,finalUnsampledUs:null,
    maximumRawDeltaEndingDuringRideUs:null,negativeDeltas:0,minimumRawDeltaUs:null,
    unknownNodes:0,malformedDeltas:0,samplesOutsideProfileBounds:0,
    note:'Sample timestamp = profile.startTime plus cumulative original timeDeltas. Negative deltas and sampling gaps are retained; no clamping or interpolation.'};
   let at=cpu.startTime;
   for(let i=0;i<cpu.samples.length;i++){
    const delta=cpu.timeDeltas[i];
    if(!finite(delta)){coverage.malformedDeltas++;at=NaN;}
    else{at+=delta;if(delta<0)coverage.negativeDeltas++;coverage.minimumRawDeltaUs=coverage.minimumRawDeltaUs===null?delta:Math.min(coverage.minimumRawDeltaUs,delta);}
    if(i===0)coverage.firstSampleUs=finite(at)?at:null;coverage.lastSampleUs=finite(at)?at:null;
    const known=Number.isInteger(cpu.samples[i])&&ids.has(cpu.samples[i]);if(!known)coverage.unknownNodes++;
    if(finite(at)&&(at<cpu.startTime||at>cpu.endTime))coverage.samplesOutsideProfileBounds++;
    if(known&&finite(at)&&down&&end&&at>=down.traceUs&&at<=end.traceUs){
     coverage.rideSamples++;coverage.firstRideSampleUs=coverage.firstRideSampleUs===null?at:Math.min(coverage.firstRideSampleUs,at);
     coverage.lastRideSampleUs=coverage.lastRideSampleUs===null?at:Math.max(coverage.lastRideSampleUs,at);
     coverage.maximumRawDeltaEndingDuringRideUs=coverage.maximumRawDeltaEndingDuringRideUs===null?delta:Math.max(coverage.maximumRawDeltaEndingDuringRideUs,delta);
    }
   }
   if(coverage.firstRideSampleUs!==null){coverage.initialUnsampledUs=coverage.firstRideSampleUs-down.traceUs;coverage.finalUnsampledUs=end.traceUs-coverage.lastRideSampleUs;}
   summary.cpuCoverage=coverage;
   if(ids.size!==cpu.nodes.length||!cpu.nodes.every(node=>Number.isInteger(node.id))||coverage.unknownNodes||coverage.malformedDeltas)errors.push('CPU samples have invalid node IDs or time deltas');
   if(coverage.samplesOutsideProfileBounds||!down||!end||!coverage.rideSamples||coverage.firstSampleUs===null||coverage.lastSampleUs===null||coverage.firstSampleUs>down.traceUs||coverage.lastSampleUs<end.traceUs)errors.push('Actual CPU samples do not cover native ride boundaries');
  }
  for(const row of Object.values(summary.nativeActivity))row.limitation=row.events?'Recorded process activity is not GPU execution or presentation timing.':'No process activity captured during trusted W input; process metadata alone is not coverage.';
  return summary;
 };
 return {index,beginCoverage,observe,finish};
}

export function traceSummary(trace,cpu,pageEvidence){
 const events=Array.isArray(trace)?trace:Array.isArray(trace?.traceEvents)?trace.traceEvents:[],accumulator=createTraceSummaryAccumulator(cpu,pageEvidence);
 for(const event of events)accumulator.index(event);accumulator.beginCoverage();
 for(const event of events)accumulator.observe(event);return accumulator.finish();
}

export function diagnosticVerdict({source,report,traceComplete,summary,errors=[],stop}){
 const reasons=[...errors,...(summary?.errors||[])],check=(ok,why)=>{if(!ok)reasons.push(why);};
 check(summary&&Number.isFinite(summary.gameRendererPid),'Real game renderer/timestamp summary missing');
 check(source?.head===PIN.head&&source?.tree===PIN.tree&&source?.harness?.gitBlob===PIN.harness,'Immutable source/harness mismatch');
 check(source?.artifact?.id===PIN.artifactId&&source?.artifact?.zipSha256===PIN.artifactSha256,'Immutable build mismatch');
 check(report?.sourceHead===PIN.head&&report?.mode==='full'&&report?.device==='desktop'&&report?.requestedSeconds===90,'Original full-desktop lane changed');
 check(report?.renderBackend==='angle-metal'&&/Metal/.test(report?.actualGpu?.renderer||'')&&!/SwiftShader|llvmpipe/i.test(report?.actualGpu?.renderer||''),'Native Metal evidence missing');
 check(JSON.stringify(report?.profile?.viewport)===JSON.stringify([1440,900,1]),'Desktop viewport/DPR changed');
 for(const field of ['settingsAtStart','settings']){const settings=report?.profile?.[field];
  check(settings?.quality==='high'&&settings?.effectiveQuality==='high'&&settings?.pixelRatio===1&&settings?.adaptiveScale===1&&settings?.cap===60,'Original quality/scale/cap changed: '+field);
  check(settings?.world?.performanceDiagnostic===false&&settings?.diagnosticReduction===false,'Full scene selection changed: '+field);
 }
 check(report?.profile?.stopReason==='trusted-W-keyup'&&Number.isFinite(summary?.nativeRide?.durationMs)&&summary.nativeRide.durationMs>=90000,'Original native 90-second ride incomplete');
 check(report?.gpsRegression&&typeof report.gpsRegression.passed==='boolean','Original GPS result missing');
 check(report?.releasePerformanceVerified===false,'Original release classification changed');
 check(stop?.trigger==='native-w-keyup'&&stop?.cpuStopIssued===true&&stop?.traceEndIssued===true&&stop?.cpuStopped===true&&stop?.traceEnded===true,'Recording did not stop at original native release');
 check(traceComplete?.dataLossOccurred===false&&typeof traceComplete?.stream==='string','Timeline incomplete or lost data');
 return {diagnosticOnly:true,releaseAcceptance:false,collectionComplete:reasons.length===0,errors:reasons,
  originalHarnessPassed:report?.passed??null,originalBaselinePassed:report?.baselinePassed??null,
  originalP95Ms:report?.profile?.metrics?.frameMs?.p95??null,originalIntervalsOver250ms:report?.profile?.over250ms??null,
  originalGpsPassed:report?.gpsRegression?.passed??null,nativeCapture:summary?.nativeRide??null,
  limitations:['Tracing and CPU sampling add overhead. This run cannot clear the current uninstrumented p95 or over-250-ms failures.',
   'Actual CPU samples must span the native boundaries; an early last sample remains an explicit coverage failure.',
   'Browser/GPU event availability and phase maxima do not establish GPU execution or stall causation.']};
}
