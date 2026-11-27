import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHash} from 'node:crypto';
import {NATIVE_GPU_SAMPLE_CONFIG as C,parsePsIdentity,selectBrowserAndGpu,parseMacCommandLine,validateProcessIdentity,captureNativeIdentitySnapshot,
 parseNativeSampleReport,nativeSampleOverlap,makeSingleSampleRunner,createNativeGpuSampler,verifyNativeGpuSample} from './native-gpu-sample.mjs';

const browserExe='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const gpuExe='/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/158.0/Helpers/Google Chrome Helper (GPU).app/Contents/MacOS/Google Chrome Helper (GPU)';
const browserArgs=browserExe+' --enable-gpu --use-gl=angle --use-angle=metal --user-data-dir=/tmp/playwright-profile';
const gpuArgs=gpuExe+' --type=gpu-process --use-angle=metal';
const version={product:'Chrome/158.0.8127.89',revision:'@1de57fa19722fa6d6841d4f596c394d015580656'};
const system={commandLine:browserArgs,gpu:{devices:[{vendorString:'Apple',deviceId:0,vendorId:0}],auxAttributes:{
 displayType:'ANGLE_METAL',glImplementationParts:'(gl=egl-angle,angle=metal)',glRenderer:'ANGLE Metal Renderer: Apple',
 glVendor:'Google Inc. (Apple)',glVersion:'OpenGL ES 3.0 (ANGLE)',inProcessGpu:false,skiaBackendType:'GraphiteDawnMetal'}}};
