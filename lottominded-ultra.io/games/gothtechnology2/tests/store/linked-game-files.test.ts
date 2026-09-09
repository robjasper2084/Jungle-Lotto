import assert from 'node:assert/strict';
import test from 'node:test';
import {linkedGameFile} from '../../scripts/linked-game-files.mjs';

test('linked games retain sibling URLs under the production prefix', () => {
  const base = '/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
  assert.match(linkedGameFile('/Jungle-Lotto/lottominded-ultra.io/games/opengw-levels/', base)!, /opengw-levels[/\\]index.html$/);
  assert.match(linkedGameFile('/Jungle-Lotto/lottominded-ultra.io/games/opengw-levels/assets/2084/branding/marquee-gameplay-keyart.webp', base)!, /marquee-gameplay-keyart\.webp$/);
  assert.equal(linkedGameFile('/Jungle-Lotto/lottominded-ultra.io/games/unknown/index.html', base), null);
  assert.throws(() => linkedGameFile('/Jungle-Lotto/lottominded-ultra.io/games/opengw-levels/%2e%2e%2fsecret', base));
});
