# Step 1 Guardrails And Baseline Staging Review

## Checkpoint

- Phase: Step 1 - repository guardrails, regression tests, and visual baseline
- Upgrade branch: `upgrade-redesign`
- Reviewed commit: `6380313b07f05270dddab87944bdd11a76ed0c8f`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8143/` while `npm.cmd run staging:serve` is running)
- Remote preview: Not configured; nothing was deployed or promoted
- Approval status: **Ready for next phase**

Step 1 changed documentation and test infrastructure, not website route implementation. To prove parity, this checkpoint compared all 23 inventoried visual states at 1440x900, 768x1024, and 390x844 rather than claiming that no route needed review.

## Screenshot Evidence

Production v1 contact sheets:

- [Desktop production baseline](../visual-baseline/v1/desktop-contact-sheet.png)
- [Tablet production baseline](../visual-baseline/v1/tablet-contact-sheet.png)
- [Mobile production baseline](../visual-baseline/v1/mobile-contact-sheet.png)

Side-by-side production and staging contact sheets:

- [Desktop production/staging review](./step-1-guardrails-baseline-assets/desktop-production-staging-contact-sheet.png)
- [Tablet production/staging review](./step-1-guardrails-baseline-assets/tablet-production-staging-contact-sheet.png)
- [Mobile production/staging review](./step-1-guardrails-baseline-assets/mobile-production-staging-contact-sheet.png)

The [review manifest](./step-1-guardrails-baseline-assets/review-manifest.json) links every production and staging route screenshot and records load status, console failures, broken assets, overflow, noindex, banner visibility, environment protections, resource counts, and transferred bytes.

## Routes Compared

`/`, `/features-app.html`, `/memberships.html`, `/news/`, `/live-events.html`, `/lottery-spheres.html`, `/beat2lotto-plus.html`, `/merch-store.html`, `/how-to-use.html`, `/privacy.html`, `/terms.html`, `/accessibility.html`, `/prompt-lab.html`, `/lottomind-stem-studio/`, `/redeem.html`, `/contact.html`, `/404.html`, `/games/gothtechnology2/`, `/games/lottomind-jackpot-maze/`, `/games/opengw-levels/`, `/games/shadow-ops-canvas/`, `/games/raytrace-pong-background/`, and `/lottery-spheres.html#spheres`.

All 69 staging captures returned HTTP 200. All 69 contained `noindex,nofollow,noarchive`, displayed the preview banner, and exposed a staging environment with live payments, account writes, redemptions, and production analytics disabled. No broken same-origin assets were detected.

## Review Matrix

| Area | Result | Findings |
| --- | --- | --- |
| Message clarity | Pass | Page titles, primary headings, and entertainment-first language remain recognizable. The staging status clearly says the preview is not production. |
| Navigation clarity | Pass with follow-up | Orb navigation and major routes remain consistent. The dense orb rail is still visually busy at tablet and mobile sizes but did not lose functionality. |
| Detroit-inspired character | Pass | Industrial darkness, music-culture framing, bold typography, and original arcade key art remain intact. |
| Guardian and orb identity | Pass | Guardian imagery, Little Man presence where used, LottoMind orbs, and the circular navigation language remain prominent. |
| Color-system consistency | Pass | Deep black/navy, gold, cyan, and violet remain the dominant functional palette without generic SaaS drift. |
| Art crop and media quality | Pass with follow-up | Key art remains legible and consistently cropped. Video frames and generated sphere values differ by capture time, which is expected rather than a design departure. |
| Column and card alignment | Pass | Production and staging columns/cards align consistently at all three viewports except the documented Stem Studio overflow. |
| Mobile readability | Pass with known issue | Core routes remain readable at 390x844. Stem Studio continues to exceed the viewport width. |
| Keyboard navigation | Pass with known issue | The route matrix confirmed visible focus on tested routes except Jackpot Maze, which has no semantic heading or visible focus target. |
| Reduced-motion behavior | Pass | All 92 source/staging route checks ran with reduced motion enabled. |
| Page weight | Needs correction | Shadow Ops transfers about 83.6 MiB per fresh load. Memberships and Home approach 28 MiB; Merch is about 22 MiB. These are material mobile-performance risks. |
| Console errors | Pass with environment note | Five captures logged `ERR_NETWORK_ACCESS_DENIED` from read-only Supabase news GETs on Features/News. Static fallback content rendered, and no write was attempted. |
| Broken assets | Pass | No broken same-origin staging assets were detected. Production/source Contact's missing `lm-support.js` is repaired only in the staging build helper. |
| Checkout and account safety | Pass | Browser tests proved live checkout, account writes, real redemptions, production analytics, and analytics beacons are blocked before reaching production services. |
| Entertainment-only wording | Pass | Lottery disclaimers, creative-number framing, responsible-use language, and no-prediction wording remain present. |
| Functional parity | Pass with known issue | Read-only pages, local games, local storage, prompts, audio tools, and visual interactions remain available. Protected writes are intentionally unavailable. Jackpot Maze remains blank as it is in the v1 baseline. |

