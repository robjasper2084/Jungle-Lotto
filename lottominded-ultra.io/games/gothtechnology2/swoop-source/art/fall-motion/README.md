# Swoop fall motion controls

Editable Blender Action with five contact-relative posture channels. 120 Hz samples ship in src/detroit/fall-curves.json. The game retargets these controls to all four supplied rider skeletons with its existing two-bone IK; terrain sweeps remain authoritative. This is a procedural animation control asset, not motion capture or a ragdoll. No paid plug-in is required.

Rebuild: blender --background --factory-startup --python scripts/build_fall_motion.py
