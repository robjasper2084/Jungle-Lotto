# Features Hybrid Staging Review

## Scope

- Production reference: `main` at `v1-final` (`975c637cea7003533cdc30aed9d96be51929bfc8`)
- Upgrade branch: `upgrade-redesign`
- Affected route: `/features-app.html`
- Staging URL: Local only (`http://127.0.0.1:8143/features-app.html`)
- Viewports: 1440x900, 768x1024, and 390x844

## Visual Evidence

- Production desktop: [v1 Features desktop](../visual-baseline/v1/features-app--desktop.png)
- Production tablet: [v1 Features tablet](../visual-baseline/v1/features-app--tablet.png)
- Production mobile: [v1 Features mobile](../visual-baseline/v1/features-app--mobile.png)
- Staging desktop: [hybrid Features desktop](features-hybrid-assets/features-desktop-1440x900.png)
- Staging tablet: [hybrid Features tablet](features-hybrid-assets/features-tablet-768x1024.png)
- Staging mobile: [hybrid Features mobile](features-hybrid-assets/features-mobile-390x844.png)

## Improvements

- The route now opens as a clear Features and Arcade destination instead of a Guardian merchandise commercial.
- Cinematic Detroit studio art, orb navigation, black, gold, cyan, and violet signals, and music-technology language remain first-viewport cues.
- Five compact creative channels restore the broader Features personality without bringing back duplicate consoles, news rails, or media players.
- The eight playable routes remain searchable and filterable from the manifest-driven Arcade directory.
- Invented `Live` status labels were replaced with the factual `Playable` label.
- Desktop, tablet, and mobile captures have no horizontal overflow or broken same-origin assets.

## Regressions

- No visual or functional regression was found in the affected route.
- The route remains image-heavy: approximately 6.6 MiB transferred initially on mobile and 9.1 MiB after the full visual route loaded.

## Intentionally Removed

- Duplicate instrument consoles, unrelated news panels, stacked audio players, and competing feature rails remain excluded from this focused route.
- Production checkout, account writes, redemptions, and analytics remain unavailable in staging.

## Unintentionally Lost

- None observed. All eight playable routes and the five intended creative destinations are present.

## Accessibility Findings

- Keyboard focus advances from the game-directory skip link through the brand and orb navigation in a coherent order.
- The commercial handoff releases all inert page containers before navigation resumes.
- Reduced-motion mode reported zero running animations.
- No text clipping or horizontal overflow was observed at the three review sizes.

## Performance Findings

- No failed same-origin responses were recorded during capture.
- Mobile defers part of the below-fold image payload, but the full route still reaches approximately 9.1 MiB.
- A later optimization pass should convert or resize the heaviest decorative and card imagery without changing the current visual composition.

## Recommended Corrections

- Keep the hybrid hierarchy and directory behavior.
- Optimize image delivery in a dedicated performance step; no release-blocking correction is required for this refinement.

## Approval Status

Ready for next phase. Production approval remains not approved.
