# C-Files, part of GothTechnology

C-Files lives at the existing site's `c-files/` route and is linked from its main navigation. It shares the Astro build, base path, and black/gold visual identity. No separate frontend hosting account is required for the published research pages.

## Run the complete local platform

Use Node 24 and run these commands from this game directory:

```sh
npm ci
npm run build
npm run cfiles:serve
```

Open `http://127.0.0.1:4185/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/c-files/`.

The first account created on this **local-only server** becomes the moderator. Create another account to test the contributor role. These accounts do not send email or connect to existing LottoMind accounts. The server binds to loopback and rejects other Host headers; do not expose it as a production service.

SQLite stores accounts, sessions, cases, evidence previews, and moderation decisions in the ignored `output/c-files-local/cfiles.sqlite` file. `CFILES_DATA_DIR` changes that directory; `CFILES_PORT` changes the port. Back up the data directory before changing or removing it. Browser drafts are stored only when the contributor explicitly saves a draft.

## Working flows

- Source-linked headlines with publication dates, per-source health, and a pausable ticker.
- Case index with keyword, location, year, witness, event type, and evidence-status filters. Search criteria survive a reload. The backend provides SQLite FTS5 search; the small published index also filters in the browser.
- Leaflet map using bundled Natural Earth country geometry, so it does not need external tile requests. Pins are regional references; records without coordinates remain searchable.
- Password-hashed accounts, expiring HttpOnly/SameSite sessions, and role checks on every moderation request.
- Eyewitness reports with event time, IANA timezone, approximate location, witness type, equipment, narrative, and permission to publish.
- Corroboration, source documents, and alternative explanations attached to case files. Images are limited to 4 MB, decoded as JPEG/PNG/WebP, re-encoded without metadata, and kept private while pending. The original image hash is retained; contributors should keep their original files.
- Moderator publication/rejection with a required rationale and an audit record. A case must be published before its evidence can be published. Public image access also checks the parent case.

Publication is an editorial decision, not proof that a claim is correct. No synthetic witness reports, ratings, or peer reviews are presented as real activity. The three initial dossiers index historical official sources and describe the limits of those records.

## News refresh

```sh
npm run cfiles:aggregate
npm run build
```

The aggregator uses public RSS, HTTPS source links, timeouts, and bounded input. It stores headlines and links, not complete third-party articles. NASA is filtered for relevant astronomy, spacecraft, and UAP terms. An unavailable feed retains its previous items and displays its last check/error; if all feeds fail, the job fails. At initial verification NASA connected and JPL returned HTTP 403. Other organizations are source-directory links until an authorized feed is configured. MUFON member records are not scraped.

The Pages workflow now has a daily 10:00 UTC schedule. On scheduled runs it refreshes the JSON snapshot, rebuilds, tests, and deploys the resulting static artifact. This schedule becomes active only after this branch is released to the default branch and GitHub Actions is enabled. GitHub schedules can be delayed. It does not promise real-time incident reporting.

## Hosted service boundary

GitHub Pages serves the source archive, map, and news. It cannot run the Node/SQLite contribution service. On a static host the UI clearly reports that accounts and submissions are not connected and never claims to save a server submission. Browser drafts remain available.

The local implementation is reviewable now. A hosted CMS, Supabase authentication/Postgres/storage, email verification, password recovery, production API rate limiting, retention/deletion policy, and HTTPS contribution endpoints are **not connected or deployed**. No tables or settings in the existing LottoMind Supabase project have been changed. Before public contributions open, implement and test a hosted API with equivalent authorization and private-file rules, explicitly provision moderators, and configure the account lifecycle and owner-approved policies. The current client expects a same-origin `c-files/api/` service; a public deployment needs an appropriate same-origin proxy or an explicitly implemented cross-origin auth adapter.

## Verification

```sh
npm run check:store
npm run test:store
npm run cfiles:test
```

C-Files browser tests use a separate temporary database on port 4186. They cover desktop/mobile routes, filters, map interaction, drafts, account creation/sign-in, private reports/images, moderator approval, public evidence, authorization, and disconnected hosting. They never create test records in the preview database.

## Asset provenance

- Observatory: generated editorial illustration, labeled as such in the page.
- Country geometry: Natural Earth 1:110m countries, public-domain geographic data; fetched from `nvkelso/natural-earth-vector/geojson/ne_110m_admin_0_countries.geojson`, reduced to names and geometry. The map links to Natural Earth attribution.
- Case and news source URLs remain attached to each record. The National Archives and Department of Defense are primary source starting points, not endorsements of an extraordinary explanation.
