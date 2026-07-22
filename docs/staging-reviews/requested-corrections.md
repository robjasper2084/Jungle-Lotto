# Requested Corrections Staging Review

- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8143/`)
- Routes compared: `/memberships.html`, `/how-to-use.html`, `/live-events.html`, `/news/`, `/lottery-spheres.html#spheres`
- Viewports: 1440x900 and 390x844
- Approval status: **Ready for next phase**

## Screenshot Links

| Route | Production desktop | Production mobile | Staging desktop | Staging mobile |
| --- | --- | --- | --- | --- |
| Memberships | [v1 desktop](../visual-baseline/v1/memberships--desktop.png) | [v1 mobile](../visual-baseline/v1/memberships--mobile.png) | [staging desktop](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/memberships-1440x900.png) | [staging mobile](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/memberships-390x844.png) |
| Static Wav | [v1 desktop](../visual-baseline/v1/how-to-use--desktop.png) | [v1 mobile](../visual-baseline/v1/how-to-use--mobile.png) | [staging desktop](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/static-wav-1440x900.png) | [staging mobile](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/static-wav-390x844.png) |
| Live Events | [v1 desktop](../visual-baseline/v1/live-events--desktop.png) | [v1 mobile](../visual-baseline/v1/live-events--mobile.png) | [staging desktop](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/live-events-1440x900.png) | [staging mobile](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/live-events-390x844.png) |
| News | [v1 desktop](../visual-baseline/v1/news-index--desktop.png) | [v1 mobile](../visual-baseline/v1/news-index--mobile.png) | [staging desktop](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/news-1440x900.png) | [staging mobile](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/news-390x844.png) |
| Lottery Spheres | [v1 desktop](../visual-baseline/v1/lottery-spheres-spheres--desktop.png) | [v1 mobile](../visual-baseline/v1/lottery-spheres-spheres--mobile.png) | [staging desktop](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/lottery-spheres-1440x900.png) | [staging mobile](../../lottominded-ultra.io/docs/staging-reviews/requested-corrections/screenshots/lottery-spheres-390x844.png) |

## Improvements

- Membership Control Deck now leads the page, with Collector Access first and the Little Man Guardian bundle in the adjacent desktop column.
- Ultra and Vault remain paired in the plan grid; the user-marked compare, benefit, add-on, and billing region is removed.
- Shared navigation uses `Lilman` and `Static Wav`, including the asynchronously rendered News header.
- News story cards show local editorial pictures while retaining source labels and responsible-play wording.
- The Magic 8 oracle now uses the same cyan, white, gold, and dark material language as the moving lottery spheres.
- Live Events attempts synchronized hero-video audio and retains an explicit Sound On control when browser autoplay policy blocks audible playback.
- Mobile Memberships and Live Events keep the signal marquee in flow instead of covering page headings.

## Intentional Visual Departures

- Memberships presents pricing decisions before the longer cinematic membership story.
- The Magic 8 oracle changes from a blue/violet utility panel to a luminous sphere treatment.
- News cards use real local LottoMind imagery instead of pattern-only story surfaces.
- The membership and Guide commercial films are preserved; screenshot automation dismisses them only to expose the affected page layouts.

## Regressions And Removed Features

- Regressions discovered: none in the affected route checks.
- Features intentionally removed: the user-selected lower membership comparison, benefit, LottoCredits add-on, and billing-information blocks.
- Features unintentionally lost: none found.

## Accessibility And Performance

- All captured routes returned 200 with no page, console, or same-origin asset failures.
- Staging `noindex,nofollow,noarchive`, the preview banner, and payment/account/redemption/analytics guards remained active.
- Reduced-motion route smoke passed, and the mobile marquee fixes remove text collisions at 390x844.
- No new media asset was added. Live Events reuses its existing soundtrack and News reuses repository images.

## Recommended Corrections

- Keep live checkout excluded until the separately controlled checkout verification and release-candidate review are complete.
- Treat audible autoplay as best-effort browser behavior; preserve the visible Sound On fallback.
