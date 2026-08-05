# Help And Presentation Media Staging Review

## Scope

- Branch: `upgrade-redesign`
- Staging URL: Local only (`http://127.0.0.1:8342/`)
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Affected routes: Home, Help, Arcade, Storefront, and Account
- Viewports: `1440x900`, `768x1024`, and `390x844`

## Visual Evidence

- Current staging: [desktop contact sheet](release-signoff-assets/desktop-contact-sheet.png), [tablet contact sheet](release-signoff-assets/tablet-contact-sheet.png), [mobile contact sheet](release-signoff-assets/mobile-contact-sheet.png), and [machine manifest](release-signoff-assets/release-signoff-manifest.json)
- Production contact sheets: [desktop](../visual-baseline/v1/desktop-contact-sheet.png), [tablet](../visual-baseline/v1/tablet-contact-sheet.png), and [mobile](../visual-baseline/v1/mobile-contact-sheet.png)
- Production route captures: [Home desktop](../visual-baseline/v1/home--desktop.png), [Home mobile](../visual-baseline/v1/home--mobile.png), [Arcade desktop](../visual-baseline/v1/features-app--desktop.png), [Arcade mobile](../visual-baseline/v1/features-app--mobile.png), [Storefront desktop](../visual-baseline/v1/merch-store--desktop.png), and [Storefront mobile](../visual-baseline/v1/merch-store--mobile.png)
- Help and Account are upgrade routes without direct `v1-final` route captures; their current states are included in all three staging contact sheets.

## Improvements

- The mobile Help reading block is compact enough that Search Help and Contact Support remain above the fixed Credits and Menu controls at `390x844`.
- The Home entry popup uses the established Storefront unboxing commercial and poster, with the same explicit muted-first sound and entry controls.
- Arcade and Account use visually equivalent WebP artwork, and Home, Arcade, and Storefront request optimized MP4 variants.
- The complete 25-route inventory passed visual, keyboard-focus, reduced-motion, noindex, preview-banner, environment-safety, overflow, console, page-error, and asset checks in 75/75 captured states.

## Performance Findings

| Asset | Original | Optimized | Reduction |
| --- | ---: | ---: | ---: |
| Membership unboxing commercial | 9,451,885 B | 2,510,553 B | 73.4% |
| Community signal commercial | 7,013,235 B | 1,864,180 B | 73.4% |
| Arcade hero film | 5,504,511 B | 1,456,846 B | 73.5% |
| Account hero artwork | 1,997,867 B | 159,488 B | 92.0% |
| Arcade marquee artwork | 3,038,065 B | 192,458 B | 93.7% |

Current staging same-origin bytes after the sign-off capture window:

| Route | Desktop | Tablet | Mobile |
| --- | ---: | ---: | ---: |
| Home | 5,575,167 B | 5,413,399 B | 4,675,978 B |
| Arcade | 7,999,856 B | 7,277,204 B | 4,455,238 B |
| Storefront | 4,222,897 B | 4,211,619 B | 4,211,619 B |
| Account | 2,735,608 B | 2,562,562 B | 2,562,562 B |
| Help | 1,218,682 B | 1,045,636 B | 1,045,636 B |

These local measurements include route-specific startup behavior and are not a production budget. Original source assets were preserved.

## Accessibility And Safety

- Mobile Help fixed-control clearance passed both source geometry and staging interaction checks.
- Keyboard focus and reduced-motion checks passed on all 75 captured states.
- Staging remained `noindex,nofollow,noarchive` with a visible preview banner.
- Live payments, production account writes, real redemptions, and production analytics remained disabled.
- The Home commercial never claims audible playback until the visitor requests it.

## Before And After Notes

- Intentional departures: Home shows the Storefront unboxing commercial; the Help mobile hero is shorter; compressed video and WebP sources replace heavier presentation requests.
- Preserved identity: the Detroit-inspired cinematic treatment, Guardian artwork, black/gold/cyan/violet language, music-technology personality, arcade character, and responsible-entertainment wording remain recognizable.
- Regressions discovered: None in automated visual and interaction coverage.
- Features intentionally removed: None.
- Features unintentionally lost: None found.

## Recommended Corrections

- Continue deferring nonessential Memberships media, which remains the heaviest mobile capture when its commercial opens.
- Keep future videos on the optimized pipeline and adopt a formal route transfer budget before the next release candidate.
- Complete a manual screen-reader pass and fresh safe checkout handoff before production review.

## Approval Status

Ready for next phase. Production approval remains not approved.
