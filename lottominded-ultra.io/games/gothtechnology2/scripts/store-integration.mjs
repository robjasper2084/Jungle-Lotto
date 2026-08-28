import { createReadStream } from 'node:fs';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const original = resolve(root, 'legacy-game/preserved-original-entry/index.html');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.html': 'text/html' };
export async function legacyEntry(base) {
  const html = await readFile(original, 'utf8');
  return html.replace('<head>', `<head>\n    <base href="${base}">`)
    .replace('../../assets/js/lm-game-rewards-sdk.js?v=rewards-sdk-1', './legacy-game/reward-sdk.js?v=rewards-sdk-1')
    .replace('</body>', '    <script src="./legacy-game/bridge.js" defer></script>\n  </body>');
}
export function legacyIntegration() {
  let base = '/';
  return { name: 'gothtechnology-preserved-game', hooks: {
    'astro:config:done': ({ config }) => { base = config.base.endsWith('/') ? config.base : `${config.base}/`; },
    'astro:server:setup': ({ server }) => {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        // Astro rewrites req.url before this integration runs in development.
        // Accept either form, but keep the public base in the generated entry.
        const route = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
        if (route === '/legacy-game/' || route === '/legacy-game/index.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await legacyEntry(base)); return;
        }
        let file;
        if (route === '/legacy-game/reward-sdk.js') file = resolve(root, '../../assets/js/lm-game-rewards-sdk.js');
        else if (route.startsWith('/src/') || route.startsWith('/assets/')) {
          file = resolve(root, decodeURIComponent(route.slice(1)));
          if (!file.startsWith(`${root}${sep}`)) { res.statusCode = 403; res.end(); return; }
        } else return next();
        try { const info = await stat(file); if (!info.isFile()) return next();
          res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
          res.setHeader('Content-Length', info.size); createReadStream(file).pipe(res);
        } catch { res.statusCode = 404; res.end('Game asset unavailable.'); }
      });
    },
    'astro:build:done': async ({ dir }) => {
      const output = fileURLToPath(dir);
      for (const folder of ['src', 'assets']) await cp(resolve(root, folder), resolve(output, folder), { recursive: true });
      await mkdir(resolve(output, 'legacy-game'), { recursive: true });
      await writeFile(resolve(output, 'legacy-game/index.html'), await legacyEntry(base));
      await cp(resolve(root, '../../assets/js/lm-game-rewards-sdk.js'), resolve(output, 'legacy-game/reward-sdk.js'));
      await writeFile(resolve(output, '.nojekyll'), '');
    },
  } };
}
