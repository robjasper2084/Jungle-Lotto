import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const requireThat=(v,m)=>{if(!v)throw new Error(m);};
export function executionGuard(m,binding){
 requireThat(m.executionBound===true,'Proof is UNBOUND; browser execution prohibited');
 for(const key of ['candidateCommit','candidateTree'])requireThat(/^[a-f0-9]{40}$/.test(m.source[key]),`Unbound ${key}`);
 for(const key of ['bundleSha256','sourceReceiptSha256'])requireThat(/^[a-f0-9]{64}$/.test(m.build[key]),`Unbound ${key}`);
 requireThat(binding&&/^[a-f0-9]{40}$/.test(binding.proofHead)&&/^\d+$/.test(String(binding.runId))&&binding.attempt===1,'Unbound workflow identity/attempt');
 requireThat(m.publication.mode==='verified-github-context','Proof publication remains UNBOUND');
 requireThat(m.proofFiles.length>=7,'Proof source allowlist missing');
 requireThat(binding.manifestSha256===hash(fs.readFileSync(path.join(here,'manifest.json'))),'Manifest external binding mismatch');
}
export function byteDiff(a,b){requireThat(a.length===b.length,'Raw size mismatch');let changed=0,max=0,pixels=0;for(let i=0;i<a.length;i+=4){let any=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);if(d){changed++;any=true;max=Math.max(max,d);}}if(any)pixels++;}return {changedBytes:changed,changedPixels:pixels,maxDifference:max};}
// Monotonic ownership: a caller supplies a thunk so an expired budget cannot
// start a protocol operation with Playwright's special unbounded timeout=0.
export class DeadlineBudget {
 constructor(bounds,start=performance.now(),now=()=>performance.now()){this.now=now;this.start=start;this.absolute=start+bounds.absoluteMs;this.work=start+bounds.workMs;}
 remaining(until=this.work){return Math.max(0,until-this.now());}
 elapsed(){return this.now()-this.start;}
 async call(label,operation,{until=this.work,limit=Infinity}={}){
  const end=Math.min(until,this.now()+limit);requireThat(this.remaining(end)>0,label+' deadline reached before start');
  let timer;
  try{
   const value=await Promise.race([Promise.resolve().then(()=>{const ms=this.remaining(end);requireThat(ms>0,label+' deadline reached before invocation');return operation(ms);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' deadline')),this.remaining(end));})]);
   requireThat(this.remaining(end)>0,label+' completed after deadline');return value;
  }finally{clearTimeout(timer);}
 }
}
export async function closeOwnedBrowser(server,time,cleanupEnd,onFailure){
 let acknowledged=false,forcedKillIssued=false;
 const stop=async()=>{
  forcedKillIssued=true;
  // A stop signal is issued even if its acknowledgement budget has expired.
  // The result then remains partial; expiry never leaves a deliberate live owner.
  let stopping;try{stopping=server.kill();}catch(e){onFailure(e);return;}
  stopping.catch(e=>onFailure(e));
  try{await time.call('Owned browser kill',()=>stopping,{until:cleanupEnd});}catch(e){onFailure(e);}
 };
 try{
  // Reserve the final second of the same ten-second cleanup for force-stop.
  await time.call('Owned browser close',()=>server.close(),{until:Math.max(time.now(),cleanupEnd-1000)});
  const proc=server.process();requireThat(proc&&(proc.exitCode!==null||proc.signalCode!==null),'Browser close did not confirm process exit');acknowledged=true;
 }catch(e){onFailure(e);await stop();}
 return {acknowledged,forcedKillIssued};
}
export class EvidenceBudget {
 constructor(bounds){this.bounds=bounds;this.regularBytes=0;this.ancillaryBytes=0;this.pngBytes=0;this.slots={'capture-status.json':bounds.reservedStatusBytes,'terminal-error.json':bounds.reservedFailureBytes,'audit.json':bounds.reservedAuditBytes};this.reserve=Object.values(this.slots).reduce((a,b)=>a+b,0);requireThat(this.reserve<bounds.ancillaryBytes&&this.reserve<bounds.outputBytes,'Invalid reserved output budget');}
 admit(length,kind){
  requireThat(Number.isSafeInteger(length)&&length>=0,'Invalid output length');
  requireThat(this.regularBytes+length+this.reserve<=this.bounds.outputBytes,'Output cap including reserved reports');
  if(kind!=='raw')requireThat(this.ancillaryBytes+length+this.reserve<=this.bounds.ancillaryBytes,'Ancillary cap including reserved reports');
  if(kind==='png')requireThat(this.pngBytes+length<=this.bounds.pngBytes,'Native screenshot byte cap');
  // Charge before I/O, including the largest possible partial write on failure.
  this.regularBytes+=length;if(kind!=='raw')this.ancillaryBytes+=length;if(kind==='png')this.pngBytes+=length;
 }
 terminal(name,length){requireThat(Object.hasOwn(this.slots,name)&&length<=this.slots[name],'Reserved report slot exceeded');requireThat(this.regularBytes+this.reserve<=this.bounds.outputBytes&&this.ancillaryBytes+this.reserve<=this.bounds.ancillaryBytes,'Reserved report accounting exceeded');}
 receipt(){return {regularEvidenceBytes:this.regularBytes,regularAncillaryBytes:this.ancillaryBytes,pngBytes:this.pngBytes,reservedSlots:{...this.slots},reservedBytes:this.reserve};}
}
export class IssueLedger {
 constructor(){this.errors=[];this.state={observed:0,storedBytes:0,truncated:0,overflow:false};this.network={observed:0,storedBytes:0,overflow:false,allowed:{html:0,script:0,favicon:0},rows:[]};}
 fail(value){const full=String(value),message=full.slice(0,2048),bytes=Buffer.byteLength(JSON.stringify(message));this.state.observed=Math.min(Number.MAX_SAFE_INTEGER,this.state.observed+1);if(full.length>message.length)this.state.truncated++;if(this.errors.length<64&&this.state.storedBytes+bytes<=65536){this.errors.push(message);this.state.storedBytes+=bytes;}else this.state.overflow=true;}
 networkFailure(kind,url='',detail=''){const row={kind:String(kind).slice(0,80),url:String(url).slice(0,2048),detail:String(detail).slice(0,512)},bytes=Buffer.byteLength(JSON.stringify(row));this.network.observed=Math.min(Number.MAX_SAFE_INTEGER,this.network.observed+1);if(this.network.rows.length<128&&this.network.storedBytes+bytes<=131072){this.network.rows.push(row);this.network.storedBytes+=bytes;}else this.network.overflow=true;this.fail(kind+': '+url+' '+detail);}
}
export function classifyRequest(url,origin,method,pairs,resourceType=null){
 try{
  if(method!=='GET')return null;const u=new URL(url);if(u.origin!==origin||u.hash)return null;
  if(u.pathname==='/fixture.js'&&!u.search&&(!resourceType||resourceType==='script'))return 'script';
  if(u.pathname==='/favicon.ico'&&!u.search&&(!resourceType||resourceType==='other'||resourceType==='image'))return 'favicon';
  if(u.pathname!=='/fixture.html'||(resourceType&&resourceType!=='document'))return null;
  if(!u.search)return 'html';const side=u.searchParams.get('side'),pair=u.searchParams.get('pair');
  return ['original','candidate','control'].includes(side)&&pairs.includes(pair)&&(side!=='control'||pair==='p1')&&u.search==='?side='+side+'&pair='+pair?'html':null;
 }catch{return null;}
}
export function validateBrowserVersion(version,lane,policies){
 const policy=policies[lane],revision=version?.revision?.replace(/^@/,'');
 requireThat(policy&&version.product===policy.product,'Browser product/lane mismatch');
 requireThat(/^[a-f0-9]{40}$/.test(revision||''),'Missing/malformed browser revision');
 requireThat(['exact-retained','observe-first-capture'].includes(policy.revisionPolicy),'Unknown revision policy');
 if(policy.revisionPolicy==='exact-retained')requireThat(revision===policy.revision,'Browser retained revision mismatch');
 else requireThat(policy.revision===null,'Unverified software revision must not be prefilled');
 return {policy:policy.revisionPolicy,revision,previouslyVerified:policy.revisionPolicy==='exact-retained',sameBrowserForBothSources:true};
}
export async function run(){
 const start=performance.now(),startedAt=Date.now();
 const m=JSON.parse(fs.readFileSync(path.join(here,'manifest.json'),'utf8'));
 const time=new DeadlineBudget(m.bounds,start);
 const binding=JSON.parse(fs.readFileSync(process.env.MINIMAP_BINDING||'UNBOUND','utf8'));
 executionGuard(m,binding);
 const lane=process.env.MINIMAP_LANE;requireThat(m.runtime.lanes.includes(lane),'Unexpected renderer lane');
 const original=path.resolve(process.env.MINIMAP_ORIGINAL||'UNBOUND'),candidate=path.resolve(process.env.MINIMAP_CANDIDATE||'UNBOUND');
 const compiled=path.resolve(process.env.MINIMAP_COMPILED||'UNBOUND'),out=path.resolve(process.env.MINIMAP_OUTPUT||'UNBOUND');
 const game='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/';
 const preflightTimeout=()=>{const ms=Math.min(10000,time.remaining());requireThat(ms>0,'Source preflight deadline');return Math.max(1,Math.ceil(ms));};
 const git=(root,args)=>{const value=execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:preflightTimeout(),maxBuffer:2*1024*1024}).trim();requireThat(time.remaining()>0,'Source preflight completed late');return value;};
 requireThat(git(original,['rev-parse','HEAD'])===m.source.originalCommit,'Original checkout mismatch');
 requireThat(git(original,['rev-parse','HEAD^{tree}'])===m.source.originalTree,'Original tree mismatch');
 requireThat(git(candidate,['rev-parse','HEAD'])===m.source.candidateCommit,'Candidate checkout mismatch');
 requireThat(git(candidate,['rev-parse','HEAD^{tree}'])===m.source.candidateTree,'Candidate tree mismatch');
 requireThat(git(candidate,['show','-s','--format=%P','HEAD'])===m.source.candidateParent,'Candidate parent mismatch');
 const changed=git(candidate,['diff','--name-only',m.source.candidateParent,'HEAD']).split('\n').sort();
 requireThat(JSON.stringify(changed)===JSON.stringify(m.source.candidateFiles.map(x=>x.path).sort()),'Candidate overlay scope changed');
 const proofRoot=git(here,['rev-parse','--show-toplevel']);requireThat(git(proofRoot,['rev-parse','HEAD'])===binding.proofHead,'Proof checkout mismatch');
 requireThat(git(proofRoot,['show','-s','--format=%P','HEAD'])===m.publication.base,'Proof publication parent mismatch');
 const proofDelta=git(proofRoot,['diff','--name-only',m.publication.base,'HEAD']).split('\n').sort();
 requireThat(JSON.stringify(proofDelta)===JSON.stringify([...m.proofFiles.map(r=>r.path),'.github/probes/minimap-foreground/manifest.json'].sort()),'Proof publication scope changed');
 const committedManifest=execFileSync('git',['-C',proofRoot,'show','HEAD:.github/probes/minimap-foreground/manifest.json'],{timeout:preflightTimeout(),maxBuffer:2*1024*1024});
 requireThat(hash(committedManifest)===binding.manifestSha256,'Manifest differs from immutable proof checkout');
 for(const r of m.proofFiles){const b=fs.readFileSync(path.join(proofRoot,r.path));requireThat(b.length===r.bytes&&hash(b)===r.sha256,'Proof source pin mismatch '+r.path);}
 const compiledBytes=fs.readFileSync(path.join(compiled,'fixture.js')),sourceReceiptBytes=fs.readFileSync(path.join(compiled,'source-receipt.json'));
 requireThat(hash(compiledBytes)===m.build.bundleSha256&&hash(sourceReceiptBytes)===m.build.sourceReceiptSha256,'Compiled source identity mismatch');
 const sourceReceipt=JSON.parse(sourceReceiptBytes);
 // Independent runtime reread of each exact input after compilation.
 for(const r of sourceReceipt.inputs){const b=fs.readFileSync(path.join(r.side==='original'?original:candidate,r.path));requireThat(b.length===r.bytes&&hash(b)===r.sha256,'Source changed after compile '+r.path);}
 const runtimeRoot=path.join(original,'lottominded-ultra.io/games/gothtechnology2'),req=createRequire(path.join(runtimeRoot,'package.json'));
 requireThat(req('playwright/package.json').version===m.runtime.playwright,'Playwright drift');
 requireThat(Number(process.versions.node.split('.')[0])===m.runtime.nodeMajor,'Node major drift');
 const {chromium}=req('playwright');
 requireThat(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Output directory must be new/empty');fs.mkdirSync(out,{recursive:true});
 const deadline=time.absolute,workDeadline=time.work,budget=new EvidenceBudget(m.bounds),issues=new IssueLedger();
 let aborted=false,closing=false,server,browser,webServer,watchdog,launchPending=null,lateKill=null;
 const errors=issues.errors,files=[],checks=[],compositions=[];
 const fail=value=>{aborted=true;issues.fail(value);};
 const networkFailure=(kind,url,detail)=>{aborted=true;issues.networkFailure(kind,url,detail);};
 const status={schema:'minimap-browser-proof-capture-v2',lane,binding,manifestSha256:hash(fs.readFileSync(path.join(here,'manifest.json'))),startedAt,finishedAt:null,clock:'node-performance-monotonic',captureComplete:false,partial:true,errors,errorReceipts:issues.state,network:issues.network,sourceReceiptSha256:hash(sourceReceiptBytes),bundleSha256:hash(compiledBytes),cleanup:{acknowledged:false,processExited:false,lateCreation:false},runtime:null,checkpoints:checks,compositions,files,outputBytes:0,summary:null};
 const remaining=(until=workDeadline)=>time.remaining(until);
 function write(name,bytes,kind='metadata'){
  const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);requireThat(/^[a-z0-9][a-z0-9_.-]*$/.test(name)&&!Object.hasOwn(budget.slots,name),'Unsafe/reserved output name');
  requireThat(!aborted&&remaining(deadline)>0,'Late evidence write');budget.admit(b.length,kind);
  fs.writeFileSync(path.join(out,name),b,{flag:'wx'});
  const receipt={name,bytes:b.length,sha256:hash(b),kind};files.push(receipt);requireThat(remaining(deadline)>0,'Evidence persistence crossed absolute deadline');return receipt;
 }
 function persist(){
  status.outputBytes=budget.regularBytes;status.budget=budget.receipt();const b=Buffer.from(JSON.stringify(status,null,2)+'\n');
  budget.terminal('capture-status.json',b.length);fs.writeFileSync(path.join(out,'capture-status.json'),b);
 }
 function terminalFailure(error){
  status.captureComplete=false;status.partial=true;fail(error);
  const b=Buffer.from(JSON.stringify({captureComplete:false,partial:true,error:(errors[0]||'Terminal persistence failed').slice(0,512),errorsObserved:issues.state.observed,budget:budget.receipt()})+'\n');
  budget.terminal('terminal-error.json',b.length);fs.writeFileSync(path.join(out,'terminal-error.json'),b);
 }
 try{
  write('manifest.json',fs.readFileSync(path.join(here,'manifest.json')));write('schedule.json',fs.readFileSync(path.join(here,'schedule.json')));write('tapes.json',fs.readFileSync(path.join(here,'tapes.json')));write('source-receipt.json',sourceReceiptBytes);write('fixture.js',compiledBytes);write('runtime-binding.json',JSON.stringify(binding));
  const html=Buffer.from('<!doctype html><meta charset="utf-8"><script defer src="/fixture.js"></script>');
  const schedule=JSON.parse(fs.readFileSync(path.join(here,'schedule.json'),'utf8'));
  const pairs=[...new Set(schedule.checkpoints.map(s=>s.pair).filter(p=>p!=='saved-p1'))];let origin=null;
  webServer=http.createServer((request,response)=>{
   const absolute=origin?new URL(request.url,origin).href:'',kind=origin?classifyRequest(absolute,origin,request.method,pairs):null;
   response.setHeader('Cache-Control','no-store');
   if(kind==='script'){response.setHeader('Content-Type','text/javascript; charset=utf-8');response.end(compiledBytes);}
   else if(kind==='html'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);}
   else if(kind==='favicon'){response.statusCode=204;response.end();}
   else{networkFailure('unexpected-server-request',absolute,request.method);response.statusCode=404;response.end();}
  });
  webServer.on('error',e=>fail('Local server error: '+e.message));
  webServer.on('clientError',(e,socket)=>{networkFailure('server-client-error','',e.message);socket.destroy();});
  await time.call('Fixture server',()=>new Promise((resolve,reject)=>{webServer.once('error',reject);webServer.listen(0,'127.0.0.1',resolve);}),{limit:2000});
  origin='http://127.0.0.1:'+webServer.address().port;
  const args=lane==='metal'?['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'];
  await time.call('Launch owned browser',ms=>{
   requireThat(ms>0,'Positive launch timeout required');
   launchPending=chromium.launchServer({channel:'chrome',headless:false,args,timeout:ms}).then(s=>{
    server=s;
    if(closing||aborted||remaining()<=0){status.cleanup.lateCreation=true;status.cleanup.forcedKillIssued=true;fail('Browser server resolved after its ownership window');lateKill=s.kill().catch(e=>fail('Late owned browser kill: '+e.message));}
    return s;
   });return launchPending;
  },{limit:m.bounds.launchMs});
  const proc=server.process();requireThat(proc?.pid,'Missing owned browser process');
  browser=await time.call('Connect browser',()=>chromium.connect(server.wsEndpoint()),{limit:4000});
  browser.on('disconnected',()=>{if(!closing)fail('Unexpected browser disconnect');});
  requireThat(remaining()>0,'Work deadline reached before watchdog');
  watchdog=setTimeout(()=>{fail('Absolute work deadline');if(server&&!lateKill){status.cleanup.forcedKillIssued=true;lateKill=server.kill().catch(e=>fail('Watchdog owned kill: '+e.message));}},remaining());
  const context=await time.call('Create context',()=>browser.newContext({viewport:m.runtime.viewport,deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:'light'}));
  context.on('request',request=>{const kind=classifyRequest(request.url(),origin,request.method(),pairs,request.resourceType());if(!kind)networkFailure('unexpected-request',request.url(),request.method()+' '+request.resourceType());else issues.network.allowed[kind]=Math.min(Number.MAX_SAFE_INTEGER,issues.network.allowed[kind]+1);});
  context.on('requestfailed',request=>networkFailure('request-failed',request.url(),request.failure()?.errorText||'unknown request error'));
  context.on('response',response=>{const request=response.request(),kind=classifyRequest(request.url(),origin,request.method(),pairs,request.resourceType()),expected=kind==='favicon'?204:200;if(!kind||response.status()!==expected)networkFailure('unexpected-response',response.url(),String(response.status()));});
  await time.call('Install fixed local routes',()=>context.route('**/*',async route=>{
   try{const r=route.request(),kind=classifyRequest(r.url(),origin,r.method(),pairs,r.resourceType());if(!kind){networkFailure('blocked-request',r.url(),r.method());await time.call('Abort unexpected route',()=>route.abort());}else await time.call('Continue fixed local route',()=>route.continue());}
   catch(e){networkFailure('route-error',route.request().url(),e.message);}
  }));
  const page=await time.call('Create fixture page',()=>context.newPage());
  page.on('pageerror',error=>fail('Uncaught fixture: '+error.message));
  page.on('console',message=>{if(message.type()==='error')fail('Browser console error: '+message.text());});
  const cdp=await time.call('Create browser identity session',()=>browser.newBrowserCDPSession());
  const version=await time.call('Read browser identity',()=>cdp.send('Browser.getVersion'));
  status.runtime={version,revisionBinding:null,renderer:null,node:process.versions.node,playwright:m.runtime.playwright,os:process.platform,args,ownedPid:proc.pid,canvasStorageBackendAttested:false};
  await time.call('Detach browser identity session',()=>cdp.detach());
  const revisionBinding=validateBrowserVersion(version,lane,m.runtime.browserLanes);status.runtime.revisionBinding=revisionBinding;
  await time.call('Load fixture',ms=>page.goto(origin+'/fixture.html',{timeout:ms,waitUntil:'load'}),{limit:10000});
  const renderer=await time.call('Read renderer identity',()=>page.evaluate(()=>{const c=document.createElement('canvas'),gl=c.getContext('webgl2');if(!gl)throw new Error('WebGL attestation unavailable');const ext=gl.getExtension('WEBGL_debug_renderer_info');if(!ext)throw new Error('Renderer receipt unavailable');const result={vendor:gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};gl.getExtension('WEBGL_lose_context')?.loseContext();return result;}));
  requireThat(lane==='metal'?/Metal/.test(renderer.renderer)&&!/SwiftShader|llvmpipe/i.test(renderer.renderer):/SwiftShader/i.test(renderer.renderer),'Backend lane mismatch');
  status.runtime={version,revisionBinding,renderer,node:process.versions.node,playwright:m.runtime.playwright,os:process.platform,args,ownedPid:proc.pid,canvasStorageBackendAttested:false};
  for(const group of schedule.groups){
   const caseStart=performance.now(),caseDeadline=Math.min(workDeadline,caseStart+m.bounds.caseMs);
   const action=(fn,arg,label)=>time.call(group+': '+label,()=>page.evaluate(fn,arg),{until:caseDeadline});
   await action(g=>window.proof.start(g),group,'start');
   while(true){
    requireThat(!aborted&&!errors.length,'Earlier asynchronous failure');
    const next=await action(()=>window.proof.next(),undefined,'next');if(next.done)break;
    let composition=null;
    if(next.composition){
     composition=await action(()=>window.proof.composition(),undefined,'composition preparation');
     requireThat(composition.dpr===1&&composition.noPriorReadbacks&&composition.priorReadbacks.every(n=>n===0),'Composition first-read contract');
     const png=await time.call('Native screenshot',ms=>page.screenshot({type:'png',fullPage:false,timeout:ms}),{until:caseDeadline});
     const f=write(next.id+'.png',png,'png');composition.file=f;compositions.push(composition);
     await action(()=>window.proof.screenshotRecorded(),undefined,'screenshot receipt');
    }
    const checkpoint=await action(()=>window.proof.read(),undefined,'raw readback');
    const spec=schedule.checkpoints[checks.length];requireThat(spec?.id===checkpoint.id,'Checkpoint order changed');
    const a=Buffer.from(checkpoint.values[0].data,'base64'),b=Buffer.from(checkpoint.values[1].data,'base64');
    requireThat(a.length===m.bounds.rawBytesPerCanvas&&b.length===a.length,'Raw byte size mismatch');
    if(checkpoint.id==='n1-byte-mutant')b[0]^=1;
    const originalFile=write(checkpoint.id+'.original.rgba',a,'raw'),candidateFile=write(checkpoint.id+'.candidate.rgba',b,'raw');
    checkpoint.values.forEach(v=>delete v.data);
    checkpoint.originalFile=originalFile;checkpoint.candidateFile=candidateFile;checkpoint.rawDiff=byteDiff(a,b);checkpoint.stateEqual=JSON.stringify(checkpoint.values[0].state)===JSON.stringify(checkpoint.values[1].state);checkpoint.caseElapsedMs=performance.now()-caseStart;
    requireThat(checkpoint.caseElapsedMs<m.bounds.caseMs&&remaining()>0,'Late checkpoint');
    const receipt=write(checkpoint.id+'.json',JSON.stringify(checkpoint,null,2)+'\n');checks.push({id:checkpoint.id,receipt,rawDiff:checkpoint.rawDiff,stateEqual:checkpoint.stateEqual,caseElapsedMs:checkpoint.caseElapsedMs});persist();
   }
  }
  status.summary=await time.call('Fixed proof finish',()=>page.evaluate(()=>window.proof.finish()));
  requireThat(checks.length===m.bounds.actualPairedRawCheckpoints&&compositions.length===m.bounds.compositionCheckpoints,'Incomplete fixed evidence set');
 }catch(error){fail(error.stack||error);}
 finally{
  clearTimeout(watchdog);closing=true;const cleanupStart=performance.now(),cleanupEnd=Math.min(deadline,cleanupStart+m.bounds.cleanupMs);
  try{
   // A timed-out launch still has one owner. Observe its settlement within the
   // same cleanup window; its late-creation handler immediately kills any server.
   if(!server&&launchPending)await time.call('Settle pending launch',()=>launchPending,{until:cleanupEnd});
   if(lateKill)await time.call('Settle owned forced kill',()=>lateKill,{until:cleanupEnd});
   if(server&&!status.cleanup.lateCreation){const result=await closeOwnedBrowser(server,time,cleanupEnd,e=>fail(e.message||e));Object.assign(status.cleanup,result);}
  }catch(error){fail(error.message||error);if(server&&!lateKill){try{status.cleanup.forcedKillIssued=true;lateKill=server.kill().catch(e=>fail(e.message||e));await time.call('Settle cleanup forced kill',()=>lateKill,{until:cleanupEnd});}catch(e){fail(e.message||e);}}}
  const proc=server?.process();status.cleanup.processExited=!!proc&&(proc.exitCode!==null||proc.signalCode!==null);status.cleanup.elapsedMs=performance.now()-cleanupStart;
  if(!status.cleanup.acknowledged||!status.cleanup.processExited||status.cleanup.lateCreation)fail('Owned browser cleanup unconfirmed or late');
  try{if(webServer)await time.call('Local server close',()=>new Promise(resolve=>{webServer.close(resolve);webServer.closeAllConnections();}),{until:cleanupEnd});}catch(error){fail(error.message||error);}
  status.cleanup.elapsedMs=performance.now()-cleanupStart;
  status.finishedAt=Date.now();status.elapsedMs=time.elapsed();
  if(status.elapsedMs>=m.bounds.absoluteMs||status.cleanup.elapsedMs>m.bounds.cleanupMs)fail('Absolute driver/cleanup budget exceeded');
  status.captureComplete=!aborted&&issues.state.observed===0&&!issues.state.overflow&&issues.network.observed===0&&!issues.network.overflow&&status.summary!==null;status.partial=!status.captureComplete;
  try{persist();if(remaining(deadline)<=0){status.captureComplete=false;status.partial=true;fail('Terminal persistence crossed absolute deadline');persist();}}
  catch(error){try{terminalFailure(error);}catch(finalError){status.captureComplete=false;status.partial=true;fail('Reserved terminal receipt failed: '+finalError.message);}}
 }
 console.log('MINIMAP_CAPTURE_JSON='+JSON.stringify({lane,captureComplete:status.captureComplete,partial:status.partial,checkpoints:checks.length,compositions:compositions.length,elapsedMs:status.elapsedMs,cleanup:status.cleanup,errors}));
 process.exitCode=status.captureComplete?0:1;return status;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await run();
