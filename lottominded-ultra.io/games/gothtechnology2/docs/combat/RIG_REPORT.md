# Rig fit and ownership

Five original rider skeletons and three actual equipment GLBs are loaded by combatRig.test.ts. Base EUC motion is evaluated first. Torso yaw uses world up, converted to the parent bone frame. An independent weapon frame supplies the right-hand target; dominant-hand reach is measured without stretching bones. The weapon receives that reach correction before solving the left hand. Reload releases the support target toward the magazine and returns it smoothly. No hand target depends on the same hand solver. Feet are preserved from the riding layer.

The 1,215 numerical cases cover 3 weapons x 3 aim blends x 3 yaw values x 3 roll values x 3 pitches x 5 riders, at 20 m/s. All errors are under 2 cm; feet drift is zero. Exact maxima are in evidence/rig-contacts.json. These checks use real skeletons with image decoding omitted, so they are not visual material/finger/eye-line acceptance. Reload/hop/crash, every wheel speed, LOD, remote presentation and front/side/ADS closeups remain in the acceptance matrix.

The original browser renderer owns runtime IK. Blender and Unity are actual authoring/import validation tools; no claim is made that a Unity runtime runs inside these games.
