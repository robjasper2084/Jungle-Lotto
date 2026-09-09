import { resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';

// Game Grid links share the same sibling routes locally and on GitHub Pages.
// A sparse storefront checkout can point at a complete checkout for these games.
const localGamesRoot = resolve(import.meta.dirname, '../..');
const gamesRoot = resolve(process.env.STORE_GAMES_ROOT || localGamesRoot);
const linkedGames = ['opengw-levels', 'shadow-ops-canvas'];

export function linkedGameFile(pathname, base) {
  const parent = new URL('../', `http://localhost${base}`).pathname;
  for (const game of linkedGames) {
    const prefix = `${parent}${game}/`;
    if (!pathname.startsWith(prefix)) continue;
    const root = resolve(localGamesRoot, game);
    let relative = decodeURIComponent(pathname.slice(prefix.length));
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) throw new Error('Invalid game path');
    return existsSync(file) ? file : resolve(gamesRoot, game, relative);
  }
  return null;
}
