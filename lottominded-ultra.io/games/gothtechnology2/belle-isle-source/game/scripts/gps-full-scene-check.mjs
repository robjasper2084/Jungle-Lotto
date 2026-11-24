/** Full-game GPS regression, never device GPS.
 * Native browser integration/error checks and isolated deterministic sensor-contract
 * timing are distinct evidence. Neither path replaces game pose, renderer or clock.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {installGpsSensorContract} from './gps-sensor-contract.mjs';

const reportKeys=['version','outcome','reason','requestedSeconds','wallDurationMs','renderedFrames','renderedFramesPerSecond','firstFrameWaitMs','tailWithoutFrameMs','frameIntervalsMs','sceneRenderCpuMs','invalidCpuSamples','stalls','locationFrames','atStart','atEnd','note'];
const metadataKeys=['viewport','targetFrameCap','reducedMotion','locationState'];
const distributionKeys=['count','meanMs','p50Ms','p95Ms','p99Ms','maxMs'];
function keys(value,expected,label){assert(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');assert.deepEqual(Object.keys(value).sort(),[...expected].sort(),label+' must contain only the coordinate-free schema');}
function distribution(value,count,label){
 keys(value,distributionKeys,label);assert.equal(value.count,count);
 for(const key of distributionKeys)assert(Number.isFinite(value[key])&&value[key]>=0,label+'.'+key+' must be finite');
 assert(value.p50Ms<=value.p95Ms&&value.p95Ms<=value.p99Ms&&value.p99Ms<=value.maxMs,label+' percentile ordering');
}
/** Reject added location/identifier fields rather than silently exporting them. */
export function validateGpsTimingReport(value,state){
 keys(value,reportKeys,'timing report');assert.equal(value.version,1);assert.equal(value.outcome,'complete','Capture incomplete: '+value.outcome+' / '+value.reason);assert.equal(value.reason,'duration');
 assert.equal(value.requestedSeconds,30);assert.equal(value.wallDurationMs,30000);
 assert(Number.isSafeInteger(value.renderedFrames)&&value.renderedFrames>=8,'At least eight actual scene submissions are required');
 assert.equal(value.renderedFramesPerSecond,value.renderedFrames/30);assert.equal(value.invalidCpuSamples,0);
 assert(Number.isFinite(value.firstFrameWaitMs)&&value.firstFrameWaitMs>=0&&value.firstFrameWaitMs<=30000);
 assert(Number.isFinite(value.tailWithoutFrameMs)&&value.tailWithoutFrameMs>=0&&value.tailWithoutFrameMs<=30000);
 distribution(value.frameIntervalsMs,value.renderedFrames-1,'frame intervals');distribution(value.sceneRenderCpuMs,value.renderedFrames,'scene CPU');
 keys(value.stalls,['over50Ms','over100Ms','over250Ms','over1000Ms'],'stalls');
 for(const count of Object.values(value.stalls))assert(Number.isSafeInteger(count)&&count>=0&&count<value.renderedFrames);
 keys(value.locationFrames,[state],'location states');assert.equal(value.locationFrames[state],value.renderedFrames);
 for(const name of ['atStart','atEnd']){
  keys(value[name],metadataKeys,name);keys(value[name].viewport,['width','height','devicePixelRatio','renderPixelRatio'],name+'.viewport');
  assert.equal(value[name].locationState,state);assert.equal(typeof value[name].reducedMotion,'boolean');
  assert(Number.isFinite(value[name].targetFrameCap)&&value[name].targetFrameCap>0);
  for(const number of Object.values(value[name].viewport))assert(Number.isFinite(number)&&number>0);
 }
 assert.deepEqual(value.atStart,value.atEnd,'Capture settings and state must remain constant');assert.equal(typeof value.note,'string');
 // Reports must not gain a timestamp/coordinate hidden in a free-text field.
 assert(!/\b-?\d{1,3}\.\d{4,}\b|\d{4}-\d{2}-\d{2}T/.test(value.note),'Timing note must not contain coordinate-like values or absolute timestamps');
 return value;
}

async function syntheticSpawn(game){
 const map=JSON.parse(await readFile(resolve(game,'dist/belle/map.json'),'utf8'));
 assert.equal(map.axes,'x east, y up, z south; metres; river 0 m, island 2 m');
 assert.deepEqual(map.origin,[-83.00175,42.34680]);assert.equal(map.spawn.x,0);assert.equal(map.spawn.z,0);
 const scale=111320,[lon,lat]=map.origin;
 return {latitude:lat-map.spawn.z/scale,longitude:lon+map.spawn.x/(scale*Math.cos(lat*Math.PI/180)),accuracy:5};
}

/** This path keeps navigator.geolocation native. Chrome's unavailable override
 * is deliberate here: recovery must not silently restart avatar following.
 */
