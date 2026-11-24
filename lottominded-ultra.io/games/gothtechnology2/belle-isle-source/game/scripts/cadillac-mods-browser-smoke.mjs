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
import {clickCadillacCommand} from './cadillac-native-command-click.mjs';

const game=resolve(import.meta.dirname,'..'),dist=resolve(game,'dist');
const layouts={desktop:{width:1280,height:800},'small-phone':{width:320,height:568},compact:{width:390,height:340}};
const layout=process.env.BELLE_CADILLAC_MODS_CASE||'desktop',variant=process.env.BELLE_CADILLAC_MODS_RIDE||'hydraulic-cadillac';
assert(Object.hasOwn(layouts,layout),'Unknown layout');
assert(['cadillac','hydraulic-cadillac'].includes(variant),'Unknown Cadillac variant');
/** Explicit environment selection only. Existing software cases remain the default. */
function cadillacBackendPolicy(requested,platform,layout){
 assert(['swiftshader','metal'].includes(requested),'Unknown Cadillac control renderer');
 if(requested==='metal'){
  assert.equal(platform,'darwin','The Metal control experiment requires macOS');
  assert.equal(layout,'desktop','The Metal control experiment is desktop-only');
  return{name:'metal',args:['--enable-gpu','--use-gl=angle','--use-angle=metal','--gpu-watchdog-timeout-seconds=60']};
 }
 return{name:'swiftshader',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']};
}
function assertCadillacBackend(renderer,requested){
 if(requested==='metal'){
  assert.match(renderer,/ANGLE/i,'The actual game canvas must identify the requested ANGLE backend');
  assert.match(renderer,/Metal/i,'The actual game canvas must use ANGLE/Metal');
  assert.doesNotMatch(renderer,/SwiftShader|llvmpipe|softpipe|software/i,'A software renderer cannot satisfy the Metal control experiment');
 }else assert.match(renderer,/SwiftShader/i,'This workflow records software WebGL honestly');
}
const backend=cadillacBackendPolicy(process.env.BELLE_CADILLAC_MODS_BACKEND??'swiftshader',process.platform,layout);
const mobile=layout!=='desktop',viewport=layouts[layout],caseName=variant+'-'+layout;
const out=resolve(game,'output/cadillac-mods',caseName);
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90000});
const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
const source=process.env.CADILLAC_MODS_SOURCE_SHA||checkout;
assert.match(source,/^[0-9a-f]{40}$/);assert.equal(checkout,source,'Checkout must be the exact requested head');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={version:2,case:caseName,source,checkout,run:process.env.GITHUB_RUN_ID??null,viewport,mobile,
 passed:false,phase:'setup',startedAt:new Date().toISOString(),checks:{},snapshots:[],captures:[],errors:[],failedRequests:[],startupWarnings:[],
 harness:{pointerActivations:0,diagnosticKeyboardActivations:0,explicitScrolls:0,alreadyVisibleScrolls:0,cooldownReports:0,cooldownReadinessPolls:0,snapshotTimings:[],commandClicks:[]},
 ...(backend.name==='metal'?{nativeEnvironment:{requestedBackend:'angle-metal',platform:process.platform,actualGpu:null,
  scope:'Isolated desktop control environment diagnostic at the unchanged Smooth/30 fixture. All original functional assertions and deadlines apply; this is not release-performance acceptance.'}}:{}),
 limitations:backend.name==='metal'?'Actual built full island on Chrome ANGLE/Metal at the unchanged Smooth/30 control fixture. Functional/layout screenshots and native input only; not physical-device, hardware FPS, sustained-performance, or completed human visual acceptance. Short Ride profile reports below are paused UI state snapshots, not performance samples. Existing release gates are unchanged.':'Actual built full island on Chrome SwiftShader. Functional/layout screenshots and native input only; not physical-device, hardware FPS, sustained-performance, or completed human visual acceptance. Short Ride profile reports below are paused UI state snapshots, not performance samples. Existing release gates are unchanged.'};
await mkdir(out,{recursive:true});
const server=createCoopStaticServer(dist);let browser,page,context,client,touchSequence;
const phase=name=>{report.phase=name;console.log(new Date().toISOString()+' '+caseName+' '+name);};
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded its deadline')),ms);})]);}finally{clearTimeout(timer);}}
// Pointer actions already scroll and perform their own visible/stable/hit/enabled
// checks. A separate scroll action repeats its animation-frame stability wait.
async function tap(locator){if(mobile)await locator.tap();else await locator.click();report.harness.pointerActivations++;}
// Only the existing, explicit command call sites use this guarded desktop path.
// A changed whitelist identity is fatal; it must never retry through locator.click.
async function commandTap(locator){
 if(mobile)return tap(locator);
 assert(await clickCadillacCommand({page,locator,targetProof,record:audit=>report.harness.commandClicks.push(audit)}),'Expected an actual whitelisted Cadillac command button');
 report.harness.pointerActivations++;
}
async function diagnosticActivate(locator){
 if(mobile)return tap(locator);
 // Repeated recorder/navigation controls use the ordinary keyboard path after
 // the initial pointer roundtrip. Keep native mouse input for every vehicle,
 // mode, hop, checkbox, and mesh command; mobile navigation still uses touch.
 await expect(locator).toBeVisible();await expect(locator).toBeEnabled();
 await locator.focus();await expect(locator).toBeFocused();await page.keyboard.press('Enter');
 report.harness.diagnosticKeyboardActivations++;
}
/** Read geometry before requesting an explicit scroll. Every later target proof
 * still checks all five hit points, size, and clipping. Scoped desktop commands
 * additionally inspect animation/identity and native receipts. No app state or
 * scroll is injected. */
