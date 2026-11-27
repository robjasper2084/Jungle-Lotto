import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {scanTraceStream} from './trace-parser.mjs';

const prefix = 'belle-native-cpu:';
const asObject = map => Object.fromEntries(map);
const bytesOf = value => Buffer.byteLength(JSON.stringify(value));

// One scope owns the stop-issued deadline and every filesystem reader. A timer
// rejection alone would leave the parser's deliberate hash-only drain running.
export function createTraceFinalizationScope(deadline, {now = Date.now, onAbort = () => {}} = {}) {
  assert(Number.isFinite(deadline), 'A fixed trace finalization deadline is required');
  const controller = new AbortController(), readers = new Set();
  let disposed = false;
  const abort = reason => {
    if (controller.signal.aborted) return;
    const error = reason instanceof Error ? reason : Error(String(reason));
    controller.abort(error);
    try { onAbort(error); }
    finally { for (const reader of readers) reader.destroy(error); }
  };
  const check = () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (now() >= deadline) {
      abort(Error('Trace finalization deadline reached; evidence remains partial'));
      throw controller.signal.reason;
    }
  };
  const timer = setTimeout(() => abort(Error('Trace finalization timed out at its absolute deadline')),
    Math.max(1, deadline - now()));
  timer.unref?.();
  return {
    deadline, signal: controller.signal, abort, check,
    get activeReaders() { return readers.size; },
    async wait(promise) {
      const pending = Promise.resolve(promise);
      // An already-started I/O operation may settle after cancellation. Observe
      // its rejection, but never let its late result resume the caller.
      void pending.catch(() => {});
      check();
      let rejectAbort;
      const interrupted = new Promise((_, reject) => { rejectAbort = reject; });
      const listener = () => rejectAbort(controller.signal.reason);
      controller.signal.addEventListener('abort', listener, {once: true});
      try {
        const value = await Promise.race([pending, interrupted]);
        check(); return value;
      } finally { controller.signal.removeEventListener('abort', listener); }
    },
    track(reader) {
      assert(reader && typeof reader.destroy === 'function' && typeof reader.once === 'function',
        'Trace readers must be explicitly destroyable streams');
      if (disposed || controller.signal.aborted || now() >= deadline) {
        reader.on('error', () => {}); reader.destroy(controller.signal.reason);
        check(); throw Error('Trace finalization scope was disposed');
      }
      readers.add(reader);
      // Cover an abort between creation and attachment of the async iterator.
      reader.on('error', () => {});
      const closed = new Promise(resolve => reader.once('close', () => { readers.delete(reader); resolve(); }));
      return closed;
    },
    dispose() {
      disposed = true; clearTimeout(timer);
      if (readers.size) abort(Error('Trace scope disposed with an active filesystem reader'));
    }
  };
}

