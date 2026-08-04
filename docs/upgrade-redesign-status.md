# LottoMind Upgrade Redesign Status

- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Production branch: `main`
- Production commit SHA: `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Snapshot tag: `v1-final`
- Snapshot annotated tag object SHA: `9ba25352efc17d5b514e5afd59c8afde5c9d2949`
- Snapshot target commit SHA: `975c637cea7003533cdc30aed9d96be51929bfc8`
- Upgrade branch: `upgrade-redesign`
- Current upgrade branch implementation SHA: `0dc245f2c7eee8ddcaf19599613900bb07f010d4` before this focused verification-documentation commit
- Upgrade branch SHA at Step 0A branch creation: `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a`
- Upgrade branch SHA before Step 0B commit: `220653bbc300d0e0b236c6e834043f39fdfcd76c`
- Step 0B commit SHA: `6e58aafc4addabf5281262ec951a7d6df3dc66a0`
- Deployment mechanism discovered: GitHub Pages Actions from repository-root `.github/workflows/pages.yml`; pushes to `main` upload the repository root with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages`. Current remote production head is `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`.
- Staging provider: Local static server (Mode C); no remote preview provider is configured
- Staging URL: Local only (`http://127.0.0.1:8405/` during the current release sign-off capture)
- Staging integrations: No isolated staging backend is configured; the staging artifact keeps payments, account writes, redemptions, and production analytics disabled. The connected backend was verified separately with Stripe `test` mode.
- Last completed step: Deployed and verified the committed Collector recovery and Stripe mode handlers, then reran every non-authenticated release gate
- Step 1 commit SHA: This file is part of the Step 1 commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact non-self-referential SHA. The completion report records it explicitly.
- Last staging review: Collector Access recovery; review: `docs/staging-reviews/collector-access-recovery.md`
- Staging review commit SHA: This file is part of the staging-review commit; the completion report records its exact SHA.
- Last successful test run: 2026-08-04 - site validation passed 17 HTML files; source browser suite passed 170 with 8 intentional skips; release audit passed 7/7 groups; fresh-port source/staging route matrix passed 156/156; staging browser safety passed 12/12; static staging verification passed 26 pages and 591 same-origin references; visual sign-off passed 78/78 states
- Visual baseline: Complete - 69 production route screenshots plus desktop, tablet, and mobile contact sheets under `docs/visual-baseline/v1/`
- Step 1 visual comparison: Production and staging home routes compared at 1440x900 and 390x844; staging adds only the preview and safety banners, with no redesign changes
- Resolved Step 1 baseline failures: Contact support helper restored; Stem Studio tablet/mobile overflow corrected; Jackpot Maze runtime, heading, and entry focus restored; first-load outliers reduced; staging News production request removed
- Latest visual comparison: Memberships was compared with its v1 references at 1440x900 and 390x844, and all 26 current routes passed desktop, tablet, and mobile sign-off; review: `docs/staging-reviews/release-blocker-remediation.md`
- Latest performance comparison: three presentation videos are 73.4-73.5% smaller; the Account hero is 92.0% smaller; the Arcade marquee is 93.7% smaller. Current staging transfer measurements are recorded in `docs/staging-reviews/help-media-release.md`
- Staging review approval status: Needs authenticated Stripe test Checkout handoff and cancellation before Step 34
- Production approval status: The earlier Step 35 launch was approved and completed through PR #2 using merge commit `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`; the new Phase 1 rollback commit is not approved or merged to `main`
- Rollback reference: `git revert -m 1 09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`; permanent snapshot `v1-final` remains at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Known pre-existing repository changes: The working tree was clean when Step 0A began. Local `main` already contained commit `1fc4c95ca4d0b22ee5188d06f8ea75573c63a00a` ahead of `origin/main`; that commit was preserved as the starting point of `upgrade-redesign` and was not pushed to production.

## Step 34 Preflight Refresh

- Preservation branch: `preserve/pre-step34-20260803-1730` retains all 103 pre-existing uncommitted entries in the original checkout without stashing, resetting, cleaning, deleting, or committing them
- Clean release worktree: `C:\Users\digit\Documents\phone\_jungle_lotto_release_candidate`
- Production synchronization: `origin/main` at `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0` was merged normally into `upgrade-redesign`; merge commit `050ecb279ea4deafe6d75714874c34be486f304d` is pushed
- Branch tracking: the partial clone now fetches `upgrade-redesign`, the local branch tracks `origin/upgrade-redesign`, and the verified divergence is `0 ahead / 0 behind`
- Verification: site validation 17/17 HTML files; source browser suite 160 passed with 8 intentional skips; release audit 7/7; source/staging route matrix 156/156; staging safety 11/11; static staging artifact 26 pages and 591 same-origin references
- Live checkout safety: production billing configuration reports enabled plans and the live Memberships UI reports `Secure Stripe checkout is ready.` A signed-out Gold selection stops at Collector Access with `auth-required`; a direct unauthenticated `/billing/checkout` request returns `401`. No Stripe redirect, payment details, payment submission, or charge occurred

