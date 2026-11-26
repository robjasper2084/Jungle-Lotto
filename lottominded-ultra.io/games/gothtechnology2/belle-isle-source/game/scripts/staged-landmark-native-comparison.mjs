/** Additive full-game comparison. No actor/camera setters or application edits.
 * The separate native portal/contact and ninety-second gates remain unchanged. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {access,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installLandmarkComparisonObserver} from './landmark-comparison-observer.mjs';
import {sites,views,viewportFor,sha256,assertSourceAssets,assertCapture,assertNativeRoute,assertModeReport,compareReports,verifyCapturePng,cameraContract,assertGeneratedTimingChange} from './staged-landmark-comparison-contract.mjs';

const MODE_BUDGET=32*60_000;
const exists=async file=>access(file).then(()=>true,()=>false);
const git=(game,args)=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
async function bounded(promise,milliseconds,label){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded its deadline')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
async function sourceAssets(game){
 const manifest=JSON.parse(await readFile(resolve(game,'public/belle/staged-architecture/manifest.json'),'utf8'));
 assert.equal(manifest.productionReady,false);assert.equal(manifest.models.length,4);
 const assets=manifest.models.flatMap(model=>model.lods.map(lod=>({site:model.placement.gameMapId||model.placement.gameRoadId,lod:lod.lod,file:lod.file,sha256:lod.sha256,bytes:lod.bytes})))
  .sort((a,b)=>a.file.localeCompare(b.file));
 assertSourceAssets(assets);
 for(const asset of assets){
  const bytes=await readFile(resolve(game,'public/belle/staged-architecture',asset.file));
  assert.equal(sha256(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);
 }
 return assets;
}
async function compiledReceipts(dist,directory=dist,result=[]){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=resolve(directory,entry.name);
  if(entry.isDirectory())await compiledReceipts(dist,file,result);
  else if(/\.(js|css)$/.test(entry.name)){const bytes=await readFile(file);result.push({file:relative(dist,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha256(bytes)});}
 }
 return result.sort((a,b)=>a.file.localeCompare(b.file));
}
function assertCheckout(game,sourceSha,sourceTree){
 assert.equal(git(game,['rev-parse','HEAD']),sourceSha,'The checkout changed during comparison');
 assert.equal(git(game,['rev-parse','HEAD^{tree}']),sourceTree,'The source tree changed during comparison');
 assert.equal(git(game,['status','--porcelain','--untracked-files=no']),'','Tracked source changes invalidate the exact-head proof');
}
async function buildMode({game,mode,sourceSha,sourceTree,assets,out}){
 assertCheckout(game,sourceSha,sourceTree);const flag=mode==='staged'?'1':'0',dist=resolve(game,'dist');
 const timingFile=resolve(game,'../research/street-detail-stats.json'),timingBefore=await readFile(timingFile);
 console.log(new Date().toISOString()+' landmark comparison building '+mode+' at '+sourceSha);
 let generatedTiming;
 try{
  execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:game,stdio:'inherit',timeout:25*60_000,
   env:{...process.env,VITE_STAGED_BELLE_ARCHITECTURE:flag}});
 }finally{
  const timingAfter=await readFile(timingFile);
  generatedTiming={file:relative(resolve(game,'..'),timingFile),...assertGeneratedTimingChange(timingBefore,timingAfter)};
  if(!timingBefore.equals(timingAfter))await writeFile(timingFile,timingBefore);
  generatedTiming.restoredOriginalBytes=(await readFile(timingFile)).equals(timingBefore);
  assert.equal(generatedTiming.restoredOriginalBytes,true,'Failed to restore only the verified generated timing noise');
 }
 assertCheckout(game,sourceSha,sourceTree);
 const builtStagedAssets=[];
 for(const asset of assets){
  const file=resolve(dist,'belle/staged-architecture',asset.file);
  if(mode==='default')assert.equal(await exists(file),false,'Default build included a staged model');
  else{const bytes=await readFile(file);assert.equal(sha256(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);builtStagedAssets.push(asset);}
 }
 const stagedManifestPresent=await exists(resolve(dist,'belle/staged-architecture/manifest.json'));
 assert.equal(stagedManifestPresent,mode==='staged');
 const manifestBytes=await readFile(resolve(dist,'asset-manifest.json')),manifest=JSON.parse(manifestBytes);
 const stagedEntries=manifest.filter(file=>file.startsWith('belle/staged-architecture/'));
 assert.equal(stagedEntries.length,mode==='staged'?13:0,'Built asset-manifest does not match the staging mode');
 const receipt={version:1,mode,flag,sourceSha,sourceTree,sourceAssets:assets,builtStagedAssets,stagedManifestPresent,generatedTiming,
  indexSha256:sha256(await readFile(resolve(dist,'index.html'))),assetManifestSha256:sha256(manifestBytes),compiled:await compiledReceipts(dist)};
 await mkdir(out,{recursive:true});await writeFile(resolve(out,'build.json'),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}

function installNativeEvidence(){
 const held=new Set(),e=window.__landmarkComparisonInputs={phase:'boot',events:[],overflow:false,held:[],focusLossDuringInput:[]};
 for(const type of ['click','keydown','keyup','pointerdown','pointerup','input','change'])document.addEventListener(type,event=>{
  if(type==='keydown')held.add(event.code);if(type==='keyup')held.delete(event.code);e.held=[...held];
  if(e.events.length>=10000){e.overflow=true;return;}
  const element=event.target,button=element?.closest?.('button');
  e.events.push({type,trusted:event.isTrusted,code:event.code||null,target:button?.id?'#'+button.id:element?.id?'#'+element.id:element?.tagName,
   text:button?.textContent?.trim()||null,value:element?.value??null,landmark:button?.closest('article.landmark')?.querySelector('h3')?.textContent?.trim()||null,
   phase:e.phase,at:performance.now()});
 },true);
 const lost=reason=>{if(held.size)e.focusLossDuringInput.push({reason,keys:[...held],phase:e.phase,at:performance.now()});};
 addEventListener('blur',()=>lost('window blur'));document.addEventListener('visibilitychange',()=>{if(document.hidden)lost('document hidden');});
}

export async function captureMode({game,mode,layout,sourceSha,sourceTree,assets,build,out}){
 const viewport=viewportFor(layout),started=Date.now(),ownedKeys=new Set(),responseReads=[];
 const report={version:1,passed:false,mode,layout,sourceSha,sourceTree,sourceAssets:assets,build,viewport,deviceScaleFactor:1,
  run:process.env.GITHUB_RUN_ID||null,startedAt:new Date(started).toISOString(),phase:'setup',captures:[],stagedRequests:[],failedRequests:[],errors:[],
  cameraContract,limitations:'Real native Metal compositor pixels at six public anchors. Camera and source equivalence only; manual appearance/overlap review, actual entrance/contact checks, and sustained performance remain separate.'};
 await mkdir(out,{recursive:true});
 const require=createRequire(resolve(game,'../../package.json'));
 const {chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90_000});
 const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
 const {captureCadillacViewportPng}=await import(pathToFileURL(resolve(game,'scripts/cadillac-cdp-viewport-png.mjs')).href);
 const server=createCoopStaticServer(resolve(game,'dist'));
 let browser,context,page,client,stopped=false,timer;
 const check=()=>{if(stopped||Date.now()-started>=MODE_BUDGET)throw Error('Comparison mode exceeded its 32-minute budget');};
 const phase=async value=>{check();report.phase=value;console.log(new Date().toISOString()+' landmark comparison '+mode+' '+value);if(page)await page.evaluate(value=>{window.__landmarkComparisonInputs.phase=value;},value);};
 const snapshot=async()=>{check();return page.evaluate(()=>window.__landmarkComparisonObserver.snapshot());};
 const press=async key=>{check();ownedKeys.add(key);try{await page.keyboard.down(key);}finally{try{await page.keyboard.up(key);}finally{ownedKeys.delete(key);}}};
 const focus=async()=>{check();await page.bringToFront();await page.locator('#game').click({position:{x:viewport.width*.58,y:viewport.height*.55}});await expect(page.locator('#game')).toBeFocused();};
 async function nextFrame(previous){
  check();await page.waitForFunction(previous=>window.__landmarkComparisonObserver?.ready()&&window.__landmarkComparisonObserver.frame()>previous,previous,{polling:100,timeout:90_000});
 }
 async function settle(){
  // Poll the cheap pass number first. Read the bounded full receipt only after
  // a new observed pass; never traverse the island once per browser RAF.
  const deadline=Date.now()+180_000;let last=-1;
  while(Date.now()<deadline){
   await nextFrame(last);const observed=await snapshot();last=observed.latest?.sequence??last;
   const tail=observed.history.slice(-6);
   if(observed.ready&&tail.length===6&&tail.every((row,index)=>row.valid&&row.sequence>observed.captureWindow.afterSequence&&row.sequence===tail[0].sequence+index&&row.scene.uuid===tail[0].scene.uuid&&row.camera?.uuid===tail[0].camera?.uuid&&
    JSON.stringify(row.camera?.gpu)===JSON.stringify(tail[0].camera?.gpu)))return observed;
  }
  throw Error('The real camera did not settle to six identical submitted GPU inputs within 180 seconds');
 }
 async function view(firstPerson){
  if(await page.locator('#view').getAttribute('aria-pressed')!==String(firstPerson)){await focus();await press('v');}
  await expect(page.locator('#view')).toHaveAttribute('aria-pressed',String(firstPerson));await settle();
 }
 async function guide(site,action){
  await phase(site.key+'-'+action.toLowerCase().replaceAll(' ','-'));
  if(!await page.locator('#map-open').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#map-open').click();await expect(page.locator('#guide')).toBeVisible();
  const card=page.locator('#guide article.landmark').filter({has:page.getByRole('heading',{name:site.name,exact:true})});
  assert.equal(await card.count(),1,'The exact public Guide destination is missing');
  await card.getByRole('button',{name:action,exact:true}).click();await expect(page.locator('#guide')).not.toBeVisible();await focus();
 }
 async function configure(){
  if(!await page.locator('#settings-open').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#settings-open').click();const cycle=page.locator('#sky-cycle');if(await cycle.isChecked())await cycle.uncheck();
  async function selectNative(selector,value){
   const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await expect(control).toBeEnabled();
   const options=await control.locator('option').evaluateAll(items=>items.map(item=>item.value)),index=options.indexOf(value);
   assert(index>=0&&options.length>1,'Missing native setting option '+selector);
   const select=async target=>{
    await control.press('Home');for(let i=0;i<target;i++)await control.press('ArrowDown');await control.press('Enter');
    await expect(control).toHaveValue(options[target]);
   };
   // If already selected, visit another real option first so the final input
   // and change handlers have trusted browser evidence as well as a DOM value.
   if(await control.inputValue()===value)await select(index===0?1:0);
   await select(index);
  }
  await selectNative('#sky-preset','12');await selectNative('#sky-clouds','clear');
  await selectNative('#quality',layout==='phone'?'smooth':'high');await selectNative('#fps',layout==='phone'?'30':'60');
  await page.locator('[data-close="settings"]').click();await focus();
  await expect(page.locator('#profile')).toHaveAttribute('data-quality',layout==='phone'?'smooth':'high');
  await expect(page.locator('#profile')).toHaveAttribute('data-effective-quality',layout==='phone'?'smooth':'high');
 }
 async function settings(){
  return page.evaluate(()=>{
   const gl=document.querySelector('#game')?.getContext('webgl2');
   return{focused:document.hasFocus(),visible:document.visibilityState==='visible',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
    startupMotion:document.querySelector('#startup-motion')?.getAttribute('aria-pressed')==='true',skyCycle:document.querySelector('#sky-cycle')?.checked,
    skyHour:Number(document.querySelector('#sky-hour')?.value),clouds:document.querySelector('#sky-clouds')?.value,
    quality:document.querySelector('#quality')?.value,effectiveQuality:document.querySelector('#profile')?.dataset.effectiveQuality,fps:document.querySelector('#fps')?.value,
    adaptiveScale:Number(document.querySelector('#profile')?.dataset.adaptiveScale),effectiveFrameCap:Number(document.querySelector('#profile')?.dataset.frameCap),
    renderPixelRatio:Number(document.querySelector('#profile')?.dataset.pixelRatio),
    antiAliasing:document.querySelector('#anti-aliasing')?.value,devicePixelRatio,innerWidth,innerHeight,contextAttributes:gl?.getContextAttributes()};
  });
 }
 async function painted(){
  return page.evaluate(()=>new Promise((yes,no)=>{
   const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');
   if(!gl||gl.isContextLost())return no(Error('Missing original game WebGL2 context'));
   const debug=gl.getExtension('WEBGL_debug_renderer_info'),renderer=gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
   const submittedAt=performance.now(),sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return no(Error('Missing original game GPU fence'));
   let frame=0,done=false;const deadline=setTimeout(()=>finish(Error('GPU completion exceeded 45 seconds')),45000);gl.flush();
   function finish(error,value){if(done)return;done=true;clearTimeout(deadline);cancelAnimationFrame(frame);gl.deleteSync(sync);error?no(error):yes(value);}
   function poll(){
    if(gl.isContextLost())return finish(Error('Game WebGL context lost'));
    const status=gl.clientWaitSync(sync,0,0);if(status===gl.TIMEOUT_EXPIRED){frame=requestAnimationFrame(poll);return;}
    if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED)return finish(Error('Game GPU fence failed'));
    const completedAt=performance.now();frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>finish(null,{gpuFence:true,renderer,submittedAt,completedAt,paintOpportunities:2,width:canvas.width,height:canvas.height}));});
   }frame=requestAnimationFrame(poll);
  }));
 }
 async function capture(id){
  await phase('capture-'+id);const expected=views.find(v=>v.id===id);assert(expected);await settle();
  const gpu=await painted(),before=await snapshot(),file=id+'.png',observedSettings=await settings();
  const bytes=await bounded(captureCadillacViewportPng({client,viewport,path:resolve(out,file)}),150_000,'Native compositor PNG');
  await nextFrame(before.latest.sequence);const after=await snapshot();
  const afterSettings=await settings();assert.deepEqual(afterSettings,observedSettings,'The real view settings changed during capture');
  const row={id,site:expected.site,file,sha256:sha256(bytes),bytes:bytes.length,viewport,gpu,before,after,settings:observedSettings,
   firstPerson:await page.locator('#view').getAttribute('aria-pressed')==='true',rideMode:(await page.locator('#ride-mode').textContent()).trim(),
   place:await page.locator('#place').textContent()};
  report.captures.push(row);assertCapture(row,{mode,layout});await verifyCapturePng(row,out,viewport);
 }
 async function exercise(){
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-angle=metal']});report.browser=browser.version();
  context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:layout==='phone',hasTouch:layout==='phone',reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(installLandmarkComparisonObserver,{historyLimit:8});
  await context.addInitScript(installNativeEvidence);
  page=await context.newPage();page.setDefaultTimeout(90_000);client=await context.newCDPSession(page);
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{
   if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());
   const path=new URL(response.url()).pathname;
   if(path.includes('/belle/staged-architecture/')){
    const task=(async()=>{const bytes=await response.body();report.stagedRequests.push({url:response.url(),file:decodeURIComponent(path.split('/').at(-1)),status:response.status(),bytes:bytes.length,sha256:sha256(bytes)});})()
     .catch(error=>report.errors.push('Staged response receipt: '+error));responseReads.push(task);
   }
  });
  await phase('boot');
  await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30_000});await page.bringToFront();
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180_000});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
  const motion=page.locator('#startup-motion');if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
  await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);
  // Startup/preparation observations remain in the report. They do not define
  // the six-view capture window, which can be armed exactly once below.
  await page.waitForFunction(()=>window.__landmarkComparisonObserver?.canArm(),null,{polling:100,timeout:90_000});
  await configure();await phase('arm-comparison-window');
  const armHandle=await page.waitForFunction(()=>{
   const observer=window.__landmarkComparisonObserver;
   return observer?.canArm()?observer.arm():false;
  },null,{polling:100,timeout:90_000});
  try{report.captureWindow=await armHandle.jsonValue();}finally{await armHandle.dispose();}
  for(const site of sites){
   await guide(site,site.travel);await view(false);await expect(page.locator('#ride-mode')).toHaveText('EUC');await capture(site.key+'-exterior');
   await focus();await press('f');await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');await view(true);await capture(site.key+'-entrance');
   await guide(site,site.explore);await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');await view(true);await capture(site.key+'-interior');
  }
  await Promise.all(responseReads);report.nativeEvidence=await page.evaluate(()=>window.__landmarkComparisonInputs);assertNativeRoute(report.nativeEvidence,layout);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);check();report.passed=true;assertModeReport(report);
 }
 try{await Promise.race([exercise(),new Promise((_,reject)=>{timer=setTimeout(()=>{stopped=true;reject(Error('Comparison mode exceeded its 32-minute budget'));},MODE_BUDGET);})]);}
 catch(error){report.passed=false;report.errors.push(String(error?.stack||error));}
 finally{
  clearTimeout(timer);stopped=true;
  if(page){
   for(const key of [...ownedKeys])try{await bounded(page.keyboard.up(key),10_000,'Native key release');ownedKeys.delete(key);}catch(error){report.errors.push(String(error));}
   try{report.nativeEvidence=await bounded(page.evaluate(()=>window.__landmarkComparisonInputs),10_000,'Native evidence receipt');}catch(error){report.errors.push(String(error));}
   try{report.finalObserver=await bounded(page.evaluate(()=>window.__landmarkComparisonObserver?.snapshot()),10_000,'Final renderer receipt');}catch(error){report.errors.push(String(error));}
  }
  await bounded(Promise.all(responseReads),10_000,'Response receipts').catch(error=>report.errors.push(String(error)));
  await bounded(browser?.close(),10_000,'Browser cleanup').catch(error=>report.errors.push(String(error)));
  server.closeAllConnections();await bounded(new Promise(yes=>server.close(()=>yes())),10_000,'Server cleanup').catch(error=>report.errors.push(String(error)));
  report.finishedAt=new Date().toISOString();report.elapsedWallMs=Date.now()-started;
  if(report.errors.length||report.failedRequests.length)report.passed=false;
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

export async function run(){
 const game=resolve(process.env.STAGED_COMPARISON_GAME_DIR||resolve(import.meta.dirname,'..')),layout=process.env.STAGED_COMPARISON_LAYOUT||'desktop';
 const out=resolve(process.env.STAGED_COMPARISON_OUT||resolve(game,'output/staged-landmark-comparison',layout));
 const sourceSha=process.env.STAGED_COMPARISON_SOURCE_SHA||git(game,['rev-parse','HEAD']),sourceTree=git(game,['rev-parse','HEAD^{tree}']);
 await mkdir(out,{recursive:true});
 const result={version:1,automatedEvidencePassed:false,sourceSha,sourceTree,layout,run:process.env.GITHUB_RUN_ID||null,
  cameraContract,manualVisualReviewRequired:true,visualOverlapAccepted:null,appearanceAccepted:null,collisionAccepted:null,performanceAccepted:null,modes:[],errors:[]};
 try{
  assert.equal(process.platform,'darwin','This evidence lane requires actual macOS Metal; no software fallback is permitted');
  assert.match(sourceSha,/^[a-f0-9]{40}$/);assertCheckout(game,sourceSha,sourceTree);viewportFor(layout);
  const assets=await sourceAssets(game);
  for(const mode of ['default','staged']){
   const directory=resolve(out,mode);const build=await buildMode({game,mode,sourceSha,sourceTree,assets,out:directory});
   const report=await captureMode({game,mode,layout,sourceSha,sourceTree,assets,build,out:directory});result.modes.push(report);
  }
  assertCheckout(game,sourceSha,sourceTree);Object.assign(result,compareReports(...result.modes));
 }catch(error){result.errors.push(String(error?.stack||error));result.automatedEvidencePassed=false;}
 finally{
  const safe=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const rows=views.map(view=>'<section><h2>'+safe(view.id)+'</h2><div class="pair">'+['default','staged'].map(mode=>{
   const capture=result.modes.find(m=>m.mode===mode)?.captures.find(c=>c.id===view.id);
   return'<figure><figcaption>'+safe(mode)+'</figcaption>'+(capture?'<img src="'+mode+'/'+capture.file+'" alt="'+safe(mode+' '+view.id)+'">':'<p>Not captured</p>')+'</figure>';
  }).join('')+'</div></section>').join('');
  await writeFile(resolve(out,'comparison.json'),JSON.stringify(result,null,2)+'\n');
  await writeFile(resolve(out,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Staged landmark matched native comparison</title><style>body{font:16px system-ui;background:#151b21;color:#eee;margin:24px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{max-width:100%;height:auto}section{margin:32px 0}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>Landmark native comparison — '+safe(layout)+'</h1><p>Source '+safe(sourceSha)+'</p><p>Automated source, camera, and capture evidence: '+(result.automatedEvidencePassed?'PASS':'NOT PASSED')+'. Manual appearance and overlap review remains required. Separate native entrance/contact and ninety-second performance gates remain in force.</p>'+rows);
 }
 console.log(JSON.stringify({sourceSha,layout,automatedEvidencePassed:result.automatedEvidencePassed,captures:result.modes.map(m=>({mode:m.mode,count:m.captures.length,passed:m.passed})),errors:result.errors}));
 if(!result.automatedEvidencePassed)process.exitCode=1;return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
