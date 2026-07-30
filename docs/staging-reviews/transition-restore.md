# Previous Transition Flow Restoration

- Date: 2026-07-29
- Branch: `upgrade-redesign`
- Implementation commit: `18b829b`
- Staging URL: `http://127.0.0.1:8296/`
- Affected route: `/memberships.html`
- Viewports: 1440x900, 768x1024, 390x844
- Approval status: Ready for next phase

## Visual Comparisons

- v1 production baseline: [desktop](../visual-baseline/v1/memberships--desktop.png), [tablet](../visual-baseline/v1/memberships--tablet.png), [mobile](../visual-baseline/v1/memberships--mobile.png)
- July 28 sequenced handoff: [desktop](signal-media-corrections-assets/membership-transition-sequence-1440x900.png), [tablet](signal-media-corrections-assets/membership-transition-sequence-768x1024.png), [mobile](signal-media-corrections-assets/membership-transition-sequence-390x844.png)
- Restored staging commercial: [desktop](transition-restore-assets/memberships-commercial-restored-1440x900.png), [tablet](transition-restore-assets/memberships-commercial-restored-768x1024.png), [mobile](transition-restore-assets/memberships-commercial-restored-390x844.png)

## Improvements

- Direct Membership visits no longer manufacture an arrival state when no route transition occurred.
- The entry commercial now closes directly into the Membership page, matching the earlier July 28 flow and removing the extra outbound wipe after the film.
- Normal internal navigation still plays the existing outbound and arrival clips before the destination experience.

## Regressions

- None found.
- The restored flow passed desktop and mobile transition regressions, the full browser suite, staging safety checks, and the complete source/staging route matrix.

## Features Intentionally Removed

- The forced Membership arrival class on direct page loads.
- The second transition between the Membership commercial and the Membership page.

## Features Unintentionally Lost

- None. Current navigation, Help, Account, Games, News + Events, commercial media, account safety, and checkout protections remain intact.

## Accessibility Findings

- The commercial retains its dialog semantics, keyboard controls, visible close action, focus restoration, and accessible sound fallback.
- Reduced-motion behavior remains unchanged because the shared transition CSS and audio runtime were not modified.

## Performance Findings

- Removing the extra transition eliminates one video playback and one 1.5-second fallback timer from the Membership entry path.
- No new media, JavaScript dependency, network request, or production integration was added.

## Identity Review

- The black, gold, cyan, and violet visual language remains recognizable.
- The Guardian, Detroit apparel film, music-technology HUD, arcade character, and responsible-entertainment wording are unchanged.
- Intentional visual departure: none. This checkpoint changes timing only.

## Verification

- Focused transition and Membership tests: 4/4 passed.
- Full browser suite: 153 passed, 7 expected viewport skips.
- Staging browser safety: 10/10 passed.
- Source/staging desktop/mobile route matrix: 100/100 passed.
- Staging static artifact: 28 pages and 640 same-origin asset references.
- Release gate audit: 7/7 groups passed.
- Site validation: 20 HTML files passed.
- Homepage static validation: passed.
- Staging noindex, preview banner, blocked live payments, blocked production account writes, blocked real redemptions, and blocked production analytics: verified.

## Recommended Corrections

- None required for this restoration.

## Approval Status

Ready for next phase. The restored flow remains staging-only on `upgrade-redesign`; production and `main` are unchanged.
