/** Full-fidelity and optional local-only diagnostic lanes, genuine browser input. */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:180000});
const device=process.env.BELLE_PROFILE_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const seconds=Math.max(30,Math.min(600,Number(process.env.BELLE_PROFILE_SECONDS)||90));
const mode=process.env.BELLE_PROFILE_MODE==='diagnostic'?'diagnostic':'full';
const output=resolve(game,'output/sustained-profile',mode,device);
await mkdir(output,{recursive:true});
const report={sourceHead:process.env.GITHUB_SHA||null,device,viewport,requestedSeconds:seconds,mode,
 renderBackend:null,rendererFallback:null,actualGpu:null,input:null,classification:null,
 hardware:'GitHub Actions Chrome; phone viewport is NOT physical iOS/Android hardware',
 acceptanceScope:mode==='diagnostic'?'REDUCED SCENE DIAGNOSTIC ONLY; not release quality':'FULL CURRENT GAME; still not device certification',
 passed:false,frameQualityAccepted:false,releasePerformanceVerified:false,welcomeReadyMs:null,rideStartedMs:null,firstPlayableMs:null,profileWindowCaveat:'Local browser capture ends at genuine trusted W-keyup before Settings/report extraction; NOT physical-device certification',profile:null,memory:null,browserSchedulerProbe:null,cdpCpuProbe:null,probeErrors:[],errors:[],failedRequests:[],elapsedWallMs:null};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const begin=Date.now();let browser;
try{
 const candidates=[{name:'angle-gl',args:['--use-gl=angle','--use-angle=gl']},
  {name:'swiftshader-fallback',args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']}];
 let page,lastBackendError;
 for(const candidate of candidates){
  try{
   browser=await chromium.launch({channel:'chrome',headless:true,args:candidate.args});
   const probe=await browser.newPage();
   const available=await probe.evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));
   await probe.close();
   if(!available)throw Error('WebGL2 unavailable on '+candidate.name);
   report.renderBackend=candidate.name;
   page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
   break;
  }catch(error){
   lastBackendError=String(error);await browser?.close().catch(()=>{});browser=undefined;
   if(candidate.name==='angle-gl')report.rendererFallback=lastBackendError;
  }
 }
 if(!page)throw Error('No real WebGL2 backend available: '+lastBackendError);
 page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{const receipts={keydowns:0,keyups:0,repeats:0,blurs:0};
  window.__belleInputReceipts=receipts;
  window.addEventListener('keydown',event=>{if(event.code==='KeyW'&&event.isTrusted){receipts.keydowns++;if(event.repeat)receipts.repeats++;}},true);
  window.addEventListener('blur',()=>receipts.blurs++,true);
  window.addEventListener('keyup',event=>{if(event.code==='KeyW'&&event.isTrusted)receipts.keyups++;},true);
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
 page.on('pageerror',err=>report.errors.push(err.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',r=>report.failedRequests.push((r.failure()?.errorText||'failed')+' '+r.url()));
 const navigationStarted=Date.now();
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1'+(mode==='diagnostic'?'&perfProbe=1':''),{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 report.welcomeReadyMs=Date.now()-navigationStarted;
 report.actualGpu=await page.locator('#game').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Game WebGL2 unavailable');
  const ext=gl.getExtension('WEBGL_debug_renderer_info');return {
   vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
   renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),
   version:String(gl.getParameter(gl.VERSION))};
 });
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 report.rideStartedMs=Date.now()-navigationStarted;
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
 await page.locator('#quality').selectOption(device==='phone'?'smooth':'high');
 if(mode==='diagnostic')await expect(page.locator('#performance-probe-warning')).toBeVisible();
 else await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
 const panel=page.locator('#ride-profile');
 await expect(panel).toBeAttached();
 await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Start 10-minute capture'}).click();
 await page.locator('[data-close="settings"]').click();
 await page.locator('#game').focus();
 let cdp=null,initialCounters=null,rideProbeStart=Date.now();
 try{
  cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  initialCounters=(await cdp.send('Performance.getMetrics')).metrics;
 }catch(error){report.probeErrors.push('CDP initial counters: '+String(error));}
 try{await page.evaluate(()=>{window.__belleBrowserClock?.reset?.();window.__belleLongTasks?.reset?.();});}
 catch(error){report.probeErrors.push('Browser probe reset: '+String(error));}
 rideProbeStart=Date.now();
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
  clock:window.__belleBrowserClock?.snapshot?.()??null,
  longTasks:window.__belleLongTasks?.snapshot?.()??null
 }));}catch(error){report.probeErrors.push('Browser scheduler snapshot: '+String(error));}
 try{
  if(cdp&&initialCounters){
   const subsequent=(await cdp.send('Performance.getMetrics')).metrics;
   const before=Object.fromEntries(initialCounters.map(x=>[x.name,x.value]));
   const after=Object.fromEntries(subsequent.map(x=>[x.name,x.value]));
   const durations=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','V8CompileDuration'];
   report.cdpCpuProbe={wallSeconds:(Date.now()-rideProbeStart)/1000,
    durationsSeconds:Object.fromEntries(durations.filter(k=>Number.isFinite(before[k])&&Number.isFinite(after[k]))
     .map(k=>[k,Math.max(0,after[k]-before[k])])),
    endJsHeapUsedBytes:after.JSHeapUsedSize??null,
    caveat:'Chrome DevTools main-thread counters during attempted ride, NOT GPU time or VRAM'};
  }
 }catch(error){report.probeErrors.push('CDP ending counters: '+String(error));}
 try{await cdp?.detach();}catch{/* observer cleanup cannot waive test results */}
 await settings();
 // Local RideProfile finishes on real W-keyup; keyboard input and GPU frames are unmodified.
 await expect(panel.locator('button')).toHaveText('Start 10-minute capture');
 if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
 report.profile=JSON.parse(await panel.locator('textarea').inputValue());
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
}catch(error){report.errors.push(String(error?.stack||error));}
finally{
 report.elapsedWallMs=Date.now()-begin;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close().catch(()=>{});
 await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify({passed:report.passed,mode,device,renderBackend:report.renderBackend,renderer:report.actualGpu?.renderer,classification:report.classification,frames:report.profile?.frames,
 movingSeconds:report.profile?.movingSeconds,distanceMetres:report.profile?.distanceMetres,
 p50:report.profile?.metrics?.frameMs?.p50,p95:report.profile?.metrics?.frameMs?.p95,
 p99:report.profile?.metrics?.frameMs?.p99,errors:report.errors.slice(0,3)}));
if(!report.passed)process.exitCode=1;
