/** Real-input polish checks plus explicitly separate CSS-only layout fixtures. */
import assert from 'node:assert/strict';
import {dispatchAfterReadyCountdown} from './polish-ready-dispatch.mjs';
import {createReadStream} from 'node:fs';
import {appendFile, mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';
import {classifyCountdownInput, createCountdownObserverLifecycle, hasCountdownCleanupEvidence} from './polish-countdown-proof.mjs';

const game = resolve(import.meta.dirname, '..');
const root = resolve(game, 'dist');
const output = resolve(process.env.BELLE_POLISH_BROWSER_OUTPUT || resolve(game, 'output/polish-browser'));
const headless = process.env.BELLE_POLISH_BROWSER_HEADED !== '1';
const selectedCase = process.env.BELLE_POLISH_BROWSER_CASE;
const configurations = [
  {name: 'desktop', viewport: {width: 1355, height: 721}, physicsViewport: {width: 640, height: 400}, mobile: false},
  {name: 'phone', viewport: {width: 390, height: 844}, physicsViewport: {width: 390, height: 340}, mobile: true},
];
const selected = selectedCase === undefined ? configurations : configurations.filter(item => item.name === selectedCase);
const limits = {caseMilliseconds: 35 * 60_000, actionMilliseconds: 90_000, offCourseMilliseconds: 300_000,
  screenshotMilliseconds: 150_000, screenshotOuterMilliseconds: 155_000, closeMilliseconds: 30_000, gpuWatchdogSeconds: 60};
await mkdir(output, {recursive: true});
const lines = [];
const log = message => { const line = new Date().toISOString() + ' ' + message; lines.push(line); console.log(line); };
const countdownChecks = ['initialCountdownHold', 'restartedCountdownHold'];
const report = {startedAt: new Date().toISOString(), head: process.env.GITHUB_SHA || null, passed: false,
  functionalPassed: false, verificationComplete: false, status: 'running', coverageGaps: [],
  selectedCase: selectedCase ?? null, selectedCases: selected.map(item => item.name), limits,
  scope: 'Actual built-game controls, countdown input, restart, off-course guidance, reactive rider poses, audio opt-in and rendered scenes. Phone countdown buffering uses keyboard activation of real buttons with trusted joystick touch. Rider capture uses real forward/turn/ascend touch holds with native Enter on Pause; its screenshot is an explicitly paused native-input pose. Other phone navigation uses touch. CSS fixtures are separate synthetic layout checks.',
  limitations: 'No human full-lap, physical-device performance or acoustic listening certification. First Sky gate audio and completed recorded-ghost replay are covered by source tests, not this bounded render smoke. Pace-guide observations report the actual mesh-visibility snapshot, not camera-frustum or pixel visibility; near/far fade or CI scheduling may prevent observation.',
  manualScreenshotReviewRequired: true, cases: []};
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const info = await stat(file);
    response.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store'});
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
});
async function bounded(operation, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' exceeded ' + milliseconds / 1000 + ' seconds')), milliseconds); })]);
  } finally { clearTimeout(timer); }
}
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));
let chromium, expect, origin, shippedCss;

