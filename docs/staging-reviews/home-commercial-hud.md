# Home Commercial HUD Review

- Branch: `upgrade-redesign`
- Baseline: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8500/` during verification)
- Routes compared: `/index.html#top` and `/merch-store.html`
- Viewports: `1440x900` and `390x844`
- Production status: Unchanged; the production Home HTML did not contain `lm-commercial-hud.css` during this review

## Screenshot Links

- Production Home baseline: [desktop](../visual-baseline/v1/home--desktop.png) and [mobile](../visual-baseline/v1/home--mobile.png)
- Staging Home HUD: [desktop](home-commercial-hud-assets/home-staging-desktop.png) and [mobile](home-commercial-hud-assets/home-staging-mobile.png)
- Staging Storefront reference: [desktop](home-commercial-hud-assets/storefront-staging-desktop.png) and [mobile](home-commercial-hud-assets/storefront-staging-mobile.png)
- Machine-readable measurements: [visual metrics](home-commercial-hud-assets/visual-metrics.json)

## Improvements

- Home now uses the same full-screen cinematic HUD system as Storefront: clipped frame, corner brackets, cyan and gold rails, scan treatment, telemetry column, signal meter, and footer command deck.
- Both dialogs measure exactly `1216x768` at `1440x900` and `390x844` at the mobile viewport.
- Home retains its own supplied film, poster, title, telemetry copy, `Play with sound`, `Enter Site`, and close controls.
- The shared stylesheet prevents the two commercial frames from drifting apart in future layout changes.

## Baseline Comparison

The v1 Home baseline did not include this full-screen commercial HUD. The larger Storefront-style transmission frame is an intentional visual departure. The black and navy foundation, gold premium accents, cyan interaction language, violet signal accents, cinematic media, Detroit sector language, and music-technology personality remain recognizable.

## Regressions

- None found in the affected routes.
- No horizontal overflow, console errors, page errors, or missing same-origin assets were observed.
- One unrelated Live Events synchronization assertion missed its timing tolerance during the first four-worker run; the focused rerun passed `4/4` and the complete rerun passed `182` with `8` intentional skips.

## Features Intentionally Removed

- None.

## Features Unintentionally Lost

- None found. Storefront keeps Replay and Buy Now; Home keeps Enter Site and its existing muted-first sound request.

## Accessibility Findings

- Dialog semantics, labelled close controls, keyboard-operable commands, and visible native pointer behavior remain available.
- Audio remains visitor-controlled and does not begin without a gesture.
- Reduced-motion rules disable scan, meter, and pulse animations.
- All mobile commands remain visible inside the viewport.

## Performance Findings

- Existing optimized Home and Storefront media files were preserved; no duplicate video was added.
- Both videos retain `preload="none"`, so the visual consolidation does not add an eager media transfer.

## Recommended Corrections

- None required for this scoped change.

## Approval Status

Ready for next phase. This review does not approve or deploy production.