// The two phases retain no event array. Metadata/marks preserve their original
// fields; flow IDs remain authoritative only in the unchanged raw trace.
export function createTraceTopologyAccumulator(limits, requiredCategories, {strict = true} = {}) {
  const metadata = [], marks = [], tracks = new Map();
  const categories = new Map(), trustedWindowCategories = new Map(), flowFields = new Map(), flowPhases = new Map();
  const phases = new Set(), serviceTracks = new Map(), vizTracks = new Map(), topLevelTracks = new Map();
  const gpuFlowTracks = new Map(), vizFlowTracks = new Map();
  let metadataBytes = 0, markBytes = 0, metadataOverflow = 0, trackOverflow = 0, guardOverflow = 0;
  let first, last, windowAvailable = false, phase = 'index';
  let flowRecords = 0, windowFlowRecords = 0, pipelineReporters = 0, gpuServiceEvents = 0, vizEvents = 0, mainRafEvents = 0;
  const failures = [];
  const boundsReceipt = () => ({metadataRows: metadata.length, metadataBytes, marks: marks.length, markBytes,
    tracks: tracks.size, categories: categories.size, phases: phases.size, metadataOverflow, trackOverflow, guardOverflow,
    auxiliaryTracks: {service: serviceTracks.size, viz: vizTracks.size, topLevel: topLevelTracks.size,
      gpuFlows: gpuFlowTracks.size, vizFlows: vizFlowTracks.size}, failures: [...failures]});
  const fail = name => {
    guardOverflow++;
    if (failures.length < 16 && !failures.includes(name)) failures.push(name);
    if (strict) {
      const error = Error('Trace index bound exceeded: ' + name);
      error.traceIndexBounds = boundsReceipt(); throw error;
    }
    return false;
  };
  const keyOf = row => {
    const key = JSON.stringify([row.pid, row.tid]);
    return key.length <= limits.traceTrackKeyChars ? key : (fail('track-key-chars'), null);
  };
  const admit = row => {
    const key = keyOf(row);
    if (key === null) return null;
    if (!tracks.has(key)) {
      if (tracks.size >= limits.traceTracks) { trackOverflow++; fail('tracks'); return null; }
      tracks.set(key, {pid: row.pid, tid: row.tid, events: 0, trustedWindowEvents: 0});
    }
    return key;
  };
  const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  const index = row => {
    assert.equal(phase, 'index', 'Trace metadata phase has ended');
    admit(row);
    if (row.ph === 'M') {
      const bytes = bytesOf(row);
      if (metadata.length >= limits.traceMetadataRows || metadataBytes + bytes > limits.traceMetadataBytes) {
        metadataOverflow++; fail('metadata-retention');
      } else { metadataBytes += bytes; metadata.push(row); }
    }
    if (String(row.name).startsWith(prefix)) {
      const {name, ts, pid, tid, ph, cat, args} = row;
      const mark = {name, ts, pid, tid, ph, cat, args}, bytes = bytesOf(mark);
      if (marks.length >= limits.marks || markBytes + bytes > limits.traceMarkBytes) fail('mark-retention');
      else { markBytes += bytes; marks.push(mark); }
    }
  };
  const beginCoverage = () => {
    assert.equal(phase, 'index', 'Trace coverage cannot be restarted'); phase = 'coverage';
    first = marks.find(row => row.name === prefix + 'first-trusted-w');
    last = marks.find(row => row.name === prefix + 'trusted-w-keyup');
    windowAvailable = Number.isFinite(first?.ts) && Number.isFinite(last?.ts) && last.ts > first.ts;
  };
  const recordFlowTrack = (collection, key, row) => {
    assert(tracks.has(key), 'An auxiliary trace map cannot retain an unadmitted track');
    const track = collection.get(key) || {pid: row.pid, tid: row.tid, records: 0};
    track.records++; collection.set(key, track);
  };
  const observe = row => {
    assert.equal(phase, 'coverage', 'Trace coverage phase has not started');
    const key = keyOf(row);
    if (key === null || !tracks.has(key)) { fail('unadmitted-coverage-track'); return; }
    const phaseName = String(row.ph);
    if (phaseName.length > limits.tracePhaseChars || (!phases.has(phaseName) && phases.size >= limits.tracePhases)) {
      fail('phases'); return;
    }
    phases.add(phaseName);
    const categoryText = String(row.cat || '');
    if (categoryText.length > limits.traceCategoryTextChars) { fail('category-text'); return; }
    const cats = categoryText.split(',');
    for (const cat of cats) {
      if (!categories.has(cat) && categories.size >= limits.traceCategories) { fail('categories'); return; }
      increment(categories, cat);
    }
    const windowEvent = windowAvailable && Number.isFinite(row.ts) && row.ts >= first.ts && row.ts <= last.ts;
    const track = tracks.get(key); track.events++; if (windowEvent) track.trustedWindowEvents++;
    const fields = ['id', 'id2', 'bind_id', 'flow_in', 'flow_out'].filter(field => Object.hasOwn(row, field));
    for (const field of fields) increment(flowFields, field);
    const flow = ['s', 't', 'f'].includes(row.ph) || row.flow_in === true || row.flow_out === true || Object.hasOwn(row, 'bind_id');
    if (flow) {
      flowRecords++; if (windowEvent) windowFlowRecords++;
      increment(flowPhases, phaseName);
    }
    if (!windowEvent) return;
    for (const cat of cats) increment(trustedWindowCategories, cat);
    if (flow && cats.includes('gpu')) recordFlowTrack(gpuFlowTracks, key, row);
    if (flow && cats.includes('viz')) recordFlowTrack(vizFlowTracks, key, row);
    if (cats.includes('toplevel')) topLevelTracks.set(key, {pid: row.pid, tid: row.tid});
    if (row.name === 'FireAnimationFrame' && row.pid === first.pid && row.tid === first.tid) mainRafEvents++;
    if (cats.includes('gpu') && ['Scheduler::RunTask', 'CommandBufferStub::OnAsyncFlush', 'CommandBufferStub::PerformWork'].includes(row.name)) {
      gpuServiceEvents++; serviceTracks.set(key, {pid: row.pid, tid: row.tid});
    }
    if (cats.includes('viz') && (row.name === 'Display::DrawAndSwap' || String(row.name).startsWith('Graphics.Pipeline'))) {
      vizEvents++; vizTracks.set(key, {pid: row.pid, tid: row.tid});
    }
    if (cats.includes('cc') && row.name === 'PipelineReporter') pipelineReporters++;
  };
  const finish = () => {
    assert.equal(phase, 'coverage', 'Trace coverage has not completed');
    const named = track => metadata.some(row => row.name === 'process_name' && row.pid === track.pid && row.args?.name) &&
      metadata.some(row => row.name === 'thread_name' && row.pid === track.pid && row.tid === track.tid && row.args?.name);
    const qualifyingFlows = (flows, evidenceTracks) => [...flows.entries()]
      .filter(([key, track]) => evidenceTracks.has(key) && track.pid !== first?.pid && named(track))
      .map(([, track]) => track);
    const qualifyingGpuFlowTracks = qualifyingFlows(gpuFlowTracks, serviceTracks);
    const qualifyingVizFlowTracks = qualifyingFlows(vizFlowTracks, vizTracks);
    const windowGpuFlowRecords = qualifyingGpuFlowTracks.reduce((sum, track) => sum + track.records, 0);
    const windowVizFlowRecords = qualifyingVizFlowTracks.reduce((sum, track) => sum + track.records, 0);
    const requiredCategoryCounts = Object.fromEntries(requiredCategories.map(name => [name, trustedWindowCategories.get(name) || 0]));
    const requirements = {
      trustedWindowAvailable: windowAvailable,
      allRequiredCategoriesPresentInTrustedWindow: Object.values(requiredCategoryCounts).every(count => count > 0),
      rendererProcessNamed: !!first && named(first), mainThreadRafTracePresent: mainRafEvents > 0,
      namedBrowserTaskTrackPresent: [...topLevelTracks.values()].some(track => named(track) &&
        metadata.some(row => row.name === 'process_name' && row.pid === track.pid && /browser/i.test(row.args?.name || ''))),
      namedGpuServiceTrackOutsideRenderer: [...serviceTracks.values()].some(track => track.pid !== first?.pid && named(track)),
      namedVizTrackOutsideRenderer: [...vizTracks.values()].some(track => track.pid !== first?.pid && named(track)),
      compositorPipelineReporterPresent: pipelineReporters > 0,
      gpuFlowsPresentInTrustedWindow: windowGpuFlowRecords > 0, vizFlowsPresentInTrustedWindow: windowVizFlowRecords > 0,
      metadataWithinBounds: metadataOverflow === 0 && trackOverflow === 0 && guardOverflow === 0
    };
    return {
      rawTraceFile: 'native-trace.json', gpuExecutionMeasured: false,
      note: 'Process/thread metadata is retained below. Raw flow IDs (id/id2/bind_id and flow flags), typed pipeline arguments, phases and timestamps remain in the unchanged hashed trace; this index does not normalize their IDs. GPU-service and toplevel spans are CPU-thread wall intervals, not hardware GPU duration.',
      trustedWindow: windowAvailable ? {startTs: first.ts, endTs: last.ts, rendererPid: first.pid, rendererTid: first.tid} : null,
      metadata, metadataOverflow, tracks: [...tracks.values()], trackOverflow,
      flowRecords, windowFlowRecords, windowGpuFlowRecords, windowVizFlowRecords,
      flowFields: asObject(flowFields), flowPhases: asObject(flowPhases), categories: asObject(categories),
      trustedWindowCategories: asObject(trustedWindowCategories), requiredCategoryCounts,
      qualifyingGpuFlowTracks, qualifyingVizFlowTracks, mainRafEvents, topLevelTracks: [...topLevelTracks.values()],
      gpuServiceEvents, gpuServiceTracks: [...serviceTracks.values()], vizEvents, vizTracks: [...vizTracks.values()], pipelineReporters,
      requirements, available: Object.values(requirements).every(Boolean)
    };
  };
  return {index, beginCoverage, observe, finish, marks, boundsReceipt};
}

