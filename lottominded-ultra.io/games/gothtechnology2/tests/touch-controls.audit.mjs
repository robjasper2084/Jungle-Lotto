import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const out = new URL('../output/touch-controls/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  for (const game of ['goth', 'maze']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(`${game}: ${error.message}`));
    await page.addInitScript(() => {
      localStorage.setItem('lottomind.jackpotMaze.settings.v1', JSON.stringify({ tutorialSeen: true, muted: true, reducedMotion: true }));
    });
    async function boot() {
      await page.goto(game === 'goth' ? `${process.env.GOTH_URL || 'http://127.0.0.1:4197'}/games/gothtechnology2/` : process.env.MAZE_URL || 'http://127.0.0.1:5192/');
      if (game === 'goth') {
        await page.waitForFunction(() => window.__gothTechnologyGame?.phase === 'title');
        await page.evaluate(() => window.__gothTechnologyGame.openMode('training'));
        await page.waitForFunction(() => window.__gothTechnologyGame.matchAssetsReady, { timeout: 60000 });
        const box = await page.locator('#game').boundingBox();
        await page.locator('#game').click({ position: { x: 804 / 1280 * box.width, y: 594 / 720 * box.height } });
        await page.waitForFunction(() => ['versus', 'fight'].includes(window.__gothTechnologyGame.phase));
        await page.evaluate(() => { const g = window.__gothTechnologyGame; g.roundMessageTimer = 0; g.update(1 / 60); });
        await page.waitForFunction(() => window.__gothTechnologyGame.phase === 'fight');
        await page.evaluate(() => { const game = window.__gothTechnologyGame; game.roundMessageTimer = 0; game.render(); });
      } else {
        await page.getByRole('button', { name: /Enter the Maze/ }).click();
        await page.waitForSelector('.game-canvas canvas');
      }
      await page.waitForSelector('.touch-deck .td-control:not(:disabled)');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await boot();
    async function bounds(label) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `${out}/${game}-latest.png` });
      const rects = await page.locator('.touch-deck .td-control, .td-customize').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label'), x: r.x, y: r.y, w: r.width, h: r.height };
      }));
      const viewport = page.viewportSize();
      for (const r of rects) assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= viewport.width + 1 && r.y + r.h <= viewport.height + 1 && r.w >= 44 && r.h >= 44, `${label} clipped: ${JSON.stringify(r)}`);
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        assert(!(a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1), `${label} overlapping: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
      }
    }
    await bounds(`${game} portrait`);
    if (game === 'goth') {
      const session = await context.newCDPSession(page);
      const stick = await page.locator('.td-stick').boundingBox();
      const attack = await page.locator('.td-action').first().boundingBox();
      const point = { x: stick.x + stick.width * 0.85, y: stick.y + stick.height / 2, id: 1 };
      const punch = { x: attack.x + attack.width / 2, y: attack.y + attack.height / 2, id: 2 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, punch] });
      const moved = { ...point, x: point.x + 40 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved, punch] });
      assert.equal(await page.evaluate(() => window.__gothTechnologyGame.input.isDown('p1.right') && window.__gothTechnologyGame.input.isDown('p1.lightPunch')), true);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [punch] });
      assert.deepEqual(await page.evaluate(() => ({ right: window.__gothTechnologyGame.input.isDown('p1.right'), punch: window.__gothTechnologyGame.input.isDown('p1.lightPunch') })), { right: true, punch: false });
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await page.evaluate(() => window.__gothTechnologyGame.input.isDown('p1.right')), false);
    } else {
      const stick = await page.locator('.td-stick').boundingBox();
      await page.touchscreen.tap(stick.x + stick.width * 0.9, stick.y + stick.height / 2);
      await page.waitForFunction(() => !document.querySelector('.live-mission-strip')?.textContent.includes('MOVE TO START'));
    }
    await page.screenshot({ path: `${out}/${game}-portrait.png` });
    await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
    await page.getByLabel('Selected control', { exact: true }).selectOption('1');
    const editButton = page.locator('.td-editor .td-action').first();
    const editRect = await editButton.boundingBox();
    await page.mouse.move(editRect.x + editRect.width / 2, editRect.y + editRect.height / 2);
    await page.mouse.down(); await page.mouse.move(editRect.x - 30, editRect.y - 20); await page.mouse.up();
    assert.notEqual(await page.getByLabel('Horizontal position', { exact: true }).inputValue(), game === 'goth' ? '70' : '81');
    await page.getByLabel('Assigned action', { exact: true }).selectOption(game === 'goth' ? 'p1.dash' : 'up');
    await page.getByLabel('Size', { exact: true }).fill('64');
    await page.getByLabel('Opacity', { exact: true }).fill('65');
    await page.getByLabel('Horizontal position', { exact: true }).fill('54');
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await boot();
    const assigned = page.locator('.td-action').first();
    assert.equal(await assigned.getAttribute('aria-label'), game === 'goth' ? 'Dash' : 'UP');
    assert.equal(await assigned.evaluate(node => node.style.width), '64px');
    assert.equal(await assigned.evaluate(node => node.style.opacity), '0.65');
    await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
    await page.getByRole('button', { name: 'Left handed', exact: true }).click();
    await page.screenshot({ path: `${out}/${game}-editor.png` });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await assigned.getAttribute('aria-label'), game === 'goth' ? 'Dash' : 'UP');
    await page.setViewportSize({ width: 844, height: 390 });
    await bounds(`${game} landscape`);
    await page.screenshot({ path: `${out}/${game}-landscape.png` });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await bounds(`${game} narrow`);
    if (game === 'maze') {
      await page.goto(process.env.MAZE_URL || 'http://127.0.0.1:5192/');
      await page.locator('.run-customizer summary').click();
      await page.getByRole('button', { name: /2 Player Co-op/ }).click();
      await page.getByRole('button', { name: /Launch Customized Run/ }).click();
      await page.waitForSelector('.touch-deck .td-control:not(:disabled)');
      assert.equal(await page.locator('.td-stick').count(), 2);
      await bounds('maze co-op');
      await page.screenshot({ path: `${out}/maze-coop.png` });
    }
    await context.close();
    console.log(`PASS ${game}: portrait, landscape, 320px, assignment, size, opacity, save/reload, cancel`);
  }
  assert.deepEqual(failures, []);
} finally { await browser.close(); }
