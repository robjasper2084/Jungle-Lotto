# LottoMind Upgrade Redesign Status

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production branch: `main`
- Production commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Snapshot tag: `v1-final`
- Snapshot annotated tag object SHA: `9ba25352efc17d5b514e5afd59c8afde5c9d2949`
- Snapshot target commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Current upgrade branch implementation SHA: This status file is part of the current focused commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact SHA. The completion report records it explicitly.
- Upgrade branch SHA at Step 0A branch creation: `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a`
- Upgrade branch SHA before Step 0B commit: `220653bbc300d0e0b236c6e834043f39fdfcd76c`
- Step 0B commit SHA: `6e58aafc4addabf5281262ec951a7d6df3dc66a0`
- Deployment mechanism discovered: GitHub Pages Actions from repository-root `.github/workflows/pages.yml`; pushes to `main` upload the repository root with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`. The latest verified successful production run deployed `main` commit `975c637cea7003533cdc30aed9d96be51929bfc8`.
- Staging provider: Local static server (Mode C); no remote preview provider is configured
- Staging URL: Local only (`http://127.0.0.1:8204/` while the current staging server is running)
- Staging integrations: No isolated backend or Stripe test-mode configuration is currently configured; protected writes remain disabled
- Last completed step: Step 34 production release candidate prepared on `upgrade-redesign`; production deployment remains excluded
- Step 1 commit SHA: This file is part of the Step 1 commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact non-self-referential SHA. The completion report records it explicitly.
- Last staging review: Signal and media corrections passed; review: `docs/staging-reviews/signal-media-corrections.md`
- Staging review commit SHA: This file is part of the staging-review commit; the completion report records its exact SHA.
- Last successful test run: 2026-07-22 - site validation passed 15 HTML files; source browser suite passed 96 checks with 6 intentional viewport skips; staging browser suite passed 15/15; source/staging route matrix passed 92/92; staging artifact verified 23 injected pages and 527 same-origin references
- Visual baseline: Complete - 69 production route screenshots plus desktop, tablet, and mobile contact sheets under `docs/visual-baseline/v1/`
- Step 1 visual comparison: Production and staging home routes compared at 1440x900 and 390x844; staging adds only the preview and safety banners, with no redesign changes
- Resolved Step 1 baseline failures: Contact support helper restored; Stem Studio tablet/mobile overflow corrected; Jackpot Maze runtime, heading, and entry focus restored; first-load outliers reduced; staging News production request removed
- Latest visual comparison: Home, Memberships, Guardian, Arcade, RAHBE, Spheres, Storefront, Live Events, and News compared with v1 production at 1440x900, 768x1024, and 390x844; review: `docs/staging-reviews/signal-media-corrections.md`
- Latest performance comparison: Home 28.1 -> 5.80 MiB; Memberships 26.7 -> 2.87 MiB; Merch 23.1 -> 1.99 MiB; Shadow Ops 87.7 -> 3.70 MiB
- Staging review approval status: Ready for next phase
- Production approval status: Step 34 release-candidate preparation approved; the live checkout handoff was verified safely in Stripe Sandbox and cancelled before any charge; pull-request approval and controlled production merge remain pending
- Rollback reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`; after a controlled production merge, use `git revert` for rollback
- Known pre-existing repository changes: The working tree was clean when Step 0A began. Local `main` already contained commit `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a` ahead of `origin/main`; that commit was preserved as the starting point of `upgrade-redesign` and was not pushed to production.

## Billing Response Validation

- Frontend behavior: Billing requests now validate JSON, configuration shape, plan identifiers, and Stripe redirect hosts; stalled, malformed, rejected, and unreachable responses receive distinct accessible messages
- Checkout return behavior: A Stripe return is no longer described as payment confirmation until an active membership is verified from the account service
- Edge Function source: `supabase/functions/lottomind-api/index.ts` is now versioned in the repository with CORS-aware auth responses, JSON body validation, Stripe mode reporting, and checkout/portal URL validation
- Connected backend check: Production function version 5 currently returns `401 AUTH_REQUIRED` with the expected CORS header for an unauthenticated checkout request; no unexplained `500` billing failures appeared in the inspected 24-hour Edge Function log window
- Backend deployment: Not performed because the connected Supabase project exposes only its production `main` branch and production approval is not granted
- Validation limitation: `npm.cmd run check:site` still reports 65 missing references because this sparse checkout intentionally omits large source assets; the independent staging build and same-origin reference check passed
- Cleanup: Generated staging/test output and the Playwright browser cache were removed after validation; they are recreated by the documented build/test commands

## Sparse Checkout Validation

- Validator behavior: Local references pass when the target exists in the working tree or is an exact tracked path in the Git index
- Safety behavior: Untracked missing references still fail with the owning HTML or CSS file and missing path
- Sparse result: The former 65 repeated errors represented 41 unique Git-tracked paths omitted by sparse checkout, not missing production assets
- Staging result: Rebuilt 23 pages and verified 491 same-origin asset references after the validator repair

## Step 34 Prerequisite Remediation

- Step number: Step 34 prerequisite remediation (live checkout excluded)
- Implementation commits: `4b836da`, `69a3fdc`, `20b0db9`, `20906a7`, `a156e6a`, `d1e33ca`, `9c2b6d2`, `98a4c52`, `8fd8a99`, `32b1bbf`
- Tests: 92/92 route checks; 9/9 staging browser checks; 23-page/492-reference static verification; 46/46 Jackpot Maze tests; 24/24 Maze assets; Shadow Ops typecheck and gameplay pixel check
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Approval status: Ready for next phase; not ready for production release-candidate preparation until safe live-checkout verification is complete
- Production state: Remote `main` and `v1-final` remain at `975c637cea7003533cdc30aed9d96be51929bfc8`; the live URL returns 200 without staging markers

## Optional Arcade Pilot

- Step: Optional Arcade Pilot - isolated redesign experiment
- Pilot branch: `upgrade-redesign-arcade-pilot`
- Parent upgrade branch SHA: `b8e6c4a78b94dafae71cec538093adf40ce170f2`
- Pilot commit SHA: `84cbde5e1940aa1b1fbe3ae996c9a4de67dcd103`
- Accepted merge commit SHA: `dd6d2a7d987cc08526cb59f38d2aac7c23819a57`
- Pilot staging URL: Local only (`http://127.0.0.1:8143/features-app.html` while the staging server is running)
- Pilot remote preview: Not configured or deployed
- Pilot review: `docs/staging-reviews/arcade-pilot.md`
- Pilot tests: 2 focused desktop/mobile Arcade checks; 23-page staging static verification with 484 same-origin references; 3 staging browser safety checks; 92 source/staging route smoke checks
- Pilot merge status: Accepted into `upgrade-redesign` with an explicit `--no-ff` merge; historical pilot branch retained
- Post-merge visual verification: Passed at 1440x900 and 390x844 with all eight card images loaded, no horizontal overflow, and no console errors
- Remaining Arcade issues: None introduced by the merge; repository-wide baseline issues remain for source Contact, mobile Stem Studio overflow, and Jackpot Maze heading/focus behavior
- Pilot approval status: Approved and merged into the upgrade branch
- Production approval status: Not approved

