import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadWebglTimerConfig(manifest) {
  const plan = manifest.webglCommandSpans;
  const bytes = await readFile(new URL('./webgl-timer-bindings.json', import.meta.url));
  assert.equal(bytes.length, plan.bindings.bytes); assert.equal(digest(bytes), plan.bindings.sha256);
  const bindings = JSON.parse(bytes);
  assert.equal(bindings.sourceCommit, manifest.cases.cadillac.commit);
  assert.deepEqual(bindings.bundle, plan.bundle);
  for (const [key, row] of Object.entries(bindings.functions)) {
    assert.equal(row.text.length, row.utf16Length, key + ' UTF-16 length');
    assert.equal(Buffer.byteLength(row.text), row.utf8Bytes, key + ' byte count');
    assert.equal(digest(row.text), row.functionTextSha256, key + ' exact function text');
  }
  assert.deepEqual(Object.keys(bindings.functions), ['nativeSetter', 'pacingSetter', 'gameFrame', 'scheduler']);
  assert.deepEqual(plan.bounds, {ownedQueries: 16, rows: 8192, errors: 32, errorChars: 256, snapshotBytes: 8388608, snapshots: 8});
  return {bindings, bounds: {...plan.bounds}};
}
export function verifyWebglTimerBuild(build, config) {
  const expected = config.bindings.bundle;
  assert.deepEqual(build.files.filter(row => row.path === expected.path), [expected], 'Expected exact executed main bundle before browser launch');
}
// Each checkpoint has a unique, exclusive path. Aborted writes can leave a
// partial file but cannot overwrite a later terminal verdict or gain a receipt.
export async function persistWebglTimerSnapshot(path, snapshot, config, {signal, timeoutMs, writer = writeFile} = {}) {
  const bytes = Buffer.from(JSON.stringify(snapshot) + '\n');
  assert(bytes.length <= config.bounds.snapshotBytes, 'WebGL sidecar byte cap');
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 4000, 'Existing RPC bound must also bound sidecar persistence');
  const owned = new AbortController(), combined = signal ? AbortSignal.any([signal, owned.signal]) : owned.signal;
  combined.throwIfAborted();
  let timer, abort;
  try {
    await Promise.race([
      Promise.resolve().then(() => { combined.throwIfAborted(); return writer(path, bytes, {flag: 'wx', signal: combined}); }),
      new Promise((_, reject) => {
        abort = () => reject(combined.reason || Error('WebGL sidecar persistence aborted'));
        combined.addEventListener('abort', abort, {once: true});
        timer = setTimeout(() => owned.abort(Error('WebGL sidecar persistence timed out')), timeoutMs);
      })
    ]);
    combined.throwIfAborted();
    return {bytes: bytes.length, sha256: digest(bytes)};
  } finally {
    clearTimeout(timer); if (abort) combined.removeEventListener('abort', abort);
    owned.abort(Error('WebGL sidecar persistence scope closed'));
  }
}