async function runCase(configuration) {
  const entry = {name: configuration.name, passed: false, functionalPassed: false, verificationComplete: false, status: 'running', coverageGaps: [],
    viewport: configuration.viewport, physicsViewport: configuration.physicsViewport,
    errors: [], console: [], failedRequests: [], screenshots: [], metrics: {}, cssFixtures: {scope: 'Synthetic insets/long timer text in an isolated document using the shipped CSS. No game state is seeded.', probes: []}};
  report.cases.push(entry);
  let browser, page, touch, deadline, timedOut = false, captureFailed = false, cleanupFailed = false, fixtureRecord, countdownWaiter;
  let countdownSequence = 0;
  const activeHolds = new Set(), activeTriggers = new Set();
  const templates = {};
  const tap = locator => configuration.mobile ? locator.tap() : locator.click();
  const readTrial = () => page.evaluate(() => window.__polishTrialSnapshot());
  const readRider = () => page.evaluate(() => window.__polishRiderSnapshot());
  const validateRider = (state, label, mode) => {
    assert.ok(state && !state.hidden, label + ': mounted rider HUD is visible');
    assert.equal(state.visibility, 'visible', label + ': actual page remains visible');
    assert.deepEqual(state.openDialogs, [], label + ': no dialog obscures the rider');
    assert.equal(state.rig, 'anchored', label + ': all four shipped-skin contacts are calibrated');
    if (mode) assert.equal(state.mode, mode, label + ': requested motion preference is applied');
    for (const key of ['lean', 'pitch', 'compression', 'handError', 'footError']) assert.ok(Number.isFinite(state[key]), label + ': finite ' + key);
    assert.ok(Math.abs(state.lean) <= .241 && Math.abs(state.pitch) <= .201 && state.compression >= 0 && state.compression <= .086, label + ': bounded torso reactions');
    assert.ok(state.handError >= 0 && state.handError <= .02 && state.footError >= 0 && state.footError <= .02, label + ': palm/sole contacts stay within two centimetres');
    assert.equal(state.ghostError, null, label + ': ghost view has a valid serialized snapshot');
    assert.ok(Array.isArray(state.ghosts), label + ': ghost view snapshot is an array');
    for (const ghost of state.ghosts) {
      assert.ok(['pace', 'recorded'].includes(ghost.kind), label + ': named ghost kind');
      for (const key of ['x', 'y', 'z', 'heading', 'pitch', 'roll', 'time', 'opacity']) assert.ok(Number.isFinite(ghost[key]), label + ': finite ghost ' + key);
      assert.ok(ghost.opacity > 0 && ghost.opacity <= 1, label + ': only actually visible ghost meshes are reported');
    }
    return state;
  };
  const armRiderTrace = label => page.evaluate(label => {
    window.__polishRiderObserver?.disconnect();
    const hover = document.querySelector('#hover-hud'), trial = document.querySelector('#trial-hud');
    if (!hover || !trial) throw new Error('Rider and trial HUDs are required for read-only pose observation');
    const trace = {label, samples: [], omitted: 0, maximumSamples: 2000};
    const record = () => {
      const sample = window.__polishRiderSnapshot();
      if (trace.samples.length < trace.maximumSamples) trace.samples.push(sample); else trace.omitted++;
    };
    const observer = new MutationObserver(record);
    observer.observe(hover, {attributes: true, attributeFilter: ['hidden', 'data-rider-rig', 'data-rider-motion', 'data-rider-lean', 'data-rider-pitch', 'data-rider-compression', 'data-rider-hand-error', 'data-rider-foot-error']});
    observer.observe(trial, {attributes: true, attributeFilter: ['hidden', 'data-status', 'data-paused', 'data-ghost-state']});
    window.__polishRiderTrace = trace; window.__polishRiderObserver = observer; record();
    return trace.samples[0];
  }, label);
  const takeRiderTrace = () => page.evaluate(() => {
    window.__polishRiderObserver?.disconnect();
    const trace = window.__polishRiderTrace;
    if (!trace) throw new Error('No rider trace is armed');
    return {...trace, final: window.__polishRiderSnapshot()};
  });
  const summarizeRider = async (trace, baseline, held, label, controls) => {
    const events = await page.evaluate(start => window.__polishInput.slice(start), held.traceStart);
    const delivered = controls.map(control => events.find(event => event.trusted && event.status === 'running' && event.paused === 'false' &&
      event.course === baseline.course && event.hudHidden === false && event.visibility === 'visible' && event.openDialogs?.length === 0 &&
      (configuration.mobile ? event.type === 'pointerdown' && (event.control === control || event.button?.hold === control) : event.type === 'keydown' && event.code === control)));
    assert.ok(delivered.every(Boolean), label + ': each requested control received trusted running-state input');
    const startedAt = Math.max(...delivered.map(event => event.at));
    const samples = [...trace.samples, trace.final].filter(sample => sample && sample.at >= startedAt && sample.status === 'running' && sample.paused === 'false' && sample.course === baseline.course && !sample.hidden);
    assert.ok(samples.length > 0, label + ': applied pose samples follow the native controls');
    for (const sample of samples) validateRider(sample, label, 'reactive');
    const axes = {};
    for (const key of ['lean', 'pitch', 'compression']) {
      const peak = samples.reduce((a, b) => Math.abs(a[key] - baseline[key]) >= Math.abs(b[key] - baseline[key]) ? a : b);
      axes[key] = {maximumChange: Math.abs(peak[key] - baseline[key]), peak};
    }
    return {input: held.description, nativeControls: delivered, baseline, axes, trace, inputEvents: events,
      contacts: {maximumHandError: Math.max(...samples.map(sample => sample.handError)), maximumFootError: Math.max(...samples.map(sample => sample.footError)), toleranceMetres: .02}};
  };
  const capture = async name => {
    const file = configuration.name + '-' + name + '.png', began = Date.now();
    const timing = {startedAt: new Date(began).toISOString(), viewport: page.viewportSize(), scope: fixtureRecord ? 'isolated CSS fixture' : 'real game', status: 'capturing'};
    (entry.metrics.captures ??= {})[name] = timing;
    log(configuration.name + ': capture ' + name + ' at ' + timing.viewport.width + 'x' + timing.viewport.height);
    try {
      await bounded(page.screenshot({path: resolve(output, file), timeout: limits.screenshotMilliseconds}), limits.screenshotOuterMilliseconds, 'Screenshot ' + name);
      timing.status = 'saved'; entry.screenshots.push(file);
    } catch (error) { timing.status = 'failed'; captureFailed = true; throw error; }
    finally { timing.milliseconds = Date.now() - began; }
  };
  const bounds = async (selector, label = selector, safe = {top: 0, right: 0, bottom: 0, left: 0}, timer = false) => {
    const value = await page.locator(selector).evaluate((element, inspectText) => {
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      let text;
      if (inspectText) {
        const range = document.createRange(); range.selectNodeContents(element);
        const t = range.getBoundingClientRect(); text = {left: t.left, right: t.right, top: t.top, bottom: t.bottom, rects: range.getClientRects().length};
      }
      return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, viewport: {width: innerWidth, height: innerHeight},
        documentWidth: document.documentElement.scrollWidth, fontSize: style.fontSize, animation: style.animationName, text};
    }, timer);
    assert.ok(value.left >= safe.left - 1 && value.right <= value.viewport.width - safe.right + 1, label + ': horizontal safe bounds');
    assert.ok(value.top >= safe.top - 1 && value.bottom <= value.viewport.height - safe.bottom + 1, label + ': vertical safe bounds');
    assert.ok(value.scrollWidth <= value.clientWidth + 1, label + ': no horizontal content clipping');
    assert.ok(value.documentWidth <= value.viewport.width + 1, label + ': document fits viewport');
    if (value.text) {
      assert.ok(value.text.left >= value.left - 1 && value.text.right <= value.right + 1, label + ': all timer digits fit');
      assert.ok(value.text.top >= value.top - 2 && value.text.bottom <= value.bottom + 2, label + ': timer is not vertically clipped');
    }
    if (fixtureRecord) (fixtureRecord.bounds ??= {})[label] = value;
    else entry.metrics[label] = value;
    return value;
  };
  const target = async (selector, {button = true, quarters = button, enabled = true, safe} = {}) => {
    const locator = page.locator(selector); await expect(locator).toBeVisible();
    if (button && enabled) await expect(locator).toBeEnabled();
    const box = await bounds(selector, selector, safe);
    if (button) assert.ok(box.width >= 44 && box.height >= 44, selector + ': minimum 44px target');
    const result = await locator.evaluate((element, quarters) => {
      const r = element.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const points = [{x, y}];
      if (quarters) points.push({x: r.left + r.width / 4, y}, {x: r.right - r.width / 4, y}, {x, y: r.top + r.height / 4}, {x, y: r.bottom - r.height / 4});
      return {x, y, points: points.map(point => { const hit = document.elementFromPoint(point.x, point.y); return {...point, receives: hit === element || element.contains(hit), covering: hit?.id || hit?.tagName}; })};
    }, quarters);
    for (const point of result.points) assert.ok(point.receives, selector + ': input is covered by ' + point.covering);
    if (fixtureRecord) (fixtureRecord.hitTargets ??= {})[selector] = result.points;
    else (entry.metrics.hitTargets ??= {})[selector] = result.points;
    return {x: result.x, y: result.y};
  };
  const resize = async viewport => {
    const began = Date.now(), record = {requested: {...viewport}, startedAt: new Date(began).toISOString(), status: 'resizing'};
    (entry.metrics.resizeTransitions ??= []).push(record);
    try {
      await page.setViewportSize(viewport);
      await page.waitForFunction(size => {
        const canvas = document.querySelector('#game');
        return innerWidth === size.width && innerHeight === size.height &&
          canvas && canvas.width === size.width && canvas.height === size.height;
      }, viewport, {timeout: limits.actionMilliseconds});
      record.status = 'passed';
    } catch (error) { record.status = 'failed'; record.failure = error.message; throw error; }
    finally {
      try { record.actual = await bounded(page.evaluate(() => {
        const canvas = document.querySelector('#game'), r = canvas?.getBoundingClientRect();
        return {innerWidth, innerHeight, devicePixelRatio, documentWidth: document.documentElement.scrollWidth,
          canvas: canvas ? {width: canvas.width, height: canvas.height} : null,
          cssRect: r ? {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height} : null};
      }), 15_000, 'Resize viewport diagnostic'); }
      catch (error) { record.diagnosticFailure = error.message; }
      record.milliseconds = Date.now() - began;
    }
  };
  const webgl = async () => {
    const state = await page.locator('#game').evaluate(canvas => {
      const context = canvas.getContext('webgl2');
      return {live: !!context && !context.isContextLost(), width: canvas.width, height: canvas.height, version: context?.getParameter(context.VERSION)};
    });
    assert.equal(state.live, true, 'Real WebGL2 context must remain live'); return state;
  };
  const openMenu = async () => { await tap(page.locator('#tools-toggle')); await expect(page.locator('#ride-menu')).toBeVisible(); };
  const openBoard = async () => { await openMenu(); await tap(page.locator('#trials-open')); await expect(page.locator('#trial-board')).toBeVisible(); };
  const assertCountdown = (state, label) => {
    assert.equal(state.status, 'countdown', label + ': preparation has ended');
    assert.equal(state.elapsed, 0, label + ': elapsed resets'); assert.equal(state.next, 0, label + ': gate resets');
    assert.equal(state.offCourse, 'false', label + ': off-course resets'); assert.equal(state.time, '0:00.00');
    assert.equal(state.speed, 0, label + ': no countdown movement');
    assert.equal(state.focused, 'game', label + ': canvas receives fresh input');
  };
  const buttonTrigger = async (selector, {keyboard = false} = {}) => {
    const locator = page.locator(selector);
    await locator.scrollIntoViewIfNeeded();
    const point = await target(selector);
    const enter = {key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 0, location: 0};
    const end = () => keyboard ? touch.send('Input.dispatchKeyEvent', {type: 'keyUp', ...enter}) :
      configuration.mobile ? touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}) : page.mouse.up();
    let down = false;
    const trigger = {description: (keyboard ? 'Native Enter down/up on focused button ' : 'Prequeued native button down/up ') + selector, point,
      fire() {
        down = true; activeTriggers.add(trigger);
        // Match Playwright's Chromium Enter event, on the same CDP session as touch.
        const pressed = keyboard ? touch.send('Input.dispatchKeyEvent', {type: 'keyDown', ...enter, text: '\r', unmodifiedText: '\r', autoRepeat: false}) :
          configuration.mobile ? touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...point, id: 2}]}) : page.mouse.down();
        const released = end().then(() => { down = false; activeTriggers.delete(trigger); });
        return Promise.all([pressed, released]);
      },
      async release() { if (!down) return; await end(); down = false; activeTriggers.delete(trigger); }};
    if (keyboard) { await locator.focus(); await expect(locator).toBeFocused(); }
    else if (!configuration.mobile) await page.mouse.move(point.x, point.y);
    return trigger;
  };
  const restartKeyTrigger = () => {
    let down = false;
    const trigger = {description: 'Native R keydown',
      fire() { down = true; activeTriggers.add(trigger); return page.keyboard.down('r'); },
      async release() { if (!down) return; await page.keyboard.up('r'); down = false; activeTriggers.delete(trigger); }};
    return trigger;
  };
  const duringCountdown = async (trigger, label, input) => {
    assert.equal(countdownWaiter, undefined, 'Only one countdown notification may be armed');
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const record = {label, trigger: trigger.description, triggerPoint: trigger.point, input: input?.description ?? 'Observe only',
      dispatch: input ? 'Native input after observed render-ready countdown' : 'Observe only', armedAt: new Date().toISOString()};
    (entry.metrics.countdownTransitions ??= []).push(record);
    const waiter = {id: ++countdownSequence, cancelled: false, received: false, cleanupComplete: false, receive(payload) {
      if (timedOut || countdownWaiter !== waiter || waiter.cancelled || waiter.received || payload.id !== waiter.id) return;
      waiter.received = true; record.notification = payload;
      try {
        assertCountdown(payload.state, label);
        assert.equal(hasCountdownCleanupEvidence(payload.observerCleanup, waiter.id), true,
          label + ': readiness notification follows owned observer cleanup');
        record.observerCleanup = payload.observerCleanup; waiter.cleanupComplete = true;
        resolveReady(payload);
      } catch (error) { record.failure = error.stack || String(error); if (!waiter.cancelled) rejectReady(error); }
    }};
    countdownWaiter = waiter;
    try {
      record.arm = await page.evaluate(id => {
        if (window.__polishCountdownArm) window.__polishCountdownLifecycle.cancel(window.__polishCountdownArm.id);
        const hud = document.querySelector('#trial-hud');
        if (!hud) throw new Error('Trial HUD is required before arming countdown');
        let previous = hud.hidden ? 'hidden' : hud.dataset.status;
        const arm = {id};
        const observer = new MutationObserver(() => {
          const status = hud.hidden ? 'hidden' : hud.dataset.status;
          if (status === 'countdown' && previous !== 'countdown') {
            const payload = {id, previous, state: window.__polishTrialSnapshot(), traceStart: window.__polishInput.length};
            window.__polishCountdownLifecycle.ready(arm, payload, ready => {
              window.__polishCountdownReady(ready).catch(error => window.__polishObserverErrors.push(String(error)));
            });
          }
          previous = status;
        });
        arm.observer = observer; window.__polishCountdownArm = arm;
        observer.observe(hud, {attributes: true, attributeFilter: ['data-status', 'hidden']});
        return {traceStart: window.__polishInput.length, state: window.__polishTrialSnapshot()};
      }, waiter.id);
      // Native input must follow the real render-ready countdown. Preparation
      // may now span GPU/compositor frames; prequeued input is correctly cleared.
      record.triggerQueuedAt = new Date().toISOString();
      const triggered = trigger.fire().then(() => { record.triggerCompletedAt = new Date().toISOString(); });
      const observed = await bounded(dispatchAfterReadyCountdown({
        triggered, ready,
        current: () => !timedOut && countdownWaiter === waiter && !waiter.cancelled,
        refresh: input ? () => input.refreshTarget?.() : undefined,
        press: input ? async () => {
          record.inputQueuedAt = new Date().toISOString();
          await input.press();
          record.inputCompletedAt = new Date().toISOString();
        } : undefined,
      }), limits.actionMilliseconds, label + ' countdown transition');
      return {traceStart: record.arm.traceStart, transitionIndex: entry.metrics.countdownTransitions.length - 1,
        state: observed.state, expectedCode: input?.expectedCode,
        expectedTarget: input?.expectedTarget, release: input?.release};
    } catch (error) {
      record.failure ??= error.stack || String(error);
      waiter.cancelled = true; if (countdownWaiter === waiter) countdownWaiter = undefined;
      if (input) { try { await bounded(input.release(), 5_000, label + ' input release'); } catch (releaseError) { record.releaseFailure = releaseError.message; cleanupFailed = true; } }
      throw error;
    } finally {
      // Invalidate late proof notifications and release a native R/button press.
      waiter.cancelled = true; if (countdownWaiter === waiter) countdownWaiter = undefined;
      try { await bounded(trigger.release(), 5_000, label + ' trigger release'); }
      catch (error) { record.triggerReleaseFailure = error.message; cleanupFailed = true; }
      // Successful readiness already disconnected and deleted its own observer
      // before notifying Node. Missing/aborted readiness still needs fatal,
      // bounded cleanup; a replacement generation must never be removed.
      if (!waiter.cleanupComplete) {
        try { record.observerCleanup = await bounded(page.evaluate(id =>
          window.__polishCountdownLifecycle.cancel(id), waiter.id), 5_000, 'Countdown observer cleanup'); }
        catch (error) { record.observerCleanupFailure = error.message; cleanupFailed = true; }
      }
    }
  };
  const begin = async (id, vehicle, input) => {
    await tap(page.locator('#trial-tab-' + vehicle));
    if (!await page.locator('[data-course="' + id + '"]').isVisible()) await tap(page.locator('#trial-practice > summary'));
    const trigger = await buttonTrigger('[data-course="' + id + '"]', {keyboard: configuration.mobile && !!input});
    const observed = await duringCountdown(trigger, 'Course start ' + id, input);
    assert.equal(observed.state.course, id, 'Requested course is ready');
    return observed;
  };
  const prepareHeld = async (vehicle, direction = 'forward') => {
    const key = direction === 'right' ? 'd' : 'w';
    const selector = vehicle === 'hoverbike' ? '#hover-move-zone' : '#touch-zone';
    let point;
    if (configuration.mobile) {
      await expect(page.locator('body')).toHaveAttribute('data-joystick-mode', 'fixed');
      await target(selector, {button: false});
      const pad = vehicle === 'hoverbike' ? '#hover-flight-stick' : '#stick';
      const geometry = await page.locator(pad).evaluate((element, {selector, direction}) => {
        const r = element.getBoundingClientRect(), zone = document.querySelector(selector);
        const point = {x: r.left + r.width / 2 + (direction === 'right' ? r.width * .35 : 0), y: r.top + r.height / 2 - (direction === 'forward' ? r.height * .35 : 0)};
        const hit = document.elementFromPoint(point.x, point.y);
        return {point, pad: {left: r.left, top: r.top, width: r.width, height: r.height}, receives: hit === zone || zone.contains(hit), covering: hit?.id || hit?.tagName};
      }, {selector, direction});
      (entry.metrics.cachedInputTargets ??= {})[vehicle + ':' + direction] = geometry;
      assert.ok(geometry.receives, 'Cached fixed-stick input point is covered by ' + geometry.covering);
      point = geometry.point;
    }
    const input = {description: configuration.mobile ? 'Trusted fixed joystick ' + direction + ' touchStart' : 'Trusted held ' + key.toUpperCase(), point,
      expectedCode: configuration.mobile ? undefined : direction === 'right' ? 'KeyD' : 'KeyW', expectedTarget: configuration.mobile ? selector.slice(1) : undefined,
      async refreshTarget() {
        if (!configuration.mobile) return;
        const pad = vehicle === 'hoverbike' ? '#hover-flight-stick' : '#stick';
        const geometry = await page.locator(pad).evaluate((element, {selector, direction}) => {
          const r = element.getBoundingClientRect(), zone = document.querySelector(selector);
          const point = {x: r.left + r.width / 2 + (direction === 'right' ? r.width * .35 : 0), y: r.top + r.height / 2 - (direction === 'forward' ? r.height * .35 : 0)};
          const hit = document.elementFromPoint(point.x, point.y);
          return {point, receives: !!zone && (hit === zone || zone.contains(hit)), covering: hit?.id || hit?.tagName};
        }, {selector, direction});
        assert.ok(geometry.receives, 'Ready-countdown input point is covered by ' + geometry.covering);
        point = geometry.point; input.point = point;
        (entry.metrics.readyInputTargets ??= {})[vehicle + ':' + direction] = geometry;
      },
      async press() { activeHolds.add(input); if (configuration.mobile) await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...point, id: 1}]}); else await page.keyboard.down(key); },
      async release() { if (!activeHolds.has(input)) return; if (configuration.mobile) await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); else await page.keyboard.up(key); activeHolds.delete(input); }};
    return input;
  };
  const startHeld = async (vehicle, direction = 'forward') => {
    const input = await prepareHeld(vehicle, direction), traceStart = await page.evaluate(() => window.__polishInput.length);
    await input.press(); return {...input, traceStart};
  };
  const startRiderControls = async () => {
    const forward = await prepareHeld('hoverbike'), turn = await target('#hover-hud [data-hold="ArrowRight"]'), ascend = await target('#hover-hud [data-hold="KeyE"]');
    const input = {description: configuration.mobile ? 'Trusted simultaneous forward joystick, turn-right and ascend touch holds; native Enter on Pause freezes the capture' : 'Trusted held W, ArrowRight and E; native Pause click freezes the capture',
      async press() {
        activeHolds.add(input);
        if (configuration.mobile) await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...forward.point, id: 1}, {...turn, id: 3}, {...ascend, id: 4}]});
        else await Promise.all([page.keyboard.down('w'), page.keyboard.down('ArrowRight'), page.keyboard.down('e')]);
      },
      async release() {
        if (!activeHolds.has(input)) return;
        if (configuration.mobile) await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        else await Promise.all([page.keyboard.up('w'), page.keyboard.up('ArrowRight'), page.keyboard.up('e')]);
        activeHolds.delete(input);
      }};
    const traceStart = await page.evaluate(() => window.__polishInput.length);
    await input.press(); return {...input, traceStart};
  };
  const bufferedGo = async (held, label) => {
    const samples = [held.state], record = {samples, inputEvents: []}; entry.metrics[label] = record;
    record.inputEvents = await page.evaluate(start => window.__polishInput.slice(start), held.traceStart);
    record.timing = {...classifyCountdownInput({mobile: configuration.mobile, events: record.inputEvents,
      state: held.state, expectedCode: held.expectedCode, expectedTarget: held.expectedTarget}),
      observedCountdownAtMilliseconds: held.state.at, transitionIndex: held.transitionIndex,
      clock: 'Native event and observer timestamps are page performance.now() milliseconds; transition dispatch timestamps are UTC.'};
    assert.notEqual(record.timing.status, 'failed', label + ': fresh trusted input arrived after prepare and before GO');
    if (record.timing.status === 'inconclusive') {
      const gap = {check: label, status: 'inconclusive', reason: record.timing.reason,
        latencyMilliseconds: record.timing.latencyMilliseconds};
      entry.coverageGaps.push(gap);
      log(configuration.name + ': INCONCLUSIVE ' + label + ' native touch arrived ' + gap.latencyMilliseconds.toFixed(1) + 'ms after the ready countdown; movement is still required');
      console.warn('::warning title=Incomplete phone countdown coverage::' + label + ': native touch missed the countdown window. Timing coverage is inconclusive, not passed; the uninterrupted hold must still produce movement.');
    }
    await expect.poll(async () => {
      const state = await readTrial(); samples.push(state);
      if (state.status === 'countdown') { assert.equal(state.speed, 0, label + ': movement frozen before GO'); assert.equal(state.elapsed, 0); }
      assert.ok(['countdown', 'running'].includes(state.status), label + ': valid countdown/run');
      return state.status === 'running' && state.speed > 0;
    }, {timeout: limits.actionMilliseconds, intervals: [100, 250, 500, 1000]}).toBe(true);
    record.movementPassed = true;
    record.result = record.timing.status === 'passed' ? 'One continuous hold from countdown through observed movement; no release/re-press at GO' :
      'Uninterrupted late-delivered touch produced measured movement; countdown buffering remains unverified.';
  };
  const idleAfterGo = async label => {
    const samples = []; entry.metrics[label] = samples;
    await expect(page.locator('#trial-hud')).toHaveAttribute('data-status', 'running');
    await expect.poll(async () => {
      const state = await readTrial();
      if (samples.at(-1)?.elapsed !== state.elapsed) samples.push(state);
      assert.equal(state.speed, 0, label + ': old input must stay cleared');
      return samples.filter(sample => sample.elapsed > 0).length;
    }, {timeout: limits.actionMilliseconds, intervals: [500, 1000, 1500]}).toBeGreaterThanOrEqual(2);
  };
  const leave = async () => {
    await tap(page.locator('#trial-exit')); await expect(page.locator('#trial-hud')).not.toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/island-trial/);
  };
  const cueStyle = () => page.locator('#trial-hud .trial-direction, #trial-hud .trial-map-wrap').evaluateAll(elements =>
    elements.map(element => ({className: element.className, animation: getComputedStyle(element).animationName, color: getComputedStyle(element).color, text: element.textContent})));

  try {
    browser = await chromium.launch({channel: 'chromium', headless, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--gpu-watchdog-timeout-seconds=' + limits.gpuWatchdogSeconds]});
    entry.metrics.browserVersion = browser.version();
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: configuration.mobile, hasTouch: true, reducedMotion: 'no-preference'});
    page = await context.newPage(); touch = await context.newCDPSession(page); page.setDefaultTimeout(limits.actionMilliseconds);
    await page.exposeBinding('__polishCountdownReady', (_, payload) => countdownWaiter?.receive(payload));
    await page.addInitScript({content: 'window.__polishCountdownLifecycle = (' + createCountdownObserverLifecycle.toString() + ')(window);'});
    // Read-only event trace proves when trusted input was delivered; it never changes the game.
    await page.addInitScript(() => {
      window.__polishInput = []; window.__polishObserverErrors = [];
      window.__polishTrialSnapshot = () => {
        const hud = document.querySelector('#trial-hud'); if (!hud) return null;
        return {at: performance.now(), hudHidden: hud.hidden, status: hud.dataset.status, course: hud.dataset.course,
          elapsed: Number(hud.dataset.elapsed), next: Number(hud.dataset.next), paused: hud.dataset.paused,
          offCourse: hud.dataset.offCourse, reducedMotion: hud.dataset.reducedMotion, time: hud.querySelector('.trial-time')?.textContent,
          speed: Number.parseFloat(document.querySelector(hud.dataset.vehicle === 'hoverbike' ? '#hover-speed' : '#speed')?.textContent || '0'),
          focused: document.activeElement?.id || document.activeElement?.tagName, visibility: document.visibilityState,
          openDialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id)};
      };
      window.__polishRiderSnapshot = () => {
        const hover = document.querySelector('#hover-hud'), trial = document.querySelector('#trial-hud');
        if (!hover || !trial) return null;
        const number = key => hover.dataset[key] === undefined || hover.dataset[key] === '' ? null : Number(hover.dataset[key]);
        let ghosts = null, ghostError = null;
        try { ghosts = JSON.parse(trial.dataset.ghostState ?? 'null'); } catch (error) { ghostError = String(error); }
        return {at: performance.now(), hidden: hover.hidden, rig: hover.dataset.riderRig, mode: hover.dataset.riderMotion,
          lean: number('riderLean'), pitch: number('riderPitch'), compression: number('riderCompression'), handError: number('riderHandError'), footError: number('riderFootError'),
          course: trial.dataset.course, status: trial.dataset.status, paused: trial.dataset.paused, elapsed: Number(trial.dataset.elapsed),
          visibility: document.visibilityState, openDialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id), systemReduced: matchMedia('(prefers-reduced-motion: reduce)').matches, gameReduced: document.querySelector('#motion')?.checked,
          ghosts, ghostError, ghostTracks: Number(trial.dataset.ghostTracks), ghostVisible: Number(trial.dataset.ghostVisible), recordedGhost: trial.dataset.recordedGhost};
      };
      for (const type of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'focus', 'visibilitychange', 'close']) window.addEventListener(type, event => {
        const hud = document.querySelector('#trial-hud');
        if (!hud) return;
        const button = event.target?.closest?.('button');
        window.__polishInput.push({...window.__polishTrialSnapshot(), type, trusted: event.isTrusted, code: event.code, repeat: event.repeat === true,
          target: event.target?.id || event.target?.nodeName, pointerType: event.pointerType, control: event.target?.closest?.('#touch-zone, #hover-move-zone')?.id,
          button: button ? {id: button.id, text: button.textContent?.trim().slice(0, 100), course: button.dataset.course, hold: button.dataset.hold} : undefined,
          relatedTarget: event.relatedTarget?.id || event.relatedTarget?.nodeName, x: event.clientX, y: event.clientY});
      }, {capture: true, passive: true});
    });
    page.on('pageerror', error => { entry.errors.push(error.message); log(configuration.name + ': page error ' + error.message); });
    page.on('console', message => {
      const item = {at: new Date().toISOString(), type: message.type(), text: message.text()};
      entry.console.push(item);
      if (item.type === 'error' || /(?:webgl|renderer).*context\s*(?:was\s*)?lost|context[_ -]?lost/i.test(item.text)) entry.errors.push(item.text);
    });
    page.on('response', response => { if (response.status() >= 400) entry.errors.push('HTTP ' + response.status() + ' ' + response.url()); });
    page.on('requestfailed', request => {
      const message = request.failure()?.errorText + ' ' + request.url(); entry.failedRequests.push(message);
      if (!message.startsWith('net::ERR_ABORTED')) entry.errors.push(message);
    });
    await Promise.race([(async () => {
      log(configuration.name + ': load game and configure through UI');
      await page.goto(origin + '/', {waitUntil: 'domcontentloaded', timeout: 30_000});
      await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#welcome')?.dataset.state), null, {timeout: 180_000});
      await expect(page.locator('#welcome')).toHaveAttribute('data-state', 'ready');
      if (await page.locator('#startup-motion').getAttribute('aria-pressed') !== 'true') await tap(page.locator('#startup-motion'));
      await tap(page.locator('.cinema-ride-picker > summary'));
      await tap(page.locator('.ride-options label').filter({hasText: 'One wheel'}));
      await tap(page.getByRole('button', {name: 'Use this ride', exact: true}));
      await tap(page.locator('#start')); await expect(page.locator('body')).not.toHaveClass(/at-start/);
      await openMenu(); await tap(page.locator('#settings-open'));
      await page.locator('#quality').selectOption('smooth'); await page.locator('#fps').selectOption('30');
      await page.locator('#touch').check(); await page.locator('#motion').uncheck();
      if (configuration.mobile) await page.locator('#joystick-mode').selectOption('fixed');
      await tap(page.locator('[data-close="settings"]')); await resize(configuration.viewport);
      entry.metrics.graphics = {quality: 'smooth', fpsTarget: 30, actualPerformanceCertified: false, touchControls: true,
        joystickMode: configuration.mobile ? 'fixed' : 'floating'};
      entry.metrics.startupWebgl = await webgl();

      log(configuration.name + ': inspect actual timed delivery HUD');
      await openMenu(); await tap(page.locator('#activities-open'));
      await tap(page.locator('#activity-tab-dispatch'));
      const timedCard = page.locator('#activity-content .activity-card').filter({has: page.getByRole('heading', {name: 'Two-Stop Sweep', exact: true})});
      await tap(timedCard.getByRole('button', {name: 'Start assignment', exact: true}));
      await expect(page.locator('#activity-hud .activity-time')).toHaveText(/^\d+:\d{2}$/);
      await bounds('#activity-hud', 'deliveryHud'); await bounds('.activity-time', 'deliveryTimer', undefined, true);
      await target('#activity-action', {enabled: false});
      templates.activity = await page.locator('#activity-hud').evaluate(element => element.outerHTML);
      await capture('delivery-timer');
      await tap(page.locator('#activity-hud').getByRole('button', {name: 'Journal · J', exact: true}));
      await tap(page.locator('#activity-board').getByRole('button', {name: 'End activity', exact: true}));
      await tap(page.locator('#activity-board').getByRole('button', {name: 'Back to island', exact: true}));

      if (configuration.mobile) await resize({width: 320, height: 360});
      await resize(configuration.physicsViewport);
      const wheelHold = await prepareHeld('onewheel');
      await openBoard();
      log(configuration.name + ': verify gate-sound opt-in control and preview status');
      await expect(page.locator('#trial-sound-toggle')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#trial-sound-status')).toContainText('off');
      await tap(page.locator('#trial-sound-toggle'));
      await expect(page.locator('#trial-sound-toggle')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#trial-sound-status')).toContainText('Sky Circuit checkpoints and finish');
      assert.equal(await page.evaluate(() => localStorage.getItem('belle-isle-gate-sounds-v1')), 'on');
      await tap(page.locator('#trial-board').getByRole('button', {name: 'Back to island', exact: true}));
      await openBoard(); await expect(page.locator('#trial-sound-toggle')).toHaveAttribute('aria-pressed', 'true');
      await tap(page.locator('#trial-sound-toggle')); await expect(page.locator('#trial-sound-toggle')).toHaveAttribute('aria-pressed', 'false');
      entry.metrics.gateSounds = {defaultOff: true, realGesturePreviewReady: true, persistedOnAndReopened: true, mutedAgain: true, acousticListening: 'not exercised', realGateCrossing: 'not exercised'};

      log(configuration.name + ': hold fresh input through Cup countdown');
      let held = await begin('onewheel-island-cup-v1', 'onewheel', wheelHold);
      try {
        await bufferedGo(held, 'initialCountdownHold');
        log(configuration.name + ': R restart while original input remains held');
        const restarted = await duringCountdown(restartKeyTrigger(), 'Held-input restart', configuration.mobile ? undefined : wheelHold);
        if (!configuration.mobile) {
          // The OS can repeat an already-held key after restart clears gameplay input.
          // The native queue sends a second down without an up after the R event.
          const repeats = await page.evaluate(start => window.__polishInput.slice(start), restarted.traceStart);
          entry.metrics.heldRestartRepeat = repeats;
          assert.ok(repeats.some(event => event.trusted && event.hudHidden === false && event.course === restarted.state.course && event.code === 'KeyW' && event.repeat && event.status === 'countdown'), 'Old held W produced a trusted countdown repeat');
        }
        await idleAfterGo('restartClearsOldHold');
      } finally { await held.release(); }
      let restart;
      if (!configuration.mobile) {
        await resize(configuration.viewport); await capture('wheel-ground-contact'); await resize(configuration.physicsViewport);
        await tap(page.locator('#pause')); await expect(page.locator('#pause')).toBeFocused();
        await expect(page.locator('#trial-hud')).toHaveAttribute('data-paused', 'true');
        const paused = await readTrial(); await delay(700); assert.equal((await readTrial()).elapsed, paused.elapsed);
        restart = restartKeyTrigger();
      } else restart = await buttonTrigger('#trial-restart', {keyboard: true});
      held = await duringCountdown(restart, configuration.mobile ? 'Button restart' : 'Pause-focused R restart', wheelHold);
      try { await expect(page.locator('#pause')).toHaveText('Pause'); await bufferedGo(held, 'restartedCountdownHold'); }
      finally { await held.release(); }
      await leave();

      if (!configuration.mobile) {
        log(configuration.name + ': mount normal grounded hoverbike near Cup start');
        await openMenu(); await tap(page.locator('#hover-enter'));
        await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
        await expect(page.locator('#hover-mode')).toHaveText('LANDED');
        const altitude = Number.parseFloat(await page.locator('#hover-altitude').textContent());
        assert.ok(altitude >= 0 && altitude < 1, 'Normal hoverbike contact capture must remain low AGL');
        entry.metrics.groundHoverAltitude = altitude;
        await resize(configuration.viewport); await capture('hover-ground-contact');
        await tap(page.locator('#hover-hud [data-hover="exit"]')); await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
        log(configuration.name + ': visit real Sunset Point guide viewpoint');
        await openMenu(); await tap(page.locator('#map-open')); await page.locator('#guide-search').fill('Sunset Point');
        const shore = page.locator('#landmarks .landmark').filter({has: page.getByRole('heading', {name: 'Sunset Point', exact: true})});
        await expect(shore).toHaveCount(1); await tap(shore.getByRole('button', {name: 'Travel to path', exact: true}));
        await expect(page.locator('#guide')).not.toBeVisible();
        entry.metrics.shoreVisit = {card: 'Sunset Point', action: 'Travel to path', place: await page.locator('#place').textContent()};
        await capture('shoreline-sunset-point'); await resize(configuration.physicsViewport);
      }

      log(configuration.name + ': real Sunset Halo strafe until off-course cue');
      await openBoard(); await armRiderTrace('Existing Sky strafe and early pace-guide observations'); await begin('sky-sunset-v1', 'hoverbike');
      await expect(page.locator('#trial-hud')).toHaveAttribute('data-status', 'running');
      await expect(page.locator('#hover-flight-mode')).toHaveValue('drone');
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-rig', 'anchored');
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-motion', 'reactive');
      const riderBaseline = validateRider(await readRider(), 'Sky start', 'reactive');
      entry.metrics.riderMotion = {scope: 'Read-only applied-pose HUD observations from actual native input. Source tests independently verify shipped skin/IK geometry.', strafe: null, preferences: {}};
      held = await startHeld('hoverbike', 'right');
      try {
        const began = Date.now();
        await expect.poll(async () => {
          const state = await readTrial(); assert.equal(state.status, 'running', 'Deviation must not invalidate the trial');
          return state.offCourse;
        }, {timeout: limits.offCourseMilliseconds, intervals: [500, 1000, 1500]}).toBe('true');
        entry.metrics.offCourse = {milliseconds: Date.now() - began, input: configuration.mobile ? 'Trusted rightward joystick hold' : 'Held D', state: await readTrial()};
        const riderTrace = await takeRiderTrace();
        entry.metrics.riderMotion.strafe = await summarizeRider(riderTrace, riderBaseline, held, 'Native Sky strafe', [configuration.mobile ? 'hover-move-zone' : 'KeyD']);
        assert.ok(entry.metrics.riderMotion.strafe.axes.lean.maximumChange >= .02, 'Native strafe produced a measured torso reaction during the hold');
        const firstRunning = riderTrace.samples.find(sample => sample?.course === 'sky-sunset-v1' && sample.status === 'running' && !sample.hidden);
        const visiblePace = riderTrace.samples.find(sample => sample?.course === 'sky-sunset-v1' && sample.status === 'running' && sample.ghosts?.some(ghost => ghost.kind === 'pace'));
        entry.metrics.ghosts = {scope: 'Actual visible ghost-view snapshots read from HUD data; no state or replay is seeded.',
          firstAfterGo: firstRunning ?? riderBaseline, firstVisiblePace: visiblePace ?? null,
          paceObservation: visiblePace ? 'Observed the pace-guide mesh reported as visible by the actual game view; screen placement requires image review' : 'No visible pace-guide mesh observed in this window; near/far fade and CI scheduling remain possible',
          recordedGhostReplay: 'Not exercised: no native full-course finish is performed'};
      } finally { await held.release(); }
      await resize(configuration.viewport);
      await expect(page.locator('#trial-hud .trial-direction')).toContainText('Off course');
      const animated = await cueStyle(); assert.ok(animated.every(item => item.animation !== 'none'), 'Default off-course cue pulses');
      await page.emulateMedia({reducedMotion: 'reduce'});
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-motion', 'reduced');
      const riderSystemReduced = validateRider(await readRider(), 'OS reduced rider motion', 'reduced');
      assert.equal(riderSystemReduced.systemReduced, true); assert.equal(riderSystemReduced.gameReduced, false);
      assert.ok(['lean', 'pitch', 'compression'].every(key => Math.abs(riderSystemReduced[key]) <= .0001), 'OS reduced motion removes secondary rider reactions');
      entry.metrics.riderMotion.preferences.system = riderSystemReduced;
      const systemReduced = await cueStyle(); assert.ok(systemReduced.every(item => item.animation === 'none'), 'OS reduced motion keeps a static cue');
      await expect(page.locator('#trial-hud .trial-direction')).toContainText('Off course');
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-motion', 'reactive');
      await openMenu(); await tap(page.locator('#settings-open')); await page.locator('#motion').check(); await tap(page.locator('[data-close="settings"]'));
      await expect(page.locator('#trial-hud')).toHaveAttribute('data-reduced-motion', 'true');
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-motion', 'reduced');
      const riderGameReduced = validateRider(await readRider(), 'In-game reduced rider motion', 'reduced');
      assert.equal(riderGameReduced.systemReduced, false); assert.equal(riderGameReduced.gameReduced, true);
      assert.ok(['lean', 'pitch', 'compression'].every(key => Math.abs(riderGameReduced[key]) <= .0001), 'In-game reduced motion removes secondary rider reactions');
      entry.metrics.riderMotion.preferences.game = riderGameReduced;
      const gameReduced = await cueStyle(); assert.ok(gameReduced.every(item => item.animation === 'none'), 'In-game reduced motion keeps a static cue');
      entry.metrics.cueMotion = {animated, systemReduced, gameReduced};
      await bounds('#trial-hud', 'skyHud'); await bounds('#trial-hud .trial-time', 'skyTimer', undefined, true);
      await target('#trial-restart'); await target('#trial-exit');
      for (const key of ['ArrowLeft', 'ArrowRight', 'KeyE', 'KeyQ', 'Space']) await target('#hover-hud [data-hold="' + key + '"]');
      if (configuration.mobile) await expect(page.locator('.hover-lighting')).not.toBeVisible();
      else {
        await tap(page.locator('.hover-lighting > summary')); await expect(page.locator('.hover-lighting')).toHaveAttribute('open', '');
        const settings = await bounds('.hover-lighting', 'optionalFlightSettings'), hud = await bounds('#trial-hud', 'settingsTrialHud');
        assert.ok(settings.left >= hud.right || settings.bottom <= hud.top || settings.top >= hud.bottom, 'Optional settings must not overlap the trial HUD');
        await target('.hover-lighting > summary', {button: false});
      }
      await capture('sky-off-course');
      templates.trial = await page.locator('#trial-hud').evaluate(element => element.outerHTML);
      templates.hover = await page.locator('#hover-hud').evaluate(element => element.outerHTML);
      if (configuration.mobile) {
        await resize({width: 844, height: 390});
        await bounds('#trial-hud', 'landscapeTrialHud'); await bounds('.trial-time', 'landscapeTimer', undefined, true);
        for (const selector of ['#trial-restart', '#trial-exit', '#hover-hud [data-hold="ArrowLeft"]', '#hover-hud [data-hold="ArrowRight"]', '#hover-hud [data-hold="KeyE"]', '#hover-hud [data-hold="KeyQ"]', '#hover-hud [data-hold="Space"]']) await target(selector);
        await expect(page.locator('.hover-lighting')).not.toBeVisible(); await capture('sky-landscape');
        await resize(configuration.viewport);
      } else await tap(page.locator('.hover-lighting > summary'));
      await duringCountdown(await buttonTrigger('#trial-restart'), 'Off-course restart');
      await expect(page.locator('#trial-hud')).toHaveAttribute('data-off-course', 'false');
      await expect(page.locator('#trial-hud')).toHaveAttribute('data-status', 'running');
      await expect(page.locator('#hover-speed')).toHaveText('0');
      log(configuration.name + ': capture an actual reactive rider pose with native controls and Pause');
      await openMenu(); await tap(page.locator('#settings-open')); await page.locator('#motion').uncheck(); await tap(page.locator('[data-close="settings"]'));
      await expect(page.locator('#hover-hud')).toHaveAttribute('data-rider-motion', 'reactive'); await resize(configuration.physicsViewport);
      const captureBaseline = validateRider(await armRiderTrace('Native forward/turn/ascend, then native Pause'), 'Rider capture baseline', 'reactive');
      held = await startRiderControls();
      try {
        await expect.poll(async () => {
          const state = validateRider(await readRider(), 'Native rider response', 'reactive');
          assert.equal(state.status, 'running'); assert.equal(state.paused, 'false');
          return Math.abs(state.lean - captureBaseline.lean);
        }, {timeout: limits.actionMilliseconds, intervals: [250, 500, 1000]}).toBeGreaterThanOrEqual(.045);
        if (configuration.mobile) { await page.locator('#pause').focus(); await page.keyboard.press('Enter'); }
        else await tap(page.locator('#pause'));
        await expect(page.locator('#trial-hud')).toHaveAttribute('data-paused', 'true');
        await held.release();
        const nativeTrace = await takeRiderTrace();
        const captureProof = await summarizeRider(nativeTrace, captureBaseline, held, 'Native rider capture', configuration.mobile ? ['hover-move-zone', 'ArrowRight', 'KeyE'] : ['KeyW', 'ArrowRight', 'KeyE']);
        assert.ok(captureProof.axes.lean.maximumChange >= .045, 'Native turning produced the rider pose used for capture');
        await resize(configuration.viewport);
        const frozen = validateRider(await readRider(), 'Paused native-input pose', 'reactive');
        assert.equal(frozen.paused, 'true'); assert.ok(Math.abs(frozen.lean - captureBaseline.lean) >= .04, 'A visible torso reaction actually remains frozen');
        const captureName = 'sky-rider-response-paused';
        entry.metrics.riderMotion.capture = {...captureProof, scope: 'Actual paused native-input pose, not a live-motion or full-lap recording', frozen, captureName,
          phoneInput: configuration.mobile ? 'Real simultaneous touch driving; native Enter activates the actual Pause button' : null};
        await capture(captureName);
        const after = validateRider(await readRider(), 'After paused rider capture', 'reactive');
        assert.equal(after.paused, 'true'); assert.equal(after.elapsed, frozen.elapsed, 'Native Pause keeps the race clock fixed during capture');
        for (const key of ['lean', 'pitch', 'compression']) assert.equal(after[key], frozen[key], 'Native Pause preserves captured rider ' + key);
        entry.metrics.riderMotion.capture.after = after;
      } finally { await held.release(); }
      await tap(page.locator('#pause')); await expect(page.locator('#trial-hud')).toHaveAttribute('data-paused', 'false'); await leave();
      entry.metrics.finalWebgl = await webgl();
      assert.deepEqual(entry.errors, [], 'Runtime errors/context loss/missing assets fail real gameplay');
      entry.realGameCompletedAt = new Date().toISOString();
      try { await writeFile(resolve(output, configuration.name + '-game-dom.html'), await bounded(page.content(), 5_000, 'Real-game DOM diagnostic')); }
      catch (error) { entry.realGameDomFailure = error.message; }

      log(configuration.name + ': begin isolated CSS fixtures; real game is unloaded');
      await page.goto('about:blank'); await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + shippedCss + '</style></head><body><div id="fixture-root"></div><p id="fixture-label" style="position:fixed;bottom:2px;left:8px;right:8px;z-index:1000;margin:0;padding:4px;background:#000;color:white;font:10px/1.4 monospace;pointer-events:none">CSS FIXTURE · artificial safe insets and long timer text · no game simulation</p></body></html>');
      const probes = [
        {name: 'small-phone', width: 320, height: 568, safe: {top: 0, right: 0, bottom: 0, left: 0}},
        {name: 'notched-small-phone', width: 320, height: 568, safe: {top: 44, right: 20, bottom: 34, left: 20}},
        {name: 'short-phone-large-controls', width: 390, height: 568, safe: {top: 44, right: 0, bottom: 34, left: 0}, controlScale: 1.2},
        {name: 'notched-phone', width: 390, height: 844, safe: {top: 59, right: 0, bottom: 34, left: 0}},
        {name: 'notched-landscape', width: 844, height: 390, safe: {top: 0, right: 44, bottom: 21, left: 44}},
        {name: 'short-landscape', width: 568, height: 320, safe: {top: 0, right: 24, bottom: 21, left: 24}, controlScale: 1.2},
        {name: 'short-landscape-fixed-stick', width: 568, height: 320, safe: {top: 0, right: 24, bottom: 21, left: 24}, controlScale: 1.2, joystickMode: 'fixed', kinds: ['trial']},
        {name: 'tablet', width: 1024, height: 768, safe: {top: 24, right: 0, bottom: 20, left: 0}},
        {name: 'desktop', width: 1355, height: 721, safe: {top: 0, right: 0, bottom: 0, left: 0}},
        {name: 'ultrawide', width: 2560, height: 1080, safe: {top: 0, right: 32, bottom: 0, left: 16}},
      ];
      for (const probe of probes) for (const kind of probe.kinds ?? ['trial', 'activity']) {
        fixtureRecord = {name: probe.name, kind, viewport: {width: probe.width, height: probe.height}, safe: probe.safe, controlScale: probe.controlScale ?? 1, joystickMode: probe.joystickMode ?? 'floating'};
        entry.cssFixtures.probes.push(fixtureRecord);
        await page.setViewportSize({width: probe.width, height: probe.height}); await page.emulateMedia({reducedMotion: 'no-preference'});
        await page.evaluate(({probe, kind, markup}) => {
          document.body.className = kind === 'trial' ? 'island-trial on-hoverbike touch-controls' : 'touch-controls';
          document.body.dataset.joystickMode = probe.joystickMode ?? 'floating';
          document.body.style.setProperty('--control-scale', String(probe.controlScale ?? 1));
          for (const side of ['top', 'right', 'bottom', 'left']) document.documentElement.style.setProperty('--island-safe-' + side, probe.safe[side] + 'px');
          document.querySelector('#fixture-root').innerHTML = markup;
          const hud = document.querySelector(kind === 'trial' ? '#trial-hud' : '#activity-hud');
          hud.hidden = false;
          const time = hud.querySelector(kind === 'trial' ? '.trial-time' : '.activity-time');
          time.textContent = kind === 'trial' ? '9999:59.99' : '9999:59';
          if (kind === 'trial') { hud.dataset.offCourse = 'true'; hud.dataset.reducedMotion = 'false'; }
          document.querySelector('#fixture-label').textContent = 'CSS FIXTURE · ' + probe.name + ' · ' + kind + ' · artificial insets/long digits · no game';
        }, {probe, kind, markup: templates[kind] + (kind === 'trial' ? templates.hover : '')});
        const hudSelector = kind === 'trial' ? '#trial-hud' : '#activity-hud';
        const timerSelector = kind === 'trial' ? '.trial-time' : '.activity-time';
        const hud = await bounds(hudSelector, 'fixture:' + probe.name + ':' + kind + ':hud', probe.safe);
        const timer = await bounds(timerSelector, 'fixture:' + probe.name + ':' + kind + ':timer', probe.safe, true);
        for (const button of kind === 'trial' ? ['#trial-restart', '#trial-exit'] : ['#activity-action', '.activity-hud-actions button:last-child']) await target(button, {safe: probe.safe, enabled: false});
        if (kind === 'trial') {
          if (probe.joystickMode === 'fixed') await target('#hover-move-zone', {button: false, quarters: true, safe: probe.safe});
          for (const key of ['ArrowLeft', 'ArrowRight', 'KeyE', 'KeyQ', 'Space']) await target('#hover-hud [data-hold="' + key + '"]', {safe: probe.safe});
          for (const action of ['lights', 'sound']) await target('#hover-hud [data-hover="' + action + '"]', {safe: probe.safe});
          if (probe.width > 600 && probe.height > 520) {
            const settings = await bounds('.hover-lighting', 'fixture:flightSettings', probe.safe);
            assert.ok(settings.left >= hud.right || settings.bottom <= hud.top || settings.top >= hud.bottom, 'Fixture flight settings stay separate from timer HUD');
          }
        }
        const buttons = await page.locator(kind === 'trial' ? '.trial-hud-actions' : '.activity-hud-actions').evaluate(element => {
          const r = element.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
        });
        if (kind === 'trial' && probe.width <= 600 && probe.height > 520) assert.ok(buttons.left - hud.right >= 28, 'Phone HUD retains a clear center corridor');
        fixtureRecord.hud = hud; fixtureRecord.timer = timer;
        if (configuration.mobile && probe.name === 'notched-small-phone') await capture('fixture-' + kind + '-long-timer');
        if (kind === 'trial' && probe.name === 'notched-phone') {
          await page.emulateMedia({reducedMotion: 'reduce'});
          assert.ok((await cueStyle()).every(item => item.animation === 'none'), 'Fixture reduced-motion cue is static');
        }
      }
      assert.equal(entry.cssFixtures.probes.length, probes.reduce((count, probe) => count + (probe.kinds?.length ?? 2), 0));
      assert.deepEqual(entry.errors, [], 'Fixtures must not introduce runtime errors');
      entry.functionalPassed = true;
      log(configuration.name + ': ' + (entry.coverageGaps.length ?
        'Functional checks passed; countdown timing coverage incomplete' : 'Functional checks passed; countdown timing coverage complete'));
    })(), new Promise((_, reject) => { deadline = setTimeout(() => { timedOut = true; reject(new Error('Polish case exceeded the 35-minute bound')); }, limits.caseMilliseconds); })]);
  } catch (error) {
    entry.failure = error.stack || String(error); log(configuration.name + ': FAIL ' + error.message);
    if (page && !timedOut) {
      try { entry.metrics.failureTimeline = await bounded(page.evaluate(() => ({state: window.__polishTrialSnapshot?.(),
        events: window.__polishInput, observerErrors: window.__polishObserverErrors})), 15_000, 'Failure input timeline'); }
      catch (diagnosticError) { entry.failureTimelineError = diagnosticError.message; }
    }
    if (page && !timedOut && !captureFailed) { try { await capture('failure'); } catch {} }
  } finally {
    clearTimeout(deadline);
    if (countdownWaiter) { countdownWaiter.cancelled = true; countdownWaiter = undefined; }
    if (page && !timedOut) {
      try { await bounded(page.evaluate(() => window.__polishRiderObserver?.disconnect()), 5_000, 'Rider observer cleanup'); }
      catch (error) { entry.riderObserverCleanupFailure = error.message; cleanupFailed = true; }
    }
    for (const trigger of [...activeTriggers]) {
      try { await bounded(trigger.release(), 5_000, 'Final native trigger release'); }
      catch (error) { (entry.triggerReleaseFailures ??= []).push(error.message); cleanupFailed = true; }
    }
    for (const input of [...activeHolds]) {
      try { await bounded(input.release(), 5_000, 'Final held-input release'); }
      catch (error) { (entry.inputReleaseFailures ??= []).push(error.message); cleanupFailed = true; }
    }
    if (page && !timedOut && !captureFailed) {
      try { await writeFile(resolve(output, configuration.name + '-dom.html'), await bounded(page.content(), 5_000, 'DOM diagnostic')); } catch (error) { entry.domFailure = error.message; }
    }
    let cleanupFailure;
    if (browser) {
      try { await bounded(browser.close(), limits.closeMilliseconds, 'Browser close'); }
      catch (error) { cleanupFailure = error; entry.cleanupFailure = error.message; cleanupFailed = true; }
    }
    entry.cleanupFailed = cleanupFailed;
    entry.functionalPassed = entry.functionalPassed && !entry.failure && !timedOut && !cleanupFailed;
    entry.verificationComplete = entry.functionalPassed && countdownChecks.every(label => entry.metrics[label]?.timing?.status === 'passed');
    entry.passed = entry.verificationComplete;
    entry.status = entry.functionalPassed ? entry.verificationComplete ? 'passed' : 'inconclusive' : 'failed';
    await writeFile(resolve(output, configuration.name + '-result.json'), JSON.stringify(entry, null, 2));
    if (cleanupFailure) throw cleanupFailure;
  }
}

