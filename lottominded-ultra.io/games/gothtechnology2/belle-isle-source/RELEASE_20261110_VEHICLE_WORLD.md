# Belle Isle vehicle and world update

The first-person hoverbike radio is part of the physical cockpit screen, with track, transport, volume, and local MP3/WAV import controls. Keyboard users can Tab to the equivalent cockpit controls.

Integrated features: MPH instruments, speed lock/cruise, boost and transmission, shaped FPV grip and steering, terrain/structure collision with local voice warnings, Hero-Cam recording, boat traversal and open bridge spans, seasonal grounded foliage, waterfront and garden detail, skyline lighting, and Michigan bridge plate 2084. Existing startup location, trial flow and public service contracts are preserved.

The sky uses volumetric ray marching with cloud-light sampling and a cached panorama reused by river reflections. It is not hardware RTX ray tracing. Smooth mode remains available for slower devices.

Validation: frozen-source TypeScript check and production Vite build passed. Full regression and GitHub Pages checks are recorded with the PR. Physical iPad and Quest are not device-verified.

Unity: matching vehicle/world Windows build is built separately after browser publication. Native exploration still does not provide full browser EUC, co-op and quest parity. Native build results and download are recorded in the release report.

Asset provenance: Michigan 2084 bridge plate is newly generated from the user-supplied visual reference; seasonal tree geometry and foliage were authored/exported in Blender; warning speech is synthesized locally with Windows SAPI. Existing asset licenses and credit files remain alongside the assets.