## Improvements

- Every staging route is visibly identified as non-production and has noindex metadata.
- Staging provides an accessible safety-status line and blocks protected writes without claiming success.
- The staging Contact helper avoids the missing `assets/js/lm-support.js` failure present in the production/source baseline while keeping submission local.
- The test matrix now detects new or unexpectedly resolved console, asset, overflow, heading, and keyboard-focus conditions.

## Regressions

No regression attributable to Step 1 was discovered. Production and staging preserve the same route composition and visual identity. The only intentional visual departure is the narrow preview banner and safety-status line above staging pages, which shifts the page downward without obscuring content.

Pre-existing conditions retained in staging:

- Jackpot Maze renders a blank white viewport at all three sizes despite HTTP 200 and lacks a semantic heading and visible keyboard focus.
- Stem Studio has horizontal overflow at 768x1024 and 390x844.
- Several first loads are unusually heavy, especially Shadow Ops, Memberships, Home, and Merch.

## Feature Accounting

Features intentionally removed or disabled in staging:

- Live Stripe checkout
- Production account mutations
- Real collectible redemption
- Production analytics and analytics beacons
- Development-only files excluded by the staging build

Features unintentionally lost: **None detected.** The Jackpot Maze blank state predates the upgrade and appears in the production v1 baseline; it is a known defect, not a staging removal.

## Accessibility Findings

- The preview banner and safety message remain visible and readable at desktop, tablet, and mobile sizes.
- Keyboard focus is visible across the route matrix except Jackpot Maze.
- Reduced-motion emulation passes across source and staging.
- Stem Studio overflow can force horizontal navigation at tablet/mobile sizes and should be corrected.
- Jackpot Maze needs a semantic page/game heading, a focusable entry control, and a visible focus treatment after its runtime render is repaired.

## Performance Findings

Fresh local-browser resource measurements found these largest transfers:

- Shadow Ops: approximately 83.6 MiB
- Memberships: approximately 25.5-28.4 MiB depending on viewport and loaded media
- Home: approximately 27.7 MiB
- Merch: approximately 22.0 MiB

These measurements include current media and game assets and should be treated as comparative review data, not CDN-compressed production billing totals. They still indicate clear optimization opportunities for mobile and first-visit performance.

## Recommended Corrections

1. Repair Jackpot Maze from its source build so it renders, then add a semantic heading and visible keyboard entry focus.
2. Remove Stem Studio's tablet/mobile minimum-width overflow without changing its workstation character.
3. Reduce first-load media and game payloads, starting with Shadow Ops, Memberships, Home, and Merch.
4. Make the Features/News read-only fallback absorb unavailable Supabase news GETs without emitting console errors in isolated or offline staging.
5. Preserve the staging banner, noindex metadata, and write protections unchanged through later phases.

## Verification

- `npm.cmd run staging:test`: passed; 23 pages, 506 same-origin references, and 3 browser safety tests
- `npm.cmd run routes:test`: passed; 92 source/staging checks across 23 states at desktop and mobile with reduced motion
- Visual review: 69 staging screenshots and three side-by-side contact sheets inspected
- Production branch deployment: unchanged
- Production approval: Not approved
