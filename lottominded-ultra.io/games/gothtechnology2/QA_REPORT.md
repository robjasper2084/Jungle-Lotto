# GOTHTECHNOLOGY — conversion v2 QA

Local review: 2026-08-28. Branch: feature/gothtechnology-store-conversion-v2. HEAD remains e6b36df9d23dabb0cece6b6237ee10a303b3bd2e. This work was not committed, pushed or deployed. The public reference is not evidence that this local revision is live.

## Result and scope

The conversion storefront is implemented and builds as a static Astro site. The final full storefront browser run passes, and the final follow-up layout run passes. The original game remains launchable and its protected source is unchanged by this work, but its wider browser suite has two unresolved failures. This is a local concept preview, not an approved merchant launch.

The owner's later sound request is implemented: home and shop commercials open with audio after an explicit click. Mute, pause, replay and close work. No commercial opens automatically; no initial MP4/MP3 is requested. Inline films and ambient sound still start muted.

## Implemented

- Shared interest/commerce decision, typed nullable product facts and a fail-closed launch gate.
- Launch Loadout preferences/quantities with preview subtotal; no fake order or disabled-checkout dead end.
- Shared consent-aware HTTPS subscription adapter; disconnected state says the email was not saved or sent. No email in local/session storage.
- Clear card actions, product development status, reference/concept labels, product-specific social imagery and demo noindex without Offer schema.
- Reordered homepage, readable mobile typography, compact native mobile filters, active chips and one Experience Settings dialog.
- User-requested films with source cleanup and no idle interruption.
- Static hero fallback, lazy optional display, original artwork/media, ashtray routing and $19.99 charm price.
- Product/collection/fighter links and validated no-op analytics. Game rewards remain local and cosmetic.

## Exact verification results

| Check | Result |
|---|---|
| npm.cmd run check:store | Passed; TypeScript reports no errors |
| npm.cmd run test:store | 27 passed, 0 failed |
| Final complete storefront Playwright run | 57 passed, 0 failed, 3 skipped; 60 total |
| Final layout / capture follow-up after drop-heading fit adjustment | 2 passed, 0 failed |
| npm.cmd run check | Passed: 34 JS files; 56 fighter assets; 39 motions per fighter; 6.79 MiB motion atlases |
| npm.cmd run test:unit | 51 passed, 0 failed |
| Complete original-game Playwright run | 53 passed, 2 failed, 11 skipped; 66 total |
| Focused original-game failure recheck | 1 passed, 2 failed, 1 skipped; 4 total |
| Launch-readiness CLI, default interest configuration | Exit 0; pending facts reported without blocking demo |
| Launch-readiness CLI, approved Shopify mode with missing configuration | Expected exit 1 before any provider request |
| npm.cmd run build, final 17:40 local | Passed; 30 static pages plus sitemap/manifest output |
| git diff --check | Passed; existing LF/CRLF advisory messages are not whitespace errors |

The three storefront skips avoid duplicating desktop-only sitemap, breakpoint and capture sweeps in the mobile project. Game skips are existing project-specific skips.

The latest full store run preceded only the final drop-title font cap. The two subsequent tests reran every requested home/product/shop width, checked the rendered drop-title text fits its box, checked hero type sizes, and recaptured the required sections/routes. No game or functional commerce code changed between these runs.

### Unresolved original-game results

1. tests/browser/game.spec.js:397, desktop keyboard remapping: titleMenuIndex remained 0 after KeyQ when the test expected 1. This repeated in the focused recheck.
2. tests/browser/game.spec.js:227, opponent HUD color sampling: the full run failed on mobile Chromium; the focused recheck passed mobile but failed desktop. The expected red-dominant sample was not stable.

The original game source and that test file match their preservation hashes. These results were not hidden, weakened or patched as part of storefront work. Do not describe the entire game suite as passing. A separate game/UI investigation is needed before release confidence can include these paths. The store wrapper's launch/preselection/forged-message checks passed in desktop, mobile and WebKit projects.

### Earlier problems corrected

- Initial assertions included a deliberately deferred material-dialog image without src; the gallery resolution assertion now checks actual main images with src.
- Native filter disclosure state made desktop fields inaccessible to keyboard automation; desktop now opens it explicitly.
- Old compact typography and nowrap/min-content rules caused small-screen overflow. Scoped component rules now preserve readable type.
- Cross-document view transitions stalled rendering after ordinary navigation. The old transition was removed; final tests use normal browser flags.
- A wider diagnostic label exposed overflow at 320px. The portal information column now reserves enough width.
- Visual review found the desktop Night Protocol heading extending into the image column. Its responsive cap was reduced and a rendered text-fit assertion added.

## Browser / visual QA

| Area | Evidence / result |
|---|---|
| App identity and route | Local 4181 preview title, product text and current-drop anchor confirmed |
| Blank screen or permanent loading overlay | None in reviewed required views; static hero immediately reports Armory Online |
| Storefront console/page errors | No page errors in visual tests; final in-app warning/error log was empty after film interaction |
| Images and media | Main images resolve; video source remains absent until explicit request |
| Interaction | Loadout, options, alerts, search, filters, menus, gallery, settings, films and game wrapper checked |
| Desktop and mobile layout | Home/product/shop sweep at 320, 360, 375, 390, 428, 768, 1024, 1440 and 1920; no page overflow |
| Accessibility | Keyboard/focus/Escape/skip/live-state checks pass; not an assistive-technology certification |