async function scrollIfNeeded(locator){
 const contained=await locator.evaluate(element=>{
  const r=element.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;
  let left=0,top=0,right=innerWidth,bottom=innerHeight;
  for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement){
   const style=getComputedStyle(ancestor),bounds=ancestor.getBoundingClientRect();
   const sx=ancestor.offsetWidth?bounds.width/ancestor.offsetWidth:1,sy=ancestor.offsetHeight?bounds.height/ancestor.offsetHeight:1;
   const x=bounds.left+ancestor.clientLeft*sx,y=bounds.top+ancestor.clientTop*sy;
   if(/^(auto|scroll|hidden|clip)$/.test(style.overflowX)){left=Math.max(left,x);right=Math.min(right,x+ancestor.clientWidth*sx);}
   if(/^(auto|scroll|hidden|clip)$/.test(style.overflowY)){top=Math.max(top,y);bottom=Math.min(bottom,y+ancestor.clientHeight*sy);}
  }
  return r.left>=left&&r.top>=top&&r.right<=right&&r.bottom<=bottom;
 });
 if(contained)report.harness.alreadyVisibleScrolls++;
 else{await locator.scrollIntoViewIfNeeded();report.harness.explicitScrolls++;}
}
async function openMenu(activate=diagnosticActivate){if(!await page.locator('#ride-menu').isVisible())await activate(page.locator('#tools-toggle'));await expect(page.locator('#ride-menu')).toBeVisible();}
async function openMods(activate=diagnosticActivate){
 if(!await page.locator('#settings').isVisible()){
  await openMenu(activate);await activate(page.getByRole('button',{name:'Hydraulics, wheels & tires',exact:true}));
 }
 await expect(page.locator('#settings')).toBeVisible();
 if(await page.locator('#cadillac-modifications').getAttribute('open')===null)await activate(page.locator('#cadillac-modifications>summary'));
 await expect(page.locator('#cadillac-modifications')).toBeVisible();
}
async function closeSettings(activate=diagnosticActivate){if(await page.locator('#settings').isVisible())await activate(page.locator('[data-close="settings"]'));await expect(page.locator('#settings')).not.toBeVisible();}

/** Use actual native key events on a real select, including its change handler. */
async function selectWithKeyboard(selector,value){
 const control=page.locator(selector);await scrollIfNeeded(control);await expect(control).toBeEnabled();
 const options=await control.locator('option').evaluateAll(items=>items.map(item=>item.value)),index=options.indexOf(value);
 assert(index>=0,selector+' contains '+value);
 if(backend.name==='metal'){
  await selectWithMetalTypeahead(control,selector,value);return;
 }
 await control.press('Home');for(let i=0;i<index;i++)await control.press('ArrowDown');await control.press('Enter');
 await expect(control).toHaveValue(value);
}
/** Mac arrow keys open an OS popup that renderer key dispatch cannot navigate.
 * Native printable keys select through the closed control's own typeahead. */
async function selectWithMetalTypeahead(control,selector,value){
 assert.equal(process.platform,'darwin');assert.equal(layout,'desktop');
 assert(['#quality','#fps','#cadillac-mod-rim','#cadillac-mod-tire','#cadillac-mod-center'].includes(selector),'Only the existing desktop fixture selects may use native typeahead');
 const receipt={selector,expectedValue:value,method:'native-closed-select-typeahead',key:null,maximumPresses:null,before:null,attempts:[],events:[],passed:false,error:null};
 (report.nativeEnvironment.selects??=[]).push(receipt);
 let evidenceStart;
 try{
  const inventory=await control.evaluate(node=>{
   if(!(node instanceof HTMLSelectElement)||node.multiple||node.size>1)throw Error('A single native menu select is required');
   return {id:node.id,options:[...node.options].map(option=>({value:option.value,label:option.label.trim(),disabled:option.disabled||!!option.closest('optgroup')?.disabled}))};
  });
  assert.equal(inventory.id,selector.slice(1));assert(inventory.options.length>0&&inventory.options.length<=32,'Native select inventory must be bounded');
  const enabled=inventory.options.filter(option=>!option.disabled),targets=enabled.filter(option=>option.value===value);
  assert.equal(targets.length,1,'The requested value must identify one enabled option');
  const key=targets[0].label.charAt(0).toLowerCase();assert.match(key,/^[a-z0-9]$/,'The existing option label must start with a native printable key');
  const cycle=enabled.filter(option=>option.label.charAt(0).toLowerCase()===key);
  receipt.key=key;receipt.maximumPresses=cycle.length;receipt.enabledOptions=enabled;
  evidenceStart=await page.evaluate(()=>window.__cadillacModsEvidence.input.length);
  assert(evidenceStart+4+cycle.length*3<5000,'Native input evidence must have room for the entire selection');
  // Genuine blur resets Blink's previous typeahead session without a timed wait.
  await control.press('Tab');await expect(control).not.toBeFocused();
  await control.focus();await expect(control).toBeFocused();
  receipt.before=await control.inputValue();
  for(let attempt=0;attempt<cycle.length;attempt++){
   await control.press(key);await expect(control).toBeFocused();
   const selected=await control.inputValue();receipt.attempts.push({press:attempt+1,value:selected});
   if(selected===value)break;
  }
  await expect(control).toHaveValue(value);
  receipt.events=await page.evaluate(start=>window.__cadillacModsEvidence.input.slice(start),evidenceStart);
  const keyCode=/^[0-9]$/.test(key)?'Digit'+key:'Key'+key.toUpperCase();
  const keys=receipt.events.filter(event=>event.type==='keydown');
  assert.equal(keys.length,1+receipt.attempts.length,'Exactly the blur key and bounded character presses must be recorded');
  assert.equal(keys[0]?.code,'Tab');assert(keys.every(event=>event.trusted&&event.target===inventory.id),'Each native key must target the actual select');
  assert(keys.slice(1).every(event=>event.code===keyCode),'Only the planned printable character may select the value');
  const changes=receipt.events.filter(event=>event.type==='input'||event.type==='change');
  assert(changes.every(event=>event.trusted&&event.target===inventory.id),'Select changes must come from native browser input');
  if(receipt.before!==value||receipt.attempts.some(attempt=>attempt.value!==receipt.before)){
   assert(changes.some(event=>event.type==='input')&&changes.some(event=>event.type==='change'),'A changed selection must dispatch native input and change');
  }
  receipt.passed=true;
 }catch(error){receipt.error=String(error);throw error;}
 finally{
  if(evidenceStart!==undefined&&!receipt.events.length)receipt.events=await page.evaluate(start=>window.__cadillacModsEvidence.input.slice(start),evidenceStart).catch(()=>[]);
 }
}
async function setReduced(value){
 const control=page.locator('#motion');
 if(await control.isChecked()!==value)await tap(control.locator('..'));
 assert.equal(await control.isChecked(),value);report.checks.reducedMotion=value;
}
async function setCorner(corner,targetCm){
 const control=page.locator('#cadillac-height-'+corner);await scrollIfNeeded(control);await expect(control).toBeEnabled();
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
 const started=Date.now();await openMods(diagnosticActivate);const summary=page.locator('#ride-profile>summary');
 if(await page.locator('#ride-profile').getAttribute('open')===null)await diagnosticActivate(summary);
 const stop=page.locator('#ride-profile').getByRole('button',{name:'Stop and show report',exact:true});
 if(!await stop.isVisible()){
  await diagnosticActivate(page.locator('#ride-profile').getByRole('button',{name:'Start Cadillac ride capture',exact:true}));
  await diagnosticActivate(summary);
 }
 await diagnosticActivate(stop);const data=JSON.parse(await page.getByLabel('Ride profile report',{exact:true}).inputValue());
 const car=data.settings?.cadillac;assert(car,'Real Ride profile report includes the Cadillac');
 assert.equal(car.vehicle,variant==='cadillac'?'silver-cadillac':variant);
 report.harness.snapshotTimings.push({label,milliseconds:Date.now()-started,activation:mobile?'native touch':'native keyboard'});
 report.snapshots.push({label,at:new Date().toISOString(),cadillac:car,profile:data});return car;
}

