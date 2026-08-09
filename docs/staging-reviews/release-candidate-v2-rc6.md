# Release Candidate v2-rc6 Review

- Review date: 2026-08-09
- Branch: `upgrade-redesign`
- Candidate SHA: immutable target of annotated tag `v2-rc6`
- Visual source SHA: `afbf7a58ab89750e65f7051ba34ecefe3057984f`
- Production reference: `main` at `441127f6d69d3021b9080f48e4246013ca674a6a`
- Staging URL: Local only (`http://127.0.0.1:8649/` during verification)
- Candidate tag: `v2-rc6`
- Approval status: **Ready for production review**

## Verification

- Full source browser suite: 232 passed, 8 intentional skips, 0 failed.
- Route matrix: 168/168 passed.
- Release audit: all 10 groups passed.
- Staging safety: 12/12 passed.
- Static artifact: 28 noindexed pages and 636 same-origin references passed.
- Visual sign-off: 81/81 desktop, tablet, and mobile route states passed across 27 routes.
- Live Events synchronization stress: 24/24 passed.
- News: 24/24; Trivia: 13/13; GothTechnology: 43/43 unit and 27 browser checks passed.
- Secure backend contract passed for eight RLS-protected tables and the append-only credit ledger.

## Checkout Safety

The authenticated Collector flow previously opened the Gold plan in Stripe Checkout with a visible `Sandbox` marker. No payment details were entered, no payment was submitted, and no charge was attempted. Staging live payments, production account writes, real redemptions, and production analytics remain blocked.

Store ordering remains fail-closed. Inventory, shipping, tax, returns, confirmation email, and carrier tracking require final operational verification before merchandise checkout can be enabled.

## Visual Review

All 27 routes passed at `1440x900`, `768x1024`, and `390x844` with visible focus, reduced-motion behavior, no horizontal overflow, no console/page errors, no broken same-origin assets, and zero external-asset warnings. The manifest measured same-origin transfers from 64,057 bytes to 14,589,047 bytes, with a median of 2,088,800 bytes.

This candidate adds the finished Trivia Vault route and retains the current account, Storefront, Live Events, Arcade, navigation, media, and support corrections. The Detroit-inspired black, gold, cyan, and violet styling, Guardian artwork, music-technology controls, cinematic media, and responsible-entertainment language remain recognizable.

## Remaining Warnings

- Staging is local only; no remote staging provider is configured.
- Manual screen-reader review remains recommended.
- Static Wav and Memberships remain the heaviest measured first-view routes.
- Browser autoplay policy can require a user gesture before audible media starts; explicit sound controls remain available.
- Store ordering remains locked pending verified operations.

## Decision

Ready for production review. This review does not authorize merging or deploying `main`. A fresh exact `APPROVE PRODUCTION MERGE` is required after the candidate tag and PR head are verified.
