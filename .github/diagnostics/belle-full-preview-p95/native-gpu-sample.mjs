/** One separately bounded native host-stack observation inside the original ride. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {writeSync} from 'node:fs';
import {access,lstat,open,readFile,realpath,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance as clock} from 'node:perf_hooks';
import {promisify} from 'node:util';

export const NATIVE_GPU_SAMPLE_CONFIG=Object.freeze({
 version:1,offsetMs:64000,requestedSeconds:8,requestedIntervalMs:10,
 rideRequestedMs:90000,executable:'/usr/bin/sample',processTimeoutMs:30000,
 killGraceMs:1000,cdpTimeoutMs:5000,psTimeoutMs:3000,
 maxRawStreamBytes:4*1024*1024,maxReportBytes:64*1024*1024,
 note:'One predeclared window; no retry or release acceptance. Requested duration/interval are not observed timing or stack counts.'
});
const C=NATIVE_GPU_SAMPLE_CONFIG;
const SAMPLE_EXECUTABLE=C.executable,SAMPLE_SECONDS=C.requestedSeconds,SAMPLE_INTERVAL_MS=C.requestedIntervalMs,SAMPLE_PROCESS_TIMEOUT_MS=C.processTimeoutMs;
const FILES=Object.freeze({stdout:'native-gpu-sample.stdout.txt',stderr:'native-gpu-sample.stderr.txt',report:'native-gpu-sample.report.txt'});
const RECEIPT='native-gpu-sample.json';
const exec=promisify(execFile),finite=n=>typeof n==='number'&&Number.isFinite(n);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const errorText=e=>String(e?.stack??e);
const timestamp=now=>({monotonicMs:now(),wallMs:Date.now(),iso:new Date().toISOString()});
async function deadline(promise,label,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
const same=(a,b,label)=>assert.deepEqual(a,b,label);
export const NATIVE_GPU_IDENTITY_POLICY=Object.freeze({version:1,
 product:'Chrome/158.0.8127.89',revision:'@1de57fa19722fa6d6841d4f596c394d015580656',
 appendedSwitches:Object.freeze(['--flag-switches-begin','--flag-switches-end','--enable-unsafe-swiftshader'])});
const IDENTITY_METHODS=Object.freeze(['Browser.getVersion','SystemInfo.getInfo','SystemInfo.getProcessInfo']);

/** CDP serializes Chromium's mutable CommandLine, not the OS launch argv.
 * Only the documented, pinned, non-permission-introducing append is qualified.
 * Both complete ordered vectors and all duplicates remain in the receipt.
 * See NATIVE_IDENTITY.md; the failed version-1 capture stays failed. */