## Membership Plan Layout Refinement

- Step number: Browser review refinement - Memberships plan hierarchy
- Commit SHA: This status file is part of the focused layout commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected route: `/memberships.html`
- Changes: Membership Control Deck promoted to the top of main content; accessible document order synchronized; Vault Pass paired beside Ultra on desktop and stacked below it on mobile
- Tests: focused source layout 1/1; focused exact-staging layout 1/1; site validation 14/14 HTML files; staging browser safety 9/9; staging static verification 23 pages and 493 same-origin references
- Route smoke result: Memberships passed source and staging at desktop and mobile sizes; the complete matrix passed 80/92 overall and 46/46 staging checks, with 12 unrelated source sparse-asset failures recorded in the staging review
- Visual review: `docs/staging-reviews/membership-plan-layout.md` with 1440x900 and 390x844 captures
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Approval status: Ready for next phase; production remains not approved

## Membership Support Column Restoration

- Step number: Browser review refinement - Collector and Guardian support columns
- Commit SHA: This status file is part of the focused support-column commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected route: `/memberships.html`
- Changes: Collector Access fixed as the first support column; Little Man Guardian bundle restored to its original second column; mobile order fixed as Collector then Guardian
- Tests: focused source layout 1/1; focused exact-staging layout 1/1; affected staging route smoke 2/2; site validation 14/14 HTML files; staging browser safety 9/9; staging static verification 23 pages and 493 same-origin references
- Visual review: `docs/staging-reviews/membership-plan-layout.md` with refreshed 1440x900 and 390x844 support-column captures
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Approval status: Ready for next phase; production remains not approved

