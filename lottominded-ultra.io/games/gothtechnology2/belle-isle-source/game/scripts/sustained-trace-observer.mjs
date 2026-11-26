/** CDP observation of the original harness. No input, route, clock or renderer replacement. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MARKER_PREFIX,isGameUrl,sha256,traceSummary,diagnosticVerdict} from './sustained-trace-contract.mjs';

const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const errorText=error=>error?.stack||String(error);
const categories=['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing',
 'v8','disabled-by-default-v8.gc','renderer.scheduler','gpu','viz','cc','disabled-by-default-gpu.service'];

/** Observer exceptions are recorded; the exact native receiver, arguments,
 * result and exception are retained. Used only by this diagnostic preload. */
export function observeMethod(owner,key,{before,after,onError=()=>{}}={}){
 const original=owner[key],descriptor=Object.getOwnPropertyDescriptor(owner,key);
 const observer=async(action,...args)=>{try{await action?.(...args);}catch(error){onError(error);}};
 const wrapped=async function(...args){await observer(before,args,this);const result=await Reflect.apply(original,this,args);await observer(after,result,args,this);return result;};
 Object.defineProperty(owner,key,{configurable:true,writable:true,value:wrapped});
 return ()=>{if(owner[key]!==wrapped)return;if(descriptor)Object.defineProperty(owner,key,descriptor);else delete owner[key];};
}
export async function cdp(session,method,params={},timeout=15000){
 let timer;try{return await Promise.race([session.send(method,params),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(method+' observation timed out')),timeout);})]);}finally{clearTimeout(timer);}
}

/** Read-only trusted-event labels, paired with native UserTiming trace events. */
export function installPageMarkers({prefix}){
 if(location.hostname!=='127.0.0.1'||new URLSearchParams(location.search).get('profile')!=='1')return;
 const markers=[],errors=[];let started=false,finished=false,droppedMarkers=0;
 const record=label=>{
  try{if(markers.length>=128){droppedMarkers++;return;}const name=prefix+label;performance.mark(name);
   const mark=performance.getEntriesByName(name,'mark').at(-1);markers.push({label,atMs:mark.startTime});
  }catch(error){errors.push(String(error));}
 };
 document.addEventListener('click',event=>{
  if(event.isTrusted&&!started&&event.target?.closest?.('#ride-profile button')?.textContent?.startsWith('Start')){started=true;record('profile-start-click');}
 },true);
 document.addEventListener('keydown',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'&&!markers.some(m=>m.label==='first-w-keydown'))record('first-w-keydown');},true);
 document.addEventListener('keyup',event=>{if(event.isTrusted&&started&&!finished&&event.code==='KeyW'){finished=true;record('w-keyup');}},true);
 Object.defineProperty(window,'__belleNativeTraceEvidence',{configurable:false,value:()=>({
  url:location.href,timeOriginMs:performance.timeOrigin,nowMs:performance.now(),wallTimeMs:Date.now(),
  viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},markers:markers.map(row=>({...row})),errors:[...errors],droppedMarkers})});
}

