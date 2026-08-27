# Build and deployment

No production deployment or push was performed. Do not publish until the owner approves the content and merchant setup.

The build preserves the existing GitHub Pages base:
/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/

Astro generates static routes and _store assets. The integration copies original src/ and assets/ without modifying them, places the preserved entry at legacy-game/index.html, includes the existing reward SDK at legacy-game/reward-sdk.js, and writes .nojekyll. All game resource URLs resolve through the configured base.

## Preview the build

```powershell
npm.cmd run build
node scripts/serve-store.mjs
```

The isolated production preview uses port 4181. Open the same nested route there. The dev preview is port 4180. Do not use file:// for ES modules or the game.

## Future Pages release

The repository's existing Pages workflow builds a lean static artifact from repository files. It has NOT been switched to publish this new store. Before a separately approved release, add a Node 24 setup and npm ci/build for this game, then overlay only this game's dist/ into _site/lottominded-ultra.io/games/gothtechnology2/. Exclude store/media-sources, source TypeScript, local output, node_modules, .env files and caches from the published artifact. Keep the rest of the site artifact unchanged. The complete built game subtree must be copied, including lazy chunks, legacy-game, src and assets.

Verify home, shop, all product routes, play, legacy entry, fonts, all media and the existing SDK on the public nested URL after Pages finishes. A successful CI job alone is not public runtime verification. Roll back with a scoped repository release; do not reset unrelated work or move protected tags.

For a custom domain change PUBLIC_SITE_ORIGIN and STORE_BASE_PATH together, rebuild, then verify generated canonical URLs and the game iframe origin. Never hardcode a privileged external iframe origin.
