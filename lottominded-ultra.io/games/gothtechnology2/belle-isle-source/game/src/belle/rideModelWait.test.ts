import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {waitForRideModel} from './rideModelWait.ts';

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('ready model resolves and releases its abort listener and timer',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const signal=new AbortController(),model={id:'bike'};
 assert.equal(await waitForRideModel(Promise.resolve(model),20_000,signal.signal),model);
 assert.equal(getEventListeners(signal.signal,'abort').length,0);t.mock.timers.tick(20_000);signal.abort();await flush();
});

test('model download error is preserved and the caller can retry',async()=>{
 const error=new Error('download failed'),signal=new AbortController();
 await assert.rejects(waitForRideModel(Promise.reject(error),20_000,signal.signal),e=>e===error);
 assert.equal(getEventListeners(signal.signal,'abort').length,0);
 assert.equal(await waitForRideModel(Promise.resolve('retry ready'),20_000,signal.signal),'retry ready');
});

test('a never-settling model releases its caller at the twenty-second deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const load=deferred<string>(),signal=new AbortController();let settled=false;
 const waiting=waitForRideModel(load.promise,20_000,signal.signal);void waiting.then(()=>{settled=true;},()=>{settled=true;});
 const rejection=assert.rejects(waiting,/download timed out/);t.mock.timers.tick(19_999);await flush();assert.equal(settled,false);
 t.mock.timers.tick(1);await rejection;assert.equal(getEventListeners(signal.signal,'abort').length,0);
});

test('cancellation releases a caller immediately without waiting for the model deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const signal=new AbortController(),load=deferred<string>();
 const rejection=assert.rejects(waitForRideModel(load.promise,20_000,signal.signal),{name:'AbortError'});
 signal.abort();await rejection;assert.equal(getEventListeners(signal.signal,'abort').length,0);
 t.mock.timers.tick(20_000);load.resolve('late model');await flush();
});

test('pre-cancelled caller preserves an Error reason and still observes a late load rejection',async()=>{
 const signal=new AbortController(),load=deferred<string>(),reason=new Error('course abandoned');signal.abort(reason);
 await assert.rejects(waitForRideModel(load.promise,20_000,signal.signal),e=>e===reason);
 assert.equal(getEventListeners(signal.signal,'abort').length,0);load.reject(new Error('late network error'));await flush();
});

test('non-Error cancellation reason becomes a standard AbortError',async()=>{
 const signal=new AbortController();signal.abort('left the course');
 await assert.rejects(waitForRideModel(Promise.resolve('model'),20_000,signal.signal),{name:'AbortError'});
});

test('cancelling one caller does not cancel another caller sharing the same transfer',async()=>{
 const load=deferred<object>(),firstSignal=new AbortController(),secondSignal=new AbortController();
 const first=waitForRideModel(load.promise,20_000,firstSignal.signal),second=waitForRideModel(load.promise,20_000,secondSignal.signal);
 const rejection=assert.rejects(first,{name:'AbortError'});firstSignal.abort();await rejection;
 assert.equal(getEventListeners(secondSignal.signal,'abort').length,1);
 const model={id:'shared bike'};load.resolve(model);assert.equal(await second,model);
 assert.equal(getEventListeners(secondSignal.signal,'abort').length,0);
});

test('timeout does not discard a shared transfer that completes during a subsequent retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const load=deferred<string>();
 const rejection=assert.rejects(waitForRideModel(load.promise,20_000),/download timed out/);
 t.mock.timers.tick(20_000);await rejection;
 const retry=waitForRideModel(load.promise,20_000);load.resolve('cached bike');assert.equal(await retry,'cached bike');
 t.mock.timers.tick(20_000);await flush();
});

test('late rejection after timeout is observed, rather than becoming an unhandled rejection',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const load=deferred<string>();
 const rejection=assert.rejects(waitForRideModel(load.promise,20_000),/download timed out/);
 t.mock.timers.tick(20_000);await rejection;load.reject(new Error('network eventually failed'));await flush();
});
