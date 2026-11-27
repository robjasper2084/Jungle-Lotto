import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {manifest, selectCase, verifyDriver, buildStatisticOnly, bounded, invalidateDiagnostic,
  finalizeDiagnostic, diagnosticStateIsClean, terminalDiagnosticReceipt, diagnosticRunIsClean,
  boundedDiagnosticCleanup} from './common.mjs';
import {installHooks} from './hooks.mjs';
import {installPageProbe} from './page-probe.mjs';

test('only the immutable originals and 2 ms sampling are selectable', () => {
  assert.deepEqual(Object.keys(manifest.cases), ['cadillac', 'armory']);
  assert.equal(selectCase('cadillac').commit, '75906273c0cd414c0d004320fc6f654b4783e5b1');
  assert.equal(selectCase('armory').commit, '1e4feafa6964f4c68b27bae07e02d102f92a2c5d');
  assert.throws(() => selectCase('current-head'));
  assert.equal(manifest.runtime.samplingIntervalUs, 2000);
  assert.equal(manifest.runtime.seconds, 90);
  assert.equal(manifest.strictDriverStepTimeoutMinutes, 28);
  assert.equal(manifest.retryCount, 0);
});
test('an altered source driver is rejected and only buildMs can differ', () => {
  assert.throws(() => verifyDriver(Buffer.from('replacement driver')));
  buildStatisticOnly({buildMs: 1, geometry: [1, 2]}, {buildMs: 2, geometry: [1, 2]});
  assert.throws(() => buildStatisticOnly({buildMs: 1, geometry: [1, 2]}, {buildMs: 2, geometry: [1, 3]}));
  assert.throws(() => buildStatisticOnly({geometry: []}, {buildMs: 2, geometry: []}));
});
test('observer timeout is explicit rather than an infinite cleanup wait', async () => {
  await assert.rejects(bounded(new Promise(() => {}), 5, 'fake observer'), /timed out/);
});

function finalState() {
  return {
    invocationId: 'same-source-only-invocation', phase: 'stopping', complete: false, partial: false,
    errors: [], errorOverflow: 0, failureRevision: 0,
    finalization: {transportClosed: false, writesHealthy: true, statusPersisted: false},
    bundleOverflow: 0, assetEventOverflow: 0, parsedScriptOverflow: 0,
    trace: {capReached: false, dataLossOccurred: false}, cpuProfile: {file: 'retained.cpuprofile'}
  };
}
function finalOptions(overrides = {}) {
  return {eligible: true, detach: async () => {}, flush: async () => {},
    writeStatus: async () => true, ...overrides};
}
test('completeness is promoted only after final detach and successful status persistence', async () => {
  const state = finalState(), order = [];
  let stored;
  assert.equal(await finalizeDiagnostic(state, finalOptions({
    detach: async () => { order.push('detach'); assert.equal(state.complete, false); },
    flush: async () => { order.push('flush'); },
    writeStatus: async snapshot => {
      order.push('write'); stored = snapshot;
      assert.equal(state.complete, false, 'In-memory status must remain incomplete while the final write is pending');
      assert.equal(snapshot.finalization.transportClosed, true);
      return true;
    }
  })), true);
  assert.deepEqual(order, ['detach', 'flush', 'write']);
  assert.equal(diagnosticStateIsClean(state), true);
  assert.equal(diagnosticRunIsClean(stored, terminalDiagnosticReceipt(state, 0), state.invocationId), true);
});
test('final detach failure preserves the CPU profile and cannot produce a complete candidate', async () => {
  const state = finalState(), profile = state.cpuProfile;
  let stored;
  assert.equal(await finalizeDiagnostic(state, finalOptions({
    detach: async () => { throw Error('transport closed during detach'); },
    writeStatus: async snapshot => { stored = snapshot; return true; }
  })), false);
  assert.strictEqual(state.cpuProfile, profile);
  assert.equal(state.complete, false); assert.equal(state.partial, true);
  assert.equal(state.finalization.transportClosed, false);
  assert(state.errors.some(error => error.where === 'final-detach'));
  assert.equal(stored.complete, false);
  assert.equal(diagnosticRunIsClean(stored, terminalDiagnosticReceipt(state, 1), state.invocationId), false);
});
test('final status write failure invalidates completeness even after successful detach', async () => {
  const state = finalState(), profile = state.cpuProfile;
  assert.equal(await finalizeDiagnostic(state, finalOptions({
    writeStatus: async () => { throw Object.assign(Error('disk full'), {code: 'ENOSPC'}); }
  })), false);
  assert.strictEqual(state.cpuProfile, profile);
  assert.equal(state.complete, false); assert.equal(state.partial, true);
  assert.equal(state.finalization.transportClosed, true);
  assert.equal(state.finalization.writesHealthy, false);
  assert.equal(state.finalization.statusPersisted, false);
  assert.match(state.ioError, /disk full/);
});
test('late asset overflow during final persistence cannot resurrect an earlier clean snapshot', async () => {
  const state = finalState();
  let releaseWrite, notifyWrite, stored;
  const reachedWrite = new Promise(resolve => { notifyWrite = resolve; });
  const pending = finalizeDiagnostic(state, finalOptions({
    writeStatus: snapshot => {
      stored = snapshot; notifyWrite();
      return new Promise(resolve => { releaseWrite = resolve; });
    }
  }));
  await reachedWrite;
  state.assetEventOverflow++;
  invalidateDiagnostic(state, 'late-asset-overflow');
  releaseWrite(true);
  assert.equal(await pending, false);
  assert.equal(stored.complete, true, 'Simulates the stale clean file already written to disk');
  assert.equal(state.complete, false); assert.equal(state.partial, true);
  assert.equal(diagnosticRunIsClean(stored, terminalDiagnosticReceipt(state, 0), state.invocationId), false);
});
test('late metadata I/O failure and contradictory stored status are rejected by runner validation', async () => {
  const state = finalState();
  await finalizeDiagnostic(state, finalOptions());
  const stored = structuredClone(state), earlierExit = terminalDiagnosticReceipt(state, 0);
  invalidateDiagnostic(state, 'late-metadata-write', Error('EIO'), {io: true});
  assert.equal(state.complete, false); assert.equal(state.partial, true);
  assert.equal(diagnosticRunIsClean(stored, terminalDiagnosticReceipt(state, 0), state.invocationId), false);
  for (const change of [
    row => { row.partial = true; },
    row => { row.errors.push({where: 'late', message: 'failure'}); },
    row => { row.ioError = 'write failed'; },
    row => { row.finalization.transportClosed = false; },
    row => { row.finalization.writesHealthy = false; },
    row => { row.finalization.statusPersisted = false; }
  ]) {
    const corrupt = structuredClone(stored); change(corrupt);
    assert.equal(diagnosticRunIsClean(corrupt, earlierExit, stored.invocationId), false);
  }
  assert.equal(diagnosticRunIsClean(stored, earlierExit, 'different-invocation'), false);
  assert.equal(diagnosticRunIsClean(stored, null, stored.invocationId), false);
});
test('cleanup deadline covers trailing persistence and never waits on the blocked queue again', async () => {
  const state = finalState();
  await finalizeDiagnostic(state, finalOptions());
  let persistenceCalls = 0, terminal;
  await bounded(boundedDiagnosticCleanup(state, {
    finish: async () => {},
    persist: () => { persistenceCalls++; return new Promise(() => {}); },
    terminal: receipt => { terminal = receipt; },
    timeoutMs: 5
  }), 100, 'cleanup contract');
  assert.equal(persistenceCalls, 1);
  assert.equal(state.complete, false); assert.equal(state.partial, true);
  assert.equal(terminal.complete, false); assert.equal(terminal.partial, true);
});

