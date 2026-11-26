/** Separate bounded software-renderer attribution. The unchanged controls
 * suite remains the acceptance test; this program does not claim its pass. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {installCadillacSoftwareGpuObserver} from './observer.mjs';
import {pins,sha256} from './provenance.mjs';
import {validateDom,validateObservation} from './validate-observation.mjs';

assert(process.env.APP_GAME&&process.env.SOFTWARE_GPU_OUT,'Explicit original app and evidence directories are required');
const game=resolve(process.env.APP_GAME),out=resolve(process.env.SOFTWARE_GPU_OUT),dist=resolve(game,'dist');
const original=async name=>import(pathToFileURL(resolve(game,'scripts',name)).href);
const {createCoopStaticServer}=await original('coop-static-server.mjs');
const {createCadillacCaseLifecycle,createCadillacCaseInput}=await original('cadillac-case-lifecycle.mjs');
const {createCadillacOperationTiming}=await original('cadillac-operation-timing.mjs');
const {captureCadillacViewportPng}=await original('cadillac-cdp-viewport-png.mjs');
const {createOriginalNativeSetup}=await import(pathToFileURL(resolve(out,'native-setup.mjs')).href);
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90000});
const viewport={width:1280,height:800},launch={channel:'chrome',headless:false,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']};
await mkdir(out,{recursive:true});
const report={version:1,kind:'SOFTWARE GPU DIAGNOSTIC ONLY',diagnosticCompleted:false,
 applicationSource:pins.applicationSource,originalBuild:pins.build,artifact:pins.artifact,
 diagnosticRevision:process.env.SOFTWARE_GPU_DIAGNOSTIC_SHA??null,run:process.env.GITHUB_RUN_ID??null,
 startedAt:new Date().toISOString(),viewport,deviceScaleFactor:1,launch,diagnosticBudgetMs:10*60000,
 phase:'setup',phases:[],checks:{},captures:[],errors:[],failedRequests:[],startupWarnings:[],
 harness:{pointerActivations:0,diagnosticKeyboardActivations:0,explicitScrolls:0,alreadyVisibleScrolls:0},
 scope:'Three actual completed full-scene application frames after the original desktop Start, open Mods, reduced motion, Smooth, 30 fps and close Settings sequence. Original controls assertions, inputs, captures and 32-minute case/34-minute step remain unchanged and are not replaced by this diagnostic. This is SwiftShader attribution, not native Metal or hardware performance acceptance.'};
const operationTiming=createCadillacOperationTiming(),server=createCoopStaticServer(dist);
let browser,context,page,client,setup,cleanup;
const caseLifecycle=createCadillacCaseLifecycle({timeout:report.diagnosticBudgetMs});
const nativeInput=createCadillacCaseInput({lifecycle:caseLifecycle,page:()=>page,touch:()=>undefined});
const phase=name=>{caseLifecycle.check();report.phase=name;report.phases.push({name,at:new Date().toISOString()});operationTiming.phase(name);console.log(report.phases.at(-1).at+' '+name);};
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded its deadline')),ms);})]);}finally{clearTimeout(timer);}}
function releaseOwned(){if(!cleanup){cleanup=bounded(nativeInput.releaseOwned(),10000,'Native input cleanup');cleanup.catch(()=>{});}return cleanup;}
async function checkpoint(){await writeFile(resolve(out,'report.json'),JSON.stringify({...report,caseLifecycle:caseLifecycle.snapshot(),operationTiming:operationTiming.snapshot()},null,2)+'\n');}
async function readDom(){return page.evaluate(()=>{
 const canvas=document.querySelector('#game'),settings=document.querySelector('#settings'),bounds=settings?.getBoundingClientRect();
 return{width:canvas?.width,height:canvas?.height,dpr:devicePixelRatio,
  quality:document.querySelector('#quality')?.value,fps:document.querySelector('#fps')?.value,
  reducedMotion:document.querySelector('#motion')?.checked,
  settingsVisible:!!settings&&getComputedStyle(settings).display!=='none'&&getComputedStyle(settings).visibility!=='hidden'&&!!bounds?.width&&!!bounds?.height,
  atStart:document.body.classList.contains('at-start'),ride:document.querySelector('#ride-mode')?.textContent,
  activeFrames:Number(document.querySelector('#profile')?.dataset.activeFrames),at:performance.now()};
 });}

async function run(){
 const provenance=JSON.parse(await readFile(resolve(out,'source-provenance.json'),'utf8'));
 assert.equal(provenance.applicationSource,pins.applicationSource);
 assert.equal(provenance.diagnosticRevision,report.diagnosticRevision);
 const marker=JSON.parse(await readFile(resolve(dist,'cadillac-mods-build.json'),'utf8'));
 assert.deepEqual(marker,pins.build);assert.equal(sha256(await readFile(resolve(dist,'index.html'))),marker.indexSha256);
 report.provenance=provenance;
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 browser=await chromium.launch(launch);report.browser=browser.version();
 context=await browser.newContext({viewport,isMobile:false,hasTouch:false,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(installCadillacSoftwareGpuObserver,{frames:3,maxObjects:2048,maxCalls:6000,timers:true});
 await context.addInitScript(()=>{
  const evidence={input:[],dropped:0};Object.defineProperty(window,'__cadillacSoftwareGpuInputs',{value:evidence});
  for(const type of ['click','keydown','keyup','input','change','pointerdown','pointerup'])document.addEventListener(type,event=>{
   if(evidence.input.length>=5000){evidence.dropped++;return;}
   evidence.input.push({type,trusted:event.isTrusted,code:event.code??null,pointerType:event.pointerType??null,
    control:event.target?.closest?.('button,input,select,summary')?.id??null,
    target:event.target?.id||event.target?.closest?.('button,label')?.id||event.target?.closest?.('button,label')?.textContent?.trim()?.slice(0,100)||event.target?.tagName,
    at:performance.now()});
  },true);
 });
 page=await context.newPage();page.setDefaultTimeout(90000);client=await context.newCDPSession(page);
 page.on('pageerror',error=>report.errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error'||/context.*lost/i.test(message.text()))report.errors.push(message.text());
  if(message.type()==='warning'&&message.text().startsWith('Selected ride preparation failed')&&report.startupWarnings.length<8)report.startupWarnings.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
 page.on('requestfailed',request=>report.failedRequests.push({phase:report.phase,url:request.url(),error:request.failure()?.errorText}));
 setup=createOriginalNativeSetup({page,nativeInput,caseLifecycle,operationTiming,report,expect});
 phase('original-native-initialization');
 await page.goto('http://127.0.0.1:'+server.address().port+'/?ride=cadillac&profile=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');await setup.tapStart(page.locator('#start'));
 await expect(page.locator('body')).not.toHaveClass(/at-start/);await expect(page.locator('#ride-mode')).toContainText('CADILLAC');
 await setup.openMods(setup.tap);await setup.setReduced(true);
 await setup.selectWithKeyboard('#quality','smooth');await setup.selectWithKeyboard('#fps','30');
 await setup.closeSettings(setup.tap);
 report.before=await readDom();validateDom(report.before);await checkpoint();
 await page.waitForFunction(()=>window.__cadillacSoftwareGpu?.read().ready===true,null,{timeout:90000,polling:1000});
 phase('three-original-completed-frames');
 report.armReceipt=await page.evaluate(()=>window.__cadillacSoftwareGpu.arm());
 for(;;){
  caseLifecycle.check();
  const state=await caseLifecycle.wait(page.evaluate(()=>{const r=window.__cadillacSoftwareGpu.read();return{completedFrames:r.completedFrames,errors:r.errors,overflow:r.overflow};}));
  assert.deepEqual(state.errors,[],'Observer failed during native frame collection');assert.equal(state.overflow,false);
  if(state.completedFrames===3)break;
  assert(state.completedFrames<3,'Observer exceeded the fixed three-frame scope');
  await caseLifecycle.wait(delay(1000));
 }
 // Nonblocking elapsed-query reads occur only after all original application
 // fences completed. Lack of the optional extension remains honest evidence.
 phase('asynchronous-query-readout');
 const queryDeadline=performance.now()+30000;
 for(;;){
  report.observation=await caseLifecycle.wait(page.evaluate(()=>window.__cadillacSoftwareGpu.poll()));
  if(report.observation.pendingQueries===0||['unavailable','disjoint','failed'].includes(report.observation.timer.status)||performance.now()>=queryDeadline)break;
  await caseLifecycle.wait(delay(250));
 }
 report.after=await readDom();
 report.nativeEvidence=await page.evaluate(()=>window.__cadillacSoftwareGpuInputs);
 assert.equal(report.nativeEvidence.dropped,0,'Native input evidence was truncated');
 report.validation=validateObservation(report.observation,report.after,report.nativeEvidence.input);
 await writeFile(resolve(out,'raw-observation.json'),JSON.stringify(report.observation,null,2)+'\n');await checkpoint();
 phase('original-pixel-proof-after-observation');
 const gpu=await operationTiming.observe('original capture fence and two paints',()=>setup.painted());caseLifecycle.check();
 const file='original-full-scene.png';
 const bytes=await operationTiming.observe('original CDP PNG',()=>bounded(captureCadillacViewportPng({client,viewport,path:resolve(out,file)}),150000,'Native PNG capture'));
 caseLifecycle.publish(()=>report.captures.push({file,sha256:sha256(bytes),bytes:bytes.length,viewport,gpu}));
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);
}

try{await caseLifecycle.run(run);report.diagnosticCompleted=true;}
catch(error){
 report.failurePhase=report.phase;report.errors.push(error.stack||String(error));releaseOwned();
 if(page)try{
  const failure=await bounded(page.evaluate(()=>({observation:window.__cadillacSoftwareGpu?.read(),nativeEvidence:window.__cadillacSoftwareGpuInputs})),15000,'Read-only failure evidence');
  report.observation=failure.observation;report.nativeEvidence=failure.nativeEvidence;
  await writeFile(resolve(out,'raw-observation.json'),JSON.stringify(report.observation??null,null,2)+'\n');
 }catch(e){report.errors.push('Failure evidence: '+e.message);}
}
finally{
 try{report.ownedInputCleanup=await releaseOwned();}catch(e){report.errors.push('Native cleanup: '+e.message);}
 if(browser)try{await bounded(browser.close(),30000,'Browser cleanup');}catch(e){report.errors.push('Browser cleanup: '+e.message);}
 if(server.listening)try{await bounded(new Promise((yes,no)=>server.close(error=>error?no(error):yes())),10000,'Server cleanup');}catch(e){report.errors.push('Server cleanup: '+e.message);}
 report.finishedAt=new Date().toISOString();report.diagnosticCompleted=report.diagnosticCompleted&&report.errors.length===0;
 await checkpoint();
 console.log(JSON.stringify({diagnosticCompleted:report.diagnosticCompleted,phase:report.phase,completedFrames:report.observation?.completedFrames,timer:report.observation?.timer,errors:report.errors}));
 if(!report.diagnosticCompleted)process.exitCode=1;
}
