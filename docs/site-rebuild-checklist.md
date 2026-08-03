# LottoMind Site Rebuild Checklist

This matrix records the current release-signoff evidence for the upgrade branch. Use `Pass`, `Fail`, `Blocked`, `Measured`, or `Not applicable`. `Measured` means performance telemetry was captured but no release budget has been approved; it is not an optimization claim.

## Evidence

- Production baseline: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`, with 69 route captures in [`visual-baseline/v1/`](visual-baseline/v1/)
- Audited site content: the focused Help and presentation-media task tree on `upgrade-redesign`; the final commit is resolved with `git log -1 --format=%H -- docs/site-rebuild-checklist.md`
- Current staging captures: 75/75 passed across 25 routes at `1440x900`, `768x1024`, and `390x844`
- Contact sheets: [desktop](staging-reviews/release-signoff-assets/desktop-contact-sheet.png), [tablet](staging-reviews/release-signoff-assets/tablet-contact-sheet.png), and [mobile](staging-reviews/release-signoff-assets/mobile-contact-sheet.png)
- Machine-readable results: [`release-signoff-manifest.json`](staging-reviews/release-signoff-assets/release-signoff-manifest.json)
- Route gate: 156/156 passed across source and staging, including Help, Account, visible keyboard focus, reduced motion, console/page errors, same-origin assets, overflow, noindex, preview banner, and environment write protections
- Review report: [`help-media-release.md`](staging-reviews/help-media-release.md)

## Sign-Off Matrix

| Route | Source | Production screenshot | Staging screenshot | Desktop | Tablet | Mobile | Keyboard | Reduced motion | Console/assets | Metadata/safety | Performance | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/features-app.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/memberships.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/news/` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/live-events.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/lottery-spheres.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/beat2lotto-plus.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/merch-store.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/how-to-use.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/privacy.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/terms.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/accessibility.html` | Sitemap | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/product.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Route not present |
| `/create.html` | Required workflow route | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Route not present |
| `/prompt-lab.html` | Required + arcade | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/redeem.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/contact.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/help.html` | Support route | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Mobile actions clear fixed Credits and Menu controls; no v1 route existed |
| `/account.html` | Upgrade route | Not applicable | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Staging sign-off complete; no v1 route existed |
| `/404.html` | Required route | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/gothtechnology2/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/lottomind-jackpot-maze/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/opengw-levels/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/shadow-ops-canvas/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/games/raytrace-pong-background/` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/lottery-spheres.html#spheres` | Arcade manifest | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |
| `/lottomind-stem-studio/` | Required + arcade | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Measured | Current staging sign-off complete |

## Release Boundary

The matrix closes the current documentation gap; it does not authorize production. The staging artifact remains noindex and fail-closed for live payments, production account writes, real redemptions, and production analytics. The Home, Arcade, Storefront, and shared artwork payload reductions are verified without removing the original source media. Production approval remains `Not approved`.
