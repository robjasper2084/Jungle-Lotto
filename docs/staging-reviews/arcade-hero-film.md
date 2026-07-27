# Arcade Hero Guardian Film Review

- Phase: Browser-requested Arcade hero media update
- Branch: `upgrade-redesign`
- Implementation commit: `9f83a7f7b4c7b59943df1428c04983c18899ac1b`
- Affected route: `/features-app.html`
- Production reference: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/features-app.html
- Local staging: http://127.0.0.1:8143/features-app.html
- Approval status: Ready for next phase; production remains unchanged

## Visual Comparison

- V1 desktop baseline: [features-app--desktop.png](../visual-baseline/v1/features-app--desktop.png)
- Staging desktop, 1440x900: [arcade-hero-film-1440x900.png](arcade-hero-film-assets/arcade-hero-film-1440x900.png)
- Staging mobile, 390x844: [arcade-hero-film-390x844.png](arcade-hero-film-assets/arcade-hero-film-390x844.png)
- Capture measurements: [capture-report.json](arcade-hero-film-assets/capture-report.json)

The v1 entry commercial and existing Guardian background artwork remain unchanged. The intentional departure is a new post-entry, 16:9 Guardian film in the marked right side of the Arcade hero. On mobile it moves below the Arcade copy instead of covering the title, actions, or route telemetry.

## Improvements

- Uses the supplied Detroit Guardian video as a visible Arcade signal rather than replacing the established hero artwork.
- Maintains a 16:9 crop with no copy overlap or horizontal overflow at both captured viewports.
- Keeps the cyan, gold, violet, black, Guardian, music-technology, and cinematic identity recognizable.
- Adds a dedicated pause/play control with a clear accessible name.

## Accessibility And Motion

- The film autoplays muted and loops without forcing audio on page entry.
- The pause/play control reflects the real playback state.
- Reduced-motion mode pauses the film and returns it to its opening frame.
- The poster preserves the composition when playback is unavailable.

## Performance

- The H.264 MP4 is approximately 5.25 MiB and uses `preload="metadata"`.
- The poster is approximately 129 KiB.
- A future media pass should consider a smaller WebM/MP4 encode, but no blocking load or broken asset was observed in this review.

## Verification

- JavaScript syntax checks passed.
- Site validation passed for 15 HTML files.
- Focused Arcade film tests passed 2/2 across desktop and mobile.
- Affected source/staging route smoke tests passed 4/4.
- Staging safety tests passed 10/10.
- Full source/staging desktop/mobile route matrix passed 92/92.
- Staging build processed 23 pages and verified 546 same-origin asset references.
- Screenshot verification passed 2/2 with no console errors, page errors, copy overlap, or horizontal overflow.
- Noindex and the staging preview banner were present in both staging captures.

## Findings

- Regressions: None found in the affected route.
- Features intentionally removed: None.
- Features unintentionally lost: None observed.
- Recommended correction: Optimize the supplied film only if page-weight targets require it.

