# Belle Isle photo reference review

Run the game Vite development server on port 8346, then run `node scripts/photo-reference-review/capture-conservatory.mjs` and `node scripts/photo-reference-review/capture-sites.mjs` from the game directory. The existing workspace Playwright dependency and a locally installed Chromium are required; set `PLAYWRIGHT_BROWSERS_PATH` to its installed directory when needed. Captures and JSON reports go to ignored `output/playwright/`.

These fixtures import production geometry, PBR materials, beach, water, koi, and fountain code. They isolate the subjects under a fixed HDR environment; they omit surrounding vegetation, full terrain/paving, gameplay and the dynamic sky. They verify actual shader compilation and provide close/wide views, not full-world frame-rate or device certification. The conservatory fixture includes before/after views and a 390px reduced-motion capture. The site fixture includes midday/evening sun directions; its sky background stays fixed.

For the complete built game use the repository's `scripts/belle-cinematic-browser-smoke.mjs`, with `EXPECTED_MERGE_SHA` set to the committed checkout, `BELLE_GAME_URL` pointing at Vite preview, and `BELLE_CINEMATIC_CASE=desktop`. Do not edit source or build output during that run.
