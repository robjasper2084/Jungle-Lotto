# Step 34 Prerequisite Remediation Staging Review

## Checkpoint

- Phase: Step 34 prerequisite remediation, excluding live checkout verification
- Upgrade branch: `upgrade-redesign`
- Reviewed implementation commit: `32b1bbfd535d01b5acb2dabf82627c52fcb26e7c`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8143/` while the staging server is running)
- Remote preview: Not configured; nothing was deployed or promoted
- Approval status: **Ready for next phase**
- Production approval status: **Not approved**; safe live-checkout verification remains excluded and incomplete

## Screenshot Evidence

Production v1 references:

- [Desktop production baseline](../visual-baseline/v1/desktop-contact-sheet.png)
- [Tablet production baseline](../visual-baseline/v1/tablet-contact-sheet.png)
- [Mobile production baseline](../visual-baseline/v1/mobile-contact-sheet.png)
- [Production baseline manifest](../visual-baseline/v1/baseline-manifest.json)

Side-by-side v1 and staging comparisons:

- [Desktop comparison](./blocker-remediation-assets/comparison--desktop.png)
- [Tablet comparison](./blocker-remediation-assets/comparison--tablet.png)
- [Mobile comparison](./blocker-remediation-assets/comparison--mobile.png)
- [Staging capture manifest](./blocker-remediation-assets/capture-manifest.json)

## Routes Compared

`/`, `/memberships.html`, `/merch-store.html`, `/games/shadow-ops-canvas/`, `/news/`, `/contact.html`, `/lottomind-stem-studio/`, and `/games/lottomind-jackpot-maze/` at 1440x900, 768x1024, and 390x844.

All 24 staging captures returned HTTP 200, contained the staging banner and noindex metadata, had no horizontal overflow, and recorded no console errors.

## Improvements

- Contact now prepares a local support draft without a missing-script failure or sending data.
- Stem Studio contains its workstation at tablet and mobile widths.
- Jackpot Maze now renders its semantic, keyboard-accessible Arcade entry screen instead of a blank white viewport.
- News uses its bundled static feed in staging and does not contact production Supabase.
- Home, Memberships, Merch, and route-commercial films remain poster-led until a user explicitly requests playback.
- Shadow Ops loads campaign assets by play and level instead of transferring the full campaign at title-screen boot.
- Production payments, account writes, real redemptions, and production analytics remain blocked in staging.

## Visual Changes

- Jackpot Maze is the largest intentional departure: the blank v1 viewport is replaced by the full neon Detroit-inspired game presentation.
- Membership and Merch commercial panels show their tracked campaign posters and a `Play Film` control before loading video. The campaign frame differs from the autoplay frame in the v1 captures, while Guardian imagery and the black/gold/cyan system remain intact.
- Contact exposes its complete local support form.
- Stem Studio keeps the same onboarding and workstation composition with corrected responsive containment.
- Shadow Ops preserves the Robot Rahbe title art, layered violet environment, gold controls, and opening composition despite the payload reduction.
- The staging banner and safety-status line are intentionally present only in staging.

## Regressions

No new visual, route, console, overflow, staging-safety, or gameplay regression was found in this checkpoint.

## Feature Accounting

Features intentionally disabled in staging:

- Live Stripe charges and production checkout completion
- Production account mutations
- Real collectible redemption
- Production analytics and analytics beacons

Features intentionally changed:

- Large films and soundtracks require explicit playback.
- Shadow Ops future-level assets load when the campaign reaches those levels.
- News uses static read-only content when production services are unavailable.

Features unintentionally lost: **None detected.** Local games, local saves, prompts, audio analysis, share previews, read-only content, and responsive/accessibility testing remain available.

## Accessibility Findings

- All affected routes have semantic headings or game entry controls and visible content at desktop, tablet, and mobile sizes.
- Jackpot Maze exposes a visible `Enter the Maze` control and semantic heading.
- Contact status messaging remains local and does not claim a request was sent.
- The 92-route matrix passed with reduced motion enabled.
- No horizontal overflow was detected in any of the 24 affected-route captures.

## Performance Findings

Fresh local mobile first-load measurements before and after remediation:

| Route | Before | After | Result |
| --- | ---: | ---: | --- |
| Home | 28.1 MiB | 5.80 MiB | Commercials and soundtrack deferred |
| Memberships | 26.7 MiB | 2.87 MiB | Campaign films and soundtrack deferred |
| Merch | 23.1 MiB | 1.99 MiB | Route and campaign films deferred |
| Shadow Ops | 87.7 MiB | 3.70 MiB | Intro, music, and campaign assets loaded on demand |

These are local comparative transfer measurements, not CDN billing totals. Shadow Ops Level 1 was also play-tested after the lazy-load change: the canvas rendered 14,369 sampled lit pixels with no console error.

## Verification

- `npm.cmd run routes:test`: 92/92 source/staging desktop/mobile route checks passed
- `npm.cmd run staging:test`: 9/9 browser checks passed
- Staging static verification: 23 injected pages and 492 same-origin references passed
- Shadow Ops TypeScript check: passed
- Jackpot Maze source tests: 46/46 passed; 24 assets validated
- Staging capture review: 24/24 affected-route screenshots returned 200 with no overflow or console error
- Production URL: HTTP 200; no staging banner; no noindex metadata
- Remote `main` and `v1-final`: both remain at `975c637cea7003533cdc30aed9d96be51929bfc8`

## Recommended Correction

Complete safe live-checkout verification without completing a charge. Until that evidence is recorded, do not create a production release candidate, merge into `main`, or deploy production.

