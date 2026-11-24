import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {build} from 'esbuild';
import {ManualLoopProbe} from './loopDiagnostics.ts';
import {installGpuFramePacing,attachGpuFramePacingProbe,gpuFramePacingDiagnostics} from './gpuFramePacing.ts';
import {createNatureRenderProbe} from './renderDiagnostics.ts';
const {outputFiles}=await build({entryPoints:[fileURLToPath(new URL('./rideProfile.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'});
const {RideProfile}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

class Element {
 constructor(tag,onText){this.tagName=tag;this.onText=onText;this.children=[];this.style={};this.hidden=false;this.open=false;this.attributes={};this._text='';}
 set textContent(value){this._text=value;this.onText?.(value);}
 get textContent(){return this._text;}
 append(child){this.children.push(child);child.parentElement=this;}
 setAttribute(key,value){this.attributes[key]=value;}
}
const nature=()=>({renderPasses:1,selectionCpuMs:0,captureCpuMs:0,cullCpuMs:0,selectionRefreshes:0,captureCalls:0,
 farPoolViewCalls:4,farSourceInstancesAcrossViews:8,farSubmittedInstancesAcrossViews:4,compactions:0,
 captureAttributeMarks:0,captureBytesMarked:0,compactionAttributeMarks:0,compactionBytesMarked:0,invalidObservations:0});
function fixture(observe=true,configure){
 let time=100,clockCalls=0,animation=null,flushes=0;const listeners=new Map(),settings=new Element('dialog');
 globalThis.document={hidden:false,createElement:tag=>new Element(tag,text=>{if(text.includes('s riding'))time+=5;}),
  getElementById:id=>id==='settings'?settings:null,addEventListener:(name,fn)=>{listeners.set(name,[...(listeners.get(name)??[]),fn]);},body:new Element('body')};
 Object.assign(globalThis,{innerWidth:1194,innerHeight:694,devicePixelRatio:2});
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,
  isContextLost(){time+=1;return false;},fenceSync(){time+=2;return {};},clientWaitSync(){time+=1;return 3;},deleteSync(){time+=1;},flush(){time+=3;flushes++;}};
 const renderer={xr:{isPresenting:false},info:{render:{frame:0}},getContext:()=>gl,setAnimationLoop:fn=>{animation=fn;},dispose(){}};
 installGpuFramePacing(renderer);
 const Probe=class extends ManualLoopProbe{constructor(){super(()=>{clockCalls++;return time;});}};
 const configured=configure?.(renderer,Probe),probe=configure?configured.loopProbe:observe?new Probe():undefined;
 const binding=configure?configured.loopBinding:probe?attachGpuFramePacingProbe(renderer,probe):undefined;
 const profile=new RideProfile(()=>({quality:'smooth',cap:60}),{loopProbe:probe,loopCoverage:()=>binding?.coverage(),gpuPacing:()=>gpuFramePacingDiagnostics(renderer)});
 return {profile,probe,binding,configured,renderer,settings,advance:ms=>{time+=ms;},clockCalls:()=>clockCalls,flushes:()=>flushes,
  tick:now=>animation?.(now),emit:(name,event)=>listeners.get(name)?.forEach(fn=>fn(event)),report:()=>JSON.parse(settings.children[0].children[2].value),text:()=>settings.children[0].children[2].value};
}
function feed(profile,dt=.2,options={}){
 profile.sample(dt,options.times??[1,2,3,4,5],20,200,2,3,options.x??1,0,options.speed??2,options.place??'Forest',options.eligible??true,options.nature??nature());
}

test('real profile sampling is nested in callback work and links the previous completed eligible wrapper',()=>{
 const f=fixture();let mode='ride',dt=.6;
 f.renderer.setAnimationLoop(()=>{if(mode==='cap')return;f.renderer.info.render.frame++;f.advance(10);feed(f.profile,dt);f.advance(1);});
 f.profile.start();f.tick(100);mode='cap';f.tick(120);mode='ride';dt=.2;f.tick(140);f.profile.finish();
 const r=f.report(),loop=r.loopDiagnostics;
 assert.equal(r.version,6);assert.equal(r.frames,2);assert.equal(r.activeSeconds,.8);assert.equal(r.movingSeconds,.8);
 assert.equal(loop.completedCallbacks,3);assert.equal(loop.acceptedCallbacks.callbacks,2);
 assert.deepEqual(loop.coverage.atStart,{installed:true,status:'installed'});assert.deepEqual(loop.coverage.atFinish,{installed:true,status:'installed'});
 const first=loop.topCallbacks.find(row=>row.callbackId===1);assert.equal(first.scopes.profileSampleCpuMs.cpuMs,5);
 assert.equal(first.scopes.callbackBodyCpuMs.cpuMs,16);assert.equal(first.scopes.gateSubmittedCpuMs.cpuMs,6);
 const slow=loop.slowIntervals.find(row=>row.sample===2);assert.equal(slow.callbackId,3);
 assert.equal(slow.previousEligibleCallback.callbackId,1);assert.equal(slow.previousEligibleCallback.acceptedSample,1);
 assert.equal(slow.previousEligibleCallback.scopes.profileSampleCpuMs.cpuMs,5);
 assert.equal(r.slowFrames.find(row=>row.frameMs===200).previousEligibleCallback.sample,1);
});

test('automatic 600-second finish stays inside the current callback before its final submission',()=>{
 const f=fixture();let reportAtBoundary,clockAtBoundary,flushAtBoundary;
 f.renderer.setAnimationLoop(()=>{
  f.renderer.info.render.frame++;f.advance(2);feed(f.profile,300);
  if(!f.profile.enabled){reportAtBoundary=f.text();clockAtBoundary=f.clockCalls();flushAtBoundary=f.flushes();}
  f.advance(4);
 });
 f.profile.start();f.tick(100);assert.equal(f.profile.enabled,true);assert.equal(f.flushes(),1);
 f.tick(120);const r=f.report(),loop=r.loopDiagnostics;
 assert.equal(f.profile.enabled,false);assert.equal(r.frames,2);assert.equal(r.activeSeconds,600);assert.equal(r.movingSeconds,600);assert.equal(r.observedFPS,2/600);
 assert.equal(loop.completedCallbacks,1);assert.equal(loop.acceptedCallbacks.callbacks,1);assert.equal(loop.acceptedSamples,2);
 assert.equal(loop.inFlightAtSnapshot.callbackId,2);assert.equal(loop.inFlightAtSnapshot.acceptedSample,2);
 assert.equal(loop.inFlightAtSnapshot.incomplete,true);assert.deepEqual(loop.inFlightAtSnapshot.openScopes,['callbackBodyCpuMs','profileSampleCpuMs']);
 assert.equal(loop.topCallbacks.length,1);assert.equal(r.gpuFramePacing.atFinish.submittedCallbacks,1);
 assert.equal(flushAtBoundary,1);assert.equal(f.flushes(),2);assert.equal(f.clockCalls(),clockAtBoundary);
 assert.equal(f.text(),reportAtBoundary);assert.deepEqual(f.probe.snapshot().inFlightAtSnapshot,loop.inFlightAtSnapshot);
 f.tick(140);assert.equal(f.clockCalls(),clockAtBoundary);assert.equal(f.text(),reportAtBoundary);
});

test('original counts, phases, percentiles and FPS are identical with optional loop observations',()=>{
 const run=observe=>{
  const f=fixture(observe);let next;f.renderer.setAnimationLoop(()=>{f.renderer.info.render.frame++;next();});f.profile.start();
  const entries=[()=>feed(f.profile,.1),()=>feed(f.profile,.2,{eligible:false}),()=>feed(f.profile,.3),
   ()=>feed(f.profile,-1),()=>feed(f.profile,.4,{times:[1,NaN,3,4,5]}),()=>feed(f.profile,.5,{speed:0}),
   ()=>{document.hidden=true;f.emit('visibilitychange');feed(f.profile,.6);document.hidden=false;f.emit('visibilitychange');},
   ()=>feed(f.profile,2.5,{x:2}),()=>{f.profile.breakFrameAssociation();feed(f.profile,.7,{x:3});}];
  for(let i=0;i<entries.length;i++){next=entries[i];f.tick(100+i*20);}
  f.profile.finish();const report=f.report();return {report,clocks:f.clockCalls()};
 };
 const plain=run(false),observed=run(true),keys=['version','stopReason','activeSeconds','movingSeconds','distanceMetres','excludedSeconds','hiddenSeconds','inactiveSeconds',
  'invalidSamples','invalidMetricSamples','frames','sampledFrames','droppedFrameSamples','observedFPS','over50ms','over100ms','over250ms','over2s','maxFrameMs',
  'slowFrames','renderDiagnostics','places','placesTruncated','metrics','visibilityInterruptions','settingsAtStart','settings','gpuFramePacing'];
 for(const key of keys)assert.deepEqual(observed.report[key],plain.report[key],key);
 assert.equal(plain.clocks,0);assert(observed.clocks>0);assert.equal(plain.report.loopDiagnostics,undefined);
 const last=observed.report.loopDiagnostics.slowIntervals.find(row=>row.sample===observed.report.frames);
 assert.equal(last.previousEligibleCallback,null,'explicit break must also clear loop association');
});

test('manual start/restart and visibility breaks cannot attach a prior capture callback',()=>{
 const f=fixture();f.renderer.setAnimationLoop(()=>{f.renderer.info.render.frame++;feed(f.profile,.2);});
 f.tick(80);assert.equal(f.clockCalls(),0);f.profile.start();f.tick(100);f.tick(120);f.profile.finish();
 assert.equal(f.report().loopDiagnostics.slowIntervals[1].previousEligibleCallback.acceptedSample,1);
 f.profile.start();document.hidden=true;f.emit('visibilitychange');document.hidden=false;f.emit('visibilitychange');f.tick(140);f.profile.finish();
 const r=f.report();assert.equal(r.frames,1);assert.equal(r.loopDiagnostics.captureEpoch,2);
 assert.equal(r.loopDiagnostics.slowIntervals[0].previousEligibleCallback,null);assert.equal(r.visibilityInterruptions,1);
});

test('unsupported wrapper coverage records absent observations rather than invented completed timing',()=>{
 const f=fixture();f.binding.detach();f.profile.start();feed(f.profile,.2);f.profile.finish();
 const r=f.report();assert.equal(r.frames,1);assert.equal(r.loopDiagnostics.coverage.atStart.installed,false);
 assert.equal(r.loopDiagnostics.completedCallbacks,0);assert.equal(r.loopDiagnostics.acceptedSamplesWithoutObservedCallback,1);
 assert.equal(r.loopDiagnostics.acceptedCallbacks.scopes.totalWrapperCpuMs.callbacks,0);assert.equal(f.clockCalls(),0);
});

async function productionProbeSetup(){
 const source=await readFile(new URL('./main.ts',import.meta.url),'utf8');
 const setup=source.slice(source.indexOf(' const submissionProbe='),source.indexOf(' const rideProfile='));
 assert(setup.includes('const localLoopProfile='));
 return (hostname,search,renderer={},Probe=ManualLoopProbe)=>{
  let submissionInstalls=0;const renderProbe=createNatureRenderProbe(search);
  const context=createContext({location:{hostname,search},URLSearchParams,renderProbe,renderer,scene:{},ManualLoopProbe:Probe,attachGpuFramePacingProbe,
   installRenderSubmissionProbe:()=>{submissionInstalls++;return{installed:true};}});
  const result=runInContext(setup+';({loopProbe,loopBinding,submissionProbe})',context);
  return{...result,renderProbe,submissionInstalls};
 };
}

test('actual production setup enables only the loop probe for exact local profile=1 and preserves manual behavior',async()=>{
 const setup=await productionProbeSetup();
 for(const hostname of ['localhost','127.0.0.1','[::1]'])for(const search of ['?profile=1','?profile=1&locationPerf=1','?profile=1&profile=manual']){
  const result=setup(hostname,search);assert(result.loopProbe instanceof ManualLoopProbe);
  assert.equal(result.renderProbe,undefined);assert.equal(result.submissionProbe,undefined);assert.equal(result.submissionInstalls,0);
 }
 for(const hostname of ['example.com','localhost.example.com','127.0.0.1.example.com','127.0.0.2','localhost.','::1']){
  const result=setup(hostname,'?profile=1');assert.equal(result.loopProbe,undefined);assert.equal(result.submissionInstalls,0);
 }
 for(const search of ['', '?profile','?profile=','?profile=true','?profile=01','?profile=1x','?profile=MANUAL','?profile=0&profile=1','?locationPerf=1']){
  const result=setup('127.0.0.1',search);assert.equal(result.loopProbe,undefined);assert.equal(result.submissionInstalls,0);
 }
 for(const hostname of ['127.0.0.1','example.com'])for(const search of ['?profile=manual','?profile=manual&profile=1']){
  const result=setup(hostname,search);assert(result.loopProbe instanceof ManualLoopProbe);assert(result.renderProbe);
  assert.equal(result.submissionInstalls,1);assert(result.submissionProbe);
 }
});

test('local profile=1 exports existing loop diagnostics and stops on trusted W release without broader observers',async()=>{
 const setup=await productionProbeSetup(),oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1',search:'?profile=1&locationPerf=1'}});
 try{
  const f=fixture(true,(renderer,Probe)=>setup(location.hostname,location.search,renderer,Probe));
  assert.equal(f.configured.submissionInstalls,0);assert.equal(f.configured.renderProbe,undefined);
  f.renderer.setAnimationLoop(()=>{f.renderer.info.render.frame++;f.advance(10);f.profile.sample(.1,[1,2,3,4,5],20,200,2,3,1,0,2,'Bridge',true);});
  f.tick(80);assert.equal(f.clockCalls(),0);f.profile.start();f.tick(100);f.tick(120);
  f.emit('keyup',{code:'KeyW',isTrusted:false});f.emit('keyup',{code:'KeyS',isTrusted:true});assert.equal(f.profile.enabled,true);
  f.emit('keyup',{code:'KeyW',isTrusted:true});assert.equal(f.profile.enabled,false);
  const report=f.report(),loop=report.loopDiagnostics;
  assert.equal(report.stopReason,'trusted-W-keyup');assert.equal(report.frames,2);assert.equal(report.activeSeconds,.2);
  assert.equal(report.renderDiagnostics,undefined);assert.equal(report.submissionDiagnostics,undefined);
  assert.equal(report.submissionInstrumentation.atStart,null);assert.equal(report.submissionInstrumentation.atFinish,null);
  assert.equal(loop.status,'available');assert.equal(loop.completedCallbacks,2);assert.equal(loop.acceptedSamples,2);assert.equal(loop.invalidObservations,0);
  assert.deepEqual(loop.coverage.atStart,{installed:true,status:'installed'});assert.deepEqual(loop.coverage.atFinish,loop.coverage.atStart);
  assert.equal(loop.allCallbacks.scopes.gateReadyCpuMs.calls,2);assert.equal(loop.acceptedCallbacks.scopes.callbackBodyCpuMs.calls,2);
  assert.equal(loop.allCallbacks.scopes.fenceSyncCpuMs.calls,2);assert.equal(loop.allCallbacks.scopes.flushCpuMs.calls,2);
  const clockAtStop=f.clockCalls(),textAtStop=f.text();f.tick(140);assert.equal(f.clockCalls(),clockAtStop);assert.equal(f.text(),textAtStop);
 }finally{if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;}
});

test('production integration keeps the original phase endpoints and observes only existing callbacks',async()=>{
 const source=await readFile(new URL('./main.ts',import.meta.url),'utf8');
 assert.match(source,/const loopProbe=renderProbe\|\|localLoopProfile\?new ManualLoopProbe\(\):undefined/);
 const renderEnd=source.indexOf('const renderEnd=performance.now();'),finishSubmission=source.indexOf('const submissionFrame=submissionProbe?.finishFrame();',renderEnd);
 const hudEnd=source.indexOf('performance.now()-renderEnd',finishSubmission),profileCall=source.lastIndexOf('rideProfile?.sample(elapsed');
 assert(renderEnd>=0&&finishSubmission>renderEnd&&profileCall>finishSubmission&&hudEnd>profileCall);
 assert.match(source,/rideProfile\?\.sample\(elapsed,\[simEnd-cpuStart,presentationEnd-simEnd,worldEnd-presentationEnd,renderEnd-worldEnd,performance.now\(\)-renderEnd\]/);
});
