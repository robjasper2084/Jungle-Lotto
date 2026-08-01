# LottoMind Site Rebuild Checklist

Use `Pass`, `Fail`, `Blocked`, `Not tested`, or `Not applicable` in each review column. Rows marked `Not present` are required upgrade-workflow checks but are not files in the current production tree.

Step 1 captured the 23 present visual states at desktop, tablet, and mobile in `docs/visual-baseline/v1/` (69 route screenshots plus three contact sheets). Use `Not tested` for review dimensions that have not received a current redesign sign-off; do not treat a route smoke pass as a visual, keyboard, reduced-motion, or performance approval.

| Route | Source | Production screenshot | Staging screenshot | Desktop | Tablet | Mobile | Keyboard | Reduced motion | Console errors | Metadata | Performance | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/features-app.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/memberships.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/news/` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/live-events.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/lottery-spheres.html` | Sitemap | Pass | Pass | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Spheres correction verified; tablet and performance review pending |
| `/beat2lotto-plus.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/merch-store.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/how-to-use.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/privacy.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/terms.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/accessibility.html` | Sitemap | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Route smoke passed; visual review pending |
| `/product.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not present |
| `/create.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not present |
| `/prompt-lab.html` | Required + arcade | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/redeem.html` | Required route | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/contact.html` | Required route | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/404.html` | Required route | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/account.html` | Required route | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested | Current route added; complete review pending |
| `/games/gothtechnology2/` | Arcade manifest | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/games/lottomind-jackpot-maze/` | Arcade manifest | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/games/opengw-levels/` | Arcade manifest | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/games/shadow-ops-canvas/` | Arcade manifest | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/games/raytrace-pong-background/` | Arcade manifest | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |
| `/lottery-spheres.html#spheres` | Arcade manifest | Pass | Pass | Pass | Not tested | Pass | Not tested | Not tested | Pass | Pass | Not tested | Spheres correction verified; tablet and performance review pending |
| `/lottomind-stem-studio/` | Required + arcade | Pass | Not tested | Pass | Not tested | Pass | Not tested | Not tested | Pass | Not tested | Not tested | Route smoke passed; visual review pending |

`account.html` is present on the upgrade branch and now has an explicit review row. It remains unapproved until its current production, staging, accessibility, and performance checks are recorded.
