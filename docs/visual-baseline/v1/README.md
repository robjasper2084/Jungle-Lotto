# LottoMind v1 Visual Baseline

## Capture Summary

- Production reference: `main` at `975c637cea7003533cdc30aed9d96be51929bfc8`, tagged `v1-final`
- Production URL: `https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/`
- Routes and visual states: 23
- Viewports: desktop 1440x900, tablet 768x1024, mobile 390x844
- Route screenshots: 69 PNG files
- Contact sheets: `desktop-contact-sheet.png`, `tablet-contact-sheet.png`, and `mobile-contact-sheet.png`
- Load result: all 69 captures received HTTP 200

PNG was used because the repository has no WebP conversion dependency. The capture command is `npm.cmd run baseline:capture` from `lottominded-ultra.io`.

The capture is read-only: non-GET requests and Stripe, Supabase, production analytics, and audio requests are blocked. The in-app Browser runtime was unavailable because initialization failed with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`; the prompt-authorized Playwright fallback was used.

## Existing Findings

- Jackpot Maze renders as a blank white viewport at desktop, tablet, and mobile despite HTTP 200. Its local source/staging smoke checks also find no semantic heading or visible keyboard focus.
- Source and production Contact request missing `assets/js/lm-support.js`, producing a same-origin 404 and console error. The staging artifact supplies a local-only support helper and does not share this failure.
- Stem Studio exceeds the 390px mobile viewport width in source and staging.
- Blocked-request console messages on Memberships and News are capture safety controls caused by intentionally blocking production integrations; they are retained in `baseline-manifest.json` for transparency.

## Staging Comparison

After the Step 1 rebuild, staging was compared with the production home route at 1440x900 and 390x844. The composition, Guardian/orb artwork, black/gold/cyan/violet palette, navigation, and typography remain unchanged. The only material staging delta is the intended preview banner and safety-status line above the page.
