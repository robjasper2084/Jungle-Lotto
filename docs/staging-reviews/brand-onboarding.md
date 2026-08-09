# LottoMind Brand And First-Use Review

- Branch: `feature/lottomind-b2b-services`
- Staging: Local only
- Production reference: `v1-final` and `docs/visual-baseline/v1/`
- Approval status: Ready for next phase

## Routes Compared

- `/index.html#choose-your-path` at 1440x900 and 390x844
- `/help.html` at 1440x900 and 390x844
- `/memberships.html#membership-plans` at 1440x900 and 390x844
- Metadata-only checks for LottoMind Arcade, Guardian Collection, and LottoMind Studio

## Improvements

- LottoMind is now the visible master consumer brand while LOTTOMINDED ULTRA remains the cinematic creative hub.
- The first session begins with four clear paths and produces a local result before presenting account or membership actions.
- Free access uses action limits instead of a countdown timer.
- Robot RAHBEE and Static Wav are described as LottoMind Arcade experiences rather than competing parent brands.
- Guest results are explicitly device-only, entertainment-only, and unable to issue verified LottoCredits.

## Visual Comparison

- The new Home sections preserve the black field, gold hierarchy, cyan controls, violet accents, Guardian signal language, and compact music-technology HUD treatment from the v1 baseline.
- The primary intentional departure is a structured four-choice onboarding deck and ecosystem map below the existing Home experience.
- Help retains its existing layout; only parent-brand wording changes.
- Memberships retains its established card layout; the free plan list now shows concrete action limits.
- No horizontal overflow or browser console errors were found in the final desktop or mobile captures.

## Accessibility And Performance

- Each path is a native button, the result dialog is keyboard reachable, status updates use live regions, and reduced motion disables the new reveal effects.
- The onboarding adds no image, video, canvas, iframe, network API, or production analytics request.
- Mobile controls retain large tap areas and a single-column reading order.

## Removed Or Lost Features

- Removed intentionally: the 10-minute local demo timer and timed Vault unlock language.
- Unintentionally lost: none found.

## Recommended Corrections

- Connect saved results to the authenticated backend only after the account service exposes a server-authorized result API.
- Keep premium quotas and entitlements server-authoritative; the current counters are explicitly guest-device limits.

## Captures

- `brand-onboarding-assets/home--desktop.png`
- `brand-onboarding-assets/home--mobile.png`
- `brand-onboarding-assets/help--desktop.png`
- `brand-onboarding-assets/help--mobile.png`
- `brand-onboarding-assets/memberships--desktop.png`
- `brand-onboarding-assets/memberships--mobile.png`
