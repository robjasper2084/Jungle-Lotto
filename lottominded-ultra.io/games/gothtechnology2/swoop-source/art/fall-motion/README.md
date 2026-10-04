# Swoop fall motion controls

Editable Blender Action with five contact-relative posture channels. 120 Hz samples ship in src/detroit/fall-curves.json. The game retargets these controls to all four supplied rider skeletons with its existing two-bone IK; terrain sweeps remain authoritative. This is a procedural animation control asset, not motion capture or a ragdoll. No paid plug-in is required.

The file also includes a human metarig reference from Blender's bundled free Rigify add-on. Floating-point posture channels use smooth Bezier interpolation so the reach and impact absorption no longer snap between integer values. Both games keep their supplied rider models and skins.

Rebuild: blender --background --factory-startup --python scripts/build_fall_motion.py
