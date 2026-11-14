import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createCoopStaticServer} from './coop-static-server.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fresh='no-cache, max-age=0, must-revalidate';
async function fixture(t){
 const parent=await mkdtemp(join(tmpdir(),'belle-coop-static-')),root=join(parent,'dist');
 await mkdir(root);await writeFile(join(root,'index.html'),'<title>Co-op static server regression</title>');
 const server=createCoopStaticServer(root);
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 t.after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));await rm(parent,{recursive:true,force:true});});
 return {root,parent,port:server.address().port};
}
function get(port,path,options={}){
 return new Promise((ok,no)=>{
  const req=request({hostname:'127.0.0.1',port,path,method:options.method||'GET',headers:options.headers},res=>{
   const chunks=[];
   res.on('data',chunk=>{chunks.push(chunk);if(options.cancel)req.destroy(new Error('Deliberate client cancellation'));});
   res.on('aborted',()=>no(new Error('Response aborted')));res.on('error',no);
   res.on('end',()=>{
    if(!res.complete)return no(new Error('Incomplete HTTP response'));
    ok({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks),chunks:chunks.length,complete:res.complete});
   });
  });
  req.on('error',no);req.end();
 });
}

test('co-op static HTML keeps real bytes and mandatory per-request freshness',async t=>{
 const {port}=await fixture(t),response=await get(port,'/?profile=1');
 assert.equal(response.status,200);assert.equal(response.headers['content-type'],'text/html');
 assert.equal(response.headers['cache-control'],fresh);
 assert.equal(Number(response.headers['content-length']),response.bytes.length);
 assert.equal(response.bytes.toString(),'<title>Co-op static server regression</title>');
});

test('multi-chunk GLB stream reaches complete HTTP EOF without rewriting its bytes',async t=>{
 const {root,port}=await fixture(t),bytes=Buffer.alloc(1024*1024+37);
 for(let i=0;i<bytes.length;i++)bytes[i]=(i*17+29)%256;
 await writeFile(join(root,'model.glb'),bytes);
 const response=await get(port,'/model.glb');
 assert.equal(response.status,200);assert.equal(response.headers['content-type'],'model/gltf-binary');
 assert.equal(response.headers['cache-control'],fresh);assert.equal(response.complete,true);
 assert.ok(response.chunks>1,'Exercise a streamed response, not a single small write.');
 assert.equal(Number(response.headers['content-length']),bytes.length);
 assert.equal(response.bytes.length,bytes.length);assert.equal(hash(response.bytes),hash(bytes));
});

test('unchanged URL returns changed source bytes even with conditional request headers',async t=>{
 const {root,port}=await fixture(t),file=join(root,'model.glb');
 await writeFile(file,'version-a');const first=await get(port,'/model.glb');
 await writeFile(file,'version-b');
 const second=await get(port,'/model.glb',{headers:{'if-none-match':'"old-build"','if-modified-since':'Wed, 01 Jan 2100 00:00:00 GMT'}});
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal(second.headers['cache-control'],fresh);assert.equal(first.bytes.toString(),'version-a');
 assert.equal(second.bytes.toString(),'version-b');assert.notEqual(hash(first.bytes),hash(second.bytes));
});

test('HEAD preserves declared asset length without sending a body',async t=>{
 const {root,port}=await fixture(t);await writeFile(join(root,'model.glb'),'fixture-body');
 const response=await get(port,'/model.glb',{method:'HEAD'});
 assert.equal(response.status,200);assert.equal(response.headers['cache-control'],fresh);
 assert.equal(Number(response.headers['content-length']),12);assert.equal(response.bytes.length,0);
});

test('query-bearing cherry URL resolves the original file and retains fresh streaming policy',async t=>{
 const {root,port}=await fixture(t);await mkdir(join(root,'belle/nature'),{recursive:true});
 await writeFile(join(root,'belle/nature/cherry.glb'),'original-cherry-bytes');
 const response=await get(port,'/belle/nature/cherry.glb?v=blossom-20261110');
 assert.equal(response.status,200);assert.equal(response.headers['cache-control'],fresh);
 assert.equal(response.bytes.toString(),'original-cherry-bytes');
});

test('missing assets stay 404 instead of a successful HTML or empty replacement',async t=>{
 const {port}=await fixture(t);
 for(const path of ['/belle/waterfront-detail.glb','/belle/birds/pigeon.glb']){
  const response=await get(port,path);assert.equal(response.status,404);assert.equal(response.bytes.length,0);
 }
 assert.equal((await get(port,'/favicon.ico')).status,204);
});

test('malformed and encoded escaping paths cannot read outside the public build',async t=>{
 const {parent,port}=await fixture(t);await writeFile(join(parent,'outside.glb'),'must-not-be-served');
 for(const path of ['/%2e%2e%2foutside.glb','/%ZZ']){
  const response=await get(port,path);assert.equal(response.status,404);assert.equal(response.bytes.length,0);
 }
});

