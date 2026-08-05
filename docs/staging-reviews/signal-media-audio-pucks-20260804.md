# Signal Media And Live Events Audio Review

- Date: 2026-08-04
- Branch: `upgrade-redesign`
- Production reference: https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/
- Staging preview: http://127.0.0.1:8381/
- Routes reviewed: `/index.html#top`, `/news/`, `/live-events.html`
- Viewports: `1440x900`, `768x1024`, `390x844`

## Production Baselines

- [Home desktop](../visual-baseline/v1/home--desktop.png)
- [Home mobile](../visual-baseline/v1/home--mobile.png)
- [News desktop](../visual-baseline/v1/news-index--desktop.png)
- [News mobile](../visual-baseline/v1/news-index--mobile.png)
- [Live Events desktop](../visual-baseline/v1/live-events--desktop.png)
- [Live Events mobile](../visual-baseline/v1/live-events--mobile.png)

## Staging Captures

- [Home desktop](signal-media-corrections-assets/home-1440x900.png)
- [Home tablet](signal-media-corrections-assets/home-768x1024.png)
- [Home mobile](signal-media-corrections-assets/home-390x844.png)
- [News desktop](signal-media-corrections-assets/news-1440x900.png)
- [News tablet](signal-media-corrections-assets/news-768x1024.png)
- [News mobile](signal-media-corrections-assets/news-390x844.png)
- [Live Events desktop](signal-media-corrections-assets/live-events-1440x900.png)
- [Live Events tablet](signal-media-corrections-assets/live-events-768x1024.png)
- [Live Events mobile](signal-media-corrections-assets/live-events-390x844.png)

## Improvements

- Live Events no longer starts a muted preview. The film remains stopped until the visitor selects **Start with sound**, then the film and its companion performance audio begin audibly from time zero.
- When the performance ends, the existing Live Events page mix takes over instead of playing over the film.
- The supplied LottoMind puck artwork replaces the old Live Events particle-ball field, with reduced-motion and mobile variants.
- Home uses the supplied apparel commercial and the Storefront-derived theme while retaining an explicit visitor sound choice.
- News owns its verified Powerball and Mega Millions marquee, keeps the full-width frequency dock, and gives Search, Credits, and Account distinct HUD colors.

## Identity And Accessibility

- The Detroit-inspired black, gold, cyan, and violet system, cinematic archive film, Guardian artwork, sphere navigation, and music-technology character remain recognizable.
- The sound start is a keyboard-focusable button with an accessible pressed state. Audible playback is user initiated so browser autoplay restrictions do not create a hidden muted state.
- Reduced motion freezes the floating pucks, and the mobile sound control remains visible without covering the Live Events heading.
- At `390x844`, the News Search, Credits, and Account utilities occupy their own row above the horizontally scrollable sphere navigation with no overlap or horizontal page overflow.
- Staging retains `noindex,nofollow,noarchive`, the preview banner, and disabled production payments, account writes, redemptions, and analytics.

## Findings

- Same-origin assets, route layout, staging metadata, and staging safety checks passed: 26 injected pages, 593 same-origin references, 12 staging safety tests, and 156 source/staging route checks.
- Some News publisher images reject automated hotlink capture with `ERR_BLOCKED_BY_ORB` or `ERR_CONNECTION_CLOSED`. The affected cards retain their accessible text and source links; no local asset is broken.
- No features were intentionally removed.
- No preserved feature was found unintentionally lost.

## Approval

- Status: Ready for next phase
- Production approval: Not approved
