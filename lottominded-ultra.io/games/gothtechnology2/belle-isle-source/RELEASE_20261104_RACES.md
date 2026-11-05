# Belle Isle race and ride release

- Three road-following island circuits (10.2 / 10.2 / 10.9 km), all starting and finishing at the Jefferson bridge approach.
- Up to four racers: offline AI, local split-screen, or online room participants; ordered checkpoints, recovery penalty, laps, results and rematch.
- Route previews, per-player maps, next checkpoint guidance and the supplied Detroit checkpoint artwork.
- Hoverbike remains the default exploration ride; races use one-wheel riders.
- Includes the completed cockpit LCD, camera grip and lens controls, drone flight, river traffic, startup sky/ride preview and Ambassador silhouette updates.

## Verification
- TypeScript check passed. Full suite: 232 passing, zero failing, including actual RideCore completion of every island circuit.
- Clean isolated source build passed with packaged checkpoint artwork. Landmark compression losslessly reduced 49.83 MB to 28.15 MB.
- Chrome startup selected hoverbike; four-player race renders individual cameras, maps and controls. Banner orientation and HUD overlap corrected during review.
- Real four-player network/device testing, iPad performance and Quest testing remain outstanding. No sustained FPS claim is made.
