# Installed mocap and City in Motion

The existing Unity cache supplies CMU 55_04 walking (Huge FBX Mocap Library part 2), A_JogFwd_Loop, A_RunFwd_Loop, A_Lift_Light_PickUp_0cm_02_R and A_ItemPickup_fromIdle_RH_100cm (Free Sample Animation Set), and anim_OpenDoor_Push_R (Free Interaction Animation). Source packages stay local; no original pack FBX files are published.

Blender sampled anatomical shoulder, elbow and torso channels. These drive the original game skins, blended with the existing anatomical solver. Foot contact remains distance matched procedural IK. This is a hybrid retarget, not full-body playback of the vendor skeleton. Short mascot strides use body-sized cadence, lift and inner knee reach. Swoop pedestrians and gallery visitors use the new motion; store browsing uses the reach gesture. Elmwood walkers use recorded walking arm swing. Pickup is available to the interaction player and local baked clip set; it does not replace mounted wheel recovery physics.

Validation: both TypeScript checks; 15 Swoop geometry/retail tests; 30 local hero/action bakes covering five skins and walk, jog, run, door, pickup, reach. Floor clearance, ankle reach, finite rotations, bone lengths and hand continuity are checked. This does not verify frame rates across every map.

City in Motion is a 36.75-second, 1280x720, 24 fps Higgsedit film from the user-generated Detroit ride and three store entrance videos, with the generated ride soundtrack. It is the first GothTech cinema program; rotation is off by default. Playback and sound require explicit controls. It is not a startup loading video. Ready to Ride keeps the compact Start/Learn card and electric-unicycle choices only.
