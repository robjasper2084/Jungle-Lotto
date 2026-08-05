# Spheres Audit Corrections

- Date: 2026-08-01
- Branch: `upgrade-redesign`
- Affected route: `/lottery-spheres.html#spheres`
- Production reference: `v1-final` and the read-only production site
- Staging URL: Local only (`http://127.0.0.1:8304/` after the committed staging build)

## Visual Comparisons

- Production desktop baseline: [`../visual-baseline/v1/lottery-spheres-spheres--desktop.png`](../visual-baseline/v1/lottery-spheres-spheres--desktop.png)
- Production mobile baseline: [`../visual-baseline/v1/lottery-spheres-spheres--mobile.png`](../visual-baseline/v1/lottery-spheres-spheres--mobile.png)
- Corrected staging desktop: [`spheres-audit-assets/spheres-1440x900.png`](spheres-audit-assets/spheres-1440x900.png)
- Corrected staging mobile: [`spheres-audit-assets/spheres-390x844.png`](spheres-audit-assets/spheres-390x844.png)

## Improvements

- The route now exposes one Magic 8 Ball Oracle instead of duplicating the Oracle in the readout and floating interface.
- The mobile Oracle starts as a compact floating 8-ball outside the title and primary action regions.
- Visible Spheres handoffs consistently identify the existing Beat2Lotto route as Robot RAHBEE.
- Kinetic headings now expose clean, non-duplicated accessible names.
- The route checklist now distinguishes verified smoke coverage from visual, accessibility, and performance sign-off.

## Regressions

- None found in the affected desktop or mobile route.

## Features Intentionally Removed

- The duplicate inline Sphere Oracle form was removed. The existing floating Oracle remains available and retains the same entertainment-only guidance.

## Features Unintentionally Lost

- None found. Sphere rerolling, pointer interaction, LottoMind App, Robot RAHBEE, Shadow Ops, and Studio links remain available.

## Accessibility Findings

- The route has one Oracle landmark and one set of controls.
- The main and supporting kinetic headings expose concise accessible names.
- Keyboard and reduced-motion behavior outside the focused checks remains pending a phase-wide audit.

## Performance Findings

- Removing the duplicate Oracle reduces rendered controls and event listeners.
- A dedicated performance trace was not run; performance approval remains pending.

## Recommended Corrections

- Complete the remaining tablet, keyboard, reduced-motion, and performance checks during the next full review checkpoint.

## Approval Status

Ready for next phase. Not approved for production.
