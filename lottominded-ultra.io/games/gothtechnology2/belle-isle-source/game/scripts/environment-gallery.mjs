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
// The older published Guide has substitute locations, NOT camera-matched
// Sylvan or Casino-bank viewpoints. Their screenshots stay contextual only.
const baselineFallback={
 'wooded-canal':{search:/Nashua Canal/i,action:/Travel/},
 'red-pedestrian-bridge':{search:/Belle Isle Casino/i,action:/Travel/},
 'swimming-beach':{search:/Belle Isle Beach/i,action:/Walk onto the beach/}
};
const sites=[
 {id:'macarthur',name:'MacArthur Bridge',search:/MacArthur Bridge overlook/i,
  note:'Real MacArthur arch and river crossing; check the bridge identity'},
 {id:'wooded-canal',name:'Wooded Sylvan Canal',search:/Sylvan Canal · wooded banks/i,action:/Visit canal view/i,
  note:'Actual mapped Sylvan Canal bank, not the Wet-Mesic forest road'},
 {id:'red-pedestrian-bridge',name:'Casino Way Bridge · bank side',search:/Casino Way Bridge · bank side/i,action:/Visit red bridge/i,wayId:'106948146',
  note:'Historically mapped Casino Way bridge, OSM way 106948146; verify railwork in the true game frame'},
 {id:'swimming-beach',name:'Belle Isle Swimming Beach',search:/Belle Isle Beach/i,action:/Walk onto the beach/i,
  note:'Real on-foot swimming beach footprint, not the nearby Park service shed'},
];
// CI runs each genuine lighting pass independently, retaining both required
// lighting cases on desktop and phone without sharing a long-lived GPU context.
const selectedLight=process.env.ENV_GALLERY_LIGHT||'all';
assert.ok(['all','high-noon','sunset'].includes(selectedLight),'Unknown environment gallery lighting selection');
const lights=[{id:'high-noon',value:'12'},{id:'sunset',value:'17.8'}].filter(l=>selectedLight==='all'||l.id===selectedLight);
await mkdir(output,{recursive:true});
const report={head:process.env.GITHUB_SHA||null,variant,device,viewport,
 source:'real built browser game; genuine Guide travel and GPU fence; Chrome SwiftShader',
 pairingComplete:false,
 comparisonLimitations:['Old published Nashua Canal/Casino Guide viewpoints are contextual, not camera-matched. Do not assert historic visual parity.'],
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
 const historic=variant==='baseline'?baselineFallback[site.id]:undefined;
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:historic?.search||site.search})}).first();
 await expect(card).toBeVisible();
 const found=await card.locator('h3').innerText();
 await card.getByRole('button',{name:historic?.action||site.action||/Travel/}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 return {destination:found,comparable:!historic||site.id==='swimming-beach',
  source:historic?'published Guide context substitute (NOT camera-matched)':'mapped candidate Guide view'};
}
// Each lighting pass still captures all four real guide destinations with the
// same WebGL frame/fence assertions. Recreate the SwiftShader page halfway
// through to release its accumulated GPU resources before the third stop.
async function openActiveRidePage(){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(150000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',request=>report.failedRequests.push((request.failure()?.errorText||'network failure')+' '+request.url()));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 const motion=page.locator('#startup-motion');
 if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 return page;
}
try{
 const launch=()=>chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 browser=await launch();
 for(const light of lights){
  let page;
  try{
   page=await openActiveRidePage();
   await configureSky(page,light.value);
   for(let i=0;i<sites.length;i++){
    if(i===2){
     await page.close();
     await browser.close();
     browser=await launch();
     page=await openActiveRidePage();
     await configureSky(page,light.value);
    }
    const site=sites[i];
    const entry={id:site.id,site:site.name,light:light.id,expectedReference:site.note,passed:false};
    try{
     const arrival=await travel(page,site);
     entry.destination=arrival.destination;
     entry.comparable=arrival.comparable;
     entry.cameraBasis=arrival.source;
     entry.wayId=site.wayId??null;
     // After the new-browser boundary, a modal Guide click can leave the page
     // without keyboard/animation focus. Restore foreground browser focus
     // through genuine Playwright UI actions, not injected frames or poses.
     await page.bringToFront();
     await page.locator('#game').focus();
     entry.focus=await page.evaluate(()=>({focused:document.hasFocus(),
      visibility:document.visibilityState,activeElement:document.activeElement?.id||null}));
     if(!entry.focus.focused||entry.focus.visibility!=='visible')
      throw Error('Real gallery page is not foreground after Guide Travel: '+JSON.stringify(entry.focus));
     const frame=await painted(page);
     const file=site.id+'-'+light.id+'.png';
     await page.screenshot({path:resolve(output,file),timeout:180000});
     entry.place=await page.locator('#place').textContent();
     entry.profile=await page.locator('#profile').textContent();
     // A genuine capture at a service shed is NOT a capture of the swimming beach.
     if(variant==='candidate'&&site.id==='swimming-beach'&&!/Belle Isle Beach/i.test(entry.place||''))
      throw Error('Beach capture at wrong mapped place: '+entry.place);
     entry.passed=true;entry.screenshot=file;entry.frame=frame;
    }catch(error){
     entry.failure=String(error);
     // Keep a factual, separate stall receipt. No screenshot is counted as
     // captured unless the original >2-frame + GPU-fence proof succeeds.
     try{
      entry.failureState=await page.evaluate(()=>{
       const p=document.getElementById('profile'),gl=document.getElementById('game')?.getContext('webgl2');
       const ext=gl?.getExtension('WEBGL_debug_renderer_info');
       return {focused:document.hasFocus(),visibility:document.visibilityState,
        activeElement:document.activeElement?.id||null,frames:p?.dataset.activeFrames||null,
        frameP95Ms:p?.dataset.frameP95Ms||null,quality:p?.dataset.quality||null,
        renderer:gl?String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)):null,
        contextLost:gl?.isContextLost()??null};
      });
     }catch(diagError){entry.failureStateError=String(diagError);}
     report.coverageGaps.push(site.id+' '+light.id+': '+error);
    }
    report.visits.push(entry);
   }
  }finally{
   if(page)await page.close();
  }
 }
 report.passed=report.visits.length===sites.length*lights.length&&report.visits.every(v=>v.passed)&&!report.errors.length&&!report.failedRequests.length;
}catch(error){
 report.errors.push(error.stack||String(error));
}finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
 if(browser)await browser.close().catch(e=>report.errors.push('Browser close: '+e.message));
 await new Promise(ok=>server.close(ok));
}
const safe=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=sites.map(site=>'<section><h2>'+safe(site.name)+'</h2><p>'+safe(site.note)+'</p>'+lights.map(light=>{
 const a=report.visits.find(x=>x.id===site.id&&x.light===light.id);
 return '<figure><figcaption>'+safe(light.id)+' · '+safe(a?.destination||'NOT CAPTURED')+'</figcaption>'+(a?.screenshot?'<img src="'+a.screenshot+'" alt="'+safe(site.name)+' at '+safe(light.id)+'">':'<p>Missing genuine browser capture</p>')+'</figure>';
}).join('')+'</section>').join('');
await writeFile(resolve(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Belle Isle Environment Reference Gallery</title><style>body{background:#171c22;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}section{border:1px solid #38404a;padding:18px}img{max-width:100%;height:auto}figure{margin:8px 0}p{color:#b9c1c8}</style><h1>Environment Gallery — '+safe(variant)+' · '+safe(device)+'</h1><p>True game captures, not proof of real-device FPS. Compare your locally held reference photos beside these frames. Red-bridge identity remains provisional until visually confirmed.</p><main>'+cards+'</main>','utf8');
console.log(JSON.stringify({passed:report.passed,device,completed:report.visits.filter(x=>x.passed).length,missing:report.coverageGaps,errors:report.errors.slice(0,8)}));
if(!report.passed)process.exitCode=1;