export async function installSustainedTrace(chromium,{game,output,source,onFailure=()=>{}}){
 await mkdir(output,{recursive:true});
 const evidence={diagnosticOnly:true,releaseAcceptance:false,source,host:{platform:process.platform,arch:process.arch},
  errors:[],unsupported:[],launches:[],pages:[],browser:null,traceComplete:null,pageEvidence:null,cpu:null,summary:null};
 const fail=error=>{evidence.errors.push(errorText(error));onFailure(error);};
 const optional=async(session,method)=>{try{return await cdp(session,method);}catch(error){evidence.unsupported.push({method,error:errorText(error)});return null;}};
 let browserSession,gameSession,gamePage,recording=false,cpuRecording=false,finishing;
 const responseTasks=new Set(),scriptReceipts=[],scriptErrors=[];
 await save(resolve(output,'trace-evidence.json'),{...evidence,status:'starting'});

 async function finish(){
  if(finishing)return finishing;
  finishing=(async()=>{
   try{
    if(gamePage&&!gamePage.isClosed()){
     evidence.pageEvidence=await gamePage.evaluate(()=>window.__belleNativeTraceEvidence?.()||null);
     evidence.targetAtEnd=await cdp(gameSession,'Target.getTargetInfo');
     evidence.frameTree=await cdp(gameSession,'Page.getFrameTree');
     evidence.metricClockEnd=await cdp(gameSession,'Performance.getMetrics');
    }
    if(cpuRecording){const result=await cdp(gameSession,'Profiler.stop');cpuRecording=false;
     evidence.cpu={file:'renderer.cpuprofile',samples:result.profile.samples?.length??0,startTime:result.profile.startTime,endTime:result.profile.endTime};
     await save(resolve(output,'renderer.cpuprofile'),result.profile);}
   }catch(error){fail(error);}
   if(browserSession){
    evidence.processesAtEnd=await optional(browserSession,'SystemInfo.getProcessInfo');
    if(recording){
     try{
      let complete,timer;
      const ended=new Promise((ok,reject)=>{complete=ok;timer=setTimeout(()=>reject(Error('Timeline flush timed out')),60000);});
      const onComplete=value=>complete(value);browserSession.once('Tracing.tracingComplete',onComplete);
      try{await cdp(browserSession,'Tracing.end');evidence.traceComplete=await ended;}
      finally{clearTimeout(timer);browserSession.off('Tracing.tracingComplete',onComplete);}
      recording=false;
      assert.ok(evidence.traceComplete.stream,'Missing raw timeline stream');
      const file=await open(resolve(output,'browser-trace.json'),'w');
      try{let done=false;while(!done){const chunk=await cdp(browserSession,'IO.read',{handle:evidence.traceComplete.stream,size:1024*1024});
       await file.writeFile(Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8'));done=chunk.eof;}}
      finally{await file.close();await cdp(browserSession,'IO.close',{handle:evidence.traceComplete.stream});}
     }catch(error){fail(error);}
    }
   }
   await Promise.allSettled([...responseTasks]);
   evidence.scriptReceipts=scriptReceipts;evidence.errors.push(...scriptErrors);
   let report=null;
   try{const bytes=await readFile(resolve(game,'output/sustained-profile/diagnostic/phone/report.json'));
    report=JSON.parse(bytes);evidence.originalReportSha256=sha256(bytes);await writeFile(resolve(output,'original-report.json'),bytes);
   }catch(error){fail(error);}
   try{
    const raw=await readFile(resolve(output,'browser-trace.json')),profileBytes=await readFile(resolve(output,'renderer.cpuprofile'));
    evidence.traceSha256=sha256(raw);evidence.cpuProfileSha256=sha256(profileBytes);
    evidence.summary=traceSummary(JSON.parse(raw),JSON.parse(profileBytes),evidence.pageEvidence);
   }catch(error){fail(error);}
   if(evidence.launches.length!==1||evidence.pages.filter(p=>p.observedGame).length!==1)fail(Error('Expected exactly one original Metal launch and one observed game page'));
   if(!scriptReceipts.length)fail(Error('Missing browser-consumed JavaScript receipts'));
   evidence.verdict=diagnosticVerdict({source,report,traceComplete:evidence.traceComplete,summary:evidence.summary,errors:evidence.errors});
   evidence.status='finished';if(!evidence.verdict.collectionComplete)onFailure(Error('Trace evidence incomplete'));
   await save(resolve(output,'trace-evidence.json'),evidence);
  })();return finishing;
 }

 observeMethod(chromium,'launch',{onError:fail,after:async(browser,args)=>{
  evidence.launches.push(args[0]);
  observeMethod(browser,'close',{before:finish,onError:fail});
  assert.deepEqual(args,[{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}],'Original launch options changed');
  browserSession=await browser.newBrowserCDPSession();
  evidence.browser=await cdp(browserSession,'Browser.getVersion');
  evidence.systemInfo=await optional(browserSession,'SystemInfo.getInfo');
  evidence.processesAtStart=await optional(browserSession,'SystemInfo.getProcessInfo');
  observeMethod(browser,'newPage',{onError:fail,after:async(page,args)=>{
   const entry={options:args[0]??null,observedGame:false};evidence.pages.push(entry);
   if(args[0]?.viewport?.width!==390||args[0]?.viewport?.height!==844)return;
   assert.deepEqual(args,[{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'}],'Original phone options changed');
   assert.ok(!gamePage,'Multiple game pages');gamePage=page;entry.observedGame=true;
   // Chrome 158 returned an empty category inventory before renderer creation.
   // Query after the original game page exists, but before its first navigation.
   // Enumeration is advisory, not proof of recording: request the entire original
   // explicit category set and require actual renderer category events afterward.
   const supported=await cdp(browserSession,'Tracing.getCategories');
   assert.ok(Array.isArray(supported.categories)&&supported.categories.every(c=>typeof c==='string'),'Malformed timeline category inventory');
   evidence.categories={available:supported.categories,requested:[...categories],selected:[...categories],
    enumerationComplete:categories.every(c=>supported.categories.includes(c))};
   await cdp(browserSession,'Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',
    traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:262144,includedCategories:evidence.categories.selected}});
   recording=true;
   await page.addInitScript(installPageMarkers,{prefix:MARKER_PREFIX});
   page.on('response',response=>{
    const url=new URL(response.url());if(url.hostname!=='127.0.0.1'||!url.pathname.endsWith('.js'))return;
    const task=(async()=>{
     const name=decodeURIComponent(url.pathname).slice(1),expected=source.files.find(row=>row.file===name);
     assert.ok(expected,'Unbound application script: '+name);assert.equal(response.status(),200,'Script response failed');
     const bytes=await response.body();assert.equal(bytes.length,expected.bytes,'Script length mismatch');assert.equal(sha256(bytes),expected.sha256,'Browser script/build hash mismatch');
     const file='scripts/'+expected.sha256+'.js';await mkdir(resolve(output,'scripts'),{recursive:true});await writeFile(resolve(output,file),bytes);
     scriptReceipts.push({url:response.url(),file,bytes:bytes.length,sha256:expected.sha256,receivedBy:'browser-response-body'});
    })().catch(error=>scriptErrors.push(errorText(error)));responseTasks.add(task);task.finally(()=>responseTasks.delete(task));
   });
   observeMethod(page,'goto',{onError:fail,after:async(_response,args)=>{
    assert.ok(isGameUrl(args[0]),'Original game navigation changed');
    gameSession=await page.context().newCDPSession(page);
    evidence.targetAtStart=await cdp(gameSession,'Target.getTargetInfo');
    assert.equal(evidence.targetAtStart.targetInfo.type,'page');assert.ok(isGameUrl(evidence.targetAtStart.targetInfo.url),'Profiler attached to wrong target');
    await cdp(gameSession,'Performance.enable',{timeDomain:'timeTicks'});
    evidence.metricClockStart=await cdp(gameSession,'Performance.getMetrics');
    evidence.pageClockStart=await page.evaluate(()=>({url:location.href,nowMs:performance.now(),timeOriginMs:performance.timeOrigin,wallTimeMs:Date.now()}));
    await cdp(gameSession,'Profiler.enable');await cdp(gameSession,'Profiler.setSamplingInterval',{interval:1000});
    await cdp(gameSession,'Profiler.start');cpuRecording=true;
   }});
  }});
 }});
 return {evidence,finish};
}
