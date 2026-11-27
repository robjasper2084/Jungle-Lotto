/** Native arrival and read-only observations only. Does not execute an exterior route. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {CASE_MS,CaseBudget,cleanupWithin} from './budget.mjs';
import {PIN,GAME,SITES,SCOPE,assertPins,verifyInputs,isGameUrl,assertSnapshot,assertObservation,assertGraphics,assertNativeEvidence,assertConsumedResponses} from './contract.mjs';
import {collectConstructorGrid} from './grid-capture.mjs';
import {writeRaw,sha256,rawJson} from './evidence.mjs';

/** Only this separate evidence object is written; application state is observed. */
export function installNativeObserver(){
 const held=new Set(),e=window.__belleViewPreflightEvidence={phase:'boot',events:[],traces:{},overflow:false,focusLossDuringInput:[],held:[]};
 for(const type of ['click','keydown','keyup','pointerdown','pointerup','pointermove'])document.addEventListener(type,event=>{
  if(type==='keydown')held.add(event.code);if(type==='keyup')held.delete(event.code);e.held=[...held];
  const element=event.target,button=element?.closest?.('button');
  if(e.events.length>=10000){e.overflow=true;return;}
  e.events.push({type,trusted:event.isTrusted,code:event.code||null,target:button?.id?'#'+button.id:element?.id?'#'+element.id:element?.tagName,
   text:button?.textContent?.trim()||null,landmark:button?.closest('article.landmark')?.querySelector('h3')?.textContent?.trim()||null,phase:e.phase,at:performance.now()});
 },true);
 const lost=reason=>{if(held.size)e.focusLossDuringInput.push({reason,phase:e.phase,keys:[...held],at:performance.now()});};
 addEventListener('blur',()=>lost('window blur'));document.addEventListener('visibilitychange',()=>{if(document.hidden)lost('document hidden');});
}

