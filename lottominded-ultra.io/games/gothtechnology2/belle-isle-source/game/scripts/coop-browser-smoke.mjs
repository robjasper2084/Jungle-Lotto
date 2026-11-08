/** Two real local actors in the built Belle Isle world. Input via public UI only.
 * Software Chrome proves functional rendering, not physical-phone/controller FPS.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {readFile,mkdir,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname,resolve,sep} from 'node:path';
import {RIDERS,SOURCE_REVISION,SOURCE_ROOT} from '../src/belle/coop/coop.ts';
const game=resolve(import.meta.dirname,'..'),root=resolve(game,'dist'),out=resolve(game,'output/coop');
await mkdir(out,{recursive:true});
const name=process.env.BELLE_COOP_DEVICE||'desktop',mobile=name==='phone',viewport=mobile?{width:390,height:844}:{width:960,height:640};
const report={head:process.env.GITHUB_SHA,source:process.env.COOP_SOURCE_SHA,run:process.env.GITHUB_RUN_ID,device:name,viewport,passed:false,scope:'Actual built island, two real Swoop models and separate controllers. Software-rendered Chrome; no physical device or hardware FPS certification.',errors:[],warnings:[],screenshots:[],assetSources:[],metrics:{}};
const log=[];const note=s=>{const t=new Date().toISOString()+' '+s;log.push(t);console.log(t);};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Invalid path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');const info=await stat(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(req.url==='/favicon.ico'?204:404).end();}});
let browser,page;
const bounded=async(p,ms,label)=>{let t;try{return await Promise.race([p,new Promise((_,no)=>{t=setTimeout(()=>no(Error(label+' timed out')),ms);})]);}finally{clearTimeout(t);}};
async function run(){
 process.env.PLAYWRIGHT_LEGACY_SCREENSHOT='1';
 const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:originalExpect}=require('@playwright/test');
 const expect=originalExpect.configure({timeout:120_000});
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 const origin='http://127.0.0.1:'+server.address().port;report.origin=origin;
 browser=await chromium.launch({channel:'chromium',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 // Serve ONLY the exact allowlisted, integrity-checked GLBs from their checked-out
 // source. This avoids treating CDN timing as a rig test; no replacement models.
 for(const rider of RIDERS){const url='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/'+SOURCE_REVISION+'/'+SOURCE_ROOT+'swoop-source/public/exports/rigged-heroes/'+rider.id+'.glb';
  await context.route(url,async route=>{const file=resolve(game,'../../swoop-source/public/exports/rigged-heroes',rider.id+'.glb');report.assetSources.push({id:rider.id,source:url,served:'exact repository GLB, runtime Git-blob verification retained'});await route.fulfill({status:200,contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'},body:await readFile(file)});});
 }
 page=await context.newPage();page.setDefaultTimeout(120_000);
 page.on('pageerror',e=>{report.errors.push(e.message);note('page error: '+e.message);});
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 const tap=locator=>mobile?locator.tap():locator.click();
 const shot=async label=>{const file=name+'-'+label+'.png';note('Screenshot '+file);await bounded(page.screenshot({path:resolve(out,file),timeout:90_000}),95_000,'Screenshot '+file);report.screenshots.push(file);};
 const position=async seat=>page.locator('.coop-player-pane').nth(seat).evaluate(e=>({x:+e.dataset.x,y:+e.dataset.y,z:+e.dataset.z,speed:+e.dataset.speed,footError:+e.dataset.footError,crash:+e.dataset.crashBlend}));
 const moved=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 note('Load real built island');await page.goto(origin+'/?profile=1',{waitUntil:'domcontentloaded',timeout:30_000});
 await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180_000});await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');
 await tap(page.locator('.cinema-ride-picker > summary'));await tap(page.locator('.ride-options label').filter({hasText:'One wheel'}));await tap(page.getByRole('button',{name:'Use this ride',exact:true}));await tap(page.locator('#start'));
 await expect(page.locator('body')).not.toHaveClass(/at-start/);await tap(page.locator('#tools-toggle'));await tap(page.locator('#settings-open'));
 await page.locator('#quality').selectOption('smooth');await page.locator('#fps').selectOption('30');await tap(page.locator('[data-close="settings"]'));
 await page.setViewportSize(viewport);await expect(page.locator('#coop-open')).toBeEnabled();
 if(!await page.locator('#coop-open').isVisible())await tap(page.locator('#tools-toggle'));
 await tap(page.locator('#coop-open'));await expect(page.locator('#coop-setup')).toBeVisible();
 note('Select separate heroes and handling profiles');await page.getByLabel('Player 1 rider',{exact:true}).selectOption('DS_Man_01');await page.getByLabel('Player 2 rider',{exact:true}).selectOption('DS_Hoodie_Woman_01');
 await page.getByLabel('Player 1 vehicle',{exact:true}).selectOption('euc:city');await page.getByLabel('Player 2 vehicle',{exact:true}).selectOption('euc:tour');
 await tap(page.getByRole('button',{name:'Confirm Player 1',exact:true}));await tap(page.getByRole('button',{name:'Confirm Player 2',exact:true}));await shot('lobby');
 await tap(page.getByRole('button',{name:'Explore together',exact:true}));
 await expect(page.locator('#coop-overlay')).toHaveAttribute('data-state','playing');await expect(page.locator('#coop-overlay')).toHaveAttribute('data-rendered-views','2');await expect(page.locator('#coop-setup')).not.toBeVisible();
 await expect(page.locator('.coop-player-pane')).toHaveCount(2);
 report.metrics.webgl=await page.locator('#game').evaluate(canvas=>{const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Live WebGL2 required');return{width:canvas.width,height:canvas.height,renderer:gl.getParameter(gl.RENDERER)};});
 report.metrics.initial=[await position(0),await position(1)];assert(moved(...report.metrics.initial)>1.3);
 for(const p of report.metrics.initial)assert(p.footError<.12&&p.crash===0,'Both real rigs must initially fit their pedals.');
 await shot('two-riders');
 note('Exercise Player 1 movement independently');await page.locator('#game').focus();await page.keyboard.down('KeyS');
 await expect.poll(async()=>moved(report.metrics.initial[0],await position(0))).toBeGreaterThan(.12);await page.keyboard.up('KeyS');
 report.metrics.afterP1=[await position(0),await position(1)];assert(moved(report.metrics.initial[1],report.metrics.afterP1[1])<.06,'P1 input must not move P2');
 note('Pause both and verify held input cannot move either');await page.keyboard.press('KeyP');await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','true');
 const held=[await position(0),await position(1)];await page.keyboard.down('ArrowDown');await page.waitForTimeout(2000);assert(moved(held[0],await position(0))<.01&&moved(held[1],await position(1))<.01);await page.keyboard.up('ArrowDown');
 await tap(page.locator('#coop-pause'));await expect(page.locator('#coop-overlay')).toHaveAttribute('data-paused','false');await page.locator('#game').focus();
 await expect.poll(async()=>Number(await page.locator('#coop-overlay').getAttribute('data-draw-calls'))).toBeGreaterThan(0);
 // Allow an actual neutral rendered frame before the next held input.
 const neutralFrame=Number(await page.locator('#coop-overlay').getAttribute('data-simulation-frames'));await expect.poll(async()=>Number(await page.locator('#coop-overlay').getAttribute('data-simulation-frames'))).toBeGreaterThan(neutralFrame+1);await page.keyboard.down('ArrowDown');await expect.poll(async()=>moved(held[1],await position(1))).toBeGreaterThan(.12);await page.keyboard.up('ArrowDown');
 report.metrics.afterP2=[await position(0),await position(1)];
 note('Separate camera and recovery controls');await tap(page.getByRole('button',{name:'Change Player 2 camera',exact:true}));await expect(page.locator('.coop-player-pane').nth(1)).toHaveAttribute('data-camera','first');await expect(page.locator('.coop-player-pane').nth(0)).toHaveAttribute('data-camera','third');
 await tap(page.getByRole('button',{name:'Recover Player 1',exact:true}));await expect.poll(async()=>Math.abs((await position(0)).speed)).toBeLessThan(.1);
 report.metrics.afterRecovery=[await position(0),await position(1)];assert(moved(...report.metrics.afterRecovery)>1.3);
 if(mobile){
  note('Native touch movement inside Player 2 viewport');await tap(page.getByRole('button',{name:'Recover Player 2',exact:true}));await expect.poll(async()=>Math.abs((await position(1)).speed)).toBeLessThan(.1);
  const before=await position(1),box=await page.getByLabel('Player 2 movement joystick',{exact:true}).boundingBox();assert(box);const session=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:7}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+30,id:7}]});
  await expect.poll(async()=>moved(before,await position(1))).toBeGreaterThan(.08);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();report.metrics.nativeTouchMovement=true;
 }
 const layout=await page.locator('#coop-overlay button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{name:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height};}));
 for(const b of layout)assert(b.w>=44&&b.h>=44&&b.x>=-.5&&b.y>=-.5&&b.x+b.w<=viewport.width+.5&&b.y+b.h<=viewport.height+.5,'Visible target must fit: '+JSON.stringify(b));
 report.metrics.buttons=layout;report.metrics.performance=await page.locator('#coop-overlay').evaluate(e=>({...e.dataset}));
 await shot('independent-cameras');
 note('Return to solo and confirm saved choices on reopening');await tap(page.getByRole('button',{name:'Return to solo',exact:true}));await expect(page.locator('#coop-overlay')).not.toBeVisible();await expect(page.locator('body')).not.toHaveClass(/coop-playing/);
 if(!await page.locator('#coop-open').isVisible())await tap(page.locator('#tools-toggle'));await tap(page.locator('#coop-open'));
 await expect(page.getByLabel('Player 1 rider',{exact:true})).toHaveValue('DS_Man_01');await expect(page.getByLabel('Player 2 vehicle',{exact:true})).toHaveValue('euc:tour');await expect(page.getByRole('button',{name:'Explore together',exact:true})).toBeDisabled();
 await tap(page.getByRole('button',{name:'Close setup',exact:true}));await expect(page.locator('#coop-setup')).not.toBeVisible();
 assert.deepEqual(report.errors,[]);report.passed=true;note('Real co-op gameplay checks passed');
}
let failed;
try{await bounded(run(),35*60_000,'Co-op real-game case');}catch(e){failed=e;report.failure=e.stack||String(e);report.passed=false;process.exitCode=1;note('FAIL '+e.message);}
finally{
 if(browser)try{await bounded(browser.close(),30_000,'Browser cleanup');}catch(e){report.cleanupFailure=e.message;report.passed=false;process.exitCode=1;}
 if(server.listening){server.closeAllConnections();await new Promise(done=>server.close(done));}
 report.finishedAt=new Date().toISOString();await writeFile(resolve(out,name+'-gameplay.json'),JSON.stringify(report,null,2));await writeFile(resolve(out,name+'-gameplay.log'),log.join('\n')+'\n');
}
