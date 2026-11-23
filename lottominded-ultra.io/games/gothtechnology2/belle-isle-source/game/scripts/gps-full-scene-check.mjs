/** Full-game GPS regression using browser-emulated public coordinates, never device GPS.
 * No game pose, renderer, clock or sensor implementation is replaced by this test.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

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

export async function checkGpsFullScene({page,expect,game,output,device,renderBackend,actualGpu,openSettings}){
 expect=expect.configure({timeout:30000});page.setDefaultTimeout(45000);
 const result={sourceHead:process.env.GITHUB_SHA||null,syntheticSensors:true,physicalDeviceCertified:false,viewportEmulated:device==='phone',device,renderBackend,actualGpu,
  actualMacMetal:process.platform==='darwin'&&renderBackend==='angle-metal'&&/Metal/i.test(actualGpu?.renderer||'')&&!/SwiftShader|llvmpipe|software rasterizer/i.test(actualGpu?.renderer||''),
  scope:'Actual full game and visible controls; synthetic public-spawn geolocation. Timing counts scene render submissions, not GPU execution or confirmed presentation.',
  placement:'Existing Return to Jefferson bridge start and Dismount controls; map origin/spawn projection, no injected game pose.',
  passed:false,map:null,states:{},captures:[],checks:{},errors:[],privacy:{networkCoordinateMatches:0,storageCoordinateMatches:0},cleanupErrors:[]};
 const context=page.context(),origin=new URL(page.url()).origin;let timer,pending=Promise.resolve(),inFlight=false,refreshError;
 let coordinateTokens=[],mapCanvas;
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
 const settings=async()=>({quality:await page.locator('#quality').inputValue(),cap:await page.locator('#fps').inputValue(),reducedMotion:await page.locator('#motion').isChecked(),hudPreset:await page.locator('body').getAttribute('data-hud-preset'),focusHud:/\bbelle-hud-focus\b/.test(await page.locator('body').getAttribute('class')||'')});
 let fixedSettings,firstMetadata;
 async function record(name,state){
  assert.deepEqual(await settings(),fixedSettings,'Graphics settings must match across GPS phases');
  await assertMapUnobscured('Before_'+name);
  await expect(dialog).toHaveAttribute('data-location-status',state==='follow'?'tracking':state);
  if(state==='follow')await expect(page.locator('body')).toHaveClass(/location-following/);else await expect(page.locator('body')).not.toHaveClass(/location-following/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  if(!await panel.evaluate(element=>element.open))await summary.click();
  await page.locator('#location-perf-duration').selectOption('30');await page.locator('#location-perf-start').click();
  await expect(page.locator('#location-perf-start')).toBeDisabled();await summary.click();
  await expect(summary).toHaveText(/Location timing · (complete|interrupted|stopped)/,{timeout:45000});
  await summary.click();const textarea=page.locator('#location-perf-report');await expect(textarea).toBeVisible();
  const timing=validateGpsTimingReport(JSON.parse(await textarea.inputValue()),state);
  const comparable={viewport:timing.atStart.viewport,targetFrameCap:timing.atStart.targetFrameCap,reducedMotion:timing.atStart.reducedMotion};
  if(firstMetadata)assert.deepEqual(comparable,firstMetadata,'Viewport and rendering settings must remain identical across phases');else firstMetadata=comparable;
  assert.deepEqual(await settings(),fixedSettings);assert(!refreshError,refreshError);
  await assertMapUnobscured('After_'+name);
  result.states[name]=timing;await writeFile(resolve(output,'gps-'+name+'-timing.json'),JSON.stringify(timing,null,2)+'\n');
  await capture(name+'-timing');await summary.click();
 }
 try{
  await expect(panel).toBeVisible();assert.equal(new URL(page.url()).searchParams.get('locationPerf'),'1');
  const capability=await page.evaluate(()=>({secure:isSecureContext,geolocation:!!navigator.geolocation}));result.checks.capability=capability;
  assert(capability.secure&&capability.geolocation,'GPS regression unavailable: secure context and browser geolocation are required');
  const map=JSON.parse(await readFile(resolve(game,'dist/belle/map.json'),'utf8'));
  assert.equal(map.axes,'x east, y up, z south; metres; river 0 m, island 2 m');
  assert.deepEqual(map.origin,[-83.00175,42.34680]);assert.equal(map.spawn.x,0);assert.equal(map.spawn.z,0);
  // Exact inverse of tools/prepare-map.mjs and realLocation.ts. These are public
  // authored coordinates, held only in this isolated test context.
  const scale=111320,[lon,lat]=map.origin;
  const synthetic={latitude:lat-map.spawn.z/scale,longitude:lon+map.spawn.x/(scale*Math.cos(lat*Math.PI/180)),accuracy:5};
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
  fixedSettings=await settings();result.settings=fixedSettings;
  await openLocation();await expect(dialog).toHaveAttribute('data-location-status','off');
  await expect(page.locator('#real-location-start')).toHaveText('Use my location');await expect(page.locator('#real-location-follow')).toBeDisabled();
  await expect(page.locator('#real-location-stop')).toBeDisabled();await expect(page.locator('#real-location-strip')).toBeHidden();
  result.checks.defaultOff=true;await capture('default-off');await closeLocation();
  await record('off','off');const beforeMarker=await cyanPixels();
  // Set the synthetic fix before granting permission: the test can never fall
  // back to the runner's real location provider. No compass is requested.
  await context.setGeolocation(synthetic);await context.grantPermissions(['geolocation'],{origin});page.on('request',observeRequest);
  await openLocation();await expect(dialog).toHaveAttribute('data-location-status','off');await page.locator('#real-location-start').click();
  await expect(dialog).toHaveAttribute('data-location-status','tracking',{timeout:15000});
  await expect(page.locator('#real-location-accuracy')).toContainText('±5 m');
  await expect(page.locator('#real-location-follow')).toBeEnabled();
  timer=setInterval(()=>{
   if(inFlight)return;inFlight=true;
   pending=context.setGeolocation(synthetic).catch(error=>{refreshError=String(error);}).finally(()=>{inFlight=false;});
  },2000);
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
  await expect.poll(cyanPixels,{timeout:15000}).toBeLessThanOrEqual(beforeMarker);result.checks.stopClearsMarkerAndRestoresControls=true;
  result.privacy.storageCoordinateMatches=await page.evaluate(tokens=>[localStorage,sessionStorage].reduce((count,storage)=>{
   for(let i=0;i<storage.length;i++){const value=storage.getItem(storage.key(i))||'';if(tokens.some(token=>value.includes(token)))count++;}return count;
  },0),coordinateTokens);
  assert.equal(result.privacy.networkCoordinateMatches,0,'Synthetic geographic coordinates must not be sent in requests');
  assert.equal(result.privacy.storageCoordinateMatches,0,'Synthetic geographic coordinates must not be saved in browser storage');
  assert(!refreshError,refreshError);await capture('stopped');result.passed=true;
 }catch(error){result.errors.push(String(error?.stack||error));try{await capture('failure');}catch(captureError){result.errors.push('Screenshot: '+String(captureError));}}
 finally{
  if(timer)clearInterval(timer);await pending;page.off('request',observeRequest);
  if(refreshError)result.cleanupErrors.push('Synthetic fix refresh: '+refreshError);
  // These are test-context settings only; release the watch through the real UI.
  try{if(await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).isVisible())await page.getByRole('button',{name:'Stop real location and clear position',exact:true}).click({timeout:5000});}catch(error){result.cleanupErrors.push(String(error));}
  try{await context.clearPermissions();await context.setGeolocation(null);}catch(error){result.cleanupErrors.push(String(error));}
  if(result.cleanupErrors.length)result.passed=false;
  await writeFile(resolve(output,'gps-regression.json'),JSON.stringify(result,null,2)+'\n');
 }
 return result;
}
