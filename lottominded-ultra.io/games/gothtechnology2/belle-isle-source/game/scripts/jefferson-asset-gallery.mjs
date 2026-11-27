/** Actual Jefferson game frames reached through ordinary UI and native input.
 * This bounded visual run is separate from the unchanged 90-second native gate.
 * Node 24; run from game/. See docs/JEFFERSON_GALLERY.md.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {launchGalleryBrowser, galleryRenderer, galleryNeedsMetal} from './gallery-renderer.mjs';
import {createNativeTouchSequence} from './native-touch-sequence.mjs';

const game = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(game, '../../package.json'));
const {chromium, expect: rawExpect} = require('@playwright/test');
const expect = rawExpect.configure({timeout: 60000});
const device = process.env.JEFFERSON_GALLERY_DEVICE || 'desktop';
const variant = process.env.JEFFERSON_GALLERY_VARIANT || 'candidate';
assert.ok(['desktop', 'phone'].includes(device), 'JEFFERSON_GALLERY_DEVICE must be desktop or phone');
assert.ok(['baseline', 'candidate'].includes(variant), 'JEFFERSON_GALLERY_VARIANT must be baseline or candidate');
const viewport = device === 'phone' ? {width: 390, height: 844} : {width: 1440, height: 900};
const buildDirectory = resolve(process.env.JEFFERSON_GALLERY_BUILD_DIR || resolve(game, 'dist'));
const output = resolve(process.env.JEFFERSON_GALLERY_OUTPUT || resolve(game, 'output/jefferson-gallery', variant, device));
const browserExecutable = process.env.JEFFERSON_GALLERY_BROWSER_EXECUTABLE || null;
assert.ok(!browserExecutable || !galleryNeedsMetal, 'An executable override is available only in the software diagnostic lane');
const started = Date.now(), deadline = started + 480000;
const requiredBuildings = ['detroit-38139', '886253052'];
const report = {
  schema: 1, head: process.env.GITHUB_SHA || process.env.JEFFERSON_GALLERY_HEAD || null,
  variant, device, viewport, deviceScaleFactor: 1, buildDirectory,
  lighting: 'High Noon, sky cycle disabled', quality: device === 'phone' ? 'smooth' : 'high',
  frameCap: 60, reducedMotion: true, maximumRunMs: 480000,
  navigation: 'Visible Guide Travel, then native keyboard or CDP touch; read-only feedback',
  poseInjection: false, cameraInjection: false, requiresMetal: galleryNeedsMetal, browserExecutable,
  passed: false, captures: [], routes: [], errors: [], failedRequests: [], assetResponses: [],
  pairing: {complete: false, reason: 'Matching report not read yet', captures: []},
  acceptance: {nativeCapture: false, visualFit: 'Requires review of the actual PNGs', performance: 'Separate unchanged 90-second desktop and phone gates'},
  limitations: [
    'Phone viewport emulation is not physical-phone performance certification.',
    'Ground-level roofline views cannot prove hidden roof surfaces.',
    'A completed native route does not certify every collision surface around a building.',
    'The signs and facades are authored game artwork, not verified replicas of current businesses.'
  ]
};
await mkdir(output, {recursive: true});
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const elapsed = () => Date.now() - started;
const remaining = () => Math.max(1, deadline - Date.now());
function budget(label) { if (Date.now() >= deadline) throw Error('Eight-minute gallery deadline reached during ' + label); }
// Actual Metal input receipts exposed two 120Hz physics steps per 60Hz input
// frame: 2.7/60=.045rad. Half that attainable spacing plus .0025rad for the
// authored easing tail avoids demanding an unreachable stationary heading.
// At the existing 3s / 5.4m/s feedback interval this is <.405m lateral drift;
// waypoint, final camera, pairing, frame/GPU and deadline checks stay unchanged.
const routeHeadingTolerance = 2.7 / 60 / 2 + .0025;
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const finitePoint = (point, length) => Array.isArray(point) && point.length === length && point.every(Number.isFinite);
let browser, page, nativeTouch, server, timer, moving = false;
const heldKeys = new Set();

async function observe() {
  budget('read-only observation');
  const state = await page.evaluate(() => typeof window.__jeffersonGalleryState === 'function' ? window.__jeffersonGalleryState() : null);
  assert.ok(state?.pose && state?.camera, 'The query-gated read-only Jefferson observer is unavailable');
  assert.ok(['x', 'y', 'z', 'headingY', 'speed', 'footBlend'].every(k => Number.isFinite(state.pose[k])), 'Observer returned a non-finite actor pose');
  assert.ok(finitePoint(state.camera.position, 3) && finitePoint(state.camera.direction, 3), 'Observer returned an invalid camera');
  assert.equal(state.active, true, 'The actual game is inactive');
  assert.equal(state.paused, false, 'The actual game is paused');
  return state;
}

async function frameProof() {
  budget('active frames and GPU fence');
  const readFrames = () => page.locator('#profile').getAttribute('data-active-frames').then(Number);
  const before = await readFrames();
  assert.ok(Number.isFinite(before), 'Missing active-frame counter');
  await expect.poll(readFrames, {timeout: Math.min(60000, remaining())}).toBeGreaterThan(before + 2);
  const fence = await page.locator('#game').evaluate(() => new Promise((resolveProof, reject) => {
    const gl = document.querySelector('#game')?.getContext('webgl2');
    if (!gl || gl.isContextLost()) return reject(Error('Real WebGL renderer unavailable'));
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), began = performance.now();
    if (!sync) return reject(Error('GPU fence unavailable'));
    gl.flush();
    const poll = () => {
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.CONDITION_SATISFIED || status === gl.ALREADY_SIGNALED) {
        gl.deleteSync(sync);
        return requestAnimationFrame(() => requestAnimationFrame(() => resolveProof({gpuFence: true, elapsedMs: performance.now() - began})));
      }
      if (status === gl.WAIT_FAILED || performance.now() - began > 60000) {
        gl.deleteSync(sync); return reject(Error('GPU-frame proof failed or timed out'));
      }
      requestAnimationFrame(poll);
    };
    poll();
  }));
  return {before, after: await readFrames(), ...fence};
}

async function focusGame() {
  await page.bringToFront();
  await page.locator('#game').focus();
  const focus = await page.evaluate(() => ({focused: document.hasFocus(), visibility: document.visibilityState, activeElement: document.activeElement?.id}));
  assert.ok(focus.focused && focus.visibility === 'visible' && focus.activeElement === 'game', 'Native input requires a visible, focused game canvas');
}

async function openMenu() {
  if (!await page.locator('#ride-menu').isVisible()) await page.locator('#tools-toggle').click();
}

async function stopInput() {
  if (nativeTouch?.snapshot().activeIds.length) await nativeTouch.dispatch('touchEnd', []);
  for (const code of [...heldKeys]) { await page.keyboard.up(code); heldKeys.delete(code); }
  moving = false;
}

async function axes(steer, throttle, run = false) {
  budget('native movement');
  if (device === 'desktop') {
    const wanted = new Set([steer < 0 ? 'KeyA' : steer > 0 ? 'KeyD' : null,
      throttle > 0 ? 'KeyW' : throttle < 0 ? 'KeyS' : null, run ? 'ShiftLeft' : null].filter(Boolean));
    for (const code of [...heldKeys]) if (!wanted.has(code)) { await page.keyboard.up(code); heldKeys.delete(code); }
    for (const code of wanted) if (!heldKeys.has(code)) { await page.keyboard.down(code); heldKeys.add(code); }
  } else if (!steer && !throttle) {
    if (nativeTouch.snapshot().activeIds.length) await nativeTouch.dispatch('touchEnd', []);
  } else {
    const stick = await page.locator('#stick').boundingBox();
    assert.ok(stick, 'Visible native movement joystick is unavailable');
    const center = {id: 1, x: stick.x + stick.width / 2, y: stick.y + stick.height / 2};
    if (!nativeTouch.snapshot().activeIds.length) await nativeTouch.dispatch('touchStart', [center]);
    const radius = stick.width * .37;
    await nativeTouch.dispatch('touchMove', [{...center, x: center.x + steer * radius, y: center.y - throttle * radius}]);
  }
  moving = !!(steer || throttle);
}

async function settle() {
  await stopInput();
  await expect.poll(async () => Math.abs((await observe()).pose.speed), {timeout: Math.min(10000, remaining())}).toBeLessThan(.025);
  // Native on-foot steering has an authored easing tail. Let it settle too.
  await page.waitForTimeout(240);
}

async function turnTo(heading) {
  await settle();
  const correction = {requestedHeadingRad: heading, toleranceRad: routeHeadingTolerance, beganMs: elapsed(), pulses: [], completed: false};
  (report.headingCorrections ||= []).push(correction);
  for (let n = 0; n < 24; n++) {
    const state = await observe(), error = wrap(heading - state.pose.headingY);
    if (Math.abs(error) <= routeHeadingTolerance) {
      correction.finalPose = state.pose;
      correction.finalResidualRad = error;
      correction.elapsedMs = elapsed() - correction.beganMs;
      correction.completed = true;
      return;
    }
    // onFoot.ts turns heading negatively for positive steer, at 2.7 rad/s.
    const steer = error > 0 ? -1 : 1;
    const holdMs = Math.min(650, Math.max(12, Math.abs(error) / 2.7 * 1000));
    correction.pulses.push({observedHeadingRad: state.pose.headingY, residualRad: error, steer, requestedHoldMs: holdMs, beganMs: elapsed()});
    await axes(steer, 0);
    await page.waitForTimeout(holdMs);
    await axes(0, 0);
    await page.waitForTimeout(240);
  }
  correction.finalPose = (await observe()).pose;
  correction.finalResidualRad = wrap(heading - correction.finalPose.headingY);
  correction.elapsedMs = elapsed() - correction.beganMs;
  throw Error('Native heading corrections did not converge');
}

async function walkTo(point, routeEntry, tolerance = .7) {
  assert.ok(finitePoint(point, 2), 'Invalid authored route waypoint');
  const initial = await observe();
  let best = distance([initial.pose.x, initial.pose.z], point), progressedAt = Date.now();
  const began = elapsed();
  for (let n = 0; n < 240; n++) {
    budget('native walking');
    const state = await observe(), p = state.pose, d = distance([p.x, p.z], point);
    if (d <= tolerance) {
      await settle();
      const arrived = await observe();
      routeEntry.waypoints.push({requested: point, actual: arrived.pose, distanceM: distance([arrived.pose.x, arrived.pose.z], point), beganMs: began, elapsedMs: elapsed() - began});
      return;
    }
    if (d < best - .35) { best = d; progressedAt = Date.now(); }
    if (Date.now() - progressedAt > 16000) throw Error('Native route made no useful progress for 16 seconds near ' + JSON.stringify({point, actual: p, distanceM: d}));
    const heading = Math.atan2(point[0] - p.x, point[1] - p.z);
    if (!moving || Math.abs(wrap(heading - p.headingY)) > routeHeadingTolerance) await turnTo(heading);
    await axes(0, 1, true);
    await page.waitForTimeout(Math.min(3000, Math.max(55, (d - tolerance * .6) / 5.4 * 1000)));
  }
  throw Error('Native route exceeded its bounded feedback steps at ' + JSON.stringify(point));
}

async function onFoot() {
  await focusGame();
  const state = await observe();
  if (state.pose.footBlend < .95) await page.locator('#mount').click();
  await expect.poll(async () => (await observe()).pose.footBlend, {timeout: Math.min(15000, remaining())}).toBeGreaterThan(.99);
  await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');
  if (await page.locator('#view').getAttribute('aria-pressed') !== 'true') await page.locator('#view').click();
  if (device === 'phone' && await page.locator('#sprint').getAttribute('aria-pressed') !== 'true') await page.locator('#sprint').click();
  await focusGame();
}

async function guideToDequindre() {
  await settle(); await openMenu(); await page.locator('#map-open').click();
  const card = page.locator('#landmarks .landmark').filter({has: page.locator('h3').filter({hasText: /^Swoop Detroit · Dequindre Cut at East Jefferson$/})});
  await expect(card).toHaveCount(1);
  await card.getByRole('button', {name: 'Travel to path', exact: true}).click();
  await expect(page.locator('#guide')).not.toBeVisible();
  await onFoot();
  report.guideTravel = {label: 'Swoop Detroit · Dequindre Cut at East Jefferson', action: 'Travel to path', actual: (await observe()).pose};
}

function remainingRoute(route, pose) {
  // Select the nearest point on the same authored path, never a new teleport.
  let best = {distance: Infinity, index: 0, point: route[0]};
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((pose.x - a[0]) * dx + (pose.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const point = [a[0] + t * dx, a[1] + t * dz], d = distance([pose.x, pose.z], point);
    if (d < best.distance) best = {distance: d, index: i + 1, point};
  }
  assert.ok(best.distance < 65, 'Actor is outside the bounded connector to the authored road route');
  return [best.point, ...route.slice(best.index)];
}

async function lookDrag(dx, dy) {
  const start = await page.evaluate(() => {
    for (const [rx, ry] of [[.76, .40], [.72, .30], [.8, .5], [.65, .42]]) {
      const x = innerWidth * rx, y = innerHeight * ry;
      if (document.elementFromPoint(x, y)?.id === 'game') return {x, y};
    }
    return null;
  });
  assert.ok(start, 'No unobstructed canvas surface is available for a native look drag');
  const end = {x: Math.max(16, Math.min(viewport.width - 16, start.x + dx)), y: Math.max(100, Math.min(viewport.height - 240, start.y + dy))};
  if (device === 'phone') {
    await nativeTouch.dispatch('touchStart', [{id: 2, ...start}]);
    for (let i = 1; i <= 6; i++) await nativeTouch.dispatch('touchMove', [{id: 2, x: start.x + (end.x - start.x) * i / 6, y: start.y + (end.y - start.y) * i / 6}]);
    await nativeTouch.dispatch('touchEnd', []);
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    try { await page.mouse.move(end.x, end.y, {steps: 6}); } finally { await page.mouse.up(); }
  }
  await page.waitForTimeout(150);
}

async function aimAt(point) {
  assert.ok(finitePoint(point, 3), 'Invalid authored camera look-at point');
  const sensitivity = Number(await page.locator('#look-sensitivity').inputValue());
  assert.ok(sensitivity > 0, 'Invalid visible look sensitivity');
  for (let n = 0; n < 18; n++) {
    const {camera} = await observe(), [x, y, z] = camera.position, [dx, dy, dz] = camera.direction;
    const targetYaw = Math.atan2(point[0] - x, point[2] - z);
    const targetPitch = Math.atan2(y - point[1], Math.hypot(point[0] - x, point[2] - z));
    const yawError = wrap(targetYaw - Math.atan2(dx, dz));
    const pitchError = targetPitch - Math.atan2(-dy, Math.hypot(dx, dz));
    if (Math.abs(yawError) < .008 && Math.abs(pitchError) < .008) return;
    await lookDrag(-yawError / (.003 * sensitivity), pitchError / (.002 * sensitivity));
  }
  throw Error('Native camera look did not converge on the authored subject');
}

function validateAssets(state, currentBuildingId) {
  const stats = state.assetStats;
  assert.ok(stats && typeof stats.enabled === 'boolean', 'Jefferson asset telemetry is unavailable');
  assert.equal(stats.enabled, variant === 'candidate', 'Build variant does not match its actual asset adapter');
  assert.deepEqual(stats.errors, [], 'Jefferson adapter reported asset errors');
  if (variant === 'baseline') { assert.equal(stats.buildings, 'disabled'); return; }
  assert.equal(stats.buildings, 'published', 'Candidate buildings have not published successfully');
  for (const id of requiredBuildings) {
    assert.ok(stats.assignmentIds?.includes(id), 'Missing candidate assignment: ' + id);
    const fitted = stats.fittedBuildings?.find(b => b.id === id);
    assert.ok(fitted, 'Missing fitted building telemetry: ' + id);
    // Far proxies remain valid LODs. Only the nearby photographed target must
    // surrender its original proxy to the detailed replacement.
    if (id === currentBuildingId) assert.equal(fitted.proxyVisible, false, 'Current target original building proxy is still visible: ' + id);
  }
  if (currentBuildingId) assert.ok(stats.visibleBuildingBatches > 0, 'Current target reports no building draw batches');
}

async function waitForAssets() {
  const began = Date.now();
  while (Date.now() - began < 60000) {
    const state = await observe(), stats = state.assetStats;
    assert.ok(stats && typeof stats.enabled === 'boolean', 'Jefferson asset telemetry is unavailable');
    assert.equal(stats.enabled, variant === 'candidate', 'Build variant does not match its actual asset adapter');
    assert.deepEqual(stats.errors, [], 'Jefferson adapter reported asset errors while loading');
    assert.notEqual(stats.buildings, 'fallback', 'Jefferson buildings fell back instead of publishing');
    if (stats.buildings === (variant === 'candidate' ? 'published' : 'disabled')) {
      report.assetWaitMs = Date.now() - began;
      return state;
    }
    await page.waitForTimeout(250);
  }
  throw Error('Jefferson building publication did not settle within its 60-second loading budget');
}

async function capture(target, kind, aim, photo = false) {
  await settle();
  if (photo) {
    await openMenu(); await page.locator('#photo-open').click();
    await expect(page.locator('.capture-panel')).toBeVisible();
    await page.getByLabel('Camera lens', {exact: true}).selectOption('85');
    const finder = page.getByRole('button', {name: 'Viewfinder', exact: true});
    if (await finder.getAttribute('aria-pressed') !== 'true') await finder.click();
  }
  await focusGame(); await aimAt(aim);
  const entry = {id: target.id + '-' + kind, target: target.id, buildingId: target.buildingId, kind, requestedView: target.view, requestedAim: aim, aimSource: photo ? (target.signLookAt ? 'Authored sign world center' : 'Estimated facade band; sign placement needs visual review') : 'Authored building target', source: photo ? 'Existing Camera lens 85 mm / Viewfinder UI' : 'Ordinary first-person game camera', passed: false};
  report.captures.push(entry);
  entry.frame = await frameProof();
  entry.state = await observe();
  validateAssets(entry.state, target.buildingId);
  entry.distanceFromViewM = distance([entry.state.pose.x, entry.state.pose.z], target.view);
  assert.ok(entry.distanceFromViewM < 1.2, 'Native actor did not arrive at the authored view');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'A modal is obscuring the game capture');
  entry.renderer = await galleryRenderer(page);
  entry.screenshot = entry.id + '.png';
  await page.screenshot({path: resolve(output, entry.screenshot), timeout: Math.min(60000, remaining())});
  budget('completed screenshot');
  entry.passed = true;
  entry.profile = await page.locator('#profile').evaluate(el => ({...el.dataset}));
  await save();
  if (photo) {
    await page.locator('#camera-capture > button').first().click();
    await expect(page.locator('.capture-panel')).not.toBeVisible();
    await focusGame();
  }
}

async function pairReports() {
  const otherVariant = variant === 'candidate' ? 'baseline' : 'candidate';
  const path = process.env.JEFFERSON_GALLERY_PAIR_REPORT || resolve(game, 'output/jefferson-gallery', otherVariant, device, 'report.json');
  let other;
  try { other = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; report.pairing.reason = 'Corresponding separate-build report is not present'; return; }
  assert.equal(other.device, device, 'Pair report device differs');
  assert.equal(other.variant, otherVariant, 'Pair report must be the other build variant');
  report.pairing.sameSourceConfirmed = !!report.head && report.head === other.head;
  report.pairing.sameSettings = JSON.stringify(report.viewport) === JSON.stringify(other.viewport)
    && report.quality === other.quality && report.frameCap === other.frameCap
    && report.lighting === other.lighting && report.reducedMotion === other.reducedMotion
    && report.deviceScaleFactor === other.deviceScaleFactor;
  for (const entry of report.captures) {
    const previous = other.captures?.find(v => v.id === entry.id && v.passed);
    if (!previous) { report.pairing.captures.push({id: entry.id, matched: false, reason: 'Other build did not capture this view'}); continue; }
    const a = entry.state.camera, b = previous.state.camera;
    const positionM = Math.hypot(...a.position.map((n, i) => n - b.position[i]));
    const directionDegrees = Math.acos(Math.max(-1, Math.min(1, a.direction.reduce((sum, n, i) => sum + n * b.direction[i], 0)))) * 180 / Math.PI;
    const fovDegrees = Math.abs(a.fovDegrees - b.fovDegrees);
    report.pairing.captures.push({id: entry.id, positionM, directionDegrees, fovDegrees, matched: positionM <= 1.5 && directionDegrees <= 2 && fovDegrees <= .05});
  }
  report.pairing.report = path;
  report.pairing.complete = report.pairing.sameSourceConfirmed && report.pairing.sameSettings && report.captures.length > 0 && report.pairing.captures.every(v => v.matched);
  report.pairing.reason = report.pairing.complete ? 'Same recorded source/settings; actual cameras agree within 1.5m / 2° / .05° FOV' : 'Source/settings are unconfirmed or some views are missing/different; do not present them as matched pairs';
}

async function run() {
  const {JEFFERSON_CAMERA_TARGETS} = await import(pathToFileURL(resolve(game, 'src/belle/jeffersonPlacements.ts')).href);
  assert.ok(Array.isArray(JEFFERSON_CAMERA_TARGETS) && JEFFERSON_CAMERA_TARGETS.length > 0, 'Authored camera target data is missing');
  for (const target of JEFFERSON_CAMERA_TARGETS) {
    assert.ok(target.id && requiredBuildings.includes(target.buildingId), 'Unexpected camera target assignment');
    assert.ok(finitePoint(target.view, 2) && finitePoint(target.lookAt, 3) && finitePoint(target.center, 2) && Number.isFinite(target.height) && Number.isFinite(target.yaw) && Array.isArray(target.route) && target.route.length > 1 && target.route.every(p => finitePoint(p, 2)), 'Incomplete authored view/route: ' + target.id);
    assert.ok(['spawn', 'dequindre-guide'].includes(target.routeAnchor), 'Unknown visible-UI route anchor');
  }
  report.targets = JEFFERSON_CAMERA_TARGETS;
  server = createCoopStaticServer(buildDirectory);
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const launcher = browserExecutable ? {launch: options => chromium.launch({...options, executablePath: browserExecutable})} : chromium;
  browser = await launchGalleryBrowser(launcher, 'chromium');
  page = await browser.newPage({viewport, deviceScaleFactor: 1, isMobile: device === 'phone', hasTouch: device === 'phone', reducedMotion: 'reduce'});
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', response => {
    if (response.status() >= 400) report.errors.push('HTTP ' + response.status() + ' ' + response.url());
    if (/jefferson/i.test(response.url())) report.assetResponses.push({url: response.url(), status: response.status()});
  });
  page.on('requestfailed', request => report.failedRequests.push((request.failure()?.errorText || 'Network failure') + ' ' + request.url()));
  await page.addInitScript(() => {
    // Event observation only. Do not synthesize input or change game state.
    const counts = {}, recent = [];
    Object.defineProperty(window, '__jeffersonNativeInputReceipt', {value: () => ({counts: {...counts}, recent: recent.slice()}), writable: false});
    for (const type of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
      const key = event.type + ':' + (event.pointerType || event.code || '') + ':' + String(event.isTrusted);
      counts[key] = (counts[key] || 0) + 1;
      if (event.type !== 'pointermove') { recent.push({type: event.type, code: event.code || null, pointerType: event.pointerType || null, trusted: event.isTrusted, target: event.target?.id || null, at: performance.now()}); if (recent.length > 160) recent.shift(); }
    }, {capture: true, passive: true});
  });
  if (device === 'phone') {
    const cdp = await page.context().newCDPSession(page);
    nativeTouch = createNativeTouchSequence((method, args) => cdp.send(method, args));
  }
  const url = new URL('http://127.0.0.1:' + server.address().port + '/');
  url.searchParams.set('profile', '1'); url.searchParams.set('jefferson-gallery', '1');
  await page.goto(url.href, {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#welcome')).toHaveAttribute('data-state', 'ready', {timeout: Math.min(150000, remaining())});
  report.renderer = await galleryRenderer(page);
  const motion = page.locator('#startup-motion');
  if (await motion.getAttribute('aria-pressed') !== 'true') await motion.click();
  await page.locator('.cinema-ride-picker > summary').click();
  await page.locator('.ride-options label').filter({hasText: 'One wheel'}).click();
  await page.getByRole('button', {name: 'Use this ride', exact: true}).click();
  await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);
  await openMenu(); await page.locator('#settings-open').click();
  if (await page.locator('#sky-cycle').isChecked()) await page.locator('#sky-cycle').uncheck();
  await page.locator('#sky-preset').selectOption('12');
  await page.locator('#quality').selectOption(report.quality);
  await page.locator('#fps').selectOption('60');
  if (device === 'phone') { await page.locator('#touch').check(); await page.locator('#joystick-mode').selectOption('fixed'); }
  await page.locator('[data-close="settings"]').click();
  await onFoot();
  report.initialState = await waitForAssets(); validateAssets(report.initialState);
  let anchor = 'spawn';
  for (const target of JEFFERSON_CAMERA_TARGETS) {
    budget('camera target ' + target.id);
    if (target.routeAnchor !== anchor) {
      assert.equal(target.routeAnchor, 'dequindre-guide', 'Route order would require an unrequested spawn reset');
      await guideToDequindre(); anchor = target.routeAnchor;
    }
    // Menus and the photography UI intentionally clear held/sprint controls.
    await onFoot();
    const routeEntry = {target: target.id, anchor, beganMs: elapsed(), waypoints: [], completed: false};
    report.routes.push(routeEntry);
    const state = await observe();
    const route = remainingRoute(target.route, state.pose);
    if (distance(route.at(-1), target.view) > .01) route.push(target.view);
    for (const point of route) await walkTo(point, routeEntry);
    await turnTo(target.yaw);
    routeEntry.completed = true; routeEntry.elapsedMs = elapsed() - routeEntry.beganMs;
    await save();
    await capture(target, 'facade-corner', target.lookAt);
    if (target.captureDetails !== false) {
      const ground = target.groundY ?? 2;
      await capture(target, 'roofline', [target.center[0], ground + target.height, target.center[1]]);
      await capture(target, 'sign-area', target.signLookAt || [target.center[0], ground + Math.min(target.height * .65, 4), target.center[1]], true);
    }
  }
  report.finalState = await observe();
  report.inputReceipt = await page.evaluate(() => window.__jeffersonNativeInputReceipt());
  const counts = report.inputReceipt.counts;
  assert.ok(device === 'phone' ? counts['pointerdown:touch:true'] > 0 && counts['pointermove:touch:true'] > 0 : counts['keydown:KeyW:true'] > 0 && counts['keyup:KeyW:true'] > 0, 'Missing trusted native movement receipts');
  await pairReports();
  report.acceptance.nativeCapture = report.captures.length > 0 && report.captures.every(v => v.passed) && report.routes.every(v => v.completed) && !report.errors.length && !report.failedRequests.length;
  report.passed = report.acceptance.nativeCapture;
}

await save();
try {
  await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Eight-minute gallery deadline reached; no timeout extension is permitted')), remaining()); })]);
} catch (error) {
  report.errors.push(error.stack || String(error));
  report.passed = false;
  if (page && !page.isClosed()) {
    try { report.failureState = await page.evaluate(() => ({state: typeof window.__jeffersonGalleryState === 'function' ? window.__jeffersonGalleryState() : null, frames: document.getElementById('profile')?.dataset.activeFrames, focused: document.hasFocus(), visibility: document.visibilityState})); }
    catch (failure) { report.failureObservationError = String(failure); }
  }
} finally {
  clearTimeout(timer);
  if (page && !page.isClosed()) {
    try { await stopInput(); } catch (error) { report.errors.push('Native input release: ' + error.message); }
    try { report.inputReceipt = await page.evaluate(() => window.__jeffersonNativeInputReceipt?.() || null); } catch {}
  }
  if (nativeTouch) try { report.touchCleanup = await nativeTouch.cancelActive(); } catch (error) { report.errors.push('Native touch cleanup: ' + error.message); }
  if (browser) try { await browser.close(); } catch (error) { report.errors.push('Browser close: ' + error.message); }
  if (server) { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
  report.elapsedMs = elapsed();
  if (report.errors.length || report.failedRequests.length) report.passed = report.acceptance.nativeCapture = false;
  await save();
}
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const cards = report.captures.map(c => '<article><h2>' + escape(c.id) + '</h2><p>' + escape(c.source) + '</p>' + (c.passed ? '<a href="' + escape(c.screenshot) + '"><img src="' + escape(c.screenshot) + '" alt="Actual game ' + escape(c.kind) + ' for ' + escape(c.buildingId) + '"></a>' : '<p>Capture did not complete.</p>') + '</article>').join('\n');
await writeFile(resolve(output, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Jefferson actual game gallery</title><style>body{margin:2rem auto;padding:0 1rem;max-width:1100px;background:#12171b;color:#e9ecec;font:16px/1.5 system-ui}a{color:#9ed8fa}img{max-width:100%;height:auto}article{margin:2rem 0}pre{white-space:pre-wrap}</style><h1>Jefferson · ' + escape(variant + ' / ' + device) + '</h1><p>High Noon · actual browser game · ' + escape(report.renderer) + '</p><p>Native capture: ' + (report.passed ? 'completed' : 'failed / incomplete') + '. Visual fit requires inspection of these PNGs. The independent 90-second performance gates are unchanged.</p><p><a href="report.json">Full route, camera, asset, frame and error evidence</a></p>' + cards + '<h2>Errors</h2><pre>' + escape(report.errors.join('\n')) + '</pre></html>');
console.log(JSON.stringify({passed: report.passed, variant, device, captures: report.captures.filter(c => c.passed).length, renderer: report.renderer, pairingComplete: report.pairing.complete, elapsedMs: report.elapsedMs, report: resolve(output, 'report.json')}, null, 2));
if (!report.passed) process.exitCode = 1;
