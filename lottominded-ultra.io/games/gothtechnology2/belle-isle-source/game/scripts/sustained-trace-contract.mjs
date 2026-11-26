/** Diagnostic evidence only. None of these checks replace the original ride gate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,lstat,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

export const ORIGINAL_HARNESS_BLOB='c722b5810a7693e5ece72ed00b4401e7cde7267a';
export const RECEIPT='belle-trace-build-receipt.json';
export const MARKER_PREFIX='belle-native-trace:';
const INPUT_PIN='output/sustained-trace/build-inputs.json';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
export const failExit=code=>code===undefined||code===0?1:code;

export function sourcePin(game){
 const git=args=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
 return {head:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}']),
  modifiedTrackedFiles:git(['diff','--name-only','HEAD','--']).split('\n').filter(Boolean)};
}
export function generatedTimingReceipt(beforeBytes,afterBytes){
 const before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes);
 for(const value of [before,after])assert.ok(Number.isFinite(value.buildMs)&&value.buildMs>=0,'Missing generated build timing');
 const {buildMs:oldMs,...oldData}=before,{buildMs:newMs,...newData}=after;
 assert.deepEqual(newData,oldData,'Generated street detail changed beyond buildMs');
 return {beforeText:beforeBytes.toString(),afterText:afterBytes.toString(),beforeSha256:sha256(beforeBytes),afterSha256:sha256(afterBytes),onlyBuildMsChanged:true};
}
export async function writeBuildInputs(game){
 const pin=sourcePin(game);
 assert.deepEqual(pin.modifiedTrackedFiles,[],'Tracked inputs must be clean before building');
 const harness=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB,'Original 90-second harness changed');
 await mkdir(resolve(game,'output/sustained-trace'),{recursive:true});
 await writeFile(resolve(game,INPUT_PIN),JSON.stringify(pin,null,2)+'\n');return pin;
}
export async function buildInventory(directory){
 const rows=[];
 async function visit(path){
  for(const entry of await readdir(path,{withFileTypes:true})){
   const file=resolve(path,entry.name),name=relative(directory,file).split('\\').join('/');
   if(name===RECEIPT)continue;
   assert.ok(!entry.isSymbolicLink(),'Build contains symlink: '+name);
   if(entry.isDirectory())await visit(file);
   else {assert.ok((await lstat(file)).isFile(),'Unexpected build entry: '+name);const bytes=await readFile(file);rows.push({file:name,bytes:bytes.length,sha256:sha256(bytes)});}
  }
 }
 await visit(directory);return rows.sort((a,b)=>a.file.localeCompare(b.file));
}
export async function makeBuildReceipt(game){
 const source=sourcePin(game),harness=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB,'Original 90-second harness changed');
 const buildInputs=JSON.parse(await readFile(resolve(game,INPUT_PIN),'utf8'));
 assert.deepEqual(buildInputs.modifiedTrackedFiles,[],'Build did not start from clean tracked inputs');
 for(const key of ['head','tree'])assert.equal(source[key],buildInputs[key],'Checkout changed during build');
 const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();
 const timingPath=relative(root,resolve(game,'../research/street-detail-stats.json')).split('\\').join('/');
 assert.ok(source.modifiedTrackedFiles.every(file=>file===timingPath),'Unexpected tracked build input modification');
 const timingBefore=execFileSync('git',['show',source.head+':'+timingPath],{cwd:game});
 const generatedTiming={file:timingPath,...generatedTimingReceipt(timingBefore,await readFile(resolve(root,timingPath)))};
 const files=await buildInventory(resolve(game,'dist'));
 assert.ok(files.some(row=>row.file==='index.html')&&files.some(row=>row.file==='asset-manifest.json'),'Incomplete build');
 assert.ok(!files.some(row=>row.file.startsWith('belle/staged-architecture/')),'This trace must use the default architecture build');
 return {version:1,...buildInputs,buildInputs,generatedTiming,harness:{gitBlob:gitBlob(harness),sha256:sha256(harness)},files,
  buildWorkflowSha:process.env.GITHUB_SHA||null,defaultArchitecture:true};
}
export async function verifyBuildReceipt(game,receipt){
 const pin=sourcePin(game),harness=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.deepEqual(pin.modifiedTrackedFiles,[],'Native trace checkout must be clean');
 assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB,'Original 90-second harness changed');
 const actual={...pin,harness:{gitBlob:gitBlob(harness),sha256:sha256(harness)},files:await buildInventory(resolve(game,'dist')),defaultArchitecture:true};
 for(const key of ['head','tree','harness','files','defaultArchitecture'])assert.deepEqual(actual[key],receipt[key],'Build/source receipt mismatch: '+key);
 assert.deepEqual(receipt.buildInputs,pin,'Clean source input provenance mismatch');
 assert.ok(!actual.files.some(row=>row.file.startsWith('belle/staged-architecture/')),'Expected the default architecture build');
 const timing=receipt.generatedTiming;
 const root=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();
 assert.equal(timing?.file,relative(root,resolve(game,'../research/street-detail-stats.json')).split('\\').join('/'));
 const before=execFileSync('git',['show',pin.head+':'+timing.file],{cwd:game});
 assert.equal(before.toString(),timing.beforeText,'Generated timing was not based on the pinned source');
 assert.deepEqual(generatedTimingReceipt(before,Buffer.from(timing.afterText)),((({file,...rest})=>rest)(timing)),'Generated timing receipt mismatch');
 assert.equal(actual.head,process.env.GITHUB_SHA,'Checkout and original harness GITHUB_SHA must agree');
 return {...actual,buildInputs:receipt.buildInputs,generatedTiming:timing};
}
export async function writeBuildReceipt(game){
 const receipt=await makeBuildReceipt(game);
 await writeFile(resolve(game,'dist',RECEIPT),JSON.stringify(receipt,null,2)+'\n');return receipt;
}

export function isGameUrl(value){
 try{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.pathname==='/'&&u.searchParams.get('profile')==='1'&&u.searchParams.get('perfProbe')==='1';}catch{return false;}
}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const categories=event=>typeof event.cat==='string'?event.cat.split(',').map(value=>value.trim()):[];

/** Both array fixtures and bounded file passes use these same checks. Every raw
 * event is retained; only the pre-existing top-100 long-event summary is bounded.
 * CPU timestamps always use the original signed deltas, without interpolation. */
