/** Real built-game visual smoke. Uses only visible controls; never seeds scores or scene state. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';

const game = resolve(import.meta.dirname, '..');
const root = resolve(game, 'dist');
const output = resolve(process.env.BELLE_ACTIVITY_BROWSER_OUTPUT || resolve(game, 'output/activity-browser'));
await mkdir(output, {recursive: true});
const lines = [];
const log = message => { const line = `${new Date().toISOString()} ${message}`; lines.push(line); console.log(line); };
const headless = process.env.BELLE_ACTIVITY_BROWSER_HEADED !== '1';
const softwareGpuWatchdogSeconds = 60;
const browserImplementation = headless ? 'Full Chromium unified headless' : 'Full Chromium windowed on the CI virtual display';
const report = {startedAt: new Date().toISOString(), passed: false, manualScreenshotReviewRequired: true, scope: 'Real WebGL rendering and activity UI smoke; no full delivery run, physical-device or performance certification.', browserIsolation: 'Fresh Chromium process per case', browserRuntime: {channel: 'chromium', headless, implementation: browserImplementation, gpuWatchdogSeconds: softwareGpuWatchdogSeconds}, screenshotBackend: 'Playwright legacy screenshot; visible page, existing compositor surface', cases: []};
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

let chromium;
let expect;
let origin;
async function runCase(configuration) {
  const setupViewport = {width: 390, height: 844};
  const entry = {name: configuration.name, viewport: configuration.viewport, setupViewport, reducedMotion: configuration.reducedMotion, passed: false, errors: [], console: [], failedRequests: [], screenshots: [], metrics: {}, photoCompletion: {status: 'not exercised'}};
  report.cases.push(entry);
  let browser;
  let page;
  let screenshotFailed = false;
  let caseTimedOut = false;
  const tap = locator => configuration.mobile ? locator.tap() : locator.click();
  const screenshot = async name => {
    const filename = `${configuration.name}-${name}.png`;
    log(`${configuration.name}: capture ${name} at ${page.viewportSize().width}×${page.viewportSize().height}`);
    try {
      // A compositor stall can also stall Playwright's screenshot cleanup. The
      // outer deadline lets this case close its own browser instead of queuing
      // more captures on the same GPU process.
      await bounded(page.screenshot({path: resolve(output, filename), timeout: 90_000}), 95_000, `${configuration.name}: screenshot ${name}`);
    } catch (error) {
      screenshotFailed = true;
      entry.screenshotFailure = error.message;
      throw error;
    }
    entry.screenshots.push(filename);
    log(`${configuration.name}: captured ${name}`);
  };
  const layout = async selector => {
    const measurements = await page.locator(selector).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth};
    });
    entry.metrics[selector] = measurements;
    assert.ok(measurements.documentWidth <= measurements.viewportWidth + 1, `${selector}: document must not overflow horizontally`);
    assert.ok(measurements.scrollWidth <= measurements.clientWidth + 1, `${selector}: content must not overflow horizontally`);
    assert.ok(measurements.left >= -1 && measurements.right <= measurements.viewportWidth + 1, `${selector}: horizontal bounds must fit`);
  };
  const card = title => page.locator('#activity-board .activity-card').filter({has: page.getByRole('heading', {name: title, exact: true})});
  const capturePhoto = async () => {
    await tap(page.locator('#camera-capture').getByRole('button', {name: 'Photo', exact: true}));
    // On successful capture, CameraCapture.finish() moves the status from
    // the bottom controls into the persistent Save/Share bar. Check the camera
    // root, and continue requiring a real encoded image and download control.
    await expect(page.locator('#camera-capture [role="status"]')).toContainText('Photo ready', {timeout: 90_000});
    await expect(page.locator('#camera-capture')).toHaveAttribute('data-capture-bytes', /^[1-9]\d*$/);
    await expect(page.locator('#camera-capture .capture-save')).toBeVisible();
  };
  let deadline;
  try {
    // Each case owns a fresh GPU process as well as fresh storage. A timed-out
    // software render in one case must not starve the following cases.
    // CI uses Playwright's supported headed/Xvfb setup so capture runs against
    // a visible window surface. Local runs may retain unified headless mode.
    // https://playwright.dev/docs/ci#running-headed
    log(`${configuration.name}: launch fresh ${browserImplementation}`);
    // The headed software runner hit Chromium's hung-GPU termination path
    // (native exit_code=512), followed immediately by WebGL context loss.
    // Keep its watchdog active, with a finite interval for software work.
    // https://github.com/chromium/chromium/blob/149.0.7827.55/gpu/ipc/service/gpu_watchdog_thread.cc
    browser = await chromium.launch({channel: 'chromium', headless, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--gpu-watchdog-timeout-seconds=${softwareGpuWatchdogSeconds}`]});
    entry.metrics.browserVersion = browser.version();
    // Bootstrap at the already verified small viewport, then use the game's real
    // graphics controls before resizing. The final CSS viewport is never reduced.
    const context = await browser.newContext({viewport: setupViewport, deviceScaleFactor: 1, reducedMotion: configuration.reducedMotion, isMobile: !!configuration.mobile, hasTouch: !!configuration.mobile});
    page = await context.newPage();
    page.setDefaultTimeout(90_000);
    page.on('pageerror', error => {
      entry.errors.push(error.message);
      log(`${configuration.name}: page error ${JSON.stringify(error.message)}`);
    });
    page.on('console', message => {
      const event = {at: new Date().toISOString(), type: message.type(), text: message.text(), location: message.location()};
      entry.console.push(event);
      if (event.type === 'error') entry.errors.push(`console: ${event.text}`);
      if (event.type === 'error' || /context.*(?:lost|restored)/i.test(event.text)) log(`${configuration.name}: browser console ${JSON.stringify(event)}`);
    });
    page.on('response', response => { if (response.status() >= 400) entry.errors.push(`HTTP ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      const message = `${request.failure()?.errorText} ${request.url()}`;
      entry.failedRequests.push(message);
      if (!message.startsWith('net::ERR_ABORTED')) entry.errors.push(message);
    });
    await Promise.race([(async () => {
      log(`${configuration.name}: load built game`);
      await page.goto(origin + '/', {waitUntil: 'domcontentloaded', timeout: 30_000});
      await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#welcome')?.dataset.state), null, {timeout: 180_000});
      await expect(page.locator('#welcome')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('.activity-welcome')).toHaveCount(2);
      await expect(page.getByRole('button', {name: 'Swoop Dispatch', exact: true})).toBeEnabled();
      entry.metrics.startupWebgl = await page.locator('#game').evaluate(canvas => {
        const gl = canvas.getContext('webgl2');
        if (!gl || gl.isContextLost()) throw new Error('A live WebGL2 renderer is required for the visual gate.');
        return {version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), width: canvas.width, height: canvas.height, cssWidth: innerWidth, cssHeight: innerHeight, devicePixelRatio};
      });
      if (configuration.reducedMotion === 'reduce') {
        await expect(page.locator('#welcome')).toHaveClass(/motion-off/);
        await expect(page.locator('#startup-motion')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#motion')).toBeChecked();
      }
      // Select the wheel through the real picker so the hover model and its
      // extra scene lights are not mounted before the graphics controls work.
      // Close the preview promptly; starting disposes its separate renderer.
      if (await page.locator('#startup-motion').getAttribute('aria-pressed') !== 'true') await tap(page.locator('#startup-motion'));
      log(`${configuration.name}: choose One wheel through the startup picker`);
      await tap(page.locator('.cinema-ride-picker > summary'));
      await tap(page.locator('.ride-options label').filter({hasText: 'One wheel'}));
      await expect(page.locator('input[name="startup-vehicle"][value="onewheel"]')).toBeChecked();
      await expect(page.locator('#welcome')).toHaveAttribute('data-vehicle', 'onewheel');
      await tap(page.getByRole('button', {name: 'Use this ride', exact: true}));
      await expect(page.locator('.cinema-ride-picker')).not.toHaveAttribute('open');
      await tap(page.locator('#start'));
      await expect(page.locator('body')).not.toHaveClass(/at-start/, {timeout: 90_000});
      await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
      await expect(page.locator('.ride-preview-canvas')).toHaveCount(0);
      log(`${configuration.name}: wheel started; select Smooth / 30 FPS through Settings`);
      await tap(page.locator('#tools-toggle'));
      await tap(page.locator('#settings-open'));
      await expect(page.locator('#settings')).toBeVisible();
      await page.locator('#quality').selectOption('smooth');
      await page.locator('#fps').selectOption('30');
      await expect(page.locator('#quality')).toHaveValue('smooth');
      await expect(page.locator('#fps')).toHaveValue('30');
      await tap(page.locator('[data-close="settings"]'));
      // Preserve the existing on-foot Dispatch handoff/key-precedence scenario.
      await tap(page.locator('#mount'));
      await expect(page.locator('#ride-mode')).toHaveText('ON FOOT', {timeout: 90_000});
      await expect(page.locator('#hover-enter')).toHaveText('Ride hoverbike · B');
      await page.setViewportSize(configuration.viewport);
      await page.waitForFunction(({width, height}) => innerWidth === width && innerHeight === height && document.querySelector('#game')?.width === width && document.querySelector('#game')?.height === height, configuration.viewport);
      entry.metrics.graphics = {quality: await page.locator('#quality').inputValue(), fps: await page.locator('#fps').inputValue(), initialRide: 'One wheel selected through startup picker; dismounted through UI', flyoverPausedThroughUi: true};
      entry.metrics.webgl = await page.locator('#game').evaluate(canvas => {
        const gl = canvas.getContext('webgl2');
        if (!gl || gl.isContextLost()) throw new Error('A live WebGL2 renderer is required after graphics setup.');
        return {version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), width: canvas.width, height: canvas.height, cssWidth: innerWidth, cssHeight: innerHeight, devicePixelRatio};
      });
      log(`${configuration.name}: Smooth / 30 FPS selected through UI; final viewport ${configuration.viewport.width}×${configuration.viewport.height}`);
      await tap(page.locator('#tools-toggle'));
      await tap(page.locator('#activities-open'));
      await expect(page.locator('#activity-board')).toBeVisible();
      await expect(page.locator('#activity-board .activity-card')).toHaveCount(5);
      await layout('#activity-board');
      await screenshot('dispatch-board');
      if (!configuration.mobile) {
        await page.locator('#activity-tab-dispatch').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#activity-tab-photo')).toBeFocused();
        await expect(page.locator('#activity-tab-photo')).toHaveAttribute('aria-selected', 'true');
        const focus = await page.locator('#activity-tab-photo').evaluate(element => ({visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth, animation: getComputedStyle(element).animationName, transition: getComputedStyle(element).transitionDuration}));
        entry.metrics.focus = focus;
        assert.ok(focus.visible && focus.outline !== 'none' && parseFloat(focus.width) > 0, 'Keyboard focus must be visible');
        if (configuration.reducedMotion === 'reduce') { assert.equal(focus.animation, 'none'); assert.equal(focus.transition, '0s'); }
      } else await tap(page.locator('#activity-tab-photo'));
      await expect(page.locator('#activity-board .activity-card')).toHaveCount(8);
      await layout('#activity-board');
      await screenshot('photo-board');
      await page.locator('#activity-board .activity-card').last().scrollIntoViewIfNeeded();
      await screenshot('photo-board-last-card');
      await tap(page.locator('#activity-tab-album'));
      await expect(page.locator('#activity-content')).toContainText('Your album starts with your first qualifying');
      await screenshot('empty-album');
      await tap(page.locator('#activity-tab-dispatch'));
      await tap(card('First Drop').getByRole('button', {name: 'Start assignment', exact: true}));
      await expect(page.locator('body')).not.toHaveClass(/at-start/);
      await expect(page.locator('#activity-hud')).toBeVisible();
      await expect(page.locator('#activity-hud h3')).toHaveText('First Drop');
      await expect(page.locator('#activity-action')).toBeDisabled();
      await expect(page.locator('#profile')).toContainText(/\d+ draws/, {timeout: 90_000});
      entry.metrics.render = await page.locator('#profile').textContent();
      assert.ok(Number(entry.metrics.render.match(/(\d+) draws/)[1]) > 0, 'The game must report real rendered draw calls');
      await page.locator('#game').focus();
      await page.keyboard.press('KeyB');
      await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/);
      await expect(page.locator('#hover-enter')).not.toHaveText(/Preparing|Get off/);
      await expect(page.locator('#activity-hud')).toContainText('Collect at Island Bridge Dispatch Hub');
      await layout('#activity-hud');
      await screenshot('dispatch-hud');
      await tap(page.locator('#activity-hud').getByRole('button', {name: 'Journal · J', exact: true}));
      await expect.poll(() => page.locator('#activity-board .activity-card button').evaluateAll(buttons => buttons.length === 5 && buttons.every(button => button.disabled))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('#activity-board')).not.toBeVisible();
      await expect(page.locator('#game')).toBeFocused();
      await page.keyboard.press('KeyJ');
      await expect(page.locator('#activity-board')).toBeVisible();
      await tap(page.getByRole('button', {name: 'End activity', exact: true}));
      await tap(page.locator('#activity-tab-photo'));
      await tap(card('First Frame').getByRole('button', {name: 'Start assignment', exact: true}));
      await expect(page.locator('#activity-hud h3')).toHaveText('First Frame');
      await tap(page.locator('#activity-action'));
      await expect(page.locator('body')).toHaveClass(/royale-camera-mode/);
      await expect(page.locator('#camera-capture .capture-panel')).toBeVisible();
      await layout('#activity-hud');
      await layout('#camera-capture .capture-panel');
      await screenshot('photo-camera');
      await capturePhoto();
      await expect(page.locator('#activity-hud > p').first()).not.toContainText('Next subject:');
      await expect(page.locator('#activity-hud')).toContainText('0/1 photos');
      entry.metrics.retryFeedback = await page.locator('#activity-hud > p').first().textContent();
      await screenshot('photo-retry-feedback');
      await tap(page.locator('#camera-capture').getByRole('button', {name: 'Put camera away · P', exact: true}));

      if (configuration.mobile) {
        // Keep the genuine mobile action-layering regression mandatory, after
        // the activity evidence is saved. The bike's first visible lights can
        // require additional shader work on the software renderer.
        log(`${configuration.name}: activity captures saved; begin real hover touch regression`);
        await tap(page.locator('#activity-hud').getByRole('button', {name: 'Journal · J', exact: true}));
        await tap(page.getByRole('button', {name: 'End activity', exact: true}));
        await tap(page.locator('#activity-board').getByRole('button', {name: 'Back to island', exact: true}));
        await expect(page.locator('#activity-hud')).not.toBeVisible();
        await expect(page.locator('body')).toHaveClass(/touch-controls/);
        await tap(page.locator('#tools-toggle'));
        const mountedAt = Date.now();
        entry.metrics.hoverTouch = {status: 'mounting', input: 'real touchscreen taps', allowanceSeconds: 90};
        log(`${configuration.name}: mount hoverbike through Menu; allow up to 90s for first mount`);
        await bounded((async () => {
          await page.locator('#hover-enter').tap({timeout: 90_000});
          await expect(page.locator('body')).toHaveClass(/on-hoverbike/, {timeout: 90_000});
          await expect(page.locator('#hover-hud')).toBeVisible({timeout: 90_000});
          await expect(page.locator('#hover-mode')).toHaveText('LANDED', {timeout: 90_000});
        })(), 90_000, `${configuration.name}: first hover mount`);
        entry.metrics.hoverTouch.mountMilliseconds = Date.now() - mountedAt;
        entry.metrics.hoverTouch.status = 'dismounting';
        const dismountedAt = Date.now();
        log(`${configuration.name}: hover mounted in ${entry.metrics.hoverTouch.mountMilliseconds}ms; tap Get off with up to 90s for shader warmup`);
        await bounded((async () => {
          await page.locator('#hover-hud [data-hover="exit"]').tap({timeout: 90_000});
          await expect(page.locator('body')).not.toHaveClass(/on-hoverbike/, {timeout: 90_000});
          await expect(page.locator('#hover-hud')).not.toBeVisible({timeout: 90_000});
          await expect(page.locator('#hover-enter')).toBeEnabled({timeout: 90_000});
          await expect(page.locator('#hover-enter')).toHaveText('Ride hoverbike · B', {timeout: 90_000});
          await expect(page.locator('#ride-mode')).toHaveText('ON FOOT', {timeout: 90_000});
        })(), 90_000, `${configuration.name}: hover Get off touch regression`);
        entry.metrics.hoverTouch.dismountMilliseconds = Date.now() - dismountedAt;
        entry.metrics.hoverTouch.status = 'passed';
        log(`${configuration.name}: real Get off tap passed in ${entry.metrics.hoverTouch.dismountMilliseconds}ms; on-foot state restored`);
      }

      // One bounded, genuine desktop capture attempt using the existing guide.
      // Failure to qualify is reported honestly and does not fake completion coverage.
      if (configuration.name === 'desktop') {
        entry.photoCompletion = {status: 'not verified', reason: 'A single ordinary guide/viewpoint capture is attempted; no full route simulation.'};
        await tap(page.locator('#tools-toggle'));
        await tap(page.locator('#map-open'));
        await page.locator('#guide-search').fill('James Scott Memorial Fountain');
        const landmark = page.locator('#landmarks .landmark').filter({has: page.getByRole('heading', {name: 'James Scott Memorial Fountain', exact: true})});
        await tap(landmark.getByRole('button', {name: 'Travel to path', exact: true}));
        await expect(page.locator('#guide')).not.toBeVisible();
        await tap(page.locator('#activity-action'));
        const finder = page.locator('#camera-capture').getByRole('button', {name: 'Viewfinder', exact: true});
        if (await finder.getAttribute('aria-pressed') === 'true') await tap(finder);
        await expect(finder).toHaveAttribute('aria-pressed', 'false');
        await page.getByLabel('Camera lens', {exact: true}).selectOption('35');
        const width = configuration.viewport.width, height = configuration.viewport.height;
        await page.mouse.move(width * .75, height * .4);
        await page.mouse.down(); await page.mouse.move(width * .75, height * .4 - 71, {steps: 8}); await page.mouse.up();
        await screenshot('fountain-camera');
        await capturePhoto();
        if (await page.locator('#activity-results').isVisible()) {
          await expect(page.locator('#activity-results h2')).toHaveText('First Frame');
          entry.photoCompletion = {status: 'verified', score: await page.locator('.activity-result-score').textContent()};
          await screenshot('photo-result');
          await tap(page.locator('#activity-results').getByRole('button', {name: 'Photo album', exact: true}));
          await expect(page.locator('.activity-photo img')).toHaveCount(1);
          await page.locator('.activity-photo img').scrollIntoViewIfNeeded();
          await expect.poll(() => page.locator('.activity-photo img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
          await screenshot('photo-album');
        } else {
          entry.photoCompletion.reason = await page.locator('#activity-hud > p').first().textContent();
          await screenshot('fountain-retry-feedback');
        }
      }
      assert.deepEqual(entry.errors, [], 'Browser errors or missing runtime assets fail the smoke');
      entry.passed = true;
      log(`${configuration.name}: mandatory visual smoke passed; qualifying photo ${entry.photoCompletion.status}`);
    })(), new Promise((_, reject) => { deadline = setTimeout(() => { caseTimedOut = true; reject(new Error('Visual context exceeded the thirty-minute bound')); }, 1_800_000); })]);
  } catch (error) {
    entry.failure = error.stack || String(error);
    log(`${configuration.name}: FAIL ${error.message}`);
    if (page && !screenshotFailed && !caseTimedOut) {
      try { await screenshot('failure'); } catch {}
    }
  } finally {
    clearTimeout(deadline);
    if (page) {
      entry.lastUrl = page.url();
      if (!screenshotFailed && !caseTimedOut) {
        try { await writeFile(resolve(output, `${configuration.name}-dom.html`), await bounded(page.content(), 5_000, `${configuration.name}: DOM diagnostic`)); }
        catch (error) { entry.domCaptureFailure = error.message; }
      } else entry.domCaptureSkipped = 'Close the stalled browser without queuing another renderer request.';
    }
    let cleanupFailure;
    if (browser) {
      try { await bounded(browser.close(), 15_000, `${configuration.name}: browser close`); }
      catch (error) { cleanupFailure = error; entry.cleanupFailure = error.message; entry.passed = false; }
    }
    await writeFile(resolve(output, `${configuration.name}-result.json`), JSON.stringify(entry, null, 2));
    // Do not launch another GPU process if the preceding process could not close.
    if (cleanupFailure) throw cleanupFailure;
  }
}

try {
  await stat(resolve(root, 'index.html'));
  // Playwright 1.61.1 exposes this compatibility switch in chromiumSwitches.ts.
  // It captures genuine visible-page pixels without requesting a new compositor
  // surface for every screenshot. Set it before loading Playwright's defaults.
  // https://github.com/microsoft/playwright/blob/v1.61.1/packages/playwright-core/src/server/chromium/chromiumSwitches.ts
  process.env.PLAYWRIGHT_LEGACY_SCREENSHOT = '1';
  const require = createRequire(resolve(game, '../../package.json'));
  const playwright = require('@playwright/test');
  chromium = playwright.chromium;
  expect = playwright.expect.configure({timeout: 90_000});
  report.playwrightVersion = require('@playwright/test/package.json').version;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  report.origin = origin;
  for (const configuration of [
    {name: 'desktop', viewport: {width: 1440, height: 960}, reducedMotion: 'no-preference'},
    {name: 'mobile', viewport: {width: 390, height: 844}, reducedMotion: 'no-preference', mobile: true},
    {name: 'reduced-motion', viewport: {width: 1440, height: 960}, reducedMotion: 'reduce'},
  ]) await runCase(configuration);
  report.passed = report.cases.length === 3 && report.cases.every(entry => entry.passed);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = error.stack || String(error);
  log(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  if (server.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'run.log'), lines.join('\n') + '\n');
}
