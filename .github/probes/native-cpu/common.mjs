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
  assert(Object.hasOwn(manifest.cases, name), 'Only the two immutable cases are permitted');
  return manifest.cases[name];
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
