/** Actual built island and native controls. UI reports are read-only snapshots;
 * no seeded storage, synthetic DOM input, scene edits, or performance waiver. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {createNativeTouchSequence} from './native-touch-sequence.mjs';

const game=resolve(import.meta.dirname,'..'),dist=resolve(game,'dist');
const layouts={desktop:{width:1280,height:800},'small-phone':{width:320,height:568},compact:{width:390,height:340}};
const layout=process.env.BELLE_CADILLAC_MODS_CASE||'desktop',variant=process.env.BELLE_CADILLAC_MODS_RIDE||'hydraulic-cadillac';
assert(Object.hasOwn(layouts,layout),'Unknown layout');
assert(['cadillac','hydraulic-cadillac'].includes(variant),'Unknown Cadillac variant');
const mobile=layout!=='desktop',viewport=layouts[layout],caseName=variant+'-'+layout;
const out=resolve(game,'output/cadillac-mods',caseName);
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90000});
const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
const source=process.env.CADILLAC_MODS_SOURCE_SHA||checkout;
assert.match(source,/^[0-9a-f]{40}$/);assert.equal(checkout,source,'Checkout must be the exact requested head');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={version:1,case:caseName,source,checkout,run:process.env.GITHUB_RUN_ID??null,viewport,mobile,
 passed:false,phase:'setup',startedAt:new Date().toISOString(),checks:{},snapshots:[],captures:[],errors:[],failedRequests:[],
 limitations:'Actual built full island on Chrome SwiftShader. Functional/layout screenshots and native input only; not physical-device, hardware FPS, sustained-performance, or completed human visual acceptance. Short Ride profile reports below are paused UI state snapshots, not performance samples. Existing release gates are unchanged.'};
await mkdir(out,{recursive:true});
const server=createCoopStaticServer(dist);let browser,page,context,client,touchSequence;
const phase=name=>{report.phase=name;console.log(new Date().toISOString()+' '+caseName+' '+name);};
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded its deadline')),ms);})]);}finally{clearTimeout(timer);}}
async function tap(locator){await locator.scrollIntoViewIfNeeded();if(mobile)await locator.tap();else await locator.click();}
async function openMenu(){if(!await page.locator('#ride-menu').isVisible())await tap(page.locator('#tools-toggle'));await expect(page.locator('#ride-menu')).toBeVisible();}
async function openMods(){
 if(!await page.locator('#settings').isVisible()){
  await openMenu();await tap(page.getByRole('button',{name:'Hydraulics, wheels & tires',exact:true}));
 }
 await expect(page.locator('#settings')).toBeVisible();
 if(await page.locator('#cadillac-modifications').getAttribute('open')===null)await tap(page.locator('#cadillac-modifications>summary'));
 await expect(page.locator('#cadillac-modifications')).toBeVisible();
}
async function closeSettings(){if(await page.locator('#settings').isVisible())await tap(page.locator('[data-close="settings"]'));await expect(page.locator('#settings')).not.toBeVisible();}

/** Use actual native key events on a real select, including its change handler. */
async function selectWithKeyboard(selector,value){
 const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await expect(control).toBeEnabled();
 const options=await control.locator('option').evaluateAll(items=>items.map(item=>item.value)),index=options.indexOf(value);
 assert(index>=0,selector+' contains '+value);
 await control.press('Home');for(let i=0;i<index;i++)await control.press('ArrowDown');await control.press('Enter');
 await expect(control).toHaveValue(value);
}
async function setReduced(value){
 const control=page.locator('#motion');await control.scrollIntoViewIfNeeded();
 if(await control.isChecked()!==value)await tap(control.locator('..'));
 assert.equal(await control.isChecked(),value);report.checks.reducedMotion=value;
}
async function setCorner(corner,targetCm){
 const control=page.locator('#cadillac-height-'+corner);await control.scrollIntoViewIfNeeded();await expect(control).toBeEnabled();
 const currentCm=Number(await control.inputValue())*100,current=Math.round(currentCm);
 assert(Number.isInteger(targetCm)&&Math.abs(current-currentCm)<1e-6,'Corner controls use whole centimeters');
 assert.equal(Number(await control.getAttribute('step')),.01);
 assert(targetCm>=Number(await control.getAttribute('min'))*100&&targetCm<=Number(await control.getAttribute('max'))*100);
 const direction=Math.sign(targetCm-current),key=direction>0?'ArrowRight':'ArrowLeft';
 // Never visit the slider minimum as a shortcut: an asymmetric low corner can
 // legitimately fail the real car's fender clearance check.
 for(let value=current;value!==targetCm;){value+=direction;await control.press(key);await expect(control).toHaveValue((value/100).toString());}
 await expect(control).toHaveValue((targetCm/100).toString());
 await expect(page.locator('#cadillac-height-'+corner+'-value')).toHaveText(targetCm+' cm');
}
const modButton=name=>page.locator('#cadillac-modifications').getByRole('button',{name,exact:true});

