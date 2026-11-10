/** Direct hoverbike Start, takeoff, input, landing and remount in branded Chrome.
 * Uses visible controls and native input. Never changes game timing, poses or records.
 * Mobile is touch/viewport emulation; SwiftShader timings are not hardware benchmarks.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';

const repository=resolve(import.meta.dirname,'..');
const project=resolve(repository,'lottominded-ultra.io/games/gothtechnology2');
const root=resolve(project,'belle-isle-source/game/dist');
const require=createRequire(resolve(project,'package.json'));
const {chromium,expect}=require('@playwright/test');
const name=process.env.BELLE_STARTUP_BROWSER_CASE??'desktop';
assert.ok(['desktop','phone'].includes(name),'Unknown startup case');
const mobile=name==='phone',viewport=mobile?{width:390,height:844}:{width:1440,height:960};
const output=resolve(process.env.BELLE_STARTUP_OUTPUT??resolve(process.env.RUNNER_TEMP??'/tmp','belle-startup-'+name));
await mkdir(output,{recursive:true});
const report={head:process.env.GITHUB_SHA??null,startedAt:new Date().toISOString(),case:name,viewport,
  browserChannel:'chrome',mobileEmulation:mobile,softwareRendering:true,passed:false,
  manualScreenshotReviewRequired:true,hardwarePerformanceCertified:false,
  checks:[],screenshots:[],errors:[],warnings:[],performanceSamples:[]};
const log=message=>console.log(new Date().toISOString(),name+':',message);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml',
  '.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname==='/favicon.ico'){response.writeHead(204).end();return;}
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403).end();return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const info=await stat(file);
    response.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
    if(request.method==='HEAD')response.end();else createReadStream(file).on('error',()=>response.destroy()).pipe(response);
  }catch{response.writeHead(404).end('Not found');}
});
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const origin='http://127.0.0.1:'+server.address().port;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' exceeded '+ms+' ms')),ms);})]);}finally{clearTimeout(timer);}}
let browser,page,touch;
const tap=locator=>mobile?locator.tap():locator.click();
const checked=(check,evidence)=>{report.checks.push({check,passed:true,at:new Date().toISOString(),evidence});log(check+' passed');};
const snapshot=()=>bounded(page.evaluate(()=>({
  title:document.title,url:location.href,state:document.querySelector('#welcome')?.dataset.state,
  loading:document.querySelector('#loading')?.textContent,start:document.querySelector('#start-label')?.textContent,
  bodyClass:document.body.className,mode:document.querySelector('#hover-mode')?.textContent,
  speed:Number.parseFloat(document.querySelector('#hover-speed')?.textContent??''),
  altitude:Number.parseFloat(document.querySelector('#hover-altitude')?.textContent??''),
  rider:{...document.querySelector('#hover-hud')?.dataset},graphics:{...document.querySelector('#profile')?.dataset},
  frameDiagnostic:document.querySelector('#profile')?.textContent,startEvent:window.__belleDirectStartEvent,
  focused:document.activeElement?.id,visibility:document.visibilityState,
})),30_000,'read-only game snapshot');
async function shot(label){const file=name+'-'+label+'.png';await bounded(page.screenshot({path:resolve(output,file),timeout:150_000}),155_000,'screenshot '+label);report.screenshots.push(file);}
async function holdForward(){
  if(!mobile){await page.locator('#game').focus();await page.keyboard.down('w');return async()=>page.keyboard.up('w');}
  // The mobile HUD intentionally hides legacy W/S buttons. Use its actual
  // floating/fixed joystick through native touch, never injected game inputs.
  const control=page.locator('#hover-move-zone');await expect(control).toBeVisible();
  const hit=await control.evaluate(zone=>{
    const r=zone.getBoundingClientRect(),stick=document.querySelector('#hover-flight-stick').getBoundingClientRect();
    const floating=document.body.dataset.joystickMode!=='fixed';
    const x=floating?r.left+r.width*.5:stick.left+stick.width/2;
    const y=floating?r.top+r.height*.28:stick.top+stick.height/2;
    const endY=y-stick.width*.37*.85;
    const receives=(px,py)=>{const target=document.elementFromPoint(px,py);return target===zone||zone.contains(target);};
    return{x,y,endY,receives:receives(x,y)&&receives(x,endY),width:r.width,height:r.height};
  });
  assert.ok(hit.receives&&hit.width>=44&&hit.height>=44,'Touchable, uncovered movement joystick');
  const release=()=>touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  try{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:hit.x,y:hit.y,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:hit.x,y:hit.endY,id:1}]});
  }catch(error){await release().catch(()=>{});throw error;}
  return release;
}
try{
  browser=await chromium.launch({channel:'chrome',headless:process.env.BELLE_STARTUP_BROWSER_HEADED!=='1',
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
  report.browserVersion=browser.version();
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference'});
  page=await context.newPage();if(mobile)touch=await context.newCDPSession(page);
  page.setDefaultTimeout(120_000);
  await page.addInitScript(()=>{
    // Observation only: this does not trigger Start or alter the selected ride.
    document.addEventListener('click',event=>{
      if(event.target instanceof Element&&event.target.closest('#start'))window.__belleDirectStartEvent={
        trusted:event.isTrusted,at:performance.now(),vehicle:document.querySelector('input[name="startup-vehicle"]:checked')?.value,
        label:document.querySelector('#start-label')?.textContent};
    },true);
  });
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'||/context\s*(?:was\s*)?lost/i.test(message.text()))report.errors.push(message.text());
    else if(message.type()==='warning')report.warnings.push(message.text());
  });
  page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
  page.on('requestfailed',request=>{const reason=request.failure()?.errorText;if(reason!=='net::ERR_ABORTED')report.errors.push(reason+' '+request.url());});
  await bounded((async()=>{
    log('load direct startup at actual test viewport');
    await page.goto(origin+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30_000});
    await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180_000});
    await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
    assert.match(await page.title(),/Belle Isle/i);checked('page identity and ready screen',await snapshot());
    if(await page.locator('#startup-motion').getAttribute('aria-pressed')!=='true')await tap(page.locator('#startup-motion'));
    await tap(page.locator('.cinema-ride-picker > summary'));
    await tap(page.locator('.ride-options label').filter({has:page.locator('input[value="hoverbike"]')}));
    await expect(page.locator('input[name="startup-vehicle"][value="hoverbike"]')).toBeChecked();
    await tap(page.getByRole('button',{name:'Use this ride',exact:true}));
    await tap(page.locator('#start'));
    await page.waitForFunction(()=>document.body.classList.contains('on-hoverbike')||document.querySelector('#start-label')?.textContent==='Try starting again',null,{timeout:150_000});
    const started=await snapshot();
    assert.equal(started.startEvent?.trusted,true);assert.equal(started.startEvent?.vehicle,'hoverbike');
    assert.match(started.bodyClass,/on-hoverbike/);assert.doesNotMatch(started.bodyClass,/at-start/);
    await expect(page.locator('#hover-hud')).toBeVisible();await expect(page.locator('#hover-enter')).toBeEnabled();
    await expect(page.locator('.ride-preview-canvas')).toHaveCount(0);
    await expect(page.locator('#settings #ride-profile')).toHaveCount(1);
    await expect(page.locator('#ride-profile')).toBeHidden();
    checked('direct hoverbike Start with trusted input',started);await shot('direct-start');

    // Fresh profiles preserve the player's Classic preference. The direct
    // altitude-hold exercise must select Drone with actual visible controls,
    // rather than assume it was the default or alter saved preferences.
    await tap(page.locator('#hover-hud .hover-lighting > summary'));
    await expect(page.locator('#hover-flight-mode')).toBeEnabled();
    await page.locator('#hover-flight-mode').selectOption('drone');
    await expect(page.locator('#hover-flight-mode')).toHaveValue('drone');
    checked('Drone altitude hold selected via UI',await snapshot());

    await tap(page.locator('#hover-hud [data-hover="takeoff"]'));
    await expect.poll(async()=>Number.parseFloat(await page.locator('#hover-altitude').textContent()),{timeout:180_000,intervals:[500,1000,2000]}).toBeGreaterThan(.8);
    await expect(page.locator('#hover-mode')).toHaveText('ALTITUDE HOLD');
    await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-rig','anchored');
    checked('takeoff and anchored rider',await snapshot());
    const release=await holdForward();
    try{await expect.poll(async()=>Number.parseFloat(await page.locator('#hover-speed').textContent()),{timeout:120_000,intervals:[500,1000,2000]}).toBeGreaterThan(0);}
    finally{await bounded(release(),30_000,'release native movement input');}
    checked(mobile?'touch joystick movement':'keyboard throttle movement',await snapshot());
    await expect.poll(async()=>Number.parseFloat(await page.locator('#hover-speed').textContent()),{timeout:120_000,intervals:[500,1000,2000]}).toBe(0);
    checked('neutral input holds position',await snapshot());await shot('airborne');

    log('observe foreground rendering diagnostics without injecting timing');
    const observed=new Set(),until=Date.now()+60_000;
    do{
      const sample=await snapshot(),id=sample.graphics.activeFrames;
      if(id!==undefined&&!observed.has(id)){observed.add(id);report.performanceSamples.push(sample);}
      if(Number(sample.graphics.adaptiveScale)<=.65)assert.equal(sample.graphics.effectiveQuality,'smooth','Automatic floor must apply Smooth effects');
      if(Date.now()<until)await delay(1000);
    }while(Date.now()<until);
    report.performanceConclusion={distinctUpdates:report.performanceSamples.length,
      status:report.performanceSamples.length>=3?'diagnostics collected':'insufficient distinct updates',
      certification:'Software-rendered observations only; no hardware FPS or long-session guarantee.'};

    await tap(page.locator('#hover-hud [data-hover="takeoff"]'));
    // SwiftShader previously advanced only ~24 frames (1.2 simulation seconds)
    // within four wall-clock minutes. Keep the real landing assertion and all
    // performance evidence, allowing more real frames without modifying dt.
    await expect(page.locator('#hover-mode')).toHaveText('LANDED',{timeout:480_000});
    checked('landing returns to grounded state',await snapshot());await shot('landed');
    await tap(page.locator('#hover-hud [data-hover="exit"]'));
    await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);await expect(page.locator('#hover-enter')).toBeEnabled();
    // The real remount control lives in the ride menu on desktop and phone.
    await tap(page.locator('#tools-toggle'));await expect(page.locator('#ride-menu')).toBeVisible();
    await tap(page.locator('#hover-enter'));await expect(page.locator('#ride-menu')).not.toBeVisible();
    await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
    await expect(page.locator('#hover-enter')).toBeEnabled();checked('dismount and cached remount',await snapshot());
    const webgl=await page.locator('#game').evaluate(canvas=>{const gl=canvas.getContext('webgl2');return{live:!!gl&&!gl.isContextLost(),width:canvas.width,height:canvas.height,renderer:gl?.getParameter(gl.RENDERER)};});
    assert.equal(webgl.live,true);checked('live final WebGL context',webgl);
    assert.deepEqual(report.errors,[],'No unexpected browser errors');checked('console and network health',[]);
    report.passed=true;
  })(),25*60_000,'direct-start case');
}catch(error){report.failure=error.stack??String(error);log('FAILED '+error.message);
  if(page){try{report.failureState=await snapshot();}catch{}try{await bounded(page.screenshot({path:resolve(output,name+'-failure.png'),timeout:20_000}),25_000,'failure screenshot');report.screenshots.push(name+'-failure.png');}catch{}}
}finally{
  if(browser){try{await bounded(browser.close(),30_000,'browser cleanup');}catch(error){report.passed=false;report.cleanupFailure=String(error);}}
  server.closeAllConnections();server.close();report.finishedAt=new Date().toISOString();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  console.log('BELLE_STARTUP_RESULT '+JSON.stringify({case:name,passed:report.passed,checks:report.checks.map(x=>x.check),failure:report.failure,performance:report.performanceConclusion,errors:report.errors}));
}
process.exit(report.passed?0:1);
