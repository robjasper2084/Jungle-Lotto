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

## 2026-07-27 Storefront, Popup, Arcade, And News Addendum

- Implementation commit: `4804b2a25e4d96d54d97f24f23daef3867f37ff7`
- Refreshed routes: Memberships, Membership commercial, Storefront, Static Wav, Arcade, RAHBE, and News
- Refreshed viewports: 1440x900, 768x1024, and 390x844
- Verification: 21/21 captures passed noindex, staging-banner, horizontal-overflow, console-error, page-error, and same-origin asset checks
- Improvement: Commercial popups now share a clear `Buy Now` action that navigates to the protected Storefront instead of initiating checkout.
- Improvement: Storefront's enlarged inline film and HUD remain contained on mobile; the selected products and gallery entry are removed, and the Detroit Embroidery Hoodie preview reads `$89.99`.
- Improvement: Membership appears only after the arrival transition completes, then closes directly to the page when its existing film ends.
- Improvement: Static Wav keeps its existing film inside a matching signal-HUD frame, while RAHBE restores the embedded game and both routes retain the explicit header hide/restore control.
- Improvement: Arcade uses a contained two-column Guardian film layout on desktop and a stacked layout on mobile without obscuring the particle artwork.
- Improvement: Current News cards use local JPG cover-story art whenever the publisher feed does not provide a usable image.
- Intentional departure: The header hide control is absent from routes other than Static Wav and RAHBE.
- Accessibility: Popup close, sound, replay, enter, and Buy Now controls remain keyboard reachable; reduced-motion captures passed at all three sizes.
- Safety: Buy Now is navigation only. Staging continues to block live payments, account writes, real redemptions, and production analytics.
- Approval status: **Ready for next phase.** Production remains unchanged and not approved.

## 2026-07-28 Static Wav Storefront HUD Addendum

- Implementation commits: `710d3a477d0b0eb8e7aba65e9d3f5933b68e4c41` and `19a41a5c3ed07c9e996f849d2318882008917366`
- Refreshed route: Static Wav (`/how-to-use.html`)
- Refreshed viewports: 1440x900, 768x1024, and 390x844
- Verification: 3/3 captures passed noindex, staging-banner, horizontal-overflow, console-error, page-error, and same-origin asset checks
- Improvement: The existing Static Wav film now sits in the same futuristic HUD language as the Storefront commercial, with a larger film bay and a dedicated signal/action rail at wider viewports.
- Improvement: The mobile popup stacks the full title, film, chapter, copy, Enter, Replay, and Buy Now controls below the preview safety bars without cropping or overflow.
- Preserved behavior: The original `lottomind-guide-commercial-20260717.mp4` media, one-pass playback, sound fallback, automatic end-of-film dismissal, route transition, and Storefront-only Buy Now navigation are unchanged.
- Intentional departure: The v1 single-column frame is replaced by a more structured Storefront-style split panel on desktop and tablet.
- Accessibility: The close control has an accessible name, all actions remain keyboard reachable, and reduced-motion capture leaves no running animation.
- Safety: Staging remains noindex and continues to block live payments, account writes, real redemptions, and production analytics.
- Approval status: **Ready for next phase.** Production remains unchanged and not approved.

## 2026-07-28 Membership HUD, Arcade Rail, And Particle Cleanup Addendum

- Implementation commits: `63d9025a36bcb9d27348590d13af42f4a107e67e` and `34ef2bdaa282d55339c35b8ccbf54d4c02b8c089`
- Refreshed routes: Home, Memberships, Arcade, and Storefront
- Refreshed viewports: 1440x900, 768x1024, and 390x844
- Verification: 12/12 captures passed HTTP, noindex, staging-banner, horizontal-overflow, console-error, page-error, and same-origin asset checks
- Membership improvement: The existing inline membership film now uses a cyan, gold, and violet signal HUD with clipped corners, telemetry, and a responsive readout. The film source and commercial lifecycle are unchanged.
- Arcade improvement: The eight-route game directory is now a keyboard-accessible horizontal snap rail with labeled previous and next controls. The Raytrace Pong display title is now `RAYCHASE PONG`; its playable route is unchanged.
- Home intentional departure: The WebGL particle entity and floating signal-particle layer were removed at the user's direction. The cinematic film, scan treatment, Guardian cursor, black/gold/cyan/violet palette, and responsible-entertainment language remain recognizable.
- Storefront intentional departure: The music-reactive equalizer strip was removed. The commercial, playback controls, piano keyboard, FX controls, products, and local-only preorder behavior remain available.
- Accessibility: The Arcade rail is keyboard focusable, its controls have accessible labels, and reduced-motion mode disables smooth rail scrolling and HUD animation.
- Performance: Removing the Home WebGL entity eliminates its particle render workload; removing the Storefront analyzer eliminates its per-frame visualizer updates.
- Safety: Staging remains noindex and visibly labeled. Live payments, production account writes, real redemptions, and production analytics remain blocked.
- Approval status: **Ready for next phase.** Production remains unchanged and not approved.

### Refreshed Visual Evidence

