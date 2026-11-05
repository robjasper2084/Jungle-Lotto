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
const report = {
  startedAt: new Date().toISOString(), passed: false, manualScreenshotReviewRequired: true,
  scope: 'Real WebGL trial menus, controls, movement, pause and restart smoke. Full course finishes, physical devices and performance are not certified by this script.',
  browserIsolation: 'Fresh Chromium process and storage per case',
  browserRuntime: {channel: 'chromium', headless, gpuWatchdogSeconds: softwareGpuWatchdogSeconds},
  limits: {screenshotTimeoutMilliseconds, screenshotOuterMilliseconds, flightResponseMilliseconds, flightSettlingMilliseconds, caseTimeoutMilliseconds},
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
  let screenshotFailed = false, caseTimedOut = false;
  const tap = locator => configuration.mobile ? locator.tap() : locator.click();
  const hud = () => page.locator('#trial-hud');
  const elapsed = async () => Number(await hud().getAttribute('data-elapsed'));
  const speed = async selector => Number.parseFloat(await page.locator(selector).textContent());

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
  const startCourse = async (id, vehicle) => {
    log(`${configuration.name}: start ${id} through its course button`);
    await tap(page.locator(`#trial-board button[data-course="${id}"]`));
    await expect(hud()).toBeVisible();
    await expect(hud()).toHaveAttribute('data-course', id);
    await expect(hud()).toHaveAttribute('data-vehicle', vehicle);
    await expect(hud()).toHaveAttribute('data-status', 'countdown');
    await expect(hud()).toHaveAttribute('data-next', '0');
    assert.equal(await elapsed(), 0);
    await expect(hud()).toHaveAttribute('data-status', 'running');
    await expect(page.locator('body')).toHaveClass(/island-trial/);
  };
  const restart = async keyboard => {
    log(`${configuration.name}: restart using ${keyboard ? 'R' : 'the visible button'}`);
    if (keyboard) { await page.locator('#game').focus(); await page.keyboard.press('r'); }
    else await tap(page.locator('#trial-restart'));
    await expect(hud()).toHaveAttribute('data-status', 'countdown');
    await expect(hud()).toHaveAttribute('data-next', '0');
    assert.equal(await elapsed(), 0, 'restart must reset elapsed time');
    await expect(page.locator('#trial-hud .trial-time')).toHaveText('0:00.00');
    await expect(hud()).toHaveAttribute('data-status', 'running');
  };
  const freezeCheck = async menu => {
    if (menu) {
      await tap(page.locator('#tools-toggle'));
      await expect(page.locator('#ride-menu')).toBeVisible();
    } else { await tap(page.locator('#pause')); await expect(page.locator('#pause')).toHaveText('Resume'); }
    await expect(hud()).toHaveAttribute('data-paused', 'true');
    const before = await elapsed();
    // This intentional observation interval proves the active clock is frozen.
    await delay(850);
    assert.equal(await elapsed(), before, `${menu ? 'menu' : 'pause'} must freeze trial time`);
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
      await expect(page.locator('#trial-course-list .trial-course')).toHaveCount(2);
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(['Set the first time', 'Set the first time']);
      if (!configuration.mobile) {
        await screenshot('sky-course-board');
        await page.locator('#trial-tab-hoverbike').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#trial-tab-onewheel')).toBeFocused();
        const focus = await page.locator('#trial-tab-onewheel').evaluate(element => ({outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth, animation: getComputedStyle(element).animationName, transition: getComputedStyle(element).transitionDuration}));
        assert.equal(focus.outline, 'solid'); assert.equal(focus.width, '3px');
        assert.equal(focus.animation, 'none'); assert.equal(focus.transition, '0s');
      } else await tap(page.locator('#trial-tab-onewheel'));
      await expect(page.locator('#trial-tab-onewheel')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#trial-course-list .trial-course')).toHaveCount(1);
      await startCourse('onewheel-island-cup-v1', 'onewheel');
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
      await expect(page.locator('#trial-course-list .trial-course')).toHaveCount(2);
      await startCourse('sky-bridge-v1', 'hoverbike');
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
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(['Set the first time', 'Set the first time']);
      await tap(page.locator('#trial-tab-onewheel'));
      await expect(page.locator('#trial-course-list .trial-course-record strong')).toHaveText(['Set the first time']);
      await tap(page.locator('#trial-board').getByRole('button', {name: 'Back to island', exact: true}));
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
    if (page) {
      entry.lastUrl = page.url();
      if (!screenshotFailed && !caseTimedOut) {
        try { await writeFile(resolve(output, `${configuration.name}-dom.html`), await bounded(page.content(), 5_000, `${configuration.name}: DOM diagnostic`)); }
        catch (error) { entry.domCaptureFailure = error.message; }
      } else entry.domCaptureSkipped = 'Close the stalled browser without another renderer request.';
    }
    let cleanupFailure;
    if (browser) {
      try { await bounded(browser.close(), 15_000, `${configuration.name}: browser close`); }
      catch (error) { cleanupFailure = error; entry.cleanupFailure = error.message; entry.passed = false; }
    }
    await writeFile(resolve(output, `${configuration.name}-result.json`), JSON.stringify(entry, null, 2));
    if (cleanupFailure) throw cleanupFailure;
  }
}

try {
  await stat(resolve(root, 'index.html'));
  process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = '1';
  const require = createRequire(resolve(game, '../../package.json'));
  const playwright = require('@playwright/test');
  chromium = playwright.chromium;
  expect = playwright.expect.configure({timeout: 90_000});
  report.playwrightVersion = require('@playwright/test/package.json').version;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`; report.origin = origin;
  for (const configuration of [
    {name: 'desktop-reduced', viewport: {width: 1440, height: 960}, reducedMotion: 'reduce'},
    {name: 'phone', viewport: {width: 390, height: 844}, reducedMotion: 'no-preference', mobile: true},
  ]) await runCase(configuration);
  report.passed = report.cases.length === 2 && report.cases.every(entry => entry.passed);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = error.stack || String(error); log(`FAIL ${error.message}`); process.exitCode = 1;
} finally {
  if (server.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'run.log'), lines.join('\n') + '\n');
}
