/**
 * Capture actual rendered game canvases from a candidate source-built game.
 * Baseline = authored/default lighting. Candidate = opt-in gds-photo calibration.
 * Both images use the same source build and identical unmodified game assets.
 * It is NOT a physical-device frame-rate or connected-world verification.
 */
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const game=process.env.GDS_GAME;
if(!['belle','swoop','elmwood'].includes(game))throw Error('GDS_GAME must be belle, swoop or elmwood');
const root=resolve(import.meta.dirname,'../..');
const candidate={
 belle:resolve(root,'belle-isle-source/game/dist'),
 swoop:resolve(root,'.gds-builds/swoop'),
 elmwood:resolve(root,'.gds-builds/elmwood')
}[game];
const published={
 belle:null,
 swoop:resolve(root,'store/public/arcade/swoop-detroit'),
 elmwood:resolve(root,'store/public/arcade/elmwood-explorer')
}[game];
const output=resolve(process.env.GDS_CAPTURE_OUTPUT||resolve(root,'output/gds-captures',game));
await mkdir(output,{recursive:true});
const require=createRequire(resolve(root,'package.json'));
const {chromium}=require('playwright');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.bin':'application/octet-stream','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2'};
const entry=game==='swoop'?'detroit.html':game==='elmwood'?'elmwood.html':'index.html';
function validPath(parent,path){const target=resolve(parent,path);if(target!==parent&&!target.startsWith(parent+sep))throw Error('Invalid URL path');return target;}
const fallbackMedia=/\.(?:glb|gltf|bin\.gz|png|jpe?g|webp|hdr|bin|json|mp3|wav|ogg|mp4|webm|woff2)$/i;
const warnings=[],missing=[];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,'')||entry;
  const icon = rel === 'favicon.ico';
  let file=icon ? resolve(root,'store/public/favicon.svg') : validPath(candidate,rel),source='candidate';
  try{const s=await stat(file);if(!s.isFile())throw Error('not file');}
  catch(error){
   if(!published||!fallbackMedia.test(rel))throw error;
   file=validPath(published,rel);source='published media';
   const s=await stat(file);if(!s.isFile())throw Error('published fallback is not a file');
  }
  const info=await stat(file);
  if(source==='published media')warnings.push(rel);
  res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache, max-age=0, must-revalidate'});
  if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch(e){missing.push(req.url);res.writeHead(404).end('Asset unavailable');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port;
const report={game,head:process.env.GDS_CANDIDATE_SHA||null,candidateRoot:candidate,baseline:'authored default lighting',after:'same source assets + ?gds-photo opt-in solar calibration',
 scope:'Actual WebGL2 canvas from source-built games. No synthetic scene, no modified camera, no physical-device/FPS or cross-district traversal proof.',
 browser:null,passed:false,cases:[],errors:[],missingAssets:missing,mediaFallbacks:warnings,comparison:null};
const config={
 belle:{canvas:'#game',ready:"document.querySelector('#welcome')?.dataset.state==='ready'",start:'#start'},
 swoop:{canvas:'#world',ready:"document.querySelector('#world')?.dataset.ready==='true'",start:'.game-menu-play'},
 elmwood:{canvas:'#view',ready:"document.querySelector('#detail')?.dataset.loaded==='true'",start:null}
}[game];
let browser;
async function capture(label,photo){
 const item={label,photo,errors:[],requestFailures:[],consoleErrors:[],screenshot:null,pose:null};
 report.cases.push(item);
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,reducedMotion:'reduce',isMobile:false,hasTouch:false});
 const page=await context.newPage();
 try{
  page.on('pageerror',e=>item.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')item.consoleErrors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)item.errors.push('HTTP '+r.status()+' '+r.url());});
  page.on('requestfailed',r=>item.requestFailures.push((r.failure()?.errorText??'request failed')+' '+r.url()));
  const q='?gds-capture'+(photo?'&gds-photo':'');
  await page.goto('http://127.0.0.1:'+port+'/'+entry+q,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(config.ready,null,{timeout:180000});
  if(game==='swoop'||game==='elmwood'){
   await page.locator('#startupPreview[data-ready="true"] button.start').click({timeout:180000});
   if(game==='elmwood'){
    await page.locator('#elmwood-main-menu[open]').waitFor({timeout:90000});
    await page.keyboard.press('Escape');
   }
  }
  if(game==='elmwood'){
   await page.locator('#time').evaluate(input=>{input.value='16.7';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
  }else{
   if(game==='belle'){
    // Reuse the already-tested real Belle startup interactions. Never bypass
    // the selection gate or seed rider state through an in-page test hook.
    const picker=page.locator('.cinema-ride-picker > summary');
    await picker.click({timeout:180000});
    await page.locator('.ride-options label').filter({hasText:'One wheel'}).click({timeout:180000});
    await page.getByRole('button',{name:'Use this ride',exact:true}).click({timeout:180000});
   }
   await page.locator(config.start).click({timeout:90000});
   if(game==='swoop')await page.waitForFunction(()=>document.body.classList.contains('playing'),null,{timeout:90000});
   if(game==='belle')await page.waitForFunction(()=>document.querySelector('#ridehud')?.hidden===false,null,{timeout:90000});
   // Pause real ride after starting. Capture is the game's own last rendered frame.
   await page.locator('#pause').click({timeout:180000});
  }
  await page.waitForTimeout(750);
  item.pose=await page.evaluate(selector=>{
   const canvas=document.querySelector(selector),gl=canvas?.getContext('webgl2');
   if(!gl||gl.isContextLost()||canvas.width<=0||canvas.height<=0)throw Error('No healthy rendered WebGL2 canvas');
   const camera=window.__gdsCamera?.();
   if(!camera||!Array.isArray(camera.position)||!Array.isArray(camera.direction))throw Error('No real-game camera pose available');
   return {camera,canvas:{width:canvas.width,height:canvas.height},time:document.querySelector('#sky-hour')?.value??document.querySelector('#time')?.value??null,ready:document.querySelector('#world')?.dataset.ready??document.querySelector('#detail')?.dataset.loaded??document.querySelector('#welcome')?.dataset.state};
  },config.canvas);
  const file=resolve(output,label+'.png');
  await page.locator(config.canvas).screenshot({path:file,timeout:120000,animations:'disabled'});
  const bytes=await readFile(file);
  if(bytes.length<12000)throw Error('Rendered screenshot too small for review');
  item.screenshot={file:label+'.png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  if(item.errors.length||item.requestFailures.length||item.consoleErrors.length)throw Error('Game emitted page, network or console failures; review evidence JSON');
 }catch(e){item.errors.push(String(e));report.errors.push(label+': '+String(e));}
 finally{await context.close().catch(e=>report.errors.push('context-close: '+String(e)));}
}
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browser=browser.version();
 await capture('before-default',false);
 await capture('after-gds-photo',true);
 const a=report.cases[0],b=report.cases[1];
 if(a?.pose&&b?.pose){
  const c=a.pose.camera,d=b.pose.camera;
  const positionDelta=Math.hypot(...c.position.map((n,i)=>n-d.position[i]));
  const directionDelta=Math.hypot(...c.direction.map((n,i)=>n-d.direction[i]));
  const fovDelta=Math.abs(c.fovDegrees-d.fovDegrees);
  report.comparison={positionDelta,directionDelta,fovDelta,identicalCamera:positionDelta<.4&&directionDelta<.03&&fovDelta<.01};
  if(!report.comparison.identicalCamera)report.errors.push('Before/after used different camera poses; manual review not a matched-angle pass');
 }
 report.passed=report.errors.length===0&&report.cases.length===2&&report.cases.every(c=>c.screenshot&&c.errors.length===0&&c.requestFailures.length===0&&c.consoleErrors.length===0)&&report.comparison?.identicalCamera===true;
}finally{
 await browser?.close().catch(e=>report.errors.push('browser-close: '+String(e)));
 await new Promise(resolve=>server.close(resolve));
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 console.log('Actual '+game+' before/after capture '+(report.passed?'PASSED':'BLOCKED')+'; images='+report.cases.filter(x=>x.screenshot).length+'; errors='+report.errors.length);
 if(!report.passed)process.exitCode=1;
}