## Collector Access Password Recovery

- Step number: Owner-requested Collector Access sign-in completion
- Implementation commit: This focused commit on `upgrade-redesign`; resolve with `git log -1 --format=%H -- docs/upgrade-redesign-status.md`
- Affected routes: `/index.html#lottomind-refined` and `/memberships.html?collector=access#lm-access-hero`
- Changes: Added Collector Access beside Unlock Vault on Home; added password visibility, Remember me session persistence, Forgot Password, and password-update controls to Collector Access
- Security: Raw passwords are never stored. Remember me chooses local versus tab-scoped session-token storage. Recovery tokens are cleared from the URL after capture.
- Staging safety: Reset emails, password updates, production account writes, live payments, real redemptions, and production analytics remain blocked. No isolated staging account backend is configured.
- Backend status: The committed `lottomind-api` handler is deployed as active Supabase Edge Function version 6. Password recovery responds generically, password update requires an authenticated recovery session, and billing configuration reports Stripe `test` mode.
- Tests: Focused Collector recovery 10/10; full browser suite 170 passed with 8 intentional skips; route matrix 156/156; release audit 7/7; site validation 17 HTML files; staging safety 12/12; static staging 26 pages and 591 same-origin references
- Visual review: `docs/staging-reviews/collector-access-recovery.md`; desktop and mobile captures show no horizontal overflow and preserve LottoMind's visual identity
- Staging URL: Local only (`http://127.0.0.1:8385/`)
- Production approval status: Not approved for this change; `main`, the production URL, and `v1-final` remain unchanged

- Remaining checkout gate: the live configuration now reports Stripe `test` mode, but the existing visible Collector credentials were rejected once with `401`. No retry, password guess, Stripe redirect, payment entry, or charge was attempted. The authenticated test Checkout handoff and cancellation remain incomplete.
- Tag safety: local and remote `v2-rc1` annotated tag objects differ, but both peel to `971dd17accd03be8bd1ff20664ad98734c792867`; no tag was moved, replaced, or deleted
- Review: `docs/staging-reviews/step34-preflight-refresh.md`
- Approval status: Not ready for Step 34; production remains not approved

## News Lottery Results Ticker

- Step number: Owner-requested current Powerball and Mega Millions News ticker
- Implementation commit: This status file is part of the focused commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md`
- Affected route: `/news/`
- Results: Powerball draw dated 2026-08-01 and Mega Millions draw dated 2026-07-31, each linked to an official result source
- Refresh workflow: `npm.cmd run news:refresh-results` fetches, validates, and records both official result sets; malformed or unavailable result pages fail the command without inventing data
- Tests: News unit suite 23/23; News production build; site validation; release audit 7/7; staging browser safety 11/11; focused desktop/mobile and reduced-motion checks
- Visual review: `docs/staging-reviews/lottery-results-ticker.md` with `1440x900` and `390x844` captures
- Staging URL: Local only (`http://127.0.0.1:8365/news/` during focused source validation)
- Production approval status: Not approved; `main`, production deployment, `v1-final`, and existing release tags remain unchanged

## Future Commercial And Publisher Media

- Step number: Owner-requested future commercial, Help film, and News publisher-image pass
- Implementation commit: This status file is part of the focused commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md`
- Affected routes: `/memberships.html`, `/help.html`, `/news/`, and `/lotto%20mind%20refined/`
- Changes: Memberships and the LottoMind App use the supplied future commercial; Help uses the supplied signal film with deferred loading; News uses attributed publisher images for 29 reports and no longer substitutes custom LottoMind artwork
- Tests: News unit suite 20/20; focused browser checks 10/10; affected source/staging route matrix 18/18; staging safety 11/11; static staging 26 pages and 591 references; release audit 7/7
- Visual review: `docs/staging-reviews/future-commercial-media.md` with 1440x900 and 390x844 captures
- Staging URL: Local only (`http://127.0.0.1:8342/`)
- Production approval status: Not approved; `main`, production deployment, `v1-final`, and existing release tags remain unchanged

