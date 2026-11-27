import test from 'node:test';
import assert from 'node:assert/strict';
import {bindNativeGpuInput,verifyNativeGpuInput} from './native-gpu-input.mjs';

test('native receiver, argument list, return promises and heartbeat remain exact; sample lifecycle observes once',async()=>{
 const calls=[],starts=[],stops=[];let t=100;
 const nativeDown=Promise.resolve('down'),nativeUp=Promise.resolve('up');
 const keyboard={down(...args){assert.equal(this,keyboard);calls.push(['down',...args]);return nativeDown;},
  up(...args){assert.equal(this,keyboard);calls.push(['up',...args]);return nativeUp;}};
 const original={down:keyboard.down,up:keyboard.up};
 const binding=bindNativeGpuInput(keyboard,{startRide:x=>starts.push(x),stopRide:x=>stops.push(x)},{now:()=>t});
 assert.equal(keyboard.down('e'),nativeDown);assert.equal(keyboard.down('w'),nativeDown);
 t=101;await nativeDown;assert.deepEqual(starts,[101]);
 t=400;assert.equal(keyboard.down('w'),nativeDown);await nativeDown;assert.deepEqual(starts,[101]);
 t=90102;assert.equal(keyboard.up('w'),nativeUp);assert.deepEqual(stops,[90102]);
 t=90104;await nativeUp;
 assert.deepEqual(calls,[['down','e'],['down','w'],['down','w'],['up','w']]);
 assert.deepEqual(verifyNativeGpuInput(binding.receipt),{startHostMs:101,endHostMs:90102,firstDispatchStartedHostMs:100,releaseCompletedHostMs:90104});
 binding.restore();assert.equal(keyboard.down,original.down);assert.equal(keyboard.up,original.up);
});

test('sampler callback errors cannot swallow, repeat, delay or replace native input',async()=>{
 const native=Promise.resolve('native'),errors=[];let down=0,up=0;
 const keyboard={down(){down++;return native;},up(){up++;return native;}};
 bindNativeGpuInput(keyboard,{startRide(){throw Error('start observation');},stopRide(){throw Error('stop observation');}},{onError:e=>errors.push(e.message)});
 assert.equal(keyboard.down('w'),native);await native;assert.equal(keyboard.up('w'),native);await native;
 assert.equal(down,1);assert.equal(up,1);assert.deepEqual(errors,['start observation','stop observation']);
});

test('native synchronous throw and rejected promise remain original failures',async()=>{
 for(const synchronous of [true,false]){
  const failure=Error('native input failed');let count=0,starts=0;
  const rejected=Promise.reject(failure);rejected.catch(()=>{});
  const keyboard={down(){count++;if(synchronous)throw failure;return rejected;},up(){return Promise.resolve();}};
  const binding=bindNativeGpuInput(keyboard,{startRide(){starts++;},stopRide(){}},{now:()=>10});
  if(synchronous)assert.throws(()=>keyboard.down('w'),e=>e===failure);
  else{const result=keyboard.down('w');assert.equal(result,rejected);await assert.rejects(result,e=>e===failure);}
  assert.equal(count,1);assert.equal(starts,0);assert.equal(binding.receipt.firstDown.rejection,String(failure));
  assert.throws(()=>verifyNativeGpuInput(binding.receipt));
 }
});

test('host bracket enforces order without inventing a second browser-duration gate; later GPS input is excluded',async()=>{
 let t=0;const keyboard={down:()=>Promise.resolve(),up:()=>Promise.resolve()};
 const b=bindNativeGpuInput(keyboard,{startRide(){},stopRide(){}},{now:()=>t});
 await keyboard.down('w');t=89999;await keyboard.up('w');assert.doesNotThrow(()=>verifyNativeGpuInput(b.receipt));
 await keyboard.down('w');await keyboard.up('w');assert.equal(b.receipt.wDownCalls,1);assert.equal(b.receipt.wUpCalls,1);
 b.receipt.firstUp.requestedHostMs=0;assert.throws(()=>verifyNativeGpuInput(b.receipt),/bracket/);
 b.receipt.firstUp.requestedHostMs=90000;b.receipt.firstUp.completedHostMs=90000;
 assert.doesNotThrow(()=>verifyNativeGpuInput(b.receipt));
 b.receipt.wUpCalls=2;assert.throws(()=>verifyNativeGpuInput(b.receipt),/one original/);
});
