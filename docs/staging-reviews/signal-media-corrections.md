# Signal and Media Corrections Staging Review

- Review date: 2026-07-22
- Upgrade branch: `upgrade-redesign`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Production URL: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Viewports: 1440x900, 768x1024, and 390x844

## Visual Comparisons

| Route | Production baseline | Staging correction |
| --- | --- | --- |
| Home | [Desktop](../visual-baseline/v1/home--desktop.png) / [Mobile](../visual-baseline/v1/home--mobile.png) | [Desktop](./signal-media-corrections-assets/home-1440x900.png) / [Tablet](./signal-media-corrections-assets/home-768x1024.png) / [Mobile](./signal-media-corrections-assets/home-390x844.png) |
| Memberships | [Desktop](../visual-baseline/v1/memberships--desktop.png) / [Mobile](../visual-baseline/v1/memberships--mobile.png) | [Plans](./signal-media-corrections-assets/memberships-1440x900.png) / [Commercial](./signal-media-corrections-assets/membership-commercial-1440x900.png) / [Mobile commercial](./signal-media-corrections-assets/membership-commercial-390x844.png) |
| Arcade | [Desktop](../visual-baseline/v1/features-app--desktop.png) / [Mobile](../visual-baseline/v1/features-app--mobile.png) | [Desktop](./signal-media-corrections-assets/arcade-1440x900.png) / [Tablet](./signal-media-corrections-assets/arcade-768x1024.png) / [Mobile](./signal-media-corrections-assets/arcade-390x844.png) |
| Live Events | [Desktop](../visual-baseline/v1/live-events--desktop.png) / [Mobile](../visual-baseline/v1/live-events--mobile.png) | [Desktop](./signal-media-corrections-assets/live-events-1440x900.png) / [Tablet](./signal-media-corrections-assets/live-events-768x1024.png) / [Mobile](./signal-media-corrections-assets/live-events-390x844.png) |
| News | [Desktop](../visual-baseline/v1/news-index--desktop.png) / [Mobile](../visual-baseline/v1/news-index--mobile.png) | [Desktop](./signal-media-corrections-assets/news-1440x900.png) / [Tablet](./signal-media-corrections-assets/news-768x1024.png) / [Mobile](./signal-media-corrections-assets/news-390x844.png) |

## Improvements

- Home removes the dense globe particle layer and title bleed while retaining the cinematic signal-room film, Detroit color language, and responsible-entertainment copy.
- The home startup commercial is delayed to 60 seconds. The background film attempts audible playback on entry and provides a visible sound control plus first-gesture retry when browser policy blocks it.
- Memberships opens on the requested decision hierarchy, keeps Collector Access first, retains the Guardian bundle beside it, and adds the supplied Detroit membership commercial in the previously empty hero column.
- Membership particles now use real Web Audio frequency energy when membership audio is active; reduced-motion mode suppresses the response.
- Arcade uses the Little Man toy/Guardian package artwork while preserving the playable eight-game directory.
- Live Events attempts synchronized hero sound immediately and exposes an accurate `Play sound` fallback instead of claiming sound is active when autoplay is blocked.
- News cards now use story or deterministic editorial imagery instead of repeated placeholder discs.
- Shared navigation reads `Games`, `Lilman`, `Storefront`, and `Static Wav` without changing route destinations.

## Intentional Departures

- The v1 Home particle globe was removed at the user's direction. The background film and cyan/gold/violet signal treatments remain.
- The v1 Membership and Arcade entry gates no longer obscure the primary page experience. Commercials remain available through explicit controls.
- News uses branded fallback art when a publisher does not provide a usable image. No live result, ranking, community, or social-proof data was invented.

## Regressions

- No new broken assets, console errors, page errors, or horizontal overflow were found in the 18 staging captures.
- Audible autoplay cannot be guaranteed by application code because browser policy can require a user gesture. The fallback control is visible, keyboard operable, and reports the actual state.
- The persistent News oracle can still occupy significant mobile space when expanded; this is inherited behavior and was not expanded in this correction pass.

## Features Intentionally Removed

- Home globe particle organism.
- Automatic Membership and Arcade entry popups that appeared before the requested content.

## Features Unintentionally Lost

- None found in the affected-route review. Game routes, local interactions, Membership plan details, Guardian media, Live Events archive controls, and News source links remain available.

## Accessibility Findings

- Reduced-motion captures completed at all three viewport sizes.
- Sound buttons expose the blocked, playing, and stopped states instead of making a false success claim.
- Staging safety messages and the staging banner remain visible; protected actions remain disabled.
- No affected route introduced horizontal overflow at 390 pixels.

## Performance Findings

- Removing the Home globe eliminates its Three.js particle workload.
- Membership audio analysis reuses one analyser and remains inactive until media is available.
- News no longer probes a missing dynamic API before loading the static feed.
- The supplied membership film is the largest new route asset; it is isolated to the Membership page and is not added to unrelated routes.

## Recommended Corrections

- Keep the explicit sound controls even if future browser versions allow more autoplay scenarios.
- Consider a later, separately approved collapsed-by-default mobile presentation for the News oracle.
- Recheck actual audio output on a physical phone before any production review.

## Approval Status

**Ready for next phase.** This is not production approval. Live checkout was not exercised or changed in this pass.
