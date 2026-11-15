# Belle Isle photo integration

Branch: `feature/belle-photo-realism-20261114`. Base: PR149 commit `71716526b1c943424fe754cfbd12d599ac57b428`, containing production main `8eabb13308133ef2229aac6757fc9c885c171e28` at the time of the fetch. Production is not changed by this work.

## References and interpretation

- User-supplied greenhouse/pond photographs: `images (65).jfif`, `images (64).jfif`, `belle-isle-conservatory-fernery-1080x717.jpg`, `images (63).jfif`, and `77a459a34f47d9d0a1ecd866b39bbf7a74929b58.jpg`. Used for tree ferns, layered tropical planting, vine-covered tufa, black cast-iron benches, flanking pots, bank plants and reed islands.
- User-supplied `images (42).jfif`, `(41)`, `(40)`, `(39)`, `(37)` and `bi11.jpg`: red cast-iron bridge railings, oval/scroll motifs, capped posts, concrete paving and stone supports. Applied as an original simplified interpretation to the two mapped Casino-adjacent footbridges, ways `106948146` and `42986441`. These are not dimensionally surveyed replicas; the existing route, deck height, rail collision envelope and junction openings remain authoritative.
- [Google Maps Casino imagery](https://www.google.com/maps/search/Belle+Isle+Casino/), Street View & 360°, Evan Sherman, June 2015, inspected 2026-11-14: buff facade, arched openings, recessed arcade lights, pale stone steps and dark window grids. Existing facade geometry, lights and signage are retained; masonry tint and filtered surface weathering are refined. No unsupported sign text or dimensions were inferred.
- [Google Maps satellite view](https://www.google.com/maps/@42.3346097,-82.9952834,18z/data=!3m1!1e3), inspected 2026-11-14: Casino/lagoon path relationship and north-up orientation. The map projection already uses +X east and +Z south. Sun dawn/evening now use east/west and noon uses south. Altitude and hours remain an artistic cycle, not date-dependent civil-time astronomy.
- [Historic Detroit Casino photo gallery](https://www.historicdetroit.org/galleries/belle-isle-casino-photos) and the [Michigan DNR park page](https://www.michigan.gov/recsearch/parks/belleisle) supplied architectural/location context. Public shoreline photography supported an open sandy strand with sparse vegetation at the landward margin, rather than a new dune field.

The user's water-park clarification means the existing beach and fountains. No pool/splash-pad sector is invented. Sand gains low-frequency sediment variation; backshore grass forms checked clusters within the same instance caps. Fountain water is nonmetallic with a restrained clearcoat and filtered caustics. Existing playscape geometry gains concrete joint/grain, rubber speckle and painted-metal variation. Photographs remain references: none are copied into shipped textures.

## Runtime bounds

- Conservatory: five opaque merged batches, 135,014 triangles, 98 fern crowns, 26 bank plant placements and seven reed islands. Existing beds constrain low foliage; new bench/pot footprints participate in walking collision. Visibility uses 140/155m hysteresis.
- All 59 small bridges remain below the existing 20,000-triangle test limit and under 60 batches. Red ornament is merged by tile/material; no alpha cards, extra lights or shadow passes.
- No new runtime image/audio requests. Surface shaders chain existing PBR hooks and filter subpixel grain. Beach instance caps remain 170 stones / 230 grass clumps / 30 driftwood pieces with the existing distance-settle behavior.

## Validation and audio context

The PR149 `audio/swoop/track-01.mp3` issue concerns range requests, pause/priming behavior; previous validation also called out source drift. New visual geometry does not repair or excuse an aborted audio request. Existing audio/cache repairs and strict request-failure checks remain intact. A local Windows root-versus-realpath mismatch was reproduced as HTTP 403 and repaired by comparing canonical root/file paths with platform-aware relative-path containment. The existing escape-link, range and cache tests plus a Windows case-normalization regression all pass outside the sandbox (29 checks); the sandbox itself denies creation of the temporary junction.

Reproducible render fixtures are in `game/scripts/photo-reference-review/` (relative to `lottominded-ultra.io/games/gothtechnology2/belle-isle-source/`). They exercise actual production components with isolated lighting. Complete-game smoke must be run against the committed source and unchanged build, separately from these close-up captures. Local review artifacts are in ignored `game/output/playwright/`.