## Mobile Help And Presentation Media

- Step number: Owner-requested mobile Help, release documentation, and initial media-transfer pass
- Implementation commit: This status file is part of the focused commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md`
- Affected routes: `/help.html`, `/index.html#top`, `/features-app.html`, `/merch-store.html`, and `/account.html`
- Help correction: At `390x844`, the hero and actions use a compact reading layout so `Contact Support` remains above the fixed Credits and Menu controls and receives pointer input
- Home popup: Uses the existing Storefront unboxing commercial and poster while retaining explicit muted-first playback, Play with sound, Enter Site, and close controls
- Media reduction: Optimized MP4 variants are 73.4-73.5% smaller; the Account hero WebP is 92.0% smaller; the Arcade marquee WebP is 93.7% smaller. Original source media remains preserved
- Tests: 154 source browser checks passed with 8 intentional skips; release audit 7/7; route matrix 156/156; staging safety 11/11; static staging 26 pages and 590 references; visual sign-off 75/75
- Visual review: `docs/staging-reviews/help-media-release.md`; contact sheets and manifest are under `docs/staging-reviews/release-signoff-assets/`
- Staging URL: Local only (`http://127.0.0.1:8342/`)
- Production approval status: Not approved; `main`, production deployment, `v1-final`, and all existing RC tags remain unchanged

## Help Center And RAHBEE Depth

- Step number: Owner-requested Help restoration and RAHBEE depth treatment
- Implementation commit: This status file is part of the focused commit; use `git log -1 --format=%H -- docs/upgrade-redesign-status.md` to resolve its exact SHA
- Affected routes: `/help.html`, `/account.html`, `/terms.html`, and `/privacy.html`
- Changes: Added a searchable eleven-topic Help Center; routed shared Help links and Account credits guidance to it; applied existing Robot RAHBEE far, mid, emissive, and rail artwork to Account, Terms, and Privacy while preserving their content and behavior
- Tests: Site validation and focused desktop/mobile Help, Account, Terms, and Privacy checks passed before commit; full route, staging safety, static artifact, and visual-capture results are recorded in the completion report
- Visual review: `docs/staging-reviews/help-rahbee-depth.md` with 1440x900 and 390x844 captures; Help is a new route with no direct v1 screenshot, and the other three routes intentionally change only their depth background and panel treatment
- Commerce and backend impact: None; staging payments, account writes, real redemptions, and production analytics remain blocked
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Shared Header Order And Utility Pills

- Step number: Owner-requested shared header refinement
- Implementation commit: `37297acd4ddc910e5abe980f2741978e64e67194`
- Navigation order: Home, Events, News, Games, Static Wav, Robot RAHBEE, Storefront, Memberships, LottoMind App
- Utility treatment: Search, Credits, and Account use matching keyboard-accessible cyan HUD pills
- Preserved route access: Lottery Spheres remains discoverable through page content and command search
- Tests: Site validation passed 16 HTML files; focused desktop/mobile checks passed 4/4; source/staging route matrix passed 144/144; staging safety passed 10/10; staging static verification passed 24 pages and 560 same-origin references
- Visual review: `docs/staging-reviews/shared-header-order.md` with 1440x900 and 390x844 captures; no overflow, console errors, page errors, or broken header assets
- Commerce and backend impact: None; staging write protections remain active
- Staging URL: Local only (`http://127.0.0.1:8321/`)
- Production approval status: Not approved; production remains unchanged

## Home Commercial, Storefront Patch, And Spheres Console