try {
  assert(selectedCase === undefined || selected.length === 1, 'BELLE_POLISH_BROWSER_CASE must be exactly desktop or phone when set');
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).filter(tag => /\brel=["']stylesheet["']/.test(tag));
  const cssFiles = links.map(tag => tag.match(/\bhref=["']([^"']+)["']/)?.[1]).filter(Boolean);
  assert.ok(cssFiles.length, 'Built stylesheet required for isolated layout probes');
  shippedCss = (await Promise.all(cssFiles.map(file => readFile(resolve(root, '.' + new URL(file, 'http://localhost').pathname), 'utf8')))).join('\n');
  process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = '1';
  const require = createRequire(resolve(game, '../../package.json'));
  const playwright = require('@playwright/test'); chromium = playwright.chromium; expect = playwright.expect.configure({timeout: limits.actionMilliseconds});
  report.playwrightVersion = require('@playwright/test/package.json').version;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = 'http://127.0.0.1:' + server.address().port;
  for (const configuration of selected) await runCase(configuration);
} catch (error) { report.failure = error.stack || String(error); log('FAIL ' + error.message); process.exitCode = 1; }
finally {
  if (server.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  report.functionalPassed = !report.failure && selected.length > 0 && report.cases.length === selected.length && report.cases.every(entry => entry.functionalPassed);
  report.verificationComplete = report.functionalPassed && report.cases.every(entry => entry.verificationComplete);
  report.passed = report.verificationComplete;
  report.status = report.functionalPassed ? report.verificationComplete ? 'passed' : 'inconclusive' : 'failed';
  report.coverageGaps = report.cases.flatMap(entry => entry.coverageGaps.map(gap => ({case: entry.name, ...gap})));
  const timings = report.cases.flatMap(entry => countdownChecks.map(label => entry.metrics[label]?.timing?.status ?? 'not reached'));
  report.countdownCoverage = {expected: selected.length * countdownChecks.length, verified: timings.filter(status => status === 'passed').length,
    inconclusive: timings.filter(status => status === 'inconclusive').length, failed: timings.filter(status => status === 'failed').length,
    notReached: selected.length * countdownChecks.length - timings.filter(status => status !== 'not reached').length};
  const outcome = report.functionalPassed ? report.verificationComplete ? 'Functional checks passed; countdown timing coverage complete' :
    'Functional checks passed; countdown timing coverage incomplete' : 'Functional checks failed';
  log(outcome + ' (' + report.countdownCoverage.verified + ' verified, ' + report.countdownCoverage.inconclusive + ' inconclusive countdown checks)');
  if (!report.functionalPassed) process.exitCode = 1;
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'run.log'), lines.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = ['## Belle Isle polish verification', '', '**' + outcome + '**', '',
      '| Case | Functional checks | Initial countdown input | Restart countdown input | Verification complete |',
      '| --- | --- | --- | --- | --- |',
      ...report.cases.map(entry => '| ' + entry.name + ' | ' + (entry.functionalPassed ? 'Passed' : 'Failed') + ' | ' +
        countdownChecks.map(label => entry.metrics[label]?.timing?.status ?? 'not reached').join(' | ') + ' | ' + (entry.verificationComplete ? 'Yes' : 'No') + ' |'),
      '', 'Countdown checks: **' + report.countdownCoverage.verified + ' verified**, **' + report.countdownCoverage.inconclusive + ' inconclusive**, **' +
        report.countdownCoverage.failed + ' failed**, **' + report.countdownCoverage.notReached + ' not reached**.', '',
      ...report.coverageGaps.map(gap => '- **' + gap.case + ' · ' + gap.check + '**: ' + gap.reason + ' Native delivery followed the observed countdown by ' + gap.latencyMilliseconds.toFixed(1) + 'ms.'),
      '', 'A successful workflow exit means the functional assertions passed. `result.json.passed` remains false whenever countdown timing coverage is incomplete.'];
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }
}