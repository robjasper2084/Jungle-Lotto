/** Paired real-game benchmark: original public bytes and an exact-source candidate.
 * Only normal UI changes game state. Telemetry reads and GPU fences do not seed
 * poses, force frames, reduce scene detail, or certify physical-device FPS.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {cpus,totalmem,platform,release,arch} from 'node:os';

const game=resolve(process.env.CANDIDATE_GAME||'.');
const dist=resolve(process.env.CANDIDATE_DIST||join(game,'dist'));
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const {createCoopStaticServer}=await import(pathToFileURL(join(game,'scripts/coop-static-server.mjs')).href);
const expect=rawExpect.configure({timeout:300000});
const device=process.env.BENCH_DEVICE||'desktop',quality=process.env.BENCH_QUALITY||(device==='phone'?'smooth':'high');
assert.ok(['desktop','phone'].includes(device));assert.ok(['high','smooth'].includes(quality));
const dpr=Number(process.env.BENCH_DPR||(quality==='high'?.7:1));
assert.ok(dpr>0&&dpr<=3,'Invalid BENCH_DPR');
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const order=(process.env.BENCH_ORDER||'baseline,candidate').split(',').map(x=>x.trim());
assert.ok(order.length>=2&&order.includes('baseline')&&order.includes('candidate')&&order.every(x=>['baseline','candidate'].includes(x)));
const minSeconds=Number(process.env.BENCH_MIN_SECONDS||120),minFrames=Number(process.env.BENCH_MIN_FRAMES||30),maxSeconds=Number(process.env.BENCH_MAX_SECONDS||300);
assert.ok(minSeconds>0&&maxSeconds>=minSeconds&&maxSeconds<=1200&&minFrames>=3);
const cacheEnabled=process.env.BENCH_CACHE==='1';
const output=resolve(process.env.BENCH_OUTPUT||'output/paired-performance/'+device+'-'+quality);
const candidateSha=process.env.CANDIDATE_SHA;
assert.match(candidateSha||'',/^[a-f0-9]{40}$/,'CANDIDATE_SHA required');
assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidateSha,'Candidate checkout moved');
const liveUrl=new URL(process.env.LIVE_URL||'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/');
liveUrl.searchParams.set('profile','1');
const liveSha=process.env.LIVE_SHA;
assert.match(liveSha||'',/^[a-f0-9]{40}$/,'LIVE_SHA required');
const manifestUrl=process.env.LIVE_MANIFEST_URL||'https://robjasper2084.github.io/Jungle-Lotto/pages-artifact-manifest.json';
const sites=[
 {id:'macarthur',name:'MacArthur Bridge overlook',button:'Travel to path',expectedPose:'Identical mapped road selection, facing the bridge midpoint; pitch 0.1, yaw offset 0'},
 {id:'blue-heron',name:'Blue Heron Lagoon',button:'Travel to path',expectedPose:{x:3960.2,z:-171.8,lookX:3890,lookZ:-180,pitch:.1,yawOffset:0}},
];
await mkdir(output,{recursive:true});
const report={version:1,createdAt:new Date().toISOString(),candidateSha,liveSha,liveUrl:liveUrl.href,manifestUrl,device,quality,dpr,viewport,order,
 host:{platform:platform(),release:release(),arch:arch(),cpuModel:cpus()[0]?.model||null,logicalCpus:cpus().length,totalMemoryBytes:totalmem()},
 sampling:{minSeconds,minFrames,maxSeconds},cacheEnabled,passed:false,performanceApproved:false,physicalDeviceVerified:false,
 methodology:'Fresh Chromium process per run; same host/browser/viewport/quality/AA policy; real shared Guide stops and FPP; real UI starts/stops the built-in profiler; software renderer explicitly recorded.',
 limitations:[
  'Chromium/SwiftShader results are software-runtime measurements, not physical desktop or iPad FPS.',
  'Frame metrics are real game callback/update intervals; the candidate adds software GPU backpressure and baseline does not. They are not GPU presentation timings.',
  'Controlled High uses deviceScaleFactor 0.7 on both versions so their actual framebuffers match. Default-DPR software behavior differs between versions.',
  'Stationary matched Guide-stop rendering is measured; this is not a continuous traversal or ten-minute endurance ride.',
  'p99 with fewer than 100 frames is approximately the maximum observed sample and is not a robust tail estimate.',
  'JS heap and geometry/texture object counts do not measure GPU VRAM. Linux browser-process PSS, when available, is separately reported with process coverage; it is not dedicated GPU memory.',
  cacheEnabled?'Measured loading uses cold browsers with primed response bodies replayed from Node memory for both versions. It does not represent real internet loading. Priming times remain network-confounded.':'Live assets arrive over the internet; candidate assets arrive from localhost. Loading-time deltas are network-confounded and must not be treated as a controlled build regression.',
  'Resource Timing has a bounded browser buffer; reported entries are observations, not a guaranteed complete transfer inventory.',
 ],priming:[],runs:[],comparisons:[],errors:[]};
const server=createCoopStaticServer(dist);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const candidateUrl='http://127.0.0.1:'+server.address().port+'/?profile=1';
const caches={baseline:new Map(),candidate:new Map()};
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function deadline(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,bad)=>{timer=setTimeout(()=>bad(Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(timer);}}
async function manifestCheck(){
 const response=await fetch(manifestUrl,{cache:'no-store',signal:AbortSignal.timeout(45000)});
 assert.ok(response.ok,'Public manifest HTTP '+response.status);const raw=await response.text(),m=JSON.parse(raw);
 assert.equal(m.commit,liveSha,'Actual public manifest differs from selected live version');
 return {url:manifestUrl,commit:m.commit,sha256:createHash('sha256').update(raw).digest('hex'),observedAt:new Date().toISOString(),commitValidated:true,bundleHashesValidated:false};
}
async function snapshot(page){return page.evaluate(()=>{
 const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info'),m=performance.memory;
 const field=id=>document.getElementById(id);
 return {atMs:performance.now(),focused:document.hasFocus(),visibility:document.visibilityState,crossOriginIsolated,place:field('place')?.textContent,
  viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:canvas?{width:canvas.width,height:canvas.height}:null,
  renderer:gl?{vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),name:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),contextLost:gl.isContextLost(),attributes:gl.getContextAttributes()}:null,
  settings:{quality:field('quality')?.value,cap:field('fps')?.value,aaMode:field('anti-aliasing')?.value,aaStatus:field('aa-status')?.textContent,fpp:field('view')?.getAttribute('aria-pressed'),hour:field('sky-hour')?.value,clouds:field('sky-clouds')?.value,cycle:field('sky-cycle')?.checked,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches},
  profile:{...field('profile')?.dataset},memory:m?{usedJSHeapSize:m.usedJSHeapSize,totalJSHeapSize:m.totalJSHeapSize,jsHeapSizeLimit:m.jsHeapSizeLimit}:null,
  resources:performance.getEntriesByType('resource').map(r=>({name:r.name,durationMs:r.duration,transferBytes:r.transferSize,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize})),
 };
});}
async function gpuFence(page){return deadline(page.evaluate(()=>new Promise((ok,bad)=>{
 const gl=document.querySelector('#game')?.getContext('webgl2');if(!gl||gl.isContextLost())return bad(Error('WebGL unavailable/context lost'));
 const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),start=performance.now();if(!fence)return bad(Error('No GPU fence'));gl.flush();
 const poll=()=>{const state=gl.clientWaitSync(fence,0,0);
  if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED){gl.deleteSync(fence);return requestAnimationFrame(()=>requestAnimationFrame(()=>ok({gpuFence:true,elapsedMs:performance.now()-start,paintOpportunities:2})));}
  if(state===gl.WAIT_FAILED||performance.now()-start>180000){gl.deleteSync(fence);return bad(Error('GPU fence failed or exceeded 180s'));}requestAnimationFrame(poll);
 };poll();
})),200000,'Driver GPU fence');}
async function painted(page){
 const first=Number(await page.locator('#profile').getAttribute('data-active-frames'));
 await expect.poll(async()=>Number(await page.locator('#profile').getAttribute('data-active-frames')),{timeout:300000,intervals:[1000,2500,5000]}).toBeGreaterThan(first+2);
 return {first,after:Number(await page.locator('#profile').getAttribute('data-active-frames')),...await gpuFence(page)};
}
async function menu(page){if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();}
async function settings(page){await menu(page);await page.locator('#settings-open').click();}
async function configure(page){
 await settings(page);if(await page.locator('#sky-cycle').isChecked())await page.locator('#sky-cycle').uncheck();
 await page.locator('#sky-preset').selectOption('12');await page.locator('#sky-clouds').selectOption('clear');
 await page.locator('#quality').selectOption(quality);await page.locator('#fps').selectOption('30');
 await page.locator('[data-close="settings"]').click();
 if(await page.locator('#view').getAttribute('aria-pressed')!=='true')await page.locator('#view').click();
}
async function travel(page,site){
 await menu(page);await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.getByRole('heading',{name:site.name,exact:true})});
 await expect(card).toHaveCount(1);await card.getByRole('button',{name:site.button,exact:true}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 if(await page.locator('#view').getAttribute('aria-pressed')!=='true')await page.locator('#view').click();
 await page.bringToFront();await page.locator('#game').focus();
 const state=await snapshot(page);assert.ok(state.focused&&state.visibility==='visible','Guide arrival lost actual focus');return state;
}
async function profileButton(page,name){
 await settings(page);const panel=page.locator('#ride-profile');
 if(await panel.getAttribute('open')===null)await panel.locator('summary').click();
 await panel.getByRole('button',{name,exact:true}).click();
}
async function memory(cdp,browserCdp){
 const result={available:false,gpuVramBytes:null};
 try{const r=await cdp.send('Performance.getMetrics');result.available=true;result.metrics=Object.fromEntries(r.metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize','Documents','Frames','Nodes','JSEventListeners','TaskDuration','ScriptDuration'].includes(x.name)).map(x=>[x.name,x.value]));}
 catch(error){result.error=String(error);}
 try{
  const info=await browserCdp.send('SystemInfo.getProcessInfo');
  const processes=await Promise.all(info.processInfo.map(async p=>{try{
   const text=await readFile('/proc/'+p.id+'/smaps_rollup','utf8'),get=key=>{const match=text.match(new RegExp('^'+key+':\\s+(\\d+) kB','m'));return match?Number(match[1])*1024:null;};
   return {id:p.id,type:p.type,available:true,pssBytes:get('Pss'),privateCleanBytes:get('Private_Clean'),privateDirtyBytes:get('Private_Dirty')};
  }catch(error){return {id:p.id,type:p.type,available:false,error:String(error)};}}));
  const measured=processes.filter(p=>p.available&&p.pssBytes!==null);
  result.browserProcesses={source:'CDP SystemInfo process IDs plus Linux smaps_rollup',processes,measuredProcesses:measured.length,reportedProcesses:processes.length,complete:measured.length===processes.length,sumMeasuredPssBytes:measured.length?measured.reduce((sum,p)=>sum+p.pssBytes,0):null};
 }catch(error){result.browserProcesses={available:false,error:String(error)};}
 return result;
}
function renderingSignature(s){return JSON.stringify({viewport:s.viewport,canvas:s.canvas,quality:s.profile?.effectiveQuality,pixelRatio:s.profile?.pixelRatio,cap:s.settings?.cap,fpp:s.settings?.fpp,hour:s.settings?.hour,clouds:s.settings?.clouds,cycle:s.settings?.cycle,aa:s.renderer?.attributes?.antialias,renderer:s.renderer?.name});}
async function installCache(context,run,variant){
 if(!cacheEnabled)return;
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();if(request.method()!=='GET'||!/^https?:/.test(url))return route.continue();
  const phase=run.stage,cache=caches[variant],range=request.headers()['range']||'',key=url+'\nRange: '+range,hit=cache.get(key);
  if(hit){run.cache.hits++;return route.fulfill({status:hit.status,headers:hit.headers,body:hit.body});}
  run.cache.misses.push({url,range,phase,at:new Date().toISOString()});
  try{
   const response=await route.fetch({timeout:240000}),body=await response.body(),headers={...response.headers()};
   delete headers['content-encoding'];delete headers['transfer-encoding'];headers['content-length']=String(body.length);
   cache.set(key,{url,range,status:response.status(),headers,body,sha256:createHash('sha256').update(body).digest('hex')});
   await route.fulfill({status:response.status(),headers,body});
  }catch(error){(run.shutdown?run.cleanupErrors:run.errors).push({type:'cache-fetch',url,phase,error:String(error)});await route.abort().catch(()=>{});}
 });
}
async function oneRun(variant,index,prime=false){
 const id=(prime?'prime':'run')+'-'+String(index).padStart(2,'0')+'-'+variant;
 const run={id,variant,prime,sourceSha:variant==='baseline'?liveSha:candidateSha,url:variant==='baseline'?liveUrl.href:candidateUrl,stage:'startup',shutdown:false,cache:{hits:0,misses:[]},errors:[],failedRequests:[],cleanupErrors:[],cleanupAborts:[],sites:[],passed:false};
 const runDir=join(output,id);await mkdir(runDir,{recursive:true});let browser,context,page,cdp,browserCdp;
 try{
  browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info']});
  run.browser=browser.version();context=await browser.newContext({viewport,deviceScaleFactor:dpr,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce',serviceWorkers:'block'});
  await installCache(context,run,variant);page=await context.newPage();page.setDefaultTimeout(300000);page.setDefaultNavigationTimeout(300000);
  page.on('pageerror',e=>(run.shutdown?run.cleanupErrors:run.errors).push({type:'pageerror',phase:run.stage,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')(run.shutdown?run.cleanupErrors:run.errors).push({type:'console',phase:run.stage,message:m.text()});});
  page.on('response',r=>{if(r.status()>=400)(run.shutdown?run.cleanupErrors:run.errors).push({type:'http',phase:run.stage,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>(run.shutdown?run.cleanupAborts:run.failedRequests).push({phase:run.stage,url:r.url(),error:r.failure()?.errorText}));
  cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');browserCdp=await browser.newBrowserCDPSession();
  const navigationStarted=performance.now();await page.goto(run.url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
  run.loading={navigationToReadyButtonMs:performance.now()-navigationStarted,definition:'Driver-observed ready button; not GPU-complete playability.',delivery:prime?'as-served prime; origin/network confounded':cacheEnabled?'cold browser with primed payload replay':'as served; origin/network confounded'};
  const motion=page.locator('#startup-motion');if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
  await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await page.getByRole('button',{name:'Use this ride',exact:true}).click();const beforeStart=performance.now();await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);await page.bringToFront();await page.locator('#game').focus();
  await expect.poll(async()=>Number(await page.locator('#profile').getAttribute('data-active-frames')),{timeout:300000,intervals:[1000,2500,5000]}).toBeGreaterThan(0);
  run.loading.startClickToFirstObservedActiveFrameMs=performance.now()-beforeStart;
  run.loading.firstActiveFence=await gpuFence(page);
  run.loading.startClickToGpuCompleteActiveFrameMs=performance.now()-beforeStart;
  run.loading.navigationToGpuCompleteActiveFrameMs=performance.now()-navigationStarted;
  run.loading.startupTelemetry=await page.evaluate(()=>typeof window.__belleStartupProfile==='function'?window.__belleStartupProfile():null);
  run.loading.startupCacheMisses=run.cache.misses.filter(m=>m.phase==='startup');
  run.loading.controlledDelivery=cacheEnabled&&!prime&&run.loading.startupCacheMisses.length===0;
  run.stage='configure';await configure(page);
  for(const site of sites){
   run.stage=site.id+'-travel';const row={id:site.id,name:site.name,expectedPose:site.expectedPose,passed:false};run.sites.push(row);
   row.arrival=await travel(page,site);run.stage=site.id+'-warmup';row.warmup=await painted(page);row.warmState=await snapshot(page);
   assert.equal(row.warmState.settings.quality,quality);assert.equal(row.warmState.profile.effectiveQuality,quality);assert.equal(row.warmState.settings.fpp,'true');
   assert.equal(row.warmState.settings.cycle,false);assert.equal(row.warmState.settings.clouds,'clear');assert.equal(Number(row.warmState.settings.hour),12);
   const actualRatio=quality==='high'?Math.min(row.warmState.viewport.dpr,.7):1;
   assert.equal(row.warmState.canvas.width,Math.floor(viewport.width*actualRatio));assert.equal(row.warmState.canvas.height,Math.floor(viewport.height*actualRatio));
   if(prime){row.passed=true;continue;}
   run.stage=site.id+'-profile-start';await profileButton(page,'Start 10-minute capture');await page.locator('[data-close="settings"]').click();await page.bringToFront();await page.locator('#game').focus();
   row.memoryBefore=await memory(cdp,browserCdp);row.before=await snapshot(page);const first=Number(row.before.profile.activeFrames),began=performance.now();run.stage=site.id+'-measurement';
   row.targetReached=false;
   while(performance.now()-began<maxSeconds*1000){
    const progress=await page.evaluate(()=>({label:document.querySelector('#ride-profile > summary')?.textContent||'',frames:Number(document.querySelector('#profile')?.dataset.activeFrames||0),focused:document.hasFocus(),visibility:document.visibilityState}));
    assert.ok(progress.focused&&progress.visibility==='visible','Measurement lost actual foreground focus');
    const seconds=Number(progress.label.match(/(\d+) s active/)?.[1]||0);
    if(seconds>=minSeconds&&progress.frames-first>=minFrames){row.targetReached=true;break;}await sleep(1500);
   }
   row.measurementWallMs=performance.now()-began;row.memoryAtEnd=await memory(cdp,browserCdp);row.atEnd=await snapshot(page);
   assert.equal(renderingSignature(row.before),renderingSignature(row.atEnd),'Rendering settings or actual framebuffer changed during the measurement');
   row.renderingStable=true;row.measurementCacheMisses=run.cache.misses.filter(m=>m.phase===site.id+'-measurement');
   run.stage=site.id+'-profile-stop';await profileButton(page,'Stop and show report');
   row.rideProfile=JSON.parse(await page.locator('#ride-profile textarea').inputValue());
   assert.ok(row.rideProfile.frames>2&&row.rideProfile.activeSeconds>0,'No genuine measurement frames');
   assert.equal(row.rideProfile.hiddenSeconds,0,'Hidden frames during capture');assert.equal(row.rideProfile.visibilityInterruptions,0,'Visibility interrupted capture');
   row.distributionQuality={frames:row.rideProfile.frames,activeSeconds:row.rideProfile.activeSeconds,minSecondsReached:row.rideProfile.activeSeconds>=minSeconds,minFramesReached:row.rideProfile.frames>=minFrames,atLeast100Frames:row.rideProfile.frames>=100,p99Caution:row.rideProfile.frames<100};
   await page.locator('[data-close="settings"]').click();await page.bringToFront();await page.locator('#game').focus();
   run.stage=site.id+'-capture';row.captureProof=await painted(page);row.captureState=await snapshot(page);
   row.screenshot=site.id+'.png';await page.screenshot({path:join(runDir,row.screenshot),timeout:300000});
   await writeFile(join(runDir,site.id+'-ride-profile.json'),JSON.stringify(row.rideProfile,null,2)+'\n');
   row.measurementComplete=row.targetReached&&row.distributionQuality.minSecondsReached&&row.distributionQuality.minFramesReached;
   row.passed=row.measurementComplete;
   if(!row.measurementComplete)row.incompleteReason='Bounded measurement ended before its eligible-time and frame-count targets; retained as partial evidence.';
   await writeFile(join(runDir,'report.json'),JSON.stringify(run,null,2)+'\n');
  }
  run.passed=run.sites.length===sites.length&&run.sites.every(x=>x.passed)&&!run.errors.length&&!run.failedRequests.length;
 }catch(error){run.errors.push({type:'run',phase:run.stage,error:error.stack||String(error)});}
 finally{run.shutdown=true;run.stage='cleanup';if(browser)await browser.close().catch(e=>run.cleanupErrors.push({type:'close',error:String(e)}));run.finishedAt=new Date().toISOString();await writeFile(join(runDir,'report.json'),JSON.stringify(run,null,2)+'\n');}
 console.log(JSON.stringify({id,passed:run.passed,frames:run.sites.map(s=>({site:s.id,frames:s.rideProfile?.frames,seconds:s.rideProfile?.activeSeconds})),errors:run.errors.length,failedRequests:run.failedRequests.length,cacheMisses:run.cache.misses.length}));return run;
}
const delta=(base,candidate)=>typeof base==='number'&&typeof candidate==='number'?{baseline:base,candidate,absolute:candidate-base,percent:base===0?null:100*(candidate-base)/base}:null;
function pairComparison(base,candidate){
 const pair={baselineRun:base.id,candidateRun:candidate.id,comparable:true,sites:[],loading:{controlled:!!base.loading?.controlledDelivery&&!!candidate.loading?.controlledDelivery}};
 for(const key of ['navigationToReadyButtonMs','startClickToFirstObservedActiveFrameMs','startClickToGpuCompleteActiveFrameMs','navigationToGpuCompleteActiveFrameMs'])pair.loading[key]=delta(base.loading?.[key],candidate.loading?.[key]);
 for(const site of sites){const b=base.sites.find(s=>s.id===site.id),c=candidate.sites.find(s=>s.id===site.id),bp=b?.rideProfile,cp=c?.rideProfile;
  const comparable=!!bp&&!!cp&&b.measurementComplete&&c.measurementComplete&&b.renderingStable&&c.renderingStable&&renderingSignature(b.warmState)===renderingSignature(c.warmState);pair.comparable&&=comparable;
  const row={site:site.id,comparable,sameGuide:site.name,distributionReliable:!!bp&&!!cp&&bp.frames>=100&&cp.frames>=100,metrics:{},observedGameFPS:delta(bp?.observedFPS,cp?.observedFPS),frames:{baseline:bp?.frames,candidate:cp?.frames},activeSeconds:{baseline:bp?.activeSeconds,candidate:cp?.activeSeconds},memory:{},stalls:{}};
  for(const metric of ['frameMs','simulationCpuMs','presentationCpuMs','worldAndActivityCpuMs','renderSubmitCpuMs','hudCpuMs','drawCalls','triangles','textures','geometries']){
   row.metrics[metric]={};for(const statistic of ['mean','p50','p95','p99','max'])row.metrics[metric][statistic]=delta(bp?.metrics?.[metric]?.[statistic],cp?.metrics?.[metric]?.[statistic]);
  }
  for(const metric of ['over50ms','over100ms','over250ms','over2s'])row.stalls[metric]={counts:delta(bp?.[metric],cp?.[metric]),perEligibleSecond:delta(bp?bp[metric]/bp.activeSeconds:null,cp?cp[metric]/cp.activeSeconds:null)};
  for(const metric of ['JSHeapUsedSize','JSHeapTotalSize','Documents','Nodes','JSEventListeners'])row.memory[metric]=delta(b?.memoryAtEnd?.metrics?.[metric],c?.memoryAtEnd?.metrics?.[metric]);
  row.memory.browserPssBytes=delta(b?.memoryAtEnd?.browserProcesses?.sumMeasuredPssBytes,c?.memoryAtEnd?.browserProcesses?.sumMeasuredPssBytes);
  row.memory.pssCoverage={baselineComplete:b?.memoryAtEnd?.browserProcesses?.complete,candidateComplete:c?.memoryAtEnd?.browserProcesses?.complete};
  pair.sites.push(row);
 }return pair;
}
try{
 report.publicBefore=await manifestCheck();
 if(cacheEnabled)for(const variant of ['baseline','candidate'])report.priming.push(await oneRun(variant,report.priming.length+1,true));
 if(report.priming.some(r=>!r.passed))throw Error('Asset priming failed; measured comparison not started');
 for(let i=0;i<order.length;i++){report.runs.push(await oneRun(order[i],i+1));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
 const bases=report.runs.filter(r=>r.variant==='baseline'),candidates=report.runs.filter(r=>r.variant==='candidate');
 for(let i=0;i<Math.min(bases.length,candidates.length);i++)report.comparisons.push(pairComparison(bases[i],candidates[i]));
 report.publicAfter=await manifestCheck();report.passed=report.runs.length===order.length&&report.runs.every(r=>r.passed)&&report.comparisons.length>0&&report.comparisons.every(p=>p.comparable);
}catch(error){report.errors.push(error.stack||String(error));}
finally{
 report.finishedAt=new Date().toISOString();report.cacheInventory=Object.fromEntries(Object.entries(caches).map(([variant,cache])=>[variant,{entries:cache.size,bytes:[...cache.values()].reduce((a,e)=>a+e.body.length,0),files:[...cache.values()].map(e=>({url:e.url,range:e.range,status:e.status,bytes:e.body.length,sha256:e.sha256}))}]));
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(ok=>{server.close(ok);server.closeAllConnections?.();});
}
console.log(JSON.stringify({passed:report.passed,performanceApproved:false,output,runs:report.runs.map(r=>({id:r.id,passed:r.passed})),errors:report.errors}));
if(!report.passed)process.exitCode=1;
