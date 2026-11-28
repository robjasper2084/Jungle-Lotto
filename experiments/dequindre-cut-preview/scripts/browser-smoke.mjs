import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {previewRoot,repoRoot} from './paths.mjs';
import {waitForPreviewReadiness} from './browser-readiness.mjs';

const compact=process.argv.includes('--compact'),phone=compact||process.argv.includes('--phone'),profile=process.argv.includes('--profile'),reducedMotion=process.argv.includes('--reduced-motion');
const viewport=compact?{width:320,height:568}:phone?{width:390,height:844}:{width:1440,height:900};
const requestedUrl=new URL(process.env.DEQUINDRE_PREVIEW_URL||'http://127.0.0.1:8317/');
if(!['localhost','127.0.0.1','[::1]'].includes(requestedUrl.hostname))throw Error('This unpublished preview test only connects to a local server');
requestedUrl.searchParams.set('profile','1');
const label=(compact?'compact-phone':phone?'phone':'desktop')+(reducedMotion?'-reduced-motion':'')+(profile?'-90s':'-smoke');
const startedAt=new Date().toISOString(),run=startedAt.replace(/[.:]/g,'-')+'-'+process.pid;
const output=resolve(previewRoot,'output/browser',label,run);await mkdir(output,{recursive:true});
const report={schemaVersion:1,startedAt,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim(),url:requestedUrl.href,device:compact?'compact-phone':phone?'phone':'desktop',viewport,reducedMotion,mode:profile?'supplemental-90-second-observation':'native-input-smoke',productionAcceptance:false,checks:[],captures:[],layout:[],nativeActions:[],pageErrors:[],failedRequests:[],httpErrors:[],consoleErrors:[],webSockets:[]};
let browser,page;
const record=(name,value)=>{report.checks.push({name,passed:!!value});if(!value)throw Error('Preview check failed: '+name);};
const check=(name,value,detail)=>report.checks.push({name,passed:!!value,...(detail===undefined?{}:{detail})});
const snapshot=page=>page.evaluate(()=>globalThis.__dequindrePreview?.snapshot?.()??null);
try{
  const expected=JSON.parse(execFileSync(process.execPath,['--experimental-transform-types','--import',resolve(previewRoot,'scripts/register-test-resolver.mjs'),resolve(previewRoot,'scripts/source-inventory.ts')],{cwd:previewRoot,encoding:'utf8',maxBuffer:1024*1024}));
  report.expectedSource=expected;
  browser=await chromium.launch({executablePath:process.env.DEQUINDRE_CHROME||chromium.executablePath(),headless:process.env.DEQUINDRE_HEADED!=='1',args:['--no-sandbox','--enable-gpu']});
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:phone,hasTouch:phone,reducedMotion:reducedMotion?'reduce':'no-preference'});
  page=await context.newPage();
  const touchSession=phone?await context.newCDPSession(page):null;
  const activate=async(locator,name)=>{
    const action={name,method:phone?'native-touch':'native-keyboard',startedAt:new Date().toISOString()},began=Date.now();
    report.nativeActions.push(action);
    try{
      await expect(locator).toBeVisible({timeout:30000});
      await expect(locator).toBeEnabled({timeout:30000});
      if(phone)await locator.tap({timeout:30000});
      else{await locator.focus({timeout:30000});await expect(locator).toBeFocused();await locator.press('Enter',{timeout:30000});}
      action.completed=true;
    }finally{action.elapsedMs=Date.now()-began;}
  };
  const holdForward=async milliseconds=>{
    if(touchSession){
      await expect(page.locator('#touch-zone')).toBeVisible();
      const box=await page.locator('#touch-zone').boundingBox();
      if(!box)throw Error('Native mobile movement area has no bounds');
      const x=box.x+box.width*.5,y=box.y+box.height*.65;
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.max(box.y+8,y-70),id:1}]});
      try{await page.waitForTimeout(milliseconds);}finally{await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    }else{
      await page.keyboard.down('KeyW');
      try{await page.waitForTimeout(milliseconds);}finally{await page.keyboard.up('KeyW');}
    }
  };
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),resourceType:request.resourceType(),error:request.failure()?.errorText}));
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('websocket',socket=>report.webSockets.push(socket.url()));
  const readinessState=async(stop=null)=>({
    ...await page.evaluate(stop=>{
      const start=document.querySelector('#start'),welcome=document.querySelector('#welcome'),banner=document.querySelector('#dequindre-preview-banner[data-dequindre-preview]'),native=stop?document.querySelector('[data-cut-travel="preview-cut-'+stop+'"]'):null;
      const visible=element=>{if(!element||element.hidden)return false;const style=getComputedStyle(element),bounds=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&bounds.width>0&&bounds.height>0;};
      const destinations=[...document.querySelectorAll('[data-preview-stop]')];
      return {preview:globalThis.__dequindrePreview?.snapshot?.()??null,bannerAttached:!!banner,startEnabled:!!start&&!start.disabled,startLabel:document.querySelector('#start-label')?.textContent?.trim()??'',loading:document.querySelector('#loading')?.textContent??'',welcomeHidden:welcome?.hidden??false,welcomeState:welcome?.dataset.state??null,bodyAtStart:document.body.classList.contains('at-start'),selectedVehicle:welcome?.dataset.vehicle??null,checkedVehicle:document.querySelector('input[name="startup-vehicle"]:checked')?.value??null,camera:welcome?.dataset.camera??null,rideHudVisible:visible(document.querySelector('#ridehud')),bannerVisible:visible(banner),previewUsable:banner?.dataset.ready==='true'&&destinations.length===4&&destinations.every(button=>!button.disabled),activeFrames:Number(document.querySelector('#profile')?.dataset.activeFrames??0),travelState:native?.dataset.previewTravelState??null,travelMessage:native?.parentElement?.querySelector('[data-preview-travel-status]')?.textContent??''};
    },stop),
    pageErrors:[...report.pageErrors],
  });
  const navigationStarted=Date.now();
  await page.goto(requestedUrl.href,{waitUntil:'domcontentloaded'});
  report.documentReadyElapsedMs=Date.now()-navigationStarted;
  // Choose through the original accessible controls before heavy world work
  // finishes. The shared map rider is One wheel; no storage or DOM override.
  const picker=page.locator('.cinema-ride-picker'),summary=picker.locator('summary');
  await expect(summary).toBeVisible({timeout:180000});
  const choiceStarted=Date.now();
  report.vehicleChoice={requested:'onewheel',method:phone?'native-touch-radio-label':'native-keyboard-radio',before:await readinessState()};
  await activate(summary,'Open native ride chooser');
  const oneWheel=picker.locator('input[name="startup-vehicle"][value="onewheel"]');
  const oneWheelCard=picker.locator('label:has(input[name="startup-vehicle"][value="onewheel"])');
  await expect(oneWheelCard).toBeVisible({timeout:30000});await expect(oneWheel).toBeEnabled({timeout:30000});
  if(phone)await oneWheelCard.tap({timeout:30000});
  else{await oneWheel.focus({timeout:30000});await expect(oneWheel).toBeFocused();await oneWheel.press('Space',{timeout:30000});}
  await expect(oneWheel).toBeChecked();
  await expect(page.locator('#welcome')).toHaveAttribute('data-vehicle','onewheel');
  await activate(picker.getByRole('button',{name:'Use this ride',exact:true}),'Confirm native One wheel choice');
  await expect(picker).toHaveJSProperty('open',false);
  Object.assign(report.vehicleChoice,{after:await readinessState(),elapsedMs:Date.now()-choiceStarted});
  record('native ride chooser selects One wheel',report.vehicleChoice.after.selectedVehicle==='onewheel'&&report.vehicleChoice.after.checkedVehicle==='onewheel');
  report.startupReadiness=await waitForPreviewReadiness(()=>readinessState());
  report.startupReadiness.totalElapsedMs=Date.now()-navigationStarted;
  record('source-backed world is ready',true);
  report.initial=await snapshot(page);
  const imported=report.initial.diagnostics?.importedWorld,coverage=imported?.mapCoverage;
  for(const key of ['terrainChunks','terrainTriangles','mappedBuildings','geospatialMeshes','sourceSpots'])check('complete original '+key,coverage?.[key]===expected[key],{expected:expected[key],actual:coverage?.[key]});
  check('complete source route length',Math.abs((imported?.sourceRouteMetres??0)-expected.sourceRouteMetres)<1e-6,{expected:expected.sourceRouteMetres,actual:imported?.sourceRouteMetres});
  check('source physical surfaces retained',coverage?.colliders>=expected.minimumStaticColliders,{minimum:expected.minimumStaticColliders,actual:coverage?.colliders});
  check('source stream has no failed original assets',imported?.stream?.total>0&&imported.stream.errors===0,imported?.stream);
  const connection=report.initial.diagnostics?.connector;
  for(const direction of ['outbound','inbound']){
    const route=connection?.[direction];
    check('complete scene connector '+direction,route?.ok===true&&route.phase==='complete-scene'&&route.issues.length===0&&route.samples>=Math.floor(connection.route.length/.75),route);
  }
  check('connector verified in both directions',connection?.verified===true);
  await activate(page.locator('#welcome-friends'),'Open native friends notice');
  await expect(page.locator('#online-room[data-preview-offline="true"]')).toBeVisible();
  await expect(page.locator('#online-room')).toContainText('Online rooms are off in this preview.');
  record('offline room notice has no join or create inputs',await page.locator('#online-room input,#online-room select').count()===0);
  await activate(page.locator('#online-room').getByRole('button',{name:'Close preview room notice',exact:true}),'Close native friends notice');
  const rideStarted=Date.now();
  await activate(page.locator('#start'),'Start native One wheel ride');
  report.nativeRideReadiness=await waitForPreviewReadiness(()=>readinessState(),{ride:true});
  report.nativeRideReadiness.totalElapsedMs=Date.now()-rideStarted;
  record('native startup reveals a usable preview HUD and renders the selected ride',true);
  const bannerBounds=await page.locator('#dequindre-preview-banner').boundingBox();
  report.layout.push({element:'preview-banner',bounds:bannerBounds});
  record('preview banner stays inside viewport',bannerBounds&&bannerBounds.x>=-.5&&bannerBounds.y>=-.5&&bannerBounds.x+bannerBounds.width<=viewport.width+.5&&bannerBounds.y+bannerBounds.height<=viewport.height+.5);
  const toolbar=await page.locator('.ride-header>.quick-tools button:visible').evaluateAll(buttons=>buttons.map(button=>{const rect=button.getBoundingClientRect();return {id:button.id||button.getAttribute('aria-label')||button.textContent,bounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};}));
  report.layout.push(...toolbar.map(button=>({element:'toolbar:'+button.id,bounds:button.bounds})));
  record('native toolbar and Cut button remain available',toolbar.length>=4&&toolbar.some(button=>button.id==='Preview places')&&['view','pause','tools-toggle'].every(id=>toolbar.some(button=>button.id===id)));
  for(const button of toolbar){
    const b=button.bounds;
    record(button.id+' toolbar target stays inside viewport',b.x>=-.5&&b.y>=-.5&&b.x+b.width<=viewport.width+.5&&b.y+b.height<=viewport.height+.5);
    if(phone)record(button.id+' toolbar target is at least 44px',b.width>=44&&b.height>=44);
  }
  for(let i=0;i<toolbar.length;i++)for(let j=i+1;j<toolbar.length;j++){
    const a=toolbar[i].bounds,b=toolbar[j].bounds;
    const overlap=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5;
    record(toolbar[i].id+' and '+toolbar[j].id+' toolbar targets do not overlap',!overlap);
  }
  report.browser=await page.evaluate(()=>{
    const canvas=document.querySelector('#game');
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    const debug=gl?.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,canvasAttributes:{...canvas.dataset}};
  });
  const choose=async stop=>{
    const button=page.locator(`[data-preview-stop="${stop}"]`);
    if(!await button.isVisible()){
      await activate(page.locator('#dequindre-preview-banner').getByRole('button',{name:'Preview places',exact:true}),'Open preview places');
      await expect(page.locator('#dequindre-preview-places')).toBeVisible();
    }
    await expect(button).toBeEnabled({timeout:30000});
    if(phone)await button.scrollIntoViewIfNeeded();else await button.focus({timeout:30000});
    const bounds=await button.boundingBox();report.layout.push({element:stop+'-travel',bounds});
    record(stop+' preview travel target stays in view',bounds&&bounds.x>=-.5&&bounds.y>=-.5&&bounds.x+bounds.width<=viewport.width+.5&&bounds.y+bounds.height<=viewport.height+.5);
    if(phone)record(stop+' preview travel target is at least 44px',bounds&&bounds.width>=44&&bounds.height>=44);
    const previous=await snapshot(page);
    await activate(button,'Travel to '+stop);
    const readiness=await waitForPreviewReadiness(()=>readinessState(stop),{travel:true});
    report.checks.push({name:stop+' destination preparation completed',passed:true,elapsedMs:readiness.elapsedMs});
    await page.waitForFunction(frameCount=>(globalThis.__dequindrePreview?.snapshot?.().diagnostics?.runtime?.frameCount??0)>frameCount,previous.diagnostics.runtime.frameCount,{timeout:30000});
    if(phone)await page.locator('#game').tap({position:{x:Math.floor(viewport.width/2),y:Math.floor(viewport.height/2)}});
    else{await page.locator('#game').focus({timeout:30000});await expect(page.locator('#game')).toBeFocused();}
  };
  for(const stop of ['atwater','freight','mack','island']){
    await choose(stop);
    const before=await snapshot(page);
    record(stop+' has a finite pose',Number.isFinite(before?.lastPose?.x)&&Number.isFinite(before?.lastPose?.z));
    await holdForward(2500);await page.waitForTimeout(400);
    const after=await snapshot(page);
    const distance=Math.hypot(after.lastPose.x-before.lastPose.x,after.lastPose.z-before.lastPose.z);
    report.checks.push({name:stop+' native movement',passed:distance>.15,distanceMetres:distance});
    const file=stop+'.png';await page.screenshot({path:resolve(output,file)});report.captures.push({stop,file,before,after,distanceMetres:distance});
    const district=after.diagnostics?.importedWorld;
    check(stop+' advances the shared rendered world',after.diagnostics?.runtime?.frameCount>before.diagnostics?.runtime?.frameCount&&after.diagnostics?.gpu?.drawCalls>0);
    if(stop!=='island'){
      check(stop+' is physically inside the imported source district',after.lastPose.sourceDistrict===true);
      check(stop+' has visible source meshes and chunks',district?.rendering?.visibleMeshes>0&&district.rendering.visibleChunks>0,district?.rendering);
      check(stop+' has no source asset errors',district?.ready===true&&!district.error&&district.stream.errors===0,district?.stream);
    }else check('return reaches original Belle Isle terrain',after.lastPose.sourceDistrict===false);
  }
  if(profile){
    const first=await snapshot(page);
    // A passive browser callback observer. It never alters the game's frame
    // clock, renderer, physics, quality policy, requestAnimationFrame or input.
    await page.evaluate(()=>{
      globalThis.__dequindreBrowserObservation={intervals:[],elapsed:[],markers:[],started:performance.now(),last:null,finished:false};
      const observe=now=>{const p=globalThis.__dequindreBrowserObservation;if(p.finished)return;if(p.last!==null){p.intervals.push(now-p.last);p.elapsed.push(now-p.started);}p.last=now;requestAnimationFrame(observe);};
      requestAnimationFrame(observe);
    });
    const mark=(stop,event)=>page.evaluate(({stop,event})=>{const p=globalThis.__dequindreBrowserObservation;const marker={stop,event,elapsedMs:performance.now()-p.started};p.markers.push(marker);return marker;},{stop,event});
    report.profileSegments=[];
    for(const stop of ['atwater','freight','mack']){
      const travelStarted=await mark(stop,'travel-start');
      await choose(stop);
      const arrived=await mark(stop,'native-input-start'),before=await snapshot(page);
      await holdForward(30000);
      const ended=await mark(stop,'native-input-end'),after=await snapshot(page);
      const distance=Math.hypot(after.lastPose.x-before.lastPose.x,after.lastPose.z-before.lastPose.z);
      report.profileSegments.push({stop,travelStarted,arrived,ended,before,after,distanceMetres:distance});
      check(stop+' sustained native movement',distance>.15,{distanceMetres:distance});
      check(stop+' sustained scene remains healthy',after.diagnostics?.importedWorld?.ready===true&&!after.diagnostics.importedWorld.error&&after.diagnostics.importedWorld.stream.errors===0);
    }
    report.observation=await page.evaluate(()=>{const p=globalThis.__dequindreBrowserObservation;p.finished=true;const sorted=[...p.intervals].sort((a,b)=>a-b);return {seconds:(performance.now()-p.started)/1000,sampleCount:p.intervals.length,intervalsMs:p.intervals,elapsedMs:p.elapsed,markers:p.markers,p95Ms:sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]:null,over250ms:p.intervals.filter(v=>v>250).length,maxMs:sorted.at(-1)??null,scope:'Passive browser callback intervals continuously sampled through Atwater, Freight Yard and Mack Avenue, including travel dialogs, transitions and loads. Supplemental preview evidence; not the original production renderer acceptance.'};});
    check('sustained source route retains at least 90 seconds of continuous samples',report.observation.seconds>=90&&report.observation.sampleCount>0&&report.observation.intervalsMs.length===report.observation.elapsedMs.length);
    report.profileBefore=first;report.profileAfter=await snapshot(page);
    await page.screenshot({path:resolve(output,'sustained-route-end.png')});
  }
  report.final=await snapshot(page);
  report.profileDataset=await page.locator('#profile').evaluate(el=>({...el.dataset}));
  const isLocal=url=>{try{return new URL(url).origin===requestedUrl.origin;}catch{return false;}};
  report.sourceHttpErrors=report.httpErrors.filter(r=>isLocal(r.url));
  report.externalHttpErrors=report.httpErrors.filter(r=>!isLocal(r.url));
  report.sourceRequestFailures=report.failedRequests.filter(r=>isLocal(r.url)&&r.resourceType!=='media');
  report.mediaRequestCancellations=report.failedRequests.filter(r=>isLocal(r.url)&&r.resourceType==='media');
  report.externalRequestFailures=report.failedRequests.filter(r=>!isLocal(r.url));
  report.externalWebSockets=report.webSockets.filter(url=>{try{return new URL(url).host!==requestedUrl.host;}catch{return true;}});
  record('preview never opens a production multiplayer socket',report.externalWebSockets.length===0);
  record('no unhandled browser errors',report.pageErrors.length===0);
  record('no missing or rejected source assets',report.sourceHttpErrors.length===0);
  record('no failed source model, image or module requests',report.sourceRequestFailures.length===0);
  record('all source stops support native movement',report.checks.filter(c=>c.name.endsWith('native movement')).every(c=>c.passed));
  report.passed=report.checks.every(c=>c.passed);
}catch(error){report.passed=false;report.error=String(error?.stack||error);if(error?.readiness)report.readinessFailure=error.readiness;process.exitCode=1;}
finally{
  if(!report.passed&&page&&!page.isClosed()){
    try{await page.screenshot({path:resolve(output,'failure.png'),timeout:15000});report.failureScreenshot='failure.png';}catch(error){report.failureScreenshotError=String(error);}
    try{
      report.failureState=await Promise.race([
        page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,24000),loading:document.querySelector('#loading')?.textContent,preview:globalThis.__dequindrePreview?.snapshot?.()??null,profile:{...document.querySelector('#profile')?.dataset}})),
        new Promise((_,reject)=>setTimeout(()=>reject(Error('Failure state snapshot timed out')),5000)),
      ]);
    }catch(error){report.failureStateError=String(error);}
  }
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(browser)await browser.close();
}
console.log(JSON.stringify({passed:report.passed,mode:report.mode,productionAcceptance:false,output,checks:report.checks,pageErrors:report.pageErrors,httpErrors:report.httpErrors,error:report.error},null,2));
