/** All results belong to this isolated experiment, never to the release gates. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pins,sha256,verifyManifest} from './provenance.mjs';
import {analyze,validateCorrectnessCase} from './contract.mjs';
import {verifyCapture,compareRawRgba} from './png-evidence.mjs';
const game=resolve(process.env.APP_GAME||''),out=resolve(process.env.APPROACH_ORDER_OUT||''),backend=process.env.APPROACH_ORDER_BACKEND;
assert(process.env.APP_GAME&&process.env.APPROACH_ORDER_OUT&&['metal','swiftshader'].includes(backend));
const {createCoopStaticServer}=await import(pathToFileURL(resolve(game,'scripts/coop-static-server.mjs')).href);
const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
const launch=backend==='metal'?{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}:
 {channel:'chrome',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']};
const report={diagnosticOnly:true,releaseAcceptance:false,complete:false,applicationSource:pins.applicationSource,
 diagnosticRevision:process.env.APPROACH_ORDER_DIAGNOSTIC_SHA??null,backend,launch,viewport:[1280,800,1],
 captures:[],correctnessGates:[],errors:[],failedRequests:[],scriptReceipts:[],startedAt:new Date().toISOString(),analysis:null};
const before=JSON.parse(await readFile(resolve(out,'dist-before.json'),'utf8')),fixture=JSON.parse(await readFile(resolve(out,'fixture-before.json'),'utf8'));
const fixturePaths=new Map(fixture.files.map(r=>['/'+r.path,r]));
const assets=createCoopStaticServer(resolve(game,'dist')).listeners('request')[0],fixtureHandler=createCoopStaticServer(resolve(out,'fixture')).listeners('request')[0];
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;(path==='/'||fixturePaths.has(path)?fixtureHandler:assets)(req,res);});
let browser,page,raw=null;const pending=new Set();
const text=e=>e?.stack||String(e);
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,no)=>{timer=setTimeout(()=>no(Error(label+' exceeded '+ms+' ms')),ms);})]);}finally{clearTimeout(timer);}}
async function checkpoint(){if(page)try{raw=await bounded(page.evaluate(()=>window.__approachOrder?.read()??null),15000,'Read partial fixture evidence');}catch(e){report.errors.push(text(e));}
 if(raw)await writeFile(resolve(out,'raw-observation.json'),JSON.stringify(raw,null,2)+'\n');await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
async function run(){
 const source=JSON.parse(await readFile(resolve(out,'source-provenance.json'),'utf8'));
 assert.equal(source.applicationSource,pins.applicationSource);assert.equal(source.diagnosticRevision,report.diagnosticRevision);report.source=source;
 await verifyManifest(resolve(game,'dist'),before);await verifyManifest(resolve(out,'fixture'),fixture);
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 browser=await chromium.launch(launch);report.browser=browser.version();
 page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});
 page.on('pageerror',e=>report.errors.push(text(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{
  if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());
  const path=new URL(r.url()).pathname;if(!path.endsWith('.js'))return;
  const task=(async()=>{const expected=fixturePaths.get(path);assert(expected,'Unexpected JavaScript URL '+path);const bytes=await r.body();assert.equal(sha256(bytes),expected.sha256);report.scriptReceipts.push({url:r.url(),bytes:bytes.length,sha256:expected.sha256});})().catch(e=>report.errors.push(text(e)));
  pending.add(task);task.finally(()=>pending.delete(task));
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.__approachOrder,null,{timeout:60000});
 await bounded(page.evaluate(()=>window.__approachOrder.ready()),600000,'Real authored world preparation');await checkpoint();
 assert(backend==='metal'?/Metal/.test(raw.gpu)&&!/SwiftShader|llvmpipe/i.test(raw.gpu):/SwiftShader/.test(raw.gpu),'Actual renderer differs from requested backend');
 for(let index=0;index<14;index++){
  const c=await bounded(page.evaluate(i=>window.__approachOrder.prepare(i),index),300000,'Case preparation');report.phase=c.name;console.log(new Date().toISOString()+' '+c.name);await checkpoint();
  let baselineRgba;
  for(let imageIndex=0;imageIndex<4;imageIndex++){
   const capture=await bounded(page.evaluate(i=>window.__approachOrder.proofImage(i),imageIndex),180000,'Original-resolution proof image');
   assert(capture.png.startsWith('data:image/png;base64,'));const bytes=Buffer.from(capture.png.split(',')[1],'base64'),rgba=Buffer.from(capture.rawRgbaBase64,'base64');
   const stem=c.name+'-'+imageIndex+'-'+capture.mode,file=stem+'.png',rawFile=stem+'.rgba';
   // Keep both original outputs even if independent decoding finds a mismatch.
   await writeFile(resolve(out,file),bytes);await writeFile(resolve(out,rawFile),rgba);
   const receipt={file,rawFile,case:c.name,index:imageIndex,mode:capture.mode,pngSha256:sha256(bytes),pixelSha256:capture.pixelSha256,difference:capture.difference};
   report.captures.push(receipt);await checkpoint();
   receipt.encoding=verifyCapture(bytes,rgba,{width:1280,height:800,pixelSha256:capture.pixelSha256});
   if(imageIndex===0)baselineRgba=rgba;receipt.independentDifference=compareRawRgba(baselineRgba,rgba);await checkpoint();
  }
  await Promise.allSettled([...pending]);assert.equal(report.errors.length,0,'Browser or served-script error before timing');assert.equal(report.failedRequests.length,0,'Failed request before timing');
  const verdict=validateCorrectnessCase(raw,index,report.captures);report.correctnessGates.push(verdict);await checkpoint();assert(verdict.passed,verdict.error);
  if(c.timing){await bounded(page.evaluate(v=>window.__approachOrder.authorizeTiming(v),verdict),15000,'Authorize independently proven case');await checkpoint();
   await bounded(page.evaluate(()=>window.__approachOrder.timing()),600000,'All balanced elapsed queries');await checkpoint();}
 }
 await Promise.allSettled([...pending]);assert(report.scriptReceipts.length>0,'No served fixture script receipt');
}
try{await bounded(run(),65*60000,'Entire isolated experiment');}
catch(error){report.errors.push(text(error));}
finally{
 await checkpoint();
 if(browser)try{await bounded(browser.close(),30000,'Browser cleanup');}catch(e){report.errors.push(text(e));}
 if(server.listening)try{await bounded(new Promise((ok,no)=>server.close(e=>e?no(e):ok())),10000,'Server cleanup');}catch(e){report.errors.push(text(e));}
 await Promise.allSettled([...pending]);
 try{await verifyManifest(resolve(game,'dist'),before);await verifyManifest(resolve(out,'fixture'),fixture);report.originalBytesUnchanged=true;}catch(e){report.errors.push(text(e));}
 report.analysis=raw?analyze(raw):null;report.complete=!!report.analysis?.complete&&!report.errors.length&&!report.failedRequests.length;
 report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({diagnosticOnly:true,releaseAcceptance:false,complete:report.complete,backend,gpu:raw?.gpu,
  cases:report.analysis?.cases.map(c=>({name:c.name,baselineMs:c.baselineMs?.mean,candidateMs:c.candidateMs?.mean,pairedPercent:c.pairedDeltaPercent?.mean})),errors:[...report.errors,...(report.analysis?.errors||[])]}));
 if(!report.complete)process.exitCode=1;
}
