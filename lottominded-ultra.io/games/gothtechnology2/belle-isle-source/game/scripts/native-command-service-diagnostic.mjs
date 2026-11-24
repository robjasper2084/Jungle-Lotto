/** Isolated native command-service observation. No runtime changes or release claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,open,readFile,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,relative,resolve,sep} from 'node:path';
import {performance as monotonicClock} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

export const PRODUCT_PARENT='9e02a7f8015a8d4b3e8ceee28eed13aa6c140688';
export const STRICT_SHA256='8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5';
export const TRACE_DELAY_MS=60000,TRACE_REQUESTED_MS=1500,RIDE_REQUESTED_MS=90000;
const includedCategories=['toplevel','renderer.scheduler','cc','viz','gpu','rail','blink.user_timing',
  'disabled-by-default-gpu.decoder','disabled-by-default-gpu.service'];
const excludedCategories=['disabled-by-default-gpu.device','disabled-by-default-viz.gpu_composite_time',
  'disabled-by-default-devtools.screenshot','disabled-by-default-devtools.timeline.screenshot','disabled-by-default-devtools.video_screenshot'];
const categoryNames=value=>String(value??'').split(',').map(name=>name.trim()).filter(Boolean);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const errorText=error=>String(error?.stack??error);
async function deadline(promise,label,milliseconds=15000){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export function selectCommandCategories(available){
  assert(Array.isArray(available)&&available.every(group=>typeof group==='string'),'Trace discovery must return string category groups');
  const normalized=[...new Set(available.flatMap(categoryNames))].sort();
  return {discoveredGroups:available,normalized,included:[...includedCategories],excluded:[...excludedCategories],
    missingFromDiscovery:includedCategories.filter(name=>!normalized.includes(name)),
    note:'Discovery is advisory. Only exported events establish coverage; missing lazy categories are not silently removed.'};
}
function asyncKey(event){
  const identity=event.id2?.global!==undefined?['global',event.id2.global]:event.id2?.local!==undefined?['local',event.id2.local]:event.id!==undefined?['id',event.id]:null;
  return identity?JSON.stringify([event.pid,event.cat??'',event.scope??'',...identity]):null;
}
/** Pair by native track identity/order, never by matching duration or nearby draw. */
export function summarizeCommandTrace(trace,markers,input){
  assert(Array.isArray(trace?.traceEvents)&&trace.traceEvents.length<=1000000,'Trace JSON is missing events or exceeds the event bound');
  assert(Array.isArray(markers)&&markers.length===2,'Exactly two page clock receipts required');
  const matches=markers.map(marker=>({marker,events:[]})),processes={},threads={},categories={},issues=[];
  const complete=[],stacks=new Map(),asyncBegins=new Map();let forbiddenEvents=0,serviceEvents=0,unmatchedEnds=0;
  const issue=message=>{if(issues.length<50)issues.push(message);};
  const add=(begin,end,duration)=>{
    if(!finite(begin.ts)||!finite(duration)||duration<0){issue('Invalid service duration');return;}
    if(begin.args?.channel!=='TraceCmd'||!categoryNames(begin.args?.gl_category).includes('disabled-by-default-gpu.decoder'))return;
    if(typeof begin.name!=='string'||!begin.name.length){issue('Unnamed TraceCmd interval');return;}
    complete.push({name:begin.name,pid:begin.pid,tid:begin.tid,startUs:begin.ts,endUs:begin.ts+duration,wallMs:duration/1000,
      phase:begin.ph,trackIdentity:asyncKey(begin),endPhase:end?.ph??null,
      // Custom-track service spans are wall intervals. No CPU/GPU conversion is made.
      threadDurationMs:finite(begin.tdur)?begin.tdur/1000:null});
  };
  for(const event of trace.traceEvents){
    if(!event||typeof event!=='object'){issue('Malformed trace event');continue;}
    const cats=categoryNames(event.cat);categories[event.cat??'']=(categories[event.cat??'']??0)+1;
    if(event.ph==='M'){
      if(event.name==='process_name')processes[event.pid]=event.args?.name??null;
      if(event.name==='thread_name')threads[event.pid+':'+event.tid]=event.args?.name??null;
      continue;
    }
    if(cats.some(name=>excludedCategories.includes(name)))forbiddenEvents++;
    if(cats.includes('blink.user_timing'))for(const match of matches){
      if(event.name===match.marker.name||event.args?.markName===match.marker.name||event.args?.data?.markName===match.marker.name)
        match.events.push({ts:event.ts,pid:event.pid,tid:event.tid,phase:event.ph,name:event.name});
    }
    if(!cats.includes('disabled-by-default-gpu.service'))continue;
    serviceEvents++;
    if(event.ph==='X')add(event,null,event.dur);
    else if(event.ph==='B'){
      const key=event.pid+':'+event.tid,stack=stacks.get(key)??[];stack.push(event);stacks.set(key,stack);
    }else if(event.ph==='E'){
      const begin=stacks.get(event.pid+':'+event.tid)?.pop();
      if(begin)add(begin,event,event.ts-begin.ts);else unmatchedEnds++;
    }else if(event.ph==='b'||event.ph==='S'){
      const key=asyncKey(event);
      if(key===null)issue('Async service begin without native identity');
      else if(asyncBegins.has(key))issue('Duplicate live async service identity');
      else asyncBegins.set(key,event);
    }else if(event.ph==='e'||event.ph==='F'){
      const key=asyncKey(event),begin=key===null?null:asyncBegins.get(key);
      if(begin){asyncBegins.delete(key);add(begin,event,event.ts-begin.ts);}else unmatchedEnds++;
    }
    if(complete.length+asyncBegins.size>200000)throw Error('Named command retention bound exceeded');
  }
  const alignment=matches.map(({marker,events})=>{
    const usable=events.filter(event=>finite(event.ts)),unique=new Set(usable.map(event=>event.ts));
    if(unique.size!==1)issue('Missing or ambiguous exact page clock marker: '+marker.name);
    const event=usable[0];return {...marker,traceMatches:events,offsetMs:event?event.ts/1000-marker.startTimeMs:null};
  });
  const [start,end]=alignment,offsetDriftMs=finite(start.offsetMs)&&finite(end.offsetMs)?end.offsetMs-start.offsetMs:null;
  const alignmentValid=finite(offsetDriftMs)&&Math.abs(offsetDriftMs)<=1&&finite(start.timeOriginMs)&&start.timeOriginMs===end.timeOriginMs&&end.startTimeMs>start.startTimeMs;
  const markerWindowMs=end.startTimeMs-start.startTimeMs;
  const inputOverlapValid=alignmentValid&&finite(input?.firstWDownAt)&&finite(input?.lastWUpAt)&&
    start.startTimeMs>=input.firstWDownAt+59000&&end.startTimeMs<=input.lastWUpAt&&input.lastWUpAt>input.firstWDownAt;
  const boundedWindow=finite(markerWindowMs)&&markerWindowMs>=1000&&markerWindowMs<=2000;
  const low=alignmentValid?start.traceMatches.find(event=>finite(event.ts)).ts:Infinity;
  const high=alignmentValid?end.traceMatches.find(event=>finite(event.ts)).ts:-Infinity;
  const rows=complete.filter(row=>row.startUs>=low&&row.endUs<=high),byName={},largest=[];
  let drawCommandCount=0,uploadCommandCount=0,totalNamedWallMs=0,withThreadDuration=0;
  for(const row of rows){
    const item=byName[row.name]??={count:0,wallMs:0,maxWallMs:0,recordedThreadMs:0,threadDurationCount:0};
    item.count++;item.wallMs+=row.wallMs;item.maxWallMs=Math.max(item.maxWallMs,row.wallMs);totalNamedWallMs+=row.wallMs;
    if(finite(row.threadDurationMs)){item.recordedThreadMs+=row.threadDurationMs;item.threadDurationCount++;withThreadDuration++;}
    if(/^(?:Draw(?:Arrays|Elements|RangeElements)|MultiDraw(?:Arrays|Elements))/.test(row.name))drawCommandCount++;
    if(/^(?:Tex(?:Sub)?Image|CompressedTex|Buffer(?:Sub)?Data|Copy(?:Sub)?Texture)/.test(row.name))uploadCommandCount++;
    if(largest.length<50||row.wallMs>largest.at(-1).wallMs){largest.push(row);largest.sort((a,b)=>b.wallMs-a.wallMs);if(largest.length>50)largest.pop();}
  }
  if(Object.keys(byName).length>500)issue('Unexpectedly many command names');
  const unmatchedBegins=[...asyncBegins.values(),...[...stacks.values()].flat()].length;
  const namedCoverageValid=rows.length>=10&&drawCommandCount>0&&serviceEvents>0&&forbiddenEvents===0&&issues.length===0;
  return {eventCount:trace.traceEvents.length,categories,processes,threads,alignment,alignmentValid,offsetDriftMs,
    markerWindowMs,boundedWindow,inputOverlapValid,inputAlignment:{startAfterWDownMs:start.startTimeMs-input?.firstWDownAt,endBeforeWUpMs:input?.lastWUpAt-end.startTimeMs},
    serviceEvents,completeNamedIntervals:complete.length,namedIntervalsInsideMarks:rows.length,excludedBoundaryIntervals:complete.length-rows.length,
    unmatchedBegins,unmatchedEnds,forbiddenEvents,namedCoverageValid,issues,drawCommandCount,uploadCommandCount,
    totalNamedWallMs,withThreadDuration,byName,largestNamedIntervals:largest,
    valid:alignmentValid&&boundedWindow&&inputOverlapValid&&namedCoverageValid,
    note:'Only complete native TraceCmd service intervals wholly inside both marks are aggregated. Pairing uses exported native track identity/order. These are all observed TraceCmd scopes, not game-only attribution: source contexts are not proven from these records. Counts are decoder commands, not JS calls or rendered frames. Custom-track durations are host wall time; they can include blocking/preemption and never establish GPU execution time. Boundary-incomplete intervals remain counted as unknown, not zero. Command intervals may overlap across contexts/tracks; the sum is not elapsed-time occupancy. No object identity is inferred from duration.',
    coverageLimit:'Upstream passthrough default trace level 2 covers draw/multidraw, uploads, framebuffer and synchronization commands; ordinary uniforms and UseProgram default to level 3 and may be absent. TraceCmd begins before DebugImpl texture-map validation, so named durations include that observer work as well as the handler. This is not baseline or all-command attribution. Exact deployed implementation is identified by runtime receipts, not inferred from upstream main.',
  };
}
async function pageMarker(page,name){
  return deadline(page.evaluate(name=>{const mark=performance.mark(name);return {name,startTimeMs:mark.startTime,timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallMs:Date.now()};},name),'Page trace clock marker');
}
async function drainStream(session,handle,path,metadata){
  let file;const started=monotonicClock.now();
  const receipt=metadata.export={complete:false,bytes:0,reads:0,maxBytes:256*1024*1024,maxWallMs:60000};
  try{
    file=await open(path,'wx');
    for(;;){
      const remainingMs=receipt.maxWallMs-(monotonicClock.now()-started);
      assert(receipt.reads<4096&&remainingMs>0,'Trace export exceeded unchanged read/time bounds');
      const chunk=await deadline(session.send('IO.read',{handle,size:1048576}),'Trace stream read budget',Math.min(15000,remainingMs));receipt.reads++;
      const data=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');
      assert(receipt.bytes+data.length<=receipt.maxBytes,'Trace export exceeds compressed byte bound');
      await file.writeFile(data);receipt.bytes+=data.length;
      assert(monotonicClock.now()-started<receipt.maxWallMs,'Trace export exceeded unchanged wall-time bound');
      if(chunk.eof)break;assert(data.length>0,'Empty nonterminal trace chunk');
    }
    receipt.complete=true;return receipt;
  }catch(error){receipt.error=errorText(error);throw error;}
  finally{
    receipt.elapsedMs=monotonicClock.now()-started;
    try{await file?.close();}catch(error){metadata.cleanupErrors.push('Trace file close: '+errorText(error));}
    try{await session.send('IO.close',{handle});}catch(error){metadata.cleanupErrors.push('Trace stream close: '+errorText(error));}
  }
}
export async function prepareCommandServiceTrace(browser,page,output){
  const native=await deadline(browser.newBrowserCDPSession(),'Browser CDP session');
  const session={send:(method,params)=>deadline(native.send(method,params),method),detach:()=>deadline(native.detach(),'CDP detach',5000)};
  const metadata={version:1,status:'preparing',requestedDelayMs:TRACE_DELAY_MS,requestedDurationMs:TRACE_REQUESTED_MS,
    clockMarkers:[],requests:[],bufferUsage:{samples:0,maxPercentFull:0,maxEventCount:0},cleanupErrors:[],
    scope:'Short CPU command-service diagnostic with original product rendering. No device timers and no release-performance claim.',
    overhead:'Enabling decoder/service tracing selects Chromium DebugImpl and allocates per-command trace records. TraceCmd begins before VerifyServiceTextureObjectsExist, so the named duration includes texture-map iteration/checking, not just command-handler work. DCHECK builds may issue texture validation calls. Timers/disjoint polling are device-only upstream, but service tracing and context bookkeeping still perturb execution. Level-2 coverage omits ordinary uniform/program setters. The earlier broad A2 trace excluded decoder and service categories and did not take this named-command path. This is observational evidence, not a baseline performance result.',
    upstreamSources:[
      'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/service/gles2_cmd_decoder_passthrough.cc',
      'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/service/gpu_tracer.cc',
      'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/build_gles2_cmd_buffer.py',
      'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/build_cmd_buffer_lib.py'],
    deadlinesMs:{cdp:15000,completion:30000,stream:60000,detach:5000},
  };
  let complete;const completionPromise=new Promise(resolve=>{complete=resolve;});
  native.once('Tracing.tracingComplete',event=>{metadata.completion=event;complete(event);});
  native.on('Tracing.bufferUsage',event=>{
    metadata.bufferUsage.samples++;
    metadata.bufferUsage.maxPercentFull=Math.max(metadata.bufferUsage.maxPercentFull,event.percentFull??event.value??0);
    metadata.bufferUsage.maxEventCount=Math.max(metadata.bufferUsage.maxEventCount,event.eventCount??0);
  });
  let attempted=false,recording=false,endRequested=false,stopPromise=null,detached=false;
  async function detach(){if(detached)return;detached=true;try{await session.detach();}catch(error){metadata.cleanupErrors.push(errorText(error));}}
  async function stop(){
    if(stopPromise)return stopPromise;
    stopPromise=(async()=>{
      let handle,drainOwnsHandle=false;
      try{
        if(!attempted){metadata.status='not-started';return metadata;}
        if(recording)try{metadata.clockMarkers.push(await pageMarker(page,metadata.markerPrefix+'-end'));}catch(error){metadata.markerError=errorText(error);}
        if(!endRequested){endRequested=true;metadata.requests.push({method:'Tracing.end',wallMs:Date.now()});await session.send('Tracing.end');}
        const completion=await deadline(completionPromise,'Trace completion',30000);
        assert(completion.stream,'Browser returned no trace stream');handle=completion.stream;
        assert.equal(completion.traceFormat,'json');assert.equal(completion.streamCompression,'gzip');
        metadata.file='command-service-trace.json.gz';drainOwnsHandle=true;
        await drainStream(session,handle,resolve(output,metadata.file),metadata);metadata.status='collected';
        return metadata;
      }catch(error){
        metadata.status='failed';metadata.error=errorText(error);
        if(handle&&!drainOwnsHandle)try{await session.send('IO.close',{handle});}catch(cleanup){metadata.cleanupErrors.push(errorText(cleanup));}
        throw error;
      }finally{await detach();await json(resolve(output,'command-trace-summary.json'),metadata);}
    })();
    return stopPromise;
  }
  try{
    metadata.browser=await session.send('Browser.getVersion');metadata.system=await session.send('SystemInfo.getInfo');
    metadata.categories=selectCommandCategories((await session.send('Tracing.getCategories')).categories);
    metadata.config={transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',tracingBackend:'chrome',bufferUsageReportingInterval:1000,
      traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:65536,enableSampling:false,enableSystrace:false,
        includedCategories:metadata.categories.included,excludedCategories:metadata.categories.excluded}};
    metadata.markerPrefix='belle-command-service-'+Date.now();metadata.status='prepared';
    return {metadata,stop,async run(){
      assert(!attempted&&!stopPromise,'Only one trace attempt is permitted');attempted=true;metadata.status='starting';
      try{
        metadata.requests.push({method:'Tracing.start',wallMs:Date.now()});await session.send('Tracing.start',metadata.config);recording=true;metadata.status='recording';
        metadata.clockMarkers.push(await pageMarker(page,metadata.markerPrefix+'-start'));
        await wait(TRACE_REQUESTED_MS);return await stop();
      }catch(error){metadata.error??=errorText(error);try{await stop();}catch{}metadata.status='failed';await json(resolve(output,'command-trace-summary.json'),metadata);throw error;}
    }};
  }catch(error){metadata.status='failed';metadata.error=errorText(error);await detach();await json(resolve(output,'command-trace-summary.json'),metadata);throw error;}
}
async function fileNames(root,directory=root){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())result.push(...await fileNames(root,path));
    else {assert(entry.isFile(),'Unexpected symlink/nonfile: '+path);result.push(relative(root,path).split(sep).join('/'));}
  }
  return result.sort();
}
export async function runDiagnostic(){
  const game=resolve(fileURLToPath(new URL('..',import.meta.url))),output=resolve(game,process.env.BELLE_COMMAND_OUTPUT||'output/native-command-service');
  const dist=resolve(game,process.env.BELLE_COMMAND_BUILD||'dist'),started=Date.now(),viewport={width:1440,height:900};
  await mkdir(dirname(output),{recursive:true});
  await mkdir(output,{recursive:false});
  const report={version:1,scope:'Isolated full-scene native CPU command-service diagnosis; never strict riding or release acceptance',
    sourceHead:null,productParent:PRODUCT_PARENT,requestedSeconds:90,requestedTraceMs:TRACE_REQUESTED_MS,requestedTraceDelayMs:TRACE_DELAY_MS,
    requestedGraphics:{quality:'high',cap:60,antiAliasing:'automatic',viewport,deviceScaleFactor:1,diagnosticReduction:false},
    diagnosticCaptureCompleted:false,diagnosticEvidenceValid:false,releasePerformanceVerified:false,phase:'created',
    errors:[],failedRequests:[],probeErrors:[],integrityErrors:[],cleanupErrors:[],droppedErrors:0};
  const append=(key,value)=>{if(report[key].length<100)report[key].push(String(value));else report.droppedErrors++;};
  const checkpoint=async phase=>{report.phase=phase;await json(resolve(output,'report.json'),report);console.log('BELLE_COMMAND_PHASE '+JSON.stringify({phase,elapsedMs:Date.now()-started}));};
  let repo,manifest,marker,browser,page,server,trace,panel,settings,closing=false,traceTask=Promise.resolve(),traceTimer,heartbeat,pendingHeartbeat=Promise.resolve(),keyHeld=false,released=null;
  let reassertions=0,heartbeatError=null;
  const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8'}).trim();
  const contained=(root,path)=>path===root||path.startsWith(root+sep);
  async function verify(){
    assert.equal(git('rev-parse','HEAD'),manifest.commit);assert.equal(git('rev-parse','HEAD^{tree}'),manifest.tree);
    const sourceHashes={};
    for(const [name,hash] of Object.entries(manifest.sources)){
      const path=resolve(game,name);assert(contained(repo,path)&&path!==repo,'Invalid manifest source path');
      const bytes=await readFile(path);sourceHashes[name]=sha256(bytes);assert.equal(sourceHashes[name],hash,'Source hash: '+name);
    }
    assert.equal(sourceHashes['scripts/sustained-ride-profile.mjs'],STRICT_SHA256,'Strict script must remain unchanged');
    assert.equal(sourceHashes['scripts/native-command-service-diagnostic.mjs'],sha256(await readFile(fileURLToPath(import.meta.url))),'Collector source missing from authenticated manifest');
    const names=manifest.files.map(file=>file.path).sort();assert(names.length>0&&new Set(names).size===names.length);
    assert(!names.includes('__belle_test_build.json'),'Build must not contain the auxiliary virtual marker');
    assert.deepEqual(await fileNames(dist),names,'Exact immutable dist inventory required');
    for(const file of manifest.files){const path=resolve(dist,file.path);assert(contained(dist,path)&&path!==dist);const bytes=await readFile(path);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256,'Dist hash: '+file.path);}
    execFileSync('git',['-C',repo,'diff','--exit-code','HEAD','--',relative(repo,game)],{stdio:'pipe'});
    return {sourceFiles:Object.keys(sourceHashes).length,distFiles:names.length,sourceHashes,manifestFilesSha256:sha256(JSON.stringify(manifest.files)),at:new Date().toISOString()};
  }
  async function readInput(){return deadline(page.evaluate(()=>window.__belleCommandInputReceipts),'Read input receipts');}
  async function extractPartial(){
    if(!page||page.isClosed())return;
    try{report.input={...(await readInput()),reassertions,heartbeatError};}catch(error){append('probeErrors','Input extraction: '+errorText(error));}
    try{const raw=await deadline(page.locator('#ride-profile textarea').inputValue({timeout:5000}),'Profile extraction',5000);if(raw){report.profile=JSON.parse(raw);await writeFile(resolve(output,'manual-profile.json'),raw+'\n');}}
    catch(error){append('probeErrors','Profile extraction: '+errorText(error));}
  }
  try{
    assert.equal(process.platform,'darwin','Native macOS Metal is required; this script never substitutes a software browser');
    assert(process.env.BELLE_COMMAND_IDENTITY,'BELLE_COMMAND_IDENTITY is required');repo=git('rev-parse','--show-toplevel');
    const identityBytes=await readFile(resolve(game,process.env.BELLE_COMMAND_IDENTITY));manifest=JSON.parse(identityBytes);
    assert.equal(manifest.repository,'robjasper2084/Jungle-Lotto');assert.equal(manifest.parent,PRODUCT_PARENT);assert.equal(git('rev-parse','HEAD^'),PRODUCT_PARENT);
    assert.match(manifest.commit,/^[0-9a-f]{40}$/);assert.equal(manifest.commit,process.env.GITHUB_SHA,'Workflow and checked-out identity must agree');
    const collectorPath=relative(repo,fileURLToPath(import.meta.url)).split(sep).join('/');
    assert.deepEqual(git('diff','--no-renames','--name-only',PRODUCT_PARENT,'HEAD').split('\n').filter(Boolean).sort(),
      ['.github/workflows/belle-native-command-service.yml',collectorPath].sort(),'Only collector/workflow may differ from pure product');
    report.sourceHead=manifest.commit;report.sourceTree=manifest.tree;report.buildManifestSha256=sha256(identityBytes);
    await writeFile(resolve(output,'source-integrity.json'),identityBytes);await writeFile(resolve(output,'collector-source.mjs'),await readFile(fileURLToPath(import.meta.url)));
    report.integrityBefore=await verify();
    const index=manifest.files.find(file=>file.path==='index.html');assert(index&&manifest.buildId&&manifest.builtAt);
    marker={version:1,repository:manifest.repository,commit:manifest.commit,buildId:manifest.buildId,builtAt:manifest.builtAt,indexSha256:index.sha256,profileQuery:'manual'};
    const markerBytes=JSON.stringify(marker);await writeFile(resolve(output,'build-marker.json'),markerBytes);
    const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
    server=createCoopStaticServer(dist);const [originalRequest]=server.listeners('request');assert.equal(server.listeners('request').length,1);
    server.removeListener('request',originalRequest);
    server.on('request',(request,response)=>{
      if(new URL(request.url,'http://localhost').pathname==='/__belle_test_build.json'){
        response.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(markerBytes),'Cache-Control':'no-store'});
        response.end(request.method==='HEAD'?undefined:markerBytes);
      }else originalRequest.call(server,request,response);
    });
    await deadline(new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);}),'Static server');
    const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:rawExpect}=require('@playwright/test'),expect=rawExpect.configure({timeout:180000});
    report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};
    report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
    browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
    page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});page.setDefaultTimeout(180000);await page.bringToFront();
    await page.addInitScript(()=>{
      localStorage.setItem('belle-graphics-v1',JSON.stringify({quality:'high',cap:60,antiAliasing:'automatic'}));
      const receipts=window.__belleCommandInputReceipts={keydowns:0,keyups:0,repeats:0,blurs:0,visibilityInterruptions:0,firstWDownAt:null,lastWUpAt:null,heldAtStart:null,heldAtFinish:null,clicks:[]};
      const boundary=at=>({at,blurs:receipts.blurs,visibilityInterruptions:receipts.visibilityInterruptions,visible:document.visibilityState,focused:document.hasFocus()});
      window.addEventListener('keydown',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keydowns++;if(event.repeat)receipts.repeats++;
        if(receipts.firstWDownAt===null){receipts.firstWDownAt=performance.now();receipts.heldAtStart=boundary(receipts.firstWDownAt);}}},true);
      window.addEventListener('keyup',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keyups++;receipts.lastWUpAt=performance.now();receipts.heldAtFinish=boundary(receipts.lastWUpAt);}},true);
      window.addEventListener('blur',event=>{if(event.target===window)receipts.blurs++;},true);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)receipts.visibilityInterruptions++;},true);
      document.addEventListener('click',event=>{const node=event.target instanceof Element?event.target.closest('button,summary,label,input'):null;
        if(node&&receipts.clicks.length<40)receipts.clicks.push({at:performance.now(),trusted:event.isTrusted,id:node.id,text:(node.textContent??'').replace(/\s+/g,' ').trim().slice(0,120)});},true);
    });
    page.on('pageerror',error=>append('errors',error.message));
    page.on('console',message=>{if(message.type()==='error')append('errors',message.text());});
    page.on('response',response=>{if(response.status()>=400)append('errors','HTTP '+response.status()+' '+response.url());});
    page.on('requestfailed',request=>append('failedRequests',(closing?'During cleanup: ':'')+(request.failure()?.errorText??'failed')+' '+request.url()));
    report.url='http://127.0.0.1:'+server.address().port+'/?profile=manual';await checkpoint('verified-inputs');
    await page.goto(report.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
    await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});
    const graphics=()=>page.locator('#game').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Game WebGL2 is unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION)),
        canvas:{width:canvas.width,height:canvas.height},drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},contextAttributes:gl.getContextAttributes(),
        defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),
        note:'Read-only context observations outside the traced/held-input interval. No framebuffer binding, timer extension, query or fence is added.'};
    });
    const validateGraphics=value=>{
      assert(/Apple/.test(value.renderer)&&/Metal/i.test(value.renderer)&&!/SwiftShader|llvmpipe|software|softpipe/i.test(value.renderer),'Native Apple Metal is required');
      assert.deepEqual(value.canvas,viewport);assert.deepEqual(value.drawingBuffer,viewport);
      assert.equal(value.defaultFramebufferBound,true);assert.equal(value.contextAttributes?.antialias,true);assert.equal(value.sampleBuffers,1);assert.equal(value.samples,4);
    };
    report.graphicsBefore=await graphics();validateGraphics(report.graphicsBefore);
    await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
    await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
    settings=async()=>{if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();};
    await settings();await expect(page.locator('#quality')).toHaveValue('high');await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
    panel=page.locator('#ride-profile');await panel.locator('summary').click();
    trace=await prepareCommandServiceTrace(browser,page,output);report.trace=trace.metadata;
    await panel.getByRole('button',{name:'Start 10-minute capture',exact:true}).click();await page.locator('[data-close="settings"]').click();await page.locator('#game').focus();
    const downRequestedWallMs=Date.now(),downRequestedMonotonicMs=monotonicClock.now();await page.keyboard.down('w');keyHeld=true;
    const heldStart=monotonicClock.now();
    report.inputDispatch={downRequestedWallMs,downDeliveredWallMs:Date.now(),downDeliveryMonotonicMs:heldStart-downRequestedMonotonicMs,
      note:'The 90-second monotonic duration starts after awaited native keydown delivery. Original page event timestamps remain unchanged.'};
    traceTimer=setTimeout(()=>{
      report.traceRequestAfterHeldMs=monotonicClock.now()-heldStart;
      traceTask=trace.run().catch(error=>append('probeErrors','Command trace: '+errorText(error)));
    },Math.max(0,TRACE_DELAY_MS-(monotonicClock.now()-heldStart)));
    let heartbeatInFlight=false;
    heartbeat=setInterval(()=>{if(heartbeatInFlight)return;heartbeatInFlight=true;
      pendingHeartbeat=deadline(page.keyboard.down('w'),'Held-input heartbeat').then(()=>reassertions++,error=>{heartbeatError=errorText(error);}).finally(()=>{heartbeatInFlight=false;});
    },450);
    await checkpoint('native-held-input');
    try{
      // Timers may wake early. Recheck the same fixed deadline; never restart or extend it.
      while(monotonicClock.now()-heldStart<RIDE_REQUESTED_MS)await wait(Math.max(1,RIDE_REQUESTED_MS-(monotonicClock.now()-heldStart)));
    }
    finally{clearTimeout(traceTimer);clearInterval(heartbeat);await pendingHeartbeat;await deadline(page.keyboard.up('w'),'Native W release');keyHeld=false;released=Date.now();report.heldInputWallMs=monotonicClock.now()-heldStart;}
    await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
    await panel.getByRole('button',{name:'Stop and show report',exact:true}).click();await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
    report.releaseToManualStopWallMs=Date.now()-released;await extractPartial();await traceTask;
    report.graphicsAfter=await graphics();validateGraphics(report.graphicsAfter);assert.equal(report.graphicsAfter.renderer,report.graphicsBefore.renderer,'Native renderer changed');
    assert.equal(await page.evaluate(()=>typeof window.__belleGpuDiagnostics),'undefined','No application timer probe may be installed');
    const stats=report.profile;assert(stats&&stats.stopReason==='manual');
    for(const text of ['Start 10-minute capture','Stop and show report','Use this ride'])assert(report.input.clicks.some(click=>click.trusted&&click.text===text),'Missing trusted click: '+text);
    assert(report.input.clicks.some(click=>click.trusted&&click.id==='start'),'Missing trusted ride Start');
    const inputStart=report.input.heldAtStart,inputFinish=report.input.heldAtFinish;
    assert(inputStart&&inputFinish,'Exact trusted input boundary snapshots required');
    report.heldInputObservation={before:{...inputStart},after:{...inputFinish},
      blurs:inputFinish.blurs-inputStart.blurs,visibilityInterruptions:inputFinish.visibilityInterruptions-inputStart.visibilityInterruptions,
      nativeEventDurationMs:report.input.lastWUpAt-report.input.firstWDownAt,
      note:'Boundary counter deltas cover genuine held input only. Earlier and later UI observations remain in the original cumulative receipts.'};
    assert(report.input.keydowns>0&&report.input.keyups===1&&!heartbeatError&&report.heldInputObservation.blurs===0&&report.heldInputObservation.visibilityInterruptions===0,
      'Trusted continuous foreground held input required');
    assert(inputStart.visible==='visible'&&inputFinish.visible==='visible'&&inputStart.focused&&inputFinish.focused);
    assert(report.heldInputObservation.nativeEventDurationMs>=90000&&report.heldInputWallMs>=90000,'The actual ride must last 90 seconds');
    assert(stats.frames>=8&&stats.movingSeconds>=5&&stats.distanceMetres>=3,'Actual sampled riding/movement required');
    assert.deepEqual(stats.viewport,[1440,900,1]);
    for(const snapshot of [stats.settingsAtStart,stats.settings]){
      assert.equal(snapshot.quality,'high');assert.equal(snapshot.effectiveQuality,'high');assert.equal(snapshot.cap,60);assert.equal(snapshot.pixelRatio,1);assert.equal(snapshot.adaptiveScale,1);
      assert.equal(snapshot.diagnosticReduction,false);assert.equal(snapshot.vehicle,'onewheel');
    }
    for(const proof of [stats.buildAtStart,stats.build]){assert.equal(proof.status,'available');assert.equal(proof.marker.commit,manifest.commit);assert.equal(proof.marker.buildId,marker.buildId);assert.equal(proof.marker.indexSha256,marker.indexSha256);}
    for(const pacing of [stats.gpuFramePacing?.atStart,stats.gpuFramePacing?.atFinish]){
      assert(pacing?.installed&&pacing.mode==='browser');assert.equal(pacing.submittedCallbacks,0);assert.equal(pacing.pendingFenceSkippedCallbacks,0);
      for(const key of ['capacity','pendingCallbacks','completedCallbacks','peakPendingCallbacks'])assert.equal(pacing[key],null);
    }
    report.diagnosticCaptureCompleted=true;
    await page.locator('[data-close="settings"]').click();await page.screenshot({path:resolve(output,'riding-end.png'),timeout:10000});
  }catch(error){append('errors',errorText(error));}
  finally{
    clearTimeout(traceTimer);clearInterval(heartbeat);await pendingHeartbeat.catch(error=>append('cleanupErrors',errorText(error)));
    if(keyHeld&&page&&!page.isClosed())try{await deadline(page.keyboard.up('w'),'Cleanup W release');keyHeld=false;}catch(error){append('cleanupErrors',errorText(error));}
    await traceTask.catch(error=>append('probeErrors',errorText(error)));
    if(trace)try{await trace.stop();}catch(error){if(!report.probeErrors.some(text=>text.includes('Command trace:')))append('probeErrors',errorText(error));}
    if(page&&!page.isClosed()&&!report.diagnosticCaptureCompleted){
      try{if(settings&&panel){await deadline((async()=>{await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();const stop=panel.getByRole('button',{name:'Stop and show report',exact:true});if(await stop.count())await stop.click({timeout:5000});})(),'Partial manual Stop',15000);}}
      catch(error){append('cleanupErrors','Partial Stop: '+errorText(error));}
      await extractPartial();await page.screenshot({path:resolve(output,'failure.png'),timeout:10000}).catch(error=>append('probeErrors','Failure screenshot: '+errorText(error)));
    }
    closing=true;try{await deadline(browser?.close()??Promise.resolve(),'Browser close',15000);}catch(error){append('cleanupErrors',errorText(error));}
    if(server)try{server.closeAllConnections?.();await deadline(new Promise((ok,fail)=>server.close(error=>error?fail(error):ok())),'Server close',5000);}catch(error){append('cleanupErrors',errorText(error));}
    await new Promise(ok=>setImmediate(ok));
    if(manifest&&repo)try{report.integrityAfter=await verify();}catch(error){append('integrityErrors',errorText(error));}
    if(trace?.metadata.file&&trace.metadata.export?.complete)try{
      const bytes=await readFile(resolve(output,trace.metadata.file)),decoded=gunzipSync(bytes,{maxOutputLength:512*1024*1024});
      trace.metadata.export.sha256=sha256(bytes);trace.metadata.export.decodedBytes=decoded.length;
      trace.metadata.summary=summarizeCommandTrace(JSON.parse(decoded.toString('utf8')),trace.metadata.clockMarkers,report.input);
      trace.metadata.valid=trace.metadata.status==='collected'&&trace.metadata.completion?.dataLossOccurred===false&&trace.metadata.bufferUsage.maxPercentFull<1&&
        !trace.metadata.markerError&&!trace.metadata.cleanupErrors.length&&trace.metadata.summary.valid;
      trace.metadata.status=trace.metadata.valid?'complete':'incomplete';
    }catch(error){append('probeErrors','Trace analysis: '+errorText(error));trace.metadata.valid=false;}
    if(trace)await json(resolve(output,'command-trace-summary.json'),trace.metadata);
    report.numericalObservations=report.profile?{frames:report.profile.frames,frameMs:report.profile.metrics?.frameMs,over250ms:report.profile.over250ms,invalidSamples:report.profile.invalidSamples,
      movingSeconds:report.profile.movingSeconds,distanceMetres:report.profile.distanceMetres,note:'Includes manual observers and the short command trace. These are retained observations, never a strict gate or performance-improvement claim.'}:null;
    report.diagnosticEvidenceValid=report.diagnosticCaptureCompleted&&trace?.metadata.valid===true&&['errors','failedRequests','probeErrors','integrityErrors','cleanupErrors'].every(key=>report[key].length===0)&&report.droppedErrors===0;
    report.elapsedWallMs=Date.now()-started;report.phase='finished';await json(resolve(output,'report.json'),report);
    const hashes=[];for(const path of await fileNames(output)){const bytes=await readFile(resolve(output,path));hashes.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
    await json(resolve(output,'evidence-hashes.json'),hashes);
    console.log('BELLE_COMMAND_RESULT '+JSON.stringify({sourceHead:report.sourceHead,sourceTree:report.sourceTree,diagnosticEvidenceValid:report.diagnosticEvidenceValid,
      diagnosticCaptureCompleted:report.diagnosticCaptureCompleted,releasePerformanceVerified:false,traceStatus:trace?.metadata.status,
      heldInputWallMs:report.heldInputWallMs,markerWindowMs:trace?.metadata.summary?.markerWindowMs,namedCommands:trace?.metadata.summary?.namedIntervalsInsideMarks,
      drawCommands:trace?.metadata.summary?.drawCommandCount,numericalObservations:report.numericalObservations,
      errors:report.errors,failedRequests:report.failedRequests,probeErrors:report.probeErrors,integrityErrors:report.integrityErrors,cleanupErrors:report.cleanupErrors}));
  }
  if(!report.diagnosticEvidenceValid)process.exitCode=1;
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runDiagnostic();
