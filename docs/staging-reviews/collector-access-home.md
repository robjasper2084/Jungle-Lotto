# Collector Access Home Review

- Branch: `upgrade-redesign`
- Baseline: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Staging URL: Local only (`http://127.0.0.1:8507/` during verification)
- Routes compared: `/index.html?collector=access#lottomind-refined` and `/memberships.html?collector=access`
- Viewports: `1440x900` and `390x844`
- Production status: Unchanged

## Screenshot Links

- Production Home baseline: [desktop](../visual-baseline/v1/home--desktop.png) and [mobile](../visual-baseline/v1/home--mobile.png)
- Production Memberships baseline: [desktop](../visual-baseline/v1/memberships--desktop.png) and [mobile](../visual-baseline/v1/memberships--mobile.png)
- Staging Home Collector Access: [desktop](collector-access-home-assets/home-collector--desktop.png) and [mobile](collector-access-home-assets/home-collector--mobile.png)
- Staging Memberships handoff: [desktop](collector-access-home-assets/memberships-handoff--desktop.png) and [mobile](collector-access-home-assets/memberships-handoff--mobile.png)

## Improvements

- The complete Collector Access flow now opens from Home beside the existing Vault entry point, matching the requested platform hierarchy.
- Authentication, password recovery, password visibility, session preference, wallet, redemption, and signed-out status behavior remain together in one accessible dialog.
- Memberships retains its plan context and a clear `Open Collector Access on Home` handoff instead of duplicating account controls.
- Password-recovery links now return to Home, and signed-out checkout requests stop at the Home Collector Access flow before any checkout session is created.

## Baseline Comparison

Moving the Collector Access dialog from Memberships to Home is an intentional structural departure from the v1 baseline. The existing black, gold, cyan, violet, Guardian, cinematic, arcade, and music-technology identity remains recognizable. No Membership pricing, plan terms, game routes, or production navigation were changed.

## Regressions

- None found in the affected routes.
- No horizontal overflow, framework overlay, console error, or missing same-origin asset was observed in the focused desktop and mobile checks.

## Features Intentionally Removed

- The duplicate Collector Access dialog was removed from Memberships. Its full functionality now lives on Home.

## Features Unintentionally Lost

- None found.

## Accessibility Findings

- Dialog naming, focus containment, Escape dismissal, password visibility, status messaging, and keyboard controls remain available.
- The mobile dialog fits the viewport and provides internal scrolling without horizontal overflow.
- The Memberships handoff remains a normal keyboard-focusable link with a 44px-or-larger touch target.

## Performance Findings

- No new third-party dependency or eager media transfer was added.
- Existing account, runtime-configuration, and Collector Access assets are reused and loaded only on Home.

## Safety Findings

- The staging artifact retains `noindex,nofollow,noarchive` and the visible preview banner.
- Live payments, production account writes, real redemptions, and production analytics remain blocked.
- No credentials, account mutation, checkout session, redemption, or charge was used during verification.

## Recommended Corrections

- None required for this scoped relocation.

## Approval Status

Ready for next phase. This review does not approve or deploy production.