test('actual client cancellation remains a failure and cannot corrupt the next transfer',async t=>{
 const {root,port}=await fixture(t),bytes=Buffer.alloc(1024*1024,73);
 await writeFile(join(root,'model.glb'),bytes);
 await assert.rejects(get(port,'/model.glb',{cancel:true}),/cancellation|aborted/);
 const response=await get(port,'/model.glb');
 assert.equal(response.status,200);assert.equal(response.complete,true);assert.equal(hash(response.bytes),hash(bytes));
});

// Additive evidence regressions; all original HTTP tests above are retained.
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {recordRequestFailure,waitForBeachFrame,prepareBeachWaterline} from './visual-review-evidence.mjs';

test('aborted, ordinary and cleanup requests are all fatal and retain diagnostic phase',()=>{
 for(const phase of ['gameplay','cleanup'])for(const errorText of ['net::ERR_ABORTED','net::ERR_FAILED']){
  const entry={errors:[],failedRequests:[]};
  const message=recordRequestFailure(entry,{failure:()=>({errorText}),url:()=>'/real-model.glb',resourceType:()=> 'fetch'},phase);
  assert.deepEqual(entry.errors,[message]);assert.deepEqual(entry.failedRequests,[message]);
  assert.equal(entry.requestFailureDetails[0].phase,phase);
  assert.equal(entry.requestFailureDetails[0].errorText,errorText);
  assert.ok(Number.isFinite(Date.parse(entry.requestFailureDetails[0].at)));
 }
});

function beachFrameFixture(options={}){
 const state={place:'Belle Isle Beach',mode:'ON FOOT',firstPerson:true,visible:true,modal:false,lost:false,...options};
 let clock=100,next=0,deletes=0,flushes=0;const timers=new Map(),paints=new Map(),waits=[];
 const results=[...(options.results||[2])];
 const gl={SYNC_GPU_COMMANDS_COMPLETE:8,TIMEOUT_EXPIRED:1,CONDITION_SATISFIED:2,ALREADY_SIGNALED:3,WAIT_FAILED:4,
  isContextLost:()=>state.lost,fenceSync:()=>options.noFence?null:{owned:true},
  flush:()=>{flushes++;},deleteSync:()=>{deletes++;if(options.cleanupError)throw Error('cleanup failure');},
  clientWaitSync:(_sync,flags,timeout)=>{waits.push({flags,timeout});return results.length>1?results.shift():results[0];}};
 const canvas={width:1440,height:960,getContext:()=>options.noContext?null:gl};
 const sandbox={canvas,innerWidth:1440,innerHeight:960,performance:{now:()=>clock},
  setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++next;paints.set(id,fn);return id;},cancelAnimationFrame:id=>paints.delete(id),
  document:{get visibilityState(){return state.visible?'visible':'hidden';},body:{classList:{contains:name=>state[name]===true}},
   querySelector:selector=>selector==='dialog[open]'?(state.modal?{}:null):selector==='#place'?{textContent:state.place}:
    selector==='#ride-mode'?{textContent:state.mode}:{getAttribute:()=>String(state.firstPerson)}}};
 const start=()=>runInNewContext(`(${waitForBeachFrame.toString()})(canvas)`,sandbox);
 const timer=()=>{const [id,item]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0]||[];assert.ok(item);timers.delete(id);clock=item.at;item.fn();};
 const paint=()=>{const [id,fn]=[...paints][0]||[];assert.ok(fn);paints.delete(id);clock+=16;fn();};
 return {state,start,timer,paint,timers,paints,waits,get deletes(){return deletes;},get flushes(){return flushes;}};
}

test('serialized beach evidence waits for GPU completion and two real paint opportunities',async()=>{
 const f=beachFrameFixture({results:[1,2]}),promise=f.start();
 assert.equal(f.paints.size,0);f.timer();assert.equal(f.paints.size,1);
 f.paint();assert.equal(f.deletes,0);f.paint();const result=await promise;
 assert.equal(result.place,'Belle Isle Beach');assert.equal(result.mode,'ON FOOT');assert.equal(result.firstPerson,true);
 assert.equal(result.paintOpportunities,2);assert.ok(result.gpuCompletedAt>=result.gpuSubmittedAt);
 assert.ok(f.waits.every(w=>w.flags===0&&w.timeout===0));assert.equal(f.flushes,1);assert.equal(f.deletes,1);
 assert.equal(f.timers.size,0);assert.equal(f.paints.size,0);
});

test('wrong destination, riding, hidden page or open dialog cannot become beach proof',()=>{
 for(const options of [{place:'Park service shed'},{mode:'RIDE'},{firstPerson:false},{visible:false},{modal:true},
  {'on-hoverbike':true},{'royale-camera-mode':true},{noContext:true}]){
  assert.throws(()=>beachFrameFixture(options).start(),/Beach|beach/);
 }
});

test('failed, missing and unknown GPU fences fail instead of approving a screenshot',async()=>{
 for(const options of [{results:[4]},{results:[99]},{noFence:true}]){
  const f=beachFrameFixture(options);await assert.rejects(f.start(),/fence/);
  assert.equal(f.timers.size,0);assert.equal(f.paints.size,0);
  assert.equal(f.deletes,options.noFence?0:1);
 }
});