## Features Hybrid Refinement

- Step number: Browser review refinement - Features cinematic shell and Arcade directory
- Commit SHA: This status file is part of the focused Features commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected route: `/features-app.html`
- Changes: Restored a cinematic Features-first opening with Detroit studio art and five creative channels while retaining the searchable, manifest-driven eight-game Arcade directory; replaced invented `Live` labels with `Playable`
- Commercial behavior: Route film starts muted automatically, exposes a user-gesture sound control, and runs once per route in the current tab
- Tests: focused source browser suite 35 passed and 1 intentional viewport skip; staging browser safety 11/11; source/staging route smoke 92/92; staging static verification 23 pages and 495 same-origin asset references
- Visual review: `docs/staging-reviews/features-hybrid.md` with 1440x900, 768x1024, and 390x844 captures; no horizontal overflow and all visual-identity invariants remained recognizable
- Accessibility: Keyboard focus order passed after the commercial handoff; reduced-motion capture reported zero running animations; no inert containers remained
- Performance: Initial mobile transfer was approximately 6.6 MiB and the fully loaded visual route approximately 9.1 MiB; image-weight optimization remains recommended
- Staging URL: Local only (`http://127.0.0.1:8143/features-app.html`)
- Live checkout: Not exercised by this Features refinement
- Approval status: Ready for next phase; production remains not approved

## Requested Corrections Pass

- Step number: Browser-requested correction pass after Features hybrid refinement
- Commit SHA: This status file is part of the focused corrections commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected routes: `/memberships.html`, `/how-to-use.html`, `/live-events.html`, `/news/`, `/lottery-spheres.html#spheres`, plus shared navigation labels
- Changes: Membership decision deck and support columns reordered; marked lower membership region removed; `Lilman` and `Static Wav` labels applied; existing Guide commercial preserved; Live Events soundtrack synchronization restored with a browser-policy fallback; News story images restored; Magic 8 restyled to match the sphere field; mobile marquee collisions corrected
- Tests: focused source checks 3 passed and 1 intentional mobile skip; staging browser safety 11/11; source/staging route smoke 92/92; staging static verification 23 pages and 488 same-origin references; screenshot verification 10/10
- Visual review: `docs/staging-reviews/requested-corrections.md` with 1440x900 and 390x844 captures; no material identity regression found
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Test-mode integrations: No isolated staging backend or Stripe test-mode checkout was configured; all protected staging writes remain blocked
- Approval status: Ready for next phase; production remains not approved

## Signal and Media Correction Pass

