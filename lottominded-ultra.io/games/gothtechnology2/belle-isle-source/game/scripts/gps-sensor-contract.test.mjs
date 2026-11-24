import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createContext,runInContext} from 'node:vm';
import {installGpsSensorContract} from './gps-sensor-contract.mjs';

const position={latitude:42.3468,longitude:-83.00175,accuracy:5};
function fixture({origin='http://127.0.0.1:8301',own=true}={}){
 let wall=10000,nativeReads=0,nextTimer=0;const timers=new Map(),microtasks=[];
 const nativeDescriptor={configurable:true,get(){nativeReads++;throw Error('A test must never access native geolocation');}};
 const navigator=own?{}:Object.create(Object.defineProperty({},'geolocation',nativeDescriptor));
 if(own)Object.defineProperty(navigator,'geolocation',nativeDescriptor);
 const context=createContext({navigator,location:{origin},Date:{now:()=>wall},queueMicrotask:fn=>microtasks.push(fn),
  setInterval:(fn,delay)=>{assert.equal(delay,2000);const id=nextTimer++;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id)});
 const install=(options={})=>runInContext('('+installGpsSensorContract.toString()+')('+JSON.stringify({origin:'http://127.0.0.1:8301',position,...options})+')',context);
 return {context,navigator,timers,install,descriptor:nativeDescriptor,nativeReads:()=>nativeReads,
  api:()=>context.__belleGpsSensorContract,advance:ms=>{wall+=ms;},tick:()=>{for(const fn of [...timers.values()])fn();},
  flush:()=>{while(microtasks.length)microtasks.shift()();}};
}
const clean=value=>JSON.parse(JSON.stringify(value));

test('contract is idle until a real watch and never reads native geolocation',()=>{
 const f=fixture();f.install();assert.equal(f.nativeReads(),0);assert.equal(f.timers.size,0);
 assert.deepEqual(clean(f.api().snapshot()),{source:'deterministic-watch-contract',activeWatches:0,watchStarts:0,watchClears:0,emittedFixes:0,emittedErrors:0,timerActive:false,disposed:false});
 const fixes=[];const id=f.navigator.geolocation.watchPosition(p=>fixes.push(p));
 assert.equal(id,0);assert.equal(fixes.length,0);f.flush();assert.equal(fixes.length,1);
 assert.equal(fixes[0].timestamp,10000);assert.equal(fixes[0].coords.latitude,position.latitude);assert.equal(fixes[0].coords.accuracy,5);
 assert.equal(f.nativeReads(),0);assert.equal(f.api().snapshot().activeWatches,1);
 assert.throws(()=>f.navigator.geolocation.getCurrentPosition(),/never a fallback/);
 f.navigator.geolocation.clearWatch(id);assert.equal(f.timers.size,0);
});

test('each delivered fix has an increasing real-wall-derived timestamp',()=>{
 const f=fixture();f.install();const stamps=[];
 f.navigator.geolocation.watchPosition(p=>stamps.push(p.timestamp));f.flush();f.tick();f.advance(2000);f.tick();
 assert.deepEqual(stamps,[10000,10001,12000]);assert.equal(f.api().snapshot().emittedFixes,3);
 assert(!Object.keys(f.api().snapshot()).some(key=>/timestamp|latitude|longitude|position/i.test(key)));
 f.api().dispose();
});

test('clearWatch cancels queued delivery and the last repeating timer, including watch zero',()=>{
 const f=fixture();f.install();let calls=0;
 const id=f.navigator.geolocation.watchPosition(()=>calls++);f.navigator.geolocation.clearWatch(id);f.flush();f.tick();
 assert.equal(id,0);assert.equal(calls,0);assert.equal(f.timers.size,0);
 assert.equal(f.api().snapshot().watchClears,1);assert.equal(f.api().snapshot().activeWatches,0);
});

test('separate contexts have independent watches, clocks and cleanup',()=>{
 const a=fixture(),b=fixture();a.install();b.install();let first=0,second=0;
 const id=a.navigator.geolocation.watchPosition(()=>first++);b.navigator.geolocation.watchPosition(()=>second++);
 a.flush();b.flush();a.navigator.geolocation.clearWatch(id);a.tick();b.advance(2000);b.tick();
 assert.equal(first,1);assert.equal(second,2);assert.equal(a.timers.size,0);assert.equal(b.timers.size,1);
 a.api().dispose();assert.equal(b.api().snapshot().activeWatches,1);b.api().dispose();
});

test('unavailable is a genuine error callback; later fixes do not create another watch',()=>{
 const f=fixture();f.install();const events=[];
 f.navigator.geolocation.watchPosition(()=>events.push('fix'),error=>events.push('error:'+error.code));f.flush();
 f.api().emitUnavailable();f.advance(2000);f.tick();
 assert.deepEqual(events,['fix','error:2','fix']);assert.equal(f.api().snapshot().watchStarts,1);
 assert.equal(f.api().snapshot().emittedErrors,1);f.api().dispose();
});

test('dispose restores the exact property and removes pending watches, timer and controller',()=>{
 for(const own of [true,false]){
  const f=fixture({own});f.install();const api=f.api(),source=f.navigator.geolocation;let calls=0;
  source.watchPosition(()=>calls++);const result=api.dispose();f.flush();f.tick();
  assert.equal(calls,0);assert.equal(result.activeWatches,0);assert.equal(result.timerActive,false);assert.equal(result.disposed,true);assert.equal(result.restored,true);
  assert.equal(f.timers.size,0);assert.equal(f.api(),undefined);assert.equal(f.nativeReads(),0);
  const restored=Object.getOwnPropertyDescriptor(f.navigator,'geolocation');assert.equal(restored?.get,own?f.descriptor.get:undefined);
  assert.throws(()=>source.watchPosition(()=>{}),/disposed/);
 }
});

test('installation is limited to the requested origin and rejects invalid fixtures before replacement',()=>{
 const wrong=fixture({origin:'https://example.invalid'});wrong.install();assert.equal(wrong.api(),undefined);assert.equal(wrong.nativeReads(),0);
 const invalid=fixture();assert.throws(()=>invalid.install({position:{...position,accuracy:0}}),/Invalid synthetic/);
 assert.equal(invalid.api(),undefined);assert.equal(Object.getOwnPropertyDescriptor(invalid.navigator,'geolocation').get,invalid.descriptor.get);
 assert.equal(invalid.nativeReads(),0);
});
