# Belle Isle Explorer — four-zone environmental release handoff
**Status:** Draft coverage, instrumentation and collision verification. NOT new Blender art, licensed texture bytes or certified hardware performance.

These are four **thematic** review groups, not a surveyed geographic quadrant split. Blue Heron Lagoon is east of the Flatwoods and beach/yacht-club stops are grouped by recreational character, not a claim that both sites are geographically eastern.

| Review zone | Grounded map stops | Primary environmental acceptance |
| --- | --- | --- |
| Western Gateway | MacArthur Bridge overlook; James Scott Memorial Fountain | Masonry/metal, bridge clearances, fountain water, paved approaches |
| Central Forest & Wetlands | Nashua Canal; Blue Heron Lagoon | Canopy near/far LOD, roots, lagoon margins, mud, reeds, rocks |
| Northern Shoreline & Memorial | William Livingstone Memorial Lighthouse; Coast Guard Station | River horizons, maritime structures, built seawall vs natural edge |
| Recreation & Waterfront | Belle Isle Beach; Detroit Yacht Club | Sand/water grading, recreation clearances, marina/pier details |

## Validation procedure
1. The current three-stop Island Guide remains available; the new eight-stop zone guide simply invokes the original map's Travel actions. Nothing edits race paths, bridge collision, physics or public asset URLs.
2. Run `npm ci && npm run check && npm test && npm run audit:environment-zones && npm run build` from `game/`. The distribution audit counts **existing** nature placements by nearest focal anchor without scattering or adding trees.
3. For genuine browser evidence run `ENV_GALLERY_DEVICE=desktop ENV_GALLERY_QUICK=1 node scripts/island-zone-gallery.mjs`. Repeat on phone. Quick mode takes one screenshot per stop: **clear noon** and **overcast sunset** alternate within each zone. All are sampled from the existing player camera after genuine Island Guide travel and GPU fence completion.
4. For full captures omit `ENV_GALLERY_QUICK`: 8 stops × Smooth/Automatic/High × clear noon / overcast sunset / scattered afternoon / layered dusk, separately on desktop and phone. This can be expensive on software graphics.
5. Review exact screenshots side by side with user-approved location references. Capture SHA-256, errors, draw calls, p50/p95/p99, textures, geometry count and requested/effective quality. New images are evidence until a **human-approved** baseline is selected. Different screenshots do not automatically signal a regression without that baseline.
6. Real hardware approval: 60 FPS desktop ⇒ p95 <=16.67ms and p99 <=33.33ms; 30 FPS phone ⇒ p95 <=33.33ms and p99 <=66.67ms, with >=240 eligible frames per run. Check all zones/quality/cloud conditions. SwiftShader CI is **not** a hardware FPS benchmark and must be marked unverified even if screenshots pass.
7. Shoreline tests sample mapped island, mainland, islet and inland lake boundaries; they verify finite ground and camera/flight obstacle responses. Existing real rock colliders remain independent of visual quality. Long multiplayer races/physical devices remain separate release gates.

## Phased integration
- Phase A: three-stop PR #177 (all original exact-head checks passed) must reconcile with newer production parent and pass exact-head checks again before any merge. The screenshot review still needs attention.
- Phase B: this four-zone coverage PR is isolated for browser validation and physical-device testing. It does not update `main` or deploy.
- Phase C: optimized Blender meshes and authored PBR textures are deployed **zone by zone** only after source hashes, GLB validation, license provenance, screenshot review, memory/draw measurements and user-approved production merge.
