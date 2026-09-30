# Atwater local build — 28 September 2026

Default free-ride spawn follows mapped Atwater Street west from the Cut entrance. Existing OSM footprints and roads remain authoritative. The terrain corridor now extends toward the Renaissance Center instead of ending at the Cut streaming area.

Renaissance Center is an original Blender skyline model, anchored at approximately 42.3298,-83.0397. Seven cylindrical towers, floor bands, crowns and podiums are merged into four material batches. Published central tower height: 221.5 m. Satellite offsets, facade details and smaller tower dimensions are approximations, not survey measurements. Existing neighborhood facades still need individual photographic verification; this is not an exact reconstruction of every apartment or condominium.

References:
- Google Maps satellite, viewed 2026-09-28: https://www.google.com/maps/@42.3328,-83.0316,16z/data=!3m1!1e3
- https://www.skyscrapercenter.com/complex/487
- https://www.hamilton-anderson.com/project/orleans-landing/
- https://www.detroitriverfront.org/plan-your-visit/parks-greenways/dequindre-cut

Original Higgsfield glass texture job: 3a056914-2bb2-49f0-8a1a-fcd69956b417. Generated facade pattern; not a photograph or map texture. Blender source and FBX accompany the game GLB. FBX and texture copied into the existing Unity asset-review project under Assets/Atwater. Unity 6.3 successfully opened Assets/Atwater/AtwaterReview.unity; no terms dialog remained on the successful editor launch.

Local changes only. Browser game remains Three.js; Unity files are an asset review, not a Unity game port. VR must still be tested on an actual headset.

2026-09-29: Restored the original head-position-only first-person camera from commit 364cdee3. Added original Gothic-futurist exterior overlays in Blender, retaining existing interiors; these are fictional Mack destinations, not claims of real buildings. Entrances align across the mapped Mack centerline. Reused the generated Higgsfield glass skin. Added street-name signs, two authored destination parking lots with stop signs, shoreline water and a collision-backed Milliken berm/viewing walk. Berm location follows satellite reference, elevation is estimated. Reference: https://www.michigan.gov/recsearch/parks/williammilliken .


2026-09-29 park/sign pass:
- Google satellite and Maps Street View/360 gallery inspected for the harbor and Ze Mound. Lighthouse map anchor: 42.3322455,-83.0249708. Official DNR park page confirms 63-foot lighthouse, accessible berm walkway/handrails and two scenic viewers.
- Original Blender lighthouse and viewers exported as GLB/FBX/BLEND. Higgsfield masonry job 1595be8f-a570-467e-9784-de013ce6d21c. Generated texture is original, not Google imagery.
- Added lighthouse pier/collision and summit viewers; handrails follow the existing authored berm. Mound height and path shape remain estimated. Harbor slips, amphitheater and every apartment facade are not fully reconstructed by this pass.
- Unity source FBXs, texture and prefab-import editor script are in the existing Atwater asset-review project. This remains a browser game, not a Unity runtime conversion.
- Street blades now have independent readable front/back faces, aluminum edges, bolts, galvanized posts and white borders. Stop signs are authored minor-road approach controls; locations are inferred from mapped junctions, not verified legal traffic-control inventory.
References: https://www.michigan.gov/recsearch/parks/WilliamMilliken ; https://www.google.com/maps/@42.3332057,-83.0246261,635m/data=!3m1!1e3 ; https://historicdetroit.org/buildings/milliken-state-park-lighthouse ; https://www.michigan.gov/oac/about/history

2026-09-29 correction after direct Street View review:
- Corrected Ze Mound from the erroneous east-harbor location to Google Maps POI 42.3318321,-83.0273376 (west of harbor). Terrain detail sampling, walkway, railings and viewers share this anchor. Added the Ze Mound overlook start option. Footprint/elevation remain estimated.
- Inspected Google Street View along Orleans Street (Nov 2024), including 240, 172, 205 and 100 Orleans. The Atwater junction visibly has an ALL WAY stop plaque, paired crosswalk boundary lines and stop bars. Added three mapped T-junction approaches; exact pole offsets remain approximate. Removed inferred Atwater-area controls rather than presenting them as verified.
- Corrected shared STOP backing rotation and reflected-map lettering UVs globally. Corrected stop shoulder side for the map reflection. Existing globally draped curbs now have cleaner Atwater lawn edges after removing coarse asphalt terrain wedges.
- Orleans Landing footprints 965070591-965070602 now use original brick/siding/window/balcony facade art. Corner 965070592 is four stories; remaining rows three stories. This is a reference-informed interpretation, not a complete photographic replica of every Atwater building.
- Verified TypeScript, production package build and 3 Atwater regression tests; browser error log empty. Browser screenshot confirms readable STOP/ALL WAY lettering and crosswalk markings.
Reference: https://www.google.com/maps/@42.333049,-83.0276532,3a,75y,180h,90t/data=!3m4!1e1!3m2!1s0K0MC52F8kM0P7RTgDV4hw!2e0