export async function run(){
 assertPins();assert.equal(process.platform,'darwin','The native view preflight requires macOS Metal');
 const layout=process.env.PREFLIGHT_LAYOUT;assert(['desktop','phone'].includes(layout),'A fixed original layout is required');
 const checkout=resolve(process.env.PREFLIGHT_APP_DIR),game=resolve(checkout,GAME),evidence=resolve(process.env.PREFLIGHT_EVIDENCE),out=resolve(evidence,'capture');
 const viewport=layout==='phone'?{width:390,height:844}:{width:1280,height:800};await mkdir(out,{recursive:true});
 const budget=new CaseBudget(),wallStarted=Date.now(),ownedKeys=new Set(),pendingResponses=new Set();
 const report={version:1,...SCOPE,collectionComplete:false,source:PIN.head,sourceTree:PIN.tree,diagnosticHead:process.env.DIAGNOSTIC_EXPECTED_HEAD,
  runId:process.env.GITHUB_RUN_ID,startedAt:new Date(wallStarted).toISOString(),caseBudgetMs:CASE_MS,layout,viewport,deviceScaleFactor:1,
  contextOptions:{viewport,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'},launchOptions:{channel:'chrome',headless:false,args:['--use-angle=metal']},
  phase:'setup',rawFiles:[],sites:[],readCalls:[],consumedResponses:[],errors:[],failedRequests:[],
  limitations:'Ten-minute diagnostic collection only. Public Guide arrival, native F/V, original normal graphics and terrain query envelopes. No route search, route execution, directed route sweeps, view images, collision acceptance, performance acceptance or original 32-minute route deadline acceptance. Observations do not certify future LOD silhouettes or unobstructed PNGs.'};
 let input,browser,context,page,server,caseTimer,exerciseComplete=false;
 const record=async(file,value)=>{const receipt=await writeRaw(out,file,value);report.rawFiles.push(receipt);return receipt;};
 const step=(name,operation,maximum)=>budget.run(name,operation,maximum);
 const phase=async name=>{budget.check();report.phase=name;console.log(new Date().toISOString()+' view-preflight '+layout+' '+name);if(page)await step('Evidence phase',()=>page.evaluate(value=>{window.__belleViewPreflightEvidence.phase=value;},name));};
 const observe=async(method,id)=>{
  assert(['snapshot','motion','exterior','viewObstructions'].includes(method));budget.check();
  const call={method,id:id??null,phase:report.phase,startedMs:budget.elapsed(),complete:false};report.readCalls.push(call);
  try{const value=await step('Read '+method,()=>page.evaluate(({method,id})=>window.__stagedLandmarkProof[method](id),{method,id}));call.complete=true;return value;}
  catch(error){call.error=String(error);throw error;}finally{call.elapsedMs=budget.elapsed()-call.startedMs;}
 };
 const motion=()=>observe('motion');
 const graphics=()=>step('Read normal graphics',()=>page.evaluate(()=>({quality:document.querySelector('#quality')?.value,fps:document.querySelector('#fps')?.value,antiAliasing:document.querySelector('#anti-aliasing')?.value})));
 const keyDown=async key=>{assert(['f','v'].includes(key),'Preflight only permits native F/V');budget.check();ownedKeys.add(key);await step('Native '+key+' down',()=>page.keyboard.down(key));};
 const keyUp=async key=>{try{await page.keyboard.up(key);}finally{ownedKeys.delete(key);}};
 const press=async key=>{try{await keyDown(key);}finally{if(ownedKeys.has(key))await keyUp(key);}budget.check();};
 const releaseOwned=async()=>{const failures=[];for(const key of [...ownedKeys])try{await keyUp(key);}catch(error){failures.push(String(error));}assert.deepEqual(failures,[],'Native key cleanup failed');};
 const focusCanvas=async()=>{await step('Focus original canvas',timeout=>page.locator('#game').click({position:{x:viewport.width*.58,y:viewport.height*.55},timeout}));await step('Verify original focus',timeout=>expect(page.locator('#game')).toBeFocused({timeout}));};
 let expect;
 async function waitMotion(rule,maximum=180000){
  assert(['frames','on-foot','settled'].includes(rule.type),'Preflight cannot follow a target, route, or turn');
  const handle=await step('Original motion settle',timeout=>page.waitForFunction(({rule,phase})=>{
   const api=window.__stagedLandmarkProof,e=window.__belleViewPreflightEvidence;if(!api||!api.frame())return false;
   const row=api.motion();if(!row.actor)return false;const trace=e.traces[phase]??=[];
   if(!trace.length||trace.at(-1).frames!==row.frames){if(trace.length>=4096){e.overflow=true;throw Error('Movement trace overflow');}trace.push(row);}
   if(rule.type==='frames')return row.frames>=rule.target?row:false;
   if(rule.type==='on-foot')return row.actor.onFoot&&row.actor.footBlend>.99?row:false;
   if(!row.actor.onFoot)throw Error('The native preflight changed out of on-foot mode');
   if(rule.type==='settled'){
    if(trace.length<4)return false;const tail=trace.slice(-4),first=tail[0];
    return row.frames-first.frames>=3&&tail.every(s=>Math.hypot(s.actor.x-first.actor.x,s.actor.z-first.actor.z)<.015)?row:false;
   }
   throw Error('Unknown original motion rule');
  },{rule,phase:report.phase},{polling:100,timeout}),maximum);
  try{return await step('Read original motion result',()=>handle.jsonValue());}finally{await handle.dispose();}
 }
 const frames=async count=>{const before=await motion();return waitMotion({type:'frames',target:before.frames+count});};
 async function guideAction(site){
  await phase('guide-'+site.id+'-'+site.action.toLowerCase().replaceAll(' ','-'));
  if(!await step('Read public Guide opener',()=>page.locator('#map-open').isVisible()))await step('Open public tools',timeout=>page.locator('#tools-toggle').click({timeout}));
  await step('Open public Guide',timeout=>page.locator('#map-open').click({timeout}));await step('Wait for public Guide',timeout=>expect(page.locator('#guide')).toBeVisible({timeout}));
  const card=page.locator('#guide article.landmark').filter({has:page.getByRole('heading',{name:site.title,exact:true})});
  assert.equal(await step('Read original landmark card',()=>card.count()),1,'Expected one public landmark card');
  await step('Use original public arrival',timeout=>card.getByRole('button',{name:site.action,exact:true}).click({timeout}));
  await step('Wait for public Guide close',timeout=>expect(page.locator('#guide')).not.toBeVisible({timeout}));await focusCanvas();await frames(3);
 }
 async function dismount(site){
  await phase('dismount-'+site.id);await focusCanvas();assert.equal((await motion()).actor.onFoot,false,'Public travel must start from the normal mounted state');
  await press('f');await waitMotion({type:'on-foot'});await frames(3);
  await phase('first-person-'+site.id);const before=await motion(),receipt={phase:report.phase,before,changed:before.actor.firstPerson!==true,after:null};
  if(receipt.changed){await focusCanvas();await press('v');await frames(2);}
  await step('Verify native first-person button',timeout=>expect(page.locator('#view')).toHaveAttribute('aria-pressed','true',{timeout}));
  receipt.after=await motion();assert.equal(receipt.after.actor.firstPerson,true,'Actual camera did not follow native V');return receipt;
 }
 async function settle(site){await phase('settle-'+site.id);return waitMotion({type:'settled'});}
 async function flushResponses(){while(pendingResponses.size){budget.check();await step('Retain consumed script bytes',()=>Promise.all([...pendingResponses]),10000);}}
 async function exercise(){
  input=await step('Verify immutable source and build',()=>verifyInputs(checkout,evidence));report.inputs=await record('inputs-before.json',input);
  const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:baseExpect}=require('@playwright/test');expect=baseExpect.configure({timeout:90000});
  const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
  const {createExteriorPlanner}=await import(pathToFileURL(resolve(game,'scripts/staged-landmark-exterior-proof.mjs')).href);
  server=createCoopStaticServer(resolve(game,'dist'));await step('Start immutable static server',()=>new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);}));
  browser=await step('Launch original native Metal context',timeout=>chromium.launch({...report.launchOptions,timeout}));report.browser=browser.version();
  context=await step('Create original viewport context',()=>browser.newContext(report.contextOptions));await step('Install read-only native observer',()=>context.addInitScript(installNativeObserver));
  page=await step('Create native page',()=>context.newPage());page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{
   if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());
   const type=response.request().resourceType();if(!['document','script'].includes(type)&&!new URL(response.url()).pathname.endsWith('.js'))return;
   const task=(async()=>{const bytes=await response.body();report.consumedResponses.push({url:response.url(),type,status:response.status(),fromServiceWorker:response.fromServiceWorker(),bytes:bytes.length,sha256:sha256(bytes)});})().catch(error=>{report.errors.push('Consumed response: '+String(error));});
   pendingResponses.add(task);task.finally(()=>pendingResponses.delete(task));
  });
  const url='http://127.0.0.1:'+server.address().port+'/?stagedArchitectureProof=1&profile=1';assert(isGameUrl(url));report.url=url;
  await step('Load original staged game',timeout=>page.goto(url,{waitUntil:'domcontentloaded',timeout}),30000);
  await step('Wait for original ready state',timeout=>page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout}),180000);
  await step('Verify original ready state',timeout=>expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout}));await step('Native start click',timeout=>page.locator('#start').click({timeout}));
  await step('Verify start transition',timeout=>expect(page.locator('body')).not.toHaveClass(/at-start/,{timeout}));
  await step('Wait for real staged frames',timeout=>page.waitForFunction(()=>window.__stagedLandmarkProof?.frame()>0,null,{timeout}),180000);
  report.initialGraphics=await graphics();assertGraphics(report.initialGraphics);
  report.actualContext=await step('Read actual renderer and viewport',()=>page.evaluate(()=>{
   const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');if(!gl)throw Error('Missing real WebGL2 game context');
   const debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,canvasWidth:canvas.width,canvasHeight:canvas.height,url:location.href};
  }));
  assert.match(report.actualContext.renderer,/Metal/i);assert.doesNotMatch(report.actualContext.renderer,/SwiftShader|llvmpipe|software rasterizer/i);
  assert.equal(report.actualContext.width,viewport.width);assert.equal(report.actualContext.height,viewport.height);assert.equal(report.actualContext.deviceScaleFactor,1);assert.equal(report.actualContext.url,url);
  for(const site of SITES){
   const row={id:site.id,label:site.label,guideAction:site.action,complete:false,viewObservationCalls:0,grid:null};report.sites.push(row);
   await guideAction(site);row.nativeFirstPerson=await dismount(site);row.settled=await settle(site);await phase('observe-'+site.id);
   const observation={id:site.id,before:null,graphicsBefore:null,exterior:null,viewObstructions:null,atomicFrameBefore:null,atomicFrameAfter:null,readResults:[],error:null};
   try{
    observation.graphicsBefore=await graphics();assert.deepEqual(observation.graphicsBefore,report.initialGraphics);row.viewObservationCalls++;
    // All three synchronous read-only methods see the same real camera frame.
    // Preserve partial observations if a later bounded method throws.
    const atomic=await step('Atomic original view observation',()=>page.evaluate(id=>{
     const api=window.__stagedLandmarkProof,result={before:null,exterior:null,viewObstructions:null,atomicFrameBefore:api.frame(),atomicFrameAfter:null,readResults:[],error:null};
     for(const [method,key]of[['snapshot','before'],['exterior','exterior'],['viewObstructions','viewObstructions']]){
      const read={method,id:method==='snapshot'?null:id,complete:false,startedPageMs:performance.now()};result.readResults.push(read);
      try{result[key]=api[method](method==='snapshot'?undefined:id);read.complete=true;}
      catch(error){result.error=String(error?.stack||error);read.error=result.error;break;}
      finally{read.elapsedMs=performance.now()-read.startedPageMs;}
     }
     result.atomicFrameAfter=api.frame();return result;
    },site.id));
    Object.assign(observation,atomic);report.readCalls.push(...atomic.readResults.map(read=>({...read,phase:report.phase,atomic:true})));
    row.observation=await record(site.label+'/observation.json',observation);assert.equal(observation.error,null,'Original bounded view observation failed');
    assert.equal(observation.atomicFrameAfter,observation.atomicFrameBefore,'Atomic observation crossed a rendered frame');assert.equal(observation.before?.frames,observation.atomicFrameBefore);
    assertSnapshot(observation.before,site.id);assert(observation.exterior?.ready&&observation.exterior.id===site.id,'Original exterior is not ready');assertObservation(observation.viewObstructions,site.id,observation.exterior);
   }catch(error){observation.error=String(error?.stack||error);if(!row.observation)row.observation=await record(site.label+'/observation.json',observation);throw error;}
   await phase('original-grid-'+site.id);
   row.grid=await collectConstructorGrid({createExteriorPlanner,bounds:observation.exterior.bounds,camera:observation.exterior.camera,layout,
    checkBudget:()=>budget.check(),queryGround:points=>step('Original bounded ground batch',()=>page.evaluate(points=>window.__stagedLandmarkProof.routeGround(points),points)),
    record:batch=>record(site.label+'/grid-'+String(batch.index).padStart(3,'0')+'.json',batch)});
   await phase('after-'+site.id);const after={snapshot:await observe('snapshot'),graphics:await graphics()};row.after=await record(site.label+'/after.json',after);
   assertSnapshot(after.snapshot,site.id);assert.deepEqual(after.graphics,observation.graphicsBefore,'Read-only collection changed normal graphics');
   assert(Math.hypot(after.snapshot.actor.x-observation.before.actor.x,after.snapshot.actor.y-observation.before.actor.y,after.snapshot.actor.z-observation.before.actor.z)<.1,'Actor moved while collecting read-only observations');
   row.complete=true;
  }
  await phase('complete');report.finalGraphics=await graphics();assert.deepEqual(report.finalGraphics,report.initialGraphics);await flushResponses();
  report.nativeEvidence=await step('Read native evidence',()=>page.evaluate(()=>window.__belleViewPreflightEvidence));assertNativeEvidence(report.nativeEvidence,report.sites);
  assertConsumedResponses(report.consumedResponses,input,report.url);assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);budget.check();exerciseComplete=true;
 }
 try{await Promise.race([exercise(),new Promise((_,reject)=>{caseTimer=setTimeout(()=>{budget.stop();reject(Error('View preflight exceeded its independent ten-minute case budget'));},budget.remaining());})]);}
 catch(error){report.errors.push(String(error?.stack||error));}
 finally{
  clearTimeout(caseTimer);report.caseElapsedMs=budget.elapsed();budget.stop();
  report.cleanup=await cleanupWithin([
   {name:'native key release',maximumMs:8000,run:releaseOwned},
   {name:'final raw native evidence',maximumMs:5000,run:async()=>{if(page)report.nativeEvidence=await page.evaluate(()=>window.__belleViewPreflightEvidence);}},
   {name:'pending consumed bytes',maximumMs:5000,run:()=>Promise.all([...pendingResponses])},
   {name:'browser close',maximumMs:10000,run:async()=>{await browser?.close();}},
   {name:'static server close',maximumMs:2000,run:async()=>{if(server){server.closeAllConnections();await new Promise(yes=>server.close(()=>yes()));}}}
  ]);
  if(!report.cleanup.complete)report.errors.push('Bounded cleanup was incomplete; inspect every cleanup receipt');
  if(report.nativeEvidence)try{assertNativeEvidence(report.nativeEvidence,report.sites);}catch(error){report.errors.push(String(error));}
  if(input)try{assertConsumedResponses(report.consumedResponses,input,report.url);}catch(error){report.errors.push(String(error));}
  report.collectionComplete=exerciseComplete&&report.caseElapsedMs<CASE_MS&&report.cleanup.complete&&!report.errors.length&&!report.failedRequests.length;
  report.finishedAt=new Date().toISOString();report.elapsedWallMs=Date.now()-wallStarted;await writeFile(resolve(out,'report.json'),rawJson(report,true),{flag:'wx'});
 }
 console.log(JSON.stringify({diagnosticOnly:true,collectionComplete:report.collectionComplete,layout,source:PIN.head,phase:report.phase,sites:report.sites.length,caseElapsedMs:report.caseElapsedMs,errors:report.errors.slice(0,3)}));
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const report=await run();process.exit(report.collectionComplete?0:1);}
