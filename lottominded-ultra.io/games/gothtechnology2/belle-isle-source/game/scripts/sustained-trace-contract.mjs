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
export function traceSummary(trace,cpu,pageEvidence){
 const events=Array.isArray(trace)?trace:Array.isArray(trace?.traceEvents)?trace.traceEvents:[],errors=[];
 const categories=event=>typeof event.cat==='string'?event.cat.split(','):[];
 const processes=events.filter(e=>e.ph==='M'&&e.name==='process_name').map(e=>({pid:e.pid,name:e.args?.name}));
 const threads=events.filter(e=>e.ph==='M'&&e.name==='thread_name').map(e=>({pid:e.pid,tid:e.tid,name:e.args?.name}));
 const observedCategories={};for(const event of events)for(const category of categories(event))observedCategories[category]=(observedCategories[category]??0)+1;
 const mapped=[];
 for(const label of ['profile-start-click','first-w-keydown','w-keyup']){
  const markers=(Array.isArray(pageEvidence?.markers)?pageEvidence.markers:[]).filter(row=>row.label===label);
  const matches=events.filter(e=>e.name===MARKER_PREFIX+label&&categories(e).includes('blink.user_timing')&&Number.isFinite(e.ts)&&Number.isFinite(e.pid)&&Number.isFinite(e.tid));
  const unique=[...new Map(matches.map(e=>[[e.pid,e.tid,e.ts].join(':'),e])).values()];
  if(markers.length!==1||!Number.isFinite(markers[0].atMs)||markers[0].atMs<0||unique.length!==1){errors.push('Missing or ambiguous clock marker: '+label);continue;}
  mapped.push({label,pageMs:markers[0].atMs,traceUs:unique[0].ts,pid:unique[0].pid,tid:unique[0].tid,offsetUs:unique[0].ts-markers[0].atMs*1000});
 }
 const offsets=mapped.map(x=>x.offsetUs),spreadUs=offsets.length?Math.max(...offsets)-Math.min(...offsets):null;
 if(mapped.length!==3||new Set(mapped.map(x=>[x.pid,x.tid].join(':'))).size!==1||spreadUs>1000)errors.push('Page/trace timestamp mapping incomplete or inconsistent');
 const start=mapped.find(x=>x.label==='profile-start-click'),down=mapped.find(x=>x.label==='first-w-keydown'),end=mapped.find(x=>x.label==='w-keyup');
 if(!start||!down||!end||!(start.pageMs<=down.pageMs&&down.pageMs<end.pageMs&&start.traceUs<=down.traceUs&&down.traceUs<end.traceUs))errors.push('Native ride boundary order is invalid');
 const nativeRide=down&&end?{startPageMs:down.pageMs,endPageMs:end.pageMs,durationMs:end.pageMs-down.pageMs,
  startTraceUs:down.traceUs,endTraceUs:end.traceUs,traceDurationMs:(end.traceUs-down.traceUs)/1000,
  basis:'Trusted first W-keydown to W-keyup; eligible active frame time is a separate measurement.'}:null;
 const rendererPid=mapped[0]?.pid,rendererTid=mapped[0]?.tid;
 if(!processes.some(p=>p.pid===rendererPid&&/renderer/i.test(p.name||'')))errors.push('Actual game renderer process absent from trace metadata');
 // Enumerating categories is not proof that their events were emitted. Require
 // real renderer work on the marked thread across the native input boundaries.
 const timeline=events.filter(e=>e.pid===rendererPid&&e.tid===rendererTid&&e.ph==='X'&&Number.isFinite(e.ts)&&Number.isFinite(e.dur)&&e.dur>=0&&
  categories(e).some(c=>c==='devtools.timeline'||c==='disabled-by-default-devtools.timeline'));
 let firstUs=Infinity,lastUs=-Infinity,duringRide=0;
 for(const event of timeline){firstUs=Math.min(firstUs,event.ts);lastUs=Math.max(lastUs,event.ts+event.dur);if(down&&end&&event.ts<=end.traceUs&&event.ts+event.dur>=down.traceUs)duringRide++;}
 const rendererTimeline={events:timeline.length,duringRide,firstUs:Number.isFinite(firstUs)?firstUs:null,lastUs:Number.isFinite(lastUs)?lastUs:null};
 if(!down||!end||!duringRide||firstUs>down.traceUs||lastUs<end.traceUs)errors.push('Renderer timeline work does not cover native ride boundaries');
 let cpuCoverage=null;
 if(!Array.isArray(cpu?.nodes)||!cpu.nodes.length||!Array.isArray(cpu?.samples)||!cpu.samples.length||!Array.isArray(cpu.timeDeltas)||cpu.samples.length!==cpu.timeDeltas.length||
  !Number.isFinite(cpu.startTime)||!Number.isFinite(cpu.endTime)||cpu.endTime<cpu.startTime)errors.push('Missing or malformed CPU call-stack samples');
 else{
  const ids=new Set(cpu.nodes.map(node=>node.id));
  if(ids.size!==cpu.nodes.length||!cpu.samples.every(id=>Number.isInteger(id)&&ids.has(id))||!cpu.timeDeltas.every(Number.isFinite))errors.push('CPU samples have invalid node IDs or time deltas');
  else{
   let at=cpu.startTime,first=null,last=null,rideSamples=0,outside=0,negativeDeltas=0;
   // Preserve signed deltas: native V8 profiles can contain small negative
   // deltas. Reconstruct their actual times instead of altering the samples.
   for(let i=0;i<cpu.samples.length;i++){const delta=cpu.timeDeltas[i];at+=delta;if(delta<0)negativeDeltas++;if(first===null)first=at;last=at;
    if(at<cpu.startTime||at>cpu.endTime)outside++;if(down&&end&&at>=down.traceUs&&at<=end.traceUs)rideSamples++;}
   cpuCoverage={samples:cpu.samples.length,firstSampleUs:first,lastSampleUs:last,rideSamples,negativeDeltas};
   if(outside||!down||!end||!rideSamples||first>down.traceUs||last<end.traceUs)errors.push('Actual CPU samples do not cover native ride boundaries');
  }
 }
 if(!start||!end||!(cpu?.startTime<=start.traceUs&&cpu?.endTime>=end.traceUs))errors.push('CPU profile does not cover mapped ride boundaries');
 if(!isGameUrl(pageEvidence?.url)||pageEvidence?.droppedMarkers||pageEvidence?.errors?.length)errors.push('Invalid game target or page observer evidence');
 return {errors,events:events.length,processes,threads,gameRendererPid:rendererPid??null,gameRendererTid:rendererTid??null,
  observedCategories,rendererTimeline,cpuCoverage,nativeRide,
  browserProcesses:processes.filter(p=>/browser/i.test(p.name||'')),gpuProcesses:processes.filter(p=>/gpu/i.test(p.name||'')),
  clockMapping:{markers:mapped,spreadUs,pageToTraceOffsetUs:offsets.length?offsets.reduce((a,b)=>a+b,0)/offsets.length:null,
   note:'PerformanceMark startTime is paired with its native trace timestamp. CPU header bounds cover the capture markers; actual samples span the native W interval. Native process tasks remain observations, not GPU-execution certification.'},
  longEvents:events.filter(e=>e.ph==='X'&&e.dur>=50000).sort((a,b)=>b.dur-a.dur).slice(0,100).map(e=>({name:e.name,cat:e.cat,pid:e.pid,tid:e.tid,ts:e.ts,dur:e.dur}))};
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
 check(report?.profile?.stopReason==='trusted-W-keyup'&&Number.isFinite(summary?.nativeRide?.durationMs)&&summary.nativeRide.durationMs>=report.requestedSeconds*1000,'Original trusted 90-second capture incomplete');
 check(traceComplete?.dataLossOccurred===false&&typeof traceComplete?.stream==='string','Timeline incomplete or lost data');
 return {diagnosticOnly:true,releaseAcceptance:false,collectionComplete:reasons.length===0,errors:reasons,
  originalHarnessPassed:report?.passed??null,originalP95Ms:report?.profile?.metrics?.frameMs?.p95??null,
  originalIntervalsOver250ms:report?.profile?.over250ms??null,
  nativeCapture:summary?.nativeRide??null,originalActiveSeconds:report?.profile?.activeSeconds??null,originalExcludedSeconds:report?.profile?.excludedSeconds??null,
  limitations:['CPU profiling and tracing add overhead. This run cannot clear any original failure or qualify release performance.',
   'Raw timeline and CPU stacks are retained. Phase maxima alone do not establish causation.',
   'Browser/GPU trace categories and process information depend on Chrome support; missing native-process coverage remains explicit.']};
}
