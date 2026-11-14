/** Exact-build HUD acceptance. Native UI only; no seeded player/scene/storage state. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {createNativeTouchSequence} from './native-touch-sequence.mjs';
const game=resolve(import.meta.dirname,'..'),out=resolve(game,'output/hud-layout'),root=resolve(game,'dist');
const choice=process.env.BELLE_HUD_CASE||'phone';
assert(['phone','desktop'].includes(choice));
const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90000});
const report={source:process.env.HUD_SOURCE_SHA??null,checkout:process.env.GITHUB_SHA??null,run:process.env.GITHUB_RUN_ID??null,case:choice,passed:false,phase:'setup',errors:[],failedRequests:[],requestFailureDetails:[],captures:[],checks:{},limitations:'Actual built island, native browser input and software WebGL. Not physical-device FPS/endurance certification. This new smoke supplements, never replaces, the original seven gates.'};
await mkdir(out,{recursive:true});
const server=createCoopStaticServer(root);let browser,page,client,touchSequence;
const bounded=async(promise,ms,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline exceeded')),ms);})]);}finally{clearTimeout(timer);}};
const phase=name=>{report.phase=name;console.log(new Date().toISOString()+' '+name);};
const tap=locator=>choice==='phone'?locator.tap():locator.click();
async function settings(){if(await page.locator('#settings').isVisible())return;await tap(page.locator('#tools-toggle'));await tap(page.locator('#settings-open'));await expect(page.locator('#settings')).toBeVisible();}
async function openEditor(){await settings();await tap(page.locator('#belle-hud-customize'));await expect(page.locator('#belle-hud-editor')).toBeVisible();}
async function boot(){
 await page.goto(report.origin+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 if(await page.locator('#startup-motion').getAttribute('aria-pressed')!=='true')await tap(page.locator('#startup-motion'));
 await tap(page.locator('.cinema-ride-picker > summary'));await tap(page.locator('.ride-options label').filter({hasText:'One wheel'}));await tap(page.getByRole('button',{name:'Use this ride',exact:true}));await tap(page.locator('#start'));await expect(page.locator('body')).not.toHaveClass(/at-start/);
 await settings();await page.locator('#quality').selectOption('smooth');await page.locator('#fps').selectOption('30');await page.locator('#touch').check();await page.locator('#joystick-mode').selectOption('fixed');await tap(page.locator('[data-close="settings"]'));
}
async function capture(name){
 const file=name+'.png';await page.screenshot({path:resolve(out,file),timeout:150000});const bytes=await readFile(resolve(out,file));report.captures.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),viewport:page.viewportSize(),phase:report.phase});
}
async function paint(){
 const before=await page.locator('#profile').getAttribute('data-active-frames');assert(before!==null&&Number.isFinite(Number(before)),'real frame count required');
 await page.waitForFunction(n=>Number(document.querySelector('#profile')?.dataset.activeFrames)>n,Number(before),{timeout:45000});
 const proof=await page.evaluate(()=>new Promise((yes,no)=>{
  const canvas=document.querySelector('#game'),gl=canvas?.getContext('webgl2');if(!gl||gl.isContextLost())return no(Error('Live WebGL2 is required'));
  const submitted=performance.now(),fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)return no(Error('Missing GPU fence'));gl.flush();let done=false,frame=0;
  const deadline=setTimeout(()=>finish(Error('GPU/paint exceeded 45 seconds')),45000);
  function finish(error,value){if(done)return;done=true;clearTimeout(deadline);cancelAnimationFrame(frame);try{gl.deleteSync(fence);}catch(e){error??=e;}error?no(error):yes(value);}
  function poll(){if(gl.isContextLost())return finish(Error('GPU context lost'));const state=gl.clientWaitSync(fence,0,0);if(state===gl.TIMEOUT_EXPIRED){frame=requestAnimationFrame(poll);return;}if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED)return finish(Error('GPU fence failed'));const gpuReady=performance.now();frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>finish(null,{submitted,gpuReady,paintOpportunities:2,ready:performance.now(),activeFrames:Number(document.querySelector('#profile')?.dataset.activeFrames)}));});}frame=requestAnimationFrame(poll);
 }));assert(proof.ready-proof.submitted<45000);return proof;
}
async function hitBox(selector){return page.locator(selector).evaluate(element=>{const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};});}
/** Inspect actual browser hit routing; DOM presence alone is not acceptance. */
async function verifyHitTarget(selector,ownerSelector=selector,label=selector,forward=false){
 const proof=await page.locator(selector).evaluate((element,{ownerSelector,forward})=>{
  const owner=document.querySelector(ownerSelector),r=element.getBoundingClientRect();
  const samples=[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75],...(forward?[[.5,.15]]:[])];
  return {rect:{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom},viewport:{width:innerWidth,height:innerHeight},points:samples.map(([u,v])=>{const x=r.left+r.width*u,y=r.top+r.height*v,hit=document.elementFromPoint(x,y);return{x,y,receives:!!owner&&(owner===hit||owner.contains(hit)),covering:hit?.id||hit?.getAttribute('data-hold')||hit?.tagName};})};
 },{ownerSelector,forward});
 const r=proof.rect;assert(r.width>=44&&r.height>=44,label+': minimum 44px');assert(r.left>=0&&r.top>=0&&r.right<=proof.viewport.width+1&&r.bottom<=proof.viewport.height+1,label+': in-bounds');
 for(const point of proof.points)assert(point.receives,label+': covered by '+point.covering);
 (report.checks.hitTargets??={})[label]=proof;return proof;
}
async function touch(type,points){await touchSequence.dispatch(type,Object.entries(points).map(([id,p])=>({id:Number(id),x:p.x,y:p.y,radiusX:2,radiusY:2,force:1})));}
async function nativeInput(){
 // This observer records real browser receipt only; it never writes game state.
 await page.evaluate(()=>{window.__hudInputProof=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.addEventListener(type,e=>window.__hudInputProof.push({type,trusted:e.isTrusted,id:e.pointerId,target:e.target.closest?.('button,#touch-zone,#game')?.id,x:e.clientX,y:e.clientY}),true);});
 const move=await hitBox('#stick'),brake=await hitBox('#brake');
 const look=await page.evaluate(()=>{for(let y=innerHeight*.24;y<innerHeight*.7;y+=12)for(let x=innerWidth*.62;x<innerWidth*.86;x+=12)if(document.elementFromPoint(x,y)?.id==='game'&&document.elementFromPoint(x+12,y+8)?.id==='game')return{x,y};throw Error('No unoccupied look region');});
 const points={1:move};await touch('touchStart',points);points[1]={x:move.x,y:move.y-30};await touch('touchMove',points);
 await expect.poll(async()=>parseFloat(await page.locator('#speed').innerText())).toBeGreaterThan(0);
 points[2]=look;await touch('touchStart',points);points[2]={x:look.x+12,y:look.y+8};await touch('touchMove',points);await expect(page.locator('body')).toHaveClass(/has-looked/);
 points[3]=brake;await touch('touchStart',points);await expect(page.locator('#brake')).toHaveClass(/is-held/);
 // Individual release uses that contact's ID. Verify trusted pointerup receipt,
 // rather than interpreting protocol acknowledgement as delivery.
 const released={3:points[3]};delete points[3];await touch('touchEnd',released);await expect(page.locator('#brake')).not.toHaveClass(/is-held/);
 points[1]={x:page.viewportSize().width*.7,y:move.y-30};await touch('touchMove',points);await expect(page.locator('#stick')).toHaveClass(/is-active/);
 await touch('touchEnd',{});await expect(page.locator('#stick')).not.toHaveClass(/is-active/);
 const events=await page.evaluate(()=>window.__hudInputProof);assert(events.some(e=>e.type==='pointerup'&&e.target==='brake'&&e.trusted));assert(events.filter(e=>e.type==='pointerdown'&&e.trusted).length>=3);report.checks.nativeMultiTouch=events;
}
async function run(){
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});report.origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chromium',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:640,height:400},hasTouch:true,isMobile:choice==='phone',deviceScaleFactor:1});page=await context.newPage();client=await context.newCDPSession(page);touchSequence=createNativeTouchSequence((method,params)=>client.send(method,params));page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/context.*lost/i.test(m.text()))report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',r=>{const d={timestamp:new Date().toISOString(),phase:report.phase,type:r.resourceType(),url:r.url(),error:r.failure()?.errorText??'Unknown request failure'};report.requestFailureDetails.push(d);report.failedRequests.push(d.error+' '+d.url);report.errors.push('requestfailed: '+d.error+' '+d.url);});
 phase('boot');await boot();
 const size=choice==='phone'?{width:390,height:844}:{width:1355,height:721};await page.setViewportSize(size);await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);report.checks.beforePaint=await paint();await capture('before');
 phase('default-compact-hit-targets');await page.setViewportSize({width:390,height:340});await page.waitForFunction(()=>innerWidth===390&&innerHeight===340);await verifyHitTarget('#stick','#touch-zone','default-compact-stick',true);await verifyHitTarget('#ride-radio summary','#ride-radio summary','compact-radio-access');report.checks.defaultCompactPaint=await paint();await capture('default-compact-controls');await page.setViewportSize(size);await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
 phase('edit-cancel');await openEditor();await expect(page.locator('#pause')).toHaveText('Resume');await page.getByLabel('Select control',{exact:true}).selectOption('brake');await page.getByLabel('Background opacity (%)',{exact:true}).fill('70');await page.getByLabel('Background opacity (%)',{exact:true}).press('Tab');await tap(page.locator('#belle-hud-cancel'));assert.equal(await page.evaluate(()=>localStorage.getItem('belle-hud-layouts-v1')),null);report.checks.cancelDidNotPersist=true;
 phase('save-profile');await tap(page.locator('#belle-hud-customize'));await page.getByLabel('Profile name',{exact:true}).fill('HUD acceptance');await page.getByLabel('Profile name',{exact:true}).press('Tab');await page.getByLabel('Select control',{exact:true}).selectOption('brake');await page.getByLabel('Background opacity (%)',{exact:true}).fill('70');await page.getByLabel('Background opacity (%)',{exact:true}).press('Tab');
 await expect(page.locator('#belle-hud-save')).toBeEnabled();await capture('editor');await tap(page.locator('#belle-hud-save'));await tap(page.locator('[data-close="settings"]'));await expect(page.locator('#brake')).toHaveClass(/belle-hud-control/);
 const saved=await page.evaluate(()=>localStorage.getItem('belle-hud-layouts-v1'));assert(saved);const archive=JSON.parse(saved);assert.equal(archive.profiles[0].name,'HUD acceptance');report.checks.savedProfile=archive;
 report.checks.afterPaint=await paint();await capture('after');
 phase('native-multitouch');await nativeInput();
 phase('reload-profile');await boot();await expect(page.locator('#brake')).toHaveClass(/belle-hud-control/);assert.equal(await page.evaluate(()=>localStorage.getItem('belle-hud-layouts-v1')),saved);report.checks.reloadPreservedProfile=true;
 phase('mode-layouts');await tap(page.locator('#mount'));await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');await openEditor();assert.match(await page.getByLabel('Player and mode',{exact:true}).innerText(),/foot/);await tap(page.locator('#belle-hud-cancel'));await tap(page.locator('[data-close="settings"]'));
 if(choice==='phone')for(const viewport of [{width:320,height:568},{width:390,height:340},{width:844,height:390}]){phase('viewport-'+viewport.width+'x'+viewport.height);await page.setViewportSize(viewport);await openEditor();await expect(page.locator('#belle-hud-cancel')).toBeVisible();await expect(page.locator('#belle-hud-save')).toBeVisible();const boxes=await page.locator('#belle-hud-editor>header button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};}));for(const box of boxes){assert(box.width>=44&&box.height>=44);assert(box.left>=0&&box.top>=0&&box.right<=viewport.width+1&&box.bottom<=viewport.height+1);}await capture('editor-'+viewport.width+'x'+viewport.height);await tap(page.locator('#belle-hud-cancel'));await tap(page.locator('[data-close="settings"]'));}
 phase('hover-editor');await page.setViewportSize(size);if(!await page.locator('#hover-enter').isVisible())await tap(page.locator('#tools-toggle'));await tap(page.locator('#hover-enter'));await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
 for(const viewport of [{width:390,height:340},{width:844,height:390}]){
  phase('default-flight-hit-targets-'+viewport.width+'x'+viewport.height);await page.setViewportSize(viewport);await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,viewport);
  await verifyHitTarget('#hover-move-zone','#hover-move-zone','flight-zone-'+viewport.width);
  for(const key of ['KeyE','KeyQ','Space'])await verifyHitTarget('#hover-hud [data-hold="'+key+'"]',undefined,'flight-'+viewport.width+'-'+key);
  (report.checks.flightPaint??={})[viewport.width]=await paint();await capture('default-flight-'+viewport.width+'x'+viewport.height);
 }
 await page.setViewportSize(size);await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);phase('hover-editor');await openEditor();assert.match(await page.getByLabel('Player and mode',{exact:true}).innerText(),/hover/);const hoverIds=await page.getByLabel('Select control',{exact:true}).locator('option').evaluateAll(es=>es.map(e=>e.value));for(const id of ['hover-stick','hover-brake','hover-up','hover-down','jarvs'])assert(hoverIds.includes(id));report.checks.hoverEditorControls=hoverIds;await capture('hover-editor');await tap(page.locator('#belle-hud-cancel'));await tap(page.locator('[data-close="settings"]'));await tap(page.locator('[data-hover="exit"]'));await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
 phase('coop-editor');if(!await page.locator('#coop-open').isVisible())await tap(page.locator('#tools-toggle'));await tap(page.locator('#coop-open'));await page.getByLabel('Player 1 rider',{exact:true}).selectOption('DS_Man_01');await page.getByLabel('Player 2 rider',{exact:true}).selectOption('DS_Hoodie_Woman_01');await page.getByLabel('Player 1 vehicle',{exact:true}).selectOption('euc:city');await page.getByLabel('Player 2 vehicle',{exact:true}).selectOption('euc:tour');await tap(page.getByRole('button',{name:'Confirm Player 1',exact:true}));await tap(page.getByRole('button',{name:'Confirm Player 2',exact:true}));await tap(page.getByRole('button',{name:'Explore together',exact:true}));await expect(page.locator('#coop-overlay')).toHaveAttribute('data-rendered-views','2');
 await tap(page.locator('#coop-hud-customize'));await expect(page.locator('#belle-hud-editor')).toBeVisible();await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','true');await expect(page.getByLabel('Player and mode',{exact:true}).locator('option')).toHaveCount(2);await page.getByLabel('Player and mode',{exact:true}).selectOption('1');await page.getByLabel('Select control',{exact:true}).selectOption('coop-camera');await page.getByLabel('Background opacity (%)',{exact:true}).fill('75');await page.getByLabel('Background opacity (%)',{exact:true}).press('Tab');await expect(page.locator('#belle-hud-save')).toBeEnabled();await capture('coop-editor');await tap(page.locator('#belle-hud-save'));await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','false');
 const coopArchive=JSON.parse(await page.evaluate(()=>localStorage.getItem('belle-hud-layouts-v1'))),keys=Object.keys(coopArchive.profiles[0].layouts);assert(keys.some(k=>k.startsWith('coop-2-')&&k.includes('-p2:')));assert(!keys.some(k=>k.startsWith('coop-2-')&&k.includes('-p1:')));report.checks.coopPlayerProfileIsolation=keys;await capture('coop-custom');await tap(page.getByRole('button',{name:'Return to solo',exact:true}));await expect(page.locator('body')).not.toHaveClass(/coop-playing/);
 phase('finished');assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.functionalPassed=true;
}
try{await bounded(run(),35*60000,'HUD case');}catch(error){report.errors.push(error.stack??String(error));if(page)try{await capture('failure');}catch(e){report.errors.push('failure screenshot: '+e);}}
finally{
 phase('cleanup');if(touchSequence)try{report.checks.touchCleanup=await bounded(touchSequence.cancelActive(),10000,'input cleanup');}catch(e){report.errors.push('input cleanup: '+e);}
 if(browser)try{await bounded(browser.close(),30000,'browser cleanup');}catch(e){report.errors.push('browser cleanup: '+e);}
 try{await bounded(new Promise((yes,no)=>server.close(e=>e?no(e):yes())),10000,'HTTP cleanup');}catch(e){report.errors.push('HTTP cleanup: '+e);}
 report.passed=report.functionalPassed===true&&report.errors.length===0&&report.failedRequests.length===0&&report.requestFailureDetails.length===0;report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'report-'+choice+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
