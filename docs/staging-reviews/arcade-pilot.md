# LottoMind Arcade Pilot Review

## Scope

- Pilot branch: `upgrade-redesign-arcade-pilot`
- Parent branch and recorded base: `upgrade-redesign` at `b8e6c4a78b94dafae71cec538093adf40ce170f2`
- Production snapshot: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Route reviewed: `/lottominded-ultra.io/features-app.html`
- Pilot preview: Local only at `http://127.0.0.1:8143/features-app.html` while the staging server is running
- Remote preview: Not deployed; no isolated branch-preview provider is configured

Production and the parent upgrade branch use the same `features-app.html` blob (`53cba1b31799b548f699874bd2b8fe9b7ba7392c`). The parent staging screenshots therefore add only the required preview safety shell to the production Arcade layout.

## Screenshot Evidence

| Viewport | Production | Main upgrade staging | Arcade pilot staging |
| --- | --- | --- | --- |
| 1440x900 | [Production desktop](../visual-baseline/v1/features-app--desktop.png) | [Parent desktop](./arcade-pilot-assets/main-upgrade-desktop.png) | [Pilot desktop](./arcade-pilot-assets/pilot-desktop.png) |
| 390x844 | [Production mobile](../visual-baseline/v1/features-app--mobile.png) | [Parent mobile](./arcade-pilot-assets/main-upgrade-mobile.png) | [Pilot mobile](./arcade-pilot-assets/pilot-mobile.png) |

Capture metrics: [pilot-capture-metrics.json](./arcade-pilot-assets/pilot-capture-metrics.json)

## What Improved

- The playable directory is now the primary page purpose instead of sitting below a commercial video, feature rails, and duplicated studio controls.
- All eight routes render from `assets/js/arcade-games.js`; the page contains no second static game list or alternate directory source.
- Cards share one media ratio, information order, control label, status treatment, and launch action.
- Category filters, search, and sort controls provide a compact Arcade-specific navigation layer without changing the global production navigation.
- Desktop uses a stable three-column game deck, tablet uses two columns, and mobile uses one column without horizontal overflow.
- Keyboard focus is visible, filters expose pressed state, search and sort have labels, status updates use an accessible live region, and reduced-motion mode disables transitions.
- Guardian/Little Man key art, the LottoMind orb system, original game art, industrial display type, and black/gold/cyan/violet language remain immediately recognizable.

## What Was Removed

- The feature-page backdrop video and Guardian promotional autoplay video
- The top and bottom duplicate studio instrument consoles
- The full-page audio player and audio track
- The lottery news panel and modal
- The unrelated member-tool stack and motion feature rail
- GSAP, ScrollTrigger, Lenis, Three.js, cinematic particle scripts, the commercial gate, and the alternate `assets/js/arcade.js` renderer from this route

Prompt Lab and Stem Studio were not changed. Their playable routes remain available as manifest-driven Arcade cards. Membership pricing, account services, Stripe, merch checkout, shared production navigation links, `main`, and `v1-final` were not modified.

## Performance Comparison

| Measure | Production Arcade | Main upgrade staging | Arcade pilot |
| --- | ---: | ---: | ---: |
| Source HTML | 30,497 bytes | 30,497 bytes | 8,129 bytes |
| Stylesheet references | 12 | 12 | 3 |
| Script tags, including metadata/import map | 16 | 16 | 3 |
| Video tags | 3 | 3 | 0 |
| Audio tags | 1 | 1 | 0 |

The pilot reduces the HTML document by 73.3% and removes autoplay media plus the heaviest animation/runtime dependencies from this route. Its fully scrolled evidence capture loaded all eight game images in 24 same-origin responses totaling 9,010,528 bytes by `Content-Length`; only the hero and first two cards are eager, while the remaining cards load as they approach the viewport. Desktop and mobile captures reported no overflow, failed responses, or console errors.

## Navigation Comparison

- Production and parent staging: global orb navigation, then multiple feature systems before the complete game directory.
- Pilot: the same global orb navigation, a direct two-action Arcade hero, a compact manifest-derived category strip, then search, sort, and standardized launch cards.
- The pilot does not replace or edit production navigation. Its local category strip affects only the Arcade directory.

## Functional Parity

Every manifest route remains present and launchable:

1. GothTechnology
2. LottoMind: Jackpot Maze
3. 2084 Static Wave
4. Robot Rahbe
5. Raytrace Pong
6. Lottery Spheres in Motion
7. Beat2Lotto+ Prompt Lab
8. LottoMind Stem Studio

No playable route was unintentionally lost. Removed panels were outside the focused Arcade launch workflow.

## Accessibility And Safety

- Pilot-specific desktop and mobile browser tests passed.
- The full 92-check source/staging route matrix passed with only the existing allowlisted Contact, Stem Studio, and Jackpot Maze findings.
- Staging remained `noindex,nofollow,noarchive` and visibly labeled as not production.
- Live payments, real redemption, production account writes, and production analytics remained blocked.
- Entertainment-only wording remains visible on the page.

## Recommendation

**Accept pilot into `upgrade-redesign` for controlled parent-branch review.**

The pilot materially improves clarity and mobile efficiency without flattening LottoMind into a generic app shell. Acceptance is a recommendation only: this branch has not been merged into `upgrade-redesign` or `main`.

## Approval Status

- Pilot decision: Ready for parent-branch review
- Production approval: Not approved
