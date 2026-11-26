// Diagnostic only. Never use this observer's result for release acceptance.
import {createHash} from 'node:crypto';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import os from 'node:os';

const pinnedDriver='c722b5810a7693e5ece72ed00b4401e7cde7267a';
const edits=[
 ["import {checkGpsFullScene} from './gps-full-scene-check.mjs';", "\nimport {startCpuDiagnostic} from './belle-cpu-observer.mjs';", 'after'],
 ['const begin=Date.now();let browser,page;', 'let diagnostic;', 'after'],
 [" await page.keyboard.down('w');", ' diagnostic=await startCpuDiagnostic({browser,cdp,output});\n', 'before'],
 [" await page.keyboard.down('w');", '\n diagnostic.beginRide();', 'after'],
 [" try{await page.waitForTimeout(seconds*1000);}finally{clearInterval(heartbeat);await pendingHeartbeat;await page.keyboard.up('w');}", '\n diagnostic.endRide();', 'after'],
 [' try{await cdp?.detach();}', ' await diagnostic?.finish();\n', 'before'],
 [' report.elapsedWallMs=Date.now()-begin;', ' await diagnostic?.finish();\n', 'before']
];
export function derive(original){
 const bytes=Buffer.from(original,'utf8');
 const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(blob!==pinnedDriver)throw Error('Original strict driver does not match its pinned Git blob');
 // Distinguish the two identical keyboard anchors with one combined insertion.
 const combined=edits.filter((_,i)=>i!==3);
 // The isolated diagnostic app recognizes this extra observation flag. Keep
 // profile=1 so the original trusted-keyup boundary and build-reader path stay
 // unchanged. No quality, input, pacing or acceptance logic is replaced.
 const nativeQuery="'/?profile=1'",diagnosticQuery="'/?profile=1&renderSubmission=1'";
 if(original.split(nativeQuery).length!==2||original.includes(diagnosticQuery))throw Error('Nonunique original profile query');
 let derived=original.replace(nativeQuery,diagnosticQuery);
 for(const [anchor,insert,side] of combined){
  if(derived.split(anchor).length!==2)throw Error('Nonunique diagnostic anchor: '+anchor);
  derived=derived.replace(anchor,()=>side==='before'?insert+anchor:anchor+insert);
 }
 const keyboard=edits[3];
 if(derived.split(keyboard[0]).length!==2)throw Error('Nonunique input-start anchor');
 derived=derived.replace(keyboard[0],()=>keyboard[0]+keyboard[1]);
 // Exact reverse operations prove all original input, frame and acceptance logic remains.
 if(derived.split(diagnosticQuery).length!==2||derived.includes(nativeQuery))throw Error('Nonunique named diagnostic query');
 let restored=derived.replace(diagnosticQuery,nativeQuery);
 for(const [anchor,insert,side] of [keyboard,...combined.slice().reverse()]){
  const pair=side==='before'?insert+anchor:anchor+insert;
  if(restored.split(pair).length!==2)throw Error('Nonunique restoration anchor');
  restored=restored.replace(pair,()=>anchor);
 }
 if(restored!==original)throw Error('Diagnostic derivation changed original code');
 return derived;
}

export function summarize(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 const parent=new Map();for(const n of profile.nodes)for(const child of n.children??[])parent.set(child,n.id);
 const self=new Map(),inclusive=new Map();
 for(const [i,id] of (profile.samples??[]).entries()){
  const dt=profile.timeDeltas?.[i];if(!Number.isFinite(dt)||dt<0||!nodes.has(id))continue;
  self.set(id,(self.get(id)??0)+dt);
  const seen=new Set();for(let at=id;at!==undefined&&!seen.has(at);at=parent.get(at)){seen.add(at);inclusive.set(at,(inclusive.get(at)??0)+dt);}
 }
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([id,us])=>({id,weightedMs:us/1000,callFrame:nodes.get(id)?.callFrame}));
 return {scope:'Sample-weighted estimates, not exact execution duration or GPU time; call sites may be minified.',sampleCount:profile.samples?.length??0,topSelf:top(self),topInclusive:top(inclusive)};
}

