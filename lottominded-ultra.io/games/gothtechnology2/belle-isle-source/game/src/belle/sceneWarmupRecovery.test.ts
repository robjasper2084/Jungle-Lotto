import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import type {Camera,Object3D,Scene,WebGLRenderer} from 'three';
import {SceneWarmup} from './sceneWarmup.ts';

// Structural fixtures exercise preparation ownership, not actual GPU performance.
function fixture(){
 const light={isDirectionalLight:true,castShadow:true};
 const scene={traverse(visit:(object:unknown)=>void){visit(light);}} as unknown as Scene;
 const model={uuid:'recovery-bike',visible:false} as Object3D;
 return{light,scene,model,camera:{} as Camera};
}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function compiler(run:()=>Promise<unknown>){return{compileAsync:run} as unknown as Pick<WebGLRenderer,'compileAsync'>;}

function linkedIsland(t:TestContext,readyAt:number[],cachedAt:number[]=[]){
 t.mock.timers.enable({apis:['setTimeout']});
 let now=0;
 t.mock.method(performance,'now',()=>now);
 const {scene,camera,light}=fixture(),busy:boolean[]=[],verified:number[]=[];
 const entries=(times:number[])=>times.map(at=>({program:{at}}));
 const programs=entries(cachedAt),newEntries=entries(readyAt);
 let submissions=0,polls=0,linkBlockMs=0;
 const renderer={info:{programs},shadowMap:{enabled:true},compile(){if(submissions++===0)programs.push(...newEntries);},
  compileAsync:async()=>scene,getContext:()=>({getExtension:()=>({COMPLETION_STATUS_KHR:1}),LINK_STATUS:2,
   isContextLost:()=>false,flush(){},getProgramParameter(handle:{at:number},key:number){
    if(key===1){polls++;return now>=handle.at;}
    now+=linkBlockMs;verified.push(handle.at);return true;
   }})};
 const warmup=new SceneWarmup(renderer as unknown as ConstructorParameters<typeof SceneWarmup>[0],scene,camera,v=>busy.push(v),async()=>{});
 const outcome=warmup.prepare().then(()=>null,(e:Error)=>e);
 const advance=async(ms:number)=>{now+=ms;t.mock.timers.tick(ms);await flush();};
 return {busy,light,verified,outcome,advance,get polls(){return polls;},blockLink:(ms:number)=>{linkBlockMs=ms;},
  async begin(){await flush();await advance(1);await advance(1);assert.equal(submissions,2);}};
}

test('new verified island links can carry preparation past 45 seconds',async t=>{
 const f=linkedIsland(t,[30_000,60_000]);await f.begin();
 await f.advance(30_000);assert.deepEqual(f.verified,[30_000]);
 await f.advance(15_000);assert.deepEqual(f.busy,[true]);
 await f.advance(15_000);assert.equal(await f.outcome,null);assert.deepEqual(f.verified,[30_000,60_000]);
 assert.deepEqual(f.busy,[true,false]);assert.equal(f.light.castShadow,true);
});

test('45 seconds of inactivity after a new link times out a partially verified island',async t=>{
 const f=linkedIsland(t,[25_000,Infinity]);await f.begin();
 await f.advance(25_000);await f.advance(20_000);await f.advance(24_999);
 assert.deepEqual(f.busy,[true]);await f.advance(1);
 assert.match((await f.outcome)!.message,/preparation took too long/);assert.deepEqual(f.verified,[25_000]);
 assert.deepEqual(f.busy,[true,false]);assert.equal(f.light.castShadow,true);
});

test('a progressing island reaches its absolute deadline at 90 seconds from the lock',async t=>{
 const f=linkedIsland(t,[30_000,60_000,80_000,100_000]);await f.begin();
 await f.advance(29_998);await f.advance(15_000);await f.advance(15_000);await f.advance(15_000);await f.advance(5_000);
 assert.deepEqual(f.verified,[30_000,60_000,80_000]);
 await f.advance(9_999);assert.deepEqual(f.busy,[true]);await f.advance(1);
 assert.match((await f.outcome)!.message,/preparation took too long/);assert.deepEqual(f.busy,[true,false]);
});

