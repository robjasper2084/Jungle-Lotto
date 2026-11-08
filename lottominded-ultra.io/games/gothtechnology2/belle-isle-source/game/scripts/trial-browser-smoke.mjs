/** Real built-game trial smoke. Uses visible controls and trusted input; never seeds a run or record. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';

const game = resolve(import.meta.dirname, '..');
const root = resolve(game, 'dist');
const output = resolve(process.env.BELLE_TRIAL_BROWSER_OUTPUT || resolve(game, 'output/trial-browser'));
await mkdir(output, {recursive: true});
const lines = [];
const log = message => { const line = `${new Date().toISOString()} ${message}`; lines.push(line); console.log(line); };
const headless = process.env.BELLE_TRIAL_BROWSER_HEADED !== '1';
const softwareGpuWatchdogSeconds = 60;
const screenshotTimeoutMilliseconds = 150_000;
const screenshotOuterMilliseconds = 155_000;
const flightResponseMilliseconds = 180_000;
const flightSettlingMilliseconds = 240_000;
const caseTimeoutMilliseconds = 35 * 60_000;
// Software Chromium exited normally after about 17s in CI; retain a finite
// cleanup deadline with room for that observed shutdown cost.
const browserCloseMilliseconds = 30_000;
const caseSelection = process.env.BELLE_TRIAL_BROWSER_CASE;
const configurations = [
  {name: 'desktop-reduced', viewport: {width: 1440, height: 960}, reducedMotion: 'reduce'},
  {name: 'phone', viewport: {width: 390, height: 844}, reducedMotion: 'no-preference', mobile: true},
];
const selectedConfigurations = caseSelection === undefined
  ? configurations
  : configurations.filter(configuration => configuration.name === caseSelection);
const report = {
  startedAt: new Date().toISOString(), passed: false, manualScreenshotReviewRequired: true,
  scope: 'Real WebGL trial menus, controls, movement, pause and restart smoke. Full course finishes, physical devices and performance are not certified by this script.',
  browserIsolation: 'Fresh Chromium process and storage per case',
  browserRuntime: {channel: 'chromium', headless, gpuWatchdogSeconds: softwareGpuWatchdogSeconds},
  caseSelection: caseSelection ?? null, selectedCases: selectedConfigurations.map(configuration => configuration.name),
  limits: {screenshotTimeoutMilliseconds, screenshotOuterMilliseconds, flightResponseMilliseconds, flightSettlingMilliseconds, caseTimeoutMilliseconds, browserCloseMilliseconds},
  screenshotBackend: 'Playwright legacy screenshot of the visible page', cases: [],
};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav'};
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
    return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds / 1000} seconds`)), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

// Observe the real transition before the native action. A slow renderer can
// finish the countdown before Playwright's click/tap promise returns.
function installCountdownObserver(expected) {
  if (window.__trialCountdownObservation) throw new Error('A countdown observer is already armed');
  const hud = document.querySelector('#trial-hud');
  if (!hud) throw new Error('Trial HUD is required before arming countdown');
  const visible = element => !!element && !element.hidden && element.getClientRects().length > 0
    && !['hidden', 'collapse'].includes(getComputedStyle(element).visibility);
  const number = value => value === undefined || value === '' ? null : Number(value);
  const snapshot = () => ({at: performance.now(), visible: visible(hud), visibility: document.visibilityState,
    course: hud.dataset.course, vehicle: hud.dataset.vehicle, status: hud.dataset.status, paused: hud.dataset.paused,
    next: number(hud.dataset.next), elapsed: number(hud.dataset.elapsed), timer: hud.querySelector('.trial-time')?.textContent?.trim()});
  const evidence = {expected, armedAt: performance.now(), before: snapshot(), activation: null, countdown: null,
    samples: [], samplesOmitted: 0, ignoredEvents: [], disconnected: false};
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true; observer.disconnect();
    window.removeEventListener('click', activation, true);
    window.removeEventListener('keydown', activation, true);
    evidence.disconnected = true;
  };
  const activation = event => {
    if (stopped || evidence.activation || event.type !== (expected.trigger === 'key' ? 'keydown' : 'click')) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button');
    const state = snapshot();
    const input = {at: performance.now(), type: event.type, trusted: event.isTrusted, code: event.code,
      repeat: !!event.repeat, modified: !!(event.ctrlKey || event.altKey || event.metaKey), mouseButton: event.button,
      target: target?.id, focused: document.activeElement?.id, buttonId: button?.id, buttonCourse: button?.dataset.course,
      buttonInBoard: !!button?.closest('#trial-board'), buttonVisible: visible(button), buttonDisabled: !!button?.disabled, state};
    const currentCourse = state.visible && state.course === expected.course && state.vehicle === expected.vehicle && state.status === 'running';
    const intended = expected.trigger === 'key'
      ? input.code === 'KeyR' && !input.repeat && !input.modified && input.target === 'game' && input.focused === 'game' && currentCourse
      : input.mouseButton === 0 && input.buttonVisible && !input.buttonDisabled
        && (expected.action === 'start' ? input.buttonInBoard && input.buttonCourse === expected.course
          : input.buttonId === 'trial-restart' && currentCourse);
    if (input.trusted && state.visibility === 'visible' && intended) evidence.activation = input;
    else if (evidence.ignoredEvents.length < 12) evidence.ignoredEvents.push(input);
  };
  const observer = new MutationObserver(() => {
    if (stopped || !evidence.activation) return;
    const state = snapshot();
    if (evidence.samples.length < 12) evidence.samples.push(state); else evidence.samplesOmitted++;
    evidence.last = state;
    if (state.course === expected.course && state.vehicle === expected.vehicle && state.status === 'countdown') {
      evidence.countdown = state; stop();
    }
  });
  window.__trialCountdownObservation = {id: expected.id, evidence, stop};
  window.addEventListener('click', activation, true);
  window.addEventListener('keydown', activation, true);
  observer.observe(hud, {attributes: true, childList: true, characterData: true, subtree: true,
    attributeFilter: ['hidden', 'data-course', 'data-vehicle', 'data-status', 'data-next', 'data-elapsed', 'data-paused']});
  return {armedAt: evidence.armedAt, before: evidence.before};
}

function assertCountdownEvidence(evidence, expected, label) {
  assert.ok(evidence, `${label}: countdown evidence is required`);
  for (const key of ['id', 'action', 'trigger', 'course', 'vehicle']) assert.equal(evidence.expected[key], expected[key], `${label}: matching ${key}`);
  const activation = evidence.activation;
  assert.ok(activation, `${label}: matching native activation was not observed`);
  assert.equal(activation.trusted, true, `${label}: activation must be trusted`);
  assert.equal(activation.state.visibility, 'visible', `${label}: activation occurs on a visible page`);
  assert.equal(activation.type, expected.trigger === 'key' ? 'keydown' : 'click', `${label}: expected native event`);
  if (expected.trigger === 'key') {
    assert.equal(activation.code, 'KeyR'); assert.equal(activation.repeat, false); assert.equal(activation.modified, false);
    assert.equal(activation.target, 'game'); assert.equal(activation.focused, 'game');
  } else {
    assert.equal(activation.mouseButton, 0); assert.equal(activation.buttonVisible, true); assert.equal(activation.buttonDisabled, false);
    if (expected.action === 'start') {
      assert.equal(activation.buttonInBoard, true); assert.equal(activation.buttonCourse, expected.course);
    } else assert.equal(activation.buttonId, 'trial-restart');
  }
  if (expected.action === 'restart') {
    assert.equal(activation.state.visible, true); assert.equal(activation.state.course, expected.course);
    assert.equal(activation.state.vehicle, expected.vehicle); assert.equal(activation.state.status, 'running');
  }
  const state = evidence.countdown;
  assert.ok(state, `${label}: post-activation countdown was not observed`);
  assert.ok(Number.isFinite(evidence.armedAt) && Number.isFinite(activation.at) && Number.isFinite(state.at)
    && activation.at >= evidence.armedAt && state.at >= activation.at, `${label}: countdown follows the armed native activation`);
  assert.equal(state.visible, true, `${label}: countdown HUD is visible`);
  assert.equal(state.visibility, 'visible', `${label}: countdown page is visible`);
  assert.equal(state.course, expected.course); assert.equal(state.vehicle, expected.vehicle);
  assert.equal(state.status, 'countdown'); assert.equal(state.next, 0, `${label}: gate resets`);
  assert.equal(state.elapsed, 0, `${label}: elapsed resets`); assert.equal(state.timer, '0:00.00', `${label}: timer resets`);
}

const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));

let chromium;
let expect;
let origin;

async function runCase(configuration) {
  const setupViewport = {width: 390, height: 844};
  const entry = {name: configuration.name, viewport: configuration.viewport, setupViewport, reducedMotion: configuration.reducedMotion,
    passed: false, errors: [], console: [], failedRequests: [], screenshots: [], metrics: {}, fullCourseCompletion: 'not exercised'};
  report.cases.push(entry);
  let browser, page, touchSession, deadline;
  let screenshotFailed = false, caseTimedOut = false, observerCleanupFailed = false;
  let countdownSequence = 0, countdownObservation;
  const tap = locator => configuration.mobile ? locator.tap() : locator.click();
  const hud = () => page.locator('#trial-hud');
  const elapsed = async () => Number(await hud().getAttribute('data-elapsed'));
  const speed = async selector => Number.parseFloat(await page.locator(selector).textContent());

  const stopCountdownObservation = async observation => {
    if (!observation) return;
    try {
      const evidence = await bounded(page.evaluate(id => {
        const observation = window.__trialCountdownObservation;
        if (!observation || observation.id !== id) return null;
        observation.stop(); delete window.__trialCountdownObservation;
        return observation.evidence;
      }, observation.id), 5_000, 'Countdown observer cleanup');
      if (evidence) observation.record.evidence = evidence;
    } catch (error) {
      observerCleanupFailed = true; observation.record.status = 'failed'; observation.record.cleanupFailure = error.message;
      entry.countdownObserverCleanupFailure = error.message; throw error;
    } finally { if (countdownObservation === observation) countdownObservation = undefined; }
  };
  const observeCountdown = async (request, trigger) => {
    assert.equal(countdownObservation, undefined, 'Only one countdown observation may be armed');
    const expected = {...request, id: ++countdownSequence};
    const label = `${request.action} ${request.course}`;
    const record = {label, expected, status: 'observing'};
    (entry.metrics.countdownTransitions ??= []).push(record);
    const observation = countdownObservation = {id: expected.id, record};
    try {
      record.arm = await page.evaluate(installCountdownObserver, expected);
      record.triggerQueuedAt = new Date().toISOString();
      await trigger(); record.triggerCompletedAt = new Date().toISOString();
      await page.waitForFunction(id => window.__trialCountdownObservation?.id === id
        && !!window.__trialCountdownObservation.evidence.countdown, expected.id, {timeout: 90_000});
      record.evidence = await page.evaluate(() => window.__trialCountdownObservation?.evidence);
      assertCountdownEvidence(record.evidence, expected, label);
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed'; record.failure = error.stack || String(error); throw error;
    } finally { await stopCountdownObservation(observation); }
  };

  const screenshot = async name => {
    const filename = `${configuration.name}-${name}.png`;
    const began = Date.now();
    const timing = {startedAt: new Date(began).toISOString(), status: 'capturing'};
    (entry.metrics.captureTimings ??= {})[name] = timing;
    log(`${configuration.name}: capture ${name} at ${page.viewportSize().width}×${page.viewportSize().height}`);
    try {
      // The previous software run captured a frame in 88.7s, then reached the
      // 90s capture limit without a context loss or browser crash. Keep a finite
      // deadline with room for that observed cost; preserve the real viewport.
      await bounded(page.screenshot({path: resolve(output, filename), timeout: screenshotTimeoutMilliseconds}), screenshotOuterMilliseconds, `${configuration.name}: screenshot ${name}`);
      timing.status = 'saved';
    } catch (error) { timing.status = 'failed'; screenshotFailed = true; entry.screenshotFailure = error.message; throw error; }
    finally { timing.milliseconds = Date.now() - began; }
    entry.screenshots.push(filename);
    log(`${configuration.name}: captured ${name} in ${timing.milliseconds}ms`);
  };
  const layout = async (selector, label = selector) => {
    const dimensions = await page.locator(selector).evaluate(element => {
      const r = element.getBoundingClientRect();
      return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, viewportWidth: innerWidth, viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth};
    });
    entry.metrics[label] = dimensions;
    assert.ok(dimensions.documentWidth <= dimensions.viewportWidth + 1, `${label}: document must fit horizontally`);
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label}: content must fit horizontally`);
    assert.ok(dimensions.left >= -1 && dimensions.right <= dimensions.viewportWidth + 1, `${label}: horizontal bounds`);
    assert.ok(dimensions.top >= -1 && dimensions.bottom <= dimensions.viewportHeight + 1, `${label}: vertical bounds`);
    return dimensions;
  };
  const touchTarget = async (selector, label = selector, button = true) => {
    const locator = page.locator(selector);
    await expect(locator).toBeVisible();
    if (button) await expect(locator).toBeEnabled();
    const dimensions = await layout(selector, label);
    if (button) assert.ok(dimensions.width >= 44 && dimensions.height >= 44, `${label}: usable touch target`);
    const hit = await locator.evaluate((element, inspectQuarters) => {
      const r = element.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const points = [{name: 'center', x, y}];
      if (inspectQuarters) points.push(
        {name: 'left quarter', x: r.left + r.width / 4, y},
        {name: 'right quarter', x: r.left + r.width * .75, y},
        {name: 'top quarter', x, y: r.top + r.height / 4},
        {name: 'bottom quarter', x, y: r.top + r.height * .75},
      );
      return {x, y, samples: points.map(point => {
        const target = document.elementFromPoint(point.x, point.y);
        return {...point, receives: !!target && (target === element || element.contains(target)), covering: target?.id || target?.className || target?.tagName};
      })};
    }, button);
    entry.metrics[`${label}:hitTargets`] = hit.samples;
    for (const sample of hit.samples) assert.ok(sample.receives, `${label}: ${sample.name} covered by ${sample.covering}`);
    return {x: hit.x, y: hit.y};
  };
  const holdTouch = async (selector, during, {button = true, moveUp = false} = {}) => {
    const point = await touchTarget(selector, selector, button);
    try {
      await touchSession.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y, id: 1}]});
      if (moveUp) await touchSession.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x, y: point.y - 55, id: 1}]});
      await during();
    } finally { await touchSession.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); }
  };
  const holdKey = async (key, during) => {
    await page.locator('#game').focus();
    await page.keyboard.down(key);
    try { await during(); } finally { await page.keyboard.up(key); }
  };
  const readFlight = () => page.locator('#hover-hud').evaluate(element => {
    const trial = document.querySelector('#trial-hud');
    return {
      observedAt: new Date().toISOString(), altitude: Number.parseFloat(element.querySelector('#hover-altitude')?.textContent ?? ''),
      elapsed: Number(trial?.dataset.elapsed), status: trial?.dataset.status, paused: trial?.dataset.paused,
      mode: element.querySelector('#hover-mode')?.textContent,
      heldKeys: [...element.querySelectorAll('[data-held="true"]')].map(button => button.dataset.hold).filter(Boolean),
      frameDiagnostic: document.querySelector('#profile')?.textContent,
      renderDiagnostics: {...document.querySelector('#profile')?.dataset},
    };
  });
  const observeFlight = async (name, predicate, {timeout = flightResponseMilliseconds, heldKey} = {}) => {
    const began = Date.now();
    const diagnostic = {startedAt: new Date(began).toISOString(), timeoutMilliseconds: timeout, polls: 0, samples: []};
    (entry.metrics.flightObservations ??= {})[name] = diagnostic;
    let sample;
    log(`${configuration.name}: observe flight ${name} with ${timeout / 1000}s bound`);
    try {
      await expect.poll(async () => {
        sample = await readFlight(); diagnostic.polls++; diagnostic.last = sample;
        assert.ok(Number.isFinite(sample.altitude) && Number.isFinite(sample.elapsed), `${name}: finite flight HUD readings required`);
        assert.equal(sample.status, 'running', `${name}: trial must remain running`);
        assert.equal(sample.paused, 'false', `${name}: trial must remain unpaused`);
        assert.equal(sample.mode, 'ALTITUDE HOLD', `${name}: standardized flight mode must remain active`);
        if (heldKey) assert.ok(sample.heldKeys.includes(heldKey), `${name}: real touch must remain held`);
        if (diagnostic.samples.at(-1)?.elapsed !== sample.elapsed) {
          diagnostic.samples.push(sample);
          if (diagnostic.samples.length > 80) diagnostic.samples.shift();
        }
        return predicate(sample, diagnostic.samples);
      }, {timeout, intervals: [500, 1000, 1500, 2000], message: `${name}: observe the real flight response`}).toBe(true);
      diagnostic.passed = true;
      return sample;
    } catch (error) { diagnostic.passed = false; diagnostic.failure = error.message; throw error; }
    finally {
      diagnostic.milliseconds = Date.now() - began;
      log(`${configuration.name}: flight ${name} ${diagnostic.passed ? 'passed' : 'failed'} after ${diagnostic.milliseconds}ms; ${diagnostic.samples.length} distinct HUD updates; last altitude ${sample?.altitude}; ${sample?.frameDiagnostic ?? 'no frame diagnostic'}`);
    }
  };
  const webgl = async label => {
    entry.metrics[label] = await page.locator('#game').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw new Error('A live WebGL2 scene is required.');
      return {version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), width: canvas.width, height: canvas.height, cssWidth: innerWidth, cssHeight: innerHeight, devicePixelRatio};
    });
  };
  const resize = async viewport => {
    await page.setViewportSize(viewport);
    await page.waitForFunction(({width, height}) => innerWidth === width && innerHeight === height
      && document.querySelector('#game')?.width === width && document.querySelector('#game')?.height === height, viewport);
  };
  const openBoard = async () => {
    await tap(page.locator('#tools-toggle'));
    await tap(page.locator('#trials-open'));
    await expect(page.locator('#trial-board')).toBeVisible();
    await layout('#trial-board');
  };
  const inspectCatalog = async vehicle => {
    const cards = page.locator('#trial-course-list .trial-course');
    await expect(cards).toHaveCount(vehicle === 'hoverbike' ? 4 : 5);
    if (vehicle === 'onewheel') {
      const gp = page.locator('#trial-course-list .trial-course[data-category="grandprix"]');
      await expect(gp).toHaveCount(2);
      const ids = await gp.locator('button[data-course]').evaluateAll(buttons => buttons.map(button => button.dataset.course));
      assert.deepEqual(ids, ['onewheel-belle-heritage-qualifier-v1', 'onewheel-belle-heritage-3lap-v1']);
      await expect(page.locator('.trial-heritage > summary')).toContainText('Grand Prix');
    }
    const featured = page.locator('#trial-course-list > .trial-course[data-category="island"]');
    await expect(featured).toHaveCount(2);
    const routes = await featured.evaluateAll(elements => elements.map(element => ({
      id: element.querySelector('button[data-course]').dataset.course,
      name: element.querySelector('h3').textContent,
      metrics: element.querySelector('.trial-course-meta').textContent,
      guide: element.querySelector('.trial-course-pace')?.textContent
    })));
    assert.equal(new Set(routes.map(route => route.id)).size, 2, 'Two independent full-island course identities');
    for (const route of routes) {
      assert.match(route.metrics, /FULL ISLAND · ONE LAP/);
      assert.ok(Number(route.metrics.match(/([\d.]+) km/)?.[1]) >= 8, `${route.name} is a substantial full-island circuit`);
      assert.match(route.guide, /Pace guide/);
    }
    (entry.metrics.courseCatalog ??= {})[vehicle] = routes;
    await expect(page.locator('#trial-practice')).not.toHaveAttribute('open');
    await expect(page.locator('#trial-practice > summary')).toContainText('Practice sprints');
    return routes[0].id;
  };
  const startCourse = async (id, vehicle) => {
    log(`${configuration.name}: start ${id} through its course button`);
    await observeCountdown({action: 'start', trigger: 'button', course: id, vehicle},
      () => tap(page.locator(`#trial-board button[data-course="${id}"]`)));
    await expect(hud()).toBeVisible();
    await expect(hud()).toHaveAttribute('data-course', id);
    await expect(hud()).toHaveAttribute('data-vehicle', vehicle);
    await expect(hud()).toHaveAttribute('data-status', 'running');
    await expect(page.locator('body')).toHaveClass(/island-trial/);
    await expect(hud()).toHaveAttribute('data-ghosts', 'on');
    await expect(hud()).toHaveAttribute('data-ghost-tracks', '1');
    await expect(hud()).toHaveAttribute('data-recorded-ghost', 'none');
  };
  const restart = async keyboard => {
    log(`${configuration.name}: restart using ${keyboard ? 'R' : 'the visible button'}`);
    if (keyboard) await page.locator('#game').focus();
    const current = await hud().evaluate(element => ({course: element.dataset.course, vehicle: element.dataset.vehicle}));
    assert.ok(current.course && current.vehicle, 'Restart requires an active course identity');
    await observeCountdown({action: 'restart', trigger: keyboard ? 'key' : 'button', ...current},
      () => keyboard ? page.keyboard.press('r') : tap(page.locator('#trial-restart')));
    await expect(hud()).toHaveAttribute('data-status', 'running');
  };
  const freezeCheck = async menu => {
    if (menu) {
      await tap(page.locator('#tools-toggle'));
      await expect(page.locator('#ride-menu')).toBeVisible();
    } else { await tap(page.locator('#pause')); await expect(page.locator('#pause')).toHaveText('Resume'); }
    await expect(hud()).toHaveAttribute('data-paused', 'true');
    const before = await elapsed();
    const ghostsBefore = await hud().getAttribute('data-ghost-state');
    // This intentional observation interval proves the active clock is frozen.
    await delay(850);
    assert.equal(await elapsed(), before, `${menu ? 'menu' : 'pause'} must freeze trial time`);
    assert.equal(await hud().getAttribute('data-ghost-state'), ghostsBefore, 'Visible ghost transforms freeze on the race clock');
    entry.metrics[menu ? 'menuPauseSeconds' : 'pauseSeconds'] = before;
    if (menu) {
      if (configuration.mobile) await tap(page.locator('[data-close="ride-menu"]'));
      else await page.keyboard.press('Escape');
      await expect(page.locator('#ride-menu')).not.toBeVisible();
    } else { await tap(page.locator('#pause')); await expect(page.locator('#pause')).toHaveText('Pause'); }
    await expect(hud()).toHaveAttribute('data-paused', 'false');
  };
  const leave = async () => {
    await tap(page.locator('#trial-exit'));
    await expect(page.locator('body')).not.toHaveClass(/island-trial/);
    await expect(hud()).not.toBeVisible();
    await expect(page.locator('#hover-enter')).toBeEnabled();
  };

  try {
    log(`${configuration.name}: launch fresh Chromium ${headless ? 'headless' : 'windowed'}`);
    browser = await chromium.launch({channel: 'chromium', headless, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--gpu-watchdog-timeout-seconds=${softwareGpuWatchdogSeconds}`]});
    entry.metrics.browserVersion = browser.version();
    const context = await browser.newContext({viewport: setupViewport, deviceScaleFactor: 1, reducedMotion: configuration.reducedMotion, isMobile: !!configuration.mobile, hasTouch: !!configuration.mobile});
    page = await context.newPage();
    if (configuration.mobile) touchSession = await context.newCDPSession(page);
    page.setDefaultTimeout(90_000);
    page.on('pageerror', error => { entry.errors.push(error.message); log(`${configuration.name}: page error ${error.message}`); });
    page.on('console', message => {
      const event = {at: new Date().toISOString(), type: message.type(), text: message.text(), location: message.location()};
      entry.console.push(event);
      const contextLost = /(?:webgl|renderer).*context\s*(?:was\s*)?lost|context[_ -]?lost/i.test(event.text);
      if (event.type === 'error' || contextLost) entry.errors.push(`console: ${event.text}`);
      if (event.type === 'error' || contextLost) log(`${configuration.name}: browser console ${event.text}`);
    });
    page.on('response', response => { if (response.status() >= 400) entry.errors.push(`HTTP ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      const message = `${request.failure()?.errorText} ${request.url()}`;
      entry.failedRequests.push(message);
      if (!message.startsWith('net::ERR_ABORTED')) entry.errors.push(message);
    });
    await Promise.race([(async () => {
      log(`${configuration.name}: load real built game and configure graphics through UI`);
      await page.goto(origin + '/', {waitUntil: 'domcontentloaded', timeout: 30_000});
      await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#welcome')?.dataset.state), null, {timeout: 180_000});
      await expect(page.locator('#welcome')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('.trial-welcome')).toHaveCount(2);
      await expect(page.locator('.trial-welcome').first()).toBeEnabled();
      await webgl('startupWebgl');
      if (configuration.reducedMotion === 'reduce') {
        await expect(page.locator('#welcome')).toHaveClass(/motion-off/);
        await expect(page.locator('#motion')).toBeChecked();
      }
      if (await page.locator('#startup-motion').getAttribute('aria-pressed') !== 'true') await tap(page.locator('#startup-motion'));
      await tap(page.locator('.cinema-ride-picker > summary'));
      await tap(page.locator('.ride-options label').filter({hasText: 'One wheel'}));
      await expect(page.locator('input[name="startup-vehicle"][value="onewheel"]')).toBeChecked();
      await tap(page.getByRole('button', {name: 'Use this ride', exact: true}));
      await tap(page.locator('#start'));
      await expect(page.locator('body')).not.toHaveClass(/at-start/);
      await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
      await expect(page.locator('.ride-preview-canvas')).toHaveCount(0);
      await tap(page.locator('#tools-toggle'));
      await tap(page.locator('#settings-open'));
      await page.locator('#quality').selectOption('smooth');
      await page.locator('#fps').selectOption('30');
      await tap(page.locator('[data-close="settings"]'));
      await resize(configuration.viewport);
      await webgl('configuredWebgl');
      entry.metrics.graphics = {quality: await page.locator('#quality').inputValue(), fps: await page.locator('#fps').inputValue(), initialRide: 'One wheel selected through startup picker'};

      await openBoard();
      await inspectCatalog('hoverbike');
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(Array(4).fill('Set the first time'));
      await expect(page.locator('#trial-ghost-toggle')).toHaveAttribute('aria-pressed', 'true');
      await tap(page.locator('#trial-ghost-toggle'));
      await expect(page.locator('#trial-ghost-toggle')).toHaveAttribute('aria-pressed', 'false');
      assert.equal(await page.evaluate(() => localStorage.getItem('belle-isle-ghost-visibility-v1')), 'off');
      await tap(page.locator('#trial-ghost-toggle'));
      await expect(page.locator('#trial-ghost-toggle')).toHaveAttribute('aria-pressed', 'true');
      await screenshot('sky-course-board');
      if (!configuration.mobile) {
        await page.locator('#trial-tab-hoverbike').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#trial-tab-onewheel')).toBeFocused();
        const focus = await page.locator('#trial-tab-onewheel').evaluate(element => ({outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth, animation: getComputedStyle(element).animationName, transition: getComputedStyle(element).transitionDuration}));
        assert.equal(focus.outline, 'solid'); assert.equal(focus.width, '3px');
        assert.equal(focus.animation, 'none'); assert.equal(focus.transition, '0s');
      } else await tap(page.locator('#trial-tab-onewheel'));
      await expect(page.locator('#trial-tab-onewheel')).toHaveAttribute('aria-selected', 'true');
      const wheelCourse = await inspectCatalog('onewheel');
      await startCourse(wheelCourse, 'onewheel');
      await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
      await expect(page.locator('#mount')).toBeDisabled();
      const observeWheel = async () => { await expect.poll(() => speed('#speed')).toBeGreaterThan(0); entry.metrics.wheelMovingKmh = await speed('#speed'); };
      if (configuration.mobile) await holdTouch('#touch-zone', observeWheel, {button: false, moveUp: true});
      else await holdKey('w', observeWheel);
      await expect.poll(elapsed).toBeGreaterThan(0);
      await freezeCheck(false);
      await freezeCheck(true);
      await restart(!configuration.mobile);
      await expect.poll(() => speed('#speed')).toBe(0);
      await layout('#trial-hud', 'wheelHud');
      await layout('#trial-restart', 'wheelRestart');
      await layout('#trial-exit', 'wheelLeave');
      await screenshot('wheel-route');
      await leave();

      await openBoard();
      await tap(page.locator('#trial-tab-hoverbike'));
      const skyCourse = await inspectCatalog('hoverbike');
      await expect(page.locator('#trial-ghost-toggle')).toHaveAttribute('aria-pressed', 'true');
      await startCourse(skyCourse, 'hoverbike');
      await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
      await expect(page.locator('#hover-flight-mode')).toHaveValue('drone');
      await expect(page.locator('#hover-flight-mode')).toBeDisabled();
      await expect(page.locator('#hover-hud [data-hover="takeoff"]')).toBeDisabled();
      await expect(page.locator('#hover-hud [data-hover="exit"]')).toBeDisabled();
      await expect(page.locator('#hover-mode')).toHaveText('ALTITUDE HOLD');
      await expect(page.locator('#trial-hud .trial-altitude')).toContainText('Altitude');
      const observeHover = async () => { await expect.poll(() => speed('#hover-speed')).toBeGreaterThan(0); entry.metrics.hoverMovingKmh = await speed('#hover-speed'); };
      if (configuration.mobile) {
        await holdTouch('#hover-move-zone', observeHover, {button: false, moveUp: true});
        await holdTouch('#hover-hud [data-hold="Space"]', async () => { await expect.poll(() => speed('#hover-speed')).toBeLessThanOrEqual(1); });
        for (const key of ['ArrowLeft', 'ArrowRight']) {
          await holdTouch(`#hover-hud [data-hold="${key}"]`, async () => { await expect(page.locator(`#hover-hud [data-hold="${key}"]`)).toHaveAttribute('data-held', 'true'); });
          await expect(page.locator(`#hover-hud [data-hold="${key}"]`)).not.toHaveAttribute('data-held');
        }
        const motion = entry.metrics.hoverTouch = {initialAltitude: await speed('#hover-altitude'),
          yawButtons: 'pressed and released through trusted touch input', throttleAndBrake: 'movement and braking observed'};
        await holdTouch('#hover-hud [data-hold="KeyE"]', async () => {
          await expect(page.locator('#hover-hud [data-hold="KeyE"]')).toHaveAttribute('data-held', 'true');
          const raised = await observeFlight('ascent', sample => sample.altitude > motion.initialAltitude + .1, {heldKey: 'KeyE'});
          motion.raisedAltitude = raised.altitude;
        });
        await expect(page.locator('#hover-hud [data-hold="KeyE"]')).not.toHaveAttribute('data-held');
        // Lift changes target clearance; the spring-driven vertical velocity
        // persists after release. At the observed ~6.5s software frames, each
        // physics step is still capped at .05s and the altitude HUD updates only
        // each .1 simulation seconds. Repeated reads of one rendered value do
        // not prove settling: require distinct active-clock HUD updates first.
        const settled = await observeFlight('neutral-after-ascent', (sample, samples) => {
          assert.ok(!sample.heldKeys.includes('KeyE') && !sample.heldKeys.includes('KeyQ'), 'settling requires released lift controls');
          if (samples.length < 8) return false;
          const recent = samples.slice(-6).map(value => value.altitude);
          return Math.max(...recent) - Math.min(...recent) <= .1 + 1e-9;
        }, {timeout: flightSettlingMilliseconds});
        motion.settledAltitude = settled.altitude;
        await holdTouch('#hover-hud [data-hold="KeyQ"]', async () => {
          await expect(page.locator('#hover-hud [data-hold="KeyQ"]')).toHaveAttribute('data-held', 'true');
          const lowered = await observeFlight('descent', sample => sample.altitude < motion.settledAltitude - .1, {heldKey: 'KeyQ'});
          motion.loweredAltitude = lowered.altitude;
        });
        await expect(page.locator('#hover-hud [data-hold="KeyQ"]')).not.toHaveAttribute('data-held');
      } else {
        await holdKey('w', observeHover);
        await holdKey('Space', async () => { await expect.poll(() => speed('#hover-speed')).toBeLessThanOrEqual(1); });
        await page.locator('#game').focus();
        for (const key of ['b', 'f', 'g']) await page.keyboard.press(key);
        await expect(hud()).toHaveAttribute('data-status', 'running');
        await expect(page.locator('body')).toHaveClass(/on-hoverbike/);
        await expect(page.locator('#hover-mode')).toHaveText('ALTITUDE HOLD');
        entry.metrics.vehicleLockKeys = 'B/F/G retain the course hoverbike and flight mode';
      }
      await layout('#trial-hud', 'skyHud');
      await screenshot('sky-route');
      if (configuration.mobile) {
        const landscape = {width: 844, height: 390};
        log(`${configuration.name}: verify short landscape controls at 844×390`);
        await resize(landscape);
        await layout('#trial-hud', 'landscapeHud');
        for (const selector of ['#trial-restart', '#trial-exit', '#hover-hud [data-hold="ArrowLeft"]', '#hover-hud [data-hold="ArrowRight"]', '#hover-hud [data-hold="KeyE"]', '#hover-hud [data-hold="KeyQ"]', '#hover-hud [data-hold="Space"]']) {
          await touchTarget(selector, `landscape:${selector}`);
        }
        await touchTarget('#hover-move-zone', 'landscape:hover-move-zone', false);
        await screenshot('sky-landscape');
      }
      await restart(false);
      await expect(page.locator('#hover-speed')).toHaveText('0');
      await leave();
      await expect(page.locator('#hover-flight-mode')).toBeEnabled();
      await openBoard();
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(Array(4).fill('Set the first time'));
      await tap(page.locator('#trial-practice > summary'));
      await expect(page.locator('#trial-board button[data-course="sky-bridge-v1"]')).toBeVisible();
      await expect(page.locator('#trial-board button[data-course="sky-sunset-v1"]')).toBeVisible();
      await tap(page.locator('#trial-tab-onewheel'));
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(Array(5).fill('Set the first time'));
       await expect(page.locator('#trial-course-list .trial-course[data-category="grandprix"]')).toHaveCount(2);
       await expect(page.locator('#trial-course-list .trial-course[data-category="grandprix"] button[data-course="onewheel-belle-heritage-qualifier-v1"]')).toHaveCount(1);
       await expect(page.locator('#trial-course-list .trial-course[data-category="grandprix"] button[data-course="onewheel-belle-heritage-3lap-v1"]')).toHaveCount(1);
      await tap(page.locator('#trial-board').getByRole('button', {name: 'Back to island', exact: true}));
      // Exercise the actual Automatic UI and observe its read-only feedback.
      // This is software-rendered behavior evidence, not a device FPS benchmark.
      await tap(page.locator('#tools-toggle'));
      await tap(page.locator('#settings-open'));
      await page.locator('#quality').selectOption('automatic');
      await tap(page.locator('[data-close="settings"]'));
      await page.locator('#game').focus();
      await expect(page.locator('#profile')).toHaveAttribute('data-quality', 'automatic');
      const automatic = {samples: [], actualPerformanceCertified: false};
      entry.metrics.automaticGraphics = automatic;
      const automaticBegan = Date.now();
      while (Date.now() - automaticBegan < 60_000) {
        const sample = await page.locator('#profile').evaluate(element => ({...element.dataset}));
        if (automatic.samples.at(-1)?.activeFrames !== sample.activeFrames) automatic.samples.push(sample);
        if (Number(sample.adaptiveScale) <= .75) {
          assert.equal(sample.effectiveQuality, 'smooth', 'Automatic low resolution also applies the lighter world effects');
          automatic.observedFallback = true;
          break;
        }
        if (automatic.samples.length >= 12) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      assert(automatic.samples.length > 0, 'Automatic graphics feedback remains readable');
      automatic.note = automatic.observedFallback ? 'Automatic selected lighter world effects under observed CI frame pressure.' : 'No low-budget transition observed within this bounded sample; deterministic pressure tests cover fallback.';
      await tap(page.locator('#tools-toggle'));
      await tap(page.locator('#settings-open'));
      await page.locator('#quality').selectOption('smooth');
      await tap(page.locator('[data-close="settings"]'));
      await expect(page.locator('#profile')).toHaveAttribute('data-effective-quality', 'smooth');
      entry.metrics.savedGraphics = await page.evaluate(() => JSON.parse(localStorage.getItem('belle-graphics-v1')));
      assert.deepEqual(entry.metrics.savedGraphics, {quality: 'smooth', cap: 30});
      await webgl('finalWebgl');
      assert.deepEqual(entry.errors, [], 'Browser errors, lost WebGL contexts or missing runtime assets fail this smoke');
      entry.passed = true;
      log(`${configuration.name}: trial controls, movement, pause, restart and leave passed`);
    })(), new Promise((_, reject) => { deadline = setTimeout(() => { caseTimedOut = true; reject(new Error('Trial browser case exceeded the thirty-five-minute bound')); }, caseTimeoutMilliseconds); })]);
  } catch (error) {
    entry.failure = error.stack || String(error);
    log(`${configuration.name}: FAIL ${error.message}`);
    if (page && !screenshotFailed && !caseTimedOut) { try { await screenshot('failure'); } catch {} }
  } finally {
    clearTimeout(deadline);
    if (countdownObservation) {
      try { await stopCountdownObservation(countdownObservation); }
      catch { entry.passed = false; }
    }
    if (page) {
      entry.lastUrl = page.url();
      if (!screenshotFailed && !caseTimedOut) {
        try { await writeFile(resolve(output, `${configuration.name}-dom.html`), await bounded(page.content(), 5_000, `${configuration.name}: DOM diagnostic`)); }
        catch (error) { entry.domCaptureFailure = error.message; }
      } else entry.domCaptureSkipped = 'Close the stalled browser without another renderer request.';
    }
    let cleanupFailure;
    if (browser) {
      try { await bounded(browser.close(), browserCloseMilliseconds, `${configuration.name}: browser close`); }
      catch (error) { cleanupFailure = error; entry.cleanupFailure = error.message; entry.passed = false; }
    }
    // A timed-out body may finish while cleanup is awaited. Failures stay final.
    entry.passed = entry.passed && !entry.failure && !caseTimedOut && !cleanupFailure && !observerCleanupFailed;
    await writeFile(resolve(output, `${configuration.name}-result.json`), JSON.stringify(entry, null, 2));
    if (cleanupFailure) throw cleanupFailure;
  }
}

try {
  assert(caseSelection === undefined || selectedConfigurations.length === 1,
    'BELLE_TRIAL_BROWSER_CASE must be exactly desktop-reduced or phone when set');
  await stat(resolve(root, 'index.html'));
  process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = '1';
  const require = createRequire(resolve(game, '../../package.json'));
  const playwright = require('@playwright/test');
  chromium = playwright.chromium;
  expect = playwright.expect.configure({timeout: 90_000});
  report.playwrightVersion = require('@playwright/test/package.json').version;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`; report.origin = origin;
  for (const configuration of selectedConfigurations) await runCase(configuration);
  report.passed = report.cases.length === selectedConfigurations.length && report.cases.every(entry => entry.passed && !entry.failure && !entry.cleanupFailure && !entry.countdownObserverCleanupFailure);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = error.stack || String(error); log(`FAIL ${error.message}`); process.exitCode = 1;
} finally {
  if (server.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'run.log'), lines.join('\n') + '\n');
}
