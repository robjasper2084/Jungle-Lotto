# Shallow-water visual and physical performance release gate

Source: PR #175 shallow lagoon depth, real built-game `?profile=1` Guide travel. A successful browser screenshot is **not** automatic visual or physical-device approval.

## Real screenshot checks (candidate, not simulated)
- Use the **Lagoon · submerged stone bed** destination created from deterministic `planShallows(map)` stone coordinates and an existing collision-safe dry OSM park path. The screenshot harness clicks the same public Guide as a player; no seeded controller state, synthetic frames or CSS-only image proof.
- Verify that the camera looks downward into a real lagoon in desktop High and Automatic, and compare with phone Smooth (where the optional bed/stone treatment must remain disabled).
- After a real Guide click, require the existing game `#profile` active frame count to advance **more than two**, followed by a real WebGL fence and two animation-frame paint opportunities before counting the PNG as captured. Preserve network, pageerror and context-loss checks.
- Inspect the actual screenshots manually for visible stone silhouettes **below** the y=1.05 waterline, sediment at y=.22, shallow gradient/ripple ordering, and plausible transparency. Do not accept an opaque water plane that hides all stones or a composite made from static sources.
- New `visualApproved:false` receipt is deliberately never auto-green. Browser passes only prove genuine capture.
- Published baseline has different nearby Guide viewpoints. Existing `pairingComplete:false` stays outstanding; use an actual matched position, heading, pitch, light and quality on original-base production before making an image-quality parity claim.

## Hardware endurance gate
- Require at least **600 eligible seconds** on an actual desktop GPU and at least one real phone/tablet, running the **FULL production scene**, with the exact candidate source/head, build ID/hash, device model, GPU/WebGL renderer, viewport, quality and AA settings recorded.
- Record frame p50/p95/p99, all >250 ms and >2 s stalls, max pause/freeze, initial loading time, GPU/JS/total memory when available, real distance and active/moving seconds, quality changes and asset errors. JS heap alone is not GPU VRAM or physical memory.
- Use the game's Settings -> Ride profile -> Start 10-minute capture, ride for ten valid minutes, then Stop and show report. Upload the exported JSON. A shorter manual recording, different PR build, software SwiftShader run or successful keyboard heartbeat does **not** certify this gate.
- Compare equivalent routes and quality against the currently published build **on the same physical device**. Do not mark production ready until no severe freeze and performance acceptance are independently reviewed.

## Release decision
Keep PR #175 draft/unmerged and #176 stacked until all exact-head CI, screenshots with visual acceptance, matched baseline and hardware gates pass. Do not merge PR #184 as a shortcut. After the authorized merge, verify main SHA, successful GitHub Pages deploy and public asset hashes before claiming live.
