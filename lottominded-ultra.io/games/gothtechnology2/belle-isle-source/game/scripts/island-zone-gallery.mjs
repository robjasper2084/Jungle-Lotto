/** Belle Isle eight-site × cloud/lighting environment gallery.
 * Runs on the real built 3D game via the public Island Guide and real GPU fences.
 * Never seeds location/camera state or claims physical hardware performance.
 * From game/: node scripts/island-zone-gallery.mjs
 * ENV_GALLERY_DEVICE=phone or desktop; reference photos remain local/optional.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import zones from '../src/belle/environmentZones.json' with {type:'json'};
import {createCoopStaticServer} from './coop-static-server.mjs';
import {launchGalleryBrowser,galleryRenderer} from './gallery-renderer.mjs';

const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:150000});
const device=process.env.ENV_GALLERY_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const output=process.env.ENV_GALLERY_OUTPUT_DIR?resolve(process.env.ENV_GALLERY_OUTPUT_DIR):resolve(game,'output/island-zone-gallery',device);
const sites=zones.zones.flatMap(zone=>zone.stops.map((stop,conditionIndex)=>({
 id:zone.id+'-'+stop.id,zone:zone.id,name:stop.destinationName,
 search:new RegExp('^'+stop.destinationName.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'$','i'),
 note:stop.focus,destinationName:stop.destinationName,conditionIndex,
 reference:'https://www.michigan.gov/recsearch/parks/belleisle'
})));
const quick=process.env.ENV_GALLERY_QUICK==='1';
const qualities=quick?[device==='phone'?'smooth':'high']:['smooth','automatic','high'];
const lights=[
 {id:'clear-noon',value:'12',clouds:'clear'},
 {id:'overcast-sunset',value:'17.8',clouds:'overcast'},
 ...(quick?[]:[{id:'scattered-afternoon',value:'16.7',clouds:'scattered'},{id:'layered-dusk',value:'18.5',clouds:'layered'}])
];
const lightsFor=site=>quick?[lights[site.conditionIndex%2]]:lights;
await mkdir(output,{recursive:true});
const report={head:process.env.ENV_GALLERY_SOURCE_SHA||process.env.GITHUB_SHA||null,sourceTree:process.env.ENV_GALLERY_SOURCE_TREE||null,
 mode:process.env.ENV_GALLERY_MODE||null,hostPlatform:process.platform,route:zones.id,device,viewport,quick,qualities,skyConditions:lights,frameTargetFps:device==='phone'?30:60,
 fpsCertified:false,
 source:'real built browser game; guide Travel action',
 limitations:['Not physical-device FPS certification','Travel cameras may not frame the intended bridge exactly','Reference photos are not bundled or distributed'],
 passed:false,visits:[],errors:[],failedRequests:[],coverageGaps:[]};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
const rawUrl=process.env.ENV_GALLERY_URL||'http://127.0.0.1:'+server.address().port+'/';
const url=new URL(rawUrl);url.searchParams.set('profile','1');
const origin=url.href;
const round=n=>Number(n.toFixed(2));
async function painted(page){
 const frame=()=>page.locator('#profile').getAttribute('data-active-frames').then(Number);
 const first=await frame();
 await expect.poll(frame).toBeGreaterThan(first+2);
 const proof=await page.locator('#game').evaluate(()=>new Promise((resolve,reject)=>{
  const gl=document.querySelector('#game')?.getContext('webgl2');
  if(!gl||gl.isContextLost())return reject(Error('Real WebGL renderer unavailable'));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),began=performance.now();
  if(!sync)return reject(Error('GPU fence unavailable'));
  gl.flush();
  const poll=()=>{
   const s=gl.clientWaitSync(sync,0,0);
   if(s===gl.CONDITION_SATISFIED||s===gl.ALREADY_SIGNALED){gl.deleteSync(sync);return requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({gpuFence:true,elapsedMs:performance.now()-began})));}
   if(s===gl.WAIT_FAILED||performance.now()-began>60000){gl.deleteSync(sync);return reject(Error('GPU-frame proof failed or timed out'));}
   requestAnimationFrame(poll);
  };poll();
 }));
 return proof;
}
async function openMenu(page){
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
}
async function configureSky(page,time,quality,clouds){
 await openMenu(page);await page.locator('#settings-open').click();
 const cycle=page.locator('#sky-cycle');if(await cycle.isChecked())await cycle.uncheck();
 await page.locator('#sky-preset').selectOption(time);
 await page.locator('#sky-clouds').selectOption(clouds);
 await page.locator('#quality').selectOption(quality);
 await page.locator('#fps').selectOption(device==='phone'?'30':'60');
 await page.locator('[data-close="settings"]').click();
}
async function travel(page,site){
 await openMenu(page);await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:site.search})}).first();
 await expect(card).toBeVisible();
 const found=await card.locator('h3').innerText();
 await card.getByRole('button',{name:/Travel/}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 return found;
}
try{
 browser=await launchGalleryBrowser(chromium,process.env.ENV_GALLERY_BROWSER==='chromium'?undefined:'chrome');
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(150000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',request=>report.failedRequests.push((request.failure()?.errorText||'network failure')+' '+request.url()));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 report.renderer=await galleryRenderer(page);
 report.browserViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio}));
 const motion=page.locator('#startup-motion');
 if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 for(const quality of qualities)for(const site of sites)for(const light of lightsFor(site)){
  await configureSky(page,light.value,quality,light.clouds);
  const entry={id:site.id,zone:site.zone,site:site.name,quality,light:light.id,clouds:light.clouds,expectedReference:site.note,passed:false};
  try{
   entry.destination=await travel(page,site);
   const frame=await painted(page);
   await expect.poll(()=>page.locator('#profile').getAttribute('data-quality')).toBe(quality);
   await expect.poll(()=>page.locator('#destination').textContent()).toContain(site.destinationName);
   const file=site.id+'-'+quality+'-'+light.id+'.png';
   const bytes=await page.screenshot({path:resolve(output,file),timeout:180000});
   if(bytes.length<15000)throw Error('Game screenshot unexpectedly empty');
   entry.passed=true;entry.screenshot=file;entry.screenshotBytes=bytes.length;
   entry.sha256=createHash('sha256').update(bytes).digest('hex');
   entry.frame=frame;entry.place=await page.locator('#place').textContent();
   entry.profile=await page.locator('#profile').textContent();
   entry.profileData=await page.locator('#profile').evaluate(node=>Object.fromEntries(Object.entries(node.dataset)));
   entry.rockReview=await page.evaluate(()=>({state:document.documentElement.dataset.polyhavenRockReview||null,loaded:document.documentElement.dataset.polyhavenRockReview==='loaded',visible:Number(document.documentElement.dataset.polyhavenRockVisible||0)}));
   entry.settings=await page.evaluate(()=>({quality:document.querySelector('#quality')?.value,time:document.querySelector('#sky-hour')?.value,
    clouds:document.querySelector('#sky-clouds')?.value,cycle:document.querySelector('#sky-cycle')?.checked,cap:document.querySelector('#fps')?.value,
    focused:document.hasFocus(),visibility:document.visibilityState}));
   entry.benchmarkStatus='unverified/software GPU - run physical hardware review';
  }catch(error){
   entry.passed=false;entry.failure=String(error);report.coverageGaps.push(site.id+' '+quality+' '+light.id+': '+error);
  }
  report.visits.push(entry);
 }
 if(process.env.ENV_GALLERY_POLYHAVEN==='1'&&!report.visits.some(v=>v.passed&&v.rockReview?.loaded&&v.rockReview.visible>0))report.errors.push('No captured visit reported active source-rock instances');
 report.passed=report.visits.length===sites.reduce((n,site)=>n+lightsFor(site).length,0)*qualities.length&&report.visits.every(v=>v.passed)&&!report.errors.length&&!report.failedRequests.length&&!report.coverageGaps.length;
}catch(error){
 report.errors.push(error.stack||String(error));
}finally{
 if(browser)await browser.close().catch(e=>report.errors.push('Browser close: '+e.message));
 await new Promise((ok,reject)=>server.close(error=>error?reject(error):ok())).catch(e=>report.errors.push('Server close: '+e.message));
 report.passed=report.passed&&!report.errors.length&&!report.failedRequests.length&&!report.coverageGaps.length;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
}
const safe=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=sites.map(site=>'<section><h2>'+safe(site.zone)+' · '+safe(site.name)+'</h2><p>'+safe(site.note)+'</p>'+qualities.map(quality=>lightsFor(site).map(light=>{
 const a=report.visits.find(x=>x.id===site.id&&x.quality===quality&&x.light===light.id);
 return '<figure><figcaption>'+safe(quality)+' · '+safe(light.id)+' · '+safe(a?.destination||'NOT CAPTURED')+'</figcaption>'+(a?.screenshot?'<img src="'+a.screenshot+'" alt="'+safe(site.name)+' '+safe(quality)+' '+safe(light.id)+'">':'<p>Missing genuine game screenshot</p>')+'</figure>';
}).join('')).join('')+'</section>').join('');
await writeFile(resolve(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Belle Isle Environment Reference Gallery</title><style>body{background:#171c22;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}section{border:1px solid #38404a;padding:18px}img{max-width:100%;height:auto}figure{margin:8px 0}p{color:#b9c1c8}</style><h1>Four-zone island-wide environmental review — '+safe(device)+'</h1><p>Real browser-game screenshots only. Software-rendered frames do not prove device FPS or photorealism. Compare your own reference photos; inspect water visibility and silhouette before accepting each stop.</p><main>'+cards+'</main>','utf8');
console.log(JSON.stringify({passed:report.passed,device,completed:report.visits.filter(x=>x.passed).length,missing:report.coverageGaps,errors:report.errors.slice(0,8)}));
if(!report.passed)process.exitCode=1;
