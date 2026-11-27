import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installWebglTimerProbe, validateWebglTimerSnapshot, loadWebglTimerConfig, verifyWebglTimerBuild, persistWebglTimerSnapshot} from './webgl-timer.mjs';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url)));
const production = {...await loadWebglTimerConfig(manifest), invocationId: 'source-contract-invocation'};
const sha = value => createHash('sha256').update(value).digest('hex');

// These are the actual four immutable executed-bundle bodies. The captured
// renderer bindings below are controlled sentinels; no application graph,
// browser, scheduler, network, or original game work is started by this test.
test('six actual-function reflection/composition contracts, including original game and scheduler exceptions', () => {
 const texts = Object.fromEntries(Object.entries(production.bindings.functions).map(([key,row]) => [key,row.text]));
 const expected = ['4e5691f343735887fc7594e659de2db5cd136912ce73a50d05d3d9c0c9fd0dd7','0eb020cff5de5bc801fb103b13a2aba716b894c300280209eb7cf00983800ac6','43c5df02077c627c2749ed9b3c2f34f5fc619d8fbb9836dd1008534da1a87b96','8b828cd5a19913ecc978e9903631d9379799cdf985d4b0777a810da1f6dfca0e'];
 Object.values(texts).forEach((text,i) => assert.equal(sha(text),expected[i]));
 const events=[],sentinelCalls=[],renderer={xr:{isPresenting:false},info:{render:{frame:7}}};
 const sandbox={
  Q3:null,b1:{setAnimationLoop(callback){events.push(['xr:set',callback===null?'null':'function']);sandbox.xrCallback=callback;}},
  k9:{start(){events.push(['native:start']);},stop(){events.push(['native:stop']);}},
  n:renderer,b:false,g:false,r:null,u:undefined,d:{probe:null},
  h:{animationCallbacks:0,executedCallbacks:0,renderedCallbacks:0,submittedCallbacks:0,xrCallbacks:0,pendingFenceSkippedCallbacks:0,contextLostSkippedCallbacks:0,pendingFenceResumptions:0},
  o:{isContextLost(){events.push(['context:check']);return false;}},
  f(timestamp){events.push(['pending:clear',timestamp??null]);},
  p(){throw Error('Unexpected pending-fence path in browser-mode fixture');},
  // No game diagnostic/probe body is invoked. These are minimal captured
  // bindings for the original browser-mode (r=null, d.probe=null) branch.
  W2(probe){assert.equal(probe,null);return undefined;},
  callbackSentinel(timestamp,frame){events.push(['sentinel:callback',timestamp]);sentinelCalls.push({timestamp,frame});renderer.info.render.frame++;}
 };
 const context=vm.createContext(sandbox,{name:'immutable759-function-reflection',codeGeneration:{strings:false,wasm:false}});
 const run=code=>new vm.Script('"use strict";\n'+code,{filename:'immutable759-reflection-fixture.vm'}).runInContext(context,{timeout:100});
 run('globalThis.functions={'+Object.entries(texts).map(([key,text])=>key+':('+text+')').join(',')+'};');
 const reflected=JSON.parse(run('JSON.stringify(Object.fromEntries(Object.entries(functions).map(([key,fn])=>[key,Function.prototype.toString.call(fn)])))'));
 for(const [key,text]of Object.entries(texts))assert.equal(reflected[key],text,'Exact Function.prototype.toString parity '+key);
 const cases=['all four actual functions reflect the exact pinned text'];

 // Native Three registration sets Q3, forwards the same callback to XR, then
 // starts the scheduler. No recreated setter body is used.
 run('functions.nativeSetter(callbackSentinel);');
 assert.equal(sandbox.Q3,sandbox.callbackSentinel);assert.equal(sandbox.xrCallback,sandbox.callbackSentinel);assert.deepEqual(events,[['xr:set','function'],['native:start']]);
 events.length=0;run('functions.nativeSetter(null);');assert.equal(sandbox.Q3,null);assert.equal(sandbox.xrCallback,null);assert.deepEqual(events,[['xr:set','null'],['native:stop']]);
 cases.push('actual native setter preserves callback identity and XR-before-start/stop order');

 // The actual original pacing setter is composed with the actual native
 // setter, using only synthetic renderer counters and a callback sentinel.
 sandbox.l=sandbox.functions.nativeSetter;events.length=0;
 run('functions.pacingSetter(callbackSentinel);');
 assert.equal(sandbox.b,true);assert.notEqual(sandbox.Q3,sandbox.callbackSentinel);assert.equal(sandbox.xrCallback,sandbox.Q3);assert.deepEqual(events,[['xr:set','function'],['native:start']]);
 const retainedPacingCallback=sandbox.Q3,frameSentinel={kind:'synthetic-frame'};sandbox.frameSentinel=frameSentinel;events.length=0;
 run('Q3(123.5,frameSentinel);');
 assert.deepEqual(events,[['context:check'],['pending:clear',123.5],['sentinel:callback',123.5]]);
 assert.equal(sentinelCalls.length,1);assert.equal(sentinelCalls[0].timestamp,123.5);assert.equal(sentinelCalls[0].frame,frameSentinel);
 assert.equal(sandbox.h.animationCallbacks,1);assert.equal(sandbox.h.executedCallbacks,1);assert.equal(sandbox.h.renderedCallbacks,1);assert.equal(sandbox.h.submittedCallbacks,0);
 events.length=0;run('functions.pacingSetter(null);');assert.equal(sandbox.b,false);assert.equal(sandbox.Q3,null);assert.deepEqual(events,[['pending:clear',null],['xr:set','null'],['native:stop']]);
 events.length=0;sandbox.retainedPacingCallback=retainedPacingCallback;run('retainedPacingCallback(124,frameSentinel);');assert.deepEqual(events,[]);assert.equal(sentinelCalls.length,1);
 cases.push('actual pacing/native composition forwards arguments and suppresses callbacks after null');

 // Execute only the game's first guard. p1=false forces m9 immediately; m9
 // throws this exact sentinel before any original game work can be reached.
 const earlyStop=Object.freeze({kind:'controlled-before-game-work'});let earlyCalls=0;
 sandbox.p1=false;sandbox.m9=()=>{earlyCalls++;throw earlyStop;};events.length=0;
 run('functions.pacingSetter(functions.gameFrame);');events.length=0;
 assert.throws(()=>run('Q3(200,frameSentinel);'),error=>error===earlyStop);
 assert.equal(earlyCalls,1);assert.deepEqual(events,[['context:check'],['pending:clear',200]]);assert.equal(sentinelCalls.length,1);
 assert.equal(sandbox.h.animationCallbacks,2);assert.equal(sandbox.h.executedCallbacks,2);assert.equal(sandbox.h.renderedCallbacks,1);
 run('functions.pacingSetter(null);');
 cases.push('actual game callback exits at its first controlled guard and pacing propagates the same exception');

 // The scheduler body is the actual pinned WebGLAnimation function. Its
 // captured request/cancel interface only stores callbacks; nothing schedules
 // an asynchronous tick in Node, and each stored callback is invoked once.
 const scheduled=[],schedulerEvents=[];let nextId=1;
 sandbox.schedulerContext={requestAnimationFrame(callback){const id=nextId++;schedulerEvents.push(['request',id]);scheduled.push({id,callback});return id;},cancelAnimationFrame(id){schedulerEvents.push(['cancel',id]);}};
 sandbox.schedulerSentinel=(timestamp,frame)=>{schedulerEvents.push(['callback',timestamp]);assert.equal(frame,frameSentinel);};
 run('globalThis.animation=functions.scheduler();animation.setContext(schedulerContext);animation.start();');assert.deepEqual(schedulerEvents,[]);
 run('animation.setAnimationLoop(schedulerSentinel);animation.start();animation.start();');assert.deepEqual(schedulerEvents,[['request',1]]);assert.equal(scheduled.length,1);
 sandbox.scheduledCallback=scheduled[0].callback;run('scheduledCallback(300,frameSentinel);');assert.deepEqual(schedulerEvents,[['request',1],['callback',300],['request',2]]);assert.equal(scheduled.length,2);
 run('animation.stop();');assert.deepEqual(schedulerEvents.at(-1),['cancel',2]);
 cases.push('actual scheduler requests the next frame after callback return and start is idempotent');
 // With the same early-exit game function, the actual scheduler must propagate
 // the exception instead of silently issuing another animation-frame request.
 run('animation.setAnimationLoop(functions.gameFrame);animation.start();');assert.equal(scheduled.length,3);sandbox.scheduledCallback=scheduled[2].callback;
 assert.throws(()=>run('scheduledCallback(301,frameSentinel);'),error=>error===earlyStop);assert.equal(earlyCalls,2);assert.equal(scheduled.length,3);run('animation.stop();');
 cases.push('actual scheduler does not enqueue a successor after the controlled game exception');

 const reflectedAfter=JSON.parse(run('JSON.stringify(Object.fromEntries(Object.entries(functions).map(([key,fn])=>[key,Function.prototype.toString.call(fn)])))'));
 assert.deepEqual(reflectedAfter,reflected,'No source function was replaced or rewritten by the fixture');
 assert.equal(cases.length,6);
});

