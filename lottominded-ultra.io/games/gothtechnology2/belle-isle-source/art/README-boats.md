# Belle Isle boat assets

Two selectable original designs replace the old roofed river launch: a twin-outboard offshore speedboat and an Unlimited-style single-cockpit hydroplane. The user requested both. Both derive from one approved Higgsfield/Tripo generation (job `50440919-153c-4412-8dca-ba5347fe6a8d`, quoted and authorized ceiling 9 credits). No second paid generation was submitted.

`higgsfield-boat-source.glb` is the unchanged provider result. `speedboat.blend` and `hydroplane.blend` are editable Blender sources. The Python authoring scripts in `../tools/` remove reconstructed wake geometry, normalize units/heading, rebuild manufactured hull surfaces and add cockpit/control anchors. The hydroplane replaces outboards with a turbine cowling, forward sponsons, canopy, canard, rear wing, rudder and propeller. Material batches keep runtime draws bounded.

To rebuild, run Blender 5.2 in background with the relevant `build-speedboat.py` or `build-hydroplane.py` script, then `-- INPUT.glb OUTPUT.glb SOURCE.blend`. Use the unchanged provider GLB as input and the matching file in `../game/public/belle/vehicles/` as output. Runtime convention: metres, +Y up, +Z bow. `Driver_Eye`, `Driver_Hip`, `Helm_Wheel`, and `Cockpit_Display` are required named anchors; asset tests validate them.

The cockpit texture is drawn from the current simulation at 10 Hz. Speed, heading, trim, cornering/vertical G and horizon track actual simulated movement. Engine torque, power and N2/RPM come from the game engine model, not hardware readings. The hydroplane's N2 scale is normalized spool; its absolute shaft-RPM parameter is an explicit modeling assumption. Reverse and brake are labeled exploration assists. No CORLEO Python script or `Physics_Constraint_Library` exists in this TypeScript runtime.

Reference facts and interpretation:

- [H1 Hydro 101](https://h1unlimited.com/hydro-101/): 28–32 ft length, 12–14½ ft beam, 6,750 lb minimum race weight, three-point running, enclosed cockpit, N2 instrumentation. The game hydroplane is 9.2 m long and 4.2 m wide, with a 3,062 kg modeled mass.
- [H1 overview](https://h1unlimited.com/about-h1/): roughly 3,000 hp turbine power. The game uses 2.237 MW as its power reference.
- [Mercury Racing 300R](https://www.mercuryracing.com/engines/r-series/300.html): 300 hp / 224 kW per engine, 600 idle RPM, 5,800–6,400 full-throttle RPM. The offshore profile uses two engines' nominal power.

These are research-informed game vehicles, not named-team replicas or certified hydrodynamic models. Handling, drag, spool, speed governors and cosmetic spray are authored for exploration. The reference photos are not shipped as textures. The canopy uses ordinary transparent PBR glazing; no extra render target or light is added. Only the selected boat is visible; spray is capped at 192 points in one draw.

Validation commands: `npm run check`, `node --experimental-strip-types --test src/belle/boatController.test.ts src/belle/boatAssets.test.ts src/belle/flightCollision.test.ts`, production build, then `node scripts/boat-browser-smoke.mjs` from `../game`. The browser check uses the real built island and native input for both boat choices, cockpit view, movement, braking, pause, shore return and phone controls. Software-browser results do not certify physical-device performance.