/** Existing user-facing diagnostics; starting/stopping the normal recorder is
 * deliberate native UI interaction. No application object is obtained or called. */
async function snapshot(label){
 await openMods();const summary=page.locator('#ride-profile>summary');
 if(await page.locator('#ride-profile').getAttribute('open')===null)await tap(summary);
 const stop=page.locator('#ride-profile').getByRole('button',{name:'Stop and show report',exact:true});
 if(!await stop.isVisible()){
  await tap(page.locator('#ride-profile').getByRole('button',{name:'Start Cadillac ride capture',exact:true}));
  await tap(summary);
 }
 await tap(stop);const data=JSON.parse(await page.getByLabel('Ride profile report',{exact:true}).inputValue());
 const car=data.settings?.cadillac;assert(car,'Real Ride profile report includes the Cadillac');
 assert.equal(car.vehicle,variant==='cadillac'?'silver-cadillac':variant);
 report.snapshots.push({label,at:new Date().toISOString(),cadillac:car,profile:data});return car;
}

async function targetProof(locator,label,ownerSelector){
 await locator.scrollIntoViewIfNeeded();
 const proof=await locator.evaluate((element,ownerSelector)=>{
  const r=element.getBoundingClientRect(),dialog=element.closest('dialog')?.getBoundingClientRect();
  const owner=ownerSelector?document.querySelector(ownerSelector):element;
  const points=[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]].map(([u,v])=>{
   const x=r.left+r.width*u,y=r.top+r.height*v,hit=document.elementFromPoint(x,y);
   return{x,y,receives:!!owner&&(hit===owner||owner.contains(hit)),covering:hit?.id||hit?.tagName};
  });
  return{label:element.getAttribute('aria-label')||element.textContent,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
   dialog:dialog?{left:dialog.left,top:dialog.top,right:dialog.right,bottom:dialog.bottom}:null,viewport:{width:innerWidth,height:innerHeight},points};
 },ownerSelector);
 const r=proof.rect;assert(r.width>=44&&r.height>=44,label+': touch target must be at least 44×44');
 assert(r.left>=0&&r.top>=0&&r.right<=proof.viewport.width+1&&r.bottom<=proof.viewport.height+1,label+': target escaped viewport');
 if(proof.dialog)assert(r.left>=proof.dialog.left&&r.top>=proof.dialog.top&&r.right<=proof.dialog.right+1&&r.bottom<=proof.dialog.bottom+1,label+': target clipped by scroll container');
 assert(proof.points.every(point=>point.receives),label+': obscured target '+JSON.stringify(proof.points));
 (report.checks.targets??=[]).push({label,...proof});return proof;
}
async function verifyEditorTargets(){
 await openMods();const controls=page.locator('#cadillac-modifications summary,#cadillac-modifications select,#cadillac-modifications input,#cadillac-modifications button');
 const count=await controls.count();assert.equal(count,16,'All editor controls must be inspected after scrolling');
 for(let i=0;i<count;i++)await targetProof(controls.nth(i),'modification-control-'+i);
 const overflow=await page.locator('#settings').evaluate(element=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
 assert(overflow.scrollWidth<=overflow.clientWidth+1,'Settings must not require horizontal scrolling');report.checks.settingsOverflow=overflow;
}

/** A completion fence observes the real submitted canvas. It does not modify
 * render settings, the scene, animation time, or the acceptance clock. */
async function painted(){
 const proof=await page.evaluate(()=>new Promise((yes,no)=>{
  const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');
  if(!gl||gl.isContextLost()||!canvas.width||!canvas.height)return no(Error('A live, nonempty game canvas is required'));
  const debug=gl.getExtension('WEBGL_debug_renderer_info'),renderer=gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
  const submittedAt=performance.now(),sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return no(Error('Missing GPU completion fence'));
  let frame=0,done=false;const deadline=setTimeout(()=>finish(Error('Canvas completion exceeded 45 seconds')),45000);gl.flush();
  function finish(error,value){if(done)return;done=true;clearTimeout(deadline);cancelAnimationFrame(frame);gl.deleteSync(sync);error?no(error):yes(value);}
  function poll(){
   if(gl.isContextLost())return finish(Error('Game WebGL context lost'));
   const status=gl.clientWaitSync(sync,0,0);
   if(status===gl.TIMEOUT_EXPIRED){frame=requestAnimationFrame(poll);return;}
   if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED)return finish(Error('Game GPU fence failed'));
   const completedAt=performance.now();frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>finish(null,{renderer,submittedAt,completedAt,paintOpportunities:2,width:canvas.width,height:canvas.height}));});
  }frame=requestAnimationFrame(poll);
 }));
 assert.match(proof.renderer,/SwiftShader/i,'This workflow records software WebGL honestly');return proof;
}
async function capture(name){
 const gpu=await painted(),file=name+'.png';const bytes=await page.screenshot({path:resolve(out,file),timeout:150000});
 report.captures.push({file,bytes:bytes.length,sha256:hash(bytes),viewport:page.viewportSize(),phase:report.phase,gpu});
}
async function editorCapture(name,selector){await page.locator(selector).first().scrollIntoViewIfNeeded();await capture(name);}
async function frames(count){
 const before=Number(await page.locator('#profile').getAttribute('data-active-frames'));assert(Number.isFinite(before));
 await page.waitForFunction(({before,count})=>Number(document.querySelector('#profile')?.dataset.activeFrames)>=before+count,{before,count},{timeout:90000});
}

