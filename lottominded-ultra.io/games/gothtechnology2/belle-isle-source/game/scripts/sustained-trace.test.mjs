import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import {execFileSync} from 'node:child_process';
import {ORIGINAL_HARNESS_BLOB,MARKER_PREFIX,gitBlob,sha256,buildInventory,generatedTimingReceipt,
 failExit,isGameUrl,traceSummary,diagnosticVerdict,writeBuildInputs,writeBuildReceipt,verifyBuildReceipt} from './sustained-trace-contract.mjs';
import {observeMethod,installSustainedTrace} from './sustained-trace-observer.mjs';

function fixture(){
 const source={head:'pinned-source',tree:'pinned-tree',harness:{gitBlob:ORIGINAL_HARNESS_BLOB},files:[]};
 const markers=[{label:'profile-start-click',atMs:1000},{label:'first-w-keydown',atMs:1100},{label:'w-keyup',atMs:91100}];
 const page={url:'http://127.0.0.1:1234/?profile=1&perfProbe=1',markers,errors:[],droppedMarkers:0};
 const trace={traceEvents:[
  ...['Browser','Renderer','GPU Process'].map((name,i)=>({ph:'M',name:'process_name',pid:i+1,args:{name}})),
  ...markers.map(m=>({name:MARKER_PREFIX+m.label,pid:2,tid:9,ts:1_000_000+m.atMs*1000,ph:'R'})),
  {ph:'X',name:'FunctionCall',pid:2,tid:9,ts:90_000_000,dur:466700}]};
 const cpu={nodes:[{id:1,callFrame:{functionName:'nativeWork',url:page.url+'assets/game.js',lineNumber:0,columnNumber:0}}],
  samples:[1],timeDeltas:[2000],startTime:1_500_000,endTime:92_500_000};
 const report={sourceHead:source.head,mode:'diagnostic',device:'phone',requestedSeconds:90,renderBackend:'angle-metal',
  actualGpu:{renderer:'ANGLE Metal Renderer: Apple'},passed:false,profile:{
   viewport:[390,844,1],settings:{quality:'smooth',effectiveQuality:'smooth',pixelRatio:1,adaptiveScale:1,cap:60,world:{performanceDiagnostic:true}},
   stopReason:'trusted-W-keyup',activeSeconds:90.1,over250ms:2,metrics:{frameMs:{p95:33.5}}}};
 return {source,page,trace,cpu,report,traceComplete:{dataLossOccurred:false,stream:'raw-stream'}};
}

test('original 90-second harness bytes and existing nonzero exits remain binding',async()=>{
 const bytes=await readFile(new URL('./sustained-ride-profile.mjs',import.meta.url));
 assert.equal(gitBlob(bytes),ORIGINAL_HARNESS_BLOB);
 assert.equal(failExit(undefined),1);assert.equal(failExit(0),1);assert.equal(failExit(23),23);
});

test('observers retain native receiver, argument identity, result, and exception',async()=>{
 const token={},value={},nativeFailure=Error('native failure'),observerFailure=Error('observer failure'),seen=[];
 const owner={async work(arg){assert.equal(this,owner);assert.equal(arg,token);seen.push('native');return value;}};
 const original=owner.work;
 const restore=observeMethod(owner,'work',{before:()=>{seen.push('before');throw observerFailure;},
  after:()=>{seen.push('after');throw observerFailure;},onError:error=>assert.equal(error,observerFailure)});
 assert.equal(await owner.work(token),value);assert.deepEqual(seen,['before','native','after']);restore();assert.equal(owner.work,original);
 owner.work=async()=>{throw nativeFailure;};observeMethod(owner,'work',{before:()=>{throw observerFailure;}});
 await assert.rejects(owner.work(),error=>error===nativeFailure);
 const restoreAgain=observeMethod(owner,'work');const replacement=()=>{};owner.work=replacement;restoreAgain();assert.equal(owner.work,replacement);
});

test('clock mapping binds native CPU samples to the real game renderer and ride bounds',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page);
 assert.deepEqual(summary.errors,[]);assert.equal(summary.gameRendererPid,2);assert.equal(summary.clockMapping.spreadUs,0);
 assert.equal(summary.browserProcesses.length,1);assert.equal(summary.gpuProcesses.length,1);assert.equal(summary.longEvents[0].dur,466700);
 const mutations=[
  x=>x.trace.traceEvents.pop()&&x.trace.traceEvents.pop(),
  x=>x.page.url='http://127.0.0.1:1234/?profile=manual&perfProbe=1',
  x=>x.page.markers[1].atMs+=20,
  x=>x.cpu.startTime=3_000_000,
  x=>x.cpu.endTime=90_000_000,
  x=>x.cpu.samples=[],
  x=>x.trace.traceEvents.find(e=>e.name===MARKER_PREFIX+'w-keyup').pid=3,
  x=>x.page.droppedMarkers=1,
 ];
 for(const mutate of mutations){const broken=fixture();mutate(broken);assert.ok(traceSummary(broken.trace,broken.cpu,broken.page).errors.length);}
 assert.equal(isGameUrl('https://example.com/?profile=1&perfProbe=1'),false);
});

