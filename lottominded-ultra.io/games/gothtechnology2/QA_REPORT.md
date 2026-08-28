# GOTHTECHNOLOGY Armory QA

Verified locally on 2026-08-27, branch `feature/gothtechnology-cinematic-store`. This is a working demo store and preserved playable game, not a merchant launch. No push or deployment was performed.

## Scope and preservation

The new Astro store is under `store/`. The original `index.html`, `src/`, `assets/`, original unit tests, and original browser tests are unchanged. The original entry and `legacy-game/preserved-original-entry/index.html` have the same SHA-256:

`6766FA401D40B22E57C70CF9A291D508D3D37C74BD03E0FA294F453690BF168D`

Development preview: http://127.0.0.1:4180/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/

Production-build QA used the same path on port 4181. The preserved game is loaded only after Launch Game on `play/`.

## Verification results

| Command | Result |
|---|---|
| `npm.cmd run build` | 30 static pages, sitemap, and asset manifest generated |
| `npm.cmd run check:store` | TypeScript passed |
| `npm.cmd run test:store` | 15 passed |
| `npm.cmd run test:store:browser` | 28 passed, 2 intentionally skipped duplicate checks |
| `npm.cmd run check` | 32 JavaScript files checked; 55 fighter assets, 39 motions per fighter, 6.79 MiB motion atlases validated |
| `npm.cmd test` | 51 passed |
| `npm.cmd run test:browser` | 44 passed, 9 existing project-specific skips |
| `git diff --check` | No whitespace errors |

The initial original-game baseline had one keyboard-remapping timing failure (43 passed, 9 skipped). Its isolated retry passed, and the final full unchanged game suite passed with 44 tests. No engine patch was made to hide the earlier intermittent failure.

Store tests cover variants, quantities, repricing and persistence, remove/empty states, demo checkout, search/filter/sort, quick view, keyboard focus and Escape, mobile navigation, reduced motion and WebGL fallback, honest 2.5D product display, opt-in silent video, newsletter consent with no demo POST, game launch and fighter preselection, forged-message rejection, static routes, metadata, and image resolution.

Browser projects: Chromium desktop 1440x900, mobile 390x844, wide 1920x1080, reference width 864x900, WebKit tablet 768x1024, and WebKit desktop 1440x900. A separate layout sweep checked home, product, and shop at widths 320, 360, 390, 428, 768, 1024, 1440, and 1920. No horizontal page overflow was found. Main images resolved and no homepage game engine, motion atlas, MP4, or MP3 was requested.

The actual in-app preview was also inspected and its search opened, used, and closed. The Astro development toolbar is disabled for the presentation preview.

## Reference fidelity ledger

The selected reference was `codex-clipboard-54513477-94c7-473b-96bd-dc24fe830455.png`. It and the latest rendered full-page screenshot were opened together for comparison; desktop, reference-width, mobile, and tablet captures were inspected.

| Reference feature | Final implementation / intentional difference |
|---|---|
| Black surface, thin gold rules, cream serif headlines, cyan diagnostics | Matched throughout; local Cormorant Garamond and Share Tech Mono supply the typography |
| Compact logo, six navigation links, search, gold loadout | Matched desktop structure; tablet/mobile use an accessible menu |
| Cathedral hero, left three-line headline, right garment on pedestal | Matched composition with newly generated campaign art using the supplied 313 pullover and charm |
| Night Protocol drop with left copy, central products, right telemetry | Matched three-column desktop layout; shows the actual requested hoodie and charm instead of inventing an unprovided hoodie reverse |
| Four category vitrines, six featured equipment cards | Matched density and order; product art is clipped from a studio atlas with real HTML links, prices, and controls |
| Four fashion portals | Matched blue/gold/neutral arches and collection labels; portraits are fictional collection concepts, not additional playable fighters |
| Four-panel combat lookbook | Matched compact strip with a new 313 campaign; imagery is labeled concept material |
| City play portal and telemetry | Matched layout; launches the preserved game through the real play page |
| Detroit origin, compact newsletter, multicolumn footer | Matched section sequence and visual treatment; uses the existing Detroit stage and functional local demo disclosures |
| Exact screenshot dimensions | Deliberately not pixel-identical: real text, consent, demo disclosures, keyboard access and readable touch layouts take additional height, especially at 864px |

All headlines, navigation, catalog controls, and prices are HTML. The screenshot was not flattened into a page-sized image.

## Evidence

Latest browser JSON: `output/store-test-results.json`.

For each of `desktop`, `mobile`, `tablet`, `wide`, `reference`, and `webkit`, captures are under:

`output/store-browser/store-visual-homepage-rend-9e38d-does-not-load-game-or-video-{project}/`

Files: `home-viewport.png`, `home-full.png`, `performance.json`. Shopping and play tests also capture the cart and launched game. Output is intentionally local and Git-ignored.

Local unthrottled desktop sample: LCP 212 ms, CLS 0.000044, DOMContentLoaded 47 ms. Mobile sample: LCP 156 ms, CLS 0, DOMContentLoaded 43.3 ms. These are local laboratory observations, not production Core Web Vitals or Lighthouse scores. WebKit does not necessarily expose the same timing APIs as Chromium.

## Remaining launch requirements

- Demo prices, variants and products must be approved before sale. No order, payment, real discount, monetary reward, or email delivery is created in demo mode.
- Shopify adapter behavior is covered by mocked API tests; a real merchant configuration and checkout have not been exercised. No Supabase/Stripe account or infrastructure was provisioned.
- Original references remain on disk; web derivatives are versioned. Campaign concepts are not manufacturing proofs. Final photography, reverse garment view, material/sizing facts, rights, policies and contact information require owner approval.
- Optional GLB product models are not supplied. The hero is artwork with an optional lazy Three.js atmosphere; the product fallback is explicitly 2.5D. This is not a completed full-geometry 3D showroom.
- The lazy Three.js chunk still exceeds Vite's 500 KB warning threshold. Re-test a deployed build on constrained hardware before making public performance claims.
- The existing Pages workflow was not switched to publish this store. Follow `DEPLOYMENT.md` only after separate release approval.
