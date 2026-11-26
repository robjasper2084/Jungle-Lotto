# Four art directions — Belle Isle / connected Greater Detroit

**Staged, not a production merge.** The existing geometric world, GIS layouts, navigation,
collisions and PBR materials remain identical. Choose Settings → Visual atmosphere.
Authentic Detroit leaves the present palette, sky time and GPU quality unchanged by
default. Golden Hour, Detroit Noir and Detroit 2084 change existing sky/light/fog
uniforms, reflection colors, and small HUD accents without extra rendering passes,
scene meshes, postprocessing, texture files or shader variants. New selections
also choose artistic time/cloud settings in solo or host mode; in guest mode
they only affect the local look, preserving the host's shared sky.

The artistic sky time is not real-date solar positioning. No photogrammetry,
survey-grade measurements or wet-road material is asserted.

Release: verify TypeScript, full tests and build; capture same-camera gameplay
screenshots of all four looks at desktop and compact phone resolutions; verify
the ride/HUD and online-host controls; run unchanged 90-second desktop High and
phone-viewport Smooth tests at p95 <=50 ms with zero intervals over 250 ms.
No automatic merge/deploy without those results. The separate standalone
Swoop Detroit and Elmwood apps are outside this patch.

## Fidelity target comparison (staging review)

The user's cinematic pictures are visual targets, not screenshots of the
live game or survey-accurate Detroit geography. The original comparison used
the mainland Jefferson spawn, while the pictures depict a rider on the
island-side bridge approach. In the Guide, choose **MacArthur Bridge · cinematic
arrival** to ride to a reproducible point approximately 65 metres before
the island landing, using the actual mapped bridge and existing collisions.

The four-look browser gallery now travels to that destination through the
real Guide interface and requires a camera receipt at the actual bridge.
No teleport of a camera independent of the player, no skyline relocation,
no replacement of bridge geometry, and no changes to the normal starting
location. These images will be real in-game comparison frames, not the target
illustrations. Pixel-perfect correspondence is not yet established.

## Cinematic original rider materials

The in-game visual targets require a believable PBR helmet and suit instead
of anime shading. On the photo-target staging branch, the existing rider's
original GLTF materials are retained (including their texture maps), the rig
and geometry are identical, and extra ink-outline draw submissions are not
created. The former anime function is retained for isolated legacy tests.
This is not a replacement of the original rider asset, and it must pass
the same actor animation, visual, collision and native frame-rate gates.

## Experimental stone-arch picture study (separate draft branch)

The generated pictures contain broad stone bridge balustrades. Under
VITE_BRIDGE_BALUSTRADE_PREVIEW=1, this study replaces the original MacArthur
crash-barrier *visual only* with two instanced arch railing meshes along the
mapped bridge, staying entirely inside the existing rail-collision strip.
The original GLB barrier remains for rollback but is excluded from rendering.
Game controls, terrain, vehicle physics, shadow budgets and map geometry
are unchanged. This is **not an as-built surveyed reconstruction**.

Do not release until actual gameplay images, matched-angle visual assessment,
real walk/drive/flight collision sweeps, verified architectural references
and the unchanged full native 90-second desktop/phone performance gates pass.

## Optional live stone railings (picture-target conceptual mode)

Settings → Visual atmosphere → **Cinematic stone bridge arches (concept art)**.
The existing metal-look railings remain the default in Authentic Detroit.
Choosing the conceptual arches displays the same 270 instanced stone panels
that passed native Metal 90-second staging acceptance, hiding the old railing
visual only. The original collision geometry, road grade, bridge route and
vehicle physics are retained. Unchecking restores the original visual rails
and their shadow behavior. The setting is stored locally when allowed.

The user's generated pictures remain **visual references**, not verified
as-built bridge evidence. Neither the default bridge nor the authored art
mode should be described as photogrammetric. Live screenshots and release
metrics must be checked again on the exact merged candidate.
