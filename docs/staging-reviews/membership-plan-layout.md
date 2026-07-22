# Membership Plan Layout Review

- Date: 2026-07-21
- Branch: `upgrade-redesign`
- Route: `/memberships.html`
- Staging URL: Local only (`http://127.0.0.1:8143/memberships.html`)
- Viewports: 1440x900 and 390x844
- Approval status: Ready for next phase

## Production References

- [Live Memberships page](https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/memberships.html)
- [v1 desktop baseline](../visual-baseline/v1/memberships--desktop.png)
- [v1 mobile baseline](../visual-baseline/v1/memberships--mobile.png)

The v1 baseline captures the cinematic entry gate. The post-entry comparison also used the production browser reference supplied with the layout comments.

## Staging Captures

- [Desktop deck-first view](membership-plan-layout-assets/staging-desktop-top.png)
- [Desktop Ultra and Vault row](membership-plan-layout-assets/staging-desktop-plans.png)
- [Mobile deck-first view](membership-plan-layout-assets/staging-mobile-top.png)
- [Mobile Ultra card](membership-plan-layout-assets/staging-mobile-plans.png)
- [Mobile Vault card](membership-plan-layout-assets/staging-mobile-vault.png)
- [Desktop Collector and Guardian columns](membership-plan-layout-assets/staging-desktop-support-columns.png)
- [Mobile Collector first](membership-plan-layout-assets/staging-mobile-support-columns.png)
- [Mobile Guardian second](membership-plan-layout-assets/staging-mobile-support-guardian.png)

## Improvements

- The Membership Control Deck now leads the main page content after the global navigation.
- The document order matches the visual order for keyboard and assistive-technology users.
- Ultra Membership and Vault Pass share the same desktop row with matched card height and clearer comparison.
- Collector Access is explicitly assigned to the first support column and the Guardian bundle to its original second column.
- At 390px, the plan grid becomes one full-width column with no horizontal overflow.
- The staging banner and safety status remain visible, and no console errors appeared during capture.

## Identity And Content

- The Detroit-inspired black, gold, cyan, and violet palette remains recognizable.
- Guardian, orb navigation, arcade, cinematic, and music-technology elements are unchanged.
- Responsible entertainment language, pricing, checkout copy, and account behavior are unchanged.
- No features were intentionally removed, and no preserved feature was unintentionally lost.

## Accessibility And Performance

- Keyboard and screen-reader order now follows the visible deck-first hierarchy.
- Desktop cards align in a stable two-column grid; mobile cards retain readable full-width content.
- The change adds one small page-specific stylesheet and one small order helper; no media or production integration was added.
- Reduced-motion capture completed without console errors or layout overflow.

## Regressions And Corrections

- No regression was found in the affected Memberships layout.
- The repository-wide source route run still reports unrelated missing sparse-checkout assets; all 46 staging route checks passed.
- Recommended correction: none for this focused layout request.

## Intentional Visual Departure

The plan deck is intentionally promoted above the cinematic hero, and Vault is intentionally changed from a full-width lower rail into a peer card beside Ultra on desktop. Mobile keeps the safer stacked sequence.

The follow-up browser review restores the Little Man Guardian bundle to its original companion column and fixes Collector Access as the first column. Mobile preserves that same Collector-then-Guardian reading order.