async function targetProof(locator,label,ownerSelector){
 await scrollIfNeeded(locator);
 const proof=await locator.evaluate((element,ownerSelector)=>{
  const r=element.getBoundingClientRect(),dialog=element.closest('dialog')?.getBoundingClientRect(),panel=element.closest('#hydraulic-controls')?.getBoundingClientRect();
  const owner=ownerSelector?document.querySelector(ownerSelector):element;
  const points=[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]].map(([u,v])=>{
   const x=r.left+r.width*u,y=r.top+r.height*v,hit=document.elementFromPoint(x,y);
   return{x,y,receives:!!owner&&(hit===owner||owner.contains(hit)),covering:hit?.id||hit?.tagName};
  });
  return{label:element.getAttribute('aria-label')||element.textContent,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
   dialog:dialog?{left:dialog.left,top:dialog.top,right:dialog.right,bottom:dialog.bottom}:null,
   panel:panel?{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom}:null,viewport:{width:innerWidth,height:innerHeight},points};
 },ownerSelector);
 const r=proof.rect;assert(r.width>=44&&r.height>=44,label+': touch target must be at least 44×44');
 assert(r.left>=0&&r.top>=0&&r.right<=proof.viewport.width+1&&r.bottom<=proof.viewport.height+1,label+': target escaped viewport');
 if(proof.dialog)assert(r.left>=proof.dialog.left&&r.top>=proof.dialog.top&&r.right<=proof.dialog.right+1&&r.bottom<=proof.dialog.bottom+1,label+': target clipped by scroll container');
 if(proof.panel)assert(r.left>=proof.panel.left&&r.top>=proof.panel.top&&r.right<=proof.panel.right+1&&r.bottom<=proof.panel.bottom+1,label+': target clipped by hydraulic panel');
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
 assertCadillacBackend(proof.renderer,backend.name);
 if(backend.name==='metal')assert.equal(proof.renderer,report.nativeEnvironment.actualGpu?.renderer,'The completed capture must retain the verified game-canvas backend');
 return proof;
}
async function capture(name){
 const gpu=await painted(),file=name+'.png';const bytes=await page.screenshot({path:resolve(out,file),timeout:150000});
 report.captures.push({file,bytes:bytes.length,sha256:hash(bytes),viewport:page.viewportSize(),phase:report.phase,gpu});
}
async function editorCapture(name,selector){await scrollIfNeeded(page.locator(selector).first());await capture(name);}
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
 await commandTap(modButton('Raise'));let car=await snapshot('raise-while-settings-pauses-ride');
 for(const corner of ['FL','FR','RL','RR']){assert.equal(car.suspension.targets[corner],.14);assert.equal(car.suspension.current[corner],.14);}
 assert(car.suspension.settled&&car.suspension.readyForDrive);assert(car.suspension.pose.heave>.13);
 await commandTap(modButton('Lower'));car=await snapshot('lower-while-settings-pauses-ride');
 for(const corner of ['FL','FR','RL','RR'])assert.equal(car.suspension.current[corner],0);
 await commandTap(modButton('Raise'));
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
 await commandTap(modButton('Level corners'));car=await snapshot('level-at-selected-average');
 for(const corner of ['FL','FR','RL','RR'])assert(Math.abs(car.suspension.current[corner]-.19)<1e-8);
 assert(car.suspension.readyForDrive);await closeSettings();await frames(1);await capture('leveled-car');
 report.checks.immediateStaticHeights=true;report.checks.reducedMotionHopsDisabled=true;
}

async function hopChecks(){
 if(mobile){report.checks.animatedHops='Detailed-editor hop sequences are covered by both desktop variant cases; this phase retains reduced motion.';return;}
 phase('animated-hops');await openMods();await setReduced(false);await commandTap(modButton('Raise'));await closeSettings();await frames(2);
 for(const [mode,name]of [['all','Full-car hop'],['front','Front hop'],['rear','Rear hop']]){
  await openMods();await expect(modButton(name)).toBeEnabled();
  const boundary=await page.evaluate(()=>window.__cadillacModsEvidence.states.length);
  await commandTap(modButton(name));await expect(page.locator('#settings')).not.toBeVisible();
  await expect(page.locator('#cadillac-modifications-feedback')).toHaveText('Hydraulic hop started. Driving resumes after landing and leveling.');
  await capture(mode+'-hop-after-native-command');
  // The observer records the real editor's synchronous busy state, even when
  // a fast renderer completes the hop before the next automation round-trip.
  await expect.poll(async()=>page.evaluate(start=>{
   const states=window.__cadillacModsEvidence.states.slice(start),busy=states.findIndex(state=>state.busy);
   return busy>=0&&states.slice(busy+1).some(state=>!state.busy);
  },boundary)).toBe(true);
  // Keep the real game running while its ordinary controls reflect cooldown.
  // Reopening Settings for each poll can repeatedly pause every eligible frame
  // under a stalled renderer. Read the three real controls first, then obtain
  // the exact native report within this same unchanged polling deadline.
  let car;await expect.poll(async()=>{
   const readiness=await page.locator('#cadillac-modifications [data-cadillac-hop]').evaluateAll(buttons=>({
    count:buttons.length,enabled:buttons.every(button=>!button.disabled),settingsOpen:!!document.querySelector('#settings[open]'),
   }));
   report.harness.cooldownReadinessPolls++;
   assert.equal(readiness.count,3,'Read all three actual detailed hop controls');
   assert.equal(readiness.settingsOpen,false,'Cooldown readiness polling must leave the game unpaused');
   if(!readiness.enabled)return false;
   car=await snapshot(mode+'-hop-landed');report.harness.cooldownReports++;
   const ready=car.suspension.hop===null&&car.suspension.settled&&car.suspension.readyForDrive&&car.suspension.cooldown===0;
   // Do not hold a diagnostic modal open while waiting for simulation time.
   if(!ready)await closeSettings(diagnosticActivate);return ready;
  },{message:mode+' hop lands, levels, and completes its real cooldown',intervals:[1000,2000,5000]}).toBe(true);
  assert.equal(car.suspension.hop,null);assert(car.suspension.settled&&car.suspension.readyForDrive);
  assert.equal(car.suspension.cooldown,0);
  assert(Object.values(car.suspension.pose.wheelLifts).every(value=>value===0));
  report.checks[mode+'Hop']=await page.evaluate(start=>window.__cadillacModsEvidence.states.slice(start),boundary);
  await closeSettings();await capture(mode+'-hop-landed');
 }
 await openMods();await setReduced(true);
}

