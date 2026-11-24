/** One bounded native GPU-process host-stack observation; never release acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {writeSync} from 'node:fs';
import {access,mkdir,open,readFile,readdir,realpath,stat,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {basename,dirname,relative,resolve,sep} from 'node:path';
import {performance as clock} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

export const PRODUCT_PARENT='e424aac64ad82f2448c11717c38c592d666c2af9';
export const STRICT_SHA256='8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5';
export const RIDE_REQUESTED_MS=30000,SAMPLE_DELAY_MS=10000,SAMPLE_SECONDS=8,SAMPLE_INTERVAL_MS=10;
export const SAMPLE_EXECUTABLE='/usr/bin/sample',SAMPLE_PROCESS_TIMEOUT_MS=30000;
const exec=promisify(execFile),finite=number=>typeof number==='number'&&Number.isFinite(number);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const errorText=error=>String(error?.stack??error),wait=ms=>new Promise(ok=>setTimeout(ok,ms));
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const stamp=()=>({wallMs:Date.now(),monotonicMs:clock.now(),iso:new Date().toISOString()});
async function deadline(promise,label,milliseconds=15000){
 let timer;try{return await Promise.race([promise,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error(label+' timed out')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
export function parsePsIdentity(summary,args){
 const match=summary.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+([\d:.-]+)\s+(.+)$/);
 assert(match,'Unrecognized macOS ps identity record');
 const [,pid,ppid,uid,user,startTime,cpuTime,executable]=match;
 const token=cpuTime.match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
 assert(token,'Unrecognized macOS ps CPU-time record');
 const cpuSeconds=Number(token[1]??0)*86400+Number(token[2]??0)*3600+Number(token[3])*60+Number(token[4]);
 return {pid:Number(pid),ppid:Number(ppid),uid:Number(uid),user,startTime,cpuTime,cpuSeconds,executable,args:args.trim()};
}
export function selectBrowserAndGpu(processInfo){
 assert(Array.isArray(processInfo)&&processInfo.length>0&&processInfo.length<=1000,'Missing/bounded CDP process list required');
 for(const row of processInfo)assert(Number.isSafeInteger(row.id)&&row.id>0&&finite(row.cpuTime)&&row.cpuTime>=0&&typeof row.type==='string','Malformed CDP process record');
 const browser=processInfo.filter(row=>row.type.toLowerCase()==='browser'),gpu=processInfo.filter(row=>row.type.toLowerCase()==='gpu');
 assert.equal(browser.length,1,'Exactly one browser process required');assert.equal(gpu.length,1,'Exactly one GPU process required');
 assert.notEqual(browser[0].id,gpu[0].id);return {browser:browser[0],gpu:gpu[0]};
}
export function validateProcessIdentity(snapshot,baseline=null){
 const selected=selectBrowserAndGpu(snapshot.cdp.processInfo),{browser,gpu}=snapshot.os;
 assert.equal(snapshot.currentUid,snapshot.currentEffectiveUid,'Real/effective user must match; no elevation');
 for(const [name,row] of Object.entries({browser,gpu})){
  assert.equal(row.pid,selected[name].id,'OS/CDP '+name+' PID mismatch');assert.equal(row.uid,snapshot.currentUid,'Target must belong to same CI user');
  assert(row.executable.startsWith('/')&&row.realExecutable.startsWith('/'),'Absolute OS executable path required');
 }
 assert.equal(gpu.ppid,browser.pid,'GPU process must be a direct child of this CDP browser');
 assert.equal(browser.executable,snapshot.browserCommandLine.arguments[0],'CDP/OS browser executable mismatch');
 const bundle=browser.realExecutable.match(/^(.+\.app)\/Contents\//)?.[1];
 assert(bundle&&/Google Chrome\.app$/.test(bundle),'Official Chrome channel app required');
 assert(gpu.realExecutable.startsWith(bundle+'/Contents/'),'GPU executable must belong to the same Chrome bundle');
 assert(/(?:^|\s)--type=gpu-process(?:\s|$)/.test(gpu.args),'OS GPU command type missing');
 assert(!/(?:^|\s)--type=/.test(browser.args),'Browser root must not be a child process');
 for(const flag of ['--enable-gpu','--use-gl=angle','--use-angle=metal'])assert(snapshot.browserCommandLine.arguments.includes(flag),'Required original native launch flag missing: '+flag);
 for(const arg of snapshot.browserCommandLine.arguments)assert(!/^--(?:enable-gpu-debugging|enable-gpu-client-logging|enable-gpu-command-logging|enable-gpu-service-(?:logging|tracing)|trace-startup|trace-config-file|enable-tracing)(?:=|$)/.test(arg),'Forbidden additional instrumentation flag');
 if(baseline){
  for(const name of ['browser','gpu']){
   const prior=baseline.os[name],current=snapshot.os[name];
   for(const key of ['pid','ppid','uid','user','startTime','executable','realExecutable','args'])assert.equal(current[key],prior[key],name+' process identity changed: '+key);
   assert(selected[name].cpuTime>=selectBrowserAndGpu(baseline.cdp.processInfo)[name].cpuTime,'CDP CPU time moved backwards');
   assert(current.cpuSeconds>=prior.cpuSeconds,'OS CPU time moved backwards');
  }
 }
 return {browserPid:browser.pid,gpuPid:gpu.pid,sameUser:true,directBrowserChild:true,stable:baseline!==null};
}
export function parseSampleReport(text){
 assert(typeof text==='string'&&Buffer.byteLength(text)<=64*1024*1024,'Sample report exceeds parse byte bound');
 const lines=text.split(/\r?\n/);assert(lines.length<=250000,'Sample line bound exceeded');
 const out={format:'macos-sample-text',parserVersion:1,header:{},declaredGlobalSampleCount:null,declaredIntervalMs:null,
  threadRoots:[],inclusiveFrames:[],binaryImages:[],unparsedGraphLines:[],issues:[],symbolizedFrameRows:0,unknownSymbolFrameRows:0,symbolsByImage:{},mechanismAttributionUsable:null,
  note:'Counts are statistical stack observations. Inclusive parent/child counts overlap and are not summed. A missing global count remains null; 8s/10ms is not an observed count. No count is CPU/GPU milliseconds or function-call frequency.'};
 const issue=message=>{if(out.issues.length<50)out.issues.push(message);};let mode='header',currentThread=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],lineNumber=i+1;
  if(/^Call graph:\s*$/.test(line)){mode='graph';continue;}
  if(/^Binary Images:\s*$/.test(line)){mode='images';continue;}
  if(mode==='graph'&&/^(?:Total number in stack|Sort by top of stack|Sort by total)/.test(line)){mode='aggregate';continue;}
  if(mode==='header'){
   const field=line.match(/^([A-Za-z][A-Za-z /()-]+):\s*(.*)$/);if(field)out.header[field[1]]=field[2];
   const interval=line.match(/^Analysis of sampling .* every ([\d.]+) milliseconds?/);if(interval)out.declaredIntervalMs=Number(interval[1]);
   const global=line.match(/^(?:Total samples|Number of samples|Sample count):\s*(\d+)\s*$/);if(global)out.declaredGlobalSampleCount=Number(global[1]);
  }else if(mode==='graph'&&line.trim()){
   const row=line.match(/^([\s+!:|]*)(\d+)\s+(.+)$/);
   if(!row){if(out.unparsedGraphLines.length<50)out.unparsedGraphLines.push({lineNumber,raw:line});continue;}
   const count=Number(row[2]),body=row[3];if(!Number.isSafeInteger(count)||count<=0){issue('Invalid positive stack observation count at '+lineNumber);continue;}
   if(/^Thread[_\s]/i.test(body)){
    assert(out.threadRoots.length<1024,'Thread root bound exceeded');currentThread=out.threadRoots.length;
    out.threadRoots.push({lineNumber,count,identity:body,prefix:row[1],raw:line});continue;
   }
   if(currentThread===null){issue('Stack frame without thread root at '+lineNumber);continue;}
   assert(out.inclusiveFrames.length<100000,'Stack frame bound exceeded');
   const imageAt=body.lastIndexOf(' (in '),imageEnd=imageAt<0?-1:body.indexOf(')',imageAt+5);
   const symbol=imageAt<0?null:body.slice(0,imageAt),image=imageEnd<0?null:body.slice(imageAt+5,imageEnd);
   const symbolized=!!symbol&&!/^(?:\?+|0x[0-9a-f]+|unknown)(?:\s|$)/i.test(symbol);
   if(symbolized)out.symbolizedFrameRows++;else out.unknownSymbolFrameRows++;
   const symbols=out.symbolsByImage[image??'<unidentified>']??={namedFrameRows:0,unknownFrameRows:0};
   symbols[symbolized?'namedFrameRows':'unknownFrameRows']++;
   out.inclusiveFrames.push({lineNumber,thread:currentThread,count,prefix:row[1],symbol,image,symbolized,address:body.match(/\[(0x[0-9a-f]+)\]\s*$/i)?.[1]??null,raw:line});
  }else if(mode==='images'&&line.trim()){
   const row=line.match(/^\s*(0x[0-9a-f]+)\s*-\s*(0x[0-9a-f]+)\s+(.+)$/i);
   if(!row){issue('Unparsed binary image line '+lineNumber);continue;}
   assert(out.binaryImages.length<10000,'Image metadata bound exceeded');
   out.binaryImages.push({lineNumber,startAddress:row[1],endAddress:row[2],uuid:row[3].match(/<([0-9a-f-]+)>/i)?.[1]??null,path:row[3].match(/\s(\/.*)$/)?.[1]??null,description:row[3],raw:line});
  }
 }
 out.targetPid=Number(out.header.Process?.match(/\[(\d+)\]\s*$/)?.[1])||null;
 out.parentPid=Number(out.header['Parent Process']?.match(/\[(\d+)\]\s*$/)?.[1])||null;
 if(!out.targetPid)issue('Missing declared target PID');
 if(out.declaredIntervalMs!==SAMPLE_INTERVAL_MS)issue('Missing or mismatched declared sampling interval');
 if(!out.threadRoots.length||!out.inclusiveFrames.length)issue('Missing thread roots/call stacks');
 if(out.unparsedGraphLines.length)issue('Unrecognized call-graph lines retained');
 if(!out.binaryImages.length||!out.binaryImages.some(row=>row.uuid&&row.path))issue('Missing auditable image metadata');
 out.structureUsable=out.issues.length===0;
 out.someSymbolsPresent=out.symbolizedFrameRows>0;
 out.symbolCoverage=out.symbolizedFrameRows===0?'unavailable':out.unknownSymbolFrameRows>0?'partial':'all-parsed-frames-named';
 return out;
}
export function makeSingleSampleRunner(output,{spawnImpl=spawn,timeoutMs=SAMPLE_PROCESS_TIMEOUT_MS,killGraceMs=1000}={}){
 let attempted=false;
 const metadata={attempted:false,attempts:0,status:'not-started',executable:SAMPLE_EXECUTABLE,requestedSeconds:SAMPLE_SECONDS,
  requestedIntervalMs:SAMPLE_INTERVAL_MS,timeoutMs,killGraceMs,stdout:'sample.stdout.txt',stderr:'sample.stderr.txt',report:'sample.report.txt',
  stdoutBytes:0,stderrBytes:0,outputTruncated:false,streamEvents:[],phaseSignals:[],signals:[],errors:[],cleanupErrors:[],exitCode:null,exitSignal:null,exitObserved:false};
 return {metadata,async run(pid){
  assert(!attempted,'Exactly one sampler attempt is allowed');assert(Number.isSafeInteger(pid)&&pid>0);attempted=true;metadata.attempted=true;metadata.attempts=1;
  metadata.argv=[String(pid),String(SAMPLE_SECONDS),String(SAMPLE_INTERVAL_MS),'-file',resolve(output,metadata.report)];
  metadata.commandDisplay=[metadata.executable,...metadata.argv];let stdout,stderr,child;
  try{
   stdout=await open(resolve(output,metadata.stdout),'wx');stderr=await open(resolve(output,metadata.stderr),'wx');
   metadata.requested=stamp();metadata.status='starting';
   await new Promise(resolveDone=>{
    let completed=false,timer,killTimer,finalTimer;const tails={stdout:'',stderr:''};
    const finish=()=>{if(completed)return;completed=true;clearTimeout(timer);clearTimeout(killTimer);clearTimeout(finalTimer);metadata.finished=stamp();resolveDone();};
    const signal=kind=>{metadata.signals.push({signal:kind,...stamp()});try{metadata.signals.at(-1).sent=child.kill(kind);}catch(error){metadata.cleanupErrors.push(errorText(error));}};
    const cancel=reason=>{
     if(metadata.cancelReason)return;metadata.cancelReason=reason;signal('SIGTERM');
     killTimer=setTimeout(()=>{signal('SIGKILL');finalTimer=setTimeout(()=>{metadata.cleanupErrors.push('Sampler exit not observed after SIGKILL');
       for(const stream of [child.stdout,child.stderr]){stream.removeAllListeners('data');stream.destroy();}
       child.removeAllListeners('spawn');child.removeAllListeners('close');child.unref?.();finish();},killGraceMs);},killGraceMs);
    };
    const consume=(name,file,data)=>{
     const bytes=Buffer.from(data),key=name+'Bytes',remaining=4*1024*1024-metadata[key],kept=bytes.subarray(0,Math.max(0,remaining));
     if(kept.length)try{let offset=0;while(offset<kept.length){const written=writeSync(file.fd,kept,offset,kept.length-offset);assert(written>0,'Raw stream write made no progress');offset+=written;}}catch(error){metadata.errors.push('Raw stream write: '+errorText(error));cancel('raw-stream-write-failure');}
     metadata[key]+=bytes.length;
     if(metadata.streamEvents.length<256)metadata.streamEvents.push({stream:name,bytes:bytes.length,retainedBytes:kept.length,...stamp()});
     else metadata.streamEventsTruncated=true;
     tails[name]=(tails[name]+bytes.toString('utf8')).slice(-8192);
     for(const [kind,pattern] of [['sampling-start',/Sampling process (\d+) for ([\d.]+) seconds? with ([\d.]+) milliseconds?/i],['sampling-complete',/Sampling completed, processing symbols/i]]){
      const match=tails[name].match(pattern);
      if(match&&!metadata.phaseSignals.some(row=>row.kind===kind))metadata.phaseSignals.push({kind,stream:name,text:match[0],declaredPid:kind==='sampling-start'?Number(match[1]):null,declaredSeconds:kind==='sampling-start'?Number(match[2]):null,declaredIntervalMs:kind==='sampling-start'?Number(match[3]):null,...stamp()});
     }
     if(kept.length<bytes.length){metadata.outputTruncated=true;cancel('raw-stream-byte-bound');}
    };
    try{child=spawnImpl(SAMPLE_EXECUTABLE,metadata.argv,{stdio:['ignore','pipe','pipe'],windowsHide:true});}
    catch(error){metadata.errors.push(errorText(error));metadata.spawnUnavailable=true;finish();return;}
    child.once('spawn',()=>{metadata.spawned=stamp();metadata.samplerPid=child.pid;metadata.status='running';});
    child.stdout.on('data',data=>consume('stdout',stdout,data));child.stderr.on('data',data=>consume('stderr',stderr,data));
    for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]])stream.on('error',error=>{metadata.errors.push(name+' stream: '+errorText(error));cancel('raw-stream-error');});
    child.on('error',error=>{metadata.errors.push(errorText(error));if(!metadata.spawned){metadata.spawnUnavailable=true;finish();}});
    child.once('close',(code,signal)=>{metadata.exitCode=code;metadata.exitSignal=signal;metadata.exitObserved=true;finish();});
    timer=setTimeout(()=>cancel('process-timeout'),timeoutMs);
   });
  }catch(error){metadata.errors.push(errorText(error));metadata.finished??=stamp();}
  finally{for(const file of [stdout,stderr])try{await file?.close();}catch(error){metadata.cleanupErrors.push(errorText(error));}}
  metadata.status=metadata.spawnUnavailable?'unavailable':metadata.cancelReason?'partial':metadata.exitCode===0&&metadata.exitObserved&&metadata.errors.length===0&&metadata.cleanupErrors.length===0?'collected':'failed';
  metadata.elapsedMs=metadata.requested&&metadata.finished?metadata.finished.monotonicMs-metadata.requested.monotonicMs:null;
  return metadata;
 }};
}
async function osProcess(pid){
 const before=stamp(),options={encoding:'utf8',timeout:3000,maxBuffer:1024*1024};
 const commands=[['-ww','-p',String(pid),'-o','pid=,ppid=,uid=,user=,lstart=,time=,comm='],['-ww','-p',String(pid),'-o','args=']];
 const values=await Promise.all(commands.map(args=>exec('/bin/ps',args,options)));
 const value=parsePsIdentity(values[0].stdout,values[1].stdout);value.realExecutable=await realpath(value.executable);
 return {...value,observationBefore:before,observationAfter:stamp(),commands:commands.map((args,i)=>({executable:'/bin/ps',argv:args,stdout:values[i].stdout,stderr:values[i].stderr}))};
}
async function browserClock(page){return deadline(page.evaluate(()=>({timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallMs:Date.now(),visible:document.visibilityState,focused:document.hasFocus()})),'Browser clock receipt');}
async function processSnapshot(session,browserCommandLine){
 const before=stamp(),cdp=await deadline(session.send('SystemInfo.getProcessInfo'),'Browser process information'),cdpReceived=stamp();
 const selected=selectBrowserAndGpu(cdp.processInfo);const [browser,gpu]=await Promise.all([osProcess(selected.browser.id),osProcess(selected.gpu.id)]);
 return {before,cdpReceived,after:stamp(),currentUid:process.getuid(),currentEffectiveUid:process.geteuid(),cdp,browserCommandLine,os:{browser,gpu}};
}
export function samplingOverlap(command,inputDispatch,input){
 const start=command.spawned??command.requested,end=command.finished;
 const signal=command.phaseSignals.find(row=>row.kind==='sampling-complete');
 const declared=command.phaseSignals.find(row=>row.kind==='sampling-start');
 const heldStart=inputDispatch?.downDeliveredMonotonicMs,heldEnd=inputDispatch?.upRequestedMonotonicMs;
 const contained=(a,b)=>finite(a)&&finite(b)&&finite(heldStart)&&finite(heldEnd)&&a>=heldStart&&b>=a&&b<=heldEnd;
 const entireProcessContained=contained(start?.monotonicMs,end?.monotonicMs);
 const signaledCaptureContained=!!declared&&!!signal&&declared.declaredPid===Number(command.argv?.[0])&&declared.declaredSeconds===SAMPLE_SECONDS&&declared.declaredIntervalMs===SAMPLE_INTERVAL_MS&&contained(start?.monotonicMs,signal.monotonicMs);
 const nativeDurationMs=input?.lastWUpAt-input?.firstWDownAt;
 return {entireProcessContained,signaledCaptureContained,heldStartMonotonicMs:heldStart??null,heldEndMonotonicMs:heldEnd??null,
  samplerProcessStartMonotonicMs:start?.monotonicMs??null,samplerProcessFinishMonotonicMs:end?.monotonicMs??null,
  samplingCompleteSignalMonotonicMs:signal?.monotonicMs??null,nativeDurationMs:finite(nativeDurationMs)?nativeDurationMs:null,
  valid:finite(nativeDurationMs)&&nativeDurationMs>=RIDE_REQUESTED_MS&&(entireProcessContained||signaledCaptureContained),
  note:'Node monotonic receipts bracket subprocess lifetime, or the sampler own sampling-complete signal before symbol/report work. Trusted down/up receipts establish the unchanged held-input interval. No browser/OS clock is modified; no exact8s observed duration is invented.'};
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
  const game=resolve(fileURLToPath(new URL('..',import.meta.url))),output=resolve(game,process.env.BELLE_GPU_SAMPLE_OUTPUT||'output/native-gpu-process-sample');
  const dist=resolve(game,process.env.BELLE_GPU_SAMPLE_BUILD||'dist'),started=Date.now(),viewport={width:1440,height:900};
  await mkdir(dirname(output),{recursive:true});
  await mkdir(output,{recursive:false});
  const report={version:1,scope:'Isolated native GPU-process statistical host-stack diagnosis; never strict riding or release acceptance',
    sourceHead:null,productParent:PRODUCT_PARENT,requestedSeconds:30,requestedSampleSeconds:SAMPLE_SECONDS,requestedSampleIntervalMs:SAMPLE_INTERVAL_MS,requestedSampleDelayMs:SAMPLE_DELAY_MS,
    requestedGraphics:{quality:'high',cap:60,antiAliasing:'automatic',viewport,deviceScaleFactor:1,diagnosticReduction:false},
    diagnosticCaptureCompleted:false,samplingEvidenceUsable:false,rawCollectionComplete:false,someSymbolsPresent:false,mechanismAttributionUsable:null,sampleStatus:'not-started',releasePerformanceVerified:false,releaseAccepted:false,phase:'created',
    errors:[],failedRequests:[],probeErrors:[],integrityErrors:[],cleanupErrors:[],droppedErrors:0};
  const append=(key,value)=>{if(report[key].length<100)report[key].push(String(value));else report.droppedErrors++;};
  const checkpoint=async phase=>{report.phase=phase;await json(resolve(output,'report.json'),report);console.log('BELLE_GPU_SAMPLE_PHASE '+JSON.stringify({phase,elapsedMs:Date.now()-started}));};
  let repo,manifest,marker,browser,page,server,session,sample,panel,settings,closing=false,sampleTask=Promise.resolve(),sampleTimer,heartbeat,pendingHeartbeat=Promise.resolve(),keyHeld=false,released=null;
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
    assert.equal(sourceHashes['scripts/render-gpu-process-sample.mjs'],sha256(await readFile(fileURLToPath(import.meta.url))),'Collector source missing from authenticated manifest');
    const names=manifest.files.map(file=>file.path).sort();assert(names.length>0&&new Set(names).size===names.length);
    assert(!names.includes('__belle_test_build.json'),'Build must not contain the auxiliary virtual marker');
    assert.deepEqual(await fileNames(dist),names,'Exact immutable dist inventory required');
    for(const file of manifest.files){const path=resolve(dist,file.path);assert(contained(dist,path)&&path!==dist);const bytes=await readFile(path);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256,'Dist hash: '+file.path);}
    execFileSync('git',['-C',repo,'diff','--exit-code','HEAD','--',relative(repo,game)],{stdio:'pipe'});
    return {sourceFiles:Object.keys(sourceHashes).length,distFiles:names.length,sourceHashes,manifestFilesSha256:sha256(JSON.stringify(manifest.files)),at:new Date().toISOString()};
  }
  async function readInput(){return deadline(page.evaluate(()=>window.__belleGpuSampleInputReceipts),'Read input receipts');}
  async function extractPartial(){
    if(!page||page.isClosed())return;
    try{report.input={...(await readInput()),reassertions,heartbeatError};}catch(error){append('probeErrors','Input extraction: '+errorText(error));}
    try{const raw=await deadline(page.locator('#ride-profile textarea').inputValue({timeout:5000}),'Profile extraction',5000);if(raw){report.profile=JSON.parse(raw);await writeFile(resolve(output,'ride-profile.json'),raw+'\n');}}
    catch(error){append('probeErrors','Profile extraction: '+errorText(error));}
  }
  try{
    assert.equal(process.platform,'darwin','Native macOS Metal is required; no substitute browser');
    assert.equal(typeof process.getuid,'function');assert.equal(process.getuid(),process.geteuid(),'No elevation');
    try{await access(SAMPLE_EXECUTABLE,1);}catch(error){report.sampleStatus='unavailable';report.sampleUnavailableReason='Same-user /usr/bin/sample is not executable: '+errorText(error);throw error;}
    assert(process.env.BELLE_GPU_SAMPLE_IDENTITY,'BELLE_GPU_SAMPLE_IDENTITY is required');repo=git('rev-parse','--show-toplevel');
    const identityBytes=await readFile(resolve(game,process.env.BELLE_GPU_SAMPLE_IDENTITY));manifest=JSON.parse(identityBytes);
    assert.equal(manifest.repository,'robjasper2084/Jungle-Lotto');assert.equal(manifest.parent,PRODUCT_PARENT);assert.equal(git('rev-parse','HEAD^'),PRODUCT_PARENT);
    assert.match(manifest.commit,/^[0-9a-f]{40}$/);assert.equal(manifest.commit,process.env.GITHUB_SHA,'Workflow and checked-out identity must agree');
    const collectorPath=relative(repo,fileURLToPath(import.meta.url)).split(sep).join('/');
    assert.deepEqual(git('diff','--no-renames','--name-only',PRODUCT_PARENT,'HEAD').split('\n').filter(Boolean).sort(),
      ['.github/workflows/belle-native-gpu-process-sample.yml',collectorPath].sort(),'Only collector/workflow may differ from pure product');
    report.sourceHead=manifest.commit;report.sourceTree=manifest.tree;report.buildManifestSha256=sha256(identityBytes);
    await writeFile(resolve(output,'source-integrity.json'),identityBytes);await writeFile(resolve(output,'collector-source.mjs'),await readFile(fileURLToPath(import.meta.url)));
    report.integrityBefore=await verify();
    const index=manifest.files.find(file=>file.path==='index.html');assert(index&&manifest.buildId&&manifest.builtAt);
    marker={version:1,repository:manifest.repository,commit:manifest.commit,buildId:manifest.buildId,builtAt:manifest.builtAt,indexSha256:index.sha256,profileQuery:'1'};
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
      const receipts=window.__belleGpuSampleInputReceipts={keydowns:0,keyups:0,repeats:0,blurs:0,visibilityInterruptions:0,firstWDownAt:null,lastWUpAt:null,heldAtStart:null,heldAtFinish:null,clicks:[]};
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
    report.url='http://127.0.0.1:'+server.address().port+'/?profile=1';await checkpoint('verified-inputs');
    const navigation=await page.goto(report.url,{waitUntil:'domcontentloaded'});assert(navigation&&navigation.status()===200,'Initial document must load successfully');
    const navigationBytes=await navigation.body();assert.equal(sha256(navigationBytes),marker.indexSha256,'Actual navigation index must match authenticated build');
    report.navigationDocument={url:navigation.url(),status:navigation.status(),bytes:navigationBytes.length,sha256:sha256(navigationBytes)};
    await writeFile(resolve(output,'navigation-index.html'),navigationBytes);
    const verifyBrowserMarker=async label=>{
      const observed=await deadline(page.evaluate(async()=>{const response=await fetch('/__belle_test_build.json',{cache:'no-store'});return {url:response.url,status:response.status,text:await response.text()};}),'Same-origin build marker');
      assert.equal(observed.status,200);assert.equal(new URL(observed.url).origin,new URL(report.url).origin);assert.equal(observed.text,markerBytes,'Actual same-origin marker bytes changed');
      const proof={...observed,sha256:sha256(observed.text),at:stamp(),note:'External same-origin build proof. The unchanged profile=1 product reader intentionally reports unavailable; it is not relabeled.'};
      await json(resolve(output,'served-build-'+label+'.json'),proof);return proof;
    };
    await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
    await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});
    const graphics=()=>page.locator('#game').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Game WebGL2 is unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION)),
        canvas:{width:canvas.width,height:canvas.height},drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},contextAttributes:gl.getContextAttributes(),
        defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),
        note:'Read-only native context assertions outside the sampled/held-input interval. No framebuffer bind, timer query, readback, fence or forced GL completion is added.'};
    });
    const validateGraphics=value=>{
      assert(/Apple/.test(value.renderer)&&/Metal/i.test(value.renderer)&&!/SwiftShader|llvmpipe|software|softpipe/i.test(value.renderer),'Native Apple Metal is required');
      assert.deepEqual(value.canvas,viewport);assert.deepEqual(value.drawingBuffer,viewport);
      assert.equal(value.defaultFramebufferBound,true);assert.equal(value.contextAttributes?.antialias,true);assert.equal(value.sampleBuffers,1);assert.equal(value.samples,4);
    };
    report.graphicsBefore=await graphics();validateGraphics(report.graphicsBefore);report.servedBuildBefore=await verifyBrowserMarker('before');
    await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
    await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
    await page.screenshot({path:resolve(output,'native-ready.png'),timeout:10000});
    settings=async()=>{if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();};
    await settings();await expect(page.locator('#quality')).toHaveValue('high');await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
    panel=page.locator('#ride-profile');await panel.locator('summary').click();
    session=await deadline(browser.newBrowserCDPSession(),'Browser CDP session');
    report.browserIdentity={version:await deadline(session.send('Browser.getVersion'),'Browser version'),
      commandLine:await deadline(session.send('Browser.getBrowserCommandLine'),'Browser command line'),
      system:await deadline(session.send('SystemInfo.getInfo'),'Native system info')};
    report.processInitial=await processSnapshot(session,report.browserIdentity.commandLine);
    report.initialIdentity=validateProcessIdentity(report.processInitial);
    sample=makeSingleSampleRunner(output);report.sample=sample.metadata;
    await panel.getByRole('button',{name:'Start 10-minute capture',exact:true}).click();await page.locator('[data-close="settings"]').click();await page.locator('#game').focus();
    report.inputClockBefore=await browserClock(page);
    const downRequestedWallMs=Date.now(),downRequestedMonotonicMs=clock.now();await page.keyboard.down('w');keyHeld=true;
    const heldStart=clock.now();
    report.inputDispatch={downRequestedWallMs,downRequestedMonotonicMs,downDeliveredWallMs:Date.now(),downDeliveredMonotonicMs:heldStart,downDeliveryMonotonicMs:heldStart-downRequestedMonotonicMs,
      note:'The 30-second monotonic duration starts after awaited native keydown delivery. Original page event timestamps remain unchanged.'};
    sampleTimer=setTimeout(()=>{
      report.sampleTaskStartedAfterHeldMs=clock.now()-heldStart;
      sampleTask=(async()=>{
        report.processBefore=await processSnapshot(session,report.browserIdentity.commandLine);
        validateProcessIdentity(report.processBefore,report.processInitial);
        report.sampleClockBefore=await browserClock(page);
        assert(clock.now()-heldStart<RIDE_REQUESTED_MS-SAMPLE_SECONDS*1000-1000,'Insufficient unchanged ride time for one sample; no late sample/retry');
        await checkpoint('sampling-one-gpu-process');
        await sample.run(report.processBefore.os.gpu.pid);
        report.sampleClockAfter=await browserClock(page);
        report.processAfter=await processSnapshot(session,report.browserIdentity.commandLine);
        report.finalIdentity=validateProcessIdentity(report.processAfter,report.processBefore);
        report.processIdentityStable=true;
        await checkpoint('sampler-report-finished');
      })().catch(error=>append('probeErrors','OS GPU sample: '+errorText(error)));
    },Math.max(0,SAMPLE_DELAY_MS-(clock.now()-heldStart)));
    let heartbeatInFlight=false;
    heartbeat=setInterval(()=>{if(heartbeatInFlight)return;heartbeatInFlight=true;
      pendingHeartbeat=deadline(page.keyboard.down('w'),'Held-input heartbeat').then(()=>reassertions++,error=>{heartbeatError=errorText(error);}).finally(()=>{heartbeatInFlight=false;});
    },450);
    await checkpoint('native-held-input');
    try{
      // Timers may wake early. Recheck the same fixed deadline; never restart or extend it.
      while(clock.now()-heldStart<RIDE_REQUESTED_MS)await wait(Math.max(1,RIDE_REQUESTED_MS-(clock.now()-heldStart)));
    }
    finally{clearTimeout(sampleTimer);clearInterval(heartbeat);await pendingHeartbeat;report.inputDispatch.upRequestedMonotonicMs=clock.now();report.inputDispatch.upRequestedWallMs=Date.now();await deadline(page.keyboard.up('w'),'Native W release');keyHeld=false;released=Date.now();report.inputDispatch.upDelivered=stamp();report.heldInputWallMs=clock.now()-heldStart;}
    await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
    await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
    report.releaseToProfileExtractionWallMs=Date.now()-released;await extractPartial();await sampleTask;report.inputClockAfter=await browserClock(page);
    report.graphicsAfter=await graphics();validateGraphics(report.graphicsAfter);assert.equal(report.graphicsAfter.renderer,report.graphicsBefore.renderer,'Native renderer changed');
    assert.equal(await page.evaluate(()=>typeof window.__belleGpuDiagnostics),'undefined','No application timer probe may be installed');
    const stats=report.profile;assert(stats&&stats.stopReason==='trusted-W-keyup','Normal profile must stop on genuine W release');
    assert.equal(stats.loopDiagnostics,undefined,'ManualLoopProbe must remain absent');
    assert.equal(stats.submissionInstrumentation?.atStart,null);assert.equal(stats.submissionInstrumentation?.atFinish,null);
    for(const text of ['Start 10-minute capture','Use this ride'])assert(report.input.clicks.some(click=>click.trusted&&click.text===text),'Missing trusted click: '+text);
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
    assert(report.heldInputObservation.nativeEventDurationMs>=RIDE_REQUESTED_MS&&report.heldInputWallMs>=RIDE_REQUESTED_MS,'The actual diagnostic ride must last 30 seconds');
    assert(stats.frames>=8&&stats.movingSeconds>=5&&stats.distanceMetres>=3,'Actual sampled riding/movement required');
    assert.deepEqual(stats.viewport,[1440,900,1]);
    for(const snapshot of [stats.settingsAtStart,stats.settings]){
      assert.equal(snapshot.quality,'high');assert.equal(snapshot.effectiveQuality,'high');assert.equal(snapshot.cap,60);assert.equal(snapshot.pixelRatio,1);assert.equal(snapshot.adaptiveScale,1);
      assert.equal(snapshot.diagnosticReduction,false);assert.equal(snapshot.vehicle,'onewheel');
    }
    for(const proof of [stats.buildAtStart,stats.build]){assert.equal(proof.status,'unavailable');assert.equal(proof.reason,'manual comparison not selected');}
    report.servedBuildAfter=await verifyBrowserMarker('after');
    for(const pacing of [stats.gpuFramePacing?.atStart,stats.gpuFramePacing?.atFinish]){
      assert(pacing?.installed&&pacing.mode==='browser');assert.equal(pacing.submittedCallbacks,0);assert.equal(pacing.pendingFenceSkippedCallbacks,0);
      for(const key of ['capacity','pendingCallbacks','completedCallbacks','peakPendingCallbacks'])assert.equal(pacing[key],null);
    }
    report.diagnosticCaptureCompleted=true;
    await page.locator('[data-close="settings"]').click();await page.screenshot({path:resolve(output,'riding-end.png'),timeout:10000});
  }catch(error){append('errors',errorText(error));}
  finally{
    clearTimeout(sampleTimer);clearInterval(heartbeat);await pendingHeartbeat.catch(error=>append('cleanupErrors',errorText(error)));
    if(keyHeld&&page&&!page.isClosed())try{await deadline(page.keyboard.up('w'),'Cleanup W release');keyHeld=false;}catch(error){append('cleanupErrors',errorText(error));}
    await sampleTask.catch(error=>append('probeErrors',errorText(error)));
    if(session)try{await deadline(session.detach(),'Browser CDP detach',5000);}catch(error){append('cleanupErrors',errorText(error));}
    if(page&&!page.isClosed()&&!report.diagnosticCaptureCompleted){
      try{if(settings&&panel){await deadline((async()=>{await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();const stop=panel.getByRole('button',{name:'Stop and show report',exact:true});if(await stop.count())await stop.click({timeout:5000});})(),'Partial manual Stop',15000);}}
      catch(error){append('cleanupErrors','Partial Stop: '+errorText(error));}
      await extractPartial();await page.screenshot({path:resolve(output,'failure.png'),timeout:10000}).catch(error=>append('probeErrors','Failure screenshot: '+errorText(error)));
    }
    closing=true;try{await deadline(browser?.close()??Promise.resolve(),'Browser close',15000);}catch(error){append('cleanupErrors',errorText(error));}
    if(server)try{server.closeAllConnections?.();await deadline(new Promise((ok,fail)=>server.close(error=>error?fail(error):ok())),'Server close',5000);}catch(error){append('cleanupErrors',errorText(error));}
    await new Promise(ok=>setImmediate(ok));
    if(manifest&&repo)try{report.integrityAfter=await verify();}catch(error){append('integrityErrors',errorText(error));}
    if(sample){
      report.sampleOverlap=samplingOverlap(sample.metadata,report.inputDispatch,report.input);
      try{
        report.rawSampleFiles=[];
        for(const name of [sample.metadata.stdout,sample.metadata.stderr,sample.metadata.report]){
          const path=resolve(output,name);let information;
          try{information=await stat(path);}catch(error){report.rawSampleFiles.push({path:name,available:false,error:errorText(error)});continue;}
          const entry={path:name,available:true,bytes:information.size,sha256:null};report.rawSampleFiles.push(entry);
          assert(information.isFile()&&information.size<=64*1024*1024,'Raw sample file exceeds immutable parse/hash bound: '+name);
          const bytes=await readFile(path);assert.equal(bytes.length,information.size,'Raw sample size changed after collection');entry.sha256=sha256(bytes);
          if(name===sample.metadata.report){
            const parsed=parseSampleReport(bytes.toString('utf8'));await json(resolve(output,'sample.parsed.json'),parsed);
            report.sampleAnalysis={path:'sample.parsed.json',targetPid:parsed.targetPid,parentPid:parsed.parentPid,header:parsed.header,
              declaredGlobalSampleCount:parsed.declaredGlobalSampleCount,declaredIntervalMs:parsed.declaredIntervalMs,
              threadRoots:parsed.threadRoots.map(row=>({lineNumber:row.lineNumber,count:row.count,identity:row.identity})),
              inclusiveFrameRows:parsed.inclusiveFrames.length,binaryImages:parsed.binaryImages.length,
              symbolizedFrameRows:parsed.symbolizedFrameRows,unknownSymbolFrameRows:parsed.unknownSymbolFrameRows,
              structureUsable:parsed.structureUsable,someSymbolsPresent:parsed.someSymbolsPresent,symbolCoverage:parsed.symbolCoverage,symbolsByImage:parsed.symbolsByImage,mechanismAttributionUsable:null,issues:parsed.issues,note:parsed.note};
            assert.equal(parsed.targetPid,report.processBefore?.os.gpu.pid,'Sampler report PID mismatch');
            assert.equal(parsed.parentPid,report.processBefore?.os.browser.pid,'Sampler report parent mismatch');
            assert.equal(await realpath(parsed.header.Path),report.processBefore?.os.gpu.realExecutable,'Sampler report executable mismatch');
            report.sampleReportIdentityValid=true;
          }
          if(name===sample.metadata.stderr&&/Operation not permitted|permission denied|not authorized|cannot attach|not allowed/i.test(bytes.toString('utf8')))report.sampleUnavailableReason='OS sampling permission/attachment failure';
        }
      }catch(error){append('probeErrors','Sample evidence analysis: '+errorText(error));}
      const before=report.processBefore,after=report.processAfter;
      if(before&&after){
        const a=selectBrowserAndGpu(before.cdp.processInfo),b=selectBrowserAndGpu(after.cdp.processInfo),sameGpu=before.os.gpu.pid===after.os.gpu.pid&&before.os.gpu.startTime===after.os.gpu.startTime,sameBrowser=before.os.browser.pid===after.os.browser.pid&&before.os.browser.startTime===after.os.browser.startTime,wallSeconds=(after.before.monotonicMs-before.before.monotonicMs)/1000;
        report.cpuObservation={beforeTimestamp:before.before,afterTimestamp:after.before,beforeCdpReceived:before.cdpReceived,afterCdpReceived:after.cdpReceived,bracketWallSeconds:wallSeconds,
          gpu:{cdpBeforeSeconds:a.gpu.cpuTime,cdpAfterSeconds:b.gpu.cpuTime,cdpDeltaSeconds:sameGpu?b.gpu.cpuTime-a.gpu.cpuTime:null,osBeforeSeconds:before.os.gpu.cpuSeconds,osAfterSeconds:after.os.gpu.cpuSeconds},
          browser:{cdpBeforeSeconds:a.browser.cpuTime,cdpAfterSeconds:b.browser.cpuTime,cdpDeltaSeconds:sameBrowser?b.browser.cpuTime-a.browser.cpuTime:null},
          note:'CDP CPU time is cumulative across process threads. This actual process-observation bracket includes OS identity, sampling and symbol/report work; it is not exactly the requested8seconds and is never GPU execution time. No delta is clamped or converted from stack counts.'};
      }
      report.rawCollectionComplete=sample.metadata.status==='collected'&&!sample.metadata.outputTruncated&&report.rawSampleFiles?.length===3&&report.rawSampleFiles.every(file=>file.available&&typeof file.sha256==='string')&&report.processIdentityStable===true&&report.sampleReportIdentityValid===true&&report.sampleOverlap.valid&&report.sampleAnalysis?.structureUsable===true;
      report.someSymbolsPresent=report.sampleAnalysis?.someSymbolsPresent===true;
      report.sampleStatus=report.sampleUnavailableReason?'unavailable':report.rawCollectionComplete?(report.someSymbolsPresent?(report.sampleAnalysis.symbolCoverage==='partial'?'complete-raw-partial-symbols':'complete-raw-with-symbols'):'unavailable-symbols'):sample.metadata.status==='collected'?'incomplete':sample.metadata.status;
    }
    report.numericalObservations=report.profile?{frames:report.profile.frames,frameMs:report.profile.metrics?.frameMs,over250ms:report.profile.over250ms,invalidSamples:report.profile.invalidSamples,
      movingSeconds:report.profile.movingSeconds,distanceMetres:report.profile.distanceMetres,note:'Includes the one OS statistical sample and its perturbation. These are diagnostic observations, not a strict gate, baseline comparison, GPU timing or performance-improvement claim.'}:null;
    report.samplingEvidenceUsable=report.diagnosticCaptureCompleted&&report.rawCollectionComplete&&report.someSymbolsPresent&&['errors','failedRequests','probeErrors','integrityErrors','cleanupErrors'].every(key=>report[key].length===0)&&report.droppedErrors===0;
    if(sample&&!sample.metadata.attempted&&report.probeErrors.length){report.sampleStatus='unavailable';report.sampleUnavailableReason??='GPU process or sampling preconditions could not be verified; no sampler launched';}
    report.sampleAttempted=sample?.metadata.attempted??false;report.sampleAttemptCount=sample?.metadata.attempts??0;
    report.samplingUsabilityScope='Usable means a bound, structurally auditable raw statistical observation with some named rows. It does not certify Chrome/ANGLE/driver mechanism attribution; per-image missing symbols remain explicit and mechanismAttributionUsable stays null.';
    report.interpretation='One statistical host-stack observation of this Chrome GPU process. Thread stack observations may include waits and blocked/preempted time; they are not command counts, per-object attribution, GPU execution time or release acceptance. Unknown symbols and absent counts remain explicit. Sampling overhead changes this diagnostic window.';
    report.elapsedWallMs=Date.now()-started;report.phase='finished';await json(resolve(output,'report.json'),report);
    const hashes=[];for(const path of await fileNames(output)){const file=resolve(output,path),information=await stat(file);
      if(information.size>64*1024*1024){hashes.push({path,bytes:information.size,sha256:null,unavailableReason:'Full raw file retained; exceeds64MiB hashing bound. No prefix digest substituted.'});continue;}
      const bytes=await readFile(file);assert.equal(bytes.length,information.size,'Final evidence size changed: '+path);hashes.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
    await json(resolve(output,'evidence-hashes.json'),hashes);
    console.log('BELLE_GPU_SAMPLE_RESULT '+JSON.stringify({sourceHead:report.sourceHead,sourceTree:report.sourceTree,samplingEvidenceUsable:report.samplingEvidenceUsable,
      diagnosticCaptureCompleted:report.diagnosticCaptureCompleted,rawCollectionComplete:report.rawCollectionComplete,releasePerformanceVerified:false,releaseAccepted:false,
      sampleStatus:report.sampleStatus,sampleAttemptCount:report.sampleAttemptCount,heldInputWallMs:report.heldInputWallMs,numericalObservations:report.numericalObservations,
      errors:report.errors,failedRequests:report.failedRequests,probeErrors:report.probeErrors,integrityErrors:report.integrityErrors,cleanupErrors:report.cleanupErrors}));
  }
  if(!report.samplingEvidenceUsable)process.exitCode=1;
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runDiagnostic();
