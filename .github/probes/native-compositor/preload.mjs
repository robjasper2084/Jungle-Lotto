import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {appendFile, mkdir, open, readFile, rename, writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {manifest, sha256, saveJson, bounded, verifyDriver, invalidateDiagnostic,
  finalizeDiagnostic, terminalDiagnosticReceipt, boundedDiagnosticCleanup, ownedTransportsClosed} from './common.mjs';
import {traceCategoryRequest, summarizeTraceTopology} from './common.mjs';
import {installPageProbe} from './page-probe.mjs';
import {installHooks} from './hooks.mjs';

const source = resolve(process.env.BELLE_NATIVE_COMPOSITOR_SOURCE);
const output = resolve(process.env.BELLE_NATIVE_COMPOSITOR_OUTPUT);
const limits = manifest.bounds;
assert(process.env.BELLE_NATIVE_COMPOSITOR_INVOCATION, 'Missing invocation identity');
assert.equal(process.platform, 'darwin', 'This probe requires the native Mac lane');
assert.equal(Number(process.versions.node.split('.')[0]), manifest.runtime.nodeMajor);
assert.equal(process.env.BELLE_PROFILE_DEVICE, 'desktop');
assert.equal(process.env.BELLE_PROFILE_MODE, 'full');
assert.equal(process.env.BELLE_PROFILE_SECONDS, '90');
verifyDriver(await readFile(resolve(source, manifest.driver.path)));
await mkdir(resolve(output, 'bundles'), {recursive: true});
const require = createRequire(resolve(source, manifest.project, 'package.json'));
const playwright = require('@playwright/test');
assert.equal(require('@playwright/test/package.json').version, manifest.runtime.playwright);

const state = {
  version: 1, diagnosticOnly: true, releaseAcceptance: false,
  diagnosticKind: manifest.diagnosticKind, gpuExecutionMeasured: false,
  invocationId: process.env.BELLE_NATIVE_COMPOSITOR_INVOCATION,
  phase: 'preloaded', complete: false, partial: false, errors: [], errorOverflow: 0, failureRevision: 0,
  finalization: {transportClosed: false, writesHealthy: true, statusPersisted: false},
  samplingIntervalUs: manifest.runtime.samplingIntervalUs, bounds: limits,
  originalDriver: manifest.driver, node: process.version, platform: process.platform, architecture: process.arch,
  playwrightVersion: manifest.runtime.playwright, playwrightModule: require.resolve('@playwright/test'),
  checkpoints: [], bundles: [], bundleBytes: 0, bundleOverflow: 0,
  assetEvents: 0, assetEventOverflow: 0, parsedScripts: 0, parsedScriptOverflow: 0,
  lifecycle: {},
  trace: {highWater: 0, dataLossOccurred: null, capReached: false, streamComplete: false,
    processScope: manifest.trace.processScope}
};
let writes = Promise.resolve(), monitor;
function queueWrite(label, operation) {
  writes = writes.then(operation).then(() => true, error => {
    invalidateDiagnostic(state, 'write-' + label, error, {io: true});
    return false;
  });
  return writes;
}
// Snapshot at queue execution, after any earlier write failures have invalidated
// state. A pre-queued successful snapshot must not resurrect stale completeness.
const persist = () => queueWrite('status', () =>
  saveJson(resolve(output, 'diagnostic-status.json'), structuredClone(state)));
function event(name, detail = {}) {
  const row = {at: new Date().toISOString(), name, ...detail};
  metadataLine('diagnostic-events.ndjson', row);
  return persist();
}
function failure(where, error) {
  const io = ['EACCES', 'ENOSPC', 'EIO', 'EROFS', 'EMFILE', 'ENFILE', 'EDQUOT', 'ENOENT'].includes(error?.code);
  invalidateDiagnostic(state, where, error, {io});
  void event('diagnostic-error', {where});
}
function metadataLine(file, row) {
  return queueWrite(file, () => appendFile(resolve(output, file), JSON.stringify(row) + '\n'));
}
await persist();

class NativeMonitor {
  constructor({page, browser, launchArguments, pageArguments}) {
    this.page = page; this.browser = browser; this.launchArguments = launchArguments; this.pageArguments = pageArguments;
    this.pendingBundles = new Set(); this.seenBundles = new Set();
    this.requestIds = new WeakMap(); this.nextRequestId = 0;
    this.started = false; this.stopPromise = null; this.cdp = null;
    this.traceCdp = null; this.owners = {}; this.disposing = false; this.pageWorkFinished = false;
    state.lifecycle ??= {};
    state.transports = Object.fromEntries(['page', 'browserTrace'].map(name => [name, {
      created: false, creationTimedOut: false, detachCalls: 0, detachAcknowledged: false,
      closeObserved: false, closed: false, unexpectedClose: false
    }]));
    this.profilerStarted = false; this.traceStarted = false; this.checkpointBusy = false;
  }
  async acquireTransport(name, create) {
    assert(!this.owners[name], 'A second owned transport was requested: ' + name);
    const receipt = state.transports[name], owner = {session: null, detaching: false, cancelled: false, detachPromise: null};
    this.owners[name] = owner;
    receipt.createRequestedAtNodeEpochMs = Date.now();
    owner.closed = new Promise(resolveClosed => { owner.resolveClosed = resolveClosed; });
    owner.creation = Promise.resolve().then(create).then(session => {
      owner.session = session; receipt.created = true; receipt.createdAtNodeEpochMs = Date.now();
      session.on('close', () => {
        receipt.closeObserved = true; receipt.closedAtNodeEpochMs = Date.now(); owner.resolveClosed();
        void event('owned-session-close', {transport: name, expectedDetach: owner.detaching, atNodeEpochMs: receipt.closedAtNodeEpochMs});
        if (!owner.detaching) {
          receipt.unexpectedClose = true;
          const error = Error('Owned ' + name + ' session closed before its explicit detach');
          failure('unexpected-session-close-' + name, error);
          if (name === 'browserTrace') this.traceReject?.(error);
          if (this.started && !this.stopPromise) void this.stop('unexpected-session-close');
        }
      });
      if (Date.now() - receipt.createRequestedAtNodeEpochMs >= limits.protocolTimeoutMs) receipt.creationTimedOut = true;
      if (owner.cancelled || this.disposing || this.stopPromise || receipt.creationTimedOut) {
        owner.cancelled = true;
        failure('late-session-creation-' + name, Error('Late owned transport is being detached without use'));
        void this.detachTransport(name);
        throw Error('Owned transport creation completed too late: ' + name);
      }
      void event('owned-session-created', {transport: name, atNodeEpochMs: receipt.createdAtNodeEpochMs});
      return session;
    });
    try {
      const session = await bounded(owner.creation, limits.protocolTimeoutMs, 'Owned ' + name + ' CDP creation');
      assert(!owner.cancelled && !this.disposing && !this.stopPromise && !receipt.unexpectedClose,
        'Owned transport became unavailable before setup: ' + name);
      return session;
    } catch (error) {
      owner.cancelled = true;
      receipt.creationTimedOut ||= Date.now() - receipt.createRequestedAtNodeEpochMs >= limits.protocolTimeoutMs;
      receipt.creationError = String(error);
      failure('session-creation-' + name, error);
      if (owner.session) void this.detachTransport(name);
      throw error;
    }
  }
  detachTransport(name) {
    const owner = this.owners[name], receipt = state.transports[name];
    if (!owner) return Promise.resolve(false);
    owner.cancelled = true;
    if (!owner.session) return Promise.resolve(false); // Late creation disposes itself.
    if (!owner.detachPromise) {
      owner.detaching = true; receipt.detachCalls++; receipt.detachRequestedAtNodeEpochMs = Date.now();
      owner.detachPromise = (async () => {
        await bounded(Promise.all([
          Promise.resolve().then(() => owner.session.detach()).then(() => {
            receipt.detachAcknowledged = true; receipt.detachAcknowledgedAtNodeEpochMs = Date.now();
          }),
          owner.closed
        ]), 2000, 'Owned ' + name + ' CDP detach and close');
        receipt.closed = true;
        void event('owned-session-detached', {transport: name, atNodeEpochMs: Date.now()});
        return true;
      })().catch(error => {
        receipt.closed = false; receipt.detachError = String(error);
        failure('session-detach-' + name, error);
        return false;
      });
    }
    return owner.detachPromise;
  }
  async detachAllTransports() {
    await Promise.allSettled(['page', 'browserTrace'].map(name => this.detachTransport(name)));
    assert(ownedTransportsClosed(state), 'Both owned CDP sessions must acknowledge detach and close');
  }
  error(where, error) {
    failure(where, error);
    if (where === 'start') void this.stop('setup-failure');
  }
  metricsCall(count) { state.originalMetricsCalls = count; }
  send(method, parameters = {}) {
    return bounded(this.cdp.send(method, parameters), limits.protocolTimeoutMs, method);
  }
  traceSend(method, parameters = {}) {
    return bounded(this.traceCdp.send(method, parameters), limits.protocolTimeoutMs, method);
  }
  async attach() {
    const launch = this.launchArguments[0], page = this.pageArguments[0];
    assert.deepEqual(launch, {channel: 'chrome', headless: false, args: ['--enable-gpu', '--use-gl=angle', '--use-angle=metal']});
    assert.deepEqual(page, {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: 'reduce'});
    state.launch = structuredClone(launch); state.pageOptions = structuredClone(page);
    await this.page.addInitScript(installPageProbe, limits);
    const asset = (kind, request) => {
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') return;
      if (kind === 'request') {
        if (this.stopPromise) return;
        this.requestIds.set(request, ++this.nextRequestId);
      }
      const id = this.requestIds.get(request);
      if (id === undefined) return;
      if (state.assetEvents >= limits.assetEvents) {
        state.assetEventOverflow++; invalidateDiagnostic(state, 'asset-event-overflow'); return;
      }
      state.assetEvents++;
      metadataLine('asset-events.ndjson', {
        kind, id, receivedAtNodeEpochMs: Date.now(), phase: state.phase,
        url: request.url(), resourceType: request.resourceType(),
        timing: kind === 'request' ? null : request.timing(),
        failure: kind === 'failed' ? request.failure() : null,
        note: 'Request timing startTime is epoch milliseconds; remaining fields are relative milliseconds. Node arrival is not a browser parse/construction timestamp.'
      });
    };
    const safelyRecordAsset = kind => request => {
      try { asset(kind, request); } catch (error) { failure('asset-event-' + kind, error); }
    };
    this.page.on('request', safelyRecordAsset('request'));
    this.page.on('requestfinished', safelyRecordAsset('finished'));
    this.page.on('requestfailed', safelyRecordAsset('failed'));
    this.page.on('response', response => {
      if (this.stopPromise) return;
      const url = new URL(response.url());
      if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('.js') || response.request().resourceType() !== 'script') return;
      if (this.seenBundles.has(response.url())) return;
      if (this.seenBundles.size >= limits.bundleCount) {
        state.bundleOverflow++; invalidateDiagnostic(state, 'bundle-count-overflow'); void persist(); return;
      }
      this.seenBundles.add(response.url());
      const pending = this.bundle(response).catch(error => failure('loaded-bundle', error));
      this.pendingBundles.add(pending);
      void pending.finally(() => this.pendingBundles.delete(pending));
    });
    this.page.on('crash', () => { failure('page-crash', Error('Original game page crashed')); void this.stop('page-crash'); });
    const pageLifetime = name => {
      state.lifecycle[name] = Date.now();
      void event(name, {atNodeEpochMs: state.lifecycle[name]});
      if (this.started && !this.pageWorkFinished) failure(name, Error('Original source page closed before required page work finished'));
      if (this.started && !this.stopPromise) void this.stop('page-closed');
    };
    this.page.on('close', () => pageLifetime('pageClosedAtNodeEpochMs'));
    this.page.context().on('close', () => pageLifetime('contextClosedAtNodeEpochMs'));
    this.browser.on('disconnected', () => {
      state.lifecycle.browserDisconnectedAtNodeEpochMs = Date.now();
      void event('browser-disconnected', {atNodeEpochMs: state.lifecycle.browserDisconnectedAtNodeEpochMs});
      if (!ownedTransportsClosed(state)) {
        const error = Error('Original browser disconnected before both owned transports closed');
        failure('browser-disconnected', error); this.traceReject?.(error);
        if (this.started && !this.stopPromise) void this.stop('browser-disconnected');
      }
    });
    state.phase = 'attached';
    await event('original-game-page-attached');
  }
  async bundle(response) {
    if (state.bundles.length >= limits.bundleCount) {
      state.bundleOverflow++; invalidateDiagnostic(state, 'bundle-count-overflow'); return persist();
    }
    const bytes = await bounded(response.body(), limits.protocolTimeoutMs, 'Loaded script body');
    if (state.bundleBytes + bytes.length > limits.bundleBytes) {
      state.bundleOverflow++; invalidateDiagnostic(state, 'bundle-byte-overflow'); return persist();
    }
    const digest = sha256(bytes);
    const dist = resolve(source, manifest.game, 'dist');
    const path = resolve(dist, '.' + decodeURIComponent(new URL(response.url()).pathname));
    assert(path.startsWith(dist + '/'), 'Loaded script resolved outside the exact build');
    assert.equal(sha256(await readFile(path)), digest, 'Loaded script bytes differ from the pinned build output');
    // Other responses can finish during the awaited hash comparison. Reserve
    // the byte budget synchronously here, before any further await.
    if (state.bundleBytes + bytes.length > limits.bundleBytes) {
      state.bundleOverflow++; invalidateDiagnostic(state, 'bundle-byte-overflow'); return persist();
    }
    state.bundleBytes += bytes.length;
    state.bundles.push({url: response.url(), status: response.status(), bytes: bytes.length, sha256: digest,
      matchesBuiltFile: true, file: 'bundles/' + digest + '.js'});
    await writeFile(resolve(output, 'bundles', digest + '.js'), bytes);
    await saveJson(resolve(output, 'loaded-bundles.json'), state.bundles);
    await persist();
  }
  async start(createSession) {
    assert(!this.started, 'A second original capture was requested');
    this.started = true; state.phase = 'starting';
    this.cdp = await this.acquireTransport('page', createSession);
    this.traceCdp = await this.acquireTransport('browserTrace', () => this.browser.newBrowserCDPSession());
    state.browserVersion = await this.send('Browser.getVersion');
    await event('before-capture-setup');
    this.traceDone = new Promise((resolveTrace, rejectTrace) => {
      this.traceReject = rejectTrace;
      this.traceCdp.once('Tracing.tracingComplete', resolveTrace);
    });
    void this.traceDone.catch(() => {}); // A disconnect can precede the later stop await.
    this.traceCdp.on('Tracing.bufferUsage', usage => {
      const value = Math.max(usage.percentFull || 0, usage.value || 0);
      state.trace.highWater = Math.max(state.trace.highWater, value);
      if (value >= 1) { state.trace.capReached = true; invalidateDiagnostic(state, 'trace-buffer-cap'); }
      void event('trace-buffer', usage);
    });
    const categoryResponse = await this.traceSend('Tracing.getCategories');
    await saveJson(resolve(output, 'trace-categories-response.json'), categoryResponse ?? null);
    const available = categoryResponse?.categories;
    await saveJson(resolve(output, 'trace-categories.json'), available ?? null);
    const request = traceCategoryRequest(available);
    await saveJson(resolve(output, 'trace-category-request.json'), request);
    state.trace.categoryRequest = request;
    if (request.warning) {
      state.warnings ??= [];
      state.warnings.push({where: 'trace-category-enumeration', message: request.warning});
      void event('trace-category-enumeration-warning', {warning: request.warning, missingFromEnumeration: request.missingFromEnumeration});
    }
    const categories = request.requestedCategories;
    state.trace.categories = categories;
    await this.send('Profiler.enable');
    await this.send('Profiler.setSamplingInterval', {interval: manifest.runtime.samplingIntervalUs});
    this.cdp.on('Debugger.scriptParsed', script => {
      if (this.stopPromise) return;
      if (state.parsedScripts >= limits.parsedScripts) {
        state.parsedScriptOverflow++; invalidateDiagnostic(state, 'parsed-script-overflow'); return;
      }
      state.parsedScripts++;
      const {scriptId, url, startLine, startColumn, endLine, endColumn, hash, executionContextId,
        sourceMapURL, hasSourceURL, isModule, length, scriptLanguage} = script;
      metadataLine('parsed-scripts.ndjson', {
        receivedAtNodeEpochMs: Date.now(), mayBeReplayFromEnable: !state.debuggerEnableCompleted,
        scriptId, url, startLine, startColumn, endLine, endColumn, protocolContentSha256: hash,
        executionContextId, sourceMapURL, hasSourceURL, isModule, length, scriptLanguage,
        parseStackIfAvailable: script.stackTrace?.callFrames?.slice(0, 32) ?? null,
        note: 'Debugger.enable replays existing scripts. Receipt time is not an actual parse timestamp; use raw trace events for timing.'
      });
    });
    await this.send('Debugger.enable', {maxScriptsCacheSize: limits.debuggerScriptCacheBytes});
    state.debuggerEnableCompleted = true;
    this.watchdog = setTimeout(() => {
      invalidateDiagnostic(state, 'diagnostic-watchdog'); void this.stop('diagnostic-watchdog');
    }, limits.captureWatchdogMs);
    this.watchdog.unref();
    this.traceStarted = true;
    await this.traceSend('Tracing.start', {
      transferMode: 'ReturnAsStream', streamFormat: manifest.trace.streamFormat, bufferUsageReportingInterval: 1000,
      traceConfig: {recordMode: manifest.trace.recordMode, traceBufferSizeInKb: limits.traceBufferKiB,
        includedCategories: categories}
    });
    this.profilerStarted = true;
    await this.send('Profiler.start');
    const started = await bounded(this.page.evaluate(() => window.__belleNativeCpuObserver.start()), limits.protocolTimeoutMs, 'Observer start');
    assert.equal(started, true, 'Page observer did not start exactly once');
    state.phase = 'capturing'; state.captureStartedAt = new Date().toISOString();
    this.checkpointTimer = setInterval(() => { void this.checkpoint('periodic'); }, limits.checkpointEveryMs);
    this.checkpointTimer.unref();
    await event('capture-started');
  }
  async checkpoint(label) {
    if (this.checkpointBusy) {
      if (label === 'final') {
        await bounded(this.checkpointDone, limits.protocolTimeoutMs + 1000, 'Prior observer checkpoint');
        return this.checkpoint(label);
      }
      return;
    }
    this.checkpointBusy = true;
    let finishCheckpoint;
    this.checkpointDone = new Promise(done => { finishCheckpoint = done; });
    const begin = Date.now();
    try {
      const snapshot = await bounded(this.page.evaluate(() => window.__belleNativeCpuObserver.snapshot()), limits.protocolTimeoutMs, 'Observer snapshot');
      this.lastSnapshot = snapshot;
      const number = state.checkpoints.length;
      const file = 'observer-' + String(number).padStart(2, '0') + '-' + label + '.json';
      await saveJson(resolve(output, file), snapshot);
      state.checkpoints.push({file, label, wallMs: Date.now() - begin, rafStored: snapshot.raf.stored, endedAtMs: snapshot.endedAtMs});
      await persist();
    } catch (error) { failure('checkpoint-' + label, error); }
    finally { this.checkpointBusy = false; finishCheckpoint(); }
  }
  stop(reason) {
    if (!this.stopPromise) this.stopPromise = this.finish(reason).catch(error => failure('finish', error));
    return this.stopPromise;
  }
  async finish(reason) {
    clearInterval(this.checkpointTimer); clearTimeout(this.watchdog);
    state.phase = 'stopping'; state.stopReason = reason;
    if (reason !== 'original-ending-metrics') invalidateDiagnostic(state, 'stop-' + reason);
    // A blocked metadata queue must not delay stopping either browser recorder.
    // Final flush still validates every queued event and status write.
    void event('capture-stopping', {reason});
    // Each result is saved independently. A trace/clock failure cannot discard
    // a successfully returned CPU profile.
    const pageTasks = [];
    if (this.profilerStarted) pageTasks.push(this.cpu().catch(error => failure('cpu-profile', error)));
    const traceTask = this.traceStarted ? this.trace().catch(error => failure('trace', error)) : Promise.resolve();
    if (this.started) pageTasks.push((async () => {
      if (reason !== 'original-ending-metrics') {
        await bounded(this.page.evaluate(reason => window.__belleNativeCpuObserver.stop(reason), reason), limits.protocolTimeoutMs, 'Observer stop');
      }
      await this.checkpoint('final');
    })().catch(error => failure('final-observer', error)));
    await Promise.allSettled(pageTasks);
    await bounded(Promise.allSettled([...this.pendingBundles]), limits.protocolTimeoutMs, 'Bundle save completion')
      .catch(error => failure('bundle-completion', error));
    this.pageWorkFinished = true; state.lifecycle.pageWorkFinishedAtNodeEpochMs = Date.now();
    await this.detachTransport('page');
    await traceTask;
    const raw = this.lastSnapshot;
    const pairs = ['first-trusted-w', 'trusted-w-keyup'].map(name => ({
      name, observer: raw?.marks?.find(mark => mark.name === name),
      trace: state.trace.marks?.find(mark => mark.name === 'belle-native-cpu:' + name)
    }));
    const paired = pairs.every(pair => pair.observer && Number.isFinite(pair.trace?.ts));
    const offsets = paired ? pairs.map(pair => pair.trace.ts / 1000 - pair.observer.atMs) : [];
    const clockRange = paired ? Math.max(...offsets) - Math.min(...offsets) : null;
    const cpuBracketsMarks = paired && pairs.every(pair =>
      pair.trace.ts >= state.cpuProfile?.startTime && pair.trace.ts <= state.cpuProfile?.endTime);
    state.alignment = {
      available: paired && cpuBracketsMarks && clockRange <= 5,
      pairedMarks: pairs, traceMinusObserverClockOffsetsMs: offsets, offsetRangeMs: clockRange,
      cpuProfileClockBracketsTrustedMarks: cpuBracketsMarks,
      timeOriginMs: raw?.timeOriginMs ?? null,
      note: 'Use raw user-timing trace marks and observer clocks to align; no clock offset or causality is invented.'
    };
    const rawComplete = raw?.stoppedBy === 'trusted-w-keyup' && raw.keydowns > 0 && raw.keyups === 1 &&
      raw.raf.overflow === 0 && raw.longTasks.overflow === 0 && raw.markOverflow === 0 && raw.longTaskSupported;
    const eligible = !!(state.originalMetricsCalls === 2 && state.cpuProfile && state.trace.streamComplete && state.trace.dataLossOccurred === false &&
      !state.trace.capReached && state.trace.topology?.available && rawComplete && state.alignment.available && state.bundles.length &&
      !state.bundleOverflow && !state.assetEventOverflow && !state.parsedScriptOverflow &&
      state.parsedScripts > 0 && !state.partial && !state.ioError && !state.errors.length);
    await event('capture-collected', {eligibleForFinalization: eligible});
    await finalizeDiagnostic(state, {
      eligible,
      detach: () => this.detachAllTransports(),
      flush: () => writes,
      writeStatus: snapshot => queueWrite('final-status', () =>
        saveJson(resolve(output, 'diagnostic-status.json'), snapshot))
    });
  }
  async cpu() {
    state.cpuStop = {issuedAtNodeEpochMs: Date.now()};
    const result = await this.send('Profiler.stop');
    state.cpuStop.responseAtNodeEpochMs = Date.now();
    const bytes = Buffer.from(JSON.stringify(result.profile) + '\n');
    await writeFile(resolve(output, 'native.cpuprofile'), bytes);
    state.cpuProfile = {
      file: 'native.cpuprofile', sha256: sha256(bytes), bytes: bytes.length,
      nodes: result.profile.nodes?.length ?? null, samples: result.profile.samples?.length ?? null,
      timeDeltas: result.profile.timeDeltas?.length ?? null,
      startTime: result.profile.startTime, endTime: result.profile.endTime
    };
    if (!result.profile.samples?.length || result.profile.samples.length !== result.profile.timeDeltas?.length) {
      failure('cpu-profile-shape', Error('CPU profile retained but sample clock arrays are incomplete'));
    }
    await event('cpu-profile-saved', state.cpuProfile);
  }
  async trace() {
    state.trace.stopIssuedAtNodeEpochMs = Date.now();
    const deadline = state.trace.stopIssuedAtNodeEpochMs + limits.traceDrainTimeoutMs;
    state.trace.finalizationDeadlineNodeEpochMs = deadline;
    const remaining = () => {
      const ms = deadline - Date.now();
      assert(ms > 0, 'Trace finalization deadline reached; evidence remains partial');
      return ms;
    };
    // The asynchronous flush notification is not an RPC response. End keeps its
    // individual protocol timeout; notification, drain and persistence share
    // this one absolute deadline from stop issuance, with no fresh drain budget.
    await bounded((async () => {
      await this.traceSend('Tracing.end');
      state.trace.stopAcknowledgedAtNodeEpochMs = Date.now();
      const complete = await bounded(this.traceDone, remaining(), 'Tracing.tracingComplete within finalization deadline');
      remaining();
      state.trace.completedAtNodeEpochMs = Date.now();
      await bounded(saveJson(resolve(output, 'trace-completion.json'), complete), remaining(), 'Trace completion persistence');
      remaining();
      state.trace.dataLossOccurred = complete.dataLossOccurred ?? null;
      if (complete.dataLossOccurred) invalidateDiagnostic(state, 'trace-data-loss');
      assert(complete.stream, 'Tracing completed without a stream');
      await this.collectTrace(complete, deadline);
      remaining();
      state.trace.finalizationFinishedAtNodeEpochMs = Date.now();
    })(), remaining(), 'Complete trace finalization');
  }
  async collectTrace(complete, deadline) {
    // The outer deadline includes opening, closing, persistence and indexing;
    // the caller passes its stop-issuance deadline without resetting the budget.
    assert(Number.isFinite(deadline) && Date.now() < deadline, 'Trace finalization deadline reached before drain');
    state.trace.drainStartedAtNodeEpochMs = Date.now();
    const withinDrain = (promise, label) => bounded(promise, Math.max(1, deadline - Date.now()), label);
    const path = resolve(output, 'native-trace.partial.json'), handle = await open(path, 'w');
    let bytes = 0, eof = false;
    try {
      while (!eof) {
        assert(Date.now() < deadline, 'Trace drain deadline reached; partial file retained');
        const chunk = await withinDrain(this.traceSend('IO.read', {handle: complete.stream, size: 1024 * 1024}), 'Trace read within drain deadline');
        const data = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
        const remaining = limits.traceFileBytes - bytes;
        if (data.length > remaining) {
          if (remaining > 0) { await withinDrain(handle.write(data.subarray(0, remaining)), 'Partial trace write'); bytes += remaining; }
          state.trace.savedBytes = bytes;
          state.trace.capReached = true; invalidateDiagnostic(state, 'trace-file-cap'); break;
        }
        await withinDrain(handle.write(data), 'Trace write within drain deadline'); bytes += data.length; eof = chunk.eof;
        state.trace.savedBytes = bytes;
      }
    } finally {
      await handle.close();
      await this.traceSend('IO.close', {handle: complete.stream}).catch(error => failure('trace-stream-close', error));
      state.trace.savedBytes = bytes; state.trace.streamComplete = eof;
      await persist();
    }
    if (eof) {
      await rename(path, resolve(output, 'native-trace.json'));
      state.trace.file = 'native-trace.json';
      const bytes = await readFile(resolve(output, 'native-trace.json'));
      state.trace.sha256 = sha256(bytes);
      const parsed = JSON.parse(bytes);
      assert(Array.isArray(parsed.traceEvents), 'Trace lacks its raw event array');
      state.trace.eventCount = parsed.traceEvents.length;
      state.trace.marks = parsed.traceEvents.filter(row => String(row.name).startsWith('belle-native-cpu:'))
        .map(({name, ts, pid, tid, ph, cat, args}) => ({name, ts, pid, tid, ph, cat, args}));
      await saveJson(resolve(output, 'trace-observer-marks.json'), state.trace.marks);
      const topology = summarizeTraceTopology(parsed.traceEvents, limits);
      await saveJson(resolve(output, 'trace-process-threads.json'), topology);
      state.trace.topology = {
        file: 'trace-process-threads.json', available: topology.available,
        requirements: topology.requirements, metadataRows: topology.metadata.length,
        requiredCategoryCounts: topology.requiredCategoryCounts,
        metadataOverflow: topology.metadataOverflow, tracks: topology.tracks.length, trackOverflow: topology.trackOverflow,
        gpuServiceEvents: topology.gpuServiceEvents, vizEvents: topology.vizEvents,
        pipelineReporters: topology.pipelineReporters, flowRecords: topology.flowRecords,
        windowFlowRecords: topology.windowFlowRecords, rawFlowIdentifiersRemainInTrace: true,
        windowGpuFlowRecords: topology.windowGpuFlowRecords, windowVizFlowRecords: topology.windowVizFlowRecords,
        mainRafEvents: topology.mainRafEvents,
        gpuExecutionMeasured: false
      };
      if (!topology.available) invalidateDiagnostic(state, 'missing-cross-process-trace-coverage',
        Error('Required compositor/GPU-service trace evidence is missing: ' +
          Object.entries(topology.requirements).filter(([, value]) => !value).map(([name]) => name).join(', ')));
    } else state.trace.file = 'native-trace.partial.json';
    assert(Date.now() <= deadline, 'Trace drain/indexing deadline reached; raw evidence retained');
    state.trace.drainFinishedAtNodeEpochMs = Date.now();
    await event('trace-saved', state.trace);
    assert(Date.now() < deadline, 'Trace finalization deadline reached during persistence; raw evidence retained');
  }
  async cleanup() {
    this.disposing = true;
    await boundedDiagnosticCleanup(state, {
      finish: () => this.stop(this.stopPromise ? state.stopReason : 'original-browser-close'),
      persist,
      timeoutMs: limits.cleanupTimeoutMs,
      terminal: receipt => writeFileSync(resolve(output, 'observer-cleanup-terminal.json'), JSON.stringify(receipt) + '\n')
    });
    if (!ownedTransportsClosed(state)) {
      invalidateDiagnostic(state, 'cleanup-forced-owned-detach');
      this.traceReject?.(Error('Trace interrupted by bounded browser-close cleanup'));
      // Both attempts begin without extending the original browser-close wait.
      void Promise.allSettled(['page', 'browserTrace'].map(name => this.detachTransport(name)));
    }
  }
}

installHooks(playwright.chromium, options => { monitor = new NativeMonitor(options); return monitor; });
// Synchronous small receipts only: termination is immediately re-delivered.
// No signal handler extends the original workflow deadline to drain a browser.
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  invalidateDiagnostic(state, 'process-' + signal);
  try { writeFileSync(resolve(output, 'interrupted.json'),
    JSON.stringify({...terminalDiagnosticReceipt(state), signal, at: new Date().toISOString()}) + '\n'); } catch {}
  process.kill(process.pid, signal);
});
process.once('exit', code => {
  try { writeFileSync(resolve(output, 'observer-process-exit.json'),
    JSON.stringify(terminalDiagnosticReceipt(state, code)) + '\n'); } catch {}
});
