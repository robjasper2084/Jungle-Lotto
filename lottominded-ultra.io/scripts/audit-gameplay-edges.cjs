const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const base = process.env.GAME_AUDIT_URL || 'http://127.0.0.1:4197';
const failures = [];
const output = path.join(__dirname, '../games/gothtechnology2/output/gameplay-audit');

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  async function check(name, task) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(8000);
    try { await task(page); assert.deepEqual(errors, [], 'No uncaught gameplay errors'); console.log('PASS', name); }
    catch (error) { failures.push(name); console.error('FAIL', name, error.message); }
    finally { await context.close(); }
  }
  try {
    await check('Goth keyboard release survives focus moving into a button', async page => {
      await page.goto(`${base}/games/gothtechnology2/`);
      await page.waitForFunction(() => window.__gothTechnologyGame?.input);
      const held = await page.evaluate(() => {
        const input = window.__gothTechnologyGame.input;
        input.onKey({ code: 'KeyA', target: document.body, preventDefault() {} }, true);
        input.onKey({ code: 'KeyA', target: document.querySelector('button'), preventDefault() {} }, false);
        return input.isDown('p1.left');
      });
      assert.equal(held, false);
    });
    await check('Goth damaged layout storage can still save a new layout', async page => {
      await page.addInitScript(() => localStorage.setItem('gothtechnology.touch.layout.v2', '7'));
      await page.goto(`${base}/games/gothtechnology2/`);
      await page.waitForFunction(() => window.__gothTechnologyGame?.phase === 'title');
      await page.evaluate(() => window.__gothTechnologyGame.openSettings());
      await page.locator('#editTouchLayout').click();
      await page.getByRole('button', { name: 'Save layout', exact: true }).click();
      assert.equal(await page.locator('.td-editor[open]').count(), 0);
    });
    await check('Maze damaged saved volume does not crash the launcher', async page => {
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('lottomind.jackpotMaze.settings.v1', JSON.stringify({ musicVolume: 9, effectsVolume: -2, hudScale: 'huge' })));
      await page.goto(`${base}/games/lottomind-jackpot-maze/`);
      await page.getByRole('button', { name: /Enter the Maze/ }).waitFor();
      assert.deepEqual(errors, []);
    });
    await check('Maze malformed checkpoint is ignored instead of breaking startup', async page => {
      await page.addInitScript(() => localStorage.setItem('lottomind.jackpotMaze.checkpoint.v1', JSON.stringify({ version: 1, world: 0 })));
      await page.goto(`${base}/games/lottomind-jackpot-maze/`);
      await page.getByRole('button', { name: /Enter the Maze/ }).waitFor();
    });
    await check('Pong holding Space pauses once', async page => {
      await page.goto(`${base}/games/raytrace-pong-background/`);
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, repeat: true }));
      });
      assert.equal(await page.locator('#mode').textContent(), 'paused');
    });
    for (const blocked of [false, true]) await check(`Maze final board reaches results once (storage blocked: ${blocked})`, async page => {
      await page.addInitScript(blockWrites => {
        localStorage.setItem('lottomind.jackpotMaze.checkpoint.v1', JSON.stringify({
          version: 1, savedAt: new Date().toISOString(), world: 9,
          draw: { mode: 'pick3', main: [1, 2, 3] }, playStyle: 'solo', runVariant: 'classic',
          score: 1200, activePlayer: 0, playerScores: [1200, 0], playerLives: [3, 3],
          playerShields: [true, true], lives: 3, shielded: true, revealed: [1, 2, 3],
          nextReveal: 3, pellets: 20, villainEncounters: 0, powerUpsUsed: 0,
          remainingHeartKeys: [], remainingPowerKeys: [], worldCollected: 20
        }));
        if (blockWrites) {
          Storage.prototype.setItem = () => { throw new Error('Storage quota exceeded'); };
          Storage.prototype.removeItem = () => { throw new Error('Storage unavailable'); };
        }
      }, blocked);
      await page.goto(`${base}/games/lottomind-jackpot-maze/`);
      await page.getByRole('button', { name: /Resume Level 10/i }).click();
      await page.getByRole('heading', { name: 'Jackpot Maze Complete', exact: true }).waitFor({ timeout: 20000 });
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const title = await page.locator('.results-card h1').boundingBox();
        const badge = await page.locator('.result-grade').boundingBox();
        assert(badge.y >= title.y + title.height, 'Grade badge must not overlap the result title');
        assert(badge.x >= 0 && badge.x + badge.width <= width, 'Grade badge stays on screen');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      if (!blocked) {
        const runs = await page.evaluate(() => JSON.parse(localStorage.getItem('lottomind.jackpotMaze.playerProgress.v1')).completedRuns);
        assert.equal(runs, 1);
      } else {
        await page.getByRole('status').filter({ hasText: 'Progress is kept for this session only' }).waitFor();
        await page.screenshot({ path: path.join(output, 'maze-session-results.png'), fullPage: true });
        await page.getByRole('button', { name: 'LottoMind Wallet', exact: true }).click();
        assert.equal(await page.locator('.history-item').count(), 1);
      }
    });
    await check('Pong loses held input on blur', async page => {
      await page.route('**/raytrace-pong-background/', async route => {
        const response = await route.fetch();
        const html = (await response.text()).replace(/requestAnimationFrame\(loop\);\s*\}\)\(\);/, 'window.__pongAudit = { keys }; requestAnimationFrame(loop);\n    })();');
        await route.fulfill({ response, body: html });
      });
      await page.goto(`${base}/games/raytrace-pong-background/`);
      const held = await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
        window.dispatchEvent(new Event('blur'));
        return window.__pongAudit.keys.size;
      });
      assert.equal(held, 0);
    });
    await check('Static Wave pause clears held movement, firing and queued bombs', async page => {
      await page.route('**/opengw-levels/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}\nwindow.__staticAudit = { input, startRun, setPaused, get state() { return state; } };` });
      });
      await page.goto(`${base}/games/opengw-levels/`);
      await page.waitForFunction(() => window.__staticAudit);
      const result = await page.evaluate(() => {
        const game = window.__staticAudit;
        game.startRun();
        game.input.keys.add('KeyW');
        game.input.mouse.down = true;
        game.input.bombQueued.add(0);
        game.setPaused(true);
        game.setPaused(false);
        return { keys: game.input.keys.size, firing: game.input.mouse.down, bombs: game.input.bombQueued.size, status: game.state.status };
      });
      assert.deepEqual(result, { keys: 0, firing: false, bombs: 0, status: 'running' });
    });
  } finally { await browser.close(); }
  if (failures.length) process.exitCode = 1;
})();
