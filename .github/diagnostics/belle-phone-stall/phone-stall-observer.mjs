/** Additive browser/V8 observations for one pinned diagnostic; never a release verdict. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const pinnedDriver='c722b5810a7693e5ece72ed00b4401e7cde7267a';
export const blobHash=text=>{const bytes=Buffer.from(text);return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');};
const inserts=[
 ["import {checkGpsFullScene} from './gps-full-scene-check.mjs';","\nimport {installPhoneStallObserver,startPhoneStallDiagnostic} from './phone-stall-observer.mjs';",'after'],
 ['const begin=Date.now();let browser,page;','let stallDiagnostic;','after'],
 [' const navigationStarted=Date.now();',' await installPhoneStallObserver(page);\n','before'],
 [' try{await page.evaluate(()=>{window.__belleBrowserClock?.reset?.();window.__belleLongTasks?.reset?.();window.__belleObserverWindow?.reset?.();});}',
  ' stallDiagnostic=await startPhoneStallDiagnostic({page,output});\n','before'],
 [" await page.keyboard.down('w');",'\n stallDiagnostic.noteInputDownReturn();','after'],
 [" try{await page.waitForTimeout(seconds*1000);}finally{clearInterval(heartbeat);await pendingHeartbeat;await page.keyboard.up('w');}",
  '\n stallDiagnostic.noteInputUpReturn();','after'],
 [' try{await cdp?.detach();}',' await stallDiagnostic?.finish();\n','before'],
 [' report.elapsedWallMs=Date.now()-begin;',' await stallDiagnostic?.finish();\n','before']
];

export function deriveDriver(original){
 assert.equal(blobHash(original),pinnedDriver,'Strict driver identity changed');
 let derived=original;
 for(const [anchor,insertion,side] of inserts){
  assert.equal(derived.split(anchor).length,2,'Diagnostic anchor must be unique: '+anchor);
  derived=derived.replace(anchor,()=>side==='before'?insertion+anchor:anchor+insertion);
 }
 let restored=derived;
 for(const [anchor,insertion,side] of inserts.slice().reverse()){
  const combined=side==='before'?insertion+anchor:anchor+insertion;
  assert.equal(restored.split(combined).length,2,'Restoration anchor must be unique');
  restored=restored.replace(combined,()=>anchor);
 }
 assert.equal(restored,original,'Only additive observation is allowed');
 return derived;
}

// Executes as an init script before application code. No game, WebGL, RAF,
// sensor, event or renderer method is replaced. Only native events are read.
export function phoneStallBrowserObserver(){
 const limit=1024;
 let startAt=null,endAt=null,firstW=null,lastRaf=null,rafId=null;
 const tasks=[],animationFrames=[],rafGaps=[],events=[];
 const dropped={tasks:0,animationFrames:0,rafGaps:0,events:0};
 const observers=[],availability={longtask:false,'long-animation-frame':false};
 function retain(kind,rows,row){if(rows.length<limit)rows.push(row);else dropped[kind]++;}
 function event(name,at=performance.now()){
  if(startAt===null)return;
  retain('events',events,{name,atMs:at,fromStartMs:at-startAt});
 }
 function eligible(entry){return startAt!==null&&entry.startTime>=startAt&&(endAt===null||entry.startTime<endAt);}
 function collectTasks(entries){for(const entry of entries){if(!eligible(entry))continue;
  retain('tasks',tasks,{startTimeMs:entry.startTime,durationMs:entry.duration,name:entry.name,
   attribution:Array.from(entry.attribution??[],a=>({name:a.name,containerType:a.containerType,containerName:a.containerName,containerId:a.containerId,containerSrc:a.containerSrc}))});
 }}
 function collectAnimationFrames(entries){for(const entry of entries){if(!eligible(entry))continue;
  retain('animationFrames',animationFrames,{startTimeMs:entry.startTime,durationMs:entry.duration,
   renderStartMs:entry.renderStart,styleAndLayoutStartMs:entry.styleAndLayoutStart,blockingDurationMs:entry.blockingDuration,
   scripts:Array.from(entry.scripts??[],s=>({startTimeMs:s.startTime,durationMs:s.duration,executionStartMs:s.executionStart,
    forcedStyleAndLayoutDurationMs:s.forcedStyleAndLayoutDuration,pauseDurationMs:s.pauseDuration,
    invoker:s.invoker,invokerType:s.invokerType,sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,
    sourceCharPosition:s.sourceCharPosition,windowAttribution:s.windowAttribution}))});
 }}
 for(const [type,collect] of [['longtask',collectTasks],['long-animation-frame',collectAnimationFrames]]){
  if(Array.isArray(PerformanceObserver.supportedEntryTypes)&&!PerformanceObserver.supportedEntryTypes.includes(type))continue;
  try{const observer=new PerformanceObserver(list=>collect(list.getEntries()));observer.observe({type});observers.push({observer,collect});availability[type]=true;}catch{}
 }
 function frame(now){
  if(startAt===null||endAt!==null)return;
  if(lastRaf!==null&&now-lastRaf>50)retain('rafGaps',rafGaps,{startTimeMs:lastRaf,endTimeMs:now,durationMs:now-lastRaf});
  lastRaf=now;rafId=requestAnimationFrame(frame);
 }
 document.addEventListener('keydown',e=>{if(startAt!==null&&endAt===null&&e.isTrusted&&e.code==='KeyW'&&firstW===null){firstW=performance.now();event('first-trusted-w-keydown',firstW);}},true);
 document.addEventListener('keyup',e=>{if(startAt!==null&&endAt===null&&e.isTrusted&&e.code==='KeyW'){
  endAt=performance.now();event('trusted-w-keyup',endAt);if(rafId!==null)cancelAnimationFrame(rafId);
 }},true);
 document.addEventListener('click',e=>{if(startAt===null||endAt!==null||!e.isTrusted||!(e.target instanceof Element))return;
  if(e.target.closest('#ride-profile > button'))event('profile-button-click');
  if(e.target.closest('[data-close="settings"]'))event('settings-close-click');
 },true);
 document.addEventListener('visibilitychange',()=>{if(startAt!==null&&endAt===null)event(document.hidden?'document-hidden':'document-visible');});
 window.addEventListener('blur',()=>{if(startAt!==null&&endAt===null)event('window-blur');});
 window.addEventListener('focus',()=>{if(startAt!==null&&endAt===null)event('window-focus');});
 window.__bellePhoneStallObserver={
  start(){
   if(startAt!==null)throw Error('Stall observer cannot reset or rearm');
   startAt=performance.now();event('observer-start',startAt);rafId=requestAnimationFrame(frame);
   return {nowMs:startAt,timeOriginMs:performance.timeOrigin,visibilityState:document.visibilityState,focused:document.hasFocus()};
  },
  finish(){
   for(const {observer,collect} of observers){collect(observer.takeRecords());observer.disconnect();}
   if(rafId!==null)cancelAnimationFrame(rafId);
   return {clock:'Browser performance.now() milliseconds since timeOrigin',timeOriginMs:performance.timeOrigin,
    startTimeMs:startAt,firstTrustedWKeydownMs:firstW,trustedWKeyupMs:endAt,snapshotTimeMs:performance.now(),
    nativeInputComplete:firstW!==null&&endAt!==null,availability,limit,dropped,tasks,animationFrames,rafGaps,events,
    scope:'Starts before original profile button and ends at native trusted W-keyup. Includes menu/focus prelude. Entries overlapping an input boundary retain their full durations for independent interpretation; no acceptance measurements are changed.'};
  }
 };
}

export async function installPhoneStallObserver(page){await page.addInitScript(phoneStallBrowserObserver);}

export async function startPhoneStallDiagnostic({page,output}){
 const receipt={schema:1,scope:'DIAGNOSTIC ONLY. V8 sampling and browser observers add overhead. This result cannot replace original uninstrumented acceptance.',
  sourceHead:process.env.GITHUB_SHA??null,driverBlob:pinnedDriver,profileQuery:'1',sceneQuery:'perfProbe=1',
  intervalUs:2000,errors:[],cpuClock:'CDP V8 microseconds; clockAlignment bounds relate the CDP Performance Timestamp to browser performance.now()',
  nodeClock:'Node performance.now() milliseconds for host-side input return receipts',browser:null,clockAlignment:null};
 let session,enabled=false,started=false,finished;
 const error=(where,e)=>receipt.errors.push({where,message:String(e?.stack??e)});
 try{
  session=await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  await session.send('Profiler.enable');enabled=true;
  await session.send('Profiler.setSamplingInterval',{interval:receipt.intervalUs});
  await session.send('Profiler.start');started=true;
  receipt.profileStartReturnMs=performance.now();
 }catch(e){error('V8 profiler start',e);}
 try{
  const timestamp=async()=>session?(await session.send('Performance.getMetrics')).metrics.find(x=>x.name==='Timestamp')?.value??null:null;
  const before=await timestamp();
  const browserStart=await page.evaluate(()=>window.__bellePhoneStallObserver.start());
  const after=await timestamp();
  receipt.clockAlignment={beforeCdpSeconds:before,afterCdpSeconds:after,browserStart,
   minCdpMinusBrowserUs:before===null?null:before*1e6-browserStart.nowMs*1000,
   maxCdpMinusBrowserUs:after===null?null:after*1e6-browserStart.nowMs*1000,
   caveat:'Browser read is bracketed by CDP Timestamp reads. Interpret sample overlap within these bounds; do not claim exact GPU timing.'};
 }catch(e){error('Browser observer start',e);}
 function finish(){return finished??=(async()=>{
  try{receipt.browser=await page.evaluate(()=>window.__bellePhoneStallObserver.finish());}catch(e){error('Browser observer finish',e);}
  try{if(started){const {profile}=await session.send('Profiler.stop');receipt.profileStopReturnMs=performance.now();
   await writeFile(join(output,'renderer.cpuprofile'),JSON.stringify(profile));receipt.samples=profile.samples?.length??0;
   receipt.profileStartUs=profile.startTime;receipt.profileEndUs=profile.endTime;
  }}catch(e){error('V8 profiler stop/archive',e);}
  try{if(enabled)await session.send('Profiler.disable');}catch(e){error('V8 profiler disable',e);}
  try{await session?.detach();}catch(e){error('Observer CDP detach',e);}
  try{await writeFile(join(output,'phone-stall-observation.json'),JSON.stringify(receipt,null,2)+'\n');}catch(e){console.error('Stall evidence write failed:',String(e));}
 })();}
 return {noteInputDownReturn(){receipt.inputDownReturnedMs=performance.now();},noteInputUpReturn(){receipt.inputUpReturnedMs=performance.now();},finish};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const source=resolve(process.argv[2]);
 assert(source.endsWith('/scripts/sustained-ride-profile.mjs'));
 const original=await readFile(source,'utf8');
 const derived=deriveDriver(original);
 await copyFile(fileURLToPath(import.meta.url),join(dirname(source),'phone-stall-observer.mjs'));
 const dest=join(dirname(source),'sustained-phone-stall-diagnostic.mjs');
 await writeFile(dest,derived,{flag:'wx'});
 if(process.argv[3]){const evidence=resolve(process.argv[3]);await mkdir(evidence,{recursive:true});
  await writeFile(join(evidence,'original-strict-driver.mjs'),original);
  await writeFile(join(evidence,'observed-driver.mjs'),derived);
  await writeFile(join(evidence,'driver-receipt.json'),JSON.stringify({originalGitBlob:blobHash(original),derivedGitBlob:blobHash(derived),exactReverseVerified:true,applicationChanges:0,queryChanges:0},null,2)+'\n');
 }
 console.log('Pinned strict driver verified; only reversible external observers added. Original file remains unchanged.');
}