// This function is serialized into the existing pre-navigation init script.
// It adds no scheduler, wait, fence, flush, readback, draw, or input operation.
export function installWebglTimerProbe(config) {
  'use strict'; // Preserve the original ES-module callback's undefined receiver.
  if (window !== window.top || '__belleWebglCommandSpanObserver' in window) return;
  const {bindings, bounds} = config;
  const reflect = Function.prototype.toString;
  const apply = Reflect.apply;
  const now = performance.now.bind(performance);
  const rows = [], errors = [], slots = [];
  const state = {
    version: 1, diagnosticOnly: true, releaseAcceptance: false,
    scope: 'synchronous-original-game-callback-webgl-command-span',
    invocationId: config.invocationId,
    sourceCommit: bindings.sourceCommit, bundleSha256: bindings.bundle.sha256,
    functionHashes: Object.fromEntries(Object.entries(bindings.functions).map(([key, value]) => [key, value.functionTextSha256])),
    bounds: {...bounds}, timeOriginMs: performance.timeOrigin,
    hardwareGpuBusyTimeAttributed: false, queuedAheadWorkMeasured: false,
    absoluteGpuTimestamps: false, callbacksAreEligibleGameFrames: false,
    setup: {rendererCount: 0, nativeSetterMatched: false, pacingSetterMatched: false,
      gameFrameMatched: false, registrationCompleted: false, installationMicrotasks: 0,
      contextMatched: false, nativeMetal: false, extensionSupported: false,
      elapsedCounterBits: null, elapsedCounterBitsType: null, elapsedCounterBitsQueries: 0, ready: false},
    armedAtMs: null, trustedStartMs: null, trustedStopMs: null, stoppedBy: null,
    keydowns: 0, keyups: 0, callbackTotal: 0, rowOverflow: 0, errorOverflow: 0,
    failureRevision: 0, contextGeneration: 0, contextLosses: 0, contextRestores: 0,
    queries: {created: 0, deleteCalls: 0, deleted: 0, lostAbandoned: 0, peakOwned: 0, peakActive: 0},
    cleanup: {finalized: false, ownedHandlesClosed: false, setterRestored: false,
      disposeRestored: false, listenersRemoved: false, devtoolsRestored: false,
      registeredCallbackRetainedInert: false},
    disabledReason: null
  };
  let renderer, gl, ext, methods, channel, ownsChannel = false;
  let setterDescriptor, disposeDescriptor, observedSetter, observedDispose;
  let activeSlot = null, inCallback = 0, querySequence = 0, previousRenderedId = null;
  let armed = false, active = false, stopped = false, finalized = false, lost = false;
  let installationQueued = false, registrationSeen = false;
  const issue = (where, error = '') => {
    state.failureRevision++;
    state.disabledReason ||= where;
    if (errors.length < bounds.errors) errors.push({where, message: String(error?.message || error).slice(0, bounds.errorChars)});
    else state.errorOverflow++;
  };
  const safe = (where, operation) => {
    try { return operation(); } catch (error) { issue(where, error); return undefined; }
  };
  const call = (name, ...args) => apply(methods[name], gl, args);
  const sourceIs = (fn, key) => typeof fn === 'function' && apply(reflect, fn, []) === bindings.functions[key].text;
  const censor = reason => {
    for (const slot of slots) if (slot.row && ['active', 'pending'].includes(slot.row.status)) {
      slot.row.status = 'censored'; slot.row.reason = reason; slot.row.resultValid = false;
    }
  };
  const invalidateAll = reason => {
    for (const row of rows) if (row.querySequence !== null) {
      row.status = 'invalid'; row.reason = reason; row.resultValid = false;
    }
  };
  function stop(reason) {
    if (stopped) return;
    stopped = true; active = false; state.stoppedBy = reason;
    if (reason !== 'trusted-w-keyup') issue('non-trusted-stop', reason);
    // No GL calls in an input listener, no result drain, and no later promotion.
    censor(reason);
  }
  function contextLost() {
    if (lost) return;
    lost = true; state.contextLosses++; state.contextGeneration++;
    issue('context-lost'); invalidateAll('context-lost');
    for (const slot of slots) if (slot.handle !== null) {
      state.queries.lostAbandoned++; slot.handle = null; slot.phase = 'lost';
    }
    activeSlot = null;
  }
  function contextRestored() { state.contextRestores++; issue('context-restored-no-resume'); }
  function healthy() {
    if (lost) return false;
    if (call('isContextLost')) { contextLost(); return false; }
    for (const [name, method] of Object.entries(methods)) if (gl[name] !== method) {
      issue('gl-method-replaced', name); return false;
    }
    return true;
  }
  function disjoint() {
    const value = call('getParameter', ext.GPU_DISJOINT_EXT);
    if (value !== false && value !== true) { issue('invalid-disjoint-value'); invalidateAll('invalid-disjoint-value'); return true; }
    if (value) { issue('gpu-disjoint'); invalidateAll('gpu-disjoint'); }
    return value;
  }
  function poll(callbackId) {
    if (!active || stopped || state.disabledReason || !healthy() || disjoint()) return;
    for (const slot of slots) {
      if (slot.phase !== 'pending' || slot.row?.status !== 'pending') continue;
      if (!active || stopped) return;
      const available = call('getQueryParameter', slot.handle, gl.QUERY_RESULT_AVAILABLE);
      if (available === false) continue;
      if (available !== true) { issue('invalid-availability-value'); invalidateAll('invalid-availability-value'); return; }
      const row = slot.row;
      row.availableAtCallbackId = callbackId; row.availableAtMs = now();
      row.availabilityEnvelopeMs = row.availableAtMs - row.queryBeginAtMs;
      // Results are read only after availability, on an already-delivered game
      // callback. No later query supplies a replacement value for this row.
      if (disjoint() || stopped || !active) return;
      const value = call('getQueryParameter', slot.handle, gl.QUERY_RESULT);
      row.rawNanoseconds = typeof value === 'number' && Number.isFinite(value) ? value : null;
      row.zeroResult = value === 0;
      if (disjoint() || stopped || !active) return;
      if (!Number.isSafeInteger(value) || value < 0 || value >= 2 ** state.setup.elapsedCounterBits) {
        issue('invalid-query-result'); row.status = 'invalid'; row.reason = 'invalid-query-result'; row.resultValid = false;
        return;
      }
      if (!Number.isFinite(row.availabilityEnvelopeMs) || row.availabilityEnvelopeMs < 0) {
        issue('invalid-availability-envelope'); row.status = 'invalid'; row.reason = 'invalid-availability-envelope'; return;
      }
      if (row.availabilityEnvelopeMs >= (2 ** state.setup.elapsedCounterBits) / 1e6) {
        // Availability can be delayed even for short GPU work. This passive
        // CPU-clock envelope conservatively censors possible counter overflow;
        // it is not another GPU duration and introduces no query or wait.
        row.status = 'censored'; row.reason = 'counter-horizon-uncertain'; row.resultValid = false;
        slot.phase = 'free'; slot.row = null; continue;
      }
      row.status = 'resolved'; row.reason = null; row.resultValid = true;
      slot.phase = 'free'; slot.row = null;
    }
  }
  function begin(row, args) {
    if (state.disabledReason) { row.reason = state.disabledReason; return; }
    if (renderer.xr?.isPresenting || args[1] != null) { issue('xr-callback-unsupported'); row.reason = 'xr-callback-unsupported'; return; }
    if (!Number.isFinite(args[0])) { issue('invalid-raf-timestamp'); row.reason = 'invalid-raf-timestamp'; return; }
    poll(row.id);
    if (!active || stopped || state.disabledReason || !healthy() || disjoint()) { row.reason = state.disabledReason || 'stopped'; return; }
    if (call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== null) {
      issue('foreign-active-query'); row.reason = 'foreign-active-query'; return;
    }
    let slot = slots.find(item => item.phase === 'free');
    if (!slot && slots.length < bounds.ownedQueries) {
      const handle = call('createQuery');
      if (!handle) { issue('query-allocation-failed'); row.reason = 'query-allocation-failed'; return; }
      slot = {id: slots.length + 1, handle, phase: 'free', row: null}; slots.push(slot);
      state.queries.created++; state.queries.peakOwned = Math.max(state.queries.peakOwned, slots.filter(item => item.handle !== null).length);
    }
    if (!slot) { row.reason = 'query-pool-exhausted'; return; }
    row.slotId = slot.id; row.querySequence = ++querySequence;
    row.queryBeginAtMs = now(); row.status = 'active'; row.reason = null;
    slot.row = row; slot.phase = 'active'; activeSlot = slot;
    // Retain ownership even if begin or the following check throws. The finally
    // path closes only this handle if CURRENT_QUERY proves it is still ours.
    call('beginQuery', ext.TIME_ELAPSED_EXT, slot.handle);
    if (call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== slot.handle) {
      issue('begin-ownership-unconfirmed'); row.status = 'invalid'; row.reason = 'begin-ownership-unconfirmed'; return;
    }
    state.queries.peakActive = 1;
  }
  function end(row, originalThrew) {
    row.originalThrew = originalThrew;
    const slot = activeSlot, ownsActive = slot?.row === row;
    try {
      if (ownsActive && slot.handle !== null && !lost) {
        if (call('isContextLost')) contextLost();
        else if (call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === slot.handle) {
          call('endQuery', ext.TIME_ELAPSED_EXT);
          if (call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === slot.handle)
            throw Error('Owned elapsed query remained active after endQuery');
          row.queryEndAtMs = now();
          slot.phase = row.status === 'active' && !stopped ? 'pending' : 'free';
          if (row.status === 'active') row.status = stopped ? 'censored' : 'pending';
          if (row.status === 'censored') row.reason ||= state.stoppedBy;
          if (slot.phase === 'free') slot.row = null;
        } else {
          issue('end-ownership-lost'); row.status = 'invalid'; row.reason = 'end-ownership-lost'; row.resultValid = false;
          slot.phase = 'uncertain';
        }
      }
    } finally {
      if (ownsActive && activeSlot === slot) activeSlot = null;
      row.callbackExitMs = now();
      row.renderFrameAfter = renderer.info.render.frame;
      row.rendered = Number.isSafeInteger(row.renderFrameBefore) && Number.isSafeInteger(row.renderFrameAfter) && row.renderFrameAfter > row.renderFrameBefore;
      if (row.rendered) previousRenderedId = row.id;
      if (originalThrew) issue('original-game-callback-threw');
    }
  }
  function wrapCallback(original) {
    return function (...args) {
      if (!active || stopped || finalized) return apply(original, this, args);
      const id = ++state.callbackTotal;
      let row = null, completed = false;
      safe('callback-entry', () => {
        if (rows.length >= bounds.rows) { state.rowOverflow++; state.disabledReason ||= 'row-cap'; return; }
        row = {id, previousCallbackId: id > 1 ? id - 1 : null, previousRenderedCallbackId: previousRenderedId,
          generation: state.contextGeneration, rafTimestampMs: Number.isFinite(args[0]) ? args[0] : null,
          callbackEntryMs: now(), callbackExitMs: null, renderFrameBefore: null,
          renderFrameAfter: null, rendered: false, originalThrew: false,
          slotId: null, querySequence: null, queryBeginAtMs: null, queryEndAtMs: null,
          availableAtCallbackId: null, availableAtMs: null, availabilityEnvelopeMs: null, rawNanoseconds: null, zeroResult: false,
          resultValid: false, status: 'uncovered', reason: 'not-admitted'};
        rows.push(row);
        row.renderFrameBefore = renderer.info.render.frame;
        if (inCallback > 0) { issue('reentrant-callback'); row.reason = 'reentrant-callback'; return; }
        begin(row, args);
      });
      inCallback++;
      try { const result = apply(original, this, args); completed = true; return result; }
      finally {
        inCallback--;
        if (row) safe('callback-exit', () => end(row, !completed));
      }
    };
  }
  function restoreProperty(key, owned, descriptor) {
    if (!owned || !descriptor) return false;
    const current = Object.getOwnPropertyDescriptor(renderer, key);
    if (!current || current.value !== owned) { issue('property-ownership-lost', key); return false; }
    Object.defineProperty(renderer, key, descriptor); return true;
  }
  function cleanup() {
    if (finalized) return;
    finalized = true; state.cleanup.finalized = true;
    if (!stopped) stop('final-snapshot-without-trusted-keyup');
    state.cleanup.registeredCallbackRetainedInert = registrationSeen;
    for (const slot of slots) if (slot.handle !== null) safe('owned-query-delete', () => {
      if (lost || call('isContextLost')) { contextLost(); return; }
      const current = call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY);
      if (current === slot.handle) {
        // This is disposal of our active object, never a foreign elapsed query.
        call('endQuery', ext.TIME_ELAPSED_EXT);
        if (call('getQuery', ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === slot.handle)
          throw Error('Cannot delete a still-active owned query');
      }
      state.queries.deleteCalls++; call('deleteQuery', slot.handle);
      if (call('isQuery', slot.handle)) throw Error('Owned query deletion was not observed');
      state.queries.deleted++; slot.handle = null; slot.row = null; slot.phase = 'deleted';
    });
    state.cleanup.ownedHandlesClosed = slots.every(slot => slot.handle === null) && inCallback === 0;
    safe('restore-setter', () => { state.cleanup.setterRestored = restoreProperty('setAnimationLoop', observedSetter, setterDescriptor); });
    safe('restore-dispose', () => { state.cleanup.disposeRestored = restoreProperty('dispose', observedDispose, disposeDescriptor); });
    safe('remove-listeners', () => {
      document.removeEventListener('keydown', keydown, true); document.removeEventListener('keyup', keyup, true);
      renderer?.domElement?.removeEventListener('webglcontextlost', contextLost);
      renderer?.domElement?.removeEventListener('webglcontextrestored', contextRestored);
      channel?.removeEventListener('observe', observe); state.cleanup.listenersRemoved = true;
    });
    safe('restore-devtools', () => {
      if (ownsChannel) {
        const current = Object.getOwnPropertyDescriptor(window, '__THREE_DEVTOOLS__');
        if (!current || current.value !== channel) { issue('devtools-ownership-lost'); return; }
        delete window.__THREE_DEVTOOLS__;
      }
      state.cleanup.devtoolsRestored = true;
    });
  }
  function installAfterPacing() {
    if (stopped || finalized) return;
    safe('install-after-pacing', () => {
      state.setup.installationMicrotasks++;
      setterDescriptor = Object.getOwnPropertyDescriptor(renderer, 'setAnimationLoop');
      disposeDescriptor = Object.getOwnPropertyDescriptor(renderer, 'dispose');
      if (!setterDescriptor?.writable || !setterDescriptor.configurable || !disposeDescriptor?.writable || !disposeDescriptor.configurable)
        throw Error('Renderer methods are not owned mutable data properties');
      if (!sourceIs(setterDescriptor.value, 'pacingSetter')) throw Error('Original browser-pacing setter signature mismatch');
      state.setup.pacingSetterMatched = true;
      const setter = setterDescriptor.value, dispose = disposeDescriptor.value;
      observedSetter = function (...args) {
        let forwarded = args;
        safe('registration-observer', () => {
          if (stopped || finalized) return;
          if (args[0] === null) { stop('animation-loop-null'); return; }
          if (registrationSeen || !sourceIs(args[0], 'gameFrame')) {
            issue('game-frame-signature-or-registration-mismatch'); stop('registration-mismatch'); return;
          }
          registrationSeen = true; state.setup.gameFrameMatched = true;
          forwarded = [wrapCallback(args[0]), ...args.slice(1)];
        });
        const result = apply(setter, this, forwarded);
        if (forwarded !== args) state.setup.registrationCompleted = true;
        return result;
      };
      observedDispose = function (...args) {
        safe('renderer-dispose', () => { if (!stopped) stop('renderer-disposed'); cleanup(); });
        return apply(dispose, this, args);
      };
      Object.defineProperty(renderer, 'setAnimationLoop', {...setterDescriptor, value: observedSetter});
      Object.defineProperty(renderer, 'dispose', {...disposeDescriptor, value: observedDispose});
      state.setup.ready = true;
    });
  }
  function observe(event) {
    if (stopped || finalized) return;
    safe('renderer-observe', () => {
      const value = event.detail;
      if (!value?.isWebGLRenderer || value.domElement !== document.getElementById('game')) return;
      state.setup.rendererCount++;
      if (renderer || installationQueued) throw Error('More than one target renderer was observed');
      renderer = value;
      if (!sourceIs(renderer.setAnimationLoop, 'nativeSetter')) throw Error('Native Three setter signature mismatch');
      state.setup.nativeSetterMatched = true;
      gl = renderer.getContext();
      if (!(gl instanceof WebGL2RenderingContext) || gl.canvas !== renderer.domElement) throw Error('Target is not the existing game WebGL2 context');
      state.setup.contextMatched = true;
      const names = ['getExtension', 'getParameter', 'getQuery', 'getQueryParameter', 'createQuery', 'beginQuery', 'endQuery', 'deleteQuery', 'isQuery', 'isContextLost'];
      methods = Object.fromEntries(names.map(name => {
        if (typeof gl[name] !== 'function') throw Error('Missing WebGL2 query method ' + name);
        return [name, gl[name]];
      }));
      const debug = call('getExtension', 'WEBGL_debug_renderer_info');
      const gpu = debug && call('getParameter', debug.UNMASKED_RENDERER_WEBGL);
      state.setup.rendererString = typeof gpu === 'string' ? gpu.slice(0, 512) : null;
      if (typeof gpu !== 'string' || !/Apple/.test(gpu) || !/ANGLE/.test(gpu) || !/Metal/.test(gpu)) throw Error('Only the original native Apple ANGLE Metal context is supported');
      state.setup.nativeMetal = true;
      ext = call('getExtension', 'EXT_disjoint_timer_query_webgl2');
      if (!ext || ext.TIME_ELAPSED_EXT !== 0x88bf || ext.GPU_DISJOINT_EXT !== 0x8fbb || ext.QUERY_COUNTER_BITS_EXT !== 0x8864)
        throw Error('EXT_disjoint_timer_query_webgl2 is unsupported');
      state.setup.extensionSupported = true;
      state.setup.elapsedCounterBitsQueries++;
      const bits = call('getQuery', ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT);
      state.setup.elapsedCounterBitsType = typeof bits;
      state.setup.elapsedCounterBits = typeof bits === 'number' && Number.isFinite(bits) ? bits : null;
      // Khronos allows zero (no useful elapsed counter); nonzero widths have a
      // minimum of30. The conservative upper64 bound matches GLuint64 results.
      if (!Number.isInteger(bits) || bits < 30 || bits > 64) throw Error('Unsupported or malformed elapsed counter width');
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
      installationQueued = true;
      // main.ts synchronously installs browser pacing, then awaits createWorld,
      // before registering the exact game frame. This adds no per-frame task.
      queueMicrotask(installAfterPacing);
    });
  }
  function keydown(event) {
    if (!armed || stopped || !event.isTrusted || event.code !== 'KeyW') return;
    state.keydowns++;
    if (state.trustedStartMs === null) { state.trustedStartMs = now(); active = true; }
  }
  function keyup(event) {
    if (!active || stopped || !event.isTrusted || event.code !== 'KeyW') return;
    state.keyups++; state.trustedStopMs = now(); stop('trusted-w-keyup');
  }
  function snapshot(final = false) {
    if (final) safe('final-cleanup', cleanup);
    const counts = Object.fromEntries(['resolved', 'pending', 'active', 'uncovered', 'censored', 'invalid'].map(status => [status, 0]));
    for (const row of rows) counts[row.status]++;
    const evidenceComplete = !!(finalized && state.setup.ready && state.setup.registrationCompleted &&
      state.setup.elapsedCounterBitsQueries === 1 && Number.isInteger(state.setup.elapsedCounterBits) &&
      state.setup.elapsedCounterBits >= 30 && state.setup.elapsedCounterBits <= 64 &&
      state.setup.rendererCount === 1 && state.keydowns > 0 && state.keyups === 1 && state.stoppedBy === 'trusted-w-keyup' &&
      state.callbackTotal > 0 && !state.rowOverflow && !state.failureRevision && !state.errorOverflow &&
      state.cleanup.ownedHandlesClosed && state.cleanup.setterRestored && state.cleanup.disposeRestored &&
      state.cleanup.listenersRemoved && state.cleanup.devtoolsRestored && !counts.active && !counts.pending);
    return JSON.parse(JSON.stringify({...state, active, stopped, stored: rows.length, counts,
      queries: {...state.queries, live: slots.filter(slot => slot.handle !== null).length},
      errors, rows, evidenceComplete,
      distributionComplete: evidenceComplete && counts.resolved === rows.length,
      gpuClockIntervalsAvailable: counts.resolved > 0,
      note: 'Raw GPU-clock intervals of synchronous delivered original game callbacks only. They include command submission gaps, exclude work queued before the begin marker, have no absolute GPU clock mapping, and cannot attribute hardware GPU busy time or compositor waits. A zero value is retained as zero/resolution-limited, never substituted. Original eligibility and workload verdict remain separate.'}));
  }
  Object.defineProperty(window, '__belleWebglCommandSpanObserver', {value: Object.freeze({
    arm() {
      if (armed || stopped || finalized) return false;
      armed = true; state.armedAtMs = now();
      if (!state.setup.ready || !state.setup.registrationCompleted) issue('arm-before-verified-registration');
      return state.failureRevision === 0;
    }, stop, snapshot
  })});
  safe('observer-installation', () => {
    const existing = Object.getOwnPropertyDescriptor(window, '__THREE_DEVTOOLS__');
    if (existing) {
      if (!Object.hasOwn(existing, 'value') || !(existing.value instanceof EventTarget)) throw Error('Foreign Three devtools channel is incompatible');
      channel = existing.value;
    } else {
      if ('__THREE_DEVTOOLS__' in window) throw Error('Inherited Three devtools channel is not owned');
      channel = new EventTarget(); ownsChannel = true;
      Object.defineProperty(window, '__THREE_DEVTOOLS__', {value: channel, writable: true, configurable: true});
    }
    channel.addEventListener('observe', observe);
    document.addEventListener('keydown', keydown, true); document.addEventListener('keyup', keyup, true);
  });
}