async function wheelChecks(){
 phase('wheels-and-tires');await openMods();
 for(const rim of ['wire-gold','wire-chrome']){
  await selectWithKeyboard('#cadillac-mod-rim',rim);
  await selectWithKeyboard('#cadillac-mod-center',rim==='wire-gold'?'black':'white');
  for(const tire of ['whitewall','low-profile','low-profile-whitewall']){
   await selectWithKeyboard('#cadillac-mod-tire',tire);
   const car=await snapshot(rim+'-'+tire);assert.equal(car.wheels.rim,rim);assert.equal(car.wheels.tire,tire);
   assert.equal(car.wheels.spokesPerWheel,100);assert.equal(car.wheels.texturesAdded,0);assert.equal(car.wheels.customMeshes,8);
   assert.equal(car.wheels.sourceRestored,false);
  }
 }
 await editorCapture('chrome-low-profile-editor','#cadillac-mod-rim');await closeSettings();await frames(1);await capture('chrome-low-profile-car');
 await openMods();await selectWithKeyboard('#cadillac-mod-rim','stock');await selectWithKeyboard('#cadillac-mod-tire','standard');
 await expect(page.locator('#cadillac-mod-center')).toBeDisabled();
 const stock=await snapshot('original-wheels-restored');assert.equal(stock.wheels.sourceRestored,true);assert.equal(stock.wheels.customMeshes,0);
 await closeSettings();await frames(1);await capture('original-wheels-restored');report.checks.wheelsAndTires=true;
}