const smartPoses={
 'front-up':{FL:.22,FR:.22,RL:.14,RR:.14},
 'back-up':{FL:.14,FR:.14,RL:.22,RR:.22},
 pancake:{FL:0,FR:0,RL:0,RR:0},
};
const modeRoot=()=>page.locator('#hydraulic-controls');
async function evidenceLength(key){return page.evaluate(key=>window.__cadillacModsEvidence[key].length,key);}
async function motionCycle(key,start,label){
 await expect.poll(()=>page.evaluate(({key,start})=>{
  const states=window.__cadillacModsEvidence[key].slice(start),moving=states.findIndex(state=>state.busy);
  return moving>=0&&states.slice(moving+1).some(state=>!state.busy);
 },{key,start}),{message:label+' must move and then settle'}).toBe(true);
 const states=await page.evaluate(({key,start})=>window.__cadillacModsEvidence[key].slice(start),{key,start});
 (report.checks.hydraulicMotion??=[]).push({label,states});return states;
}
function assertSmartPose(car,pose){
 assert.deepEqual(car.suspension.targets,smartPoses[pose],pose+' sets all four intended targets');
 for(const corner of Object.keys(smartPoses[pose]))assert(Math.abs(car.suspension.current[corner]-smartPoses[pose][corner])<1e-8,pose+' settles '+corner);
 assert.equal(car.suspension.settled,true);assert.equal(car.hydraulicSwitches.activePose,pose,'The physical switch indication agrees with the targets');
}
async function modeSnapshot(label,{inside=false}={}){
 const car=await snapshot(label),controls=report.snapshots.at(-1).profile.settings.hydraulicControls;
 assert(controls,'Ride Profile exposes read-only hydraulic controls diagnostics');
 assert.equal(controls.active,true);assert.equal(controls.inside,inside);assert.equal(controls.blocked,true,'The open Settings report genuinely blocks cabin input');
 await expect(modeRoot()).not.toBeVisible();await closeSettings(diagnosticActivate);await expect(modeRoot()).toBeVisible();return{car,controls};
}
async function setModeCorner(corner,targetCm){
 const control=page.locator('#hydraulic-corner-'+corner);await scrollIfNeeded(control);await expect(control).toBeEnabled();
 const raw=Number(await control.inputValue())*100,current=Math.round(raw);assert(Math.abs(raw-current)<1e-6);assert.equal(Number(await control.getAttribute('step')),.01);
 assert(Number.isInteger(targetCm)&&targetCm>=0&&targetCm<=24);
 const direction=Math.sign(targetCm-current),key=direction>0?'ArrowRight':'ArrowLeft';
 for(let value=current;value!==targetCm;){value+=direction;await control.press(key);await expect(control).toHaveValue(String(value/100));}
 await expect(control).toHaveAttribute('aria-valuetext',new RegExp('^'+targetCm+' cm target'));
}
async function verifyModeTargets(){
 const advanced=page.locator('#hydraulic-advanced-corners');if(await advanced.getAttribute('open')===null)await tap(advanced.locator('summary'));
 const controls=page.locator('#hydraulic-outside-controls button,#hydraulic-outside-controls summary,#hydraulic-outside-controls input');
 const count=await controls.count();assert.equal(count,13,'Inspect every radial, hop, disclosure, and corner control');
 for(let i=0;i<count;i++)await targetProof(controls.nth(i),'hydraulic-mode-control-'+i);
 const size=await modeRoot().evaluate(element=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,height:element.getBoundingClientRect().height,viewportHeight:innerHeight}));
 assert(size.scrollWidth<=size.clientWidth+1,'Hydraulic panel must not scroll horizontally');assert(size.height< size.viewportHeight,'Hydraulic panel leaves part of the playfield visible');
 report.checks.hydraulicPanelBounds=size;
}
async function tapPoint(point){
 if(mobile){
  await touchSequence.dispatch('touchStart',[{id:7,x:point.clientX,y:point.clientY,radiusX:2,radiusY:2,force:1}]);
  await touchSequence.dispatch('touchEnd',[]);
 }else await page.mouse.click(point.clientX,point.clientY);
}
async function dragPoint(point,dx,dy=0){
 if(mobile){
  await touchSequence.dispatch('touchStart',[{id:7,x:point.clientX,y:point.clientY,radiusX:2,radiusY:2,force:1}]);
  for(let step=1;step<=8;step++)await touchSequence.dispatch('touchMove',[{id:7,x:point.clientX+dx*step/8,y:point.clientY+dy*step/8,radiusX:2,radiusY:2,force:1}]);
  await touchSequence.dispatch('touchEnd',[]);
 }else{
  await page.mouse.move(point.clientX,point.clientY);await page.mouse.down();
  try{await page.mouse.move(point.clientX+dx,point.clientY+dy,{steps:8});}finally{await page.mouse.up();}
 }
}
async function canvasPointProof(point,label){
 assert(Number.isFinite(point.clientX)&&Number.isFinite(point.clientY)&&point.clientX>=0&&point.clientY>=0&&point.clientX<viewport.width&&point.clientY<viewport.height,label+' is in the actual viewport');
 const proof=await page.evaluate(({clientX,clientY})=>{
  const hit=document.elementFromPoint(clientX,clientY);return{clientX,clientY,receiver:hit?.id??hit?.tagName};
 },point);
 assert.equal(proof.receiver,'game',label+' must reach the real canvas, without a covering HUD');
 (report.checks.cabinPointerTargets??=[]).push({label,...proof});return proof;
}
async function cabinChecks(){
 phase('hydraulic-first-person-controls');await tap(page.locator('#view'));
 await expect(modeRoot()).toHaveAttribute('data-view','inside');await expect(page.locator('#hydraulic-outside-controls')).not.toBeVisible();
 await expect(page.locator('#hydraulic-inside-hint')).toBeVisible();await expect(page.locator('#hydraulic-corner-FL')).not.toBeVisible();
 await expect(page.locator('#hydraulic-corner-FL')).toBeDisabled();await targetProof(page.locator('#hydraulic-inside-exit'),'hydraulic-first-person-exit');
 const hudActions=page.locator('#ridehud .actions button');assert.equal(await hudActions.count(),4);
 for(let i=0;i<4;i++)await targetProof(hudActions.nth(i),'hydraulic-first-person-hud-action-'+i);
 await frames(3);await capture('hydraulic-first-person-hint');
 let sample;
 for(const [key,pose]of [['7','front-up'],['8','back-up'],['9','pancake']]){
  // Native keys deliberately arrive while the FPP Exit button owns focus;
  // forcing focus to the canvas here would conceal the shortcut regression.
  await page.locator('#hydraulic-inside-exit').press(key);await expect(page.locator('#hydraulic-inside-exit')).toBeFocused();
  await expect(page.locator('#hydraulic-controls-feedback')).toContainText('Smart Pump:');
  // The faster diagnostic keyboard path must not rely on incidental pointer
  // actionability waits to present the new body pose and cockpit camera.
  await frames(1);
  sample=await modeSnapshot('hydraulic-cabin-key-'+key,{inside:true});assertSmartPose(sample.car,pose);
 }
 // Key 9's report already contains the live projections at this exact parked,
 // reduced-motion pose. No input or view change intervenes before the first tap.
 assert(sample?.controls,'The final keyboard report includes live switch projections');
 report.checks.cabinProjectionSource='hydraulic-cabin-key-9';
 for(const pose of ['front-up','back-up','pancake']){
  const point=sample.controls.switches.find(item=>item.pose===pose);assert(point,'Profile includes '+pose+' grip');
  assert.equal(point.inViewport,true);assert.equal(point.reachableWhenSettingsClosed,true,pose+' is reachable through the normal scene picker');
  await canvasPointProof(point,'native-'+pose+'-grip');await tapPoint(point);
  await frames(1);
  sample=await modeSnapshot('hydraulic-native-cabin-'+pose,{inside:true});assertSmartPose(sample.car,pose);
 }
 await capture('hydraulic-native-cabin-switches');
 // A real drag starting on a switch must cancel its pending tap. The unchanged
 // targets and active physical indication are checked in the normal report.
 const grip=sample.controls.switches.find(item=>item.pose==='front-up');await canvasPointProof(grip,'switch-drag-start');
 const dx=grip.clientX+28<viewport.width-8?28:-28;await dragPoint(grip,dx);await frames(2);
 const dragged=await modeSnapshot('hydraulic-switch-drag-rejected',{inside:true});assertSmartPose(dragged.car,'pancake');
 // Choose an unobstructed canvas patch using DOM geometry only. Camera changes
 // come from this native gesture, never from a scene object or injected state.
 const start=await page.evaluate(switches=>{
  const candidates=[];
  for(const x of [.15,.5,.85])for(const y of [.45,.6,.75]){
   const clientX=innerWidth*x,clientY=innerHeight*y,dx=x<.5?36:-36;
   if(document.elementFromPoint(clientX,clientY)?.id!=='game'||document.elementFromPoint(clientX+dx,clientY)?.id!=='game')continue;
   const distance=Math.min(...switches.map(item=>Math.hypot(item.clientX-clientX,item.clientY-clientY)));
   if(distance>50)candidates.push({clientX,clientY,dx,distance});
  }
  return candidates.sort((a,b)=>b.distance-a.distance)[0]??null;
 },dragged.controls.switches);
 assert(start,'An exposed canvas patch is available for camera look');await canvasPointProof(start,'native-camera-drag-start');
 await dragPoint(start,start.dx);await frames(3);const looked=await modeSnapshot('hydraulic-camera-drag-no-command',{inside:true});assertSmartPose(looked.car,'pancake');
 assert(looked.controls.switches.some(item=>{const before=dragged.controls.switches.find(previous=>previous.pose===item.pose);return Math.hypot(item.clientX-before.clientX,item.clientY-before.clientY)>1;}),'The native camera drag changes the real projected switch positions');
 report.checks.nativeCabinSwitches={poses:['front-up','back-up','pancake'],input:mobile?'native touch':'native mouse',switchDragRejected:true,cameraDragNoCommand:true,
  note:'Physical grip meshes use real-sized hit surfaces. The 44px DOM target requirement is verified separately for accessible overlay controls.'};
 await page.locator('#hydraulic-inside-exit').press('h');await expect(modeRoot()).not.toBeVisible();await expect(page.locator('#game')).toBeFocused();
 await expect(page.locator('body')).not.toHaveClass(/belle-hydraulic-mode/);
 if(mobile)await expect(page.locator('#touch-zone')).toBeVisible();
 await page.locator('#game').press('7');await frames(2);const off=await snapshot('hydraulic-mode-off-key-ignored');assertSmartPose(off,'pancake');await closeSettings();
 // The ordinary view button also resets the native look offset for the next
 // third-person phase; no diagnostic camera setter is used.
 await tap(page.locator('#view'));await expect(page.locator('#view')).toHaveAttribute('aria-pressed','false');
 report.checks.hydraulicViewGating=true;report.checks.hydraulicKeyboardPoses=true;
}

