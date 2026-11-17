/** Genuine wheel ride using browser input, on Chrome SwiftShader (not mobile hardware). */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium,expect:rawExpect}=require('@playwright/test');
const expect=rawExpect.configure({timeout:180000});
const device=process.env.BELLE_PROFILE_DEVICE==='phone'?'phone':'desktop';
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const seconds=Math.max(30,Math.min(600,Number(process.env.BELLE_PROFILE_SECONDS)||90));
const output=resolve(game,'output/sustained-profile',device);
await mkdir(output,{recursive:true});
const report={sourceHead:process.env.GITHUB_SHA||null,device,viewport,requestedSeconds:seconds,
 hardware:'Chrome SwiftShader software GPU; phone viewport is NOT physical iOS/Android hardware',
 passed:false,firstPlayableMs:null,profile:null,memory:null,errors:[],failedRequests:[],elapsedWallMs:null};
const server=createCoopStaticServer(resolve(game,'dist'));
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const begin=Date.now();let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(180000);
 page.on('pageerror',err=>report.errors.push(err.message));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 page.on('requestfailed',r=>report.failedRequests.push((r.failure()?.errorText||'failed')+' '+r.url()));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?profile=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 report.firstPlayableMs=Date.now()-begin;
 await page.locator('.cinema-ride-picker > summary').click();
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
 await page.getByRole('button',{name:'Use this ride',exact:true}).click();
 await page.locator('#start').click();
 await expect(page.locator('body')).not.toHaveClass(/at-start/);
 async function settings(){
  if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();
  await page.locator('#settings-open').click();
  await expect(page.locator('#settings')).toBeVisible();
 }
 await settings();
 await page.locator('#quality').selectOption(device==='phone'?'smooth':'high');
 const panel=page.locator('#ride-profile');
 await expect(panel).toBeAttached();
 await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Start 10-minute capture'}).click();
 await page.locator('[data-close="settings"]').click();
 await page.locator('#game').focus();
 await page.keyboard.down('w');
 await page.waitForTimeout(seconds*1000);
 await page.keyboard.up('w');
 await settings();
 await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Stop and show report'}).click();
 report.profile=JSON.parse(await panel.locator('textarea').inputValue());
 report.memory=await page.evaluate(()=>({
  jsHeap:performance.memory?{usedBytes:performance.memory.usedJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit}:null,
  userAgent:navigator.userAgent,deviceMemoryGB:navigator.deviceMemory??null,
  caveat:'JS heap is not total device RAM or GPU VRAM; physical device profiling still required'
 }));
 await page.locator('[data-close="settings"]').click();
 await page.screenshot({path:resolve(output,'riding-end.png'),timeout:180000});
 const stats=report.profile;
 report.passed=stats.frames>=8&&stats.movingSeconds>=5&&stats.distanceMetres>=3&&
  stats.metrics?.frameMs?.p95!==null&&!report.errors.length&&!report.failedRequests.length;
}catch(error){report.errors.push(String(error?.stack||error));}
finally{
 report.elapsedWallMs=Date.now()-begin;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close().catch(()=>{});
 await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify({passed:report.passed,device,frames:report.profile?.frames,
 movingSeconds:report.profile?.movingSeconds,distanceMetres:report.profile?.distanceMetres,
 p50:report.profile?.metrics?.frameMs?.p50,p95:report.profile?.metrics?.frameMs?.p95,
 p99:report.profile?.metrics?.frameMs?.p99,errors:report.errors.slice(0,3)}));
if(!report.passed)process.exitCode=1;
