# Armored Detroit rider

Requested from the user's supplied nighttime EUC photograph,
`52590114_10158195045604167_4252205837096845312_n.jpg`.

Higgsfield reference upload: `450038fa-9d9c-43ee-89e9-10d75c7f040e`.
The user approved 4.25 credits for one detailed six-view sheet. Higgsfield
job `a6d70847-f8e8-4654-bb67-11b4fd45bb32` completed successfully using
GPT Image 2.5, high quality, 3:2. `higgsfield-six-view.png` preserves front,
back, both sides and two three-quarter views. No further paid generations
were made.

## Design and authoring

- Preserve dark riding clothes, a sculpted X-shaped back protector,
  articulated lumbar and limb guards, gloves and tall black boots.
- The front and face are inferred; the reference only establishes the rear.
- Include a separate red/black EUC reference inset, keeping the rider
  independent of the wheel so the game can drive its existing physics.
- Use the existing meter-scale 24-bone hoodie rig as a fitted foundation;
  add editable protective panels, straps, helmet, gloves and boot shells
  in Blender. Keep the original asset untouched.
- Export a new named GLB with the existing Hips/Spine/arm/leg/foot bone
  contract and independently skinned armor. Preserve source, reference,
  manifest and Blender build script together.
- Verify silhouette from front/rear/profiles, foot contact on EUC pedals,
  rider motion and actual selection in Swoop before delivery.

`base-rig-inspection.json` records the current source rig's scale, hierarchy
and bones. Direct Blender 5.2.1 LTS authoring completed without changing
the original hoodie source.

## Finished asset

`DS_Armored_Rider_01.blend` contains 97 editable protective gear parts on
the existing 24-bone rig. `build_armored_rider.py` rebuilds it from
`Armored_Rider_Setup.blend`. Front, rear and profile previews are included.
`model-report.json` records 49,277 triangles, 40,541 vertices and a
2,545,016-byte GLB.

The export is `public/exports/glb/DS_Armored_Rider_01/DS_Armored_Rider_01_LOD1.glb`.
It joins the geometry into one skinned mesh with seven editable materials,
using the games' riding animation and pedal IK. The EUC stays separate and
uses the existing physics. This is a manually modeled game asset guided
by the generated sheet, not a photogrammetry reconstruction.

Available in Swoop Detroit and Elmwood Explorer as **Armored rider · Night Sentinel**.

## NVIDIA detail bake

`bake_armored_optix.py` uses the RTX 3080 through Blender Cycles NVIDIA OptiX. The runtime GLB includes a 1024px occlusion atlas and the same 24-bone rig, with seven materials. `DS_Armored_Rider_01.blend` retains the editable gear; `DS_Armored_Rider_01_Runtime.blend` contains the joined UV-unwrapped export. No extra runtime geometry or NVIDIA-specific browser dependency is required. See `nvidia-bake-report.json` for measured bake details.
