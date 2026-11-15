/** Read-only anti-aliasing A/B measurements of the built Belle Isle game.
 * One Chromium/SwiftShader renderer per mode; both use the same native UI course.
 * Phone is Chromium touch emulation, NOT a physical-device GPU benchmark. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname,resolve,sep} from 'node:path';

const game=resolve(import.meta.dirname,'..'),root=resolve(game,'dist');
const device=process.env.AA_COMPARE_DEVICE||'desktop';
assert(['desktop','phone'].includes(device),'AA_COMPARE_DEVICE must be desktop or phone');
const mobile=device==='phone',viewport=mobile?{width:390,height:844}:{width:1355,height:721};
const out=resolve(game,'output/aa-comparison',device);
await mkdir(out,{recursive:true});
const report={device,viewport,started:new Date().toISOString(),source:process.env.RELEASE_SOURCE_SHA??null,
 scope:'Built Belle Isle hover race with real WebGL render submissions. SwiftShader + emulated phone; not hardware FPS certification.',
 modes:{},comparison:null,passed:false,warnings:[],errors:[],screenshots:[],limitations:[
  'GPU is Chromium SwiftShader on GitHub Actions, not a mobile or discrete graphics processor.',
  'Measured FPS is main-scene render-submission cadence, not GPU scanout or display refresh.',
  'Moving-run scenes may differ slightly because rider/ghost position follows elapsed time.',
  'Screenshots are for qualitative edge/shimmer review; no invented pixel-quality score.'
 ]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.bin':'application/octet-stream','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep))throw Error('Invalid path');
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  const info=await stat(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404).end('Missing asset');}
});
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:expectBase}=require('@playwright/test');
const expect=expectBase.configure({timeout:120000});
const pct=(p,x)=>!x.length?null:x[Math.max(0,Math.ceil(x.length*p)-1)];
const round=x=>Math.round(x*100)/100;
function summarize(samples){
 const ordered=samples.filter(s=>Number.isFinite(s.at)&&Number.isFinite(s.submitMs)).sort((a,b)=>a.at-b.at);
 const intervals=ordered.slice(1).map((s,i)=>s.at-ordered[i].at).filter(x=>x>0).sort((a,b)=>a-b);
 const submits=ordered.map(s=>s.submitMs).sort((a,b)=>a-b);
 const span=ordered.length>1?ordered.at(-1).at-ordered[0].at:0;
 return{frames:ordered.length,measuredSeconds:round(span/1000),submittedFps:span>0?round((ordered.length-1)*1000/span):null,
  medianIntervalMs:pct(.5,intervals)&&round(pct(.5,intervals)),p95IntervalMs:pct(.95,intervals)&&round(pct(.95,intervals)),
  medianSubmitMs:pct(.5,submits)&&round(pct(.5,submits)),p95SubmitMs:pct(.95,submits)&&round(pct(.95,submits)),
  gapsOver50ms:intervals.filter(x=>x>50).length,gapsOver100ms:intervals.filter(x=>x>100).length};
}
const note=s=>console.log(new Date().toISOString()+' [AA] '+s);
let browser;
const origin=await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',()=>yes('http://127.0.0.1:'+server.address().port));});
process.env.PLAYWRIGHT_LEGACY_SCREENSHOT='1';

async function measure(page,label,mode) {
 await page.evaluate(()=>{const p=window.__aaProbe;p.samples=[];p.started=performance.now();p.record=true;});
 let timedOut=false;
 try{await page.waitForFunction(()=>{const p=window.__aaProbe;return p.samples.length>=20&&performance.now()-p.started>=8000;},null,{timeout:150000,polling:500});}
 catch{timedOut=true;}
 const readings=await page.evaluate(()=>{const p=window.__aaProbe;p.record=false;return{samples:p.samples,rendererObserved:p.rendererObserved,elapsed:performance.now()-p.started,course:document.querySelector('#trial-hud')?.dataset.course,status:document.querySelector('#trial-hud')?.dataset.status,paused:document.querySelector('#trial-hud')?.dataset.paused,speedKmh:parseFloat(document.querySelector('#hover-speed')?.textContent||'0')};});
 const metrics={...summarize(readings.samples),timedOut,elapsedWallSeconds:round(readings.elapsed/1000),course:readings.course,status:readings.status,paused:readings.paused,speedKmh:readings.speedKmh};
 if(!readings.rendererObserved)throw Error('Three.js renderer observation was unavailable');
 if(metrics.frames<8)throw Error('Not enough real 3D frame samples for '+mode+' '+label+': '+metrics.frames);
 if(metrics.status!=='running'||metrics.paused==='true')throw Error('Race ended or paused during '+mode+' '+label);
 const filename=device+'-'+mode+'-'+label+'.png';
 await page.screenshot({path:resolve(out,filename),timeout:150000});
 report.screenshots.push(filename);
 note(mode+' '+label+' '+JSON.stringify(metrics));
 return{...metrics,screenshot:filename};
}

async function runMode(mode){
 const r={mode,passed:false,errors:[],shots:[],metrics:{},started:new Date().toISOString()};
 report.modes[mode]=r;
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 let page,client=null,moving=false;
 try{
  // This runs before the actual game module initializes the WebGL context.
  await context.addInitScript(choice=>{
   localStorage.setItem('belle-graphics-v1',JSON.stringify({quality:'smooth',cap:30,antiAliasing:choice}));
   const probe=window.__aaProbe={rendererObserved:false,record:false,started:0,samples:[]};
   const hub=new EventTarget();window.__THREE_DEVTOOLS__=hub;
   hub.addEventListener('observe',event=>{
    const renderer=event.detail;
    if(!renderer?.isWebGLRenderer||renderer.domElement?.id!=='game')return;
    probe.rendererObserved=true;
    const real=renderer.render;
    const worldScenes=new WeakSet();
    renderer.render=function(scene,camera){
     // Skip reflection probes and offscreen buffers: time the displayed world only.
     const onscreen=this.getRenderTarget()===null;
     if(!worldScenes.has(scene)&&scene?.getObjectByName?.('Belle Isle changing sky'))worldScenes.add(scene);
     if(!onscreen||!worldScenes.has(scene))return real.call(this,scene,camera);
     const began=performance.now();
     const result=real.call(this,scene,camera);
     const done=performance.now(),h=document.querySelector('#trial-hud');
     if(probe.record&&h&&!h.hidden&&h.dataset.vehicle==='hoverbike'&&h.dataset.status==='running'&&h.dataset.paused!=='true'&&!document.hidden){
      probe.samples.push({at:done,submitMs:done-began});
      if(probe.samples.length>500)probe.samples.shift();
     }
     return result;
    };
   });
  },mode);
  page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>r.errors.push('Page error: '+e.message));
  page.on('console',m=>{if(m.type()==='error')r.errors.push('Console: '+m.text());});
  page.on('response',response=>{if(response.status()>=400)r.errors.push('HTTP '+response.status()+' '+new URL(response.url()).pathname);});
  note(device+' '+mode+' loading real game');
  await page.goto(origin+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
  const aa=await page.evaluate(()=>{
   const canvas=document.getElementById('game'),gl=canvas.getContext('webgl2');
   return{supported:!!gl&&!gl.isContextLost(),antialias:gl?.getContextAttributes()?.antialias,samples:gl?.getParameter(gl.SAMPLES),renderer:gl?.getParameter(gl.RENDERER),
    selected:document.querySelector('#anti-aliasing')?.value,quality:document.querySelector('#quality')?.value,fps:document.querySelector('#fps')?.value};
  });
  r.webgl=aa;
  assert(aa.supported,'A live WebGL2 scene is required');
  assert.equal(aa.selected,mode,'Applied preference is different from requested AA mode');
  assert.equal(aa.antialias,mode==='on','WebGL context did not grant requested MSAA; A/B is not valid');
  assert.equal(aa.quality,'smooth');assert.equal(aa.fps,'30');
  if(await page.locator('#startup-motion').getAttribute('aria-pressed')!=='true')await page.locator('#startup-motion').click();
  await page.locator('.cinema-ride-picker > summary').click();
  await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await page.getByRole('button',{name:'Use this ride',exact:true}).click();
  await page.locator('#start').click();await expect(page.locator('body')).not.toHaveClass(/at-start/);
  await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();
  await page.locator('#sky-cycle').uncheck();await page.locator('[data-close="settings"]').click();
  await page.locator('#tools-toggle').click();await page.locator('#trials-open').click();
  await expect(page.locator('#trial-board')).toBeVisible();
  await page.locator('#trial-tab-hoverbike').click();
  const course=page.locator('#trial-course-list > .trial-course[data-category="island"] button[data-course]').first();
  r.course=await course.getAttribute('data-course');assert(r.course?.includes('sky-'),'An authentic full-island hover race is required');
  await course.click();
  await expect(page.locator('#trial-hud')).toHaveAttribute('data-status','running',{timeout:180000});
  await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
  r.metrics.still=await measure(page,'start-line',mode);
  if(mobile){
   client=await context.newCDPSession(page);
   const pt=await page.locator('#hover-move-zone').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};});
   assert(pt.width>40&&pt.height>40,'Mobile hover joystick must be present');
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:pt.x,y:pt.y,force:1,radiusX:4,radiusY:4}]});
   moving=true;
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:pt.x,y:pt.y-55,force:1,radiusX:4,radiusY:4}]});
  }else{
   await page.locator('#game').focus();await page.keyboard.down('w');moving=true;
  }
  r.metrics.moving=await measure(page,'hover-racing',mode);
  assert(r.metrics.moving.speedKmh>0,'Move input did not produce forward speed; cannot call this a moving-race benchmark');
  assert.equal(r.errors.length,0,'Browser emitted errors: '+r.errors.join('; ').slice(0,500));
  r.passed=true;
 }catch(e){r.failure=e.stack||String(e);report.errors.push(mode+': '+e.message);note('FAIL '+mode+' '+e.message);}
 finally{
  if(moving)try{if(mobile)await client?.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page?.keyboard.up('w');}catch(e){report.warnings.push(mode+' input release: '+e.message);}
  if(page&&!r.passed)try{const filename=device+'-'+mode+'-failure.png';await page.screenshot({path:resolve(out,filename),timeout:150000});report.screenshots.push(filename);}catch(e){report.warnings.push(mode+' failure screenshot: '+e.message);}
  try{await context.close({reason:'AA measurement complete'});}catch(e){report.warnings.push(mode+' context close: '+e.message);}
  r.finished=new Date().toISOString();
 }
}

try{
 browser=await chromium.launch({channel:'chromium',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browser=browser.version();
 for(const mode of ['off','on'])await runMode(mode);
 const off=report.modes.off?.metrics.moving,on=report.modes.on?.metrics.moving;
 if(off&&on&&off.submittedFps>0){
  const change=round(100*(on.submittedFps/off.submittedFps-1));
  report.comparison={movingSubmittedFps:{off:off.submittedFps,on:on.submittedFps,percentChange:change},
   movingP95FrameMs:{off:off.p95IntervalMs,on:on.p95IntervalMs,deltaMs:round(on.p95IntervalMs-off.p95IntervalMs)},
   edgeReview:'Manual review required: compare paired start-line and moving-race screenshots.',
   potentialRegression:change< -15||on.p95IntervalMs>off.p95IntervalMs*1.2};
 }
 report.passed=Object.values(report.modes).every(x=>x.passed)&&Object.keys(report.modes).length===2;
 if(!report.passed)process.exitCode=1;
}finally{
 if(browser)try{await browser.close();}catch(e){report.warnings.push('Browser close: '+e.message);}
 if(server.listening){server.closeAllConnections();await new Promise(done=>server.close(done));}
 report.finished=new Date().toISOString();
 await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));
}
