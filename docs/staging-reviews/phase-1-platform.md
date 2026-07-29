# LottoMind Phase 1 Platform Staging Review

- Production baseline: [`docs/visual-baseline/v1/`](../visual-baseline/v1/)
- Staging URL: Local only (`http://127.0.0.1:8294/` while the verified server is running)
- Implementation commit: `ef73f36c6aea559d4713ccb599811ca380ef4a6c`
- Capture report: [`phase-1-platform-assets/capture-report.json`](phase-1-platform-assets/capture-report.json)
- Approval status: **Ready for next phase**

## Scope

The Phase 1 pack is integrated as a platform-architecture upgrade. A central route
manifest now drives navigation, command search, sitemap generation, route
inventory, and smoke coverage. Canonical App, Arcade, Studio, Help, Account,
Beat2Lotto+, RAHBE, and Static Wav routes replace ambiguous or duplicated public
entry points without removing the existing playable games, commercial media,
membership checkout hooks, local tools, or Collector services.

## Visual Comparison

Representative production baselines:

- [Home desktop](../visual-baseline/v1/home--desktop.png)
- [Features/Arcade desktop](../visual-baseline/v1/features-app--desktop.png)
- [Memberships desktop](../visual-baseline/v1/memberships--desktop.png)
- [Guide desktop](../visual-baseline/v1/how-to-use--desktop.png)

Representative Phase 1 staging captures:

- [Home desktop](phase-1-platform-assets/home-1440x900.png)
- [Home mobile](phase-1-platform-assets/home-390x844.png)
- [App desktop](phase-1-platform-assets/app-1440x900.png)
- [Arcade desktop](phase-1-platform-assets/arcade-1440x900.png)
- [Studio tablet](phase-1-platform-assets/studio-768x1024.png)
- [Help mobile](phase-1-platform-assets/help-390x844.png)
- [Account desktop](phase-1-platform-assets/account-1440x900.png)
- [Memberships mobile](phase-1-platform-assets/memberships-390x844.png)

All seven affected routes were captured at `1440x900`, `768x1024`, and
`390x844`. The 21 captures have no horizontal overflow, console errors, page
errors, broken same-origin assets, missing noindex metadata, or missing staging
banner.

## Findings

- Improvements: Primary destinations are stable and scannable; command search,
  mobile bottom navigation, Help search, and Account states reduce route
  ambiguity.
- Intentional departures: The old Features entry is split into App and Arcade;
  Studio and Account gain clear launch pages; Help becomes searchable; the Home
  page introduces a platform-family explanation and stronger CTA hierarchy.
- Regressions: None found in the tested desktop, tablet, or mobile compositions.
- Features intentionally removed: No playable route, local tool, membership
  tier, commercial, Collector path, or commerce hook was removed.
- Features unintentionally lost: None found.
- Accessibility: Keyboard command navigation, focus return, mobile labels,
  reduced motion, signed-out messaging, and Help deep links pass.
- Performance: No new framework or remote runtime dependency was introduced.
  Route data and UI behavior remain local static assets.
- Identity: Guardian art, orb navigation, Detroit-inspired industrial tone,
  black/gold/cyan/violet color language, music-technology vocabulary, original
  arcade art, cinematic media, and entertainment-only wording remain visible.
- Recommended corrections: None before the next phase. Continue testing any
  future commerce or backend work only through isolated staging services.

## Verification

- Source browser suite: 145 passed, 7 intentional viewport skips, 0 failed.
- Source/staging route matrix: 100/100 passed.
- Staging safety suite: 10/10 passed.
- Static staging verification: 29 pages and 630 same-origin references passed.
- Release gate audit: 7/7 groups passed.
- Visual captures: 21/21 passed automated and representative manual review.
- Production impact: None. `main`, the production workflow, and the live URL
  were not changed.
