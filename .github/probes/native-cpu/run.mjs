import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {manifest, selectCase, verifySource, hashDirectory, saveJson, sha256, git, diagnosticRunIsClean} from './common.mjs';

const [action, caseName, sourceArgument, outputArgument] = process.argv.slice(2);
assert(['inspect', 'prepare', 'built', 'run'].includes(action), 'Unknown probe action');
const target = selectCase(caseName), source = resolve(sourceArgument), output = resolve(outputArgument);
await mkdir(output, {recursive: true});
await saveJson(resolve(output, 'payload-manifest.json'), manifest);
const contract = await verifySource(source, caseName, {objectsOnly: action === 'inspect', allowBuildStatistic: ['built', 'run'].includes(action)});
await saveJson(resolve(output, 'source-' + action + '.json'), contract);
if (action === 'inspect') {
  console.log(JSON.stringify({action, case: caseName, commit: target.commit, tree: target.tree, originalDriver: manifest.driver.gitBlob, sourceObjectsVerified: true}));
} else if (action === 'prepare') {
  assert.equal(Number(process.versions.node.split('.')[0]), manifest.runtime.nodeMajor);
  const flags = Object.keys(process.env).filter(name => name.startsWith('VITE_') && process.env[name]);
  assert.equal(flags.length, 0, 'Default source build must not inherit VITE flags');
  await writeFile(resolve(output, 'original-driver.mjs'), await readFile(resolve(source, manifest.driver.path)));
  console.log('Immutable source, original locks, and untouched driver verified before build.');
} else if (action === 'built') {
  const build = await hashDirectory(resolve(source, manifest.game, 'dist'));
  await saveJson(resolve(output, 'built-files.json'), build);
  await writeFile(resolve(output, 'tracked-build-diff.patch'), git(source, 'diff', 'HEAD', '--'));
  console.log(JSON.stringify({case: caseName, buildFiles: build.files.length, buildManifestSha256: build.manifestSha256}));
} else {
  assert.equal(process.platform, 'darwin', 'Native Metal capture requires macOS');
  const built = JSON.parse(await readFile(resolve(output, 'built-files.json'), 'utf8'));
  const current = await hashDirectory(resolve(source, manifest.game, 'dist'));
  assert.equal(current.manifestSha256, built.manifestSha256, 'Build changed before browser capture');
  const preload = fileURLToPath(new URL('./preload.mjs', import.meta.url));
  const driver = resolve(source, manifest.driver.path);
  const invocationId = randomUUID();
  const environment = {...process.env,
    BELLE_PROFILE_DEVICE: 'desktop', BELLE_PROFILE_MODE: 'full', BELLE_PROFILE_SECONDS: '90',
    BELLE_NATIVE_CPU_SOURCE: source, BELLE_NATIVE_CPU_OUTPUT: output,
    BELLE_NATIVE_CPU_INVOCATION: invocationId, GITHUB_SHA: target.commit};
  const receipt = {
    invocationId, diagnosticOnly: true, releaseAcceptance: false, source: target, workflowHead: process.env.GITHUB_SHA ?? null,
    originalDriver: manifest.driver, preloadSha256: sha256(await readFile(preload)),
    originalReportPath: resolve(source, manifest.game, 'output/sustained-profile/full/desktop/report.json'),
    command: [process.execPath, '--import', preload, driver], cwd: resolve(source, manifest.game),
    settings: manifest.runtime, startedAt: new Date().toISOString(), strictStepTimeoutMinutes: 28
  };
  await saveJson(resolve(output, 'invocation.json'), receipt);
  const stdout = createWriteStream(resolve(output, 'original-driver.stdout.log'));
  const stderr = createWriteStream(resolve(output, 'original-driver.stderr.log'));
  const child = spawn(process.execPath, ['--import', preload, driver], {
    cwd: resolve(source, manifest.game), env: environment, stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', data => { stdout.write(data); process.stdout.write(data); });
  child.stderr.on('data', data => { stderr.write(data); process.stderr.write(data); });
  const exit = await new Promise(resolveExit => {
    child.once('error', error => resolveExit({code: null, signal: null, error: String(error)}));
    child.once('close', (code, signal) => resolveExit({code, signal}));
  });
  await Promise.all([new Promise(done => stdout.end(done)), new Promise(done => stderr.end(done))]);
  await saveJson(resolve(output, 'original-driver-exit.json'), {...exit, endedAt: new Date().toISOString()});
  let report = null, diagnostic = null, terminal = null, cleanupTerminal = null;
  try {
    await cp(resolve(source, manifest.game, 'output/sustained-profile/full/desktop'), resolve(output, 'original-driver-output'), {recursive: true});
    report = JSON.parse(await readFile(receipt.originalReportPath, 'utf8'));
  } catch (error) { receipt.reportCopyError = String(error); }
  try { diagnostic = JSON.parse(await readFile(resolve(output, 'diagnostic-status.json'), 'utf8')); }
  catch (error) { receipt.diagnosticReadError = String(error); }
  try { terminal = JSON.parse(await readFile(resolve(output, 'observer-process-exit.json'), 'utf8')); }
  catch (error) { receipt.terminalReadError = String(error); }
  try { cleanupTerminal = JSON.parse(await readFile(resolve(output, 'observer-cleanup-terminal.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') receipt.cleanupTerminalReadError = String(error); }
  let preserved = false;
  try {
    await saveJson(resolve(output, 'source-after-run.json'), await verifySource(source, caseName, {allowBuildStatistic: true}));
    const after = await hashDirectory(resolve(source, manifest.game, 'dist'));
    assert.equal(after.manifestSha256, built.manifestSha256, 'Build mutated during capture');
    preserved = true;
  } catch (error) { receipt.preservationError = String(error); }
  const originalVerdict = report ? {
    passed: report.passed, baselinePassed: report.baselinePassed, frameQualityAccepted: report.frameQualityAccepted,
    sourceHead: report.sourceHead, stopReason: report.profile?.stopReason, p95: report.profile?.metrics?.frameMs?.p95,
    over250ms: report.profile?.over250ms, maxFrameMs: report.profile?.maxFrameMs
  } : null;
  const runtimeReceipt = report ? {
    sourceHead: report.sourceHead, device: report.device, mode: report.mode,
    requestedSeconds: report.requestedSeconds, viewport: report.viewport, renderBackend: report.renderBackend,
    rendererFallback: report.rendererFallback, actualGpu: report.actualGpu,
    settingsAtStart: Object.fromEntries(['quality', 'effectiveQuality', 'cap', 'pixelRatio', 'adaptiveScale', 'diagnosticReduction']
      .map(key => [key, report.profile?.settingsAtStart?.[key] ?? null])),
    worldPerformanceDiagnosticAtStart: report.profile?.settingsAtStart?.world?.performanceDiagnostic ?? null,
    stopReason: report.profile?.stopReason ?? null, input: report.input,
    browserObserverWindow: report.browserSchedulerProbe?.observationWindow ?? null
  } : null;
  const diagnosticComplete = diagnosticRunIsClean(diagnostic, terminal, invocationId, cleanupTerminal) &&
    !receipt.diagnosticReadError && !receipt.terminalReadError && !receipt.cleanupTerminalReadError;
  await saveJson(resolve(output, 'result.json'), {
    ...receipt, exit, sourceAndBuildPreserved: preserved, originalVerdict, runtimeReceipt,
    diagnosticComplete, diagnosticPartial: !diagnosticComplete, terminalReceipt: terminal, cleanupTerminal,
    note: 'Original source driver verdict is retained, including all failures. This sampled/instrumented run is diagnostic only and cannot approve release.'
  });
  console.log(JSON.stringify({case: caseName, originalVerdict, diagnosticComplete, preserved}));
  // A failed original verdict stays failed. Missing/partial evidence also fails
  // this diagnostic job, without replacing or rewriting the original report.
  process.exitCode = exit.code === 0 && report?.passed === true && diagnosticComplete && preserved ? 0 : (exit.code || 1);
}