test('trace collection preserves failed ride metrics and never qualifies release acceptance',()=>{
 const f=fixture(),summary=traceSummary(f.trace,f.cpu,f.page),verdict=diagnosticVerdict({...f,summary});
 assert.equal(verdict.collectionComplete,true);assert.equal(verdict.releaseAcceptance,false);assert.equal(verdict.originalHarnessPassed,false);
 assert.equal(verdict.originalP95Ms,33.5);assert.equal(verdict.originalIntervalsOver250ms,2);
 const mutations=[
  x=>x.source.harness.gitBlob='different',x=>x.report.sourceHead='old-head',x=>x.report.mode='full',
  x=>x.report.requestedSeconds=30,x=>x.report.actualGpu.renderer='SwiftShader',x=>x.report.profile.viewport[2]=2,
  x=>x.report.profile.settings.quality='high',x=>x.report.profile.settings.adaptiveScale=.5,
  x=>x.report.profile.settings.cap=30,x=>x.report.profile.settings.world.performanceDiagnostic=false,
  x=>x.report.profile.stopReason='timeout',x=>x.report.profile.activeSeconds=89.99,
  x=>x.traceComplete.dataLossOccurred=true,x=>delete x.traceComplete.dataLossOccurred,x=>delete x.traceComplete.stream,
 ];
 for(const mutate of mutations){const broken=fixture();mutate(broken);const result=diagnosticVerdict({...broken,summary});
  assert.equal(result.collectionComplete,false);assert.equal(result.releaseAcceptance,false);}
 assert.equal(diagnosticVerdict({...f,summary:null}).collectionComplete,false);
});

test('build inventory detects changed bytes and rejects symlinks; timing exception permits only buildMs',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-inventory-'));
 try{
  await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/game.js'),'original');
  const first=await buildInventory(root);await writeFile(resolve(root,'assets/game.js'),'changed');
  assert.notDeepEqual(await buildInventory(root),first);
  await symlink(resolve(root,'assets/game.js'),resolve(root,'linked.js'));await assert.rejects(buildInventory(root),/symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
 const before=Buffer.from('{"boxes":46034,"buildMs":1,"notes":["unchanged"]}');
 const after=Buffer.from('{"boxes":46034,"buildMs":2,"notes":["unchanged"]}');
 const receipt=generatedTimingReceipt(before,after);assert.equal(receipt.onlyBuildMsChanged,true);assert.equal(receipt.beforeSha256,sha256(before));
 assert.throws(()=>generatedTimingReceipt(before,Buffer.from('{"boxes":1,"buildMs":2,"notes":["unchanged"]}')),/beyond buildMs/);
 assert.throws(()=>generatedTimingReceipt(before,Buffer.from('{"boxes":46034,"notes":["unchanged"]}')),/timing/);
});

test('clean input pin survives generated timing noise and rejects changed source, head, or downloaded build',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'belle-trace-source-')),game=resolve(root,'app/game'),previousSha=process.env.GITHUB_SHA;
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const timing=Buffer.from('{"boxes":46034,"buildMs":1}');
 try{
  await mkdir(resolve(game,'scripts'),{recursive:true});await mkdir(resolve(root,'app/research'),{recursive:true});
  await writeFile(resolve(game,'scripts/sustained-ride-profile.mjs'),await readFile(new URL('./sustained-ride-profile.mjs',import.meta.url)));
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),timing);
  git(['init','-q']);git(['add','.']);git(['-c','user.name=Trace fixture','-c','user.email=trace@example.invalid','commit','-qm','Fixture','--no-gpg-sign']);
  await mkdir(resolve(game,'dist'));await writeFile(resolve(game,'dist/index.html'),'fixture');await writeFile(resolve(game,'dist/asset-manifest.json'),'[]');
  const pin=await writeBuildInputs(game);process.env.GITHUB_SHA=pin.head;
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),'{"boxes":46034,"buildMs":2}');
  const receipt=await writeBuildReceipt(game);assert.equal(receipt.generatedTiming.onlyBuildMsChanged,true);
  await assert.rejects(verifyBuildReceipt(game,receipt),/checkout must be clean/);
  await writeFile(resolve(root,'app/research/street-detail-stats.json'),timing);
  assert.equal((await verifyBuildReceipt(game,receipt)).head,pin.head);
  await writeFile(resolve(game,'dist/index.html'),'changed');await assert.rejects(verifyBuildReceipt(game,receipt),/mismatch: files/);
  await writeFile(resolve(game,'dist/index.html'),'fixture');process.env.GITHUB_SHA='wrong-sha';await assert.rejects(verifyBuildReceipt(game,receipt),/GITHUB_SHA/);
  process.env.GITHUB_SHA=pin.head;
  const changed=structuredClone(receipt);changed.generatedTiming.afterText='{"boxes":1,"buildMs":2}';
  await assert.rejects(verifyBuildReceipt(game,changed),/beyond buildMs/);
  await writeFile(resolve(game,'scripts/sustained-ride-profile.mjs'),'changed source');
  await assert.rejects(writeBuildInputs(game),/clean before/);await assert.rejects(verifyBuildReceipt(game,receipt),/checkout must be clean/);
 }finally{
  if(previousSha===undefined)delete process.env.GITHUB_SHA;else process.env.GITHUB_SHA=previousSha;
  await rm(root,{recursive:true,force:true});
 }
});