const sha=b=>createHash('sha256').update(b).digest('hex');
const stamp=n=>({monotonicMs:n,wallMs:1700000000000+n,iso:new Date(1700000000000+n).toISOString()});
function ps(pid,ppid,exe,args,at){
 const summary=`${pid} ${ppid} 501 runner Fri Nov 27 12:00:00 2026 0:01.23 ${exe}\n`;
 return {...parsePsIdentity(summary,args),realExecutable:exe,observationBefore:stamp(at+1),observationAfter:stamp(at+2),commands:[
  {executable:'/bin/ps',argv:['-ww','-p',String(pid),'-o','pid=,ppid=,uid=,user=,lstart=,time=,comm='],stdout:summary,stderr:'',exitCode:0},
  {executable:'/bin/ps',argv:['-ww','-p',String(pid),'-o','args='],stdout:args+'\n',stderr:'',exitCode:0}
 ]};
}
function snap(at){
 const cdp={processInfo:[{id:111,type:'browser',cpuTime:2},{id:222,type:'GPU',cpuTime:1}]};
 return {before:stamp(at),cdpReceived:stamp(at+1),after:stamp(at+3),currentUid:501,currentEffectiveUid:501,
  collectionErrors:[],cdpObservations:['Browser.getVersion','SystemInfo.getInfo','SystemInfo.getProcessInfo'].map((method,i)=>({
   method,params:{},started:stamp(at),received:stamp(at+1),status:'response',error:null,response:structuredClone([version,system,cdp][i])})),
  browserVersion:structuredClone(version),systemInfo:structuredClone(system),cdp,browserCommandLine:browserArgs,
  os:{browser:ps(111,100,browserExe,browserArgs,at),gpu:ps(222,111,gpuExe,gpuArgs,at)}};
}
function report(){return `Analysis of sampling Google Chrome Helper (GPU) (pid 222) every 10 milliseconds
Process:         Google Chrome Helper (GPU) [222]
Path:            ${gpuExe}
Parent Process:  Google Chrome [111]
Code Type:       ARM-64 (Native)
Call graph:
    800 Thread_12345 DispatchQueue_1: com.apple.main-thread (serial)
    + 800 thread_start (in libsystem_pthread.dylib) + 8 [0x100000010]
    + ! 785 ??? (in Google Chrome Framework) + 741199 [0x100000020]
    + ! 15 ChromeMain + 999999 (in Google Chrome Helper (GPU)) [0x100000030]
Total number in stack (recursive counted multiple, when >=5):
Binary Images:
       0x100000000 - 0x100ffffff Google Chrome Helper (GPU) (158.0) <12345678-1234-1234-1234-123456789abc> ${gpuExe}
       0x200000000 - 0x200ffffff libsystem_pthread.dylib (1) <22345678-1234-1234-1234-123456789abc> /usr/lib/system/libsystem_pthread.dylib
`;}
function fixture(output='/tmp/belle-native-fixture'){
 const stdout=Buffer.from('Sampling process 222 for 8 seconds with 10 milliseconds of run time between samples\n'),stderr=Buffer.from('Sampling completed, processing symbols...\n');
 const raw={'native-gpu-sample.stdout.txt':stdout,'native-gpu-sample.stderr.txt':stderr,'native-gpu-sample.report.txt':Buffer.from(report())};
 const phaseSignals=[{kind:'sampling-start',stream:'stdout',streamEventOrdinal:1,receivedBytes:stdout.length,text:'Sampling process 222 for 8 seconds with 10 milliseconds',declaredPid:222,declaredSeconds:8,declaredIntervalMs:10,...stamp(74006)},
  {kind:'sampling-complete',stream:'stderr',streamEventOrdinal:2,receivedBytes:stderr.length,text:'Sampling completed, processing symbols',declaredPid:null,declaredSeconds:null,declaredIntervalMs:null,...stamp(82006)}];
 const receipt={version:2,diagnosticOnly:true,releaseAcceptance:false,mechanismAttributionUsable:null,config:{...C},platform:'darwin',browserVersion:version,systemInfo:system,outputDirectory:output,
  errors:[],singleTaskAttempts:1,ride:{startHostMs:10000,stopHostMs:99999.4,scheduledHostMs:74000},taskStartedHostMs:74000,
  initialSnapshot:snap(9000),beforeSnapshot:snap(74000),afterSnapshot:snap(83005),
  sample:{executable:C.executable,requestedSeconds:8,requestedIntervalMs:10,timeoutMs:30000,killGraceMs:1000,attempted:true,attempts:1,
   argv:['222','8','10','-file',resolve(output,'native-gpu-sample.report.txt')],stdout:'native-gpu-sample.stdout.txt',stderr:'native-gpu-sample.stderr.txt',report:'native-gpu-sample.report.txt',
   status:'collected',exitObserved:true,terminationConfirmedAtFinish:true,cleanupComplete:true,exitCode:0,exitSignal:null,outputTruncated:false,errors:[],cleanupErrors:[],signals:[],
   requested:stamp(74004),spawned:stamp(74005),finished:stamp(83004),elapsedMs:9000,stdoutBytes:stdout.length,stderrBytes:stderr.length,
   phaseSignals,streamEvents:[{stream:'stdout',bytes:stdout.length,retainedBytes:stdout.length,...stamp(74006)},{stream:'stderr',bytes:stderr.length,retainedBytes:stderr.length,...stamp(82006)}]},
  rawFiles:Object.entries(raw).map(([file,b])=>({file,available:true,bytes:b.length,sha256:sha(b)})),analysis:parseNativeSampleReport(report()),reportPathResolution:{reportedPath:gpuExe,realPath:gpuExe}};
 receipt.processIdentity={initial:validateProcessIdentity(receipt.initialSnapshot),
  before:validateProcessIdentity(receipt.beforeSnapshot,receipt.initialSnapshot),after:validateProcessIdentity(receipt.afterSnapshot,receipt.beforeSnapshot)};
 return {receipt,raw,options:{readCapturedFile:async file=>raw[file],rideStartHostMs:10000,rideStopHostMs:99999.4,browserVersion:version,systemInfo:system}};
}
const dir=async t=>{const p=await mkdtemp(join(tmpdir(),'belle-native-gpu-test-'));t.after(()=>rm(p,{recursive:true,force:true}));return p;};
const deferred=()=>{let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve};};
function fakeChild(){const p=new EventEmitter();p.pid=999;p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>true;return p;}

