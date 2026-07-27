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
| Memberships | [Desktop](../visual-baseline/v1/memberships--desktop.png) / [Mobile](../visual-baseline/v1/memberships--mobile.png) | [Desktop](./signal-media-corrections-assets/memberships-1440x900.png) / [Tablet](./signal-media-corrections-assets/memberships-768x1024.png) / [Mobile](./signal-media-corrections-assets/memberships-390x844.png) / [Commercial desktop](./signal-media-corrections-assets/membership-commercial-1440x900.png) / [Commercial tablet](./signal-media-corrections-assets/membership-commercial-768x1024.png) / [Commercial mobile](./signal-media-corrections-assets/membership-commercial-390x844.png) |
| Arcade | [Desktop](../visual-baseline/v1/features-app--desktop.png) / [Mobile](../visual-baseline/v1/features-app--mobile.png) | [Desktop](./signal-media-corrections-assets/arcade-1440x900.png) / [Tablet](./signal-media-corrections-assets/arcade-768x1024.png) / [Mobile](./signal-media-corrections-assets/arcade-390x844.png) |
| RAHBE | [Desktop](../visual-baseline/v1/beat2lotto-plus--desktop.png) / [Mobile](../visual-baseline/v1/beat2lotto-plus--mobile.png) | [Desktop](./signal-media-corrections-assets/rahbe-1440x900.png) / [Tablet](./signal-media-corrections-assets/rahbe-768x1024.png) / [Mobile](./signal-media-corrections-assets/rahbe-390x844.png) |
| Spheres | [Desktop](../visual-baseline/v1/lottery-spheres-spheres--desktop.png) / [Mobile](../visual-baseline/v1/lottery-spheres-spheres--mobile.png) | [Desktop](./signal-media-corrections-assets/spheres-1440x900.png) / [Tablet](./signal-media-corrections-assets/spheres-768x1024.png) / [Mobile](./signal-media-corrections-assets/spheres-390x844.png) |
| Storefront | [Desktop](../visual-baseline/v1/merch-store--desktop.png) / [Mobile](../visual-baseline/v1/merch-store--mobile.png) | [Desktop](./signal-media-corrections-assets/storefront-1440x900.png) / [Tablet](./signal-media-corrections-assets/storefront-768x1024.png) / [Mobile](./signal-media-corrections-assets/storefront-390x844.png) |
| Static Wav | [Desktop](../visual-baseline/v1/how-to-use--desktop.png) / [Mobile](../visual-baseline/v1/how-to-use--mobile.png) | [Desktop](./signal-media-corrections-assets/static-wav-1440x900.png) / [Tablet](./signal-media-corrections-assets/static-wav-768x1024.png) / [Mobile](./signal-media-corrections-assets/static-wav-390x844.png) |
| Live Events | [Desktop](../visual-baseline/v1/live-events--desktop.png) / [Mobile](../visual-baseline/v1/live-events--mobile.png) | [Desktop](./signal-media-corrections-assets/live-events-1440x900.png) / [Tablet](./signal-media-corrections-assets/live-events-768x1024.png) / [Mobile](./signal-media-corrections-assets/live-events-390x844.png) |
| News | [Desktop](../visual-baseline/v1/news-index--desktop.png) / [Mobile](../visual-baseline/v1/news-index--mobile.png) | [Desktop](./signal-media-corrections-assets/news-1440x900.png) / [Tablet](./signal-media-corrections-assets/news-768x1024.png) / [Mobile](./signal-media-corrections-assets/news-390x844.png) |

## Improvements

