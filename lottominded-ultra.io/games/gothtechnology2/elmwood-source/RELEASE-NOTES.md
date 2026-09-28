# Elmwood local feature check — 2026-09-27

Local build: /arcade/elmwood-explorer/elmwood.html on port 8210. Not deployed.

- Added Main menu with Free ride, Creek lane sprint, Two-minute trick session and Creek lane discovery; solo/two-player selection, resume, controls, landmark exploration and Return to Swoop Detroit.
- Two independent RideCore players share terrain and scenery. Separate keyboards, standard gamepads and per-player touch controls; movable/remappable layouts saved by orientation.
- Boerboel follows either/both players. Authored Blender Sit and Down clips retain the original idle/trot/run clips. Automatic sit after a one-second stop; Sit/Down/Stay/Come/Chase/Bark via buttons and opt-in browser speech recognition.
- Local behavior includes obstacle routing, fast regrouping when trapped, solid bird contacts, limited chases, return from pond edge, alert head turn, tail wag disabled, grounded seated skin and synthesized bark bursts. Nearby birds and five lane walkers flee a pursuing/barking dog.
- 5,247 creek-bank blooms plus 4,392 garden blooms. Placement excludes paths, parking, building footprints, grave markers and areas outside the cemetery boundary; planting is interpreted, not a surveyed botanical inventory.
- Hammond's grass bank extends into the sampled ridge, with matching ride height. The earlier 2018 Chrysler reference asset and two placements remain.

Checks: TypeScript; 31 dog, session, wildlife and terrain checks; 4 planting checks; 5 RideMotion checks. Browser verified Main Menu mode switching, Down, selecting chase targets, bark activation, P2-only motion/120-point trick scoring, portrait/landscape split rendering and saved moved/remapped touch controls. No captured browser errors in the QA tabs. Microphone recognition and physical two-controller/multifinger hardware were not tested.

Swoop shops and freestyle park stay in Swoop Detroit; the return link opens that game. This is not a full map/shop port or online multiplayer.

Release update: six rider choices, three from Swoop; P2 chestnut-fawn dog material; Low/Balanced/High/Auto graphics, 30/60 FPS caps, scenery distance, flower density, shadow and resolution changes. Main menu suspends rendering. Three photography visitors and two yielding cyclists, distance-driven planted footsteps. Swoop first-person movement, head anchor and look; third-person RideCore follow. Rare spirits limited to one or two per ride.

Higgsfield title edit job c1b1d799-6bae-4a25-a557-145b76caf389 replaces job 35b67dee-0803-4423-9f30-1a6056183a8f. Boerboel reference: https://www.dogsfiles.com/index.php?breed=293&did=43482&ind=dogsbase&nlang=en&op=view . Breed standard checked against https://images.akc.org/pdf/breeds/standards/Boerboel.pdf and Google Images. Docked tail, broad head and fawn black-mask coat. Artwork is generated illustration, not surveyed imagery.

Latest checks: TypeScript and 27 camera, dog skin-grounding, disabled-tail, session, wildlife, graphics, all rider assets and planted-foot tests passed. Physical low-end hardware has not been benchmarked.
