/** Additional real-game acceptance, not a replacement for the two-EUC smoke.
 * A fresh .localhost origin takes the production URL-modifier branch. The
 * browser retrieves the actual pinned HTTPS GLBs; no CDN routes are mocked.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function verifyDualHover({browser,origin,game,out,name,mobile,viewport,expect,bounded,note,parent}) {
 const pins=JSON.parse(await readFile(resolve(game,'src/belle/assetPins.json'),'utf8'));
 const pin=pins.files.find(file=>file.path==='belle/vehicles/hero-hoverbike.glb');
 assert(pin&&pin.bytes&&pin.sha256,'The hoverbike must have an immutable production pin.');
 const expectedURL=pins.base+(pin.source??pin.path);
 const url=new URL(origin);url.hostname='belle-coop.localhost';url.search='?profile=1';
 const report={source:process.env.COOP_SOURCE_SHA,head:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,
  device:name,passed:false,origin:url.origin,expectedAsset:{url:expectedURL,bytes:pin.bytes,sha256:pin.sha256},
  scope:'Two actual hoverbikes; native UI/input; production asset mapping and real HTTPS downloads. Software browser, not hardware FPS certification.',
  screenshots:[],errors:[],assetResponses:[],localHoverRequests:[],metrics:{}};
 parent.dualHover=report;
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(120_000);
 const checks=[];let closing=false,failure;
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('requestfailed',r=>{if(!closing)report.errors.push((r.failure()?.errorText??'Request failed')+' '+r.url());});
 page.on('request',r=>{const u=new URL(r.url());if(u.origin===url.origin&&u.pathname.endsWith('/hero-hoverbike.glb'))report.localHoverRequests.push(r.url());});
 page.on('response',response=>{
  if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());
  if(response.url()!==expectedURL)return;
  checks.push((async()=>{
   assert.equal(response.status(),200,'Pinned hoverbike HTTP response');
   const bytes=await response.body(),hash=createHash('sha256').update(bytes).digest('hex');
   assert.equal(bytes.length,pin.bytes,'Production hoverbike byte length');
   assert.equal(hash,pin.sha256,'Production hoverbike exact SHA256');
   report.assetResponses.push({url:response.url(),bytes:bytes.length,sha256:hash});
  })().catch(error=>{report.errors.push('Asset verification: '+error.message);}));
 });
 const tap=locator=>mobile?locator.tap():locator.click();
 const pane=seat=>page.locator('.coop-player-pane').nth(seat);
 const status=seat=>pane(seat).locator('.coop-player-status');
 const pose=seat=>pane(seat).evaluate(e=>{
  const p={x:Number(e.dataset.x),y:Number(e.dataset.y),z:Number(e.dataset.z),speed:Number(e.dataset.speed),vehicle:e.dataset.vehicle,rider:e.dataset.rider};
  if(![p.x,p.y,p.z,p.speed].every(Number.isFinite))throw Error('Missing finite rendered hoverbike telemetry.');return p;
 });
 const pair=async()=>[await pose(0),await pose(1)];
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const frame=async()=>Number(await page.locator('#coop-overlay').getAttribute('data-simulation-frames'));
 const advance=async()=>{const before=await frame();await expect.poll(frame).toBeGreaterThan(before+1);};
 const shot=async label=>{
  const file=name+'-dual-hover-'+label+'.png';note('Screenshot '+file);
  await bounded(page.screenshot({path:resolve(out,file),timeout:90_000}),95_000,'Screenshot '+file);
  report.screenshots.push(file);parent.screenshots.push(file);
 };
 const keyMove=async(seat,key)=>{
  const before=await pair();await page.locator('#game').focus();await advance();await page.keyboard.down(key);
  try{await expect.poll(async()=>distance(before[seat],await pose(seat))).toBeGreaterThan(.12);}
  finally{await page.keyboard.up(key);}
  const after=await pair();assert(distance(before[1-seat],after[1-seat])<.06,'One rider input must not move their partner.');
  return {before,after};
 };
 const stop=async seat=>{
  const key=seat===0?'ShiftLeft':'ShiftRight';await page.locator('#game').focus();await advance();await page.keyboard.down(key);
  try{await expect.poll(async()=>Math.abs((await pose(seat)).speed)).toBeLessThan(.1);}
  finally{await page.keyboard.up(key);}await advance();
 };
 const flight=async(seat,airborne)=>{
  await tap(page.getByRole('button',{name:'Player '+(seat+1)+' takeoff or land',exact:true}));
  await expect(status(seat)).toContainText(airborne?'Flying':'Landed');
 };
 try{
  note('Load production-path island for TWO HOVERBIKES');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:30_000});
  assert.deepEqual(await page.evaluate(()=>({host:location.hostname,secure:isSecureContext})),{host:'belle-coop.localhost',secure:true});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180_000});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
  await tap(page.locator('.cinema-ride-picker > summary'));
  await tap(page.locator('.ride-options label').filter({hasText:'One wheel'}));
  await tap(page.getByRole('button',{name:'Use this ride',exact:true}));await tap(page.locator('#start'));
  await expect(page.locator('body')).not.toHaveClass(/at-start/);
  await tap(page.locator('#tools-toggle'));await tap(page.locator('#settings-open'));
  await page.locator('#quality').selectOption('smooth');await page.locator('#fps').selectOption('30');
  await tap(page.locator('[data-close="settings"]'));await page.setViewportSize(viewport);
  if(!await page.locator('#coop-open').isVisible())await tap(page.locator('#tools-toggle'));
  await tap(page.locator('#coop-open'));await expect(page.locator('#coop-setup')).toBeVisible();
  for(const [seat,rider] of [[1,'DS_Man_01'],[2,'DS_Hoodie_Woman_01']]){
   await page.getByLabel('Player '+seat+' rider',{exact:true}).selectOption(rider);
   await page.getByLabel('Player '+seat+' vehicle',{exact:true}).selectOption('hoverbike');
  }
  await tap(page.getByRole('button',{name:'Confirm Player 1',exact:true}));
  await tap(page.getByRole('button',{name:'Confirm Player 2',exact:true}));await shot('lobby');
  // Distinguish the co-op fetch from any earlier solo preview request.
  const beforeChecks=checks.length;
  await tap(page.getByRole('button',{name:'Explore together',exact:true}));
  await expect(page.locator('#coop-overlay')).toHaveAttribute('data-state','playing');
  await expect(page.locator('#coop-overlay')).toHaveAttribute('data-rendered-views','2');
  await expect(page.locator('#coop-setup')).not.toBeVisible();await expect(page.locator('.coop-player-pane')).toHaveCount(2);
  await expect.poll(()=>checks.length).toBeGreaterThan(beforeChecks);await Promise.all(checks);
  assert.equal(report.localHoverRequests.length,0,'Co-op must not request the omitted local GLB.');
  assert(report.assetResponses.length>0,'Verified real pinned HTTPS model response required.');
  for(let i=0;i<2;i++){await expect(pane(i)).toHaveAttribute('data-vehicle','hoverbike');await expect(status(i)).toContainText('Landed');}
  await expect(pane(0)).toHaveAttribute('data-rider','DS_Man_01');await expect(pane(1)).toHaveAttribute('data-rider','DS_Hoodie_Woman_01');
  report.metrics.webgl=await page.locator('#game').evaluate(canvas=>{const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Live WebGL2 required');return {width:canvas.width,height:canvas.height,renderer:gl.getParameter(gl.RENDERER)};});
  await advance();report.metrics.initial=await pair();assert(distance(...report.metrics.initial)>3.3,'Two bike footprints must be separated.');await shot('two-riders');
  await flight(0,true);await expect.poll(async()=>(await pose(0)).y-report.metrics.initial[0].y).toBeGreaterThan(.1);
  assert(distance(report.metrics.initial[1],await pose(1))<.06,'P1 takeoff must not move P2.');
  await expect(status(1)).toContainText('Landed');report.metrics.p1Movement=await keyMove(0,'KeyS');await stop(0);
  await flight(1,true);await expect.poll(async()=>(await pose(1)).y-report.metrics.initial[1].y).toBeGreaterThan(.1);
  if(mobile){
   const before=await pair(),box=await page.getByLabel('Player 2 movement joystick',{exact:true}).boundingBox();assert(box);
   const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
   try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:7}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+24,id:7}]});
    await expect.poll(async()=>distance(before[1],await pose(1))).toBeGreaterThan(.12);
   }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
   const after=await pair();assert(distance(before[0],after[0])<.06,'P2 touch must not move P1.');
   report.metrics.p2Movement={before,after,nativeTouch:true};
  }else report.metrics.p2Movement=await keyMove(1,'ArrowDown');
  await stop(1);await shot('both-flying');
  await tap(page.locator('#coop-pause'));await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','true');
  await advance();const paused=await pair();await page.locator('#game').focus();await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);assert((await pair()).every((p,i)=>distance(p,paused[i])<.01&&Math.abs(p.y-paused[i].y)<.01),'Pause freezes both bikes.');
  await tap(page.locator('#coop-pause'));await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','false');
  await page.locator('#game').focus();await advance();await page.keyboard.down('KeyW');await advance();
  assert((await pair()).every((p,i)=>distance(p,paused[i])<.01),'Held key cannot rearm on resume.');
  await page.keyboard.up('KeyW');await advance();report.metrics.neutralKeyboardRearm=true;
  report.metrics.freshResumeMovement=await keyMove(0,'KeyW');await stop(0);
  await tap(page.getByRole('button',{name:'Change Player 2 camera',exact:true}));
  await expect(pane(1)).toHaveAttribute('data-camera','first');await expect(pane(0)).toHaveAttribute('data-camera','third');
  await tap(page.getByRole('button',{name:'Change Player 1 camera',exact:true}));
  await expect(pane(0)).toHaveAttribute('data-camera','first');await expect(pane(1)).toHaveAttribute('data-camera','first');
  await tap(page.getByRole('button',{name:'Change Player 1 camera',exact:true}));
  await expect(pane(0)).toHaveAttribute('data-camera','third');await shot('independent-cameras');
  const beforeRecovery=await pair();await tap(page.getByRole('button',{name:'Recover Player 1',exact:true}));
  await expect(status(0)).toContainText('Landed');await expect.poll(async()=>Math.abs((await pose(0)).speed)).toBeLessThan(.1);
  assert(distance(beforeRecovery[1],await pose(1))<.06,'P1 recovery must leave P2 alone.');
  report.metrics.p1Recovery=await pair();assert(distance(...report.metrics.p1Recovery)>3.3);
  const beforeP2Recovery=await pair();await tap(page.getByRole('button',{name:'Recover Player 2',exact:true}));
  await expect(status(1)).toContainText('Landed');await expect.poll(async()=>Math.abs((await pose(1)).speed)).toBeLessThan(.1);
  assert(distance(beforeP2Recovery[0],await pose(0))<.06,'P2 recovery must leave P1 alone.');
  report.metrics.p2Recovery=await pair();assert(distance(...report.metrics.p2Recovery)>3.3);
  // Both bikes must land through their actual flight controls, not just recovery.
  await flight(0,true);await flight(1,true);await flight(0,false);await flight(1,false);
  await expect(status(0)).toContainText('Landed');await expect(status(1)).toContainText('Landed');
  report.metrics.takeoffAndLanding=[true,true];await shot('both-landed');
  const targets=await page.locator('#coop-overlay button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const b of targets)assert(b.w>=44&&b.h>=44&&b.x>=-.5&&b.y>=-.5&&b.x+b.w<=viewport.width+.5&&b.y+b.h<=viewport.height+.5,'Dual hover touch target: '+JSON.stringify(b));
  report.metrics.targets=targets;
  await tap(page.getByRole('button',{name:'Return to solo',exact:true}));
  await expect(page.locator('#coop-overlay')).not.toBeVisible();await expect(page.locator('body')).not.toHaveClass(/coop-playing/);
  if(!await page.locator('#coop-open').isVisible())await tap(page.locator('#tools-toggle'));await tap(page.locator('#coop-open'));
  for(const seat of [1,2])await expect(page.getByLabel('Player '+seat+' vehicle',{exact:true})).toHaveValue('hoverbike');
  await expect(page.getByRole('button',{name:'Explore together',exact:true})).toBeDisabled();
  await tap(page.getByRole('button',{name:'Close setup',exact:true}));await expect(page.locator('#coop-setup')).not.toBeVisible();
  report.metrics.returnToSolo=true;await shot('returned-solo');await Promise.all(checks);assert.deepEqual(report.errors,[]);
  report.passed=true;note('Real production-path TWO HOVERBIKE checks passed');
 }catch(error){
  failure=error;report.failure=error.stack||String(error);report.passed=false;
  try{report.failureState=await bounded(page.locator('body').evaluate(()=>({body:document.body.className,session:document.querySelector('#coop-overlay')?.dataset,players:[...document.querySelectorAll('.coop-player-pane')].map(p=>({...p.dataset})),status:document.querySelector('#coop-setup .coop-status')?.textContent})),10_000,'Dual hover failure state');}catch(e){report.diagnosticFailure=e.message;}
  try{await shot('failure');}catch(e){report.failureScreenshot=e.message;}
 }finally{
  closing=true;try{await bounded(context.close(),30_000,'Dual hover context cleanup');}catch(e){report.cleanupFailure=e.message;report.passed=false;failure??=e;}
  report.finishedAt=new Date().toISOString();await writeFile(resolve(out,name+'-dual-hover-gameplay.json'),JSON.stringify(report,null,2));
 }
 if(failure)throw failure;
}