- Home removes the dense globe particle layer and title bleed while retaining the cinematic signal-room film, Detroit color language, and responsible-entertainment copy.
- The home startup commercial is delayed to 60 seconds. The background film attempts audible playback on entry and provides a visible sound control plus first-gesture retry when browser policy blocks it.
- Memberships opens with the cinematic Choose Your Membership film using a brighter, lower-contrast treatment, keeps the original title scale, places the plan cards immediately after the hero, moves Collector Access below Gaming Showcase, and closes with the Guardian offer and supplied gun-range commercial.
- The Vault Pass now reads `$29.99` and explicitly includes the Little Man Luggage Charm; its checkout lookup key and integrations were not changed.
- Membership particles now use real Web Audio frequency energy when membership audio is active; reduced-motion mode suppresses the response.
- Arcade uses a clearer cinematic serif title, restores the existing particle mascot as a restrained screen-blended background, and brightens the Little Man toy/Guardian artwork while preserving the playable eight-game directory.
- Home, Memberships, and Storefront now share the same full-width legal footer treatment without duplicate legal destinations.
- Storefront product actions are labeled `Preorder` and build a local device-only preview that explicitly states no order, reservation, payment, or inventory claim was submitted.
- Live Events attempts synchronized hero sound immediately and exposes an accurate `Play sound` fallback instead of claiming sound is active when autoplay is blocked.
- News cards now use story or deterministic editorial imagery instead of repeated placeholder discs.
- Shared navigation reads `Games`, `RAHBE`, `Storefront`, and `Static Wav` without changing route destinations. All ten tab positions now use one stable artwork map and fixed circular geometry across desktop and mobile.
- The Games route restores a persistent, keyboard-focusable `NAV` control that hides and restores the artwork header without removing page navigation from the document.
- Static Wav restores its existing `Follow the Signal` commercial on every page entry, including repeat navigation in the same tab, while retaining the user-gesture sound fallback.
- The Storefront commercial now uses a complete futuristic HUD with a framed portrait viewport, Detroit-sector telemetry rail, signal meter, and always-visible controls on desktop and mobile.
- Static Wav and RAHBE expose a persistent `HIDE NAV` / `SHOW NAV` control after their commercial gate closes, so the artwork header can be removed and restored without losing navigation state.
- Internal navigation now plays a themed outbound clip followed by the destination arrival clip; support and legal routes participate in the same system.
- The Membership commercial keeps its existing film while adopting the Storefront HUD language: clipped signal corners, member-uplink telemetry, cyan/gold framing, and a clearer footer action row.
- Membership and Storefront commercials request audible playback immediately, expose `Play with sound` only when browser policy blocks it, and close automatically when playback ends.

## Intentional Departures

- The v1 Home particle globe was removed at the user's direction. The background film and cyan/gold/violet signal treatments remain.
- The v1 Membership and Arcade entry gates no longer obscure the primary page experience. Commercials remain available through explicit controls.
- Arcade restores the earlier LottoMan particle organism behind the redesigned key art instead of replacing the current Arcade directory.
- Storefront preorder controls remain non-transactional until a separately approved commerce integration is available.
- News uses branded fallback art when a publisher does not provide a usable image. No live result, ranking, community, or social-proof data was invented.
- The Storefront commercial intentionally replaces the plain cinematic frame with a wider HUD composition on desktop and a stacked full-height HUD on mobile. The portrait film and action row remain visible at 1440x900, 768x1024, and 390x844.
- The Membership commercial intentionally replaces its simpler v1 frame with a black/cyan/gold/violet HUD. The film source itself is unchanged, and the navigation toggle stays hidden only while the modal is active so it cannot cover the close control.

## Regressions

- No new broken assets, console errors, page errors, or horizontal overflow were found in the 12 refreshed transition/commercial captures or the previously reviewed route captures.
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

- Removing the Home globe eliminates its Three.js particle workload; the restored Arcade particle mascot is isolated to the Features route and uses the existing reduced-motion path.
- Membership audio analysis reuses one analyser and remains inactive until media is available.
- News no longer probes a missing dynamic API before loading the static feed.
- The supplied membership film is the largest new route asset; it is isolated to the Membership page and is not added to unrelated routes.

## Recommended Corrections

- Keep the explicit sound controls even if future browser versions allow more autoplay scenarios.
- Consider a later, separately approved collapsed-by-default mobile presentation for the News oracle.
- Recheck actual audio output on a physical phone before any production review.

## Approval Status

**Ready for next phase.** This is not production approval. Live checkout was not exercised or changed in this pass.
