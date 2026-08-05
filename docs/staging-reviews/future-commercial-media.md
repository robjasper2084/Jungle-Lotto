# Future Commercial And Publisher Media Review

- Review date: 2026-08-03
- Branch: `upgrade-redesign`
- Staging URL: Local only (`http://127.0.0.1:8342/`)
- Affected routes: `/memberships.html`, `/help.html`, `/news/`, and `/lotto%20mind%20refined/`
- Approval status: Ready for next phase

## Production And Baseline References

- Membership baseline: [desktop](../visual-baseline/v1/memberships--desktop.png) and [mobile](../visual-baseline/v1/memberships--mobile.png)
- Help comparison reference: [How-to-use desktop](../visual-baseline/v1/how-to-use--desktop.png) and [mobile](../visual-baseline/v1/how-to-use--mobile.png); Help is a newer route without a direct v1 capture
- News baseline: [desktop](../visual-baseline/v1/news-index--desktop.png) and [mobile](../visual-baseline/v1/news-index--mobile.png)
- LottoMind App: no matching v1 route capture exists

## Staging Captures

- Membership commercial: [desktop](future-commercial-media/memberships--desktop.png) and [mobile](future-commercial-media/memberships--mobile.png)
- Help signal film: [desktop](future-commercial-media/help--desktop.png) and [mobile](future-commercial-media/help--mobile.png)
- News publisher imagery: [desktop](future-commercial-media/news--desktop.png) and [mobile](future-commercial-media/news--mobile.png)
- LottoMind App commercial: [desktop](future-commercial-media/lottomind-app--desktop.png) and [mobile](future-commercial-media/lottomind-app--mobile.png)

## Improvements

- Memberships and the LottoMind App share the supplied 15-second future membership commercial in an accessible cyan/gold HUD.
- Help presents the supplied signal film in the hero with native controls, deferred loading, and explicit sound-on-play wording.
- The static News feed now carries attributed publisher images for 29 of 56 reports. Cards never substitute LottoMind commercial or custom editorial art when a publisher image is unavailable.
- Publisher-host failures fall back to a neutral headline panel, while same-origin asset failures still fail route smoke tests.
- The Membership HUD clears the staging safety banner at `390x844`; its title, close control, film, and actions remain visible without horizontal overflow.

## Regressions And Removed Features

- Regressions discovered: None on the affected routes.
- Features intentionally removed: Custom LottoMind poster fallbacks from News report cards.
- Features unintentionally lost: None found.
- Existing Detroit-inspired black, gold, cyan, violet, Guardian, arcade, and cinematic identity remains recognizable.

## Accessibility And Performance

- Keyboard dismissal, focus containment, Escape, replay, and destination controls remain available in the commercial overlays.
- Help does not autoplay or preload its film; sound begins only after the visitor presses play.
- Membership film: 3,799,896 bytes; poster: 75,038 bytes.
- Help film: 2,933,382 bytes; poster: 67,128 bytes.
- Article images remain lazy-loaded and are linked to their attributed original sources.

## Safety

- Staging remains `noindex,nofollow,noarchive` with its visible preview banner.
- Live payments, production account writes, real redemptions, and production analytics remain disabled.
- No Stripe test mode or isolated staging backend is configured.
- Production URL and deployment source were not changed.

## Recommended Corrections

- None required for this pass. Publisher images should be refreshed periodically with `npm run news:hydrate-images` from `lottominded-ultra.io/news-hub` before future News releases.