// Independent bounded sidecar validation. Complete bookkeeping can contain
// correctly censored rows; it must never imply a complete span distribution.
export function validateWebglTimerSnapshot(snapshot, config, {final = false} = {}) {
  const failures = [];
  const require = (value, label) => { if (!value && failures.length < 64) failures.push(label); };
  const s = snapshot, b = config.bounds;
  if (!s || typeof s !== 'object') return {valid: false, evidenceComplete: false, distributionComplete: false, failures: ['missing sidecar']};
  require(s.version === 1 && s.diagnosticOnly === true && s.releaseAcceptance === false, 'diagnostic identity');
  require(s.scope === 'synchronous-original-game-callback-webgl-command-span', 'measurement scope');
  require(typeof config.invocationId === 'string' && config.invocationId.length > 0 && s.invocationId === config.invocationId, 'invocation identity');
  require(s.sourceCommit === config.bindings.sourceCommit && s.bundleSha256 === config.bindings.bundle.sha256, 'immutable source binding');
  for (const [key, value] of Object.entries(config.bindings.functions)) require(s.functionHashes?.[key] === value.functionTextSha256, 'function binding ' + key);
  require(JSON.stringify(s.bounds) === JSON.stringify(b), 'fixed bounds');
  for (const key of ['hardwareGpuBusyTimeAttributed', 'queuedAheadWorkMeasured', 'absoluteGpuTimestamps', 'callbacksAreEligibleGameFrames']) require(s[key] === false, key);
  const statuses = ['resolved', 'pending', 'active', 'uncovered', 'censored', 'invalid'];
  const counterSupported = s.setup?.elapsedCounterBitsQueries === 1 && s.setup.elapsedCounterBitsType === 'number' &&
    Number.isInteger(s.setup.elapsedCounterBits) && s.setup.elapsedCounterBits >= 30 && s.setup.elapsedCounterBits <= 64;
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));
  require(Array.isArray(s.rows) && s.rows.length <= b.rows, 'row bound');
  const rows = Array.isArray(s.rows) ? s.rows.slice(0, b.rows) : [];
  require(s.stored === rows.length && Number.isSafeInteger(s.callbackTotal) && Number.isSafeInteger(s.rowOverflow) &&
    s.rowOverflow >= 0 && s.callbackTotal === s.stored + s.rowOverflow, 'callback accounting');
  let lastQuery = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    require(row.id === i + 1 && row.previousCallbackId === (i ? i : null), 'callback identity');
    require(statuses.includes(row.status), 'row status');
    if (statuses.includes(row.status)) counts[row.status]++;
    require(Number.isFinite(row.rafTimestampMs) && Number.isFinite(row.callbackEntryMs), 'callback clocks');
    require(Number.isFinite(row.callbackExitMs) && row.callbackExitMs >= row.callbackEntryMs, 'callback exit');
    require(Number.isSafeInteger(row.renderFrameBefore) && Number.isSafeInteger(row.renderFrameAfter) &&
      row.rendered === (row.renderFrameAfter > row.renderFrameBefore), 'original render counter');
    if (row.querySequence !== null) {
      require(Number.isSafeInteger(row.slotId) && row.slotId >= 1 && row.slotId <= b.ownedQueries &&
        Number.isSafeInteger(row.querySequence) && row.querySequence > lastQuery, 'query identity');
      lastQuery = row.querySequence;
      require(Number.isFinite(row.queryBeginAtMs), 'query begin clock');
    }
    if (row.status === 'resolved') require(counterSupported && row.querySequence !== null && Number.isFinite(row.queryBeginAtMs) &&
      row.resultValid === true && Number.isSafeInteger(row.rawNanoseconds) && row.rawNanoseconds >= 0 &&
      row.rawNanoseconds < 2 ** s.setup.elapsedCounterBits &&
      row.zeroResult === (row.rawNanoseconds === 0) && Number.isSafeInteger(row.availableAtCallbackId) &&
      row.availableAtCallbackId > row.id && row.availableAtCallbackId <= s.callbackTotal &&
      Number.isFinite(row.queryEndAtMs) && row.queryEndAtMs >= row.queryBeginAtMs &&
      Number.isFinite(row.availableAtMs) && row.availableAtMs >= row.queryEndAtMs &&
      Number.isFinite(row.availabilityEnvelopeMs) && row.availabilityEnvelopeMs === row.availableAtMs - row.queryBeginAtMs &&
      row.availabilityEnvelopeMs >= 0 && row.availabilityEnvelopeMs < (2 ** s.setup.elapsedCounterBits) / 1e6 &&
      row.reason === null, 'resolved query receipt');
    else require(row.resultValid === false, 'unresolved row cannot be valid');
    if (row.status === 'censored' && row.reason === 'counter-horizon-uncertain') require(counterSupported &&
      row.querySequence !== null && Number.isFinite(row.queryBeginAtMs) &&
      Number.isSafeInteger(row.rawNanoseconds) && row.rawNanoseconds >= 0 && row.rawNanoseconds < 2 ** s.setup.elapsedCounterBits &&
      row.zeroResult === (row.rawNanoseconds === 0) && Number.isSafeInteger(row.availableAtCallbackId) &&
      row.availableAtCallbackId > row.id && row.availableAtCallbackId <= s.callbackTotal &&
      Number.isFinite(row.queryEndAtMs) && row.queryEndAtMs >= row.queryBeginAtMs &&
      Number.isFinite(row.availableAtMs) && row.availableAtMs >= row.queryEndAtMs &&
      Number.isFinite(row.availabilityEnvelopeMs) && row.availabilityEnvelopeMs === row.availableAtMs - row.queryBeginAtMs &&
      row.availabilityEnvelopeMs >= (2 ** s.setup.elapsedCounterBits) / 1e6, 'counter-horizon censorship receipt');
  }
  for (const status of statuses) require(s.counts?.[status] === counts[status], 'status accounting ' + status);
  const q = s.queries;
  require(q && ['created', 'deleteCalls', 'deleted', 'lostAbandoned', 'live', 'peakOwned', 'peakActive'].every(key => Number.isSafeInteger(q[key]) && q[key] >= 0), 'query counters');
  if (q) require(q.created <= b.ownedQueries && q.peakOwned <= b.ownedQueries && q.peakActive <= 1 &&
    q.created === q.deleted + q.lostAbandoned + q.live && q.deleted <= q.deleteCalls, 'query ownership accounting');
  require(Array.isArray(s.errors) && s.errors.length <= b.errors && Number.isSafeInteger(s.failureRevision) &&
    Number.isSafeInteger(s.errorOverflow) && s.failureRevision === s.errors.length + s.errorOverflow, 'failure accounting');
  const clean = s.cleanup;
  const evidence = !!(final && clean?.finalized && clean.ownedHandlesClosed && clean.setterRestored && clean.disposeRestored &&
    clean.listenersRemoved && clean.devtoolsRestored && clean.registeredCallbackRetainedInert &&
    s.setup?.ready && s.setup.rendererCount === 1 && s.setup.installationMicrotasks === 1 && s.setup.nativeSetterMatched &&
    s.setup.pacingSetterMatched && s.setup.gameFrameMatched && s.setup.registrationCompleted &&
    s.setup.contextMatched && s.setup.nativeMetal && s.setup.extensionSupported && counterSupported && s.keydowns > 0 && s.keyups === 1 &&
    s.stoppedBy === 'trusted-w-keyup' && s.stopped && !s.active && Number.isFinite(s.armedAtMs) &&
    Number.isFinite(s.trustedStartMs) && Number.isFinite(s.trustedStopMs) && s.trustedStartMs >= s.armedAtMs &&
    s.trustedStopMs >= s.trustedStartMs && s.callbackTotal > 0 && s.rowOverflow === 0 &&
    s.failureRevision === 0 && s.errorOverflow === 0 && s.contextLosses === 0 && s.contextRestores === 0 &&
    q?.live === 0 && !counts.active && !counts.pending);
  if (final) require(s.evidenceComplete === evidence, 'terminal evidence verdict');
  else require(s.evidenceComplete === false && s.distributionComplete === false, 'periodic snapshot is not terminal');
  const distribution = evidence && counts.resolved === rows.length;
  if (final) require(s.distributionComplete === distribution, 'distribution verdict');
  require(s.gpuClockIntervalsAvailable === (counts.resolved > 0), 'resolved availability');
  return {valid: failures.length === 0, evidenceComplete: failures.length === 0 && evidence,
    distributionComplete: failures.length === 0 && distribution, counts, failures};
}
