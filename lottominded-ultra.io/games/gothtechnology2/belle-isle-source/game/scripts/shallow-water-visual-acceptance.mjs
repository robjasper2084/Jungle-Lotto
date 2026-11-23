/** Authentic built-game shallow-water close-up. All navigation is through
 * shipped visible UI, from a mapped dry-bank Guide destination. Captures are
 * software-Chromium visual evidence, never physical GPU certification. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
const game=resolve(import.meta.dirname,'..'),repository=resolve(game,'../../../../..');
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:180000});
const device=process.env.SHALLOW_VIS_DEVICE==='phone'?'phone':'desktop';
const quality=['high','automatic','smooth'].includes(process.env.SHALLOW_VIS_QUALITY)?process.env.SHALLOW_VIS_QUALITY:'high';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const output=resolve(game,'output/shallow-water-visual',device+'-'+quality);
await mkdir(output,{recursive:true});
const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
const expectedHead=process.env.BELLE_PR_HEAD||checkout;
assert.equal(checkout,expectedHead,'The visual capture MUST run on the exact PR source head');
const report={head:expectedHead,checkout,device,quality,viewport,source:'real local build, real Guide travel, GPU fence, Chrome SwiftShader',
 selectedGuide:null,place:null,frameProof:null,renderer:null,renderStats:null,screenshot:null,
 passed:false,visualApproved:false,physicalDeviceVerified:false,
 limitations:['Real screenshot, but not automatic pixel-level acceptance','Software Chromium is not physical hardware','Matching original-base camera and 10-minute performance remain separate gates'],
 errors:[],failedRequests:[]};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser,page;
async function showMenu(){
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
}
async function frameProof(){
 const frame=()=>page.locator('#profile').getAttribute('data-active-frames').then(Number);
 const first=await frame();
 await expect.poll(frame,{timeout:180000}).toBeGreaterThan(first+2);
 const gpu=await page.locator('#game').evaluate(()=>new Promise((resolve,reject)=>{
  const gl=document.querySelector('#game')?.getContext('webgl2');
  if(!gl||gl.isContextLost())return reject(Error('Actual game WebGL2 context unavailable'));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),began=performance.now();
  if(!sync)return reject(Error('GPU fence unavailable'));
  gl.flush();
  const poll=()=>{
   const state=gl.clientWaitSync(sync,0,0);
   if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED){
    gl.deleteSync(sync);
    return requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({gpuFence:true,paintOpportunities:2,elapsedMs:performance.now()-began})));
   }
   if(state===gl.WAIT_FAILED||performance.now()-began>60000){
    gl.deleteSync(sync);return reject(Error('GPU fence failed or exceeded 60 seconds'));
   }
   requestAnimationFrame(poll);
  };poll();
 }));
 return {first,after:await frame(),...gpu};
}
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(180000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',r=>report.failedRequests.push((r.failure()?.errorText||'request failure')+' '+r.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 const motion=page.locator('#startup-motion');
 if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 await showMenu();await page.locator('#settings-open').click();
 const cycle=page.locator('#sky-cycle');
 if(await cycle.isChecked())await cycle.uncheck();
 await page.locator('#sky-preset').selectOption('12');
 await page.locator('#quality').selectOption(quality);
 await page.locator('#fps').selectOption('30');
 await page.locator('[data-close="settings"]').click();
 await showMenu();await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:/Lagoon · submerged stone bed/i})}).first();
 await expect(card).toBeVisible();
 report.selectedGuide=await card.locator('h3').innerText();
 await card.getByRole('button',{name:'Inspect shallow water',exact:true}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 await page.bringToFront();await page.locator('#game').focus();
 const foreground=await page.evaluate(()=>({focused:document.hasFocus(),visible:document.visibilityState==='visible'}));
 assert(foreground.focused&&foreground.visible,'Actual visible browser focus required');
 report.frameProof=await frameProof();
 report.renderer=await page.locator('#game').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
  return {name:gl?String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)):null,contextLost:gl?.isContextLost()??true};
 });
 assert(!report.renderer.contextLost,'Lost WebGL renderer');
 report.renderStats=await page.locator('#profile').evaluate(e=>({...e.dataset}));
 assert.equal(report.renderStats.quality,quality,'Real game must retain requested quality');
 report.place=await page.locator('#place').textContent();
 const name='mapped-shallow-water-'+device+'-'+quality+'.png';
 await page.screenshot({path:resolve(output,name),timeout:180000});
 report.screenshot=name;
 report.passed=report.frameProof.after>report.frameProof.first+2&&report.frameProof.gpuFence&&report.frameProof.paintOpportunities===2&&!report.errors.length&&!report.failedRequests.length;
}catch(error){report.errors.push(String(error?.stack||error));}finally{
 if(browser)await browser.close().catch(e=>report.errors.push('browser cleanup '+e.message));
 await new Promise(ok=>server.close(ok));
 report.passed=report.passed&&!report.errors.length&&!report.failedRequests.length;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
}
console.log(JSON.stringify({passed:report.passed,head:report.head,device,quality,selectedGuide:report.selectedGuide,place:report.place,
 frames:report.frameProof,renderer:report.renderer?.name,errors:report.errors.slice(0,3)}));
if(!report.passed)process.exitCode=1;
