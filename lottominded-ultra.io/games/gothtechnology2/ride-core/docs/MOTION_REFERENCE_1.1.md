# RideCore 1.1 — responsive upper body

Reference: [Gadget Glimpse: InMotion Adventure V14](https://www.youtube.com/shorts/P2B4jCIbI3A), inspected in Edge, especially the riding and hop demonstration around 19–29 seconds. These are original procedural motions authored from visual reference, not extracted motion capture or copied animation data. No video media is bundled.

The reference shows soft elbows, unequal arm heights while balancing, hands hanging below the forearms, and the wheel moving beneath flexed knees. The update adds a preparation/reach/settle arm sequence to existing hops, arm-velocity-driven wrist lag, and outward elbow clearance during raised-arm poses. Shoulders mirror correctly through opposite turns. Head anticipation and distributed torso bending remain active.

Suspension compresses during hop preload and extends on takeoff. Rider height and pedal targets use the same travel. Wheel steering, speed, traction, grounded tyre rotation and collision behavior retain the existing simulation. No perpetual steering wobble or hand flutter is added.

Use existing `RideController` / `RideCore` inputs and `ThreeRiderView.apply(pose)`; no new input bindings are required. Human foot-down stops remain; mascot profiles keep both feet on the pedals. This update animates hands at the wrists; it does not add individual finger capture.

Validation: game typecheck and 204 tests passed, including actual character skeleton/geometry checks, falls, pedal fit, mirror balance, wrist settling and deterministic playback. Physical VR headset validation remains separate from this animation update.