async function panelAction(action){await openMenu();await tap(page.locator('[data-cadillac-action="'+action+'"]'));await expect(page.locator('#ride-menu')).not.toBeVisible();await frames(2);}
async function silverPanels(open){
 if(variant!=='cadillac')return;
 phase(open?'open-silver-panels':'close-silver-panels');await closeSettings();
 await page.locator('#game').press('e');await frames(2);
 for(const action of ['trunk','rear-left','rear-right'])await panelAction(action);
 const car=await snapshot(open?'silver-panels-open':'silver-panels-closed');
 for(const part of ['trunk','rearLeft','rearRight']){
  assert.equal(car.access[part].open,open);assert(open?car.access[part].progress>.99:car.access[part].progress<.01,part+' reaches its requested pose');
 }
 assert(open?Math.abs(car.driverDoorRad)>.95:Math.abs(car.driverDoorRad)<.01,'Driver door reaches its requested pose');
 await closeSettings();await capture(open?'silver-panels-open':'silver-panels-closed');return car;
}

async function heightChecks(){
 phase('reduced-motion-static-heights');await openMods();
 for(const name of ['Full-car hop','Front hop','Rear hop'])await expect(modButton(name)).toBeDisabled();
 await tap(modButton('Raise'));let car=await snapshot('raise-while-settings-pauses-ride');
 for(const corner of ['FL','FR','RL','RR']){assert.equal(car.suspension.targets[corner],.14);assert.equal(car.suspension.current[corner],.14);}
 assert(car.suspension.settled&&car.suspension.readyForDrive);assert(car.suspension.pose.heave>.13);
 await tap(modButton('Lower'));car=await snapshot('lower-while-settings-pauses-ride');
 for(const corner of ['FL','FR','RL','RR'])assert.equal(car.suspension.current[corner],0);
 await tap(modButton('Raise'));
 await setCorner('FL',22);await setCorner('FR',18);await setCorner('RL',20);await setCorner('RR',16);
 car=await snapshot('independent-corners-apply-immediately');
 assert.deepEqual(car.suspension.current,{FL:.22,FR:.18,RL:.20,RR:.16});assert.deepEqual(car.suspension.current,car.suspension.targets);
 assert(car.suspension.settled&&!car.suspension.readyForDrive);assert(Math.abs(car.suspensionRollRad)>.001);assert(Math.abs(car.suspensionPitchRad)>.001);
 if(variant==='cadillac'){
  for(const part of ['trunk','rearLeft','rearRight'])assert(car.access[part].open&&car.access[part].progress>.99,'Static suspension preserves '+part);
  assert(Math.abs(car.driverDoorRad)>.95,'Static suspension preserves driver door');
 }
 await editorCapture('independent-corner-controls','#cadillac-height-FL');await editorCapture('suspension-actions','#cadillac-modifications .cadillac-mods-actions');
 await editorCapture('hop-actions','#cadillac-modifications .cadillac-mods-actions:last-of-type');
 await tap(modButton('Level corners'));car=await snapshot('level-at-selected-average');
 for(const corner of ['FL','FR','RL','RR'])assert(Math.abs(car.suspension.current[corner]-.19)<1e-8);
 assert(car.suspension.readyForDrive);await closeSettings();await frames(1);await capture('leveled-car');
 report.checks.immediateStaticHeights=true;report.checks.reducedMotionHopsDisabled=true;
}