test('observer archives native CPU/timeline/consumed source and preserves an original failed report',async()=>{
 const f=fixture(),root=await mkdtemp(resolve(tmpdir(),'belle-trace-observer-')),output=resolve(root,'trace'),js=Buffer.from('function nativeWork() {}');
 f.source.files=[{file:'assets/game.js',bytes:js.length,sha256:sha256(js)}];
 let closed=0,failures=0;
 class BrowserSession extends EventEmitter{
  async send(method){
   if(method==='Tracing.getCategories')return {categories:['blink.user_timing','devtools.timeline','gpu']};
   if(method==='Tracing.end'){queueMicrotask(()=>this.emit('Tracing.tracingComplete',f.traceComplete));return {};}
   if(method==='IO.read')return {data:JSON.stringify(f.trace),eof:true};
   return {};
  }
 }
 const browserSession=new BrowserSession(),pageSession={send:async method=>{
  if(method==='Profiler.stop')return {profile:f.cpu};
  if(method==='Target.getTargetInfo')return {targetInfo:{type:'page',url:f.page.url,targetId:'actual-game'}};
  return {};
 }};
 class Page extends EventEmitter{
  isClosed(){return false;} async addInitScript(){} context(){return {newCDPSession:async()=>pageSession};}
  async evaluate(){return f.page;}
  async goto(){this.emit('response',{url:()=> 'http://127.0.0.1:1234/assets/game.js',status:()=>200,body:async()=>js});return null;}
 }
 const browser={newBrowserCDPSession:async()=>browserSession,newPage:async()=>new Page(),close:async()=>{closed++;}};
 const chromium={launch:async()=>browser};
 try{
  await mkdir(resolve(root,'output/sustained-profile/diagnostic/phone'),{recursive:true});
  const originalBytes=Buffer.from(JSON.stringify(f.report));await writeFile(resolve(root,'output/sustained-profile/diagnostic/phone/report.json'),originalBytes);
  await installSustainedTrace(chromium,{game:root,output,source:f.source,onFailure:()=>failures++});
  const launched=await chromium.launch({channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
  await launched.newPage();
  const page=await launched.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.goto(f.page.url,{waitUntil:'domcontentloaded'});await launched.close();
  const evidence=JSON.parse(await readFile(resolve(output,'trace-evidence.json'),'utf8'));
  assert.equal(failures,0);assert.equal(closed,1);assert.equal(evidence.verdict.collectionComplete,true);
  assert.equal(evidence.verdict.originalHarnessPassed,false);assert.equal(evidence.verdict.releaseAcceptance,false);
  assert.deepEqual(await readFile(resolve(output,'original-report.json')),originalBytes);
  assert.deepEqual(await readFile(resolve(output,evidence.scriptReceipts[0].file)),js);
  assert.deepEqual(JSON.parse(await readFile(resolve(output,'renderer.cpuprofile'),'utf8')),f.cpu);
  assert.deepEqual(JSON.parse(await readFile(resolve(output,'browser-trace.json'),'utf8')),f.trace);
 }finally{await rm(root,{recursive:true,force:true});}
});