async function checkNativeBrowserLocation({page,expect,output,synthetic,openSettings}){
 expect=expect.configure({timeout:30000});
 const context=page.context(),origin=new URL(page.url()).origin,tokens=[String(synthetic.latitude),String(synthetic.longitude)];
 const result={source:'native-browser-geolocation-emulation',syntheticSensors:true,physicalDeviceCertified:false,passed:false,checks:{},states:[],captures:[],errors:[],cleanupErrors:[],privacy:{networkCoordinateMatches:0,networkObserved:false,storageCoordinateMatches:null,storageChecked:false}};
 const dialog=page.locator('#real-location');
 const requestObserver=request=>{const text=request.url()+'\n'+(request.postData()||'');if(tokens.some(token=>text.includes(token)))result.privacy.networkCoordinateMatches++;};
 const state=async phase=>result.states.push({phase,...await page.evaluate(()=>{const value=document.querySelector('#real-location')?.getAttribute('data-location-status');return {status:['off','requesting','tracking','unavailable','stale','denied','timeout','poor-accuracy','outside-map','paused','jump-rejected'].includes(value)?value:'unrecognized',following:document.body.classList.contains('location-following')};})});
 const capture=async name=>{const file='gps-native-'+name+'.png';await page.screenshot({path:resolve(output,file),timeout:90000});result.captures.push(file);};
 const open=async()=>{
  if(await dialog.isVisible())return;
  if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#ride-menu .real-location-open').click();await expect(dialog).toBeVisible();
 };
 const close=async()=>{
  if(await dialog.isVisible())await page.getByRole('button',{name:'Close real location settings',exact:true}).click();
  if(await page.locator('#ride-menu').isVisible())await page.locator('#ride-menu [data-close="ride-menu"]').click();
 };
 let mapCanvas;
 const pixels=async()=>mapCanvas.evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(Math.abs(data[i]-101)<=3&&Math.abs(data[i+1]-232)<=3&&data[i+2]>=252&&data[i+3]>=200)count++;return count;});
 try{
  assert(await page.evaluate(()=>isSecureContext&&!!navigator.geolocation&&!Object.hasOwn(globalThis,'__belleGpsSensorContract')),'Native browser GPS path must not contain the sensor contract fixture');
  const qa=page.locator('#location-perf');if(await qa.evaluate(element=>element.open))await qa.locator(':scope > summary').click();
  await openSettings();await page.locator('#restart').click();await expect(page.locator('#settings')).not.toBeVisible();
  if((await page.locator('#ride-mode').innerText()).trim()!=='ON FOOT')await page.locator('#mount').click();
  await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');
  const reference=page.locator('#reference-hud .reference-map canvas');mapCanvas=await reference.isVisible()?reference:page.locator('#minimap');
  await expect(mapCanvas).toBeVisible();const before=await pixels();
  await open();await expect(dialog).toHaveAttribute('data-location-status','off');await state('off');
  // Configure a synthetic native provider before granting any permission.
  await context.setGeolocation(synthetic);await context.grantPermissions(['geolocation'],{origin});
  page.on('request',requestObserver);result.privacy.networkObserved=true;
  await page.locator('#real-location-start').click();await expect(dialog).toHaveAttribute('data-location-status','tracking');
  await expect(page.locator('#real-location-accuracy')).toContainText('±5 m');await state('initial-fix');
  await close();await expect.poll(pixels).toBeGreaterThan(before+4);result.checks.nativeFixDrawsOnActualMap=true;
  await open();await page.locator('#real-location-follow').click();await expect(page.locator('body')).toHaveClass(/location-following/);
  await expect(page.locator('#real-location-strip')).toContainText('GPS follow');await state('initial-follow');
  // An empty override explicitly means unavailable; it does not clear the
  // override or fall through to the runner's real provider.
  await context.setGeolocation(null);await expect(dialog).toHaveAttribute('data-location-status','unavailable');
  await expect(page.locator('body')).not.toHaveClass(/location-following/);await expect(page.locator('#mount')).toBeEnabled();
  await state('provider-unavailable');await capture('unavailable');result.checks.unavailableStopsFollow=true;
  await context.setGeolocation(synthetic);await expect(dialog).toHaveAttribute('data-location-status','tracking');
  await expect(page.locator('body')).not.toHaveClass(/location-following/);await expect(page.locator('#real-location-strip')).toContainText('GPS on');
  await state('recovered-marker-only');result.checks.recoveryDoesNotAutoFollow=true;
  await open();await page.locator('#real-location-follow').click();await expect(page.locator('body')).toHaveClass(/location-following/);
  await state('manual-follow-after-recovery');result.checks.manualFollowAfterRecovery=true;
  await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).click();
  await expect(dialog).toHaveAttribute('data-location-status','off');await expect(page.locator('body')).not.toHaveClass(/location-following/);
  await expect(page.locator('#real-location-strip')).toBeHidden();await expect(page.locator('#mount')).toBeEnabled();
  await expect.poll(pixels).toBeLessThanOrEqual(before);await state('stopped');result.checks.stopClearsMarkerAndRestoresControls=true;
  result.privacy.storageCoordinateMatches=await page.evaluate(tokens=>[localStorage,sessionStorage].reduce((count,storage)=>{for(let i=0;i<storage.length;i++)if(tokens.some(token=>(storage.getItem(storage.key(i))||'').includes(token)))count++;return count;},0),tokens);
  result.privacy.storageChecked=true;assert.equal(result.privacy.networkCoordinateMatches,0);assert.equal(result.privacy.storageCoordinateMatches,0);
  await capture('stopped');result.passed=true;
 }catch(error){result.errors.push(String(error?.stack||error));try{await state('failure');await capture('failure');}catch(captureError){result.errors.push(String(captureError));}}
 finally{
  page.off('request',requestObserver);
  try{const stop=page.getByRole('button',{name:'Stop real location and clear position',exact:true});if(await stop.isVisible())await stop.click({timeout:5000});}catch(error){result.cleanupErrors.push(String(error));}
  try{await context.setGeolocation(null);await context.clearPermissions();}catch(error){result.cleanupErrors.push(String(error));}
  if(result.cleanupErrors.length)result.passed=false;
  await writeFile(resolve(output,'gps-native-browser.json'),JSON.stringify(result,null,2)+'\n');
 }
 return result;
}

