/** Full-scene native draw-layout diagnostic; never a release-performance gate. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {installPipelineCensus} from './pipeline-state-census.mjs';

const game=resolve(process.env.BELLE_CENSUS_GAME||resolve(import.meta.dirname,'..'));
const output=resolve(process.env.BELLE_CENSUS_OUTPUT||resolve(game,'output/pipeline-census'));
const seconds=Number(process.env.BELLE_CENSUS_SECONDS||45);
assert(Number.isInteger(seconds)&&seconds>=30&&seconds<=90,'Diagnostic window must be 30–90 seconds');
assert.equal(process.platform,'darwin','This diagnostic requires the native Mac/Metal runner');
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:180000});
const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
const viewport={width:1440,height:900};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(output,{recursive:true});
const report={version:1,sourceHead:process.env.GITHUB_SHA||null,product:process.env.PRODUCT_PARENT_SHA||null,
 scope:'Full current game, Desktop High, native onscreen Chrome/Metal, 1440×900 DPR 1. A bounded observer records actual GL draw state, including WEBGL_multi_draw. No scene reduction, altered GPU flag, injected pose or synthetic game frame. Observer overhead is included; this is NOT a performance acceptance run or a count of native Metal pipeline objects.',
 releasePerformanceVerified:false,requestedSeconds:seconds,viewport,quality:'high',runtime:{node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version},
 sources:{driver:sha256(await readFile(import.meta.filename)),observer:sha256(await readFile(resolve(import.meta.dirname,'pipeline-state-census.mjs'))),strict:sha256(await readFile(resolve(game,'scripts/sustained-ride-profile.mjs')))},
 actualGpu:null,input:null,profile:null,censusFile:null,errors:[],failedRequests:[],complete:false};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser,page,heartbeat=null,pendingHeartbeat=Promise.resolve(),holdingW=false;
const began=Date.now();
try{
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
 report.browserVersion=browser.version();
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});
 page.setDefaultTimeout(180000);await page.bringToFront();
 await page.addInitScript(installPipelineCensus);
 await page.addInitScript(()=>{
  localStorage.setItem('belle-graphics-v1',JSON.stringify({quality:'high',cap:60,antiAliasing:'automatic'}));
  const receipts={keydowns:0,keyups:0,repeats:0,blurs:0};window.__belleCensusInput=receipts;
  window.addEventListener('keydown',event=>{if(event.isTrusted&&event.code==='KeyW'){receipts.keydowns++;if(event.repeat)receipts.repeats++;}},true);
  window.addEventListener('keyup',event=>{if(event.isTrusted&&event.code==='KeyW')receipts.keyups++;},true);
  window.addEventListener('blur',()=>receipts.blurs++,true);
 });
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
 page.on('requestfailed',request=>report.failedRequests.push((request.failure()?.errorText||'failed')+' '+request.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1&locationPerf=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});
 report.welcomeReadyMs=Date.now()-began;
 report.actualGpu=await page.locator('#game').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Full game WebGL2 unavailable');
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION)),
   context:gl.getContextAttributes(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],defaultDrawFramebuffer:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),devicePixelRatio};
 });
 assert.match(report.actualGpu.renderer,/Metal/i);assert.doesNotMatch(report.actualGpu.renderer,/SwiftShader|llvmpipe|software rasterizer/i);
 assert.deepEqual(report.actualGpu.drawingBuffer,[1440,900]);assert.equal(report.actualGpu.devicePixelRatio,1);
 assert.equal(report.actualGpu.context.antialias,true);assert.equal(report.actualGpu.defaultDrawFramebuffer,true);assert.equal(report.actualGpu.samples,4);
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
 report.rideStartedMs=Date.now()-began;
 await page.locator('#location-perf > summary').click();
 const settings=async()=>{if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();};
 await settings();await expect(page.locator('#quality')).toHaveValue('high');
 await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
 const panel=page.locator('#ride-profile');await expect(panel).toBeAttached();await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Start 10-minute capture'}).click();
 await page.locator('[data-close="settings"]').click();await page.locator('#game').focus();
 // Collection opens after the menu transition; the game's original profiler
 // retains its own broader eligible window and finishes on trusted W release.
 await page.evaluate(()=>window.__bellePipelineCensus.start());
 await page.keyboard.down('w');holdingW=true;
 let reassertions=0,inFlight=false,heartbeatError=null;
 heartbeat=setInterval(()=>{if(inFlight)return;inFlight=true;pendingHeartbeat=page.keyboard.down('w').then(()=>reassertions++,error=>{heartbeatError=String(error);}).finally(()=>{inFlight=false;});},450);
 try{await page.waitForTimeout(seconds*1000);}finally{clearInterval(heartbeat);heartbeat=null;await pendingHeartbeat;await page.keyboard.up('w');holdingW=false;}
 report.input={...(await page.evaluate(()=>window.__belleCensusInput)),reassertions,heartbeatError};
 const census=await page.evaluate(()=>window.__bellePipelineCensus.stop());
 await writeFile(resolve(output,'draw-layout-census.json'),JSON.stringify(census,null,2)+'\n');report.censusFile='draw-layout-census.json';
 // A completed browser ride is not proof that the observer captured its work.
 // Retain bytes first, then reject incomplete or silently empty diagnostics.
 assert.equal(census.context?.status,'tracking');assert.equal(census.context.observedAtGetContextReturn,true);
 assert.equal(census.context.metadataDropped,0);assert.equal(census.active,false);
 assert(census.coverage.length>0&&census.coverage.every(row=>row.status==='installed'),'Every required observer hook must be installed');
 for(const key of ['observerErrors','foreignReceiverCalls','nativeThrows','sourceTruncations','objectLimitHits','contextLosses','contextRestores'])assert.equal(census.stats[key],0,'Invalid observer counter: '+key);
 for(const key of ['droppedFrames','droppedDraws','droppedSubdraws','dictionaryLimitHits','droppedIssues','thrownRequests'])assert.equal(census.totals[key],0,'Incomplete census: '+key);
 assert.equal(census.issues.length,0,'Uncovered renderer state or observer issues');
 assert(census.totals.requests>census.totals.extensionRequests&&census.totals.retainedDraws>0&&census.totals.extensionRequests>0,'Actual core and multi-draw requests must be observed');
 assert.equal(census.totals.returnedRequests,census.totals.requests);
 assert(census.frames.filter(frame=>frame.boundary==='requestAnimationFrame').length>=2&&census.layouts.length>0&&census.bindings.length>0&&census.states.length>0&&census.groups.length>0&&census.programs.length>0&&census.shaderSources.length>0,'Nonempty draw/program/layout evidence required');
 const programs=new Map(census.programs.map(program=>[program.id+':'+program.generation,program]));
 let retained=0;
 for(const frame of census.frames){
  assert.equal(frame.complete,true,'Incomplete sampled callback');assert.equal(frame.droppedDraws,0);
  assert.equal(frame.returnedRequests,frame.requests);assert.equal(frame.draws.length,frame.requests);
  for(const draw of frame.draws){
   retained++;assert.equal(draw.returned,true);assert.equal(draw.draw.complete,true);
   for(const [key,table]of [['layoutId','layouts'],['bindingId','bindings'],['stateId','states'],['groupId','groups']])assert(Number.isInteger(draw[key])&&draw[key]>=0&&draw[key]<census[table].length,'Missing '+key);
   const program=programs.get(draw.programId+':'+draw.generation);assert(program&&program.generation>0&&program.linked!==false,'Missing or failed program generation');
   assert(program.stages.length>=2&&program.stages.every(stage=>Number.isInteger(stage.sourceId)&&census.shaderSources[stage.sourceId]&&!census.shaderSources[stage.sourceId].truncated),'Missing complete submitted shader source');
   assert(census.layouts[draw.layoutId].uncertainty.every(reason=>reason.startsWith('native-conversion-or-short-buffer:')),'Active attribute inventory or locations missing');
  }
 }
 assert.equal(retained,census.totals.retainedDraws);
 report.coverageAccepted=true;
 await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
 await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
 report.profile=JSON.parse(await panel.locator('textarea').inputValue());
 assert.equal(report.profile.stopReason,'trusted-W-keyup');
 assert(report.profile.frames>=8&&report.profile.movingSeconds>=5&&report.profile.distanceMetres>=3,'Actual full-scene moving ride must be captured');
 assert(report.input.keydowns>=1&&report.input.keyups>=1&&!heartbeatError,'Genuine keyboard input must be delivered');
 await page.locator('[data-close="settings"]').click();
 await page.screenshot({path:resolve(output,'riding-end.png'),timeout:180000});
 assert.equal(report.errors.length,0,'Application/browser errors retained');assert.equal(report.failedRequests.length,0,'Failed asset requests retained');
 report.complete=true;
}catch(error){
 report.errors.push(String(error?.stack||error));
 if(page){
  const census=await page.evaluate(()=>window.__bellePipelineCensus?.snapshot?.()??null).catch(()=>null);
  if(census){await writeFile(resolve(output,'draw-layout-census-at-failure.json'),JSON.stringify(census,null,2)+'\n');report.censusFile='draw-layout-census-at-failure.json';}
  await page.screenshot({path:resolve(output,'failure.png'),timeout:10000}).catch(()=>{});
 }
}finally{
 if(heartbeat)clearInterval(heartbeat);await pendingHeartbeat.catch(()=>{});
 if(holdingW&&page)await page.keyboard.up('w').catch(()=>{});
 report.elapsedWallMs=Date.now()-began;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close().catch(()=>{});await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify({complete:report.complete,source:report.sourceHead,product:report.product,censusFile:report.censusFile,frames:report.profile?.frames,p95:report.profile?.metrics?.frameMs?.p95,stallsOver250:report.profile?.over250ms,errors:report.errors.slice(0,3),releasePerformanceVerified:false}));
if(!report.complete)process.exitCode=1;
