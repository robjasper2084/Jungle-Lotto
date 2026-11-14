# Belle Isle cinematic presentation and release proof

## Scope and ownership

Based on production `d546de77fb304ebb3e113c676ff9d322c0535105`. Source changes only, isolated on `feature/belle-cinematic-polish-20261111`. No production merge, tag movement, paid service, source-asset replacement or generated bundle edit is part of this change.

The existing sunset/atmosphere, hover collision and recovery, trial arrows, off-course warnings, ghost records, rider IK, water wakes and quality budgets are retained. This is an extension, not a replacement vehicle or navigation engine. PR #147 owns startup/JARVS LCD changes; PR #148 owns beach and wildlife. Reconcile their changes before integration, especially cockpitLcd.ts and the explicit test list. Do not overwrite either branch or infer its release status from this branch.

## Implemented

- Presentation settings: Exploration, Racing, Cinematic; compact/full physical LCD; guarded local preferences. Cinematic never removes race guidance or driving, pause and recovery controls.
- Dark glass-like HUD material with readable numeric hierarchy, strong focus, desktop-only modest blur on High, no blur on reduced motion or small screens.
- Bounded 160 ms input confirmation without moving hit targets or adding sound. Cancellation on hide/reduced motion; no extra render loop.
- Opt-in Belle Isle Sunset at 17.55 with wispy clouds and a 60-minute cycle through the existing sky controller. Does not change the sky on load; does not bypass online host locking.
- Smaller physical cockpit assembly, preserving raycast UV controls and accessible radio buttons. Subtle rider torso/turn tuning inside current bounds and IK fallbacks. No simulation or race timing edits.
- LOW CLEARANCE advice from finite airborne speed/height telemetry; collision and reverse retain priority. No invented obstacle signal and no automatic vehicle control.
- Original derivative-filtered lawn variation applied to existing materials, with cleanup. No new art downloads, objects, render targets, draw calls or collision surfaces. Actual shader timing and scene appearance require browser evidence.
- Read-only Deployment Health page with exact SHA and run ID, actual build/deploy steps, public manifest, check-run status and links to browser evidence. It explicitly does NOT certify rendering from HTTP or badges.
- Public verifier requires actual main-push deployment identity and successful build/deploy/Deploy to GitHub Pages step, public byte hashes, real foreground browser startup/rendering at desktop and compact phone sizes, and matching public bytes again after browser checks. Reports include screenshots, trace and errors; no synthetic FPS claim.
- Full public manifest metadata diagnostics on Jackpot Maze CLI staging failure, with nonzero failure and original strict path, duplicate, checksum and total checks. PR #146 remains unchanged.

## Validation

Focused local tests and an in-memory browser DOM/CSS fixture are useful but are NOT the full game or a production publication check. Run strict TypeScript, the complete registered Belle suite, build and all existing release workflows on the exact candidate. The new cinematic workflow additionally tests 1440x960, 390x340 and 320x568 actual-game starts, settings, reduced motion, visible controls, pause/resume, asset errors and screenshots. Keep the hard 1024 MiB Pages limit and all existing tests/time assertions. No PR-specific waiver is added.

Do not merge while any required gate is pending, skipped, cancelled or failed. Inspect rendered screenshots for road visibility, LCD legibility, sunset highlights and ground shimmer. A passing software-rendered CI run is not a 60 FPS hardware guarantee. Record hardware frame times on the user's machine before claiming a performance improvement.

For public verification, jobs proof + matching manifest/emitted hashes + actual successful browser cases must all reference the same full main SHA. The dashboard's metadata-only status is not enough. A stale CDN or newer unrelated release must fail the exact-target comparison rather than be called success.

## Headless asset delivery decision

Do not move asset staging to a live CMS during this release. The earlier iterable failure was a test-fixture object spread, not evidence that asset hosting needed replacement.

A future authoring CMS should export a versioned, immutable catalog at build time: original asset path, content SHA-256, bytes, media type, license/provenance and quality tier. Build approval pins that catalog and downloads all needed bytes to a verified cache before staging. CI validates path traversal, duplicates, type/size, hashes, totals and the Pages budget before changing output. Runtime reads the pinned catalog only, never a mutable latest-content endpoint during Start. Failed downloads leave the last published release untouched. Rollback selects a prior catalog and matching game commit together.

CMS editing/authentication, provider selection, migration costs and external object-storage permissions need their own review; none is enabled or represented as completed here. Landmark re-authoring and high-resolution replacement models remain separate art work, not hidden downloads in this polish patch.