Actual captures inspected: home at all nine widths; Current Drop, Featured, campaign, signals, portal, shop, product, lookbook, About and Play at desktop/mobile; mobile menu; loadout and alert dialogs on desktop/mobile; Experience Settings. Inspection covered cropping, readable copy, product visibility, action hierarchy, overflow and dialog/footer/sticky overlap. Follow-up captures corrected the drop heading and scroll framing of product/filter views.

Tall section captures use normal viewport screenshots rather than enlarging the viewport and moving a sticky header into the middle of the image. Additional raw full-page and browser-project duplicates remain available; the review claims refer to the required focused views above.

The in-app browser verified the local title, rendered content and commercial click/sound-toggle/close sequence. Native capture scaling was unreliable, and some locator-evaluation calls timed out; exact-size screenshots and numeric media-state assertions therefore use the explicitly requested Playwright suite.

### Evidence locations

All evidence is local, outside the repository:

C:/Users/digit/AppData/Local/Temp/goth-store-v2-20260828/

- store-v2-release-check.json — complete store run, 57/0/3.
- browser-release-check/ — complete-run screenshots, dialog/settings captures and performance.json files.
- store-v2-layout-final.json — final two-test layout/capture run.
- browser-layout-final/store-widths-320-through-1-27592-w-or-hide-purchase-controls-desktop/ — home-320.png through home-1920.png.
- browser-layout-final/store-responsive-evidence--f0f60-uct-lookbook-about-and-play-desktop/ — drop, featured, campaign, signals, portal, shop, product, lookbook, about and play, each with 1440/390 suffix, plus mobile-menu.png.
- browser-release-check/store-shopping-cart-launch-74de8-stence-alert-flow-and-focus-{desktop,mobile}/ — launch-loadout.png and launch-alert.png.
- browser-release-check/store-conversion-UI-keyboa-55c3d--settings-and-sticky-action-{desktop,mobile}/ — experience-settings.png.
- game-final.json and game-final/ — complete original-game run and failures.
- game-recheck.json and game-recheck/ — focused game recheck.
- readiness-demo.txt and readiness-blocked.txt — CLI gate probes.
- before.patch, before-status.txt and protected hash snapshots — preservation evidence.

## Locally measured

Unthrottled Chromium desktop: LCP 196ms, CLS 0, DOMContentLoaded 52.1ms. Pixel 7 emulation: LCP 180ms, CLS 0, DOMContentLoaded 58.5ms. Both requested the 36,710-byte 1600px hero; the narrow high-DPR phone did not request the 2048px source. See PERFORMANCE.md for sampling limits and the full table. These are not field Core Web Vitals or Lighthouse claims.

The lazy bundle warning above 500kB remains. No dependency install/npm ci was run; existing dependencies were reused while C: had less than 0.5GB free.

## Preservation audit

Original entries, protected game source/tests/config, lockfile and supplied model assets retain their captured hashes. The initial 16:10 snapshot matches 25 of 26 files. Its only mismatch is the parent Pages workflow, which had already changed by the 16:26 parent checkpoint; both files in that later checkpoint still match. That existing workflow/catalog diff was left untouched. Do not stage all dirty files as if conversion v2 authored them.

No original uploads were deleted. Uploaded models and conversion dependencies remain on disk, but the rejected model bindings/showroom were not restored. No reset, clean, stash, commit, push, deployment, payment activation or indexing approval occurred.

## Owner action required / blocked

- Approve actual merchandise, prices, variants, inventory, measurements, materials, care, manufacturing claims, packaging/inclusions and final photography.
- Supply selling identity, monitored contacts, shipping/return facts and owner-reviewed privacy/terms/accessibility content.
- Approve and test a real consent/email service before collecting email; confirm delivery, rate limiting, allowed origins and unsubscribe.
- Configure and test the merchant Shopify provider/cart/checkout before setting launch approvals.
- Review film rights, captions/transcripts and final media labels.
- Review the unresolved original-game test failures and approve the scoped release separately.

See OWNER_LAUNCH_CHECKLIST.md, OWNER_ASSET_CHECKLIST.md, COMMERCE_SETUP.md and ANALYTICS_EVENTS.md.

## Not tested / future enhancement

Real Shopify/payment inventory, delivery of email, a deployed v2 build, production CDN behavior, Lighthouse/field metrics, physical-device controller/touch testing, screen readers, exhaustive contrast/zoom/forced-colors testing, approved GLB appearance/context loss and legal compliance are not certified. Optional 3D remains a future enhancement, not a shopping requirement.

## Exact local preview

From PowerShell:

```powershell
Set-Location -LiteralPath 'C:/Users/digit/Documents/phone/_gothtechnology_live_20260826/lottominded-ultra.io/games/gothtechnology2'
npm.cmd run build
node scripts/serve-store.mjs
```

Open http://127.0.0.1:4181/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/ . If that preview is already running, open the URL instead of starting another server. For source development, npm.cmd run dev uses port 4180.

Future deployment requires separate owner approval, review of the scoped dirty changes, clean checks including the game failures, approved launch data/service configuration, then the existing documented Pages release path and public route/asset verification. Do not enable live payments or indexing as a side effect of publishing an interest preview.

---

## Historical report — 2026-08-27, not the current v2 result

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