test('process identity requires a unique same-user native browser/GPU pair and stable birth/arguments',()=>{
 const a=snap(100),b=snap(200);assert.equal(validateProcessIdentity(a).gpuPid,222);assert.equal(validateProcessIdentity(b,a).stable,true);
 for(const mutate of [r=>r.os.gpu.ppid=333,r=>r.currentEffectiveUid=0,r=>r.os.gpu.uid=0,r=>r.os.gpu.startTime='later',r=>r.os.gpu.args+=' --changed',r=>r.cdp.processInfo.push({id:223,type:'gpu',cpuTime:0})]){
  const x=structuredClone(b);mutate(x);assert.throws(()=>validateProcessIdentity(x,a));
 }
 assert.throws(()=>selectBrowserAndGpu([{id:111,type:'browser',cpuTime:0}]));
 assert.throws(()=>parseMacCommandLine(browserArgs+' --foo="a b"',browserExe));
 const x=structuredClone(a);x.browserCommandLine+=' --unexpected';assert.throws(()=>validateProcessIdentity(x));
 const whitespace=structuredClone(a);whitespace.browserCommandLine=whitespace.browserCommandLine.replace(' --use-gl','  --use-gl');
 whitespace.systemInfo.commandLine=whitespace.browserCommandLine;whitespace.cdpObservations[1].response=structuredClone(whitespace.systemInfo);
 assert.throws(()=>validateProcessIdentity(whitespace),/Raw command-line strings/);
});

test('every native snapshot makes exactly one fresh bounded query for version, SystemInfo and processes',async()=>{
 let time=100,osCalls=0;const calls=[],now=()=>++time;
 const session={async send(method,params){calls.push({method,params});return structuredClone({
  'Browser.getVersion':version,'SystemInfo.getInfo':system,'SystemInfo.getProcessInfo':snap(0).cdp}[method]);}};
 const options={getuid:()=>501,geteuid:()=>501,osProcess:async(pid)=>{
  osCalls++;const at=now(),row=pid===111?ps(111,100,browserExe,browserArgs,at):ps(222,111,gpuExe,gpuArgs,at);
  row.observationBefore=stamp(at);row.observationAfter=stamp(now());return row;
 }};
 const first=await captureNativeIdentitySnapshot(session,now,options),second=await captureNativeIdentitySnapshot(session,now,options);
 assert.equal(validateProcessIdentity(first,null,{browserVersion:version,systemInfo:system}).gpuPid,222);
 assert.equal(validateProcessIdentity(second,first).stable,true);assert.equal(osCalls,4);
 assert.deepEqual(calls.map(row=>row.method),['Browser.getVersion','SystemInfo.getInfo','SystemInfo.getProcessInfo',
  'Browser.getVersion','SystemInfo.getInfo','SystemInfo.getProcessInfo']);
 assert(calls.every(row=>Object.keys(row.params).length===0));
 assert(second.before.monotonicMs>first.after.monotonicMs);
 for(const value of [first,second])for(const row of value.cdpObservations){
  assert(row.started.monotonicMs>=value.before.monotonicMs);assert(row.received.monotonicMs<=value.cdpReceived.monotonicMs);
 }
});

test('fresh query failure retains all responses and error receipts without observing OS targets',async()=>{
 let time=100,osCalls=0;const calls=[];
 const value=await captureNativeIdentitySnapshot({send(method){calls.push(method);
  if(method==='SystemInfo.getInfo')throw Error('fresh SystemInfo unavailable');
  return Promise.resolve(structuredClone(method==='Browser.getVersion'?version:snap(0).cdp));
 }},()=>++time,{getuid:()=>501,geteuid:()=>501,osProcess:async()=>{osCalls++;throw Error('must not observe target');}});
 assert.equal(calls.length,3);assert.equal(osCalls,0);assert.equal(value.collectionErrors.length,1);
 assert.match(value.cdpObservations[1].error,/fresh SystemInfo unavailable/);
 assert.deepEqual(value.cdpObservations[0].response,version);assert.deepEqual(value.cdpObservations[2].response,snap(0).cdp);
 assert.equal(value.cdpObservations[1].status,'error');assert.equal(value.os.gpu,null);
 assert.throws(()=>validateProcessIdentity(value),/Fresh native identity collection failed/);
});

