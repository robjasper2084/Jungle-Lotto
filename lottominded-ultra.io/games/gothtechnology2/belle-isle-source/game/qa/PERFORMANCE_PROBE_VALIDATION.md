# Performance probe and release separation

The FULL lane preserves production geometry and user quality settings (High desktop, Smooth phone viewport).
The DIAGNOSTIC lane uses the *same* selected quality for the matching device/viewport. Only the localhost-only scene-reduction switch differs.
Compare modes only within the same actual GPU renderer, same viewport, matching quality, and equivalent ride route; keep release acceptance separate.
The diagnostic lane explicitly requests perfProbe=1 on a localhost URL. It limits visible trees, removes nearby ground-cover instances,
hides decorative reeds/branches, suppresses the new canal reflection overlay, and draws lower-detail Casino ornamental railings.
It displays a persistent on-screen REDUCED SCENE DIAGNOSTIC — NOT RELEASE QUALITY banner.
The scene-reduction flag cannot be activated on the published GitHub Pages host.

Both lanes use the same controller physics, real Playwright keyboard input and player camera. An independent Node timer
reasserts the held W key every 450 ms, recording trusted key receipts and focus loss; it cannot create simulation frames,
buffer a lost multi-second physics interval, change user/player pose, or make a severe render stall disappear.

Chrome first tries ANGLE desktop OpenGL. If WebGL2 cannot be obtained, it falls back explicitly to the trusted local
SwiftShader backend, logging the attempted backend, reason for fallback and actual WebGL vendor/renderer.
Renderer identity, quality preset and viewport are mandatory metadata. Do not compare different GPU backends as equivalent.

90-second software browser tests are diagnostic. A green diagnostic lane means the capture operated, not that the game
meets production frame budgets. Report frame p50/p95/p99, stalls, draw calls, movement, resource counts, JS heap
and first-playable wall time separately for each lane. Do not label a frame-starved 8-frame capture as 90 seconds of simulation.

Full acceptance still requires actual desktop and mobile-device measurements for 10 minutes, a camera-matched baseline on
the same GPU/quality/route, no serious freezes, and full-fidelity before/after screenshots with bridge and foliage detail.
All original cinematic, collision, co-op, screenshot and build workflows remain required and unmodified.
