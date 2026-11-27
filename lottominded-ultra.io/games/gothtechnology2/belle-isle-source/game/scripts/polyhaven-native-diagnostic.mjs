/** Candidate-only native Metal cost evidence at the public Nashua Guide stop.
 * No application setters, renderer policy changes, or acceptance-driver edits. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {installPolyhavenComparisonObserver} from './polyhaven-native-diagnostic-observer.mjs';
import {selectNativeByLabel} from './native-select-typeahead.mjs';
import {ORIGINAL_HARNESS_BLOB,WINDOW_SECONDS,VIEWPORT,PROTOTYPES,sha256,gitBlob,sourceArtifactContract,generatedTimingContract,
 chooseRockTarget,nativeLookPlan,targetFraming,cpuCoverage,diagnosticVerdict,limitations} from './polyhaven-native-diagnostic-contract.mjs';

const game=resolve(import.meta.dirname,'..'),output=resolve(game,'output/polyhaven-native-diagnostic');
const report={version:1,diagnosticOnly:true,releaseAcceptance:false,collectionComplete:false,status:'starting',
 started:new Date().toISOString(),hostPlatform:process.platform,workflowSha:process.env.GITHUB_SHA||null,
 runId:process.env.GITHUB_RUN_ID||null,requestedDiagnosticSeconds:WINDOW_SECONDS,
 scope:'Candidate preview only; public Guide travel and native look; full-scene manual CPU observation.',
 errors:[],failedRequests:[],looks:[],consumedScripts:[],consumedAssets:[],limitations};
const save=(name,value)=>writeFile(resolve(output,name),JSON.stringify(value,null,2)+'\n');
const errorText=e=>e?.stack||String(e);
const git=args=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});await save('report.json',report);

async function inventory(directory){
 const files=[];
 async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
  const file=resolve(folder,entry.name),name=relative(directory,file).split('\\').join('/');
  assert(!entry.isSymbolicLink(),'Unbound build symlink: '+name);
  if(entry.isDirectory())await visit(file);else{assert(entry.isFile(),'Unexpected build entry');const bytes=await readFile(file);files.push({file:name,bytes:bytes.length,sha256:sha256(bytes)});}
 }}await visit(directory);return files.sort((a,b)=>a.file.localeCompare(b.file));
}
async function sourceAndBuild(){
 const head=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
 assert.equal(head,process.env.POLYHAVEN_EXPECTED_HEAD,'Checkout is not the requested PR head');
 assert.equal(git(['diff','--name-only','HEAD','--']),'','Tracked inputs must be clean before building');
 assert(process.env.POLYHAVEN_REVIEW_DIR&&process.env.GITHUB_RUN_ID,'Missing same-run source-art provenance');
 const artifact=resolve(process.env.POLYHAVEN_REVIEW_DIR),sourceArtifact=JSON.parse(await readFile(resolve(artifact,'source-provenance.json'),'utf8'));
 const root=git(['rev-parse','--show-toplevel']),timing=resolve(game,'../research/street-detail-stats.json'),timingPath=relative(root,timing).split('\\').join('/');
 const beforeTiming=await readFile(timing),harness=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'));
 assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB,'Original ninety-second driver changed');
 assert.equal(sourceArtifact.head,head);assert.equal(sourceArtifact.tree,tree);assert.equal(String(sourceArtifact.runId),String(process.env.GITHUB_RUN_ID));
 report.buildInputs={head,tree,expectedHead:process.env.POLYHAVEN_EXPECTED_HEAD,sourceArtifact,harness:{gitBlob:gitBlob(harness),sha256:sha256(harness)}};
 await save('build-inputs.json',report.buildInputs);
 const built=spawnSync('npm',['run','build'],{cwd:game,env:{...process.env,VITE_POLYHAVEN_ROCK_PREVIEW:'1'},stdio:'inherit',timeout:30*60*1000});
 report.buildStatus={status:built.status,signal:built.signal,error:built.error?errorText(built.error):null};
 assert(!built.error&&!built.signal&&built.status===0,'Original preview build failed');
 assert.equal(git(['rev-parse','HEAD']),head,'Head changed during build');assert.equal(git(['rev-parse','HEAD^{tree}']),tree,'Tree changed during build');
 const changed=git(['diff','--name-only','HEAD','--']).split('\n').filter(Boolean);
 assert(changed.every(file=>file===timingPath),'Build changed a tracked input other than known generated timing');
 report.generatedTrackedChanges=changed;
 report.generatedTiming={path:timingPath,...generatedTimingContract(beforeTiming,await readFile(timing))};
 const assets=[];
 for(const [folder,file] of PROTOTYPES)assets.push({folder,file,source:await readFile(resolve(artifact,folder,file)),
  staged:await readFile(resolve(game,'public/belle/polyhaven-review',file)),built:await readFile(resolve(game,'dist/belle/polyhaven-review',file))});
 const manifest=JSON.parse(await readFile(resolve(game,'dist/asset-manifest.json'),'utf8'));
 report.source=sourceArtifactContract({head,tree,expectedHead:process.env.POLYHAVEN_EXPECTED_HEAD,artifact:sourceArtifact,
  runId:process.env.GITHUB_RUN_ID,harness,assets,manifest});
 // This is the existing manual profiler's provenance endpoint, not an app
 // patch. Bind the exact completed build before serving it; no fake base SHA.
 report.buildMarker={version:1,repository:'robjasper2084/Jungle-Lotto',commit:head,
  buildId:'polyhaven-native-diagnostic-'+process.env.GITHUB_RUN_ID,builtAt:new Date().toISOString(),
  indexSha256:sha256(await readFile(resolve(game,'dist/index.html'))),profileQuery:'manual'};
 await writeFile(resolve(game,'dist/__belle_test_build.json'),JSON.stringify(report.buildMarker,null,2)+'\n');
 report.buildFiles=await inventory(resolve(game,'dist'));await save('build-receipt.json',{source:report.source,buildFiles:report.buildFiles,generatedTiming:report.generatedTiming});
 return assets;
}

/** Copies trusted native input evidence. Never dispatches any application input. */
function installInputReceipts(){
 const rows=[],errors=[];let untrusted=0,dropped=0;
 for(const type of ['click','keydown','keyup','pointerdown','pointerup','pointermove'])document.addEventListener(type,event=>{
  try{
   const target=event.target,canvas=target?.id==='game';
   if(type==='pointermove'&&(!canvas||event.buttons!==1))return;
   if(type.startsWith('pointer')&&!canvas)return;
   const button=target?.closest?.('button'),heading=button?.closest?.('.landmark')?.querySelector('h3')?.textContent?.trim();
   if(!event.isTrusted)untrusted++;
   if(rows.length>=512){dropped++;return;}
   rows.push({type,trusted:event.isTrusted,atMs:performance.now(),target:target?.id||null,buttonId:button?.id||null,
    text:button?.textContent?.trim().slice(0,120)||null,heading:heading||null,code:event.code||null,
    x:Number.isFinite(event.clientX)?event.clientX:null,y:Number.isFinite(event.clientY)?event.clientY:null,buttons:event.buttons??null});
  }catch(e){errors.push(String(e));}
 },true);
 Object.defineProperty(window,'__polyhavenNativeInputs',{value:()=>({rows:rows.map(row=>({...row})),untrusted,dropped,errors:[...errors]}),configurable:false});
}

