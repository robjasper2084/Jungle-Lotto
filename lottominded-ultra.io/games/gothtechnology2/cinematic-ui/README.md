# Cinematic game startup

Swoop Detroit and Elmwood Explorer share the scoped startup controller in `src/cinematicStartup.ts`. Their source adapters keep the first screen open until Press Start, then close subsequent ride-loading screens as soon as the ride is ready. Static Royale uses its existing startup flow.

Media lives in each game's `public/cinematics/` and is included by both packaging scripts. Startup videos play once, then loading loops repeat silently. Media failure never prevents the game from becoming ready; key art stays visible. Reduced motion (system preference or `?reducedMotion`) uses still artwork and skips video loading. Pause Motion also stops CSS animation.

The percentage represents completed setup steps, not estimated elapsed time or byte progress. Swoop completes graphics initialization, rider/physics loading, nearby interiors, scenery, and controls. Elmwood completes manifests/terrain, foundation, entrance assets, environment setup, and controls. Only the final ready gate sets 100%. Later ride initialization has an indeterminate bar because its asset set depends on the selection.

Media was created using Higgsfield Seedance 2.5. Elmwood title job `95f0e28f-6db0-4cc9-8fad-7a51f2e9ff5b` replaces the rejected firefly effect with moonlit mist. Swoop title job `1f1b8b47-7039-4288-a856-3f106114b0a3` provides the electric accent. Full generation records and original media are preserved in the workspace's `output/game-cinematics-20261016/seedance-2.5-redo` folder.

Installed locally in source, packaged games, and localhost:8242 preview. No public publication is implied. Previous source and preview entry points are saved in `output/cinematic-install-backup`; packaging retains prior packages under `.game-builds`.
