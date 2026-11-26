# Cadillac modifications

Both the silver Cadillac and the hydraulic Cadillac have a **Hydraulics, wheels & tires** button in the Ride menu. It opens **Cadillac modifications** under **Ride your way**. Stop the car before changing its setup.

## Smart Pump and Hydraulic Mode

Choose **Hydraulic mode** in the Ride menu, or press **H** while parked. The car stays parked until you exit the mode. In third person, a compact radial control appears with three one-touch poses:

| Smart Pump pose | Front axle | Rear axle |
| --- | --- | --- |
| Front up | 22 cm | 14 cm |
| Back up | 14 cm | 22 cm |
| Pancake | Factory height | Factory height |

Open **Advanced corners** for the four individual sliders. Each lift eases into motion and comes to rest gradually. You can change a target during a lift; the new motion begins at the car's actual current height. Every new path still goes through the fender, terrain and panel clearance checks. **Finish & level** finishes a hop and levels the selected heights.

Press **V** to switch to the cabin view. A black and chrome console between the front seats has three physical toggle switches corresponding to the Smart Pump poses. A short click or tap on a switch flicks its lever; a camera drag does not activate it. In Hydraulic Mode, drag open canvas space on either side to look around; the ordinary steering/look split resumes after you exit. Switching works only while parked in Hydraulic Mode, from the cabin and within reach, with an unobstructed view of the switch. The console's indicator follows the accepted preset, including commands from the overlay or keyboard.

The cabin also supports **7: Front up**, **8: Back up**, and **9: Pancake**. These shortcuts work when a hydraulic button has keyboard focus; typing into a slider or other input retains that control's normal behavior. **H**, **Escape**, or **Exit mode** returns to driving controls. Uneven corners level before driving resumes. Losing focus, pausing, leaving the Cadillac or changing activities clears the active mode and any unfinished pointer gesture.

Accepted commands produce a subtle mechanical click and hydraulic hiss when **Vehicle effects** are enabled in the existing audio settings. The effect follows that volume and mute setting. It does not start during loading, restored preferences or rejected commands.

## Wheels and tires

| Control | Choices |
| --- | --- |
| Rim style | Original Cadillac; gold wire with a chrome lip; polished chrome wire |
| Tire profile | Standard sidewall; whitewall; low-profile blackwall; low-profile whitewall |
| Center cap | Polished gold; black and gold; white and gold |

Center caps apply to the two custom wire rims. **Original Cadillac** restores the vehicle's own rims, including the hydraulic Cadillac's red and gold finish. The low-profile options increase the rim opening while preserving the tire's outside rolling diameter. Changes appear while Settings is open.

The last wheel, tire and cap selection is remembered on this browser. Suspension height and active motion are reset for each new ride.

## Hydraulic suspension

Each corner has its own height slider, measured above the factory stance. The slider range is **0–24 cm**. The usable combination depends on the vehicle, steering angle and surrounding clearance; a requested combination can be rejected without changing the current setup.

| Action | Result |
| --- | --- |
| Lower / Stock height | Return all four corners to the factory stance, 0 cm |
| Raise | Set all four corners to 14 cm |
| Level corners | Set all four corners to the average selected height |
| Full-car hop | Play one hop using all four wheels |
| Front hop / Rear hop | Play one hop using the selected axle |
| Finish motion & level | Close Settings, finish any current hop, then level at the average selected height |

Height targets apply immediately while Settings is open, and the separate suspension preview eases the car toward them while driving stays paused. With reduced motion, heights apply without a transition. A hop closes Settings so its animation can run. Allow a hop to land and its short cooldown to finish before starting another.

For independent corner adjustment, **Raise** provides more room around the tires than the factory stance. If a change would push a tire farther into its fender, the editor identifies the affected corner and keeps the prior setup. Straightening the wheels or choosing a more level stance can provide more clearance.

Hops, uneven stances and Hydraulic Mode hold steering and propulsion at the pose checked for clearance. After leaving the mode, applying the accelerator to an uneven stance first levels the car; normal driving resumes once it is ready. Doors and the trunk retain their own animations and are included in clearance checks. A command can also be refused when terrain, an obstacle or an open panel blocks its path.

With **Reduced camera motion** enabled, static height and wheel changes remain available and hop buttons are disabled. The editor supports keyboard navigation, native select and slider keys, and touch controls; its controls have a minimum 44-pixel target size.

## Implementation and verification

- Suspension presentation is separate from wheel spin, steering, access-panel animation and the vehicle's ground transform.
- `HydraulicController` applies one shared smoothstep progression along the checked current-to-target segment. It accounts for the curve's peak speed to retain the existing 0.35 m/s actuator limit, finishes at exact endpoints and never overshoots during retargeting.
- The physical switch bank has fixed shared geometry and materials and adds no textures. Switch picking uses the actual cabin and occupant geometry on a pointer gesture; there are no per-frame raycasts. A completed stationary primary-pointer tap is required, and mode/perspective/reach are checked again on release.
- Hydraulic audio creates its context only after an accepted trusted gesture. It owns at most two short voices, caches one original noise buffer, limits repeated feedback and stops on mute, focus loss or teardown.
- Tire contact follows the same rendered-road contact surface used by the current vehicle integration. Collision bounds include the selected tire profile, the front wheels' steering angle and open access panels.
- Authored fender crown geometry is captured once. Candidate motion is checked against that geometry before being accepted, preserving the source model's existing overlap allowance. This is a bounded clearance guard, not a general deformable-body simulation.
- Custom wheel geometry is cached and shared across the four wheels. Selection changes add no textures, and returning to the original setup restores the source materials.
- `npm run check`, `npm test` and `npm run build` validate the source and production build. The tests include the actual vehicle GLBs, wheel restoration, independent suspension, eased Smart Pump paths and retargeting, hop and landing paths, ground-attitude holds, collision bounds, access-panel independence, cabin input gating and audio lifecycle.
- The **Belle Isle Cadillac modification controls** workflow builds the exact candidate commit and runs both vehicles at desktop, small-phone and compact dimensions. It retains native-input evidence, screenshots and reports even on failure. Its Chrome SwiftShader runs establish browser behavior and layout; they do not certify physical-device performance or replace the existing sustained-performance gates.