/** Preserve the caller's original riding result. The second context contains
 * the unchanged built game and a test-only sensor source, never a production hook.
 */
export async function checkGpsFullScene(options){
 const {page,expect,game,output,device,renderBackend,actualGpu}=options;
 const sourceUrl=page.url(),viewport=page.viewportSize(),browser=page.context().browser();
 const synthetic=await syntheticSpawn(game);
 const expectedSettings={quality:await page.locator('#quality').inputValue(),cap:await page.locator('#fps').inputValue(),reducedMotion:await page.locator('#motion').isChecked(),hudPreset:await page.locator('body').getAttribute('data-hud-preset'),focusHud:/\bbelle-hud-focus\b/.test(await page.locator('body').getAttribute('class')||'')};
 const nativeBrowserChecks=await checkNativeBrowserLocation({...options,synthetic});
 let context,freshPage,contract,disposal,originalContextReleased=false,setupStage='release-original',setupFailure=null;const errors=[],failedRequests=[],cleanupErrors=[],setupCaptures=[];
 const tokens=[String(synthetic.latitude),String(synthetic.longitude)];
 const redact=value=>tokens.reduce((text,token)=>text.split(token).join('[synthetic coordinate]'),String(value));
 const pageError=error=>errors.push(redact(error.message));
 const consoleError=message=>{if(message.type()==='error')errors.push(redact(message.text()));};
 const responseError=response=>{if(response.status()>=400)errors.push('HTTP '+response.status()+' '+redact(response.url()));};
 const requestError=request=>failedRequests.push(redact((request.failure()?.errorText||'failed')+' '+request.url()));
 try{
  // The caller retires its exact observation handlers after the native path
  // finishes, then releases the original island. No second GPU scene may load
  // if that release fails; prior gameplay errors remain in the caller's report.
  try{assert.equal(typeof options.releaseSourceContext,'function');await options.releaseSourceContext();originalContextReleased=true;}
  catch(error){cleanupErrors.push('Original scene context release: '+redact(error));throw Error('Original island was not released before isolated fixture startup');}
  // The native override remains synthetic even if the contract installation
  // fails. No permissions are granted in this isolated context.
  setupStage='create-isolated-context';context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:expectedSettings.reducedMotion?'reduce':'no-preference',geolocation:synthetic,permissions:[]});
  freshPage=await context.newPage();freshPage.setDefaultTimeout(180000);
  await freshPage.addInitScript(installGpsSensorContract,{origin:new URL(sourceUrl).origin,position:synthetic,intervalMs:2000});
  // Match the profiler's boot preferences so its real startup warms the same
  // shaders. These preferences are subsequently verified through Settings UI.
  await freshPage.addInitScript(({quality,cap})=>localStorage.setItem('belle-graphics-v1',JSON.stringify({quality,cap:Number(cap),antiAliasing:'automatic'})),expectedSettings);
  freshPage.on('pageerror',pageError);freshPage.on('console',consoleError);freshPage.on('response',responseError);freshPage.on('requestfailed',requestError);
  setupStage='normal-game-readiness';await freshPage.bringToFront();await freshPage.goto(sourceUrl,{waitUntil:'domcontentloaded'});
  await freshPage.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
  await expect(freshPage.locator('#welcome')).toHaveAttribute('data-state','ready');
  const fixtureReady=await freshPage.evaluate(()=>globalThis.__belleGpsSensorContract?.snapshot());
  assert(fixtureReady?.source==='deterministic-watch-contract'&&fixtureReady.activeWatches===0&&!fixtureReady.timerActive,'Fresh context must contain an idle, isolated sensor contract');
  const freshGpu=await freshPage.locator('#game').evaluate(canvas=>{const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Fresh game WebGL2 unavailable');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION))};});
  assert.equal(freshGpu.renderer,actualGpu.renderer,'The deterministic capture must use the same actual GPU backend');
  setupStage='normal-ride-start';await freshPage.locator('.cinema-ride-picker > summary').click();await freshPage.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await freshPage.getByRole('button',{name:'Use this ride',exact:true}).click();await freshPage.locator('#start').click();
  await expect(freshPage.locator('body')).not.toHaveClass(/at-start/);
  const timingPanel=freshPage.locator('#location-perf');if(await timingPanel.evaluate(element=>element.open))await timingPanel.locator(':scope > summary').click();
  const openSettings=async()=>{if(!await freshPage.locator('#ride-menu').isVisible())await freshPage.locator('#tools-toggle').click();await freshPage.locator('#settings-open').click();await expect(freshPage.locator('#settings')).toBeVisible();};
  setupStage='verify-settings';await openSettings();await expect(freshPage.locator('#quality')).toHaveValue(expectedSettings.quality);await expect(freshPage.locator('#fps')).toHaveValue(expectedSettings.cap);
  assert.equal(await freshPage.locator('#motion').isChecked(),expectedSettings.reducedMotion);await freshPage.locator('[data-close="settings"]').click();
  setupStage='full-scene-contract';contract=await checkGpsContractScene({page:freshPage,expect,game,output,device,renderBackend,actualGpu:freshGpu,openSettings,expectedSettings});
 }catch(error){
  errors.push(redact(error?.stack||error));setupFailure={stage:setupStage,ui:null};
  if(freshPage){
   let deadline;
   try{setupFailure.ui=await Promise.race([freshPage.evaluate(()=>{const value=document.querySelector('#welcome')?.getAttribute('data-state');return {visibility:document.visibilityState,focused:document.hasFocus(),welcome:['loading','ready','error'].includes(value)?value:'unrecognized',atStart:document.body.classList.contains('at-start'),sensorContractInstalled:Object.hasOwn(globalThis,'__belleGpsSensorContract'),following:document.body.classList.contains('location-following')};}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Fresh setup UI diagnostic timed out')),5000);})]);}
   catch(diagnosticError){errors.push('Fresh setup diagnostic: '+redact(diagnosticError));}finally{if(deadline)clearTimeout(deadline);}
   try{const file='gps-contract-setup-failure.png';await freshPage.screenshot({path:resolve(output,file),timeout:15000});setupCaptures.push(file);}
   catch(captureError){errors.push('Fresh setup screenshot: '+redact(captureError));}
  }
 }
 finally{
  if(freshPage){
   try{const stop=freshPage.getByRole('button',{name:'Stop real location and clear position',exact:true});if(await stop.isVisible())await stop.click({timeout:5000});}catch(error){cleanupErrors.push('Fixture UI stop: '+redact(error));}
   try{disposal=await freshPage.evaluate(()=>{const fixture=globalThis.__belleGpsSensorContract;if(!fixture)throw Error('Sensor contract missing during cleanup');return fixture.dispose();});assert.equal(disposal.activeWatches,0);assert.equal(disposal.timerActive,false);assert.equal(disposal.restored,true);}catch(error){cleanupErrors.push('Fixture disposal: '+redact(error));}
   try{freshPage.off('pageerror',pageError);freshPage.off('console',consoleError);freshPage.off('response',responseError);freshPage.off('requestfailed',requestError);}catch(error){cleanupErrors.push('Fixture observer cleanup: '+redact(error));}
  }
  if(context)try{await context.close();}catch(error){cleanupErrors.push('Fixture context close: '+redact(error));}
 }
 const result=contract??{sourceHead:process.env.GITHUB_SHA||null,syntheticSensors:true,physicalDeviceCertified:false,device,passed:false,states:{},captures:[],errors:[],cleanupErrors:[]};
 result.nativeBrowserChecks=nativeBrowserChecks;result.sensorSource='deterministic-watch-contract';result.sensorContractDisposal=disposal??null;result.originalContextReleased=originalContextReleased;result.setupFailure=setupFailure;result.setupCaptures=setupCaptures;result.captures.push(...setupCaptures);
 result.errors.push(...nativeBrowserChecks.errors.map(error=>'Native browser path: '+error),...errors);result.failedRequests=failedRequests;result.cleanupErrors.push(...nativeBrowserChecks.cleanupErrors.map(error=>'Native browser path: '+error),...cleanupErrors);
 result.passed=!!result.passed&&nativeBrowserChecks.passed&&!result.errors.length&&!failedRequests.length&&!result.cleanupErrors.length;
 await writeFile(resolve(output,'gps-regression.json'),JSON.stringify(result,null,2)+'\n');return result;
}

async function checkGpsContractScene({page,expect,game,output,device,renderBackend,actualGpu,openSettings,expectedSettings}){
 expect=expect.configure({timeout:30000});page.setDefaultTimeout(45000);
 const result={sourceHead:process.env.GITHUB_SHA||null,syntheticSensors:true,physicalDeviceCertified:false,viewportEmulated:device==='phone',device,renderBackend,actualGpu,
  actualMacMetal:process.platform==='darwin'&&renderBackend==='angle-metal'&&/Metal/i.test(actualGpu?.renderer||'')&&!/SwiftShader|llvmpipe|software rasterizer/i.test(actualGpu?.renderer||''),
  sensorSource:'deterministic-watch-contract',scope:'Actual full game and visible controls in a fresh isolated context with a deterministic synthetic watchPosition contract. Native browser sensor/error integration is reported separately. Timing counts scene render submissions, not GPU execution or confirmed presentation.',
  placement:'Existing Return to Jefferson bridge start and Dismount controls; map origin/spawn projection, no injected game pose.',
  passed:false,map:null,states:{},captures:[],checks:{},controlLayouts:{},uiTransitions:null,failureUi:null,diagnosticErrors:[],errors:[],privacy:{networkCoordinateMatches:0,networkObserved:false,storageCoordinateMatches:null,storageChecked:false},cleanupErrors:[]};
 let coordinateTokens=[],mapCanvas,uiObserver,initialMovementControls;
 const observeRequest=request=>{const value=request.url()+'\n'+(request.postData()||'');if(coordinateTokens.some(token=>value.includes(token)))result.privacy.networkCoordinateMatches++;};
 const capture=async name=>{const file='gps-'+name+'.png';await page.screenshot({path:resolve(output,file),timeout:90000});result.captures.push(file);};
 const panel=page.locator('#location-perf'),summary=panel.locator(':scope > summary'),dialog=page.locator('#real-location');
 const openLocation=async()=>{
  if(await dialog.isVisible())return;
  if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#ride-menu .real-location-open').click();await expect(dialog).toBeVisible();
 };
 const closeLocation=async()=>{
  if(await dialog.isVisible())await page.getByRole('button',{name:'Close real location settings',exact:true}).click();
  if(await page.locator('#ride-menu').isVisible())await page.locator('#ride-menu [data-close="ride-menu"]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
 };
 const cyanPixels=async()=>{
  assert(mapCanvas&&await mapCanvas.isVisible(),'The selected player-visible GPS map must remain visible');
  return mapCanvas.evaluate(canvas=>{
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('The actual minimap canvas is unavailable');
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;
  for(let i=0;i<rgba.length;i+=4)if(Math.abs(rgba[i]-101)<=3&&Math.abs(rgba[i+1]-232)<=3&&rgba[i+2]>=252&&rgba[i+3]>=200)count++;
  return count;
  });
 };
 const assertMapUnobscured=async label=>{
  await expect(mapCanvas).toBeVisible();
  const uncovered=await mapCanvas.evaluate(canvas=>{
   const box=canvas.getBoundingClientRect(),surface=canvas.closest('.reference-map')||canvas;
   // The center and four interior quadrants lie inside the circular map.
   // Read hit targets only; never mutate styles or dismiss an obstruction.
   return [[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].every(([x,y])=>{
    const target=document.elementFromPoint(box.left+box.width*x,box.top+box.height*y);
    return !!target&&surface.contains(target);
   });
  });
  result.checks['mapUnobscured'+label]=uncovered;
  assert(uncovered,'The selected GPS map must remain unobscured at its center and four interior quadrants');
 };
 const observeUi=async()=>page.evaluateHandle(()=>{
  const dialog=document.getElementById('real-location'),note=document.getElementById('real-location-follow-note'),body=document.body;
  if(!dialog||!note)throw Error('GPS UI diagnostics require the actual location controls');
  const statuses=new Set(['off','requesting','tracking','poor-accuracy','stale','outside-map','denied','unavailable','timeout','unsupported','insecure','paused','jump-rejected']);
  const reasons=new Map([
   ['', 'none'],
   ['Your local avatar view follows your location. Ordinary riding resumes where you left it when you stop.', 'following'],
   ['Follow is for solo exploration on mapped open ground. Ordinary ride controls pause while following.', 'ready'],
   ['This map uses a different coordinate layout. Avatar follow is unavailable.', 'map-layout'],
   ['Start or resume solo exploration before following your location.', 'solo-inactive'],
   ['Leave the multiplayer room before following your location.', 'multiplayer-active'],
   ['Return to solo exploration and exit vehicles and activities first.', 'mode-active'],
   ['Your location is not on clear mapped ground. The map marker remains available.', 'ground-unavailable'],
   ['Avatar follow paused because mapped ground is unavailable.', 'mapped-ground-unavailable'],
   ['Avatar follow stopped before multiplayer.', 'multiplayer-switch'],
   ['Avatar follow stopped for game travel.', 'travel-switch'],
   ['Avatar follow stopped for a vehicle.', 'vehicle-switch'],
   ['Avatar follow stopped for the slide.', 'slide-switch'],
   ['Avatar follow stopped for a boat.', 'boat-switch'],
   ['Avatar follow stopped for photography.', 'photo-switch'],
   ['Avatar follow stopped for a race.', 'race-switch'],
   ['Avatar follow stopped for an activity.', 'activity-switch'],
   ['Avatar follow stopped for local co-op.', 'coop-switch'],
   ['Avatar follow stopped for the Cadillac.', 'cadillac-switch'],
   ['Avatar follow stopped for VR.', 'vr-switch'],
  ]);
  const status=value=>statuses.has(value)?value:'unrecognized',reason=value=>reasons.get(value||'')||'unrecognized';
  const following=value=>/\blocation-following\b/.test(value||'');
  const state=()=>({status:status(dialog.getAttribute('data-location-status')),following:following(body.getAttribute('class')),reason:reason(note.textContent)});
  const started=performance.now(),events=[],limit=200;let dropped=0;
  const append=(field,from,to)=>{
   if(from===to)return;
   if(events.length===limit){events.shift();dropped++;}
   events.push({atMs:Math.max(0,Math.round(performance.now()-started)),field,from,to});
  };
  for(const [field,value]of Object.entries(state()))append(field,null,value);
  const collect=records=>{
   for(let i=0;i<records.length;i++){
    const record=records[i];
    if(record.type==='attributes'){
     // The next mutation's oldValue is this mutation's new value. Reading
     // only the final DOM value would lose brief stale -> tracking changes.
     const next=records.slice(i+1).find(other=>other.type==='attributes'&&other.target===record.target&&other.attributeName===record.attributeName);
     const value=next?next.oldValue:record.target.getAttribute(record.attributeName);
     if(record.target===dialog)append('status',status(record.oldValue),status(value));
     else if(record.target===body)append('following',following(record.oldValue),following(value));
    }else if(record.type==='childList'&&record.target===note){
     append('reason',reason([...record.removedNodes].map(node=>node.textContent||'').join('')),reason([...record.addedNodes].map(node=>node.textContent||'').join('')));
    }else if(record.type==='characterData'&&note.contains(record.target)){
     const next=records.slice(i+1).find(other=>other.type==='characterData'&&other.target===record.target);
     append('reason',reason(record.oldValue),reason(next?next.oldValue:record.target.textContent));
    }
   }
  };
  const observer=new MutationObserver(collect);
  observer.observe(dialog,{attributes:true,attributeOldValue:true,attributeFilter:['data-location-status']});
  observer.observe(body,{attributes:true,attributeOldValue:true,attributeFilter:['class']});
  observer.observe(note,{childList:true,subtree:true,characterData:true,characterDataOldValue:true});
  return {
   snapshot(){collect(observer.takeRecords());return {source:'Read-only DOM status and follow controls; no sensor API replacement or coordinates.',limit,dropped,events:[...events],final:state()};},
   disconnect(){observer.disconnect();},
  };
 });
 const readUiEvidence=async()=>{
  if(!uiObserver)return null;
  try{return await uiObserver.evaluate(observer=>observer.snapshot());}
  catch{result.diagnosticErrors.push('Could not read the bounded GPS UI transition record.');return null;}
 };
 const recordControlLayout=async(label,state)=>{
  const layout=await page.evaluate(()=>{
   const points=[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
   const visible=element=>{if(!element)return false;const box=element.getBoundingClientRect(),style=getComputedStyle(element);return box.width>0&&box.height>0&&style.visibility==='visible'&&style.display!=='none';};
   const hit=(element,samples)=>{const box=element.getBoundingClientRect();return samples.every(([x,y])=>{const target=document.elementFromPoint(box.left+box.width*x,box.top+box.height*y);return !!target&&element.contains(target);});};
   const check=(element,samples)=>{const shown=visible(element);return {visible:shown,unobscured:shown?hit(element,samples):null};};
   const strip=document.getElementById('real-location-strip'),buttons=strip?[...strip.querySelectorAll('button')]:[];
   return {strip:check(strip,points),locationButton:check(buttons[0],points),stopButton:check(buttons[1],points),movement:Object.fromEntries(['touch-zone','mount','recover','brake','hop','sprint'].map(id=>[id,check(document.getElementById(id),[[.5,.5]])]))};
  });
  const visibleMovement=Object.entries(layout.movement).filter(([,check])=>check.visible).map(([id])=>id).sort();
  if(label==='Before_off')initialMovementControls=visibleMovement;
  layout.movementMatchesOff=state==='follow'?null:JSON.stringify(visibleMovement)===JSON.stringify(initialMovementControls);
  layout.passed=state==='off'?!layout.strip.visible:layout.strip.visible&&layout.strip.unobscured&&layout.locationButton.unobscured&&layout.stopButton.unobscured;
  layout.passed=!!layout.passed&&Object.values(layout.movement).every(check=>!check.visible||check.unobscured)&&(state==='follow'||layout.movementMatchesOff);
  // Keep evidence now, but defer layout assertions until after all three
  // timing windows and Stop so an overlap cannot hide a Follow diagnostic.
  result.controlLayouts[label]=layout;
 };
 const settings=async()=>({quality:await page.locator('#quality').inputValue(),cap:await page.locator('#fps').inputValue(),reducedMotion:await page.locator('#motion').isChecked(),hudPreset:await page.locator('body').getAttribute('data-hud-preset'),focusHud:/\bbelle-hud-focus\b/.test(await page.locator('body').getAttribute('class')||'')});
 let fixedSettings,firstMetadata;
 async function record(name,state){
  assert.deepEqual(await settings(),fixedSettings,'Graphics settings must match across GPS phases');
  await assertMapUnobscured('Before_'+name);
  await expect(dialog).toHaveAttribute('data-location-status',state==='follow'?'tracking':state);
  if(state==='follow')await expect(page.locator('body')).toHaveClass(/location-following/);else await expect(page.locator('body')).not.toHaveClass(/location-following/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await recordControlLayout('Before_'+name,state);
  if(!await panel.evaluate(element=>element.open))await summary.click();
  await page.locator('#location-perf-duration').selectOption('30');await page.locator('#location-perf-start').click();
  await expect(page.locator('#location-perf-start')).toBeDisabled();await summary.click();
  await expect(summary).toHaveText(/Location timing · (complete|interrupted|stopped)/,{timeout:45000});
  await summary.click();const textarea=page.locator('#location-perf-report');await expect(textarea).toBeVisible();
  const timing=validateGpsTimingReport(JSON.parse(await textarea.inputValue()),state);
  const comparable={viewport:timing.atStart.viewport,targetFrameCap:timing.atStart.targetFrameCap,reducedMotion:timing.atStart.reducedMotion};
  if(firstMetadata)assert.deepEqual(comparable,firstMetadata,'Viewport and rendering settings must remain identical across phases');else firstMetadata=comparable;
  assert.deepEqual(await settings(),fixedSettings);
  await assertMapUnobscured('After_'+name);
  result.states[name]=timing;await writeFile(resolve(output,'gps-'+name+'-timing.json'),JSON.stringify(timing,null,2)+'\n');
  await capture(name+'-timing');await summary.click();await recordControlLayout('After_'+name,state);
 }
 try{
  uiObserver=await observeUi();
  await expect(panel).toBeVisible();assert.equal(new URL(page.url()).searchParams.get('locationPerf'),'1');
  const capability=await page.evaluate(()=>({secure:isSecureContext,geolocation:!!navigator.geolocation}));result.checks.capability=capability;
  assert(capability.secure&&capability.geolocation,'GPS regression unavailable: secure context and browser geolocation are required');
  const synthetic=await syntheticSpawn(game);
  coordinateTokens=[String(synthetic.latitude),String(synthetic.longitude)];
  if(await panel.evaluate(element=>element.open))await summary.click();
  await openSettings();await page.locator('#restart').click();await expect(page.locator('#settings')).not.toBeVisible();
  if((await page.locator('#ride-mode').innerText()).trim()!=='ON FOOT')await page.locator('#mount').click();
  await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');
  // The default cinematic preset shows the circular navigation canvas and
  // hides legacy #navigation. Check the map players actually see, preserving
  // their HUD preset instead of exposing a hidden legacy canvas for the test.
  const referenceMap=page.locator('#reference-hud .reference-map canvas');
  if(await referenceMap.isVisible()){
   mapCanvas=referenceMap;result.map={kind:'circular',selector:'#reference-hud .reference-map canvas'};
  }else{
   mapCanvas=page.locator('#minimap');result.map={kind:'legacy',selector:'#minimap'};
   if(!await mapCanvas.isVisible()){
    await expect(page.locator('#minimap-hide')).toBeVisible();
    // The QA disclosure can overlap this corner; native keyboard activation
    // uses the actual visible button, without a forced click or DOM mutation.
    await page.locator('#minimap-hide').press('Enter');
   }
  }
  await expect(mapCanvas).toBeVisible();
  fixedSettings=await settings();assert.deepEqual(fixedSettings,expectedSettings,'The isolated context must preserve the original graphics and HUD settings');result.settings=fixedSettings;
  await openLocation();await expect(dialog).toHaveAttribute('data-location-status','off');
  await expect(page.locator('#real-location-start')).toHaveText('Use my location');await expect(page.locator('#real-location-follow')).toBeDisabled();
  await expect(page.locator('#real-location-stop')).toBeDisabled();await expect(page.locator('#real-location-strip')).toBeHidden();
  result.checks.defaultOff=true;await capture('default-off');await closeLocation();
  await record('off','off');const beforeMarker=await cyanPixels();
  result.sensorContractAtActivation=await page.evaluate(()=>globalThis.__belleGpsSensorContract.snapshot());
  assert.equal(result.sensorContractAtActivation.activeWatches,0);assert.equal(result.sensorContractAtActivation.timerActive,false);
  page.on('request',observeRequest);result.privacy.networkObserved=true;
  await openLocation();await expect(dialog).toHaveAttribute('data-location-status','off');await page.locator('#real-location-start').click();
  await expect(dialog).toHaveAttribute('data-location-status','tracking',{timeout:15000});
  await expect(page.locator('#real-location-accuracy')).toContainText('±5 m');
  await expect(page.locator('#real-location-follow')).toBeEnabled();
  await capture('tracking-dialog');await closeLocation();
  await expect.poll(cyanPixels,{timeout:15000}).toBeGreaterThan(beforeMarker+4);result.checks.actualMinimapMarker=true;
  await expect(page.locator('#real-location-strip')).toContainText('GPS on');await capture('marker');await record('marker','tracking');
  await openLocation();await page.locator('#real-location-follow').click();
  await expect(page.locator('body')).toHaveClass(/location-following/);await expect(dialog).not.toBeVisible();
  await expect(page.locator('#real-location-strip')).toContainText('GPS follow');await capture('follow');await record('follow','follow');
  await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).click();
  await expect(page.locator('body')).not.toHaveClass(/location-following/);await expect(dialog).toHaveAttribute('data-location-status','off');
  await expect(page.locator('#real-location-strip')).toBeHidden();await expect(page.locator('#mount')).toBeEnabled();
  await assertMapUnobscured('AfterStop');
  await recordControlLayout('AfterStop','off');
  await expect.poll(cyanPixels,{timeout:15000}).toBeLessThanOrEqual(beforeMarker);result.checks.stopClearsMarkerAndRestoresControls=true;
  result.privacy.storageCoordinateMatches=await page.evaluate(tokens=>[localStorage,sessionStorage].reduce((count,storage)=>{
   for(let i=0;i<storage.length;i++){const value=storage.getItem(storage.key(i))||'';if(tokens.some(token=>value.includes(token)))count++;}return count;
  },0),coordinateTokens);
  result.privacy.storageChecked=true;
  assert.equal(result.privacy.networkCoordinateMatches,0,'Synthetic geographic coordinates must not be sent in requests');
  assert.equal(result.privacy.storageCoordinateMatches,0,'Synthetic geographic coordinates must not be saved in browser storage');
  await capture('stopped');
  result.checks.controlLayoutsPassed=Object.values(result.controlLayouts).every(layout=>layout.passed);
  assert(result.checks.controlLayoutsPassed,'GPS strip buttons and ordinary movement controls must remain unobscured in the default HUD');result.passed=true;
 }catch(error){result.errors.push(String(error?.stack||error));result.uiTransitions=await readUiEvidence();result.failureUi=result.uiTransitions?.final??null;try{await capture('failure');}catch(captureError){result.errors.push('Screenshot: '+String(captureError));}}
 finally{
  if(!result.uiTransitions)result.uiTransitions=await readUiEvidence();
  if(uiObserver){try{await uiObserver.evaluate(observer=>observer.disconnect());await uiObserver.dispose();}catch{result.diagnosticErrors.push('Could not dispose the GPS UI transition observer.');}}
  page.off('request',observeRequest);
  // These are test-context settings only; release the watch through the real UI.
  try{if(await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).isVisible())await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).click({timeout:5000});}catch(error){result.cleanupErrors.push(String(error));}
  try{result.sensorContractAfterStop=await page.evaluate(()=>globalThis.__belleGpsSensorContract.snapshot());assert.equal(result.sensorContractAfterStop.activeWatches,0);assert.equal(result.sensorContractAfterStop.timerActive,false);}catch(error){result.cleanupErrors.push('Synthetic watch cleanup: '+String(error));}
  if(result.cleanupErrors.length||result.diagnosticErrors.length||!result.uiTransitions)result.passed=false;
  await writeFile(resolve(output,'gps-regression.json'),JSON.stringify(result,null,2)+'\n');
 }
 return result;
}
