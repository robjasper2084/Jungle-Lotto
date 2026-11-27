import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter, once} from 'node:events';
import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {manifest, selectCase, verifyDriver, buildStatisticOnly, bounded, invalidateDiagnostic, sha256,
  finalizeDiagnostic, diagnosticStateIsClean, terminalDiagnosticReceipt, diagnosticRunIsClean,
  boundedDiagnosticCleanup, traceCategoryRequest, summarizeTraceTopology, ownedTransportsClosed} from './common.mjs';
import {installHooks} from './hooks.mjs';
import {installPageProbe} from './page-probe.mjs';
import {createTraceFinalizationScope, createTraceTopologyAccumulator, indexTraceSource, indexTraceFile, reconcileTracePasses} from './trace-index.mjs';
import {scanTraceStream} from './trace-parser.mjs';

test('only original 210 and the fixed compositor categories are selectable', () => {
  assert.deepEqual(Object.keys(manifest.cases), ['cadillac']);
  assert.equal(selectCase('cadillac').commit, '75906273c0cd414c0d004320fc6f654b4783e5b1');
  assert.throws(() => selectCase('armory'));
  assert.throws(() => selectCase('current-head'));
  assert.deepEqual(manifest.trace.categories, ['cc', 'viz', 'gpu', 'toplevel', 'toplevel.flow', 'devtools.timeline', 'blink.user_timing']);
  assert.deepEqual(traceCategoryRequest([...manifest.trace.categories, 'unrequested']).requestedCategories, manifest.trace.categories);
  assert.equal(manifest.trace.gpuExecutionMeasured, false);
  assert.equal(manifest.trace.transport, 'browser.newBrowserCDPSession');
  assert.equal(manifest.trace.processScope, 'browser-root/all-browser-processes');
  assert.equal(manifest.transportOwnership.creationTimeoutMs, manifest.bounds.protocolTimeoutMs);
  assert.equal(manifest.transportOwnership.detachAndCloseTimeoutMs, 2000);
  assert.equal(manifest.transportOwnership.originalPageAndContextClosureDelayed, false);
  assert.equal(manifest.bounds.traceBufferKiB * 1024, 512 * 1024 * 1024);
  assert.equal(manifest.bounds.traceFileBytes, 1024 * 1024 * 1024);
  assert.equal(manifest.bounds.traceDrainTimeoutMs, 120000);
  assert.equal(manifest.trace.finalizationBudget.milliseconds, manifest.bounds.traceDrainTimeoutMs);
  assert.equal(manifest.trace.finalizationBudget.start, 'Tracing.end issuance');
  assert.equal(manifest.trace.finalizationBudget.renewedOnStreamArrival, false);
  assert.equal(manifest.trace.finalizationBudget.individualRpcTimeoutMs, 4000);
  assert.equal(manifest.bounds.captureWatchdogMs, 110000);
  assert.equal(manifest.bounds.protocolTimeoutMs, 4000);
  assert.equal(manifest.bounds.cleanupTimeoutMs, 10000);
  assert.equal(manifest.runtime.samplingIntervalUs, 2000);
  assert.equal(manifest.runtime.seconds, 90);
  assert.equal(manifest.strictDriverStepTimeoutMinutes, 28);
  assert.equal(manifest.retryCount, 0);
});
test('empty or incomplete enumeration yields an explicit advisory receipt and never drops a requested category', () => {
  for (const available of [[], ['cc'], [...manifest.trace.categories]]) {
    const original = [...available], request = traceCategoryRequest(available);
    assert.deepEqual(available, original);
    assert.deepEqual(request.requestedCategories, manifest.trace.categories);
    assert.equal(request.enumeratedCategoryCount, available.length);
    assert.equal(request.enumerationIsCapabilityProof, false);
    assert.equal(request.requiredEvidenceScope, 'trusted-W-window');
    assert.equal(request.enumerationComplete, available.length === 7);
    if (available.length === 7) assert.equal(request.warning, null);
    else {
      assert.match(request.warning, /exactly once/);
      assert.equal(request.missingFromEnumeration.length, 7 - available.length);
    }
  }
  assert.equal(manifest.trace.semanticReference.allRequiredCategoriesEnumerated, true);
  assert.equal(manifest.trace.semanticReference.allRequiredCategoriesObserved, undefined);
  assert.deepEqual(manifest.trace.semanticReference.requiredCategoriesObservedInReferenceTrace, ['devtools.timeline', 'blink.user_timing']);
});
test('malformed enumeration fails instead of being converted into an empty advisory list', () => {
  for (const value of [undefined, null, {}, 'cc', ['cc', null], ['cc', 7], ['cc', {}]]) {
    assert.throws(() => traceCategoryRequest(value), /Tracing.getCategories/);
  }
});
test('audited page, input and ending-metrics hooks remain byte-identical to ac88', async () => {
  for (const [file, expected] of Object.entries(manifest.preservedObserverFiles)) {
    assert.equal(sha256(await readFile(new URL(file, import.meta.url))), expected, file);
  }
});
test('the standalone workflow contains one immutable original-210 job and no retry matrix', async () => {
  const workflow = await readFile(new URL('../../workflows/belle-native-compositor-diagnostic.yml', import.meta.url), 'utf8');
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  assert.deepEqual([...jobs.matchAll(/^  ([a-z_]+):$/gm)].map(match => match[1]), ['cadillac_original']);
  assert(workflow.includes('ref: 75906273c0cd414c0d004320fc6f654b4783e5b1'));
  assert(workflow.includes('github.run_attempt == 1'));
  assert(workflow.includes('timeout-minutes: 28'));
  assert(!/matrix:|armory|1e4feafa|native-cpu\//.test(workflow));
});

function traceFixture() {
  return [
    {ph: 'M', name: 'process_name', pid: 1, tid: 0, args: {name: 'Renderer'}},
    {ph: 'M', name: 'thread_name', pid: 1, tid: 10, args: {name: 'CrRendererMain'}},
    {ph: 'M', name: 'process_name', pid: 2, tid: 0, args: {name: 'GPU Process'}},
    {ph: 'M', name: 'thread_name', pid: 2, tid: 20, args: {name: 'CrGpuMain'}},
    {ph: 'M', name: 'thread_name', pid: 2, tid: 21, args: {name: 'VizCompositorThread'}},
    {ph: 'M', name: 'process_name', pid: 3, tid: 0, args: {name: 'Browser'}},
    {ph: 'M', name: 'thread_name', pid: 3, tid: 30, args: {name: 'CrBrowserMain'}},
    {ph: 'R', name: 'belle-native-cpu:first-trusted-w', cat: 'blink.user_timing', ts: 100, pid: 1, tid: 10},
    {ph: 'X', name: 'FireAnimationFrame', cat: 'devtools.timeline', ts: 105, dur: 10, pid: 1, tid: 10},
    {ph: 'X', name: 'ThreadControllerImpl::RunTask', cat: 'toplevel', ts: 106, dur: 3, pid: 3, tid: 30},
    {ph: 'X', name: 'Scheduler::RunTask', cat: 'gpu,toplevel.flow', ts: 120, dur: 5, pid: 2, tid: 20,
      bind_id: '0xffffffffffffffff', flow_in: true},
    {ph: 's', name: 'Graphics.Pipeline', cat: 'viz', ts: 130, pid: 2, tid: 21, id2: {global: '0xabcdef1234567890'}},
    {ph: 'X', name: 'Display::DrawAndSwap', cat: 'viz', ts: 140, dur: 3, pid: 2, tid: 21},
    {ph: 'b', name: 'PipelineReporter', cat: 'cc,benchmark,disabled-by-default-devtools.timeline.frame', ts: 110, pid: 1, tid: 10, id: '0x8'},
    {ph: 'R', name: 'belle-native-cpu:trusted-w-keyup', cat: 'blink.user_timing', ts: 200, pid: 1, tid: 10}
  ];
}
test('cross-process index keeps raw metadata and never rewrites large flow identifiers', () => {
  const rows = traceFixture(), unchanged = JSON.stringify(rows);
  const topology = summarizeTraceTopology(rows, manifest.bounds);
  assert.equal(topology.available, true);
  assert.equal(topology.gpuExecutionMeasured, false);
  assert.equal(topology.gpuServiceEvents, 1);
  assert.equal(topology.vizEvents, 2);
  assert.equal(topology.pipelineReporters, 1);
  assert.equal(topology.windowFlowRecords, 2);
  assert.equal(topology.windowGpuFlowRecords, 1);
  assert.equal(topology.windowVizFlowRecords, 1);
  assert.equal(topology.flowFields.bind_id, 1);
  assert.equal(topology.flowFields.id2, 1);
  assert.equal(topology.metadata.find(row => row.tid === 20).args.name, 'CrGpuMain');
  assert.equal(JSON.stringify(rows), unchanged, 'Derived index must not normalize the raw flow IDs');
});
test('incomplete enumeration cannot certify missing trusted-window categories using startup or shutdown events', () => {
  const request = traceCategoryRequest(['cc']);
  assert(request.warning);
  assert.deepEqual(request.requestedCategories, manifest.trace.categories);
  const rows = traceFixture().map(row => row.cat?.includes('toplevel.flow') ? {...row, cat: 'gpu'} : row);
  rows.push(
    {ph: 'I', name: 'Before ride', cat: 'toplevel.flow', ts: 99, pid: 3, tid: 30},
    {ph: 'I', name: 'After ride', cat: 'toplevel.flow', ts: 201, pid: 3, tid: 30}
  );
  const topology = summarizeTraceTopology(rows, manifest.bounds);
  assert.equal(topology.categories['toplevel.flow'], 2);
  assert.equal(topology.requiredCategoryCounts['toplevel.flow'], 0);
  assert.equal(topology.requirements.namedGpuServiceTrackOutsideRenderer, true);
  assert.equal(topology.requirements.namedVizTrackOutsideRenderer, true);
  assert.equal(topology.requirements.gpuFlowsPresentInTrustedWindow, true);
  assert.equal(topology.requirements.vizFlowsPresentInTrustedWindow, true);
  assert.equal(topology.requirements.allRequiredCategoriesPresentInTrustedWindow, false);
  assert.equal(topology.available, false);
});
test('actual category coverage accepts valid instant toplevel.flow events inside the trusted window', () => {
  const rows = traceFixture().map(row => row.cat?.includes('toplevel.flow') ? {...row, cat: 'gpu'} : row);
  rows.push({ph: 'I', name: 'Task posted', cat: 'toplevel.flow', ts: 150, pid: 3, tid: 30,
    bind_id: '0xfeed1234567890', flow_out: true});
  const topology = summarizeTraceTopology(rows, manifest.bounds);
  assert.equal(topology.requiredCategoryCounts['toplevel.flow'], 1);
  assert.equal(topology.requirements.allRequiredCategoriesPresentInTrustedWindow, true);
  assert.equal(topology.available, true);
});
test('missing GPU/Viz names, missing flows or metadata overflow cannot certify cross-process coverage', () => {
  const complete = traceFixture();
  const noNames = complete.filter(row => row.ph !== 'M' || row.pid !== 2);
  const noFlows = complete.map(row => {
    const copy = {...row};
    for (const field of ['id', 'id2', 'bind_id', 'flow_in', 'flow_out']) delete copy[field];
    if (copy.ph === 's') copy.ph = 'i';
    return copy;
  });
  for (const [rows, limits] of [[noNames, manifest.bounds], [noFlows, manifest.bounds],
    [complete, {...manifest.bounds, traceMetadataRows: 1}], [complete, {...manifest.bounds, traceTracks: 1}]]) {
    const topology = summarizeTraceTopology(rows, limits);
    assert.equal(topology.available, false);
    assert(Object.values(topology.requirements).includes(false));
  }
  const outside = complete.map(row => row.cat?.includes('gpu') ? {...row, ts: 201} : row);
  assert.equal(summarizeTraceTopology(outside, manifest.bounds).requirements.namedGpuServiceTrackOutsideRenderer, false);
  const rendererFlowsOnly = complete.map(row => row.bind_id || row.id2 ? {...row, cat: 'devtools.timeline', pid: 1, tid: 10} : row);
  const oldFlowCoverage = summarizeTraceTopology(rendererFlowsOnly, manifest.bounds);
  assert(oldFlowCoverage.windowFlowRecords > 0);
  assert.equal(oldFlowCoverage.requirements.gpuFlowsPresentInTrustedWindow, false);
  assert.equal(oldFlowCoverage.requirements.vizFlowsPresentInTrustedWindow, false);
  assert.equal(summarizeTraceTopology(complete.filter(row => row.pid !== 3), manifest.bounds).requirements.namedBrowserTaskTrackPresent, false);
});
test('renderer-only gpu/viz flows cannot borrow unrelated named outside-renderer service tracks', () => {
  const rows = traceFixture();
  const outsideWithoutFlows = rows.map(row => {
    const copy = {...row};
    for (const field of ['id', 'id2', 'bind_id', 'flow_in', 'flow_out']) delete copy[field];
    if (copy.ph === 's') copy.ph = 'i';
    return copy;
  });
  const rendererFlows = rows.filter(row => row.bind_id || row.id2)
    .map(row => ({...row, pid: 1, tid: 10}));
  assert(rendererFlows.some(row => row.cat.includes('gpu')));
  assert(rendererFlows.some(row => row.cat.includes('viz')));
  const topology = summarizeTraceTopology([...outsideWithoutFlows, ...rendererFlows], manifest.bounds);
  assert.equal(topology.requirements.namedGpuServiceTrackOutsideRenderer, true);
  assert.equal(topology.requirements.namedVizTrackOutsideRenderer, true);
  assert(topology.windowFlowRecords > 0);
  assert.equal(topology.windowGpuFlowRecords, 0);
  assert.equal(topology.windowVizFlowRecords, 0);
  assert.deepEqual(topology.qualifyingGpuFlowTracks, []);
  assert.deepEqual(topology.qualifyingVizFlowTracks, []);
  assert.equal(topology.available, false);
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
    transports: Object.fromEntries(['page', 'browserTrace'].map(name => [name, {
      created: true, creationTimedOut: false, detachCalls: 1, detachAcknowledged: true,
      closeObserved: true, closed: true, unexpectedClose: false
    }])), lifecycle: {},
    bundleOverflow: 0, assetEventOverflow: 0, parsedScriptOverflow: 0,
    trace: {capReached: false, dataLossOccurred: false}, cpuProfile: {file: 'retained.cpuprofile'}
  };
}
function finalOptions(overrides = {}) {
  return {eligible: true, detach: async () => {}, flush: async () => {},
    writeStatus: async () => true, ...overrides};
}
async function startupMonitorFixture({response = {categories: []}, failAt = null} = {}) {
  const source = await readFile(new URL('./preload.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('class NativeMonitor {'), end = source.indexOf('\ninstallHooks(', start);
  const state = finalState(), calls = [], saved = [], events = [];
  let observerStarts = 0;
  const NativeMonitor = vm.runInNewContext(source.slice(start, end) + '\nNativeMonitor;', {
    assert, Buffer, resolve, state, createTraceFinalizationScope, indexTraceFile, manifest, limits: manifest.bounds, output: '/source-only-evidence',
    bounded, traceCategoryRequest, setTimeout: () => ({unref() {}}), setInterval: () => ({unref() {}}),
    async saveJson(path, value) { saved.push({path, value: structuredClone(value)}); },
    async event(name, detail) { events.push({name, detail}); }
  });
  const cdp = {once() {}, on() {}, async send(method, parameters) {
    calls.push({method, parameters});
    if (method === failAt) throw Error('real protocol failure at ' + method);
    if (method === 'Tracing.getCategories') return response;
    return {};
  }};
  const monitor = new NativeMonitor({page: {async evaluate() { observerStarts++; return true; }},
    browser: {async newBrowserCDPSession() { return cdp; }}});
  return {monitor, state, calls, saved, events, get observerStarts() { return observerStarts; }, start: () => monitor.start(async () => cdp)};
}
test('actual startup retains incomplete enumeration and requests the same seven categories exactly once', async () => {
  for (const response of [{categories: []}, {categories: ['cc', 'viz']}]) {
    const f = await startupMonitorFixture({response});
    await f.start();
    assert.deepEqual(f.calls.map(call => call.method), ['Browser.getVersion', 'Tracing.getCategories',
      'Profiler.enable', 'Profiler.setSamplingInterval', 'Debugger.enable', 'Tracing.start', 'Profiler.start']);
    assert.deepEqual(f.saved.find(row => row.path.endsWith('/trace-categories-response.json')).value, response);
    assert.deepEqual(f.saved.find(row => row.path.endsWith('/trace-categories.json')).value, response.categories);
    const requested = f.calls.find(call => call.method === 'Tracing.start').parameters.traceConfig.includedCategories;
    assert.deepEqual(Array.from(requested), manifest.trace.categories);
    assert.equal(f.calls.filter(call => call.method === 'Tracing.start').length, 1);
    assert.equal(f.observerStarts, 1);
    assert.equal(f.state.warnings.length, 1);
    assert.equal(f.state.errors.length, 0);
    assert(f.events.some(row => row.name === 'trace-category-enumeration-warning'));
    assert.equal(f.state.complete, false, 'Successful startup is not capture completeness');
  }
});
test('malformed protocol enumeration is retained and fails before any recorder start', async () => {
  for (const response of [{}, {categories: null}, {categories: ['cc', 12]}]) {
    const f = await startupMonitorFixture({response});
    await assert.rejects(f.start(), /Tracing.getCategories/);
    assert.deepEqual(f.saved.find(row => row.path.endsWith('/trace-categories-response.json')).value, response);
    assert.deepEqual(f.calls.map(call => call.method), ['Browser.getVersion', 'Tracing.getCategories']);
    assert.equal(f.observerStarts, 0);
  }
});
test('real enumeration or Tracing.start protocol errors remain fatal and are never retried', async () => {
  for (const failAt of ['Tracing.getCategories', 'Tracing.start']) {
    const f = await startupMonitorFixture({failAt});
    await assert.rejects(f.start(), /real protocol failure/);
    assert.equal(f.calls.filter(call => call.method === failAt).length, 1);
    assert.equal(f.calls.some(call => call.method === 'Profiler.start'), false);
    assert.equal(f.observerStarts, 0);
  }
});
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
test('a blocked event-write queue cannot delay either recorder stop or raw CPU persistence', async () => {
  // Exercise the actual production monitor methods without running its preload,
  // loading Playwright, opening a browser, or changing any source-driver code.
  const source = await readFile(new URL('./preload.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('class NativeMonitor {');
  const end = source.indexOf('\ninstallHooks(', start);
  assert(start >= 0 && end > start, 'The production monitor class must be available');
  const state = finalState(), calls = [], saved = [], events = [];
  const blockedWrite = new Promise(() => {});
  const profile = {nodes: [{id: 1}], samples: [1], timeDeltas: [2000], startTime: 0, endTime: 3000};
  const NativeMonitor = vm.runInNewContext(source.slice(start, end) + '\nNativeMonitor;', {
    assert, Buffer, resolve, state, createTraceFinalizationScope, indexTraceFile, limits: manifest.bounds, output: '/source-only-evidence',
    clearTimeout() {}, clearInterval() {},
    bounded: promise => promise,
    event(name) { events.push(name); return blockedWrite; },
    failure(where, error) { throw Error(where + ': ' + error); },
    async writeFile(path, bytes) { saved.push({path, profile: JSON.parse(bytes.toString())}); },
    sha256: () => 'source-only-profile-hash'
  });
  const monitor = new NativeMonitor({});
  monitor.profilerStarted = true; monitor.traceStarted = true;
  monitor.traceDone = new Promise(() => {});
  monitor.cdp = {async send(method) {
    calls.push(method);
    return method === 'Profiler.stop' ? {profile} : {};
  }};
  monitor.traceCdp = monitor.cdp;
  let finished = false;
  const pending = monitor.finish('original-ending-metrics');
  void pending.then(() => { finished = true; });
  assert.deepEqual(calls, ['Profiler.stop', 'Tracing.end'], 'Both stops must be issued before any event write can settle');
  await new Promise(setImmediate);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].path, '/source-only-evidence/native.cpuprofile');
  assert.deepEqual(saved[0].profile, profile);
  assert.deepEqual(events, ['capture-stopping', 'cpu-profile-saved']);
  assert.equal(finished, false, 'The deliberately blocked queue still prevents complete finalization');
  assert.equal(state.complete, false);
});

async function traceMonitorFixture({fileCap = 16, drainMs = 100, protocolMs = 10,
  read = async () => ({data: '0123456789abcdefghijkl', eof: false}), endTrace = async () => ({}),
  completion = Promise.resolve({stream: 'raw-trace-stream', dataLossOccurred: false}),
  save = async () => {}, clock = null, openFile = null} = {}) {
  const source = await readFile(new URL('./preload.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('class NativeMonitor {'), end = source.indexOf('\ninstallHooks(', start);
  const state = finalState(), calls = [], writes = [], budgets = [];
  Object.assign(state.trace, {streamComplete: false, savedBytes: 0});
  let notifyClosed;
  const closed = new Promise(done => { notifyClosed = done; });
  const NativeMonitor = vm.runInNewContext(source.slice(start, end) + '\nNativeMonitor;', {
    assert, Buffer, resolve, state, createTraceFinalizationScope, indexTraceFile, output: '/source-only-evidence',
    Date: clock ? class extends Date { static now() { return clock.now; } } : Date,
    bounded(promise, ms, label) { budgets.push({label, ms}); return bounded(promise, ms, label); },
    limits: {...manifest.bounds, traceFileBytes: fileCap, traceDrainTimeoutMs: drainMs, protocolTimeoutMs: protocolMs},
    invalidateDiagnostic, saveJson: save, async persist() {}, async event() {},
    failure(where, error) { invalidateDiagnostic(state, where, error); },
    async open() { if (openFile) return openFile(); return {async write(bytes, offset = 0, length = bytes.length) { writes.push(Buffer.from(bytes.subarray(offset, offset + length))); return {bytesWritten: length}; }, async close() { calls.push('file-close'); }}; }
  });
  const monitor = new NativeMonitor({});
  monitor.traceDone = completion;
  monitor.cdp = {async send(method) {
    calls.push(method);
    if (method === 'Tracing.end') return endTrace();
    if (method === 'IO.read') return read();
    if (method === 'IO.close') notifyClosed();
    return {};
  }};
  monitor.traceCdp = monitor.cdp;
  return {monitor, state, calls, writes, closed, budgets};
}
test('asynchronous trace completion can outlive the RPC limit within the single finalization budget', async () => {
  let releaseCompletion;
  const completion = new Promise(resolve => { releaseCompletion = resolve; });
  const f = await traceMonitorFixture({protocolMs: 5, drainMs: 100, completion});
  let collectedDeadline;
  f.monitor.collectTrace = async (_complete, deadline) => { collectedDeadline = deadline; };
  const pending = f.monitor.trace();
  await new Promise(resolve => setTimeout(resolve, 15));
  releaseCompletion({stream: 'raw-trace-stream', dataLossOccurred: false});
  await bounded(pending, 200, 'completion contract');
  assert.deepEqual(f.calls, ['Tracing.end']);
  assert.equal(collectedDeadline, f.state.trace.stopIssuedAtNodeEpochMs + 100);
  assert.equal(f.state.trace.finalizationDeadlineNodeEpochMs, collectedDeadline);
  assert(f.state.trace.finalizationFinishedAtNodeEpochMs < collectedDeadline);
  assert.equal(f.budgets.find(row => row.label === 'Tracing.end').ms, 5);
  assert(f.budgets.find(row => row.label.startsWith('Tracing.tracingComplete')).ms > 5);
});
test('stalled completion expires the total budget and a late event cannot start a new drain', async () => {
  let releaseCompletion;
  const completion = new Promise(resolve => { releaseCompletion = resolve; });
  const f = await traceMonitorFixture({drainMs: 5, completion}), profile = f.state.cpuProfile;
  const pending = f.monitor.trace().catch(error => { invalidateDiagnostic(f.state, 'trace', error); throw error; });
  await assert.rejects(bounded(pending, 100, 'stalled completion contract'), /timed out|deadline/);
  releaseCompletion({stream: 'late-stream', dataLossOccurred: false});
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, ['Tracing.end']);
  assert.equal(f.state.trace.drainStartedAtNodeEpochMs, undefined);
  assert.equal(f.state.trace.finalizationFinishedAtNodeEpochMs, undefined);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.equal(terminalDiagnosticReceipt(f.state).complete, false);
  assert.strictEqual(f.state.cpuProfile, profile);
});
test('completion time consumes the same absolute drain budget instead of granting a second allowance', async () => {
  const clock = {now: 1000};
  let releaseCompletion;
  const completion = new Promise(resolve => { releaseCompletion = resolve; });
  const f = await traceMonitorFixture({clock, fileCap: 1024, drainMs: 60, completion,
    endTrace: async () => { clock.now = 1003; return {}; },
    read: async () => { clock.now = 1061; return {data: 'raw-prefix', eof: false}; }});
  const pending = f.monitor.trace().catch(error => { invalidateDiagnostic(f.state, 'trace', error); throw error; });
  await new Promise(setImmediate);
  clock.now = 1040;
  releaseCompletion({stream: 'shared-budget-stream', dataLossOccurred: false});
  await assert.rejects(bounded(pending, 200, 'shared budget contract'), /deadline/);
  assert.equal(f.state.trace.finalizationDeadlineNodeEpochMs, 1060);
  assert.equal(f.state.trace.drainStartedAtNodeEpochMs, 1040);
  assert.equal(f.calls.filter(method => method === 'IO.read').length, 1);
  assert.equal(f.budgets.find(row => row.label === 'IO.read').ms, 10);
  assert.equal(f.state.trace.finalizationFinishedAtNodeEpochMs, undefined);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
});
test('a late completion-receipt write cannot resume collection after the finalization deadline', async () => {
  let releaseWrite;
  const blocked = new Promise(resolve => { releaseWrite = resolve; });
  const f = await traceMonitorFixture({drainMs: 5, save: () => blocked});
  const pending = f.monitor.trace().catch(error => { invalidateDiagnostic(f.state, 'trace', error); throw error; });
  await assert.rejects(bounded(pending, 100, 'completion persistence contract'), /timed out|deadline/);
  releaseWrite();
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, ['Tracing.end']);
  assert.equal(f.state.trace.drainStartedAtNodeEpochMs, undefined);
  assert.equal(f.state.trace.finalizationFinishedAtNodeEpochMs, undefined);
  assert.equal(terminalDiagnosticReceipt(f.state).complete, false);
});
test('Tracing.end still fails at its individual RPC timeout before the larger finalization budget', async () => {
  const f = await traceMonitorFixture({protocolMs: 5, drainMs: 100, endTrace: () => new Promise(() => {})});
  await assert.rejects(bounded(f.monitor.trace(), 200, 'end RPC contract'), /Tracing.end timed out after 5 ms/);
  assert.deepEqual(f.calls, ['Tracing.end']);
  assert.equal(f.state.trace.stopAcknowledgedAtNodeEpochMs, undefined);
  assert.equal(f.state.trace.drainStartedAtNodeEpochMs, undefined);
});
test('actual trace collector retains only the bounded prefix and rejects file overflow', async () => {
  const f = await traceMonitorFixture(), profile = f.state.cpuProfile;
  await f.monitor.trace();
  assert.deepEqual(f.calls, ['Tracing.end', 'IO.read', 'file-close', 'IO.close']);
  assert.equal(Buffer.concat(f.writes).toString(), '0123456789abcdef');
  assert.equal(f.state.trace.savedBytes, 16);
  assert.equal(f.state.trace.capReached, true);
  assert.equal(f.state.trace.streamComplete, false);
  assert.equal(f.state.trace.file, 'native-trace.partial.json');
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.strictEqual(f.state.cpuProfile, profile);
});
test('a stalled raw trace read cannot escape the independent drain deadline', async () => {
  const f = await traceMonitorFixture({drainMs: 5, read: () => new Promise(() => {})});
  const profile = f.state.cpuProfile;
  await assert.rejects(bounded(f.monitor.trace().catch(error => {
    invalidateDiagnostic(f.state, 'trace', error); throw error;
  }), 100, 'outer trace test guard'), /timed out|Trace finalization deadline reached; evidence remains partial/);
  await bounded(f.closed, 100, 'trace handle cleanup');
  assert.equal(f.calls[0], 'Tracing.end');
  assert.equal(f.state.trace.streamComplete, false);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.strictEqual(f.state.cpuProfile, profile);
});


async function ownershipFixture({cpuError = false, lateBrowserCreation = null, pageDetach = null,
  protocolMs = 40, cleanupMs = 10, detachMs = 2000, onEvent = null, indexStreamFactory = null, beforeSaveJson = null} = {}) {
  const source = await readFile(new URL('./preload.mjs', import.meta.url), 'utf8');
  const begin = source.indexOf('class NativeMonitor {'), end = source.indexOf('\ninstallHooks(', begin);
  const state = finalState(), calls = [], events = [], files = new Map();
  delete state.cpuProfile;
  Object.assign(state, {checkpoints: [], bundles: [{file: 'exact-loaded-source.js'}], parsedScripts: 1,
    originalMetricsCalls: 2, bundleBytes: 1, assetEvents: 0});
  const profile = {nodes: [{id: 1}], samples: [1], timeDeltas: [300], startTime: 0, endTime: 300};
  const snapshot = {timeOriginMs: 100000, stoppedBy: 'trusted-w-keyup', keydowns: 1, keyups: 1,
    marks: [{name: 'first-trusted-w', atMs: .1}, {name: 'trusted-w-keyup', atMs: .2}],
    raf: {stored: 1, overflow: 0}, longTasks: {overflow: 0}, markOverflow: 0, longTaskSupported: true};
  const traceBytes = Buffer.from(JSON.stringify({traceEvents: traceFixture()}) + '\n');
  let resolvePageDetached, resolveBrowserDetached;
  const pageDetached = new Promise(done => { resolvePageDetached = done; });
  const browserDetached = new Promise(done => { resolveBrowserDetached = done; });
  const pageSession = new EventEmitter(), browserSession = new EventEmitter();
  for (const [name, session, notify] of [['page', pageSession, resolvePageDetached], ['browserTrace', browserSession, resolveBrowserDetached]]) {
    session.closed = false; session.detachCount = 0;
    session.on('close', () => { session.closed = true; });
    session.detach = async () => {
      calls.push(name + ':detach'); session.detachCount++;
      if (session.closed) throw Error('TargetClosed: owned session already closed');
      if (name === 'page' && pageDetach) await pageDetach();
      session.emit('close'); notify();
    };
  }
  pageSession.send = async method => {
    calls.push('page:' + method);
    assert(!method.startsWith('Tracing.') && !method.startsWith('IO.'), 'Tracing/IO must use browser ownership');
    if (pageSession.closed) throw Error('TargetClosed: original page session');
    if (method === 'Profiler.stop') {
      if (cpuError) throw Error('Required CPU profile unavailable');
      return {profile};
    }
    return {};
  };
  browserSession.send = async method => {
    calls.push('browserTrace:' + method);
    assert(!method.startsWith('Profiler.') && !method.startsWith('Debugger.'), 'Profiler/Debugger must stay on original page');
    if (browserSession.closed) throw Error('Browser tracing session closed');
    if (method === 'Tracing.getCategories') return {categories: manifest.trace.categories};
    if (method === 'IO.read') return {data: traceBytes.toString(), eof: true};
    return {};
  };
  const context = new EventEmitter(), page = new EventEmitter(), browser = new EventEmitter();
  page.closed = false; page.context = () => context; page.addInitScript = async () => {};
  page.evaluate = async fn => {
    if (page.closed) throw Error('Original page closed');
    return String(fn).includes('.start()') ? true : snapshot;
  };
  browser.newBrowserCDPSession = () => lateBrowserCreation || Promise.resolve(browserSession);
  const saveJson = async (path, value) => { await beforeSaveJson?.(path, value); files.set(path, Buffer.from(JSON.stringify(value))); };
  const failure = (where, error) => invalidateDiagnostic(state, where, error);
  const createMonitor = vm.runInNewContext(source.slice(begin, end) + `
    (page, browser) => new NativeMonitor({page, browser,
      launchArguments: [{channel: 'chrome', headless: false, args: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal']}],
      pageArguments: [{viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: 'reduce'}]});`, {
    assert, Buffer, resolve, state, createTraceFinalizationScope, indexTraceFile, manifest, output: '/source-only-evidence', structuredClone, installPageProbe,
    limits: {...manifest.bounds, protocolTimeoutMs: protocolMs, cleanupTimeoutMs: cleanupMs, traceDrainTimeoutMs: 200},
    bounded(promise, ms, label) { return bounded(promise, label.includes('CDP detach and close') ? detachMs : ms, label); },
    setTimeout, setInterval, clearTimeout, clearInterval, sha256, summarizeTraceTopology,
    traceCategoryRequest, invalidateDiagnostic, ownedTransportsClosed, finalizeDiagnostic, terminalDiagnosticReceipt, boundedDiagnosticCleanup,
    failure, saveJson, writes: Promise.resolve(),
    async persist() { await saveJson('/source-only-evidence/diagnostic-status.json', state); return true; },
    async event(name, detail) { events.push({name, detail}); onEvent?.(name, detail); },
    async queueWrite(_label, operation) { await operation(); return true; },
    async writeFile(path, bytes) { files.set(path, Buffer.from(bytes)); },
    writeFileSync(path, bytes) { files.set(path, Buffer.from(bytes)); },
    async readFile(path) { assert(files.has(path), 'Missing in-memory raw file'); return files.get(path); },
    indexTraceFile(path, options) { return indexTraceSource(indexStreamFactory || (() => Readable.from([files.get(path)])), options); },
    async rename(from, to) { files.set(to, files.get(from)); files.delete(from); },
    async open(path) {
      const chunks = [];
      return {async write(bytes, offset = 0, length = bytes.length) { chunks.push(Buffer.from(bytes.subarray(offset, offset + length))); return {bytesWritten: length}; }, async close() { files.set(path, Buffer.concat(chunks)); }};
    }
  });
  const monitor = createMonitor(page, browser);
  return {monitor, state, calls, files, events, pageSession, browserSession, pageDetached, browserDetached,
    async start() { await monitor.attach(); await monitor.start(async () => pageSession); },
    closeSource() {
      page.closed = true; page.emit('close'); context.emit('close');
      if (!pageSession.closed) pageSession.emit('close');
      return 'original-source-context-closed';
    },
    completeTrace() { browserSession.emit('Tracing.tracingComplete', {stream: 'browser-owned-stream', dataLossOccurred: false}); }
  };
}
test('original page closes while browser flush remains pending, then both owned sessions complete cleanly', async () => {
  const f = await ownershipFixture(); await f.start();
  const pending = f.monitor.stop('original-ending-metrics');
  assert.deepEqual(f.calls.filter(value => value.endsWith('Profiler.stop') || value.endsWith('Tracing.end')),
    ['page:Profiler.stop', 'browserTrace:Tracing.end']);
  await bounded(f.pageDetached, 100, 'prompt page detach');
  assert.equal(f.browserSession.detachCount, 0, 'Browser tracing must remain alive during flush');
  assert.equal(f.closeSource(), 'original-source-context-closed', 'Original closure is never delayed');
  f.completeTrace(); await bounded(pending, 150, 'complete ownership fixture');
  assert.equal(f.state.complete, true); assert.equal(f.state.partial, false);
  assert.equal(ownedTransportsClosed(f.state), true);
  assert.equal(f.state.trace.topology.available, true);
  assert.equal(f.state.alignment.available, true);
  assert(f.files.has('/source-only-evidence/native.cpuprofile'));
  assert(f.files.has('/source-only-evidence/native-trace.json'));
  assert(Number.isFinite(f.state.lifecycle.pageClosedAtNodeEpochMs));
  assert(Number.isFinite(f.state.lifecycle.contextClosedAtNodeEpochMs));
  assert.equal(f.pageSession.detachCount, 1); assert.equal(f.browserSession.detachCount, 1);
  await f.monitor.cleanup();
  assert.equal(f.pageSession.detachCount, 1); assert.equal(f.browserSession.detachCount, 1);
});
test('early original-page closure remains a failure even when browser trace is retained', async () => {
  const f = await ownershipFixture(); await f.start();
  f.closeSource(); f.completeTrace();
  await bounded(f.monitor.stop('original-ending-metrics'), 150, 'early source close');
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert(f.state.errors.some(row => /closed|close/.test(row.where)));
  assert.equal(f.state.transports.page.unexpectedClose, true);
  assert(f.files.has('/source-only-evidence/native-trace.json'));
});
test('missing required CPU data cannot be masked by a complete browser trace', async () => {
  const f = await ownershipFixture({cpuError: true}); await f.start();
  const pending = f.monitor.stop('original-ending-metrics'); f.completeTrace(); await pending;
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.equal(f.state.cpuProfile, undefined);
  assert(f.files.has('/source-only-evidence/native-trace.json'));
  assert(f.state.errors.some(row => row.where === 'cpu-profile'));
});
test('unexpected browser-session closure preserves CPU evidence and cannot be relabeled as successful detach', async () => {
  const f = await ownershipFixture(); await f.start();
  const pending = f.monitor.stop('original-ending-metrics');
  await f.pageDetached; f.browserSession.emit('close'); await pending;
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.equal(f.state.transports.browserTrace.unexpectedClose, true);
  assert.equal(f.state.transports.browserTrace.detachAcknowledged, false);
  assert(f.files.has('/source-only-evidence/native.cpuprofile'));
});
test('late owned-session creation is detached exactly once and never resumes capture', async () => {
  let releaseCreation;
  const creation = new Promise(resolve => { releaseCreation = resolve; });
  const f = await ownershipFixture({lateBrowserCreation: creation, protocolMs: 5});
  await assert.rejects(f.start(), /creation timed out/);
  const finished = f.monitor.stop('setup-failure');
  releaseCreation(f.browserSession);
  await bounded(f.browserDetached, 100, 'late creation disposal'); await finished;
  assert.equal(f.browserSession.detachCount, 1);
  assert.equal(f.state.transports.browserTrace.creationTimedOut, true);
  assert.equal(f.calls.some(call => call.endsWith('Tracing.start')), false);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
});
test('cleanup racing an already-created session prevents setup from resuming', async () => {
  let f, cleanup;
  f = await ownershipFixture({onEvent(name, detail) {
    if (name === 'owned-session-created' && detail.transport === 'browserTrace') cleanup = f.monitor.cleanup();
  }});
  await assert.rejects(f.start(), /became unavailable before setup/);
  await bounded(cleanup, 100, 'creation and cleanup race');
  await bounded(f.browserDetached, 100, 'created session disposal');
  assert.equal(f.browserSession.detachCount, 1);
  assert.equal(f.calls.some(call => call.endsWith('Tracing.start')), false);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
});
test('a late detach acknowledgement cannot recover a failed ownership receipt', async () => {
  let releaseDetach;
  const held = new Promise(resolve => { releaseDetach = resolve; });
  const f = await ownershipFixture({pageDetach: () => held, detachMs: 5}); await f.start();
  const pending = f.monitor.stop('original-ending-metrics'); f.completeTrace(); await pending;
  assert.equal(f.state.transports.page.closed, false);
  releaseDetach(); await new Promise(setImmediate);
  assert.equal(f.state.transports.page.detachAcknowledged, true);
  assert.equal(f.state.transports.page.closed, false, 'Late success cannot overwrite the timed-out detach outcome');
  assert.equal(f.state.complete, false); assert.equal(terminalDiagnosticReceipt(f.state).complete, false);
});
test('browser-close cleanup stays bounded and late trace data cannot restore completeness', async () => {
  const f = await ownershipFixture({cleanupMs: 5}); await f.start();
  const pending = f.monitor.stop('original-ending-metrics'); await f.pageDetached;
  await bounded(f.monitor.cleanup(), 100, 'bounded owned-session cleanup');
  f.completeTrace(); await pending;
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert(f.files.has('/source-only-evidence/observer-cleanup-terminal.json'));
  assert.equal(f.pageSession.detachCount, 1); assert.equal(f.browserSession.detachCount, 1);
  assert.equal(terminalDiagnosticReceipt(f.state).complete, false);
});
test('completion validation requires both explicit owned transport acknowledgements', async () => {
  for (const name of ['page', 'browserTrace']) for (const field of ['detachAcknowledged', 'closeObserved', 'closed']) {
    const state = finalState(); state.transports[name][field] = false;
    assert.equal(await finalizeDiagnostic(state, finalOptions()), false);
    assert.equal(diagnosticStateIsClean(state), false);
  }
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


async function streamingFixture(rows = traceFixture(), overrides = {}) {
  const scope = createTraceFinalizationScope(Date.now() + 2000);
  const bytes = Buffer.from(JSON.stringify({traceEvents: rows}));
  try {
    return await indexTraceSource(() => Readable.from([bytes]), {
      limits: manifest.bounds, categories: manifest.trace.categories, scope, ...overrides
    });
  } finally { scope.dispose(); }
}
test('streaming topology preserves the five frozen original output fixtures, including nonchronological marks', async () => {
  // SHA receipts were computed from the unchanged 0d838033 common.mjs before
  // refactoring; they are not snapshots generated by the new implementation.
  const rows = traceFixture();
  const variants = {
    ordered: rows,
    metadataLast: [...rows.filter(row => row.ph !== 'M'), ...rows.filter(row => row.ph === 'M')],
    nonchronological: [rows.at(-1), ...rows.slice(0, -1)],
    rendererFlowsOnly: rows.map(row => row.bind_id || row.id2 ? {...row, pid: 1, tid: 10} : row),
    outsideWindow: rows.map(row => row.cat?.includes('gpu') ? {...row, ts: 201} : row)
  };
  const hashes = {
    ordered: '4a6042669e90728c290a84831815d816d61a0cddbd8601b1ec6058325707af05',
    metadataLast: '6f421ad126645771696c565ef8dac1ec21a9faa5c87f283ea27b067c9955895a',
    nonchronological: 'd16b437e641db33f04605955dfecd8261976144d8f038eaa35219e7163dd4704',
    rendererFlowsOnly: '43008c77cbe72e2b6bb0f4eac27dce6186cdf59e40c7cfd7a475bbf583208833',
    outsideWindow: 'ce4a5221bced458da3f19e55a59ed4fca81c2b3bba56d024b856858201558cd1'
  };
  for (const [name, events] of Object.entries(variants)) {
    const before = JSON.stringify(events), indexed = await streamingFixture(events);
    assert.equal(sha256(Buffer.from(JSON.stringify(indexed.topology))), hashes[name], name);
    assert.equal(JSON.stringify(events), before);
    assert.equal(indexed.receipt.passes, 2); assert.equal(indexed.receipt.unchangedBetweenPasses, true);
    assert.deepEqual(indexed.marks, events.filter(row => String(row.name).startsWith('belle-native-cpu:'))
      .map(({name, ts, pid, tid, ph, cat, args}) => ({name, ts, pid, tid, ph, cat, args})));
  }
});
test('narrow parser fork keeps UTF-8/chunk/grammar validation and fails closed on truncated or duplicate documents', async () => {
  const valid = Buffer.from(JSON.stringify({before: {unicode: 'Δ🌊'}, traceEvents: [{name: 'Δ🌊', ph: 'X'}], after: [1, false, null]}));
  const rows = [];
  const receipt = await scanTraceStream(Readable.from([...valid].map(byte => Buffer.from([byte]))), row => rows.push(row));
  assert.equal(receipt.completeDocument, true); assert.equal(receipt.bytes, valid.length);
  assert.deepEqual(rows, [{name: 'Δ🌊', ph: 'X'}]);
  for (const bytes of [valid.subarray(0, -1), Buffer.from('{"traceEvents":[],"traceEvents":[]}'),
    Buffer.from('{"traceEvents":[3]}'), Buffer.from('{"traceEvents":[{"x":01}]}'),
    Buffer.from([123,34,116,114,97,99,101,69,118,101,110,116,115,34,58,91,93,44,34,120,34,58,34,255,34,125])]) {
    await assert.rejects(scanTraceStream(Readable.from([bytes]), () => {}), error => {
      assert.equal(error.traceReceipt.completeFile, true);
      assert.equal(error.traceReceipt.completeDocument, false);
      assert.equal(error.traceReceipt.sha256, sha256(bytes)); return true;
    });
  }
});
test('record, depth, root-key count and root-key size guards reject before unbounded retention', async () => {
  const cases = [
    ['{"traceEvents":[{"name":"' + 'x'.repeat(64) + '"}]}', {maxRecordChars: 32}],
    ['{"traceEvents":[],"a":[[[[0]]]]}', {maxDepth: 3}],
    ['{"traceEvents":[],"a":0,"b":0}', {maxRootKeys: 2}],
    ['{"traceEvents":[],"' + 'k'.repeat(32) + '":0}', {maxRootKeyChars: 16}]
  ];
  for (const [text, options] of cases) {
    await assert.rejects(scanTraceStream(Readable.from([Buffer.from(text)]), () => {}, options), error => {
      assert.equal(error.traceReceipt.completeFile, true); assert.equal(error.traceReceipt.completeDocument, false);
      assert(error.traceReceipt.topLevelKeys.length <= (options.maxRootKeys || 64)); return true;
    });
  }
});
test('every auxiliary track map rejects unadmitted tracks before retention', () => {
  const limits = {...manifest.bounds, traceTracks: 1};
  const accumulator = createTraceTopologyAccumulator(limits, manifest.trace.categories);
  accumulator.index({pid: 1, tid: 10, name: 'first'});
  assert.throws(() => accumulator.index({pid: 2, tid: 20, name: 'Scheduler::RunTask', cat: 'gpu', bind_id: '0x1'}), /tracks/);
  const receipt = accumulator.boundsReceipt();
  assert.equal(receipt.tracks, 1);
  assert(Object.values(receipt.auxiliaryTracks).every(count => count === 0));
  assert.equal(receipt.trackOverflow, 1);
});
test('metadata and mark byte budgets reject without retaining the overflowing row', () => {
  const metadata = createTraceTopologyAccumulator({...manifest.bounds, traceMetadataBytes: 8}, manifest.trace.categories);
  assert.throws(() => metadata.index(traceFixture()[0]), /metadata-retention/);
  assert.equal(metadata.boundsReceipt().metadataRows, 0); assert.equal(metadata.boundsReceipt().metadataBytes, 0);
  const marks = createTraceTopologyAccumulator({...manifest.bounds, traceMarkBytes: 8}, manifest.trace.categories);
  assert.throws(() => marks.index(traceFixture()[7]), /mark-retention/);
  assert.equal(marks.marks.length, 0); assert.equal(marks.boundsReceipt().markBytes, 0);
});
test('category and phase capacities are checked before inserting a new key', () => {
  for (const [limits, rows, errorName] of [
    [{traceCategories: 1}, [{pid: 1, tid: 1, cat: 'one', ph: 'X'}, {pid: 1, tid: 1, cat: 'two', ph: 'X'}], 'categories'],
    [{tracePhases: 1}, [{pid: 1, tid: 1, cat: 'one', ph: 'X'}, {pid: 1, tid: 1, cat: 'one', ph: 'I'}], 'phases']
  ]) {
    const accumulator = createTraceTopologyAccumulator({...manifest.bounds, ...limits}, manifest.trace.categories);
    rows.forEach(accumulator.index); accumulator.beginCoverage(); accumulator.observe(rows[0]);
    assert.throws(() => accumulator.observe(rows[1]), new RegExp(errorName));
    assert.equal(accumulator.boundsReceipt()[errorName], 1);
  }
});
test('byte, event and SHA changes between complete passes each fail independently', () => {
  const receipt = {completeFile: true, completeDocument: true, rootShape: 'object', sha256: 'a'.repeat(64), bytes: 20, events: 2};
  assert.equal(reconcileTracePasses(receipt, {...receipt}).unchangedBetweenPasses, true);
  for (const patch of [{bytes: 21}, {events: 3}, {sha256: 'b'.repeat(64)}, {completeFile: false}, {completeDocument: false}, {rootShape: 'array'}]) {
    assert.throws(() => reconcileTracePasses(receipt, {...receipt, ...patch}));
  }
});
test('a changed stream between the two passes never publishes an available index', async () => {
  const first = traceFixture(), second = traceFixture(); second[8].dur = 11;
  const scope = createTraceFinalizationScope(Date.now() + 1000), receipts = [];
  try {
    await assert.rejects(indexTraceSource(pass => Readable.from([Buffer.from(JSON.stringify({traceEvents: pass === 1 ? first : second}))]),
      {limits: manifest.bounds, categories: manifest.trace.categories, scope, onReceipt: value => receipts.push(value)}), /changed between passes/);
    assert.equal(scope.signal.aborted, true); assert.equal(scope.activeReaders, 0);
    assert.equal(receipts.length, 2);
  } finally { scope.dispose(); }
});
test('an absolute deadline destroys a stalled reader and no read escapes afterward', async () => {
  let reads = 0;
  const reader = new Readable({read() { reads++; }}), closed = new Promise(done => reader.once('close', done));
  const scope = createTraceFinalizationScope(Date.now() + 15);
  try {
    await assert.rejects(indexTraceSource(() => reader, {limits: manifest.bounds, categories: manifest.trace.categories, scope}), /deadline|timed out/);
    await closed; const after = reads;
    await new Promise(done => setTimeout(done, 10));
    assert.equal(reader.destroyed, true); assert.equal(reads, after); assert.equal(scope.activeReaders, 0);
  } finally { scope.dispose(); }
});
test('deadline cancellation also destroys hash-only drain after an earlier parse error', async () => {
  let reads = 0;
  const reader = new Readable({read() { if (++reads === 1) this.push(Buffer.from('{"traceEvents":[0],')); }});
  const closed = new Promise(done => reader.once('close', done));
  const scope = createTraceFinalizationScope(Date.now() + 15);
  try {
    await assert.rejects(indexTraceSource(() => reader, {limits: manifest.bounds, categories: manifest.trace.categories, scope}), /deadline|timed out/);
    await closed; assert(reads > 1, 'The parser attempted to hash the remainder after rejecting the event');
    const after = reads; await new Promise(done => setTimeout(done, 10));
    assert.equal(reads, after); assert.equal(reader.destroyed, true); assert.equal(scope.activeReaders, 0);
  } finally { scope.dispose(); }
});
test('a deadline reached after the first receipt prevents a second reader and late promotion', async () => {
  let now = 0, opened = 0;
  const scope = createTraceFinalizationScope(1000, {now: () => now});
  try {
    await assert.rejects(indexTraceSource(() => { opened++; return Readable.from([Buffer.from(JSON.stringify({traceEvents: traceFixture()}))]); },
      {limits: manifest.bounds, categories: manifest.trace.categories, scope, onReceipt: value => { if (value.complete) now = 1000; }}), /deadline/);
    assert.equal(opened, 1); assert.equal(scope.activeReaders, 0); assert.equal(scope.signal.aborted, true);
  } finally { scope.dispose(); }
});
test('browser-close cleanup aborts an active index stream and late chunks cannot recover completeness', async () => {
  let ready, reads = 0;
  const indexing = new Promise(done => { ready = done; });
  const reader = new Readable({read() { reads++; }}), closed = new Promise(done => reader.once('close', done));
  const f = await ownershipFixture({cleanupMs: 5, indexStreamFactory: () => { ready(); return reader; }});
  await f.start(); const pending = f.monitor.stop('original-ending-metrics'); f.completeTrace();
  await indexing; await f.monitor.cleanup(); await pending; await closed;
  const after = reads; reader.push(Buffer.from('{"traceEvents":[]}')); await new Promise(setImmediate);
  assert.equal(reads, after); assert.equal(reader.destroyed, true); assert.equal(f.monitor.traceScope.activeReaders, 0);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert(f.files.has('/source-only-evidence/native.cpuprofile'));
  assert(f.files.has('/source-only-evidence/native-trace.json'));
  assert(f.files.has('/source-only-evidence/observer-cleanup-terminal.json'));
});
test('unexpected browser tracing transport closure aborts an in-progress filesystem index', async () => {
  let ready;
  const indexing = new Promise(done => { ready = done; });
  const reader = new Readable({read() {}}), closed = new Promise(done => reader.once('close', done));
  const f = await ownershipFixture({indexStreamFactory: () => { ready(); return reader; }});
  await f.start(); const pending = f.monitor.stop('original-ending-metrics'); f.completeTrace(); await indexing;
  f.browserSession.emit('close'); await pending; await closed;
  assert.equal(reader.destroyed, true); assert.equal(f.state.complete, false);
  assert.equal(f.state.transports.browserTrace.unexpectedClose, true);
  assert.equal(f.monitor.traceScope.activeReaders, 0);
});
test('valid input larger than MAX_STRING_LENGTH indexes twice under a bounded child heap without a raw file', {timeout: 120000}, async () => {
  const code = `
    import {Readable} from 'node:stream';
    import {constants} from 'node:buffer';
    import {getHeapStatistics} from 'node:v8';
    import {createTraceFinalizationScope,indexTraceSource} from ${JSON.stringify(new URL('./trace-index.mjs', import.meta.url).href)};
    const limits=${JSON.stringify(manifest.bounds)},categories=${JSON.stringify(manifest.trace.categories)};
    const header=Buffer.from(${JSON.stringify(JSON.stringify({traceEvents: traceFixture()}).slice(0, -1) + ',"padding":"')});
    const footer=Buffer.from('"}'),chunk=Buffer.alloc(limits.traceReaderChunkBytes,120);
    const padding=constants.MAX_STRING_LENGTH+4096,expected=header.length+padding+footer.length;
    const source=()=>Readable.from((async function*(){yield header;let left=padding;
      while(left){const size=Math.min(left,chunk.length);yield chunk.subarray(0,size);left-=size;}yield footer;})());
    const started=performance.now(),scope=createTraceFinalizationScope(Date.now()+90000);
    try{const result=await indexTraceSource(source,{limits,categories,scope});
      if(result.receipt.bytes!==expected||!result.topology.available||!result.receipt.unchangedBetweenPasses)throw Error('Synthetic proof mismatch');
      console.log('STREAMING_HEAP_PROOF_JSON='+JSON.stringify({bytes:result.receipt.bytes,events:result.receipt.events,
        passes:result.receipt.passes,sha256:result.receipt.sha256,maxStringLength:constants.MAX_STRING_LENGTH,
        elapsedMs:performance.now()-started,maxRssKiB:process.resourceUsage().maxRSS,heapLimitBytes:getHeapStatistics().heap_size_limit,
        oldSpaceLimitMiB:64,semiSpaceLimitMiB:4,rawFileCreated:false,completeDocument:result.receipt.completeDocument}));
    }finally{scope.dispose();}
  `;
  const child = spawn(process.execPath, ['--max-old-space-size=64', '--max-semi-space-size=4', '--input-type=module', '--eval', code], {stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 32768) child.kill(); });
  child.stderr.on('data', bytes => { stderr += bytes; if (stderr.length > 32768) child.kill(); });
  const timer = setTimeout(() => child.kill(), 100000);
  try {
    const [code, signal] = await once(child, 'close');
    assert.equal(code, 0, stderr || String(signal));
    const line = stdout.split('\n').find(row => row.startsWith('STREAMING_HEAP_PROOF_JSON='));
    assert(line, stdout); const receipt = JSON.parse(line.slice('STREAMING_HEAP_PROOF_JSON='.length));
    assert(receipt.bytes > receipt.maxStringLength); assert.equal(receipt.passes, 2);
    assert.equal(receipt.rawFileCreated, false); assert.equal(receipt.completeDocument, true);
    console.log(line);
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); }
});


test('a file open resolving after expiry or just before a late resumption closes exactly once without reading', async () => {
  for (const lateResolution of [false, true]) {
    let closeCalls = 0, releaseOpen;
    const handle = {async close() { closeCalls++; }, async write() { throw Error('Expired open must never write'); }};
    const clock = {now: 1000};
    const f = await traceMonitorFixture({clock: lateResolution ? null : clock, drainMs: 5,
      openFile: lateResolution ? () => new Promise(done => { releaseOpen = done; }) : async () => { clock.now = 1006; return handle; }});
    await assert.rejects(f.monitor.trace(), /deadline|timed out/);
    if (lateResolution) releaseOpen(handle);
    await new Promise(setImmediate); await new Promise(setImmediate);
    assert.equal(closeCalls, 1);
    assert.equal(f.calls.includes('IO.read'), false);
    assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  }
});
test('late topology persistence after cleanup cannot publish index completion or erase the failed status', async () => {
  let ready, releaseWrite;
  const writing = new Promise(done => { ready = done; }), blocked = new Promise(done => { releaseWrite = done; });
  const f = await ownershipFixture({cleanupMs: 5, beforeSaveJson(path) {
    if (path.endsWith('/trace-process-threads.json')) { ready(); return blocked; }
  }});
  await f.start(); const pending = f.monitor.stop('original-ending-metrics'); f.completeTrace();
  await writing; await f.monitor.cleanup(); await pending;
  releaseWrite(); await new Promise(setImmediate); await new Promise(setImmediate);
  assert.equal(f.state.trace.indexing.complete, false);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  const persisted = JSON.parse(f.files.get('/source-only-evidence/diagnostic-status.json'));
  assert.equal(persisted.complete, false); assert.equal(persisted.partial, true);
  assert.equal(terminalDiagnosticReceipt(f.state).complete, false);
});
