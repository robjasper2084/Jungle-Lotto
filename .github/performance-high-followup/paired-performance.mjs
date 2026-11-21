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
assert.equal(device,'desktop','High Loop follow-up requires desktop layout');assert.equal(quality,'high');assert.equal(dpr,.7);
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const order=(process.env.BENCH_ORDER||'baseline,candidate,candidate,baseline').split(',').map(x=>x.trim());
assert.deepEqual(order,['baseline','candidate','candidate','baseline'],'Preserve counterbalanced ABBA order');
const minSeconds=Number(process.env.BENCH_MIN_SECONDS||120),minFrames=Number(process.env.BENCH_MIN_FRAMES||30),maxSeconds=Number(process.env.BENCH_MAX_SECONDS||900);
assert.ok(minSeconds>=120&&maxSeconds>=minSeconds&&maxSeconds>=900&&maxSeconds<=1200&&minFrames>=30);
const cacheEnabled=process.env.BENCH_CACHE==='1';
assert.ok(cacheEnabled,'Preserve primed response replay for both variants');
const output=resolve(process.env.BENCH_OUTPUT||'output/paired-performance-high-followup/'+device+'-'+quality);
const candidateSha=process.env.CANDIDATE_SHA;
assert.match(candidateSha||'',/^[a-f0-9]{40}$/,'CANDIDATE_SHA required');
assert.ok(['a595ed97ec2ea970aedeb24695c1252c8abb3a0d','68943261e040a880eadb0e156d55638ccd91c86d'].includes(candidateSha),'Follow-up must use one unchanged release candidate');
assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidateSha,'Candidate checkout moved');
const liveUrl=new URL(process.env.LIVE_URL||'https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/');
liveUrl.searchParams.set('profile','1');
const liveSha=process.env.LIVE_SHA;
assert.match(liveSha||'',/^[a-f0-9]{40}$/,'LIVE_SHA required');
const manifestUrl=process.env.LIVE_MANIFEST_URL||'https://robjasper2084.github.io/Jungle-Lotto/pages-artifact-manifest.json';
const sites=[{id:'submerged-stones',name:'Loop Canal',button:'Travel to path',expectedPose:{x:411.71,z:960.79,y:2,headingY:.5055174780416892,lookX:421.23,lookZ:977.99,pitch:.1,yawOffset:0,source:'Existing shared Guide nearest-path selection; metadata only, never injected'}}];
await mkdir(output,{recursive:true});
const report={version:1,protocolRevision:2,studyId:'high-loop-common-layered-followup-v2',observerBoundaryPolicy:'A real Pause, two consecutive equal paused HUD counter writes and GPU fence precede Start; every observed post-Pause write, including initial settling changes, is retained. Start occurs paused, then real Resume. Memory and WebGL/ResourceTiming snapshots occur before Start and after real Pause plus Stop; active capture contains only bounded profiler, focus and visibility polling plus necessary Pause input checks.',createdAt:new Date().toISOString(),candidateSha,liveSha,liveUrl:liveUrl.href,manifestUrl,device,quality,dpr,viewport,order,skyRenderer:'layered',skyRendererScope:'Shared prepareReferencePreferences initialization seeds Layered in both fresh contexts. The existing UI explicitly selects Layered again for Guide views and steady-state captures after startup loading observations.',
 host:{platform:platform(),release:release(),arch:arch(),cpuModel:cpus()[0]?.model||null,logicalCpus:cpus().length,totalMemoryBytes:totalmem()},
 sampling:{minSeconds,minFrames,maxSeconds},cacheEnabled,passed:false,performanceApproved:false,physicalDeviceVerified:false,
 methodology:'High Loop Canal follow-up with the existing Layered sky option explicitly selected in both versions, a longer sample bound and guarded trusted pointer navigation. Fresh Chromium process per run; same host/browser/viewport/requested quality/AA policy; real shared Guide and FPP; real UI starts, pauses, and stops the built-in profiler. Source shadow policies still differ, so shadow quality is not equalized.',
 sourceDerivedSkyPolicy:{scope:'Pinned-source initialization behavior, not a separately sampled startup UI state.',sharedSeed:'main.ts calls prepareReferencePreferences before startup; sunsetReferencePolicy.ts seeds belle-sky-renderer=layered when storage has no saved preference in both versions. Isolated islandSky fallback defaults do not describe these normal fresh contexts.',sources:[liveSha,candidateSha].flatMap(sha=>['main.ts','sunsetReferencePolicy.ts'].map(p=>'https://github.com/robjasper2084/Jungle-Lotto/blob/'+sha+'/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/'+p))},
 sourceDerivedShadowPolicies:{scope:'Derived from the pinned source policies; these are not runtime shadow-map measurements.',unequalShadowQualityRemains:true,
  baseline:{sourceSha:liveSha,highDirectionalShadowMapSize:{width:1536,height:1536},refreshPolicy:'Renderer default automatic shadow updates; no candidate cadence override',sources:['islandSky.ts','worldPerformancePolicy.ts','world.ts'].map(p=>'https://github.com/robjasper2084/Jungle-Lotto/blob/'+liveSha+'/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/'+p)},
  candidate:{sourceSha:candidateSha,softwareHighDirectionalShadowMapSize:{width:768,height:768},shadowMapAutoUpdate:false,refreshPolicy:'ShadowMapCadence interval 0.1 simulation seconds, with reset/needsUpdate paths; not a measured 10 Hz wall-clock rate',sources:['islandSky.ts','worldPerformancePolicy.ts','world.ts'].map(p=>'https://github.com/robjasper2084/Jungle-Lotto/blob/'+candidateSha+'/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/'+p)}},
 navigationPolicy:'Unique visible enabled controls; freshly read in-viewport unobstructed centers; trusted browser mouse input; asserted UI outcomes; action durations retained. Ordinary mouse-wheel input scrolls dialog controls into view; normal Playwright select/fill APIs retain the existing UI settings and Guide search. Pointer actions never use DOM click or driver-injected events.',
 instrumentation:{memoryBefore:'Normally paused, after a real paused callback and GPU fence, before the profiler starts',memoryAfter:'After the real Pause action and profiler stop, with Settings open',activeWindow:'Only bounded reads of the profiler label, active-frame count, focus and visibility plus necessary Pause input checks; no PSS or WebGL snapshot before pausing',preCaptureObserver:'Temporary MutationObserver of the existing HUD active-frame attribute; disconnected before Start',addedRafObserver:false,tracing:false},
 limitations:[
  'Chromium/SwiftShader results are software-runtime measurements, not physical desktop or iPad FPS.',
  'Both builds use the same existing GPU frame gate via SceneWarmup; the candidate early call is idempotent. Frame metrics are eligible real game callback intervals, not GPU execution or physical presentation timings.',
  'Controlled High uses deviceScaleFactor 0.7 on both versions so their actual framebuffers match. Default-DPR software behavior differs between versions.',
  'Both runs select Layered sky through the existing UI. High mapped-shadow quality remains unequal: live source selects 1536 px and automatic refresh; candidate software source selects 768 px and cadenced refresh. This follow-up does not establish equal visual quality or clear the separately observed black-tree issue.',
  'Stationary matched Guide-stop rendering is measured; this is not a continuous traversal or ten-minute endurance ride.',
  'p99 with 100 or fewer frames is approximately the maximum observed sample and is not a robust tail estimate.',
  'The baseline is the actual Pages deployment; the candidate is built from its pinned source before full Pages asset packaging. Published PNG palette optimization can differ from the raw game build, so response replay does not establish pixel-identical texture payloads.',
  'Loading is recorded before High is selected and therefore reflects default Automatic startup. Desktop DPR 0.7 is below both software Automatic caps, but no startup framebuffer/adaptive-scale history establishes equal graphics work; controlled delivery normalizes asset delivery only. The guarded navigation protocol changes harness startup latency and must remain separate from earlier studies.',
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
  settings:{quality:field('quality')?.value,cap:field('fps')?.value,aaMode:field('anti-aliasing')?.value,aaStatus:field('aa-status')?.textContent,fpp:field('view')?.getAttribute('aria-pressed'),hour:field('sky-hour')?.value,clouds:field('sky-clouds')?.value,skyRenderer:field('sky-renderer')?.value,cycle:field('sky-cycle')?.checked,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches},
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
async function pausedCallbackProof(page,row){
 const proof=await deadline(page.evaluate(()=>new Promise(ok=>{
  const hud=document.querySelector('#profile'),pause=document.querySelector('#pause'),started=performance.now(),observations=[];
  const initialActiveFrames=Number(hud?.dataset.activeFrames);let timer,observer,previousCounter=initialActiveFrames,previousWrite=null,stableWrites=0;
  const state=()=>({pauseText:pause?.textContent?.trim(),focused:document.hasFocus(),visibility:document.visibilityState});
  const finish=(passed,error)=>{
   observer?.disconnect();clearTimeout(timer);
   ok({source:'Existing #profile data-active-frames attribute writes after real Pause',passed,error,initialActiveFrames,settledActiveFrames:previousCounter,requiredStableWrites:2,stableWrites,observations,observedAttributeMutation:observations.length>0,observerDisconnected:true,elapsedMs:performance.now()-started});
  };
  const initialState=state();
  if(!hud||!Number.isInteger(initialActiveFrames)||initialActiveFrames<0||initialState.pauseText!=='Resume'||!initialState.focused||initialState.visibility!=='visible')return finish(false,'Real Pause, a valid counter and foreground visibility must precede observation');
  observer=new MutationObserver(records=>{
   const writes=records.filter(r=>r.attributeName==='data-active-frames');
   for(let i=0;i<writes.length;i++){
    // oldValue on the following mutation preserves intermediate values in a batch.
    const counter=Number(i+1<writes.length?writes[i+1].oldValue:hud.dataset.activeFrames),currentState=state();
    observations.push({write:observations.length+1,elapsedMs:performance.now()-started,activeFrames:counter,previousObservedCounter:previousCounter,unchangedFromPreviousWrite:previousWrite!==null&&counter===previousWrite,...currentState});
    if(currentState.pauseText!=='Resume'||!currentState.focused||currentState.visibility!=='visible')return finish(false,'Paused callback lost Pause state or foreground visibility');
    if(!Number.isInteger(counter)||counter<previousCounter)return finish(false,'Paused HUD counter was invalid or non-monotonic');
    stableWrites=counter===previousWrite?stableWrites+1:1;previousWrite=counter;previousCounter=counter;
   }
   if(stableWrites>=2)return finish(true);
  });
  observer.observe(hud,{attributes:true,attributeOldValue:true,attributeFilter:['data-active-frames']});
  timer=setTimeout(()=>finish(false,'No pair of consecutive equal paused HUD writes within 180s'),180000);
 })),200000,'Paused callback proof');
 row.preCapturePauseProof=proof;assert.ok(proof.passed,'Paused callback proof failed: '+JSON.stringify(proof));
 proof.fence=await gpuFence(page);
 proof.postFence=await page.evaluate(()=>({activeFrames:Number(document.querySelector('#profile')?.dataset.activeFrames),pauseText:document.querySelector('#pause')?.textContent?.trim(),focused:document.hasFocus(),visibility:document.visibilityState}));
 assert.equal(proof.postFence.activeFrames,proof.settledActiveFrames,'Active counter changed after the stable paused writes and GPU fence');
 assert.ok(proof.postFence.pauseText==='Resume'&&proof.postFence.focused&&proof.postFence.visibility==='visible','Pause or foreground state changed before profiler Start');
 proof.confirmedBeforeProfilerStart=true;return proof;
}
const pageRuns=new WeakMap();
async function controlGeometry(locator){return locator.evaluate(el=>{
 const rect=el.getBoundingClientRect(),style=getComputedStyle(el),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 let clip={left:0,top:0,right:innerWidth,bottom:innerHeight},scroll=null;
 for(let p=el.parentElement;p;p=p.parentElement){
  const s=getComputedStyle(p),r=p.getBoundingClientRect();
  if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
  if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
  if(!scroll&&/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1)scroll=p;
 }
 const centerInside=x>clip.left&&x<clip.right&&y>clip.top&&y<clip.bottom,hit=centerInside?document.elementFromPoint(x,y):null;
 let wheel=null;if(scroll){
  const r=scroll.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
  const wx=(left+right)/2,wy=(top+bottom)/2,h=document.elementFromPoint(wx,wy);
  if(right>left&&bottom>top&&h&&(h===scroll||scroll.contains(h)))wheel={x:wx,y:wy,deltaY:Math.max(-650,Math.min(650,y-(clip.top+clip.bottom)/2)),scrollTop:scroll.scrollTop};
 }
 return {x,y,box:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},clip,centerInside,receives:!!hit&&(hit===el||el.contains(hit)),
  visible:rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0,
  enabled:!el.matches(':disabled')&&!el.closest('[aria-disabled="true"],[inert]'),hit:hit?{tag:hit.tagName,id:hit.id}:null,wheel};
});}
async function clickControl(page,locator,label,assertAfter){
 assert.equal(typeof assertAfter,'function','Every trusted click requires an asserted UI outcome');
 const run=pageRuns.get(page),record={kind:'trusted-mouse-click',label,phase:run?.stage,startedAt:new Date().toISOString(),scrolls:[]},began=performance.now();run?.navigationActions.push(record);
 console.log(JSON.stringify({event:'ui-action-start',at:record.startedAt,run:run?.id,phase:run?.stage,label}));
 try{
  await expect(locator).toHaveCount(1);await expect(locator).toBeVisible();await expect(locator).toBeEnabled();
  let point=null;while(performance.now()-began<300000){
   const g=await controlGeometry(locator);record.lastObserved=g;
   if(!g.visible||!g.enabled||(g.centerInside&&!g.receives)){await sleep(150);continue;}
   if(g.centerInside&&g.receives){point=g;break;}
   assert.ok(!g.centerInside&&g.wheel&&Math.abs(g.wheel.deltaY)>1,label+' center is obstructed or cannot be safely scrolled');
   record.scrolls.push(g.wheel);assert.ok(record.scrolls.length<=30,'Too many navigation scroll attempts');
   await page.mouse.move(g.wheel.x,g.wheel.y);await page.mouse.wheel(0,g.wheel.deltaY);await sleep(150);
  }
  assert.ok(point,label+' did not reach an unobstructed viewport center');
  const fresh=await controlGeometry(locator);assert.ok(fresh.visible&&fresh.enabled&&fresh.centerInside&&fresh.receives,label+' changed before input');
  record.point={x:fresh.x,y:fresh.y,box:fresh.box,hit:fresh.hit};await page.mouse.click(fresh.x,fresh.y);await assertAfter();record.outcomeAsserted=true;
 }catch(error){record.error=String(error);throw error;}
 finally{record.elapsedMs=performance.now()-began;record.finishedAt=new Date().toISOString();console.log(JSON.stringify({event:'ui-action-end',at:record.finishedAt,run:run?.id,phase:record.phase,label,elapsedMs:record.elapsedMs,passed:record.outcomeAsserted===true,error:record.error}));}
}
async function selectControl(page,selector,value){
 const run=pageRuns.get(page),record={kind:'normal-select-option',label:selector+' = '+value,phase:run?.stage},began=performance.now();run?.navigationActions.push(record);
 try{const locator=page.locator(selector);await expect(locator).toBeVisible();await expect(locator).toBeEnabled();await locator.selectOption(value);await expect(locator).toHaveValue(value);record.outcomeAsserted=true;}
 catch(error){record.error=String(error);throw error;}finally{record.elapsedMs=performance.now()-began;}
}
async function menu(page){if(!await page.locator('#ride-menu').isVisible())await clickControl(page,page.locator('#tools-toggle'),'Open ride menu',()=>expect(page.locator('#ride-menu')).toBeVisible());}
async function settings(page){await menu(page);await clickControl(page,page.locator('#settings-open'),'Open Settings',()=>expect(page.locator('#settings')).toBeVisible());}
async function closeSettings(page){await clickControl(page,page.locator('[data-close="settings"]'),'Close Settings',()=>expect(page.locator('#settings')).not.toBeVisible());}
async function configure(page){
 await settings(page);if(await page.locator('#sky-cycle').isChecked())await clickControl(page,page.locator('#sky-cycle'),'Disable day cycle',()=>expect(page.locator('#sky-cycle')).not.toBeChecked());
 await selectControl(page,'#sky-preset','12');await selectControl(page,'#sky-clouds','clear');
 await selectControl(page,'#quality',quality);await selectControl(page,'#fps','30');await selectControl(page,'#sky-renderer','layered');await closeSettings(page);
 if(await page.locator('#view').getAttribute('aria-pressed')!=='true')await clickControl(page,page.locator('#view'),'Select FPP',()=>expect(page.locator('#view')).toHaveAttribute('aria-pressed','true'));
}
async function travel(page,site){
 await menu(page);await clickControl(page,page.locator('#map-open'),'Open Guide',()=>expect(page.locator('#guide')).toBeVisible());
 const run=pageRuns.get(page),record={kind:'normal-input-fill',label:'Find '+site.name,phase:run?.stage},began=performance.now();run?.navigationActions.push(record);
 try{const search=page.locator('#guide-search');await expect(search).toBeVisible();await expect(search).toBeEnabled();await search.fill(site.name);await expect(search).toHaveValue(site.name);record.outcomeAsserted=true;}
 catch(error){record.error=String(error);throw error;}finally{record.elapsedMs=performance.now()-began;}
 const card=page.locator('#landmarks .landmark').filter({has:page.getByRole('heading',{name:site.name,exact:true})});
 await expect(card).toHaveCount(1);await clickControl(page,card.getByRole('button',{name:site.button,exact:true}),'Travel to '+site.name,()=>expect(page.locator('#guide')).not.toBeVisible());
 if(await page.locator('#view').getAttribute('aria-pressed')!=='true')await clickControl(page,page.locator('#view'),'Select FPP',()=>expect(page.locator('#view')).toHaveAttribute('aria-pressed','true'));
 await page.bringToFront();await page.locator('#game').focus();
 const state=await snapshot(page);assert.ok(state.focused&&state.visibility==='visible','Guide arrival lost actual focus');return state;
}
async function profileButton(page,name){
 await settings(page);const panel=page.locator('#ride-profile');
 if(await panel.getAttribute('open')===null)await clickControl(page,panel.locator('summary'),'Open profiler panel',()=>expect(panel).toHaveAttribute('open',/.*/));
 await clickControl(page,panel.getByRole('button',{name,exact:true}),name,async()=>{
  // Shared RideProfile.start() changes the button text and intentionally closes details.
  if(name.startsWith('Start'))await Promise.all([
   expect(panel).not.toHaveAttribute('open',/.*/,{timeout:60000}),
   expect(panel.locator('button')).toHaveCount(1,{timeout:60000}),
   expect(panel.locator('button')).toHaveText('Stop and show report',{timeout:60000}),
  ]);
  else await Promise.all([
   expect(panel).toHaveAttribute('open',/.*/,{timeout:60000}),
   expect(panel.locator('textarea')).toBeVisible({timeout:60000}),
  ]);
 });
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
function renderingSignature(s){return JSON.stringify({viewport:s.viewport,canvas:s.canvas,quality:s.profile?.effectiveQuality,pixelRatio:s.profile?.pixelRatio,cap:s.settings?.cap,fpp:s.settings?.fpp,hour:s.settings?.hour,clouds:s.settings?.clouds,skyRenderer:s.settings?.skyRenderer,cycle:s.settings?.cycle,aa:s.renderer?.attributes?.antialias,renderer:s.renderer?.name});}
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
 const run={id,variant,prime,sourceSha:variant==='baseline'?liveSha:candidateSha,url:variant==='baseline'?liveUrl.href:candidateUrl,stage:'startup',shutdown:false,cache:{hits:0,misses:[]},navigationActions:[],errors:[],failedRequests:[],cleanupErrors:[],cleanupAborts:[],sites:[],passed:false};
 const runDir=join(output,id);await mkdir(runDir,{recursive:true});let browser,context,page,cdp,browserCdp;
 try{
  browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info']});
  run.browser=browser.version();context=await browser.newContext({viewport,deviceScaleFactor:dpr,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce',serviceWorkers:'block'});
  await installCache(context,run,variant);page=await context.newPage();pageRuns.set(page,run);page.setDefaultTimeout(300000);page.setDefaultNavigationTimeout(300000);
  page.on('pageerror',e=>(run.shutdown?run.cleanupErrors:run.errors).push({type:'pageerror',phase:run.stage,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')(run.shutdown?run.cleanupErrors:run.errors).push({type:'console',phase:run.stage,message:m.text()});});
  page.on('response',r=>{if(r.status()>=400)(run.shutdown?run.cleanupErrors:run.errors).push({type:'http',phase:run.stage,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>(run.shutdown?run.cleanupAborts:run.failedRequests).push({phase:run.stage,url:r.url(),error:r.failure()?.errorText}));
  cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');browserCdp=await browser.newBrowserCDPSession();
  const navigationStarted=performance.now();await page.goto(run.url,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
  run.loading={navigationToReadyButtonMs:performance.now()-navigationStarted,definition:'Driver-observed ready button; not GPU-complete playability.',delivery:prime?'as-served prime; origin/network confounded':cacheEnabled?'cold browser with primed payload replay':'as served; origin/network confounded'};
  const motion=page.locator('#startup-motion');if(await motion.getAttribute('aria-pressed')!=='true')await clickControl(page,motion,'Pause startup flyover',()=>expect(motion).toHaveAttribute('aria-pressed','true'));
  const picker=page.locator('.cinema-ride-picker');await clickControl(page,picker.locator('summary'),'Open ride picker',()=>expect(picker).toHaveAttribute('open',/.*/));
  await clickControl(page,page.locator('.ride-options label').filter({hasText:'One wheel'}),'Choose one wheel',()=>expect(page.locator('input[name="startup-vehicle"][value="onewheel"]')).toBeChecked());
  await clickControl(page,page.getByRole('button',{name:'Use this ride',exact:true}),'Use chosen ride',()=>expect(picker).not.toHaveAttribute('open',/.*/));
  const beforeStart=performance.now();await clickControl(page,page.locator('#start'),'Start riding',()=>expect(page.locator('body')).not.toHaveClass(/at-start/));
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
   assert.equal(row.warmState.settings.cycle,false);assert.equal(row.warmState.settings.clouds,'clear');assert.equal(Number(row.warmState.settings.hour),12);assert.equal(row.warmState.settings.skyRenderer,'layered');
   const actualRatio=quality==='high'?Math.min(row.warmState.viewport.dpr,.7):1;
   assert.equal(row.warmState.canvas.width,Math.floor(viewport.width*actualRatio));assert.equal(row.warmState.canvas.height,Math.floor(viewport.height*actualRatio));
   if(prime){row.passed=true;continue;}
   run.stage=site.id+'-pause-before-profile';await expect(page.locator('#pause')).toHaveText('Pause');
   await clickControl(page,page.locator('#pause'),'Pause before capture setup',()=>expect(page.locator('#pause')).toHaveText('Resume'));
   run.stage=site.id+'-paused-callback-proof';await pausedCallbackProof(page,row);console.log(JSON.stringify({event:'paused-start-proof',at:new Date().toISOString(),run:run.id,site:site.id,proof:row.preCapturePauseProof}));
   run.stage=site.id+'-before-capture-observation';row.memoryBefore=await memory(cdp,browserCdp);row.before=await snapshot(page);await expect(page.locator('#pause')).toHaveText('Resume');
   await writeFile(join(runDir,'report.json'),JSON.stringify(run,null,2)+'\n');
   run.stage=site.id+'-profile-start';await profileButton(page,'Start 10-minute capture');await expect(page.locator('#pause')).toHaveText('Resume');await closeSettings(page);await expect(page.locator('#pause')).toHaveText('Resume');
   const first=Number(await page.locator('#profile').getAttribute('data-active-frames'));
   await clickControl(page,page.locator('#pause'),'Resume new capture',()=>expect(page.locator('#pause')).toHaveText('Pause'));
   row.startResumeProof={control:'#pause',observedText:await page.locator('#pause').textContent(),profilerStartedWhilePaused:true};
   await page.bringToFront();await page.locator('#game').focus();const began=performance.now();run.stage=site.id+'-measurement';
   row.targetReached=false;
   while(performance.now()-began<maxSeconds*1000){
    const progress=await page.evaluate(()=>({label:document.querySelector('#ride-profile > summary')?.textContent||'',frames:Number(document.querySelector('#profile')?.dataset.activeFrames||0),focused:document.hasFocus(),visibility:document.visibilityState}));
    assert.ok(progress.focused&&progress.visibility==='visible','Measurement lost actual foreground focus');
    const seconds=Number(progress.label.match(/(\d+) s active/)?.[1]||0);
    if(seconds>=minSeconds&&progress.frames-first>=minFrames){row.targetReached=true;break;}await sleep(1500);
   }
   row.measurementWallMs=performance.now()-began;run.stage=site.id+'-pause-at-window-end';
   await clickControl(page,page.locator('#pause'),'Pause at sample boundary',()=>expect(page.locator('#pause')).toHaveText('Resume'));
   row.pauseProof={control:'#pause',observedText:await page.locator('#pause').textContent(),pausedBeforeBoundaryObservations:true};
   run.stage=site.id+'-profile-stop';await profileButton(page,'Stop and show report');
   row.rideProfile=JSON.parse(await page.locator('#ride-profile textarea').inputValue());
   row.stoneCoverage={selected:row.rideProfile.settings?.world?.water?.shallow?.visibleStones??null,guide:site.name,
    scope:'Actual shallow-water world selection count; it does not assert on-screen stone pixel visibility or frustum coverage.',
    expectedAim:{lookX:421.23,lookZ:977.99,pitch:.1,yawOffset:0},candidateRequiresNonzero:variant==='candidate',baselineMetricMayBeUnavailable:variant==='baseline'};
   if(variant==='candidate')assert.ok(Number.isFinite(row.stoneCoverage.selected)&&row.stoneCoverage.selected>0,'Candidate Loop Canal view selected no shallow-water stones');
   run.stage=site.id+'-after-capture-observation';row.memoryAtEnd=await memory(cdp,browserCdp);row.atEnd=await snapshot(page);
   row.memoryTiming={before:'Normally paused after a genuine paused callback, profiler inactive',atEnd:'Paused, profiler stopped, Settings report visible'};
   assert.equal(renderingSignature(row.before),renderingSignature(row.atEnd),'Rendering settings or actual framebuffer changed during the measurement');
   row.renderingStable=true;row.measurementCacheMisses=run.cache.misses.filter(m=>m.phase===site.id+'-measurement');
   assert.ok(row.rideProfile.frames>2&&row.rideProfile.activeSeconds>0,'No genuine measurement frames');
   assert.equal(row.rideProfile.hiddenSeconds,0,'Hidden frames during capture');assert.equal(row.rideProfile.visibilityInterruptions,0,'Visibility interrupted capture');
   row.distributionQuality={frames:row.rideProfile.frames,activeSeconds:row.rideProfile.activeSeconds,minSecondsReached:row.rideProfile.activeSeconds>=minSeconds,minFramesReached:row.rideProfile.frames>=minFrames,atLeast100Frames:row.rideProfile.frames>=100,p99Caution:row.rideProfile.frames<=100};
   await closeSettings(page);await clickControl(page,page.locator('#pause'),'Resume after stopped profile',()=>expect(page.locator('#pause')).toHaveText('Pause'));
   row.resumeProof={control:'#pause',observedText:await page.locator('#pause').textContent()};await page.bringToFront();await page.locator('#game').focus();
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
  const row={site:site.id,comparable,sameGuide:site.name,distributionReliable:!!bp&&!!cp&&bp.frames>100&&cp.frames>100,metrics:{},observedGameFPS:delta(bp?.observedFPS,cp?.observedFPS),frames:{baseline:bp?.frames,candidate:cp?.frames},activeSeconds:{baseline:bp?.activeSeconds,candidate:cp?.activeSeconds},memory:{},stalls:{}};
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
 for(let i=0;i<order.length;i++){
  const run=await oneRun(order[i],i+1);report.runs.push(run);await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if((run.errors.length||run.failedRequests.length)&&!run.sites.some(s=>s.rideProfile)){
   report.stoppedEarly={run:run.id,reason:'Run error before any ride profile was captured; remaining ABBA runs were not attempted.',noPerformanceProfileCaptured:true};
   throw Error('Measurement setup failed in '+run.id+' before a ride profile was captured');
  }
 }
 const bases=report.runs.filter(r=>r.variant==='baseline'),candidates=report.runs.filter(r=>r.variant==='candidate');
 for(let i=0;i<Math.min(bases.length,candidates.length);i++)report.comparisons.push(pairComparison(bases[i],candidates[i]));
 report.passed=report.runs.length===order.length&&report.runs.every(r=>r.passed)&&report.comparisons.length>0&&report.comparisons.every(p=>p.comparable);
}catch(error){report.errors.push(error.stack||String(error));}
finally{
 try{report.publicAfter=await manifestCheck();}catch(error){report.passed=false;report.errors.push(error.stack||String(error));}
 report.finishedAt=new Date().toISOString();report.cacheInventory=Object.fromEntries(Object.entries(caches).map(([variant,cache])=>[variant,{entries:cache.size,bytes:[...cache.values()].reduce((a,e)=>a+e.body.length,0),files:[...cache.values()].map(e=>({url:e.url,range:e.range,status:e.status,bytes:e.body.length,sha256:e.sha256}))}]));
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(ok=>{server.close(ok);server.closeAllConnections?.();});
}
console.log(JSON.stringify({passed:report.passed,performanceApproved:false,output,runs:report.runs.map(r=>({id:r.id,passed:r.passed})),errors:report.errors}));
if(!report.passed)process.exitCode=1;
