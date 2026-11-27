// Read-only post-capture audit. The archive is never modified or unpacked here.
import assert from 'node:assert/strict';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {scanTraceStream} from './sustained-trace-json.mjs';

let auditProgress = {};
async function main() {
const [archiveArgument, outputArgument, fixedArgument] = process.argv.slice(2);
assert(archiveArgument && outputArgument && fixedArgument, 'ZIP, output directory and fixed JSON required');
const archive = resolve(archiveArgument), outputDirectory = resolve(outputArgument);
const destination = resolve(outputDirectory, 'environment-trace-stream-audit.json');
await mkdir(outputDirectory, {recursive: true});
const fixed = JSON.parse(await readFile(resolve(fixedArgument), 'utf8'));
assert.equal(fixed.capture.runId, 45987971947);
assert.equal(fixed.capture.attempt, 1);
assert.equal(fixed.capture.artifactId, 15193147198);
assert.equal(fixed.capture.head, 'a8e8b97a531d57b3c2b5b23d99aa0636d4c8dd25');
const captureAudit = JSON.parse(await readFile(resolve(outputDirectory, 'environment-capture-audit.json'), 'utf8'));
const readSmallMembers = String.raw`
import hashlib,json,pathlib,re,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 infos=z.infolist()
 assert len(infos)<=4096, 'Unexpected archive entry count'
 names=[i.filename for i in infos]
 assert len(names)==len(set(names)), 'Duplicate archive member names'
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts and chr(92) not in n for n in names), 'Unsafe member name'
 results=[n for n in names if n=='result.json' or n.endswith('/result.json')]
 assert len(results)==1, 'One diagnostic result required'
 prefix=results[0][:-len('result.json')]
 receipts=[]
 def read(name,required=True):
  assert name in ['diagnostic-status.json','trace-process-threads.json'] or re.fullmatch(r'observer-[A-Za-z0-9_-]+\.json',name), 'Unexpected small JSON member'
  member=prefix+name
  if member not in names:
   assert not required, 'Required small JSON member missing'
   return None
  info=z.getinfo(member)
  assert not info.is_dir() and info.file_size<=32*1024*1024, 'Small JSON member exceeds bound'
  data=z.read(info)
  assert len(data)==info.file_size, 'Small JSON length mismatch'
  receipts.append({'member':member,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'crcVerifiedByZipReader':True})
  return data.decode('utf-8')
 state=json.loads(read('diagnostic-status.json'))
 finals=[r for r in state.get('checkpoints',[]) if r.get('label')=='final']
 observer_member=finals[-1]['file'] if finals else None
 observer_text=read(observer_member,False) if observer_member else None
 producer=read('trace-process-threads.json',False)
 trace_names=[prefix+n for n in ['native-trace.json','native-trace.partial.json'] if prefix+n in names]
 assert len(trace_names)==1, 'Exactly one retained raw trace is required'
 info=z.getinfo(trace_names[0])
 assert info.file_size<=536870912, 'Retained trace exceeds declared file cap'
 print(json.dumps({'member':trace_names[0],'declaredTraceBytes':info.file_size,'state':state,
  'observerMember':prefix+observer_member if observer_member else None,'observerRawText':observer_text,
  'producer':json.loads(producer) if producer else None,'smallMemberReceipts':receipts},separators=(',',':')))
`;
const {stdout} = await promisify(execFile)('python3', ['-c', readSmallMembers, archive], {maxBuffer: 32 * 1024 * 1024, timeout: 60000});
const selected = JSON.parse(stdout), {member, state} = selected;
const observer = selected.observerRawText ? JSON.parse(selected.observerRawText) : null;
const producer = selected.producer || {};
if (selected.observerRawText) await writeFile(resolve(outputDirectory, 'observer-final.json'), selected.observerRawText);
auditProgress = {archive, member, selectedMemberReceipts: selected.smallMemberReceipts,
  observerMember: selected.observerMember, observerFile: selected.observerRawText ? 'observer-final.json' : null};
const required = ['cc', 'viz', 'gpu', 'toplevel', 'toplevel.flow', 'devtools.timeline', 'blink.user_timing'];
const checks = {}, check = (name, value) => checks[name] = Boolean(value);
const source = 'import sys,zipfile,shutil\nwith zipfile.ZipFile(sys.argv[1]) as z:\n with z.open(sys.argv[2]) as f: shutil.copyfileobj(f,sys.stdout.buffer,1024*1024)\n';
async function scan(visitor) {
  const child = spawn('python3', ['-c', source, archive, member], {stdio: ['ignore', 'pipe', 'pipe']});
  let stderr = ''; child.stderr.on('data', data => { stderr += data; });
  const closed = new Promise(done => child.once('close', (code, signal) => done({code, signal})));
  const receipt = await scanTraceStream(child.stdout, visitor);
  const outcome = await closed; assert.equal(outcome.code, 0, stderr);
  return receipt;
}
const increment = (table, key, n = 1) => table[key] = (table[key] || 0) + n;
const cats = row => String(row.cat || '').split(',');
const key = row => JSON.stringify([row.pid, row.tid]);
const metadata = [], marks = [], globalCategories = {}, phases = {}, tracks = new Map();
const flowFields = {}, flowPhases = {}; let flowRecords = 0, unsafeNumericFlowIdentifiers = 0;
let firstTimestamp = Infinity, lastTimestamp = -Infinity;
auditProgress = {...auditProgress, metadata, marks, globalCategories, phases, tracks: []};
const firstPass = await scan(row => {
  if (row.ph === 'M') { assert(metadata.length < 4096, 'Raw metadata row bound exceeded'); metadata.push(row); }
  if (String(row.name).startsWith('belle-native-cpu:')) {
    assert(marks.length < 256, 'Observer-prefix mark bound exceeded'); marks.push(row);
  }
  for (const category of cats(row)) increment(globalCategories, category);
  increment(phases, row.ph);
  let track = tracks.get(key(row));
  if (!track) {
    assert(tracks.size < 4096, 'Raw track bound exceeded');
    track = {pid: row.pid, tid: row.tid, events: 0}; tracks.set(key(row), track);
    auditProgress.tracks.push(track);
  }
  track.events++;
  if (Number.isFinite(row.ts)) { firstTimestamp = Math.min(firstTimestamp, row.ts); lastTimestamp = Math.max(lastTimestamp, row.ts); }
  for (const field of ['id', 'id2', 'bind_id', 'flow_in', 'flow_out']) if (Object.hasOwn(row, field)) {
    increment(flowFields, field);
    const value = row[field];
    if (typeof value === 'number' && !Number.isSafeInteger(value)) unsafeNumericFlowIdentifiers++;
    if (value && typeof value === 'object') for (const item of Object.values(value)) if (typeof item === 'number' && !Number.isSafeInteger(item)) unsafeNumericFlowIdentifiers++;
  }
  const flow = ['s', 't', 'f'].includes(row.ph) || row.flow_in === true || row.flow_out === true || Object.hasOwn(row, 'bind_id');
  if (flow) { flowRecords++; increment(flowPhases, row.ph); }
});
auditProgress = {...auditProgress, receipt: firstPass, metadata, marks, globalCategories, phases, tracks: [...tracks.values()],
  flowFields, flowPhases, flowRecords, unsafeNumericFlowIdentifiers};
const downRows = marks.filter(row => row.name === 'belle-native-cpu:first-trusted-w');
const upRows = marks.filter(row => row.name === 'belle-native-cpu:trusted-w-keyup');
check('one-trusted-mark-per-boundary', downRows.length === 1 && upRows.length === 1);
const first = downRows[0], last = upRows[0];
check('trusted-window-order-and-thread', first && last && Number.isFinite(first.ts) && last.ts > first.ts && key(first) === key(last));
assert(checks['trusted-window-order-and-thread'], 'Raw trusted-W window unavailable; no attribution is possible');
const processes = new Map(metadata.filter(row => row.name === 'process_name').map(row => [row.pid, row.args?.name]));
const threads = new Map(metadata.filter(row => row.name === 'thread_name').map(row => [key(row), row.args?.name]));
const named = row => Boolean(processes.get(row.pid) && threads.get(key(row)));
const windowCategories = {}, windowNames = new Map(), gpuFlows = new Map(), vizFlows = new Map();
const gpuTracks = new Map(), vizTracks = new Map(), browserTracks = new Map();
let pipeline = 0, raf = 0, gpuServiceEvents = 0, vizEvents = 0, windowFlowRecords = 0;
const bumpTrack = (map, row) => {
  const value = map.get(key(row)) || {pid: row.pid, tid: row.tid, records: 0};
  value.records++; map.set(key(row), value);
};
const explicitSetupNameCounts = new Map();
const secondPass = await scan(row => {
  if (!(Number.isFinite(row.ts) && row.ts >= first.ts && row.ts <= last.ts)) return;
  const categories = cats(row);
  for (const category of categories) increment(windowCategories, category);
  const group = JSON.stringify([row.pid, row.tid, row.cat, row.name, row.ph]);
  windowNames.set(group, (windowNames.get(group) || 0) + 1);
  const flow = ['s', 't', 'f'].includes(row.ph) || row.flow_in === true || row.flow_out === true || Object.hasOwn(row, 'bind_id');
  if (flow) {
    windowFlowRecords++;
    if (categories.includes('gpu')) bumpTrack(gpuFlows, row);
    if (categories.includes('viz')) bumpTrack(vizFlows, row);
  }
  if (categories.includes('gpu') && ['Scheduler::RunTask', 'CommandBufferStub::OnAsyncFlush', 'CommandBufferStub::PerformWork'].includes(row.name)) { gpuServiceEvents++; gpuTracks.set(key(row), row); }
  if (categories.includes('viz') && (row.name === 'Display::DrawAndSwap' || String(row.name).startsWith('Graphics.Pipeline'))) { vizEvents++; vizTracks.set(key(row), row); }
  if (categories.includes('toplevel') && /browser/i.test(processes.get(row.pid) || '') && named(row)) browserTracks.set(key(row), row);
  if (categories.includes('cc') && row.name === 'PipelineReporter') pipeline++;
  if (row.name === 'FireAnimationFrame' && key(row) === key(first)) raf++;
  if (/compile|linkprogram|create.*pipeline|metal|first.?use|shader.*cache/i.test(String(row.name))) explicitSetupNameCounts.set(group, (explicitSetupNameCounts.get(group) || 0) + 1);
});
check('raw-zip-passes-identical', firstPass.bytes === secondPass.bytes && firstPass.sha256 === secondPass.sha256 && firstPass.events === secondPass.events);
check('raw-file-sha-matches-recorder', firstPass.sha256 === state.trace.sha256);
check('raw-byte-count-matches-recorder', firstPass.bytes === state.trace.savedBytes);
check('raw-event-count-matches-recorder', firstPass.events === state.trace.eventCount);
check('raw-file-within-512MiB', firstPass.bytes <= 536870912);
const qualifying = map => [...map.values()].filter(row => row.pid !== first.pid && named(row));
const service = qualifying(gpuTracks), viz = qualifying(vizTracks);
const gpuFlowCount = service.reduce((sum, row) => sum + (gpuFlows.get(key(row))?.records || 0), 0);
const vizFlowCount = viz.reduce((sum, row) => sum + (vizFlows.get(key(row))?.records || 0), 0);
const categoryCounts = Object.fromEntries(required.map(category => [category, windowCategories[category] || 0]));
const coverage = {
  trustedStartUs: first.ts, trustedEndUs: last.ts, trustedDurationSeconds: (last.ts - first.ts) / 1e6,
  rendererPid: first.pid, rendererTid: first.tid, requiredCategoryCounts: categoryCounts,
  browserTracks: [...browserTracks.values()].map(({pid, tid}) => ({pid, tid})),
  gpuServiceTracks: service.map(({pid, tid}) => ({pid, tid})),
  vizTracks: viz.map(({pid, tid}) => ({pid, tid})),
  gpuFlowRecordsOnQualifyingTracks: gpuFlowCount, vizFlowRecordsOnQualifyingTracks: vizFlowCount,
  pipelineReporters: pipeline, mainRafEvents: raf, gpuServiceEvents, vizEvents,
  gpuExecutionMeasured: false
};
check('all-seven-raw-categories-in-trusted-window', Object.values(categoryCounts).every(n => n > 0));
check('renderer-named', named(first));
check('raw-cross-process-witnesses', browserTracks.size && service.length && viz.length && gpuFlowCount && vizFlowCount && pipeline && raf);
check('metadata-and-tracks-within-bounds', metadata.length <= 4096 && tracks.size <= 4096);
check('producer-topology-matches-raw', producer.available === true && producer.windowGpuFlowRecords === gpuFlowCount && producer.windowVizFlowRecords === vizFlowCount && producer.pipelineReporters === pipeline && producer.mainRafEvents === raf && JSON.stringify(producer.requiredCategoryCounts) === JSON.stringify(categoryCounts));
const pairedMarks = [first, last].map(row => ({trace: row, observer: observer?.marks?.find(mark => row.name === 'belle-native-cpu:' + mark.name)}));
const offsets = pairedMarks.map(row => row.observer ? row.trace.ts / 1000 - row.observer.atMs : null);
const offsetSpreadMs = offsets.every(Number.isFinite) ? Math.max(...offsets) - Math.min(...offsets) : null;
check('independent-clock-pairing', offsetSpreadMs !== null && offsetSpreadMs <= 5);
check('producer-clock-offsets-match', JSON.stringify(offsets) === JSON.stringify(state.alignment?.traceMinusObserverClockOffsetsMs));
const gaps = [], values = observer?.raf?.values || [];
if (offsets.every(Number.isFinite)) for (let i = 2; i < values.length; i += 2) {
  const startMs = values[i - 2], endMs = values[i];
  if (startMs < pairedMarks[0].observer.atMs || endMs > pairedMarks[1].observer.atMs || endMs - startMs <= 100) continue;
  gaps.push({index: i / 2, rafTimestampGapMs: endMs - startMs, callbackEntryGapMs: values[i + 1] - values[i - 1],
    previousRafTimestampMs: startMs, nextRafTimestampMs: endMs,
    previousCallbackEntryMs: values[i - 1], nextCallbackEntryMs: values[i + 1],
    rafTimestampTraceStartUs: (startMs + offsets[0]) * 1000, rafTimestampTraceEndUs: (endMs + offsets[0]) * 1000,
    callbackEntryTraceStartUs: (values[i - 1] + offsets[0]) * 1000, callbackEntryTraceEndUs: (values[i + 1] + offsets[0]) * 1000});
}
gaps.sort((a, b) => b.rafTimestampGapMs - a.rafTimestampGapMs);
const nameRows = map => [...map].map(([group, count]) => { const [pid, tid, cat, name, ph] = JSON.parse(group); return {pid, tid, cat, name, ph, count}; }).sort((a, b) => b.count - a.count);
const provenanceBlockingChecks = [...(captureAudit.issues || []), ...Object.entries(captureAudit.checks || {}).filter(([,value]) => value !== true).map(([name]) => name)];
if (captureAudit.auditCompleted !== true || captureAudit.provenanceChecksPassed !== true) provenanceBlockingChecks.push('capture-provenance-not-complete');
const rawFailedChecks = Object.keys(checks).filter(name => !checks[name]);
const blockingChecks = [...new Set([...provenanceBlockingChecks, ...rawFailedChecks])];
const output = {auditCompleted: true, releaseAcceptance: false, attributionAllowed: blockingChecks.length === 0,
  blockingChecks, captureAuditFile: 'environment-capture-audit.json',
  selectedMemberReceipts: selected.smallMemberReceipts, observerMember: selected.observerMember,
  observerFile: selected.observerRawText ? 'observer-final.json' : null,
  scope: 'Independent, read-only ZIP-stream audit; no raw file extraction or mutation.', archive, member,
  receipt: {...firstPass, passes: 2, unchangedBetweenPasses: checks['raw-zip-passes-identical']}, checks,
  failedChecks: rawFailedChecks,
  coverage, clock: {pairedMarks, traceMinusObserverClockOffsetsMs: offsets, offsetSpreadMs},
  rawRafGapsOver100ms: gaps, metadata, globalCategories, trustedWindowCategories: windowCategories,
  phases, tracks: [...tracks.values()], flowFields, flowPhases, flowRecords, windowFlowRecords,
  unsafeNumericFlowIdentifiers,
  rawFlowNote: 'Original bytes remain unchanged inside the ZIP. This derived audit counts fields and witnesses but does not join flow identifiers. JavaScript-unsafe numeric IDs cannot support a causal join here.',
  explicitSetupNameCounts: nameRows(explicitSetupNameCounts), trustedWindowEventNames: nameRows(windowNames),
  observedTimestampSpanSeconds: (lastTimestamp - firstTimestamp) / 1e6,
  limitation: 'GPU-service/toplevel spans are CPU-thread wall intervals, not hardware GPU execution. No causal attribution follows merely from category or thread names.'};
await writeFile(destination, JSON.stringify(output, null, 2) + '\n');
console.log('TRACE_AUDIT_JSON=' + JSON.stringify(output));
process.exitCode = output.attributionAllowed ? 0 : 1;
}
main().catch(async error => {
  const failed = {...auditProgress, auditCompleted: false, releaseAcceptance: false, attributionAllowed: false,
    failedChecks: ['audit-exception'], blockingChecks: ['audit-exception'],
    error: String(error?.stack || error), receipt: error?.traceReceipt || auditProgress.receipt || null,
    limitation: 'Partial inventory only. Missing provenance, raw W marks, clock or topology forbids timing attribution.'};
  if (process.argv[3]) {
    try {
      const directory = resolve(process.argv[3]); await mkdir(directory, {recursive: true});
      await writeFile(resolve(directory, 'environment-trace-stream-audit.json'), JSON.stringify(failed, null, 2) + '\n');
    } catch (writeError) { failed.reportWriteError = String(writeError); }
  }
  console.log('TRACE_AUDIT_JSON=' + JSON.stringify(failed));
  process.exitCode = 1;
});