// The browser-facing observer runs unchanged inside this bounded VM. Only the
// WebGL/DOM host and callback bodies are controlled fixtures. Unsupported host
// operations throw rather than scheduling, rendering, waiting, or networking.
function fixture(options = {}) {
  class Target {
    listeners = new Map();
    addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== fn)); }
    dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); return true; }
  }
  const canvas = new Target(), document = new Target(), microtasks = [], calls = [], handles = [];
  document.getElementById = id => id === 'game' ? canvas : null;
  let time = 0, nextId = 1;
  const elapsed = 0x88bf, disjoint = 0x8fbb, gpuName = 0x9246;
  class GL {
    canvas = canvas; CURRENT_QUERY = 0x8865; QUERY_RESULT = 0x8866; QUERY_RESULT_AVAILABLE = 0x8867;
    current = null; lost = false; disjoint = false; available = false; value = 12345; extension = true; counterBits = 64;
    getExtension(name) { calls.push(['getExtension', name]); return name === 'WEBGL_debug_renderer_info' ? {UNMASKED_RENDERER_WEBGL: gpuName} : this.extension ? {TIME_ELAPSED_EXT: elapsed, GPU_DISJOINT_EXT: disjoint, QUERY_COUNTER_BITS_EXT: 0x8864} : null; }
    getParameter(parameter) {
      calls.push(['getParameter', parameter]);
      if (parameter === gpuName) return 'ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version)';
      if (parameter === disjoint) return this.disjoint;
      throw Error('Unexpected GL parameter');
    }
    getQuery(target, parameter) {
      assert.equal(target, elapsed);
      if (parameter === 0x8864) { calls.push(['getQueryBits', target, parameter]); return this.counterBits; }
      assert.equal(parameter, this.CURRENT_QUERY); calls.push(['getQuery', this.current?.id ?? null]); if (this.queryError) throw this.queryError; return this.current;
    }
    createQuery() { const handle = {id: nextId++, deleted: false}; handles.push(handle); calls.push(['createQuery', handle.id]); return handle; }
    beginQuery(target, handle) { assert.equal(target, elapsed); assert.equal(this.current, null); assert(handles.includes(handle)); this.current = handle; calls.push(['beginQuery', handle.id]); if (this.beginError) throw this.beginError; }
    endQuery(target) { assert.equal(target, elapsed); assert(this.current); calls.push(['endQuery', this.current.id]); if (this.endError) throw this.endError; this.current = null; }
    getQueryParameter(handle, parameter) {
      assert(handles.includes(handle)); assert.equal(handle.deleted, false); calls.push(['getQueryParameter', handle.id, parameter]);
      if (parameter === this.QUERY_RESULT_AVAILABLE) return this.available;
      assert.equal(parameter, this.QUERY_RESULT); assert.equal(this.available, true, 'Result read requires availability');
      if (this.disjointAfterResult) this.disjoint = true;
      return this.value;
    }
    isQuery(handle) { calls.push(['isQuery', handle.id]); return handles.includes(handle) && !handle.deleted; }
    deleteQuery(handle) { assert(handles.includes(handle), 'Must never delete foreign objects'); assert.notEqual(handle, this.current); calls.push(['deleteQuery', handle.id]); handle.deleted = true; }
    isContextLost() { calls.push(['isContextLost']); return this.lost; }
    getError() { throw Error('GL error state must remain untouched'); }
    finish() { throw Error('No GPU waits'); }
    flush() { throw Error('No observer flush'); }
    fenceSync() { throw Error('No observer fence'); }
    readPixels() { throw Error('No observer readback'); }
  }
  const gl = new GL(); if (options.unsupported) gl.extension = false;
  if (Object.hasOwn(options, 'counterBits')) gl.counterBits = options.counterBits;
  const sandbox = {document, EventTarget: Target, WebGL2RenderingContext: GL,
    performance: {timeOrigin: 123000, now() { time += 0.25; return time; }},
    queueMicrotask(fn) { microtasks.push(fn); },
    requestAnimationFrame() { throw Error('Observer must not create an rAF'); },
    cancelAnimationFrame() { throw Error('Observer must not touch the existing scheduler'); },
    setTimeout() { throw Error('No browser timers'); }, setInterval() { throw Error('No browser timers'); },
    fetch() { throw Error('No network'); }, gl, canvas, calls, observedCalls: [],
    setterReturn: {kind: 'original-setter-result'}, disposalReturn: {kind: 'original-disposal-result'},
    gameAction(...args) { sandbox.observedCalls.push({receiver: this, args}); sandbox.renderer.info.render.frame++; return sandbox.gameReturn; },
    gameReturn: {kind: 'original-callback-result'}};
  const context = vm.createContext(sandbox, {codeGeneration: {strings: false, wasm: false}});
  const run = source => new vm.Script('"use strict";\n' + source).runInContext(context, {timeout: 100});
  run(`globalThis.window=globalThis;window.top=window;
    globalThis.nativeSetter=function nativeSetter(callback){globalThis.registered=callback;return globalThis.setterReturn;};
    globalThis.pacingSetter=function pacingSetter(callback,...rest){globalThis.registered=callback;globalThis.setterReceiver=this;globalThis.setterArgs=[callback,...rest];return globalThis.setterReturn;};
    globalThis.pacingDispose=function pacingDispose(...args){globalThis.disposeReceiver=this;globalThis.disposeArgs=args;return globalThis.disposalReturn;};
    globalThis.gameFrame=function gameFrame(...args){return Reflect.apply(globalThis.gameAction,this,args);};
    globalThis.renderer={isWebGLRenderer:true,domElement:canvas,getContext(){return gl;},xr:{isPresenting:false},info:{render:{frame:9}},setAnimationLoop:nativeSetter,dispose:function(){}};`);
  const config = structuredClone(production);
  for (const key of ['nativeSetter', 'pacingSetter', 'gameFrame']) {
    const text = run('Function.prototype.toString.call(' + key + ')');
    config.bindings.functions[key] = {...config.bindings.functions[key], text, functionTextSha256: sha(text)};
  }
  if (options.rows) config.bounds.rows = options.rows;
  if (options.wrongNative) config.bindings.functions.nativeSetter.text += ' ';
  if (options.wrongPacing) config.bindings.functions.pacingSetter.text += ' ';
  if (options.wrongFrame) config.bindings.functions.gameFrame.text += ' ';
  sandbox.config = config;
  run('(' + installWebglTimerProbe.toString() + ')(config);');
  const api = sandbox.__belleWebglCommandSpanObserver;
  sandbox.__THREE_DEVTOOLS__.dispatchEvent({type: 'observe', detail: sandbox.renderer});
  sandbox.renderer.setAnimationLoop = sandbox.pacingSetter;
  sandbox.renderer.dispose = sandbox.pacingDispose;
  const flushMicrotasks = () => { while (microtasks.length) { sandbox.queued = microtasks.shift(); run('queued();'); } };
  if (!options.deferInstallation) flushMicrotasks();
  const register = () => run('renderer.setAnimationLoop(gameFrame);');
  if (!options.deferRegistration) register();
  const key = (type, trusted = true) => document.dispatchEvent({type, isTrusted: trusted, code: 'KeyW'});
  const start = () => { api.arm(); key('keydown'); };
  const tick = (timestamp, receiver, second) => {
    sandbox.tickArgs = [timestamp, second, 'unchanged-extra']; sandbox.tickReceiver = receiver;
    return run('Reflect.apply(registered,tickReceiver,tickArgs);');
  };
  const snapshot = final => JSON.parse(JSON.stringify(api.snapshot(!!final)));
  const resultCalls = () => calls.filter(row => row[0] === 'getQueryParameter' && row[2] === gl.QUERY_RESULT);
  return {sandbox, run, config, gl, api, key, start, tick, snapshot, calls, handles, microtasks, flushMicrotasks, register, resultCalls, canvas,
    setClock(value) { time = value; }};
}