export function summarizeTraceTopologyEvents(events, limits, categories) {
  const accumulator = createTraceTopologyAccumulator(limits, categories, {strict: false});
  for (const row of events) accumulator.index(row);
  accumulator.beginCoverage();
  for (const row of events) accumulator.observe(row);
  return accumulator.finish();
}

export function reconcileTracePasses(first, second) {
  for (const receipt of [first, second]) {
    assert(receipt.completeFile === true && receipt.completeDocument === true, 'Both trace passes must reach validated EOF');
    assert.equal(receipt.rootShape, 'object', 'Native trace must retain its original object root');
  }
  for (const key of ['sha256', 'bytes', 'events']) assert.equal(second[key], first[key], 'Raw trace changed between passes: ' + key);
  return {...first, passes: 2, unchangedBetweenPasses: true};
}

export async function indexTraceSource(openStream, {limits, categories, scope, onReceipt = () => {}}) {
  const accumulator = createTraceTopologyAccumulator(limits, categories), receipts = [];
  const scan = async (pass, visit) => {
    scope.check();
    const reader = openStream(pass), closed = scope.track(reader);
    let bytes = 0;
    async function* guardedBytes() {
      try {
        for await (const chunk of reader) {
          scope.check();
          assert(chunk instanceof Uint8Array, 'Trace reader must yield bytes');
          assert(chunk.byteLength <= limits.traceReaderChunkBytes, 'Trace reader chunk exceeds its bound');
          bytes += chunk.byteLength;
          assert(bytes <= limits.traceFileBytes, 'Retained trace exceeds its declared file cap');
          yield chunk;
          // Runs even after the parser has switched into hash-only draining.
          scope.check();
        }
        scope.check();
      } finally { reader.destroy(); }
    }
    try {
      const receipt = await scope.wait(scanTraceStream(guardedBytes(), row => {
        scope.check(); visit(row); scope.check();
      }, {maxRecordChars: limits.traceRecordChars, maxDepth: limits.traceNestingDepth,
        maxRootKeys: limits.traceRootKeys, maxRootKeyChars: limits.traceRootKeyChars}));
      await scope.wait(closed); scope.check();
      assert(receipt.completeFile && receipt.completeDocument, 'Trace pass did not validate its complete document');
      assert.equal(receipt.rootShape, 'object', 'Native trace must retain its original object root');
      receipts.push(receipt); onReceipt({pass, complete: true, receipt});
      return receipt;
    } catch (error) {
      onReceipt({pass, complete: false, receipt: error.traceReceipt || null,
        error: String(error), bounds: error.traceIndexBounds || accumulator.boundsReceipt()});
      throw error;
    } finally { reader.destroy(); }
  };
  try {
    const first = await scan(1, accumulator.index);
    accumulator.beginCoverage();
    const second = await scan(2, accumulator.observe);
    scope.check();
    const receipt = reconcileTracePasses(first, second), topology = accumulator.finish();
    scope.check();
    assert.equal(scope.activeReaders, 0, 'Trace indexing cannot finish with a background reader');
    return {receipt, topology, marks: accumulator.marks, bounds: accumulator.boundsReceipt()};
  } catch (error) {
    scope.abort(error);
    error.tracePasses = receipts; throw error;
  }
}

export function indexTraceFile(path, options) {
  return indexTraceSource(() => createReadStream(path, {highWaterMark: options.limits.traceReaderChunkBytes}), options);
}