- Step number: Browser-requested signal, commercial, navigation, and media refinement
- Commit SHA: This status file is part of the focused correction commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected routes: `/index.html#top`, `/memberships.html`, `/features-app.html`, `/live-events.html`, `/news/`, plus shared navigation surfaces
- Changes: Home commercial delay set to 60 seconds; Home particle globe and title bleed removed; Home and Live Events films use truthful browser-policy fallbacks; Membership hero, plan, Collector, Gaming Showcase, and Guardian order refined; Membership particles connected to Web Audio energy; Guardian uses the supplied gun-range commercial; Arcade restores the existing particle mascot behind brighter Little Man artwork and a cinematic serif title; News card imagery restored; shared tabs renamed to `Games`, `RAHBE`, `Storefront`, and `Static Wav`; Home, Memberships, and Storefront use one legal-footer treatment; Storefront exposes a device-only preorder preview with no transaction claim
- Tests: JavaScript syntax checks passed; focused route suite 12/12; staging browser suite 15/15; source/staging route smoke 92/92; static artifact verification 23 pages and 529 same-origin references; refreshed screenshot verification 30/30
- Visual review: `docs/staging-reviews/signal-media-corrections.md` with refreshed captures across 1440x900, 768x1024, and 390x844; no horizontal overflow, console errors, page errors, or broken assets found
- Staging URL: Local only (`http://127.0.0.1:8204/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Excluded from this task and unchanged
- Approval status: Ready for next phase; production remains not approved

## Header And Membership Follow-up

- Step number: Browser-requested shared header and Membership media follow-up
- Commit SHA: This status file is part of the focused follow-up commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected routes: Shared site header routes, `/memberships.html`, `/features-app.html`, `/news/`, `/beat2lotto-plus.html#beat2lotto`, and `/lottery-spheres.html#spheres`
- Changes: Ten shared tabs use a stable artwork map and fixed circular geometry; navigation no longer hides when clicked; the Beat2Lotto tab reads `RAHBE`; the Membership hero film is brighter with lower contrast; the Guardian card restores deferred gun-range video playback with a matching poster; the Vault Pass reads `$29.99` and includes the Little Man Luggage Charm
- Tests: JavaScript syntax checks passed; focused route regression 12/12; staging browser suite 15/15; source/staging route smoke 92/92; static artifact verification 23 pages and 529 same-origin references; screenshot verification 30/30
- Visual review: `docs/staging-reviews/signal-media-corrections.md` with 1440x900, 768x1024, and 390x844 captures; no broken assets, console errors, page errors, or horizontal document overflow found
- Staging URL: Local only (`http://127.0.0.1:8204/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Approval status: Ready for next phase; production remains not approved

## Homepage Entry And Scan Bars Follow-up

- Step number: Browser-requested homepage entry and scan-bar correction
- Implementation commit SHA: `5a3c208c5eab86b4e23e67214520a8e06e364d91`
- Affected route: `/index.html#top`
- Changes: Restored cyan/gold hero scan bars; preserved a static scan accent for reduced-motion and mobile-performance modes; removed the delayed `Start the home frequency` dialog, scheduler, audio handoff, and focus takeover
- Tests: Homepage static validation passed; focused source browser checks passed; staging browser suite 15/15; source/staging route smoke 92/92; static artifact verification 23 pages and 527 same-origin references; affected-route screenshots 2/2
- Visual review: `docs/staging-reviews/home-entry-scan-bars.md` with 1440x900 and 390x844 comparisons against `docs/visual-baseline/v1/`
- Staging URL: Local only (`http://127.0.0.1:8204/index.html#top` while the staging server is running)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Approval status: Ready for next phase; production remains not approved

## Step 34 Production Release Candidate

- Step number: Step 34
- Release report: `docs/site-rebuild-release-report.md`
- Release-candidate record: `docs/production-release-candidate.md`
- Release-candidate tag: `v2-rc1`
- Audited upgrade baseline: `efc474291fd2f695902ea5d99b39efdca1aec221`
- Tests: site validation passed; source browser suite 96 passed and 6 intentional viewport skips; staging browser suite 15/15; source/staging route matrix 92/92; staging static verification 23 pages and 527 same-origin references
- Staging URL: Local only (`http://127.0.0.1:8204/` while the preview server is running)
- Checkout safety: Stripe Sandbox handoff verified and cancelled before any charge; staging production writes remain blocked
- Approval status: Ready for pull-request review; production merge and deployment not performed

## Popup, Header, And Readability Follow-up

- Step number: Browser-requested popup, header-label, and readability correction
- Commit SHA: This status file is part of the focused popup, navigation, and readability commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve the exact SHA
- Affected routes: `/index.html#top`, `/memberships.html`, `/lottery-spheres.html#spheres`, `/merch-store.html`, `/how-to-use.html`, `/live-events.html`, and `/beat2lotto-plus.html`
- Changes: Removed the selected Home entry dialog and Spheres Jackpot Maze popup; standardized the shared Beat2Lotto tab label as `RAHBE`; enlarged the Magic 8 oracle and Membership control-deck text; brightened the Membership hero film; corrected commercial route priority; retained one Membership commercial and one Storefront unboxing commercial; kept the Static Wav Guide commercial; made the Storefront commercial close control accessible above the persistent header
- Tests: Homepage and site static validation passed; staging static verification passed for 23 pages and 531 same-origin asset references; staging browser suite 10/10; source/staging desktop/mobile route matrix 92/92
- Visual review: Refreshed 1440x900 and 390x844 captures under `lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/` and refreshed Home, Storefront, and RAHBE captures under `docs/staging-reviews/signal-media-corrections-assets/`; compared with `docs/visual-baseline/v1/`
- Intentional visual departures: The selected Home and Spheres popups are absent; Membership copy is larger; the Membership film is brighter and lower contrast; Storefront presents one unobstructed unboxing-film modal
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex, preview banner, blocked live payments, blocked production account writes, blocked real redemptions, and blocked production analytics verified
- Approval status: Not approved for production; production remains unchanged

## Storefront, Guide, And Games Navigation Follow-up

- Step number: Browser-requested Storefront dialog and shared navigation correction
- Implementation commit SHA: `1196c3c019f83010dd0b2c7832ec4c4c68176fe8`
- Affected routes: `/merch-store.html`, `/features-app.html`, `/news/`, and shared header/menu surfaces
- Changes: Refitted the single Storefront commercial for clear desktop and mobile portrait playback; standardized the Guide tab label across static, generated News, and runtime navigation; restored the accessible Games-page `NAV` control for explicitly hiding and restoring the artwork header
- Tests: JavaScript syntax passed; site validation passed for 15 HTML files; News/account tests 20/20; staging browser safety 10/10; source/staging desktop/mobile route matrix 92/92; Games header interaction 1/1; staging screenshot verification 6/6
- Visual review: Refreshed Storefront and Arcade captures at 1440x900, 768x1024, and 390x844 under `docs/staging-reviews/signal-media-corrections-assets/`; compared with `docs/visual-baseline/v1/`
- Intentional visual departures: Storefront uses a narrower cinematic desktop dialog and a full-height mobile film treatment; Games adds a persistent circular `NAV` control while retaining the Guardian artwork, particles, black/gold/cyan/violet color language, and arcade identity
- Verification: No horizontal overflow, console errors, page errors, or broken assets in the six affected-route captures
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed by this correction
- Approval status: Not approved for production; production remains unchanged

## Static Wav Commercial And Storefront HUD Follow-up

- Step number: Browser-requested Static Wav naming, commercial restoration, and Storefront HUD correction
- Implementation commit SHA: `24b7baa4fef620da5bfe1acee9f91f11c9f52cd2`
- Affected routes: `/how-to-use.html`, `/merch-store.html`, `/news/`, and shared header/menu surfaces
- Changes: Restored `Static Wav` as the page, tab, metadata, generated News, and runtime-menu label; restored the existing `Follow the Signal` commercial on every Static Wav page entry; redesigned the single Storefront commercial as a complete futuristic HUD with film viewport, transmission telemetry, signal meter, and visible controls
- Tests: JavaScript syntax passed; site validation passed for 15 HTML files; News/account tests 20/20; staging browser safety 10/10; source/staging desktop/mobile route matrix 92/92; focused Static Wav repeat-entry and Storefront layout checks passed
- Visual review: Refreshed Storefront and Static Wav captures at 1440x900, 768x1024, and 390x844 under `docs/staging-reviews/signal-media-corrections-assets/`; compared with `docs/visual-baseline/v1/`
- Intentional visual departures: Storefront replaces the plain film frame with a cyan/gold/violet/pink HUD; Static Wav retains its original commercial artwork while restoring the requested route name and entry behavior
- Verification: No horizontal overflow, console errors, page errors, or broken assets in the six affected-route captures; the Storefront footer and all actions remain within the viewport
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed by this correction
- Approval status: Not approved for production; production remains unchanged

## Page Transitions, Header Controls, And Commercial Lifecycle Follow-up

- Step number: Browser-requested transition, navigation-control, and commercial-lifecycle correction
- Implementation commits: `e0ff6c6d7081bfce75d94c41d86041aec4828841`, `fbc82fc9a2fc39b4302eced4a9934f137ec336d1`, and `2b04cb1e09de64592b245bb70e10befabb3e73c0`
- Affected routes: Shared internal navigation, `/memberships.html`, `/merch-store.html`, `/how-to-use.html`, `/beat2lotto-plus.html`, `/accessibility.html`, `/contact.html`, `/privacy.html`, and `/terms.html`
- Changes: Added explicit `HIDE NAV` and `SHOW NAV` controls; restored the control runtime on Static Wav and RAHBE; added outbound and arrival transitions to support/legal routes; added distinct transition entry and exit cues; preserved the existing Membership commercial media while presenting it in a Storefront-inspired cyan/gold/violet HUD; requested audible commercial playback immediately with an accurate muted fallback; closed Membership and Storefront commercials automatically at playback end; kept navigation controls out of the way while a modal is active
- Tests: JavaScript syntax and 15-page site validation passed; focused interaction suite 8/8; full source browser suite 112 passed with 6 intentional viewport skips; staging browser safety 10/10; clean source/staging route matrix 92/92; staging static verification 23 pages and 542 same-origin asset references
- Visual review: Refreshed Membership commercial, Storefront, Static Wav, and RAHBE captures at 1440x900, 768x1024, and 390x844 under `docs/staging-reviews/signal-media-corrections-assets/`; all 12 captures passed noindex, staging-banner, overflow, console, page-error, and asset checks
- Intentional visual departures: The Membership commercial now uses clipped HUD corners, member-uplink status, stronger film framing, and a clearer footer action row; its commercial video source remains unchanged
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed by this correction
- Production approval status: Not approved; production remains unchanged

## Storefront Guardian Bundle Packages

- Step number: Browser-requested Storefront bundle package addition
- Implementation commit: `c1d259828011af1176e606bbe1f79ed3eadb3cc9`
- Affected route: `/merch-store.html#drop`
- Changes: Added Guardian Hoodie Package and Detroit Carry Package previews using the supplied artwork; packages expose local wishlist saving but no checkout action, invented price, inventory, or availability claim
- Commerce status: Existing individual-product preorder preview remains device-only; bundle pricing, sizing, availability, and final contents are marked unconfirmed
- Tests: Site validation passed 15 HTML files; focused Storefront browser checks passed 2/2; affected source/staging route smoke passed 4/4; full route matrix passed 92/92 before the focused commit; staging safety passed 10/10; staging static verification passed 23 pages and 544 same-origin references
- Visual verification: `docs/staging-reviews/storefront-bundles.md`; staging captures passed at 1440x900 and 390x844 with both images loaded, no horizontal overflow, no console errors, staging banner present, and noindex active
- Performance note: Two lazy-loaded supplied PNG assets total approximately 4.15 MiB; optimized WebP or AVIF delivery remains recommended
- Staging URL: Local only (`http://127.0.0.1:8143/merch-store.html#drop`)
- Approval status: Ready for next phase; production remains unchanged and not approved

## Arcade Hero Guardian Film

- Step number: Browser-requested Arcade hero media update
- Implementation commit: `9f83a7f7b4c7b59943df1428c04983c18899ac1b`
- Affected route: `/features-app.html`
- Changes: Added the supplied Detroit Guardian film to the marked right side of the Arcade hero; preserved the original entry commercial and background artwork; added responsive 16:9 framing, a poster, muted autoplay, a pause/play control, visibility handling, and reduced-motion behavior
- Tests: JavaScript syntax passed; site validation passed for 15 HTML files; focused Arcade film checks passed 2/2; affected source/staging route smoke passed 4/4; staging safety passed 10/10; full source/staging desktop/mobile route matrix passed 92/92; staging static verification passed 23 pages and 546 same-origin asset references
- Visual review: `docs/staging-reviews/arcade-hero-film.md`; staging captures passed at 1440x900 and 390x844 with a 16:9 film frame, no copy overlap, no horizontal overflow, no console or page errors, noindex present, and the staging banner visible
- Intentional visual departure: A post-entry Guardian film now occupies the Arcade hero media position while the v1 entry commercial, Guardian artwork, particles, and black/gold/cyan/violet identity remain recognizable
- Performance note: The supplied H.264 film is approximately 5.25 MiB and uses metadata-only preload; a smaller production encode remains recommended
- Staging URL: Local only (`http://127.0.0.1:8143/features-app.html`)
- Staging safety: Live payments, production account writes, real redemptions, and production analytics remain blocked
- Approval status: Ready for next phase; production remains unchanged and not approved

## Storefront, Popup, Arcade, And News Refinement

- Step number: Browser-requested Storefront, commercial, Arcade, and News correction
- Implementation commit: `4804b2a25e4d96d54d97f24f23daef3867f37ff7`
- Affected routes: `/merch-store.html`, `/memberships.html`, `/how-to-use.html`, `/features-app.html`, `/beat2lotto-plus.html`, `/news/`, and shared header surfaces
- Changes: Set the Detroit Embroidery Hoodie preorder preview to `$89.99`; removed the selected Cyber Brain Glow Hoodie, LottoMind Coin Set, and Boogie Knit gallery entry; enlarged the inline Storefront commercial without mobile overflow; added safe Storefront-linked `Buy Now` actions to all commercial popup systems; limited the header hide control to Static Wav and RAHBE; delayed the Membership popup until the arrival transition completes and removed its duplicate close transition; restored the visible RAHBE game; fitted the Arcade Guardian film beside the hero copy; and changed current News fallback art to local JPG cover-story images
- Commerce safety: `Buy Now` links navigate to the Storefront or Guardian section only. They do not call Stripe, complete checkout, create an order, or bypass staging guards.
- Tests: JavaScript syntax and diff checks passed; site validation passed for 15 HTML files; News/account tests passed 20/20; focused source browser checks passed 22/22 across desktop and mobile; staging safety passed 10/10; source/staging route matrix passed 92/92; staging static verification passed for 23 pages and 543 same-origin asset references
- Visual review: Refreshed 21 staging captures at 1440x900, 768x1024, and 390x844 under `docs/staging-reviews/signal-media-corrections-assets/`; compared with `docs/visual-baseline/v1/`
- Intentional visual departures: Storefront uses a larger commercial capsule and a responsive HUD popup; Membership and Static Wav use matching signal-HUD popup language while retaining their existing films; Arcade uses a true two-column desktop film layout; News uses photographic JPG fallback covers where publisher artwork is absent
- Verification: No horizontal overflow, console errors, page errors, or broken assets were found in the 21 affected-route captures. Black/navy, gold, cyan, violet, Guardian, orb, Detroit, music-technology, and arcade identity remain recognizable.
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed by this correction
- Approval status: Ready for next phase; production remains unchanged and not approved

## Static Wav Storefront HUD Alignment

- Step number: Browser-requested Static Wav commercial visual alignment
- Implementation commits: `710d3a477d0b0eb8e7aba65e9d3f5933b68e4c41` and `19a41a5c3ed07c9e996f849d2318882008917366`
- Affected route: `/how-to-use.html`
- Changes: Restyled the existing Static Wav commercial to match the Storefront HUD language with a clipped cyan/gold frame, larger film bay, desktop signal rail, contained action deck, and stacked mobile layout; kept the original Static Wav commercial video and playback lifecycle unchanged
- Tests: JavaScript syntax and diff checks passed; site validation passed for 15 HTML files; focused Static Wav desktop/mobile checks passed 2/2; staging safety passed 10/10; full source/staging desktop/mobile route matrix passed 92/92; staging static verification passed for 23 pages and 543 same-origin asset references
- Visual review: Refreshed Static Wav captures at 1440x900, 768x1024, and 390x844 under `docs/staging-reviews/signal-media-corrections-assets/`; compared with `docs/visual-baseline/v1/how-to-use--desktop.png` and `docs/visual-baseline/v1/how-to-use--mobile.png`
- Intentional visual departure: The v1 single-column commercial becomes a Storefront-style split HUD on wider viewports while retaining a complete one-column control flow on mobile
- Verification: No horizontal overflow, console errors, page errors, broken assets, or staging-banner overlap in the three affected-route captures
- Staging URL: Local only (`http://127.0.0.1:8143/how-to-use.html`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed
- Approval status: Ready for next phase; production remains unchanged and not approved

## Membership HUD, Arcade Rail, And Particle Cleanup

- Step number: Browser-requested Membership HUD, Arcade directory, Home particle, and Storefront visualizer correction
- Implementation commits: `63d9025a36bcb9d27348590d13af42f4a107e67e` and `34ef2bdaa282d55339c35b8ccbf54d4c02b8c089`
- Affected routes: `/memberships.html`, `/features-app.html`, `/index.html`, and `/merch-store.html`
- Changes: Added a responsive futuristic HUD to the existing inline Membership film; converted the eight-game Arcade directory to a swipeable snap rail; renamed the Raytrace Pong display title to `RAYCHASE PONG`; removed the Home WebGL and floating particle layers; removed the Storefront music-reactive equalizer while retaining its commercial and instrument controls
- Tests: JavaScript checks passed; site validation passed for 15 HTML files; focused Membership/Arcade checks passed 4/4; focused Home/Storefront checks passed 6/6; full source/staging desktop/mobile route matrix passed 92/92; staging safety passed 10/10; staging static verification passed for 23 pages and 541 same-origin references
- Visual review: 12 staging captures passed at 1440x900, 768x1024, and 390x844 with no horizontal overflow, console errors, page errors, or broken assets; compared with `docs/visual-baseline/v1/`
- Intentional visual departures: Home particle effects and the Storefront audio analyzer are removed; the Detroit-inspired cinematic film, scan language, Guardian, orb navigation, black/gold/cyan/violet palette, music tools, and arcade identity remain recognizable
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed
- Production approval status: Not approved; production remains unchanged

## Membership Transition Sequence Correction

- Step number: Browser-requested Membership entry and commercial timing correction
- Commit SHA: This status entry is part of the current focused commit; the completion report records its exact SHA
- Affected route: `/memberships.html`
- Sequence: Arrival transition completes, Membership commercial opens, commercial dismissal starts an outbound transition, and the Membership page is released only after the outbound transition completes
- Tests: JavaScript syntax and site validation passed; focused desktop/mobile sequence tests passed 4/4; full source/staging route matrix passed 92/92; staging safety passed 10/10; staging static verification passed for 23 pages and 541 same-origin references
- Visual review: Membership commercial captures passed at 1440x900, 768x1024, and 390x844; compared with `docs/visual-baseline/v1/`
- Intentional visual departure: None. The existing Membership HUD and commercial media are preserved; only the transition timing and page-release order changed
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Live checkout: Not exercised or changed
- Production approval status: Not approved; production remains unchanged
