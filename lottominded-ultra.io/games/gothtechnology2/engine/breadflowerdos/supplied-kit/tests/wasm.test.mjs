import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BreadflowerInputBridge, ActionChannels as C } from '../dist/bridge.js';
const bytes=await readFile(new URL('../dist/breadflower-input.wasm',import.meta.url));
const module=await WebAssembly.compile(bytes);
const fresh=()=>BreadflowerInputBridge.fromModule(module);
test('actual Wasm has no unresolved platform imports',()=>{
  assert.deepEqual(WebAssembly.Module.imports(module),[]);
});
test('six slots round-trip through real upstream C++ functions',()=>{
  const b=fresh();
  for(let s=0;s<6;s++) b.writeFrame(s,[[C.steer,s/8],[C.throttle,-s/8],[C.fire,s%2]]);
  for(let s=0;s<6;s++) {assert.equal(b.get(s,C.steer),s/8);assert.equal(b.get(s,C.throttle),-s/8);assert.equal(b.get(s,C.fire),s%2);}
});
test('aim does not overwrite steering',()=>{
  const b=fresh();b.writeFrame(0,[[C.steer,.5],[C.aimYaw,-.75],[C.fire,1]]);
  assert.equal(b.get(0,C.steer),.5);assert.equal(b.get(0,C.aimYaw),-.75);
});
test('all 64 channels work including high flag bit 63',()=>{
  const b=fresh();for(let c=0;c<64;c++) {b.set(0,c,.25);assert.equal(b.has(0,c),true);assert.equal(b.get(0,c),.25);}
});
test('PINone=64 is rejected before engine array/shift access',()=>{
  const b=fresh();assert.throws(()=>b.set(0,64,1),RangeError);
  assert.throws(()=>b.get(0,-1),RangeError);
});
test('invalid slot and fractional indices are rejected',()=>{
  const b=fresh();for(const s of [-1,6,1.5,NaN]) assert.throws(()=>b.clear(s),RangeError);
  assert.throws(()=>b.set(0,8.5,1),RangeError);
});
test('NaN infinity and out-of-range inputs are rejected',()=>{
  const b=fresh();for(const v of [NaN,Infinity,-Infinity,1.01,-1.01]) assert.throws(()=>b.set(0,8,v),RangeError);
});
test('clear releases flags and leaves another rider alone',()=>{
  const b=fresh();b.set(0,C.fire,1);b.set(1,C.fire,1);b.clear(0);
  assert.equal(b.has(0,C.fire),false);assert.equal(b.get(0,C.fire),0);assert.equal(b.get(1,C.fire),1);
});
test('new frame omits and clears previous trigger',()=>{
  const b=fresh();b.writeFrame(0,[[C.fire,1]]);b.writeFrame(0,[[C.steer,.25]]);assert.equal(b.has(0,C.fire),false);
});
test('invalid complete frame is rejected atomically',()=>{
  const b=fresh();b.set(0,C.fire,1);assert.throws(()=>b.writeFrame(0,[[C.steer,.25],[64,1]]));
  assert.equal(b.get(0,C.fire),1);
});
test('duplicate channels are rejected',()=>{
  const b=fresh();assert.throws(()=>b.writeFrame(0,[[C.fire,1],[C.fire,0]]));
});
test('two room instances have isolated mutable memory',()=>{
  const a=fresh(),b=fresh();a.set(0,C.throttle,1);assert.equal(b.get(0,C.throttle),0);
  b.set(0,C.fire,1);assert.equal(a.has(0,C.fire),false);
});
test('input snapshot restores only input, without shared JS array references',()=>{
  const a=fresh(),b=fresh();a.writeFrame(0,[[C.fire,0],[C.steer,-.5]]);const saved=a.snapshot(0);
  b.writeFrame(0,saved);a.clear(0);assert.equal(b.has(0,C.fire),true);assert.equal(b.get(0,C.steer),-.5);
});
test('raw Wasm export independently validates untrusted input',()=>{
  const a=new WebAssembly.Instance(module,{}).exports;
  assert.equal(a.sr_set(0,64,1),-2);assert.equal(a.sr_set(6,8,1),-1);
  assert.equal(a.sr_set(0,8,NaN),-3);assert.equal(a.sr_set(0,8,Infinity),-3);
  assert.equal(a.sr_set(0,8,1),1);assert.equal(a.sr_get(0,8),1);
});
