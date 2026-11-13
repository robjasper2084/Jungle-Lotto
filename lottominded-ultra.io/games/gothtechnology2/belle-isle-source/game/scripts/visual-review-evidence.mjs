/** Evidence collection only: never changes the game scene, physics or records. */
export function recordRequestFailure(entry, request, phase = 'gameplay') {
  const errorText = request.failure()?.errorText ?? 'Request failed';
  const url = request.url();
  const message = `${errorText} ${url}`;
  entry.failedRequests.push(message);
  entry.errors.push(message); // ERR_ABORTED and cleanup failures are not waived.
  (entry.requestFailureDetails ??= []).push({at: new Date().toISOString(), phase,
    url, errorText, resourceType: request.resourceType()});
  return message;
}

/** Serialized into the browser by Playwright. Reads the actual rendered UI and
 * waits nonblockingly for submitted GPU work; does not render a substitute view.
 */
export function waitForBeachFrame(canvas) {
  const snapshot = () => {
    const place = document.querySelector('#place')?.textContent?.trim();
    const mode = document.querySelector('#ride-mode')?.textContent?.trim();
    const firstPerson = document.querySelector('#view')?.getAttribute('aria-pressed') === 'true';
    if (document.visibilityState !== 'visible' || document.querySelector('dialog[open]')
      || place !== 'Belle Isle Beach' || mode !== 'ON FOOT' || !firstPerson
      || document.body.classList.contains('on-hoverbike')
      || document.body.classList.contains('royale-camera-mode')) {
      throw new Error('Beach evidence requires the visible, unobstructed on-foot Beach/FPP view.');
    }
    return {place, mode, firstPerson, width: canvas.width, height: canvas.height,
      cssWidth: innerWidth, cssHeight: innerHeight};
  };
  const initial = snapshot();
  const gl = canvas.getContext('webgl2');
  if (!gl || gl.isContextLost() || initial.width <= 0 || initial.height <= 0) {
    throw new Error('Beach evidence requires a live, nonempty WebGL2 canvas.');
  }
  return new Promise((resolve, reject) => {
    let sync, pollTimer, paintFrame, deadline, settled = false, paints = 0;
    const submittedAt = performance.now();
    let completedAt;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(pollTimer); clearTimeout(deadline);
      if (paintFrame !== undefined) cancelAnimationFrame(paintFrame);
      try { if (sync) gl.deleteSync(sync); } catch (cleanupError) { error ??= cleanupError; }
      if (error) { reject(error); return; }
      try {
        if (gl.isContextLost()) throw new Error('Beach WebGL context lost before capture.');
        resolve({...snapshot(), gpuSubmittedAt: submittedAt, gpuCompletedAt: completedAt,
          paintOpportunities: paints});
      } catch (stateError) { reject(stateError); }
    };
    const paint = () => {
      if (settled) return;
      try { snapshot(); } catch (error) { finish(error); return; }
      if (++paints === 2) finish();
      else paintFrame = requestAnimationFrame(paint);
    };
    const poll = () => {
      if (settled) return;
      try {
        snapshot();
        if (gl.isContextLost()) throw new Error('Beach WebGL context lost while waiting for the frame.');
        const result = gl.clientWaitSync(sync, 0, 0);
        if (result === gl.WAIT_FAILED) throw new Error('Beach GPU frame fence failed.');
        if (result === gl.TIMEOUT_EXPIRED) { pollTimer = setTimeout(poll, 16); return; }
        if (result !== gl.ALREADY_SIGNALED && result !== gl.CONDITION_SATISFIED) {
          throw new Error('Unexpected Beach GPU frame fence result.');
        }
        completedAt = performance.now();
        paintFrame = requestAnimationFrame(paint);
      } catch (error) { finish(error); }
    };
    deadline = setTimeout(() => finish(new Error('Beach frame evidence exceeded 45 seconds.')), 45_000);
    try {
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) throw new Error('Beach GPU frame fence unavailable.');
      gl.flush(); poll();
    } catch (error) { finish(error); }
  });
}

/** The guide already has a separate shoreline arrival. Generic path travel may
 * correctly stop by the service shed; it is not evidence of the beach surface.
 * Keep that path check, then use this real public action and a fresh game frame.
 */
export async function prepareBeachWaterline({page, tap, expect, bounded}) {
  const readFrames = async () => {
    const value = await page.locator('#profile').getAttribute('data-active-frames');
    if (value === null || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new Error('Missing actual game frame counter.');
    }
    return Number(value);
  };
  const before = await readFrames();
  await tap(page.locator('#tools-toggle'));
  await tap(page.locator('#map-open'));
  await page.locator('#guide-search').fill('Belle Isle Beach');
  const beach = page.locator('#landmarks .landmark').filter({has:
    page.getByRole('heading', {name: 'Belle Isle Beach', exact: true})});
  await tap(beach.getByRole('button', {name: 'Walk onto the beach', exact: true}));
  await expect(page.locator('#guide')).not.toBeVisible();
  await expect(page.locator('#ride-mode')).toHaveText('ON FOOT');
  await expect(page.locator('#place')).toHaveText('Belle Isle Beach');
  await expect(page.locator('body')).not.toHaveClass(/on-hoverbike|royale-camera-mode/);
  const view = page.locator('#view');
  if (await view.getAttribute('aria-pressed') !== 'true') await tap(view);
  await expect(view).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#game').focus();
  const arrivalFrames = await readFrames();
  await expect.poll(readFrames).toBeGreaterThan(arrivalFrames);
  const frame = await bounded(page.locator('#game').evaluate(waitForBeachFrame),
    50_000, 'Beach frame evidence');
  return {action: 'Walk onto the beach', frame, previousActiveFrames: before,
    arrivalActiveFrames: arrivalFrames, currentActiveFrames: await readFrames(),
    screenshotReview: 'Required: sand, wet margin and open water must be visible in the actual capture.'};
}
