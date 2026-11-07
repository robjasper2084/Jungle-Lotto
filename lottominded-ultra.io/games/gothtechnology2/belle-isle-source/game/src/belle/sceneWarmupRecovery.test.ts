import test from 'node:test';
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