export async function startCpuDiagnostic({browser,cdp,output}){
 const evidence={scope:'DIAGNOSTIC ONLY; renderSubmission=1 named render observers, V8 profiling and OS sampling can perturb scheduling. Not release acceptance or GPU-device timing.',profileQuery:'1',renderSubmissionQuery:'1',intervalUs:5000,clock:'Node performance.now() within this invocation; not aligned to browser timestamps',errors:[],hostSamples:[],processBefore:null,processAfter:null,nativeSample:null};
 let browserSession,enabled=false,started=false,interval,timer,sampleProcess,samplePromise,sampleTimeout,finished;
 const error=(where,e)=>evidence.errors.push({where,message:String(e)});
 const host=()=>{try{evidence.hostSamples.push({atMs:performance.now(),load:os.loadavg(),freeBytes:os.freemem(),cpuTimes:os.cpus().map(c=>c.times)});}catch(e){error('host sample',e);}};
 evidence.host={platform:os.platform(),arch:os.arch(),cpus:os.cpus().length,totalBytes:os.totalmem()};host();
 try{browserSession=await browser.newBrowserCDPSession();evidence.processBefore=(await browserSession.send('SystemInfo.getProcessInfo')).processInfo;}catch(e){error('Chrome process counters before',e);}
 try{if(!cdp)throw Error('Original page CDP session unavailable');await cdp.send('Profiler.enable');enabled=true;await cdp.send('Profiler.setSamplingInterval',{interval:evidence.intervalUs});await cdp.send('Profiler.start');started=true;evidence.profileStartMs=performance.now();}catch(e){error('V8 profile start',e);}
 function beginRide(){
  evidence.inputDownReturnedMs=performance.now();host();interval=setInterval(host,2000);
  timer=setTimeout(()=>{
   const gpu=evidence.processBefore?.find(p=>String(p.type).toLowerCase()==='gpu');
   if(process.platform!=='darwin'||!Number.isInteger(gpu?.id)||gpu.id<=0){evidence.nativeSample={skipped:'No identified macOS Chrome GPU process'};return;}
   evidence.nativeSample={pid:gpu.id,type:gpu.type,startMs:performance.now(),durationSeconds:8,intervalMs:10};
   try{
    sampleProcess=spawn('/usr/bin/sample',[String(gpu.id),'8','10','-file',resolve(output,'gpu-process-sample.txt')],{stdio:['ignore','ignore','pipe']});
    let stderr='';sampleProcess.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4096);});
    samplePromise=new Promise(ok=>{sampleProcess.once('error',e=>{error('GPU process sample',e);});sampleProcess.once('close',(code,signal)=>{clearTimeout(sampleTimeout);Object.assign(evidence.nativeSample,{code,signal,stderr,endMs:performance.now()});ok();});});
    sampleTimeout=setTimeout(()=>{if(sampleProcess.exitCode===null&&sampleProcess.signalCode===null)sampleProcess.kill('SIGTERM');},20000);
   }catch(e){error('GPU process sample launch',e);}
  },20000);
 }
 function endRide(){if(evidence.inputUpReturnedMs!==undefined)return;evidence.inputUpReturnedMs=performance.now();clearInterval(interval);clearTimeout(timer);host();}
 function finish(){return finished??=(async()=>{
  if(evidence.inputDownReturnedMs!==undefined&&evidence.inputUpReturnedMs===undefined){evidence.inputEndUnconfirmed=true;endRide();}
  clearInterval(interval);clearTimeout(timer);
  try{if(started){const {profile}=await cdp.send('Profiler.stop');evidence.profileStopMs=performance.now();await writeFile(join(output,'renderer.cpuprofile'),JSON.stringify(profile));await writeFile(join(output,'renderer-profile-summary.json'),JSON.stringify(summarize(profile),null,2)+'\n');}}catch(e){error('V8 profile stop or archive',e);}
  try{if(enabled)await cdp.send('Profiler.disable');}catch(e){error('V8 profiler disable',e);}
  try{if(browserSession)evidence.processAfter=(await browserSession.send('SystemInfo.getProcessInfo')).processInfo;}catch(e){error('Chrome process counters after',e);}
  try{await browserSession?.detach();}catch(e){error('Chrome browser CDP detach',e);}
  if(samplePromise){if(sampleProcess.exitCode===null&&sampleProcess.signalCode===null)sampleProcess.kill('SIGTERM');await samplePromise;}
  clearTimeout(sampleTimeout);host();
  try{await writeFile(join(output,'cpu-diagnostic.json'),JSON.stringify(evidence,null,2)+'\n');}catch(e){console.error('CPU diagnostic receipt write failed:',String(e));}
 })();}
 return {beginRide,endRide,finish};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const source=resolve(process.argv[2]);
 if(!source.endsWith('/scripts/sustained-ride-profile.mjs'))throw Error('Expected exact original strict script path');
 const original=await readFile(source,'utf8');
 const derived=derive(original);
 const dest=join(dirname(source),'sustained-ride-cpu-diagnostic.mjs');
 await copyFile(fileURLToPath(import.meta.url),join(dirname(source),'belle-cpu-observer.mjs'));
 await writeFile(dest,derived,{flag:'wx'});
 console.log('Pinned driver verified; reversible diagnostic inserts plus renderSubmission=1 observation selection only:',dest);
}