test('late CDP completion cannot rewrite the retained fixed-deadline failure or trigger a retry',async()=>{
 const pending=deferred();let requests=0,osCalls=0;
 const value=await captureNativeIdentitySnapshot({send(method){requests++;
  return method==='SystemInfo.getInfo'?pending.promise:Promise.resolve(structuredClone(method==='Browser.getVersion'?version:snap(0).cdp));
 }},undefined,{getuid:()=>501,geteuid:()=>501,osProcess:async()=>{osCalls++;throw Error('must not observe target');}});
 assert.equal(requests,3);assert.equal(osCalls,0);assert.match(value.cdpObservations[1].error,/timed out/);
 const retained=JSON.stringify(value);pending.resolve(structuredClone(system));await Promise.resolve();await Promise.resolve();
 assert.equal(JSON.stringify(value),retained);assert.equal(requests,3);
});

test('raw fresh responses, projections, ordered timing and saved comparison relations replay exactly',async()=>{
 const {receipt,options}=fixture();
 const mutations=[
  r=>r.version=1,
  r=>r.beforeSnapshot.cdpObservations.pop(),
  r=>r.beforeSnapshot.cdpObservations[1].method='Browser.getVersion',
  r=>r.beforeSnapshot.cdpObservations[1].params={retry:true},
  r=>r.beforeSnapshot.cdpObservations[1].started.monotonicMs=r.beforeSnapshot.before.monotonicMs-1,
  r=>r.beforeSnapshot.cdpObservations[1].received.monotonicMs=r.beforeSnapshot.cdpReceived.monotonicMs+1,
  r=>r.beforeSnapshot.cdpObservations[1].response.commandLine+=' --unexpected',
  r=>r.beforeSnapshot.browserVersion.revision='@'+'0'.repeat(40),
  r=>r.beforeSnapshot.systemInfo.gpu.auxAttributes.glRenderer='SwiftShader',
  r=>r.beforeSnapshot.os.gpu.observationBefore.monotonicMs=r.beforeSnapshot.before.monotonicMs,
  r=>r.processIdentity.before.commandLineRelation.osSwitches.reverse(),
  r=>r.processIdentity.before.commandLineRelation.mode='pinned-chromium-in-memory-append',
  r=>r.processIdentity.before.commandLineRelation.appendedSwitches=['--unexpected'],
  r=>r.processIdentity.before.commandLineRelation.fallbackPermissionIntroduced=true
 ];
 for(const mutate of mutations){const changed=structuredClone(receipt);mutate(changed);await assert.rejects(()=>verifyNativeGpuSample(changed,options));}
 // Updating both the fresh raw response and its projections still cannot hide a
 // changed browser command line behind an unchanged OS command or old receipt.
 const changed=structuredClone(receipt);
 for(const key of ['beforeSnapshot','afterSnapshot']){
  const snapshot=changed[key];snapshot.browserCommandLine+=' --new-switch';snapshot.systemInfo.commandLine=snapshot.browserCommandLine;
  snapshot.cdpObservations[1].response=structuredClone(snapshot.systemInfo);
 }
 await assert.rejects(()=>verifyNativeGpuSample(changed,options),/Fresh browser arguments differ/);
 // Dynamic observation counters are retained but aren't stable renderer fields.
 const dynamic=snap(200);dynamic.systemInfo.gpu.auxAttributes.visibilityCallbackCallCount=17;
 dynamic.cdpObservations[1].response=structuredClone(dynamic.systemInfo);
 assert.equal(validateProcessIdentity(dynamic,snap(100)).stable,true);
});

