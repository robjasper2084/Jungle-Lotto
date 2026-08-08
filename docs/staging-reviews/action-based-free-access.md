# Action-Based Free Access Review

## Scope

- Routes: `/index.html` and `/memberships.html`
- Staging URL: Local only
- Review sizes: `1440x900` and `390x844`
- Production reference: `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/`

## Visual Comparisons

- [Home desktop staging](action-based-free-access-home-desktop.png)
- [Home mobile staging](action-based-free-access-home-mobile.png)
- [Memberships desktop staging](action-based-free-access-memberships-desktop.png)
- [Memberships mobile staging](action-based-free-access-memberships-mobile.png)
- Baseline reference: `docs/visual-baseline/v1/`

## Improvements

- Free access is described with six action-based allowances instead of a countdown.
- The first-use flow offers four clear paths and lets a guest reach and save a result before presenting an upgrade link.
- The membership action now says `Start Free`, removing the timed-demo implication.
- Dormant timed-pass state and expiration routing were removed from the shared site script.

## Limits Verified

- 3 Dream Oracle entries
- 10 creative number sets
- 5 saved items
- 3 Prompt Lab generations
- 2 premium game missions
- 1 Studio export preview

## Visual Notes

- No material layout or art direction change was introduced.
- Black, gold, cyan, and violet styling, orb navigation, Guardian identity, music-technology character, and entertainment-only language remain recognizable.
- Desktop and mobile captures show the quota information legibly within the existing hierarchy.

## Accessibility And Safety

- The upgrade action remains hidden until the selected allowance or saved-item allowance is exhausted.
- Existing keyboard dialog behavior is preserved.
- Staging remains noindex and visibly labeled; production payments, account writes, redemptions, and analytics remain blocked.

## Verification

- Site validation: 17 HTML files
- Focused onboarding browser tests: 8 passed
- Release audit: 7 groups passed
- Route matrix: 162/162 passed
- Static staging: 27 pages and 627 same-origin references
- Staging safety: 12/12 passed

## Regressions

- None observed in the affected routes.

## Approval Status

Ready for next phase
