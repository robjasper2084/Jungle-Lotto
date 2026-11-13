# Conservatory garden and environment update — November 13, 2026

## Provenance and release state
Prepared against production 4a2b67d0b10beafb7c999f11985e45a4e45adb94.
These are proposed changes, not a passed release or live deployment.
No original maze was found in the inspected tracked source or GLB metadata.
The 7×5-cell hedge maze is original fictional game content, not a recovered asset or a claim about a historic maze at the real Conservatory.

## Runtime
Fixed passages produce 46 shared render/collision walls. The garden lawn placement preserves mapped paths, greenhouse entrances and the pond gate. Island guide → Conservatory Garden Maze → Walk to maze entrance uses existing travel and voluntary dismount outside the maze, not corridor teleportation. Opaque instanced hedge cores/caps and gravel use three draw batches without new media, lights, animation loops or rewards. Height-limited collision allows flight above the hedges. Gameplay walls remain on all graphics qualities.

Cloned tree leaves and split-screen cards are 12% broader without additional vertices, draws, changes to trunk collision, near-detail budgets or seasonal density. Botanical basal clusters are modestly fuller within the existing fixed triangle budget. Detailed gardens reduce gradually from full count at 85 m to 35% at 150 m instead of an abrupt count switch.

Directional aerial perspective uses the existing fog shader. The added blend is at most 2.2% (1.2% Smooth/XR), absent within 150 m and at night. This is not foreground-occluded volumetric god rays. No new fullscreen pass, texture, fog-density increase, clock or camera motion is added.

## Required evidence
Retain the entire original test registry and add maze topology, real walking-controller, collision and presentation regressions. Require full dependency-backed strict checks/tests/builds, real desktop/phone WebGL review, normal maze traversal, pause/reduced motion, quality transitions and compact 44px controls. Keep all seven release workflows, original deadlines and the 1024 MiB Pages cap. Before/after screenshots must use matched cameras, season, quality and lighting. Software CI does not certify physical-device FPS or endurance. Only a successful guarded follow-up merge, production deployment and exact public verification establish publication.
