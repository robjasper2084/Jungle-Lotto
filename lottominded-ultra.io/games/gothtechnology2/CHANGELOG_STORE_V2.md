# Store conversion v2 — 2026-08-28

Branch: feature/gothtechnology-store-conversion-v2. Local implementation only; no commit, push, deployment, live payments or indexing approval.

## UX and behavior

- Reordered the home page around a clear Detroit fighting-game/product world: hero, status, current drop, products, requested film, signals, game, lookbook, origin and alerts. Kept the existing category artwork and current-drop anchor.
- Replaced demo checkout with a persistent Launch Loadout, preview subtotal and an accessible launch-alert form.
- Corrected card action semantics: View Product, Choose Options, or save a valid one-variant product.
- Added grouped pending product facts and consistent reference/concept media labels. Retained supplied imagery, videos, $19.99 charm pricing and the ashtray's existing URL.
- Removed automatic commercial prompts and initial video requests. Later owner steering enables sound when a home/shop commercial is opened explicitly; mute/pause/replay/close remain available.
- Consolidated Experience Settings, improved mobile typography/filters/sticky actions and removed the old navigation transition that stalled rendering.
- Kept game character links on collections and product pages. Home signal cards retain the requested collectible artwork rather than restoring game portraits or the rejected 3D showroom.

## Architecture and principal files

New:

- store/commerce/mode.ts; store/content/launch.ts; scripts/check-launch-readiness.ts
- store/state/subscription.ts; store/ui/subscriptions.ts; store/ui/analytics.ts
- store/components/LaunchAlert.astro; LaunchAlertForm.astro; ExperienceSettings.astro; CampaignFilm.astro; ProductDevelopment.astro
- store/styles/conversion.css; scripts/prepare-store-responsive.mjs
- store/public/media/armory-hero-v2-640.webp; armory-hero-v2-1600.webp
- OWNER_LAUNCH_CHECKLIST.md; OWNER_ASSET_CHECKLIST.md; ANALYTICS_EVENTS.md; this changelog

Updated for conversion behavior:

- package.json (launch-readiness command only; existing model tooling dependencies retained)
- store/commerce/types.ts, provider.ts and shopify.ts; store/content/catalog.ts and support.ts
- store/layouts/Shell.astro and homepage/shop/product/collection/about/support route components
- CathedralHero, ProductCard, ProductMedia, Filters, Newsletter, HomeCommercial and OriginFilm components
- store/ui/app.ts, cart.ts, catalog.ts, dom.ts, experience.ts, story.ts, home-commercial.ts and inline-film.ts
- store/state/analytics.ts, store/game/play.ts (validated wrapper analytics only), store/three/viewer-entry.ts
- store/styles/armory.css, cinematic.css and hybrid.css
- tests/store/store.test.ts and tests/store-browser/store.spec.js
- QA_REPORT.md, ACCESSIBILITY.md, PERFORMANCE.md and COMMERCE_SETUP.md

## Preservation boundary

The workspace was already dirty. The original game source, original game tests/config, original entry, assets, model conversion tooling, uploaded GLBs/JSON, lockfile, existing media and unrelated parent changes were preserved. The git diff therefore contains more than conversion-v2 work; do not stage the entire checkout for a later release.

The original 16:10 protected-file snapshot has 25/26 matching hashes; the only exception is the Pages workflow, which had already changed by the later 16:26 preservation checkpoint. Both files in that later parent checkpoint still match. This implementation did not edit the workflow or parent generated arcade catalog and did not undo those existing changes.

## Verification and release status

See QA_REPORT.md for exact counts, failed original-game assertions and capture locations. Storefront checks/build pass; the original game browser suite is not entirely green. Shopify and subscription behavior use fixtures/mocks only.

Release remains blocked on owner approval, final data/photography/policies/service configuration, real merchant testing, and review of the unresolved game test failures. No release action was performed.
