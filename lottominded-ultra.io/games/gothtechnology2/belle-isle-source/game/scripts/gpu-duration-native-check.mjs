/** Separate instrumented GPU-duration diagnostic using the existing full-game
 * ride/GPS workload and limits. It is never release-performance acceptance. */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {checkGpsFullScene} from './gps-full-scene-check.mjs';
// GPU TRACE OPT-IN BEGIN
import {createGpuDurationTrace,markGpuTraceClock} from './gpu-duration-trace.mjs';
// GPU TRACE OPT-IN END
const gpuApiWallStages=['issue.drawingBufferWidth','issue.drawingBufferHeight','issue.drawFramebufferBinding','issue.samples',
 'issue.sampleBuffers','issue.createQuery','issue.beginQuery','issue.ownershipAfterBegin','close.ownership','close.endQuery'];
/** Independent receipt arithmetic; call spans overlap the existing enclosing
 * callback/query-bracket totals and must never be added to those totals. */
function validateGpuApiWall(row){
 const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
 const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0,tolerance=.000001;
 const timing=row.apiWall,calls=Array.isArray(timing?.calls)?timing.calls:[];
 check(Array.isArray(timing?.calls)&&calls.length>=6&&calls.length<=12&&timing.dropped===0,'API wall receipt bound/inventory is invalid');
 const phases={issue:[],end:[],cleanup:[]};let phaseOrder=0,previousEnd=row.issuedCpuTimeMs,sum=0,firstStart=null,lastEnd=null;
 for(const call of calls.slice(0,12)){
  if(!call||typeof call!=='object'){errors.push('API wall call object missing');continue;}
  check(gpuApiWallStages.includes(call.stage),'Unknown API wall stage');
  const phase=['issue','end','cleanup'].indexOf(call.phase);
  check(phase>=phaseOrder&&phase>=0,'API wall phases are out of order');if(phase>=0){phaseOrder=phase;phases[call.phase].push(call);}
  check(['returned','threw'].includes(call.outcome),'API wall call outcome is invalid');
  const clockErrors=Array.isArray(call.clockErrors)?call.clockErrors:[];
  check(Array.isArray(call.clockErrors)&&clockErrors.length<=3&&new Set(clockErrors).size===clockErrors.length&&
   clockErrors.every(value=>['start-threw','start-invalid','end-threw','end-invalid','regressed'].includes(value)),'API wall clock error inventory is invalid');
  for(const key of ['start','end']){
   const value=call[key+'Ms'],invalid=clockErrors.filter(error=>error===key+'-threw'||error===key+'-invalid');
   check((value===null&&invalid.length===1)||(finite(value)&&invalid.length===0),'API wall timestamp/error markers disagree');
  }
  const regressed=finite(call.startMs)&&finite(call.endMs)&&call.endMs<call.startMs;
  check(clockErrors.includes('regressed')===regressed,'API wall regression marker disagrees with timestamps');
  if(clockErrors.length){check(call.wallMs===null,'Invalid API wall clock must retain a null duration');errors.push('API wall clock could not be validated');continue;}
  check(finite(call.startMs)&&finite(call.endMs)&&call.endMs>=call.startMs&&call.wallMs===call.endMs-call.startMs,'API wall duration does not match its raw timestamps');
  check(finite(previousEnd)&&call.startMs+tolerance>=previousEnd,'API wall call intervals overlap or precede issue');
  previousEnd=call.endMs;firstStart??=call.startMs;lastEnd=call.endMs;if(finite(call.wallMs))sum+=call.wallMs;
  if(finite(row.queryBracketCpuMs))check(call.endMs<=row.issuedCpuTimeMs+row.queryBracketCpuMs+tolerance,'API wall call escaped the legacy query bracket');
  if(finite(row.cpuEndMs)&&finite(row.renderSubmitCpuMs)&&call.phase==='issue')
   check(call.endMs<=row.cpuEndMs-row.renderSubmitCpuMs+tolerance,'Issue API wall call escaped the pre-render interval');
  if(finite(row.cpuEndMs)&&call.phase==='end')check(call.startMs+tolerance>=row.cpuEndMs,'Close API wall call precedes the original render-end timestamp');
 }
 check(phases.issue.length>=6&&phases.issue.length<=8&&phases.issue.every((call,index)=>call.stage===gpuApiWallStages[index]),'Issue API wall stage order is invalid');
 check(phases.issue.slice(0,6).every(call=>call.outcome==='returned'),'An issued query cannot have failed before allocation');
 for(const phase of ['end','cleanup'])check(phases[phase].length<=2&&phases[phase].every((call,index)=>call.stage===gpuApiWallStages[8+index]),'Close API wall stage order is invalid');
 for(const phase of ['issue','end','cleanup']){const threw=phases[phase].findIndex(call=>call.outcome==='threw');check(threw<0||threw===phases[phase].length-1,'A thrown API call must terminate its phase');}
 if(row.status==='valid'||finite(row.cpuEndMs))check(phases.issue.length===8&&phases.end.length===2&&phases.cleanup.length===0&&calls.every(call=>call&&call.outcome==='returned'),'Completed query lacks its successful issue/close API wall receipts');
 if(firstStart!==null&&lastEnd!==null)check(sum<=lastEnd-firstStart+tolerance,'Non-overlapping API wall calls exceed their containing span');
 if(finite(row.queryBracketCpuMs))check(sum<=row.queryBracketCpuMs+tolerance,'API wall sum exceeds its legacy enclosing bracket');
 return errors;
}
/** Derived here from scalar raw receipts, never from a probe-supplied aggregate. */
function summarizeGpuApiWall(gpu){
 const rows=Array.isArray(gpu?.samples)?gpu.samples.slice(0,256):[];
 return gpuApiWallStages.map(stage=>{
  const calls=rows.flatMap(row=>Array.isArray(row?.apiWall?.calls)?row.apiWall.calls.slice(0,12):[]).filter(call=>call?.stage===stage);
  const values=calls.filter(call=>Array.isArray(call.clockErrors)&&call.clockErrors.length===0&&
   typeof call.startMs==='number'&&Number.isFinite(call.startMs)&&call.startMs>=0&&typeof call.endMs==='number'&&Number.isFinite(call.endMs)&&call.endMs>=call.startMs&&
   call.wallMs===call.endMs-call.startMs).map(call=>call.wallMs).sort((a,b)=>a-b);
  return{stage,calls:calls.length,returned:calls.filter(call=>call.outcome==='returned').length,threw:calls.filter(call=>call.outcome==='threw').length,
   invalidClock:calls.length-values.length,phases:Object.fromEntries(['issue','end','cleanup'].map(phase=>[phase,calls.filter(call=>call.phase===phase).length])),
   wallMs:values.length?{count:values.length,sum:values.reduce((a,b)=>a+b,0),mean:values.reduce((a,b)=>a+b,0)/values.length,
    p50:values[Math.min(values.length-1,Math.floor(values.length*.5))],p95:values[Math.min(values.length-1,Math.floor(values.length*.95))],max:values.at(-1)}:null};
 });
}
/** Reconcile the detached report without polling GL or trusting its aggregates. */
function validateGpuDuration(gpu,actualGpu){
 const errors=[],check=(condition,message)=>{if(!condition)errors.push(message);};
 const finite=value=>typeof value==='number'&&Number.isFinite(value),integer=value=>Number.isSafeInteger(value)&&value>=0;
 if(!gpu||typeof gpu!=='object')return ['Opt-in GPU duration snapshot missing'];
 check(gpu.version===2&&gpu.enabled===true&&gpu.status==='ready','GPU duration schema or state is invalid');
 check(gpu.apiWallTiming?.clock==='performance.now'&&gpu.apiWallTiming.maxCallsPerSample===12&&JSON.stringify(gpu.apiWallTiming.stages)===JSON.stringify(gpuApiWallStages),'API wall timing scope/schema is invalid');
 check(gpu.capability?.extension==='EXT_disjoint_timer_query_webgl2'&&gpu.capability.available===true&&integer(gpu.capability.counterBits)&&gpu.capability.counterBits>0,'Elapsed-query capability was not established');
 check(gpu.backend?.renderer===actualGpu?.renderer&&gpu.backend?.version===actualGpu?.version,'Query and workload GPU identities differ');
 check(gpu.limits?.sampleEvery===7&&gpu.limits?.maxIssued===256&&gpu.limits?.maxPending===4,'Diagnostic sampling bounds changed');
 const c=gpu.counts??{},rows=Array.isArray(gpu.samples)?gpu.samples:[];
 check(Array.isArray(gpu.samples)&&rows.length===c.issued&&rows.length<=256,'Raw receipt inventory differs from issued queries');
 check(['admittedCallbacks','eligibleCallbacks','issued','completed','valid','rejected','unresolved','pendingPeak','errors'].every(k=>integer(c[k])),'GPU counters must be nonnegative safe integers');
 check(c.issued>=8&&c.issued<=256&&c.valid>=8&&c.valid<=c.issued,'Fewer than eight valid bounded GPU measurements');
 check(c.issued===c.valid+c.rejected+c.unresolved&&c.completed===c.valid+c.rejected,'Query lifetime accounting is inconsistent');
 check(c.unresolved<=c.pendingPeak&&c.pendingPeak<=4&&c.pendingPeak>=1,'Pending query bound is invalid');
 check(c.eligibleCallbacks<=c.admittedCallbacks&&c.errors===0,'Callback accounting or observer errors are invalid');
 const statuses={valid:0,rejected:0,pending:0},values=[];let previousCallback=0,previousEligible=0;
 for(const [index,row]of rows.slice(0,256).entries()){
  const label='Receipt '+(index+1)+': ';
  if(!row||typeof row!=='object'){errors.push(label+'missing object');continue;}
  errors.push(...validateGpuApiWall(row).map(error=>label+error));
  check(row.sample===index+1&&integer(row.callback)&&row.callback>previousCallback&&row.callback<=c.admittedCallbacks,'Receipt identifiers or callback order are invalid');
  check(integer(row.eligibleCallback)&&row.eligibleCallback>previousEligible&&row.eligibleCallback<=c.eligibleCallbacks&&row.eligibleCallback<=row.callback&&row.eligibleCallback%7===0,label+'sampling cadence is invalid');
  previousCallback=row.callback;previousEligible=row.eligibleCallback;
  if(Object.hasOwn(statuses,row.status))statuses[row.status]++;else errors.push(label+'unknown query status');
  check(finite(row.rafTimeMs)&&row.rafTimeMs>=0&&finite(row.cpuStartMs)&&row.cpuStartMs>=0&&finite(row.issuedCpuTimeMs)&&row.issuedCpuTimeMs>=row.cpuStartMs,label+'issue timestamps are invalid');
  check(integer(row.drawingBuffer?.width)&&row.drawingBuffer.width>0&&integer(row.drawingBuffer?.height)&&row.drawingBuffer.height>0,label+'drawing buffer is invalid');
  check(typeof row.framebuffer?.defaultBound==='boolean'&&integer(row.framebuffer.samples)&&integer(row.framebuffer.sampleBuffers),label+'framebuffer metadata is invalid');
  check(['waiting','paired','interrupted'].includes(row.association),label+'unknown callback association');
  for(const key of ['nextAdmittedCallback','nextEligibleCallback']){
   const next=row[key];if(next===null)continue;
   check(next&&integer(next.callback)&&next.callback>row.callback&&finite(next.rafTimeMs)&&next.rafTimeMs>row.rafTimeMs&&next.intervalMs===next.rafTimeMs-row.rafTimeMs&&typeof next.eligible==='boolean',label+key+' is invalid');
  }
  if(row.association==='paired')check(row.nextAdmittedCallback?.eligible===true&&row.nextEligibleCallback?.eligible===true&&row.nextAdmittedCallback.callback===row.nextEligibleCallback.callback,label+'paired callbacks do not agree');
  if(row.association==='waiting')check(row.nextAdmittedCallback===null&&row.nextEligibleCallback===null,label+'waiting association has a future receipt');
  if(row.status==='valid'){
   const ns=row.gpuNanoseconds;
   check(Number.isSafeInteger(ns)&&ns>0&&row.gpuMs===ns/1e6,label+'GPU duration does not match raw nanoseconds');
   if(Number.isSafeInteger(ns)&&ns>0&&row.gpuMs===ns/1e6)values.push(ns/1e6);
   check(row.rejectionReason===null&&integer(row.resultCallback)&&row.resultCallback>row.callback&&row.resolutionDelayCallbacks===row.resultCallback-row.callback&&finite(row.resolutionDelayCpuMs)&&row.resolutionDelayCpuMs>=0,label+'result availability receipt is invalid');
   check(finite(row.cpuEndMs)&&row.cpuEndMs>=row.issuedCpuTimeMs&&row.cpuElapsedMs===row.cpuEndMs-row.cpuStartMs&&finite(row.renderSubmitCpuMs)&&row.renderSubmitCpuMs>=0&&row.renderSubmitCpuMs<=row.cpuElapsedMs&&finite(row.queryBracketCpuMs)&&row.queryBracketCpuMs>=0,label+'same-callback CPU timing is invalid');
   check(integer(row.drawCalls)&&row.drawCalls>0&&integer(row.triangles)&&integer(row.renderPasses)&&row.renderPasses>=1&&typeof row.shadowUpdateRequested==='boolean',label+'render metadata is invalid');
  }else{
   check(row.gpuNanoseconds===null&&row.gpuMs===null,label+'unresolved/rejected result must not contain a duration');
   if(row.status==='rejected')check(typeof row.rejectionReason==='string'&&row.rejectionReason.length>0,label+'rejection reason missing');
  }
 }
 check(statuses.valid===c.valid&&statuses.rejected===c.rejected&&statuses.pending===c.unresolved,'Raw receipt statuses differ from counters');
 values.sort((a,b)=>a-b);
 const expected=values.length?{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:values[Math.min(values.length-1,Math.floor(values.length*.5))],p95:values[Math.min(values.length-1,Math.floor(values.length*.95))],max:values.at(-1)}:null;
 check(expected!==null&&gpu.gpuMs&&Object.keys(expected).every(k=>gpu.gpuMs[k]===expected[k]),'GPU aggregate differs from independently recomputed valid receipts');
 return errors;
}
const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:180000});
const device=process.env.BELLE_PROFILE_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const seconds=Math.max(30,Math.min(600,Number(process.env.BELLE_PROFILE_SECONDS)||90));
const mode='full';
const output=resolve(game,'output/gpu-duration-profile',mode,device);
await mkdir(output,{recursive:true});
const report={sourceHead:process.env.GITHUB_SHA||null,device,viewport,requestedSeconds:seconds,mode,
 renderBackend:null,rendererFallback:null,actualGpu:null,input:null,classification:null,
 hardware:'Chrome '+process.platform+' '+process.arch+'; phone viewport is emulated',
 acceptanceScope:'INSTRUMENTED FULL-GAME GPU DURATION DIAGNOSTIC ONLY; not release-performance acceptance or device certification',
 gpuDuration:null,gpuApiWall:null,gpuDurationDiagnosticComplete:false,gpuDurationValidationErrors:[],
 instrumentationNote:'GPU queries and per-call wall timing add diagnostic work. All frame-budget and GPS checks remain, but no instrumented result is release-performance acceptance. Query duration excludes compositor/presentation and queue delay before the interval; it is not pure shader-busy time. API wall duration can include scheduling, process/driver communication or synchronization; it is not pure CPU execution or proof of a GPU cause. These spans overlap legacy callback or query-bracket intervals; close scopes occur after cpuEndMs but within a completed query bracket. Do not add child and enclosing spans or subtract their percentiles.',
 passed:false,instrumentedRideGatePassed:false,gpsRegression:null,frameQualityAccepted:false,releasePerformanceVerified:false,welcomeReadyMs:null,rideStartedMs:null,firstPlayableMs:null,profileWindowCaveat:'Local browser capture ends at genuine trusted W-keyup before Settings/report extraction; NOT physical-device certification',profile:null,memory:null,browserSchedulerProbe:null,cdpCpuProbe:null,probeErrors:[],errors:[],failedRequests:[],elapsedWallMs:null};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const begin=Date.now();let browser,page;