test('transparent callback receiver, all arguments, result identity, native setter and disposal semantics', () => {
  const f = fixture(); f.start(); const receiver = {kind: 'receiver'};
  assert.equal(f.tick(100, receiver), f.sandbox.gameReturn);
  assert.equal(f.sandbox.observedCalls[0].receiver, receiver);
  assert.deepEqual(f.sandbox.observedCalls[0].args, [100, undefined, 'unchanged-extra']);
  const promise = Promise.resolve(7); f.sandbox.gameReturn = promise;
  assert.equal(f.tick(101, undefined), promise, 'Observer cannot await or replace a return');
  assert.equal(f.sandbox.observedCalls[1].receiver, undefined, 'Strict init serialization preserves undefined this');
  f.key('keyup'); const s = f.snapshot(true);
  assert.equal(s.evidenceComplete, true); assert.equal(s.distributionComplete, false);
  assert.equal(s.counts.censored, 2); assert.equal(f.sandbox.renderer.setAnimationLoop, f.sandbox.pacingSetter);
  assert.equal(f.sandbox.renderer.dispose, f.sandbox.pacingDispose);
  const disposalReceiver = {kind: 'dispose'}, arg = {kind: 'original'};
  assert.equal(f.sandbox.renderer.dispose.call(disposalReceiver, arg), f.sandbox.disposalReturn);
  assert.equal(f.sandbox.disposeReceiver, disposalReceiver); assert.equal(f.sandbox.disposeArgs[0], arg);
  assert.equal(validateWebglTimerSnapshot(s, f.config, {final: true}).evidenceComplete, true);
});
test('original sentinel exception wins over query cleanup errors', () => {
  const f = fixture(); f.start(); const original = {kind: 'original-game-exception'};
  f.sandbox.gameAction = () => { throw original; }; f.gl.endError = Error('observer-only end failure');
  assert.throws(() => f.tick(1), error => error === original);
  f.key('keyup'); const s = f.snapshot(true);
  assert.equal(s.evidenceComplete, false); assert(s.errors.some(row => row.where === 'callback-exit'));
});
test('one active and sixteen owned queries; pool pressure records gaps and never delays game callbacks', () => {
  const f = fixture(); f.start();
  for (let i = 1; i <= 17; i++) f.tick(i);
  let s = f.snapshot(); assert.equal(s.queries.created, 16); assert.equal(s.queries.peakActive, 1);
  assert.equal(s.rows[16].status, 'uncovered'); assert.equal(s.rows[16].reason, 'query-pool-exhausted');
  assert.equal(f.resultCalls().length, 0); assert.equal(f.sandbox.observedCalls.length, 17);
  f.gl.available = true; f.tick(18); assert.equal(f.resultCalls().length, 16); assert.equal(f.handles.length, 16);
  f.key('keyup'); s = f.snapshot(true);
  assert.equal(s.counts.resolved, 16); assert.equal(s.counts.uncovered, 1); assert.equal(s.counts.censored, 1);
  assert.equal(s.queries.deleted, 16); assert.equal(s.evidenceComplete, true); assert.equal(s.distributionComplete, false);
});
test('trusted keyup censors pending queries with no GL call and no later result promotion', () => {
  const f = fixture(); f.start(); f.tick(5); const before = f.calls.length;
  f.key('keyup', false); assert.equal(f.snapshot().stopped, false);
  f.key('keyup'); assert.equal(f.calls.length, before, 'Input handler must not call GL');
  f.gl.available = true; f.tick(6); assert.equal(f.resultCalls().length, 0);
  const s = f.snapshot(true), frozen = JSON.stringify(s); f.tick(7); f.api.stop('later');
  assert.equal(s.rows[0].status, 'censored'); assert.equal(s.callbackTotal, 1);
  assert.equal(JSON.stringify(s), frozen); assert.equal(f.sandbox.observedCalls.length, 3);
  assert.equal(f.handles.every(handle => handle.deleted), true);
});
test('disjoint before or during result retrieval invalidates measurements instead of substituting zero', () => {
  for (const after of [false, true]) {
    const f = fixture(); f.start(); f.tick(1); f.gl.available = true;
    if (after) f.gl.disjointAfterResult = true; else f.gl.disjoint = true;
    f.tick(2); f.key('keyup'); const s = f.snapshot(true);
    assert.equal(s.evidenceComplete, false); assert.equal(s.distributionComplete, false);
    assert.equal(s.rows[0].resultValid, false); assert.equal(s.rows[0].status, 'invalid');
    assert.equal(s.rows[0].rawNanoseconds, after ? 12345 : null);
    assert.equal(f.resultCalls().length, after ? 1 : 0);
  }
});
test('zero and no-render callbacks stay explicit; they are not eligible-frame or hardware-busy claims', () => {
  const f = fixture({counterBits: 30}); f.sandbox.gameAction = () => f.sandbox.gameReturn;
  f.start(); f.tick(10); f.gl.available = true; f.gl.value = 0; f.tick(11); f.key('keyup');
  const s = f.snapshot(true); assert.equal(s.rows[0].rawNanoseconds, 0); assert.equal(s.rows[0].zeroResult, true);
  assert.equal(s.rows[0].rendered, false); assert.equal(s.rows[0].resultValid, true);
  assert.equal(s.callbacksAreEligibleGameFrames, false); assert.equal(s.hardwareGpuBusyTimeAttributed, false);
  assert.equal(s.setup.elapsedCounterBits, 30); assert.equal(s.setup.elapsedCounterBitsQueries, 1);
  assert.equal(f.calls.filter(row => row[0] === 'getQueryBits').length, 1);
  assert.equal(validateWebglTimerSnapshot(s, f.config, {final: true}).valid, true);
});
test('elapsed counter capability rejects zero, subminimum, oversized and malformed widths before registration', () => {
  for (const counterBits of [0, -1, 1, 29, 65, 30.5, '64', null, undefined, NaN, Infinity]) {
    const f = fixture({counterBits}); f.start(); f.tick(1); f.key('keyup'); const s = f.snapshot(true);
    assert.equal(s.setup.elapsedCounterBitsQueries, 1); assert.equal(s.setup.ready, false);
    assert.equal(f.calls.filter(row => row[0] === 'getQueryBits').length, 1);
    assert.equal(f.handles.length, 0); assert.equal(f.sandbox.registered, f.sandbox.gameFrame);
    assert.equal(s.gpuClockIntervalsAvailable, false); assert.equal(s.evidenceComplete, false);
    assert.equal(validateWebglTimerSnapshot(s, f.config, {final: true}).evidenceComplete, false);
  }
});
test('results outside the reported counter width and forged zero-bit receipts cannot be accepted', () => {
  const f = fixture({counterBits: 30}); f.start(); f.tick(1); f.gl.available = true; f.gl.value = 2 ** 30;
  f.tick(2); f.key('keyup'); const s = f.snapshot(true);
  assert.equal(s.rows[0].rawNanoseconds, 2 ** 30); assert.equal(s.rows[0].status, 'invalid');
  assert.equal(s.rows[0].resultValid, false); assert.equal(s.evidenceComplete, false);
  const g = fixture(); g.start(); g.tick(1); g.gl.available = true; g.tick(2); g.key('keyup');
  const valid = g.snapshot(true); assert.equal(valid.evidenceComplete, true);
  for (const bits of [0, 29, 65, '64', null]) {
    const forged = structuredClone(valid); forged.setup.elapsedCounterBits = bits;
    assert.equal(validateWebglTimerSnapshot(forged, g.config, {final: true}).evidenceComplete, false);
  }
});
test('counter horizon conservatively censors at or above the CPU envelope and rejects forged resolution', () => {
  const horizon = (2 ** 30) / 1e6;
  for (const [bits, envelope, censored] of [[30, horizon - 1, false], [30, horizon, true], [30, horizon + 1, true], [64, horizon, false]]) {
    const f = fixture({counterBits: bits}); f.start(); f.tick(1); const first = f.snapshot().rows[0];
    // The existing callback-entry clock and availability clock each advance
    // this fixture's CPU clock by .25; no browser callback or timer is added.
    f.setClock(first.queryBeginAtMs + envelope - .5); f.gl.available = true; f.gl.value = 0;
    f.tick(2); f.key('keyup'); const s = f.snapshot(true), row = s.rows[0];
    assert.equal(row.availabilityEnvelopeMs, envelope); assert.equal(row.rawNanoseconds, 0); assert.equal(row.zeroResult, true);
    assert.equal(row.status, censored ? 'censored' : 'resolved'); assert.equal(row.resultValid, !censored);
    assert.equal(row.reason, censored ? 'counter-horizon-uncertain' : null);
    assert.equal(f.handles.length, 1, 'Censored result releases the owned slot without waiting');
    assert.equal(s.evidenceComplete, true); assert.equal(s.distributionComplete, false);
    assert.equal(validateWebglTimerSnapshot(s, f.config, {final: true}).evidenceComplete, true);
    if (censored) {
      const forged = structuredClone(s); forged.rows[0].status = 'resolved'; forged.rows[0].resultValid = true; forged.rows[0].reason = null;
      forged.counts.censored--; forged.counts.resolved++; forged.gpuClockIntervalsAvailable = true;
      assert.equal(validateWebglTimerSnapshot(forged, f.config, {final: true}).evidenceComplete, false);
      const badCensor = structuredClone(s); badCensor.rows[0].availabilityEnvelopeMs = horizon - 1;
      assert.equal(validateWebglTimerSnapshot(badCensor, f.config, {final: true}).evidenceComplete, false);
      const unidentified = structuredClone(s); unidentified.rows[0].querySequence = null; unidentified.rows[0].slotId = null;
      assert.equal(validateWebglTimerSnapshot(unidentified, f.config, {final: true}).evidenceComplete, false);
    }
  }
});
test('foreign active queries are never ended or deleted, including ownership lost inside the game', () => {
  for (const during of [false, true]) {
    const f = fixture(); f.start(); const foreign = {id: 'foreign'};
    if (during) f.sandbox.gameAction = () => { f.gl.current = foreign; f.sandbox.renderer.info.render.frame++; };
    else f.gl.current = foreign;
    f.tick(1); f.key('keyup'); const s = f.snapshot(true);
    assert.equal(f.gl.current, foreign); assert.equal(s.evidenceComplete, false);
    assert.equal(f.calls.some(row => ['endQuery', 'deleteQuery'].includes(row[0]) && row[1] === 'foreign'), false);
    assert.equal(s.errors.some(row => row.where === (during ? 'end-ownership-lost' : 'foreign-active-query')), true);
  }
});
test('context loss invalidates owned handles, restoration cannot resume or poll stale objects', () => {
  const f = fixture(); f.start(); f.tick(1);
  f.gl.lost = true; f.canvas.dispatchEvent({type: 'webglcontextlost'});
  const atLoss = f.calls.length;
  f.gl.lost = false; f.canvas.dispatchEvent({type: 'webglcontextrestored'}); f.gl.available = true;
  f.tick(2); f.key('keyup'); const s = f.snapshot(true);
  assert.equal(f.calls.length, atLoss); assert.equal(f.resultCalls().length, 0);
  assert.equal(s.queries.lostAbandoned, 1); assert.equal(s.queries.deleted, 0);
  assert.equal(s.contextGeneration, 1); assert.equal(s.contextRestores, 1); assert.equal(s.evidenceComplete, false);
});
test('source mismatches and unsupported extension preserve unwrapped registration and reject coverage', () => {
  for (const option of ['wrongNative', 'wrongPacing', 'wrongFrame', 'unsupported']) {
    const f = fixture({[option]: true}); f.start(); f.tick(1); f.key('keyup'); const s = f.snapshot(true);
    assert.equal(f.sandbox.registered, f.sandbox.gameFrame, option);
    assert.equal(f.handles.length, 0); assert.equal(f.sandbox.observedCalls.length, 1);
    assert.equal(s.evidenceComplete, false); assert(s.failureRevision > 0);
  }
});
test('startup stop prevents late installation; later method owners are not overwritten', () => {
  const f = fixture({deferInstallation: true, deferRegistration: true});
  f.api.stop('source-only-early-stop'); f.snapshot(true); f.flushMicrotasks();
  assert.equal(f.sandbox.renderer.setAnimationLoop, f.sandbox.pacingSetter);
  assert.equal(f.snapshot().setup.installationMicrotasks, 0);
  const g = fixture(); g.start(); g.tick(1);
  const later = function laterOwner() {}; g.sandbox.renderer.setAnimationLoop = later;
  g.key('keyup'); const s = g.snapshot(true);
  assert.equal(g.sandbox.renderer.setAnimationLoop, later); assert.equal(s.cleanup.setterRestored, false); assert.equal(s.evidenceComplete, false);
});
test('row cap and reentrant callbacks preserve original calls and leave explicit incomplete evidence', () => {
  const f = fixture({rows: 2}); f.start(); for (let i = 1; i <= 4; i++) f.tick(i); f.key('keyup');
  const s = f.snapshot(true); assert.equal(s.stored, 2); assert.equal(s.callbackTotal, 4); assert.equal(s.rowOverflow, 2);
  assert.equal(f.sandbox.observedCalls.length, 4); assert.equal(s.evidenceComplete, false);
  const g = fixture(); g.start(); let entered = false;
  g.sandbox.gameAction = () => { if (!entered) { entered = true; g.sandbox.registered(2); } g.sandbox.renderer.info.render.frame++; };
  g.tick(1); assert.equal(g.calls.filter(row => row[0] === 'beginQuery').length, 1);
  assert.equal(g.calls.filter(row => row[0] === 'endQuery').length, 1, 'Nested observer must not lose the outer ownership token');
  g.key('keyup'); const t = g.snapshot(true); assert.equal(t.rows[1].reason, 'reentrant-callback'); assert.equal(t.evidenceComplete, false);
});
test('final snapshot without keyup and renderer disposal fail closed without swallowing the original result', () => {
  const f = fixture(); f.start(); f.tick(1); assert.equal(f.snapshot(true).evidenceComplete, false);
  const g = fixture(); g.start(); g.tick(1);
  assert.equal(g.sandbox.renderer.dispose(), g.sandbox.disposalReturn);
  assert.equal(g.snapshot().stoppedBy, 'renderer-disposed'); assert.equal(g.snapshot().cleanup.ownedHandlesClosed, true);
});
test('independent validator rejects forged promotion, source, clock, query identity and cleanup receipts', () => {
  const f = fixture(); f.start(); f.tick(1); f.gl.available = true; f.tick(2); f.key('keyup'); const original = f.snapshot(true);
  assert.equal(validateWebglTimerSnapshot(original, f.config, {final: true}).evidenceComplete, true);
  const mutate = [s => {s.distributionComplete = true;}, s => {s.invocationId = 'other';},
    s => {s.bundleSha256 = '0'.repeat(64);}, s => {s.rows[0].availableAtCallbackId = 1;},
    s => {s.rows[1].resultValid = true;}, s => {s.queries.created = 17;},
    s => {s.cleanup.setterRestored = false;}, s => {s.failureRevision = 1;},
    s => {s.rows[0].rawNanoseconds = -1;}, s => {s.rows[0].queryEndAtMs = null;},
    s => {s.functionHashes.pacingSetter = '0'.repeat(64);}];
  for (const change of mutate) { const s = structuredClone(original); change(s); assert.equal(validateWebglTimerSnapshot(s, f.config, {final: true}).evidenceComplete, false); }
});
test('build binding rejects changed, missing and duplicate main bundles before native launch', () => {
  const expected = production.bindings.bundle;
  verifyWebglTimerBuild({files: [expected]}, production);
  for (const files of [[], [expected, expected], [{...expected, sha256: '0'.repeat(64)}], [{...expected, bytes: expected.bytes + 1}]])
    assert.throws(() => verifyWebglTimerBuild({files}, production));
});
test('exclusive bounded sidecar persistence retains failures and cannot promote after abort or late completion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'webgl-timer-contract-'));
  try {
    const file = join(directory, 'snapshot.json'), snapshot = {partial: true};
    const receipt = await persistWebglTimerSnapshot(file, snapshot, production, {timeoutMs: 100});
    assert.equal(sha(await readFile(file)), receipt.sha256);
    await assert.rejects(persistWebglTimerSnapshot(file, {partial: false}, production, {timeoutMs: 100}), /EEXIST/);
    assert.deepEqual(JSON.parse(await readFile(file)), snapshot);
    let settle, ownedSignal, lateResolved = false;
    const pending = persistWebglTimerSnapshot(join(directory, 'blocked.json'), snapshot, production, {timeoutMs: 10,
      writer: async (_path, _bytes, options) => {ownedSignal = options.signal; await new Promise(done => {settle = done;}); lateResolved = true;}});
    await assert.rejects(pending, /timed out/); assert.equal(ownedSignal.aborted, true);
    settle(); await Promise.resolve(); await Promise.resolve(); assert.equal(lateResolved, true);
    await assert.rejects(pending, /timed out/, 'Late writer settlement cannot replace the rejected terminal promise');
    const controller = new AbortController(); controller.abort(Error('outer cleanup deadline'));
    await assert.rejects(persistWebglTimerSnapshot(join(directory, 'cancelled.json'), snapshot, production,
      {timeoutMs: 100, signal: controller.signal, writer: () => assert.fail('Cancelled writer must not start')}), /outer cleanup deadline/);
    await assert.rejects(persistWebglTimerSnapshot(join(directory, 'rejected.json'), snapshot, production,
      {timeoutMs: 100, writer: () => {throw Error('write rejected');}}), /write rejected/);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