| Surface | v1 baseline | Staging |
| --- | --- | --- |
| Home | [Desktop](../visual-baseline/v1/home--desktop.png) / [Tablet](../visual-baseline/v1/home--tablet.png) / [Mobile](../visual-baseline/v1/home--mobile.png) | [Desktop](./signal-media-corrections-assets/home-1440x900.png) / [Tablet](./signal-media-corrections-assets/home-768x1024.png) / [Mobile](./signal-media-corrections-assets/home-390x844.png) |
| Membership inline HUD | [Desktop](../visual-baseline/v1/memberships--desktop.png) / [Tablet](../visual-baseline/v1/memberships--tablet.png) / [Mobile](../visual-baseline/v1/memberships--mobile.png) | [Desktop](./signal-media-corrections-assets/membership-inline-hud-1440x900.png) / [Tablet](./signal-media-corrections-assets/membership-inline-hud-768x1024.png) / [Mobile](./signal-media-corrections-assets/membership-inline-hud-390x844.png) |
| Arcade directory | [Desktop](../visual-baseline/v1/features-app--desktop.png) / [Tablet](../visual-baseline/v1/features-app--tablet.png) / [Mobile](../visual-baseline/v1/features-app--mobile.png) | [Desktop](./signal-media-corrections-assets/arcade-directory-1440x900.png) / [Tablet](./signal-media-corrections-assets/arcade-directory-768x1024.png) / [Mobile](./signal-media-corrections-assets/arcade-directory-390x844.png) |
| Storefront console | [Desktop](../visual-baseline/v1/merch-store--desktop.png) / [Tablet](../visual-baseline/v1/merch-store--tablet.png) / [Mobile](../visual-baseline/v1/merch-store--mobile.png) | [Desktop](./signal-media-corrections-assets/storefront-console-1440x900.png) / [Tablet](./signal-media-corrections-assets/storefront-console-768x1024.png) / [Mobile](./signal-media-corrections-assets/storefront-console-390x844.png) |

## 2026-07-28 Membership Transition Sequence Addendum

- Affected route: Memberships (`/memberships.html`)
- Required sequence: arrival transition, Membership commercial, outbound transition, Membership page
- Verification: The entry commercial cannot open until the arrival transition emits its completion event. When the film ends or the entry commercial is dismissed, the Membership page remains inert while a dedicated outbound transition plays and becomes interactive only after that transition completes.
- Focused browser tests: 4/4 passed across desktop and mobile, including event-order and page-inert assertions.
- Route verification: 92/92 source/staging desktop/mobile route checks passed.
- Staging verification: 10/10 safety checks passed; 23 staging pages and 541 same-origin references verified.
- Visual verification: 3/3 captures passed at 1440x900, 768x1024, and 390x844 with no horizontal overflow, console errors, page errors, or broken assets.
- Before/after: The v1 and current Membership HUD, film, actions, Guardian language, and black/gold/cyan/violet identity are visually unchanged. The intentional departure is the deterministic four-stage handoff and the removal of page exposure between the commercial and final transition.
- Staging safety: Noindex and preview banners remain active. Live payments, production account writes, real redemptions, and production analytics remain blocked.
- Approval status: **Ready for next phase.** Production remains unchanged and not approved.

### Membership Sequence Captures

- [Desktop staging](./signal-media-corrections-assets/membership-transition-sequence-1440x900.png)
- [Tablet staging](./signal-media-corrections-assets/membership-transition-sequence-768x1024.png)
- [Mobile staging](./signal-media-corrections-assets/membership-transition-sequence-390x844.png)
- [v1 desktop baseline](../visual-baseline/v1/memberships--desktop.png)
- [v1 tablet baseline](../visual-baseline/v1/memberships--tablet.png)
- [v1 mobile baseline](../visual-baseline/v1/memberships--mobile.png)

## 2026-07-28 Membership 3D Depth Addendum

- Affected route: Memberships (`/memberships.html`)
- Improvement: The Membership hero now responds to fine-pointer movement with restrained copy, HUD, and control parallax. Plan cards and the bottom Guardian card use true perspective tilt, layered emblems, and a pointer-following signal sheen.
- Interaction safety: Keyboard focus raises the active card without obscuring its controls. Coarse-pointer, mobile, and reduced-motion environments use a stable non-tilting presentation.
- Preserved identity: The existing Detroit footage, Guardian and orb artwork, black/gold/cyan/violet color system, cinematic HUD language, membership wording, and responsible-entertainment context remain recognizable.
- Intentional departure: The post-commercial Membership page is more dimensional than the flat v1 baseline. Layout, plan order, pricing, commercial media, and protected actions are unchanged.
- Verification: The focused depth and Membership route tests passed 6/6 across desktop and mobile. The full source/staging route matrix passed 92/92. Staging safety passed 10/10, and static staging verification covered 23 pages and 541 same-origin references.
- Visual verification: 6/6 interaction captures passed at 1440x900, 768x1024, and 390x844 with no horizontal overflow, console errors, page errors, or broken assets.
- Safety: Staging remains noindex and visibly labeled. Live payments, production account writes, real redemptions, and production analytics remain blocked.
- Approval status: **Ready for next phase.** Production remains unchanged and not approved.

### Membership Depth Captures

| Surface | v1 baseline | Staging |
| --- | --- | --- |
| Hero depth | [Desktop](../visual-baseline/v1/memberships--desktop.png) / [Tablet](../visual-baseline/v1/memberships--tablet.png) / [Mobile](../visual-baseline/v1/memberships--mobile.png) | [Desktop](./signal-media-corrections-assets/membership-depth-hero-1440x900.png) / [Tablet](./signal-media-corrections-assets/membership-depth-hero-768x1024.png) / [Mobile](./signal-media-corrections-assets/membership-depth-hero-390x844.png) |
| Plan depth | [Desktop](../visual-baseline/v1/memberships--desktop.png) / [Tablet](../visual-baseline/v1/memberships--tablet.png) / [Mobile](../visual-baseline/v1/memberships--mobile.png) | [Desktop](./signal-media-corrections-assets/membership-depth-plans-1440x900.png) / [Tablet](./signal-media-corrections-assets/membership-depth-plans-768x1024.png) / [Mobile](./signal-media-corrections-assets/membership-depth-plans-390x844.png) |