export function createTraceSummaryAccumulator(cpu,pageEvidence){
 const processes=[],threads=[],markerEvents=[],longEvents=[],observedCategories=Object.create(null);
 let count=0,summary,start,down,end;
 const index=event=>{
  count++;
  if(event.ph==='M'&&event.name==='process_name')processes.push({pid:event.pid,name:event.args?.name});
  if(event.ph==='M'&&event.name==='thread_name')threads.push({pid:event.pid,tid:event.tid,name:event.args?.name});
  for(const category of categories(event))observedCategories[category]=(observedCategories[category]??0)+1;
  if(typeof event.name==='string'&&event.name.startsWith(MARKER_PREFIX))markerEvents.push(event);
  if(event.ph==='X'&&finite(event.dur)&&event.dur>=50000){
   longEvents.push({name:event.name,cat:event.cat,pid:event.pid,tid:event.tid,ts:event.ts,dur:event.dur});
   longEvents.sort((a,b)=>b.dur-a.dur);if(longEvents.length>100)longEvents.pop();
  }
 };
 const beginCoverage=()=>{
  const errors=[],mapped=[];
  for(const label of ['profile-start-click','first-w-keydown','w-keyup']){
   const markers=(Array.isArray(pageEvidence?.markers)?pageEvidence.markers:[]).filter(row=>row.label===label);
   const matches=markerEvents.filter(e=>e.name===MARKER_PREFIX+label&&categories(e).includes('blink.user_timing')&&finite(e.ts)&&finite(e.pid)&&finite(e.tid));
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
  if(!isGameUrl(pageEvidence?.url)||pageEvidence?.droppedMarkers||pageEvidence?.errors?.length)errors.push('Invalid game target or page observer evidence');
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

export function diagnosticVerdict({source,report,traceComplete,summary,errors=[]}){
 const reasons=[...errors,...(summary?.errors||[])],check=(ok,why)=>{if(!ok)reasons.push(why);};
 check(summary&&Number.isFinite(summary.gameRendererPid),'Real game renderer/timestamp summary missing');
 check(source?.harness?.gitBlob===ORIGINAL_HARNESS_BLOB,'Original harness identity mismatch');
 check(report?.sourceHead===source?.head,'Original report source mismatch');
 check(report?.mode==='diagnostic'&&report?.device==='phone'&&report?.requestedSeconds===90,'Original lane changed');
 check(report?.renderBackend==='angle-metal'&&/Metal/.test(report?.actualGpu?.renderer||'')&&!/SwiftShader|llvmpipe/i.test(report?.actualGpu?.renderer||''),'Native Metal evidence missing');
 check(JSON.stringify(report?.profile?.viewport)===JSON.stringify([390,844,1]),'Phone viewport/DPR changed');
 check(report?.profile?.settings?.quality==='smooth'&&report?.profile?.settings?.effectiveQuality==='smooth'&&report?.profile?.settings?.pixelRatio===1&&report?.profile?.settings?.adaptiveScale===1&&report?.profile?.settings?.cap===60,'Original quality/scale/cap changed');
 check(report?.profile?.settings?.world?.performanceDiagnostic===true,'Diagnostic scene selection changed');
 check(report?.profile?.stopReason==='trusted-W-keyup'&&Number.isFinite(report?.profile?.activeSeconds)&&report.profile.activeSeconds>=90,'Original trusted 90-second capture incomplete');
 check(Number.isFinite(summary?.nativeRide?.durationMs)&&summary.nativeRide.durationMs>=report?.requestedSeconds*1000,'Native trusted 90-second input interval incomplete');
 check(traceComplete?.dataLossOccurred===false&&typeof traceComplete?.stream==='string','Timeline incomplete or lost data');
 return {diagnosticOnly:true,releaseAcceptance:false,collectionComplete:reasons.length===0,errors:reasons,
  originalHarnessPassed:report?.passed??null,originalP95Ms:report?.profile?.metrics?.frameMs?.p95??null,
  originalIntervalsOver250ms:report?.profile?.over250ms??null,
  nativeCapture:summary?.nativeRide??null,originalActiveSeconds:report?.profile?.activeSeconds??null,originalExcludedSeconds:report?.profile?.excludedSeconds??null,
  limitations:['CPU profiling and tracing add overhead. This run cannot clear any original failure or qualify release performance.',
   'Raw timeline and CPU stacks are retained. Phase maxima alone do not establish causation.',
   'Browser/GPU trace categories and process information depend on Chrome support; missing native-process coverage remains explicit.']};
}
