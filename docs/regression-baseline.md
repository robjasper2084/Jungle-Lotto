# LottoMind Step 1 Regression Baseline

The Step 1 route matrix records these pre-existing failures without changing production pages or generated game bundles:

| Surface | Viewport | Existing failure | Evidence |
| --- | --- | --- | --- |
| Source `/contact.html` | Desktop and mobile | `assets/js/lm-support.js` returns 404 and emits a console resource error. | Detected by same-origin response and console listeners. The staging build supplies a local-only support helper, so staging does not share this failure. |
| Source and staging `/lottomind-stem-studio/` | Mobile 390x844 | The document width exceeds the viewport. | Detected by comparing `documentElement.scrollWidth` and `clientWidth`. |
| Production, source, and staging `/games/lottomind-jackpot-maze/` | Desktop, tablet baseline, and mobile | The production screenshots render as a blank white viewport despite HTTP 200. Source and staging also have no semantic heading, and keyboard traversal does not produce a visible focus indicator. | Confirmed in all three production contact sheets, plus heading inventory and up to 40 `Tab` key presses with computed focus styles. |

Stripe, Supabase, and production analytics endpoints are deliberately blocked during smoke tests. Their browser-level `ERR_BLOCKED_BY_CLIENT` messages are test controls, not application failures. Browser-cancelled iframe requests with `ERR_ABORTED` are also excluded because they occur when a completed test closes its page.

The allowlist in `lottominded-ultra.io/tests/known-route-failures.json` is exact. A new failure fails the suite, and a resolved failure also fails until its stale allowlist entry is removed.

The legacy static validators were also run against the complete reconstructed source artifact. `validate-home-page.mjs` passed; `validate-site.mjs` reported only the already-recorded Contact `lm-support.js` reference.
