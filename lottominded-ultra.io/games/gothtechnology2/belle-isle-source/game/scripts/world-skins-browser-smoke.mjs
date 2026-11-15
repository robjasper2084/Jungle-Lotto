/** Inspect the actual built world via its public guide, not seeded scene/camera state. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createCoopStaticServer} from './coop-static-server.mjs';
const game=resolve(import.meta.dirname,'..'),out=resolve(game,process.env.WORLD_SKIN_OUTPUT||'output/world-skins/browser');
await mkdir(out,{recursive:true});
const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:120000});
const server=createCoopStaticServer(resolve(game,'dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.env.WORLD_SKIN_GPU==='d3d11'?['--enable-gpu','--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(120000);
const report={passed:false,errors:[],failedRequests:[],loadedSkins:[],visits:[],limitations:'Browser visual acceptance; not physical-device performance certification.'};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());if(/\/belle\/skins\/.*\.webp/.test(r.url()))report.loadedSkins.push(new URL(r.url()).pathname.split('/').pop());});
page.on('requestfailed',r=>report.failedRequests.push(r.failure()?.errorText+' '+r.url()));
async function menu(){if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();}
async function painted(){const n=Number(await page.locator('#profile').getAttribute('data-active-frames'));await expect.poll(async()=>Number(await page.locator('#profile').getAttribute('data-active-frames'))).toBeGreaterThan(n+3);await page.evaluate(()=>new Promise((yes,no)=>{const gl=document.querySelector('#game').getContext('webgl2');if(!gl||gl.isContextLost())return no(Error('WebGL lost'));const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const start=performance.now();function poll(){const status=gl.clientWaitSync(fence,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED){gl.deleteSync(fence);requestAnimationFrame(()=>requestAnimationFrame(yes));}else if(status===gl.WAIT_FAILED||performance.now()-start>60000){gl.deleteSync(fence);no(Error('GPU frame failed'));}else requestAnimationFrame(poll);}poll();}));}
try{
 const url=new URL(process.env.BELLE_GAME_URL||'http://127.0.0.1:'+server.address().port+'/');url.searchParams.set('profile','1');await page.goto(url.href,{waitUntil:'domcontentloaded'});await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 if(await page.locator('#startup-motion').getAttribute('aria-pressed')!=='true')await page.locator('#startup-motion').click();
 await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();
 await menu();await page.locator('#settings-open').click();await page.locator('#quality').selectOption('high');await page.locator('#fps').selectOption('30');await page.locator('#sky-preset').selectOption('12');await page.locator('[data-close="settings"]').click();
 for(const [name,pattern] of [['conservatory',/Conservatory/],['casino',/Belle Isle Casino/],['beach',/Belle Isle Beach|Swim Beach/],['fountain',/Scott.*Fountain/],['playscape',/Kids.*Row|Playscape|Playground/],['golf',/Golf Center/]]){
  await menu();await page.locator('#map-open').click();
  const card=page.locator('#landmarks .landmark').filter({has:page.locator('h3').filter({hasText:pattern})}).first();
  await expect(card).toBeVisible();const title=await card.locator('h3').innerText();await card.getByRole('button',{name:/Travel/}).click();await expect(page.locator('#guide')).not.toBeVisible();await painted();
  await page.screenshot({path:resolve(out,name+'.png'),timeout:120000});report.visits.push({name,title,place:await page.locator('#place').textContent(),profile:await page.locator('#profile').textContent()});console.log('Captured',name);
 }
 assert.equal(new Set(report.loadedSkins).size,57);assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));try{await page.screenshot({path:resolve(out,'failure.png'),timeout:30000});}catch{}}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;}
