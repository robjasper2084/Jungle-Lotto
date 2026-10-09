const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

const base = process.env.GAME_AUDIT_URL || 'http://127.0.0.1:4197';
const output = path.join(__dirname, '../games/gothtechnology2/output/pubg-controls');

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const game of process.env.CONTROL_GAMES?.split(',') || ['goth', 'static']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (game === 'static') await page.route('**/opengw-levels/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}\nwindow.__staticTouchTest = { mobileControls, collectCommands, get state() { return state; } };` });
      });
      const url = game === 'goth' && process.env.GOTH_GAME_URL ? process.env.GOTH_GAME_URL : `${base}/games/${game === 'goth' ? 'gothtechnology2' : 'opengw-levels'}/`;
      async function boot() {
        await page.goto(url);
        if (game === 'goth') {
          await page.waitForFunction(() => window.__gothTechnologyGame?.phase === 'title');
          await page.evaluate(() => window.__gothTechnologyGame.openMode('training'));
          await page.waitForFunction(() => window.__gothTechnologyGame.matchAssetsReady, { timeout: 60000 });
          const box = await page.locator('#game').boundingBox();
          await page.locator('#game').click({ position: { x: 804 / 1280 * box.width, y: 594 / 720 * box.height } });
          await page.waitForFunction(() => ['versus', 'fight'].includes(window.__gothTechnologyGame.phase));
          await page.evaluate(() => { const g = window.__gothTechnologyGame; g.roundMessageTimer = 0; g.update(1 / 60); });
          await page.waitForFunction(() => window.__gothTechnologyGame.phase === 'fight');
          await page.evaluate(() => window.__gothTechnologyGame.render());
        } else {
          await page.getByRole('button', { name: 'Start Sector 1', exact: true }).click();
          await page.waitForFunction(() => window.__staticTouchTest?.state.status === 'running', { timeout: 45000 });
          await page.evaluate(() => { window.__staticTouchTest.state.players[0].invuln = 999; });
        }
        await page.waitForSelector('.td-battle .td-control:not(:disabled)');
      }
      const center = async selector => {
        const box = await page.locator(selector).boundingBox();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      async function pointer(selector, type, id, dx = 0, dy = 0) {
        const point = await center(selector);
        await page.locator(selector).dispatchEvent(type, { pointerId: id, pointerType: 'touch', clientX: point.x + dx, clientY: point.y + dy, button: 0, bubbles: true });
      }
      async function bounds(label) {
        if (game === 'goth') {
          const visible = await page.evaluate(() => {
            const game = window.__gothTechnologyGame; game.render();
            const data = game.ctx.getImageData(0, 0, game.canvas.width, game.canvas.height).data;
            let count = 0; for (let i = 0; i < data.length; i += 1600) if (data[i] + data[i + 1] + data[i + 2] > 24) count++;
            return count;
          });
          assert(visible > 100, 'Fight canvas must render visible gameplay');
        }
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: path.join(output, `${game}-${label}.png`) });
        const rects = await page.locator(`.td-battle .td-control, .td-battle .td-customize${game === 'static' ? ', #forgeToggleAction:not([hidden]), #statusStrip' : ''}`).evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label') || node.id, x: r.x, y: r.y, w: r.width, h: r.height, passive: node.id === 'statusStrip' };
        }));
        const view = page.viewportSize();
        const geometry = await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], root: document.querySelector('.td-battle').getBoundingClientRect().toJSON(), stage: document.querySelector('.td-battle .td-stage').getBoundingClientRect().toJSON() }));
        for (const r of rects) assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= view.width + 1 && r.y + r.h <= view.height + 1 && (r.passive || r.w >= 44 && r.h >= 44), `${label}: clipped ${JSON.stringify({ r, geometry })}`);
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          assert(!(a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1), `${label}: overlap ${a.label} / ${b.label}`);
        }
      }
      await boot();
      await bounds('portrait');

      const moveSelector = '.td-battle [data-control="move"]';
      const session = await context.newCDPSession(page);
      const movePoint = { ...await center(moveSelector), id: 1 };
      const aimOrAttack = game === 'goth' ? '.td-battle [data-control="attack-1"]' : '.td-battle [data-control="aim"]';
      const otherPoint = { ...await center(aimOrAttack), id: 2 };
      const firePoint = game === 'static' ? { ...await center('.td-battle [data-control="fire-right"]'), id: 3 } : null;
      const points = [movePoint, otherPoint, ...(firePoint ? [firePoint] : [])];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map(point => point.id === 1 ? { ...point, x: point.x + 38 } : game === 'static' && point.id === 2 ? { ...point, y: point.y - 40 } : point) });
      if (game === 'goth') {
        assert.equal(await page.evaluate(() => window.__gothTechnologyGame.input.isDown('p1.right') && window.__gothTechnologyGame.input.isDown('p1.lightPunch')), true);
      } else {
        const command = await page.evaluate(() => window.__staticTouchTest.collectCommands()[0]);
        assert(command.move.x > .5 && command.aim.y < -.5 && command.fire, 'Move, aim and fire can be held together');
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      if (game === 'goth') assert.equal(await page.evaluate(() => window.__gothTechnologyGame.input.down.size), 0);
      else {
        await pointer('.td-battle [data-control="aim"]', 'pointerdown', 21, 0, -40);
        assert.equal(await page.evaluate(() => window.__staticTouchTest.collectCommands()[0].fire), false, 'Aim alone must not shoot');
        await pointer('.td-battle [data-control="fire-left"]', 'pointerdown', 22);
        await pointer('.td-battle [data-control="fire-right"]', 'pointerdown', 23);
        await pointer('.td-battle [data-control="fire-left"]', 'pointerup', 22);
        assert.equal(await page.evaluate(() => window.__staticTouchTest.mobileControls.input.fire), true, 'Other fire button remains held');
        await pointer('.td-battle [data-control="fire-right"]', 'pointerup', 23);
        await pointer('.td-battle [data-control="aim"]', 'pointerup', 21);
        assert.equal(await page.evaluate(() => window.__staticTouchTest.mobileControls.input.fire), false);
        const bombs = await page.evaluate(() => window.__staticTouchTest.state.team.bombs);
        await page.locator('.td-battle [data-control="bomb"]').tap();
        await page.waitForFunction(before => window.__staticTouchTest.state.team.bombs === before - 1, bombs);
      }

      for (const view of [{ width: 320, height: 740 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
        await page.setViewportSize(view);
        await bounds(`${view.width}x${view.height}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
      if (game === 'goth') assert.equal(await page.evaluate(() => window.__gothTechnologyGame.phase), 'pause');
      else assert.equal(await page.evaluate(() => window.__staticTouchTest.state.status), 'paused');
      await page.getByLabel('Selected control', { exact: true }).selectOption(game === 'goth' ? '1' : '2');
      await page.getByLabel('Assigned action', { exact: true }).selectOption(game === 'goth' ? 'p1.throw' : 'bomb');
      await page.getByLabel('Size', { exact: true }).fill('64');
      await page.getByLabel('Opacity', { exact: true }).fill('55');
      await page.getByLabel('Joystick mode', { exact: true }).selectOption('fixed');
      await page.screenshot({ path: path.join(output, `${game}-editor.png`), fullPage: true });
      await page.getByRole('button', { name: 'Save layout', exact: true }).click();
      const target = game === 'goth' ? '.td-battle [data-control="attack-1"]' : '.td-battle [data-control="fire-right"]';
      assert.equal(await page.locator(target).getAttribute('aria-label'), game === 'goth' ? 'Throw' : 'Bomb');
      assert.equal(await page.locator(target).evaluate(node => node.style.opacity), '0.55');
      await boot();
      assert.equal(await page.locator(target).getAttribute('aria-label'), game === 'goth' ? 'Throw' : 'Bomb');
      assert.equal(await page.locator(target).evaluate(node => node.style.width), '64px');
      await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
      await page.getByLabel('Control preset', { exact: true }).selectOption('claw4');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await page.locator(target).getAttribute('aria-label'), game === 'goth' ? 'Throw' : 'Bomb');
      for (const preset of ['thumbs', 'claw3', 'claw4']) {
        for (const view of [{ width: 390, height: 844 }, { width: 568, height: 320 }]) {
          await page.setViewportSize(view);
          await page.getByRole('button', { name: 'Customize touch controls', exact: true }).click();
          await page.getByLabel('Control preset', { exact: true }).selectOption(preset);
          await page.getByRole('button', { name: 'Save layout', exact: true }).click();
          await bounds(`${preset}-${view.width}`);
        }
      }
      await page.getByRole('button', { name: 'Open pause menu', exact: true }).click();
      assert.equal(await page.locator('.td-battle .td-control:not(:disabled)').count(), 0);
      await page.getByRole('button', { name: 'Open pause menu', exact: true }).click();
      await page.waitForSelector('.td-battle .td-control:not(:disabled)');
      assert.deepEqual(errors, []);
      console.log(`PASS ${game}: native multi-touch, release, presets, editor, pause, save/reload, four viewports`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
