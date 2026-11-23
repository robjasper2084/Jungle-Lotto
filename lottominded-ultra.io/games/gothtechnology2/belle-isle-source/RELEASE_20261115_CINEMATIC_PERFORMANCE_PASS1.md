# Belle Isle Explorer — Cinematic Performance Pass 1
Date: 2026-11-15
Release stage: candidate; do not publish until CI + screenshot review are green.

## Scope
Performance-first iteration for the existing Belle Isle browser game.
No new bloom, grading, particles, physics algorithms or race balancing.

### 1. Default graphics
- New players start in Automatic quality instead of High. User-saved graphics presets still win.
- The explicit `?sunset=reference` preview continues to select High for its controlled screenshot review.
- Existing `WorldQuality` pixel scaling, `FrameBudget` timing hysteresis and 30/60 FPS caps remain unchanged.

### 2. Loading and delivery
- Production establishes an early connection to the immutable GitHub-hosted GLB origin.
- Only `belle/detroit-skyline.glb` receives a CORS-compatible fetch preload. Do not preload the ~30 MB landmarks archive or all vehicle variants.
- Existing pinned hashes and loader URL redirection remain authoritative. No external URL is changed.
- Local/authoring preview remains self-contained; no production connection hints there.
- Browser evidence must confirm no double-fetch from differing preload/request credentials. If repeated requests are seen, remove the preload while retaining the preconnect.

### 3. Draw-call reduction
- Consolidate only eligible, opaque, non-animated playground meshes with the same actual material, render state, geometry attribute layout and playground site.
- Use Three.js BatchedMesh so every source retains its own world transform and local-space texture coordinates. Keep each playground's visibility culling independent. Preserve shadow/culling settings and all collision/physics logic.
- Skip transparent, skinned, instanced, morphing, unsupported geometry and unrecognized custom shaders; allow known triplanar surfaces, and keep originals when batching is unavailable.
- Expose `world.stats.playgrounds.batching` for per-candidate baseline comparison.

## Acceptance and rollback
1. `npm ci && npm run check && npm test && npm run build` from `belle-isle-source/game`.
2. Confirm `assetDelivery.test.mjs` and `playgroundBatch.test.ts` pass as part of the unchanged release test suite.
3. Run existing Belle cinematic, polish, co-op, startup, release-evidence and public-preview checks for desktop and phones.
4. Profile matching routes before/after: normal spawn, waterfront sunset, greenhouse, long-island race, and co-op. Report median, p95, p99 frame time, submitted draws, triangles, startup asset timing and duplicate network requests. Capture screenshots for identical camera/season/preset.
5. If visual mismatch, wrong asset, stalled first frame, failed release gate or measured regression appears, stop and revert the candidate; do not auto-merge.

Targets (not achieved measurements): 30–40% draw-call reduction where the original draw submissions allow it; 60 FPS on capable desktop devices and 30 FPS on supported mid-range mobile hardware. Real-device metrics and visual review are required to claim either.

Production publication requires a reviewed, current-main candidate and green release checks. Keep this feature branch separate until those conditions are verified.