test('GPU or page loss during capture cleans pending work and fails',async()=>{
 for(const field of ['lost','modal']){
  const f=beachFrameFixture({results:[1]}),promise=f.start();f.state[field]=true;f.timer();
  await assert.rejects(promise,/Beach/);assert.equal(f.deletes,1);assert.equal(f.timers.size,0);
 }
 const f=beachFrameFixture(),promise=f.start();f.state.place='Park service shed';f.paint();
 await assert.rejects(promise,/Beach/);assert.equal(f.deletes,1);assert.equal(f.paints.size,0);
});

test('a never-ready beach frame expires at 45 seconds and is never passed',async()=>{
 const f=beachFrameFixture({results:[1]}),promise=f.start();
 const check=assert.rejects(promise,/45 seconds/);
 for(let i=0;f.timers.size&&i<3000;i++)f.timer();
 await check;assert.equal(f.deletes,1);assert.equal(f.timers.size,0);assert.equal(f.paints.size,0);
});

test('beach fence cleanup errors stay fatal after otherwise completed rendering',async()=>{
 const f=beachFrameFixture({cleanupError:true}),promise=f.start();f.paint();f.paint();
 await assert.rejects(promise,/cleanup failure/);assert.equal(f.deletes,1);assert.equal(f.timers.size,0);
});

function beachUiFixture(initialFrame='10'){
 const calls=[],frames=[initialFrame,'20','21','21'];let first=false;
 const locate=label=>({label,filter(){return this;},getByRole:(_role,{name})=>locate(name),
  fill:async value=>calls.push(['fill',value]),focus:async()=>calls.push(['focus',label]),
  getAttribute:async()=>label==='#profile'?frames.shift():String(first),
  evaluate:async fn=>{assert.equal(fn,waitForBeachFrame);calls.push(['GPU evidence']);return {place:'Belle Isle Beach'};}});
 const page={locator:locate,getByRole:(_role,{name})=>locate(name)};
 const expect=locator=>({not:{toBeVisible:async()=>calls.push(['closed',locator.label]),toHaveClass:async()=>{}},
  toHaveText:async value=>calls.push(['text',locator.label,value]),toHaveAttribute:async()=>assert.equal(first,true)});
 expect.poll=fn=>({toBeGreaterThan:async before=>{assert.equal(before,20);assert.ok(await fn()>before);calls.push(['fresh frame']);}});
 const tap=async locator=>{calls.push(['tap',locator.label]);if(locator.label==='#view')first=true;};
 const bounded=async(promise,ms)=>{assert.equal(ms,50_000);return promise;};
 return {calls,page,tap,expect,bounded};
}

test('beach framing uses the actual shoreline action and a post-FPP game frame',async()=>{
 const f=beachUiFixture(),result=await prepareBeachWaterline(f);
 assert.deepEqual(f.calls.filter(c=>c[0]==='tap').map(c=>c[1]),['#tools-toggle','#map-open','Walk onto the beach','#view']);
 assert.ok(f.calls.find(c=>c[0]==='text'&&c[1]==='#ride-mode'&&c[2]==='ON FOOT'));
 assert.ok(f.calls.find(c=>c[0]==='text'&&c[1]==='#place'&&c[2]==='Belle Isle Beach'));
 assert.equal(result.previousActiveFrames,10);assert.equal(result.arrivalActiveFrames,20);assert.equal(result.currentActiveFrames,21);
 assert.ok(f.calls.findIndex(c=>c[0]==='fresh frame')<f.calls.findIndex(c=>c[0]==='GPU evidence'));
});

test('missing or invalid game frame counts cannot manufacture shoreline evidence',async()=>{
 for(const value of [null,'','NaN','-1','1.5','9007199254740992']){
  const f=beachUiFixture(value);await assert.rejects(prepareBeachWaterline(f),/frame counter/);assert.deepEqual(f.calls,[]);
 }
});

test('activity and trial reviews preserve streaming and make every request failure fatal',async()=>{
 for(const name of ['activity-browser-smoke.mjs','trial-browser-smoke.mjs']){
  const text=await readFile(new URL(name,import.meta.url),'utf8');
  assert.ok(text.includes("'Cache-Control': 'no-cache, max-age=0, must-revalidate'"));
  assert.ok(text.includes('createReadStream(file)')&&text.includes("'Content-Length': info.size"));
  assert.ok(text.includes('recordRequestFailure(entry, request, requestPhase)'));
  assert.ok(!text.includes("message.startsWith('net::ERR_ABORTED')"));
  assert.ok(text.includes("requestPhase = 'cleanup'"));
  assert.ok(text.includes('entry.errors.length === 0'));
 }
 const activity=await readFile(new URL('activity-browser-smoke.mjs',import.meta.url),'utf8');
 assert.ok(activity.indexOf('await prepareBeachWaterline(')<activity.indexOf("screenshot('belle-isle-beach-waterline')"));
 assert.ok(activity.includes("name: 'Travel to path'"));
});