// GPU TRACE OPT-IN BEGIN
const traceRequested=process.env.BELLE_GPU_TRACE==='1';
const traceEnvironment=traceRequested?{platform:process.platform,device,mode,requestedSeconds:seconds,renderBackend:null,actualGpu:null}:null;
const trace=traceRequested?createGpuDurationTrace({output,environment:traceEnvironment,
 createSession:()=>browser.newBrowserCDPSession(),browserVersion:()=>browser.version(),
 markClock:name=>page.evaluate(markGpuTraceClock,name)}):null;
// GPU TRACE OPT-IN END
try{
 // GPU TRACE OPT-IN BEGIN
 if(traceRequested&&(process.platform!=='darwin'||device!=='desktop'||mode!=='full'||seconds!==90))
  throw Error('BELLE_GPU_TRACE=1 requires the unchanged 90-second desktop full-scene native Metal workload on darwin');
 // GPU TRACE OPT-IN END
 const native=process.platform==='darwin'?'metal':process.platform==='win32'?'d3d11':'gl';
 const hardware={name:'angle-'+native,args:['--enable-gpu','--use-gl=angle','--use-angle='+native]};
 const candidates=process.platform==='darwin'?[hardware]:[hardware,
  {name:'swiftshader-fallback',args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']}];
 let lastBackendError;
 for(const candidate of candidates){
  try{
   // macOS provides a WindowServer. Its onscreen compositor sustains normal
   // refresh even when the headless virtual display throttles a clear canvas.
   browser=await chromium.launch({channel:'chrome',headless:process.platform!=='darwin',args:candidate.args});
   const probe=await browser.newPage();
   const available=await probe.evaluate(()=>{
    const gl=document.createElement('canvas').getContext('webgl2');
    if(!gl)return null;
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
   });
   await probe.close();
   if(!available)throw Error('WebGL2 unavailable on '+candidate.name);
   report.probeRenderer=available;
   console.log('WebGL2 probe:',available);
   if(candidate.name==='angle-metal'&&(!/Metal/i.test(available)||/SwiftShader|llvmpipe|software rasterizer/i.test(available)))
    throw Error('Metal renderer unavailable: '+available);
   report.renderBackend=candidate.name;
   page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
   await page.bringToFront();
   break;
  }catch(error){
   lastBackendError=String(error);await browser?.close().catch(()=>{});browser=undefined;
   if(candidate===candidates[0])report.rendererFallback=lastBackendError;
  }
 }
 if(!page)throw Error('No real WebGL2 backend available: '+lastBackendError);
 page.setDefaultTimeout(180000);
 await page.bringToFront();
 // Boot with this lane's actual settings so startup prepares the same shaders
 // that the 90-second ride will exercise. Settings also verifies the selection.
 const quality=device==='phone'?'smooth':'high';
 await page.addInitScript(quality=>{
  localStorage.setItem('belle-graphics-v1',JSON.stringify({quality,cap:60,antiAliasing:'automatic'}));
 },quality);
 // Distinguish a blocked driver link from slow submission when a hosted GPU
 // times out before the first ride. Restore the native methods before capture.
 await page.addInitScript(()=>{
  const proto=WebGL2RenderingContext.prototype;
  const link=proto.linkProgram,query=proto.getProgramParameter;
  const pending=new Map();let linked=0,checks=0;
  proto.linkProgram=function(program){
   linked++;pending.set(program,performance.now());return link.call(this,program);
  };
  proto.getProgramParameter=function(program,pname){
   const value=query.call(this,program,pname);
   if(pname===0x91b1){checks++;if(value)pending.delete(program);}
   return value;
  };
  window.__belleStartupLinks=()=>({linked,completionChecks:checks,pending:pending.size,
   oldestUnconfirmedMs:Math.max(0,...[...pending.values()].map(start=>performance.now()-start))});
  window.__belleEndLinkProbe=()=>{proto.linkProgram=link;proto.getProgramParameter=query;pending.clear();};
 });
 await page.addInitScript(()=>{const receipts={keydowns:0,keyups:0,repeats:0,blurs:0};
  // Read native UI/input events without replacing game, sensor, or renderer APIs.
  // Retain the early prelude even if later events reach this bounded limit.
  const transitions=[],transitionLimit=32;let observing=false,observerStarted=0,droppedTransitions=0,firstW=false;
  const mark=event=>{
   if(!observing)return;
   if(transitions.length>=transitionLimit){droppedTransitions++;return;}
   transitions.push({event,atMs:Math.max(0,Math.round(performance.now()-observerStarted))});
  };
  window.__belleObserverWindow={
   reset(){transitions.length=0;droppedTransitions=0;firstW=false;observerStarted=performance.now();observing=true;mark('observer-start');},
   finish(){mark('observer-snapshot');observing=false;return {
    scope:'Observers begin with Settings open, before the ride profile starts, and end after genuine W-keyup. Includes the profile-start, menu-close and focus prelude; distinct from the unchanged requested riding window.',
    durationMs:Math.max(0,Math.round(performance.now()-observerStarted)),transitionLimit,droppedTransitions,transitions:[...transitions],
    caveat:'Relative native-event observation times only; no coordinates, GPU execution timings, or previous-render attribution.',
   };},
  };
  document.addEventListener('click',event=>{
   if(!event.isTrusted||!(event.target instanceof Element))return;
   const target=event.target;
   if(target.closest('#ride-profile > button')?.textContent?.startsWith('Start'))mark('profile-start-click');
   if(target.closest('[data-close="settings"]'))mark('settings-close-click');
  },true);
  document.addEventListener('close',event=>{if(event.target?.id==='settings')mark('settings-close-event');},true);
  document.addEventListener('focus',event=>{if(event.target?.id==='game')mark('game-focus');},true);
  document.addEventListener('visibilitychange',()=>mark(document.hidden?'document-hidden':'document-visible'));
  window.addEventListener('focus',()=>mark('window-focus'));
  window.addEventListener('blur',()=>mark('window-blur'));
  window.__belleInputReceipts=receipts;
  window.addEventListener('keydown',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keydowns++;if(event.repeat)receipts.repeats++;if(observing&&!firstW){firstW=true;mark('first-w-keydown');}}},true);
  window.addEventListener('blur',()=>receipts.blurs++,true);
  window.addEventListener('keyup',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keyups++;mark('w-keyup');}},true);
  // Browser-only compositor callback observations: no extra game or GPU draws.
  const browserClock={rafCallbacks:0,gaps:[],over250ms:0,maxGapMs:0};let lastRaf=null;
  browserClock.reset=()=>{browserClock.rafCallbacks=0;browserClock.gaps=[];browserClock.over250ms=0;browserClock.maxGapMs=0;lastRaf=null;};
  browserClock.snapshot=()=>({rafCallbacks:browserClock.rafCallbacks,over250ms:browserClock.over250ms,
   maxGapMs:browserClock.maxGapMs,lastGapsMs:browserClock.gaps.slice(),
   caveat:'Independent browser requestAnimationFrame callbacks, NOT game draws or actual GPU-present timings'});
  window.__belleBrowserClock=browserClock;
  function browserTick(now){
   if(lastRaf!==null){const gap=Math.max(0,now-lastRaf);browserClock.maxGapMs=Math.max(browserClock.maxGapMs,gap);
    if(gap>250)browserClock.over250ms++;
    if(browserClock.gaps.length>=128)browserClock.gaps.shift();browserClock.gaps.push(gap);
   }
   lastRaf=now;browserClock.rafCallbacks++;requestAnimationFrame(browserTick);
  }
  requestAnimationFrame(browserTick);
  const longTasks={count:0,over250ms:0,maxMs:0,totalMs:0};
  longTasks.reset=()=>{longTasks.count=longTasks.over250ms=longTasks.maxMs=longTasks.totalMs=0;};
  longTasks.snapshot=()=>({count:longTasks.count,over250ms:longTasks.over250ms,maxMs:longTasks.maxMs,totalMs:longTasks.totalMs,
   caveat:'Browser long tasks are main-thread, NOT GPU queue execution'});
  window.__belleLongTasks=longTasks;
  try{new PerformanceObserver(list=>{for(const task of list.getEntries()){
   longTasks.count++;longTasks.totalMs+=task.duration;longTasks.maxMs=Math.max(longTasks.maxMs,task.duration);
   if(task.duration>250)longTasks.over250ms++;
  }}).observe({type:'longtask'});}catch{/* availability is not invented */}
 });
 const sourcePageError=err=>report.errors.push(err.message);
 const sourceConsoleError=msg=>{if(msg.type()==='error')report.errors.push(msg.text());};
 const sourceResponseError=r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());};
 const sourceRequestError=r=>report.failedRequests.push((r.failure()?.errorText||'failed')+' '+r.url());
 page.on('pageerror',sourcePageError);page.on('console',sourceConsoleError);
 page.on('response',sourceResponseError);page.on('requestfailed',sourceRequestError);
 const navigationStarted=Date.now();
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1&gpu-duration=1'+(mode==='diagnostic'?'&perfProbe=1':'&locationPerf=1'),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});
 report.welcomeReadyMs=Date.now()-navigationStarted;
 report.startupLinks=await page.evaluate(()=>{const links=window.__belleStartupLinks();window.__belleEndLinkProbe();return links;});
 report.actualGpu=await page.locator('#game').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Game WebGL2 unavailable');
  const ext=gl.getExtension('WEBGL_debug_renderer_info');return {
   vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
   renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),
   version:String(gl.getParameter(gl.VERSION))};
 });
 if(report.renderBackend==='angle-metal'&&(!/Metal/i.test(report.actualGpu.renderer)||/SwiftShader|llvmpipe|software rasterizer/i.test(report.actualGpu.renderer)))
  throw Error('The sustained profile requires a Metal renderer on macOS. Chrome reported '+report.actualGpu.renderer);
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 report.rideStartedMs=Date.now()-navigationStarted;
 // The QA observer is hidden during ride selection. Once play starts, keep
 // its idle disclosure collapsed until the separate GPS capture windows.
 if(mode==='full')await page.locator('#location-perf > summary').click();
 // Welcome/ride start are not proof of the first input-responsive rendered frame.
 // firstPlayableMs remains null pending genuine frame-coupled input evidence.
 async function settings(){
  if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#settings-open').click();
  await expect(page.locator('#settings')).toBeVisible();
 }
 await settings();
 // Keep the actual quality tier identical between FULL and DIAGNOSTIC on each viewport.
 // Only localhost perfProbe reductions may differ; never attribute a High→Smooth change to scene reduction.
 await expect(page.locator('#quality')).toHaveValue(quality);
 if(mode==='diagnostic')await expect(page.locator('#performance-probe-warning')).toBeVisible();
 else await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
 const panel=page.locator('#ride-profile');
 await expect(panel).toBeAttached();
 // GPU TRACE OPT-IN BEGIN
 if(trace){
  Object.assign(traceEnvironment,{renderBackend:report.renderBackend,actualGpu:report.actualGpu});
  await trace.start(); // Setup errors remain explicit evidence; every original workload assertion still runs.
 }
 // GPU TRACE OPT-IN END
 await panel.locator('summary').click();
 // Start independent observers before the profiler/menu transition. Resetting
 // after closing Settings would miss the preceding render of an early stall.
 let cdp=null,initialCounters=null,cpuProbeStart=Date.now();
 try{
  cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  initialCounters=(await cdp.send('Performance.getMetrics')).metrics;
  cpuProbeStart=Date.now();
 }catch(error){report.probeErrors.push('CDP initial counters: '+String(error));}
 try{await page.evaluate(()=>{window.__belleBrowserClock?.reset?.();window.__belleLongTasks?.reset?.();window.__belleObserverWindow?.reset?.();});}
 catch(error){report.probeErrors.push('Browser probe reset: '+String(error));}
 await panel.getByRole('button',{name:'Start 10-minute capture'}).click();
 await page.locator('[data-close="settings"]').click();
 await page.locator('#game').focus();
 let reassertions=0,inFlight=false,heartbeatError=null,pendingHeartbeat=Promise.resolve();
 await page.keyboard.down('w');
 // This timer is outside the game event loop: reassert real input, never pose.
 const heartbeat=setInterval(()=>{
  if(inFlight)return;inFlight=true;
  pendingHeartbeat=page.keyboard.down('w').then(()=>reassertions++,error=>{heartbeatError=String(error);}).finally(()=>{inFlight=false;});
 },450);
 try{await page.waitForTimeout(seconds*1000);}finally{clearInterval(heartbeat);await pendingHeartbeat;await page.keyboard.up('w');}
 report.input={...(await page.evaluate(()=>window.__belleInputReceipts||{keydowns:0,repeats:0,blurs:0})),reassertions,heartbeatError};
 try{report.browserSchedulerProbe=await page.evaluate(()=>({
  observationWindow:window.__belleObserverWindow?.finish?.()??null,
  clock:window.__belleBrowserClock?.snapshot?.()??null,
  longTasks:window.__belleLongTasks?.snapshot?.()??null
 }));}catch(error){report.probeErrors.push('Browser scheduler snapshot: '+String(error));}
 try{
  if(cdp&&initialCounters){
   const subsequent=(await cdp.send('Performance.getMetrics')).metrics;
   const before=Object.fromEntries(initialCounters.map(x=>[x.name,x.value]));
   const after=Object.fromEntries(subsequent.map(x=>[x.name,x.value]));
   const durations=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','V8CompileDuration'];
   report.cdpCpuProbe={wallSeconds:(Date.now()-cpuProbeStart)/1000,
    windowScope:'CDP counters begin before the ride profile starts with Settings open and end after genuine W-keyup; includes the menu/focus prelude, not only the requested riding window.',
    durationsSeconds:Object.fromEntries(durations.filter(k=>Number.isFinite(before[k])&&Number.isFinite(after[k]))
     .map(k=>[k,Math.max(0,after[k]-before[k])])),
    endJsHeapUsedBytes:after.JSHeapUsedSize??null,
    caveat:'Chrome DevTools main-thread counters over the stated observer window, NOT GPU time or VRAM'};
  }
 }catch(error){report.probeErrors.push('CDP ending counters: '+String(error));}
 try{await cdp?.detach();}catch{/* observer cleanup cannot waive test results */}
 await settings();
 // Local RideProfile finishes on real W-keyup; keyboard input and GPU frames are unmodified.
 if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
 await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
 report.profile=JSON.parse(await panel.locator('textarea').inputValue());
 report.gpuDuration=report.profile.settings?.gpuDuration??null;
 // Inspect only the immutable, bounded snapshot already emitted by the real
 // recorder. No forced query resolution, fence, frame, or app control is used.
 report.gpuDurationValidationErrors=validateGpuDuration(report.gpuDuration,report.actualGpu);
 report.gpuApiWall=summarizeGpuApiWall(report.gpuDuration);
 report.gpuDurationDiagnosticComplete=report.gpuDurationValidationErrors.length===0;
 // GPU TRACE OPT-IN BEGIN
 // Riding, native key release and ending counters are complete before any IO.read.
 if(trace)report.gpuTrace=await trace.finish(report.gpuDuration?.samples??[]);
 // GPU TRACE OPT-IN END
 if(report.profile.stopReason!=='trusted-W-keyup')throw Error('Capture did not end on real trusted keyboard release');
 report.memory=await page.evaluate(()=>({
  jsHeap:performance.memory?{usedBytes:performance.memory.usedJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit}:null,
  userAgent:navigator.userAgent,deviceMemoryGB:navigator.deviceMemory??null,
  caveat:'JS heap is not total device RAM or GPU VRAM; physical device profiling still required'
 }));
 await page.locator('[data-close="settings"]').click();
 await page.screenshot({path:resolve(output,'riding-end.png'),timeout:180000});
 const stats=report.profile;
 report.frameQualityAccepted=stats.metrics?.frameMs?.p95<=50&&stats.over250ms===0;
 const keyReceived=report.input.keydowns>=1&&report.input.keyups>=1&&!report.input.heartbeatError;
 report.passed=keyReceived&&stats.frames>=8&&stats.metrics?.frameMs?.p95!==null&&
  stats.movingSeconds>=5&&stats.distanceMetres>=3&&report.frameQualityAccepted&&!report.errors.length&&!report.failedRequests.length;
 report.classification=stats.frames<8?'insufficient-rendered-frames':!keyReceived?'input-not-delivered':
  stats.distanceMetres<3?'render-starved-or-blocked-motion':report.frameQualityAccepted?'frame-budget-met':'stalls-detected';
 // A reduced-scene or software-browser success is never release approval.
 report.releasePerformanceVerified=false;
 report.instrumentedRideGatePassed=report.passed;
 if(mode==='full'){
  report.gpsRegression=await checkGpsFullScene({page,expect,game,output,device,renderBackend:report.renderBackend,actualGpu:report.actualGpu,openSettings:settings,
   releaseSourceContext:async()=>{
    // Native ride and sensor checks are complete. Keep every collected error,
    // then stop observing intentional teardown before releasing the GPU scene.
    page.off('pageerror',sourcePageError);page.off('console',sourceConsoleError);
    page.off('response',sourceResponseError);page.off('requestfailed',sourceRequestError);
    await page.context().close();
   }});
  // Keep the original riding threshold and failures; GPS regression is an
  // additional functional gate, with its timing distributions reported apart.
  report.passed=report.instrumentedRideGatePassed&&report.gpsRegression.passed&&!report.errors.length&&!report.failedRequests.length;
 }
 report.workloadClassification=report.classification;
 report.classification='instrumented-gpu-diagnostic; workload='+report.workloadClassification+'; gpu='+(report.gpuDurationDiagnosticComplete?'complete':'incomplete');
 report.passed=report.passed&&report.gpuDurationDiagnosticComplete;
}catch(error){
 report.passed=false;
 report.workloadClassification=report.workloadClassification??report.classification;
 report.classification='instrumented-gpu-diagnostic-error';
 report.errors.push(String(error?.stack||error));
 if(page)report.startupAtFailure=await page.evaluate(()=>({
  visible:document.visibilityState,focused:document.hasFocus(),loading:document.querySelector('#loading')?.textContent,
  telemetry:window.__belleStartupProfile?.(),callbacks:window.__belleBrowserClock?.snapshot?.(),links:window.__belleStartupLinks?.()
 })).catch(()=>null);
}
finally{
 // GPU TRACE OPT-IN BEGIN
 if(trace){
  report.gpuTrace??=await trace.finish(report.gpuDuration?.samples??[]);
  report.gpuTraceDiagnosticComplete=report.gpuTrace.complete;
  report.passed=report.passed&&report.gpuTraceDiagnosticComplete;
  report.classification+='; host-trace='+(report.gpuTraceDiagnosticComplete?'complete':'incomplete');
 }
 // GPU TRACE OPT-IN END
 report.elapsedWallMs=Date.now()-begin;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close().catch(()=>{});
 await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify({passed:report.passed,diagnosticComplete:report.gpuDurationDiagnosticComplete,gpuMs:report.gpuDuration?.gpuMs,gpuCounts:report.gpuDuration?.counts,gpuValidationErrors:report.gpuDurationValidationErrors,mode,device,renderBackend:report.renderBackend,renderer:report.actualGpu?.renderer,classification:report.classification,frames:report.profile?.frames,
 movingSeconds:report.profile?.movingSeconds,distanceMetres:report.profile?.distanceMetres,
 p50:report.profile?.metrics?.frameMs?.p50,p95:report.profile?.metrics?.frameMs?.p95,
 p99:report.profile?.metrics?.frameMs?.p99,instrumentedRideGatePassed:report.instrumentedRideGatePassed,
 gps:report.gpsRegression?{passed:report.gpsRegression.passed,syntheticSensors:true,states:Object.fromEntries(Object.entries(report.gpsRegression.states).map(([name,value])=>[name,{frames:value.renderedFrames,p95Ms:value.frameIntervalsMs?.p95Ms,stallsOver250ms:value.stalls.over250Ms}])),errors:report.gpsRegression.errors.slice(0,2)}:null,
 errors:report.errors.slice(0,3)}));
if(!report.passed)process.exitCode=1;