async function hopChecks(){
 if(mobile){report.checks.animatedHops='Covered by both desktop variant cases; this case retains reduced motion.';return;}
 phase('animated-hops');await openMods();await setReduced(false);await tap(modButton('Raise'));await closeSettings();await frames(2);
 for(const [mode,name]of [['all','Full-car hop'],['front','Front hop'],['rear','Rear hop']]){
  await openMods();await expect(modButton(name)).toBeEnabled();
  const boundary=await page.evaluate(()=>window.__cadillacModsEvidence.states.length);
  await tap(modButton(name));await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('#cadillac-modifications-feedback')).toHaveText('Hydraulic hop started. Driving resumes after landing and leveling.');
  await capture(mode+'-hop-after-native-command');
  // The observer records the real editor's synchronous busy state, even when
  // a fast renderer completes the hop before the next automation round-trip.
  await expect.poll(async()=>page.evaluate(start=>{
   const states=window.__cadillacModsEvidence.states.slice(start),busy=states.findIndex(state=>state.busy);
   return busy>=0&&states.slice(busy+1).some(state=>!state.busy);
  },boundary)).toBe(true);
  await frames(30);const car=await snapshot(mode+'-hop-landed');
  assert.equal(car.suspension.hop,null);assert(car.suspension.settled&&car.suspension.readyForDrive);
  assert(Object.values(car.suspension.pose.wheelLifts).every(value=>value===0));
  report.checks[mode+'Hop']=await page.evaluate(start=>window.__cadillacModsEvidence.states.slice(start),boundary);
  await closeSettings();await capture(mode+'-hop-landed');
 }
 await openMods();await setReduced(true);
}

async function driveAfterLevel(){
 phase('finish-level-and-drive');await openMods();await tap(modButton('Raise'));await setCorner('FL',20);await setCorner('FR',16);
 await tap(modButton('Finish motion & level'));await expect(page.locator('#settings')).not.toBeVisible();await frames(3);
 let car=await snapshot('finish-motion-level');assert(car.suspension.readyForDrive);
 for(const corner of ['FL','FR','RL','RR'])assert(Math.abs(car.suspension.current[corner]-.16)<1e-8);
 await closeSettings();
 const speed=async()=>parseFloat(await page.locator('#speed').innerText());
 if(mobile){
  const proof=await targetProof(page.locator('#stick'),'native-driving-joystick','#touch-zone'),r=proof.rect;
  // The joystick is painted inside #touch-zone and deliberately pointer-events:none.
  const x=r.left+r.width/2,y=r.top+r.height/2;
  await touchSequence.dispatch('touchStart',[{id:1,x,y,radiusX:2,radiusY:2,force:1}]);
  await touchSequence.dispatch('touchMove',[{id:1,x,y:y-30,radiusX:2,radiusY:2,force:1}]);
  try{await expect.poll(speed).toBeGreaterThan(0);}finally{await touchSequence.dispatch('touchEnd',[]);}
 }else{
  await page.locator('#game').focus();await page.keyboard.down('w');
  try{await expect.poll(speed).toBeGreaterThan(0);}finally{await page.keyboard.up('w');}
 }
 report.checks.drivingSpeedMph=await speed();
 await page.locator('#game').focus();await page.keyboard.down('Space');
 try{await expect.poll(speed).toBe(0);}finally{await page.keyboard.up('Space');}
 car=await snapshot('drive-resumed-and-braked');assert(car.distanceM>.05);assert(car.suspension.readyForDrive);
 await closeSettings();await capture('drive-resumed');report.checks.drivingAfterLevel=true;
}

