# Performance Media Pass Review

## Scope

- Audited commit: `697afdc22318eae5646eb0b7b081d2350fbf039e`
- Staging URL: Local only (`http://127.0.0.1:8321/`)
- Routes: Memberships, Arcade, Static Wav, Robot RAHBEE, Storefront, and Live Events
- Viewports: `1440x900`, `768x1024`, and `390x844`
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`

## Visual Evidence

- Current staging contact sheets: [desktop](performance-media-pass-assets/desktop-contact-sheet.jpg), [tablet](performance-media-pass-assets/tablet-contact-sheet.jpg), [mobile](performance-media-pass-assets/mobile-contact-sheet.jpg)
- Machine-readable capture results: [manifest](performance-media-pass-assets/manifest.json)
- Production contact sheets: [desktop](../visual-baseline/v1/desktop-contact-sheet.png), [tablet](../visual-baseline/v1/tablet-contact-sheet.png), [mobile](../visual-baseline/v1/mobile-contact-sheet.png)
- Production route captures: [Memberships](../visual-baseline/v1/memberships--desktop.png), [Arcade](../visual-baseline/v1/features-app--desktop.png), [Static Wav](../visual-baseline/v1/how-to-use--desktop.png), [Robot RAHBEE](../visual-baseline/v1/beat2lotto-plus--desktop.png), [Storefront](../visual-baseline/v1/merch-store--desktop.png), [Live Events](../visual-baseline/v1/live-events--desktop.png)

## Improvements

- Memberships and Arcade start from their existing posters and defer nonessential hero-film hydration until after page load and idle time.
- Static Wav and Robot RAHBEE no longer create a game document on page entry. Each iframe remains without `src` until its explicit Launch Game command.
- The two supplied Storefront bundle images were converted from approximately 4.16 MiB of PNG data to approximately 0.16 MiB of WebP data. Pointer-depth work now runs only on fine-pointer devices, and coarse/reduced-motion modes suppress costly decorative animation and filtering.
- The mobile Live Events player is a compact now-playing strip. It retains the primary play control, removes redundant mobile-only skip controls and artwork, and no longer overlaps the floating Menu control.
- All 18 current staging captures returned `200`, retained noindex and the staging safety banner, showed no broken images or horizontal overflow, and produced no console or page errors.

## Performance Findings

The same throttled mobile 4G sampler was run before and after this pass. Values are directional local measurements, not production budgets.

| Route | Transfer before | Transfer after | FCP before | FCP after | Wall load before | Wall load after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Memberships | 2.28 MiB | 2.28 MiB | 6252 ms | 3752 ms | 9687 ms | 6690 ms |
| Arcade | 2.14 MiB | 2.14 MiB | 6228 ms | 6228 ms | 7291 ms | 5929 ms |
| Live Events | 2.04 MiB | 2.04 MiB | 2332 ms | 2232 ms | 9804 ms | 9437 ms |
| Storefront | 1.20 MiB | 1.42 MiB | 2412 ms | 2220 ms | 2747 ms | 2610 ms |
| Robot RAHBEE | 1.11 MiB | 0.94 MiB | 1964 ms | 1904 ms | 2208 ms | 1990 ms |
| Static Wav | 1.29 MiB | 1.02 MiB | 2012 ms | 1908 ms | 2167 ms | 2030 ms |

Storefront's full-route sample increased because the deferred hero film entered the three-second measurement window; its two bundle-image payloads are nonetheless reduced by about 96 percent. Desktop totals intentionally include media that begins after idle or commercial startup, so they remain substantially heavier than first-view mobile transfers.

## Accessibility And Safety

- Keyboard-visible controls and existing commercial fallbacks remain intact.
- The mobile player regression test verifies a maximum 72-pixel player height, visible primary control, hidden redundant controls, no Menu collision, and no document overflow.
- Reduced-motion behavior passed route smoke checks at all three viewport sizes.
- Staging remains noindex and blocks live payments, production account writes, real redemptions, and production analytics.

## Regressions And Removals

- Regressions discovered: None.
- Features intentionally removed: None. Mobile Live Events hides only redundant player artwork and previous/next controls; playback remains available.
- Features unintentionally lost: None.
- Intentional visual departure: The phone Live Events player is visibly slimmer than v1. The other changes preserve the established commercials, Guardian art, Detroit character, and black/gold/cyan/violet language.

## Recommended Corrections

- Compress or stream the 11.6 MiB Memberships entry commercial before a later production candidate.
- Revisit Live Events' five embedded media frames and Storefront's hero-film timing if a stricter initial-transfer budget is adopted.
- Optimize the shared 2.38 MiB coin artwork, which remains one of the largest common image requests.

## Approval Status

Ready for next phase. Production approval remains not approved.