let browser,page,server,session,cpuRecording=false,receiptsPaused=false;
const responseTasks=new Set();
async function cdp(method,params={}){
 let timer;try{return await Promise.race([session.send(method,params),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(method+' timed out')),15000);})]);}finally{clearTimeout(timer);}
}
async function clockProbe(){
 const beforeMs=await page.evaluate(()=>performance.now()),metrics=(await cdp('Performance.getMetrics')).metrics;
 const afterMs=await page.evaluate(()=>performance.now()),timestampSeconds=metrics.find(row=>row.name==='Timestamp')?.value;
 return {beforeMs,afterMs,timestampSeconds,metrics};
}
async function openSettings(expect){
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
 await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();
}
async function closeMenus(){
 for(const id of ['settings','ride-menu'])if(await page.locator('#'+id).isVisible())await page.locator('[data-close="'+id+'"]').click();
 await page.locator('#game').focus();
}
async function actualSettings(){
 return page.evaluate(()=>({quality:document.querySelector('#quality')?.value,cap:Number(document.querySelector('#fps')?.value),
  hour:Number(document.querySelector('#sky-hour')?.value),clouds:document.querySelector('#sky-clouds')?.value,cycle:document.querySelector('#sky-cycle')?.checked,
  lookSensitivity:Number(document.querySelector('#look-sensitivity')?.value),focused:document.hasFocus(),visibility:document.visibilityState,
  reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,viewport:[innerWidth,innerHeight,devicePixelRatio],url:location.href}));
}
async function fence(){
 return page.locator('#game').evaluate(()=>new Promise((ok,reject)=>{
  const gl=document.querySelector('#game')?.getContext('webgl2');if(!gl||gl.isContextLost())return reject(Error('Native WebGL2 lost'));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),start=performance.now();if(!sync)return reject(Error('Native fence unavailable'));gl.flush();
  const poll=()=>{const result=gl.clientWaitSync(sync,0,0);
   if(result===gl.CONDITION_SATISFIED||result===gl.ALREADY_SIGNALED){gl.deleteSync(sync);return ok({gpuFence:true,elapsedMs:performance.now()-start});}
   if(result===gl.WAIT_FAILED||performance.now()-start>30000){gl.deleteSync(sync);return reject(Error('Native fence failed or timed out'));}
   requestAnimationFrame(poll);
  };poll();
 }));
}
async function settled(expect){
 await expect.poll(()=>page.evaluate(()=>window.__polyhavenComparisonObserver?.ready()),{timeout:60000}).toBe(true);
 const before=await page.evaluate(()=>window.__polyhavenComparisonObserver.frame());
 await page.waitForFunction(first=>window.__polyhavenComparisonObserver.ready()&&window.__polyhavenComparisonObserver.frame()>first+2,before,{timeout:60000});
}
async function capture(name,target,expect){
 await settled(expect);const proof=await fence();
 const before=await page.evaluate(()=>window.__polyhavenComparisonObserver.snapshot());
 const bytes=await page.screenshot({path:resolve(output,name+'.png'),timeout:60000});
 const observer=await page.evaluate(()=>window.__polyhavenComparisonObserver.snapshot());
 const resources=await page.evaluate(()=>window.__polyhavenComparisonObserver.resources());await save(name+'-resources.json',resources);
 const row={name,fence:proof,observer,framing:targetFraming(observer.latest.camera,target),
  png:{file:name+'.png',bytes:bytes.length,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},
  resourceFile:name+'-resources.json',resourceSha256:sha256(await readFile(resolve(output,name+'-resources.json')))};
 await save(name+'-capture.json',row);
 assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR','Real screenshot is not PNG');
 assert.equal(row.png.width,1440);assert.equal(row.png.height,900);assert(bytes.length>=15000,'Unexpectedly empty native screenshot');
 assert.deepEqual(observer.latest.camera.gpu,before.latest.camera.gpu,'Actual submitted camera changed across screenshot');
 const owners=s=>s.latest.rockDraws.map(({object,geometry,geometryResource,material,count,instanceMatrix,matrixWorld,drawRange})=>({object,geometry,geometryResource,material,count,instanceMatrix,matrixWorld,drawRange}));
 assert.deepEqual(owners(observer),owners(before),'Rock owners changed across native screenshot');
 assert(observer.ready&&observer.captureInvalidPasses===0,'Incomplete or failed original draw coverage');
 if(!row.framing.projectedInside)report.errors.push(name+': target center/base not inside the actual submitted camera');return row;
}

