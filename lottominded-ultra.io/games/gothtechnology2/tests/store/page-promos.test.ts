import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { pagePromos } from '../../store/content/page-promos.ts';
import { schedulePagePromo } from '../../store/ui/page-promo-timer.ts';

function fakeClock() {
  let now = 0, id = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  return {
    later(callback: () => void, delayMs: number) {
      const key = ++id;
      tasks.set(key, { at: now + delayMs, callback });
      return () => { tasks.delete(key); };
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
    pending: () => tasks.size,
  };
}

test('only the three requested routes have timed introductions', () => {
  assert.deepEqual(Object.keys(pagePromos), ['play/', 'lookbook/', 'lottomind/']);
  assert.deepEqual(Object.values(pagePromos).map(promo => [promo.id, promo.delayMs]), [
    ['swoop-detroit', 5_000], ['static-royale', 20_000], ['lottomind-companion', 40_000],
  ]);
  assert.equal(pagePromos['play/'].url, 'arcade/swoop-detroit/');
  assert.equal(pagePromos['lookbook/'].url, 'arcade/swoop-detroit/royale.html');
  assert.equal(pagePromos['lottomind/'].url, 'https://robjasper2084.github.io/Jungle-Lotto/lotto%20mind%20refined/?route=companion');
});

for (const promo of Object.values(pagePromos)) {
  test(`${promo.id} opens at ${promo.delayMs / 1000} seconds, never earlier, and only once`, () => {
    const clock = fakeClock();
    let appearances = 0;
    schedulePagePromo(promo.delayMs, { canShow: () => true, show: () => { appearances++; } }, clock.later);
    clock.advance(promo.delayMs - 1);
    assert.equal(appearances, 0);
    clock.advance(1);
    assert.equal(appearances, 1);
    clock.advance(120_000);
    assert.equal(appearances, 1);
    assert.equal(clock.pending(), 0);
  });
}

test('a hidden page, busy dialog or focused field postpones the introduction', () => {
  const clock = fakeClock();
  let blocked = true, appearances = 0;
  schedulePagePromo(5_000, { canShow: () => !blocked, show: () => { appearances++; } }, clock.later);
  clock.advance(8_000);
  assert.equal(appearances, 0);
  blocked = false;
  clock.advance(500);
  assert.equal(appearances, 1);
  assert.equal(clock.pending(), 0);
});

test('leaving the page or starting a game cancels a pending introduction', () => {
  const clock = fakeClock();
  let appearances = 0;
  const cancel = schedulePagePromo(5_000, { canShow: () => true, show: () => { appearances++; } }, clock.later);
  clock.advance(4_000);
  cancel();
  clock.advance(60_000);
  assert.equal(appearances, 0);
  assert.equal(clock.pending(), 0);
});

test('cancellation also releases a postponed introduction', () => {
  const clock = fakeClock();
  const cancel = schedulePagePromo(5_000, { canShow: () => false, show: () => assert.fail('cancelled') }, clock.later);
  clock.advance(5_000);
  assert.equal(clock.pending(), 1);
  cancel();
  assert.equal(clock.pending(), 0);
});

test('popup wiring starts after load, uses shared accessible dialogs, and never embeds or autoplays an app', async () => {
  const component = await readFile(new URL('../../store/components/PagePromo.astro', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../../store/ui/page-promos.ts', import.meta.url), 'utf8');
  assert.match(component, /aria-labelledby="page-promo-title" aria-describedby="page-promo-description"/);
  assert.match(component, /data-close-dialog aria-label=.*autofocus/);
  assert.match(component, /Continue browsing/);
  assert.match(component, /min-height:44px/);
  assert.doesNotMatch(component, /<iframe|<video|<audio|autoplay|animation:[^n]/);
  assert.match(controller, /window\.addEventListener\('load', start/);
  assert.match(controller, /window\.addEventListener\('pagehide', dispose/);
  assert.match(controller, /document\.addEventListener\('store:game-launch', dispose/);
  assert.match(controller, /openDialog\(dialog\.id\)/);
  assert.doesNotMatch(controller, /location\.(href|assign|replace)\s*[=(]|window\.open/);
});

test('all popup artwork and the current Elmwood loading image are packaged locally', async () => {
  const assets = new Set([...Object.values(pagePromos).map(promo => promo.image), 'media/elmwood-loading-current.png']);
  for (const path of assets) {
    const info = await stat(new URL(`../../store/public/${path}`, import.meta.url));
    assert.ok(info.isFile() && info.size > 0, path);
  }
  const elmwood = await readFile(new URL('../../store/components/ElmwoodPopup.astro', import.meta.url), 'utf8');
  assert.match(elmwood, /href\('media\/elmwood-loading-current\.png'\)/);
  assert.doesNotMatch(elmwood, /media\/elmwood-explorer-preview\.png/);
  const png = await readFile(new URL('../../store/public/media/elmwood-loading-current.png', import.meta.url));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1344, 752]);
});