export function compareBrowserCommandLines(osSwitches,systemSwitches,browserVersion){
 for(const [label,values] of [['OS browser',osSwitches],['SystemInfo browser',systemSwitches]]){
  assert(Array.isArray(values)&&values.length>0&&values.length<=4096,label+' switches missing or unbounded');
  for(const value of values)assert(typeof value==='string'&&/^--[a-z0-9][a-z0-9-]*(?:=[^\s"'\\]*)?$/.test(value),label+' malformed switch');
  assert(!values.some(value=>value.split('=')[0]==='--type'),'Browser root must not be a child process');
  validateNativeSwitches(values,label);
 }
 const identical=osSwitches.length===systemSwitches.length&&osSwitches.every((value,i)=>value===systemSwitches[i]);
 if(!identical){
  same(browserVersion?.product,NATIVE_GPU_IDENTITY_POLICY.product,'Unqualified browser product for command-line relation');
  same(browserVersion?.revision,NATIVE_GPU_IDENTITY_POLICY.revision,'Unqualified Chromium revision for command-line relation');
  same(osSwitches.length,43,'Qualified startup extension requires the observed 43-switch launch');
  same(systemSwitches.slice(0,osSwitches.length),osSwitches,'SystemInfo changed the ordered OS launch prefix');
  same(systemSwitches.slice(osSwitches.length),NATIVE_GPU_IDENTITY_POLICY.appendedSwitches,'Unexplained SystemInfo command-line append');
  assert(!osSwitches.some(value=>/^--flag-switches-(?:begin|end)$/.test(value.split('=')[0])),'OS launch already contains flag sentinels');
  same(osSwitches.filter(value=>value.split('=')[0]==='--enable-unsafe-swiftshader'),['--enable-unsafe-swiftshader'],
   'Qualified append requires exactly one existing identical bare fallback-permission switch');
 }
 return {version:1,mode:identical?'identical':'pinned-chromium-in-memory-append',sourceRevision:browserVersion?.revision??null,
  osSwitches:[...osSwitches],systemSwitches:[...systemSwitches],appendedSwitches:systemSwitches.slice(osSwitches.length),
  existingSwitchValuesPreserved:true,fallbackPermissionIntroduced:false};
}
/** Stable actual-backend fields only; dynamic counters remain in raw responses. */
export function nativeRendererIdentity(systemInfo){
 const gpu=systemInfo?.gpu,aux=gpu?.auxAttributes;
 assert(aux&&typeof aux==='object','Actual native GPU information missing');
 same(aux.displayType,'ANGLE_METAL','Actual native display backend changed');
 same(aux.glImplementationParts,'(gl=egl-angle,angle=metal)','Actual native GL implementation changed');
 assert(typeof aux.glRenderer==='string'&&/ANGLE Metal Renderer:/.test(aux.glRenderer)&&!/SwiftShader|llvmpipe|software/i.test(aux.glRenderer),'Actual native Metal renderer required');
 same(aux.inProcessGpu,false,'Separate native GPU process required');
 for(const name of ['glVendor','glVersion'])assert(typeof aux[name]==='string'&&aux[name].length>0,'Actual native '+name+' missing');
 assert(Array.isArray(gpu.devices)&&gpu.devices.length>0&&gpu.devices.length<=16,'Bounded native device inventory required');
 return {displayType:aux.displayType,glImplementationParts:aux.glImplementationParts,glRenderer:aux.glRenderer,
  glVendor:aux.glVendor,glVersion:aux.glVersion,inProcessGpu:aux.inProcessGpu,skiaBackendType:aux.skiaBackendType??null,
  devices:gpu.devices.map(device=>Object.fromEntries(['vendorId','deviceId','vendorString','deviceString','driverVendor','driverVersion']
   .filter(key=>Object.hasOwn(device,key)).map(key=>[key,device[key]])))};
}
function validateFreshCdpObservations(snapshot){
 assert(Array.isArray(snapshot.collectionErrors)&&snapshot.collectionErrors.length===0,'Fresh native identity collection failed');
 assert(Array.isArray(snapshot.cdpObservations)&&snapshot.cdpObservations.length===IDENTITY_METHODS.length,'Exactly three fresh CDP identity observations required');
 same(snapshot.cdpObservations.map(row=>row.method),IDENTITY_METHODS,'Fresh CDP identity methods changed');
 for(const row of snapshot.cdpObservations){
  same(row.params,{});same(row.status,'response','Fresh CDP identity response failed');same(row.error,null);
  assert(finite(row.started?.monotonicMs)&&finite(row.received?.monotonicMs)&&
   row.started.monotonicMs>=snapshot.before.monotonicMs&&row.received.monotonicMs>=row.started.monotonicMs&&
   row.received.monotonicMs<=snapshot.cdpReceived.monotonicMs,'Fresh CDP identity timing is outside its observation bracket');
  assert(row.received.monotonicMs-row.started.monotonicMs<=C.cdpTimeoutMs,'Fresh CDP identity exceeded its fixed deadline');
 }
 same(snapshot.browserVersion,snapshot.cdpObservations[0].response,'Fresh browser-version response changed');
 same(snapshot.systemInfo,snapshot.cdpObservations[1].response,'Fresh SystemInfo response changed');
 same(snapshot.cdp,snapshot.cdpObservations[2].response,'Fresh process-list response changed');
 same(snapshot.browserCommandLine,snapshot.systemInfo?.commandLine,'Fresh command-line binding changed');
 assert(/^Chrome\//.test(snapshot.browserVersion?.product??'')&&/^@[a-f0-9]{40}$/.test(snapshot.browserVersion?.revision??''),'Actual official browser identity missing');
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
export function parseMacCommandLine(commandLine,executable,label='Process'){
 // Chromium's POSIX command-line string and ps args are flattened, not shell-escaped argv.
 // Corroborate only this controlled switch-only launch; never interpret quotes/escapes or
 // guess boundaries for whitespace-bearing values. The full observed strings are retained.
 assert(typeof commandLine==='string'&&commandLine.trim().length>0&&Buffer.byteLength(commandLine)<=1024*1024,label+' command-line evidence must be nonempty and bounded');
 assert(typeof executable==='string'&&executable.startsWith('/')&&!/[\x00-\x1f\x7f"'\\]/.test(executable),label+' executable path is ambiguous');
 assert(!/[\x00-\x1f\x7f"'\\]/.test(commandLine),label+' command-line evidence has ambiguous quoting, escaping or control characters');
 assert(commandLine.startsWith(executable+' '),label+' command-line executable does not match OS executable');
 const suffix=commandLine.slice(executable.length+1);
 assert(suffix.length>0&&suffix===suffix.trim(),label+' command-line switches are missing or ambiguous');
 const switches=suffix.split(/ +/);assert(switches.length<=4096,label+' command-line switch bound exceeded');
 for(const value of switches)assert(/^--[a-z0-9][a-z0-9-]*(?:=[^\s"'\\]*)?$/.test(value),label+' command-line has an ambiguous or unsupported argument: '+value);
 return switches;
}
export function validateNativeSwitches(switches,label='Browser'){
 for(const required of ['--enable-gpu','--use-gl=angle','--use-angle=metal']){
  const name=required.split('=')[0],matches=switches.filter(value=>value.split('=')[0]===name);
  assert.equal(matches.length,1,label+' requires exactly one native launch switch: '+name);
  assert.equal(matches[0],required,label+' native launch switch has a conflicting value: '+name);
 }
 for(const value of switches){
  assert(!/^--(?:disable-gpu|disable-gpu-compositing)(?:=|$)/.test(value),label+' has a conflicting native GPU switch');
  assert(!/^--(?:enable-gpu-debugging|enable-gpu-client-logging|enable-gpu-command-logging|enable-gpu-service-(?:logging|tracing)|trace-startup(?:-[a-z0-9-]+)?|trace-config-file|enable-tracing)(?:=|$)/.test(value),label+' has a forbidden additional instrumentation switch');
 }
}
export function validateProcessIdentity(snapshot,baseline=null,expected=null){
 validateFreshCdpObservations(snapshot);
 const nativeRenderer=nativeRendererIdentity(snapshot.systemInfo);
 if(expected){
  same(snapshot.browserVersion,expected.browserVersion,'Fresh browser identity differs from original browser receipt');
  same(snapshot.browserCommandLine,expected.systemInfo?.commandLine,'Fresh browser arguments differ from original SystemInfo receipt');
  same(nativeRenderer,nativeRendererIdentity(expected.systemInfo),'Fresh renderer differs from original SystemInfo receipt');
 }
 const selected=selectBrowserAndGpu(snapshot.cdp.processInfo),{browser,gpu}=snapshot.os;
 assert(Number.isSafeInteger(snapshot.currentUid)&&snapshot.currentUid>=0,'Known current user required');
 assert.equal(snapshot.currentUid,snapshot.currentEffectiveUid,'Real/effective user must match; no elevation');
 for(const [name,row] of Object.entries({browser,gpu})){
  assert.equal(row.pid,selected[name].id,'OS/CDP '+name+' PID mismatch');assert.equal(row.uid,snapshot.currentUid,'Target must belong to same CI user');
  assert(row.executable.startsWith('/')&&row.realExecutable.startsWith('/'),'Absolute OS executable path required');
 }
 assert.equal(gpu.ppid,browser.pid,'GPU process must be a direct child of this CDP browser');
 const systemSwitches=parseMacCommandLine(snapshot.browserCommandLine,browser.executable,'SystemInfo browser');
 const osSwitches=parseMacCommandLine(browser.args,browser.executable,'OS browser');
 const gpuSwitches=parseMacCommandLine(gpu.args,gpu.executable,'OS GPU');
 const bundle=browser.realExecutable.match(/^(.+\.app)\/Contents\//)?.[1];
 assert(bundle&&/Google Chrome\.app$/.test(bundle),'Official Chrome channel app required');
 assert(gpu.realExecutable.startsWith(bundle+'/Contents/'),'GPU executable must belong to the same Chrome bundle');
 assert.deepEqual(gpuSwitches.filter(value=>value.split('=')[0]==='--type'),['--type=gpu-process'],'Exactly one OS GPU command type required');
 const commandLineRelation=compareBrowserCommandLines(osSwitches,systemSwitches,snapshot.browserVersion);
 same(snapshot.browserCommandLine,browser.args+(commandLineRelation.mode==='identical'?'':' '+NATIVE_GPU_IDENTITY_POLICY.appendedSwitches.join(' ')),
  'Raw command-line strings do not match the qualified relation');
 commandLineRelation.rawOsCommandLine=browser.args;
 commandLineRelation.rawSystemCommandLine=snapshot.browserCommandLine;
 if(baseline){
  same(snapshot.browserVersion,baseline.browserVersion,'Fresh browser version changed');
  same(snapshot.browserCommandLine,baseline.browserCommandLine,'Fresh browser command line changed');
  same(nativeRenderer,nativeRendererIdentity(baseline.systemInfo),'Fresh native renderer identity changed');
  for(const name of ['browser','gpu']){
   const prior=baseline.os[name],current=snapshot.os[name];
   for(const key of ['pid','ppid','uid','user','startTime','executable','realExecutable','args'])assert.equal(current[key],prior[key],name+' process identity changed: '+key);
   assert(selected[name].cpuTime>=selectBrowserAndGpu(baseline.cdp.processInfo)[name].cpuTime,'CDP CPU time moved backwards');
   assert(current.cpuSeconds>=prior.cpuSeconds,'OS CPU time moved backwards');
  }
 }
 return {browserPid:browser.pid,gpuPid:gpu.pid,sameUser:true,directBrowserChild:true,stable:baseline!==null,commandLineRelation,nativeRenderer};
}
export function makeSingleSampleRunner(output,{spawnImpl=spawn,timeoutMs=SAMPLE_PROCESS_TIMEOUT_MS,killGraceMs=1000,now=()=>clock.now()}={}){
 const stamp=()=>timestamp(now);
 let attempted=false;
 const metadata={attempted:false,attempts:0,status:'not-started',executable:SAMPLE_EXECUTABLE,requestedSeconds:SAMPLE_SECONDS,
  requestedIntervalMs:SAMPLE_INTERVAL_MS,timeoutMs,killGraceMs,stdout:FILES.stdout,stderr:FILES.stderr,report:FILES.report,
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
    const finish=()=>{if(completed)return;completed=true;clearTimeout(timer);clearTimeout(killTimer);clearTimeout(finalTimer);metadata.finished=stamp();metadata.terminationConfirmedAtFinish=metadata.exitObserved;metadata.cleanupComplete=metadata.exitObserved&&metadata.cleanupErrors.length===0;resolveDone();};
    const signal=kind=>{metadata.signals.push({signal:kind,...stamp()});try{metadata.signals.at(-1).sent=child.kill(kind);}catch(error){metadata.cleanupErrors.push(errorText(error));}};
    const cancel=reason=>{
     if(metadata.cancelReason)return;metadata.cancelReason=reason;signal('SIGTERM');
     killTimer=setTimeout(()=>{signal('SIGKILL');finalTimer=setTimeout(()=>{metadata.cleanupErrors.push('Sampler exit not observed after SIGKILL');
       for(const stream of [child.stdout,child.stderr]){stream.removeAllListeners('data');stream.destroy();}
       // Keep the close listener, but release handles after the fixed cleanup bound.
       // Unref is not proof of termination; successful replay requires observed exit.
       for(const stream of [child.stdout,child.stderr])stream.unref?.();child.unref?.();finish();},killGraceMs);},killGraceMs);
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
      if(match&&!metadata.phaseSignals.some(row=>row.kind===kind))metadata.phaseSignals.push({kind,stream:name,streamEventOrdinal:metadata.streamEvents.length,receivedBytes:metadata[key],text:match[0],declaredPid:kind==='sampling-start'?Number(match[1]):null,declaredSeconds:kind==='sampling-start'?Number(match[2]):null,declaredIntervalMs:kind==='sampling-start'?Number(match[3]):null,...stamp()});
     }
     if(kept.length<bytes.length){metadata.outputTruncated=true;cancel('raw-stream-byte-bound');}
    };
    try{child=spawnImpl(SAMPLE_EXECUTABLE,metadata.argv,{stdio:['ignore','pipe','pipe'],windowsHide:true});}
    catch(error){metadata.errors.push(errorText(error));metadata.spawnUnavailable=true;finish();return;}
    child.once('spawn',()=>{if(completed)return;metadata.spawned=stamp();metadata.samplerPid=child.pid;metadata.status='running';});
    child.stdout.on('data',data=>consume('stdout',stdout,data));child.stderr.on('data',data=>consume('stderr',stderr,data));
    for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]])stream.on('error',error=>{if(completed)return;metadata.errors.push(name+' stream: '+errorText(error));cancel('raw-stream-error');});
    child.on('error',error=>{if(completed)return;metadata.errors.push(errorText(error));if(!metadata.spawned){metadata.spawnUnavailable=true;finish();}});
    child.once('close',(code,signal)=>{if(completed){
     const late={exitCode:code,exitSignal:signal,observed:stamp(),terminationConfirmedAtFinish:metadata.terminationConfirmedAtFinish,note:'Late close observed after bounded cleanup returned. The original finish-time uncertainty is not rewritten.'};
     void writeFile(resolve(output,'native-gpu-sample.late-exit.json'),JSON.stringify(late,null,2)+'\n',{flag:'wx'}).catch(()=>{});return;}metadata.exitCode=code;metadata.exitSignal=signal;metadata.exitObserved=true;finish();});
    timer=setTimeout(()=>cancel('process-timeout'),timeoutMs);
   });
  }catch(error){metadata.errors.push(errorText(error));metadata.finished??=stamp();}
  finally{for(const file of [stdout,stderr])try{await file?.close();}catch(error){metadata.cleanupErrors.push(errorText(error));}}
  metadata.status=metadata.spawnUnavailable?'unavailable':metadata.cancelReason?'partial':metadata.exitCode===0&&metadata.exitObserved&&metadata.errors.length===0&&metadata.cleanupErrors.length===0?'collected':'failed';
  metadata.elapsedMs=metadata.requested&&metadata.finished?metadata.finished.monotonicMs-metadata.requested.monotonicMs:null;
  return metadata;
 }};
}
/** Parse retained native text without inventing missing observations or resolving symbols. */
export function parseNativeSampleReport(text){
 assert(typeof text==='string'&&Buffer.byteLength(text)<=C.maxReportBytes,'Sample report exceeds byte bound');
 const parts=text.split('\n');assert(parts.length<=250000,'Sample report exceeds line bound');
 const terminated=text.endsWith('\n');if(terminated)parts.pop();
 const rawLines=parts.map((part,i)=>{const hasEnding=i<parts.length-1||terminated,crlf=hasEnding&&part.endsWith('\r');
  return {lineNumber:i+1,raw:crlf?part.slice(0,-1):part,lineEnding:hasEnding?(crlf?'\r\n':'\n'):''};});
 const out={format:'macos-sample-text',parserVersion:3,header:{},declaredGlobalSampleCount:null,declaredIntervalMs:null,
  rawLines,rootCountMeaning:'Observation groups; repeated IDs and Thread_<multiple> do not establish a distinct-thread count.',
  threadRoots:[],inclusiveFrames:[],binaryImages:[],unparsedGraphLines:[],issues:[],symbolizedFrameRows:0,unknownSymbolFrameRows:0,
  namedFrameRows:0,unresolvedNamedFrameRows:0,largeOffsetNamedFrameRows:0,collapsedFrameRows:0,incompleteLocationFrameRows:0,
  retainedLocationCount:0,
  symbolsByImage:{},mechanismAttributionUsable:null,
  note:'Inclusive row counts are statistical observations, not function calls, distinct threads, per-location counts, per-frame attribution, CPU milliseconds or GPU execution. Requested8s/10ms never supplies an observed count. Large offsets from a named export are unresolved, not recovered function symbols; small named offsets do not prove complete symbol resolution. Collapsed locations retain one row count; ellipses explicitly omit locations. Every raw line remains authoritative.'};
 let mode='header',currentThread=null;
 const issue=m=>{assert(out.issues.length<1000,'Sample issue bound exceeded');out.issues.push(m);};
 const list=(value,kind)=>{
  // Cap before allocating an unbounded per-row list; native addresses are at
  // most 64 bits. An ellipsis is the only accepted omitted-location marker.
  const entries=value.split(',',1026).map(x=>x.trim()),incomplete=entries.at(-1)==='...';
  if(incomplete)entries.pop();
  if(!entries.length||entries.length>1024||entries.some(x=>!(kind==='address'?/^0x[0-9a-f]{1,16}$/i:/^\d{1,16}$/).test(x)))return null;
  if(kind==='offset'&&entries.some(x=>!Number.isSafeInteger(Number(x))))return null;
  return {entries,incomplete};
 };
 for(const {raw:line,lineNumber} of rawLines){
  if(/^Call graph:\s*$/.test(line)){mode='graph';continue;}
  if(/^Binary Images:\s*$/.test(line)){mode='images';continue;}
  if(mode==='graph'&&/^(?:Total number in stack|Sort by top of stack|Sort by total)/.test(line)){mode='aggregate';continue;}
  if(mode==='header'){
   const field=line.match(/^([A-Za-z][A-Za-z /()-]+):\s*(.*)$/);
   if(field){if(Object.hasOwn(out.header,field[1]))issue('Duplicate header field: '+field[1]);else out.header[field[1]]=field[2];}
   const interval=line.match(/^Analysis of sampling .* every ([\d.]+) milliseconds?/);
   if(interval){if(out.declaredIntervalMs!==null)issue('Duplicate sampling-interval declaration');out.declaredIntervalMs=Number(interval[1]);}
   const global=line.match(/^(?:Total samples|Number of samples|Sample count):\s*(\d+)\s*$/);
   if(global){if(out.declaredGlobalSampleCount!==null)issue('Duplicate global-count declaration');out.declaredGlobalSampleCount=Number(global[1]);if(!Number.isSafeInteger(out.declaredGlobalSampleCount)||out.declaredGlobalSampleCount<=0)issue('Invalid global-count declaration');}
  }else if(mode==='graph'&&line.trim()){
   const row=line.match(/^([ \t+!:|]*)(\d+)[ \t]+(.+)$/);
   if(!row){assert(out.unparsedGraphLines.length<10000,'Unparsed graph bound exceeded');out.unparsedGraphLines.push({lineNumber,raw:line});continue;}
   const count=Number(row[2]),body=row[3];
   if(!Number.isSafeInteger(count)||count<=0){issue('Invalid positive stack count at '+lineNumber);continue;}
   // These are root observation groups, not a census of distinct OS threads.
   const root=body.match(/^(Thread_(?:0x[0-9A-Fa-f]+|[0-9A-Fa-f]+|<multiple>)|Thread[ \t]+\d+)(?=$|[ \t:])/);
   if(root){
    assert(out.threadRoots.length<1024,'Thread-root bound exceeded');currentThread=out.threadRoots.length;
    const grouped=root[1]==='Thread_<multiple>';
    out.threadRoots.push({lineNumber,count,identity:body,prefix:row[1],raw:line,
     kind:grouped?'multiple-thread-group':'thread-observation-group',threadId:grouped?null:root[1].replace(/^Thread(?:_|[ \t]+)/,''),
     distinctThreadCount:null});continue;
   }
   if(currentThread===null){issue('Frame without thread root at '+lineNumber);continue;}
   assert(out.inclusiveFrames.length<100000,'Frame-row bound exceeded');
   // Parse the address suffix separately so image names may contain parentheses.
   // Multiple displayed locations remain one inclusive row, never expanded counts.
   const tail=body.match(/^(.+?)[ \t]+\[([^\]]+)\](?:[ \t]+(.*))?$/);
   const frame=tail?.[1].match(/^(.+?)[ \t]+\(in[ \t]+(.+)\)(.*)$/);
   let symbol=frame?.[1]?.trim()??null,image=frame?.[2]?.trim()??null,locations=[],locationsComplete=false,
    locationKind=null,loadAddress=null,parsed=!!frame,offsetValues=null;
   // A greedy image match must not swallow a malformed offset or an unmatched
   // delimiter. Real image names such as "Test (GPU)" remain balanced.
   let imageDepth=0;
   if(!image)parsed=false;
   else for(const character of image){
    if(character==='(')imageDepth++;
    else if(character===')'&&--imageDepth<0){parsed=false;break;}
   }
   if(imageDepth!==0)parsed=false;
   const addresses=tail?list(tail[2],'address'):null;
   if(!addresses||tail?.[3])parsed=false;
   const inlineOffset=symbol?.match(/[ \t]+\+[ \t]+(.+)$/);
   let trailing=frame?.[3]?.trim()??'';
   if(inlineOffset){
    if(trailing)parsed=false;
    else trailing='+ '+inlineOffset[1];
    symbol=symbol.slice(0,inlineOffset.index).trim();
   }
   const unknownSymbol=!symbol||/^(?:\?+|0x[0-9a-f]+|unknown)(?:[ \t]|$)/i.test(symbol);
   if(parsed){
    if(!trailing){
     locationKind='address-only';
     if(addresses.entries.length!==1||addresses.incomplete)parsed=false;
    }else if(/^\+[ \t]+/.test(trailing)){
     locationKind='symbol-relative';offsetValues=list(trailing.replace(/^\+[ \t]+/,''),'offset');
     if(!offsetValues||offsetValues.entries.length!==addresses.entries.length||offsetValues.incomplete!==addresses.incomplete)parsed=false;
    }else{
     const load=trailing.match(/^load[ \t]+address[ \t]+(0x[0-9a-f]{1,16})[ \t]+\+[ \t]+(0x[0-9a-f]{1,16})$/i);
     if(!load||!unknownSymbol||addresses.entries.length!==1||addresses.incomplete)parsed=false;
     else{
      locationKind='load-address-relative';loadAddress=load[1];
      const relative=BigInt(load[2]);
      if(relative>BigInt(Number.MAX_SAFE_INTEGER)||BigInt(load[1])+relative!==BigInt(addresses.entries[0]))parsed=false;
      else offsetValues={entries:[load[2]],incomplete:false};
     }
    }
   }
   if(parsed){
    assert(out.retainedLocationCount+addresses.entries.length<=100000,'Total retained-location bound exceeded');
    out.retainedLocationCount+=addresses.entries.length;
    locationsComplete=!addresses.incomplete;
    locations=addresses.entries.map((address,i)=>({address,offsetText:offsetValues?.entries[i]??null,
     offsetBytes:offsetValues?Number(offsetValues.entries[i]):null}));
   }else issue('Unparsed or inconsistent native frame retained at '+lineNumber);
   const collapsed=parsed&&(locations.length>1||!locationsComplete);
   const named=parsed&&!unknownSymbol;
   const largeOffset=named&&locations.some(location=>location.offsetBytes!==null&&location.offsetBytes>4096);
   const unresolvedNamed=named&&(largeOffset||!locationsComplete);
   const symbolized=named&&!unresolvedNamed;
   if(named)out.namedFrameRows++;
   if(symbolized)out.symbolizedFrameRows++;
   if(!named)out.unknownSymbolFrameRows++;
   if(unresolvedNamed)out.unresolvedNamedFrameRows++;
   if(largeOffset)out.largeOffsetNamedFrameRows++;
   if(collapsed)out.collapsedFrameRows++;
   if(parsed&&!locationsComplete)out.incompleteLocationFrameRows++;
   const imageKey=image??'<unidentified>';
   if(!Object.hasOwn(out.symbolsByImage,imageKey))Object.defineProperty(out.symbolsByImage,imageKey,{value:{namedFrameRows:0,symbolizedFrameRows:0,unknownFrameRows:0,unresolvedNamedFrameRows:0,largeOffsetNamedFrameRows:0},enumerable:true,writable:true,configurable:true});
   const byImage=out.symbolsByImage[imageKey];
   byImage[named?'namedFrameRows':'unknownFrameRows']++;if(symbolized)byImage.symbolizedFrameRows++;
   if(unresolvedNamed)byImage.unresolvedNamedFrameRows++;if(largeOffset)byImage.largeOffsetNamedFrameRows++;
   out.inclusiveFrames.push({lineNumber,thread:currentThread,count,prefix:row[1],symbol,image,named,symbolized,
    offsetBytes:parsed&&!collapsed?locations[0]?.offsetBytes??null:null,largeOffset,unresolvedNamed,
    address:parsed&&!collapsed?locations[0]?.address??null:null,locationKind,loadAddress,locations,collapsed,locationsComplete,
    trailingAnnotation:tail?.[3]??null,parsed,raw:line});
  }else if(mode==='images'&&line.trim()){
   const row=line.match(/^\s*(0x[0-9a-f]+)\s*-\s*(0x[0-9a-f]+)\s+(.+)$/i);
   if(!row){issue('Unparsed binary-image line '+lineNumber);continue;}
   assert(out.binaryImages.length<10000,'Binary-image bound exceeded');
   out.binaryImages.push({lineNumber,startAddress:row[1],endAddress:row[2],uuid:row[3].match(/<([0-9a-f-]+)>/i)?.[1]??null,
    path:row[3].match(/\s(\/.*)$/)?.[1]??null,description:row[3],raw:line});
  }
 }
 const target=out.header.Process?.match(/\[(\d+)\]\s*$/)?.[1],parent=out.header['Parent Process']?.match(/\[(\d+)\]\s*$/)?.[1];
 out.targetPid=target===undefined?null:Number(target);out.parentPid=parent===undefined?null:Number(parent);
 if(!Number.isSafeInteger(out.targetPid)||out.targetPid<=0)issue('Missing or invalid target PID');
 if(!Number.isSafeInteger(out.parentPid)||out.parentPid<=0)issue('Missing or invalid parent PID');
 if(out.declaredIntervalMs!==C.requestedIntervalMs)issue('Missing or mismatched interval declaration');
 if(!out.threadRoots.length||!out.inclusiveFrames.length)issue('Missing thread roots or call stacks');
 if(out.unparsedGraphLines.length)issue('Unrecognized call-graph lines retained');
 if(!out.binaryImages.some(r=>r.uuid&&r.path))issue('Missing auditable binary-image metadata');
 out.structureUsable=out.issues.length===0;
 out.someSymbolsPresent=out.symbolizedFrameRows>0;
 out.symbolCoverage=out.symbolizedFrameRows===0?'unavailable':out.unknownSymbolFrameRows>0||out.unresolvedNamedFrameRows>0||out.incompleteLocationFrameRows>0?'partial':'all-parsed-frames-named';
 return out;
}

export function nativeSampleOverlap(sample,ride){
 const start=sample.requested?.monotonicMs,end=sample.finished?.monotonicMs;
 const started=sample.phaseSignals?.find(r=>r.kind==='sampling-start'),complete=sample.phaseSignals?.find(r=>r.kind==='sampling-complete');
 const contained=(a,b)=>finite(a)&&finite(b)&&finite(ride.startHostMs)&&finite(ride.stopHostMs)&&a>=ride.startHostMs&&b>=a&&b<=ride.stopHostMs;
 const entireProcessContained=contained(start,end);
 const signaledCaptureContained=!!started&&!!complete&&started.declaredPid===Number(sample.argv?.[0])&&started.declaredSeconds===C.requestedSeconds&&started.declaredIntervalMs===C.requestedIntervalMs&&
  finite(started.monotonicMs)&&started.monotonicMs>=start&&complete.monotonicMs>=started.monotonicMs&&contained(start,complete.monotonicMs);
 return {entireProcessContained,signaledCaptureContained,rideStartHostMs:ride.startHostMs,rideStopHostMs:ride.stopHostMs,
  samplerRequestedHostMs:start??null,samplerFinishedHostMs:end??null,completionSignalHostMs:complete?.monotonicMs??null,
  valid:finite(ride.startHostMs)&&finite(ride.stopHostMs)&&ride.stopHostMs>ride.startHostMs&&(entireProcessContained||signaledCaptureContained),
  note:'The request precedes process creation and is the conservative lower bound. Either the full subprocess or its matching declared sampling-complete signal must fit inside the observed native-input host bracket. Signal receipt may be later than actual sampling. No exact observed8s is inferred.'};
}

function psCommands(pid){return [['-ww','-p',String(pid),'-o','pid=,ppid=,uid=,user=,lstart=,time=,comm='],['-ww','-p',String(pid),'-o','args=']];}
async function osProcess(pid,now){
 const before=timestamp(now),commands=psCommands(pid),options={encoding:'utf8',timeout:C.psTimeoutMs,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C',LANG:'C'}};
 const values=await Promise.all(commands.map(argv=>exec('/bin/ps',argv,options)));
 const row=parsePsIdentity(values[0].stdout,values[1].stdout);row.realExecutable=await realpath(row.executable);
 return {...row,observationBefore:before,observationAfter:timestamp(now),commands:commands.map((argv,i)=>({executable:'/bin/ps',argv,stdout:values[i].stdout,stderr:values[i].stderr,exitCode:0}))};
}
export async function captureNativeIdentitySnapshot(session,now=()=>clock.now(),testing={}){
 const value={before:timestamp(now),cdpReceived:null,after:null,currentUid:(testing.getuid??process.getuid)(),
  currentEffectiveUid:(testing.geteuid??process.geteuid)(),cdpObservations:[],collectionErrors:[],
  browserVersion:null,systemInfo:null,cdp:null,browserCommandLine:null,os:{browser:null,gpu:null}};
 value.cdpObservations=await Promise.all(IDENTITY_METHODS.map(async method=>{
  const row={method,params:{},started:timestamp(now),received:null,status:'pending',response:null,error:null};
  try{row.response=await deadline(Promise.resolve().then(()=>session.send(method,{})),'GPU identity '+method,C.cdpTimeoutMs);row.status='response';}
  catch(error){row.status='error';row.error=errorText(error);}
  row.received=timestamp(now);return row;
 }));
 value.cdpReceived=timestamp(now);
 [value.browserVersion,value.systemInfo,value.cdp]=value.cdpObservations.map(row=>row.response);
 value.browserCommandLine=value.systemInfo?.commandLine??null;
 for(const row of value.cdpObservations)if(row.status!=='response')value.collectionErrors.push({where:row.method,error:row.error});
 if(value.collectionErrors.length===0){
  try{
   const selected=selectBrowserAndGpu(value.cdp?.processInfo),observeOs=testing.osProcess??osProcess;
   const results=await Promise.allSettled(['browser','gpu'].map(name=>observeOs(selected[name].id,now)));
   for(const [i,result] of results.entries()){
    const name=['browser','gpu'][i];
    if(result.status==='fulfilled')value.os[name]=result.value;
    else value.collectionErrors.push({where:'OS '+name,error:errorText(result.reason)});
   }
  }catch(error){value.collectionErrors.push({where:'process selection',error:errorText(error)});}
 }
 value.after=timestamp(now);return value;
}
function replaySnapshot(value,prior=null,expected=null){
 assert(value&&finite(value.before?.monotonicMs)&&finite(value.after?.monotonicMs)&&value.after.monotonicMs>=value.before.monotonicMs,'Malformed native process observation bracket');
 assert(finite(value.cdpReceived?.monotonicMs)&&value.cdpReceived.monotonicMs>=value.before.monotonicMs&&value.cdpReceived.monotonicMs<=value.after.monotonicMs,'Malformed CDP observation time');
 validateFreshCdpObservations(value);
 for(const name of ['browser','gpu']){
  const row=value.os?.[name];assert(row&&Array.isArray(row.commands)&&row.commands.length===2,'Missing raw ps observations');
  const expected=psCommands(row.pid);
  for(const [i,command] of row.commands.entries()){
   assert.equal(command.executable,'/bin/ps');same(command.argv,expected[i]);assert.equal(command.exitCode,0);
   assert(typeof command.stdout==='string'&&typeof command.stderr==='string'&&Buffer.byteLength(command.stdout)<=1024*1024&&Buffer.byteLength(command.stderr)<=1024*1024,'Unbounded ps evidence');
  }
  const parsed=parsePsIdentity(row.commands[0].stdout,row.commands[1].stdout);
  for(const [key,expected] of Object.entries(parsed))same(row[key],expected,'Raw ps replay mismatch: '+name+'.'+key);
  assert(finite(row.observationBefore?.monotonicMs)&&finite(row.observationAfter?.monotonicMs)&&row.observationBefore.monotonicMs>=value.cdpReceived.monotonicMs&&row.observationAfter.monotonicMs>=row.observationBefore.monotonicMs&&row.observationAfter.monotonicMs<=value.after.monotonicMs,'Malformed raw ps observation time');
 }
 if(prior)assert(value.before.monotonicMs>=prior.after.monotonicMs,'Process identity observations out of order');
 return validateProcessIdentity(value,prior,expected);
}
function replayPhaseSignals(sample,raw){
 assert(Array.isArray(sample.streamEvents)&&sample.streamEvents.length<=256,'Missing bounded raw-stream observations');
 const totals={stdout:0,stderr:0},events=[];let prior=sample.requested.monotonicMs;
 for(const event of sample.streamEvents){
  assert(Object.hasOwn(totals,event.stream)&&Number.isSafeInteger(event.bytes)&&event.bytes>0&&event.retainedBytes===event.bytes,'Malformed/unretained native output chunk');
  assert(finite(event.monotonicMs)&&event.monotonicMs>=prior&&event.monotonicMs<=sample.finished.monotonicMs,'Native output chunk timing is out of order');prior=event.monotonicMs;
  const start=totals[event.stream];totals[event.stream]+=event.bytes;events.push({event,start,end:totals[event.stream]});
 }
 for(const stream of ['stdout','stderr'])same(totals[stream],raw[stream].length,'Raw output chunk accounting changed');
 const observed=[];
 for(const stream of ['stdout','stderr']){
  const text=raw[stream].toString('utf8');
  for(const match of text.matchAll(/Sampling process (\d+) for ([\d.]+) seconds? with ([\d.]+) milliseconds?/ig))observed.push({kind:'sampling-start',stream,text:match[0],declaredPid:Number(match[1]),declaredSeconds:Number(match[2]),declaredIntervalMs:Number(match[3])});
  for(const match of text.matchAll(/Sampling completed, processing symbols/ig))observed.push({kind:'sampling-complete',stream,text:match[0],declaredPid:null,declaredSeconds:null,declaredIntervalMs:null});
 }
 assert(Array.isArray(sample.phaseSignals)&&sample.phaseSignals.length<=2&&sample.phaseSignals.every(r=>['sampling-start','sampling-complete'].includes(r.kind)),'Invalid bounded phase receipts');
 for(const kind of ['sampling-start','sampling-complete']){
  const found=observed.filter(r=>r.kind===kind),retained=sample.phaseSignals.filter(r=>r.kind===kind);
  assert(found.length<=1,'Multiple native phase declarations retained; cannot choose a favorable one');same(retained.length,found.length,'Native phase declaration/receipt mismatch');
  if(found.length){const receipt=retained[0];for(const [k,v] of Object.entries(found[0]))same(receipt[k],v,'Native phase raw replay mismatch: '+k);
   assert(Number.isSafeInteger(receipt.streamEventOrdinal)&&receipt.streamEventOrdinal>=1&&receipt.streamEventOrdinal<=events.length,'Native phase has no raw output chunk');
   const chunk=events[receipt.streamEventOrdinal-1];same(receipt.stream,chunk.event.stream);same(receipt.receivedBytes,chunk.end);
   assert(raw[receipt.stream].subarray(0,chunk.end).toString('utf8').includes(receipt.text)&&!raw[receipt.stream].subarray(0,chunk.start).toString('utf8').includes(receipt.text),'Native phase is not bound to its first complete raw declaration');
   const upper=events[receipt.streamEventOrdinal]?.event.monotonicMs??sample.finished.monotonicMs;
   assert(finite(receipt.monotonicMs)&&receipt.monotonicMs>=chunk.event.monotonicMs&&receipt.monotonicMs<=upper,'Native phase receipt is outside its output-chunk bracket');}
 }
 const declaredStart=observed.find(r=>r.kind==='sampling-start')??null;
 if(declaredStart){same(declaredStart.declaredPid,Number(sample.argv[0]),'Native start declaration names a different target');same(declaredStart.declaredSeconds,C.requestedSeconds,'Native duration declaration changed');same(declaredStart.declaredIntervalMs,C.requestedIntervalMs,'Native interval declaration changed');}
 return {declaredStart,declaredComplete:observed.find(r=>r.kind==='sampling-complete')??null};
}

/** Replays successful collection from raw files and explicitly supplied external bindings. */
export async function verifyNativeGpuSample(receipt,{readCapturedFile,rideStartHostMs,rideStopHostMs,browserVersion,systemInfo}){
 assert.equal(typeof readCapturedFile,'function');same(receipt.version,2,'Fresh-identity receipt version required');same(receipt.config,C,'Native sample controls changed');
 assert.equal(receipt.diagnosticOnly,true);assert.equal(receipt.releaseAcceptance,false);assert.equal(receipt.mechanismAttributionUsable,null);
 assert.equal(receipt.platform,'darwin');same(receipt.browserVersion,browserVersion,'Browser version binding changed');same(receipt.systemInfo,systemInfo,'System identity binding changed');
 assert(typeof browserVersion?.product==='string'&&/^Chrome\//.test(browserVersion.product),'Official native browser version missing');
 assert(typeof systemInfo?.commandLine==='string','Native SystemInfo command line absent');
 assert(finite(rideStartHostMs)&&finite(rideStopHostMs)&&rideStopHostMs>rideStartHostMs,'Original native host input bracket missing');
 same(receipt.ride.startHostMs,rideStartHostMs,'First native down-completion binding changed');same(receipt.ride.stopHostMs,rideStopHostMs,'First native up-request binding changed');
 same(receipt.ride.scheduledHostMs,rideStartHostMs+C.offsetMs);
 assert(finite(receipt.taskStartedHostMs)&&receipt.taskStartedHostMs>=receipt.ride.scheduledHostMs,'Sampler task started before predefined offset');
 assert(Array.isArray(receipt.errors)&&receipt.errors.length===0,'Native sampler has collection errors');
 assert.equal(receipt.singleTaskAttempts,1,'Exactly one scheduled task required');
 const expected={browserVersion,systemInfo};
 const initial=replaySnapshot(receipt.initialSnapshot,null,expected),before=replaySnapshot(receipt.beforeSnapshot,receipt.initialSnapshot,expected),after=replaySnapshot(receipt.afterSnapshot,receipt.beforeSnapshot,expected);
 same(receipt.processIdentity,{initial,before,after},'Captured process-identity relations did not replay exactly');
 const sample=receipt.sample;
 same(sample.executable,C.executable);same(sample.requestedSeconds,C.requestedSeconds);same(sample.requestedIntervalMs,C.requestedIntervalMs);
 same(sample.timeoutMs,C.processTimeoutMs);same(sample.killGraceMs,C.killGraceMs);assert.equal(sample.attempted,true);assert.equal(sample.attempts,1);
 assert(typeof receipt.outputDirectory==='string'&&receipt.outputDirectory.startsWith('/'),'Absolute captured output-directory receipt required');
 same(sample.argv,[String(before.gpuPid),String(C.requestedSeconds),String(C.requestedIntervalMs),'-file',resolve(receipt.outputDirectory,FILES.report)]);
 for(const k of Object.keys(FILES))same(sample[k],FILES[k]);
 assert.equal(sample.status,'collected');assert.equal(sample.exitObserved,true);assert.equal(sample.terminationConfirmedAtFinish,true);assert.equal(sample.cleanupComplete,true);assert.equal(sample.exitCode,0);assert.equal(sample.exitSignal,null);
 assert.equal(sample.outputTruncated,false);assert(!sample.streamEventsTruncated,'Raw stream receipt overflow');assert(!sample.cancelReason&&!sample.spawnUnavailable,'Sampler cancellation/unavailability retained');
 for(const key of ['errors','cleanupErrors','signals'])assert(Array.isArray(sample[key])&&sample[key].length===0,'Sampler '+key+' retained');
 for(const s of ['requested','spawned','finished'])assert(finite(sample[s]?.monotonicMs),'Missing sampler '+s+' receipt');
 assert(sample.requested.monotonicMs>=receipt.beforeSnapshot.after.monotonicMs&&sample.spawned.monotonicMs>=sample.requested.monotonicMs&&sample.finished.monotonicMs>=sample.spawned.monotonicMs,'Invalid sampler timing order');
 assert(sample.requested.monotonicMs<rideStartHostMs+C.rideRequestedMs-C.requestedSeconds*1000-1000,'Sampler started too late for the predeclared ride');
 same(sample.elapsedMs,sample.finished.monotonicMs-sample.requested.monotonicMs);assert(sample.elapsedMs<=C.processTimeoutMs,'Sampler exceeded fixed process deadline');
 assert(receipt.afterSnapshot.before.monotonicMs>=sample.finished.monotonicMs,'Final process identity preceded sampler completion');
 same(receipt.rawFiles.map(r=>r.file),Object.values(FILES),'Raw-file inventory changed');
 const raw={},verifiedFiles=[];
 for(const [name,file] of Object.entries(FILES)){
  const saved=receipt.rawFiles.find(r=>r.file===file);assert.equal(saved.available,true,'Missing native raw file: '+file);
  const bytes=Buffer.from(await readCapturedFile(file));assert(bytes.length<=(name==='report'?C.maxReportBytes:C.maxRawStreamBytes),'Native raw-file bound exceeded');
  same(saved.bytes,bytes.length);same(saved.sha256,sha256(bytes),'Native raw-file hash mismatch');raw[name]=bytes;verifiedFiles.push({file,bytes:bytes.length,sha256:sha256(bytes)});
  if(name!=='report')same(sample[name+'Bytes'],bytes.length,'Sampler raw-stream byte count mismatch');
 }
 assert(!/Operation not permitted|permission denied|not authorized|cannot attach|not allowed/i.test(raw.stderr.toString('utf8')),'Native attachment/permission failure retained');
 const parsed=parseNativeSampleReport(raw.report.toString('utf8'));same(receipt.analysis,parsed,'Native report parser replay changed');
 assert.equal(parsed.structureUsable,true,'Native report structure incomplete');same(parsed.targetPid,before.gpuPid);same(parsed.parentPid,before.browserPid);
 assert(typeof parsed.header.Path==='string'&&parsed.header.Path.startsWith('/'),'Native report executable absent');
 same(receipt.reportPathResolution.reportedPath,parsed.header.Path);same(receipt.reportPathResolution.realPath,receipt.beforeSnapshot.os.gpu.realExecutable,'Native report executable identity mismatch');
 const phaseSignals=replayPhaseSignals(sample,raw),overlap=nativeSampleOverlap(sample,receipt.ride);assert(overlap.valid,'Native sample does not fit the original held-input bracket');
 return {collectionComplete:true,rawFilesVerified:verifiedFiles,processIdentity:{initial,before,after},phaseSignals,overlap,
  someSymbolsPresent:parsed.someSymbolsPresent,symbolCoverage:parsed.symbolCoverage,symbolsByImage:parsed.symbolsByImage,
  largeOffsetNamedFrameRows:parsed.largeOffsetNamedFrameRows,stackObservationUsable:parsed.someSymbolsPresent,mechanismAttributionUsable:null,
  note:'Successful raw collection and some named rows do not establish useful Chrome/ANGLE/Metal attribution. Missing/large-offset symbols stay explicit; native host stacks do not measure device execution or identify individual frame-gap causes.'};
}

/** Synchronous ride hooks never await identity, sampling, file writes or completion. */
export function createNativeGpuSampler({browserSession,browserVersion,systemInfo,output,onError=()=>{},now=()=>clock.now()},testing={}){
 const platform=testing.platform??process.platform,observe=testing.snapshot??captureNativeIdentitySnapshot,runFactory=testing.runnerFactory??makeSingleSampleRunner;
 const later=testing.setTimeout??setTimeout,cancelLater=testing.clearTimeout??clearTimeout,checkAccess=testing.access??access,resolvePath=testing.realpath??realpath;
 const receipt={version:2,diagnosticOnly:true,releaseAcceptance:false,mechanismAttributionUsable:null,config:{...C},platform,
  browserVersion:structuredClone(browserVersion??null),systemInfo:structuredClone(systemInfo??null),outputDirectory:resolve(output),
  status:'initializing',collectionComplete:false,validationPassed:false,validation:null,errors:[],singleTaskAttempts:0,
  ride:{startHostMs:null,stopHostMs:null,scheduledHostMs:null},taskStartedHostMs:null,initialSnapshot:null,beforeSnapshot:null,afterSnapshot:null,
  processIdentity:{initial:null,before:null,after:null},sample:null,rawFiles:[],analysis:null,reportPathResolution:null,
  interpretation:'One separately bounded statistical observation of native GPU-process host stacks. Overhead is unquantified; original reports and acceptance remain separate. Unknown symbols remain unknown.'};
 let timer=null,task=Promise.resolve(),finishing=null,runner=null;
 const fail=(where,error)=>{const message=errorText(error);receipt.errors.push({where,message,hostMs:now()});try{void Promise.resolve(onError(Error(where+': '+message))).catch(()=>{});}catch{/* Reporting must not replace the original native result. */}};
 const initial=(async()=>{
  assert.equal(platform,'darwin','Native macOS sampler required; no substitute');
  assert(browserSession&&typeof browserSession.send==='function');assert(typeof systemInfo?.commandLine==='string','SystemInfo command line required');
  assert(/^Chrome\//.test(browserVersion?.product??''),'Official Chrome version required');
  await checkAccess(C.executable,1);
  for(const file of [...Object.values(FILES),RECEIPT])try{await lstat(resolve(output,file));throw Error('Sampler output already exists: '+file);}catch(error){if(error.code!=='ENOENT')throw error;}
  receipt.initialSnapshot=await observe(browserSession,now);
  receipt.processIdentity.initial=replaySnapshot(receipt.initialSnapshot,null,{browserVersion,systemInfo});
  receipt.status='ready';
 })().catch(error=>{receipt.status='unavailable';fail('initialize',error);});
 async function collect(){
  receipt.singleTaskAttempts++;receipt.taskStartedHostMs=now();
  try{
   assert.equal(receipt.singleTaskAttempts,1,'Exactly one scheduled sample task allowed');await initial;
   assert(receipt.initialSnapshot&&receipt.errors.length===0,'Native identity initialization failed');
   assert.equal(receipt.ride.stopHostMs,null,'Native release already requested; no late sample');
   receipt.beforeSnapshot=await observe(browserSession,now);
   receipt.processIdentity.before=replaySnapshot(receipt.beforeSnapshot,receipt.initialSnapshot,{browserVersion,systemInfo});
   assert.equal(receipt.ride.stopHostMs,null,'Native release occurred during sampler identity checks');
   assert(now()<receipt.ride.startHostMs+C.rideRequestedMs-C.requestedSeconds*1000-1000,'Insufficient remaining original ride time; no late sample or retry');
   runner=runFactory(output,{now});receipt.sample=runner.metadata;receipt.status='sampling';
   await runner.run(receipt.beforeSnapshot.os.gpu.pid);
   receipt.afterSnapshot=await observe(browserSession,now);
   receipt.processIdentity.after=replaySnapshot(receipt.afterSnapshot,receipt.beforeSnapshot,{browserVersion,systemInfo});
   receipt.status='sample-finished';
  }catch(error){receipt.status='incomplete';fail('collect',error);}
 }
 const api={receipt,
  startRide(hostMs){
   if(receipt.ride.startHostMs!==null)return false;
   try{assert(!finishing,'Sampler already finalized');assert(finite(hostMs)&&hostMs<=now(),'Invalid native keydown completion');
    receipt.ride.startHostMs=hostMs;receipt.ride.scheduledHostMs=hostMs+C.offsetMs;
    const trigger=()=>{timer=null;if(receipt.ride.stopHostMs!==null||finishing)return;
     const remaining=receipt.ride.scheduledHostMs-now();if(remaining>0){timer=later(trigger,remaining);return;}task=collect();};
    timer=later(trigger,Math.max(0,receipt.ride.scheduledHostMs-now()));return true;
   }catch(error){fail('startRide',error);return false;}
  },
  stopRide(hostMs){
   if(receipt.ride.stopHostMs!==null)return false;
   try{assert(finite(hostMs)&&hostMs<=now(),'Invalid native keyup request');receipt.ride.stopHostMs=hostMs;
    if(timer!==null){cancelLater(timer);timer=null;receipt.status='not-sampled-native-input-ended-before-offset';}return true;
   }catch(error){fail('stopRide',error);return false;}
  },
  finish(){
   if(finishing)return finishing;
   finishing=(async()=>{
    if(timer!==null){cancelLater(timer);timer=null;receipt.status='not-sampled-finalized-before-offset';}
    await initial;await task;
    for(const [name,file] of Object.entries(FILES)){
     const saved={file,available:false,bytes:null,sha256:null};receipt.rawFiles.push(saved);
     try{const info=await lstat(resolve(output,file));assert(info.isFile()&&!info.isSymbolicLink(),'Native raw output must be an ordinary file');saved.bytes=info.size;
      assert(info.size<=(name==='report'?C.maxReportBytes:C.maxRawStreamBytes),'Native raw output exceeds bound; full file retained without prefix digest');
      const bytes=await readFile(resolve(output,file));assert.equal(bytes.length,info.size,'Native raw output changed while reading');saved.available=true;saved.sha256=sha256(bytes);
      if(name==='report'){receipt.analysis=parseNativeSampleReport(bytes.toString('utf8'));receipt.reportPathResolution={reportedPath:receipt.analysis.header.Path??null,realPath:null};
       assert(typeof receipt.analysis.header.Path==='string','Sample report has no executable path');receipt.reportPathResolution.realPath=await resolvePath(receipt.analysis.header.Path);}
     }catch(error){saved.error=errorText(error);fail('raw '+file,error);}
    }
    try{receipt.validation=await verifyNativeGpuSample(receipt,{readCapturedFile:file=>readFile(resolve(output,file)),rideStartHostMs:receipt.ride.startHostMs,rideStopHostMs:receipt.ride.stopHostMs,browserVersion,systemInfo});
     receipt.collectionComplete=true;receipt.validationPassed=true;receipt.status=receipt.validation.someSymbolsPresent?(receipt.validation.symbolCoverage==='partial'?'complete-raw-partial-symbols':'complete-raw-with-symbols'):'complete-raw-symbols-unavailable';
    }catch(error){receipt.collectionComplete=false;receipt.validationPassed=false;receipt.status=receipt.status==='unavailable'?'unavailable':'incomplete';fail('verify',error);}
    receipt.finishedHostMs=now();
    try{await writeFile(resolve(output,RECEIPT),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}catch(error){receipt.collectionComplete=false;receipt.validationPassed=false;fail('receipt.write',error);}
    return receipt;
   })();return finishing;
  }
 };
 return api;
}
