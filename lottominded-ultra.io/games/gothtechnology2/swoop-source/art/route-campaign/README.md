# Swoop campaign assets

Original Higgsfield artwork generated on 2026-09-23 using the user's supplied LottoMind references, sunset inspiration and GothTechnology clothing collection images. Model: gpt_image_2_5. Job IDs and provenance are in docs/swoop-polish/mack-field-and-campaign.md in the worktree.

- lottomind.jpg: Carry Your Signal; job 9b7ac09b-9cb5-4622-b431-aea7c1aadf65.
- gothtechnology.jpg: Detroit After Dark clothing; job afe0171a-8d49-47b6-9b3b-1b523e5e94c9.
- detroit-dreams.jpg: sunset mural; job fbfbc89b-5e54-470b-b1c5-d02c036dc7aa.

Original PNGs are retained. Runtime JPEGs are 1280 x 720. Artwork is printed, not an emissive light source. Clothing concepts are not represented as available merchandise.

Swoop_Campaign_Props.blend contains all three props, separated for inspection. Individual GLB/FBX exports use metre units, ground pivots and packed/embedded images. Billboard artwork is 6.4 x 3.6 m, starting 1.5 m above the ground. Front and back have independent readable UVs. Mural is 3.698 x 2.08 m. Rebuild with Blender --background --factory-startup --python scripts/build_campaign_assets.py. The browser creates matching supports at local terrain height; reusable exports assume a flat placement plane.

Unity project Assets/SwoopField/Campaign contains the FBXs and textures. Unity's licence service blocked its import verification; no verified unitypackage is included. These GLBs, FBXs and the Blender scene were successfully exported independently of Unity.
