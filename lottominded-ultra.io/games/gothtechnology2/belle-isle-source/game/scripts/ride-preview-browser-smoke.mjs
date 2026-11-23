/** Isolated real-WebGL ride chooser component smoke. Not full-island release acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {transform} from 'esbuild';
const game=resolve(import.meta.dirname,'..'),out=resolve(game,process.env.BELLE_PREVIEW_OUTPUT||'output/ride-preview');
const require=createRequire(import.meta.url);
function dependency(name){try{return require(name);}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;return createRequire(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))(name);}}
let chromium;try{({chromium}=dependency('playwright'));}catch{({chromium}=dependency('@playwright/test'));}
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=['src/belle/ridePreview.ts','src/belle/rideSetup.ts','src/belle/rideSetup.css','src/belle/vehicles/models.ts'];
async function sourceHashes(){return Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await readFile(resolve(game,file)))])));}
const baseline=process.env.BELLE_PREVIEW_COMPARE_BASE;
if(baseline)assert.match(baseline,/^[0-9a-f]{40}$/);
const baselineSource=baseline?execFileSync('git',['show',baseline+':lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/ridePreview.ts'],{cwd:game,encoding:'utf8'}).replace(/from '\.\/([^']+)'/g,"from '/src/belle/$1'"):null;
const baselineModule=baselineSource?(await transform(baselineSource,{loader:'ts',format:'esm',target:'es2022'})).code:null;
await mkdir(out,{recursive:true});
const report={scope:'Isolated chooser component; real production preview/setup modules, actual GLBs, native input and real SwiftShader WebGL. No full island, gameplay, production deployment or device-speed certification.',checkout:execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),workingTreeSources:await sourceHashes(),baselineFactoryCommit:baseline??null,baselineFactoryHash:baselineSource?hash(baselineSource):null,startedAt:new Date().toISOString(),passed:false,cases:[],errors:[]};
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ride preview component verification</title><link rel="icon" href="data:,"><style>
body{margin:0;padding:24px;box-sizing:border-box;background:#07141a;color:#e9eddf;font:14px Arial,sans-serif}h1{font:24px Georgia,serif;margin:0 0 8px}p{max-width:590px;line-height:1.5;color:#afc1c0}details.cinema-ride-picker{position:relative;box-sizing:border-box;width:min(590px,calc(100vw - 48px));max-height:none;background:#0b2029;border:1px solid #8fa7aa;border-radius:5px}details.cinema-ride-picker[open]{height:290px;max-height:290px;overflow:auto}summary{min-height:44px;box-sizing:border-box;padding:12px;cursor:pointer}details .ride-setup{padding:18px}.cinema-actions{display:none}.component-footer{max-width:590px;margin-top:12px;font-size:12px}@media(max-width:600px){body{padding:16px}h1{font-size:19px}p{font-size:12px}details.cinema-ride-picker{width:calc(100vw - 32px)}details.cinema-ride-picker[open]{height:255px;max-height:255px}}
</style></head><body><h1>Ride chooser · component verification</h1><p>Actual vehicle models and production chooser code. This isolated component does not load the island or certify gameplay performance.</p><section id="welcome"><div class="cinema-actions"></div></section><p class="component-footer">Use the normal chooser and scroll to view each ride.</p><script type="module" src="/component-fixture.mjs"></script></body></html>`;
const fixtureModule=`import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createRideSetup} from '/src/belle/rideSetup.ts';
const factory=new URLSearchParams(location.search).has('baseline')?await import('/baseline-preview.ts'):await import('/src/belle/ridePreview.ts');
const evidence=window.__previewEvidence={events:[],ready:[],drawCalls:0};
for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){evidence.drawCalls++;return original.apply(this,args);};}
const screen=document.querySelector('#welcome');createRideSetup(screen);
const host=screen.querySelector('.ride-setup'),picker=document.createElement('details');picker.className='cinema-ride-picker';picker.innerHTML='<summary>Choose your ride &amp; view</summary>';host.before(picker);picker.append(host);
picker.addEventListener('click',event=>evidence.events.push({type:event.type,trusted:event.isTrusted,at:performance.now(),target:event.target.closest('label')?.querySelector('input')?.value??event.target.tagName}));
const seen=new Set();new MutationObserver(()=>{for(const label of host.querySelectorAll('label.preview-ready')){const vehicle=label.querySelector('input')?.value;if(!seen.has(vehicle)){seen.add(vehicle);evidence.ready.push({vehicle,at:performance.now(),drawCalls:evidence.drawCalls});}}}).observe(host,{attributes:true,subtree:true,attributeFilter:['class']});
const loader=new GLTFLoader(),wheel=await loader.loadAsync('/exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb');
let preview,bike;const loadBike=()=>bike??=loader.loadAsync('/belle/vehicles/hero-hoverbike.glb').then(asset=>asset.scene.getObjectByName('HoverBikeRoot')??asset.scene);
picker.addEventListener('toggle',()=>{if(picker.open&&!preview)preview=factory.createRidePreview(host,wheel.scene,loadBike);preview?.setActive(picker.open);});
window.addEventListener('pagehide',()=>preview?.dispose());document.body.dataset.fixtureReady='true';`;
const server=await createServer({root:game,configFile:false,publicDir:resolve(game,'public'),logLevel:'error',cacheDir:resolve(out,'vite-cache'),optimizeDeps:{noDiscovery:true,include:['three','fflate']},server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{name:'ride-preview-component-fixture',configureServer(server){server.middlewares.use((request,response,next)=>{const path=new URL(request.url,'http://fixture').pathname;if(path==='/'){response.setHeader('Content-Type','text/html');response.end(fixture);}else next();});},resolveId(id){if(id==='/component-fixture.mjs')return '\0component-fixture.mjs';if(id==='/baseline-preview.ts'&&baselineModule)return '\0baseline-preview.ts';},load(id){if(id==='\0component-fixture.mjs')return fixtureModule;if(id==='\0baseline-preview.ts')return baselineModule;}}]});
let browser;
function componentFence(canvas){
 const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost()||!canvas.width||!canvas.height)throw Error('Preview requires a live nonempty canvas.');
 const debug=gl.getExtension('WEBGL_debug_renderer_info'),renderer=gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),submittedAt=performance.now();
 return new Promise((resolve,reject)=>{const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync){reject(Error('Preview GPU fence unavailable'));return;}let timer,deadline,paints=0,settled=false;const finish=(error,completedAt)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(deadline);gl.deleteSync(sync);if(error||gl.isContextLost())reject(error??Error('Preview context lost before capture'));else resolve({renderer,submittedAt,completedAt,paintOpportunities:paints,width:canvas.width,height:canvas.height});};
 const poll=()=>{if(gl.isContextLost()){finish(Error('Preview context lost'));return;}const status=gl.clientWaitSync(sync,0,0);if(status===gl.TIMEOUT_EXPIRED){timer=setTimeout(poll,16);return;}if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED){finish(Error('Preview GPU fence failed'));return;}const completedAt=performance.now();requestAnimationFrame(()=>{paints++;requestAnimationFrame(()=>{paints++;finish(null,completedAt);});});};deadline=setTimeout(()=>finish(Error('Preview fence exceeded 45 seconds')),45000);gl.flush();poll();});
}
const modelPath=url=>/\.(?:glb|glb\.gz)(?:\?|$)/.test(url)?new URL(url).pathname:null;
async function capture(page,record,name){if(record.baseline)await page.waitForFunction(()=>window.__previewEvidence.drawCalls>Math.max(0,...window.__previewEvidence.ready.map(item=>item.drawCalls)));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const gpu=await page.locator('.ride-preview-canvas').evaluate(componentFence);assert(gpu.completedAt>=gpu.submittedAt&&gpu.paintOpportunities===2);const file=record.name+'-'+name+'.png',bytes=await page.screenshot({path:resolve(out,file)});record.captures.push({file,sha256:hash(bytes),bytes:bytes.length,gpu});return bytes;}
async function visibleVehicles(page){return page.locator('.ride-preview-slot').evaluateAll(slots=>{const picker=document.querySelector('.cinema-ride-picker').getBoundingClientRect();return slots.flatMap(slot=>{const r=slot.getBoundingClientRect();return Math.min(picker.bottom,innerHeight,r.bottom)>Math.max(picker.top,0,r.top)&&Math.min(picker.right,innerWidth,r.right)>Math.max(picker.left,0,r.left)?[slot.closest('label').querySelector('input').value]:[];});});}
async function waitReady(page,vehicle){await page.waitForFunction(vehicle=>document.querySelector('input[value="'+vehicle+'"]')?.closest('label')?.classList.contains('preview-ready'),vehicle,{timeout:45000});}
async function scrollToRide(page,vehicle){
 for(let attempt=0;attempt<12;attempt++){const bounds=await page.locator('input[value="'+vehicle+'"]').evaluate(input=>{const card=input.closest('label').getBoundingClientRect(),picker=document.querySelector('.cinema-ride-picker').getBoundingClientRect();return{card:{top:card.top,bottom:card.bottom},picker:{left:picker.left,right:picker.right,top:picker.top,bottom:picker.bottom},center:(card.top+card.bottom)/2};});
  if(bounds.center>bounds.picker.top+15&&bounds.center<bounds.picker.bottom-15)return;
  await page.mouse.move((bounds.picker.left+bounds.picker.right)/2,(bounds.picker.top+bounds.picker.bottom)/2);await page.mouse.wheel(0,bounds.center<bounds.picker.top?-180:180);await page.waitForTimeout(80);
 }
 throw Error('Native scrolling did not reveal '+vehicle);
}
async function runCase(name,viewport,mobile,base=false){
 const record={name,viewport,mobile,baseline:base,passed:false,requests:[],errors:[],failedRequests:[],captures:[],metrics:{}};report.cases.push(record);
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(45000);
 const started=Date.now();page.on('pageerror',e=>record.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());});page.on('request',request=>{const path=modelPath(request.url());if(path)record.requests.push({path,startedMs:Date.now()-started});});page.on('requestfailed',request=>{record.failedRequests.push({url:request.url(),error:request.failure()?.errorText});});page.on('response',response=>{if(response.status()>=400)record.errors.push('HTTP '+response.status()+' '+response.url());});
 try{
  await page.goto(origin+'/?'+(base?'baseline=1':''),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
  record.beforeOpenRequests=record.requests.map(r=>r.path);const openAt=Date.now();await page.locator('summary').click();record.metrics.summaryClickMs=Date.now()-openAt;
  const initialVisible=await visibleVehicles(page);record.initialVisible=initialVisible;
  assert.deepEqual(initialVisible,['onewheel','hoverbike'],'fixture must initially expose only the first row');
  await waitReady(page,'hoverbike');record.metrics.firstHoverReadyMs=Date.now()-openAt;
  if(base){await page.waitForFunction(()=>document.querySelectorAll('.ride-options label.preview-ready').length===5,null,{timeout:90000});record.metrics.allPreviewsReadyMs=Date.now()-openAt;}
  await capture(page,record,'first-open');record.afterFirstOpenRequests=record.requests.map(r=>r.path);
  if(!base){assert(!record.requests.some(r=>/jetson|corleo|cadillac|pilot-/.test(r.path)),'opening must not request clipped vehicles');}
  const choose=async vehicle=>{await scrollToRide(page,vehicle);const label=page.locator('.ride-options label').filter({has:page.locator('input[value="'+vehicle+'"]')});const begin=Date.now();if(mobile)await label.tap();else await label.click();assert.equal(await page.locator('input[value="'+vehicle+'"]').isChecked(),true);await waitReady(page,vehicle);record.metrics[vehicle+'SelectionToPreviewMs']=Date.now()-begin;await capture(page,record,vehicle);};
  await choose('hoverbike');
  if(!base){
   await choose('jetson');await choose('corleo');await choose('cadillac');
   assert(!record.requests.some(r=>/CORLEO_.*\.glb(?:\.gz)?$/.test(r.path)),'decorative CORLEO must not request gameplay action packages');
   const before=record.requests.map(r=>r.path);await page.locator('summary').click();assert.equal(await page.locator('details').getAttribute('open'),null);await page.locator('summary').click();await choose('hoverbike');assert.deepEqual(record.requests.map(r=>r.path),before,'reopen must reuse prepared models');
   const beforeIdle=await page.evaluate(()=>window.__previewEvidence.drawCalls),first=await capture(page,record,'reduced-before-idle');await page.waitForTimeout(700);const second=await capture(page,record,'reduced-after-idle'),afterIdle=await page.evaluate(()=>window.__previewEvidence.drawCalls);record.metrics.reducedIdle={beforeDrawCalls:beforeIdle,afterDrawCalls:afterIdle,image:{identical:first.equals(second),sha256Before:hash(first),sha256After:hash(second)}};assert.equal(afterIdle,beforeIdle,'reduced motion must retain the picture without redrawing static models');assert.equal(record.metrics.reducedIdle.image.identical,true,'the displayed preview must persist while idle with preserveDrawingBuffer false');
   await page.setViewportSize({width:viewport.width-40,height:viewport.height-30});await waitReady(page,'hoverbike');await capture(page,record,'resized');
   await page.emulateMedia({reducedMotion:'no-preference'});const beforeMotion=await page.evaluate(()=>window.__previewEvidence.drawCalls);await page.waitForFunction(before=>window.__previewEvidence.drawCalls>before,beforeMotion);await capture(page,record,'animated');record.metrics.motionResumed=true;
  }
  record.events=await page.evaluate(()=>window.__previewEvidence);assert(record.events.events.length>0&&record.events.events.every(e=>e.trusted),'all recorded chooser clicks must be genuine browser input');
  record.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.(?:glb|glb\.gz)(?:\?|$)/.test(e.name)).map(e=>({path:new URL(e.name).pathname,duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize})));
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.failedRequests,[]);record.passed=true;
 }catch(error){record.failure=error.stack||String(error);try{const file=name+'-failure.png';await page.screenshot({path:resolve(out,file)});record.failureScreenshot=file;}catch(captureError){record.errors.push(captureError.message);}throw error;}
 finally{
  try{await context.close();}catch(error){record.errors.push('Context cleanup: '+(error.stack||String(error)));}
  record.passed=record.passed&&!record.failure&&!record.errors.length&&!record.failedRequests.length;
 }
 assert.equal(record.passed,true,'Preview case must remain clean through context cleanup');
}
let origin;
try{
 await server.listen();origin='http://127.0.0.1:'+server.httpServer.address().port;
 if(process.argv.includes('--check-fixture-http')){
  for(const path of ['/component-fixture.mjs',...(baseline?['/baseline-preview.ts']:[])]){const response=await fetch(origin+path),source=await response.text();assert.equal(response.status,200,path+' must compile');assert(!/from ['"]three(?:\/|['"])/.test(source),path+' must have Vite-transformed browser imports');if(path==='/baseline-preview.ts')assert(!source.includes('ownedVehicles:VehicleModel'), 'baseline TypeScript must be compiled');console.log(JSON.stringify({path,status:response.status,transformedBytes:Buffer.byteLength(source)}));}
  await server.close();console.log('Fixture HTTP transform check passed; no browser verification was run.');process.exit(0);
 }
 browser=await chromium.launch({...(process.env.BELLE_BROWSER_PATH?{executablePath:process.env.BELLE_BROWSER_PATH}:{channel:'chrome'}),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});report.browser=browser.version();
 if(baseline){console.log('Ride preview component: baseline desktop');await runCase('baseline-desktop',{width:1100,height:800},false,true);}
 console.log('Ride preview component: candidate desktop');await runCase('candidate-desktop',{width:1100,height:800},false);
 console.log('Ride preview component: candidate phone');await runCase('candidate-phone',{width:390,height:700},true);
 assert.deepEqual(await sourceHashes(),report.workingTreeSources,'component source changed during verification');report.passed=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{try{await browser?.close();}catch(error){report.errors.push('Browser cleanup: '+error.message);}try{await server.close();}catch(error){report.errors.push('Server cleanup: '+error.message);}report.finishedAt=new Date().toISOString();for(const record of report.cases)record.passed=record.passed&&!record.failure&&!record.errors.length&&!record.failedRequests.length;report.passed=report.passed&&!report.errors.length&&report.cases.length===(baseline?3:2)&&report.cases.every(record=>record.passed&&!record.errors.length&&!record.failedRequests.length);await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({name,passed,failure,metrics,requests})=>({name,passed,failure,metrics,modelRequests:requests.length})),errors:report.errors},null,2));if(!report.passed)process.exitCode=1;}
