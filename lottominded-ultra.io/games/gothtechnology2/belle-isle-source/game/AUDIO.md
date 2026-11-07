# Belle Isle: Swoop Detroit audio

## Player controls

Open Settings, then **Swoop Detroit audio**. Music, wheel effects and warning beeps are independently opt-in and default to off. Enable the desired channels, adjust their individual volumes, then close Settings and return to riding. A fresh trusted click or key gesture is required each visit; restoring preferences alone cannot start playback. Next track, track selection, Retry music and a combined music/wheel mute are available.

Music uses one lazy HTML audio element with `preload='none'`. Only the selected song is requested; the full playlist is not preloaded. Wheel sound synthesis reuses two oscillators and one noise source. Audio follows the existing game frame, with wheel updates limited to 30 Hz. Pause, menus, focus loss, page hiding and ride-preparation control clearing silence this new audio.

## Integration boundary

The new wheel effects read the existing controller's speed, warning pulse, braking and contact-scrape fields. Ground contact effects stop while airborne, dismounted or crashed. They are connected for normal exploration and one-wheel time trials. The independent multi-rider `IslandRace` simulation still needs its own wheel-pose adapter; it is deliberately excluded rather than playing stale exploration sounds. Music can continue during active races. Existing hoverbike engine, nature ambience and time-trial Gate sounds remain separately controlled and unchanged. The new music/wheel audio is not added to the photo/video capture mixer in this patch.

No race physics, course geometry, rider animation, graphics budgets, saved best times or commerce contracts are changed. This patch does not implement the separate Grand Prix/VRacer proposal.

## Asset identity and packaging

The 19 musical files are reused verbatim from the tracked Swoop package at `db27045ef3d51758325a1e3eb7b407d90588ae48`, under `store/public/arcade/swoop-detroit/audio/swoop`. See `public/audio/swoop/belle-audio-provenance.json` for each original Git blob ID and byte length. Duplicate catalog entries and the short effect track are excluded. No replacement music, external downloads or dependency upgrades are introduced. These files retain their original rights; reuse here is at the repository owner's request, not a new license grant.

`vite.config.ts` explicitly copies each selected file and the provenance manifest into the build, using relative URLs compatible with the packaged route. The original Swoop files and catalog remain untouched.

## Checks

`npm test` now includes `src/belle/belleAudio.test.mjs` (31 runtime/policy regressions) and `src/belle/belleAudioAssets.test.mjs` (catalog identity, byte/hash equivalence and production asset allowlist checks).

The downloadable package's 40 focused tests, including its installer tests, and its standalone strict TypeScript check passed before application. This is not a full-game build or browser/audio-quality sign-off. Run `npm run check`, `npm test` and `npm run build` in this game directory, then exercise opt-in, track switching, mute/pause, real warning/contact triggers and missing-file recovery in Chrome and on a physical phone before publication. Repository-wide startup, visual and performance release gates still apply. Do not merge or deploy solely on the standalone package checks.
