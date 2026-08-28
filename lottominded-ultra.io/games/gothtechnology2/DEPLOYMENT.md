# Build and deployment

The owner approved publishing the current storefront on August 28, 2026. This release remains a demo catalog: payments, fulfillment, and live inventory are disabled. Publishing the preview does not authorize enabling commerce.

The build preserves the existing GitHub Pages base:
/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/

Astro generates static routes and _store assets. The integration copies original src/ and assets/ without modifying them, places the preserved entry at legacy-game/index.html, includes the existing reward SDK at legacy-game/reward-sdk.js, and writes .nojekyll. All game resource URLs resolve through the configured base.

## Preview the build

```powershell
npm.cmd run build
node scripts/serve-store.mjs
```

The isolated production preview uses port 4181. Open the same nested route there. The dev preview is port 4180. Do not use file:// for ES modules or the game.

## GitHub Pages release

The repository's Pages workflow installs this game's locked dependencies with Node 24, runs store and game checks, and builds Astro with PUBLIC_COMMERCE_MODE=demo and PUBLIC_LAUNCH_APPROVED=false. Pull requests validate and assemble the artifact without deploying. A successful main-branch run publishes it through GitHub Pages.

The lean artifact builder replaces only _site/lottominded-ultra.io/games/gothtechnology2/ with this game's complete dist/ tree, including lazy chunks, legacy-game, src, assets, fonts, and supplied media. It excludes this game's authoring tree and rejects private environment files, TypeScript, Astro source, source maps, and symlinks in the generated output. The rest of the static site's assembly rules stay unchanged. Missing required routes or videos fail the build before the existing artifact is removed.

The homepage retains its artwork fallback while the hoodie and charm model paths are null. The gated cathedral scene is not a completed or verified 3D product model experience.

Verify home, shop, all product routes, play, legacy entry, fonts, all media and the existing SDK on the public nested URL after Pages finishes. A successful CI job alone is not public runtime verification. Roll back with a scoped repository release; do not reset unrelated work or move protected tags.

For a custom domain change PUBLIC_SITE_ORIGIN and STORE_BASE_PATH together, rebuild, then verify generated canonical URLs and the game iframe origin. Never hardcode a privileged external iframe origin.