test('failed fresh identity is archived and prevents any sampler invocation',async t=>{
 const output=await dir(t);let ms=1000,timer,runnerCalls=0,observations=0;
 const bad=snap(100);bad.systemInfo.commandLine+=' --unexplained';bad.browserCommandLine=bad.systemInfo.commandLine;
 bad.cdpObservations[1].response=structuredClone(bad.systemInfo);
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms},
  {platform:'darwin',access:async()=>{},snapshot:async()=>{observations++;return structuredClone(bad);},setTimeout:fn=>{timer=fn;return fn;},clearTimeout:()=>{},
   runnerFactory:()=>{runnerCalls++;throw Error('must not attach');}});
 s.startRide(ms);ms=65000;timer();ms=90000;s.stopRide(ms);const receipt=await s.finish();
 assert.equal(observations,1);assert.equal(runnerCalls,0);assert.equal(receipt.sample,null);assert.equal(receipt.singleTaskAttempts,1);
 assert.deepEqual(receipt.initialSnapshot,bad);assert.equal(receipt.collectionComplete,false);assert.equal(receipt.validationPassed,false);
 assert(receipt.errors.some(row=>row.where==='initialize'&&row.message.includes('Fresh browser arguments differ')));
});

test('pre-sample raw-identity replay rejects tampered OS evidence before any attachment',async t=>{
 const output=await dir(t);let ms=1000,timer,runnerCalls=0,observations=0;const first=deferred(),second=deferred();
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms},
  {platform:'darwin',access:async()=>{},snapshot:async()=>{
    observations++;const value=snap(observations===1?100:65000);
    if(observations===1)first.resolve();else {value.os.gpu.commands[0].stdout=value.os.gpu.commands[0].stdout.replace('222 111','223 111');second.resolve();}
    return value;
   },setTimeout:fn=>{timer=fn;return fn;},clearTimeout:()=>{},runnerFactory:()=>{runnerCalls++;throw Error('must not attach');}});
 await first.promise;s.startRide(ms);ms=65000;timer();await second.promise;ms=90000;s.stopRide(ms);const receipt=await s.finish();
 assert.equal(observations,2);assert.equal(runnerCalls,0);assert.equal(receipt.sample,null);
 assert(receipt.errors.some(row=>row.where==='collect'&&row.message.includes('Raw ps replay mismatch')));
 assert.equal(receipt.collectionComplete,false);assert.equal(receipt.validationPassed,false);
});

test('native parser preserves thread_start as a frame, parenthesized images, unknown symbols and large offsets',()=>{
 const p=parseNativeSampleReport(report());assert.equal(p.structureUsable,true);assert.equal(p.threadRoots.length,1);assert.equal(p.inclusiveFrames.length,3);
 assert.equal(p.inclusiveFrames[0].symbol,'thread_start');assert.equal(p.inclusiveFrames[2].image,'Google Chrome Helper (GPU)');
 assert.equal(p.declaredGlobalSampleCount,null);assert.equal(p.unknownSymbolFrameRows,1);assert.equal(p.largeOffsetNamedFrameRows,1);assert.equal(p.symbolCoverage,'partial');
 assert.equal(p.mechanismAttributionUsable,null);
 const bad=parseNativeSampleReport(report().replace('Process:         Google','Process: X [999]\nProcess:         Google'));assert.equal(bad.structureUsable,false);
 assert.equal(parseNativeSampleReport(report().replace('every 10 milliseconds','every 11 milliseconds')).structureUsable,false);
});

test('overlap uses observed host bracket without adding a second90s gate; explicit completion can precede symbol-work exit',()=>{
 const {receipt:r}=fixture();assert(nativeSampleOverlap(r.sample,r.ride).valid);
 r.sample.finished=stamp(101000);r.sample.elapsedMs=26996;assert.equal(nativeSampleOverlap(r.sample,r.ride).entireProcessContained,false);assert(nativeSampleOverlap(r.sample,r.ride).signaledCaptureContained);
 r.sample.phaseSignals[1].monotonicMs=100000;assert.equal(nativeSampleOverlap(r.sample,r.ride).valid,false);
 r.sample.phaseSignals[1].monotonicMs=82006;r.sample.phaseSignals[0].declaredSeconds=9;assert.equal(nativeSampleOverlap(r.sample,r.ride).valid,false);
});