test('cached links and repeated readiness polls do not extend the initial deadline',async t=>{
 const f=linkedIsland(t,[Infinity],[20_000]);await f.begin();
 for(let i=0;i<4;i++)await f.advance(10_000);
 assert.ok(f.polls>=4);assert.deepEqual(f.verified,[20_000]);
 await f.advance(4_998);
 assert.match((await f.outcome)!.message,/preparation took too long/);assert.deepEqual(f.busy,[true,false]);
});

test('a synchronous link query that returns after the inactivity deadline cannot renew it',async t=>{
 const f=linkedIsland(t,[1_000,30_000]);await f.begin();
 await f.advance(1_000);f.blockLink(20_000);await f.advance(29_000);
 assert.match((await f.outcome)!.message,/preparation took too long/);assert.deepEqual(f.busy,[true,false]);
});

test('a suspended preparation paint times out and releases scene controls before any shader submission',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {scene,model,camera,light}=fixture(),busy:boolean[]=[];let calls=0;
 const warmup=new SceneWarmup(compiler(async()=>{calls++;}),scene,camera,value=>busy.push(value),()=>new Promise(()=>{}));
 const rejection=assert.rejects(warmup.prepare(model),/preparation took too long/);await flush();assert.deepEqual(busy,[true]);
 t.mock.timers.tick(45_000);await rejection;assert.equal(calls,0);assert.equal(model.visible,false);assert.equal(light.castShadow,true);assert.deepEqual(busy,[true,false]);
});

test('a synchronous shader-submission exception restores scene state and permits retry',async()=>{
 const {scene,model,camera,light}=fixture(),busy:boolean[]=[];let fail=true;
 const warmup=new SceneWarmup(compiler(()=>{if(fail)throw new Error('submission failed');return Promise.resolve();}),scene,camera,value=>busy.push(value),async()=>{});
 await assert.rejects(warmup.prepare(model),/submission failed/);assert.equal(model.visible,false);assert.equal(light.castShadow,true);assert.deepEqual(busy,[true,false]);
 fail=false;await warmup.prepare(model);assert.deepEqual(busy,[true,false,true,false]);
});

test('never-ready shaders time out at the existing 45-second deadline without caching success',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {scene,model,camera,light}=fixture(),busy:boolean[]=[];let ready=false,calls=0;
 const warmup=new SceneWarmup(compiler(()=>{calls++;return ready?Promise.resolve():new Promise(()=>{});}),scene,camera,value=>busy.push(value),async()=>{});
 const rejection=assert.rejects(warmup.prepare(model),/preparation took too long/);await flush();t.mock.timers.tick(45_000);await rejection;
 assert.deepEqual(busy,[true,false]);assert.equal(model.visible,false);assert.equal(light.castShadow,true);
 ready=true;await warmup.prepare(model);assert.equal(calls,3);assert.deepEqual(busy,[true,false,true,false]);
});

test('late shader rejection after cancellation cannot unlock or corrupt a replacement attempt',async()=>{
 const {scene,model,camera,light}=fixture(),busy:boolean[]=[],firstSignal=new AbortController(),nextSignal=new AbortController();
 const jobs:{resolve:()=>void;reject:(reason:unknown)=>void}[]=[];
 const warmup=new SceneWarmup(compiler(()=>new Promise<void>((resolve,reject)=>jobs.push({resolve,reject}))),scene,camera,value=>busy.push(value),async()=>{});
 const first=assert.rejects(warmup.prepare(model,firstSignal.signal),{name:'AbortError'});await flush();firstSignal.abort();
 const replacement=warmup.prepare(model,nextSignal.signal);await first;await flush();assert.deepEqual(busy,[true,false,true]);
 jobs[0].reject(new Error('abandoned GPU submission'));await flush();assert.deepEqual(busy,[true,false,true]);
 jobs[1].resolve();await flush();jobs[2].resolve();await replacement;
 assert.deepEqual(busy,[true,false,true,false]);assert.equal(model.visible,false);assert.equal(light.castShadow,true);
 assert.equal(getEventListeners(firstSignal.signal,'abort').length,0);assert.equal(getEventListeners(nextSignal.signal,'abort').length,0);
});