try{
 assert.equal(process.platform,'darwin','This diagnostic requires genuine native macOS Metal');
 await sourceAndBuild();
 const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:rawExpect}=require('@playwright/test'),expect=rawExpect.configure({timeout:60000});
 server=createCoopStaticServer(resolve(game,'dist'));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
 report.launch=launch;browser=await chromium.launch(launch);
 page=await browser.newPage({viewport:VIEWPORT,deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});
 page.setDefaultTimeout(60000);await page.addInitScript(installPolyhavenComparisonObserver);await page.addInitScript(installInputReceipts);
 page.on('pageerror',e=>report.errors.push('Page: '+errorText(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push('Console: '+m.text());});
 page.on('requestfailed',r=>report.failedRequests.push((r.failure()?.errorText||'failed')+' '+r.url()));
 page.on('response',response=>{
  if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());
  const url=new URL(response.url());if(url.hostname!=='127.0.0.1')return;
  const name=decodeURIComponent(url.pathname).slice(1),asset=report.source.assets.find(row=>name==='belle/polyhaven-review/'+row.file);
  if(!name.endsWith('.js')&&!asset)return;
  const task=(async()=>{
   const bound=report.buildFiles.find(row=>row.file===name);assert(bound,'Unbound consumed application resource: '+name);
   assert.equal(response.status(),200,'Consumed resource was not successful');const bytes=await response.body();
   assert.equal(bytes.length,bound.bytes,'Consumed resource length mismatch');assert.equal(sha256(bytes),bound.sha256,'Consumed resource/build mismatch');
   if(asset)assert.equal(bound.sha256,asset.sha256,'Consumed prototype differs from source-art');
   const directory=resolve(output,'consumed');await mkdir(directory,{recursive:true});const file=bound.sha256+(asset?'.glb':'.js');await writeFile(resolve(directory,file),bytes);
   const row={file:asset?.file||name,path:'consumed/'+file,url:response.url(),bytes:bytes.length,sha256:bound.sha256,verified:true};
   (asset?report.consumedAssets:report.consumedScripts).push(row);
  })().catch(e=>report.errors.push('Resource receipt: '+errorText(e)));responseTasks.add(task);task.finally(()=>responseTasks.delete(task));
 });
 report.url='http://127.0.0.1:'+server.address().port+'/?profile=manual';
 await page.goto(report.url,{waitUntil:'domcontentloaded'});await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:180000});
 report.renderer=await page.locator('#game').evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');if(!gl||gl.isContextLost())throw Error('Game WebGL unavailable');return String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));});
 assert(/Metal/i.test(report.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.renderer),'The real game is not using native Metal');
 const motion=page.locator('#startup-motion');if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
 await openSettings(expect);report.nativeSettings=[];
 for(const [selector,value] of [['#quality','high'],['#fps','60'],['#sky-preset','12'],['#sky-clouds','clear']])report.nativeSettings.push(await selectNativeByLabel(page,expect,selector,value));
 if(await page.locator('#sky-cycle').isChecked())await page.locator('#sky-cycle').uncheck();await closeMenus();
 if(await page.locator('#view').getAttribute('aria-pressed')!=='true')await page.locator('#view').click();
 await expect(page.locator('#view')).toHaveAttribute('aria-pressed','true');
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:/^Nashua Canal$/})});
 await expect(card).toHaveCount(1);await card.getByRole('button',{name:/^Travel/}).click();await expect(page.locator('#guide')).not.toBeVisible();await closeMenus();
 await expect(page.locator('#destination')).toContainText('Nashua Canal');
 report.guide={destination:'Nashua Canal',trusted:(await page.evaluate(()=>window.__polyhavenNativeInputs())).rows.some(r=>r.type==='click'&&r.trusted&&r.heading==='Nashua Canal'&&r.text?.startsWith('Travel'))};
 await expect.poll(()=>page.evaluate(()=>window.__polyhavenComparisonObserver.canArm()),{timeout:60000}).toBe(true);
 report.captureWindow=await page.evaluate(()=>window.__polyhavenComparisonObserver.arm());await settled(expect);
 let target;
 for(let shape=0;shape<3;shape++){
  const snapshot=await page.evaluate(()=>window.__polyhavenComparisonObserver.snapshot()),resources=await page.evaluate(()=>window.__polyhavenComparisonObserver.resources());
  target=chooseRockTarget(snapshot,resources,shape);const plan=nativeLookPlan(snapshot.latest.camera,target),row={shape,target,plan,trusted:false,capture:null};report.looks.push(row);
  const boundary=await page.evaluate(()=>performance.now());await page.mouse.move(plan.from.x,plan.from.y);await page.mouse.down();
  try{await page.mouse.move(plan.to.x,plan.to.y,{steps:plan.steps});}finally{await page.mouse.up();}
  const inputs=(await page.evaluate(()=>window.__polyhavenNativeInputs())).rows.filter(r=>r.atMs>=boundary);
  row.trusted=['pointerdown','pointermove','pointerup'].every(type=>inputs.some(r=>r.type===type&&r.trusted&&r.target==='game'));
  row.inputRows=inputs;row.capture=await capture('look-'+shape,target,expect);await save('report.json',report);
 }
 report.receiptPause=await page.evaluate(()=>window.__polyhavenComparisonObserver.pauseReceipts());receiptsPaused=true;
 session=await page.context().newCDPSession(page);report.target=await cdp('Target.getTargetInfo');
 assert.equal(report.target.targetInfo.type,'page');assert.equal(report.target.targetInfo.url,report.url,'CPU profiler attached to another page');
 await cdp('Performance.enable',{timeDomain:'timeTicks'});await cdp('Profiler.enable');await cdp('Profiler.setSamplingInterval',{interval:1000});await cdp('Profiler.start');cpuRecording=true;
 await openSettings(expect);const panel=page.locator('#ride-profile');if(!await panel.evaluate(n=>n.open))await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Start 10-minute capture',exact:true}).click();await closeMenus();
 await expect(page.locator('#profile')).toHaveAttribute('data-quality','high');await expect(page.locator('#pause')).toHaveText('Pause');
 report.settingsAtStart=await actualSettings();report.clockStart=await clockProbe();report.window={startMs:await page.evaluate(()=>performance.now()),endMs:null};
 await page.waitForTimeout(WINDOW_SECONDS*1000);report.window.endMs=await page.evaluate(()=>performance.now());report.clockEnd=await clockProbe();report.settingsAtEnd=await actualSettings();
 await openSettings(expect);if(!await panel.evaluate(n=>n.open))await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Stop and show report',exact:true}).click();
 const rawManual=await panel.getByRole('textbox',{name:'Ride profile report'}).inputValue();await writeFile(resolve(output,'manual-profile.json'),rawManual+'\n');
 report.manualProfile=JSON.parse(rawManual);report.manualProfileSha256=sha256(Buffer.from(rawManual+'\n'));
 const cpu=(await cdp('Profiler.stop')).profile;cpuRecording=false;await save('renderer.cpuprofile',cpu);
 report.cpu={file:'renderer.cpuprofile',sha256:sha256(await readFile(resolve(output,'renderer.cpuprofile'))),coverage:cpuCoverage(cpu,report.window,report.clockStart,report.clockEnd)};
 report.receiptWindow=await page.evaluate(()=>window.__polyhavenComparisonObserver.resumeReceipts());receiptsPaused=false;
 await closeMenus();report.afterCapture=await capture('after-profile',target,expect);
 report.inputs=await page.evaluate(()=>window.__polyhavenNativeInputs());
 const after=await inventory(resolve(game,'dist'));assert.deepEqual(after,report.buildFiles,'Built bytes changed during native observation');
 assert.equal(git(['rev-parse','HEAD']),report.source.head);assert.equal(git(['rev-parse','HEAD^{tree}']),report.source.tree);
 assert.deepEqual(git(['diff','--name-only','HEAD','--']).split('\n').filter(Boolean),report.generatedTrackedChanges,'Tracked source changed during observation');
 assert.equal(sha256(await readFile(resolve(game,'../research/street-detail-stats.json'))),report.generatedTiming.afterSha256,'Generated source timing changed during observation');
 assert.equal(sha256(await readFile(resolve(game,'scripts/sustained-ride-profile.mjs'))),report.source.harness.sha256,'Original acceptance driver changed');
}catch(e){report.errors.push(errorText(e));}
finally{
 if(cpuRecording&&session)try{const raw=(await cdp('Profiler.stop')).profile;await save('renderer-incomplete.cpuprofile',raw);}catch(e){report.errors.push('CPU cleanup: '+errorText(e));}
 if(page&&!page.isClosed()){
  try{if(receiptsPaused)report.receiptWindow=await page.evaluate(()=>window.__polyhavenComparisonObserver.resumeReceipts());report.inputs=await page.evaluate(()=>window.__polyhavenNativeInputs?.()??null);}catch(e){report.errors.push('Observer cleanup: '+errorText(e));}
  if(report.errors.length)try{await page.screenshot({path:resolve(output,'failure.png'),timeout:15000});}catch(e){report.errors.push('Failure screenshot: '+errorText(e));}
 }
 await Promise.allSettled([...responseTasks]);
 if(browser)await browser.close().catch(e=>report.errors.push('Browser close: '+errorText(e)));
 if(server)await new Promise(ok=>server.close(e=>{if(e)report.errors.push('Server close: '+errorText(e));ok();}));
 report.verdict=diagnosticVerdict(report);report.collectionComplete=report.verdict.collectionComplete;report.status='finished';report.finished=new Date().toISOString();
 await save('report.json',report);
 console.log(JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,collectionComplete:report.collectionComplete,errors:report.verdict.errors}));
 if(!report.collectionComplete)process.exitCode=1;
}
