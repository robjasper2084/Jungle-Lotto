/** Belle Isle 4-site × High-Noon/Sunset reference gallery.
 * Runs on the real built 3D game via the public Island Guide and real GPU fences.
 * Never seeds location/camera state or claims physical hardware performance.
 * From game/: node scripts/environment-gallery.mjs
 * ENV_GALLERY_DEVICE=phone or desktop; reference photos remain local/optional.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';

const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:150000});
const device=process.env.ENV_GALLERY_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const variant=process.env.ENV_GALLERY_VARIANT==='baseline'?'baseline':'candidate';
const output=resolve(game,'output/environment-gallery',variant,device);
// The source-commit baseline predates our new direct sightseeing entries.
// Use only its real Guide Travel actions; mark different viewpoints unpaired.
const baselineFallback={
 'wooded-canal':{search:/Nashua Canal/i,action:/Travel/},
 'red-pedestrian-bridge':{search:/Belle Isle Casino/i,action:/Travel/},
 'casino-context':{search:/Belle Isle Casino/i,action:/Travel/},
 'swimming-beach':{search:/Belle Isle Beach/i,action:/Walk onto the beach/}
};
const sites=[
 {id:'macarthur',name:'MacArthur Bridge',search:/MacArthur Bridge overlook/i,
  note:'Concrete arches, protected riprap and bridge clearances'},
 {id:'wooded-canal',name:'Wooded Canal',search:/Sylvan Canal · wooded banks/i,action:/Visit canal view/i,
  note:'Real mapped Sylvan Canal view; verify waterside foliage and wetland bank'},
 {id:'red-pedestrian-bridge',name:'Red Pedestrian Bridge',search:/Casino Way Bridge · bank side/i,action:/Visit red bridge/i,
  note:'Historically located Casino Way crossing, photographed from a collision-safe bank-side view'},
 {id:'casino-context',name:'Casino bridge / Casino context',search:/Casino Way Bridge · Casino context/i,action:/Visit Casino context/i,
  note:'Collision-safe wider bank view with the historic crossing and Casino architecture in the same real scene'},
 {id:'swimming-beach',name:'Swimming Beach',search:/Belle Isle Beach/i,action:/Walk onto the beach/i,
  note:'Actual on-foot swimming beach view, not a service-building path'},
];
// CI runs each genuine lighting pass independently, retaining both required
// lighting cases on desktop and phone without sharing a long-lived GPU context.
const selectedLight=process.env.ENV_GALLERY_LIGHT||'all';
assert.ok(['all','high-noon','sunset'].includes(selectedLight),'Unknown environment gallery lighting selection');
const lights=[{id:'high-noon',value:'12'},{id:'sunset',value:'17.8'}].filter(l=>selectedLight==='all'||l.id===selectedLight);
await mkdir(output,{recursive:true});
const report={head:process.env.GITHUB_SHA||null,variant,device,viewport,
 source:process.env.ENV_GALLERY_BUILD_DIR?'exact production-source commit, rebuilt and served locally; real Guide Travel; Chrome SwiftShader':'real built browser game; guide Travel action; Chrome SwiftShader',
 baselineHead:process.env.ENV_GALLERY_BASE_SHA||null,
 comparisonLimitations:variant==='baseline'?['Nashua Canal and Casino are historic-guide contextual substitutes, NOT the same camera as the PR new views. Do not compute a matched four-site gain.']:[],
 limitations:['Not physical-device FPS certification','Travel cameras may not frame the intended bridge exactly','Reference photos are not bundled or distributed'],
 passed:false,intro:null,actualMacArthurRailFinish:null,railFinishAccepted:null,visits:[],errors:[],failedRequests:[],coverageGaps:[]};
const server=createCoopStaticServer(process.env.ENV_GALLERY_BUILD_DIR?resolve(process.env.ENV_GALLERY_BUILD_DIR):resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
const rawUrl=process.env.ENV_GALLERY_URL||'http://127.0.0.1:'+server.address().port+'/';
const url=new URL(rawUrl);url.searchParams.set('profile','1');
const origin=url.href;
const round=n=>Number(n.toFixed(2));
async function gpuFenced(page){
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
async function painted(page){
 const frame=()=>page.locator('#profile').getAttribute('data-active-frames').then(Number);
 const first=await frame();
 await expect.poll(frame).toBeGreaterThan(first+2);
 return gpuFenced(page);
}
async function openMenu(page){
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
}
async function configureSky(page,time){
 await openMenu(page);await page.locator('#settings-open').click();
 const cycle=page.locator('#sky-cycle');if(await cycle.isChecked())await cycle.uncheck();
 await page.locator('#sky-preset').selectOption(time);
 await page.locator('#quality').selectOption(device==='phone'?'smooth':'high');
 await page.locator('#fps').selectOption('30');
 await page.locator('[data-close="settings"]').click();
}
async function travel(page,site){
 await openMenu(page);await page.locator('#map-open').click();
 const compatible=variant==='baseline'?baselineFallback[site.id]:undefined;
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:compatible?.search||site.search})}).first();
 await expect(card).toBeVisible();
 const found=await card.locator('h3').innerText();
 await card.getByRole('button',{name:compatible?.action||site.action||/Travel/}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 return {destination:found,comparable:!compatible||site.id==='swimming-beach',action:compatible?.action?'historic-guide substitute':'candidate-guide view'};
}
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(150000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',request=>report.failedRequests.push((request.failure()?.errorText||'network failure')+' '+request.url()));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 if(variant==='candidate'){
  const profile=page.locator('#profile');
  const rawMeshes=await profile.getAttribute('data-macarthur-rail-meshes');
  const rawMaterials=await profile.getAttribute('data-macarthur-rail-materials');
  const railMeshes=rawMeshes===null?null:Number(rawMeshes),railMaterials=rawMaterials===null?null:Number(rawMaterials);
  report.actualMacArthurRailFinish={meshes:railMeshes,materials:railMaterials,source:'actual loaded landmarks.glb after material pass'};
  report.railFinishAccepted=Number.isInteger(railMeshes)&&railMeshes>0&&Number.isInteger(railMaterials)&&railMaterials>0;
  if(!report.railFinishAccepted)report.coverageGaps.push('Loaded MacArthur railing material match is zero or unreported; inspect real GLB mesh labels');
 }
 const motion=page.locator('#startup-motion');
 if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 // Reduced motion holds the first geographic flyover at a fixed camera position.
 // Capture the actual GPU-painted MacArthur view before the game transitions.
 const opening=(await page.locator('#startup-scene').textContent()||'').trim();
 if(!/MACARTHUR BRIDGE/i.test(opening))throw Error('Intro flyover is not at MacArthur Bridge: '+opening);
 const introFrame=await gpuFenced(page);
 const introFile='intro-macarthur.png';
 await page.screenshot({path:resolve(output,introFile),timeout:180000});
 report.intro={passed:true,scene:opening,screenshot:introFile,frame:introFrame,lighting:'authored startup sky',camera:'first deterministic MacArthur flyover',variant,device};
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 for(const light of lights){
  await configureSky(page,light.value);
  for(const site of sites){
   const entry={id:site.id,site:site.name,light:light.id,expectedReference:site.note,passed:false};
   try{
    const capture=await travel(page,site);
    entry.destination=capture.destination;entry.comparable=capture.comparable;entry.cameraBasis=capture.action;
    const frame=await painted(page);
    const file=site.id+'-'+light.id+'.png';
    await page.screenshot({path:resolve(output,file),timeout:180000});
    entry.passed=true;entry.screenshot=file;entry.frame=frame;
    entry.place=await page.locator('#place').textContent();
    entry.profile=await page.locator('#profile').textContent();
   }catch(error){
    entry.failure=String(error);report.coverageGaps.push(site.id+' '+light.id+': '+error);
   }
   report.visits.push(entry);
  }
 }
 report.passed=!!report.intro?.passed&&report.visits.length===sites.length*lights.length&&report.visits.every(v=>v.passed)&&!report.errors.length&&!report.failedRequests.length&&(variant==='baseline'||report.railFinishAccepted===true);
 // Every photographic pairing still needs an actual camera-equivalence review.
 report.pairingComplete=false;
 report.comparableSites=report.visits.filter(v=>v.passed&&v.comparable).map(v=>v.id);
}catch(error){
 report.errors.push(error.stack||String(error));
}finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
 if(browser)await browser.close().catch(e=>report.errors.push('Browser close: '+e.message));
 await new Promise(ok=>server.close(ok));
}
const safe=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const openingCard='<section><h2>MacArthur · Opening Flyover</h2><p>Identical first-shot camera and startup sky; verify sunset bridge arches, foliage silhouette, river suntrail and horizon.</p>'+(report.intro?.screenshot?'<figure><img src="'+safe(report.intro.screenshot)+'" alt="Real MacArthur intro flyover"></figure>':'<p>Missing intro GPU capture</p>')+'</section>';
const cards=sites.map(site=>'<section><h2>'+safe(site.name)+'</h2><p>'+safe(site.note)+'</p>'+lights.map(light=>{
 const a=report.visits.find(x=>x.id===site.id&&x.light===light.id);
 return '<figure><figcaption>'+safe(light.id)+' · '+safe(a?.destination||'NOT CAPTURED')+'</figcaption>'+(a?.screenshot?'<img src="'+a.screenshot+'" alt="'+safe(site.name)+' at '+safe(light.id)+'">':'<p>Missing genuine browser capture</p>')+'</figure>';
}).join('')+'</section>').join('');
await writeFile(resolve(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Belle Isle Environment Reference Gallery</title><style>body{background:#171c22;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}section{border:1px solid #38404a;padding:18px}img{max-width:100%;height:auto}figure{margin:8px 0}p{color:#b9c1c8}</style><h1>Environment Gallery — '+safe(variant)+' · '+safe(device)+'</h1><p>True game captures, not proof of real-device FPS. Compare your locally held reference photos beside these frames. Red-bridge identity remains provisional until visually confirmed.</p><main>'+openingCard+cards+'</main>','utf8');
console.log(JSON.stringify({passed:report.passed,device,completed:report.visits.filter(x=>x.passed).length,pairingComplete:report.pairingComplete,introCaptured:!!report.intro?.passed,missing:report.coverageGaps,errors:report.errors.slice(0,8)}));
if(!report.passed)process.exitCode=1;
