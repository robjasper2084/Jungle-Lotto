import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {manifest, selectCase, verifyDriver, buildStatisticOnly, bounded, invalidateDiagnostic, sha256,
  finalizeDiagnostic, diagnosticStateIsClean, terminalDiagnosticReceipt, diagnosticRunIsClean,
  boundedDiagnosticCleanup, traceCategoryRequest, summarizeTraceTopology} from './common.mjs';
import {installHooks} from './hooks.mjs';
import {installPageProbe} from './page-probe.mjs';

test('only original 210 and the fixed compositor categories are selectable', () => {
  assert.deepEqual(Object.keys(manifest.cases), ['cadillac']);
  assert.equal(selectCase('cadillac').commit, '75906273c0cd414c0d004320fc6f654b4783e5b1');
  assert.throws(() => selectCase('armory'));
  assert.throws(() => selectCase('current-head'));
  assert.deepEqual(manifest.trace.categories, ['cc', 'viz', 'gpu', 'toplevel', 'toplevel.flow', 'devtools.timeline', 'blink.user_timing']);
  assert.deepEqual(traceCategoryRequest([...manifest.trace.categories, 'unrequested']).requestedCategories, manifest.trace.categories);
  assert.equal(manifest.trace.gpuExecutionMeasured, false);
  assert.equal(manifest.bounds.traceBufferKiB * 1024, 512 * 1024 * 1024);
  assert.equal(manifest.bounds.traceFileBytes, 512 * 1024 * 1024);
  assert.equal(manifest.bounds.traceDrainTimeoutMs, 60000);
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
    assert, Buffer, resolve, state, manifest, limits: manifest.bounds, output: '/source-only-evidence',
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
  const monitor = new NativeMonitor({page: {async evaluate() { observerStarts++; return true; }}});
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
    assert, Buffer, resolve, state, limits: manifest.bounds, output: '/source-only-evidence',
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

async function traceMonitorFixture({fileCap = 16, drainMs = 100, read = async () => ({data: '0123456789abcdefghijkl', eof: false})} = {}) {
  const source = await readFile(new URL('./preload.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('class NativeMonitor {'), end = source.indexOf('\ninstallHooks(', start);
  const state = finalState(), calls = [], writes = [];
  Object.assign(state.trace, {streamComplete: false, savedBytes: 0});
  let notifyClosed;
  const closed = new Promise(done => { notifyClosed = done; });
  const NativeMonitor = vm.runInNewContext(source.slice(start, end) + '\nNativeMonitor;', {
    assert, Buffer, resolve, state, output: '/source-only-evidence', bounded,
    limits: {...manifest.bounds, traceFileBytes: fileCap, traceDrainTimeoutMs: drainMs},
    invalidateDiagnostic, async saveJson() {}, async persist() {}, async event() {},
    failure(where, error) { invalidateDiagnostic(state, where, error); },
    async open() { return {async write(bytes) { writes.push(Buffer.from(bytes)); }, async close() { calls.push('file-close'); }}; }
  });
  const monitor = new NativeMonitor({});
  monitor.traceDone = Promise.resolve({stream: 'raw-trace-stream', dataLossOccurred: false});
  monitor.send = async method => {
    calls.push(method);
    if (method === 'IO.read') return read();
    if (method === 'IO.close') notifyClosed();
    return {};
  };
  return {monitor, state, calls, writes, closed};
}
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
  }), 100, 'outer trace test guard'), /timed out/);
  await bounded(f.closed, 100, 'trace handle cleanup');
  assert.equal(f.calls[0], 'Tracing.end');
  assert.equal(f.state.trace.streamComplete, false);
  assert.equal(f.state.complete, false); assert.equal(f.state.partial, true);
  assert.strictEqual(f.state.cpuProfile, profile);
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
