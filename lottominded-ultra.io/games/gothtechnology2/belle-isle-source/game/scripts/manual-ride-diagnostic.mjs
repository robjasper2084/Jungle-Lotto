/** Separate manual-observer diagnostic. Never substitutes for the unchanged
 * sustained-ride-profile.mjs release gate or changes its acceptance policy. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {prepareHostServiceTrace} from './host-service-trace.mjs';

const {values}=parseArgs({options:{...Object.fromEntries(['game','build','output','sha','source','case','device','baseline','candidate','condition'].map(name=>[name,{type:'string'}])),gpu:{type:'boolean',default:false},trace:{type:'boolean',default:false}}});
for(const name of ['game','build','output','sha','source','case','device','baseline','candidate'])assert(values[name],'Missing --'+name);
for(const name of ['sha','baseline','candidate'])assert.match(values[name],/^[0-9a-f]{40}$/,'Full immutable --'+name+' SHA required');
assert(['baseline','candidate'].includes(values.source));assert(['A1','B1','B2','A2'].includes(values.case));assert(['desktop','phone'].includes(values.device));
assert.equal(values.sha,values[values.source]);
const attribution=values.condition!==undefined,gpuRequested=values.gpu||values.condition==='frame';
if(attribution){
  assert(['off','frame'].includes(values.condition));assert.equal(values.gpu,false,'Use --condition for the matched attribution experiment');
  assert.equal(values.source,'candidate');assert.equal(values.baseline,values.candidate,'Matched conditions require one identical source commit');
  assert.equal(values.condition,values.case.startsWith('A')?'off':'frame');
}else assert.equal(values.source,values.case.startsWith('A')?'baseline':'candidate');
if(values.trace){assert(attribution);assert.equal(values.condition,'off');assert.equal(values.case,'A2','Trace only the separate query-off follow-up');}
const game=resolve(values.game),bundle=resolve(values.build),dist=resolve(bundle,'dist'),output=resolve(values.output);
const strictHash='c7bf025a63918b885bcd7e1bcda55865423aba73c63f58a8287ff9a03af1a100';
const mobile=values.device==='phone',viewport=mobile?{width:390,height:844}:{width:1440,height:900},quality=mobile?'smooth':'high';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const emit=(name,value)=>console.log('BELLE_MANUAL_'+name+' '+JSON.stringify(value));
const contained=(root,path)=>path===root||path.startsWith(root+sep);
const started=Date.now();
await mkdir(output,{recursive:false}); // Refuse stale or overwritten case evidence.
const report={version:1,case:values.case,source:values.source,sourceHead:values.sha,baseline:values.baseline,candidate:values.candidate,
  measurementCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,runAttempt:process.env.GITHUB_RUN_ATTEMPT??null,
  scope:'FULL-scene manual observer diagnostic; not a strict release run',device:values.device,viewport,quality,mode:'full',profileQuery:'manual',requestedSeconds:90,gpuTimingRequested:gpuRequested,
  queryCondition:values.condition??null,pipelineObservationRequested:attribution,hostServiceTraceRequested:values.trace,
  diagnosticCaptureCompleted:false,diagnosticEvidenceValid:false,frameQualityAccepted:false,releasePerformanceVerified:false,firstPlayableMs:null,
  exitSemantics:'Zero means valid diagnostic evidence collection only. Original numerical budget outcomes are reported separately. The unchanged strict full lane remains the acceptance check.',
  requestedGraphics:{quality,cap:60,antiAliasing:'automatic',pixelRatio:1,diagnosticReduction:false},
  errors:[],failedRequests:[],probeErrors:[],integrityErrors:[],cleanupErrors:[],cleanupRequestAborts:[],phase:'created'};
let manifest,repoRoot,browser,page,server,cdp,marker,hostTrace,closingBrowser=false;
async function checkpoint(phase){report.phase=phase;await json(resolve(output,'report.json'),report);emit('PHASE',{case:values.case,phase,elapsedMs:Date.now()-started});}
async function fileNames(root,directory=root){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())result.push(...await fileNames(root,path));
    else if(entry.isFile())result.push(relative(root,path).split(sep).join('/'));
    else throw Error('Unexpected non-file build entry: '+path);
  }
  return result.sort();
}
async function verifyBuild(){
  const expected=manifest.files.map(file=>file.path).sort();
  assert(expected.length>0&&new Set(expected).size===expected.length,'Complete unique build manifest required');
  assert(!expected.includes('__belle_test_build.json'),'Diagnostic marker must not replace a compiled build file');
  assert.deepEqual((await fileNames(dist)).filter(name=>name!=='__belle_test_build.json'),expected,'Unexpected or missing original build file');
  for(const file of manifest.files){
    const path=resolve(dist,file.path);assert(contained(dist,path)&&path!==dist,'Unsafe build path');
    const bytes=await readFile(path);assert.equal(bytes.length,file.bytes,file.path+' bytes');assert.equal(sha256(bytes),file.sha256,file.path+' hash');
  }
  return {files:expected.length,manifestFilesSha256:sha256(JSON.stringify(manifest.files)),verifiedAt:new Date().toISOString()};
}
async function verifySources(){
  const result={};
  for(const [name,expected] of Object.entries(manifest.sources)){
    const path=resolve(game,name);assert(contained(repoRoot,path),'Unsafe source path');
    result[name]=sha256(await readFile(path));assert.equal(result[name],expected,name+' source hash');
  }
  assert.equal(result['scripts/sustained-ride-profile.mjs'],strictHash,'Original strict script changed');
  execFileSync('git',['-C',repoRoot,'diff','--exit-code','HEAD'],{stdio:'pipe'});
  return result;
}
const compactSubmission=value=>value?{invalidObservations:value.invalidObservations,
  largestObservedOperations:Object.entries(value.operations).filter(([,v])=>v.calls>0).sort((a,b)=>b[1].cpuMs-a[1].cpuMs).slice(0,5).map(([operation,v])=>({operation,...v})),topDirectDraws:value.topDirectDraws}:null;
// Preserve complete bounded census detail in the original JSON artifacts.
// Stdout contains only its count/coverage summary, so rows do not flood CI logs.
const compactSubmissionTotals=value=>{
  if(!value?.programCensus)return value;
  const {samples,...counts}=value.programCensus;
  return {...value,programCensus:{...counts,samplesRetained:Array.isArray(samples)?samples.length:null,
    detail:'Complete bounded sample rows remain in manual-profile.json and report.json.'}};
};
const compactLoop=value=>value?{captureEpoch:value.captureEpoch,callbackId:value.callbackId,outcome:value.outcome,acceptedSample:value.acceptedSample,
  associationEligible:value.associationEligible,place:value.place,x:value.x,z:value.z,draws:value.draws,triangles:value.triangles,renderMs:value.renderMs,
  wallGapSincePreviousObservedCallbackMs:value.wallGapSincePreviousObservedCallbackMs,invalidObservations:value.invalidObservations,scopes:value.scopes}:null;
function observerSummary(profile){
  if(!profile)return null;
  const pacing=profile.gpuFramePacing,first=pacing?.atStart,last=pacing?.atFinish,loop=profile.loopDiagnostics;
  const cumulative=['animationCallbacks','executedCallbacks','submittedCallbacks','xrCallbacks','pendingFenceSkippedCallbacks','contextLostSkippedCallbacks','pendingFenceResumptions','pendingFenceObservedSpanMs'];
  return {
    gpuFramePacing:{atStart:first,atFinish:last,cumulativeDelta:Object.fromEntries(cumulative.map(key=>[key,Number.isFinite(first?.[key])&&Number.isFinite(last?.[key])?last[key]-first[key]:null])),
      note:'Only cumulative counters and sums are subtracted. Pending spans are wall observations, not GPU time. Lifetime maxima/current spans are not deltas.'},
    loopTotals:loop?{status:loop.status,coverage:loop.coverage,captureEpoch:loop.captureEpoch,completedCallbacks:loop.completedCallbacks,acceptedSamples:loop.acceptedSamples,
      acceptedSamplesWithoutObservedCallback:loop.acceptedSamplesWithoutObservedCallback,invalidObservations:loop.invalidObservations,allCallbacks:loop.allCallbacks,
      acceptedCallbacks:loop.acceptedCallbacks,inFlightAtSnapshot:loop.inFlightAtSnapshot,note:loop.note}:null,
    submissionTotals:profile.submissionDiagnostics??null,submissionCoverage:profile.submissionInstrumentation??null,
    topLoopCallbacks:loop?.topCallbacks?.slice(0,3).map(compactLoop)??[],
    loopSlowIntervals:loop?.slowIntervals?.slice(0,3).map(row=>({...row,previousEligibleCallback:compactLoop(row.previousEligibleCallback)}))??[],
    currentAndPreviousRenderWork:profile.slowFrames?.slice(0,3).map(row=>({frameMs:row.frameMs,place:row.place,x:row.x,z:row.z,currentRenderMs:row.renderMs,
      currentSubmission:compactSubmission(row.submission),previousEligibleCallback:row.previousEligibleCallback?{sample:row.previousEligibleCallback.sample,
      place:row.previousEligibleCallback.place,x:row.previousEligibleCallback.x,z:row.previousEligibleCallback.z,renderMs:row.previousEligibleCallback.renderMs,
      submission:compactSubmission(row.previousEligibleCallback.submission)}:null}))??[],
    natureTotals:profile.renderDiagnostics?{profiledCallbacks:profile.renderDiagnostics.profiledCallbacks,invalidDiagnosticSamples:profile.renderDiagnostics.invalidDiagnosticSamples,
      totals:profile.renderDiagnostics.totals,maxima:profile.renderDiagnostics.maxima,callbacksWithSelectionRefresh:profile.renderDiagnostics.callbacksWithSelectionRefresh,
      callbacksWithoutSelectionRefresh:profile.renderDiagnostics.callbacksWithoutSelectionRefresh,note:profile.renderDiagnostics.note}:null,
    note:'Built-in associations are retained, never inferred from equal frame durations. Top lists here are bounded previews; raw UI JSON is retained. Nested CPU timings overlap and include observer overhead. Missing/partial hooks are not zero-cost evidence.'
  };
}
try{
  assert.equal(process.platform,'darwin','This diagnostic requires the existing hosted macOS Metal backend');
  repoRoot=execFileSync('git',['-C',game,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),values.sha);
  const manifestBytes=await readFile(resolve(bundle,'manual-diagnostic-build.json'));manifest=JSON.parse(manifestBytes);
  assert.equal(manifest.commit,values.sha);assert.equal(manifest.label,values.source);assert.equal(manifest.repository,'robjasper2084/Jungle-Lotto');
  assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),manifest.tree);
  assert.equal(manifest.workflowCommit,report.measurementCommit,'Build and driver workflow revisions must match');
  report.sourceTree=manifest.tree;report.buildManifestSha256=sha256(manifestBytes);report.sourceHashesBefore=await verifySources();report.buildIntegrityBefore=await verifyBuild();
  await writeFile(resolve(output,'build.json'),manifestBytes);await writeFile(resolve(output,'diagnostic-driver.mjs'),await readFile(fileURLToPath(import.meta.url)));
  const index=manifest.files.find(file=>file.path==='index.html');assert(index);
  marker={version:1,repository:manifest.repository,commit:values.sha,buildId:manifest.buildId,builtAt:manifest.builtAt,indexSha256:index.sha256,profileQuery:'manual'};
  const markerPath=resolve(dist,'__belle_test_build.json');
  try{assert.deepEqual(JSON.parse(await readFile(markerPath,'utf8')),marker,'Existing diagnostic marker differs');}
  catch(error){if(error.code!=='ENOENT')throw error;await json(markerPath,marker);}
  await json(resolve(output,'build-marker.json'),marker);
  const require=createRequire(resolve(game,'../../package.json'));
  const {chromium,expect:rawExpect}=require('@playwright/test'),expect=rawExpect.configure({timeout:180000});
  report.runtime={node:process.version,platform:process.platform,architecture:process.arch,playwright:require('@playwright/test/package.json').version};
  const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
  server=createCoopStaticServer(dist);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  report.url='http://127.0.0.1:'+server.address().port+'/?profile=manual'+(attribution?'&pipelineProbe=1':'')+(gpuRequested?'&gpuProbe='+(attribution?'frame':'1'):'');
  report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
  emit('IDENTITY',{case:values.case,source:values.source,sourceHead:values.sha,sourceTree:manifest.tree,baseline:values.baseline,candidate:values.candidate,
    measurementCommit:report.measurementCommit,buildId:manifest.buildId,buildManifestSha256:report.buildManifestSha256,sourceHashes:report.sourceHashesBefore,
    runtime:report.runtime,launch:report.launch,viewport,quality,mode:'full',profileQuery:'manual',requestedSeconds:90,
    queryCondition:report.queryCondition,pipelineObservationRequested:attribution,hostServiceTraceRequested:values.trace});
  await checkpoint('verified-immutable-inputs');
  browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
  page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});page.setDefaultTimeout(180000);await page.bringToFront();
  // Event receipt listeners observe genuine browser input. The source-owned
  // optional pipeline probe observes existing calls without issuing GL work.
  await page.addInitScript(quality=>{
    localStorage.setItem('belle-graphics-v1',JSON.stringify({quality,cap:60,antiAliasing:'automatic'}));
    const receipts={keydowns:0,keyups:0,repeats:0,blurs:0,firstWDownAt:null,lastWUpAt:null,clicks:[]};window.__belleManualInputReceipts=receipts;
    window.addEventListener('keydown',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keydowns++;if(event.repeat)receipts.repeats++;receipts.firstWDownAt??=performance.now();}},true);
    window.addEventListener('keyup',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keyups++;receipts.lastWUpAt=performance.now();}},true);
    window.addEventListener('blur',()=>receipts.blurs++,true);
    document.addEventListener('click',event=>{const node=event.target instanceof Element?event.target.closest('button,summary,label,input'):null;
      if(node&&receipts.clicks.length<40)receipts.clicks.push({at:performance.now(),trusted:event.isTrusted,id:node.id,tag:node.tagName,text:(node.textContent??'').replace(/\s+/g,' ').trim().slice(0,120)});},true);
  },quality);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
  page.on('requestfailed',request=>{
    const error=request.failure()?.errorText??'failed',receipt=error+' '+request.url();
    if(closingBrowser&&/ERR_ABORTED|cancelled|canceled/i.test(error))report.cleanupRequestAborts.push(receipt);
    report.failedRequests.push(receipt);
  });
  const navigation=Date.now();await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});report.welcomeReadyMs=Date.now()-navigation;
  report.actualGpu=await page.locator('#game').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Game WebGL2 unavailable');const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),
      version:String(gl.getParameter(gl.VERSION)),canvas:{width:canvas.width,height:canvas.height},contextAttributes:gl.getContextAttributes(),
      drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},
      sampleObservation:{defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),note:'Samples describe the existing bound draw framebuffer. No framebuffer is rebound for this observation.'},
      timerQuery:{name:'EXT_disjoint_timer_query_webgl2',available:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),queriesIssued:0,note:'Availability only; no query objects, per-draw measurements or GPU duration claims.'}};
  });
  assert(/Metal/i.test(report.actualGpu.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.actualGpu.renderer),'Actual Metal renderer required');
  assert.deepEqual(report.actualGpu.canvas,viewport,'Actual initial canvas must match the full device viewport');
  await page.locator('.cinema-ride-picker > summary').click();
  await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);report.rideStartedMs=Date.now()-navigation;
  async function settings(){if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();}
  await settings();await expect(page.locator('#quality')).toHaveValue(quality);await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
  const panel=page.locator('#ride-profile');await expect(panel).toBeAttached();await panel.locator('summary').click();await checkpoint('ready-for-native-manual-capture');
  if(values.trace){hostTrace=await prepareHostServiceTrace(browser,page,values.case);report.hostServiceTrace=hostTrace.metadata;}
  else if(attribution){
    const identity=await browser.newBrowserCDPSession();
    try{report.browserIdentity={version:await identity.send('Browser.getVersion'),system:await identity.send('SystemInfo.getInfo')};}
    finally{await identity.detach();}
  }
  await panel.getByRole('button',{name:'Start 10-minute capture',exact:true}).click();await page.locator('[data-close="settings"]').click();await page.locator('#game').focus();
  let initial=null;try{cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');initial=(await cdp.send('Performance.getMetrics')).metrics;}catch(error){report.probeErrors.push('CDP start: '+String(error));}
  const heldStart=Date.now();let reassertions=0,inFlight=false,heartbeatError=null,pendingHeartbeat=Promise.resolve();
  await page.keyboard.down('w');
  let traceStartTimer,traceStartPromise=Promise.resolve();
  if(hostTrace)traceStartTimer=setTimeout(()=>{
    report.traceStartRequestedAfterHeldMs=Date.now()-heldStart;
    traceStartPromise=hostTrace.start().then(()=>{report.traceStartedAfterHeldMs=Date.now()-heldStart;},error=>{report.probeErrors.push('Host trace start: '+String(error));});
  },Math.max(0,60000-(Date.now()-heldStart)));
  const heartbeat=setInterval(()=>{if(inFlight)return;inFlight=true;pendingHeartbeat=page.keyboard.down('w').then(()=>reassertions++,error=>{heartbeatError=String(error);}).finally(()=>{inFlight=false;});},450);
  let released;
  try{await page.waitForTimeout(90000);}finally{clearTimeout(traceStartTimer);clearInterval(heartbeat);await pendingHeartbeat;await page.keyboard.up('w');released=Date.now();await traceStartPromise;}
  report.heldInputWallMs=released-heldStart;
  try{if(cdp&&initial){const result=(await cdp.send('Performance.getMetrics')).metrics,before=Object.fromEntries(initial.map(x=>[x.name,x.value])),after=Object.fromEntries(result.map(x=>[x.name,x.value]));
    report.cdpAtKeyup={wallSeconds:(Date.now()-heldStart)/1000,durationsSeconds:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','V8CompileDuration']
      .filter(key=>Number.isFinite(before[key])&&Number.isFinite(after[key])).map(key=>[key,Math.max(0,after[key]-before[key])])),endJsHeapUsedBytes:after.JSHeapUsedSize??null,
      note:'Held-input main-thread/JS-heap boundary before manual Stop UI; not GPU time, total RAM, VRAM or peak memory.'};}}catch(error){report.probeErrors.push('CDP end: '+String(error));}
  await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
  await panel.getByRole('button',{name:'Stop and show report',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
  report.releaseToManualStopWallMs=Date.now()-released;
  const raw=await panel.locator('textarea').inputValue();report.profile=JSON.parse(raw);await writeFile(resolve(output,'manual-profile.json'),raw+'\n');
  if(hostTrace){
    try{
      report.hostServiceTrace=await hostTrace.stop(output);await json(resolve(output,'host-service-trace-summary.json'),report.hostServiceTrace);
      assert.equal(report.hostServiceTrace.status,'complete','The separate host trace must retain its start and end markers without buffer loss');
    }catch(error){report.probeErrors.push('Host trace finish: '+String(error));}
  }
  if(gpuRequested){
    report.gpuTiming=await page.evaluate(()=>window.__belleGpuDiagnostics?.()??null);
    await json(resolve(output,'gpu-timing.json'),report.gpuTiming);
    assert(report.gpuTiming,'The explicitly requested native GPU probe must be available');
    assert.equal(report.gpuTiming.supported,true,'Native timer-query support is required for GPU attribution');
    assert.equal(report.gpuTiming.status,'stopped','GPU capture must follow the real manual Stop');
    assert(report.gpuTiming.counts?.issued>0&&report.gpuTiming.counts?.resolved>0,'Actual asynchronously resolved native queries are required');
    assert.equal(report.gpuTiming.activeQuery,false,'No query may remain open after the capture');
    assert.deepEqual(report.gpuTiming.errors,[],'Native GPU probe errors must remain visible and fail collection');
    assert(report.gpuTiming.hooks?.every(hook=>hook.status==='installed'),'Complete requested GPU hook coverage is required');
    if(attribution){assert.equal(report.gpuTiming.mode,'frame');assert.equal(report.gpuTiming.sampleEveryEligibleCallbacks,32);assert.deepEqual(report.gpuTiming.hooks,[],'Sparse frame mode must not hook individual rendering passes');}
  }
  if(attribution){
    report.pipeline=await page.evaluate(()=>window.__bellePipelineDiagnostics?.()??null);
    await json(resolve(output,'pipeline-timing.json'),report.pipeline);
    assert(report.pipeline,'Requested original-callback/fence observation must be available');
    assert.equal(report.pipeline.status,'stopped');assert.equal(report.pipeline.coverage?.complete,true);
    assert.deepEqual(report.pipeline.errors,[]);assert.equal(report.pipeline.observerErrors,0);
    assert(report.pipeline.callbacks?.length>0,'Original callback timestamps must be retained');
    if(!gpuRequested)assert.equal(await page.evaluate(()=>typeof window.__belleGpuDiagnostics),'undefined','Query-off control must not install the GPU timer probe');
  }
  report.input={...(await page.evaluate(()=>window.__belleManualInputReceipts)),reassertions,heartbeatError};
  if(hostTrace){
    const markers=report.hostServiceTrace.clockMarkers??[],start=markers.find(mark=>mark.name.endsWith('-trace-start')),end=markers.find(mark=>mark.name.endsWith('-trace-end'));
    report.hostServiceTrace.trustedInputAlignment={requestedStartDelayMs:60000,
      actualStartAfterFirstWDownMs:start&&Number.isFinite(report.input.firstWDownAt)?start.startTimeMs-report.input.firstWDownAt:null,
      actualEndAfterLastWUpMs:end&&Number.isFinite(report.input.lastWUpAt)?end.startTimeMs-report.input.lastWUpAt:null,
      actualMarkerWindowMs:start&&end?end.startTimeMs-start.startTimeMs:null,
      note:'Measured page clock markers relative to genuine trusted input receipts. The host timer requests a late start; neither receipt nor frame timestamp is adjusted.'};
    await json(resolve(output,'host-service-trace-summary.json'),report.hostServiceTrace);
  }
  report.captureBoundary='Native manual Start precedes W-down; native Stop follows genuine W-up. The measured release-to-Stop delay is retained. This is not the strict CLI trusted-W-keyup boundary. Observer CPU overhead is included.';
  const stats=report.profile;
  report.frameQualityAccepted=Number.isFinite(stats.metrics?.frameMs?.p95)&&stats.metrics.frameMs.p95<=50&&stats.over250ms===0;
  report.originalNumericObservations={framesAtLeast8:stats.frames>=8,p95Present:Number.isFinite(stats.metrics?.frameMs?.p95),movingSecondsAtLeast5:stats.movingSeconds>=5,
    distanceAtLeast3m:stats.distanceMetres>=3,p95AtMost50ms:Number.isFinite(stats.metrics?.frameMs?.p95)&&stats.metrics.frameMs.p95<=50,noFramesOver250ms:stats.over250ms===0};
  assert.equal(stats.stopReason,'manual');
  for(const text of ['Start 10-minute capture','Stop and show report','Use this ride'])assert(report.input.clicks.some(click=>click.trusted&&click.text===text),'Missing trusted '+text+' click');
  assert(report.input.clicks.some(click=>click.trusted&&click.id==='start'),'Missing trusted Start click');
  assert(report.input.keydowns>=1&&report.input.keyups>=1&&!heartbeatError,'Genuine riding input and release required');
  assert(stats.frames>=8&&Number.isFinite(stats.metrics?.frameMs?.p95)&&stats.movingSeconds>=5&&stats.distanceMetres>=3,'Actual sampled riding and movement required for diagnostic evidence');
  for(const snapshot of [stats.settingsAtStart,stats.settings]){
    assert.equal(snapshot.quality,quality);assert.equal(snapshot.effectiveQuality,quality);assert.equal(snapshot.cap,60);assert.equal(snapshot.pixelRatio,1);assert.equal(snapshot.adaptiveScale,1);
    assert.equal(snapshot.diagnosticReduction,false);assert.equal(snapshot.vehicle,'onewheel');
  }
  assert.deepEqual(stats.viewport,[viewport.width,viewport.height,1]);
  report.effectiveGraphicsAtFinish=await page.locator('#game').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Final game WebGL2 unavailable');
    return {canvas:{width:canvas.width,height:canvas.height},contextAttributes:gl.getContextAttributes(),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},
      sampleObservation:{defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS)}};
  });
  assert.deepEqual(report.effectiveGraphicsAtFinish.canvas,viewport,'Actual final canvas must match the full device viewport');
  for(const proof of [stats.buildAtStart,stats.build]){assert.equal(proof.status,'available');assert.equal(proof.marker.commit,values.sha);assert.equal(proof.marker.indexSha256,marker.indexSha256);}
  report.observerCoverage={loop:stats.loopDiagnostics?.coverage??null,submission:stats.submissionInstrumentation??null,
    note:'Coverage is retained verbatim. Partial/unavailable hooks are not zero-cost measurements.'};
  assert.equal(stats.loopDiagnostics?.status,'available');assert.equal(stats.loopDiagnostics?.coverage?.atStart?.installed,true);assert.equal(stats.loopDiagnostics?.coverage?.atFinish?.installed,true);
  assert(stats.loopDiagnostics.completedCallbacks>0,'No completed loop observations');
  assert(stats.submissionDiagnostics?.profiledCallbacks>0,'No native submission observations');
  report.memoryAfterExtraction=await page.evaluate(()=>({jsHeap:performance.memory?{usedBytes:performance.memory.usedJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit}:null,
    userAgent:navigator.userAgent,note:'Later post-extraction JS heap; separate from capture-end CDP heap and not device RAM/VRAM.'}));
  await page.locator('[data-close="settings"]').click();await page.screenshot({path:resolve(output,'riding-end.png'),timeout:180000});report.diagnosticCaptureCompleted=true;
}catch(error){
  report.errors.push(String(error?.stack??error));
  if(page&&!page.isClosed()){
    report.startupAtFailure=await page.evaluate(()=>({visible:document.visibilityState,focused:document.hasFocus(),loading:document.querySelector('#loading')?.textContent,
      welcomeState:document.querySelector('#welcome')?.dataset.state,telemetry:window.__belleStartupProfile?.(),input:window.__belleManualInputReceipts})).catch(()=>null);
    await page.screenshot({path:resolve(output,'failure.png'),timeout:10000}).catch(error=>report.probeErrors.push('Failure screenshot: '+String(error)));
  }
}
finally{
  await checkpoint('closing-browser-and-verifying-final-integrity');
  if(hostTrace&&['recording','prepared'].includes(report.hostServiceTrace?.status)){
    try{report.hostServiceTrace=await hostTrace.stop(output);await json(resolve(output,'host-service-trace-summary.json'),report.hostServiceTrace);}
    catch(error){report.probeErrors.push('Host trace cleanup: '+String(error));}
  }
  try{await cdp?.detach();}catch(error){report.probeErrors.push('CDP cleanup: '+String(error));}
  closingBrowser=true;
  try{await browser?.close();}catch(error){report.cleanupErrors.push('Browser cleanup: '+String(error));}
  if(server)try{await new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));}catch(error){report.cleanupErrors.push('Server cleanup: '+String(error));}
  // The browser is shut down before final serialization. Every late error or
  // failed request remains fatal, including classified shutdown aborts.
  await new Promise(ok=>setImmediate(ok));
  if(manifest&&repoRoot)try{report.sourceHashesAfter=await verifySources();report.buildIntegrityAfter=await verifyBuild();assert.deepEqual(JSON.parse(await readFile(resolve(dist,'__belle_test_build.json'),'utf8')),marker);}catch(error){report.integrityErrors.push(String(error?.stack??error));}
  report.observers=null;
  try{report.observers=observerSummary(report.profile);}catch(error){report.errors.push('Observer summary: '+String(error?.stack??error));}
  report.elapsedWallMs=Date.now()-started;report.phase='finished';
  report.diagnosticEvidenceValid=report.diagnosticCaptureCompleted&&!report.errors.length&&!report.failedRequests.length&&!report.probeErrors.length&&!report.integrityErrors.length&&!report.cleanupErrors.length;
  await json(resolve(output,'report.json'),report);await json(resolve(output,'observer-summary.json'),report.observers);
  emit('RESULT',{case:values.case,source:values.source,sourceHead:values.sha,sourceTree:report.sourceTree,diagnosticCaptureCompleted:report.diagnosticCaptureCompleted,
    diagnosticEvidenceValid:report.diagnosticEvidenceValid,frameQualityAccepted:report.frameQualityAccepted,releasePerformanceVerified:false,exitSemantics:report.exitSemantics,
    actualGpu:report.actualGpu,browserVersion:report.browserVersion,viewport,quality,requestedGraphics:report.requestedGraphics,effectiveGraphicsAtFinish:report.effectiveGraphicsAtFinish,
    queryCondition:report.queryCondition,pipelineObservationRequested:attribution,hostServiceTraceRequested:values.trace,
    settingsAtStart:report.profile?.settingsAtStart&&Object.fromEntries(['quality','effectiveQuality','cap','pixelRatio','adaptiveScale','diagnosticReduction','vehicle'].map(key=>[key,report.profile.settingsAtStart[key]])),
    settingsAtFinish:report.profile?.settings&&Object.fromEntries(['quality','effectiveQuality','cap','pixelRatio','adaptiveScale','diagnosticReduction','vehicle'].map(key=>[key,report.profile.settings[key]])),
    heldInputWallMs:report.heldInputWallMs,releaseToManualStopWallMs:report.releaseToManualStopWallMs,stopReason:report.profile?.stopReason,frames:report.profile?.frames,
    movingSeconds:report.profile?.movingSeconds,distanceMetres:report.profile?.distanceMetres,frameMs:report.profile?.metrics?.frameMs,over250ms:report.profile?.over250ms,
    input:report.input,originalNumericObservations:report.originalNumericObservations,welcomeReadyMs:report.welcomeReadyMs,rideStartedMs:report.rideStartedMs,
    errors:report.errors,failedRequests:report.failedRequests,probeErrors:report.probeErrors,integrityErrors:report.integrityErrors,cleanupErrors:report.cleanupErrors,
    cleanupRequestAborts:report.cleanupRequestAborts,captureBoundary:report.captureBoundary});
  emit('FENCE',report.observers?.gpuFramePacing??null);emit('LOOP_TOTALS',report.observers?.loopTotals??null);
  emit('SUBMISSION_TOTALS',{totals:compactSubmissionTotals(report.observers?.submissionTotals),coverage:report.observers?.submissionCoverage});
  emit('LOOP_ASSOCIATIONS',{topCallbacks:report.observers?.topLoopCallbacks,slowIntervals:report.observers?.loopSlowIntervals});
  emit('RENDER_ASSOCIATIONS',report.observers?.currentAndPreviousRenderWork??null);emit('NATURE_TOTALS',report.observers?.natureTotals??null);
  emit('CDP_AND_MEMORY',{cdpAtKeyup:report.cdpAtKeyup,memoryAfterExtraction:report.memoryAfterExtraction});
  if(values.gpu)emit('GPU_TIMING',report.gpuTiming??null);
  const hashes=[];for(const path of await fileNames(output)){const bytes=await readFile(resolve(output,path));hashes.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
  await json(resolve(output,'evidence-hashes.json'),hashes);emit('HASHES',hashes);
}
if(!report.diagnosticEvidenceValid)process.exitCode=1;
