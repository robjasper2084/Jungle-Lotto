# Platform Route Restore Review

## Scope

- Branch: `upgrade-redesign`
- Implementation commit: `d5cd5b5ef390059ab0a9a3c19b7b365e027bc56a`
- Staging URL: `http://127.0.0.1:8143/` (local only)
- Production URL: `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/`
- Production was not changed.

## Restored

- LottoMind App overview at `/features.html`
- Arcade overview and eight current game routes at `/arcade.html`
- Account and Collector Vault at `/account.html`
- Search, Credits, Account, Help Center, Contact, Accessibility, and account-recovery routes
- Large grouped News + Events route chooser
- Shared desktop and mobile navigation with Memberships last
- Shared HUD footer route directory

## Preserved

- Existing cinematic Home, Memberships, Storefront, Games, RAHBE, and Static Wav experiences
- Current game names and playable HTML destinations
- Original page-transition behavior
- Stem Studio source and implementation under `/lottomind-stem-studio/`
- Detroit-inspired black, gold, cyan, and violet identity
- Guardian artwork, music-technology controls, arcade personality, and responsible-entertainment language

The unfinished Studio launcher is hidden from shared navigation and headers. Its
underlying implementation remains saved for later work.

## News Background

News now uses the Robot RAHBE gameplay artwork as a restrained cyan/violet depth
layer. Pointer movement adds subtle depth on desktop; reduced-motion and touch
devices receive a static treatment. The article cards, source labels, and reading
controls remain unchanged and readable.

## Verification

- Focused platform shell: 12 passed across desktop and mobile.
- Full source browser suite: 142 passed, 6 expected viewport skips.
- Route matrix: 100 passed across source/staging and desktop/mobile.
- Staging safety: 10 passed on fresh port `8300`.
- Release gates: 7 groups passed.
- Site validation: 18 HTML files passed.
- Homepage validation: 5 IDs and 67 references passed.
- Staging artifact: 26 noindex pages and 600 same-origin references verified.
- Visual verification: 15 captures across five affected routes at `1440x900`,
  `768x1024`, and `390x844`.
- Visual failures: none; no horizontal overflow, console errors, page errors,
  broken same-origin assets, or visible Studio launcher.

## Visual Comparison

- Current captures: [platform-route-restore-assets](./platform-route-restore-assets/)
- v1 baseline: [visual-baseline/v1](../visual-baseline/v1/)
- App, Arcade, and Account are intentional restored surfaces not present in the
  v1 route baseline.
- News retains its existing intelligence-console hierarchy while adding the
  recolored RAHBE depth artwork and the current shared navigation shell.
- RAHBE gameplay and transitions are unchanged; only its unfinished shared
  Studio launcher is hidden.

## Safety

- Staging is visibly labeled and carries `noindex,nofollow,noarchive`.
- Live payments, production account writes, real redemptions, and production
  analytics remain blocked.
- Local Account preview is read-only and does not call the production account
  endpoint.
- No live checkout, charge, redemption, or production mutation was attempted.
- `main`, production deployment, and `v1-final` were not changed.

## Approval Status

Ready for next phase. Production remains unchanged and not approved.
