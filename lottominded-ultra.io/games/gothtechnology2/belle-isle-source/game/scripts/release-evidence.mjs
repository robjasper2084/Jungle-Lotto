/** Release evidence on the real built game. No seeded race state or fake renderer.
 * The phone case uses trusted CDP touch-from-mouse emulation and the unchanged
 * countdown classifier. The graphics case overrides ONLY the review camera at
 * render time via Three's devtools observation hook; full game scene is retained.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname,resolve,sep} from 'node:path';
import {classifyCountdownInput} from './polish-countdown-proof.mjs';
import {revealPracticeCourse} from './release-navigation.mjs';
const game=resolve(import.meta.dirname,'..'),root=resolve(game,'dist');
const mode=process.env.BELLE_RELEASE_EVIDENCE;
assert(['phone-timing','golden-reference'].includes(mode),'Select a named review case');
const out=resolve(game,'output/release-evidence',mode);await mkdir(out,{recursive:true});
const report={source:process.env.RELEASE_SOURCE_SHA,head:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,mode,passed:false,errors:[],warnings:[],captures:[],checks:{},limits:{actionMs:90000,loadMs:180000,screenshotMs:150000,closeMs:30000},limitations:mode==='phone-timing'?'Chromium phone emulation with trusted browser touch events, not a physical phone or hardware FPS test.':'Real built island and production shaders. Estimated reference camera only; no surveyed camera/EXIF, pixel-equivalence or hardware FPS claim.'};
const lines=[];const log=s=>{const line=new Date().toISOString()+' '+s;lines.push(line);console.log(line);};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}let file=resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+sep))throw Error('Path escape');if((await stat(file)).isDirectory())file=resolve(file,'index.html');const info=await stat(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(404).end();}});
const bounded=async(p,ms,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline exceeded')),ms);})]);}finally{clearTimeout(timer);}};
let browser,page,client;
const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:90000});
const shot=async name=>{log('Screenshot '+name);await page.screenshot({path:resolve(out,name+'.png'),timeout:150000});report.captures.push(name+'.png');};
const enter={key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,modifiers:0,location:0};
const releaseTouch=()=>client.send('Input.emulateTouchFromMouseEvent',{type:'mouseReleased',x:120,y:240,button:'left',clickCount:1});
const menu=async()=>{if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await expect(page.locator('#ride-menu')).toBeVisible();};
const nativeActivate=async selector=>{await page.locator(selector).focus();await expect(page.locator(selector)).toBeFocused();await Promise.all([client.send('Input.dispatchKeyEvent',{type:'keyDown',...enter,text:'\r',unmodifiedText:'\r',autoRepeat:false}),client.send('Input.dispatchKeyEvent',{type:'keyUp',...enter})]);};
async function boot(){
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 report.origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chromium',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browser=browser.version();
 const phone=mode==='phone-timing',context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:phone,hasTouch:true,reducedMotion:'no-preference'});
 page=await context.newPage();client=await context.newCDPSession(page);page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 if(!phone)await context.addInitScript(()=>{
  const hub=new EventTarget();window.__THREE_DEVTOOLS__=hub;
  const review=window.__referenceReview={enabled:false,frames:0,errors:[],last:null,frame:null};
  hub.addEventListener('observe',event=>{
   const renderer=event.detail;if(!renderer?.isWebGLRenderer||renderer.domElement?.id!=='game')return;
   const original=renderer.render;
   renderer.render=function(scene,camera){
    if(!review.enabled||renderer.getRenderTarget()!==null||!scene?.getObjectByName?.('Belle Isle changing sky'))return original.call(this,scene,camera);
    const sky=scene.getObjectByName('Belle Isle changing sky'),saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,aspect:camera.aspect,sky:sky.position.clone()};
    try{
     camera.position.set(...review.camera.position);camera.lookAt(...review.camera.target);camera.fov=review.camera.verticalFov;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();camera.updateMatrixWorld();sky.position.copy(camera.position);
     original.call(this,scene,camera);review.frames++;
     const u=sky.material.uniforms,lights=[];scene.traverse(o=>{if(o.isDirectionalLight||o.isHemisphereLight)lights.push({type:o.type,intensity:o.intensity,color:o.color.toArray(),castShadow:o.castShadow});});
     review.last={camera:{position:camera.position.toArray(),target:[...review.camera.target],verticalFov:camera.fov,aspect:camera.aspect},sky:{sun:u.sunDirection.value.toArray(),coverage:u.coverage.value,overcast:u.overcast.value,daylight:u.daylight.value,zenith:u.zenith.value.toArray(),horizon:u.horizon.value.toArray()},lights,fog:scene.fog?{density:scene.fog.density,color:scene.fog.color.toArray()}:null,exposure:renderer.toneMappingExposure,pixelRatio:renderer.getPixelRatio(),render:{...renderer.info.render},memory:{...renderer.info.memory},programs:renderer.info.programs?.length};
     if(review.capture){review.frame=renderer.domElement.toDataURL('image/png');review.capture=false;}
    }catch(error){review.errors.push(String(error));throw error;}finally{camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.aspect=saved.aspect;camera.updateProjectionMatrix();camera.updateMatrixWorld();sky.position.copy(saved.sky);}
   };
  });
 });
 log('Load actual built game');await page.goto(report.origin+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 report.title=await page.title();assert.match(report.title,/Belle Isle/i);
 await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
 await menu();await page.locator('#settings-open').click();await page.locator('#quality').selectOption('smooth');await page.locator('#fps').selectOption('30');await page.locator('#touch').check();await page.locator('#joystick-mode').selectOption('fixed');await page.locator('#motion').uncheck();await page.locator('[data-close="settings"]').click();
 report.checks.webgl=await page.locator('#game').evaluate(c=>{const g=c.getContext('webgl2');return{live:!!g&&!g.isContextLost(),renderer:g?.getParameter(g.RENDERER),width:c.width,height:c.height};});assert(report.checks.webgl.live);
 assert.deepEqual(report.errors,[]);
}
async function phoneTiming(){
 // Same physics viewport and quality as the existing phone polish case.
 await page.setViewportSize({width:390,height:340});
 await page.waitForFunction(()=>innerWidth===390&&innerHeight===340&&document.querySelector('#game').height===340);
 report.viewport={width:390,height:340};report.settings={quality:'smooth',targetFps:30,deviceScaleFactor:1,joystick:'fixed'};
 await page.evaluate(()=>{
  window.__releaseInput=[];window.__releaseCountdown=[];
  window.__releaseSnapshot=()=>{const h=document.querySelector('#trial-hud');return{at:performance.now(),hudHidden:h.hidden,status:h.dataset.status,course:h.dataset.course,elapsed:Number(h.dataset.elapsed),next:Number(h.dataset.next),paused:h.dataset.paused,offCourse:h.dataset.offCourse,time:h.querySelector('.trial-time')?.textContent,speed:parseFloat(document.querySelector('#speed')?.textContent||'0'),focused:document.activeElement?.id,visibility:document.visibilityState,openDialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)};};
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','keydown','keyup'])window.addEventListener(type,e=>window.__releaseInput.push({...window.__releaseSnapshot(),type,trusted:e.isTrusted,pointerType:e.pointerType,code:e.code,repeat:e.repeat,control:e.target.closest?.('#touch-zone')?.id,target:e.target.id}),true);
  const h=document.querySelector('#trial-hud');let previous=h.dataset.status;
  new MutationObserver(()=>{const s=window.__releaseSnapshot();if(!s.hudHidden&&s.status==='countdown'&&previous!=='countdown')window.__releaseCountdown.push(s);previous=s.status;}).observe(h,{attributes:true,attributeFilter:['data-status','hidden']});
 });
 const read=()=>page.evaluate(()=>window.__releaseSnapshot());
 const point=await page.locator('#stick').evaluate(el=>{const r=el.getBoundingClientRect(),p={x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height*.15)},hit=document.elementFromPoint(p.x,p.y);return{...p,control:hit?.closest?.('#touch-zone')?.id};});assert.equal(point.control,'touch-zone');
 async function hold(selector,label){
  await expect(page.locator(selector)).toBeVisible();await expect(page.locator(selector)).toBeEnabled();
  await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).focus();await expect(page.locator(selector)).toBeFocused();
  const before=await page.evaluate(()=>({events:window.__releaseInput.length,countdowns:window.__releaseCountdown.length}));
  log('Native '+label+' then trusted touch-from-mouse hold');
  // Same-session queue, no response round-trip before the hold. This generates
  // trusted pointerType=touch through Chromium, not dispatchEvent or game setters.
  await bounded(Promise.all([
   client.send('Input.dispatchKeyEvent',{type:'keyDown',...enter,text:'\r',unmodifiedText:'\r',autoRepeat:false}),
   client.send('Input.dispatchKeyEvent',{type:'keyUp',...enter}),
   client.send('Input.emulateTouchFromMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1})
  ]),90000,label+' native queue');
  await expect.poll(()=>page.evaluate(n=>window.__releaseCountdown.length>n,before.countdowns)).toBe(true);
  const evidence=await page.evaluate(before=>({state:window.__releaseCountdown[before.countdowns],events:window.__releaseInput.slice(before.events)}),before);
  const classification=classifyCountdownInput({mobile:true,...evidence,expectedTarget:'touch-zone'});
  report.checks[label]={...evidence,classification,transport:'CDP Input.emulateTouchFromMouseEvent; trusted browser pointerType=touch; no DOM event injection'};
  assert.equal(classification.status,'passed',label+': real trusted touch must arrive DURING countdown, not after GO');
  assert.equal(classification.event.elapsed,0);assert.equal(classification.event.speed,0);assert.equal(classification.event.paused,'false');assert.deepEqual(classification.event.openDialogs,[]);
  const samples=[];await expect.poll(async()=>{const s=await read();samples.push(s);assert(['countdown','running'].includes(s.status));if(s.status==='countdown'){assert.equal(s.speed,0);assert.equal(s.elapsed,0);}return s.status==='running'&&s.speed>0;},{timeout:90000,intervals:[100,250,500,1000]}).toBe(true);
  const trace=await page.evaluate(start=>window.__releaseInput.slice(start),before.events);assert(!trace.some(e=>['pointerup','pointercancel'].includes(e.type)&&e.control==='touch-zone'),'Input hold must be uninterrupted through GO');
  Object.assign(report.checks[label],{samples,movementPassed:true,uninterrupted:true});
 }
 try{
  await menu();await page.locator('#trials-open').click();await page.locator('#trial-tab-onewheel').click();
  await revealPracticeCourse(page,expect,'[data-course="onewheel-island-cup-v1"]');
  report.checks.practiceDisclosure={opened:true,transport:'Native touch on the existing summary; no forced DOM state'};
  await hold('[data-course="onewheel-island-cup-v1"]','initialCountdownHold');
  log('Restart while the native touch remains held');
  await page.keyboard.press('r');await expect(page.locator('#trial-hud')).toHaveAttribute('data-status','running');
  const states=[];await expect.poll(async()=>{const s=await read();assert.equal(s.speed,0,'Restart must clear old held touch');if(s.elapsed>0&&states.at(-1)?.elapsed!==s.elapsed)states.push(s);return states.length;},{timeout:90000,intervals:[500,1000,1500]}).toBeGreaterThanOrEqual(2);report.checks.staleHoldCleared=states;
  await client.send('Input.emulateTouchFromMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  await hold('#trial-restart','restartedCountdownHold');
 }finally{await client.send('Input.emulateTouchFromMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1}).catch(e=>report.errors.push('touch cleanup '+e));}
 await page.setViewportSize({width:390,height:844});await shot('phone-real-game');
 report.verificationComplete=true;report.checks.countdownVerified=2;
}
async function goldenReference(){
 await menu();await page.locator('#map-open').click();await page.locator('#guide-search').fill('Sunset Point');
 const card=page.locator('#landmarks .landmark').filter({has:page.getByRole('heading',{name:'Sunset Point',exact:true})});await expect(card).toHaveCount(1);await card.getByRole('button',{name:'Travel to path',exact:true}).click();await expect(page.locator('#guide')).not.toBeVisible();
 const map=JSON.parse(await readFile(resolve(root,'belle/map.json'),'utf8')),point=map.landmarks.find(p=>p.name==='Sunset Point');assert(point);
 // Estimated framing from the point and skyline anchors; not a survey-calibrated pose.
 const camera={position:[point.x+301.01,95,point.z-118.38],target:[point.x+118.01,2,point.z-92.38],verticalFov:66};
 report.reference={description:'User-provided square aerial Sunset Point photo: pale warm horizon, low sun, golden reflection, long tree shadows and curving park paths.',camera,coordinateFrame:'Existing map metre coordinates, Y up',cameraAccuracy:'Estimated aerial viewpoint; photograph has no calibrated camera metadata.',hour:17.6,clouds:'clear',cycle:false,viewport:{width:1000,height:1000},hardwarePerformanceCertified:false};
 await page.setViewportSize(report.reference.viewport);
 for(const quality of ['smooth','high']){
  log('Configure documented 17:36 low-sun reference, '+quality);
  await menu();await page.locator('#settings-open').click();await page.locator('#quality').selectOption(quality);await page.locator('#sky-cycle').uncheck();await page.locator('#sky-clouds').selectOption('clear');
  // Fill a public range input through its regular input event, not a shader override.
  await page.locator('#sky-hour').evaluate(input=>{input.value='17.6';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('[data-close="settings"]').click();
  await page.evaluate(camera=>{Object.assign(window.__referenceReview,{enabled:true,camera,capture:false,frame:null});},camera);
  const first=await page.evaluate(()=>window.__referenceReview.frames);
  await expect.poll(()=>page.evaluate(()=>window.__referenceReview.frames),{timeout:90000}).toBeGreaterThan(first+1);
  await page.evaluate(()=>{window.__referenceReview.capture=true;window.__referenceReview.frame=null;});
  await page.waitForFunction(()=>typeof window.__referenceReview.frame==='string',null,{timeout:150000});
  const capture=await page.evaluate(()=>({frame:window.__referenceReview.frame,last:window.__referenceReview.last,errors:window.__referenceReview.errors,settings:{quality:document.querySelector('#quality').value,hour:document.querySelector('#sky-hour').value,clouds:document.querySelector('#sky-clouds').value,cycle:document.querySelector('#sky-cycle').checked}}));
  assert.deepEqual(capture.errors,[]);assert.equal(capture.settings.quality,quality);assert.equal(capture.settings.cycle,false);assert.equal(capture.settings.clouds,'clear');assert(Math.abs(Number(capture.settings.hour)-17.6)<.02);
  assert(capture.last.sky.sun[1]>0&&capture.last.sky.sun[1]<.15,'Documented low sun required');assert(capture.last.render.calls>0);assert(capture.last.render.triangles>10000,'Actual island scene required');
  const image=Buffer.from(capture.frame.split(',')[1],'base64');assert(image.length>20000,'Nontrivial actual framebuffer capture required');
  await writeFile(resolve(out,'sunset-point-'+quality+'.png'),image);report.captures.push('sunset-point-'+quality+'.png');delete capture.frame;report.checks[quality]=capture;
  await shot('sunset-point-'+quality+'-with-ui');
 }
 await page.evaluate(()=>window.__referenceReview.enabled=false);
 report.visualReviewRequired=true;report.visualMatchCertified=false;
}
try{await bounded((async()=>{await boot();if(mode==='phone-timing')await phoneTiming();else await goldenReference();assert.deepEqual(report.errors,[]);report.passed=true;})(),35*60*1000,'Release evidence case');}
catch(error){report.failure=error.stack||String(error);process.exitCode=1;log('FAIL '+error.message);if(page)try{report.failureState=await bounded(page.evaluate(()=>({title:document.title,body:document.body.className,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),welcome:document.querySelector('#welcome')?.dataset.state,trial:window.__releaseSnapshot?.(),input:window.__releaseInput?.slice(-30),reference:window.__referenceReview?{frames:window.__referenceReview.frames,last:window.__referenceReview.last,errors:window.__referenceReview.errors}:null})),15000,'Failure snapshot');}catch(e){report.diagnosticError=String(e);}}
finally{if(browser)try{await bounded(browser.close(),30000,'Browser close');}catch(e){report.cleanupFailure=String(e);report.passed=false;process.exitCode=1;}if(server.listening){server.closeAllConnections();await new Promise(done=>server.close(done));}report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await writeFile(resolve(out,'run.log'),lines.join('\n'));console.log(JSON.stringify(report,null,2));}