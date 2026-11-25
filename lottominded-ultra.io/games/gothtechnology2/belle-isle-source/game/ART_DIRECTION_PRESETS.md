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