function fakeBrowser() {
  const calls = [], sessions = [];
  const context = {
    async newCDPSession(...args) {
      calls.push(['newCDPSession', args]);
      const session = {async send(...sendArgs) {
        calls.push(['send', sendArgs]);
        return {sequence: calls.length, original: true};
      }};
      sessions.push(session); return session;
    }
  };
  const pages = [];
  const browser = {
    async newPage(...args) {
      calls.push(['newPage', args]);
      const page = {context: () => context, keyboard: {original: true}};
      pages.push(page); return page;
    },
    async close(...args) { calls.push(['close', args]); return 'native-close-result'; }
  };
  const chromium = {async launch(...args) { calls.push(['launch', args]); return browser; }};
  return {calls, sessions, context, pages, browser, chromium};
}
test('c722 creation sequence is observed once; original results/args/input objects survive', async () => {
  const f = fakeBrowser(), observed = [];
  const launchOptions = {channel: 'chrome', headless: false, args: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal']};
  const gameOptions = {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: 'reduce'};
  let attachedPage;
  installHooks(f.chromium, ({page, launchArguments, pageArguments}) => {
    attachedPage = page;
    assert.strictEqual(launchArguments[0], launchOptions);
    assert.strictEqual(pageArguments[0], gameOptions);
    return {
      async attach() { observed.push('attach'); },
      async start(createSession) { observed.push('start'); await createSession(); },
      stop(reason) { observed.push(reason); return new Promise(() => {}); },
      async cleanup() { observed.push('cleanup'); },
      error(where, error) { throw Error(where + ': ' + error); }
    };
  });
  const browser = await f.chromium.launch(launchOptions);
  const probe = await browser.newPage();
  assert.equal(observed.length, 0, 'The initial WebGL probe must not be instrumented');
  const page = await browser.newPage(gameOptions);
  assert.notStrictEqual(page, probe);
  assert.strictEqual(page, attachedPage);
  const keyboard = page.keyboard;
  const session = await page.context().newCDPSession(page);
  const parameters = {untouched: true};
  assert.equal((await session.send('Performance.enable', parameters)).original, true);
  assert.equal((await session.send('Performance.getMetrics')).original, true);
  assert.deepEqual(observed, ['attach', 'start']);
  const ending = await bounded(session.send('Performance.getMetrics'), 50, 'ending metrics');
  assert.equal(ending.original, true, 'A permanently pending observer stop cannot delay ending metrics');
  assert.deepEqual(observed, ['attach', 'start', 'original-ending-metrics']);
  assert.strictEqual(page.keyboard, keyboard);
  assert.strictEqual(f.calls.find(row => row[0] === 'launch')[1][0], launchOptions);
  assert.strictEqual(f.calls.find(row => row[0] === 'send')[1][1], parameters);
  const anotherSession = await page.context().newCDPSession(page);
  await anotherSession.send('Performance.getMetrics');
  await browser.newPage(gameOptions);
  assert.equal(observed.filter(value => value === 'start').length, 1);
  assert.equal(observed.filter(value => value === 'attach').length, 1);
  const closeOptions = {reason: 'original close'};
  assert.equal(await browser.close(closeOptions), 'native-close-result');
  assert.strictEqual(f.calls.find(row => row[0] === 'close')[1][0], closeOptions);
});
test('observer startup failure cannot replace original metric result', async () => {
  const f = fakeBrowser(), errors = [];
  installHooks(f.chromium, () => ({
    async attach() {}, async start() { throw Error('observer unavailable'); },
    async stop() {}, async cleanup() {}, error(where, error) { errors.push([where, String(error)]); }
  }));
  const browser = await f.chromium.launch({});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  const session = await page.context().newCDPSession(page);
  assert.equal((await session.send('Performance.getMetrics')).original, true);
  assert.equal(errors[0][0], 'start');
});

function pageFixture(limits) {
  let now = 0, nextId = 0, performanceObserver;
  const callbacks = new Map(), events = new Map(), timingMarks = [];
  const originalReceipts = {keydowns: 7};
  const window = {__belleInputReceipts: originalReceipts}; window.top = window;
  class Element { closest() { return null; } }
  const document = {hidden: false, addEventListener(type, callback) {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(callback);
  }};
  const context = {
    window, document, Element, Float64Array, limits,
    performance: {timeOrigin: 123000, now: () => now, mark: name => timingMarks.push({name, now})},
    requestAnimationFrame(callback) { const id = ++nextId; callbacks.set(id, callback); return id; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
    PerformanceObserver: class {
      constructor(callback) { this.callback = callback; performanceObserver = this; }
      observe() {} takeRecords() { return []; }
    }
  };
  vm.runInNewContext('(' + installPageProbe.toString() + ')(limits)', context);
  return {
    observer: window.__belleNativeCpuObserver, window, originalReceipts, timingMarks,
    time(value) { now = value; },
    emit(type, event) { for (const callback of events.get(type) || []) callback(event); },
    tick(value) { now = value; const [id, callback] = callbacks.entries().next().value; callbacks.delete(id); callback(value); },
    longTasks(entries) { performanceObserver.callback({getEntries: () => entries}); }
  };
}
test('raw observer follows genuine key boundaries and records overflow without altering game receipts', () => {
  const f = pageFixture({rafSamples: 2, longTasks: 1, marks: 8});
  assert.equal(f.observer.start(), true); assert.equal(f.observer.start(), false);
  f.time(1); f.emit('keydown', {code: 'KeyW', isTrusted: false});
  f.time(2); f.emit('keydown', {code: 'KeyW', isTrusted: true});
  f.tick(16); f.tick(32); f.tick(48);
  f.longTasks([{startTime: 10, duration: 55}, {startTime: 30, duration: 60}]);
  f.time(50); f.emit('keyup', {code: 'KeyW', isTrusted: false});
  assert.equal(f.observer.snapshot().active, true);
  f.time(92); f.emit('keyup', {code: 'KeyW', isTrusted: true});
  const result = f.observer.snapshot();
  assert.equal(result.stoppedBy, 'trusted-w-keyup');
  assert.equal(result.keydowns, 1); assert.equal(result.keyups, 1);
  assert.equal(result.raf.total, 3); assert.equal(result.raf.stored, 2); assert.equal(result.raf.overflow, 1);
  assert.equal(result.longTasks.overflow, 1);
  assert.deepEqual(Array.from(result.raf.values), [16, 16, 32, 32]);
  assert.strictEqual(f.window.__belleInputReceipts, f.originalReceipts);
  assert.equal(f.originalReceipts.keydowns, 7);
  assert(f.timingMarks.some(mark => mark.name === 'belle-native-cpu:first-trusted-w'));
  assert(f.timingMarks.some(mark => mark.name === 'belle-native-cpu:trusted-w-keyup'));
});