test('successful independent replay binds native raw files, process evidence, controls and external input/browser receipts',async()=>{
 const {receipt,options}=fixture(),v=await verifyNativeGpuSample(receipt,options);
 assert.equal(v.collectionComplete,true);assert.equal(v.rawFilesVerified.length,3);assert.equal(v.symbolCoverage,'partial');assert.equal(v.mechanismAttributionUsable,null);
 for(const mutate of [r=>r.config.requestedSeconds=9,r=>r.sample.argv[1]='9',r=>r.beforeSnapshot.os.gpu.pid=223,r=>r.afterSnapshot.os.gpu.startTime='later',
  r=>r.sample.terminationConfirmedAtFinish=false,r=>r.sample.exitObserved=false,r=>r.sample.cleanupErrors.push('not reaped'),r=>r.sample.elapsedMs=30001,
  r=>r.ride.startHostMs=10001,r=>r.taskStartedHostMs=73999,r=>r.analysis.targetPid=333,r=>r.reportPathResolution.realPath=browserExe,
  r=>r.sample.phaseSignals[1].streamEventOrdinal=1,r=>r.sample.phaseSignals[1].monotonicMs=74005,r=>r.sample.streamEvents[0].bytes--,
  r=>r.rawFiles[0].sha256='0'.repeat(64),r=>r.beforeSnapshot.os.gpu.commands[0].stdout='wrong']){
  const x=structuredClone(receipt);mutate(x);await assert.rejects(()=>verifyNativeGpuSample(x,options));
 }
 await assert.rejects(()=>verifyNativeGpuSample(receipt,{...options,browserVersion:{product:'Chrome/159'}}));
 await assert.rejects(()=>verifyNativeGpuSample(receipt,{...options,rideStopHostMs:100001}));
 await assert.rejects(()=>verifyNativeGpuSample(receipt,{...options,readCapturedFile:async()=>Buffer.from('corrupt')}));
});

test('raw phase declaration conflicts and permissions fail even when a saved result claims success',async()=>{
 for(const change of ['duplicate','wrong pid','consistent wrong pid','consistent wrong duration','permission']){
  const f=fixture();let file='native-gpu-sample.stdout.txt';
  if(change==='duplicate')f.raw[file]=Buffer.concat([f.raw[file],f.raw[file]]);
  if(change==='wrong pid')f.raw[file]=Buffer.from(f.raw[file].toString().replace('222','333'));
  if(change==='consistent wrong pid'){f.raw[file]=Buffer.from(f.raw[file].toString().replace('222','333'));f.receipt.sample.phaseSignals[0].declaredPid=333;f.receipt.sample.phaseSignals[0].text=f.receipt.sample.phaseSignals[0].text.replace('222','333');}
  if(change==='consistent wrong duration'){f.raw[file]=Buffer.from(f.raw[file].toString().replace('for 8 seconds','for 9 seconds'));f.receipt.sample.phaseSignals[0].declaredSeconds=9;f.receipt.sample.phaseSignals[0].text=f.receipt.sample.phaseSignals[0].text.replace('for 8 seconds','for 9 seconds');}
  if(change==='permission'){file='native-gpu-sample.stderr.txt';f.raw[file]=Buffer.from('Operation not permitted\n');}
  const saved=f.receipt.rawFiles.find(r=>r.file===file);saved.bytes=f.raw[file].length;saved.sha256=sha(f.raw[file]);
  const stream=file.includes('stdout')?'stdout':'stderr';f.receipt.sample[stream+'Bytes']=saved.bytes;
  await assert.rejects(()=>verifyNativeGpuSample(f.receipt,f.options));
 }
});