async function hydraulicModeChecks(){
 phase('smooth-settings-preview');await openMods();await setReduced(true);await commandTap(modButton('Lower'));await setReduced(false);
 let boundary=await evidenceLength('states');await commandTap(modButton('Raise'));await expect(page.locator('#settings')).toBeVisible();
 const preview=await motionCycle('states',boundary,'Detailed Settings lift');
 assert(preview.some(state=>state.busy&&state.settingsOpen),'A normal lift advances while Settings remains open');
 let car=await snapshot('normal-motion-settings-preview');assert(car.suspension.settled);for(const value of Object.values(car.suspension.current))assert(Math.abs(value-.14)<1e-8);
 boundary=await evidenceLength('states');await commandTap(modButton('Lower'));await motionCycle('states',boundary,'Detailed Settings lower');await closeSettings();
 phase('hydraulic-mode-third-person');await expect(modeRoot()).not.toBeVisible();await expect(page.locator('body')).not.toHaveClass(/belle-hydraulic-mode/);
 if(await page.locator('#view').getAttribute('aria-pressed')==='true')await tap(page.locator('#view'));
 await openMenu();await targetProof(page.locator('#hydraulic-mode-toggle'),'hydraulic-mode-menu-toggle');await tap(page.locator('#hydraulic-mode-toggle'));
 await expect(page.locator('#ride-menu')).not.toBeVisible();await expect(modeRoot()).toBeVisible();await expect(modeRoot()).toHaveAttribute('data-view','outside');
 await expect(page.locator('body')).toHaveClass(/belle-hydraulic-mode/);
 const movementSurface=await page.locator('#touch-zone').evaluate(element=>({visibility:getComputedStyle(element).visibility,pointerEvents:getComputedStyle(element).pointerEvents}));
 assert.deepEqual(movementSurface,{visibility:'hidden',pointerEvents:'none'});report.checks.hydraulicMovementSurface=movementSurface;
 await capture('hydraulic-mode-radial');
 await openMenu();await expect(modeRoot()).not.toBeVisible();await tap(page.locator('[data-close="ride-menu"]'));await expect(modeRoot()).toBeVisible();
 for(const pose of ['front-up','back-up','pancake']){
  boundary=await evidenceLength('modeStates');await commandTap(page.locator('#hydraulic-'+pose));
  const states=await motionCycle('modeStates',boundary,'Smart Pump '+pose);
  if(pose==='front-up')assert(states.some(state=>state.busy&&Object.values(state.corners).some(corner=>corner.currentCm!==null&&corner.currentCm<corner.targetCm)),
   'The actual UI must expose a current height below its accepted target during a normal lift');
  await expect(page.locator('#hydraulic-'+pose)).toBeFocused();
  ({car}=await modeSnapshot('hydraulic-mode-'+pose));assertSmartPose(car,pose);
 }
 // A native Enter on the second button avoids an extra pointer-stability wait
 // while the first lift runs. Capture its pre-command visible motion state.
 boundary=await evidenceLength('modeStates');const inputBoundary=await evidenceLength('input');
 await commandTap(page.locator('#hydraulic-front-up'));await page.locator('#hydraulic-back-up').press('Enter');await motionCycle('modeStates',boundary,'Native in-flight retarget');
 const retarget=await page.evaluate(start=>window.__cadillacModsEvidence.input.slice(start).find(event=>event.type==='keydown'&&event.code==='Enter'&&event.target==='hydraulic-back-up'),inputBoundary);
 assert(retarget&&retarget.modeMotion==='moving','The native Back up activation must retarget an unfinished lift');
 ({car}=await modeSnapshot('hydraulic-mode-retarget'));assertSmartPose(car,'back-up');report.checks.hydraulicRetargetInput=retarget;
 await openMods();await commandTap(modButton('Raise'));await expect(page.locator('#cadillac-modifications')).toHaveAttribute('data-motion','idle');await closeSettings();
 boundary=await evidenceLength('modeStates');await commandTap(page.locator('#hydraulic-hop-all'));
 const hopStates=await motionCycle('modeStates',boundary,'Hydraulic Mode full hop');
 assert(hopStates.some(state=>state.motion==='hop'&&state.poseLocked&&state.cornersLocked&&state.hopsLocked),'A live mode hop locks conflicting controls');
 ({car}=await modeSnapshot('hydraulic-mode-hop-landed'));assert.equal(car.suspension.hop,null);assert(car.suspension.settled&&car.suspension.readyForDrive);
 assert(Object.values(car.suspension.pose.wheelLifts).every(value=>value===0));
 await verifyModeTargets();
 for(const [corner,height]of [['FL',22],['FR',18],['RL',20],['RR',16]])await setModeCorner(corner,height);
 await expect(modeRoot()).toHaveAttribute('data-motion','still');({car}=await modeSnapshot('hydraulic-mode-independent-corners'));
 assert.deepEqual(car.suspension.current,{FL:.22,FR:.18,RL:.20,RR:.16});assert.deepEqual(car.suspension.targets,car.suspension.current);
 await scrollIfNeeded(page.locator('#hydraulic-corner-FL'));await capture('hydraulic-advanced-front-corners');
 await scrollIfNeeded(page.locator('#hydraulic-corner-RR'));await capture('hydraulic-advanced-rear-corners');
 await commandTap(page.locator('#hydraulic-settle'));await expect(modeRoot()).toHaveAttribute('data-motion','still');({car}=await modeSnapshot('hydraulic-mode-finish-level'));
 for(const value of Object.values(car.suspension.current))assert(Math.abs(value-.19)<1e-8);assert(car.suspension.readyForDrive);
 await openMods();await setReduced(true);await closeSettings();
 for(const mode of ['all','front','rear'])await expect(page.locator('#hydraulic-hop-'+mode)).toBeDisabled();
 await expect(page.locator('#hydraulic-front-up')).toBeEnabled();await expect(page.locator('#hydraulic-corner-FL')).toBeEnabled();
 await commandTap(page.locator('#hydraulic-pancake'));({car}=await modeSnapshot('hydraulic-mode-reduced-pancake'));assertSmartPose(car,'pancake');
 await cabinChecks();
 phase('hydraulic-mode-holds-driving');await page.locator('#game').focus();await page.keyboard.press('h');await expect(modeRoot()).toBeVisible();
 await page.locator('#hydraulic-front-up').press('Escape');await expect(modeRoot()).not.toBeVisible();await expect(page.locator('#game')).toBeFocused();
 await page.keyboard.press('h');await expect(modeRoot()).toBeVisible();
 await commandTap(page.locator('#hydraulic-front-up'));const before=await modeSnapshot('hydraulic-mode-before-held-drive');assertSmartPose(before.car,'front-up');
 await page.locator('#game').focus();await page.keyboard.down('w');
 try{await frames(12);assert.equal(parseFloat(await page.locator('#speed').innerText()),0);}finally{await page.keyboard.up('w');}
 const held=await modeSnapshot('hydraulic-mode-held-drive');assertSmartPose(held.car,'front-up');
 assert(Math.abs(held.car.distanceM-before.car.distanceM)<1e-8,'Held accelerator cannot propel the car in Hydraulic Mode');
 assert.equal(held.car.speedMps,0);assert.equal(held.car.suspension.readyForDrive,false,'Held controls cannot silently level the selected uneven pose');
 await commandTap(page.locator('#hydraulic-exit'));await expect(modeRoot()).not.toBeVisible();await expect(page.locator('body')).not.toHaveClass(/belle-hydraulic-mode/);
 await page.locator('#game').focus();await page.keyboard.down('w');
 try{await expect.poll(async()=>parseFloat(await page.locator('#speed').innerText())).toBeGreaterThan(0);}finally{await page.keyboard.up('w');}
 await page.keyboard.down('Space');try{await expect.poll(async()=>parseFloat(await page.locator('#speed').innerText())).toBe(0);}finally{await page.keyboard.up('Space');}
 car=await snapshot('hydraulic-mode-exit-restores-driving');assert(car.distanceM>held.car.distanceM+.01);assert(car.suspension.readyForDrive);
 await closeSettings();report.checks.hydraulicModeHoldsDriving={distanceBefore:before.car.distanceM,distanceHeld:held.car.distanceM,distanceAfterExit:car.distanceM};
 report.checks.hydraulicMode=true;report.checks.smoothSettingsPreview=true;
}