async function run(){
 const marker=JSON.parse(await readFile(resolve(dist,'cadillac-mods-build.json'),'utf8'));assert.equal(marker.sourceSha,source);
 assert.equal(marker.indexSha256,hash(await readFile(resolve(dist,'index.html'))));report.build=marker;
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browser=browser.version();
 context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(()=>{
  const evidence=window.__cadillacModsEvidence={input:[],states:[]};let last='';
  for(const type of ['click','keydown','input','change','pointerdown','pointerup'])document.addEventListener(type,event=>{
   if(evidence.input.length<2000)evidence.input.push({type,trusted:event.isTrusted,code:event.code??null,pointerType:event.pointerType??null,target:event.target?.id||event.target?.closest?.('button,label')?.textContent?.trim()?.slice(0,100)||event.target?.tagName,at:performance.now()});
  },true);
  new MutationObserver(()=>{
   const note=document.querySelector('#cadillac-modifications-note');if(!note)return;
   const state={busy:note.textContent.includes('Close Settings to let the suspension finish'),note:note.textContent,feedback:document.querySelector('#cadillac-modifications-feedback')?.textContent,settingsOpen:!!document.querySelector('#settings[open]')};
   const next=JSON.stringify(state);if(next!==last){last=next;evidence.states.push({...state,at:performance.now()});}
  }).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','open']});
 });
 page=await context.newPage();page.setDefaultTimeout(90000);client=await context.newCDPSession(page);touchSequence=createNativeTouchSequence((method,params)=>client.send(method,params));
 page.on('pageerror',error=>report.errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error'||/context.*lost/i.test(message.text()))report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
 page.on('requestfailed',request=>report.failedRequests.push({phase:report.phase,url:request.url(),type:request.resourceType(),error:request.failure()?.errorText}));
 phase('boot');await page.goto('http://127.0.0.1:'+server.address().port+'/?ride='+variant+'&profile=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');await tap(page.locator('#start'));
 await expect(page.locator('body')).not.toHaveClass(/at-start/);await expect(page.locator('#ride-mode')).toContainText('CADILLAC');
 await openMods();await setReduced(true);
 // Functional software-renderer fixture uses the ordinary Smooth setting. This
 // does not change any full-quality or sustained-performance acceptance suite.
 await selectWithKeyboard('#quality','smooth');await selectWithKeyboard('#fps','30');
 if(mobile){if(!await page.locator('#touch').isChecked())await tap(page.locator('#touch').locator('..'));await selectWithKeyboard('#joystick-mode','fixed');}
 await verifyEditorTargets();await editorCapture('modifications-menu','#cadillac-mod-rim');
 const baseline=await snapshot('initial-stock');assert(baseline.suspension.readyForDrive);assert.equal(baseline.wheels.sourceRestored,true);
 await closeSettings();await frames(2);await capture('original-car');
 await wheelChecks();await silverPanels(true);await heightChecks();await silverPanels(false);await hopChecks();await driveAfterLevel();
 report.nativeEvidence=await page.evaluate(()=>window.__cadillacModsEvidence);
 assert(report.nativeEvidence.input.length>0);assert(report.nativeEvidence.input.every(event=>event.trusted),'All observed input must originate in native browser input');
 if(mobile)assert(report.nativeEvidence.input.some(event=>event.type==='pointerdown'&&event.pointerType==='touch'),'Phone driving/navigation requires real touch receipt');
 await page.waitForLoadState('networkidle',{timeout:60000});assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.functionalPassed=true;
}

try{await bounded(run(),32*60000,'Cadillac modification case');}
catch(error){
 report.failurePhase=report.phase;report.errors.push(error.stack||String(error));
 if(page)try{report.nativeEvidence=await page.evaluate(()=>window.__cadillacModsEvidence);const file='failure.png';await page.screenshot({path:resolve(out,file),timeout:30000});report.failureScreenshot=file;}catch(captureError){report.errors.push('Failure screenshot: '+captureError.message);}
}
finally{
 phase('cleanup');if(touchSequence)try{report.touchCleanup=await bounded(touchSequence.cancelActive(),10000,'Native input cleanup');}catch(error){report.errors.push('Native input cleanup: '+error.message);}
 if(browser)try{await bounded(browser.close(),30000,'Browser cleanup');}catch(error){report.errors.push('Browser cleanup: '+error.message);}
 if(server.listening)try{await bounded(new Promise((yes,no)=>server.close(error=>error?no(error):yes())),10000,'Static server cleanup');}catch(error){report.errors.push('Static server cleanup: '+error.message);}
 report.passed=report.functionalPassed===true&&report.errors.length===0&&report.failedRequests.length===0;report.finishedAt=new Date().toISOString();
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,case:caseName,source,snapshots:report.snapshots.length,screenshots:report.captures.length,failurePhase:report.failurePhase??null,errors:report.errors,failedRequests:report.failedRequests}));
 if(!report.passed)process.exitCode=1;
}
