/** Actual in-game visual evidence: Guide Travel UI, real WebGL2 and GPU fence. */
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {launchGalleryBrowser,galleryRenderer} from './gallery-renderer.mjs';
const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:150000});
const device=process.env.JEFFERSON_CAPTURE_DEVICE==='phone'?'phone':'desktop';
const out=resolve(game,'output/jefferson-armory-game',device),viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
await mkdir(out,{recursive:true});
const result={head:process.env.GITHUB_SHA||null,device,viewport,actualGame:true,source:'Guide Travel UI, genuine browser WebGL2 and GPU-fenced frames',
  stagedState:null,renderer:null,place:null,camera:null,profile:null,screenshot:null,errors:[],failedRequests:[],passed:false,
  limitations:['Not a walk/drive/fly collision sweep','Emulated phone viewport is not a physical phone','Building heights remain unsurveyed']};
const server=createCoopStaticServer(resolve(game,'dist'));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await launchGalleryBrowser(chromium,process.env.JEFFERSON_CAPTURE_BROWSER==='chromium'?undefined:'chrome');
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(150000);
 page.on('pageerror',error=>result.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')result.errors.push(message.text());});
 page.on('requestfailed',request=>result.failedRequests.push((request.failure()?.errorText||'failed')+' '+request.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1&gds-capture=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 result.renderer=await galleryRenderer(page);
 const motion=page.locator('#startup-motion');
 if(await motion.getAttribute('aria-pressed')!=='true')await motion.click();
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
 await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:'Detroit Naval Armory Jefferson QA'})}).first();
 await expect(card).toBeVisible();
 await card.getByRole('button',{name:/Travel/}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__jeffersonStageStatus?.()||null)).toMatchObject({ready:true,legacyVisible:false,modelVisible:true,collisionChanged:false});
 result.stagedState=await page.evaluate(()=>window.__jeffersonStageStatus());
 const nextFrames=()=>page.locator('#profile').getAttribute('data-active-frames').then(Number);
 const previous=await nextFrames();await expect.poll(nextFrames).toBeGreaterThan(previous+2);
 result.gpuFence=await page.locator('#game').evaluate(()=>new Promise((ok,fail)=>{
  const gl=document.querySelector('#game')?.getContext('webgl2');if(!gl||gl.isContextLost())return fail(Error('WebGL2 unavailable'));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),started=performance.now();if(!sync)return fail(Error('No WebGL fence'));
  gl.flush();const poll=()=>{const s=gl.clientWaitSync(sync,0,0);
   if(s===gl.CONDITION_SATISFIED||s===gl.ALREADY_SIGNALED){gl.deleteSync(sync);return requestAnimationFrame(()=>requestAnimationFrame(()=>ok({complete:true,ms:performance.now()-started})));}
   if(s===gl.WAIT_FAILED||performance.now()-started>60000){gl.deleteSync(sync);return fail(Error('GPU fence timed out'));}
   requestAnimationFrame(poll);};poll();
 }));
 result.screenshot='Naval-Armory-Jefferson-'+device+'-in-game.png';
 await page.screenshot({path:resolve(out,result.screenshot),timeout:180000});
 result.place=await page.locator('#place').textContent();
 result.camera=await page.evaluate(()=>window.__gdsCamera?.()||null);
 result.profile=await page.locator('#profile').evaluate(node=>Object.fromEntries(Object.entries(node.dataset)));
 result.passed=!result.errors.length&&!result.failedRequests.length&&!!result.gpuFence?.complete&&result.stagedState.ready&&!result.stagedState.legacyVisible;
}catch(e){result.errors.push(e.stack||String(e));}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(result,null,2)+'\n');await browser?.close().catch(()=>{});await new Promise(ok=>server.close(ok));}
console.log(JSON.stringify({passed:result.passed,device,stage:result.stagedState,screenshot:result.screenshot,errors:result.errors.slice(0,2)}));
if(!result.passed)process.exitCode=1;