async function driveAfterLevel(){
 phase('finish-level-and-drive');await openMods();await commandTap(modButton('Raise'));await setCorner('FL',20);await setCorner('FR',16);
 await commandTap(modButton('Finish motion & level'));await expect(page.locator('#settings')).not.toBeVisible();await frames(3);
 let car=await snapshot('finish-motion-level');assert(car.suspension.readyForDrive);
 assert.equal(car.speedMps,0,'The final driving check starts from rest');
 for(const corner of ['FL','FR','RL','RR'])assert(Math.abs(car.suspension.current[corner]-.16)<1e-8);
 await closeSettings();
 const speed=async()=>parseFloat(await page.locator('#speed').innerText());
 const drivingHud=async()=>page.evaluate(()=>({
  speedMph:parseFloat(document.getElementById('speed')?.textContent??''),
  activeFrames:Number(document.getElementById('profile')?.dataset.activeFrames??NaN),
  settingsOpen:document.getElementById('settings')?.open??true
 }));
 let drivingFramesBefore,drivingObservation;
 const captureDrivingStart=async()=>{
  const state=await drivingHud();assert(!state.settingsOpen,'Driving is observed with Settings closed');
  assert(Number.isSafeInteger(state.activeFrames)&&state.activeFrames>=0,'Active-frame UI counter is required');
  drivingFramesBefore=state.activeFrames;
 };
 // Rounded 1 MPH can appear after only 0.019 m on the compact joystick.
 // Keep real input held until a fresh 2 MPH HUD update before braking. From
 // rest, the controller's 3.9 m/s² acceleration bound requires >0.05 m to
 // reach the 1.5 MPH rounding boundary. The original poll deadline remains.
 const drivingSpeed=async()=>{
  const state=await drivingHud();assert(!state.settingsOpen,'Driving is observed with Settings closed');
  assert(Number.isSafeInteger(state.activeFrames)&&Number.isFinite(state.speedMph),'Fresh driving HUD values are required');
  drivingObservation=state;return state.activeFrames>drivingFramesBefore?state.speedMph:0;
 };
 if(mobile){
  const proof=await targetProof(page.locator('#stick'),'native-driving-joystick','#touch-zone'),r=proof.rect;
  // The joystick is painted inside #touch-zone and deliberately pointer-events:none.
  const x=r.left+r.width/2,y=r.top+r.height/2;
  await captureDrivingStart();
  await touchSequence.dispatch('touchStart',[{id:1,x,y,radiusX:2,radiusY:2,force:1}]);
  await touchSequence.dispatch('touchMove',[{id:1,x,y:y-30,radiusX:2,radiusY:2,force:1}]);
  try{await expect.poll(drivingSpeed).toBeGreaterThanOrEqual(2);}finally{await touchSequence.dispatch('touchEnd',[]);}
 }else{
  await page.locator('#game').focus();await captureDrivingStart();await page.keyboard.down('w');
  try{await expect.poll(drivingSpeed).toBeGreaterThanOrEqual(2);}finally{await page.keyboard.up('w');}
 }
 report.checks.drivingExposure={minimumDisplayedMph:2,activeFramesBefore:drivingFramesBefore,observed:drivingObservation};
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
 browser=await chromium.launch({channel:'chrome',headless:false,args:backend.args});
 report.browser=browser.version();
 context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(()=>{
  const evidence=window.__cadillacModsEvidence={input:[],states:[],modeStates:[],startupStates:[]};let last='',lastMode='',lastStartup='';
  const recordStartup=reason=>{
   const welcome=document.querySelector('#welcome'),start=document.querySelector('#start');if(!welcome||!start)return;
   const state={welcomeState:welcome.dataset.state??null,welcomeHidden:welcome.hidden,atStart:document.body.classList.contains('at-start'),
    loading:document.querySelector('#loading')?.textContent??null,startLabel:document.querySelector('#start-label')?.textContent??null,startDisabled:start.disabled};
   const next=JSON.stringify(state);if(reason==='mutation'&&next===lastStartup)return;lastStartup=next;
   if(evidence.startupStates.length>=128)evidence.startupStates.shift();
   evidence.startupStates.push({...state,reason,at:performance.now()});
  };
  for(const type of ['click','keydown','input','change','pointerdown','pointerup'])document.addEventListener(type,event=>{
   if(evidence.input.length<5000)evidence.input.push({type,trusted:event.isTrusted,code:event.code??null,pointerType:event.pointerType??null,target:event.target?.id||event.target?.closest?.('button,label')?.textContent?.trim()?.slice(0,100)||event.target?.tagName,
    modeMotion:document.querySelector('#hydraulic-controls')?.getAttribute('data-motion')??null,modeActive:document.body?.classList.contains('belle-hydraulic-mode')??false,at:performance.now()});
   if(type==='click'&&event.target?.closest?.('#start'))recordStartup('start-click');
  },true);
  new MutationObserver(()=>{
   recordStartup('mutation');
   const note=document.querySelector('#cadillac-modifications-note'),mods=document.querySelector('#cadillac-modifications');
   if(note&&mods){
    const motion=mods.getAttribute('data-motion')??'idle';
    const state={busy:motion!=='idle',motion,note:note.textContent,feedback:document.querySelector('#cadillac-modifications-feedback')?.textContent,settingsOpen:!!document.querySelector('#settings[open]')};
    const next=JSON.stringify(state);if(next!==last){last=next;evidence.states.push({...state,at:performance.now()});}
   }
   const root=document.querySelector('#hydraulic-controls');if(!root)return;
   const motion=root.getAttribute('data-motion')??'still',corners={};
   for(const corner of ['FL','FR','RL','RR']){
    const input=document.querySelector('#hydraulic-corner-'+corner),spoken=input?.getAttribute('aria-valuetext')??'',current=spoken.match(/currently (-?\d+) cm/);
    const targetCm=input?Math.round(Number(input.value)*100):null;
    corners[corner]={targetCm,currentCm:current?Number(current[1]):spoken?targetCm:null,spoken};
   }
   const state={busy:motion!=='still',motion,active:document.body.classList.contains('belle-hydraulic-mode'),hidden:root.hidden,view:root.getAttribute('data-view'),
    poseLocked:document.querySelector('#hydraulic-front-up')?.disabled??true,cornersLocked:document.querySelector('#hydraulic-corner-FL')?.disabled??true,
    hopsLocked:['all','front','rear'].every(mode=>document.querySelector('#hydraulic-hop-'+mode)?.disabled),
    corners,feedback:document.querySelector('#hydraulic-controls-feedback')?.textContent,settingsOpen:!!document.querySelector('#settings[open]')};
   const next=JSON.stringify(state);if(next!==lastMode){lastMode=next;evidence.modeStates.push({...state,at:performance.now()});}
  }).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','open','hidden','data-state','data-motion','data-view','aria-valuetext','class']});
 });
 page=await context.newPage();page.setDefaultTimeout(90000);client=await context.newCDPSession(page);touchSequence=createNativeTouchSequence((method,params)=>client.send(method,params));
 page.on('pageerror',error=>report.errors.push(error.stack||error.message));
 page.on('console',message=>{
  if(message.type()==='error'||/context.*lost/i.test(message.text()))report.errors.push(message.text());
  if(message.type()==='warning'&&message.text().startsWith('Selected ride preparation failed')&&report.startupWarnings.length<8)
   report.startupWarnings.push({at:new Date().toISOString(),phase:report.phase,message:message.text()});
 });
 page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
 page.on('requestfailed',request=>report.failedRequests.push({phase:report.phase,url:request.url(),type:request.resourceType(),error:request.failure()?.errorText}));
 phase('boot');await page.goto('http://127.0.0.1:'+server.address().port+'/?ride='+variant+'&profile=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 if(backend.name==='metal'){
  const actual=await page.locator('#game').evaluate(canvas=>{
   const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost()||!canvas.width||!canvas.height)throw Error('A live, nonempty game WebGL2 canvas is required');
   const debug=gl.getExtension('WEBGL_debug_renderer_info');return{
    vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
    renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),
    version:String(gl.getParameter(gl.VERSION)),width:canvas.width,height:canvas.height};
  });
  report.nativeEnvironment.actualGpu=actual;assertCadillacBackend(actual.renderer,backend.name);
 }
 await tap(page.locator('#start'));
 await expect(page.locator('body')).not.toHaveClass(/at-start/);await expect(page.locator('#ride-mode')).toContainText('CADILLAC');
 await openMods(tap);await setReduced(true);
 // Functional control fixture uses the ordinary Smooth setting. This
 // does not change any full-quality or sustained-performance acceptance suite.
 await selectWithKeyboard('#quality','smooth');await selectWithKeyboard('#fps','30');
 if(mobile){if(!await page.locator('#touch').isChecked())await tap(page.locator('#touch').locator('..'));await selectWithKeyboard('#joystick-mode','fixed');}
 await verifyEditorTargets();await editorCapture('modifications-menu','#cadillac-mod-rim');
 const baseline=await snapshot('initial-stock');assert(baseline.suspension.readyForDrive);assert.equal(baseline.wheels.sourceRestored,true);
 // Retain the initial complete mouse/touch menu roundtrip before keyboard
 // navigation avoids repeating the same desktop stability-frame waits.
 await closeSettings(tap);await frames(2);await capture('original-car');
 await wheelChecks();await silverPanels(true);await heightChecks();await silverPanels(false);await hopChecks();await hydraulicModeChecks();await driveAfterLevel();
 report.nativeEvidence=await page.evaluate(()=>window.__cadillacModsEvidence);
 assert(report.nativeEvidence.input.length>0);assert(report.nativeEvidence.input.every(event=>event.trusted),'All observed input must originate in native browser input');
 if(mobile)assert(report.nativeEvidence.input.some(event=>event.type==='pointerdown'&&event.pointerType==='touch'),'Phone driving/navigation requires real touch receipt');
 await page.waitForLoadState('networkidle',{timeout:60000});assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.functionalPassed=true;
}

try{await bounded(run(),32*60000,'Cadillac modification case');}
catch(error){
 report.failurePhase=report.phase;report.errors.push(error.stack||String(error));
 if(page)try{
  const failure=await page.evaluate(()=>({evidence:window.__cadillacModsEvidence,startup:{at:performance.now(),
   welcomeState:document.querySelector('#welcome')?.dataset.state??null,welcomeHidden:document.querySelector('#welcome')?.hidden??null,
   atStart:document.body?.classList.contains('at-start')??null,loading:document.querySelector('#loading')?.textContent??null,
   startLabel:document.querySelector('#start-label')?.textContent??null,startDisabled:document.querySelector('#start')?.disabled??null}}));
  report.nativeEvidence=failure.evidence;report.startupAtFailure=failure.startup;
  const file='failure.png';await page.screenshot({path:resolve(out,file),timeout:30000});report.failureScreenshot=file;
 }catch(captureError){report.errors.push('Failure screenshot: '+captureError.message);}
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
