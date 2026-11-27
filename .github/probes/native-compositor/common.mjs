import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';

export const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const gitBlob = bytes => createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
export const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {maxBuffer: 32 * 1024 * 1024});
let serial = 0;
export async function saveJson(path, value) {
  await mkdir(resolve(path, '..'), {recursive: true});
  const temporary = path + '.tmp-' + process.pid + '-' + (++serial);
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}
export function bounded(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label + ' timed out after ' + milliseconds + ' ms')), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}
export function invalidateDiagnostic(state, where, error, {io = false} = {}) {
  state.complete = false;
  state.partial = true;
  state.failureRevision = (state.failureRevision || 0) + 1;
  state.finalization ??= {transportClosed: false, writesHealthy: true, statusPersisted: false};
  state.finalization.statusPersisted = false;
  if (io) {
    state.ioError = String(error);
    state.finalization.writesHealthy = false;
  }
  if (error !== undefined) {
    state.errors ??= [];
    if (state.errors.length < 64) state.errors.push({where, message: String(error?.stack || error).slice(0, 4000)});
    else state.errorOverflow = (state.errorOverflow || 0) + 1;
  }
  if (state.phase === 'complete-diagnostic-only') state.phase = 'partial-diagnostic';
}
function diagnosticHasNoFailures(state) {
  return state?.partial === false && Array.isArray(state.errors) && state.errors.length === 0 &&
    !(state.errorCount > 0) && state.errorOverflow === 0 && state.failureRevision === 0 && !state.ioError &&
    state.bundleOverflow === 0 && state.assetEventOverflow === 0 && state.parsedScriptOverflow === 0 &&
    state.trace?.capReached === false && state.trace?.dataLossOccurred === false &&
    state.finalization?.writesHealthy === true;
}
export function diagnosticStateIsClean(state) {
  return state?.complete === true && state.phase === 'complete-diagnostic-only' &&
    diagnosticHasNoFailures(state) && state.finalization?.transportClosed === true &&
    state.finalization?.statusPersisted === true;
}
export async function finalizeDiagnostic(state, {eligible, detach, flush, writeStatus}) {
  state.complete = false;
  state.phase = 'finalizing';
  state.finalization.statusPersisted = false;
  try { await detach(); state.finalization.transportClosed = true; }
  catch (error) {
    state.finalization.transportClosed = false;
    invalidateDiagnostic(state, 'final-detach', error);
  }
  try { await flush(); }
  catch (error) { invalidateDiagnostic(state, 'final-flush', error, {io: true}); }
  const candidate = eligible && diagnosticHasNoFailures(state) && state.finalization.transportClosed;
  const revision = state.failureRevision;
  const snapshot = structuredClone(state);
  snapshot.complete = !!candidate; snapshot.partial = !candidate;
  snapshot.phase = candidate ? 'complete-diagnostic-only' : 'partial-diagnostic';
  snapshot.finalization.statusPersisted = true;
  try {
    if (await writeStatus(snapshot) === false) throw Error('Final status write failed');
  } catch (error) {
    invalidateDiagnostic(state, 'final-status-write', error, {io: true});
    state.phase = 'partial-diagnostic';
    return false;
  }
  // A late asset/transport/write failure during the await must never be erased
  // by promotion of the earlier successful candidate snapshot.
  if (state.failureRevision !== revision || (candidate && !diagnosticHasNoFailures(state))) {
    state.complete = false; state.partial = true; state.phase = 'partial-diagnostic';
    state.finalization.statusPersisted = false;
    return false;
  }
  state.complete = !!candidate; state.partial = !candidate; state.phase = snapshot.phase;
  state.finalization.statusPersisted = true;
  return diagnosticStateIsClean(state);
}
export function terminalDiagnosticReceipt(state, code = null) {
  return {
    invocationId: state.invocationId, code, phase: state.phase,
    complete: diagnosticStateIsClean(state), partial: state.partial || !diagnosticStateIsClean(state),
    failureRevision: state.failureRevision, errorOverflow: state.errorOverflow,
    errorCount: state.errors?.length ?? 0,
    errors: (state.errors || []).slice(0, 8).map(row => ({where: row.where, message: row.message.slice(0, 256)})),
    ioError: state.ioError ?? null, finalization: structuredClone(state.finalization),
    bundleOverflow: state.bundleOverflow, assetEventOverflow: state.assetEventOverflow,
    parsedScriptOverflow: state.parsedScriptOverflow,
    trace: {capReached: state.trace?.capReached, dataLossOccurred: state.trace?.dataLossOccurred}
  };
}
export function diagnosticRunIsClean(status, terminal, invocationId, cleanupTerminal = null) {
  return !!invocationId && status?.invocationId === invocationId && terminal?.invocationId === invocationId &&
    diagnosticStateIsClean(status) && diagnosticStateIsClean(terminal) &&
    (!cleanupTerminal || (cleanupTerminal.invocationId === invocationId && diagnosticStateIsClean(cleanupTerminal)));
}
export async function boundedDiagnosticCleanup(state, {finish, persist, terminal, timeoutMs}) {
  try {
    await bounded((async () => {
      await finish();
      if (await persist() === false) throw Error('Cleanup status persistence failed');
    })(), timeoutMs, 'Complete observer cleanup');
  } catch (error) {
    invalidateDiagnostic(state, 'bounded-cleanup', error);
    // Never wait on the same possibly blocked write queue after the deadline.
    try { terminal(terminalDiagnosticReceipt(state)); }
    catch (writeError) { invalidateDiagnostic(state, 'cleanup-terminal-write', writeError, {io: true}); }
  }
}
export function selectCase(name) {
  assert(Object.hasOwn(manifest.cases, name), 'Only the immutable original 210 case is permitted');
  return manifest.cases[name];
}
export function requiredTraceCategories(available) {
  assert(Array.isArray(available), 'Tracing.getCategories did not return an array');
  const missing = manifest.trace.categories.filter(name => !available.includes(name));
  assert.equal(missing.length, 0, 'Required compositor trace categories unavailable: ' + missing.join(', '));
  return [...manifest.trace.categories];
}
// The raw trace file is the authority for flow identifiers. This bounded index
// never rewrites or converts those identifiers, and never claims GPU execution.
export function summarizeTraceTopology(events, limits) {
  const metadata = [], tracks = new Map(), flowFields = {}, flowPhases = {}, categories = {};
  let metadataOverflow = 0, trackOverflow = 0, flowRecords = 0, windowFlowRecords = 0;
  const first = events.find(row => row.name === 'belle-native-cpu:first-trusted-w');
  const last = events.find(row => row.name === 'belle-native-cpu:trusted-w-keyup');
  const windowAvailable = Number.isFinite(first?.ts) && Number.isFinite(last?.ts) && last.ts > first.ts;
  const inWindow = row => windowAvailable && Number.isFinite(row.ts) && row.ts >= first.ts && row.ts <= last.ts;
  const serviceTracks = new Map(), vizTracks = new Map(), topLevelTracks = new Map();
  const gpuFlowTracks = new Map(), vizFlowTracks = new Map();
  let pipelineReporters = 0, gpuServiceEvents = 0, vizEvents = 0, mainRafEvents = 0;
  const trackKey = row => JSON.stringify([row.pid, row.tid]);
  const recordFlowTrack = (collection, row) => {
    const key = trackKey(row);
    const track = collection.get(key) || {pid: row.pid, tid: row.tid, records: 0};
    track.records++; collection.set(key, track);
  };
  for (const row of events) {
    if (row.ph === 'M') {
      if (metadata.length < limits.traceMetadataRows) metadata.push(row);
      else metadataOverflow++;
    }
    const key = trackKey(row), windowEvent = inWindow(row);
    if (!tracks.has(key)) {
      if (tracks.size < limits.traceTracks) tracks.set(key, {pid: row.pid, tid: row.tid, events: 0, trustedWindowEvents: 0});
      else trackOverflow++;
    }
    const track = tracks.get(key);
    if (track) { track.events++; if (windowEvent) track.trustedWindowEvents++; }
    const cats = String(row.cat || '').split(',');
    for (const cat of cats) categories[cat] = (categories[cat] || 0) + 1;
    const fields = ['id', 'id2', 'bind_id', 'flow_in', 'flow_out'].filter(field => Object.hasOwn(row, field));
    for (const field of fields) flowFields[field] = (flowFields[field] || 0) + 1;
    const flow = ['s', 't', 'f'].includes(row.ph) || row.flow_in === true || row.flow_out === true || Object.hasOwn(row, 'bind_id');
    if (flow) {
      flowRecords++; if (windowEvent) windowFlowRecords++;
      flowPhases[row.ph] = (flowPhases[row.ph] || 0) + 1;
    }
    if (!windowEvent) continue;
    if (flow && cats.includes('gpu')) recordFlowTrack(gpuFlowTracks, row);
    if (flow && cats.includes('viz')) recordFlowTrack(vizFlowTracks, row);
    if (cats.includes('toplevel')) topLevelTracks.set(key, {pid: row.pid, tid: row.tid});
    if (row.name === 'FireAnimationFrame' && row.pid === first.pid && row.tid === first.tid) mainRafEvents++;
    if (cats.includes('gpu') && ['Scheduler::RunTask', 'CommandBufferStub::OnAsyncFlush', 'CommandBufferStub::PerformWork'].includes(row.name)) {
      gpuServiceEvents++; serviceTracks.set(key, {pid: row.pid, tid: row.tid});
    }
    if (cats.includes('viz') && (row.name === 'Display::DrawAndSwap' || String(row.name).startsWith('Graphics.Pipeline'))) {
      vizEvents++; vizTracks.set(key, {pid: row.pid, tid: row.tid});
    }
    if (cats.includes('cc') && row.name === 'PipelineReporter') pipelineReporters++;
  }
  const named = track => metadata.some(row => row.name === 'process_name' && row.pid === track.pid && row.args?.name) &&
    metadata.some(row => row.name === 'thread_name' && row.pid === track.pid && row.tid === track.tid && row.args?.name);
  // Category labels alone are insufficient: renderer-side flows must not be
  // combined with unrelated service/Viz tracks to claim cross-process coverage.
  const qualifyingFlows = (flows, evidenceTracks) => [...flows.entries()]
    .filter(([key, track]) => evidenceTracks.has(key) && track.pid !== first?.pid && named(track))
    .map(([, track]) => track);
  const qualifyingGpuFlowTracks = qualifyingFlows(gpuFlowTracks, serviceTracks);
  const qualifyingVizFlowTracks = qualifyingFlows(vizFlowTracks, vizTracks);
  const windowGpuFlowRecords = qualifyingGpuFlowTracks.reduce((sum, track) => sum + track.records, 0);
  const windowVizFlowRecords = qualifyingVizFlowTracks.reduce((sum, track) => sum + track.records, 0);
  const requirements = {
    trustedWindowAvailable: windowAvailable,
    rendererProcessNamed: !!first && named(first),
    mainThreadRafTracePresent: mainRafEvents > 0,
    namedBrowserTaskTrackPresent: [...topLevelTracks.values()].some(track => named(track) &&
      metadata.some(row => row.name === 'process_name' && row.pid === track.pid && /browser/i.test(row.args?.name || ''))),
    namedGpuServiceTrackOutsideRenderer: [...serviceTracks.values()].some(track => track.pid !== first?.pid && named(track)),
    namedVizTrackOutsideRenderer: [...vizTracks.values()].some(track => track.pid !== first?.pid && named(track)),
    compositorPipelineReporterPresent: pipelineReporters > 0,
    gpuFlowsPresentInTrustedWindow: windowGpuFlowRecords > 0,
    vizFlowsPresentInTrustedWindow: windowVizFlowRecords > 0,
    metadataWithinBounds: metadataOverflow === 0 && trackOverflow === 0
  };
  return {
    rawTraceFile: 'native-trace.json', gpuExecutionMeasured: false,
    note: 'Process/thread metadata is retained below. Raw flow IDs (id/id2/bind_id and flow flags), typed pipeline arguments, phases and timestamps remain in the unchanged hashed trace; this index does not normalize their IDs. GPU-service and toplevel spans are CPU-thread wall intervals, not hardware GPU duration.',
    trustedWindow: windowAvailable ? {startTs: first.ts, endTs: last.ts, rendererPid: first.pid, rendererTid: first.tid} : null,
    metadata, metadataOverflow, tracks: [...tracks.values()], trackOverflow,
    flowRecords, windowFlowRecords, windowGpuFlowRecords, windowVizFlowRecords, flowFields, flowPhases, categories,
    qualifyingGpuFlowTracks, qualifyingVizFlowTracks,
    mainRafEvents, topLevelTracks: [...topLevelTracks.values()],
    gpuServiceEvents, gpuServiceTracks: [...serviceTracks.values()], vizEvents, vizTracks: [...vizTracks.values()], pipelineReporters,
    requirements, available: Object.values(requirements).every(Boolean)
  };
}
export function verifyDriver(bytes) {
  assert.equal(bytes.length, manifest.driver.bytes, 'Original driver byte count changed');
  assert.equal(sha256(bytes), manifest.driver.sha256, 'Original driver SHA-256 changed');
  assert.equal(gitBlob(bytes), manifest.driver.gitBlob, 'Original driver Git blob changed');
}
export function buildStatisticOnly(before, after) {
  const a = structuredClone(before), b = structuredClone(after);
  assert.equal(typeof a.buildMs, 'number', 'Missing original build statistic');
  assert.equal(typeof b.buildMs, 'number', 'Missing resulting build statistic');
  delete a.buildMs; delete b.buildMs;
  assert.deepEqual(a, b, 'Build changed more than its elapsed buildMs statistic');
}
export async function verifySource(root, name, {objectsOnly = false, allowBuildStatistic = false} = {}) {
  const target = selectCase(name);
  assert.equal(git(root, 'rev-parse', target.commit + '^{tree}').toString().trim(), target.tree);
  const fromObject = path => git(root, 'show', target.commit + ':' + path);
  verifyDriver(fromObject(manifest.driver.path));
  const files = {};
  for (const [suffix, expected] of Object.entries(manifest.packageFiles)) {
    const path = manifest.project + '/' + suffix, bytes = fromObject(path);
    assert.equal(sha256(bytes), expected, 'Pinned package file differs: ' + path);
    if (!objectsOnly) assert.equal(sha256(await readFile(resolve(root, path))), expected, 'Working package file differs: ' + path);
    files[path] = {sha256: expected, gitBlob: gitBlob(bytes), bytes: bytes.length};
  }
  const lock = JSON.parse(fromObject(manifest.project + '/package-lock.json'));
  assert.equal(lock.packages['node_modules/@playwright/test'].version, manifest.runtime.playwright);
  const changes = [];
  if (!objectsOnly) {
    assert.equal(git(root, 'rev-parse', 'HEAD').toString().trim(), target.commit, 'Checkout is not the fixed source commit');
    verifyDriver(await readFile(resolve(root, manifest.driver.path)));
    const paths = git(root, 'diff', '--name-only', '-z', 'HEAD', '--').toString().split('\0').filter(Boolean);
    const statistic = manifest.project + '/belle-isle-source/research/street-detail-stats.json';
    for (const path of paths) {
      assert(allowBuildStatistic && path === statistic, 'Tracked source mutation: ' + path);
      const before = JSON.parse(fromObject(path));
      const bytes = await readFile(resolve(root, path)), after = JSON.parse(bytes);
      buildStatisticOnly(before, after);
      changes.push({path, onlyElapsedBuildMsDiffers: true, before, after, afterSha256: sha256(bytes)});
    }
  }
  return {case: name, ...target, objectsOnly, driver: manifest.driver, packageFiles: files, buildStatisticChanges: changes};
}
export async function hashDirectory(root) {
  const rows = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      assert(!entry.isSymbolicLink(), 'Unexpected output symlink: ' + path);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        rows.push({path: relative(root, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha256(bytes)});
      }
    }
  }
  await visit(root);
  assert(rows.length > 0, 'Empty build output');
  return {files: rows, manifestSha256: sha256(Buffer.from(JSON.stringify(rows)))};
}