test('single runner retains split raw signals and permits no second attachment',async t=>{
 const output=await dir(t);let count=0,child;
 const runner=makeSingleSampleRunner(output,{spawnImpl:(exe,args)=>{count++;assert.equal(exe,C.executable);assert.deepEqual(args,['222','8','10','-file',resolve(output,'native-gpu-sample.report.txt')]);child=fakeChild();
  setImmediate(()=>{child.emit('spawn');child.stdout.write('Sampling pro');child.stdout.write('cess 222 for 8 seconds with 10 milliseconds\n');child.stderr.write('Sampling completed, processing symbols\n');child.emit('close',0,null);});return child;}});
 const m=await runner.run(222);assert.equal(m.status,'collected');assert.equal(m.terminationConfirmedAtFinish,true);assert.equal(m.cleanupComplete,true);assert.equal(m.phaseSignals.length,2);
 assert.equal(m.phaseSignals[0].streamEventOrdinal,2);assert.equal(m.phaseSignals[0].receivedBytes,m.stdoutBytes);
 assert.match(await readFile(resolve(output,m.stdout),'utf8'),/Sampling process 222/);await assert.rejects(()=>runner.run(222),/one sampler attempt/);assert.equal(count,1);
});

test('runner timeout retains termination evidence and never claims a completed sample',async t=>{
 const output=await dir(t);const child=fakeChild(),sent=[];child.kill=signal=>{sent.push(signal);if(signal==='SIGKILL')setImmediate(()=>child.emit('close',null,'SIGKILL'));return true;};
 const runner=makeSingleSampleRunner(output,{timeoutMs:5,killGraceMs:5,spawnImpl:()=>{setImmediate(()=>child.emit('spawn'));return child;}});
 const m=await runner.run(222);assert.equal(m.status,'partial');assert.equal(m.cancelReason,'process-timeout');assert.deepEqual(sent,['SIGTERM','SIGKILL']);assert.equal(m.exitObserved,true);assert.equal(m.terminationConfirmedAtFinish,true);
});

test('unconfirmed kill is explicit failed cleanup and retains the child close listener',async t=>{
 const output=await dir(t),child=fakeChild();let unrefCalled=false;child.unref=()=>{unrefCalled=true;};
 const runner=makeSingleSampleRunner(output,{timeoutMs:3,killGraceMs:3,spawnImpl:()=>{setImmediate(()=>child.emit('spawn'));return child;}});
 const m=await runner.run(222);assert.equal(m.status,'partial');assert.equal(m.terminationConfirmedAtFinish,false);assert.equal(m.cleanupComplete,false);assert.equal(m.exitObserved,false);
 assert(m.cleanupErrors.some(e=>e.includes('exit not observed')));assert.equal(unrefCalled,true);assert.equal(child.listenerCount('close'),1);
 child.emit('close',null,'SIGKILL');assert.equal(m.exitObserved,false,'Late exit must not rewrite the frozen finish observation');
});

test('spawn failure stays unavailable and single-attempt',async t=>{
 const runner=makeSingleSampleRunner(await dir(t),{spawnImpl:()=>{throw Error('attachment unavailable');}});
 const m=await runner.run(222);assert.equal(m.status,'unavailable');assert.equal(m.exitObserved,false);assert.equal(m.terminationConfirmedAtFinish,false);await assert.rejects(()=>runner.run(222));
});

test('synchronous ride hooks cancel pending sampling, retain first boundaries, and finalize once',async t=>{
 const output=await dir(t);let ms=1000,timer,cancels=0,runnerCalls=0;
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms,onError:()=>{}},{platform:'darwin',access:async()=>{},snapshot:async()=>snap(100),setTimeout:(fn,delay)=>{timer={fn,delay};return timer;},clearTimeout:()=>{cancels++;},runnerFactory:()=>{runnerCalls++;throw Error('must not run');}});
 assert.equal(s.startRide(ms),true);assert.equal(timer.delay,64000);assert.equal(s.startRide(ms+1),false);
 ms=5000;assert.equal(s.stopRide(ms),true);assert.equal(s.stopRide(ms+1),false);assert.equal(cancels,1);
 const a=s.finish(),b=s.finish();assert.equal(a,b);const r=await a;assert.equal(r.collectionComplete,false);assert.equal(r.validationPassed,false);assert.equal(r.singleTaskAttempts,0);assert.equal(runnerCalls,0);
 assert.equal(r.ride.startHostMs,1000);assert.equal(r.ride.stopHostMs,5000);assert.equal(JSON.parse(await readFile(resolve(output,'native-gpu-sample.json'),'utf8')).collectionComplete,false);
});