- Step number: Owner-requested Home, Storefront, and Spheres corrections
- Implementation commit: `03129291ff064bebee08642d5e43b57d6b0bbee9`
- Affected routes: `/index.html#top`, `/merch-store.html`, and `/lottery-spheres.html#spheres`
- Home: Restored the original commercial overlay and existing video with explicit Play with sound and Enter Site controls; playback remains muted until a visitor requests audio
- Storefront: Replaced the two selected Innovation Floor hoodie cards and the selected Model Drop gallery tile with the supplied Detroit 1701 embroidered patch artwork at `$10`; converted the source PNG to a 126 KiB WebP
- Spheres: Expanded the fixed console and frequency-generator column so all six presets, level control, play control, and status copy remain available without clipping
- Tests: Home validation passed; site validation passed 16 HTML files; focused browser checks passed 6/6; Home regression passed 12/12 with 4 intentional skips; source/staging route matrix passed 150/150; staging safety passed 10/10 for 25 noindex pages and 569 same-origin references
- Visual review: Nine captures passed at `1440x900`, `768x1024`, and `390x844`; review: `docs/staging-reviews/home-storefront-spheres-corrections.md`
- Intentional visual departures: Home again opens with the original commercial; the selected Storefront products now show the Detroit patch; the Spheres console is slightly taller with a wider frequency deck
- Commerce and backend impact: None; no checkout, account-write, redemption, analytics, or production-data behavior changed
- Staging URL: Local only (`http://127.0.0.1:8321/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Billing Response Validation

- Frontend behavior: Billing requests now validate JSON, configuration shape, plan identifiers, and Stripe redirect hosts; stalled, malformed, rejected, and unreachable responses receive distinct accessible messages
- Checkout return behavior: A Stripe return is no longer described as payment confirmation until an active membership is verified from the account service
- Edge Function source: `supabase/functions/lottomind-api/index.ts` is now versioned in the repository with CORS-aware auth responses, JSON body validation, Stripe mode reporting, and checkout/portal URL validation
- Connected backend check: Production function version 5 currently returns `401 AUTH_REQUIRED` with the expected CORS header for an unauthenticated checkout request; no unexplained `500` billing failures appeared in the inspected 24-hour Edge Function log window
- Backend deployment: Not performed because the connected Supabase project exposes only its production `main` branch and production approval is not granted
- Validation limitation: `npm.cmd run check:site` still reports 65 missing references because this sparse checkout intentionally omits large source assets; the independent staging build and same-origin reference check passed
- Cleanup: Generated staging/test output and the Playwright browser cache were removed after validation; they are recreated by the documented build/test commands

## Platform HUD And Depth Refinement

- Step number: Browser-requested Platform HUD, Help, and Account visual refinement
- Implementation commits: `7a4bb40`, `6afbf18`
- Affected routes: `/how-to-use.html`, `/account.html`, and the generated footer on `/arcade.html`
- Changes: Help now uses a Home-adjacent cinematic treatment without losing content; Search, Credits, and Account use a segmented utility rail; Account adds a CSS perspective-floor background; the 16-link platform directory is a responsive route-control HUD
- Transition preservation: Transition and commercial assets were not edited; their Git object hashes are unchanged and the existing inbound/outbound regression passed on desktop and mobile
- Tests: Site validation 20/20 HTML files; focused checks 8/8; source browser suite 153 passed with 7 intentional skips; clean-port staging browser safety 10/10; source/staging route matrix 100/100; staging static verification 28 pages and 640 same-origin references; release audit 7/7 groups
- Visual review: `docs/staging-reviews/platform-hud-depth.md` with 1440x900, 768x1024, and 390x844 captures; no overflow, console errors, page errors, broken assets, or lost features found
- Staging URL: Local only (`http://127.0.0.1:8296/`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Approval status: Ready for next phase; these commits are not approved for production

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

## Membership 3D Depth Interaction

- Step number: Browser-requested Membership 3D interaction enhancement
- Commit SHA: This status entry is part of the current focused commit; the completion report records its exact SHA
- Affected route: `/memberships.html`
- Changes: Added restrained fine-pointer parallax to the Membership hero and HUD; added perspective tilt, layered emblems, signal sheen, and keyboard-focus lift to the four plan cards and bottom Guardian card; added static coarse-pointer and reduced-motion fallbacks
- Tests: JavaScript syntax and 15-page site validation passed; focused Membership interaction and route tests passed 6/6; full source/staging desktop/mobile route matrix passed 92/92; staging safety passed 10/10; staging static verification passed for 23 pages and 541 same-origin references
- Visual review: Six Membership captures passed at 1440x900, 768x1024, and 390x844; compared with `docs/visual-baseline/v1/` and documented in `docs/staging-reviews/signal-media-corrections.md`
- Intentional visual departure: Membership hero and plan surfaces now have interactive depth on fine-pointer devices; the existing composition remains static on mobile, coarse pointers, and reduced-motion environments
- Commerce and backend impact: None. Pricing, Membership commercial media, account behavior, checkout hooks, and staging guards are unchanged
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Production approval status: Not approved; production remains unchanged

## Static Wav Future HUD

- Step number: Browser-requested Static Wav commercial visual refinement
- Commit SHA: This status entry is part of the current focused commit; the completion report records its exact SHA
- Affected route: `/how-to-use.html`
- Changes: Refined the existing guide commercial into a beveled Static Wav transmission chassis with layered glass framing, stronger telemetry, a contained film bay, chapter node, responsive action deck, and delayed staging-safety offset measurement
- Preserved behavior: Existing commercial media, one-pass playback, sound fallback, automatic dismissal, transition handoff, and Storefront Buy Now navigation are unchanged
- Tests: JavaScript syntax and 15-page site validation passed; focused Static Wav browser tests passed 2/2; candidate source/staging route matrix passed 92/92; staging safety passed 10/10; static staging verification passed for 23 pages and 543 same-origin references
- Visual review: Refreshed Static Wav captures passed at 1440x900, 768x1024, and 390x844; compared with `docs/visual-baseline/v1/` and documented in `docs/staging-reviews/signal-media-corrections.md`
- Intentional visual departure: The prior clean split panel becomes a more cinematic signal chassis while retaining the Detroit footage and black/gold/cyan/violet visual identity
- Commerce and backend impact: None. Buy Now remains route navigation only, and no checkout, account, redemption, or backend behavior changed
- Staging URL: Local only (`http://127.0.0.1:8143/how-to-use.html`)
- Staging safety: Noindex and preview banners verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Production approval status: Not approved; production remains unchanged

## Release Candidate v2-rc2

- Step number: Step 34 RC2 release-candidate preparation
- Preserved unrelated work: Pushed branch `wip/pre-release-user-work-20260728` at `e2e24535294380a0dc076f07c1d3ef1d61826a2d`; generated local artifacts were moved to `C:\Users\digit\Documents\phone\_jungle_lotto_refined-preserved-20260728`
- Audited implementation commit: `ae37b5a60b70a531bc4b96e616a7dd71c29a312c`
- Release-candidate tag: `v2-rc2`
- Production synchronization: Current `origin/main` at `f6e46b49eb0fe7e02e537ed48a127226e7b3f72a` is already an ancestor of `upgrade-redesign`; no rebase, reset, or merge was needed
- Tests: Release gates 7/7; site validation 15/15; source browser 126 passed with 6 intentional skips; staging safety 10/10; route matrix 92/92; News 20/20 with 0 production dependency vulnerabilities; GothTechnology 39 unit and 25 browser checks passed with 5 intentional skips; Shadow Ops typecheck passed
- Visual review: `docs/staging-reviews/release-candidate-v2-rc2.md`; 51 captures passed at `1440x900`, `768x1024`, and `390x844`
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production verification: Live Home and Memberships returned HTTP 200 without staging noindex or preview-banner markers
- Approval status: Ready for production review; pull-request approval and fresh exact `APPROVE PRODUCTION MERGE` authorization remain required

## Phase 1 Platform Architecture Integration

- Step number: Phase 1 CodeX pack integration
- Implementation commit: `ef73f36c6aea559d4713ccb599811ca380ef4a6c`
- Upgrade branch: `upgrade-redesign`
- Scope: Central route manifest and generated sitemap/inventory; canonical App, Arcade, Studio, Help, Account, Beat2Lotto+, RAHBE, and Static Wav routes; manifest-driven desktop/mobile navigation and command search; clearer Home and Membership hierarchy
- Tests: Source browser suite passed 145 checks with 7 intentional viewport skips; source/staging route matrix passed 100/100; staging safety passed 10/10; release gates passed 7/7; site validation passed 21 source pages
- Staging build: 29 noindex pages and 630 same-origin references verified from commit `ef73f36c6aea559d4713ccb599811ca380ef4a6c`
- Visual review: 21 captures passed at `1440x900`, `768x1024`, and `390x844`; review: `docs/staging-reviews/phase-1-platform.md`
- Staging URL: Local only (`http://127.0.0.1:8294/` while the verified server is running)
- Staging safety: Preview banner and noindex verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Commerce and backend impact: Existing membership prices, checkout hooks, account services, and redemption protections are preserved; no live charge or production-data mutation was attempted
- Production approval status: Not approved for this new Phase 1 branch work; production remains unchanged

## Previous Layout Restoration With Retained Platform Tools

- Step number: Browser-requested previous-layout restoration
- Implementation commit: `afa774c3e178d24700cef57fc98f6b887e1baf19`
- Upgrade branch: `upgrade-redesign`
- Navigation order: Home, App, Arcade, News + Events, Store, Membership
- Preserved updates: Search, Credits, Account, LottoMind App, grouped News + Events navigation, How-to-Use / Help Center, recent public route names, and the Account and Collector Vault footer directory
- Studio preservation: The public `studio.html` overview and discovery links were removed; its exact source reference is documented in `docs/archived-pages/studio-phase1.md`, while the underlying `lottomind-stem-studio/` implementation and assets remain saved
- Tests: Source browser suite passed 147 checks with 7 intentional viewport skips; staging safety passed 10/10; source/staging desktop/mobile route matrix passed 96/96; release gates passed 7/7; staging static verification passed for 28 pages and 616 same-origin references
- Visual review: 21 route captures passed at `1440x900`, `768x1024`, and `390x844`; review: `docs/staging-reviews/layout-restoration.md`
- Staging URL: Local only (`http://127.0.0.1:8295/` while the verified server is running)
- Staging safety: Preview banner and noindex verified; live payments, production account writes, real redemptions, and production analytics remain blocked
- Commerce and backend impact: None; no checkout, account mutation, redemption, or production-data action was attempted
- Production approval status: Not approved; production remains unchanged

## Selective Phase 1 Platform Restore

- Step number: Owner-requested selective Phase 1 recovery
- Implementation commit: `403f2e5c9e8dc1af752060d409d874747fbf378b`
- Restored surfaces: Search, Account, generated navigation, App overview, Arcade overview, Help Center, and grouped News + Events navigation
- Preserved layout: Previous cinematic Home composition and current navigation order
- Studio status: Public `studio.html` remains removed; source recovery is documented in `docs/archived-pages/studio-phase1.md`, and `lottomind-stem-studio/` remains preserved
- Tests: Site validation passed for 20 HTML files; source browser suite passed 147 checks with 7 intentional viewport skips; staging safety passed 10/10; source/staging route matrix passed 96/96; release gates passed 7/7; staging static verification passed for 28 pages and 616 same-origin references
- Visual review: 21 captures passed at `1440x900`, `768x1024`, and `390x844`; review: `docs/staging-reviews/selective-phase1-restore.md`
- Staging URL: Local only (`http://127.0.0.1:8295/` while the verified server is running)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Games Page Return And News + Events HUD

- Step number: Browser-requested Games page restoration and News + Events HUD expansion
- Implementation commits: `f9eaf51b6326d2c467ff95aa4af2d09e9273d6a0`, `9ab9d2057477205812e9a2ba299a0ebc15c50b6d`, and `6a044e145d54fd4fe2a85460686690a17005a7e9`
- Restored surface: `/features-app.html` is again a complete Games destination with the Guardian hero film, particle figure, searchable and swipeable seven-game directory, filters, sorting, game controls, and responsible-entertainment language
- Navigation: App, Arcade, and Games remain separate generated routes; the existing navigation order is preserved with Games inserted after Arcade
- News + Events: The grouped route dialog is now a large responsive HUD with descriptive News and Live Events channels and an accessible close control
- Tests: Site validation passed for 20 HTML files; focused desktop/mobile checks passed 6/6, followed by HUD 2/2 and Games 2/2 corrections; full source suite passed 151 checks with 7 intentional viewport skips; staging safety passed 10/10 on fresh port `8296`; source/staging route matrix passed 100/100; release gates passed 7/7
- Staging build: 28 noindex pages built from `6a044e145d54fd4fe2a85460686690a17005a7e9`; preview banner and blocked production writes verified
- Visual review: Nine captures passed at `1440x900`, `768x1024`, and `390x844`; review: `docs/staging-reviews/features-return-hud.md`
- Intentional visual departure: The v1 entry commercial remains, while the post-entry Games page is now a richer cinematic directory; the small News + Events picker becomes a full cyan/gold control-deck HUD
- Commerce and backend impact: None; live payments, production account writes, real redemptions, and production analytics remain blocked on staging
- Staging URL: Local only (`http://127.0.0.1:8295/` while the verified server is running)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Previous Transition Flow Restoration

- Step number: Browser-requested transition rollback to the earlier July 28 behavior
- Implementation commit: `18b829b01905b4edaa1ff58e2ba53097101cebd3`
- Upgrade branch: `upgrade-redesign`
- Affected route: `/memberships.html`
- Restored behavior: Internal routes retain their existing outbound and arrival clips; a direct Membership visit no longer forces a false arrival state; the Membership commercial closes directly into the page without a second outbound wipe
- Preserved behavior: Shared transition visuals and audio, current route coverage, commercial media, sound fallback, navigation, Account, Help, Games, News + Events, checkout hooks, and staging guards are unchanged
- Tests: Focused transition checks passed 4/4; full browser suite passed 153 checks with 7 expected viewport skips; staging safety passed 10/10; source/staging route matrix passed 100/100; release gates passed 7/7; site validation passed for 20 HTML files; homepage static validation passed
- Staging build: 28 noindex pages and 640 same-origin asset references verified from `18b829b01905b4edaa1ff58e2ba53097101cebd3`
- Visual review: Three Membership commercial captures passed at 1440x900, 768x1024, and 390x844; review: `docs/staging-reviews/transition-restore.md`
- Intentional visual departure: None; this is a timing and handoff restoration only
- Commerce and backend impact: None; live payments, production account writes, real redemptions, and production analytics remain blocked on staging
- Staging URL: Local only (`http://127.0.0.1:8296/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Full Phase 1 Rollback

- Step number: Browser-requested full Phase 1 rollback
- Implementation commit: `885c4f7644e28fb82077acae77112c3ad01e35a2`
- Upgrade branch: `upgrade-redesign`
- Target: Current production site tree from `origin/main` at `09f8e5d2c8bc10d0cf1af240216404c6af74c3c0`
- Primary reference: `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/beat2lotto-plus.html#beat2lotto`
- Result: The complete `lottominded-ultra.io` tree matches `origin/main`; the Shadow Ops Canvas / Robot RAHBE Beat2Lotto+ route and pre-Phase-1 cinematic site structure are restored
- Removed: Phase 1 platform routes, generated navigation/search infrastructure, Account and Arcade overview routes, platform Help Center rewrite, standalone RAHBE/Static Wave routes, grouped News + Events HUD, and later Phase 1 visual refinements
- Preservation: All removed work remains recoverable from existing Git commits and historical staging reviews; no branch, tag, or history was deleted or rewritten
- Tests: Focused checks passed 20/20; full browser suite passed 126 checks with 6 expected viewport skips; staging safety passed 10/10; source/staging route matrix passed 92/92; release gates passed 7/7; site validation passed for 15 HTML files; homepage static validation passed
- Staging build: 23 noindex pages and 543 same-origin asset references verified from `885c4f7644e28fb82077acae77112c3ad01e35a2`
- Visual review: Six staging/live Beat2Lotto+ captures passed at 1440x900, 768x1024, and 390x844; review: `docs/staging-reviews/phase1-full-rollback.md`
- Commerce and backend impact: None; live payments, production account writes, real redemptions, and production analytics remain blocked on staging
- Staging URL: Local only (`http://127.0.0.1:8296/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Latest Platform Route Update Rollback

- Step number: Owner-requested rollback of the latest updates
- Implementation commit: `c770c124dedceb32cb80a68680c1b88aa443a306`
- Reverted updates: `d5cd5b5` and `a05f162`
- Result: Removed the latest selective platform-route restoration and its review artifacts, returning `upgrade-redesign` to the reviewed Full Phase 1 Rollback site state
- Tests: Full browser suite passed 126 checks with 6 expected viewport skips; staging safety passed 10/10; source/staging route matrix passed 92/92; release gates passed 7/7; site validation passed for 15 HTML files; homepage static validation passed
- Staging build: 23 noindex pages and 543 same-origin asset references verified from `c770c124dedceb32cb80a68680c1b88aa443a306`
- Visual review: No material visual departure from the existing Full Phase 1 Rollback comparison in `docs/staging-reviews/phase1-full-rollback.md`
- Commerce and backend impact: None; live payments, production account writes, real redemptions, and production analytics remain blocked on staging
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Restored Support Utilities

- Step number: Owner-requested Search, Credits, Account, Help, Contact, and Accessibility restoration
- Implementation commits: `0c52eb4`, `c132b4d`, `836c60e`, `ccc1c24`, and `8be909f`
- Upgrade branch: `upgrade-redesign`
- Restored surfaces: Shared Search, Credits, and Account header controls; Help, Contact, Accessibility, Credits, and Account support routes; read-only Account and Collector Vault page
- Preserved behavior: Existing cinematic navigation order, sphere artwork, site transitions, public content, and commerce hooks remain unchanged
- Tests: Full browser suite passed 130 checks with 6 expected viewport skips; focused support utilities passed 4/4; compatibility checks passed 6/6; staging safety passed 10/10; source/staging desktop/mobile route matrix passed 92/92; release gates passed 7/7; site validation passed for 16 HTML files; homepage validation passed
- Staging build: 24 noindex pages and 559 same-origin asset references verified from `8be909f10b246c9e2a6fdd7ef827498243d660bc`
- Visual review: Four Search and Account captures passed at `1440x900` and `390x844` without horizontal overflow or console errors; review: `lottominded-ultra.io/docs/staging-reviews/support-utilities.md`
- Intentional visual departure: A compact cyan-and-gold support row is added around the existing sphere navigation; the LottoMind black, gold, cyan, violet, Guardian, arcade, and cinematic identity remains recognizable
- Commerce and backend impact: None; staging live payments, production account writes, real redemptions, and production analytics remain blocked
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Spheres Audit Remediation

- Step number: Owner-requested audit corrections
- Implementation commit: This focused commit on `upgrade-redesign`
- Affected route: `/lottery-spheres.html#spheres`
- Corrections: Removed the duplicate inline Oracle, docked the mobile floating Oracle away from the title and primary controls, standardized visible handoffs as Robot RAHBEE, and corrected duplicated kinetic-heading accessible names
- Preserved behavior: Sphere rerolling, pointer interaction, the floating Magic 8 Ball, entertainment-only guidance, linked game and studio routes, cinematic artwork, and the black, gold, cyan, and violet identity remain intact
- Tests: Site validation passed for 16 HTML files; release audit passed 7/7 groups; full source browser suite passed 134 checks with 6 intentional viewport skips, including focused Spheres coverage on desktop and mobile; committed route and staging verification follows this commit
- Visual review: Desktop and mobile comparisons are recorded in `docs/staging-reviews/spheres-audit-corrections.md`
- Intentional visual departure: Mobile opens with a compact floating 8-ball instead of an expanded Oracle covering the page title; desktop retains the established full Oracle treatment
- Commerce and backend impact: None; no payment, account-write, redemption, analytics, or production-data behavior changed
- Staging URL: Local only (`http://127.0.0.1:8304/` after the committed staging build)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Release Documentation Sign-Off

- Step number: Owner-requested release documentation completion
- Audited site commit: `aa2c125d360a76631e8797595cdcbd23357cb47d`
- Upgrade branch: `upgrade-redesign`
- Route matrix: `docs/site-rebuild-checklist.md` now records current evidence for all 24 present routes without blanket pending states
- Tests: Site validation passed for 16 HTML files; release audit passed 7/7 groups; full browser suite passed 136 checks with 6 intentional viewport skips; expanded source/staging route suite passed 144/144 checks across `1440x900`, `768x1024`, and `390x844`; staging safety passed 10/10 for 24 noindex pages and 564 same-origin references
- Visual review: 72/72 current staging captures passed; contact sheets and the machine manifest are under `docs/staging-reviews/release-signoff-assets/`
- Review: `docs/staging-reviews/release-documentation-signoff.md`
- Performance: Transfer sizes are measured and documented; no unapproved performance threshold was invented
- Phase 2 package: Inspected for scope only; Phase 2 implementation, branch creation, database migrations, and Stripe changes were not started by this documentation task
- Staging URL: Local only (`http://127.0.0.1:8304/` while the verified server is running)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged

## Footer And Popup Pointer Repair

- Step number: Browser-requested footer deduplication and popup pointer correction
- Implementation commits: `57751a4068b2c53baa648646c5686efcab020d89` and `e030d104570e9c20e53c8cac20c45f20120261ba`
- Upgrade branch: `upgrade-redesign`
- Affected surfaces: Shared footers on all generated routes, Home commercial, Membership commercial, Storefront commercial, Static Wav commercial, and open dialogs
- Corrections: Removed duplicate footer destinations, standardized seven canonical support/legal links, restored a visible native pointer over popup layers, and reserved mobile footer clearance for fixed controls
- Tests: Focused footer and pointer checks passed 4/4; shared support and Home checks passed 20 with 4 intentional desktop skips; mobile footer regression passed 2/2; source/staging route matrix passed 150/150 across desktop, mobile, and tablet; staging safety passed 10/10
- Staging build: 25 noindex pages and 571 same-origin references verified from `e030d104570e9c20e53c8cac20c45f20120261ba`
- Visual review: Six final captures passed at `1440x900` and `390x844`; review: `docs/staging-reviews/footer-pointer-fix.md`
- Intentional visual departure: Duplicate footer buttons are removed, and mobile footers include safe clearance below their final link; LottoMind artwork and black, gold, cyan, and violet identity are unchanged
- Commerce and backend impact: None; staging live payments, production account writes, real redemptions, and production analytics remain blocked
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Production approval status: Not approved; `main`, production, and `v1-final` remain unchanged
