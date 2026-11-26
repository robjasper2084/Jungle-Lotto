/** Four fixed-camera real-game captures. No canvas substitution or scripted camera teleport. */
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {launchGalleryBrowser,galleryRenderer} from './gallery-renderer.mjs';

const game=resolve(import.meta.dirname,'..');
const require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:150000});
const device=process.env.BELLE_ART_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const out=resolve(game,'output/art-direction-gallery',device);
await mkdir(out,{recursive:true});
const report={sha:process.env.GITHUB_SHA??null,device,viewport,renderer:null,realGame:true,
  imageSource:'real Belle Isle game WebGL canvas and Playwright screen capture',
  samples:[],errors:[],failedRequests:[],passed:false,
  limitations:['Software browser rendering does not certify native GPU performance','Art direction is an artist palette, not measured Detroit solar conditions']};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
const modes=['authentic','golden','noir','detroit2084'];
try{
 browser=await launchGalleryBrowser(chromium,undefined);
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(150000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('requestfailed',req=>report.failedRequests.push((req.failure()?.errorText??'failed')+' '+req.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1&gds-capture=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 report.renderer=await galleryRenderer(page);
 // Start from real gameplay and use the Guide to travel to the island-side photo viewpoint.
 const pause=page.locator('#startup-motion');if(await pause.getAttribute('aria-pressed')!=='true')await pause.click();
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
 await page.locator('#map-open').click();
 const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:'MacArthur Bridge · cinematic arrival'})}).first();
 await expect(card).toBeVisible();
 await card.getByRole('button',{name:/Travel/}).click();
 await expect(page.locator('#guide')).not.toBeVisible();
 report.photoTargetView='Real MacArthur Bridge island-side approach reached through Guide';
 let baseline;
 for(const mode of modes){
  if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#settings-open').click();
  await expect(page.locator('#settings')).toBeVisible();
  await page.locator('#art-style').selectOption(mode);
  await expect(page.locator('body')).toHaveAttribute('data-art-style',mode);
  if(process.env.BELLE_BRIDGE_STONE_REVIEW==='1'){
   const stone=await page.evaluate(()=>window.__bridgePictureStatus?.()||null);
   if(!stone||!stone.active||stone.legacyVisible||!stone.legacyMarkedReplaced||
    !stone.newVisible||stone.instancedMeshes!==2||stone.stonePanels<220||
    stone.collisionChanged||stone.asBuiltVerified)
    throw Error('Stone bridge preview lacks exclusive visual proof: '+JSON.stringify(stone));
   report.stoneBridge=stone;
  }
  const skyHour=Number(await page.locator('#sky-hour').inputValue());
  const selected=await page.locator('#art-style').inputValue();
  await page.locator('#settings .close').click();
  await expect(page.locator('#settings')).not.toBeVisible();
  const frames=async()=>Number(await page.locator('#profile').getAttribute('data-active-frames'));
  const before=await frames();await expect.poll(frames).toBeGreaterThan(before+12);
  const fence=await page.locator('#game').evaluate(()=>new Promise((ok,fail)=>{
   const gl=document.querySelector('#game')?.getContext('webgl2');
   if(!gl||gl.isContextLost())return fail(Error('Missing active WebGL2'));
   const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),since=performance.now();
   if(!sync)return fail(Error('GPU fence allocation failed'));
   gl.flush();const poll=()=>{const status=gl.clientWaitSync(sync,0,0);
    if(status===gl.CONDITION_SATISFIED||status===gl.ALREADY_SIGNALED){gl.deleteSync(sync);requestAnimationFrame(()=>requestAnimationFrame(()=>ok({complete:true,ms:performance.now()-since})));return;}
    if(status===gl.WAIT_FAILED||performance.now()-since>60000){gl.deleteSync(sync);fail(Error('GPU fence did not complete'));return;}requestAnimationFrame(poll);
   };poll();
  }));
  const camera=await page.evaluate(()=>window.__gdsCamera?.()??null);
  if(!camera||!Array.isArray(camera.position)||!Array.isArray(camera.direction))throw Error('Missing real game camera receipt');
  if(camera.position[0]<300||camera.position[0]>520||camera.position[2]<600||camera.position[2]>850)throw Error('Capture not at the mapped island-side bridge approach');
  if(baseline){
   const moved=Math.hypot(...camera.position.map((v,i)=>v-baseline.position[i]));
   const turned=Math.hypot(...camera.direction.map((v,i)=>v-baseline.direction[i]));
   if(moved>3||turned>.08)throw Error('Art style capture camera drifted: '+mode+' moved '+moved+' turned '+turned);
  }else baseline=camera;
  const screenshot=mode+'-'+device+'-in-game.png';
  await page.screenshot({path:resolve(out,screenshot),timeout:180000});
  const bytes=await readFile(resolve(out,screenshot));
  if(bytes.length<12000)throw Error('Blank/trivial game screenshot: '+mode);
  const checksum=createHash('sha256').update(bytes).digest('hex');
  report.samples.push({mode,selected,skyHour,camera,fence,screenshot,bytes:bytes.length,checksum,activeFrames:await frames()});
 }
 report.passed=report.samples.length===4&&!report.errors.length&&!report.failedRequests.length&&report.samples.every(s=>s.fence.complete&&s.selected===s.mode);
}catch(error){report.errors.push(error?.stack||String(error));}
finally{
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 await browser?.close().catch(()=>{});
 await new Promise(done=>server.close(done));
}
console.log(JSON.stringify({passed:report.passed,device,renderer:report.renderer,samples:report.samples.map(s=>({mode:s.mode,file:s.screenshot,bytes:s.bytes})),errors:report.errors.slice(0,2),failedRequests:report.failedRequests.slice(0,2)}));
if(!report.passed)process.exitCode=1;