test('early timer wake rearms the same fixed target without a sample attempt',async t=>{
 const output=await dir(t);let ms=1000,timer,scheduled=0;
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms},{platform:'darwin',access:async()=>{},snapshot:async()=>snap(100),setTimeout:(fn,delay)=>{timer={fn,delay};scheduled++;return timer;},clearTimeout:()=>{}});
 s.startRide(ms);ms=64999.7;timer.fn();assert.equal(scheduled,2);assert(timer.delay>0&&timer.delay<1);assert.equal(s.receipt.singleTaskAttempts,0);
 ms=65000;s.stopRide(ms);await s.finish();assert.equal(s.receipt.singleTaskAttempts,0);
});

test('release during delayed process verification prevents attachment',async t=>{
 const output=await dir(t);let ms=1000,timer,observed=0,releaseBefore,runnerCalls=0;
 const pending=new Promise(ok=>releaseBefore=ok),initialEntered=deferred(),beforeEntered=deferred();
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms},{platform:'darwin',access:async()=>{},snapshot:async()=>{observed++;if(observed===1){initialEntered.resolve();return snap(100);}beforeEntered.resolve();return pending;},setTimeout:fn=>{timer=fn;return fn;},clearTimeout:()=>{},runnerFactory:()=>{runnerCalls++;throw Error('must not attach');}});
 await initialEntered.promise;s.startRide(ms);ms=65000;timer();await beforeEntered.promise;assert.equal(observed,2);ms=90000;s.stopRide(ms);releaseBefore(snap(65000));
 const r=await s.finish();assert.equal(r.singleTaskAttempts,1);assert.equal(runnerCalls,0);assert.equal(r.collectionComplete,false);assert(r.errors.some(e=>e.message.includes('release occurred')));
});

test('full factory archives and independently replays a bound successful observation',async t=>{
 const output=await dir(t),f=fixture(output);let ms=9000,timer,observed=0,ran=0;
 const snapshots=[f.receipt.initialSnapshot,f.receipt.beforeSnapshot,f.receipt.afterSnapshot],initialEntered=deferred(),afterEntered=deferred();
 const s=createNativeGpuSampler({browserSession:{send(){}},browserVersion:version,systemInfo:system,output,now:()=>ms},{platform:'darwin',access:async()=>{},realpath:async p=>p,
  snapshot:async()=>{const r=structuredClone(snapshots[observed++]);ms=r.after.monotonicMs+1;if(observed===1)initialEntered.resolve();if(observed===3)afterEntered.resolve();return r;},
  setTimeout:fn=>{timer=fn;return fn;},clearTimeout:()=>{},runnerFactory:()=>({metadata:f.receipt.sample,async run(pid){assert.equal(pid,222);ran++;
   for(const [name,bytes] of Object.entries(f.raw))await writeFile(resolve(output,name),bytes,{flag:'wx'});ms=83004;return this.metadata;}})});
 await initialEntered.promise;assert.equal(observed,1);
 ms=10000;s.startRide(ms);ms=74000;timer();await afterEntered.promise;assert.equal(observed,3);
 ms=99999.4;s.stopRide(ms);const r=await s.finish();assert.equal(ran,1);assert.equal(r.collectionComplete,true);assert.equal(r.validationPassed,true);
 const saved=JSON.parse(await readFile(resolve(output,'native-gpu-sample.json'),'utf8'));
 assert.deepEqual(saved,r);assert.deepEqual(await verifyNativeGpuSample(saved,{...f.options,readCapturedFile:file=>readFile(resolve(output,file))}),saved.validation);
});
