# LottoMind Site Rebuild Checklist

This matrix records the current release-signoff evidence for the upgrade branch. Use `Pass`, `Fail`, `Blocked`, `Measured`, or `Not applicable`. `Measured` means performance telemetry was captured but no release budget has been approved; it is not an optimization claim.

## Evidence

### 2026-08-11 v2-rc9 Release Candidate

- Candidate source: the current `upgrade-redesign` maintenance build served at `http://127.0.0.1:8624/`.
- Source browser suite: 230 passed, 8 intentional skips, 0 failed.
- Route matrix: 162/162 passed across source and staging.
- Release audit: all 10 groups passed; staging safety passed 12/12; backend contract passed; Trivia passed 13/13.
- Git-tracked site payload: approximately 0.72 GiB across 1,308 files. Local dependencies and generated test output are not part of that tracked payload.
- Hosted staging: `Blocked`; no isolated remote preview provider is configured.
- Commerce operations: `Blocked`; ordering remains locked pending verified inventory, shipping, tax, returns, confirmation email, and tracking.
- Media behavior: Live Events uses its featured performance video without the separate background player. Unmuted autoplay is attempted, but browsers may require a user gesture.
- Navigation and shared surfaces: Spheres and Robot RAHBEE remain Arcade experiences rather than top-level header tabs; the Spheres page no longer carries Magic 8 or the instrument console.
- Step 34 and production merge authorization are recorded for `v2-rc9`.

### 2026-08-10 v2-rc8 Release Candidate

- Candidate source: `upgrade-redesign`, synchronized through merge commit `c1bc5a7493d4ec31462d7d1c44ddfbf6fbcc74f6` plus the focused release-gate fixes recorded by annotated tag `v2-rc8`
- Lean Pages package: 1,589 files, 944.2 MiB measured, 1,200 MiB maximum gate. The packager omitted 134 unreferenced media files totaling 400.1 MiB without modifying source media.
- Route isolation: `routes:test` now allocates available source and staging ports dynamically instead of assuming port 8142. The full source/staging gate passed 168/168, and the packaged artifact route smoke passed 84/84.
- Shared interactive surfaces: the complete compact instrument console is present on News and Live Events, and the desktop Magic 8 oracle is 30% smaller while retaining its input and action controls.
- Hosted staging: `Blocked`; no isolated remote preview provider is configured
- Commerce operations: `Blocked`; Storefront ordering remains locked pending verified inventory, shipping, tax, returns, confirmation email, and tracking
- Arcade discovery and Trivia launcher visual states: `Pass` in fresh desktop/mobile verification. Grid mode exposes all 10 routes, Rail mode preserves swipe/scroll browsing, Spheres is first in the shared header, Trivia Quick Play opens a real question, and neither route produced horizontal overflow or browser errors.
- Candidate tests: 232 source browser checks passed with 8 intentional skips; `check:site` 17/17 HTML files; `backend:test` secure contract pass; `games:validate` 10/10 manifest routes; `trivia:test` 13/13; all 10 release-audit groups; `routes:test` 168/168; packaged route smoke 84/84; staging safety 12/12.
- Step 34 and the exact production merge authorization are recorded for `v2-rc8`.

- Production baseline: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`, with 69 route captures in [`visual-baseline/v1/`](visual-baseline/v1/)
- Audited site content: immutable target of annotated tag `v2-rc8`; visual source commit `afbf7a58ab89750e65f7051ba34ecefe3057984f`
- Current staging captures: 81/81 passed across 27 routes at `1440x900`, `768x1024`, and `390x844`
- Contact sheets: [desktop](staging-reviews/release-signoff-assets/desktop-contact-sheet.png), [tablet](staging-reviews/release-signoff-assets/tablet-contact-sheet.png), and [mobile](staging-reviews/release-signoff-assets/mobile-contact-sheet.png)
- Machine-readable results: [`release-signoff-manifest.json`](staging-reviews/release-signoff-assets/release-signoff-manifest.json)
- Route gate: 168/168 passed across source and staging, including Help, Account, visible keyboard focus, reduced motion, console/page errors, same-origin assets, overflow, noindex, preview banner, and environment write protections
- Current staging artifact: 28 pages, 645 same-origin references, and 12/12 safety checks
- Review reports: [`release-candidate-v2-rc8.md`](staging-reviews/release-candidate-v2-rc8.md), [`store-membership-definition.md`](staging-reviews/store-membership-definition.md), and [`help-media-release.md`](staging-reviews/help-media-release.md)

## Sign-Off Matrix

| Route | Source | Production screenshot | Staging screenshot | Desktop | Tablet | Mobile | Keyboard | Reduced motion | Console/assets | Metadata/safety | Performance | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Opens directly on the value proposition; story and soundtrack controls remain user accessible |
| `/features-app.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/memberships.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Assigned soundtrack and visible sound control verified; guarded checkout preserved |
| `/news/` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Publisher imagery is cached locally; final sign-off recorded zero external-asset warnings |
| `/live-events.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/lottery-spheres.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/beat2lotto-plus.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/merch-store.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Two-product launch catalog reviewed at desktop/mobile; ordering remains locked pending verified fulfillment |
| `/how-to-use.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/privacy.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/terms.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/accessibility.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/product.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Route not present |
| `/create.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Route not present |
| `/prompt-lab.html` | Required + arcade | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/redeem.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/contact.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/help.html` | Support route | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Mobile actions clear fixed Credits and Menu controls; no v1 route existed |
| `/account.html` | Upgrade route | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Unified dashboard verified at desktop/mobile; service data and device-only activity remain clearly separated; no v1 route existed |
| `/services/` | Commercial services route | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | New B2B route; local-only inquiry draft, explicit starting prices, and no undocumented client or result claims |
| `/404.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/gothtechnology2/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/lottomind-jackpot-maze/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/lottomind-313-fortune-grid/` | Arcade manifest | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | New route; 3/3 current staging states passed with visible setup controls and no v1 route |
| `/games/opengw-levels/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/shadow-ops-canvas/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/raytrace-pong-background/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/lottomind-trivia/` | Arcade manifest | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | New Trivia Vault route; 3/3 staging states passed and local-only scores remain clearly separated from verified credits |
| `/lottery-spheres.html#spheres` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/lottomind-stem-studio/` | Required + arcade | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |

## Release Boundary

The matrix closes the current documentation gap; it does not authorize production. The staging artifact remains noindex and fail-closed for live payments, production account writes, real redemptions, and production analytics. Authenticated Stripe Sandbox handoff and cancellation passed without payment entry or charge. Store ordering remains locked pending verified operations. Production approval remains `Not approved`.
