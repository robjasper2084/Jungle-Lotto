/** Native controlled image evidence only. No original acceptance driver is invoked or altered. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {pins,sha256,json,checkout,helperPins,modelPins,verifyManifest} from './provenance.mjs';
import {analyze,assertSourcePair} from './contract.mjs';
import {verifyCapture,decodePng} from './png-evidence.mjs';
import {assertNonblank,encodeRgba,cropRgba,comparePixels} from './png-derived.mjs';
import {readEvidenceCheckpoint} from './evidence-transfer.ts';

const [beforeArg,candidateArg,distArg,outArg]=process.argv.slice(2);assert(beforeArg&&candidateArg&&distArg&&outArg);
const apps={before:resolve(beforeArg),candidate:resolve(candidateArg)},dist=resolve(distArg),out=resolve(outArg);
const game=resolve(apps.before,pins.gamePath),require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
const {installLandmarkComparisonObserver}=await import(pathToFileURL(resolve(game,'scripts/landmark-comparison-observer.mjs')).href);
const launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
const report={schema:1,diagnosticOnly:true,releaseAcceptance:false,complete:false,diagnosticHead:process.env.ROOF_DIAGNOSTIC_SHA??null,
 source:pins.sources,assetContext:pins.artifact,launch,viewport:pins.viewport,startedAt:new Date().toISOString(),
 errors:[],failedRequests:[],console:[],served:[],captures:[],differences:[],contextCleanup:[],checkpoints:[],analysis:null};
const raw={},pending=new Set();let browser,activePage,activeMode,activeTransfer,abortVariants=false;const servers=[];
const errorText=e=>e?.stack||String(e);
async function bounded(p,ms,label){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=Error(label+' exceeded '+ms+' ms');e.code='DIAGNOSTIC_TIMEOUT';reject(e);},ms);})]);}finally{clearTimeout(timer);}}
async function checkpoint({bestEffort=false}={}){
 let failure;
 // Capture page/mode/session locally. A late response cannot update another
 // variant or replace the last completely verified, persisted checkpoint.
 const state=activeTransfer,page=activePage,mode=activeMode;
 if(page&&state&&!state.failed)try{
  const result=await readEvidenceCheckpoint({session:state.session,mode,source:pins.sources[mode],previous:state.previous,
   remote:(method,request)=>page.evaluate(({method,request})=>window.__roofCompare.transfer[method](request),{method,request})});
  const directory=resolve(out,mode,'checkpoint-sections');await mkdir(directory,{recursive:true});
  for(const section of result.newSections){
   const file=resolve(directory,section.sha256+'.json'),temporary=file+'.pending';
   await writeFile(temporary,section.encoded);await rename(temporary,file);
  }
  // The scalar-preserving sections and complete manifest retain the exact
  // analyzer input, including -0/undefined, beyond ordinary JSON's limitations.
  const manifestFile=resolve(out,mode,'checkpoint-manifest.json'),pendingManifest=manifestFile+'.pending';
  await json(pendingManifest,result.manifest);await rename(pendingManifest,manifestFile);
  state.previous=result;raw[mode]=result.value;
  report.checkpoints.push({mode,diagnosticHead:report.diagnosticHead,...result.receipt});
 }catch(e){state.failed=true;failure=e;report.errors.push(errorText(e));}
 await json(resolve(out,'report.json'),report);
 if(failure&&!bestEffort)throw failure;
}
function installDeterminism(config){
 let state=config.seed>>>0,calls=0;const originalDate=Date;
 Math.random=function(){calls++;state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
 // Monotonic performance.now, scheduling, GPU fences and browser timeouts stay native.
 class FixedDate extends originalDate{constructor(...args){if(args.length)super(...args);else super(config.dateEpochMs);}static now(){return config.dateEpochMs;}}
 window.Date=FixedDate;
 Object.defineProperty(window,'__roofDeterminism',{value:()=>({algorithm:config.randomAlgorithm,seed:config.seed,state,calls,dateEpochMs:config.dateEpochMs,monotonicClock:'native unchanged'}),configurable:false});
}
async function collect(mode){
 const app=apps[mode],appGame=resolve(app,pins.gamePath),modeOut=resolve(out,mode);await mkdir(modeOut,{recursive:true});
 checkout(app,mode);await helperPins(appGame);await modelPins(appGame,mode);
 const fixture=JSON.parse(await readFile(resolve(modeOut,'fixture-manifest.json'),'utf8'));
 await verifyManifest(resolve(modeOut,'fixture'),fixture);
 const fixtureFiles=new Map(fixture.files.map(r=>['/'+r.path,r]));
 const inline=new Map();
 for(const file of fixture.files.filter(r=>r.path.endsWith('.js'))){const code=await readFile(resolve(modeOut,'fixture',file.path),'utf8');
  for(const match of code.matchAll(/data:[A-Za-z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/g)){const data=Buffer.from(match[0].split(',')[1],'base64');inline.set(match[0],{bytes:data.length,sha256:sha256(data)});}}
 const distManifest=JSON.parse(await readFile(resolve(out,'dist-manifest.json'),'utf8')),assetFiles=new Map(distManifest.files.map(r=>['/'+r.path,r]));
 const overlay=new Map(Object.entries(pins.models).filter(([name])=>name.startsWith('Aquarium_')).map(([name,v])=>['/belle/staged-architecture/'+name,v[mode]]));
 const fixtureHandler=createCoopStaticServer(resolve(modeOut,'fixture')).listeners('request')[0],assetHandler=createCoopStaticServer(dist).listeners('request')[0];
 const modelHandler=createCoopStaticServer(resolve(appGame,'public')).listeners('request')[0];
 const server=createServer((req,res)=>{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  (path==='/'||fixtureFiles.has(path)?fixtureHandler:mode==='candidate'&&overlay.has(path)?modelHandler:assetHandler)(req,res);
 });servers.push(server);await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 const origin='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce',serviceWorkers:'block'});
 const deadline=setTimeout(()=>{report.errors.push(mode+': 13-minute native variant deadline');void context.close().catch(e=>report.errors.push(errorText(e)));},13*60000);
 try{
 await context.addInitScript(installDeterminism,pins.construction);await context.addInitScript(installLandmarkComparisonObserver,{historyLimit:8});
 const page=await context.newPage();activePage=page;activeMode=mode;activeTransfer={session:randomUUID(),previous:null,failed:false};
 page.on('pageerror',e=>report.errors.push(mode+': '+errorText(e)));
 page.on('console',m=>{report.console.push({mode,type:m.type(),text:m.text()});
  if(m.type()==='error'||m.type()==='warning'&&/unavailable|failed|fallback|retry/i.test(m.text()))report.errors.push(mode+': '+m.text());});
 page.on('requestfailed',r=>report.failedRequests.push({mode,url:r.url().slice(0,240),urlSha256:sha256(r.url()),error:r.failure()?.errorText}));
 page.on('response',response=>{
  const task=(async()=>{
   const url=new URL(response.url());
   if(url.protocol==='data:'||url.protocol==='blob:'){
    const expected=inline.get(response.url()),type=response.headers()['content-type']??url.pathname.split(/[;,]/)[0];
    assert(expected||type.startsWith('image/'),'Unbound inline non-image resource');
    if(url.protocol==='blob:')assert.equal(url.origin,origin,'Foreign blob resource');
    const bytes=await bounded(response.body(),30000,'Inline source asset response'),hash=sha256(bytes);
    if(expected){assert.equal(bytes.length,expected.bytes);assert.equal(hash,expected.sha256);}
    // Embedded or generated image resources have no remote URL. Their exact
    // bytes and decoded texture receipts must match across the two worlds.
    report.served.push({mode,path:'inline:'+hash,kind:expected?'fixture-inline':'derived-image',bytes:bytes.length,sha256:hash});return;
   }
   assert.equal(url.origin,origin,'Unexpected external asset origin');
   const path=decodeURIComponent(url.pathname),key=path==='/'?'/index.html':path;
   if(path==='/favicon.ico'&&response.status()===204)return;
   assert.equal(response.status(),200,'Native asset response failed: '+path);
   const kind=fixtureFiles.has(key)?'fixture':'asset',expected=fixtureFiles.get(key)??(overlay.has(key)?overlay.get(key):assetFiles.get(key));
   assert(expected,'Unpinned served asset '+path);const bytes=await bounded(response.body(),30000,'Native source asset response '+path);assert.equal(bytes.length,expected.bytes,'Served asset length changed: '+path);assert.equal(sha256(bytes),expected.sha256,'Served asset hash changed: '+path);
   report.served.push({mode,path:key,kind,bytes:bytes.length,sha256:expected.sha256});
  })().catch(e=>report.errors.push(mode+': '+errorText(e)));pending.add(task);task.finally(()=>pending.delete(task));
 });
  await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:30000});await page.bringToFront();
  await page.waitForFunction(()=>!!window.__roofCompare,null,{timeout:60000});
  await bounded(page.evaluate(()=>window.__roofCompare.ready()),600000,mode+' complete original world construction');await checkpoint();
  for(let index=0;index<4;index++){
   const name=pins.nativeBeforeEvidence.views[index].name;report.phase=mode+'/'+name;console.log(new Date().toISOString()+' '+report.phase);
   try{
    const prepared=await bounded(page.evaluate(i=>window.__roofCompare.prepare(i),index),300000,report.phase+' native preparation');await checkpoint();
    for(let captureIndex=0;captureIndex<2;captureIndex++){
     const capture=await bounded(page.evaluate(i=>window.__roofCompare.capture(i),captureIndex),180000,report.phase+' native framebuffer');
     assert(capture.png.startsWith('data:image/png;base64,'));const png=Buffer.from(capture.png.split(',')[1],'base64'),rgba=Buffer.from(capture.rawRgbaBase64,'base64');
     const stem=name+'-'+captureIndex,file=mode+'/'+stem+'.png',rawFile=mode+'/'+stem+'.rgba';
     // Preserve both original outputs before the decoder can reject either.
     await writeFile(resolve(out,file),png);await writeFile(resolve(out,rawFile),rgba);
     const receipt={mode,name,index:captureIndex,file,rawFile,pngSha256:sha256(png),rawSha256:sha256(rgba),roofRegion:prepared.roofRegion};
     report.captures.push(receipt);await checkpoint();receipt.encoding=verifyCapture(png,rgba,{width:1280,height:800,pixelSha256:capture.pixelSha256});
     const pixels=assertNonblank(png,1280,800),crop=cropRgba(pixels,1280,800,prepared.roofRegion),cropPng=encodeRgba(crop,prepared.roofRegion.width,prepared.roofRegion.height);
     receipt.roofFile=mode+'/'+stem+'-roof.png';receipt.roofPngSha256=sha256(cropPng);receipt.roofRgbaSha256=sha256(crop);receipt.roofDerivation='Exact top-down decoded native channels; no resampling or color conversion';
     await writeFile(resolve(out,receipt.roofFile),cropPng);await checkpoint();
    }
    await bounded(page.evaluate(()=>window.__roofCompare.finishCase()),180000,report.phase+' complete scene conservation snapshot');await checkpoint();
   }catch(e){report.errors.push(report.phase+': '+errorText(e));
    // A timed-out browser operation may still be running. Never start a
    // competing read against that context; retain the last good observation.
    if(e.code==='DIAGNOSTIC_TIMEOUT')activeTransfer.failed=true;
    await checkpoint({bestEffort:true});if(e.code==='DIAGNOSTIC_TIMEOUT'||page.isClosed())throw e;if(activeTransfer.failed)throw e;}
  }
  await bounded(Promise.allSettled([...pending]),35000,mode+' source response settlement');
  for(const file of Object.keys(pins.models))assert(report.served.some(r=>r.mode===mode&&r.path==='/belle/staged-architecture/'+file&&r.sha256===pins.models[file][mode].sha256),'A staged GLB was not fetched/verified: '+file);
 }catch(e){
  if(e.code==='DIAGNOSTIC_TIMEOUT'&&activeTransfer)activeTransfer.failed=true;
  throw e;
 }finally{
  clearTimeout(deadline);
  try{await checkpoint({bestEffort:true});}catch(e){report.errors.push(errorText(e));}
  activePage=null;activeMode=null;activeTransfer=null;
  let confirmed=false;
  try{await bounded(context.close(),30000,mode+' context cleanup');confirmed=true;}catch(e){report.errors.push(errorText(e));abortVariants=true;}
  report.contextCleanup.push({mode,confirmed});
  // Write the compatible complete observation once per variant, including
  // the last successfully verified partial snapshot on failure.
  if(raw[mode])try{await json(resolve(modeOut,'native-observation.json'),raw[mode]);}catch(e){report.errors.push(errorText(e));}
  if(!confirmed)try{await bounded(browser.close(),30000,'Abort browser after unconfirmed context closure');}catch(e){report.errors.push(errorText(e));}
  try{await verifyManifest(resolve(modeOut,'fixture'),fixture);checkout(app,mode);}catch(e){report.errors.push(errorText(e));}
 }
}
async function differences(){
 for(const view of pins.nativeBeforeEvidence.views){
  const a=report.captures.find(c=>c.mode==='before'&&c.name===view.name&&c.index===0&&c.encoding),b=report.captures.find(c=>c.mode==='candidate'&&c.name===view.name&&c.index===0&&c.encoding);
  if(!a||!b)continue;
  assert.deepEqual(a.roofRegion,b.roofRegion);const aa=decodePng(await readFile(resolve(out,a.file)),{width:1280,height:800}),bb=decodePng(await readFile(resolve(out,b.file)),{width:1280,height:800});
  const {image,statistics}=comparePixels(aa,bb,1280,800,a.roofRegion),png=encodeRgba(image,1280,800),crop=cropRgba(image,1280,800,a.roofRegion),roofPng=encodeRgba(crop,a.roofRegion.width,a.roofRegion.height);
  const file=view.name+'-absolute-difference.png',roofFile=view.name+'-roof-absolute-difference.png';await writeFile(resolve(out,file),png);await writeFile(resolve(out,roofFile),roofPng);
  report.differences.push({name:view.name,file,roofFile,pngSha256:sha256(png),roofPngSha256:sha256(roofPng),statistics});
 }
}
try{
 assert.match(report.diagnosticHead,/^[0-9a-f]{40}$/,'Missing diagnostic source identity');
 const sources=await Promise.all(['before','candidate'].map(mode=>readFile(resolve(out,mode,'source-inputs.json'),'utf8').then(JSON.parse)));assertSourcePair(...sources);
 // Independently prove that the bundled loader delta is only the three reviewed hash strings.
 const loaders=await Promise.all(['before','candidate'].map(mode=>readFile(resolve(apps[mode],pins.gamePath,'src/belle/stagedLandmarkStudies.ts'),'utf8')));
 let restored=loaders[1];for(const [name,v] of Object.entries(pins.models))if(name.startsWith('Aquarium_')){assert.equal(restored.split(v.candidate.sha256).length,2);restored=restored.replace(v.candidate.sha256,v.before.sha256);}assert.equal(restored,loaders[0]);
 const assetManifest=JSON.parse(await readFile(resolve(out,'dist-manifest.json'),'utf8'));await verifyManifest(dist,assetManifest);
 browser=await chromium.launch(launch);report.browser=browser.version();
 for(const mode of ['before','candidate']){if(abortVariants){report.errors.push('Skipped '+mode+' after unconfirmed prior context closure');break;}
  try{await collect(mode);}catch(e){report.errors.push(mode+': '+errorText(e));await checkpoint({bestEffort:true});}}
 const derived=mode=>report.served.filter(r=>r.mode===mode&&r.kind==='derived-image').map(({kind,bytes,sha256})=>({kind,bytes,sha256})).sort((a,b)=>a.sha256.localeCompare(b.sha256));
 assert.deepEqual(derived('before'),derived('candidate'),'Derived image resources changed across worlds');
 await differences();
}catch(e){report.errors.push(errorText(e));}
finally{
 try{await checkpoint({bestEffort:true});}catch(e){report.errors.push(errorText(e));}
 if(browser)try{await bounded(browser.close(),30000,'Native browser cleanup');}catch(e){report.errors.push(errorText(e));}
 for(const server of servers)if(server.listening)try{await bounded(new Promise((yes,no)=>server.close(e=>e?no(e):yes())),10000,'Static server cleanup');}catch(e){report.errors.push(errorText(e));}
 try{await bounded(Promise.allSettled([...pending]),35000,'Final source response settlement');}catch(e){report.errors.push(errorText(e));}
 try{await verifyManifest(dist,JSON.parse(await readFile(resolve(out,'dist-manifest.json'),'utf8')));report.immutableAssetsUnchanged=true;}catch(e){report.errors.push(errorText(e));}
 report.analysis=analyze(raw);report.complete=report.analysis.complete&&report.captures.length===16&&report.differences.length===4&&report.contextCleanup.length===2&&report.contextCleanup.every(r=>r.confirmed)&&!report.errors.length&&!report.failedRequests.length;
 report.finishedAt=new Date().toISOString();await json(resolve(out,'report.json'),report);
 console.log(JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,complete:report.complete,captures:report.captures.length,errors:[...report.errors,...report.analysis.errors],differences:report.differences.map(r=>({name:r.name,...r.statistics}))}));
 if(!report.complete)process.exitCode=1;
}
